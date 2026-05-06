# full updated file with corrected endpoints for JSON responses
from __future__ import annotations
from fastapi.responses import RedirectResponse
from fastapi.responses import StreamingResponse, JSONResponse
import io
import os
from pathlib import Path
import tempfile
from typing import Optional
import re
import json
from typing import List, Optional, Dict, Any # Ensure List is included
# --- START: ADDED FOR FORM FILLING (Ensure these imports are present) ---
import json # Likely already there
import shutil
from fastapi import Body, APIRouter # Add Body and APIRouter if you plan to use it
from pydantic import Field as PydanticField # If needed for complex models
from backend_rag.form_processing import DetailedOcrResult, OcrPage, OcrWord
from fastapi.responses import Response
from backend_rag.tts import generate_speech_audio
# Import the new form processing functions
from backend_rag.form_processing import (
    detect_form_fields,
    generate_field_suggestions,
    fill_pdf_form,       # Placeholder function
    fill_docx_form       # Functional implementation
    # Assuming OcrResult class is defined in form_processing.py or imported there
)
# In api_server.py, at the top with other imports
from cryptography.fernet import Fernet  # <--- ADD THIS

# ... (other imports)

# --- LOAD ENCRYPTION KEY ---
ENCRYPTION_KEY = os.getenv("TEXT_ENCRYPTION_KEY")
cipher = Fernet(ENCRYPTION_KEY) if ENCRYPTION_KEY else None
if not cipher:
    print("⚠️ WARNING: TEXT_ENCRYPTION_KEY not found. Ingestion will be PLAIN TEXT.")
else:
    print("🔒 Encryption is ENABLED for new uploads.")
from backend_rag.prompts import build_strict_system_prompt 
from backend_rag.prompts import WEB_ANSWER_SYSTEM_PROMPT
from backend_rag.web_search import google_search
from backend_rag.models import model # Import both models
# --- END: ADDED FOR FORM FILLING (Imports) ---
# Ensure all backend modules are correctly imported
# In api_server.py, near other backend imports
from backend_rag.Translation import detect_language, translate_text
from backend_rag.vectorstore_pinecone import get_or_create_index, upsert_chunks, delete_namespace, namespace, query_top_k, namespace_count
from backend_rag.embeddings import embed_texts, get_embedding_dimension
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydub import AudioSegment

from backend_rag.retrieval import retrieve_similar_chunks, retrieve_general_legal_chunks
from backend_rag.extract import extract_text_with_diagnostics
from backend_rag.chunking import chunk_text
from backend_rag.analysis import (
    generate_study_guide,
    quick_analyze_for_thread as quick_analyze_thread,
    generate_faq,
    generate_timeline,
    suggest_case_law,
    generate_predictive_output, 
    generate_clause_explanations,
    generate_mindmap,              
    generate_structured_timeline,
    generate_short_summary,
    generate_risk_analysis,
    
)
from backend_rag.prompts import (
    build_strict_system_prompt , 
    WEB_ANSWER_SYSTEM_PROMPT,
    GENERAL_LEGAL_QA_PROMPT  
)
from backend_rag.highlighting import find_text_coordinates
from backend_rag.retrieval import retrieve_similar_chunks
from backend_rag.ocr import speech_to_text_from_local_file, speech_to_text_from_bytes

# try to use your LLM helper; fall back to a minimal one if not present
try:
    from backend_rag.llm import call_model_system_then_user
except Exception:
    from backend_rag.models import model
    from langchain_core.messages import SystemMessage, HumanMessage
    def call_model_system_then_user(system_prompt: str, user_prompt: str, temperature: float = 0.0) -> str:
        sys = SystemMessage(content=system_prompt)
        hum = HumanMessage(content=user_prompt)
        try:
            resp = model.invoke([sys, hum])
            return getattr(resp, "content", str(resp))
        except Exception as e:
            return f"(model error: {e})"

# optional: use your prompt builder if it exists, otherwise a safe default

from backend_rag.prompts import build_strict_system_prompt 
from backend_rag.prompts import build_summary_system_prompt

# ----------------------------- FastAPI app ------------------------------------
app = FastAPI(title="RAG Backend API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/tmp/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ----------------------------- Models -----------------------------------------
# In api_server.py, update these models

class StudyGuideReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    output_language: Optional[str] = 'en' # Add this

class PredictiveOutputReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    output_language: Optional[str] = 'en' # Add this

class SpeakReq(BaseModel):
    text: str
    language: str = "en"
    
class ShortSummaryReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    output_language: Optional[str] = 'en'

# --- START: ADDED FOR FORM FILLING (Pydantic Models) ---
class DetectedField(BaseModel):
    id: str
    label_text: Optional[str] = ""
    bbox: List[int] 
    page_number: int  # <--- *** THIS IS THE FIRST CHANGE ***
    semantic_type: str
    confidence: str
    is_sensitive: bool
    description: Optional[str] = "Enter the required information."
    suggestions: List[str] = []
    value: str = ""

class FormAnalyzeResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    form_id: str 
    fields: List[DetectedField] = []

class FieldValue(BaseModel):
    id: str
    value: str

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str

class FormExportRequest(BaseModel):
    form_id: str # ID received from analyze response
    field_values: List[FieldValue]
    export_format: str = "docx" # Default to docx as it's implemented
    original_filename: Optional[str] = None # Important for finding the template/original

# Rebuild new models too
DetectedField.model_rebuild()
FormAnalyzeResponse.model_rebuild()
FieldValue.model_rebuild()
FormExportRequest.model_rebuild()
# --- END: ADDED FOR FORM FILLING (Pydantic Models) ---


class QuickAnalyzeReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str


class FAQReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    max_snippets: int = 8
    num_questions: int = 10
    output_language: Optional[str] = 'en' # Add this

class TimelineReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    max_snippets: int = 10
    output_language: Optional[str] = 'en' # Add this

class AskReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    query: str
    top_k: int = 4
    output_language: Optional[str] = 'en' # Add this
    history: List[ChatMessage] = []

class CaseLawReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    output_language: Optional[str] = 'en' # Add this


class StressTestReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    output_language: Optional[str] = 'en'


class GeneralAskReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    query: str
    history: List[ChatMessage] = []  # <--- History Support
    output_language: Optional[str] = 'en'

class ClauseReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    output_language: Optional[str] = 'en'

class FlowchartReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str



# ----------------------------- Utils ------------------------------------------

from backend_rag.Translation import translate_text # Ensure this is imported
from typing import Any, Dict, List, Optional, Union # Ensure these are imported

# ... (keep all your other code and endpoints) ...
def _find_coordinates_in_ocr_result(ocr_result: DetailedOcrResult, target_text: str) -> List[Dict[str, Any]]:
    """
    Locates a target text string within the pre-parsed OCR result (words + bboxes).
    Mimics the logic of highlighting.py but uses the in-memory OcrResult object
    instead of re-opening the PDF.
    """
    import re
    
    # Normalize target (lowercase, remove extra spaces)
    normalized_target = re.sub(r'\s+', ' ', target_text).strip().lower()
    target_words = normalized_target.split()
    if not target_words:
        return []

    found_boxes = []
    seq_len = len(target_words)

    # Iterate through every page
    for page in ocr_result.pages:
        # Create a list of normalized words for this page
        page_word_texts = [re.sub(r'\s+', ' ', w.text).strip().lower() for w in page.words]
        
        # Sliding window search
        for i in range(len(page_word_texts) - seq_len + 1):
            if page_word_texts[i : i + seq_len] == target_words:
                
                # Match Found! Grab the original word objects
                matched_ocr_words = page.words[i : i + seq_len]
                
                # --- Merge Logic (Simple Union Rect per line) ---
                # Group by Y-coordinate to handle multi-line highlights
                lines = {}
                for w in matched_ocr_words:
                    # Round Y to nearest 5px to group words on same line
                    y_key = round(w.bbox[1] / 5) * 5 
                    if y_key not in lines: lines[y_key] = []
                    lines[y_key].append(w)

                # Create boxes
                for _, line_words in lines.items():
                    x0 = min(w.bbox[0] for w in line_words)
                    top = min(w.bbox[1] for w in line_words)
                    x1 = max(w.bbox[2] for w in line_words)
                    bottom = max(w.bbox[3] for w in line_words)
                    
                    found_boxes.append({
                        "page": page.page_number,
                        "x": x0,
                        "y": top,
                        "width": x1 - x0,
                        "height": bottom - top,
                        # "text_fragment": " ".join([w.text for w in line_words]) # Optional debug
                    })

    return found_boxes

# --- ADD THIS NEW HELPER FUNCTION near the top of api_server.py ---
# This function can "walk" through a JSON object and translate all string values,
# leaving the keys in English, which is perfect for your new output.
def _translate_json_values(
    data: Union[Dict, List, str], 
    target_language: str
) -> Union[Dict, List, str]:
    """
    Recursively translates string values in a JSON object or list.
    Keeps all keys in English.
    """
    if not data or target_language == 'en':
        return data

    try:
        if isinstance(data, str):
            # Base case: translate the string
            # Avoid translating errors or "not specified" placeholders
            if data.strip().lower() in ["not specified", "not specified in the provided excerpts."]:
                return data
            translated = translate_text(data, target_language)
            return translated if translated else data

        if isinstance(data, list):
            # If it's a list, translate each item
            return [_translate_json_values(item, target_language) for item in data]

        if isinstance(data, dict):
            # If it's a dict, translate all values, keep keys
            return {
                key: _translate_json_values(value, target_language)
                for key, value in data.items()
            }
        
        # If it's a number, boolean, or other type, just return it
        return data

    except Exception as e:
        print(f"--- [TRANSLATE_JSON] Error during recursive translation: {e} ---")
        return data # Return original data on error


def _stream_text_file(text: str, filename: str, media_type: str = "text/plain; charset=utf-8"):
    buf = io.BytesIO(text.encode("utf-8"))
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(buf, media_type=media_type, headers=headers)

def _reset_vector_store(user_id: Optional[str], thread_id: str):
    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)
    try:
        delete_namespace(index, ns)
    except Exception:
        pass

# In api_server.py


# In api_server.py

def _extract_and_translate_only(local_path: str) -> Dict[str, Any]:
    """
    Lightweight Processor: Extracts and Translates text ONLY. 
    Does NOT chunk, embed, or store in Pinecone.
    """
    # 1. Extract Text
    extraction = extract_text_with_diagnostics(local_path)
    text = (extraction.get("text") or "").strip()
    
    if not text:
        return {"success": False, "message": "No text extracted from file."}

    # 2. Language Detection & Translation (Crucial for Analysis)
    detection = detect_language(text)
    original_lang = 'en'
    
    if detection and detection.get('language') and detection.get('confidence', 0) > 0.5:
        original_lang = detection['language']

    text_to_process = text
    if original_lang != 'en':
        # We still need translation so the English-prompted AI can understand it
        translated = translate_text(text, target_language='en')
        if translated:
            text_to_process = translated
            print(f"--- [Risk Upload] Translated from {original_lang} to en ---")

    return {
        "success": True,
        "extracted_text": text_to_process,
        "original_language": original_lang
    }
# In api_server.py
# In api_server.py


# In api_server.py
def _ingest_no_sqlite_save(local_path: str, file_name: str, user_id: Optional[str], thread_id: str,input_language: str = "en-IN"):
    # 1. Extract Text
    extraction = extract_text_with_diagnostics(local_path)
    text = (extraction.get("text") or "").strip()
    source = extraction.get("source")
    diagnostics = extraction.get("diagnostics", {})

    if not text:
        return {
            "success": False, 
            "message": "No text extracted from file.", 
            "diagnostics": diagnostics, 
            "source": source
        }

    # 2. Language Detection & Translation
    # We translate to English for better Embedding/Search accuracy
    detection = detect_language(text)
    original_lang = 'en'
    if detection and detection.get('language') and detection.get('confidence', 0) > 0.5:
        original_lang = detection['language']

    text_to_process = text
    if original_lang != 'en':
        translated = translate_text(text, target_language='en')
        if translated:
            text_to_process = translated
            diagnostics['translation'] = f"Detected '{original_lang}', translated to 'en'"
    
    # 3. Chunking (Process the English/Translated text)
    chunks = chunk_text(text_to_process, chunk_size=1000, overlap=200)
    texts = [c[1] for c in chunks]
    
    if not texts:
        return {
            "success": False, 
            "message": "No chunks created from file.", 
            "diagnostics": diagnostics, 
            "source": source
        }
    
    # 4. Embed CLEAR TEXT (So the AI can understand and search it)
    vecs = embed_texts(texts)
    vecs_list = [v.astype("float32").tolist() for v in vecs]
    ids = [c[0] for c in chunks]
    
    # 5. Prepare Metadata (Encrypting the text for storage)
    metadatas = []
    for i in range(len(texts)):
        # Get the clear text snippet
        clear_text_snippet = texts[i][:4000]
        
        # --- ENCRYPTION LOGIC ---
        # We encrypt the text so it is unreadable in the Pinecone Dashboard
        if 'cipher' in globals() and cipher:
            try:
                stored_text = cipher.encrypt(clear_text_snippet.encode()).decode()
            except Exception as e:
                print(f"--- [Ingest] Encryption failed for chunk {i}: {e} ---")
                stored_text = clear_text_snippet # Fallback to clear text
        else:
            stored_text = clear_text_snippet
        # ------------------------

        metadatas.append({
            "file_name": file_name,
            "chunk_id": ids[i],
            "text": stored_text,  # Store ENCRYPTED text
            "original_language": original_lang,
        })

    # 6. Upsert to Pinecone
    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)
    upsert_chunks(index, ns, vecs_list, ids, metadatas)
    
    return {
        "success": True, 
        "message": f"Ingested {len(chunks)} chunks (source={source}, lang={original_lang}) into chat {thread_id}", 
        "diagnostics": diagnostics, 
        "source": source,
        "extracted_text": text # Returning original text for frontend reference if needed
    }


def _ingest_audio_no_sqlite_save(
    local_path: str, 
    file_name: str, 
    user_id: Optional[str], 
    thread_id: str,
    input_language: str = "en-US"  # <--- ADD THIS PARAMETER
):
    try:
        # Step 1: Transcribe the audio file
        # Ensure speech_to_text_from_local_file in ocr.py accepts language_code
        speech_result = speech_to_text_from_local_file(local_path, language_code=input_language)
        
        transcript = speech_result.get("transcript", "")
        detected_lang_code = speech_result.get("detected_language", input_language)

        if not transcript or transcript.startswith("(speech error"):
            return {"success": False, "message": f"Could not produce transcript. Reason: {transcript}"}

        text = transcript.strip()
        # Use the language code we detected or passed
        original_lang = detected_lang_code.split('-')[0] 
        source = f"audio:{file_name}"
        diagnostics = {
            "transcript_length": len(text.split()),
            "detected_audio_language": detected_lang_code
        }

        # Step 2: Chunk + Embed + Store as usual
        chunks = chunk_text(text, chunk_size=1000, overlap=200)
        texts = [c[1] for c in chunks]
        if not texts:
            return {"success": False, "message": "No chunks created from transcript.", "transcript": transcript}

        vecs = embed_texts(texts)
        vecs_list = [v.astype("float32").tolist() for v in vecs]
        ids = [c[0] for c in chunks]

        # Encrypt metadata
        metadatas = []
        for i in range(len(texts)):
            clear_text_snippet = texts[i][:4000]
            
            # Encryption Logic
            if 'cipher' in globals() and cipher:
                try:
                    stored_text = cipher.encrypt(clear_text_snippet.encode()).decode()
                except Exception:
                    stored_text = clear_text_snippet
            else:
                stored_text = clear_text_snippet

            metadatas.append({
                "file_name": file_name,
                "chunk_id": ids[i],
                "text": stored_text, # Encrypted
                "source": source,
                "original_language": original_lang
            })

        dim = get_embedding_dimension()
        index = get_or_create_index(dim)
        ns = namespace(user_id, thread_id)
        upsert_chunks(index, ns, vecs_list, ids, metadatas)

        return {
            "success": True,
            "message": f"Ingested {len(chunks)} audio chunks (source={source}, lang={original_lang})",
            "transcript": transcript,
            "diagnostics": diagnostics,
            "source": source,
            "original_language": original_lang
        }

    except Exception as e:
        return {"success": False, "message": f"_ingest_audio_no_sqlite_save error: {e}"}



# ----------------------------- Endpoints --------------------------------------
@app.get("/")
async def root():
    return RedirectResponse(url="/docs")
    
@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/study-guide")
def study_guide(req: StudyGuideReq):
    """
    Generates a structured study guide by classifying the document
    and routing to the correct summarization agent.
    """
    print("\n--- SERVER CHECK: The /api/study-guide (V2) endpoint was called. ---")
    try:
        # 1. Generate the structured JSON output
        # This function now returns a dict:
        # { "success": True, "study_guide": { "document_type": "...", "summary": {...} } }
        result = generate_study_guide(req.user_id, req.thread_id)

        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result)

        # 2. Check for translation
        if req.output_language and req.output_language != 'en':
            print(f"--- [API Study Guide] Translating structured JSON to {req.output_language}... ---")
            # Get the structured object to be translated
            study_guide_json = result.get("study_guide", {})
            
            # Use the new recursive translation helper
            translated_guide = _translate_json_values(study_guide_json, req.output_language)
            
            if translated_guide:
                result["study_guide"] = translated_guide
            else:
                print(f"--- [API Study Guide] Recursive translation failed. Returning English. ---")

        # 3. Return the (potentially translated) structured JSON
        return result

    except Exception as e:
        print(f"--- [API Study Guide] Error: {e} ---")
        raise HTTPException(status_code=500, detail=f"Error generating study guide: {e}")

@app.post("/api/quick-analyze")
def api_quick_analyze(req: QuickAnalyzeReq):
    try:
        out = quick_analyze_thread(req.user_id, req.thread_id)
        if not out.get("success"):
            raise HTTPException(status_code=422, detail=out)
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail={"success": False, "message": f"quick_analyze error: {str(e)}"})


@app.post("/api/timeline")
def timeline(req: TimelineReq):
    print("\n--- SERVER CHECK: The /api/timeline endpoint was called. ---")
    try:
        result = generate_timeline(req.user_id, req.thread_id, max_snippets=req.max_snippets)
        if req.output_language and req.output_language != 'en':
            timeline_events = result.get("timeline", [])
            for item in timeline_events:
                event = item.get("event", "")
                if event:
                    translated_event = translate_text(event, req.output_language)
                    if translated_event:
                        item["event"] = translated_event

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating timeline: {e}")

@app.post("/api/predictive-output")
def api_predictive_output(req: PredictiveOutputReq):
    print("\n--- SERVER CHECK: The /api/predictive-output endpoint was called. ---")
    try:
        result = generate_predictive_output(req.user_id, req.thread_id)
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result)

        if req.output_language and req.output_language != 'en':
            prediction = result.get("prediction", {})
            disclaimer = prediction.get("disclaimer", "")
            if disclaimer:
                translated_disclaimer = translate_text(disclaimer, req.output_language)
                if translated_disclaimer:
                    prediction["disclaimer"] = translated_disclaimer

            scenarios = prediction.get("scenarios", [])
            for scenario in scenarios:
                outcome = scenario.get("outcome", "")
                if outcome:
                    translated_outcome = translate_text(outcome, req.output_language)
                    if translated_outcome:
                        scenario["outcome"] = translated_outcome
                reasoning = scenario.get("reasoning", "")
                if reasoning:
                    translated_reasoning = translate_text(reasoning, req.output_language)
                    if translated_reasoning:
                        scenario["reasoning"] = translated_reasoning

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating predictive output: {e}")

    
@app.post("/api/ingest")
async def ingest(user_id: Optional[str] = Form(default=None), thread_id: str = Form(...), file: UploadFile = File(...), replace: bool = Form(False)):
    if replace:
        _reset_vector_store(user_id, thread_id)
    save_name = f"{thread_id}_{file.filename}"
    local_path = UPLOAD_DIR / save_name
    with local_path.open("wb") as f:
        f.write(await file.read())
    result = _ingest_no_sqlite_save(str(local_path), file.filename, user_id, thread_id)
    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result)
    return result

# In api_server.py

@app.post("/api/ingest-audio")
async def ingest_audio(
    user_id: Optional[str] = Form(default=None),
    thread_id: str = Form(default=None),
    file: UploadFile = File(...),
    replace: bool = Form(False),
    input_language: str = Form("en-IN") # <--- New Form Field
):
    if replace:
        _reset_vector_store(user_id, thread_id)
    
    save_name = f"{thread_id}_{file.filename}"
    local_path = UPLOAD_DIR / save_name
    with local_path.open("wb") as f:
        f.write(await file.read())
    
    # Pass the language code to the logic function
    result = _ingest_audio_no_sqlite_save(
        str(local_path), 
        file.filename, 
        user_id, 
        thread_id,
        input_language=input_language
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result)
    
    return result
    
    return result

# In api_server.py

# In api_server.py
import json
import html



# In api_server.py

# Ensure these are imported at the top
import json
from fastapi.responses import StreamingResponse 

# In api_server.py

# In api_server.py

@app.post("/api/ask")
def api_ask(req: AskReq):
    # --- Step 1: Translate query (Keep existing logic) ---
    query_to_process = req.query
    if req.query.strip():
        query_lang_detection = detect_language(req.query)
        if query_lang_detection and query_lang_detection.get('language') != 'en':
            translated_query = translate_text(req.query, target_language='en')
            if translated_query:
                query_to_process = translated_query

    # --- Step 2: Retrieve similar chunks (Keep existing logic) ---
    hits = retrieve_similar_chunks(query_to_process, user_id=req.user_id, thread_id=req.thread_id, top_k=req.top_k)
    sources = []
    
    if not hits:
        print("--- [API Ask] No RAG results. Proceeding to web search. ---")
        context_combined = "No relevant document excerpts found."
    else:
        # --- Step 3: Prepare context ---
        context_blobs = []
        for r in hits:
            # Note: r['text'] is already decrypted by retrieval.py
            text = (r.get("text") or "").replace("\n", " ")
            fn = r.get("file_name") or "document"
            context_blobs.append(f"--- From file: {fn} ---\n{text}\n")
            sources.append({"file_name": fn, "preview": text[:300]})

        context_combined = "\n\n".join(context_blobs)

    # --- Process History ---
    history_text = ""
    recent_history = req.history[-20:] 
    for msg in recent_history:
        role_label = "User" if msg.role == "user" else "AI"
        history_text += f"{role_label}: {msg.content}\n"

    # --- Build Prompt with Follow-up Instruction ---
    base_prompt = build_strict_system_prompt(context_combined, chat_history_str=history_text)
    
    # Append the hidden instruction to the system prompt
    system_prompt_rag = base_prompt + (
        "\n\n**BONUS TASK:** At the very end of your response, strictly on a new line, "
        "generate exactly 2 relevant follow-up questions the USER should ask you next based on this topic. "
        "Format them as: `||Q1: [Question]||Q2: [Question]||` so I can parse them easily."
    )
    
    user_prompt_rag = query_to_process.strip()

    # --- Call Model ---
    ai_response_text = call_model_system_then_user(
        system_prompt_rag, user_prompt_rag, temperature=0.2
    )
    
    # --- Extract Follow-up Questions & Clean Answer ---
    final_answer_string = ai_response_text
    follow_up_questions = []

    if "||Q1:" in ai_response_text:
        parts = ai_response_text.split("||Q1:")
        final_answer_string = parts[0].strip() # The clean Markdown answer
        
        # Extract the questions from the hidden part
        remainder = parts[1]
        if "||Q2:" in remainder:
            try:
                q1_part, q2_part = remainder.split("||Q2:")
                q1_clean = q1_part.strip()
                q2_clean = q2_part.replace("||", "").strip()
                if q1_clean: follow_up_questions.append(q1_clean)
                if q2_clean: follow_up_questions.append(q2_clean)
            except Exception as e:
                print(f"--- [API Ask] Error parsing follow-ups: {e}")

    # --- Step 4: Check Confidence & Web Search ---
    # If the AI explicitly says "CONFIDENCE_LOW", we switch to Web Search
    if "CONFIDENCE_LOW" in final_answer_string or "Not stated in document" in final_answer_string:
        print(f"--- [API Ask] Low confidence detected. Switching to Web Search. ---")
        
        web_context = google_search(query_to_process)
        
        # Use Web Search Prompt
        system_prompt_web = WEB_ANSWER_SYSTEM_PROMPT.format(web_context=web_context)
        user_prompt_web = query_to_process
        
        web_answer = call_model_system_then_user(
            system_prompt_web, user_prompt_web
        )
        final_answer_string = web_answer
        sources = [] # Clear document sources
        follow_up_questions = [] # Clear follow-ups as context changed

    # --- Step 5: Translation ---
    final_answer_translated = final_answer_string
    final_followups = follow_up_questions

    if req.output_language and req.output_language != 'en':
        # Translate Answer
        if final_answer_string:
            translated = translate_text(final_answer_string, target_language=req.output_language)
            if translated:
                final_answer_translated = translated
        
        # Translate Follow-up Questions
        if follow_up_questions:
            translated_qs = []
            for q in follow_up_questions:
                tq = translate_text(q, target_language=req.output_language)
                translated_qs.append(tq if tq else q)
            final_followups = translated_qs

    return {
        "success": True, 
        "answer": final_answer_translated, 
        "sources": sources,
        "follow_up_questions": final_followups # New field in JSON response
    }



@app.post("/api/suggest-case-law")
def api_suggest_case_law(req: CaseLawReq):
    print("\n--- SERVER CHECK: The /api/suggest-case-law endpoint was called. ---")
    try:
        # --- THIS IS THE CHANGE ---
        # OLD: result = suggest_case_law(req.user_id, req.thread_id, req.query_text)
        result = suggest_case_law(req.user_id, req.thread_id)
        # --- END OF CHANGE ---

        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result)

        # Translation (if requested)
        if req.output_language and req.output_language.lower() != "en":
            for case in result.get("suggested_cases", []):
                # --- NEW: Translate the "relevance" field ---
                if "relevance" in case:
                    case["relevance"] = translate_text(case["relevance"], req.output_language)
                # --- END OF NEW ---
                if "snippet" in case:
                    case["snippet"] = translate_text(case["snippet"], req.output_language)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error suggesting case law: {e}")

@app.post("/api/transcribe-audio")
async def transcribe_audio(file: UploadFile, user_id: str = Form(""), thread_id: str = Form("")):
    try:
        audio_bytes = await file.read()
        try:
            AudioSegment.from_file(io.BytesIO(audio_bytes))
        except Exception as e:
            return JSONResponse(content={"success": False, "transcript": f"(speech error: Pydub/FFMPEG failed to decode audio. Error: {e})"}, status_code=422)
        transcript = speech_to_text_from_bytes(content=audio_bytes, language_code="en-US", enable_automatic_punctuation=True)
        if not transcript or transcript.startswith("(speech error"):
            return JSONResponse(content={"success": False, "transcript": transcript or ""}, status_code=422)
        return {"success": True, "transcript": transcript}
    except Exception as e:
        return JSONResponse(content={"success": False, "error": str(e)}, status_code=500)



@app.post("/api/faq")
def faq(req: FAQReq):
    try:
        # 1. Generate the FAQ (now returns a list of dicts)
        result = generate_faq(
            req.user_id,
            req.thread_id,
            max_snippets=req.max_snippets,
            num_questions=req.num_questions
        )

        # Check if FAQ generation was successful
        if not result.get("success"):
             # Propagate the error message from the backend
             raise HTTPException(status_code=422, detail={"message": result.get("message", "Failed to generate FAQ.")})

        faq_list = result.get("faq", [])
        if not faq_list:
            # Handle empty FAQ list case
             raise HTTPException(status_code=422, detail={"message": "No FAQ items were generated."})

        # 2. Translate Question and Answer values if needed
        if req.output_language and req.output_language != 'en':
            print(f"--- [API FAQ] Translating {len(faq_list)} FAQ items to {req.output_language}... ---")
            for item in faq_list:
                # Translate question
                q_en = item.get("question", "")
                if q_en:
                    q_translated = translate_text(q_en, target_language=req.output_language)
                    if q_translated: item["question"] = q_translated
                # Translate answer
                a_en = item.get("answer", "")
                if a_en and a_en != "Not stated in document." and not a_en.startswith("Error"): # Avoid translating errors
                    a_translated = translate_text(a_en, target_language=req.output_language)
                    if a_translated: item["answer"] = a_translated

        # 3. Format the final list into Markdown for the response
        # (Alternatively, you could return the list directly if your frontend prefers that)
        faq_md_parts = []
        for item in faq_list:
             faq_md_parts.append(f"### Q: {item.get('question', '')}")
             faq_md_parts.append(f"A: {item.get('answer', '')}")
        faq_markdown = "\n\n".join(faq_md_parts)

        # Return the formatted markdown string
        return {"success": True, "faq_markdown": faq_markdown}

    except HTTPException as httpe:
         raise httpe # Re-raise known HTTP exceptions
    except Exception as e:
         # Catch unexpected errors
         print(f"--- [API FAQ] Unexpected Error: {e} ---")
         raise HTTPException(status_code=500, detail=f"Error processing FAQ request: {e}")





@app.get("/api/ns/stats")
def api_ns_stats(user_id: Optional[str] = None, thread_id: str = Query(...)):
    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)
    count = namespace_count(index, ns)
    return {"namespace": ns, "vector_count": count}

@app.get("/api/ns/peek")
def api_ns_peek(user_id: Optional[str] = None, thread_id: str = Query(...), k: int = 3):
    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)
    zero = [0.0] * dim
    matches = query_top_k(index, ns, zero, top_k=max(1, min(k, 10)))
    out = []
    for m in matches:
        md = m.get("metadata", {}) if isinstance(m, dict) else {}
        preview = ""
        for key in ("text", "chunk_text", "content", "page_content", "snippet", "preview", "chunk", "body"):
            if isinstance(md.get(key), str) and md[key].strip():
                preview = md[key][:120]
                break
        out.append({"id": m.get("id"), "score": float(m.get("score", 0.0)) if isinstance(m, dict) else 0.0, "keys": list(md.keys())[:20], "preview": preview})
    return {"namespace": ns, "samples": out}

# --- START: ADDED FOR FORM FILLING (API Endpoints) ---
import pdfplumber
# In api_server.py

# In api_server.py

@app.post("/api/forms/analyze", response_model=FormAnalyzeResponse)
async def analyze_form(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    thread_id: Optional[str] = Form(None),
    output_language: Optional[str] = Form("en")
):
    """
    Uploads a form, gets RAG context, detects fields, and returns 
    Translated Descriptions + English Suggestions.
    """
    print(f"--- [/api/forms/analyze] Received upload: {file.filename} | Lang: {output_language} ---")
    
    temp_form_id = f"form_{user_id or 'anon'}_{thread_id or 'temp'}_{os.urandom(4).hex()}"
    temp_file_path = UPLOAD_DIR / f"{temp_form_id}_{file.filename}"
    
    try:
        with temp_file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 1. OCR Extraction
        try:
            with pdfplumber.open(temp_file_path) as pdf:
                all_pages = []
                if not pdf.pages: raise HTTPException(status_code=422, detail="PDF file has no pages.")
                for i, page in enumerate(pdf.pages):
                    page_words = []
                    words = page.extract_words(x_tolerance=2, y_tolerance=2, keep_blank_chars=False)
                    for word in words:
                        bbox = [int(word['x0']), int(word['top']), int(word['x1']), int(word['bottom'])]
                        page_words.append(OcrWord(text=word['text'], bbox=bbox))
                    all_pages.append(OcrPage(page_number=i + 1, width=int(page.width), height=int(page.height), words=page_words))
            
            detailed_ocr_result = DetailedOcrResult(pages=all_pages)
        except Exception as e:
            print(f"--- [Form Analyze] OCR Failed: {e} ---")
            raise HTTPException(status_code=422, detail=f"Layout parse failed: {e}")

        # 2. GET CONTEXT (RAG)
        context_summary = ""
        if thread_id:
            try:
                form_snippet = " ".join(w.text for w in detailed_ocr_result.pages[0].words[:50]) 
                hits = retrieve_similar_chunks(form_snippet, user_id=user_id, thread_id=thread_id, top_k=4)
                if hits:
                    context_summary = "\n".join([h.get("text", "") for h in hits])
            except Exception as e:
                print(f"--- [Form Analyze] RAG Context Error: {e} ---")

        # 3. DETECT FIELDS
        detected_fields_raw = detect_form_fields(detailed_ocr_result, context_summary=context_summary)
        
        if not detected_fields_raw:
             raise HTTPException(status_code=422, detail="Could not detect any fields.")

        # 4. Generate Suggestions & Finalize
        final_fields = []
        for field_data in detected_fields_raw:
             suggestions = []
             if not field_data.get('is_sensitive', False):
                 suggestions = generate_field_suggestions(field_data, context_summary)
             
             field_obj = DetectedField(
                 id=field_data['id'],
                 label_text=field_data.get('label_text'),
                 bbox=field_data['bbox'], 
                 page_number=field_data.get('page_number', 1),
                 semantic_type=field_data['semantic_type'],
                 confidence=field_data['confidence'],
                 is_sensitive=field_data['is_sensitive'],
                 description=field_data.get('description', 'Enter required info.'),
                 suggestions=suggestions,
                 value=""
             )
             final_fields.append(field_obj)

        # 5. TRANSLATION LOGIC (UPDATED)
        if output_language and output_language != 'en':
            print(f"--- [Form Analyze] Translating descriptions ONLY to '{output_language}'... ---")
            for field in final_fields:
                # A. Translate Description (The "Why" - Keep this in local language)
                if field.description:
                    trans_desc = translate_text(field.description, output_language)
                    if trans_desc: field.description = trans_desc
                
                # B. Translate Suggestions -> REMOVED
                # We explicitly DO NOT translate field.suggestions anymore.
                # They will remain in English (as generated by the LLM).

        return FormAnalyzeResponse(success=True, form_id=temp_form_id, fields=final_fields)

    except HTTPException as httpe: raise httpe
    except Exception as e:
         print(f"--- [Form Analyze] Fatal Error: {e} ---")
         raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

# In api_server.py

# In api_server.py

@app.post("/api/speak")
def api_speak(req: SpeakReq):
    """
    Generates audio and streams it directly to the frontend for immediate playback.
    """
    if not req.text:
        raise HTTPException(status_code=400, detail="No text provided.")

    # 1. Generate Audio
    audio_bytes = generate_speech_audio(req.text, req.language)
    
    if not audio_bytes:
        raise HTTPException(status_code=500, detail="TTS Generation failed.")

    print(f"--- [API Speak] Generated {len(audio_bytes)} bytes. Sending to frontend... ---")

    # 2. Return Raw Bytes (No 'attachment' header)
    # This allows Javascript to capture it as a Blob and play it instantly.
    return Response(content=audio_bytes, media_type="audio/mpeg")




# In api_server.py
# (Replace your old api_general_ask function with this one)

# In api_server.py
# (Replace your old api_general_ask function with this one)

# In api_server.py
from backend_rag.prompts import build_general_system_prompt
# In api_server.py

@app.post("/api/general-ask")
def api_general_ask(req: GeneralAskReq):
    """
    General Legal Q&A with Chat History.
    """
    print(f"--- [General Ask] User: {req.user_id} | Thread: {req.thread_id} ---")

    try:
        # 1. Translate Query if needed
        query_to_process = req.query
        if req.query.strip():
            query_lang = detect_language(req.query)
            if query_lang and query_lang.get('language') != 'en':
                translated = translate_text(req.query, target_language='en')
                if translated: query_to_process = translated

        # 2. Process History
        history_text = ""
        recent_history = req.history[-10:] 
        for msg in recent_history:
            role_label = "User" if msg.role == "user" else "AI"
            history_text += f"{role_label}: {msg.content}\n"

        # 3. Build Prompt
        # This function now returns the complete System Prompt string
        final_system_prompt = build_general_system_prompt(chat_history_str=history_text)
        
        # 4. Call LLM
        # We pass 'final_system_prompt' as the System Instructions
        # We pass 'query_to_process' as the User Message
        response_text = call_model_system_then_user(
            system_prompt=final_system_prompt,
            user_prompt=query_to_process, 
            temperature=0.3
        )

        # 5. Translate Response if needed
        final_answer = response_text
        if req.output_language and req.output_language != 'en':
            translated_resp = translate_text(response_text, target_language=req.output_language)
            if translated_resp: final_answer = translated_resp

        return {
            "success": True,
            "answer": final_answer
        }

    except Exception as e:
        print(f"--- [General Ask] Error: {e} ---")
        # Use 500 so we see the error in logs, but return detail
        raise HTTPException(status_code=500, detail=f"Error processing request: {e}")



@app.post("/api/explain-clauses")
def api_explain_clauses(req: ClauseReq):
    """
    Proactively finds and explains complex clauses in the document.
    """
    print("\n--- SERVER CHECK: The /api/explain-clauses endpoint was called. ---")
    try:
        result = generate_clause_explanations(req.user_id, req.thread_id)
        
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result)

        # Translate the explanations if needed
        if req.output_language and req.output_language != 'en':
            for item in result.get("explanations", []):
                if "explanation" in item:
                    translated = translate_text(item["explanation"], req.output_language)
                    if translated:
                        item["explanation"] = translated
        
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error explaining clauses: {e}")
    
# In api_server.py

@app.post("/api/flowchart")
def api_flowchart(req: FlowchartReq):
    """
    Returns only the Mermaid Mindmap code.
    Output: { "success": true, "mindmap_code": "..." }
    """
    print("\n--- SERVER CHECK: The /api/flowchart endpoint was called. ---")
    try:
        result = generate_mindmap(req.user_id, req.thread_id)
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating mindmap: {e}")


@app.post("/api/event-timeline")
def api_event_timeline(req: FlowchartReq): # We can reuse FlowchartReq as it has user_id/thread_id
    """
    Returns the structured event list for custom UI rendering.
    Output: { "success": true, "timeline": [{ "actor": "Court", "event": "..." }] }
    """
    print("\n--- SERVER CHECK: The /api/event-timeline endpoint was called. ---")
    try:
        result = generate_structured_timeline(req.user_id, req.thread_id)
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating timeline: {e}")
    
@app.post("/api/short-summary")
def api_short_summary(req: ShortSummaryReq):
    """
    Returns a 2-3 line summary of the uploaded document.
    """
    print("\n--- SERVER CHECK: The /api/short-summary endpoint was called. ---")
    try:
        result = generate_short_summary(req.user_id, req.thread_id)
        
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result)
            
        summary_text = result.get("summary", "")
        
        # Translate if needed
        if req.output_language and req.output_language != 'en' and summary_text:
            translated = translate_text(summary_text, target_language=req.output_language)
            if translated:
                result["summary"] = translated
                
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating summary: {e}")

@app.post("/api/upload-risk-doc")
async def upload_risk_doc(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    thread_id: str = Form(...),
    output_language: Optional[str] = Form('en')
):
    print(f"\n--- [/api/upload-risk-doc] Processing file: {file.filename} | Thread: {thread_id} ---")
    
    # Debug logs (Keep these for now)
    print(f"DEBUG: Filename received: '{file.filename}'")
    print(f"DEBUG: Content-Type received: '{file.content_type}'")

    save_name = f"{thread_id}_{file.filename}"
    local_path = UPLOAD_DIR / save_name
    
    # 1. Save File
    try:
        with local_path.open("wb") as f:
            f.write(await file.read())
            
        ocr_result = None
        extracted_text = ""
        
        # --- FIX IS HERE ---
        # Check BOTH extension AND content_type
        is_pdf = (
            file.filename.lower().endswith(".pdf") 
            or file.content_type == "application/pdf"
        )
        
        if is_pdf:
            try:
                import pdfplumber
                from backend_rag.form_processing import DetailedOcrResult, OcrPage, OcrWord
                
                print("--- [Risk API] Parsing PDF layout (Form-Filling Style)... ---")
                with pdfplumber.open(local_path) as pdf:
                    # ... (Existing pdfplumber logic) ...
                    all_pages = []
                    full_text_parts = []
                    
                    for i, page in enumerate(pdf.pages):
                        page_words = []
                        words = page.extract_words(x_tolerance=2, y_tolerance=2, keep_blank_chars=False)
                        for word in words:
                            bbox = [int(word['x0']), int(word['top']), int(word['x1']), int(word['bottom'])]
                            page_words.append(OcrWord(text=word['text'], bbox=bbox))
                        
                        all_pages.append(OcrPage(page_number=i + 1, width=int(page.width), height=int(page.height), words=page_words))
                        full_text_parts.append(page.extract_text() or "")

                    ocr_result = DetailedOcrResult(pages=all_pages)
                    extracted_text = "\n".join(full_text_parts)
                    
            except Exception as e:
                print(f"--- [Risk API] PDF Parsing Warning: {e}. Falling back... ---")
                process_result = _extract_and_translate_only(str(local_path))
                extracted_text = process_result.get("extracted_text", "")

        else:
            # Non-PDF
            print("--- [Risk API] Non-PDF detected. Using standard extraction. ---")
            process_result = _extract_and_translate_only(str(local_path))
            extracted_text = process_result.get("extracted_text", "")

        # ... (Rest of the function remains the same) ...

        if not extracted_text.strip():
             raise HTTPException(status_code=422, detail="Could not extract text from document.")

        # 3. Run Semantic Risk Analysis
        # We pass the text directly.
        analysis_result = generate_risk_analysis(user_id, thread_id, direct_context=extracted_text)
        
        if not analysis_result.get("success"):
            raise HTTPException(status_code=422, detail=analysis_result)
        
        risks = analysis_result.get("risks", [])
        
        # 4. In-Memory Highlighting (No re-opening file)
        if ocr_result:
            print(f"--- [Risk API] Mapping {len(risks)} risks to coordinates using in-memory data... ---")
            for risk in risks:
                quote = risk.get("original_text", "")
                if quote:
                    # Use our new helper function
                    coords = _find_coordinates_in_ocr_result(ocr_result, quote)
                    risk["coordinates"] = coords
                else:
                    risk["coordinates"] = []
        else:
            # If not a PDF or parsing failed, return empty coords
            for risk in risks: risk["coordinates"] = []

        # 5. Translate Response (Output)
        if output_language and output_language != 'en':
            print(f"--- [Risk API] Translating output to {output_language} ---")
            for risk in risks:
                # Helper to translate specific keys
                for key in ["explanation", "recommendation", "compliance_check"]:
                    if key in risk:
                        trans = translate_text(risk[key], output_language)
                        if trans: risk[key] = trans

        # 6. Return Final JSON
        return {"success": True, "risks": risks}

    except HTTPException as httpe:
        raise httpe
    except Exception as e:
        print(f"--- [Risk API] Fatal Error: {e} ---")
        raise HTTPException(status_code=500, detail=f"Error analyzing risks: {e}")

