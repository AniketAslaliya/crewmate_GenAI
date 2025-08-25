# backend_rag/embeddings.py
from __future__ import annotations

import os
import gc
from typing import Iterable, List

import numpy as np

# Lazy-load SentenceTransformer only when needed (saves RAM on tiny instances)
_ST_MODEL = None

# Env knobs
LOCAL_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBED_BATCH = int(os.getenv("EMBED_BATCH", "64"))

# Known default dims (used to avoid loading the model just to read dim)
_KNOWN_DIMS = {
    "all-MiniLM-L6-v2": 384,
    "all-mpnet-base-v2": 768,
}

def _get_local_model():
    """Load the SentenceTransformer model on CPU (predictable memory on 512 MB)."""
    global _ST_MODEL
    if _ST_MODEL is None:
        from sentence_transformers import SentenceTransformer
        _ST_MODEL = SentenceTransformer(LOCAL_MODEL_NAME, device="cpu")
    return _ST_MODEL

def get_embedding_dimension() -> int:
    """
    Return the embedding dimension expected by the vector DB.
    If model is in _KNOWN_DIMS, use that (fast). Otherwise, ask the model.
    """
    if LOCAL_MODEL_NAME in _KNOWN_DIMS:
        return _KNOWN_DIMS[LOCAL_MODEL_NAME]
    try:
        return _get_local_model().get_sentence_embedding_dimension()
    except Exception:
        # Reasonable fallback; adjust if you add other models
        return 384

def iter_embed_texts(texts: List[str]) -> Iterable[List[float]]:
    """
    Generator that yields one embedding per input string using SentenceTransformers
    in small batches to avoid big intermediate matrices in RAM.
    """
    texts = texts or []
    if not texts:
        return
    model = _get_local_model()
    bs = max(1, int(EMBED_BATCH))
    for i in range(0, len(texts), bs):
        batch = texts[i:i + bs]
        arr = model.encode(
            batch,
            batch_size=min(bs, 64),
            convert_to_numpy=True,
            show_progress_bar=False,
            normalize_embeddings=False,
        )  # shape: (len(batch), dim)
        try:
            for row in arr:
                yield np.asarray(row, dtype=np.float32).tolist()
        finally:
            del arr
            gc.collect()

# Backwards-compat for old call sites (avoid for large docs; use iter_embed_texts)
def embed_texts(texts: List[str]):
    vecs: List[List[float]] = [v for v in iter_embed_texts(texts)]
    return np.asarray(vecs, dtype=np.float32)
