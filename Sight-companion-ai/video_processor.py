import cv2
import threading
import subprocess
import numpy as np
from detector import ObjectDetector
from depth import DepthEstimator
from ocr import TextReader
from navigation import NavigationEngine
from speech import SpeechEngine
from utils import annotate_frame

# Run depth estimation every N frames to save compute (reuse cached map in between)
DEPTH_EVERY = 3

# Phone webcam app device name keywords (case-insensitive)
PHONE_CAM_KEYWORDS = ["droidcam", "ivcam", "epoccam", "iriun", "ndis cam", "reincubate"]


def _is_phone_cam_installed() -> bool:
    """Check Windows device list for known phone webcam virtual drivers."""
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Get-PnpDevice -Class Camera | Select-Object -ExpandProperty FriendlyName"],
            capture_output=True, text=True, timeout=6
        )
        names = result.stdout.lower()
        return any(kw in names for kw in PHONE_CAM_KEYWORDS)
    except Exception:
        return False


def auto_detect_camera() -> tuple:
    """
    Automatically detect camera source.

    Priority:
      1. Phone webcam (DroidCam / iVCam / etc.) — tries indices 0-4
      2. Laptop/PC built-in webcam (index 0) as fallback

    Returns (source_index, backend) ready for cv2.VideoCapture().
    """
    backends = [
        ("DSHOW", cv2.CAP_DSHOW),
        ("MSMF",  cv2.CAP_MSMF),
    ]

    phone_installed = _is_phone_cam_installed()

    if phone_installed:
        print("📱 Phone webcam app detected — scanning for its camera index...")

        # Collect ALL working cameras with their resolutions
        found = []   # list of (idx, backend_flag, backend_name, width, height)
        for b_name, b_flag in backends:
            for idx in range(5):
                cap = cv2.VideoCapture(idx, b_flag)
                if cap.isOpened():
                    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    cap.release()
                    # Avoid duplicate entries for same (idx, w, h)
                    if not any(f[0] == idx and f[2] == w and f[3] == h for f in found):
                        found.append((idx, b_flag, b_name, w, h))
                else:
                    cap.release()

        if len(found) > 1:
            # More than one camera — pick the one that is NOT the first DSHOW index 0
            # (laptop cam is almost always DSHOW index 0)
            laptop_entry = next(
                (f for f in found if f[0] == 0 and f[2] == "DSHOW"), None
            )
            phone_entry = next(
                (f for f in found if f != laptop_entry), None
            )
            if phone_entry:
                idx, b_flag, b_name, w, h = phone_entry
                print(f"  ✅ Phone cam found: [{b_name}] index {idx} ({w}x{h})")
                return idx, b_flag

        elif len(found) == 1:
            # Only one camera — it IS the phone (no separate laptop cam detected)
            idx, b_flag, b_name, w, h = found[0]
            print(f"  ✅ Phone cam is the only camera: [{b_name}] index {idx} ({w}x{h})")
            return idx, b_flag

        print("  ⚠️  Phone app detected but camera index not found. Falling back to laptop cam.")

    else:
        print("💻 No phone webcam app detected — using laptop webcam.")

    # Default fallback: laptop/PC webcam
    return 0, cv2.CAP_DSHOW


class PipelineProcessor:
    def __init__(self, run_ocr=True):
        print("Initializing AI Pipeline Components...")
        self.detector = ObjectDetector()
        self.depth_estimator = DepthEstimator()
        self.ocr_reader = TextReader() if run_ocr else None
        self.nav_engine = NavigationEngine()
        self.speech = SpeechEngine()

        # Shared state between AI thread and display thread
        self._lock = threading.Lock()
        self._latest_frame = None
        self._latest_annotated = None
        self._ai_instructions = []
        self._ai_detections = []
        self._ai_ocr = []
        self._stop_event = threading.Event()

    def _ai_worker(self, width, frame_skip):
        """Background thread: runs YOLO, depth, OCR, navigation continuously."""
        cached_depth = None
        depth_frame_count = 0
        ocr_frame_count = 0

        while not self._stop_event.is_set():
            with self._lock:
                frame = self._latest_frame

            if frame is None:
                continue

            depth_frame_count += 1
            ocr_frame_count += 1

            detections = self.detector.detect(frame)

            if cached_depth is None or depth_frame_count % DEPTH_EVERY == 0:
                cached_depth = self.depth_estimator.estimate(frame)

            ocr_results = []
            if self.ocr_reader and (ocr_frame_count % frame_skip == 0):
                try:
                    ocr_results = self.ocr_reader.read_text(frame)
                except Exception:
                    pass

            instructions = self.nav_engine.evaluate(detections, cached_depth, ocr_results, width)
            if instructions:
                self.speech.speak(instructions[0])

            annotated = annotate_frame(frame, detections, ocr_results, instructions)
            with self._lock:
                self._latest_annotated = annotated
                self._ai_detections = detections
                self._ai_ocr = ocr_results
                self._ai_instructions = instructions

    def process_video(self, source_path="auto", output_path="output.mp4", frame_skip=5):
        # ── Camera selection ──────────────────────────────────────────────────
        if source_path == "auto":
            cam_index, cam_backend = auto_detect_camera()
            cap = cv2.VideoCapture(cam_index, cam_backend)
        elif isinstance(source_path, int):
            # Explicit integer index — try DSHOW first, fallback to MSMF
            cap = cv2.VideoCapture(source_path, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(source_path, cv2.CAP_MSMF)
        else:
            # String path / URL (e.g., RTSP stream from IP Webcam)
            cap = cv2.VideoCapture(source_path)

        if not cap.isOpened():
            print(f"Error: Could not open video source '{source_path}'.")
            return

        width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps    = int(cap.get(cv2.CAP_PROP_FPS)) or 30
        print(f"Camera opened: {width}x{height} @ {fps}fps")

        writer = None
        if output_path:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        # Start AI background thread
        ai_thread = threading.Thread(
            target=self._ai_worker,
            args=(width, frame_skip),
            daemon=True
        )
        ai_thread.start()

        frame_count = 0
        blank = np.zeros((height, width, 3), dtype=np.uint8)
        cv2.putText(blank, "Loading AI models...", (30, height // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)

        print("Processing video frames... (press Q in window to quit)")
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1

            with self._lock:
                self._latest_frame = frame.copy()
                annotated = self._latest_annotated

            display = annotated if annotated is not None else blank
            cv2.imshow("AI Assistive Vision", display)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

            if writer and annotated is not None:
                writer.write(annotated)

            if frame_count % 30 == 0:
                print(f"Captured {frame_count} frames...")

        # Cleanup
        self._stop_event.set()
        cap.release()
        if writer:
            writer.release()
        cv2.destroyAllWindows()
        self.speech.shutdown()
        print(f"Processing finished! Saved output to: {output_path}")
