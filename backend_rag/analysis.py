

from __future__ import annotations

import json
import math
import re
import os
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

# External dependencies used across versions
import cloudscraper
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


def generate_study_guide(user_id: Optional[str], thread_id: str, max_snippets: int = 8) -> Dict[str, Any]:
    """
    Build a study guide from representative snippets stored in Pinecone.
    (Original implementation retained from the first code block.)
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
            "You are a detailed legal document analyst.\n"
            "Using only the provided document excerpts, produce:\n"
            "- A plain-English statement of what this document is (e.g., contract, agreement, policy) and its general purpose.\n"
            "- A comprehensive, long-form plain-English summary aimed at a non-lawyer, covering all key topics and details in the text.\n"
            "- A single-line confidence indicator (High/Medium/Low).\n"
        )

        user_prompt = f"Document excerpts:\n\n{context_excerpt}\n\nProduce the Study Guide as requested above."

        guide_text = call_model_system_then_user(system_prompt, user_prompt, temperature=0.2)
        return {"success": True, "study_guide": guide_text}
    except Exception as e:
        return {"success": False, "message": f"generate_study_guide error: {e}"}
    

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
            "Keep the definition short (1-2 sentences), give one concrete example relevant to the document, and list any immediate "
            "legal implications or actions (one line). If the paragraph does not define the term, say 'Not stated in document.'"
        )
        q_user = f"Term: {term}\n\nParagraph:\n{paragraph}\n\nDefinition:"

        definition = call_model_system_then_user(q_prompt_sys, q_user, temperature=0.2)
        return {"success": True, "term": term, "definition": definition, "snippet": paragraph}
    except Exception as e:
        return {"success": False, "message": f"get_term_context error: {e}"}


def generate_faq(user_id: Optional[str], thread_id: str, max_snippets: int = 8, num_questions: int = 10) -> Dict[str, Any]:
    """
    Generate an FAQ (questions & answers) based ONLY on the uploaded document excerpts stored in Pinecone.
    (Retained from the first code block.)
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

# --- MODIFIED: Handle failure gracefully ---
def _agent0_identify_legal_domain(context: str) -> str:
    """Agent 0: Identifies the core legal domain of the document."""
    print("--- [AGENT 0] Identifying legal domain... ---")
    system_prompt = (
        "Based on the text, identify the primary area of Indian law. "
        "Respond with ONLY the name of the area and the key statute, if applicable. "
        "Examples: 'Indian Contract Act, 1872', 'Transfer of Property Act, 1882', 'Income Tax Act, 1961', 'Code of Civil Procedure, 1908'. "
        "Be concise."
    )
    user_prompt = f"Document Text:\n---\n{context}\n---"
    try:
        domain = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)
        print(f"--- [AGENT 0] Identified Domain: {domain} ---")
        return domain.strip()
    except Exception as e:
        # Instead of returning a hardcoded default, return an empty string to signal failure.
        print(f"--- [AGENT 0] ERROR: Could not identify legal domain due to: {e} ---")
        return ""

def _agent1_generate_search_queries(context: str, domain: str) -> List[str]:
    print(f"--- [AGENT 1] Generating search-engine-friendly queries for domain: {domain}... ---")
    system_prompt = (
        "You are a legal research assistant creating search queries for a simple engine like Google. "
        "Based on the document text, generate three short, simple search phrases to find relevant Indian case law.\n\n"
        "**RULES:**\n"
        "- Use simple keywords.\n"
        "- **DO NOT** include section numbers (like 'Section 125' or 'Section 24').\n"
        "- **DO NOT** use legal jargon like 'pendente lite' or 'vs.'.\n"
        "- **DO NOT** number the queries.\n"
        "- Keep each query under 7 words.\n\n"
        "**GOOD EXAMPLES:**\n"
        "maintenance from date of application\n"
        "interim maintenance for educated wife\n"
        "overlapping jurisdiction HMA DV Act\n\n"
        "**BAD EXAMPLES:**\n"
        "1. Hindu Marriage Act Section 24 interim maintenance unemployed wife\n"
        "2. maintenance pendente lite vs permanent alimony"
    )
    user_prompt = f"Document Text:\n---\n{context}\n---"
    try:
        response = call_model_system_then_user(system_prompt, user_prompt, temperature=0.3)
        queries = [q.strip() for q in response.split('\n') if q.strip()]
        if not queries: raise ValueError("LLM returned no queries.")
        print(f"--- [AGENT 1] Generated queries: {queries} ---")
        return queries[:3]
    except Exception as e:
        print(f"--- [AGENT 1] Failed to generate queries: {e} ---")
        return []

def _clean_scraped_text_heuristic(soup: BeautifulSoup) -> str:
    for element in soup(["script", "style", "header", "footer", "nav", "form"]):
        element.decompose()
    text = soup.get_text(separator='\n', strip=True)
    lines = text.split('\n')
    start_index = 0
    anchor_keywords = ["J U D G M E N T", "JUDGMENT", "O R D E R", "ORDER"]
    for i, line in enumerate(lines):
        if line.strip().upper() in anchor_keywords:
            start_index = i + 1
            break
    content_lines = lines[start_index:]
    stop_phrases = [ "Get this document in PDF", "Warning on translation", "Share Link", "Desktop View", "Cites", "Cited by", "Equivalent citations:", "Author:", "Bench:", "PETITIONER:", "RESPONDENT:", "DATE OF JUDGMENT", "Virtual Legal Assistant" ]
    cleaned_lines = [line for line in content_lines if not any(phrase.lower() in line.lower() for phrase in stop_phrases)]
    return "\n".join(cleaned_lines).strip()


import os
import re
from typing import Dict, List
from urllib.parse import quote
import cloudscraper
from bs4 import BeautifulSoup

# This is the only function you need to replace in analysis.py

def _agent2_retrieve_cases_from_indian_kanoon(queries: List[str], max_cases: int = 3) -> List[Dict]:
    """
    [UPGRADED] Performs search and robust scraping via a proxy service to avoid being blocked.
    """
    if not queries: 
        return []

    # --- MODIFIED: Read the API key from environment variables ---
    SCRAPER_API_KEY = os.environ.get("SCRAPER_API_KEY")

    scraper = cloudscraper.create_scraper()
    all_results = {}

    for query in queries:
        full_query = f'"{query}"'
        
        try:
            target_url = f"https://indiankanoon.org/search/?formInput={quote(full_query)}"
            request_url = target_url

            # --- MODIFIED: Build the proxy URL if a key is available ---
            if SCRAPER_API_KEY:
                print(f"--- [AGENT 2] Searching via proxy with query: '{full_query}' ---")
                proxy_url = f"http://api.scraperapi.com?api_key={SCRAPER_API_KEY}&url={quote(target_url)}"
                request_url = proxy_url
            else:
                print(f"--- [AGENT 2] WARNING: No proxy key found. Making a direct request which may be blocked on deployed servers. ---")
                print(f"--- [AGENT 2] Searching directly with query: '{full_query}' ---")
            
            # Use a longer timeout for proxy requests
            response = scraper.get(request_url, timeout=45)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            
            results = soup.find_all('div', class_='result')
            for result in results:
                if (title_div := result.find('div', class_='result_title')) and (link := title_div.find('a')):
                    case_url = "https://indiankanoon.org" + link['href']
                    if case_url not in all_results:
                        all_results[case_url] = {"case_name": link.get_text(strip=True), "url": case_url}
        except Exception as e:
            print(f"--- [AGENT 2] Search failed for query '{query}': {e} ---")

    unique_cases = list(all_results.values())[:max_cases]
    if not unique_cases:
        print("--- [AGENT 2] No relevant cases found. ---")
        return []
    
    print(f"--- [AGENT 2] Found {len(unique_cases)} unique cases to scrape. ---")

    for case in unique_cases:
        try:
            target_url = case['url']
            request_url = target_url

            # --- MODIFIED: Also use proxy for scraping individual case pages ---
            if SCRAPER_API_KEY:
                print(f"--- [AGENT 2] Scraping page via proxy: {target_url} ---")
                proxy_url = f"http://api.scraperapi.com?api_key={SCRAPER_API_KEY}&url={quote(target_url)}"
                request_url = proxy_url
            else:
                 print(f"--- [AGENT 2] Scraping page directly: {target_url} ---")

            page_response = scraper.get(request_url, timeout=45)
            page_response.raise_for_status()
            case_soup = BeautifulSoup(page_response.text, 'html.parser')
            
            cleaned_text = _clean_scraped_text_heuristic(case_soup) # Assumes this helper function exists in your file
            
            if len(cleaned_text) > 300:
                case['raw_text'] = cleaned_text[:25000]
                print(f"--- [AGENT 2] SUCCESS: Extracted {len(case['raw_text'])} chars for '{case['case_name']}'.")
            else:
                case['raw_text'] = ""
                print(f"--- [AGENT 2] FAILED: Could not extract sufficient text for '{case['case_name']}'.")
        except Exception as e:
            case['raw_text'] = ""
            print(f"--- [AGENT 2] FAILED to scrape '{case.get('url')}': {e} ---")
    
    return [case for case in unique_cases if case.get('raw_text')]

def _agent3_consolidated_analysis(user_context: str, case: Dict, domain: str) -> Optional[Dict]:
    raw_text = case.get("raw_text", "")
    if len(raw_text) < 300: return None
    system_prompt = (
        f"You are an expert legal analyst for Indian law, specializing in the '{domain}'. Your task is to analyze a historical court case and explain its relevance to a user's current situation within this specific legal domain. Respond in a strict JSON format.\n\n"
        "Output JSON schema:\n"
        "{\n"
        "  \"is_useful\": true|false,\n"
  		"  \"reason_if_not_useful\": \"If is_useful=false, briefly explain why it's not relevant to the user's situation under {domain}.\",\n"
        "  \"similarity_summary\": \"If is_useful=true, explain the similarity between the user's situation and the historical case, focusing on principles from the {domain}.\",\n"
        "  \"case_outcome\": \"If is_useful=true, state the final decision of the historical case.\"\n"
        "}"
    )
    user_prompt = f"USER_SITUATION:\n---\n{user_context}\n---\n\nHISTORICAL_CASE_TEXT for '{case.get('case_name')}':\n---\n{raw_text}\n---"
    try:
        response_str = call_model_system_then_user(system_prompt, user_prompt, temperature=0.1)
        match = re.search(r'\{.*\}', response_str, re.DOTALL)
        if not match:
            print(f"--- [AGENT 3] Could not find JSON in response for '{case.get('case_name')}'.")
            return None
        analysis = json.loads(match.group(0))
        if analysis.get("is_useful"):
            print(f"--- [AGENT 3] AI deemed case '{case.get('case_name')}' as USEFUL.")
            return {"case_name": case.get("case_name"), "url": case.get("url"), "details": analysis.get("similarity_summary"), "outcome": analysis.get("case_outcome")}
        else:
            reason = analysis.get("reason_if_not_useful", "Not relevant.")
            print(f"--- [AGENT 3] AI deemed case '{case.get('case_name')}' not useful. Reason: {reason} ---")
            return None
    except Exception as e:
        print(f"--- [AGENT 3] Failed to parse analysis for '{case.get('case_name')}': {e} ---")
        return None

# --- MODIFIED: Handle failure from Agent 0 ---
def suggest_case_law(user_id: Optional[str], thread_id: str) -> Dict[str, Any]:
    """Main orchestrator for the domain-focused case law feature."""
    try:
        index = get_or_create_index(dim=384)
        ns = namespace(user_id, thread_id)
        query_result = query_top_k(index, ns, query_vec=[0.0] * 384, top_k=25)
        if not query_result:
            return {"success": False, "message": "No document excerpts for analysis."}
        user_context = "\n".join([hit.get("metadata", {}).get("text", "").strip() for hit in query_result])
        if len(user_context.strip()) < 100:
            return {"success": False, "message": "Document content is too short for analysis."}
        context_snippet = user_context[:4000]

        # Step 0: Identify the Legal Domain
        legal_domain = _agent0_identify_legal_domain(context_snippet)
        
        # --- NEW: Check if Agent 0 failed ---
        if not legal_domain:
            return {"success": False, "message": "Could not automatically identify the legal domain of the document. The AI model may be temporarily unavailable."}
        
        # Step 1: Generate Domain-Specific, Search-Friendly Queries
        search_queries = _agent1_generate_search_queries(context_snippet, legal_domain)
        
        # Step 2: Perform Filtered Search and Scrape
        retrieved_cases = _agent2_retrieve_cases_from_indian_kanoon(search_queries)
        if not retrieved_cases:
            return {"success": True, "suggested_cases": [], "message": f"No relevant cases under '{legal_domain}' could be found online for this document."}

        # Step 3: Perform Domain-Aware Analysis
        final_cases = []
        for case in retrieved_cases:
            if analysis_result := _agent3_consolidated_analysis(context_snippet, case, legal_domain):
                final_cases.append(analysis_result)
        
        if not final_cases:
            return {"success": True, "suggested_cases": [], "message": f"Found some potential cases, but none were sufficiently relevant to your document's specific context within '{legal_domain}'."}

        return {"success": True, "suggested_cases": final_cases}

    except Exception as e:
        print(f"--- [ERROR] An unexpected error occurred in suggest_case_law: {e}")
        return {"success": False, "message": f"An unexpected error occurred: {e}"}