# backend_rag/chat.py
from __future__ import annotations
import json
import re
from typing import Annotated, Dict, Any, Optional

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage

from .db import checkpointer
from .prompts import build_strict_system_prompt, FALLBACK_SYSTEM_PROMPT, WEB_ANSWER_SYSTEM_PROMPT
from .retrieval import retrieve_similar_chunks
from .threads import get_user_for_thread
from .models import model, call_model_with_messages # Use default 'model' for RAG, 'web_model' for web
from .web_search import google_search

class ChatState(dict):
    messages: Annotated[list[BaseMessage], add_messages]
    original_query: Optional[str] = None
    user_id: Optional[str] = None
    thread_id: Optional[str] = None

# --- Graph Nodes ---

def get_session_info(state: ChatState):
    """Extracts user/thread IDs and the original query from the last human message."""
    messages = state.get("messages", [])
    last_user_msg = None
    
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            last_user_msg = m
            break
            
    if last_user_msg is None:
        return {"messages": [SystemMessage(content="Error: No user message found.")]}

    # Use regex to find [USER_ID:...] and [THREAD_ID:...]
    uid_match = re.search(r"\[USER_ID:([^\]]+)\]", last_user_msg.content)
    tid_match = re.search(r"\[THREAD_ID:([^\]]+)\]", last_user_msg.content)
    
    user_id = uid_match.group(1).strip() if uid_match else None
    thread_id = tid_match.group(1).strip() if tid_match else None
    
    # Clean the query
    cleaned_text = re.sub(r"\[USER_ID:[^\]]+\]", "", last_user_msg.content)
    cleaned_text = re.sub(r"\[THREAD_ID:[^\]]+\]", "", cleaned_text).strip()
    
    # Check for thread hijacking
    if thread_id and user_id:
        owner = get_user_for_thread(thread_id)
        if owner is not None and owner != user_id:
            return {"messages": [SystemMessage(content="Access denied: This thread does not belong to the specified USER_ID.")]}
            
    return {"original_query": cleaned_text, "user_id": user_id, "thread_id": thread_id}

def perform_rag_chat(state: ChatState):
    """
    Node 1: Performs the initial RAG search and gets a JSON response from the LLM.
    """
    user_id = state.get("user_id")
    thread_id = state.get("thread_id")
    query = state.get("original_query")
    messages = state.get("messages", [])
    
    # Clean the user message in the state
    last_user_msg = messages[-1]
    last_user_msg.content = query
    
    if not thread_id:
        # No thread context, just a fallback (or you could do web search directly)
        system_prompt = SystemMessage(content=FALLBACK_SYSTEM_PROMPT)
        response = call_model_with_messages([system_prompt, last_user_msg], model_instance=model)
        return {"messages": [response]}
        
    # --- Perform RAG ---
    retrieved = retrieve_similar_chunks(query, user_id=user_id, thread_id=thread_id, top_k=4)
    if not retrieved:
        # No documents, use fallback prompt
        system_prompt = SystemMessage(content=FALLBACK_SYSTEM_PROMPT)
        response = call_model_with_messages([system_prompt, last_user_msg], model_instance=model)
        return {"messages": [response]}

    # --- Build Context and Call LLM for JSON response ---
    context_texts = []
    for r in retrieved:
        fn = r.get("file_name", "document")
        snippet = r.get("text", "")[:1200].replace("\n", " ")
        context_texts.append(f"--- From file: {fn} ---\n{snippet}\n")
    context_combined = "\n\n".join(context_texts)
    
    # Use the JSON prompt from prompts.py
    system_prompt_text = build_strict_system_prompt(context_combined, max_context_chars=5000)
    system_prompt = SystemMessage(content=system_prompt_text)
    
    # Call the model
    response = call_model_with_messages([system_prompt, last_user_msg], model_instance=model)
    return {"messages": [response]} # Add the JSON AI Message to the state

def perform_web_search(state: ChatState):
    """
    Node 2: Performs a web search based on the original query.
    """
    print("--- [Graph] Confidence is Low. Performing web search... ---")
    query = state.get("original_query")
    search_results = google_search(query)
    
    # Add the web results as a new SystemMessage for the next step
    web_context_msg = SystemMessage(content=search_results)
    return {"messages": [web_context_msg]}

def perform_web_answer(state: ChatState):
    """
    Node 3: Generates a final answer using the original query and web search context.
    """
    print("--- [Graph] Generating final answer from web context... ---")
    query = state.get("original_query")
    messages = state.get("messages", [])
    
    # Find the web search context
    web_context = "No web context found."
    for msg in reversed(messages):
        if isinstance(msg, SystemMessage) and msg.content.startswith("Source [1]:"):
            web_context = msg.content
            break
            
    # Build the prompt
    system_prompt = WEB_ANSWER_SYSTEM_PROMPT.format(web_context=web_context)
    user_prompt = query
    
    # Call the web_model
    response = call_model_with_messages(
        [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)],
        model_instance=model
    )
    
    # Replace the last AI message (the JSON one) with this new, final answer
    new_messages = messages[:-2] # Remove RAG JSON response and web context
    new_messages.append(response) # Add the final answer
    
    return {"messages": new_messages}

# --- Conditional Edge ---

def check_confidence_and_route(state: ChatState) -> str:
    """
    Checks the confidence of the last AI (RAG) response and decides where to route.
    """
    last_message = state.get("messages", [])[-1]
    
    if not isinstance(last_message, (AIMessage, SystemMessage)):
        return "end" # Should not happen, but a safe fallback
        
    content = last_message.content
    
    # Try to parse the JSON response from the RAG step
    try:
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if not json_match:
            # Not a JSON response (e.g., a greeting or fallback), end here.
            return "end"
            
        json_data = json.loads(json_match.group(0))
        confidence = json_data.get("response", {}).get("ASSESSMENT", {}).get("CONFIDENCE", "High").lower()
        plain_answer = json_data.get("response", {}).get("PLAIN ANSWER", "")
        
        # Check for low confidence or "Not stated"
        if confidence == "low" or "not stated in document" in plain_answer.lower():
            # Confidence is low, proceed to web search
            return "web_search"
        else:
            # Confidence is high, replace AI msg with just the plain answer and end
            plain_answer_msg = AIMessage(content=plain_answer)
            messages = state.get("messages", [])
            messages[-1] = plain_answer_msg # Replace JSON with plain text
            return "end"
            
    except Exception as e:
        print(f"--- [Graph] Error parsing confidence JSON: {e} ---")
        # Could not parse, just end the flow
        return "end"

# --- Build the Graph ---

graph = StateGraph(ChatState)
graph.add_node("get_session_info", get_session_info)
graph.add_node("rag_chat", perform_rag_chat)
graph.add_node("web_search", perform_web_search)
graph.add_node("web_answer", perform_web_answer)

graph.add_edge(START, "get_session_info")
graph.add_edge("get_session_info", "rag_chat")
graph.add_conditional_edges(
    "rag_chat",
    check_confidence_and_route,
    {
        "web_search": "web_search", # If confidence is low
        "end": END                   # If confidence is high or not JSON
    }
)
graph.add_edge("web_search", "web_answer")
graph.add_edge("web_answer", END)

chatbot = graph.compile(checkpointer=checkpointer)