"""
app.py — Sight Companion Backend API
=====================================
Bridge between the Sight-companion-ai pipeline and the React frontend.

Architecture
------------
- CameraManager runs a single background thread that:
    1. Reads frames from the physical camera (via OpenCV).
    2. Feeds each frame to the AI pipeline (YOLO, depth, OCR, navigation).
    3. Annotates the frame and stores it as a JPEG-encoded bytes object.
    4. Stores the latest structured detections/OCR results.
- Flask routes expose the annotated frames as MJPEG and the detections as JSON.
- All model initialisation is done once at startup (lazy, on first camera start).
- The browser's camera is NOT used; Python owns the camera.

Start with:
    python app.py                   (from inside Backend/)
    python Backend/app.py           (from the project root)

Requires:
    pip install flask flask-cors    (already done via requirements_backend.txt)
    All AI deps already in Sight-companion-ai/venv/
"""

from __future__ import annotations

import base64
import io
import os
import sys
import threading
import time
import logging
from pathlib import Path
from typing import Optional

import cv2  
import numpy as np

# ---------------------------------------------------------------------------
# Path setup — the AI modules live in Sight-companion-ai/
# ---------------------------------------------------------------------------
# This file is in Backend/. We resolve the ai directory relative to *this* file
# so the server can be started from any working directory.
_BACKEND_DIR = Path(__file__).resolve().parent        # …/Backend
_PROJECT_ROOT = _BACKEND_DIR.parent                    # …/Sight-companion
_AI_DIR = _PROJECT_ROOT / "Sight-companion-ai"        # …/Sight-companion-ai

if str(_AI_DIR) not in sys.path:
    sys.path.insert(0, str(_AI_DIR))

# ---------------------------------------------------------------------------
# Flask application
# ---------------------------------------------------------------------------
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
log = logging.getLogger("sight-companion")
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

# Allow Vite dev server and common localhost variants.
CORS(app, origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
])

# ---------------------------------------------------------------------------
# Lazy AI import helpers (so the server starts fast even if models load slowly)
# ---------------------------------------------------------------------------

_ai_import_lock = threading.Lock()
_ai_imported = False
_ObjectDetector = None
_DepthEstimator = None
_TextReader = None
_NavigationEngine = None
_SpeechEngine = None
_annotate_frame = None
_auto_detect_camera = None
_config = None


def _ensure_ai_imported() -> bool:
    """Import all AI modules from Sight-companion-ai/ exactly once."""
    global _ai_imported, _ObjectDetector, _DepthEstimator, _TextReader
    global _NavigationEngine, _SpeechEngine, _annotate_frame
    global _auto_detect_camera, _config

    if _ai_imported:
        return True

    with _ai_import_lock:
        if _ai_imported:
            return True
        try:
            import config as cfg
            from detector import ObjectDetector
            from depth import DepthEstimator
            from ocr import TextReader
            from navigation import NavigationEngine
            from speech import SpeechEngine
            from utils import annotate_frame
            from video_processor import auto_detect_camera

            _config = cfg
            _ObjectDetector = ObjectDetector
            _DepthEstimator = DepthEstimator
            _TextReader = TextReader
            _NavigationEngine = NavigationEngine
            _SpeechEngine = SpeechEngine
            _annotate_frame = annotate_frame
            _auto_detect_camera = auto_detect_camera
            _ai_imported = True
            log.info("AI modules imported successfully.")
            return True
        except Exception as exc:
            log.error("Failed to import AI modules: %s", exc)
            return False


# ---------------------------------------------------------------------------
# Shared state
# ---------------------------------------------------------------------------

class _State:
    """Thread-safe shared state between the camera worker and Flask routes."""

    def __init__(self):
        self._lock = threading.Lock()

        # Initialisation
        self.ai_ready: bool = False
        self.ai_error: Optional[str] = None

        # Camera
        self.camera_running: bool = False
        self.camera_error: Optional[str] = None
        self.frame_count: int = 0

        # Latest annotated frame as JPEG bytes
        self.latest_jpeg: Optional[bytes] = None

        # Latest structured results
        self.latest_detections: list = []
        self.latest_ocr: list = []
        self.latest_instructions: list = []

        # Speech
        self.speech_enabled: bool = True

        # Stop event for camera thread
        self.stop_event: threading.Event = threading.Event()

    # ------------------------------------------------------------------
    # Thread-safe accessors
    # ------------------------------------------------------------------

    def get_snapshot(self) -> dict:
        with self._lock:
            return {
                "ai_ready": self.ai_ready,
                "ai_error": self.ai_error,
                "camera_running": self.camera_running,
                "camera_error": self.camera_error,
                "frame_count": self.frame_count,
                "speech_enabled": self.speech_enabled,
                "detections_count": len(self.latest_detections),
                "ocr_count": len(self.latest_ocr),
            }

    def update_results(self, jpeg: bytes, detections: list, ocr: list, instructions: list):
        with self._lock:
            self.latest_jpeg = jpeg
            self.latest_detections = detections
            self.latest_ocr = ocr
            self.latest_instructions = instructions
            self.frame_count += 1

    def get_jpeg(self) -> Optional[bytes]:
        with self._lock:
            return self.latest_jpeg

    def get_detections(self) -> list:
        with self._lock:
            return list(self.latest_detections)

    def get_ocr(self) -> list:
        with self._lock:
            return list(self.latest_ocr)

    def get_instructions(self) -> list:
        with self._lock:
            return list(self.latest_instructions)


_state = _State()


# ---------------------------------------------------------------------------
# AI component singletons (initialised once per process lifetime)
# ---------------------------------------------------------------------------

class _AIComponents:
    detector: object = None
    depth_estimator: object = None
    ocr_reader: object = None
    nav_engine: object = None
    speech_engine: object = None
    initialised: bool = False
    error: Optional[str] = None
    _init_lock = threading.Lock()

    @classmethod
    def initialise(cls) -> bool:
        if cls.initialised:
            return True
        if cls.error:
            return False

        with cls._init_lock:
            if cls.initialised or cls.error:
                return cls.initialised

            if not _ensure_ai_imported():
                cls.error = "Could not import AI modules. Check Sight-companion-ai/ path."
                return False

            try:
                log.info("Loading YOLO model...")
                yolo_path = _AI_DIR / "yolov8s.pt"
                if yolo_path.exists():
                    cls.detector = _ObjectDetector(model_path=str(yolo_path))
                else:
                    cls.detector = _ObjectDetector()
                log.info("YOLO model loaded.")
            except Exception as exc:
                cls.error = f"YOLO load failed: {exc}"
                log.error(cls.error)
                return False

            try:
                log.info("Loading depth model (may download on first run)...")
                cls.depth_estimator = _DepthEstimator()
                log.info("Depth model loaded.")
            except Exception as exc:
                log.warning("Depth model failed to load: %s — depth will be skipped.", exc)
                cls.depth_estimator = None

            try:
                log.info("Loading OCR model...")
                cls.ocr_reader = _TextReader()
                log.info("OCR model loaded.")
            except Exception as exc:
                log.warning("OCR model failed to load: %s — OCR will be skipped.", exc)
                cls.ocr_reader = None

            cls.nav_engine = _NavigationEngine()
            cls.speech_engine = _SpeechEngine()
            cls.initialised = True
            log.info("All AI components ready.")
            return True


# ---------------------------------------------------------------------------
# Camera capture + AI inference loop (runs in a dedicated daemon thread)
# ---------------------------------------------------------------------------

DEPTH_EVERY = 3   # reuse cached depth map for N frames to save CPU


def _build_blank_frame(width: int, height: int, msg: str) -> bytes:
    """Return a JPEG-encoded dark frame with a centred status message."""
    blank = np.zeros((height, width, 3), dtype=np.uint8)
    cv2.putText(blank, msg, (20, height // 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 200, 255), 2)
    _, buf = cv2.imencode(".jpg", blank, [cv2.IMWRITE_JPEG_QUALITY, 75])
    return bytes(buf)


def _camera_loop():
    """Background thread: captures frames and runs the AI pipeline."""
    global _state

    log.info("Camera loop starting…")

    # Initialise AI models first (may block for model downloads)
    if not _AIComponents.initialise():
        _state.camera_error = _AIComponents.error or "AI initialisation failed."
        with threading.Lock():
            _state.camera_running = False
        log.error(_state.camera_error)
        return

    _state.ai_ready = True
    _state.ai_error = None

    # Open camera
    try:
        cam_index, cam_backend = _auto_detect_camera()
    except Exception:
        cam_index = getattr(_config, "CAMERA_SOURCE", 0) if _config else 0
        cam_backend = cv2.CAP_DSHOW

    if isinstance(cam_index, str):
        cap = cv2.VideoCapture(cam_index)
    else:
        cap = cv2.VideoCapture(cam_index, cam_backend)
        if not cap.isOpened():
            cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(0, cv2.CAP_MSMF)
        if not cap.isOpened() and cam_index != 0:
            cap = cv2.VideoCapture(cam_index)

    if not cap.isOpened():
        _state.camera_error = "Could not open any camera. Check connection and permissions."
        _state.camera_running = False
        log.error(_state.camera_error)
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    log.info("Camera opened: %dx%d @ index %s", width, height, cam_index)
    _state.camera_error = None

    cached_depth = None
    depth_frame_count = 0
    ocr_frame_count = 0
    ocr_results: list = []
    last_speech_time = 0.0
    COOLDOWN = getattr(_config, "COOLDOWN_SECONDS", 3.0) if _config else 3.0

    loading_jpeg = _build_blank_frame(width, height, "Loading AI models...")
    _state.update_results(loading_jpeg, [], [], [])

    frame_number = 0

    while not _state.stop_event.is_set():
        ret, frame = cap.read()
        if not ret:
            log.warning("Camera read failed — retrying…")
            time.sleep(0.1)
            continue

        frame_number += 1
        depth_frame_count += 1
        ocr_frame_count += 1

        # --- YOLO detection (every frame) ---
        try:
            detections = _AIComponents.detector.detect(frame)
        except Exception as exc:
            log.warning("Detection error: %s", exc)
            detections = []

        # --- Depth estimation (every DEPTH_EVERY frames) ---
        if _AIComponents.depth_estimator is not None:
            if cached_depth is None or depth_frame_count % DEPTH_EVERY == 0:
                try:
                    cached_depth = _AIComponents.depth_estimator.estimate(frame)
                except Exception as exc:
                    log.warning("Depth error: %s", exc)
                    cached_depth = None

        # Build a dummy flat depth map when depth is unavailable
        depth_for_nav = cached_depth if cached_depth is not None else np.zeros(
            (frame.shape[0], frame.shape[1]), dtype=np.uint8)

        # --- OCR (every 15 frames to save CPU) ---
        if _AIComponents.ocr_reader is not None and (ocr_frame_count % 15 == 0):
            try:
                ocr_results = _AIComponents.ocr_reader.read_text(frame)
            except Exception:
                ocr_results = []

        # --- Navigation / instructions ---
        try:
            instructions = _AIComponents.nav_engine.evaluate(
                detections, depth_for_nav, ocr_results, width
            )
        except Exception:
            instructions = []

        # --- Speech (non-blocking, with cooldown) ---
        if _state.speech_enabled and instructions:
            now = time.time()
            if now - last_speech_time >= COOLDOWN:
                try:
                    _AIComponents.speech_engine.speak(instructions[0])
                    last_speech_time = now
                except Exception:
                    pass

        # --- Annotate frame ---
        try:
            annotated = _annotate_frame(frame, detections, ocr_results, instructions)
        except Exception:
            annotated = frame.copy()

        # --- Encode to JPEG ---
        try:
            encode_params = [cv2.IMWRITE_JPEG_QUALITY, 75]
            _, buf = cv2.imencode(".jpg", annotated, encode_params)
            jpeg_bytes = bytes(buf)
        except Exception as exc:
            log.warning("JPEG encode error: %s", exc)
            jpeg_bytes = _state.get_jpeg() or b""

        # --- Store results thread-safely ---
        _state.update_results(jpeg_bytes, detections, ocr_results, instructions)

    # Cleanup
    cap.release()
    _state.camera_running = False
    log.info("Camera loop stopped.")


_camera_thread: Optional[threading.Thread] = None


def _start_camera_thread():
    global _camera_thread
    if _camera_thread and _camera_thread.is_alive():
        return  # already running

    _state.stop_event.clear()
    _state.camera_running = True
    _state.camera_error = None
    _camera_thread = threading.Thread(target=_camera_loop, daemon=True, name="camera-loop")
    _camera_thread.start()


def _stop_camera_thread():
    _state.stop_event.set()
    if _camera_thread:
        _camera_thread.join(timeout=5)
    _state.camera_running = False
    _state.latest_jpeg = None


# ---------------------------------------------------------------------------
# MJPEG stream generator
# ---------------------------------------------------------------------------

def _mjpeg_generator():
    """Yield MJPEG boundary frames for the /api/camera/stream endpoint."""
    BOUNDARY = b"--frame"
    HEADER = b"Content-Type: image/jpeg\r\n\r\n"
    blank = _build_blank_frame(640, 480, "Camera not started. POST /api/camera/start first.")

    while True:
        jpeg = _state.get_jpeg()
        if jpeg is None:
            jpeg = blank

        yield BOUNDARY + b"\r\n" + HEADER + jpeg + b"\r\n"
        time.sleep(0.04)  # ~25 fps cap to avoid overwhelming the browser


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

def _ok(**kwargs):
    return jsonify({"ok": True, **kwargs})


def _err(msg: str, code: int = 400):
    return jsonify({"ok": False, "error": msg}), code


# ---------- health ----------------------------------------------------------

@app.get("/api/health")
def health():
    """Simple liveness probe."""
    return _ok(service="Sight Companion Backend", version="2.0")


# ---------- status ----------------------------------------------------------

@app.get("/api/status")
def status():
    """Full system status."""
    snap = _state.get_snapshot()
    return jsonify({
        "ok": True,
        "ai": {
            "ready": snap["ai_ready"],
            "error": snap["ai_error"],
            "components": {
                "detector": _AIComponents.detector is not None,
                "depth": _AIComponents.depth_estimator is not None,
                "ocr": _AIComponents.ocr_reader is not None,
                "navigation": _AIComponents.nav_engine is not None,
                "speech": _AIComponents.speech_engine is not None,
            } if _AIComponents.initialised else {},
        },
        "camera": {
            "running": snap["camera_running"],
            "error": snap["camera_error"],
            "frames_processed": snap["frame_count"],
        },
        "speech": {
            "enabled": snap["speech_enabled"],
        },
        "pipeline": {
            "detections": snap["detections_count"],
            "ocr_results": snap["ocr_count"],
        },
    })


# ---------- camera ----------------------------------------------------------

@app.post("/api/camera/start")
def camera_start():
    """Start the camera capture + AI inference loop."""
    if _state.camera_running:
        return _ok(message="Camera already running.")
    _start_camera_thread()
    return _ok(message="Camera starting.")


@app.post("/api/camera/stop")
def camera_stop():
    """Stop camera capture and release resources."""
    _stop_camera_thread()
    return _ok(message="Camera stopped.")


@app.get("/api/camera/frame")
def camera_frame():
    """Return the latest annotated frame as a JPEG image."""
    jpeg = _state.get_jpeg()
    if jpeg is None:
        return _err("No frame available. Start the camera first.", 503)
    return Response(jpeg, mimetype="image/jpeg")


@app.get("/api/camera/stream")
def camera_stream():
    """MJPEG stream endpoint — drop into an <img src=...> tag."""
    return Response(
        _mjpeg_generator(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


# ---------- detections ------------------------------------------------------

@app.get("/api/detections")
def get_detections():
    """
    Return the latest structured object detections.

    Each item:
        label      — object class name (str)
        distance   — depth level string ("Very Close" | "Close" | "Far" | "N/A")
        direction  — spatial zone ("on your left" | "ahead" | "on your right")
        level      — UI severity ("danger" | "careful" | "safe")
        confidence — YOLO confidence score (float 0-1)
        box        — [xmin, ymin, xmax, ymax] in pixels
        message    — human-readable summary sentence
    """
    raw = _state.get_detections()
    depth_for_ui = None
    if _AIComponents.initialised and _AIComponents.depth_estimator is not None:
        # We don't have the depth map here; use nav_engine cooldown data
        pass

    results = []
    for det in raw:
        name = det.get("name", "object")
        conf = det.get("confidence", 0.0)
        box = det.get("box", [0, 0, 1, 1])

        # Derive direction from box if nav_engine available
        direction = "ahead"
        if _AIComponents.nav_engine:
            try:
                # Use stored instruction text as direction hint — approximate
                # We compute it again here for the API response
                engine = _AIComponents.nav_engine
                # Access protected method for API response only
                snap_instructions = _state.get_instructions()
                # Fallback direction from box center
                if len(box) == 4:
                    center_x = (box[0] + box[2]) / 2.0
                    # We don't have width here; assume 640 default
                    # The nav_engine result is more accurate but lives in instructions
                    direction = "ahead"  # will be overridden by message below
            except Exception:
                pass

        # Determine distance label from cached instructions / detection proximity
        depth_label = "N/A"
        level = "safe"
        instructions = _state.get_instructions()

        # Match against instruction text for this object
        for instr in instructions:
            lower = instr.lower()
            if name.lower() in lower:
                if "very close" in lower:
                    depth_label = "Very Close"
                    level = "danger"
                elif "close" in lower or "careful" in lower:
                    depth_label = "Close"
                    level = "careful"
                break

        # Build a readable direction from bounding box
        if box and len(box) == 4:
            center_x = (box[0] + box[2]) / 2.0
            # Rough thirds split on assumed 640-wide frame
            if center_x < 213:
                direction = "on your left"
            elif center_x > 427:
                direction = "on your right"
            else:
                direction = "ahead"

        message = f"{name.capitalize()} {direction}."
        if depth_label != "N/A":
            message = f"{name.capitalize()} {direction}. {depth_label}."

        results.append({
            "label": name,
            "confidence": round(conf, 3),
            "box": box,
            "distance": depth_label,
            "direction": direction,
            "level": level,
            "message": message,
        })

    return jsonify(results)


# ---------- OCR -------------------------------------------------------------

@app.get("/api/ocr/results")
def ocr_results():
    """Return the latest OCR-detected text items."""
    raw = _state.get_ocr()
    out = []
    for item in raw:
        out.append({
            "text": item.get("text", ""),
            "confidence": round(item.get("confidence", 0.0), 3),
        })
    return jsonify(out)


@app.post("/api/ocr/read")
def ocr_read():
    """
    Trigger an OCR read on the latest camera frame.
    Returns immediately with results if the camera is running,
    or an error if no frame is available.
    """
    if not _state.camera_running:
        return _err("Camera is not running. Start it first.", 503)

    if not _AIComponents.initialised or _AIComponents.ocr_reader is None:
        return _err("OCR module is not available.", 503)

    jpeg = _state.get_jpeg()
    if jpeg is None:
        return _err("No frame available yet.", 503)

    try:
        # Decode JPEG back to OpenCV frame for OCR
        nparr = np.frombuffer(jpeg, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        ocr_data = _AIComponents.ocr_reader.read_text(frame)
        return jsonify({
            "ok": True,
            "results": [{"text": r["text"], "confidence": round(r["confidence"], 3)} for r in ocr_data],
        })
    except Exception as exc:
        return _err(f"OCR failed: {exc}", 500)


# ---------- speech ----------------------------------------------------------

@app.post("/api/speech/toggle")
def speech_toggle():
    """Enable or disable voice output."""
    _state.speech_enabled = not _state.speech_enabled
    enabled = _state.speech_enabled
    if enabled and _AIComponents.speech_engine:
        try:
            _AIComponents.speech_engine.speak("Voice guidance on.")
        except Exception:
            pass
    return _ok(speech_enabled=enabled)


@app.post("/api/speech/speak")
def speech_speak():
    """Speak an arbitrary message (for testing or UI actions)."""
    data = request.get_json(silent=True) or {}
    text = str(data.get("text", "")).strip()
    if not text:
        return _err("text field is required.")
    if not _AIComponents.initialised or _AIComponents.speech_engine is None:
        return _err("Speech engine not available.", 503)
    try:
        _AIComponents.speech_engine.speak(text)
        return _ok(spoken=text)
    except Exception as exc:
        return _err(f"Speech failed: {exc}", 500)


# ---------- AI pipeline controls -------------------------------------------

@app.post("/api/ai/start")
def ai_start():
    """Alias for /api/camera/start (the AI starts with the camera)."""
    return camera_start()


@app.post("/api/ai/stop")
def ai_stop():
    """Alias for /api/camera/stop."""
    return camera_stop()


# ---------- activity log ---------------------------------------------------

@app.get("/api/activity")
def get_activity():
    """
    Returns recent activity items generated from AI results.
    These are derived from the latest detections and OCR results.
    """
    detections = _state.get_detections()
    ocr = _state.get_ocr()
    instructions = _state.get_instructions()

    items = []
    _id = 1
    now_str = "Just now"

    for instr in instructions[:3]:
        lower = instr.lower()
        if "danger" in lower or "very close" in lower:
            kind = "object"
        elif "sign" in lower:
            kind = "sign"
        else:
            kind = "safe"
        items.append({"id": _id, "type": kind, "title": instr, "time": now_str})
        _id += 1

    for det in detections[:3]:
        items.append({
            "id": _id,
            "type": "object",
            "title": f"{det.get('name','object').capitalize()} detected",
            "time": now_str,
        })
        _id += 1

    for ocr_item in ocr[:2]:
        items.append({
            "id": _id,
            "type": "sign",
            "title": f"Sign: {ocr_item.get('text','')}",
            "time": now_str,
        })
        _id += 1

    if not items:
        items.append({
            "id": 1,
            "type": "safe",
            "title": "No activity yet. Start the camera.",
            "time": now_str,
        })

    return jsonify(items)


# ---------- contact form ---------------------------------------------------

@app.post("/api/contact")
def post_contact():
    """Receives a contact message. Logs it; wire up email or DB when ready."""
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    message = data.get("message", "").strip()
    if not name or not email or not message:
        return _err("All fields are required.")
    log.info("[Contact] %s <%s>: %s", name, email, message[:80])
    return _ok()


# ---------- health root -----------------------------------------------------

@app.get("/")
def root():
    return _ok(service="Sight Companion Backend", docs="/api/health")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    log.info("Sight Companion Backend starting on http://127.0.0.1:%d", port)
    log.info("AI modules directory: %s", _AI_DIR)
    log.info("MJPEG stream: http://127.0.0.1:%d/api/camera/stream", port)
    # use_reloader=False is critical — the camera thread must not be duplicated
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=False, threaded=True)
