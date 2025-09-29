# backend_rag/embeddings.py
from __future__ import annotations

import os
import numpy as np
from sentence_transformers import SentenceTransformer

# Environment variable for embedding model name
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# Load the SentenceTransformer model
_embed_model = SentenceTransformer(EMBEDDING_MODEL_NAME, device="cpu")


def embed_texts(texts: List[str]) -> np.ndarray:
    """
    Embed all texts in one operation using SentenceTransformer.
    Returns a NumPy array of shape (len(texts), embedding_dimension).
    """
    if not texts:
        return np.empty((0, get_embedding_dimension()), dtype=np.float32)
    return _embed_model.encode(
        texts,
        convert_to_numpy=True,
        show_progress_bar=False,
        normalize_embeddings=False,
    )


def get_embedding_dimension() -> int:
    """
    Return the embedding dimension expected by the vector DB.
    """
    return _embed_model.get_sentence_embedding_dimension()
