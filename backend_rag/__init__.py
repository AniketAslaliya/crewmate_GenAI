from __future__ import annotations

# Public API re-exports

from .ingest import ingest_file, thread_has_ingested_file
from .retrieval import retrieve_similar_chunks
from .analysis import (
    generate_study_guide,
    quick_analyze_thread,
    generate_faq,
    generate_timeline,
    suggest_case_law
)

from .chat import chatbot
from .threads import (
    create_user_if_not_exists,
    associate_thread_with_user,
    get_threads_for_user,
    get_user_for_thread,
)

# This list defines what gets imported when a user does 'from backend_rag import *'
_all_ = [
    # Ingest
    "ingest_file",
    "thread_has_ingested_file",
    # Retrieval
    "retrieve_similar_chunks",
    # Analysis
    "quick_analyze_thread",
    "generate_study_guide",
    "generate_faq",
    "generate_timeline",
    "suggest_case_law",
    # Chatbot graph
    "chatbot",
    # Threads/users helpers
    "create_user_if_not_exists",
    "associate_thread_with_user",
    "get_threads_for_user",
    "get_user_for_thread",
]