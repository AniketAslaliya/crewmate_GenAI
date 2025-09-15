# api_server.py
from __future__ import annotations
from fastapi.responses import StreamingResponse, JSONResponse
import io
import os
from pathlib import Path
import tempfile
from typing import Optional

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

# CORS — open for dev; lock down in prod
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload dir (temporary)
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/tmp/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ----------------------------- Models -----------------------------------------
class StudyGuideReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str

class QuickAnalyzeReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str

class FAQReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    max_snippets: int = 8
    num_questions: int = 10

class TimelineReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    max_snippets: int = 10

class AskReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    query: str
    top_k: int = 4

# ----------------------------- Utils ------------------------------------------
def _reset_vector_store(user_id: Optional[str], thread_id: str):
    """Delete the Pinecone namespace for this (user, thread)."""
    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)
    try:
        delete_namespace(index, ns)
    except Exception:
        pass

def _ingest_no_sqlite_save(local_path: str, file_name: str, user_id: Optional[str], thread_id: str):
    extraction = extract_text_with_diagnostics(local_path)
    text = (extraction.get("text") or "").strip()
    source = extraction.get("source")
    diagnostics = extraction.get("diagnostics", {})

    if not text:
        return {"success": False, "message": "No text extracted from file.", "diagnostics": diagnostics, "source": source}

    chunks = chunk_text(text, chunk_size=1000, overlap=200)
    texts = [c[1] for c in chunks]
    if not texts:
        return {"success": False, "message": "No chunks created from file.", "diagnostics": diagnostics, "source": source}

    vecs = embed_texts(texts)
    vecs_list = [v.astype("float32").tolist() for v in vecs]
    ids = [c[0] for c in chunks]
    metadatas = [{"file_name": file_name, "chunk_id": ids[i], "text": texts[i][:4000]} for i in range(len(texts))]

    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)
    upsert_chunks(index, ns, vecs_list, ids, metadatas)

    return {"success": True, "message": f"Ingested {len(chunks)} chunks (source={source}) into chat {thread_id} for user {user_id}", "diagnostics": diagnostics, "source": source}

def _ingest_audio_no_sqlite_save(local_path: str, file_name: str, user_id: Optional[str], thread_id: str):
    try:
        transcript = speech_to_text_from_local_file(local_path)
        if not transcript or not transcript.strip() or transcript.startswith("(speech error"):
            return {"success": False, "message": f"Could not produce transcript from audio file. Reason: {transcript}"}

        text = transcript.strip()
        source = f"audio:{file_name}"
        diagnostics = {"transcript_length": len(text.split())}

        chunks = chunk_text(text, chunk_size=1000, overlap=200)
        texts = [c[1] for c in chunks]
        if not texts:
            return {"success": False, "message": "No chunks created from audio transcript.", "diagnostics": diagnostics, "source": source}

        vecs = embed_texts(texts)
        vecs_list = [v.astype("float32").tolist() for v in vecs]
        ids = [c[0] for c in chunks]
        metadatas = [{"file_name": file_name, "chunk_id": ids[i], "text": texts[i][:4000], "source": source} for i in range(len(texts))]

        dim = get_embedding_dimension()
        index = get_or_create_index(dim)
        ns = namespace(user_id, thread_id)
        upsert_chunks(index, ns, vecs_list, ids, metadatas)

        return {"success": True, "message": f"Ingested {len(chunks)} audio chunks (source={source}) into chat {thread_id} for user {user_id}", "diagnostics": diagnostics, "source": source}
    except Exception as e:
        return {"success": False, "message": f"_ingest_audio_no_sqlite_save error: {e}"}

# ----------------------------- Endpoints --------------------------------------
@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/ingest")
async def ingest(
    user_id: Optional[str] = Form(default=None),
    thread_id: str = Form(...),
    file: UploadFile = File(...),
    replace: bool = Form(False),
):
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
    replace: bool = Form(False),
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

@app.post("/api/ask")
def api_ask(req: AskReq):
    hits = retrieve_similar_chunks(req.query, user_id=req.user_id, thread_id=req.thread_id, top_k=req.top_k)
    if not hits:
        return {"success": True, "answer": "Not stated in document.", "sources": []}

    context_blobs = []
    sources = []
    for r in hits:
        text = (r.get("text") or "")[:1200].replace("\n", " ")
        fn = r.get("file_name") or "document"
        context_blobs.append(f"--- From file: {fn} ---\n{text}\n")
        sources.append({"file_name": fn, "preview": text[:300]})

    context = "\n\n".join(context_blobs)
    system_prompt = _build_strict_prompt(context)
    user_prompt = req.query.strip()
    answer = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)

    return {"success": True, "answer": answer.strip(), "sources": sources}

# In api_server.py

@app.post("/api/transcribe-audio")
async def transcribe_audio(
    file: UploadFile,
    user_id: str = Form(""),
    thread_id: str = Form(""),
):
    # This outer try-except is a general catch-all
    try:
        audio_bytes = await file.read()
        
        # --- NEW Specific Error Handling ---
        # We wrap the pydub conversion in its own try-except
        # to see if this is the part that is failing.
        try:
            # Load audio bytes into pydub. Use io.BytesIO to treat bytes as a file.
            audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
        except Exception as e:
            # If pydub/ffmpeg fails to read the file, return a specific error
            error_message = f"Pydub/FFMPEG failed to decode audio. Error: {e}"
            return JSONResponse(
                content={"success": False, "transcript": f"(speech error: {error_message})"},
                status_code=422,
            )
        # --- END of new block ---

        # If loading was successful, proceed with transcription
        transcript = speech_to_text_from_bytes(
            content=audio_bytes,
            language_code="en-US",
            enable_automatic_punctuation=True,
        )

        if not transcript or transcript.startswith("(speech error"):
            return JSONResponse(
                content={"success": False, "transcript": transcript or ""},
                status_code=422,
            )

        return {"success": True, "transcript": transcript}

    except Exception as e:
        return JSONResponse(
            content={"success": False, "error": str(e)}, status_code=500
        )
@app.get("/api/ns/stats")
def api_ns_stats(user_id: Optional[str] = None, thread_id: str = Query(...)):
    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)
    count = namespace_count(index, ns)
    return {"namespace": ns, "vector_count": count}