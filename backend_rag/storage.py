from __future__ import annotations

from pathlib import Path
from typing import Tuple

from .config import VECTOR_DIR


def chat_paths(user_id: str | None, thread_id: str) -> Tuple[Path, Path, Path]:
    """
    Return (faiss_path, meta_path, file_record) for a given user/thread.

    Structure:
      vectors/{user_id or "anonymous"}/{thread_id}/
        - faiss.index
        - metadata.json
        - ingested_file.json
    """
    uid = str(user_id) if user_id else "anonymous"
    chat_dir = VECTOR_DIR / uid / str(thread_id)
    chat_dir.mkdir(parents=True, exist_ok=True)

    faiss_path = chat_dir / "faiss.index"
    meta_path = chat_dir / "metadata.json"
    file_record = chat_dir / "ingested_file.json"
    return faiss_path, meta_path, file_record
