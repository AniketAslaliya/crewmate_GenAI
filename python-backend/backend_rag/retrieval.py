# backend_rag/retrieval.py
from __future__ import annotations

import os
from typing import Optional, List, Dict

from backend_rag.embeddings import embed_texts, get_embedding_dimension
# Import both index functions
from backend_rag.vectorstore_pinecone import get_or_create_index, namespace, query_top_k, get_general_legal_index

# Optional CrossEncoder reranker
CROSS_ENCODER_MODEL = os.environ.get("CROSS_ENCODER_MODEL", "")
try:
    if CROSS_ENCODER_MODEL:
        from sentence_transformers import CrossEncoder
        _cross = CrossEncoder(CROSS_ENCODER_MODEL)
    else:
        _cross = None
except Exception:
    _cross = None


def _rerank(query: str, candidates: List[Dict], top_k: int, text_key: str = "text") -> List[Dict]:
    """
    Reranks candidates using the CrossEncoder.
    Accepts a 'text_key' to find the correct metadata field.
    """
    if not candidates or _cross is None:
        return candidates[:top_k]
    
    # --- THIS IS THE FIX ---
    # Use the dynamic text_key to get the correct text for reranking
    pairs = [(query, c.get("metadata", {}).get(text_key, "")) for c in candidates]
    
    try:
        scores = _cross.predict(pairs)
    except Exception:
        # Fallback to non-reranked if prediction fails
        return candidates[:top_k]
        
    for c, s in zip(candidates, scores):
        c["ce_score"] = float(s)
    return sorted(candidates, key=lambda x: x.get("ce_score", 0.0), reverse=True)[:top_k]


def retrieve_similar_chunks(query: str, user_id: Optional[str], thread_id: str, top_k: int = 3):
    """
    Pinecone-only retrieval for user-specific documents.
    """
    dim = get_embedding_dimension()
    index = get_or_create_index(dim)

    q_vec = embed_texts([query])[0].astype("float32").tolist()
    ns = namespace(user_id, thread_id)
    
    # Fetch more for the reranker
    initial_k = int(os.environ.get("ANN_TOP_K", "100"))
    matches = query_top_k(index, ns, q_vec, top_k=initial_k)

    # --- THIS IS THE FIX ---
    # Rerank using the "text" key
    matches = _rerank(query, matches, top_k, text_key="text")

    # Normalize shape
    out = []
    for m in matches:
        md = m.get("metadata", {}) or {}
        out.append({
            "file_name": md.get("file_name", "document"),
            "text": md.get("text", ""),
            "score": float(m.get("ce_score", m.get("score", 0.0))),
        })
    return out


def retrieve_general_legal_chunks(query: str, top_k: int = 5):
    """
    Retrieves from the GENERAL legal knowledge base (not a user's thread).
    Uses the same embedding and reranking logic as RAG.
    """
    try:
        # 1. Get the general index
        index = get_general_legal_index()
        
        # 2. Get query vector
        q_vec = embed_texts([query])[0].astype("float32").tolist()
        
        # 3. Query Pinecone (no namespace = default)
        initial_k = int(os.environ.get("ANN_TOP_K", "100"))
        matches = index.query(
            vector=q_vec, 
            top_k=initial_k, 
            include_metadata=True,
            namespace=""  # <-- THIS IS THE FIX
        )
        matches_list = matches.get("matches", [])

        # 4. --- THIS IS THE FIX ---
        # Rerank using the "question" key
        reranked_matches = _rerank(query, matches_list, top_k, text_key="question")

        # 5. Normalize shape
        out = []
        for m in reranked_matches:
            md = m.get("metadata", {}) or {}
            out.append({
                "file_name": "Legal Knowledge Base",
                "text": md.get("answer", ""), # Context is the 'answer'
                "score": float(m.get("ce_score", m.get("score", 0.0))),
                "retrieved_question": md.get("question", "")
            })
        return out
        
    except Exception as e:
        print(f"--- [ERROR] retrieve_general_legal_chunks failed: {e} ---")
        return []