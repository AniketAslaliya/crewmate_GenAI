from __future__ import annotations

import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional

from .extract import extract_text_with_diagnostics
from .chunking import chunk_text
from .models import call_model_system_then_user
from .vectorstore_pinecone import get_or_create_index, namespace, query_top_k

# Heuristic keywords
LEGAL_KEYWORDS = [
    "agreement", "party", "parties", "indemnify", "indemnity", "warranty", "liability",
    "governing law", "jurisdiction", "termination", "clause", "herein", "hereby",
    "force majeure", "arbitration", "confidentiality", "non-disclosure", "nda"
]

try:
    from wordfreq import zipf_frequency
except Exception:
    zipf_frequency = None


def _simple_clean_tokens(text: str):
    tokens = re.findall(r"\b[A-Za-z\-']+\b", text)
    return [t.lower() for t in tokens]


def detect_legal_like(text: str, threshold: int = 3) -> bool:
    low = text.lower()
    count = sum(1 for kw in LEGAL_KEYWORDS if kw in low)
    return count >= threshold


def detect_hard_words(text: str, top_n: int = 40) -> List[str]:
    tokens = _simple_clean_tokens(text)
    counts = Counter(tokens)
    scored = []
    for w, c in counts.items():
        if len(w) < 4:
            continue
        freq_score = None
        if zipf_frequency is not None:
            try:
                freq = zipf_frequency(w, "en")
                freq_score = freq
            except Exception:
                freq_score = None
        rarity = (0 if freq_score is None else (7.0 - freq_score))
        length_factor = max(0, (len(w) - 6) / 10.0)
        score = rarity * 1.2 + length_factor + math.log(c + 1)
        scored.append((w, score, c, freq_score))
    scored.sort(key=lambda x: (-x[1], -x[2]))
    terms = [t[0] for t in scored[:top_n]]
    stop_like = {"section", "shall", "including", "included", "thereof", "hereby"}
    terms = [t for t in terms if t not in stop_like]
    return terms


def quick_analyze(user_id: Optional[str], thread_id: str) -> Dict[str, Any]:
    """
    Fast summary + basic keywords, without touching FAISS.
    """
    try:
        extraction = extract_text_with_diagnostics(file)
        text = (extraction.get("text") or "")
        if not text.strip():
            return {"success": False, "message": "No text extracted for analysis.", "diagnostics": extraction.get("diagnostics", {})}

        n = len(text)
        first = text[:2000]
        middle = text[max(0, n // 2 - 1000): min(n, n // 2 + 1000)]
        last = text[-2000:]
        sample = "\n\n---\n\n".join([first, middle, last])

        system_prompt = (
            "You are a concise legal document analyst.\n"
            "Using only the provided document excerpts, produce: (A) a short plain-English summary aimed at a non-lawyer, "
            "(B) three short factual bullets labelled FACTS that are explicitly supported by the excerpts, and "
            "(C) a single-line confidence indicator (High/Medium/Low)."
        )
        user_prompt = f"Document excerpts:\n{sample}\n\nReturn: (1) 3-sentence summary, (2) three FACTS bullets, (3) Confidence:"

        summary_text = call_model_system_then_user(system_prompt, user_prompt, temperature=0.2)

        tokens = _simple_clean_tokens(text)
        counts = Counter(tokens)
        common = [w for w, _ in counts.most_common(30) if len(w) > 4][:15]
        legal_like = detect_legal_like(text)

        return {"success": True, "summary": summary_text, "keywords": common, "legal_like": legal_like}
    except Exception as e:
        return {"success": False, "message": f"quick_analyze error: {e}"}


def quick_analyze_thread(user_id: Optional[str], thread_id: str) -> Dict[str, Any]:
    """
    Wrapper: run quick_analyze for the ingested file belonging to (user_id, thread_id).
    """
    try:
        # Query Pinecone for the ingested file metadata
        index = get_or_create_index(dim=384)  # Example dimension, adjust as needed
        ns = namespace(user_id, thread_id)
        query_result = query_top_k(index, ns, query_vec=[0.0] * 384, top_k=1)  # Example query vector

        if not query_result:
            return {"success": False, "message": "No ingested file for this thread."}
        prompt = {"(B) three short factual bullets labelled FACTS that are explicitly supported by the excerpts, and "
            "(C) a single-line confidence indicator (High/Medium/Low)."}
        # Extract filepath from metadata
        

        return quick_analyze( user_id, thread_id)
    except Exception as e:
        return {"success": False, "message": f"quick_analyze_thread error: {e}"}


# alias for backward-compat
quick_analyze_for_thread = quick_analyze_thread


from backend_rag.vectorstore_pinecone import get_or_create_index, namespace, query_top_k
from backend_rag.models import call_model_system_then_user


def generate_study_guide(user_id: Optional[str], thread_id: str, max_snippets: int = 8) -> Dict[str, Any]:
    """
    Build a study guide from representative snippets stored in Pinecone.
    """
    try:
        index = get_or_create_index(dim=384)  # Example dimension, adjust as needed
        ns = namespace(user_id, thread_id)
        query_result = query_top_k(index, ns, query_vec=[0.0] * 384, top_k=max_snippets)

        if not query_result:
            return {"success": False, "message": "No document excerpts available for study guide."}

        snippets = [hit.get("metadata", {}).get("text", "").strip() for hit in query_result if hit.get("metadata", {}).get("text", "").strip()]
        if not snippets:
            return {"success": False, "message": "No valid snippets found in Pinecone."}

        context_excerpt = "\n\n---\n\n".join([s[:2000] for s in snippets])
        system_prompt = (
    "You are a concise legal document analyst.\n"
    "Using only the provided document excerpts, extract key factual points.\n"
    "Rules:\n"
    "- Generate approximately 1 FACT for every 100 words of text.\n"
    "- Each FACT should be 1–2 sentences: clear, specific, and not vague.\n"
    "- Do not include opinions, interpretations, or assumptions—only what is explicitly supported by the excerpts.\n"
    "- Keep the wording concise but complete, neither too short nor too long.\n"
)

        user_prompt = f"Document excerpts:\n\n{context_excerpt}\n\nProduce the Study Guide as requested above."

        guide_text = call_model_system_then_user(system_prompt, user_prompt, temperature=0.2)
        return {"success": True, "study_guide": guide_text}
    except Exception as e:
        return {"success": False, "message": f"generate_study_guide error: {e}"}
    
def get_term_context(user_id: Optional[str], thread_id: str, term: str) -> Dict[str, Any]:
    """
    Quick, paragraph-anchored explanation of a term within the uploaded doc.
    """
    try:
        filepath = _read_ingested_filepath(user_id, thread_id)
        if not filepath:
            return {"success": False, "message": "No ingested file for this thread."}

        extraction = extract_text_with_diagnostics(filepath)
        text = extraction.get("text", "") or ""
        if not text:
            return {"success": False, "message": "No text available."}

        m = re.search(r"([^.]{0,300}\b" + re.escape(term) + r"\b[^.]{0,300}\.)", text, flags=re.I | re.S)
        paragraph = m.group(0) if m else text[:400]

        q_prompt_sys = (
            "You are a legal assistant. Explain the requested term in plain English in the context of the provided paragraph. "
            "Keep the definition short (1-2 sentences), give one concrete example relevant to the document, and list any immediate "
            "legal implications or actions (one line). If the paragraph does not define the term, say 'Not stated in document.'"
        )
        q_user = f"Term: {term}\n\nParagraph:\n{paragraph}\n\nDefinition:"

        definition = call_model_system_then_user(q_prompt_sys, q_user, temperature=0.0)
        return {"success": True, "term": term, "definition": definition, "snippet": paragraph}
    except Exception as e:
        return {"success": False, "message": f"get_term_context error: {e}"}


def generate_faq(user_id: Optional[str], thread_id: str, max_snippets: int = 8, num_questions: int = 10) -> Dict[str, Any]:
    """
    Generate an FAQ (questions & answers) based ONLY on the uploaded document excerpts stored in Pinecone.
    """
    try:
        index = get_or_create_index(dim=384)  # Example dimension, adjust as needed
        ns = namespace(user_id, thread_id)
        query_result = query_top_k(index, ns, query_vec=[0.0] * 384, top_k=max_snippets)

        if not query_result:
            return {"success": False, "message": "No document excerpts available for FAQ generation."}

        snippets = [hit.get("metadata", {}).get("text", "").strip() for hit in query_result if hit.get("metadata", {}).get("text", "").strip()]
        if not snippets:
            return {"success": False, "message": "No valid snippets found in Pinecone."}

        context_excerpt = "\n\n---\n\n".join([s[:2000] for s in snippets])
        system_prompt = (
            "You are an expert FAQ writer for legal/technical documents. "
            "Using ONLY the provided excerpts (DO NOT use outside knowledge), create a concise FAQ in MARKDOWN.\n\n"
            "Rules:\n"
            "- Write exactly between 6 and {nq} Q&A pairs (aim for {nq} if material supports it).\n"
            "- Each question should be short and practical for a non-expert.\n"
            "- Each answer must be STRICTLY supported by the excerpts. If not present, write exactly: 'Not stated in document.'\n"
            "- Keep each answer 1–3 short sentences max. Avoid boilerplate and legalese.\n"
            "- If you quote, include only a short snippet (<=200 chars) and append '(excerpt)'.\n"
            "- Do NOT invent numbers, dates, obligations, or parties.\n"
            "- Output format (Markdown): use '### Q: ...' then on next line 'A: ...'. No extra commentary.\n"
            ).format(nq=num_questions)

        user_prompt = (
            f"Document excerpts:\n\n{context_excerpt}\n\n"
            "Now produce the FAQ as per instructions."
        )

        faq_md = call_model_system_then_user(system_prompt, user_prompt, temperature=0.2)
        return {"success": True, "faq_markdown": faq_md}
    except Exception as e:
        return {"success": False, "message": f"generate_faq error: {e}"}
        
def generate_timeline(user_id: Optional[str], thread_id: str, max_snippets: int = 10) -> Dict[str, Any]:
    """
    Generate a chronological timeline using ONLY the uploaded document excerpts stored in Pinecone.
    """
    try:
        index = get_or_create_index(dim=384)  # Example dimension, adjust as needed
        ns = namespace(user_id, thread_id)
        query_result = query_top_k(index, ns, query_vec=[0.0] * 384, top_k=max_snippets)

        if not query_result:
            return {"success": False, "message": "No document excerpts available for timeline generation."}

        snippets = [hit.get("metadata", {}).get("text", "").strip() for hit in query_result if hit.get("metadata", {}).get("text", "").strip()]
        if not snippets:
            return {"success": False, "message": "No valid snippets found in Pinecone."}

        context_excerpt = "\n\n---\n\n".join([s[:2000] for s in snippets])
        system_prompt = (
            "You are a precise timeline builder. Using ONLY the provided excerpts (no outside knowledge), "
            "produce a chronological TIMELINE in MARKDOWN.\n\n"
            "Rules:\n"
            "- Include ONLY events that have a complete calendar date (day, month, year) in the excerpts.\n"
            "- Normalize ALL dates to DD/MM/YYYY (e.g., 01/02/2024).\n"
            "- Format strictly as a Markdown table with columns: Date | Event (NO other columns).\n"
            "- Sort rows earliest → latest.\n"
            "- If fewer than 6 dated events are present, output exactly: 'No timeline to show in your document.'\n"
        )
        user_prompt = (
            f"Document excerpts:\n\n{context_excerpt}\n\n"
            "Now produce the TIMELINE as instructed above."
        )

        timeline_md = call_model_system_then_user(system_prompt, user_prompt, temperature=0.2)

        # Ensure timeline is sorted and in one format
        timeline_lines = timeline_md.split("\n")
        sorted_timeline = sorted(
            [line for line in timeline_lines if "|" in line and line.strip()],
            key=lambda x: x.split("|")[0].strip()
        )
        final_timeline = "\n".join(sorted_timeline)

        return {"success": True, "timeline_markdown": final_timeline}
    except Exception as e:
        return {"success": False, "message": f"generate_timeline error: {e}"}