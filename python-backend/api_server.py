# full updated file with corrected endpoints for JSON responses
from __future__ import annotations
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
    generate_structured_timeline
)
from backend_rag.prompts import (
    build_strict_system_prompt , 
    WEB_ANSWER_SYSTEM_PROMPT,
    GENERAL_LEGAL_QA_PROMPT  
)

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

class FAQDownloadReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str

class TimelineDownloadReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str

class StudyGuideDownloadReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str

class GeneralAskReq(BaseModel):
    query: str
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

def _ingest_no_sqlite_save(local_path: str, file_name: str, user_id: Optional[str], thread_id: str):
    extraction = extract_text_with_diagnostics(local_path)
    text = (extraction.get("text") or "").strip()
    source = extraction.get("source")
    diagnostics = extraction.get("diagnostics", {})

    if not text:
        return {"success": False, "message": "No text extracted from file.", "diagnostics": diagnostics, "source": source}

    # --- NEW: Language Detection & Translation Step ---
    detection = detect_language(text)
    original_lang = 'en' # Default to English
    if detection and detection.get('language') and detection.get('confidence', 0) > 0.5:
        original_lang = detection['language']

    text_to_process = text
    if original_lang != 'en':
        translated = translate_text(text, target_language='en')
        if translated:
            text_to_process = translated
            diagnostics['translation'] = f"Detected '{original_lang}', translated to 'en'"
        else:
            # If translation fails, proceed with original text but log it
            diagnostics['translation_error'] = f"Detected '{original_lang}', but translation failed."

    # --- End of New Step ---

    chunks = chunk_text(text_to_process, chunk_size=1000, overlap=200) # Use the processed text
    texts = [c[1] for c in chunks]
    if not texts:
        return {"success": False, "message": "No chunks created from file.", "diagnostics": diagnostics, "source": source}
    
    vecs = embed_texts(texts)
    vecs_list = [v.astype("float32").tolist() for v in vecs]
    ids = [c[0] for c in chunks]
    
    # --- MODIFIED: Add original_lang to metadata ---
    metadatas = [
        {
            "file_name": file_name,
            "chunk_id": ids[i],
            "text": texts[i][:4000],
            "original_language": original_lang  # Store the detected language
        } for i in range(len(texts))
    ]
    # --- End of Modification ---

    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)
    upsert_chunks(index, ns, vecs_list, ids, metadatas)
    
    return {"success": True, "message": f"Ingested {len(chunks)} chunks (source={source}, lang={original_lang}) into chat {thread_id} for user {user_id}", "diagnostics": diagnostics, "source": source}

# In api_server.py

# In api_server.py

def _ingest_audio_no_sqlite_save(local_path: str, file_name: str, user_id: Optional[str], thread_id: str):
    try:
        # Step 1: Transcribe the audio file
        speech_result = speech_to_text_from_local_file(local_path)
        transcript = speech_result.get("transcript", "")
        detected_lang_code = speech_result.get("detected_language", "en-US")

        if not transcript or transcript.startswith("(speech error"):
            return {"success": False, "message": f"Could not produce transcript. Reason: {transcript}"}

        text = transcript.strip()
        original_lang = detected_lang_code.split('-')[0]  # e.g., 'gu-IN' → 'gu'
        source = f"audio:{file_name}"
        diagnostics = {
            "transcript_length": len(text.split()),
            "detected_audio_language": detected_lang_code
        }

        # ✅ Do NOT translate — store original language
        text_to_process = text  

        # Step 2: Chunk + Embed + Store as usual
        chunks = chunk_text(text_to_process, chunk_size=1000, overlap=200)
        texts = [c[1] for c in chunks]
        if not texts:
            return {"success": False, "message": "No chunks created from transcript.", "transcript": transcript}

        vecs = embed_texts(texts)
        vecs_list = [v.astype("float32").tolist() for v in vecs]
        ids = [c[0] for c in chunks]

        metadatas = [
            {
                "file_name": file_name,
                "chunk_id": ids[i],
                "text": texts[i][:4000],
                "source": source,
                "original_language": original_lang
            }
            for i in range(len(texts))
        ]

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

@app.post("/api/ingest-audio")
async def ingest_audio(
    user_id: Optional[str] = Form(default=None),
    thread_id: str = Form(...),
    file: UploadFile = File(...),
    replace: bool = Form(False)
):
    if replace:
        _reset_vector_store(user_id, thread_id)
    
    save_name = f"{thread_id}_{file.filename}"
    local_path = UPLOAD_DIR / save_name
    with local_path.open("wb") as f:
        f.write(await file.read())
    
    result = _ingest_audio_no_sqlite_save(str(local_path), file.filename, user_id, thread_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result)
    
    return result

# In api_server.py

# In api_server.py
import json
import html



# In api_server.py
# (Replace your old api_ask function with this one)

@app.post("/api/ask")
def api_ask(req: AskReq):
    # --- Step 1: Translate query to English if needed ---
    query_to_process = req.query
    if req.query.strip():
        query_lang_detection = detect_language(req.query)
        if query_lang_detection and query_lang_detection.get('language') != 'en':
            translated_query = translate_text(req.query, target_language='en')
            if translated_query:
                query_to_process = translated_query

    # --- Step 2: Retrieve similar chunks ---
    hits = retrieve_similar_chunks(query_to_process, user_id=req.user_id, thread_id=req.thread_id, top_k=req.top_k)
    sources = []
    
    if not hits:
        print("--- [API Ask] No RAG results. Proceeding to web search. ---")
        context_combined = "No relevant document excerpts found."
        rag_answer_json = None
    else:
        # --- Step 3: Prepare context and get RAG answer ---
        context_blobs = []
        for r in hits:
            text = (r.get("text") or "").replace("\n", " ")
            fn = r.get("file_name") or "document"
            context_blobs.append(f"--- From file: {fn} ---\n{text}\n")
            sources.append({"file_name": fn, "preview": text[:300]})

        context_combined = "\n\n".join(context_blobs)

    # --- NEW: Process History from Request ---
    history_text = ""
    # Take the last 6 messages to keep context focused and avoid token limits
    recent_history = req.history[-6:] 
    for msg in recent_history:
        # Map 'user'/'assistant' to clear labels for the AI
        role_label = "User" if msg.role == "user" else "AI"
        history_text += f"{role_label}: {msg.content}\n"

    # --- UPDATED: Pass history_text to the prompt builder ---
    system_prompt_rag = build_strict_system_prompt(context_combined, chat_history_str=history_text)
    user_prompt_rag = query_to_process.strip()

    # Get the JSON response from the RAG model
    rag_answer_json_string = call_model_system_then_user(
        system_prompt_rag, user_prompt_rag, temperature=0.0
    )
    
    # --- Step 4: Check Confidence and Decide to Web Search ---
    final_answer_string = ""
    try:
        json_match = re.search(r'\{.*\}', rag_answer_json_string, re.DOTALL)
        if not json_match:
            final_answer_string = rag_answer_json_string
        else:
            rag_json = json.loads(json_match.group(0))
            confidence = rag_json.get("response", {}).get("ASSESSMENT", {}).get("CONFIDENCE", "High").lower()
            plain_answer = rag_json.get("response", {}).get("PLAIN ANSWER", "")

            # Check for low confidence or "Not stated"
            if confidence == "low" or "not stated in document" in plain_answer.lower():
                print(f"--- [API Ask] RAG answer was '{plain_answer}' (Confidence: {confidence}). Proceeding to web search. ---")
                
                # --- Step 5: Perform Web Search ---
                web_context = google_search(query_to_process)
                
                # Note: We don't typically pass history to the web search prompt yet, 
                # but you could modify WEB_ANSWER_SYSTEM_PROMPT similarly if needed.
                system_prompt_web = WEB_ANSWER_SYSTEM_PROMPT.format(web_context=web_context)
                user_prompt_web = query_to_process
                
                # Call the web_model for summarization
                web_answer = call_model_system_then_user(
                    system_prompt_web, user_prompt_web
                )
                final_answer_string = web_answer
                sources = [] # Clear document sources, as this is a web answer
            else:
                # Confidence is high, use the RAG answer
                final_answer_string = plain_answer
                
    except Exception as e:
        print(f"--- [API Ask] Error parsing JSON or routing: {e} ---")
        final_answer_string = rag_answer_json_string # Fallback

    # --- Step 6: Translate the final string answer if needed ---
    final_answer_translated = final_answer_string
    if req.output_language and req.output_language != 'en' and final_answer_string:
        translated = translate_text(final_answer_string, target_language=req.output_language)
        if translated:
            final_answer_translated = translated

    return {"success": True, "answer": final_answer_translated, "sources": sources}



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

@app.post("/api/download/faq")
# In api_server.py, replace the old @app.post("/api/faq") function with this one

# In api_server.py

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

@app.post("/api/download/timeline")
def download_timeline(req: TimelineDownloadReq):
    out = generate_timeline(req.user_id, req.thread_id)
    if not out.get("success"):
        raise HTTPException(status_code=422, detail=out)
    timeline_list = out.get("timeline", [])
    if not timeline_list:
        message = out.get("message", "Empty timeline content.")
        raise HTTPException(status_code=422, detail={"message": message})
    timeline_text_parts = ["| Date | Event |", "|---|---|"]
    for item in timeline_list:
        timeline_text_parts.append(f"| {item.get('date', '')} | {item.get('event', '')} |")
    timeline_text = "\n".join(timeline_text_parts)
    base = f"thread_{req.thread_id}"
    return _stream_text_file(timeline_text, f"{base}_timeline.md", media_type="text/markdown; charset=utf-8")

@app.post("/api/download/study-guide")
def download_study_guide(req: StudyGuideDownloadReq):
    out = generate_study_guide(req.user_id, req.thread_id)
    if not out.get("success"):
        raise HTTPException(status_code=422, detail=out)
    guide_text = out.get("study_guide") or ""
    if not guide_text.strip():
        raise HTTPException(status_code=422, detail={"message": "Empty study guide content."})
    base = f"thread_{req.thread_id}"
    return _stream_text_file(guide_text, f"{base}_study_guide.txt", media_type="text/plain; charset=utf-8")

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

@app.post("/api/forms/export")
async def export_filled_form(req: FormExportRequest = Body(...)):
    """
    Receives final field values and generates a filled PDF or DOCX file.
    """
    print(f"--- [/api/forms/export] Request received for form ID: {req.form_id}, format: {req.export_format} ---")
    
    # Find the original uploaded file path based on form_id and filename
    # This requires req.original_filename to be sent from frontend
    if not req.original_filename:
        raise HTTPException(status_code=400, detail="Missing original_filename in request for export.")
        
    original_file_path = UPLOAD_DIR / f"{req.form_id}_{req.original_filename}"
    if not original_file_path.exists():
         print(f"--- [/api/forms/export] Original file not found at expected path: {original_file_path} ---")
         raise HTTPException(status_code=404, detail="Original form file not found for export. It might have been cleaned up.")

    # Prepare data for filling functions {field_id: value}
    field_data_dict = {fv.id: fv.value for fv in req.field_values}

    # Define output path
    output_filename = f"filled_{req.form_id}.{req.export_format}"
    output_path = UPLOAD_DIR / output_filename

    try:
        if req.export_format == "pdf":
            # NOTE: fill_pdf_form is a placeholder unless you implement AcroForm filling
            fill_pdf_form(str(original_file_path), str(output_path), field_data_dict)
            media_type = "application/pdf"
        elif req.export_format == "docx":
            fill_docx_form(str(original_file_path), str(output_path), field_data_dict)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            raise HTTPException(status_code=400, detail="Unsupported export format.")

        # Check if file was created
        if not output_path.exists():
             raise HTTPException(status_code=500, detail="Export failed: Output file not generated.")

        # Stream the file back
        def iterfile():
            try:
                with open(output_path, mode="rb") as file_like:
                    yield from file_like
            finally:
                 # Clean up the generated filled file after streaming
                 if output_path.exists():
                     output_path.unlink()
                     print(f"--- [/api/forms/export] Cleaned up exported file: {output_path} ---")
                 # Optionally clean up the original uploaded file now too
                 # if original_file_path.exists():
                 #    original_file_path.unlink()

        headers = {'Content-Disposition': f'attachment; filename="{output_filename}"'}
        return StreamingResponse(iterfile(), media_type=media_type, headers=headers)

    except HTTPException as httpe:
        raise httpe
    except Exception as e:
        print(f"--- [/api/forms/export] Error: {e} ---")
        # Clean up potentially corrupted output file on error
        if output_path.exists(): output_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to export form: {e}")

# --- END: ADDED FOR FORM FILLING (API Endpoints) ---


# In api_server.py
# (Replace your old api_general_ask function with this one)

# In api_server.py
# (Replace your old api_general_ask function with this one)

@app.post("/api/general-ask")
def api_general_ask(req: GeneralAskReq):
    """
    Answers a general legal question using the main (non-thread)
    legal knowledge base.
    """
    try:
        # --- Step 1: Translate query to English if needed ---
        query_to_process = req.query
        if req.query.strip():
            query_lang_detection = detect_language(req.query)
            if query_lang_detection and query_lang_detection.get('language') != 'en':
                translated_query = translate_text(req.query, target_language='en')
                if translated_query:
                    query_to_process = translated_query
                    print(f"--- [API GeneralAsk] Translated query to: {query_to_process}")
        
        # --- Step 2: NEW GREETING CHECK (Before RAG) ---
        # We check for the greeting *before* running the search
        greeting_triggers = ["hi", "hii", "hello", "how are you", "good morning", "good afternoon", "good evening"]
        normalized_query = query_to_process.lower().strip(" ?.")
        
        if normalized_query in greeting_triggers:
            print("--- [API GeneralAsk] Greeting detected. Bypassing RAG. ---")
            
            # This is the hardcoded greeting from your prompt's Rule 1
            final_answer = "Hello, this is Legal SahAI. How may I help you?"
            
            # Translate the greeting *response* if needed
            if req.output_language and req.output_language != 'en':
                translated = translate_text(final_answer, target_language=req.output_language)
                if translated:
                    final_answer = translated
            return {"success": True, "answer": final_answer}
        # --- END OF NEW GREETING CHECK ---

        # --- Step 3: (Was Step 2) Retrieve from GENERAL knowledge base ---
        # This part now only runs if the query is NOT a greeting
        print(f"--- [API GeneralAsk] Non-greeting query received. Retrieving chunks... ---")
        hits = retrieve_general_legal_chunks(query_to_process, top_k=5)
        
        context_combined = ""
        if not hits:
            print("--- [API GeneralAsk] No relevant chunks found in general DB.")
            context_combined = "(No relevant information found)"
        else:
            # Improved context building with both questions and answers
            context_blobs = []
            for i, r in enumerate(hits, 1):
                question = r.get("retrieved_question", "").strip()
                answer = r.get("text", "").strip()
                context_blobs.append(
                    f"--- Similar Question {i} ---\n"
                    f"Q: {question}\n"
                    f"A: {answer}\n"
                )
            context_combined = "\n\n".join(context_blobs)

        # Use LLM with context
        system_prompt = GENERAL_LEGAL_QA_PROMPT.format(context=context_combined)
        final_answer = call_model_system_then_user(
            system_prompt, query_to_process, temperature=0.1
        )

        # Translation if needed...
        final_answer_translated = final_answer
        if req.output_language and req.output_language != 'en' and final_answer:
            translated = translate_text(final_answer, target_language=req.output_language)
            if translated:
                final_answer_translated = translated
        return {"success": True, "answer": final_answer_translated}

    except Exception as e:
        print(f"--- [API GeneralAsk] Error: {e} ---")
        raise HTTPException(status_code=500, detail=str(e))



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