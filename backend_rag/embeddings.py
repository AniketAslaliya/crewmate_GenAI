# backend_rag/embeddings.py
from __future__ import annotations
import os
import numpy as np
from sentence_transformers import SentenceTransformer

EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
_embed_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

def embed_texts(texts):
    return _embed_model.encode(texts, convert_to_numpy=True, show_progress_bar=False)

def get_embedding_dimension() -> int:
    return _embed_model.get_sentence_embedding_dimension()