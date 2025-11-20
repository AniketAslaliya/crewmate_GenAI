# backend_rag/translation.py
from __future__ import annotations
import os
from typing import Dict, Optional
import html

# --- Google Translate (optional) ---
try:
    from google.cloud import translate_v2 as translate
    from google.oauth2 import service_account
    _gcloud_translate_import_error = None
except Exception as e:
    translate = None
    service_account = None
    _gcloud_translate_import_error = e

TRANSLATE_AVAILABLE = translate is not None and _gcloud_translate_import_error is None
_translate_client = None

def _get_translate_client():
    """Instantiates and returns a Google Translate client."""
    global _translate_client
    if not TRANSLATE_AVAILABLE:
        return None
    if _translate_client is not None:
        return _translate_client

    key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    try:
        if key_path and os.path.exists(key_path) and service_account is not None:
            creds = service_account.Credentials.from_service_account_file(key_path)
            _translate_client = translate.Client(credentials=creds)
        else:
            # Fallback to Application Default Credentials (ADC)
            _translate_client = translate.Client()
        return _translate_client
    except Exception:
        _translate_client = None
        return None

def detect_language(text: str) -> Optional[Dict]:
    """
    Detects the language of a given text snippet.
    Returns a dictionary like {'language': 'hi', 'confidence': 0.98} or None.
    """
    client = _get_translate_client()
    if not client or not text.strip():
        return None
    try:
        # The API requires a non-empty string
        result = client.detect_language(text[:500]) # Use a snippet for efficiency
        return result
    except Exception:
        return None

# In backend_rag/translation.py
def translate_text(text: str, target_language: str) -> Optional[str]:
    """
    Translates text into the target language while preserving Markdown labels and field names.
    """
    print(f"\n--- [TRANSLATION] Attempting to translate to '{target_language}' ---")
    
    if not text or not text.strip():
        print("--- [TRANSLATION] FAILED: Input text is empty or whitespace.")
        return None

    # Protect Markdown labels
    placeholder_map = {
        "### Q:": "___Q_PLACEHOLDER___",
        "A:": "___A_PLACEHOLDER___"
    }
    protected_text = text
    for k, v in placeholder_map.items():
        protected_text = protected_text.replace(k, v)

    client = _get_translate_client()
    if not client:
        print("--- [TRANSLATION] FAILED: Translate client not available.")
        return None

    try:
        api_response = client.translate(protected_text, target_language=target_language)
        translated = api_response.get('translatedText')
        if not translated:
            print("--- [TRANSLATION] FAILED: 'translatedText' not in API response.")
            return None

        translated = html.unescape(translated)

        # Restore placeholders
        for k, v in placeholder_map.items():
            translated = translated.replace(v, k)

        return translated

    except Exception as e:
        print(f"--- [TRANSLATION] FAILED: Exception during the API call: {e}")
        return None