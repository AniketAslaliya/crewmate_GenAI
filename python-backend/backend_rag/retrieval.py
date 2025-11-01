# backend_rag/retrieval.py
from __future__ import annotations

import os
from typing import Optional, List, Dict

from backend_rag.embeddings import embed_texts, get_embedding_dimension
# Import all our helper functions
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
    """Enhanced reranking that considers both question and answer content"""
    if not candidates or _cross is None:
        return candidates[:top_k]
    
    # Create pairs that combine both question and answer for better matching
    pairs = []
    for c in candidates:
        md = c.get("metadata", {})
        question = md.get("question", "")
        answer = md.get("answer", "")
        combined = f"Q: {question}\nA: {answer}"
        pairs.append((query, combined))
    
    try:
        scores = _cross.predict(pairs)
    except Exception:
        return candidates[:top_k]
        
    for c, s in zip(candidates, scores):
        c["ce_score"] = float(s)
    return sorted(candidates, key=lambda x: x.get("ce_score", 0.0), reverse=True)[:top_k]


def retrieve_similar_chunks(query: str, user_id: Optional[str], thread_id: str, top_k: int = 3):
    """
    Pinecone-only retrieval for user-specific documents.
    """
    dim = get_embedding_dimension()
    index = get_or_create_index(dim) # Gets the 'rag-api' index

    q_vec = embed_texts([query])[0].astype("float32").tolist()
    ns = namespace(user_id, thread_id)
    
    initial_k = int(os.environ.get("ANN_TOP_K", "100"))
    
    # This function already works, so we don't change its logic
    matches = query_top_k(index, ns, q_vec, top_k=initial_k)

    matches = _rerank(query, matches, top_k, text_key="text")

    out = []
    for m in matches:
        md = m.get("metadata", {}) or {}
        out.append({
            "file_name": md.get("file_name", "document"),
            "text": md.get("text", ""),
            "score": float(m.get("ce_score", m.get("score", 0.0))),
        })
    return out


# [This is the full function. Replace your old one with this.]

def retrieve_general_legal_chunks(query: str, top_k: int = 5):
    """
    Retrieves from the GENERAL legal knowledge base (not a user's thread).
    
    --- UPDATED: This version SKIPS reranking as the logs show it
    can harm Q&A results by prioritizing keywords over semantics. ---
    
    It relies directly on the high-quality semantic search from the vector DB.
    """
    try:
        # 1. Get the general index
        index = get_general_legal_index()
        
        # 2. Get query vector
        # This uses your fixed embeddings.py (normalize_embeddings=True)
        q_vec = embed_texts([query])[0].astype("float32").tolist()
        
        # 3. --- THIS IS THE FIX ---
        # We query for 'top_k' directly and skip the 'initial_k' rerank logic.
        # We also use the 'ns=""' fix from before.
        matches_list = query_top_k(index, ns="", query_vec=q_vec, top_k=top_k)
        
        # 4. (Reranking step has been removed)

        # 5. Normalize shape
        out = []
        for m in matches_list: # Use the direct matches
            md = m.get("metadata", {}) or {}
            out.append({
                "file_name": "Legal Knowledge Base",
                "text": md.get("answer", ""), # Context is the 'answer'
                "score": float(m.get("score", 0.0)), # This is now the pure vector score
                "retrieved_question": md.get("question", "")
            })
        
        # This helps in debugging - print what we're sending to the LLM
        if out:
             print(f"--- [GeneralLegal] Found {len(out)} matches. Top match Q: {out[0]['retrieved_question'][:80]}... Score: {out[0]['score']}")
        else:
             print("--- [GeneralLegal] No matches found after vector search.")

        return out
        
    except Exception as e:
        print(f"--- [ERROR] retrieve_general_legal_chunks failed: {e} ---")
        return []