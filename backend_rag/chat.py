from __future__ import annotations

from typing import Annotated

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from .db import checkpointer
from .prompts import build_strict_system_prompt, FALLBACK_SYSTEM_PROMPT
from .retrieval import retrieve_similar_chunks
from .threads import get_user_for_thread
from .models import call_model_with_messages


class ChatState(dict):
    # LangGraph message store annotation
    messages: Annotated[list[BaseMessage], add_messages]


def _extract_ids_and_text_from_human(msg_content: str):
    """
    Parse optional [USER_ID:...] and [THREAD_ID:...] headers from the start of a message.
    Returns: (user_id | None, thread_id | None, remaining_text)
    """
    if not msg_content:
        return None, None, msg_content

    uid = None
    tid = None
    rest = msg_content

    if msg_content.startswith("[USER_ID:"):
        try:
            close = msg_content.index("]")
            uid = msg_content[9:close].strip()
            rest = msg_content[close + 1 :].lstrip()
        except ValueError:
            rest = msg_content

    if rest.startswith("[THREAD_ID:"):
        try:
            close2 = rest.index("]\n")
            tid = rest[11:close2].strip()
            rest = rest[close2 + 2 :]
        except ValueError:
            if "]" in rest:
                close2 = rest.index("]")
                tid = rest[11:close2].strip()
                rest = rest[close2 + 1 :].lstrip()

    return uid, tid, rest


def chat_node(state: ChatState):
    messages = state.get("messages", [])
    last_user_msg = None
    last_user_index = None

    # Find last HumanMessage
    for i in range(len(messages) - 1, -1, -1):
        m = messages[i]
        if isinstance(m, HumanMessage):
            last_user_msg = m
            last_user_index = i
            break

    if last_user_msg is None:
        return {"messages": []}

    uid, tid, cleaned_text = _extract_ids_and_text_from_human(last_user_msg.content)

    # Enforce access headers
    if tid is not None and uid is None:
        err = SystemMessage(content=("Access denied: A [USER_ID:<id>] is required to continue this thread."))
        return {"messages": [err]}
    if tid is not None and uid is not None:
        owner = get_user_for_thread(tid)
        if owner is not None and owner != uid:
            err = SystemMessage(content=("Access denied: This thread does not belong to the specified USER_ID."))
            return {"messages": [err]}

    if tid is None:
        # No thread context → plain model call
        new_messages = messages
        try:
            resp = call_model_with_messages(new_messages, temperature=0.0)
            return {"messages": [resp] if not isinstance(resp, list) else resp}
        except Exception as e:
            err_msg = SystemMessage(content=f"Error calling model: {e}")
            return {"messages": [err_msg]}
    else:
        # Replace the last user message content with cleaned_text (headers removed)
        cleaned_human = HumanMessage(content=cleaned_text)
        new_messages_list = messages.copy()
        new_messages_list[last_user_index] = cleaned_human

        # Retrieve context from per-user-per-thread index
        retrieved = retrieve_similar_chunks(cleaned_text, user_id=uid, thread_id=tid, top_k=4)
        if retrieved:
            context_texts = []
            for r in retrieved:
                fn = r.get("file_name", "document")
                snippet = r.get("text", "") or ""
                snippet_short = snippet[:1200].replace("\n", " ")
                context_texts.append(f"--- From file: {fn} ---\n{snippet_short}\n")
            context_combined = "\n\n".join(context_texts)

            system_prompt_text = build_strict_system_prompt(context_combined, max_context_chars=5000)
            system_prompt = SystemMessage(content=system_prompt_text)
            new_messages = [system_prompt] + new_messages_list
            try:
                resp = call_model_with_messages(new_messages, temperature=0.0)
                return {"messages": [resp] if not isinstance(resp, list) else resp}
            except Exception as e:
                err_msg = SystemMessage(content=f"Error calling model: {e}")
                return {"messages": [err_msg]}
        else:
            system_prompt = SystemMessage(content=FALLBACK_SYSTEM_PROMPT)
            new_messages = [system_prompt] + new_messages_list
            try:
                resp = call_model_with_messages(new_messages, temperature=0.0)
                return {"messages": [resp] if not isinstance(resp, list) else resp}
            except Exception as e:
                err_msg = SystemMessage(content=f"Error calling model: {e}")
                return {"messages": [err_msg]}


# Compile the graph and expose chatbot
graph = StateGraph(ChatState)
graph.add_node("chat_node", chat_node)
graph.add_edge(START, "chat_node")
graph.add_edge("chat_node", END)
chatbot = graph.compile(checkpointer=checkpointer)
