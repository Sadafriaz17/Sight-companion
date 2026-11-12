"""Depth estimation evaluation for Sight Companion (Depth Anything Small via HF).
- Reuses existing DepthEstimator and config thresholds (no retraining/changes).
- Measures latency/FPS and inspects output representation (relative/normalized 0-255).
- Computes MAE/RMSE/AbsRel/SqRel/LogRMSE/delta metrics ONLY if compatible ground-truth depth data exists.
- Evaluates threshold classification (Very Close/Close/Far) only if labeled distance samples exist.
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
import numpy as np
import cv2

from eval_common import AI_DIR, DATASET_DIR, RESULTS_DIR, PLOTS_DIR, ensure_dirs, environment_record, write_csv, write_json, time_call

def _load_depth():
    sys.path.insert(0, str(AI_DIR))
    from depth import DepthEstimator, DEPTH_INFER_SIZE
    import config
    de = DepthEstimator(model_name=config.DEPTH_MODEL_NAME)
    meta = {
        "model": config.DEPTH_MODEL_NAME,
        "input_infer_size_w_h": list(DEPTH_INFER_SIZE),
        "output_representation": "relative_inverse_depth_normalized_per_frame_to_uint8_0_255",
        "normalization": "per-frame min-max to [0,255] in DepthEstimator.estimate (not metric, not globally calibrated)",
        "very_close_thresh": config.VERY_CLOSE_THRESH,
        "close_thresh": config.CLOSE_THRESH,
        "thresholds_experimentally_validated": False,
        "thresholds_note": "Heuristic config values; no measured-distance calibration/validation dataset found in repo."
    }
    return de, meta

def _find_images():
    d = DATASET_DIR / "depth" / "images"
    imgs = sorted([p for p in d.glob("*") if p.suffix.lower() in {".jpg",".jpeg",".png",".bmp",".webp"}])
    source = "custom_dataset"
    if not imgs:
        fallback = Path(r"D:\Sight_Companion\venv\Lib\site-packages\matplotlib\mpl-data\sample_data\grace_hopper.jpg")
        if fallback.exists():
            imgs = [fallback]
            source = "illustrative_sample_no_gt"
    return imgs, source

def _try_gt_metrics():
    # expect optional pairs: ground_truth/*.npy aligned to images by stem (metric depth in meters) OR a manifest.csv
    gt_dir = DATASET_DIR / "depth" / "ground_truth"
    manifest = gt_dir / "manifest.csv"
    if not gt_dir.exists():
        return None, "No depth ground-truth directory found."
    if not any(gt_dir.iterdir()):
        return None, "Depth ground-truth directory is empty; no compatible metric/annotated depth data available."
    # We do not guess formats/units. Support explicit, compatible .npy metric GT with same HxW.
    return None, "Ground-truth files present but no supported, explicitly compatible metric-depth evaluation protocol/manifest detected. Provide aligned metric depth maps (.npy, meters, same resolution/mask) or labeled distance samples; metrics not computed to avoid invalid comparison."

def run(args):
    ensure_dirs()
    de, meta = _load_depth()
    images, img_source = _find_images()
    env = environment_record(); env["component_config"] = meta

    rows = []
    times_all = []
    frame_means = []
    sample_dm = None
    for im_path in images:
        img = cv2.imread(str(im_path))
        if img is None:
            rows.append({"image": im_path.name, "status": "read_error"})
            continue
        dm, tlist, avg = time_call(de.estimate, img, repeats=args.repeats, warmup=args.warmup)
        times_all.extend(tlist)
        sample_dm = dm if sample_dm is None else sample_dm
        mean_v = float(np.mean(dm)) if dm is not None else None
        if mean_v is not None: frame_means.append(mean_v)
        rows.append({
            "image": im_path.name,
            "source": img_source,
            "shape": str(getattr(dm,'shape',None)),
            "dtype": str(getattr(dm,'dtype',None)),
            "min": int(dm.min()) if dm is not None else None,
            "max": int(dm.max()) if dm is not None else None,
            "mean": round(mean_v,4) if mean_v is not None else None,
            "avg_inference_s": round(avg,6) if avg else None,
            "fps": round(1.0/avg,3) if avg and avg>0 else None,
            "status": "ok"
        })

    avg_s = (sum(times_all)/len(times_all)) if times_all else None
    # frame-to-frame consistency proxy on normalized outputs (if multiple different images/runs exist it's limited)
    consistency = {
        "per_frame_normalization_effect": "Each estimate() min-max normalizes independently to 0-255, so identical real distances can map to different values across frames/scenes; temporal consistency is not guaranteed without calibration/global scaling.",
        "normalized_mean_std_across_evaluated_frames": round(float(np.std(frame_means)),4) if len(frame_means)>1 else None,
        "frames_compared": len(frame_means)
    }

    gt_data, gt_reason = _try_gt_metrics()
    gt_metrics = {
        "status": "pending_missing_or_incompatible_ground_truth",
        "reason": gt_reason or "No compatible ground-truth depth data found.",
        "MAE": "N/A", "RMSE": "N/A", "AbsRel": "N/A", "SqRel": "N/A", "LogRMSE": "N/A",
        "delta1_25": "N/A", "delta1_25_2": "N/A", "delta1_25_3": "N/A",
        "threshold_classification_eval": "N/A (no measured-distance labeled samples)"
    }

    perf = {
        "images_evaluated": len([r for r in rows if r.get("status")=="ok"]),
        "image_source": img_source,
        "avg_inference_s_per_image": round(avg_s,6) if avg_s else None,
        "fps": round(1.0/avg_s,3) if avg_s and avg_s>0 else None,
    }

    plot_path = None
    try:
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        if times_all:
            plt.figure(figsize=(6,4)); plt.bar(range(len(times_all)), times_all)
            plt.xlabel('Inference run index'); plt.ylabel('Seconds'); plt.title('Depth inference latency per run (measured)')
            plot_path = PLOTS_DIR/'depth_latency.png'; plt.tight_layout(); plt.savefig(plot_path, dpi=150); plt.close()
        if sample_dm is not None:
            plt.figure(figsize=(5,4)); plt.imshow(sample_dm, cmap='inferno'); plt.colorbar(label='normalized depth (0-255, relative)')
            plt.title('Sample depth map (relative, normalized)'); p2 = PLOTS_DIR/'depth_sample_map.png'; plt.tight_layout(); plt.savefig(p2, dpi=150); plt.close()
            summary_extra_plot = str(p2)
        else:
            summary_extra_plot = None
    except Exception:
        plot_path = None; summary_extra_plot = None

    summary = {"environment": env, "performance": perf, "representation_and_thresholds": meta, "consistency": consistency, "ground_truth_metrics": gt_metrics, "per_image": rows, "plots": {"depth_latency": str(plot_path) if plot_path else None, "depth_sample_map": summary_extra_plot}}
    write_csv(RESULTS_DIR/'depth_results.csv', rows)
    write_json(RESULTS_DIR/'depth_results.json', summary)
    print(json.dumps({"component":"depth","performance":perf,"ground_truth_metrics":gt_metrics,"representation":meta["output_representation"]}, indent=2))
    return summary

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--repeats', type=int, default=2)
    ap.add_argument('--warmup', type=int, default=1)
    args = ap.parse_args(); run(args)
