# backend_rag/retrieval.py
from __future__ import annotations

import os
from typing import Optional, List, Dict

from backend_rag.embeddings import embed_texts, get_embedding_dimension
from backend_rag.vectorstore_pinecone import get_or_create_index, namespace, query_top_k

# Optional CrossEncoder reranker (kept if you already used it)
CROSS_ENCODER_MODEL = os.environ.get("CROSS_ENCODER_MODEL", "")
try:
    if CROSS_ENCODER_MODEL:
        from sentence_transformers import CrossEncoder
        _cross = CrossEncoder(CROSS_ENCODER_MODEL)
    else:
        _cross = None
except Exception:
    _cross = None


def _rerank(query: str, candidates: List[Dict], top_k: int) -> List[Dict]:
    if not candidates or _cross is None:
        return candidates[:top_k]
    pairs = [(query, c.get("metadata", {}).get("text", "")) for c in candidates]
    try:
        scores = _cross.predict(pairs)
    except Exception:
        return candidates[:top_k]
    for c, s in zip(candidates, scores):
        c["ce_score"] = float(s)
    return sorted(candidates, key=lambda x: x.get("ce_score", 0.0), reverse=True)[:top_k]


def retrieve_similar_chunks(query: str, user_id: Optional[str], thread_id: str, top_k: int = 3):
    """Pinecone-only retrieval."""
    dim = get_embedding_dimension()  # ensures index exists with right dim elsewhere
    index = get_or_create_index(dim)

    q_vec = embed_texts([query])[0].astype("float32").tolist()
    ns = namespace(user_id, thread_id)
    matches = query_top_k(index, ns, q_vec, top_k=max(top_k, 1))

    # Optionally rerank with CrossEncoder
    matches = _rerank(query, matches, top_k)

    # Normalize shape to your app's expected keys
    out = []
    for m in matches:
        md = m.get("metadata", {}) or {}
        out.append({
            "file_name": md.get("file_name", "document"),
            "text": md.get("text", ""),
            "score": float(m.get("score", 0.0)),
        })
    return out