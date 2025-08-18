# backend_database.py
"""
Backend: per-user-per-chat vector stores (vectors/{user_id}/{thread_id}/...)
RAG ingestion + retrieval + SQLite user/thread mapping and safe migration.
"""

import os
import json
import uuid
import sqlite3
import shutil
from pathlib import Path
from typing import TypedDict, Annotated, Optional
from datetime import datetime

# langgraph / model imports
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

# RAG libs
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    import faiss
    import PyPDF2
except Exception as e:
    raise ImportError(f"Install dependencies: sentence-transformers, faiss-cpu, PyPDF2. Error: {e}")

# optional docx
try:
    import docx
except Exception:
    docx = None

from dotenv import load_dotenv
load_dotenv()

# ---------- Paths & DB ----------
BASE_DIR = Path(__file__).parent
VECTOR_DIR = BASE_DIR / "vectors"
VECTOR_DIR.mkdir(exist_ok=True, parents=True)
DB_PATH = BASE_DIR / "chatbot.db"

# sqlite connection & checkpointer
conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
checkpointer = SqliteSaver(conn=conn)

# ---------- DB migration (same as before) ----------
def _backup_db():
    try:
        bak = DB_PATH.with_suffix(".db.bak")
        if DB_PATH.exists() and not bak.exists():
            shutil.copy2(DB_PATH, bak)
    except Exception:
        pass

def _table_columns(table_name: str):
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
    if not cur.fetchone():
        return None
    cur.execute(f"PRAGMA table_info({table_name})")
    rows = cur.fetchall()
    return [r[1] for r in rows]

def _safe_migrate_table_to_new_schema(old_table: str, new_table: str, new_schema_sql: str, column_mapping: dict):
    cur = conn.cursor()
    cur.execute(new_schema_sql)
    old_cols = _table_columns(old_table) or []
    select_parts = []
    for new_col, old_col in column_mapping.items():
        if old_col and old_col in old_cols:
            select_parts.append(old_col)
        else:
            select_parts.append("NULL")
    sel = ", ".join(select_parts)
    new_cols = ", ".join(column_mapping.keys())
    if old_cols:
        cur.execute(f"INSERT OR IGNORE INTO {new_table} ({new_cols}) SELECT {sel} FROM {old_table}")
        conn.commit()
        cur.execute(f"DROP TABLE IF EXISTS {old_table}")
        cur.execute(f"ALTER TABLE {new_table} RENAME TO {old_table}")
        conn.commit()
    else:
        cur.execute(f"ALTER TABLE {new_table} RENAME TO {old_table}")
        conn.commit()

def _ensure_schema():
    if DB_PATH.exists():
        _backup_db()
    cur = conn.cursor()
    # users
    users_cols = _table_columns("users")
    if users_cols is None:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT,
                created_at TEXT
            )
        """)
        conn.commit()
    else:
        required = {"user_id", "username", "created_at"}
        if not required.issubset(set(users_cols)):
            old_cols = users_cols
            mapping = {
                "user_id": old_cols[0] if len(old_cols) >= 1 else None,
                "username": old_cols[1] if len(old_cols) >= 2 else None,
                "created_at": None
            }
            new_schema_sql = "CREATE TABLE temp_users_new (user_id TEXT PRIMARY KEY, username TEXT, created_at TEXT)"
            _safe_migrate_table_to_new_schema("users", "temp_users_new", new_schema_sql, mapping)

    # threads
    threads_cols = _table_columns("threads")
    if threads_cols is None:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS threads (
                thread_id TEXT PRIMARY KEY,
                user_id TEXT,
                file_name TEXT,
                filepath TEXT,
                ingested_at TEXT
            )
        """)
        conn.commit()
    else:
        required_t = {"thread_id", "user_id", "file_name", "filepath", "ingested_at"}
        if not required_t.issubset(set(threads_cols)):
            old_cols = threads_cols
            mapping_t = {
                "thread_id": old_cols[0] if len(old_cols) >= 1 else None,
                "user_id": old_cols[1] if len(old_cols) >= 2 else None,
                "file_name": old_cols[2] if len(old_cols) >= 3 else None,
                "filepath": old_cols[3] if len(old_cols) >= 4 else None,
                "ingested_at": None
            }
            new_schema_sql = "CREATE TABLE temp_threads_new (thread_id TEXT PRIMARY KEY, user_id TEXT, file_name TEXT, filepath TEXT, ingested_at TEXT)"
            _safe_migrate_table_to_new_schema("threads", "temp_threads_new", new_schema_sql, mapping_t)

    conn.commit()

_try_schema_err = None
try:
    _ensure_schema()
except Exception as _e:
    _try_schema_err = _e
    print("Warning: _ensure_schema failed:", _e)

# ---------- Model ----------
model = ChatGoogleGenerativeAI(
    model=os.getenv('GOOGLE_MODEL', 'gemini-2.5-flash'),
    temperature=float(os.getenv('MODEL_TEMPERATURE', 0.7)),
    google_api_key=os.getenv('GOOGLE_API_KEY')
)

# ---------- Embedding model ----------
EMBEDDING_MODEL_NAME = os.getenv('EMBEDDING_MODEL', "all-MiniLM-L6-v2")
_embed_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

# ---------- Per-user-per-chat path helpers ----------
def _chat_paths(user_id: Optional[str], thread_id: str):
    # normalize user id
    uid = str(user_id) if user_id else "anonymous"
    chat_dir = VECTOR_DIR / uid / str(thread_id)
    chat_dir.mkdir(parents=True, exist_ok=True)
    faiss_path = chat_dir / "faiss.index"
    meta_path = chat_dir / "metadata.json"
    file_record = chat_dir / "ingested_file.json"
    return faiss_path, meta_path, file_record

def _ensure_index_for_chat(user_id: Optional[str], thread_id: str):
    faiss_path, meta_path, _ = _chat_paths(user_id, thread_id)
    if faiss_path.exists() and meta_path.exists():
        try:
            index = faiss.read_index(str(faiss_path))
            with open(meta_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
            return index, metadata
        except Exception:
            pass
    d = _embed_model.get_sentence_embedding_dimension()
    index = faiss.IndexFlatL2(d)
    metadata = {}
    faiss.write_index(index, str(faiss_path))
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    return index, metadata

def _persist_index_for_chat(user_id: Optional[str], thread_id: str, index, metadata: dict):
    faiss_path, meta_path, _ = _chat_paths(user_id, thread_id)
    faiss.write_index(index, str(faiss_path))
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

# ---------- File reading & chunking ----------
def _extract_text_from_pdf(path):
    text = []
    with open(path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            try:
                page_text = page.extract_text()
            except Exception:
                page_text = ""
            if page_text:
                text.append(page_text)
    return "\n".join(text)

def _read_file_text(filepath: str):
    p = Path(filepath)
    suf = p.suffix.lower()
    if suf == ".pdf":
        return _extract_text_from_pdf(filepath)
    elif suf in {".txt", ".md"}:
        try:
            return Path(filepath).read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return ""
    elif suf == ".docx":
        if docx is None:
            return ""
        try:
            d = docx.Document(filepath)
            paragraphs = [pp.text for pp in d.paragraphs]
            return "\n".join(paragraphs)
        except Exception:
            return ""
    else:
        try:
            return Path(filepath).read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return ""

def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200):
    chunks = []
    i = 0
    n = len(text)
    while i < n:
        end = min(i + chunk_size, n)
        chunk = text[i:end].strip()
        if chunk:
            chunk_id = str(uuid.uuid4())
            chunks.append((chunk_id, chunk))
        i += chunk_size - overlap
    return chunks

# ---------- DB helpers ----------
def create_user_if_not_exists(user_id: str, username: Optional[str] = None):
    if not user_id:
        return
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM users WHERE user_id = ?", (user_id,))
    if cur.fetchone():
        return
    cur.execute("INSERT INTO users (user_id, username, created_at) VALUES (?, ?, ?)",
                (user_id, username or None, datetime.utcnow().isoformat()))
    conn.commit()

def associate_thread_with_user(user_id: str, thread_id: str):
    if not thread_id:
        return
    if user_id:
        create_user_if_not_exists(user_id)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM threads WHERE thread_id = ?", (thread_id,))
    if cur.fetchone():
        cur.execute("UPDATE threads SET user_id = ? WHERE thread_id = ?", (user_id, thread_id))
    else:
        cur.execute("INSERT INTO threads (thread_id, user_id, file_name, filepath, ingested_at) VALUES (?, ?, ?, ?, ?)",
                    (thread_id, user_id, None, None, None))
    conn.commit()

def get_threads_for_user(user_id: str):
    if not user_id:
        return []
    cur = conn.cursor()
    cur.execute("SELECT thread_id, file_name, filepath, ingested_at FROM threads WHERE user_id = ?", (user_id,))
    rows = cur.fetchall()
    return [{"thread_id": r[0], "file_name": r[1], "filepath": r[2], "ingested_at": r[3]} for r in rows]

def get_user_for_thread(thread_id: str):
    if not thread_id:
        return None
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM threads WHERE thread_id = ?", (thread_id,))
    r = cur.fetchone()
    return r[0] if r else None

# ---------- RAG public functions ----------
def ingest_file(filepath: str, file_name: str, thread_id: str, user_id: Optional[str] = None):
    """
    Ingest into vectors/{user_id}/{thread_id}/...
    If user_id provided, associate thread->user in DB.
    """
    if user_id:
        create_user_if_not_exists(user_id)
        associate_thread_with_user(user_id, thread_id)
    index, metadata = _ensure_index_for_chat(user_id, thread_id)
    text = _read_file_text(filepath)
    if not text or not text.strip():
        return {"success": False, "message": "No text extracted from file."}
    chunks = _chunk_text(text, chunk_size=1000, overlap=200)
    texts = [c[1] for c in chunks]
    if not texts:
        return {"success": False, "message": "No chunks created from file."}
    vectors = _embed_model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    start_idx = index.ntotal
    index.add(vectors.astype(np.float32))
    for i, (chunk_id, chunk_text) in enumerate(chunks):
        idx_key = start_idx + i
        metadata[str(int(idx_key))] = {
            "file_name": file_name,
            "chunk_id": chunk_id,
            "text": chunk_text[:4000]
        }
    _persist_index_for_chat(user_id, thread_id, index, metadata)
    _, _, file_record = _chat_paths(user_id, thread_id)
    with open(file_record, "w", encoding="utf-8") as f:
        json.dump({"file_name": file_name, "filepath": str(filepath), "user_id": user_id}, f, ensure_ascii=False, indent=2)
    # update threads table
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    cur.execute("SELECT 1 FROM threads WHERE thread_id = ?", (thread_id,))
    if cur.fetchone():
        cur.execute("UPDATE threads SET user_id = ?, file_name = ?, filepath = ?, ingested_at = ? WHERE thread_id = ?",
                    (user_id, file_name, str(filepath), now, thread_id))
    else:
        cur.execute("INSERT INTO threads (thread_id, user_id, file_name, filepath, ingested_at) VALUES (?, ?, ?, ?, ?)",
                    (thread_id, user_id, file_name, str(filepath), now))
    conn.commit()
    return {"success": True, "message": f"Ingested {len(chunks)} chunks into chat {thread_id} for user {user_id}"}

def thread_has_ingested_file(thread_id: str, user_id: Optional[str] = None) -> bool:
    # check per-user-per-chat file record
    _, _, file_record = _chat_paths(user_id, thread_id)
    if file_record.exists():
        return True
    # fallback to DB
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM threads WHERE thread_id = ? AND file_name IS NOT NULL", (thread_id,))
    return cur.fetchone() is not None

def retrieve_similar_chunks(query: str, user_id: Optional[str], thread_id: str, top_k: int = 3):
    index, metadata = _ensure_index_for_chat(user_id, thread_id)
    if index.ntotal == 0:
        return []
    q_vec = _embed_model.encode([query], convert_to_numpy=True)
    D, I = index.search(q_vec.astype(np.float32), top_k)
    results = []
    for idx in I[0]:
        if int(idx) < 0:
            continue
        meta = metadata.get(str(int(idx)), {})
        results.append({"index": int(idx), "file_name": meta.get("file_name"), "text": meta.get("text")})
    return results

def retrieve_all_threads(user_id: Optional[str] = None):
    cur = conn.cursor()
    if user_id:
        cur.execute("SELECT thread_id FROM threads WHERE user_id = ?", (user_id,))
    else:
        cur.execute("SELECT thread_id FROM threads")
    rows = cur.fetchall()
    return [r[0] for r in rows]

# ---------- Chat integration ----------
class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

def _extract_ids_and_text_from_human(msg_content: str):
    """
    Supports tags:
      [USER_ID:<id>][THREAD_ID:<id>]\n<rest>
    or single [THREAD_ID:<id>]\n<rest>
    Returns (user_id, thread_id, text)
    """
    if not msg_content:
        return None, None, msg_content
    uid = None
    tid = None
    rest = msg_content
    # parse user tag if present
    if msg_content.startswith("[USER_ID:"):
        try:
            close = msg_content.index("]")
            uid = msg_content[9:close].strip()
            rest = msg_content[close+1:].lstrip()
        except ValueError:
            rest = msg_content
    # parse thread tag next
    if rest.startswith("[THREAD_ID:"):
        try:
            close2 = rest.index("]\n")
            tid = rest[11:close2].strip()
            rest = rest[close2+2:]
        except ValueError:
            # maybe tag ends with ] only (no newline)
            if "]" in rest:
                close2 = rest.index("]")
                tid = rest[11:close2].strip()
                rest = rest[close2+1:].lstrip()
    return uid, tid, rest

def chat_node(state: ChatState):
    messages = state.get('messages', [])
    last_user_msg = None
    last_user_index = None
    for i in range(len(messages)-1, -1, -1):
        m = messages[i]
        if isinstance(m, HumanMessage):
            last_user_msg = m
            last_user_index = i
            break
    if last_user_msg is None:
        return {"messages": []}

    uid, tid, cleaned_text = _extract_ids_and_text_from_human(last_user_msg.content)
    # if user_id missing, try DB lookup for thread
    if uid is None and tid is not None:
        uid = get_user_for_thread(tid)

    if tid is None:
        # no thread id: pass messages unchanged
        new_messages = messages
    else:
        cleaned_human = HumanMessage(content=cleaned_text)
        new_messages_list = messages.copy()
        new_messages_list[last_user_index] = cleaned_human

        retrieved = retrieve_similar_chunks(cleaned_text, user_id=uid, thread_id=tid, top_k=4)
        if retrieved:
            context_texts = []
            for r in retrieved:
                fn = r.get("file_name", "document")
                snippet = r.get("text", "")
                context_texts.append(f"--- From file: {fn} ---\n{snippet}\n")
            context_combined = "\n\n".join(context_texts)
            system_prompt = SystemMessage(content=(
                "You are an assistant that should answer the user's question using the following document excerpts when relevant.\n"
                "Prefer answers found in the provided excerpts. If the document does not contain the answer, say you don't know or answer using general knowledge but mention the document didn't contain the info.\n\n"
                f"Document context:\n{context_combined}\n\nNow answer the user's question concisely and accurately."
            ))
            new_messages = [system_prompt] + new_messages_list
        else:
            new_messages = new_messages_list

    try:
        response = model.invoke(new_messages)
    except Exception as e:
        err_msg = SystemMessage(content=f"Error calling model: {e}")
        return {"messages": [err_msg]}

    return {"messages": [response]}

# compile graph
graph = StateGraph(ChatState)
graph.add_node("chat_node", chat_node)
graph.add_edge(START, "chat_node")
graph.add_edge("chat_node", END)
chatbot = graph.compile(checkpointer=checkpointer)
