# backend_rag/tts.py
from __future__ import annotations
import os
from typing import Optional

# Try to import Google Cloud Text-to-Speech
try:
    from google.cloud import texttospeech
    from google.oauth2 import service_account
    _tts_available = True
except ImportError:
    _tts_available = False
    print("--- [TTS] Warning: google-cloud-texttospeech not installed. ---")

_tts_client = None

def _get_tts_client():
    global _tts_client
    if not _tts_available: return None
    if _tts_client: return _tts_client

    key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    try:
        if key_path and os.path.exists(key_path):
            creds = service_account.Credentials.from_service_account_file(key_path)
            _tts_client = texttospeech.TextToSpeechClient(credentials=creds)
        else:
            _tts_client = texttospeech.TextToSpeechClient()
        return _tts_client
    except Exception as e:
        print(f"--- [TTS] Error initializing client: {e} ---")
        return None

def generate_speech_audio(text: str, language_code: str = "en-US") -> Optional[bytes]:
    """
    Converts text to audio using HIGH QUALITY (Neural2/Wavenet) voices.
    """
    client = _get_tts_client()
    if not client: return None

    # 1. Map Codes to Full Locale
    locale_map = {
        "en": "en-IN", # Use Indian English for better relatability
        "hi": "hi-IN",
        "gu": "gu-IN",
        "ta": "ta-IN",
        "te": "te-IN",
        "mr": "mr-IN",
        "bn": "bn-IN",
        "kn": "kn-IN",
        "ml": "ml-IN"
    }
    full_lang_code = locale_map.get(language_code, "en-US")

    # 2. Select the BEST Voice (Neural2 or Wavenet)
    # Google Cloud Voice Names: https://cloud.google.com/text-to-speech/docs/voices
    voice_name_map = {
        "en-IN": "en-IN-Neural2-D",  # Indian English (Neural - Female)
        "en-US": "en-US-Neural2-J",  # US English (Neural - Male)
        "hi-IN": "hi-IN-Neural2-A",  # Hindi (Neural - Female) - Very Natural
        "gu-IN": "gu-IN-Wavenet-A",  # Gujarati (Wavenet - Female)
        "ta-IN": "ta-IN-Wavenet-D",  # Tamil (Wavenet - Female)
        "te-IN": "te-IN-Standard-A", # Telugu (Standard - sometimes better for specific dialects)
        "mr-IN": "mr-IN-Wavenet-A",  # Marathi
        "bn-IN": "bn-IN-Wavenet-A",  # Bengali
    }
    
    # Default to a specific high-quality voice if defined, otherwise let Google pick
    selected_name = voice_name_map.get(full_lang_code)

    synthesis_input = texttospeech.SynthesisInput(text=text)

    if selected_name:
        # Request the specific high-quality voice
        voice = texttospeech.VoiceSelectionParams(
            language_code=full_lang_code,
            name=selected_name
        )
    else:
        # Fallback
        voice = texttospeech.VoiceSelectionParams(
            language_code=full_lang_code,
            ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
        )

    # 3. MP3 Config
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=0.95  # Slightly slower for better clarity in explanation
    )

    try:
        response = client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )
        return response.audio_content
    except Exception as e:
        print(f"--- [TTS] Synthesis failed: {e} ---")
        return None