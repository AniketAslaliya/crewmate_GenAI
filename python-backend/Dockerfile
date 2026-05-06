FROM python:3.11-slim

# System packages:
# - poppler-utils for pdf2image
# - libgl1 + libglib2.0-0 for Pillow/graphics
# - build-essential + libjpeg-dev + zlib1g-dev for compiling Python deps
# - ffmpeg for audio conversion
#
# NOTE: We have REMOVED chromium-browser from this list.
# We will let Playwright handle its own system dependencies.
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

# Install CPU-only torch, then all other requirements.
# THEN, run 'playwright install-deps' to install all correct
# system-level libraries for the browser.
# FINALLY, run 'playwright install chromium' to download the
# browser binary itself.
# In Dockerfile
RUN python -m pip install --upgrade pip && \
    pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copy application code
COPY . /app

# Expose port
EXPOSE 7860

# Run FastAPI with uvicorn
CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]