import torch

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Model Paths & Setup
YOLO_MODEL_PATH = "yolov8s.pt"
DEPTH_MODEL_NAME = "LiheYoung/depth-anything-small-hf"

# Detection & OCR Thresholds
YOLO_CONF_THRESH = 0.25
OCR_CONF_THRESH = 0.45

# Depth Map Levels (0-255 scale)
VERY_CLOSE_THRESH = 179
CLOSE_THRESH = 115

# Time threshold (in seconds) to prevent redundant speech spam
COOLDOWN_SECONDS = 3.0

# ---------------------------------------------------------------------------
# Camera Source
# ---------------------------------------------------------------------------
# Use "auto" to prefer a phone webcam app when present, otherwise the default
# system camera. Set to 0 for the built-in webcam, 1+ for another index, or a
# URL/RTSP string for an IP camera stream.
#
# Examples:
#   CAMERA_SOURCE = "auto"
#   CAMERA_SOURCE = 0
#   CAMERA_SOURCE = 1
#   CAMERA_SOURCE = "http://192.168.1.X:8080/video"
#
CAMERA_SOURCE = "auto"
