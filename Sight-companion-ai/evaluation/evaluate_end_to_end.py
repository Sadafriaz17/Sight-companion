"""End-to-end/performance evaluation for Sight Companion AI pipeline.
- Reuses existing model classes and NavigationEngine (same components as pipeline/backend).
- Measures per-component and total latency/FPS on available frames, plus CPU/RAM/process stats via psutil.
- Camera-to-detection / detection-to-voice delays require live camera+audio runtime; reported as pending/not measured if unavailable.
- No end-to-end accuracy claimed without ground-truth annotations.
"""
from __future__ import annotations
import argparse, json, sys, threading, time
from pathlib import Path
import numpy as np
import cv2

from eval_common import AI_DIR, DATASET_DIR, RESULTS_DIR, PLOTS_DIR, ensure_dirs, environment_record, write_csv, write_json, time_call

def _find_images(n=10):
    # gather some frames: custom detection images else sample
    d = DATASET_DIR / "detection" / "images"
    imgs = sorted([p for p in d.glob("*") if p.suffix.lower() in {".jpg",".jpeg",".png",".bmp",".webp"}])
    source = "custom_dataset"
    if not imgs:
        sample = Path(r"D:\Sight_Companion\venv\Lib\site-packages\matplotlib\mpl-data\sample_data\grace_hopper.jpg")
        if sample.exists():
            imgs = [sample]; source = "illustrative_sample_no_gt"
    # duplicate sample to simulate short sequence for pipeline timing if only one
    if len(imgs) == 1 and n>1:
        imgs = imgs * n
    return imgs[:n], source

def run(args):
    ensure_dirs()
    sys.path.insert(0, str(AI_DIR))
    import config
    from detector import ObjectDetector
    from depth import DepthEstimator, DEPTH_INFER_SIZE
    from ocr import TextReader
    from navigation import NavigationEngine
    try:
        import psutil
        proc = psutil.Process()
    except Exception:
        psutil = None; proc = None

    env = environment_record()
    images, img_source = _find_images(args.frames)
    frames = []
    for p in images:
        im = cv2.imread(str(p))
        if im is not None:
            frames.append((p.name, im))
    if not frames:
        summary = {"status":"no_frames","reason":"No readable images available."}
        write_json(RESULTS_DIR/'end_to_end_results.json', summary); return summary

    # Load components (timed) - mirrors backend/pipeline usage
    load_times = {}
    t0=time.perf_counter(); detector = ObjectDetector(str(AI_DIR/'yolov8s.pt')); load_times['detector_s']=time.perf_counter()-t0
    t0=time.perf_counter(); depth_est = DepthEstimator(config.DEPTH_MODEL_NAME); load_times['depth_s']=time.perf_counter()-t0
    t0=time.perf_counter(); ocr_reader = TextReader(['en']); load_times['ocr_s']=time.perf_counter()-t0
    nav = NavigationEngine()

    per_frame = []
    det_times=[]; depth_times=[]; ocr_times=[]; nav_times=[]; total_times=[]
    cpu_samples=[]; rss_samples=[]
    failures=0; empty_outputs=0
    ocr_every = args.ocr_every
    for i,(name,frame) in enumerate(frames):
        try:
            if psutil:
                cpu_samples.append(psutil.cpu_percent(interval=None))
                rss_samples.append(proc.memory_info().rss/(1024*1024))
            w = frame.shape[1]
            t_total0=time.perf_counter()
            t=time.perf_counter(); dets = detector.detect(frame); det_times.append(time.perf_counter()-t)
            t=time.perf_counter(); dm = depth_est.estimate(frame); depth_times.append(time.perf_counter()-t)
            ocr_res=[]
            if i % ocr_every == 0:
                t=time.perf_counter(); ocr_res = ocr_reader.read_text(frame); ocr_times.append(time.perf_counter()-t)
            t=time.perf_counter(); instr = nav.evaluate(dets, dm, ocr_res, w); nav_times.append(time.perf_counter()-t)
            total = time.perf_counter()-t_total0; total_times.append(total)
            if (not dets) and (not ocr_res) and (not instr):
                empty_outputs += 1
            per_frame.append({"frame": name, "index": i, "detections": len(dets), "ocr_items": len(ocr_res), "instructions": len(instr), "total_s": round(total,6), "status":"ok"})
        except Exception as e:
            failures += 1
            per_frame.append({"frame": name, "index": i, "status": "error", "error": str(e)})

    def stats(xs):
        if not xs: return {"avg": None, "p50": None, "p95": None}
        arr = sorted(xs)
        p50 = arr[len(arr)//2]; p95 = arr[max(0,int(len(arr)*0.95)-1)]
        return {"avg": sum(xs)/len(xs), "p50": p50, "p95": p95}

    det_s=stats(det_times); depth_s=stats(depth_times); ocr_s=stats(ocr_times); tot_s=stats(total_times)
    perf = {
        "frames_evaluated": len([r for r in per_frame if r.get('status')=='ok']),
        "frame_source": img_source,
        "note": "Pipeline timing on static image frames using existing components; camera capture I/O and real-time video decode not included except model pipeline stages.",
        "component_latency_s": {
            "detector_avg": det_s['avg'], "depth_avg": depth_s['avg'], "ocr_avg_on_sampled_frames": ocr_s['avg'], "navigation_avg": stats(nav_times)['avg']
        },
        "total_processing_latency_s_avg": tot_s['avg'],
        "fps_avg_pipeline": (1.0/tot_s['avg']) if tot_s['avg'] and tot_s['avg']>0 else None,
        "load_times_s": load_times,
        "ocr_run_every_n_frames": ocr_every,
    }
    resources = {
        "psutil_available": bool(psutil),
        "cpu_percent_samples_avg": (sum(cpu_samples)/len(cpu_samples)) if cpu_samples else None,
        "process_rss_mb_avg": (sum(rss_samples)/len(rss_samples)) if rss_samples else None,
        "note": "CPU/RAM sampled in-process around frame processing; not a full-system sustained benchmark. Values depend on host load."
    }
    reliability = {
        "processing_failures": failures,
        "empty_output_frames": empty_outputs,
        "empty_output_note": "Frames with no detections, no OCR items, and no navigation instructions in this run (depends on content/thresholds)."
    }
    realtime = {
        "camera_to_detection_delay": "NOT_MEASURED (requires live camera capture session with timestamps; not available in static/offline evaluation).",
        "detection_to_voice_announcement_delay": "NOT_MEASURED (requires live TTS/audio playback instrumentation; SpeechEngine uses async PowerShell/pyttsx3 calls, not benchmarked here).",
        "end_to_end_accuracy": "N/A (no ground-truth annotations for detection/depth/ocr events in evaluated frames)."
    }
    behavior_notes = {
        "multiple_objects": "Depends on frame content; YOLO returns all detections above conf (config 0.25). Not exhaustively validated without annotated multi-object dataset.",
        "objects_appearing_disappearing": "Pipeline processes frames independently (no persistent tracker IDs); NavigationEngine uses cooldown-based announcement suppression (COOLDOWN_SECONDS).",
        "repeated_object_detections": "NavigationEngine suppresses repeated announcements per (name,zone) within cooldown; observed by code inspection.",
        "poor_lighting_camera_movement_blur_empty_frames": "Not systematically measured (no labeled condition-specific dataset). Model performance expected to degrade; requires collected test media.",
        "model_exceptions": f"Handled per-frame in script; failures recorded = {failures}."
    }

    plot_path = None
    try:
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        labels=['detector','depth','ocr(sampled)','total']
        vals=[perf['component_latency_s']['detector_avg'] or 0, perf['component_latency_s']['depth_avg'] or 0, perf['component_latency_s']['ocr_avg_on_sampled_frames'] or 0, perf['total_processing_latency_s_avg'] or 0]
        plt.figure(figsize=(7,4)); plt.bar(labels, vals); plt.ylabel('Seconds (avg)'); plt.title('End-to-end pipeline latency by stage (measured)')
        plot_path = PLOTS_DIR/'end_to_end_latency.png'; plt.tight_layout(); plt.savefig(plot_path, dpi=150); plt.close()
    except Exception:
        plot_path = None

    summary = {"environment": env, "performance": perf, "resources": resources, "reliability": reliability, "realtime_unmeasured": realtime, "behavior_notes": behavior_notes, "per_frame": per_frame, "plots": {"end_to_end_latency": str(plot_path) if plot_path else None}}
    write_csv(RESULTS_DIR/'end_to_end_results.csv', per_frame)
    write_json(RESULTS_DIR/'end_to_end_results.json', summary)
    print(json.dumps({"component":"end_to_end","performance":perf,"resources":resources,"reliability":reliability}, indent=2, default=str))
    return summary

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--frames', type=int, default=5)
    ap.add_argument('--ocr-every', type=int, default=5)
    args = ap.parse_args(); run(args)
