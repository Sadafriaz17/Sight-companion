# Sight Companion AI Evaluation

This directory contains **reproducible, isolated** evaluation scripts for the existing AI components in `Sight-companion-ai/` (no retraining, no production behavior changes). Scripts reuse `detector.py`, `depth.py`, `ocr.py`, `config.py`, and pipeline logic.

## Scripts
- `evaluate_detector.py` — YOLOv8 (Ultralytics) latency/FPS; runs Ultralytics `val` **only** if a labeled dataset + `data.yaml` is provided.
- `evaluate_depth.py` — Depth Anything Small latency/output inspection; computes metric depth errors **only** if compatible ground-truth depth data is provided.
- `evaluate_ocr.py` — EasyOCR latency/confidence and a reproduced 4-word synthetic micro-test (preliminary functional check, **not** real-world accuracy); computes CER/WER/exact-match **only** if reference transcripts exist.
- `evaluate_end_to_end.py` — Pipeline (detect→depth→OCR→navigation) latency/FPS and psutil CPU/RAM sampling on available frames.

## Run (from project root, using existing venv)
```powershell
cd D:\Sight_Companion
$env:PYTHONPATH = "D:\Sight_Companion\Sight-companion-ai"
.\venv\Scripts\python.exe Sight-companion-ai\evaluation\evaluate_detector.py
.\venv\Scripts\python.exe Sight-companion-ai\evaluation\evaluate_depth.py
.\venv\Scripts\python.exe Sight-companion-ai\evaluation\evaluate_ocr.py
.\venv\Scripts\python.exe Sight-companion-ai\evaluation\evaluate_end_to_end.py
```

## Dataset templates (ground truth required for accuracy metrics)
- **Detection** `dataset/detection/`: `images/`, `labels/` (YOLO .txt), and `data.yaml` (Ultralytics format). Without these, mAP/precision/recall/F1/PR/confusion matrix are **N/A**.
- **Depth** `dataset/depth/`: `images/`, `ground_truth/` — provide aligned metric depth maps (e.g. `.npy`, meters, same H×W/mask) or a manifest of measured distances for threshold calibration. Current model output is **relative, per-frame min-max normalized to 0–255** (not metric).
- **OCR** `dataset/ocr/`: `images/`, `transcripts/` — per-image `.txt` (same stem) or `transcripts/manifest.csv` with `image,reference,category` (e.g. clean/blur/low_light/tilted/distant).

## Outputs
- `results/*.csv`, `results/*.json`, `evaluation_summary.json`
- `plots/*.png` (latency charts, sample depth map when generated)

## Integrity
Scripts do **not** invent annotations, treat confidence as accuracy, treat successful execution as correctness, or use model predictions as ground truth. Metrics that cannot be legitimately computed are reported as `N/A` / pending with reasons.
