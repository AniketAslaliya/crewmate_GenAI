from __future__ import annotations

import json
import math
import re
import os
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote
import httpx
# Near the top of analysis.py
# In backend_rag/analysis.py (at the top with other imports)
   # <-- NEW
# External dependencies used across versions
from bs4 import BeautifulSoup, NavigableString

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


def _read_ingested_filepath(user_id: Optional[str], thread_id: str) -> Optional[str]:
    """
    Helper to discover a source filepath (if any) from Pinecone metadata for the given thread.
    Returns the filepath string or None.
    """
    try:
        index = get_or_create_index(dim=384)
        ns = namespace(user_id, thread_id)
        results = query_top_k(index, ns, query_vec=[0.0] * 384, top_k=1)
        if not results:
            return None
        md = results[0].get("metadata", {})
        # try common metadata keys
        for key in ("filepath", "source", "file", "path"):
            if md.get(key):
                return md.get(key)
        return None
    except Exception:
        return None


# ------------------- Quick analysis (from first file) -------------------
def quick_analyze(user_id: Optional[str], thread_id: str) -> Dict[str, Any]:
    """
    Fast summary + basic keywords, without touching FAISS/Pinecone for detailed search.
    """
    try:
        # Attempt to locate the ingested filepath
        filepath = _read_ingested_filepath(user_id, thread_id)
        if not filepath:
            return {"success": False, "message": "No ingested file for analysis."}

        extraction = extract_text_with_diagnostics(filepath)
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
            "Using only the provided document excerpts, produce:\n"
            "(A) first, a plain-English statement of what this document is (e.g., contract, agreement, policy) and its general purpose,\n"
            "(B) a short 3-sentence plain-English summary aimed at a non-lawyer,\n"
            "(C) three short factual bullets labelled FACTS that are explicitly supported by the excerpts, and\n"
            "(D) a single-line confidence indicator (High/Medium/Low)."
        )

        user_prompt = f"Document excerpts:\n{sample}\n\nReturn: (1) About the document (what it is + purpose), (2) 3-sentence summary, (3) three FACTS bullets, (4) Confidence:"

        summary_text = call_model_system_then_user(system_prompt, user_prompt, temperature=0.2)

        tokens = _simple_clean_tokens(text)
        counts = Counter(tokens)
        common = [w for w, _ in counts.most_common(30) if len(w) > 4][:15]
        legal_like = detect_legal_like(text)

        return {"success": True, "summary": summary_text, "keywords": common, "legal_like": legal_like}
    except Exception as e:
        return {"success": False, "message": f"quick_analyze error: {e}"}


# ------------------- quick_analyze_thread (updated in second file) -------------------
def quick_analyze_thread(user_id: Optional[str], thread_id: str) -> Dict[str, Any]:
    """
    Wrapper: run a quick analysis using many chunks pulled from Pinecone for the (user_id, thread_id).
    Uses the improved approach from the newer codebase.
    """
    try:
        index = get_or_create_index(dim=384)
        ns = namespace(user_id, thread_id)
        
        all_chunks = query_top_k(index, ns, query_vec=[0.0] * 384, top_k=50)
        if not all_chunks:
            return {"success": False, "message": "No ingested file for this thread."}
        
        text = " ".join([hit.get("metadata", {}).get("text", "") for hit in all_chunks])
        if not text.strip():
            return {"success": False, "message": "No text content found for analysis."}

        n = len(text)
        sample = text[:4000]

        system_prompt = (
            "You are a concise legal document analyst for Indian law.\n"
            "Using only the provided document excerpts, produce:\n"
            "(A) a plain-English statement of what this document is (e.g., contract, lease agreement, policy) and its purpose,\n"
            "(B) a short 3-sentence plain-English summary for a non-lawyer,\n"
            "(C) three short factual bullet points labelled FACTS, explicitly supported by the excerpts."
        )
        user_prompt = f"Document excerpts:\n{sample}\n\nReturn your analysis."
        summary_text = call_model_system_then_user(system_prompt, user_prompt, temperature=0.2)

        return {"success": True, "summary": summary_text}
    except Exception as e:
        return {"success": False, "message": f"quick_analyze_thread error: {e}"}


# alias for backward-compat
quick_analyze_for_thread = quick_analyze_thread


# ------------------- Study guide / FAQ / Timeline / Term context
# Keep these four functions exactly as they appeared in the FIRST code version (per instruction)


# In backend_rag/analysis.py
# --- (Keep all your existing imports at the top) ---
from .vectorstore_pinecone import get_or_create_index, namespace, query_top_k
from .embeddings import get_embedding_dimension
from .models import call_model_system_then_user
from typing import Any, Dict, List, Optional
import json 
import re

# ... (Keep your other functions like quick_analyze_thread, generate_faq, etc.) ...

# =========================================================================
# === NEW DYNAMIC STUDY GUIDE (V2)                                      ===
# =========================================================================
#
# DELETE the old _legal_agent1, _legal_agent2, _legal_agent3, _legal_agent4,
# and the old generate_study_guide functions.
#
# REPLACE them with these new agents:
# In backend_rag/analysis.py

# === HELPER: UNIVERSAL ADAPTER ===
def _normalize_response(doc_type: str, raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transforms specific agent outputs into a Single Universal Schema 
    for the Frontend.
    """
    # Default Universal Structure
    normalized = {
        "document_type": doc_type,
        "title": "Untitled Document",
        "overview": "No summary available.",
        "structured_data": [],  # Frontend will loop this: [{label, value}]
        "critical_points": []   # Frontend will loop this: [string]
    }

    # --- MAP: CASE JUDGMENT ---
    if doc_type == "Case Judgment":
        normalized["title"] = raw_data.get("case_title", "Unknown Case")
        normalized["overview"] = raw_data.get("facts", "")
        
        # Map specific fields to generic structured_data
        normalized["structured_data"] = [
            {"label": "Verdict", "value": raw_data.get("verdict", "Not specified")},
            {"label": "Key Laws", "value": ", ".join(raw_data.get("key_laws", []))},
            {"label": "Precedents", "value": ", ".join(raw_data.get("key_precedents", []))}
        ]
        
        # Map issues/arguments to critical_points
        issues = raw_data.get("issues", [])
        if isinstance(issues, list):
            normalized["critical_points"] = issues[:5] # Top 5 issues

    # --- MAP: AGREEMENT/CONTRACT ---
    elif doc_type == "Agreement/Contract":
        normalized["title"] = raw_data.get("document_title", "Untitled Agreement")
        normalized["overview"] = raw_data.get("purpose", "")
        
        normalized["structured_data"] = [
            {"label": "Parties", "value": ", ".join(raw_data.get("parties", []))},
            {"label": "Termination", "value": raw_data.get("term_and_termination", "Not specified")},
            {"label": "Jurisdiction", "value": raw_data.get("governing_law", "Not specified")}
        ]
        
        # Obligations become critical points
        obligations = raw_data.get("key_obligations", [])
        if isinstance(obligations, list):
            normalized["critical_points"] = obligations[:5]

    # --- MAP: LEGAL FILING ---
    elif doc_type == "Legal Filing":
        normalized["title"] = f"{raw_data.get('filing_type', 'Filing')} - {raw_data.get('court', 'Unknown Court')}"
        normalized["overview"] = raw_data.get("summary_of_facts", "")
        
        normalized["structured_data"] = [
            {"label": "Parties", "value": ", ".join(raw_data.get("parties", []))},
            {"label": "Filing Type", "value": raw_data.get("filing_type", "Petition")}
        ]
        
        # Prayers (what they want) become critical points
        prayers = raw_data.get("summary_of_prayers", [])
        if isinstance(prayers, list):
            normalized["critical_points"] = prayers[:5]

    # --- MAP: OTHER ---
    else:
        normalized["title"] = raw_data.get("document_title", "Legal Document")
        normalized["overview"] = raw_data.get("general_summary", "")
        topics = raw_data.get("key_topics", [])
        if isinstance(topics, list):
             normalized["critical_points"] = topics[:5]

    return normalized
# --- AGENT 1: DOCUMENT CLASSIFIER ---
def _agent_classify_document_type(context: str) -> str:
    """
    Analyzes the document context and classifies it into a specific type.
    """
    print("--- [Study Guide V2 - Agent 1] Classifying document type... ---")
    system_prompt = (
        "You are a legal document classifier. Analyze the provided text excerpts and determine the "
        "primary type of the document. Respond with ONE of the following classifications ONLY:\n"
        "- 'Case Judgment' (if it's a court decision, order, or petition)\n"
        "- 'Agreement/Contract' (if it's a lease, NDA, employment agreement, settlement, etc.)\n"
        "- 'Legal Filing' (if it's a petition, affidavit, complaint, or other filing)\n"
        "- 'Other Legal Document' (for anything else, like a policy, will, or academic article)\n\n"
        "Respond with the classification string and nothing else."
    )
    user_prompt = f"Document Excerpts:\n---\n{context[:10000]}\n---\n\nClassification:"
    
    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)
        
        # Clean up the response to get one of the keys
        if "Case Judgment" in response: return "Case Judgment"
        if "Agreement/Contract" in response: return "Agreement/Contract"
        if "Legal Filing" in response: return "Legal Filing"
        return "Other Legal Document"
        
    except Exception as e:
        print(f"--- [Agent 1] Error during classification: {e} ---")
        return "Other Legal Document" # Default fallback

# --- AGENT 2: CASE JUDGMENT SUMMARIZER ---
def _agent_summarize_case_judgment(context: str) -> Dict[str, Any]:
    """
    Extracts key information from a document identified as a Case Judgment.
    This is the logic from your *original* successful prompt.
    """
    print("--- [Study Guide V2 - Agent 2] Routing to Case Judgment summarizer... ---")
    system_prompt = (
        "You are an expert legal analyst summarizing a court case document. "
        "Analyze the provided text and extract the key components into a valid JSON object.\n"
        "Required JSON Keys:\n"
        "- `case_title`: string (e.g., 'Case Name v. Respondent Name')\n"
        "- `facts`: string (a concise summary of the case facts)\n"
        "- `issues`: list[string] (a list of the main legal questions)\n"
        "- `arguments`: string (a brief summary of arguments from both sides)\n"
        "- `verdict`: string (the final operative order, e.g., 'Petition dismissed.')\n"
        "- `key_laws`: list[string] (e.g., ['Indian Penal Code, S 302'])\n"
        "- `key_precedents`: list[string] (e.g., ['Case Name v. State of U.P.'])\n\n"
        "Rules:\n"
        "- If information for a key is not found, use 'Not specified' or an empty list [].\n"
        "- Output ONLY the JSON object."
    )
    user_prompt = f"Document Excerpts:\n---\n{context}\n---\n\nExtract summary into JSON:"

    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    except Exception as e:
        print(f"--- [Agent 2] Error parsing case summary: {e} ---")
    
    return {"error": "Failed to parse case judgment summary."}

# --- AGENT 3: AGREEMENT/CONTRACT SUMMARIZER ---
def _agent_summarize_agreement_contract(context: str) -> Dict[str, Any]:
    """
    Extracts key information from a document identified as an Agreement or Contract.
    """
    print("--- [Study Guide V2 - Agent 3] Routing to Agreement/Contract summarizer... ---")
    system_prompt = (
        "You are an expert contract analyst. Analyze the provided legal agreement "
        "and extract the key components into a valid JSON object.\n"
        "Required JSON Keys:\n"
        "- `document_title`: string (e.g., 'Residential Lease Agreement', 'Non-Disclosure Agreement')\n"
        "- `parties`: list[string] (The names of the parties involved, e.g., ['Party A', 'Party B'])\n"
        "- `purpose`: string (A one-sentence summary of the agreement's purpose)\n"
        "- `key_obligations`: list[string] (3-5 key duties or responsibilities for the parties)\n"
        "- `term_and_termination`: string (Summary of the agreement's duration and how it can be ended)\n"
        "- `governing_law`: string (The jurisdiction, e.g., 'State of [X], India')\n\n"
        "Rules:\n"
        "- If information for a key is not found, use 'Not specified' or an empty list [].\n"
        "- Output ONLY the JSON object."
    )
    user_prompt = f"Document Excerpts:\n---\n{context}\n---\n\nExtract summary into JSON:"
    
    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    except Exception as e:
        print(f"--- [Agent 3] Error parsing agreement summary: {e} ---")
        
    return {"error": "Failed to parse agreement/contract summary."}

# --- AGENT 4: LEGAL FILING SUMMARIZER ---
def _agent_summarize_legal_filing(context: str) -> Dict[str, Any]:
    """
    Extracts key information from a document identified as a Legal Filing (Petition, Affidavit, etc.).
    """
    print("--- [Study Guide V2 - Agent 4] Routing to Legal Filing summarizer... ---")
    system_prompt = (
        "You are an expert legal clerk. Analyze the provided legal filing "
        "and extract the key components into a valid JSON object.\n"
        "Required JSON Keys:\n"
        "- `filing_type`: string (e.g., 'Writ Petition', 'Affidavit', 'Complaint')\n"
        "- `parties`: list[string] (e.g., ['Petitioner Name', 'Respondent Name'])\n"
        "- `court`: string (The court it is filed in, e.g., 'High Court of Delhi')\n"
        "- `summary_of_facts`: string (A brief summary of the facts presented in the filing)\n"
        "- `summary_of_prayers`: list[string] (The key reliefs or 'prayers' requested from the court)\n\n"
        "Rules:\n"
        "- If information for a key is not found, use 'Not specified' or an empty list [].\n"
        "- Output ONLY the JSON object."
    )
    user_prompt = f"Document Excerpts:\n---\n{context}\n---\n\nExtract summary into JSON:"
    
    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    except Exception as e:
        print(f"--- [Agent 4] Error parsing filing summary: {e} ---")
        
    return {"error": "Failed to parse legal filing summary."}

# --- AGENT 5: GENERAL/OTHER DOCUMENT SUMMARIZER ---
def _agent_summarize_other(context: str) -> Dict[str, Any]:
    """
    Provides a general summary for documents that don't fit other categories.
    """
    print("--- [Study Guide V2 - Agent 5] Routing to General summarizer... ---")
    system_prompt = (
        "You are a document analyst. Analyze the provided text and "
        "generate a concise summary as a valid JSON object.\n"
        "Required JSON Keys:\n"
        "- `document_title`: string (The title or a descriptive title if none is found)\n"
        "- `key_topics`: list[string] (A list of the 5-7 main topics discussed in the document)\n"
        "- `general_summary`: string (A 3-4 sentence paragraph summarizing the document's content)\n\n"
        "Rules:\n"
        "- If information for a key is not found, use 'Not specified' or an empty list [].\n"
        "- Output ONLY the JSON object."
    )
    user_prompt = f"Document Excerpts:\n---\n{context}\n---\n\nExtract summary into JSON:"
    
    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    except Exception as e:
        print(f"--- [Agent 5] Error parsing general summary: {e} ---")
        
    return {"error": "Failed to parse general document summary."}

# === NEW V2 ORCHESTRATOR ===
def generate_study_guide(user_id: Optional[str], thread_id: str, max_snippets: int = 50) -> Dict[str, Any]:
    """
    Orchestrates the dynamic multi-agent process AND normalizes the output
    so the frontend always receives the exact same JSON structure.
    """
    print("--- [Study Guide V2] Starting generation & normalization... ---")
    try:
        # 1. Get Context (Standard RAG)
        index = get_or_create_index(dim=get_embedding_dimension()) 
        ns = namespace(user_id, thread_id)
        initial_hits = query_top_k(index, ns, query_vec=[0.0] * get_embedding_dimension(), top_k=max_snippets) 
        
        if not initial_hits: return {"success": False, "message": "No document excerpts available."}
        snippets = [hit.get("metadata", {}).get("text", "") for hit in initial_hits if hit.get("metadata", {}).get("text", "")]
        if not snippets: return {"success": False, "message": "No valid text snippets found."}
        full_context = "\n\n---\n\n".join(snippets)

        # 2. Classify
        doc_type = _agent_classify_document_type(full_context)
        print(f"--- [Orchestrator] Classified as: {doc_type} ---")

        # 3. Route to Agent (Get Specific Data)
        raw_agent_data = {}
        if doc_type == "Case Judgment":
            raw_agent_data = _agent_summarize_case_judgment(full_context)
        elif doc_type == "Agreement/Contract":
            raw_agent_data = _agent_summarize_agreement_contract(full_context)
        elif doc_type == "Legal Filing":
            raw_agent_data = _agent_summarize_legal_filing(full_context)
        else:
            raw_agent_data = _agent_summarize_other(full_context)

        if "error" in raw_agent_data:
             # Fallback if agent failed
             return {"success": False, "message": "Analysis failed for this document type."}

        # 4. NORMALIZE (Transform to Universal Schema)
        # This ensures the frontend always sees the same keys
        universal_output = _normalize_response(doc_type, raw_agent_data)
        
        print("--- [Orchestrator] Normalized output ready. ---")
        return {"success": True, "study_guide": universal_output}

    except Exception as e:
        print(f"--- [Orchestrator] Error: {e} ---")
        return {"success": False, "message": f"generate_study_guide error: {e}"}

# =========================================================================
# === END OF NEW STUDY GUIDE (V2) SECTION                               ===
# =========================================================================

# ... (Keep your other functions like get_term_context, generate_faq, generate_timeline, etc.) ...

def get_term_context(user_id: Optional[str], thread_id: str, term: str) -> Dict[str, Any]:
    """
    Quick, paragraph-anchored explanation of a term within the uploaded doc.
    (Retained from the first code block.)
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
    "Keep the definition short (1-2 sentences), give one concrete example, and list any immediate legal implications.\n"
    "- CRITICAL RULE: Do not translate the keys or labels; any JSON keys or Markdown headings must remain in English.\n"
)

        q_user = f"Term: {term}\n\nParagraph:\n{paragraph}\n\nDefinition:"

        definition = call_model_system_then_user(q_prompt_sys, q_user, temperature=0.2)
        return {"success": True, "term": term, "definition": definition, "snippet": paragraph}
    except Exception as e:
        return {"success": False, "message": f"get_term_context error: {e}"}

from .embeddings import get_embedding_dimension
from .retrieval import retrieve_similar_chunks
from .prompts import build_strict_system_prompt

# === AGENT 1: Generate Questions ===
def _faq_agent1_generate_questions(context: str, num_questions: int) -> List[str]:
    """
    Uses LLM to generate potential questions based on the provided context.
    """
    print(f"--- [FAQ Agent 1] Generating {num_questions} questions... ---")
    system_prompt = (
        f"You are an expert at identifying key questions within a document. Based ONLY on the provided text excerpts, "
        f"generate exactly {num_questions} distinct and relevant questions that a user might ask about the content. "
        "Focus on important facts, definitions, obligations, or events mentioned.\n"
        "Rules:\n"
        "- Output ONLY the questions, each on a new line.\n"
        "- Do NOT number the questions.\n"
        "- Do NOT include answers or any other text."
    )
    user_prompt = f"Document Excerpts:\n---\n{context}\n---\n\nGenerate the questions:"

    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.3)
        # Split questions by newline and filter out empty lines
        questions = [q.strip() for q in response.split('\n') if q.strip()]
        print(f"--- [FAQ Agent 1] Generated {len(questions)} questions. ---")
        return questions[:num_questions] # Ensure we don't exceed the requested number
    except Exception as e:
        print(f"--- [FAQ Agent 1] Failed to generate questions: {e} ---")
        return []

# === AGENT 2: Find Answers ===
# In backend_rag/analysis.py

# === AGENT 2: Find Answers (Simplified Version) ===
def _faq_agent2_find_answers(question: str, user_id: Optional[str], thread_id: str, top_k: int = 4) -> str:
    """
    Finds relevant snippets for a specific question using vector search and
    generates a plain text answer using the LLM.
    """
    print(f"--- [FAQ Agent 2] Finding answer for: '{question[:80]}...' ---")
    try:
        # 1. Find relevant snippets specifically for this question
        hits = retrieve_similar_chunks(question, user_id=user_id, thread_id=thread_id, top_k=top_k)
        if not hits:
            return "Not stated in document."

        # 2. Build context ONLY from these targeted snippets
        context_blobs = [f"--- Excerpt ---\n{(hit.get('text') or '').strip()}" for hit in hits]
        context = "\n\n".join(context_blobs)

        # 3. Use a strict prompt to answer based *only* on this context
        #    This prompt asks ONLY for the plain answer.
        system_prompt = (
            "You are a meticulous document Q&A assistant. Use ONLY the provided excerpts to answer.\n"
            "If the answer is not present in the excerpts, reply exactly: 'Not stated in document.'\n"
            "Keep the answer concise and in plain English. Do NOT provide confidence levels or next steps.\n\n"
            f"Document excerpts:\n{context}\n"
        )
        user_prompt = question.strip()

        # 4. Get the plain answer string from the LLM
        answer = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)
        print(f"--- [FAQ Agent 2] Answer found. ---")
        return answer.strip() # Return only the answer string
            
    except Exception as e:
        print(f"--- [FAQ Agent 2] Failed to find answer: {e} ---")
        return "Error finding answer."
    

# === FAQ Orchestrator ===
def generate_faq(user_id: Optional[str], thread_id: str, max_snippets: int = 8, num_questions: int = 10) -> Dict[str, Any]:
    """
    Orchestrates the multi-agent process to generate an FAQ list.
    Returns a structured list of Q&A pairs.
    """
    print("--- [FAQ Orchestrator] Starting FAQ generation... ---")
    try:
        # 1. Get initial broad context snippets (used for question generation)
        index = get_or_create_index(dim=get_embedding_dimension()) # Assuming get_embedding_dimension is available
        ns = namespace(user_id, thread_id)
        initial_hits = query_top_k(index, ns, query_vec=[0.0] * get_embedding_dimension(), top_k=max_snippets)

        if not initial_hits:
            return {"success": False, "message": "No document excerpts available for FAQ generation."}

        snippets = [hit.get("metadata", {}).get("text", "").strip() for hit in initial_hits if hit.get("metadata", {}).get("text", "").strip()]
        if not snippets:
            return {"success": False, "message": "No valid text snippets found in Pinecone."}

        initial_context = "\n\n---\n\n".join([s[:2000] for s in snippets]) # Limit context size

        # 2. Call Agent 1 to generate questions
        questions = _faq_agent1_generate_questions(initial_context, num_questions)
        if not questions:
            return {"success": False, "message": "FAQ Agent 1 failed to generate any questions."}

        # 3. Call Agent 2 for each question to find the answer
        faq_list = []
        for q in questions:
            answer = _faq_agent2_find_answers(q, user_id, thread_id)
            faq_list.append({"question": q, "answer": answer})

        print("--- [FAQ Orchestrator] FAQ generation complete. ---")
        # Return the structured list instead of pre-formatted markdown
        return {"success": True, "faq": faq_list} 

    except Exception as e:
        print(f"--- [FAQ Orchestrator] Error: {e} ---")
        return {"success": False, "message": f"generate_faq error: {e}"}
        
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

def _normalize_two_digit_year(y: int) -> int:
    # heuristic: 00-50 -> 2000-2050, 51-99 -> 1951-1999
    return 2000 + y if y <= 50 else 1900 + y

def _parse_date_tokens(day: Optional[int], month: Optional[int], year: Optional[int]) -> Tuple[datetime, str]:
    """
    Return (sort_key_datetime, display_str)
    day, month, year may be None for partial dates.
    For partial dates we choose a canonical day for sorting but return partial format.
    """
    if year is None:
        # no year -> use far future to push to end; but this case should not normally happen
        sort_dt = datetime.max
        display = ""
    else:
        y = year if year >= 100 else _normalize_two_digit_year(year)
        if month is None and day is None:
            # Year-only
            sort_dt = datetime(y, 1, 1)
            display = f"{y}"
        elif day is None:
            # Month + Year
            sort_dt = datetime(y, month if month is not None else 1, 1)
            display = f"{month:02d}/{y}"
        else:
            # Full date
            sort_dt = datetime(y, month, day)
            display = f"{day:02d}/{month:02d}/{y}"
    return sort_dt, display

def _month_name_to_num(name: str) -> int:
    m = name.strip().lower()[:3]
    months = {
        'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,
        'jul':7,'aug':8,'sep':9,'oct':10,'nov':11,'dec':12
    }
    return months.get(m, 0)

import re
import json
from typing import Dict, Any, Optional, List
from datetime import datetime

# Assume get_or_create_index, namespace, query_top_k, and call_model_system_then_user
# are defined elsewhere in your file as before.


def _timeline_agent1_extract_events(context: str) -> str:
    """Agent 1 (Smarter): Scans text to extract events ONLY for the primary case."""
    print("--- [Timeline Agent 1] Extracting raw events for the PRIMARY case... ---")
    system_prompt = (
        "You are an event extraction agent. Your task is to scan the provided text and extract every potential date and its associated event for the **primary case only**.\n"
        "**CRITICAL RULE**: A legal document has one main case (e.g., 'Appellant vs. Respondent') and many older, cited cases (precedents). You MUST ignore the dates of the cited precedents and extract events ONLY for the main case.\n"
        "Ignore dates from footers, headers, or citations.\n"
        "Output each finding on a new line with the format: `DATE | EVENT`."
    )
    user_prompt = f"Document Text:\n---\n{context}\n---"
    raw_events = call_model_system_then_user(system_prompt, user_prompt, temperature=0.1)
    print(f"--- [Timeline Agent 1] Found raw data: \n{raw_events[:500]}...")
    return raw_events

def _timeline_agent2_structure_and_clean(raw_events: str) -> List[Dict]:
    """Agent 2 (Reviewer): Takes raw data, filters out any remaining precedents, normalizes, and structures into JSON."""
    print("--- [Timeline Agent 2] Structuring, cleaning, and reviewing data... ---")
    system_prompt = (
        "You are a data structuring and reviewing agent. You will receive a list of raw 'DATE | EVENT' pairs. Your job is to clean this data, convert it into a valid JSON array, and **filter out any events that refer to historical precedents**.\n"
        "**RULES:**\n"
        "1.  Review each event. If it is about the main case history, keep it. If it is about an old law or a cited historical case, DISCARD it.\n"
        "2.  For each valid event, create a JSON object with 'date' and 'event' keys.\n"
        "3.  Normalize dates: full dates to DD/MM/YYYY, month/year to MM/YYYY, and year-only to YYYY.\n"
        "4.  Keep event descriptions concise.\n"
        "5.  Output **ONLY** the final JSON array. No other text.\n\n"
        "**Example Input:**\n"
        "January 2013 | The Respondent-wife left the matrimonial home.\n"
        "1996 | The Bombay High Court held in Sushila Viresh Chhawda v. Viresh Nagsi Chhawda.\n"
        "02.09.2013 | The wife filed an application for interim maintenance.\n"
        "\n"
        "**Example Output (Notice the 1996 precedent is removed):**\n"
        '[{"date": "01/2013", "event": "The Respondent-wife left the matrimonial home."}, {"date": "02/09/2013", "event": "The wife filed an application for interim maintenance."}]'
        # Add this rule to the system_prompt
        "CRITICAL RULE: The keys in the JSON objects ('date', 'event') MUST be in English. Do not translate them."
    )
    user_prompt = f"Raw Data to Clean and Review:\n---\n{raw_events}\n---"
    json_string = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)
    print(f"--- [Timeline Agent 2] Produced structured JSON: {json_string[:500]}...")
    try:
        json_match = re.search(r'\[.*\]', json_string, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        return []
    except json.JSONDecodeError:
        print("--- [Timeline Agent 2] FAILED to parse JSON from LLM response.")
        return []

def generate_timeline(user_id: Optional[str], thread_id: str, max_snippets: int = 10) -> Dict[str, Any]:
    """Orchestrates the final multi-agent pipeline to generate a focused timeline."""
    try:
        # --- Setup and Context Retrieval ---
        index = get_or_create_index(dim=384)
        ns = namespace(user_id, thread_id)
        query_result = query_top_k(index, ns, query_vec=[0.0] * 384, top_k=20)
        if not query_result:
            return {"success": True, "timeline": [], "message": "No document excerpts available for timeline generation."}
        snippets = [hit.get("metadata", {}).get("text", "").strip() for hit in query_result if hit.get("metadata", {}).get("text", "").strip()]
        if not snippets:
            return {"success": True, "timeline": [], "message": "No valid snippets found in Pinecone."}
        context_excerpt = "\n\n---\n\n".join(snippets)

        # --- Agent 1: Event Identification ---
        raw_events_data = _timeline_agent1_extract_events(context_excerpt)
        if not raw_events_data.strip():
            return {"success": True, "timeline": [], "message": "Agent 1 could not identify any potential events."}

        # --- Agent 2: Data Structuring & Reviewing ---
        structured_events = _timeline_agent2_structure_and_clean(raw_events_data)
        if not structured_events:
            return {"success": True, "timeline": [], "message": "After review, no valid timeline events for the main case were found."}
            
        # --- Final Step (Agent 3): Chronological Sorting in Python for 100% reliability ---
        print("--- [Final Step] Sorting data chronologically... ---")
        def sort_key_for_date(event):
            date_str = event.get('date', '')
            # Handle different date formats for sorting
            for fmt in ('%d/%m/%Y', '%m/%Y', '%Y'):
                try:
                    # For MM/YYYY, strptime needs a day, so we add a dummy day '01'
                    if fmt == '%m/%Y':
                        return datetime.strptime(f"01/{date_str}", '%d/%m/%Y')
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
            return datetime.max # Put unparseable dates at the end
            
        sorted_timeline = sorted(structured_events, key=sort_key_for_date)

        return {"success": True, "timeline": sorted_timeline}
        
    except Exception as e:
        return {"success": False, "message": f"generate_timeline error: {e}", "timeline": []}


## --- CASE LAW SUGGESTION: FINAL ARCHITECTURE ---


import os
import httpx

import random
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote
from typing import List, Dict

# In backend_rag/analysis.py
# In backend_rag/analysis.py

# --- Add these imports at the top of your file ---

# --- Make sure the other necessary imports are still there ---
from bs4 import BeautifulSoup
from urllib.parse import quote
from typing import List, Dict, Optional
import os



# In backend_rag/analysis.py
# In backend_rag/analysis.py
# REPLACE the old Agent 2 with this one:

# --- Make sure you have this import at the top of analysis.py ---
from urllib.parse import quote

# In backend_rag/analysis.py
# REPLACE the old Agent 2 with this one:
import requests # <-- ADD THIS
import time
import html
# --- Make sure you have these imports at the top ---
import httpx
import json
import os
from typing import Any, Dict, List, Optional
from .vectorstore_pinecone import get_or_create_index, namespace, query_top_k # (and other existing imports)
from urllib.parse import quote_plus
def clean_html(text: str) -> str:
    """Remove HTML tags like <b>, <i> and decode entities."""
    text = re.sub(r"<[^>]+>", "", text or "")  # strip tags
    return html.unescape(text.strip())

# --- NEW: AGENT 1 (Fact Extractor) ---
def _agent1_extract_searchable_facts(context: str) -> List[str]:
    """
    Reads a large document context and extracts 3-5 key legal
    facts or questions that are ideal for a case law search.
    """
    print("--- [AGENT 1] Extracting searchable facts from document... ---")
    system_prompt = (
        "You are a legal analyst. Read the provided document excerpts and identify the 3-5 most critical legal questions or key factual situations. "
        "Return each item on a new line. Be concise.\n\n"
        "**Example Output:**\n"
        "Rights of an adult daughter to marry against parents' wishes\n"
        "Police protection for interfaith couple\n"
        "Validity of anticipatory bail in a 498a case\n"
    )
    user_prompt = f"Document Excerpts:\n---\n{context}\n---\n\nExtract the 3-5 most important searchable facts/questions:"
    
    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.2)
        facts = [f.strip() for f in response.split('\n') if f.strip()]
        print(f"--- [AGENT 1] Extracted facts: {facts} ---")
        return facts[:5] # Limit to 5
    except Exception as e:
        print(f"--- [AGENT 1] Error extracting facts: {e} ---")
        return []

# --- RENAMED: AGENT 2 (API Search Tool) ---
# This is your working function, renamed to be an "agent"
def _agent2_search_api(query_text: str) -> List[Dict]:
    """
    Searches the Indian Kanoon API for a single query text
    and returns a list of parsed case dictionaries.
    """
    print(f"--- [AGENT 2] Searching API for: '{query_text[:80]}...' ---")
    
    api_key = os.environ.get("INDIAN_KANOON_API_KEY") # Use consistent key name
    if not api_key:
        print("--- [AGENT 2] ERROR: Missing KANOON_API key.")
        return [] # Return empty list on failure

    base_url = "https://api.indiankanoon.org/search/"
    headers = {
        "Authorization": f"Token {api_key}",
        "User-Agent": "CaseLawFinder/1.0",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {"formInput": query_text, "pagenum": 0}

    try:
        response = requests.post(base_url, headers=headers, data=data, timeout=15)

        if response.status_code == 200:
            api_data = response.json()
            results = []
            for doc in api_data.get("docs", []):
                case_id = doc.get("tid", "")
                results.append({
                    "title": clean_html(doc.get("title", "Unknown Title")),
                    "url": f"https://indiankanoon.org/doc/{case_id}/" if case_id else "",
                    "citation": clean_html(doc.get("citation", "")),
                    "court": clean_html(doc.get("docsource", "")),
                    "date": clean_html(doc.get("publishdate", "")),
                    "snippet": clean_html(doc.get("headline", ""))
                })
            print(f"--- [AGENT 2] Found {len(results)} cases. ---")
            return results
        else:
            print(f"--- [AGENT 2] Server error: {response.status_code} ---")
            return []

    except requests.RequestException as e:
        print(f"--- [AGENT 2] Request error: {e} ---")
        return []

# --- NEW: AGENT 3 (Relevancy Filter) ---
# In backend_rag/analysis.py
# (This is the only function you need to replace)

def _agent3_check_relevancy(user_context: str, case: Dict) -> Optional[str]:
    """
    Checks if a case snippet is relevant to the user's document
    AND is not the *same* document.
    """
    print(f"--- [AGENT 3] Checking relevancy for: {case.get('title')} ---")
    case_snippet = case.get('snippet', '')
    if not case_snippet:
        return None # No snippet to check

    # --- THIS IS THE NEW, SMARTER PROMPT ---
    system_prompt = (
        "You are a legal analyst. You will see a user's document and a snippet from a potential case law. "
        "Your job is to find *other* relevant cases (precedents).\n\n"
        "**CRITICAL RULE:** If the 'CASE LAW SNIPPET' is from the **exact same document** as the 'USER'S DOCUMENT' (e.g., it discusses the same parties, facts, and petition numbers), you **MUST** respond with 'NO'. The user already has this document.\n\n"
        "**YOUR TASK:**\n"
        "1.  Read both texts.\n"
        "2.  If they are the **same document**, respond with 'NO'.\n"
        "3.  If they are **different**, but the snippet is **relevant**, respond with a 1-sentence explanation of *why* it is relevant.\n"
        "4.  If they are **different** and **NOT relevant**, respond with 'NO'."
    )

    # We also pass the case title in the user prompt to help it spot duplicates
    case_title = case.get('title', 'Unknown Title')
    user_prompt = (
        f"**USER'S DOCUMENT (Context):**\n{user_context[:2000]}\n\n"
        f"**CASE LAW SNIPPET (from '{case_title}'):**\n{case_snippet}\n\n"
        f"**Decision:** (If it's the *same document* or *not relevant*, respond 'NO'. If it's a *different, relevant* case, explain *why* in 1 sentence.)"
    )
    # --- END OF PROMPT CHANGES ---

    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)
        
        # Check for the "NO" response
        if response.strip().upper() == "NO" or "not relevant" in response.lower() or "same document" in response.lower():
            print(f"--- [AGENT 3] Result: NOT RELEVANT (or is a duplicate) ---")
            return None
        else:
            # Any other response is the relevancy explanation
            print(f"--- [AGENT 3] Result: RELEVANT ({response}) ---")
            return response 
    except Exception as e:
        print(f"--- [AGENT 3] Error checking relevancy: {e} ---")
        return None

# --- NEW: Orchestrator Function ---
# This is the new main function called by api_server.py
def suggest_case_law(user_id: Optional[str], thread_id: str) -> Dict[str, Any]:
    """
    Orchestrates the multi-agent pipeline to:
    1. Extract facts from the user's doc.
    2. Search for cases for each fact.
    3. Filter all results for relevancy.
    """
    print("\n--- [Orchestrator] Starting automated case law suggestion... ---")
    
    # 1. Get User Document Context
    try:
        dim = get_embedding_dimension()
        index = get_or_create_index(dim)
        ns = namespace(user_id, thread_id)
        # Get a large context for analysis
        query_result = query_top_k(index, ns, query_vec=[0.0] * dim, top_k=25)
        if not query_result:
            return {"success": False, "message": "No document excerpts for analysis."}
        
        user_context = "\n".join([hit.get("metadata", {}).get("text", "").strip() for hit in query_result])
        if len(user_context.strip()) < 100:
            return {"success": False, "message": "Document content is too short for analysis."}
    except Exception as e:
        return {"success": False, "message": f"Error retrieving document: {e}"}

    # 2. Agent 1: Extract Facts
    facts = _agent1_extract_searchable_facts(user_context)
    if not facts:
        return {"success": False, "message": "Agent 1 failed to extract any facts from the document."}

    # 3. Agents 2 & 3: Search and Filter
    all_relevant_cases = {} # Use a dict to auto-deduplicate based on URL
    
    for fact in facts:
        # Agent 2: Search for this fact
        cases_from_fact = _agent2_search_api(fact)
        
        for case in cases_from_fact:
            url = case.get('url')
            if not url or url in all_relevant_cases:
                continue # Skip duplicates
            
            # Agent 3: Check for relevancy
            relevance_reason = _agent3_check_relevancy(user_context, case)
            
            if relevance_reason:
                case["relevance"] = relevance_reason # Add the new "relevance" field
                all_relevant_cases[url] = case
                
    # 4. Format Output
    final_cases_list = list(all_relevant_cases.values())
    
    if not final_cases_list:
        return {
            "success": True,
            "suggested_cases": [],
            "message": f"Searched for {len(facts)} facts, but found no relevant cases after filtering."
        }

    return {
        "success": True,
        "suggested_cases": final_cases_list,
        "message": f"Found {len(final_cases_list)} relevant cases from {len(facts)} searched facts."
    }


        
def _predictive_agent1_extract_facts(context: str) -> str:
    """Agent 1: Scans the document to identify and create a structured list of all key facts, obligations, and liabilities."""
    print("--- [Predictive Agent 1] Extracting critical facts... ---")
    system_prompt = "You are a legal fact-extraction agent. Scan the provided document and create a structured, bulleted markdown list of all key facts, obligations, liabilities, and important figures (names, dates, amounts). Be concise and objective."
    user_prompt = f"Document Text:\n---\n{context}\n---"
    facts_summary = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)
    print(f"--- [Predictive Agent 1] Extracted Facts: \n{facts_summary[:500]}...")
    return facts_summary

# --- UPDATED: Agent 2 now performs comprehensive & adversarial analysis ---
def _predictive_agent2_comprehensive_analysis(facts_summary: str) -> str:
    """Agent 2: Assesses facts for primary strengths/risks AND from an adversarial perspective."""
    print("--- [Predictive Agent 2] Performing comprehensive (primary & adversarial) analysis... ---")
    system_prompt = (
        "You are a senior legal analyst. Based on the following facts, provide a two-part analysis.\n\n"
        "**Part 1: Primary Analysis**: From the perspective of the document's main party, identify the key 'Legal Strengths' and 'Potential Risks'.\n\n"
        "**Part 2: Adversarial Analysis**: Now, acting as the 'Devil's Advocate' or opposing counsel, identify the 'Counter-Arguments / Opponent's Strengths'.\n\n"
        "Structure your output with these three clear, bulleted markdown headings."
    )
    user_prompt = f"Extracted Facts:\n---\n{facts_summary}\n---"
    risk_analysis = call_model_system_then_user(system_prompt, user_prompt, temperature=0.3)
    print(f"--- [Predictive Agent 2] Comprehensive Analysis: \n{risk_analysis[:500]}...")
    return risk_analysis

# --- UPDATED: Agent 3 now synthesizes the comprehensive analysis ---
def _predictive_agent3_synthesize_prediction(facts_summary: str, comprehensive_analysis: str) -> Dict[str, Any]:
    """Agent 3: Combines facts and the two-part analysis to generate a balanced predictive summary."""
    print("--- [Predictive Agent 3] Synthesizing balanced prediction... ---")
    system_prompt = (
        "You are a senior legal strategist. You have been given a list of facts, a primary analysis of strengths/risks, and an adversarial analysis of counter-arguments. "
        "Your task is to synthesize ALL of this information into a balanced predictive forecast. Generate a summary of 2-3 potential future outcomes or scenarios. "
        "For each outcome, your reasoning should be and in easy understable language and robust and consider both sides of the argument. "
        "Conclude with a standard legal disclaimer. "
        "The output MUST be a valid JSON object with two keys: `scenarios` (a list of objects, each with `outcome` and `reasoning` keys) and `disclaimer` (a string)."
        "CRITICAL RULE: The keys in the JSON output ('scenarios', 'outcome', 'reasoning', 'disclaimer') MUST be in English and must not be translated."
    )
    user_prompt = f"Facts Summary:\n{facts_summary}\n\nComprehensive Analysis (Both Sides):\n{comprehensive_analysis}\n\nNow, generate the balanced predictive forecast as a JSON object."
    json_string = call_model_system_then_user(system_prompt, user_prompt, temperature=0.4)
    print(f"--- [Predictive Agent 3] Generated Prediction JSON: {json_string[:500]}...")
    try:
        json_match = re.search(r'\{.*\}', json_string, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        return {} # Return empty dict on failure
    except json.JSONDecodeError:
        print("--- [Predictive Agent 3] FAILED to parse JSON from LLM response.")
        return {}

# --- UPDATED: The main orchestrator function ---
def generate_predictive_output(user_id: Optional[str], thread_id: str) -> Dict[str, Any]:
    """Orchestrates the multi-agent pipeline for generating a predictive output with adversarial analysis."""
    try:
        index = get_or_create_index(dim=384)
        ns = namespace(user_id, thread_id)
        query_result = query_top_k(index, ns, query_vec=[0.0] * 384, top_k=25)
        if not query_result:
            return {"success": False, "message": "No document excerpts available for analysis."}
        context = "\n\n---\n\n".join([hit.get("metadata", {}).get("text", "").strip() for hit in query_result])
        if len(context.strip()) < 100:
            return {"success": False, "message": "Document content is too short for meaningful analysis."}
        
        # --- Agent 1: Fact Extraction ---
        facts = _predictive_agent1_extract_facts(context)
        if not facts.strip():
            return {"success": False, "message": "Agent 1 failed to extract any facts."}
            
        # --- Agent 2: Comprehensive & Adversarial Analysis ---
        analysis = _predictive_agent2_comprehensive_analysis(facts)
        if not analysis.strip():
            return {"success": False, "message": "Agent 2 failed to produce a comprehensive analysis."}
            
        # --- Agent 3: Prediction Synthesis ---
        prediction = _predictive_agent3_synthesize_prediction(facts, analysis)
        if not prediction or "scenarios" not in prediction:
            return {"success": False, "message": "Agent 3 failed to synthesize a prediction."}
            
        return {"success": True, "prediction": prediction}

    except Exception as e:
        print(f"--- [ERROR] An unexpected error occurred in generate_predictive_output: {e}")
        return {"success": False, "message": f"An unexpected error occurred: {e}"}
    

# In backend_rag/analysis.py
# (Add this new function alongside your other agents like generate_faq, etc.)

def _agent_explain_complex_clauses(context: str) -> Dict[str, str]:
    """
    Scans the document context, identifies the top 5-7 most complex/high-risk
    legal clauses, and generates a simple, plain-English explanation for each.
    """
    print("--- [Jargon Buster Agent] Finding and explaining complex clauses... ---")
    
    system_prompt = (
        "You are an expert legal analyst with a talent for simple explanations. "
        "Your task is to scan the provided document text, identify the 5-7 most "
        "complex, high-risk, or jargon-filled clauses, and explain them in "
        "plain English for a non-lawyer.\n\n"
        "Common clauses to look for: 'Indemnity', 'Limitation of Liability', "
        "'Governing Law', 'Arbitration', 'Termination for Convenience', "
        "'Confidentiality', 'Warranty', 'Non-Compete'.\n\n"
        "Return a single, valid JSON object where:\n"
        "- The KEY is the name of the clause (e.g., 'Indemnity Clause').\n"
        "- The VALUE is a 2-3 sentence, simple explanation of what it means "
        "and what the potential risk is for the user.\n\n"
        "Example Output:\n"
        "{\n"
        "  \"Indemnity Clause\": \"This means you agree to pay for the other party's "
        "legal costs if they get sued because of something you did. "
        "This can be very expensive.\",\n"
        "  \"Limitation of Liability\": \"This clause tries to cap the amount of "
        "money a party has to pay if they break the contract. You should check if "
        "this limit is fair to you.\"\n"
        "}"
    )
    
    user_prompt = f"Document Excerpts:\n---\n{context[:25000]}\n---\n\n" \
                  "Generate the JSON of complex clauses and their simple explanations:"

    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.1)
        
        # Find the JSON object in the response
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            clauses = json.loads(match.group(0))
            print(f"--- [Jargon Buster Agent] Extracted {len(clauses)} clauses. ---")
            return clauses
        else:
            print("--- [Jargon Buster Agent] Failed: Could not find JSON in response.")
            return {}
            
    except Exception as e:
        print(f"--- [Jargon Buster Agent] Error: {e} ---")
        return {}

def generate_clause_explanations(user_id: Optional[str], thread_id: str) -> Dict[str, Any]:
    """
    Orchestrator for the Jargon Buster. Gets all text and calls the agent.
    """
    try:
        # Get a large context of the document
        index = get_or_create_index(dim=get_embedding_dimension())
        ns = namespace(user_id, thread_id)
        # Query for many snippets to form a complete picture
        hits = query_top_k(index, ns, query_vec=[0.0] * get_embedding_dimension(), top_k=50)
        
        if not hits:
            return {"success": False, "message": "No document excerpts available."}
        
        snippets = [hit.get("metadata", {}).get("text", "") for hit in hits if hit.get("metadata", {}).get("text", "")]
        if not snippets:
            return {"success": False, "message": "No valid text snippets found."}
            
        full_context = "\n\n---\n\n".join(snippets)

        # Call the new agent
        explanations = _agent_explain_complex_clauses(full_context)
        
        if not explanations:
            return {"success": False, "message": "AI could not identify specific complex clauses to explain."}

        # Convert from Dict {key: val} to List [{"clause": key, "explanation": val}]
        # This is much easier for your frontend to display
        explanation_list = [
            {"clause": key, "explanation": value} 
            for key, value in explanations.items()
        ]

        return {"success": True, "explanations": explanation_list}

    except Exception as e:
        print(f"--- [Jargon Buster] Orchestrator Error: {e} ---")
        return {"success": False, "message": f"An error occurred: {e}"}


# In backend_rag/analysis.py

# === 1. MIND MAP GENERATOR (Returns Mermaid Code) ===
def _agent_generate_mindmap_only(context: str) -> str:
    """
    Generates ONLY the Mermaid.js Mindmap code.
    """
    print("--- [Visual Agent] Generating Mind Map... ---")
    system_prompt = (
        "You are a legal visualization expert. Create a `mindmap` code block for the provided document.\n"
        "- Root node: Document Title.\n"
        "- Branches: Key Themes, Core Issues, Evidence, Outcomes.\n"
        "- Focus on **Knowledge Clusters**.\n"
        "- Output ONLY the raw Mermaid syntax (no markdown)."
    )
    user_prompt = f"Document Excerpts:\n---\n{context[:25000]}\n---\n\nGenerate Mermaid mindmap:"

    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.2)
        return response.replace("```mermaid", "").replace("```", "").strip()
    except Exception as e:
        print(f"--- [Mindmap Agent] Error: {e} ---")
        return "mindmap\n root((Error))"

def generate_mindmap(user_id: Optional[str], thread_id: str) -> Dict[str, Any]:
    """Orchestrator for Mind Map only."""
    try:
        index = get_or_create_index(dim=get_embedding_dimension())
        ns = namespace(user_id, thread_id)
        hits = query_top_k(index, ns, query_vec=[0.0]*get_embedding_dimension(), top_k=40)
        if not hits: return {"success": False, "message": "No context."}
        
        full_context = "\n".join([h.get("metadata", {}).get("text", "") for h in hits])
        code = _agent_generate_mindmap_only(full_context)
        
        return {"success": True, "mindmap_code": code}
    except Exception as e:
        return {"success": False, "message": str(e)}


# === 2. STRUCTURED TIMELINE GENERATOR (Returns JSON Data) ===
def _agent_generate_event_data(context: str) -> List[Dict[str, str]]:
    """
    Generates a structured JSON list of events for a custom timeline UI.
    """
    print("--- [Timeline Agent] Generating structured event list... ---")
    system_prompt = (
        "You are a legal analyst. Extract the chronological sequence of events from the document.\n"
        "Return a valid JSON list of objects `[]`, where each object represents a step.\n\n"
        "**JSON Structure:**\n"
        "[\n"
        "  {\n"
        "    \"order\": 1,\n"
        "    \"actor\": \"Name of the Actor (e.g., Court, Police, Petitioner, Government)\",\n"
        "    \"event\": \"Concise description of the action (max 10-15 words)\",\n"
        "    \"date\": \"Date if mentioned, else 'N/A'\"\n"
        "  }\n"
        "]\n\n"
        "**Rules:**\n"
        "- Ensure the list is strictly chronological.\n"
        "- The 'actor' field is critical for grouping in the UI.\n"
        "- Output ONLY the JSON list."
    )
    user_prompt = f"Document Excerpts:\n---\n{context[:25000]}\n---\n\nGenerate JSON Timeline:"

    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.1)
        match = re.search(r'\[.*\]', response, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        return []
    except Exception as e:
        print(f"--- [Timeline Agent] Error: {e} ---")
        return []

def generate_structured_timeline(user_id: Optional[str], thread_id: str) -> Dict[str, Any]:
    """Orchestrator for Event Timeline data."""
    try:
        index = get_or_create_index(dim=get_embedding_dimension())
        ns = namespace(user_id, thread_id)
        hits = query_top_k(index, ns, query_vec=[0.0]*get_embedding_dimension(), top_k=40)
        if not hits: return {"success": False, "message": "No context."}
        
        full_context = "\n".join([h.get("metadata", {}).get("text", "") for h in hits])
        timeline_data = _agent_generate_event_data(full_context)
        
        return {"success": True, "timeline": timeline_data}
    except Exception as e:
        return {"success": False, "message": str(e)}