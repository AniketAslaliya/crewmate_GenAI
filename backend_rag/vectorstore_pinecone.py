# backend_rag/vectorstore_pinecone.py
from __future__ import annotations

import os
from typing import List, Dict, Optional
from pinecone import Pinecone, ServerlessSpec


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    v = os.environ.get(name, default)
    return v if v is not None and str(v).strip() != "" else default


def get_pc() -> Pinecone:
    api_key = _env("PINECONE_API_KEY")
    if not api_key:
        raise RuntimeError("PINECONE_API_KEY is not set")
    return Pinecone(api_key=api_key)


def get_or_create_index(dim: int):
    """Ensure the serverless index exists; return a handle."""
    pc = get_pc()
    name = _env("PINECONE_INDEX_NAME", "rag-index")
    cloud = _env("PINECONE_CLOUD", "aws")
    region = _env("PINECONE_REGION", "us-east-1")

    existing = {i["name"]: i for i in pc.list_indexes().get("indexes", [])}
    if name not in existing:
        pc.create_index(
            name=name,
            dimension=dim,
            metric="cosine",
            spec=ServerlessSpec(cloud=cloud, region=region),
        )
    return pc.Index(name)


def namespace(user_id: Optional[str], thread_id: str) -> str:
    return f"{(user_id or 'anonymous')}::{thread_id}"


def upsert_chunks(
    index,
    ns: str,
    vectors: List[List[float]],
    ids: List[str],
    metadatas: List[Dict],
) -> int:
    items = []
    for i, v in enumerate(vectors):
        md = metadatas[i] if i < len(metadatas) else {}
        items.append({"id": ids[i], "values": v, "metadata": md})
    if not items:
        return 0
    index.upsert(vectors=items, namespace=ns)
    return len(items)


def query_top_k(index, ns: str, query_vec: List[float], top_k: int = 5):
    res = index.query(vector=query_vec, top_k=top_k, include_metadata=True, namespace=ns)
    return res.get("matches", [])


def delete_namespace(index, ns: str):
    """Delete everything for this user/thread."""
    index.delete(namespace=ns, delete_all=True)