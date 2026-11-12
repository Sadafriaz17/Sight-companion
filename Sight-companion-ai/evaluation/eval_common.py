"""Common helpers for Sight Companion evaluation scripts."""
from __future__ import annotations
import csv, json, os, platform, sys, time, importlib, traceback
from pathlib import Path
from datetime import datetime, timezone

AI_DIR = Path(__file__).resolve().parents[1]
ROOT = AI_DIR.parent
EVAL_DIR = Path(__file__).resolve().parent
RESULTS_DIR = EVAL_DIR / "results"
PLOTS_DIR = EVAL_DIR / "plots"
DATASET_DIR = EVAL_DIR / "dataset"

for p in (AI_DIR, ROOT):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def ensure_dirs():
    for d in [RESULTS_DIR, PLOTS_DIR, DATASET_DIR / "detection" / "images", DATASET_DIR / "detection" / "labels",
              DATASET_DIR / "depth" / "images", DATASET_DIR / "depth" / "ground_truth",
              DATASET_DIR / "ocr" / "images", DATASET_DIR / "ocr" / "transcripts"]:
        d.mkdir(parents=True, exist_ok=True)

def pkg_version(name):
    try:
        m = importlib.import_module(name)
        return getattr(m, "__version__", "unknown")
    except Exception:
        return "not-installed"

def environment_record():
    import cv2, numpy, torch
    rec = {
        "timestamp_utc": now_iso(),
        "python": platform.python_version(),
        "platform": platform.platform(),
        "processor": platform.processor(),
        "machine": platform.machine(),
        "packages": {
            "opencv-python": getattr(cv2, "__version__", "unknown"),
            "numpy": getattr(numpy, "__version__", "unknown"),
            "torch": getattr(torch, "__version__", "unknown"),
            "torch_cuda_available": bool(torch.cuda.is_available()),
            "torch_device": "cuda" if torch.cuda.is_available() else "cpu",
            "ultralytics": pkg_version("ultralytics"),
            "easyocr": pkg_version("easyocr"),
            "transformers": pkg_version("transformers"),
            "matplotlib": pkg_version("matplotlib"),
            "psutil": pkg_version("psutil"),
        },
        "ai_dir": str(AI_DIR),
    }
    try:
        import psutil
        vm = psutil.virtual_memory()
        rec["system"] = {
            "cpu_count_logical": psutil.cpu_count(logical=True),
            "cpu_count_physical": psutil.cpu_count(logical=False),
            "ram_total_gb": round(vm.total / (1024**3), 2),
        }
    except Exception:
        rec["system"] = {}
    return rec

def write_csv(path, rows, fieldnames=None):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if fieldnames is None:
        if rows:
            # union of keys preserving first-seen order
            keys = []
            for r in rows:
                for k in r.keys():
                    if k not in keys:
                        keys.append(k)
            fieldnames = keys
        else:
            fieldnames = ["note"]
            rows = [{"note": "no data"}]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})

def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def time_call(fn, *args, repeats=1, warmup=0, **kwargs):
    for _ in range(warmup):
        fn(*args, **kwargs)
    times = []
    out = None
    for _ in range(repeats):
        t0 = time.perf_counter()
        out = fn(*args, **kwargs)
        t1 = time.perf_counter()
        times.append(t1 - t0)
    avg = sum(times) / len(times) if times else None
    return out, times, avg

def safe_run(name, fn):
    try:
        return fn()
    except Exception as e:
        return {"status": "error", "component": name, "error": str(e), "traceback": traceback.format_exc()}
