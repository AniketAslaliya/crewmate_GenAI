from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env once
load_dotenv()

# Paths
BASE_DIR: Path = Path(__file__).parent
VECTOR_DIR: Path = BASE_DIR / "vectors"
VECTOR_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH: Path = BASE_DIR / "chatbot.db"

# Models / knobs
DEFAULT_GOOGLE_MODEL = os.getenv("GOOGLE_MODEL", "gemini-2.5-flash")
DEFAULT_MODEL_TEMPERATURE = float(os.getenv("MODEL_TEMPERATURE", "0.0"))
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

ANN_TOP_K = int(os.getenv("ANN_TOP_K", "100"))
FINAL_TOP_K = int(os.getenv("FINAL_TOP_K", "5"))
CROSS_ENCODER_MODEL = os.getenv("CROSS_ENCODER_MODEL", "")

# OCR / Vision
VISION_GCS_BUCKET = os.getenv("VISION_GCS_BUCKET", "")
VISION_ASYNC_TIMEOUT = int(os.getenv("VISION_ASYNC_TIMEOUT", "180"))
