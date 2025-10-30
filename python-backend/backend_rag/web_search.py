# backend_rag/web_search.py
from __future__ import annotations
import os
import httpx
from typing import List, Dict, Optional

API_KEY = os.getenv("GOOGLE_SEARCH_API_KEY")
CSE_ID = os.getenv("GOOGLE_CSE_ID")
SEARCH_URL = "https://www.googleapis.com/customsearch/v1"

def google_search(query: str, num_results: int = 5) -> str:
    """
    Performs a Google search using the Custom Search JSON API and returns
    a formatted string of snippets.
    """
    if not API_KEY or not CSE_ID:
        return "Search is not configured: GOOGLE_SEARCH_API_KEY or GOOGLE_CSE_ID is missing."

    params = {
        'key': API_KEY,
        'cx': CSE_ID,
        'q': query,
        'num': num_results
    }
    
    try:
        with httpx.Client() as client:
            response = client.get(SEARCH_URL, params=params, timeout=10.0)
            response.raise_for_status() # Raise an exception for bad status codes
            
        results = response.json()
        items = results.get('items', [])
        
        if not items:
            return "No relevant web search results found."
        
        snippets = []
        for i, item in enumerate(items):
            title = item.get('title', 'No Title')
            url = item.get('link', '')
            snippet = item.get('snippet', 'No snippet available.').replace("\n", "")
            snippets.append(f"Source [{i+1}]: {title} ({url})\nSnippet: {snippet}")
            
        return "\n\n".join(snippets)

    except Exception as e:
        print(f"--- [Google Search] Error: {e} ---")
        return f"(Web search failed: {e})"