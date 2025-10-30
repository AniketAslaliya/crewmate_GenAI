# backend_rag/models.py
from __future__ import annotations

import os
from typing import List, Optional

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from .config import DEFAULT_GOOGLE_MODEL, DEFAULT_MODEL_TEMPERATURE


# Single shared chat model (Gemini via LangChain wrapper)
model = ChatGoogleGenerativeAI(
    model=DEFAULT_GOOGLE_MODEL,
    convert_system_message_to_human=True,
    temperature=DEFAULT_MODEL_TEMPERATURE,
    google_api_key=os.getenv("GOOGLE_API_KEY"),
)

# --- form_model has been removed as requested ---


def call_model_system_then_user(
    system_prompt: str,
    user_prompt: str,
    temperature: Optional[float] = None,
    model_instance=model 
) -> str:
    """
    Invoke the shared LLM with [System, Human] messages.
    Optionally override temperature.
    Returns the content string (or a simple error string on failure).
    """
    sys = SystemMessage(content=system_prompt)
    hum = HumanMessage(content=user_prompt)

    # Prepare config to override temperature if provided
    invoke_config = {}
    if temperature is not None:
        invoke_config = {"temperature": float(temperature)}

    try:
        # --- This now ONLY uses the single, global 'model' ---
        # It ignores the model_instance argument
        resp = model.invoke([sys, hum], config=invoke_config)
        return getattr(resp, "content", str(resp))
    except Exception as e:
        return f"(model error: {e})"


def call_model_with_messages(
    messages: List[BaseMessage],
    temperature: Optional[float] = None,
    model_instance=model  # <-- We still accept this argument
):
    """
    Invoke the shared LLM with an arbitrary message list.
    Optionally override temperature.
    Returns the LC message response (or a SystemMessage with error text).
    """
    
    # Prepare config
    invoke_config = {}
    if temperature is not None:
        invoke_config = {"temperature": float(temperature)}

    try:
        # --- This now ONLY uses the single, global 'model' ---
        # It ignores the model_instance argument
        return model.invoke(messages, config=invoke_config)
    except Exception as e:
        return SystemMessage(content=f"(model error: {e})")