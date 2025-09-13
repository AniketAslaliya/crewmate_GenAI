from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any

# No local DB. Frontend stores chat in MongoDB; embeddings go to Pinecone.
# We keep a tiny in-memory map only for runtime convenience (clears on restart).

_USERS: Dict[str, Dict[str, Any]] = {}
_THREADS: Dict[str, Dict[str, Any]] = {}


def create_user_if_not_exists(user_id: str, username: Optional[str] = None) -> None:
    if not user_id:
        return
    _USERS.setdefault(user_id, {
        "user_id": user_id,
        "username": username,
        "created_at": datetime.utcnow().isoformat(),
    })


def associate_thread_with_user(user_id: Optional[str], thread_id: str) -> None:
    if not thread_id:
        return
    if user_id:
        create_user_if_not_exists(user_id)
    thread = _THREADS.get(thread_id)
    if thread is None:
        _THREADS[thread_id] = {
            "thread_id": thread_id,
            "user_id": user_id,
            "file_name": None,
            "filepath": None,
            "ingested_at": None,
        }
    else:
        thread["user_id"] = user_id


def get_threads_for_user(user_id: str) -> List[Dict[str, Any]]:
    if not user_id:
        return []
    return [
        {
            "thread_id": t["thread_id"],
            "file_name": t.get("file_name"),
            "filepath": t.get("filepath"),
            "ingested_at": t.get("ingested_at"),
        }
        for t in _THREADS.values()
        if t.get("user_id") == user_id
    ]


def get_user_for_thread(thread_id: str) -> Optional[str]:
    t = _THREADS.get(thread_id)
    return t.get("user_id") if t else None