from __future__ import annotations

# Public API re-exports


# backend_rag/_init_.py
from .ingest import ingest_file, thread_has_ingested_file
from .retrieval import retrieve_similar_chunks
from .analysis import (
    generate_study_guide,
    quick_analyze_thread,
    get_term_context,
)
from .storage import chat_paths
from .chat import chatbot
from .threads import (
    create_user_if_not_exists,
    associate_thread_with_user,
    get_threads_for_user,
    get_user_for_thread,
)

_all_ = [
    # Ingest
    "ingest_file",
    "thread_has_ingested_file",
    # Retrieval
    "retrieve_similar_chunks",
    "retrieve_all_threads",
    # Analysis
    "quick_analyze_for_thread",
    "generate_study_guide",
    "get_term_context",
    # Chatbot graph
    "chatbot",
    # Threads/users helpers
    "create_user_if_not_exists",
    "associate_thread_with_user",
    "get_threads_for_user",
    "get_user_for_thread",
]
