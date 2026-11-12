"""OCR evaluation for Sight Companion (EasyOCR).
- Reuses existing TextReader implementation and pretrained models (no retraining).
- Measures latency/FPS and average confidence on available images.
- Computes CER/WER/exact-match/detection success ONLY if reference transcripts (and boxes where applicable) exist.
- Reproduces the existing 4-word synthetic micro-test as a preliminary functional check (NOT real-world accuracy).
"""
from __future__ import annotations
import argparse, json, sys, re
from pathlib import Path
import numpy as np
import cv2

from eval_common import AI_DIR, DATASET_DIR, RESULTS_DIR, PLOTS_DIR, ensure_dirs, environment_record, write_csv, write_json, time_call

def _load_ocr():
    sys.path.insert(0, str(AI_DIR))
    from ocr import TextReader
    import config
    tr = TextReader(lang_list=['en'])
    meta = {
        "library": "EasyOCR",
        "language": ['en'],
        "confidence_threshold": config.OCR_CONF_THRESH,
        "execution": "cuda" if getattr(config, 'DEVICE', 'cpu') == 'cuda' else 'cpu',
        "gpu_flag_passed_to_reader": (getattr(config, 'DEVICE', 'cpu') == 'cuda')
    }
    return tr, meta

def _levenshtein(a, b):
    if a == b: return 0
    if len(a) < len(b): a, b = b, a
    prev = list(range(len(b)+1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            ins = cur[j-1] + 1
            dele = prev[j] + 1
            sub = prev[j-1] + (0 if ca == cb else 1)
            cur.append(min(ins, dele, sub))
        prev = cur
    return prev[-1]

def _normalize(text, mode="standard"):
    # documented normalization: lowercase, collapse whitespace, strip edges; optionally keep basic punctuation out
    t = text.strip().lower()
    t = re.sub(r"\s+", " ", t)
    if mode == "alnum_space":
        t = re.sub(r"[^a-z0-9 ]", "", t)
        t = re.sub(r"\s+", " ", t).strip()
    return t

def _cer(ref, hyp):
    ref_n = _normalize(ref, "standard")
    hyp_n = _normalize(hyp, "standard")
    if len(ref_n) == 0:
        return 0.0 if len(hyp_n) == 0 else 1.0
    return _levenshtein(ref_n, hyp_n) / len(ref_n)

def _wer(ref, hyp):
    ref_w = _normalize(ref, "standard").split()
    hyp_w = _normalize(hyp, "standard").split()
    if len(ref_w) == 0:
        return 0.0 if len(hyp_w) == 0 else 1.0
    # word-level Levenshtein
    dp = [[0]*(len(hyp_w)+1) for _ in range(len(ref_w)+1)]
    for i in range(len(ref_w)+1): dp[i][0]=i
    for j in range(len(hyp_w)+1): dp[0][j]=j
    for i in range(1,len(ref_w)+1):
        for j in range(1,len(hyp_w)+1):
            cost = 0 if ref_w[i-1]==hyp_w[j-1] else 1
            dp[i][j]=min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost)
    return dp[-1][-1]/len(ref_w)

def _synthetic_microtest(tr):
    cases = ['EXIT','STOP','OPEN','CAFE']
    details = []
    for text in cases:
        img = np.full((120,400,3),255,dtype=np.uint8)
        cv2.putText(img,text,(20,80),cv2.FONT_HERSHEY_SIMPLEX,2,(0,0,0),4)
        r = tr.read_text(img)
        got = r[0]['text'] if r else ''
        conf = float(r[0]['confidence']) if r else 0.0
        details.append({"ground_truth": text, "recognized": got, "confidence": conf, "exact_match_case_insensitive": (got.upper()==text)})
    exact = sum(1 for d in details if d['exact_match_case_insensitive'])/len(details)
    return {
        "status": "reproduced_functional_microtest",
        "note": "4 clean synthetic rendered words only; NOT sufficient evidence of real-world OCR accuracy.",
        "exact_match_accuracy": exact,
        "cases": len(details),
        "details": details
    }

def _find_images():
    d = DATASET_DIR / "ocr" / "images"
    imgs = sorted([p for p in d.glob("*") if p.suffix.lower() in {".jpg",".jpeg",".png",".bmp",".webp"}])
    source = "custom_dataset"
    if not imgs:
        fallback = Path(r"D:\Sight_Companion\venv\Lib\site-packages\matplotlib\mpl-data\sample_data\grace_hopper.jpg")
        if fallback.exists():
            imgs = [fallback]; source = "illustrative_sample_no_gt"
    return imgs, source

def _load_transcripts():
    tdir = DATASET_DIR / "ocr" / "transcripts"
    mapping = {}
    if not tdir.exists():
        return mapping
    # support per-image .txt or manifest.csv (image,reference,category)
    manifest = tdir / "manifest.csv"
    if manifest.exists():
        import csv
        with open(manifest, newline='', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                img = row.get('image') or row.get('filename')
                ref = row.get('reference') or row.get('text') or ''
                if img: mapping[img] = {"reference": ref, "category": row.get('category','uncategorized')}
    for p in tdir.glob('*.txt'):
        mapping.setdefault(p.name.replace('.txt',''), {"reference": p.read_text(encoding='utf-8').strip(), "category": "uncategorized"})
        mapping.setdefault(p.stem, mapping[p.name.replace('.txt','')])
    return mapping

def run(args):
    ensure_dirs()
    tr, meta = _load_ocr()
    images, img_source = _find_images()
    transcripts = _load_transcripts()
    env = environment_record(); env["component_config"] = meta

    micro = _synthetic_microtest(tr)

    rows = []
    times_all = []
    confs = []
    gt_available = False
    for im_path in images:
        img = cv2.imread(str(im_path))
        if img is None:
            rows.append({"image": im_path.name, "status": "read_error"}); continue
        out, tlist, avg = time_call(tr.read_text, img, repeats=args.repeats, warmup=args.warmup)
        times_all.extend(tlist)
        texts = [o.get('text','') for o in (out or [])]
        joined = " ".join(texts).strip()
        cvals = [float(o.get('confidence',0)) for o in (out or [])]
        for c in cvals: confs.append(c)
        avg_conf = (sum(cvals)/len(cvals)) if cvals else 0.0
        det_success = 1 if len(texts)>0 else 0
        # transcript lookup by filename or stem
        ref_entry = transcripts.get(im_path.name) or transcripts.get(im_path.stem)
        ref = ref_entry.get('reference') if isinstance(ref_entry, dict) else (ref_entry if ref_entry else None)
        category = ref_entry.get('category','uncategorized') if isinstance(ref_entry, dict) else 'uncategorized'
        if ref is not None and img_source == "custom_dataset":
            gt_available = True
            cer = _cer(ref, joined); wer = _wer(ref, joined)
            exact = 1 if _normalize(ref,'standard') == _normalize(joined,'standard') else 0
        else:
            cer = wer = exact = "N/A"
        rows.append({
            "image": im_path.name, "source": img_source, "category": category,
            "recognized_text": joined, "reference_text": ref if ref is not None else "",
            "items_detected": len(texts), "detection_success": det_success,
            "avg_confidence": round(avg_conf,6), "avg_inference_s": round(avg,6) if avg else None,
            "fps": round(1.0/avg,3) if avg and avg>0 else None,
            "CER": cer if cer=="N/A" else round(cer,6),
            "WER": wer if wer=="N/A" else round(wer,6),
            "exact_match": exact,
            "status": "ok"
        })

    avg_s = (sum(times_all)/len(times_all)) if times_all else None
    perf = {
        "images_evaluated": len([r for r in rows if r.get("status")=="ok"]),
        "image_source": img_source,
        "avg_inference_s_per_image": round(avg_s,6) if avg_s else None,
        "fps": round(1.0/avg_s,3) if avg_s and avg_s>0 else None,
        "average_ocr_confidence": round(sum(confs)/len(confs),6) if confs else 0.0,
        "text_detection_success_rate": round(sum(r['detection_success'] for r in rows if r.get('status')=='ok')/max(1,len([r for r in rows if r.get('status')=='ok'])),6)
    }

    if gt_available:
        valid = [r for r in rows if r.get('CER') != 'N/A']
        gt_metrics = {
            "status": "evaluated",
            "CER": round(sum(r['CER'] for r in valid)/len(valid),6) if valid else "N/A",
            "WER": round(sum(r['WER'] for r in valid)/len(valid),6) if valid else "N/A",
            "exact_match_accuracy": round(sum(r['exact_match'] for r in valid)/len(valid),6) if valid else "N/A",
            "samples": len(valid),
            "normalization": "lowercase, trim, collapse whitespace (standard). No characters silently removed except whitespace normalization in metric computation; originals preserved in CSV.",
            "category_breakdown": "insufficient_or_mixed" if len(set(r.get('category') for r in valid))<=1 else "see_per_image_rows"
        }
    else:
        gt_metrics = {
            "status": "pending_missing_ground_truth",
            "reason": "No OCR reference transcripts/ground truth found in evaluation/dataset/ocr for custom images. CER/WER/exact-match accuracy cannot be legitimately computed from model output alone.",
            "CER": "N/A", "WER": "N/A", "exact_match_accuracy": "N/A",
            "text_detection_success_rate_note": perf["text_detection_success_rate"],
        }

    plot_path = None
    try:
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        if times_all:
            plt.figure(figsize=(6,4)); plt.bar(range(len(times_all)), times_all)
            plt.xlabel('Inference run index'); plt.ylabel('Seconds'); plt.title('OCR inference latency per run (measured)')
            plot_path = PLOTS_DIR/'ocr_latency.png'; plt.tight_layout(); plt.savefig(plot_path, dpi=150); plt.close()
    except Exception:
        plot_path = None

    summary = {"environment": env, "performance": perf, "synthetic_microtest": micro, "ground_truth_metrics": gt_metrics, "per_image": rows, "plots": {"ocr_latency": str(plot_path) if plot_path else None}}
    write_csv(RESULTS_DIR/'ocr_results.csv', rows)
    write_json(RESULTS_DIR/'ocr_results.json', summary)
    print(json.dumps({"component":"ocr","performance":perf,"synthetic_microtest":{"exact_match_accuracy":micro['exact_match_accuracy'],"note":micro['note']},"ground_truth_metrics":gt_metrics}, indent=2))
    return summary

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--repeats', type=int, default=1)
    ap.add_argument('--warmup', type=int, default=0)
    args = ap.parse_args(); run(args)
