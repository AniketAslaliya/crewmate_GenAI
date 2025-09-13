from __future__ import annotations

import os
import re
from io import BytesIO
from pathlib import Path
from typing import Any, Dict

try:
    import PyPDF2
except Exception as e:  # pragma: no cover
    raise ImportError(f"Install PyPDF2. Error: {e}")

try:
    import docx  # python-docx
except Exception:
    docx = None

try:
    from pdf2image import convert_from_path
except Exception:
    convert_from_path = None

from .ocr import (
    VISION_AVAILABLE,
    ocr_image_with_google_vision,
    ocr_image_with_google_vision_bytes,
    ocr_pdf_with_google_vision_async_gcs,
)


def _extract_text_from_pdf(path: str) -> str:
    """Try to extract text from a PDF that already has a text layer."""
    text_parts = []
    try:
        with open(path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                try:
                    page_text = page.extract_text()
                except Exception:
                    page_text = ""
                if page_text:
                    text_parts.append(page_text)
    except Exception:
        return ""
    return "\n".join(text_parts)


def ocr_pdf_with_google_vision_local_pages(pdf_path: str, max_pages: int = 5) -> str:
    """
    Fallback OCR: rasterize first max_pages using pdf2image and OCR each page with Vision.
    Requires: pdf2image + poppler installed locally.
    """
    if convert_from_path is None:
        return ""
    try:
        pages = convert_from_path(pdf_path, dpi=300, first_page=1, last_page=max_pages)
        texts = []
        for p in pages:
            buf = BytesIO()
            p.save(buf, format="JPEG")
            content = buf.getvalue()
            t = ocr_image_with_google_vision_bytes(content)
            if t:
                texts.append(t)
        return "\n\n".join(texts)
    except Exception:
        return ""


def extract_text_with_diagnostics(file: str, pdf_ocr_pages: int = 5) -> Dict[str, Any]:
    """
    Attempts multi-strategy extraction and returns diagnostics.

    Returns:
      {
        "text": str,
        "source": str | None,
        "diagnostics": { step_name: {"ok": bool, "len": int, "note"?: str} }
      }
    """
    p = Path(file)
    suf = p.suffix.lower()
    diag: Dict[str, Any] = {}

    # 1) PDF: text layer → Vision GCS async → local rasterize fallback
    if suf == ".pdf":
        t = _extract_text_from_pdf(file)
        diag["pdf_pytext"] = {"ok": bool(t and t.strip()), "len": len(t) if t else 0}
        if t and t.strip():
            return {"text": t, "source": "pdf_pytext", "diagnostics": diag}

        if os.getenv("VISION_GCS_BUCKET"):
            diag["pdf_vision_mode"] = {"mode": "gcs_async", "bucket": os.getenv("VISION_GCS_BUCKET")}
            t2 = ocr_pdf_with_google_vision_async_gcs(file, max_pages=pdf_ocr_pages)
            diag["pdf_vision"] = {"ok": bool(t2 and t2.strip()), "len": len(t2) if t2 else 0}
            if t2 and t2.strip():
                return {"text": t2, "source": "pdf_vision_gcs_async", "diagnostics": diag}
        else:
            diag["pdf_vision_mode"] = {"mode": "local_pages_fallback", "note": "VISION_GCS_BUCKET not set"}

        t3 = ocr_pdf_with_google_vision_local_pages(file, max_pages=pdf_ocr_pages)
        diag["pdf_vision_local_pages"] = {"ok": bool(t3 and t3.strip()), "len": len(t3) if t3 else 0}
        if t3 and t3.strip():
            return {"text": t3, "source": "pdf_vision_local_pages", "diagnostics": diag}

        return {"text": "", "source": None, "diagnostics": diag}

    # 2) Plain text / Markdown
    if suf in {".txt", ".md"}:
        try:
            t = p.read_text(encoding="utf-8", errors="ignore")
            diag["txt_read"] = {"ok": bool(t and t.strip()), "len": len(t) if t else 0}
            if t and t.strip():
                return {"text": t, "source": "txt_read", "diagnostics": diag}
        except Exception as e:
            diag["txt_read"] = {"ok": False, "len": 0, "note": str(e)}
        return {"text": "", "source": None, "diagnostics": diag}

    # 3) DOCX (optional dep)
    if suf == ".docx":
        if docx is None:
            diag["docx"] = {"ok": False, "len": 0, "note": "python-docx not installed"}
            return {"text": "", "source": None, "diagnostics": diag}
        try:
            d = docx.Document(file)
            paragraphs = [pp.text for pp in d.paragraphs]
            t = "\n".join(paragraphs)
            diag["docx"] = {"ok": bool(t and t.strip()), "len": len(t) if t else 0}
            if t and t.strip():
                return {"text": t, "source": "docx", "diagnostics": diag}
        except Exception as e:
            diag["docx"] = {"ok": False, "len": 0, "note": str(e)}
        return {"text": "", "source": None, "diagnostics": diag}

    # 4) Legacy .doc — conversion omitted in modular cut (keep minimal)
    if suf == ".doc":
        diag["doc_to_docx"] = {"ok": False, "note": "Conversion not implemented in modular cut"}
        return {"text": "", "source": None, "diagnostics": diag}

    # 5) Images → Vision
    if suf in {".png", ".jpg", ".jpeg", ".tiff", ".bmp"}:
        diag["vision_available"] = {"ok": VISION_AVAILABLE}
        if VISION_AVAILABLE:
            t = ocr_image_with_google_vision(str(p))
            diag["vision_image"] = {"ok": bool(t and t.strip()), "len": len(t) if t else 0}
            if t and t.strip():
                return {"text": t, "source": "vision_image", "diagnostics": diag}
            else:
                diag["vision_image_note"] = "vision returned empty text"
        else:
            diag["vision_image_note"] = "vision not available"
        return {"text": "", "source": None, "diagnostics": diag}

    # 6) Fallback raw read
    try:
        raw = p.read_text(encoding="utf-8", errors="ignore")
        diag["raw_read"] = {"ok": bool(raw and raw.strip()), "len": len(raw) if raw else 0}
        if raw and raw.strip():
            return {"text": raw, "source": "raw_read", "diagnostics": diag}
    except Exception as e:
        diag["raw_read"] = {"ok": False, "len": 0, "note": str(e)}

    return {"text": "", "source": None, "diagnostics": diag}
