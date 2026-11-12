# ============================================================================
# Sight Companion — Production Dockerfile
# Deploys the Flask backend + AI pipeline to Render.com
#
# NOTE: The live camera feature (MJPEG stream, real-time YOLO inference on
# live frames) requires a physical webcam connected to the server machine.
# Cloud VMs have no camera hardware. All other features (Supabase auth,
# history, Ask Lumi chat, OCR history) work correctly after deployment.
# ============================================================================

FROM python:3.11-slim

# ---------------------------------------------------------------------------
# System dependencies
# ---------------------------------------------------------------------------
# libglib2.0-0  — OpenCV threading / GLib
# libgl1        — OpenCV needs libGL even in headless mode
# libgomp1      — EasyOCR OpenMP parallel inference
# wget          — download YOLOv8 weights during build
# espeak-ng     — optional Linux TTS (silent no-op if unused on cloud)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgl1 \
        libgomp1 \
        wget \
        espeak-ng \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Python dependencies
# ---------------------------------------------------------------------------
WORKDIR /app

COPY requirements-prod.txt .

# 1. Install PyTorch CPU-only wheel first (avoids pulling the 2 GB CUDA wheel
#    that pip would choose by default on Linux).
RUN pip install --no-cache-dir \
        torch==2.1.0 \
        torchvision==0.16.0 \
        --index-url https://download.pytorch.org/whl/cpu

# 2. Install remaining deps (requirements-prod.txt excludes torch/torchvision
#    to avoid re-downloading them).
RUN pip install --no-cache-dir -r requirements-prod.txt

# ---------------------------------------------------------------------------
# Application code
# ---------------------------------------------------------------------------
COPY Backend/     ./Backend/
COPY Sight-companion-ai/ ./Sight-companion-ai/

# ---------------------------------------------------------------------------
# YOLOv8s model weights (21.5 MB)
# If yolov8s.pt is committed in git it will already be in
# Sight-companion-ai/ from the COPY above. The wget only runs as a
# fallback for repos that keep the .pt in .gitignore.
# ---------------------------------------------------------------------------
RUN [ -f Sight-companion-ai/yolov8s.pt ] || \
    wget -q -O Sight-companion-ai/yolov8s.pt \
        "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8s.pt" \
    || echo "WARNING: YOLOv8s download failed — camera features will be unavailable"

# ---------------------------------------------------------------------------
# Cache directories for HuggingFace + EasyOCR models
# Mount a Render Persistent Disk at /app/.cache to avoid re-downloading
# on every deploy. Without the disk the ~800 MB model files re-download
# on every cold start.
# ---------------------------------------------------------------------------
RUN mkdir -p /app/.cache/hf /app/.cache/easyocr

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
ENV TRANSFORMERS_CACHE=/app/.cache/hf
ENV HF_HOME=/app/.cache/hf
ENV EASYOCR_MODULE_PATH=/app/.cache/easyocr
ENV PYTHONUNBUFFERED=1
ENV FLASK_DEBUG=0

# ---------------------------------------------------------------------------
# Start
# Working directory is /app/Backend so relative imports in app.py resolve.
# ---------------------------------------------------------------------------
WORKDIR /app/Backend

EXPOSE 10000

CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]
