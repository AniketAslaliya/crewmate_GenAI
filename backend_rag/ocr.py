from __future__ import annotations

import json
import os
import time
from io import BytesIO
from pathlib import Path
from typing import List, Optional, Tuple

from .config import VISION_GCS_BUCKET, VISION_ASYNC_TIMEOUT

# --- Google Vision + GCS (optional) ---
try:
    from google.cloud import vision_v1 as vision
    from google.cloud import storage as gcs
    from google.oauth2 import service_account
    _vision_import_error = None
except Exception as e:  # pragma: no cover
    vision = None
    gcs = None
    service_account = None
    _vision_import_error = e

VISION_AVAILABLE = vision is not None and _vision_import_error is None

_vision_client = None
_gcs_client = None


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


def _read_gcs_json_outputs(bucket_name: str, prefix: str) -> List[dict]:
    """Read Vision async JSON outputs from GCS prefix."""
    _, storage_client = _get_vision_and_storage_clients()
    if storage_client is None:
        return []
    out: List[dict] = []
    try:
        blobs = list(storage_client.list_blobs(bucket_name, prefix=prefix))
        for b in blobs:
            if not b.name.endswith(".json"):
                continue
            data = b.download_as_bytes()
            try:
                out.append(json.loads(data.decode("utf-8")))
            except Exception:
                try:
                    out.append(json.loads(data))
                except Exception:
                    continue
        return out
    except Exception:
        return []


def ocr_pdf_with_google_vision_async_gcs(pdf_path: str, max_pages: int = 100) -> str:
    """
    Use Vision async_batch_annotate_files via GCS. Requires:
      - VISION_GCS_BUCKET env var
      - Service account with storage + vision access
    Returns extracted text or "" on failure.
    """
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

        timeout_seconds = VISION_ASYNC_TIMEOUT
        poll_interval = 2
        waited = 0
        while not operation.done():
            time.sleep(poll_interval)
            waited += poll_interval
            if waited > timeout_seconds:
                break

        outputs = _read_gcs_json_outputs(bucket, gcs_dst_prefix)
        text_parts: List[str] = []
        for out_json in outputs:
            try:
                responses = out_json.get("responses", [])
                for r in responses:
                    fta = r.get("fullTextAnnotation")
                    if isinstance(fta, dict) and fta.get("text"):
                        text_parts.append(fta["text"])
                    elif r.get("textAnnotations"):
                        t0 = r["textAnnotations"][0].get("description", "")
                        if t0:
                            text_parts.append(t0)
            except Exception:
                continue
        return "\n\n".join(text_parts).strip()
    except Exception:
        return ""
