# api_server.py
from __future__ import annotations

import io
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from backend_rag.vectorstore_pinecone import (
    get_or_create_index,
    upsert_chunks,
    delete_namespace,
    namespace,
)
from backend_rag.embeddings import iter_embed_texts, get_embedding_dimension
from backend_rag.storage import chat_paths
from backend_rag.extract import extract_text_with_diagnostics
from backend_rag.chunking import chunk_text
from backend_rag.config import VECTOR_DIR, ANN_TOP_K, FINAL_TOP_K, CROSS_ENCODER_MODEL
from backend_rag.ocr import VISION_AVAILABLE
from backend_rag.retrieval import retrieve_similar_chunks

# ---- LLM helpers (Gemini chat you already use) ----
try:
    from backend_rag.llm import call_model_system_then_user  # preferred
except Exception:
    from backend_rag.models import model  # fallback
    from langchain_core.messages import SystemMessage, HumanMessage

    def call_model_system_then_user(system_prompt: str, user_prompt: str, temperature: float = 0.0) -> str:
        sys = SystemMessage(content=system_prompt)
        hum = HumanMessage(content=user_prompt)
        try:
            resp = model.invoke([sys, hum])
            return getattr(resp, "content", str(resp))
        except Exception as e:
            return f"(model error: {e})"

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
    allow_origins=["*"],  # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload dir (temporary)
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/tmp/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Tunables (set via ENV on Render)
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))
CHUNK_BYTES = int(os.getenv("UPLOAD_CHUNK_BYTES", str(1024 * 1024)))  # 1 MB default
EMBED_BATCH = int(os.getenv("EMBED_BATCH", "64"))
PREVIEW_CHARS = int(os.getenv("PREVIEW_CHARS", "600"))

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

class StudyGuideDownloadReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    filename: Optional[str] = None

class QuickAnalyzeDownloadReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    filename: Optional[str] = None

class FAQDownloadReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    filename: Optional[str] = None

class TimelineDownloadReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    filename: Optional[str] = None

# ----------------------------- Utils ------------------------------------------
def _read_ingested_filepath(user_id: Optional[str], thread_id: str) -> Optional[str]:
    """Read vectors/<user>/<thread>/ingested_file.json and return 'filepath'."""
    _, _, file_record = chat_paths(user_id, thread_id)
    if file_record.exists():
        try:
            import json
            rec = json.loads(file_record.read_text(encoding="utf-8"))
            return rec.get("filepath")
        except Exception:
            return None
    return None

def _default_basename(user_id: Optional[str], thread_id: str) -> str:
    fp = _read_ingested_filepath(user_id, thread_id)
    try:
        if fp:
            return Path(fp).stem
    except Exception:
        pass
    return f"thread_{thread_id}"

def _stream_text_file(text: str, filename: str, media_type: str = "text/plain; charset=utf-8"):
    buf = io.BytesIO(text.encode("utf-8"))
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(buf, media_type=media_type, headers=headers)

def _reset_vector_store(user_id: Optional[str], thread_id: str):
    """Delete Pinecone namespace for (user, thread) and remove local file pointer."""
    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)
    try:
        delete_namespace(index, ns)
    except Exception:
        pass
    _, _, file_record = chat_paths(user_id, thread_id)
    try:
        if file_record.exists():
            file_record.unlink()
    except Exception:
        pass

def _ingest_no_sqlite_save(local_path: str, file_name: str, user_id: Optional[str], thread_id: str):
    """
    Extract -> chunk -> embed (batched) -> upsert (batched) to Pinecone.
    Writes only a tiny ingested_file.json locally. Designed for 512 MB RAM.
    """
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

    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)

    total = 0
    for i in range(0, len(texts), EMBED_BATCH):
        batch_texts = texts[i:i + EMBED_BATCH]
        batch_ids = [chunks[i + j][0] for j in range(len(batch_texts))]
        batch_metas = [
            {"file_name": file_name, "chunk_id": cid, "text": (batch_texts[j] or "")[:PREVIEW_CHARS]}
            for j, cid in enumerate(batch_ids)
        ]

        # Get embeddings via generator (keeps memory low)
        batch_vecs = list(iter_embed_texts(batch_texts))
        if len(batch_vecs) != len(batch_ids):
            return {"success": False, "message": "Embedding count mismatch.", "diagnostics": diagnostics, "source": source}

        upsert_chunks(index, ns, batch_vecs, batch_ids, batch_metas)
        total += len(batch_ids)

    # Persist small pointer so UI knows a file is attached
    import json
    _, _, file_record = chat_paths(user_id, thread_id)
    file_record.parent.mkdir(parents=True, exist_ok=True)
    file_record.write_text(
        json.dumps(
            {"file_name": file_name, "filepath": str(local_path), "user_id": user_id, "extracted_from": source},
            ensure_ascii=False, indent=2
        ),
        encoding="utf-8"
    )

    return {
        "success": True,
        "message": f"Ingested {total} chunks (source={source}) into chat {thread_id} for user {user_id}",
        "diagnostics": diagnostics,
        "source": source,
    }

# ----------------------------- Endpoints --------------------------------------
@app.get("/api/health")
def health():
    return {"ok": True, "vector_dir": str(VECTOR_DIR), "vision": VISION_AVAILABLE}

@app.get("/api/config")
def get_config():
    return {
        "ANN_TOP_K": ANN_TOP_K,
        "FINAL_TOP_K": FINAL_TOP_K,
        "CROSS_ENCODER_MODEL": CROSS_ENCODER_MODEL,
        "VISION_AVAILABLE": VISION_AVAILABLE,
    }

@app.get("/api/thread/has-file")
def has_file(user_id: Optional[str] = None, thread_id: str = ""):
    if not thread_id:
        raise HTTPException(status_code=400, detail="thread_id is required")
    _, _, file_record = chat_paths(user_id, thread_id)
    return {"has_file": file_record.exists()}

def _ingest_background(local_path: str, file_name: str, user_id: Optional[str], thread_id: str):
    try:
        result = _ingest_no_sqlite_save(local_path, file_name, user_id, thread_id)
        print("[ingest] done:", result.get("message", result))
    except Exception as e:
        print("[ingest] ERROR:", e)

@app.post("/api/ingest")
async def ingest(
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = Form(default=None),
    thread_id: str = Form(...),
    file: UploadFile = File(...),
    replace: bool = Form(False),
    mode: str = Form("async"),  # "async" (default) or "sync" for debugging
):
    # One-file-per-thread policy
    _, _, file_record = chat_paths(user_id, thread_id)
    if file_record.exists() and not replace:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "A file is already attached to this thread. Pass replace=true to overwrite.",
                "has_file": True,
                "thread_id": thread_id,
                "user_id": user_id,
            },
        )
    if replace and file_record.exists():
        _reset_vector_store(user_id, thread_id)

    # Stream the upload to disk (avoid reading whole file into RAM)
    save_name = f"{thread_id}_{uuid.uuid4()}_{file.filename}"
    local_path = UPLOAD_DIR / save_name
    bytes_written = 0
    try:
        with local_path.open("wb") as out:
            while True:
                chunk = await file.read(CHUNK_BYTES)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_MB * 1024 * 1024:
                    try:
                        local_path.unlink()
                    except Exception:
                        pass
                    raise HTTPException(status_code=413, detail=f"File too large. Limit is {MAX_UPLOAD_MB} MB.")
                out.write(chunk)
    finally:
        await file.close()

    if mode.lower() == "sync":
        result = _ingest_no_sqlite_save(str(local_path), file.filename, user_id, thread_id)
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result)
        return result

    # Async: return quickly, process after response
    background_tasks.add_task(_ingest_background, str(local_path), file.filename, user_id, thread_id)
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={
            "success": True,
            "status": "accepted",
            "message": "File received; ingestion running in background.",
            "bytes": bytes_written,
            "thread_id": thread_id,
            "user_id": user_id,
        },
    )

@app.post("/api/study-guide")
def api_study_guide(req: StudyGuideReq):
    out = generate_study_guide(req.user_id, req.thread_id)
    if not out.get("success"):
        raise HTTPException(status_code=422, detail=out)
    return out

@app.post("/api/quick-analyze")
def api_quick_analyze(req: QuickAnalyzeReq):
    out = quick_analyze_thread(req.user_id, req.thread_id)
    if not out.get("success"):
        raise HTTPException(status_code=422, detail=out)
    return out

@app.post("/api/faq")
def api_faq(req: FAQReq):
    out = generate_faq(req.user_id, req.thread_id, max_snippets=req.max_snippets, num_questions=req.num_questions)
    if not out.get("success"):
        raise HTTPException(status_code=422, detail=out)
    return out

@app.post("/api/timeline")
def api_timeline(req: TimelineReq):
    out = generate_timeline(req.user_id, req.thread_id, max_snippets=req.max_snippets)
    if not out.get("success"):
        raise HTTPException(status_code=422, detail=out)
    return out

@app.post("/api/ask")
def api_ask(req: AskReq):
    """
    Q&A over the uploaded document for (user_id, thread_id).
    - Uses FAISS retrieval -> strict system prompt -> LLM
    - No SQLite writes; only reads vector store on disk.
    """
    ing_fp = _read_ingested_filepath(req.user_id, req.thread_id)
    if not ing_fp or not Path(ing_fp).exists():
        raise HTTPException(status_code=400, detail="No ingested file for this thread. Upload a document first.")

    hits = retrieve_similar_chunks(req.query, user_id=req.user_id, thread_id=req.thread_id, top_k=req.top_k)
    if not hits:
        return {"success": True, "answer": "Not stated in document.", "sources": []}

    context_blobs, sources = [], []
    for r in hits:
        text = (r.get("text") or "")[:1200].replace("\n", " ")
        fn = r.get("file_name") or "document"
        context_blobs.append(f"--- From file: {fn} ---\n{text}\n")
        sources.append({"file_name": fn, "preview": text[:300]})
    context = "\n\n".join(context_blobs)

    system_prompt = _build_strict_prompt(context)
    user_prompt = req.query.strip()
    answer = call_model_system_then_user(system_prompt, user_prompt, temperature=0.0)

    if not answer or answer.strip() == "":
        answer = "Not stated in document."
    low = answer.lower()
    if ("i don't have" in low or "cannot access" in low) and sources:
        answer = "Not stated in document."

    return {"success": True, "answer": answer.strip(), "sources": sources}

@app.post("/api/download/study-guide")
def download_study_guide(req: StudyGuideDownloadReq):
    out = generate_study_guide(req.user_id, req.thread_id)
    if not out.get("success"):
        raise HTTPException(status_code=422, detail=out)
    guide_text = out.get("study_guide") or out.get("text") or out.get("content") or ""
    if not guide_text.strip():
        raise HTTPException(status_code=422, detail={"message": "Empty study guide content."})
    base = req.filename or _default_basename(req.user_id, req.thread_id)
    return _stream_text_file(guide_text, f"{base}_study_guide.txt", media_type="text/plain; charset=utf-8")

@app.post("/api/download/quick-analyze")
def download_quick_analyze(req: QuickAnalyzeDownloadReq):
    qa = quick_analyze_thread(req.user_id, req.thread_id)
    if not qa.get("success"):
        raise HTTPException(status_code=422, detail=qa)

    dl_text = "QUICK SUMMARY\n\n"
    dl_text += (qa.get("summary") or "") + "\n\n"
    if qa.get("keywords"):
        dl_text += "KEYWORDS:\n" + ", ".join(qa.get("keywords")) + "\n\n"
    if qa.get("sample_snippets"):
        dl_text += "SAMPLE SNIPPETS:\n"
        for k, v in qa.get("sample_snippets", {}).items():
            dl_text += f"--- {k} ---\n{(v or '')[:2000]}\n\n"

    base = req.filename or _default_basename(req.user_id, req.thread_id)
    return _stream_text_file(dl_text, f"{base}_quick_analysis.txt", media_type="text/plain; charset=utf-8")

@app.post("/api/download/faq")
def download_faq(req: FAQDownloadReq):
    out = generate_faq(req.user_id, req.thread_id)
    if not out.get("success"):
        raise HTTPException(status_code=422, detail=out)
    faq_text = out.get("faq_markdown") or out.get("text") or out.get("content") or ""
    if not faq_text.strip():
        raise HTTPException(status_code=422, detail={"message": "Empty FAQ content."})
    base = req.filename or _default_basename(req.user_id, req.thread_id)
    return _stream_text_file(faq_text, f"{base}_faq.md", media_type="text/markdown; charset=utf-8")

@app.post("/api/download/timeline")
def download_timeline(req: TimelineDownloadReq):
    out = generate_timeline(req.user_id, req.thread_id)
    if not out.get("success"):
        raise HTTPException(status_code=422, detail=out)
    timeline_text = out.get("timeline_markdown") or out.get("text") or out.get("content") or ""
    if timeline_text.strip() == "":
        raise HTTPException(status_code=422, detail={"message": "Empty timeline content."})
    base = req.filename or _default_basename(req.user_id, req.thread_id)
    return _stream_text_file(timeline_text, f"{base}_timeline.md", media_type="text/markdown; charset=utf-8")
