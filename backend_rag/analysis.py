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
from .storage import chat_paths

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
    try:
        _, _, file_record = chat_paths(user_id, thread_id)
        if file_record.exists():
            rec = json.loads(file_record.read_text(encoding="utf-8"))
            return rec.get("filepath")
    except Exception:
        pass
    return None


def quick_analyze(filepath: str, user_id: Optional[str], thread_id: str) -> Dict[str, Any]:
    """
    Fast summary + basic keywords, without touching FAISS.
    """
    try:
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
        fp = _read_ingested_filepath(user_id, thread_id)
        if not fp:
            return {"success": False, "message": "No ingested file for this thread."}
        return quick_analyze(str(fp), user_id, thread_id)
    except Exception as e:
        return {"success": False, "message": f"quick_analyze_thread error: {e}"}


# alias for backward-compat
quick_analyze_for_thread = quick_analyze_thread


def generate_study_guide(user_id: Optional[str], thread_id: str, max_snippets: int = 8) -> Dict[str, Any]:
    """
    Build a study guide from a handful of representative snippets.
    """
    try:
        filepath = _read_ingested_filepath(user_id, thread_id)
        if not filepath or not Path(filepath).exists():
            return {"success": False, "message": "No ingested file for this thread."}

        # Prefer metadata snippets saved at ingest time
        _, meta_path, _ = chat_paths(user_id, thread_id)
        snippets: List[str] = []
        diagnostics: Dict[str, Any] = {"meta_used": False}

        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                taken = 0
                for k in sorted(meta.keys(), key=lambda x: int(x) if str(x).isdigit() else x):
                    if taken >= max_snippets:
                        break
                    t = meta.get(k, {}).get("text") or ""
                    if t.strip():
                        snippets.append(t.strip())
                        taken += 1
                if snippets:
                    diagnostics["meta_used"] = True
                    diagnostics["meta_count"] = len(snippets)
            except Exception as e:
                diagnostics["meta_error"] = str(e)

        # Fallback: extract and chunk directly
        if not snippets:
            extraction = extract_text_with_diagnostics(filepath)
            diagnostics["extraction"] = extraction.get("diagnostics", {})
            text = extraction.get("text", "") or ""
            if not text.strip():
                return {"success": False, "message": "No text available to generate study guide.", "diagnostics": diagnostics}
            chunks = chunk_text(text, chunk_size=1200, overlap=200)
            for _, ctext in chunks[:max_snippets]:
                snippets.append(ctext)
            diagnostics["from_chunks"] = len(snippets)

        if not snippets:
            return {"success": False, "message": "Unable to find document excerpts for study guide.", "diagnostics": diagnostics}

        # Prompt the LLM
        context_excerpt = "\n\n---\n\n".join([s[:2000] for s in snippets])
        system_prompt = (
            "You are an expert study-guide writer who specializes in legal and technical documents. "
            "Using ONLY the provided document excerpts below (do NOT use external knowledge), produce a detailed Study Guide in MARKDOWN.\n\n"
            "Style & structure (flexible):\n"
            "- Create a clear, readable title using the uploaded filename if available (otherwise use 'Uploaded Document — Study Guide').\n"
            "- Organize the guide with sensible headings and subheadings (use Markdown), but do not force a rigid template. For each heading you create, include 1–4 short paragraphs (2–4 sentences each) that explain the topic plainly and concisely for a non-expert reader.\n"
            "- After the main explanation sections, include the following useful outputs if supported by the excerpts: Key Concepts, Quiz (with questions), Answer Key, Timeline (if the document contains dates), Glossary of key terms, and Suggested Study Tips. Only include the sections that are relevant to the provided excerpts; omit irrelevant sections.\n\n"
            "Content rules (must follow):\n"
            "- Use ONLY content present in the provided excerpts. If a requested fact, limit, date, or clause is not present in the excerpts, write exactly: 'Not stated in document.' Do NOT invent or assume missing facts, numbers, or legal conclusions.\n"
            "- If you make an inference that synthesizes multiple excerpts, PREPEND the inference with the single word 'INFERENCE:' then succinctly explain the premises and cite the short snippets used (see quoting rule below).\n"
            "- When including any quoted excerpt, include only a short snippet (<=250 characters) and append a parenthetical source tag like '(excerpt)'. Do not paste long verbatim sections from the document.\n"
            "- Keep language plain, concise, and aimed at a non-expert. Use bullet lists for enumerations and short numbered lists for steps or procedures.\n\n"
            "Specific output elements (guidance):\n"
            "- Overview: 2–4 short paragraphs describing the document's purpose, scope, and core themes.\n"
            "- Key Concepts: up to ~10 important terms from the excerpts; for each give a 1–2 sentence plain-English definition and a one-line note about why it matters in this document. If a term is missing detail, write 'Not stated in document.'\n"
            "- Suggested Tips: 3–5 practical tips for reviewing the document (e.g., focus areas, how to compare clauses, what to bring to counsel).\n\n"
            "Formatting & deliverable:\n"
            "- Produce the entire Study Guide in Markdown. Use H1 for title, H2/H3 for main sections and subsections, bullets and code blocks only where appropriate.\n"
            "- Be thorough and long-form (comparable to a helpful revision guide) but avoid repetition.\n"
            "- At the top, include a single-line 'Source summary:' listing which short snippets you used as the basis for the guide (each as a short quoted snippet <=250 chars followed by '(excerpt)').\n\n"
            "Now: using ONLY the excerpts provided below, generate the Study Guide according to these instructions. Begin with the H1 title and 'Source summary:' and then the rest of the guide."
        )
        user_prompt = f"Document excerpts:\n\n{context_excerpt}\n\nProduce the Study Guide as requested above."

        guide_text = call_model_system_then_user(system_prompt, user_prompt, temperature=0.2)
        return {"success": True, "study_guide": guide_text, "diagnostics": diagnostics}
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
    Generate an FAQ (questions & answers) based ONLY on the uploaded document excerpts.
    Returns:
      {"success": bool, "faq_markdown": str, "diagnostics": {...}}
    """
    try:
        filepath = _read_ingested_filepath(user_id, thread_id)
        if not filepath or not Path(filepath).exists():
            return {"success": False, "message": "No ingested file for this thread."}

        # Prefer metadata snippets saved at ingest time
        _, meta_path, _ = chat_paths(user_id, thread_id)
        snippets: List[str] = []
        diagnostics: Dict[str, Any] = {"meta_used": False, "num_questions": num_questions}

        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                taken = 0
                for k in sorted(meta.keys(), key=lambda x: int(x) if str(x).isdigit() else x):
                    if taken >= max_snippets:
                        break
                    t = meta.get(k, {}).get("text") or ""
                    if t.strip():
                        snippets.append(t.strip())
                        taken += 1
                if snippets:
                    diagnostics["meta_used"] = True
                    diagnostics["meta_count"] = len(snippets)
            except Exception as e:
                diagnostics["meta_error"] = str(e)

        # Fallback: extract & chunk if needed
        if not snippets:
            extraction = extract_text_with_diagnostics(filepath)
            diagnostics["extraction"] = extraction.get("diagnostics", {})
            text = extraction.get("text", "") or ""
            if not text.strip():
                return {"success": False, "message": "No text available to generate FAQ.", "diagnostics": diagnostics}
            chunks = chunk_text(text, chunk_size=1200, overlap=200)
            for _, ctext in chunks[:max_snippets]:
                snippets.append(ctext)
            diagnostics["from_chunks"] = len(snippets)

        if not snippets:
            return {"success": False, "message": "Unable to find document excerpts for FAQ.", "diagnostics": diagnostics}

        # Build prompt
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
        return {"success": True, "faq_markdown": faq_md, "diagnostics": diagnostics}
    except Exception as e:
        return {"success": False, "message": f"generate_faq error: {e}"}\
        
def generate_timeline(user_id: Optional[str], thread_id: str, max_snippets: int = 10) -> Dict[str, Any]:
    """
    Generate a chronological timeline (Markdown) using ONLY the uploaded document excerpts.

    Rules enforced post-generation:
    - Only show timeline if there are >= 1 rows; else return "No timeline to show in your document."
    - Normalize all dates to DD/MM/YYYY.
    - Keep only two columns: Date | Event (no snippet).
    """
    import re
    from pathlib import Path

    # --- helpers: date normalization ---
    MONTHS = {
        "january": "01", "february": "02", "march": "03", "april": "04",
        "may": "05", "june": "06", "july": "07", "august": "08",
        "september": "09", "october": "10", "november": "11", "december": "12",
        "jan": "01", "feb": "02", "mar": "03", "apr": "04",
        "jun": "06", "jul": "07", "aug": "08",
        "sep": "09", "sept": "09", "oct": "10", "nov": "11", "dec": "12",
    }

    def _pad2(n: str) -> str:
        return n.zfill(2)

    def normalize_date_string(s: str) -> Optional[str]:
        """Try to normalize various common formats to DD/MM/YYYY; return None if cannot."""
        ss = s.strip()

        # YYYY-MM-DD
        m = re.match(r"^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$", ss)
        if m:
            y, mo, d = m.groups()
            return f"{_pad2(d)}/{_pad2(mo)}/{y}"

        # YYYY/MM/DD or YYYY.MM.DD
        m = re.match(r"^\s*(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})\s*$", ss)
        if m:
            y, mo, d = m.groups()
            return f"{_pad2(d)}/{_pad2(mo)}/{y}"

        # DD/MM/YYYY or D/M/YYYY (already dd/mm/yyyy-ish)
        m = re.match(r"^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$", ss)
        if m:
            d, mo, y = m.groups()
            return f"{_pad2(d)}/{_pad2(mo)}/{y}"

        # Month D, YYYY   (e.g., January 10, 2024)
        m = re.match(r"^\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*$", ss)
        if m:
            mon, d, y = m.groups()
            mo = MONTHS.get(mon.lower())
            if mo:
                return f"{_pad2(d)}/{mo}/{y}"

        # D Month YYYY    (e.g., 10 January 2024)
        m = re.match(r"^\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*$", ss)
        if m:
            d, mon, y = m.groups()
            mo = MONTHS.get(mon.lower())
            if mo:
                return f"{_pad2(d)}/{mo}/{y}"

        # Mon D, YYYY (short month) e.g., Jan 5, 2024
        m = re.match(r"^\s*([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})\s*$", ss)
        if m:
            mon, d, y = m.groups()
            mo = MONTHS.get(mon.lower())
            if mo:
                return f"{_pad2(d)}/{mo}/{y}"

        return None  # unknown format

    def sanitize_table(md_text: str) -> Tuple[str, int]:
        """
        Convert any markdown table returned by the model into a strict 2-col table (Date|Event),
        normalize the first column to DD/MM/YYYY, drop rows with un-normalizable dates,
        and return (table_text, row_count).
        """
        lines = [ln.rstrip() for ln in md_text.splitlines()]
        rows = []
        header_seen = False
        sep_seen = False

        for ln in lines:
            if not ln.strip().startswith("|"):
                continue
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            if len(cells) < 2:
                continue

            # Detect header
            if not header_seen and ("date" in cells[0].lower() and "event" in " ".join(cells[1:]).lower()):
                header_seen = True
                continue
            # Detect separator row (---)
            if not sep_seen and re.match(r"^\s*:?-{3,}:?\s*$", cells[0]):
                sep_seen = True
                continue

            # Data row: keep only first two columns
            date_cell = cells[0]
            event_cell = cells[1]

            norm = normalize_date_string(date_cell)
            if not norm:
                # Try to extract a date-like token within the cell
                # e.g., “2024-03-15 — ...”
                # Pull first plausible token (very simple heuristic)
                tok = re.split(r"[—\-–]|,|\s{2,}", date_cell)[0].strip()
                norm = normalize_date_string(tok)

            if not norm:
                # skip rows we can't normalize into DD/MM/YYYY
                continue

            rows.append((norm, event_cell))

        # sort earliest -> latest by YYYYMMDD numeric
        def sort_key(row):
            d, e = row
            # dd/mm/yyyy -> yyyymmdd
            day, mon, year = d.split("/")
            return (year, mon, day)

        rows.sort(key=sort_key)

        # Build strict 2-col table
        out = []
        out.append("| Date | Event |")
        out.append("|---|---|")
        for d, e in rows:
            out.append(f"| {d} | {e} |")

        return ("\n".join(out), len(rows))

    try:
        filepath = _read_ingested_filepath(user_id, thread_id)
        if not filepath or not Path(filepath).exists():
            return {"success": False, "message": "No ingested file for this thread."}

        # Prefer metadata snippets saved at ingest time
        _, meta_path, _ = chat_paths(user_id, thread_id)
        snippets: List[str] = []
        diagnostics: Dict[str, Any] = {"meta_used": False}

        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                taken = 0
                for k in sorted(meta.keys(), key=lambda x: int(x) if str(x).isdigit() else x):
                    if taken >= max_snippets:
                        break
                    t = meta.get(k, {}).get("text") or ""
                    if t.strip():
                        snippets.append(t.strip())
                        taken += 1
                if snippets:
                    diagnostics["meta_used"] = True
                    diagnostics["meta_count"] = len(snippets)
            except Exception as e:
                diagnostics["meta_error"] = str(e)

        # Fallback: extract & chunk if no meta snippets
        if not snippets:
            extraction = extract_text_with_diagnostics(filepath)
            diagnostics["extraction"] = extraction.get("diagnostics", {})
            text = extraction.get("text", "") or ""
            if not text.strip():
                return {"success": False, "message": "No text available to generate timeline.", "diagnostics": diagnostics}
            chunks = chunk_text(text, chunk_size=1200, overlap=200)
            for _, ctext in chunks[:max_snippets]:
                snippets.append(ctext)
            diagnostics["from_chunks"] = len(snippets)

        if not snippets:
            return {"success": False, "message": "Unable to find document excerpts for timeline.", "diagnostics": diagnostics}

        # Build stricter prompt (no snippet column, explicit format & threshold)
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

        # Post-process to enforce format and threshold regardless of LLM drift
        sanitized_md, row_count = sanitize_table(timeline_md)

        if row_count < 6:
            return {"success": True, "timeline_markdown": "No timeline to show in your document.", "diagnostics": diagnostics}

        return {"success": True, "timeline_markdown": sanitized_md, "diagnostics": diagnostics}
    except Exception as e:
        return {"success": False, "message": f"generate_timeline error: {e}"}