
# ============================================================================
# Sight Companion — Production Dockerfile
# Flask backend + AI pipeline for Render.com deployment
# ============================================================================

FROM python:3.11-slim

# ============================================================================
# 1. SYSTEM DEPENDENCIES
# ============================================================================

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    wget \
    espeak-ng \
    && rm -rf /var/lib/apt/lists/*

# ============================================================================
# 2. PYTHON DEPENDENCIES
# ============================================================================

WORKDIR /app

COPY requirements-prod.txt .

# Install compatible CPU-only PyTorch
# PyTorch 2.6.0 is required by the installed Transformers version.
RUN pip install --no-cache-dir \
    torch==2.6.0 \
    torchvision==0.21.0 \
    --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies.
# requirements-prod.txt must contain numpy==1.26.4
# and must not install another PyTorch version.
RUN pip install --no-cache-dir -r requirements-prod.txt

# ============================================================================
# 3. APPLICATION CODE
# ============================================================================

COPY Backend/ ./Backend/
COPY Sight-companion-ai/ ./Sight-companion-ai/

# ============================================================================
# 4. YOLO MODEL WEIGHTS
# ============================================================================

# Use the model already present in the repository.
# Download it if it is missing. Build fails if download fails.

RUN test -f Sight-companion-ai/yolov8n.pt || \
    wget -q -O Sight-companion-ai/yolov8n.pt \
    "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.pt"

# ============================================================================
# 5. AI MODEL CACHE DIRECTORIES
# ============================================================================

RUN mkdir -p /app/.cache/hf /app/.cache/easyocr

# ============================================================================
# 6. ENVIRONMENT VARIABLES
# ============================================================================

ENV TRANSFORMERS_CACHE=/app/.cache/hf
ENV HF_HOME=/app/.cache/hf
ENV EASYOCR_MODULE_PATH=/app/.cache/easyocr
ENV PYTHONUNBUFFERED=1
ENV FLASK_DEBUG=0

# ============================================================================
# 7. START BACKEND
# ============================================================================

WORKDIR /app/Backend

EXPOSE 10000

CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]
