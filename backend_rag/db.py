from __future__ import annotations

"""
No local DB. No LangGraph Sqlite checkpointer.
Frontend stores chat history; Pinecone stores embeddings.
"""

# Exported symbol used by the chat graph builder
checkpointer = None