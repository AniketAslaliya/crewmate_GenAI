# api_server.py
from __future__ import annotations
from fastapi.responses import StreamingResponse
import io
import os
from pathlib import Path
from typing import Optional
from backend_rag.vectorstore_pinecone import get_or_create_index, upsert_chunks, delete_namespace, namespace
from backend_rag.embeddings import embed_texts, get_embedding_dimension
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---- Import ONLY modular parts that don't write to SQLite ----
# We avoid backend_rag.ingest (it writes to sqlite) and compose a no-DB ingest here.
from backend_rag.storage import chat_paths
from backend_rag.extract import extract_text_with_diagnostics
from backend_rag.chunking import chunk_text
from backend_rag.config import VECTOR_DIR, ANN_TOP_K, FINAL_TOP_K, CROSS_ENCODER_MODEL
from backend_rag.ocr import VISION_AVAILABLE

# High-level generators (they do not write to sqlite)
from backend_rag.analysis import (
    generate_study_guide,
    quick_analyze_for_thread as quick_analyze_thread,
    generate_faq,
    generate_timeline,  # already updated with DD/MM/YYYY + min 6 items
)
from backend_rag.vectorstore_pinecone import (
    get_or_create_index,
    upsert_chunks,
    delete_namespace,
    namespace,
)
from backend_rag.embeddings import embed_texts, get_embedding_dimension
from backend_rag.extract import extract_text_with_diagnostics
from backend_rag.chunking import chunk_text
from backend_rag.storage import chat_paths
# add with the other imports at the top
from pydantic import BaseModel
from typing import List, Dict
from backend_rag.retrieval import retrieve_similar_chunks

# try to use your LLM helper; fall back to a minimal one if not present
try:
    from backend_rag.llm import call_model_system_then_user  # preferred if you have it
except Exception:
    # Fallback: use the same model your backend uses
    from backend_rag.models import model  # if you have a wrapper, adjust as needed
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
    allow_origins=["*"],    # change to your site(s) in prod
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

class StudyGuideDownloadReq(BaseModel):
    user_id: Optional[str] = None
    thread_id: str
    filename: Optional[str] = None  # optional custom name

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
    """Mirror the backend helper: read vectors/<user>/<thread>/ingested_file.json."""
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
    """Derive a nice base filename from the uploaded file if present, else the thread id."""
    fp = _read_ingested_filepath(user_id, thread_id)
    try:
        if fp:
            return Path(fp).stem
    except Exception:
        pass
    return f"thread_{thread_id}"

def _stream_text_file(text: str, filename: str, media_type: str = "text/plain; charset=utf-8"):
    """Return a download response with Content-Disposition: attachment; filename=..."""
    buf = io.BytesIO(text.encode("utf-8"))
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(buf, media_type=media_type, headers=headers)
# --- add this in api_server.py, near other Utils ---

def _reset_vector_store(user_id: Optional[str], thread_id: str):
    """Delete the Pinecone namespace for this (user, thread) and remove the local file pointer."""
    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)
    try:
        delete_namespace(index, ns)
    except Exception:
        pass
    # remove local ingested_file.json pointer
    _, _, file_record = chat_paths(user_id, thread_id)
    try:
        if file_record.exists():
            file_record.unlink()
    except Exception:
        pass

def _ingest_no_sqlite_save(local_path: str, file_name: str, user_id: Optional[str], thread_id: str):
    """
    Pinecone-only ingestion: chunk + embed + upsert to Pinecone.
    Writes only a small ingested_file.json locally so the thread knows it has a file attached.
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

    vecs = embed_texts(texts)
    vecs_list = [v.astype("float32").tolist() for v in vecs]
    ids = [c[0] for c in chunks]
    metadatas = [{"file_name": file_name, "chunk_id": ids[i], "text": texts[i][:4000]} for i in range(len(texts))]

    # Pinecone upsert
    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)
    upsert_chunks(index, ns, vecs_list, ids, metadatas)

    # Persist a small "ingested_file.json" so your UI/endpoints know there's a file attached
    import json
    _, _, file_record = chat_paths(user_id, thread_id)
    file_record.parent.mkdir(parents=True, exist_ok=True)
    file_record.write_text(
        json.dumps({"file_name": file_name, "filepath": str(local_path), "user_id": user_id, "extracted_from": source}, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    return {"success": True, "message": f"Ingested {len(chunks)} chunks (source={source}) into chat {thread_id} for user {user_id}", "diagnostics": diagnostics, "source": source}

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


@app.post("/api/ingest")
async def ingest(
    user_id: Optional[str] = Form(default=None),
    thread_id: str = Form(...),
    file: UploadFile = File(...),
    replace: bool = Form(False),   # <-- NEW: server-side control
):
    # Enforce one-file-per-thread on the server
    _, _, file_record = chat_paths(user_id, thread_id)
    if file_record.exists() and not replace:
        # client can pass replace=true to allow replacing the context
        raise HTTPException(
            status_code=409,
            detail={
                "message": "A file is already attached to this thread. Pass replace=true to overwrite.",
                "has_file": True,
                "thread_id": thread_id,
                "user_id": user_id,
            },
        )

    # If replacing, wipe the previous vector store + metadata
    if replace and file_record.exists():
        _reset_vector_store(user_id, thread_id)

    # Save upload to disk (no DB writes)
    save_name = f"{thread_id}_{file.filename}"
    local_path = UPLOAD_DIR / save_name
    with local_path.open("wb") as f:
        f.write(await file.read())

    # Ingest without SQLite writes (FAISS + metadata files only)
    result = _ingest_no_sqlite_save(str(local_path), file.filename, user_id, thread_id)
    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result)
    return result

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
    # generate_timeline already returns "No timeline to show in your document."
    # if < 6 rows after normalization; still success=True in that branch.
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
    # verify there is an ingested file pointer (optional but nice)
    ing_fp = _read_ingested_filepath(req.user_id, req.thread_id)
    if not ing_fp or not Path(ing_fp).exists():
        raise HTTPException(status_code=400, detail="No ingested file for this thread. Upload a document first.")

    # retrieve top_k similar chunks
    hits = retrieve_similar_chunks(req.query, user_id=req.user_id, thread_id=req.thread_id, top_k=req.top_k)
    if not hits:
        # still reply with a consistent payload
        return {
            "success": True,
            "answer": "Not stated in document.",
            "sources": [],
        }

    # build short, safe context
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

    # if the model drifted and didn't follow rules, guard-rail minimally
    if not answer or answer.strip() == "":
        answer = "Not stated in document."
    # very light sanity check: if it contains 'I do not have the document' etc., fix
    low = answer.lower()
    if ("i don't have" in low or "cannot access" in low) and sources:
        answer = "Not stated in document."

    return {
        "success": True,
        "answer": answer.strip(),
        "sources": sources,  # small previews so you can show citations in your UI
    }

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

    # Build the same text you used in Streamlit
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