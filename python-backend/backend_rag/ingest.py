# backend_rag/ingest.py
from __future__ import annotations

import os
import json
from typing import Optional, Dict
from cryptography.fernet import Fernet

from backend_rag.extract import extract_text_with_diagnostics
from backend_rag.chunking import chunk_text
from backend_rag.embeddings import embed_texts, get_embedding_dimension
from backend_rag.vectorstore_pinecone import (
    get_or_create_index,
    upsert_chunks,
    delete_namespace,
    namespace,
)

# --- ENCRYPTION SETUP ---
# Load the key from .env
from dotenv import load_dotenv
load_dotenv()
ENCRYPTION_KEY = os.getenv("TEXT_ENCRYPTION_KEY")
# Initialize cipher if key exists
cipher = Fernet(ENCRYPTION_KEY) if ENCRYPTION_KEY else None

def ingest_file(
    filepath: str,
    file_name: str,
    thread_id: str,
    user_id: Optional[str] = None,
    replace: bool = False,
) -> Dict:
    """
    Pinecone-only ingestion: extract -> chunk -> embed -> ENCRYPT -> upsert.
    """

    # Optional: replace existing vectors for this thread
    if replace:
        try:
            dim = get_embedding_dimension()
            index = get_or_create_index(dim)
            ns = namespace(user_id, thread_id)
            delete_namespace(index, ns)
        except Exception:
            # best-effort cleanup
            pass

    # 1) Extract text
    extraction = extract_text_with_diagnostics(filepath)
    text = (extraction.get("text") or "").strip()
    source = extraction.get("source")
    diagnostics = extraction.get("diagnostics", {})

    if not text:
        return {
            "success": False,
            "message": "No text extracted from file.",
            "diagnostics": diagnostics,
            "source": source,
        }

    # 2) Chunk
    chunks = chunk_text(text, chunk_size=1000, overlap=200)
    if not chunks:
        return {
            "success": False,
            "message": "No chunks created from file.",
            "diagnostics": diagnostics,
            "source": source,
        }

    texts = [c[1] for c in chunks]
    ids = [c[0] for c in chunks]

    # 3) Embed 
    # IMPORTANT: We embed the CLEAR TEXT so the AI semantic search works.
    vecs = embed_texts(texts)
    vecs_list = [v.astype("float32").tolist() for v in vecs]

    # 4) Upsert to Pinecone with ENCRYPTION
    metadatas = []
    for i in range(len(texts)):
        clear_text_snippet = texts[i][:4000]
        
        # --- ENCRYPTION LOGIC ---
        # We encrypt the text before putting it into the metadata
        if cipher:
            try:
                stored_text = cipher.encrypt(clear_text_snippet.encode()).decode()
            except Exception as e:
                print(f"Encryption failed for chunk {ids[i]}: {e}")
                stored_text = clear_text_snippet
        else:
            # Fallback if no key is found in .env
            stored_text = clear_text_snippet
        # ------------------------

        metadatas.append({
            "file_name": file_name, 
            "chunk_id": ids[i], 
            "text": stored_text  # <--- This is now encrypted in the DB
        })

    dim = get_embedding_dimension()
    index = get_or_create_index(dim)
    ns = namespace(user_id, thread_id)
    upsert_chunks(index, ns, vecs_list, ids, metadatas)

    return {
        "success": True,
        "message": f"Ingested {len(chunks)} chunks (source={source}) into chat {thread_id} for user {user_id}",
        "diagnostics": diagnostics,
        "source": source,
    }

def thread_has_ingested_file(thread_id: str, user_id: Optional[str] = None) -> bool:
    """Server-side check: check if namespace is empty."""
    try:
        dim = get_embedding_dimension()
        index = get_or_create_index(dim)
        ns = namespace(user_id, thread_id)
        stats = index.describe_index_stats()
        count = stats.get("namespaces", {}).get(ns, {}).get("vector_count", 0)
        return count > 0
    except Exception:
        return False