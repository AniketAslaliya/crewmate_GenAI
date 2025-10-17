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

# Ensure all backend modules are correctly imported
# In api_server.py, near other backend imports
from backend_rag.Translation import detect_language, translate_text
from backend_rag.vectorstore_pinecone import get_or_create_index, upsert_chunks, delete_namespace, namespace, query_top_k, namespace_count
from backend_rag.embeddings import embed_texts, get_embedding_dimension
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydub import AudioSegment

from backend_rag.extract import extract_text_with_diagnostics
from backend_rag.chunking import chunk_text
from backend_rag.analysis import (
    generate_study_guide,
    quick_analyze_for_thread as quick_analyze_thread,
    generate_faq,
    generate_timeline,
    suggest_case_law,
    generate_predictive_output, 
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
try:
    from backend_rag.prompts import build_strict_system_prompt as _build_strict_prompt
except Exception:
    def _build_strict_prompt(context: str) -> str:
        return (
            "You are a meticulous document Q&A assistant. Use ONLY the provided excerpts to answer.\n"
            "If the answer is not present in the excerpts, reply exactly: 'Not stated in document.'\n"
            "Keep answers concise and plain-English. Do NOT invent facts.\n\n"
            f"Document excerpts:\n{context}\n"
        )

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



# ----------------------------- Utils ------------------------------------------
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

def _ingest_audio_no_sqlite_save(local_path: str, file_name: str, user_id: Optional[str], thread_id: str):
    try:
        transcript = speech_to_text_from_local_file(local_path)
        if not transcript or not transcript.strip() or transcript.startswith("(speech error"):
            return {"success": False, "message": f"Could not produce transcript from audio file. Reason: {transcript}"}
        
        text = transcript.strip()
        source = f"audio:{file_name}"
        diagnostics = {"transcript_length": len(text.split())}

        # --- NEW: Language Detection & Translation Step ---
        detection = detect_language(text)
        original_lang = 'en'  # Default to English
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
            return {"success": False, "message": "No chunks created from audio transcript.", "diagnostics": diagnostics, "source": source}
        
        vecs = embed_texts(texts)
        vecs_list = [v.astype("float32").tolist() for v in vecs]
        ids = [c[0] for c in chunks]

        # --- MODIFIED: Add original_lang and source to metadata ---
        metadatas = [
            {
                "file_name": file_name,
                "chunk_id": ids[i],
                "text": texts[i][:4000],
                "source": source,
                "original_language": original_lang  # Store the detected language
            } for i in range(len(texts))
        ]
        # --- End of Modification ---

        dim = get_embedding_dimension()
        index = get_or_create_index(dim)
        ns = namespace(user_id, thread_id)
        upsert_chunks(index, ns, vecs_list, ids, metadatas)
        
        return {"success": True, "message": f"Ingested {len(chunks)} audio chunks (source={source}, lang={original_lang}) into chat {thread_id} for user {user_id}", "diagnostics": diagnostics, "source": source}
    
    except Exception as e:
        return {"success": False, "message": f"_ingest_audio_no_sqlite_save error: {e}"}

# ----------------------------- Endpoints --------------------------------------
@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/study-guide")
def study_guide(req: StudyGuideReq):
    try:
        result = generate_study_guide(req.user_id, req.thread_id)

        # --- Translation Logic ---
        if result.get("success") and req.output_language and req.output_language != 'en':
            english_text = result.get("study_guide", "")
            if english_text:
                translated_text = translate_text(english_text, target_language=req.output_language)
                if translated_text:
                    result["study_guide"] = translated_text
        # --- End Translation Logic ---
        
        return result
    except Exception as e:
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
    try:
        result = generate_timeline(req.user_id, req.thread_id, max_snippets=req.max_snippets)

        # --- Translation Logic ---
        if result.get("success") and req.output_language and req.output_language != 'en':
            timeline_events = result.get("timeline", [])
            if timeline_events:
                # Translate the 'event' field for each item in the timeline
                for item in timeline_events:
                    english_event = item.get("event", "")
                    if english_event:
                        translated_event = translate_text(english_event, target_language=req.output_language)
                        if translated_event:
                            item["event"] = translated_event
        # --- End Translation Logic ---

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating timeline: {e}")

@app.post("/api/predictive-output")
def api_predictive_output(req: PredictiveOutputReq):
    try:
        result = generate_predictive_output(req.user_id, req.thread_id)
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result)

        # --- Translation Logic ---
        if result.get("success") and req.output_language and req.output_language != 'en':
            prediction = result.get("prediction", {})
            if prediction:
                # Translate disclaimer
                disclaimer = prediction.get("disclaimer", "")
                if disclaimer:
                    translated_disclaimer = translate_text(disclaimer, target_language=req.output_language)
                    if translated_disclaimer:
                        prediction["disclaimer"] = translated_disclaimer
                
                # Translate scenarios
                scenarios = prediction.get("scenarios", [])
                for scenario in scenarios:
                    # Translate outcome
                    outcome = scenario.get("outcome", "")
                    if outcome:
                        translated_outcome = translate_text(outcome, target_language=req.output_language)
                        if translated_outcome:
                            scenario["outcome"] = translated_outcome
                    # Translate reasoning
                    reasoning = scenario.get("reasoning", "")
                    if reasoning:
                        translated_reasoning = translate_text(reasoning, target_language=req.output_language)
                        if translated_reasoning:
                            scenario["reasoning"] = translated_reasoning
        # --- End Translation Logic ---

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
async def ingest_audio(user_id: Optional[str] = Form(default=None), thread_id: str = Form(...), file: UploadFile = File(...), replace: bool = Form(False)):
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


    
@app.post("/api/ask")
def api_ask(req: AskReq):
    # --- NEW: Translate the incoming query to English first ---
    query_to_process = req.query
    query_lang_detection = detect_language(req.query)
    query_lang = 'en'
    if query_lang_detection and query_lang_detection.get('language') != 'en':
        query_lang = query_lang_detection.get('language')
        translated_query = translate_text(req.query, target_language='en')
        if translated_query:
            query_to_process = translated_query
    # --- End of New Step ---

    hits = retrieve_similar_chunks(query_to_process, user_id=req.user_id, thread_id=req.thread_id, top_k=req.top_k)
    
    if not hits:
        # Default "not found" response
        not_found_msg = "Not stated in document."
        if req.output_language and req.output_language != 'en':
            translated_not_found = translate_text(not_found_msg, target_language=req.output_language)
            not_found_msg = translated_not_found or not_found_msg
        return {"success": True, "answer": not_found_msg, "sources": []}

    context_blobs = []
    sources = []
    for r in hits:
        text = (r.get("text") or "")[:1200].replace("\n", " ")
        fn = r.get("file_name") or "document"
        context_blobs.append(f"--- From file: {fn} ---\n{text}\n")
        sources.append({"file_name": fn, "preview": text[:300]})

    context = "\n\n".join(context_blobs)



    system_prompt = _build_strict_prompt(context)
    user_prompt = query_to_process.strip()
    
    # The LLM always generates the answer in English
    english_answer = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)

    # --- NEW: Translate the final answer if requested ---
    final_answer = english_answer.strip()
    if req.output_language and req.output_language != 'en':
        translated_answer = translate_text(final_answer, target_language=req.output_language)
        if translated_answer:
            final_answer = translated_answer
    # --- End of New Step ---

    return {"success": True, "answer": final_answer, "sources": sources}

@app.post("/api/suggest-case-law")
def api_suggest_case_law(req: CaseLawReq):
    try:
        result = suggest_case_law(req.user_id, req.thread_id)
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result)

        # --- Translation Logic ---
        if result.get("success") and req.output_language and req.output_language != 'en':
            suggested_cases = result.get("suggested_cases", [])
            if suggested_cases:
                # Translate 'details' and 'outcome' for each case
                for case in suggested_cases:
                    # Translate details
                    details = case.get("details", "")
                    if details:
                        translated_details = translate_text(details, target_language=req.output_language)
                        if translated_details:
                            case["details"] = translated_details
                    # Translate outcome
                    outcome = case.get("outcome", "")
                    if outcome:
                        translated_outcome = translate_text(outcome, target_language=req.output_language)
                        if translated_outcome:
                            case["outcome"] = translated_outcome
        # --- End Translation Logic ---

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

@app.post("/api/faq")
def faq(req: FAQReq):
    # --- ADD THIS LINE AS THE VERY FIRST LINE OF THE FUNCTION ---
    print("\n--- SERVER CHECK: The /api/faq endpoint function was just called. ---")

    try:
        # 1. Generate the FAQ in English first
        result = generate_faq(
            req.user_id,
            req.thread_id,
            max_snippets=req.max_snippets,
            num_questions=req.num_questions
        )

        # --- 2. ADDED: Translate the result if needed ---
        if result.get("success") and req.output_language and req.output_language != 'en':
            english_markdown = result.get("faq_markdown", "")
            if english_markdown:
                translated_markdown = translate_text(english_markdown, target_language=req.output_language)
                if translated_markdown:
                    # Update the result with the translated text
                    result["faq_markdown"] = translated_markdown
                else:
                    # --- ADD THIS ELSE BLOCK for better feedback ---
                    result["translation_status"] = (
                        f"Failed to translate to '{req.output_language}'. "
                        "Check server logs for the specific error from Google API."
                    )
        # --- End of added logic ---

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating FAQ: {e}")

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