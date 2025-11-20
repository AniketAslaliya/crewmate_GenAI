from __future__ import annotations

import json
import os
import time
import io
import wave
from io import BytesIO
from pathlib import Path
from typing import List, Optional

from pydub import AudioSegment

from .config import VISION_GCS_BUCKET, VISION_ASYNC_TIMEOUT

# --- Google Vision + GCS + Speech (optional) ---
try:
    from google.cloud import vision_v1 as vision
    from google.cloud import storage as gcs
    from google.oauth2 import service_account
    from google.cloud import speech_v2 as speech

    _gcloud_import_error = None
except Exception as e:  # pragma: no cover
    vision = None
    gcs = None
    service_account = None
    speech = None
    _gcloud_import_error = e

VISION_AVAILABLE = vision is not None and _gcloud_import_error is None
SPEECH_AVAILABLE = speech is not None and _gcloud_import_error is None

_vision_client = None
_gcs_client = None
_speech_client = None
_gcs_client_for_speech = None


def _get_vision_and_storage_clients():
    """Create Vision & Storage clients using GOOGLE_APPLICATION_CREDENTIALS (if present)."""
    global _vision_client, _gcs_client
    if not VISION_AVAILABLE:
        return None, None
    if _vision_client is not None and _gcs_client is not None:
        return _vision_client, _gcs_client

    key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    try:
        if key_path and Path(key_path).exists() and service_account is not None:
            creds = service_account.Credentials.from_service_account_file(key_path)
            _vision_client = vision.ImageAnnotatorClient(credentials=creds)
            _gcs_client = gcs.Client(credentials=creds, project=creds.project_id) if gcs else None
        else:
            # ADC / local gcloud auth
            _vision_client = vision.ImageAnnotatorClient()
            _gcs_client = gcs.Client() if gcs else None
        return _vision_client, _gcs_client
    except Exception:
        _vision_client = None
        _gcs_client = None
        return None, None

def _get_speech_and_storage_clients():
    """
    Create Speech (v2) & Storage clients using GOOGLE_APPLICATION_CREDENTIALS.
    Fully compatible with Speech-to-Text v2.
    Includes detailed logging for debugging credential issues.
    """
    global _speech_client, _gcs_client_for_speech

    if not SPEECH_AVAILABLE:
        print("[SPEECH INIT] ❌ Speech/Storage not available in environment.")
        return None, None

    # Reuse cached clients
    if _speech_client is not None and _gcs_client_for_speech is not None:
        print("[SPEECH INIT] ✅ Returning existing cached clients.")
        return _speech_client, _gcs_client_for_speech

    key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    print(f"[SPEECH INIT] GOOGLE_APPLICATION_CREDENTIALS: {key_path}")

    try:
        # --- CASE 1: Explicit key file path provided ---
        if key_path and Path(key_path).exists() and service_account is not None:
            print(f"[SPEECH INIT] ✅ Found service account key at: {key_path}")
            creds = service_account.Credentials.from_service_account_file(key_path)

            # ✅ Use Speech-to-Text v2 client here
            from google.cloud import speech_v2
            _speech_client = speech_v2.SpeechClient(credentials=creds)

            # Google Cloud Storage client (optional)
            _gcs_client_for_speech = gcs.Client(credentials=creds, project=creds.project_id) if gcs else None

        # --- CASE 2: No explicit key, try ADC (local gcloud or env) ---
        else:
            print("[SPEECH INIT] ⚠️ No valid key path found. Trying default credentials (ADC)...")

            # ✅ Use Speech-to-Text v2 client here
            from google.cloud import speech_v2
            _speech_client = speech_v2.SpeechClient()

            _gcs_client_for_speech = gcs.Client() if gcs else None

        print("[SPEECH INIT] ✅ Speech-to-Text v2 and Storage clients initialized successfully.")
        return _speech_client, _gcs_client_for_speech

    except Exception as e:
        print(f"[SPEECH INIT] ❌ FAILED to initialize Speech/Storage clients: {e}")
        _speech_client = None
        _gcs_client_for_speech = None
        return None, None




def ocr_image_with_google_vision_bytes(content: bytes) -> str:
    """OCR image bytes using Vision's DOCUMENT_TEXT_DETECTION."""
    vclient, _ = _get_vision_and_storage_clients()
    if vclient is None:
        return ""
    try:
        image = vision.Image(content=content)
        resp = vclient.document_text_detection(image=image)
        if getattr(resp, "error", None) and getattr(resp.error, "message", None):
            return ""
        fta = getattr(resp, "full_text_annotation", None)
        if fta and getattr(fta, "text", None):
            return fta.text
        if resp.text_annotations:
            return resp.text_annotations[0].description or ""
        return ""
    except Exception:
        return ""


def ocr_image_with_google_vision(image_path: str) -> str:
    bucket = os.getenv("VISION_GCS_BUCKET")
    if not bucket:
        raise ValueError("VISION_GCS_BUCKET is not set in environment variables.")

    # Upload image to GCS
    dest_blob_name = f"vision_inputs/{Path(image_path).name}"
    gcs_uri = _upload_file_to_gcs(bucket, image_path, dest_blob_name)
    if not gcs_uri:
        raise RuntimeError("Failed to upload image to GCS.")

    # Perform OCR
    try:
        with open(image_path, "rb") as f:
            return ocr_image_with_google_vision_bytes(f.read())
    except Exception:
        return ""


def _upload_file_to_gcs(bucket_name: str, source_path: str, dest_blob_name: str) -> Optional[str]:
    """Upload local file to GCS. Returns gs:// URI or None."""
    _, storage_client = _get_vision_and_storage_clients()
    if storage_client is None:
        return None
    try:
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(dest_blob_name)
        blob.upload_from_filename(source_path)
        return f"gs://{bucket_name}/{dest_blob_name}"
    except Exception:
        return None


def ocr_pdf_with_google_vision_async_gcs(pdf_path: str) -> str:
    """Use Vision async_batch_annotate_files via GCS."""
    bucket = VISION_GCS_BUCKET
    if not bucket:
        return ""
    vclient, storage_client = _get_vision_and_storage_clients()
    if vclient is None or storage_client is None:
        return ""

    try:
        from uuid import uuid4
        uid = str(uuid4())
        gcs_src_name = f"vision_inputs/{uid}/{Path(pdf_path).name}"
        gcs_dst_prefix = f"vision_outputs/{uid}/"

        src_gs_uri = _upload_file_to_gcs(bucket, pdf_path, gcs_src_name)
        if not src_gs_uri:
            return ""

        gcs_source = vision.GcsSource(uri=src_gs_uri)
        input_config = vision.InputConfig(gcs_source=gcs_source, mime_type="application/pdf")
        gcs_destination = vision.GcsDestination(uri=f"gs://{bucket}/{gcs_dst_prefix}")
        output_config = vision.OutputConfig(gcs_destination=gcs_destination, batch_size=2)

        feature = vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)
        async_req = vision.AsyncAnnotateFileRequest(
            input_config=input_config,
            features=[feature],
            output_config=output_config,
        )
        operation = vclient.async_batch_annotate_files(requests=[async_req])

        operation.result(timeout=VISION_ASYNC_TIMEOUT)

        text_parts = []
        blobs = storage_client.list_blobs(bucket, prefix=gcs_dst_prefix)
        for blob in blobs:
            if blob.name.endswith(".json"):
                output = json.loads(blob.download_as_string())
                for response in output.get("responses", []):
                    if response.get("fullTextAnnotation"):
                        text_parts.append(response["fullTextAnnotation"]["text"])
        return "\n\n".join(text_parts).strip()
    except Exception:
        return ""


# ------------------- Speech-to-Text helpers -------------------
def detect_language_from_audio_bytes(content: bytes) -> str:
    """
    Detects spoken language using quick trial transcriptions.
    Tries Hindi, Gujarati, and English — returns whichever yields the longest transcript.
    """
    client, _ = _get_speech_and_storage_clients()
    if not client:
        print("--- [LANG DETECT] Speech client not available, defaulting to en-US.")
        return "en-US"

    try:
        # Use only the first 10 seconds for detection
        audio_segment = AudioSegment.from_file(io.BytesIO(content))
        snippet = audio_segment[:10000]
        buffer = io.BytesIO()
        snippet.export(buffer, format="wav")
        wav_bytes = buffer.getvalue()
        recognition_audio = speech.RecognitionAudio(content=wav_bytes)

        # Try all candidate languages
        candidates = ["hi-IN", "gu-IN", "en-US"]
        scores = {}

        for lang in candidates:
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=snippet.frame_rate,
                language_code=lang,
                model="latest_long",
                audio_channel_count=snippet.channels,
            )
            try:
                response = client.recognize(config=config, audio=recognition_audio)
                transcript_len = sum(len(r.alternatives[0].transcript.strip()) for r in response.results)
                scores[lang] = transcript_len
            except Exception as inner_e:
                scores[lang] = 0

        detected = max(scores, key=scores.get)
        print(f"--- [LANG DETECT] Language scores: {scores} → Detected: {detected} ---")
        return detected if scores[detected] > 5 else "en-US"

    except Exception as e:
        print(f"--- [LANG DETECT] Error during language detection: {e}, defaulting to en-US.")
        return "en-US"

    

import io
import os
import base64
import requests
from pydub import AudioSegment

import os
import io
import base64
import requests
from pydub import AudioSegment

# In backend_rag/ocr.py

# (Make sure the necessary imports are at the top, like speech, AudioSegment, io, etc.)
# (Also ensure the _get_speech_client() function is present in the file)

def speech_to_text_from_bytes(content: bytes, language_code: str | None = None,enable_automatic_punctuation: bool = True) -> str:
    """
    Transcribes audio using Google Cloud Speech-to-Text v2.
    If `language_code` is provided, it forces that language.
    Otherwise, auto-detects using multiple language codes.
    Returns native-script output (e.g., Hindi → 'यह क्या है', Gujarati → 'આ શું છે').
    """
    try:
        from google.cloud import speech_v2
        from google.oauth2 import service_account
        import json

        # --- Step 1: Load credentials & project info ---
        key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if not key_path or not Path(key_path).exists():
            return "(speech error: GOOGLE_APPLICATION_CREDENTIALS missing or invalid path)"

        with open(key_path, "r", encoding="utf-8") as f:
            creds_data = json.load(f)
        project_id = creds_data.get("project_id")
        if not project_id:
            return "(speech error: project_id missing in service account JSON)"

        creds = service_account.Credentials.from_service_account_file(key_path)
        client = speech_v2.SpeechClient(credentials=creds)

        # --- Step 2: Prepare audio (normalize) ---
        audio_segment = AudioSegment.from_file(io.BytesIO(content))
        audio_segment = audio_segment.set_frame_rate(16000).set_channels(1)
        buf = io.BytesIO()
        audio_segment.export(buf, format="wav")
        wav_bytes = buf.getvalue()

        # --- Step 3: Build language list ---
        if language_code:
            languages = [language_code]
        else:
            languages = ["hi-IN", "gu-IN", "en-US"]  # Auto-detect among these (add more if needed)

        # --- Step 4: Create RecognizeRequest ---
        request = speech_v2.RecognizeRequest(
            recognizer=f"projects/{project_id}/locations/global/recognizers/_",
            config=speech_v2.RecognitionConfig(
                auto_decoding_config={},
                language_codes=languages,
                model="long",
                features=speech_v2.RecognitionFeatures(
                    enable_automatic_punctuation=True,
                    enable_spoken_punctuation=True,
                ),
            ),
            content=wav_bytes,
        )

        # --- Step 5: Transcribe ---
        response = client.recognize(request=request)

        transcript = ""
        detected_lang = None
        for result in response.results:
            transcript += result.alternatives[0].transcript.strip() + " "
            if result.language_code:
                detected_lang = result.language_code

        transcript = transcript.strip()
        print(f"[SPEECH V2] ✅ Transcript: {transcript}")
        if detected_lang:
            print(f"[SPEECH V2] 🌐 Detected Language: {detected_lang}")

        return transcript or "(speech error: empty transcript)"

    except Exception as e:
        return f"(speech error: {e})"


def speech_to_text_from_local_file(audio_path: str) -> dict:
    """
    Orchestrator function: reads a local file, detects the language from its
    audio, then gets the full transcript in that language.
    Returns a dictionary with the transcript and detected language.
    """
    try:
        with open(audio_path, "rb") as f:
            content = f.read()

        # First Pass: Detect language from the audio bytes
        detected_language = detect_language_from_audio_bytes(content)

        # Second Pass: Transcribe the full audio using the detected language
        transcript = speech_to_text_from_bytes(content, language_code=detected_language)
        
        return {"transcript": transcript, "detected_language": detected_language}
    except Exception as e:
        return {"transcript": f"(speech error: {e})", "detected_language": "unknown"}