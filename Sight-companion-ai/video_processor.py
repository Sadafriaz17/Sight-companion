import cv2
import threading
import numpy as np
from detector import ObjectDetector
from depth import DepthEstimator
from ocr import TextReader
from navigation import NavigationEngine
from speech import SpeechEngine
from utils import annotate_frame

# Run depth estimation every N frames to save compute (reuse cached map in between)
DEPTH_EVERY = 3

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
        self._latest_frame = None          # most recent raw frame for AI to process
        self._latest_annotated = None      # latest annotated frame for display
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
            # Grab the latest frame safely
            with self._lock:
                frame = self._latest_frame

            if frame is None:
                continue  # No frame yet, spin

            depth_frame_count += 1
            ocr_frame_count += 1

            # --- Object Detection (every frame) ---
            detections = self.detector.detect(frame)

            # --- Depth Estimation (every DEPTH_EVERY frames, cached otherwise) ---
            if cached_depth is None or depth_frame_count % DEPTH_EVERY == 0:
                cached_depth = self.depth_estimator.estimate(frame)

            # --- OCR (every frame_skip frames) ---
            ocr_results = []
            if self.ocr_reader and (ocr_frame_count % frame_skip == 0):
                try:
                    ocr_results = self.ocr_reader.read_text(frame)
                except Exception:
                    pass

            # --- Navigation ---
            instructions = self.nav_engine.evaluate(detections, cached_depth, ocr_results, width)
            if instructions:
                self.speech.speak(instructions[0])

            # --- Annotate & push result for display ---
            annotated = annotate_frame(frame, detections, ocr_results, instructions)
            with self._lock:
                self._latest_annotated = annotated
                self._ai_detections = detections
                self._ai_ocr = ocr_results
                self._ai_instructions = instructions

    def process_video(self, source_path=0, output_path="output.mp4", frame_skip=5):
        # Use DirectShow backend for integer indices (webcam / DroidCam virtual driver).
        # For URLs (IP Webcam RTSP/HTTP) use the default backend.
        if isinstance(source_path, int):
            cap = cv2.VideoCapture(source_path, cv2.CAP_MSMF)
        else:
            cap = cv2.VideoCapture(source_path)
        if not cap.isOpened():
            print(f"Error: Could not open video source '{source_path}'.")
            return

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30

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

        print("Processing video frames...")
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1

            # Push latest raw frame to AI thread
            with self._lock:
                self._latest_frame = frame.copy()
                annotated = self._latest_annotated

            # Display: use latest annotated result (or loading screen initially)
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
