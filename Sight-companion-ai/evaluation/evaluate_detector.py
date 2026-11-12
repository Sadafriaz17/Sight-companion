"""Object detection evaluation for Sight Companion (YOLOv8 / Ultralytics).
- Reuses existing detector implementation and pretrained weights (no retraining).
- Computes latency/FPS and functional smoke results on available images.
- Computes Precision/Recall/F1/mAP and plots ONLY when a labeled dataset is present.
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
import numpy as np
import cv2

from eval_common import AI_DIR, EVAL_DIR, DATASET_DIR, RESULTS_DIR, PLOTS_DIR, ensure_dirs, environment_record, write_csv, write_json, time_call

def _load_detector():
    # reuse existing implementation
    sys.path.insert(0, str(AI_DIR))
    from detector import ObjectDetector
    import config
    weights = AI_DIR / "yolov8s.pt"
    model_path = str(weights) if weights.exists() else config.YOLO_MODEL_PATH
    det = ObjectDetector(model_path=model_path)
    return det, {"model": "YOLOv8s (Ultralytics)", "weights": model_path, "conf_thresh_config": config.YOLO_CONF_THRESH, "classes": 80}

def _find_images():
    # prefer dataset images, else fallback to sample image for latency/smoke (NOT accuracy GT)
    d = DATASET_DIR / "detection" / "images"
    imgs = sorted([p for p in d.glob("*") if p.suffix.lower() in {".jpg",".jpeg",".png",".bmp",".webp"}])
    source = "custom_dataset"
    if not imgs:
        fallback = Path(r"D:\Sight_Companion\venv\Lib\site-packages\matplotlib\mpl-data\sample_data\grace_hopper.jpg")
        if fallback.exists():
            imgs = [fallback]
            source = "illustrative_sample_no_gt"
    return imgs, source

def _has_yolo_labels(label_dir: Path, images):
    if not label_dir.exists():
        return False
    # YOLO txt labels matching image stems
    for im in images:
        if (label_dir / f"{im.stem}.txt").exists():
            return True
    return False

def run(args):
    ensure_dirs()
    det, meta = _load_detector()
    images, img_source = _find_images()
    env = environment_record()
    env["component_config"] = meta

    rows = []
    per_image_times = []
    total_dets = 0
    for im_path in images:
        img = cv2.imread(str(im_path))
        if img is None:
            rows.append({"image": im_path.name, "status": "read_error"})
            continue
        out, times, avg = time_call(det.detect, img, repeats=args.repeats, warmup=args.warmup)
        per_image_times.extend(times)
        n = len(out) if out else 0
        total_dets += n
        rows.append({
            "image": im_path.name,
            "source": img_source,
            "detections": n,
            "avg_inference_s": round(avg, 6) if avg else None,
            "fps": round(1.0/avg, 3) if avg and avg > 0 else None,
            "top_labels": ";".join([f"{d['name']}:{d['confidence']:.3f}" for d in (out or [])[:5]]),
            "status": "ok"
        })

    avg_s = (sum(per_image_times)/len(per_image_times)) if per_image_times else None
    perf = {
        "images_evaluated": len([r for r in rows if r.get("status")=="ok"]),
        "image_source": img_source,
        "total_detections": total_dets,
        "avg_inference_s_per_image": round(avg_s, 6) if avg_s else None,
        "fps": round(1.0/avg_s, 3) if avg_s and avg_s > 0 else None,
        "note": "Latency measured by wall-clock around detector.detect() on available images; NOT model accuracy." if img_source != "custom_dataset" else "Latency measured on custom dataset images."
    }

    # Ground-truth based metrics
    label_dir = DATASET_DIR / "detection" / "labels"
    data_yaml = DATASET_DIR / "detection" / "data.yaml"
    gt_metrics = {
        "status": "pending_missing_ground_truth",
        "reason": "No labeled detection dataset/annotations found in evaluation/dataset/detection (images+labels/data.yaml). mAP/precision/recall/F1/confusion matrix/PR curves require valid ground truth and cannot be fabricated.",
        "precision": "N/A", "recall": "N/A", "f1": "N/A", "mAP50": "N/A", "mAP50_95": "N/A",
        "per_class": "N/A", "confusion_matrix": "not_generated", "pr_curve": "not_generated",
    }
    # Try Ultralytics validation only if a proper dataset config exists
    if data_yaml.exists() and _has_yolo_labels(label_dir, images):
        try:
            from ultralytics import YOLO
            model = YOLO(str(AI_DIR / "yolov8s.pt"))
            res = model.val(data=str(data_yaml), plots=True, save_json=False, verbose=False)
            # Ultralytics metrics object (best-effort extraction)
            box = getattr(res, "box", None)
            mp = getattr(box, "mp", None)  # mean precision
            mr = getattr(box, "mr", None)  # mean recall
            map50 = getattr(box, "map50", None)
            map5095 = getattr(box, "map", None)
            f1 = None
            if mp is not None and mr is not None and (mp + mr) > 0:
                f1 = 2 * mp * mr / (mp + mr)
            gt_metrics = {
                "status": "evaluated",
                "precision": float(mp) if mp is not None else "N/A",
                "recall": float(mr) if mr is not None else "N/A",
                "f1": float(f1) if f1 is not None else "N/A",
                "mAP50": float(map50) if map50 is not None else "N/A",
                "mAP50_95": float(map5095) if map5095 is not None else "N/A",
                "per_class": "see_ultralytics_val_output" if hasattr(res, "results_dict") else "N/A",
                "confusion_matrix": "generated_by_ultralytics_if_available",
                "pr_curve": "generated_by_ultralytics_if_available",
                "results_dict": getattr(res, "results_dict", {}),
                "save_dir": str(getattr(res, "save_dir", "")),
                "note": "Computed by Ultralytics val() on provided labeled dataset using existing pretrained weights (no retraining)."
            }
        except Exception as e:
            gt_metrics = {"status": "error_during_validation", "error": str(e), "precision": "N/A", "recall": "N/A", "f1": "N/A", "mAP50": "N/A", "mAP50_95": "N/A"}

    # simple perf plot if we have times
    plot_path = None
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        if per_image_times:
            plt.figure(figsize=(6,4))
            plt.bar(range(len(per_image_times)), per_image_times)
            plt.xlabel('Inference run index')
            plt.ylabel('Seconds')
            plt.title('YOLO inference latency per run (measured)')
            plot_path = PLOTS_DIR / 'detection_latency.png'
            plt.tight_layout(); plt.savefig(plot_path, dpi=150); plt.close()
    except Exception:
        plot_path = None

    summary = {"environment": env, "performance": perf, "ground_truth_metrics": gt_metrics, "per_image": rows, "plots": {"detection_latency": str(plot_path) if plot_path else None}}
    write_csv(RESULTS_DIR / 'detection_results.csv', rows)
    write_json(RESULTS_DIR / 'detection_results.json', summary)
    print(json.dumps({"component":"detector","performance":perf,"ground_truth_metrics":{k:v for k,v in gt_metrics.items() if k!='results_dict'}}, indent=2))
    return summary

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--repeats', type=int, default=3)
    ap.add_argument('--warmup', type=int, default=1)
    args = ap.parse_args()
    run(args)
