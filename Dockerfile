FROM python:3.11-slim

# System packages:
# - poppler-utils for pdf2image (your old pipeline)
# - libgl1 + libglib2.0-0 for Pillow/graphics
# - build-essential + libjpeg-dev + zlib1g-dev for compiling Python deps
# - ffmpeg for audio conversion (needed by pydub)
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    libjpeg-dev \
    zlib1g-dev \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pip settings
ENV PIP_DEFAULT_TIMEOUT=120
ENV PIP_NO_CACHE_DIR=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt /app/requirements.txt

# Install CPU-only torch first (so sentence-transformers won't try to pull CUDA wheels),
# then install remaining requirements.
RUN python -m pip install --upgrade pip && \
    pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copy application code
COPY . /app

# Expose port (Render/Heroku will override with $PORT anyway)
EXPOSE 10000

# Run FastAPI with uvicorn
# Use ${PORT:-10000} as fallback so it works locally and on platforms like Render
CMD uvicorn api_server:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1
