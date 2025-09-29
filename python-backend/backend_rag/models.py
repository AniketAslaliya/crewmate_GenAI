from __future__ import annotations

import os
from typing import List, Optional

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from .config import DEFAULT_GOOGLE_MODEL, DEFAULT_MODEL_TEMPERATURE


# Single shared chat model (Gemini via LangChain wrapper)
model = ChatGoogleGenerativeAI(
    model=DEFAULT_GOOGLE_MODEL,
    temperature=DEFAULT_MODEL_TEMPERATURE,
    google_api_key=os.getenv("GOOGLE_API_KEY"),
)



def call_model_system_then_user(system_prompt: str, user_prompt: str, temperature: Optional[float] = None) -> str:
    """
    Invoke LLM with [System, Human] messages. Optionally override temperature.
    Returns the content string (or a simple error string on failure).
    """
    sys = SystemMessage(content=system_prompt)
    hum = HumanMessage(content=user_prompt)
    try:
        if temperature is None:
            resp = model.invoke([sys, hum])
            return getattr(resp, "content", str(resp))
        # Use a temp override model instance
        tmp_model = ChatGoogleGenerativeAI(
            model=os.getenv("GOOGLE_MODEL", DEFAULT_GOOGLE_MODEL),
            temperature=float(temperature),
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )
        resp = tmp_model.invoke([sys, hum])
        return getattr(resp, "content", str(resp))
    except Exception as e:
        return f"(model error: {e})"


def call_model_with_messages(messages: List[BaseMessage], temperature: Optional[float] = None):
    """
    Invoke LLM with an arbitrary message list. Optionally override temperature.
    Returns the LC message response (or a SystemMessage with error text).
    """
    try:
        if temperature is None:
            return model.invoke(messages)
        tmp_model = ChatGoogleGenerativeAI(
            model=os.getenv("GOOGLE_MODEL", DEFAULT_GOOGLE_MODEL),
            temperature=float(temperature),
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )
        return tmp_model.invoke(messages)
    except Exception as e:
        return SystemMessage(content=f"(model error: {e})")
