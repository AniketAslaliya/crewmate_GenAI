FROM python:3.11-slim

# Poppler for pdf2image and small libs for Pillow/graphics
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    libjpeg-dev \
    zlib1g-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Speed up/resilient pip installs
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

# Optional: expose (for clarity). Render injects PORT at runtime anyway.
EXPOSE 10000

# Use shell form so ${PORT} gets expanded at runtime by the shell.
# Use ${PORT:-10000} as fallback in case PORT is not provided locally.
# Keep a single worker to lower memory usage.
CMD ["sh", "-c", "uvicorn api_server:app --host 0.0.0.0 --port ${PORT} --workers 1 --log-level info"]
