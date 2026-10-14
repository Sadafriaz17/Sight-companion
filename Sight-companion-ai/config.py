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
# Option A — Laptop/PC built-in webcam (default):
#   CAMERA_SOURCE = 0
#
# Option B — Phone via DroidCam or iVCam (virtual USB/Wi-Fi driver):
#   Install DroidCam (Android) or iVCam (Android/iPhone) on your phone +
#   the matching PC client. The phone appears as a new webcam device.
#   Change the number below to 1 or 2 if 0 is still your laptop camera.
#   CAMERA_SOURCE = 1
#
# Option C — Phone via IP Webcam app (Android, Wi-Fi stream):
#   1. Install "IP Webcam" from Google Play.
#   2. Open the app, tap "Start server" — note the IP address shown.
#   3. Set CAMERA_SOURCE to the RTSP or HTTP URL below:
#      CAMERA_SOURCE = "rtsp://192.168.1.X:8080/h264_ulaw.sdp"   # RTSP (low latency)
#      CAMERA_SOURCE = "http://192.168.1.X:8080/video"            # MJPEG HTTP
#   Replace 192.168.1.X with the IP shown in the app.
#
CAMERA_SOURCE = 1   # DroidCam detected on [MSMF] [MSMF] Index 1 � 640x480
