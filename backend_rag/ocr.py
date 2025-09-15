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
    from google.cloud import speech_v1 as speech
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
    """Create Speech & Storage clients using GOOGLE_APPLICATION_CREDENTIALS."""
    global _speech_client, _gcs_client_for_speech
    if not SPEECH_AVAILABLE:
        return None, None
    if _speech_client is not None and _gcs_client_for_speech is not None:
        return _speech_client, _gcs_client_for_speech

    key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    try:
        if key_path and Path(key_path).exists() and service_account is not None:
            creds = service_account.Credentials.from_service_account_file(key_path)
            _speech_client = speech.SpeechClient(credentials=creds)
            _gcs_client_for_speech = gcs.Client(credentials=creds, project=creds.project_id) if gcs else None
        else:
            # ADC / local gcloud auth
            _speech_client = speech.SpeechClient()
            _gcs_client_for_speech = gcs.Client() if gcs else None
        return _speech_client, _gcs_client_for_speech
    except Exception:
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

def speech_to_text_from_bytes(
    content: bytes,
    language_code: str = "en-US",
    enable_automatic_punctuation: bool = True,
) -> str:
    """
    Recognize audio content (bytes) by first converting it to the required format.
    This function takes any audio format supported by pydub and converts it to
    16-bit, 16kHz, mono WAV before sending it to the Google Speech-to-Text API.
    """
    sc, _ = _get_speech_and_storage_clients()
    if sc is None:
        return "(speech error: client not available)"
        
    try:
        # --- START: AUDIO CONVERSION LOGIC ---
        # Load audio bytes into pydub. Use io.BytesIO to treat bytes as a file.
        audio = AudioSegment.from_file(io.BytesIO(content))

        # Convert to the required format: 16-bit (sample_width=2), 16kHz, mono (channels=1)
        audio = audio.set_sample_width(2).set_frame_rate(16000).set_channels(1)

        # Export the converted audio back into a bytes object
        converted_buffer = io.BytesIO()
        audio.export(converted_buffer, format="wav")
        converted_bytes = converted_buffer.getvalue()
        # --- END: AUDIO CONVERSION LOGIC ---

        # Use the NEW, CORRECTED bytes for recognition
        recognition_audio = speech.RecognitionAudio(content=converted_bytes)

        # The audio is now guaranteed to be LINEAR16, so we can set the config directly
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            language_code=language_code,
            audio_channel_count=1,
            enable_automatic_punctuation=enable_automatic_punctuation,
        )

        resp = sc.recognize(config=config, audio=recognition_audio)

        parts = []
        for res in resp.results:
            if res.alternatives:
                parts.append(res.alternatives[0].transcript)
        return "\n".join(parts).strip()
        
    except Exception as e:
        return f"(speech error: {e})"


def speech_to_text_from_local_file(
    audio_path: str,
    language_code: str = "en-US",
    enable_automatic_punctuation: bool = True,
) -> str:
    """
    Reads an audio file from a local path and transcribes it.
    This function now acts as a simple wrapper around speech_to_text_from_bytes.
    """
    try:
        with open(audio_path, "rb") as f:
            content = f.read()
        return speech_to_text_from_bytes(
            content=content,
            language_code=language_code,
            enable_automatic_punctuation=enable_automatic_punctuation,
        )
    except Exception as e:
        return f"(speech error: {e})"