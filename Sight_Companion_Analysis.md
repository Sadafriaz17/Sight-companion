# Sight Companion — Repository Analysis & Gap Report

**Source repo:** `assistive-vision-ai` (https://github.com/Abhishek-Krishna-A-M/assistive-vision-ai)
**Report scope:** Read-only inspection. No code was changed.
**Repo location:** `d:\Sight_Companion\assistive-vision-ai\`

---

## STEP 1 — What each file does right now (plain language)

| File | What it actually does |
|---|---|
| `main.py` | Entry point. Creates a `PipelineProcessor(run_ocr=True)` and starts it on the webcam (`source_path=0`). Thin 7-line starter. |
| `video_processor.py` | The conductor. Opens the camera (`cv2.VideoCapture`), loops: frame → YOLO detection → depth estimation → OCR every 3rd frame → navigation engine → speaks **only `instructions[0]`** → draws overlay → optionally writes `output.mp4`. Press `q` to quit. |
| `config.py` | Settings: device (cuda/cpu), model names (`yolov8s.pt`, `LiheYoung/depth-anything-small-hf`), thresholds (YOLO 0.25, OCR 0.45), depth thresholds (179 = "very close", 115 = "close"), `COOLDOWN_SECONDS = 3.0`. |
| `detector.py` | YOLOv8 wrapper. Loads pretrained model once; `detect(frame)` returns list of dicts with `name`, `confidence`, `box [xmin, ymin, xmax, ymax]` (COCO classes). |
| `depth.py` | Depth Anything wrapper. `estimate(frame)` returns a depth map resized to frame, normalized to 0–255 (relative depth, near = bright — **not** metres). |
| `navigation.py` | Decision brain. `_get_spatial_zone` (left/center/right thirds → "on your left"/"ahead"/"on your right"), `_get_depth_level` (mean depth in box → "Very Close"/"Close"/"Far"), `evaluate(...)` (keep Close/Very Close as hazards, sort Very Close first, time-cooldown dict `last_announced`, build sentence, special "Obstacle very close ahead" case, OCR only if no hazards). |
| `speech.py` | TTS. Tries IPython/Colab audio first; else **pyttsx3**. `speak()` prints text then `engine.say()` + `engine.runAndWait()` (**blocking**). Also a gTTS (online) fallback using macOS/Linux shell commands. |
| `utils.py` | Drawing only. `annotate_frame` draws green detection boxes + labels, blue OCR boxes, and a top black bar showing the spoken instruction. |
| `ocr.py` | EasyOCR wrapper. `read_text(frame)` returns entries with `text`, `confidence`, `box`, filtered by OCR threshold. |
| `requirements.txt` | ultralytics, transformers, easyocr, torch, torchvision, opencv-python, pillow, numpy, gtts, pyttsx3. |
| `README.md` | Original setup / run / troubleshooting docs. |

---

## STEP 2 — Your 10 features vs. the current code

### 1. Camera capture from webcam (OpenCV) — ✅ Already present and working
`video_processor.py` → `PipelineProcessor.process_video()` line 19 (`cv2.VideoCapture(source_path)`), invoked from `main.py` line 7 with `source_path=0`. Also supports a video-file path.

### 2. Object detection (pretrained YOLO) — ✅ Already present and working
`detector.py` → `ObjectDetector` (lines 4–24) loads `yolov8s.pt`; `detect()` returns name/confidence/box.

### 3. Distance buckets (close / medium / far) — ⚠️ Partially present
- **Present:** `depth.py` → `estimate()` and `navigation.py` → `_get_depth_level()` (lines 21–40) produce three buckets via two thresholds in `config.py` (lines 14–15).
- **Missing/incomplete:** buckets are named **"Very Close" / "Close" / "Far"**, not **close / medium / far** (no distinct "medium"). Depth is **per-frame normalized relative depth**, so thresholds (179/115) are not stable physical distances and can jitter; no calibration.

### 4. Side detection (left / center / right) — ✅ Present and working (wording note)
`navigation.py` → `_get_spatial_zone()` (lines 9–19) splits frame into horizontal thirds → left/center/right. Center is spoken as **"ahead"**, not "center". Horizontal only.

### 5. Scene tracker / cooldown to stop repeats — ⚠️ Partially present
- **Present:** time-based cooldown — `navigation.py` `self.last_announced` (line 7), used at lines 60–65 and 71–73, via `config.COOLDOWN_SECONDS = 3.0`.
- **Missing/incomplete:** it is a **key+timestamp cache, not a tracker** (no object identity across frames, no IDs, no IoU/centroid matching). Key is only `name + position` (no distance). `last_announced` grows forever (no cleanup).

### 6. Hazard priority list (urgent first, background waits/skipped) — ⚠️ Partially present
- **Present:** `navigation.py` `evaluate()` (lines 46–66) builds hazards, sorts **"Very Close" before "Close"** (line 56), has an urgent special-case (lines 61–62). "Far" objects are effectively skipped.
- **Missing/incomplete:** priority is **depth-only**, not object-type; there is **no explicit hazard class list** (stairs/vehicles/poles, and "stairs" isn't a COCO class anyway). Background objects are **silently dropped, not queued**. And `video_processor.py` line 55 speaks **only `instructions[0]`** — extra hazards per frame are discarded.

### 7. Spoken sentences like "chair on your left" — ✅/⚠️ Mostly present (phrasing differs)
`navigation.py` line 64 builds `f"{name.capitalize()} {pos}."` → `"Chair on your left."`. But only for Close/Very Close objects (Far never described) and the sentence does **not include distance**.

### 8. pyttsx3 TTS, ideally non-blocking — ⚠️ Partially present (blocking!)
- **Present:** `speech.py` uses pyttsx3 (`engine.say` + `runAndWait`).
- **Missing/incomplete:** `runAndWait()` (line 31) **blocks the main loop**. There is a **Colab/IPython branch** (lines 6–9, 22–28) that switches to **online gTTS** whenever IPython is importable (often true on dev machines) — breaks offline. No thread/queue; no interrupt/drop of stale audio.

### 9. Voice question answering (spoken Q → spoken A) — ❌ Not present at all
Search confirmed: **no** `speech_recognition`, `pyaudio`, `vosk`, or `whisper` anywhere. No mic capture, no question parsing, no scene-based answer logic.

### 10. Fully offline, no cloud dependency — ⚠️ Mostly present, not guaranteed
- Offline by design: YOLO, Depth Anything, EasyOCR all run locally.
- **Not guaranteed:** `speech.py` gTTS/IPython branches hit the network (lines 22–36); `requirements.txt` includes **gtts** (online); first run **downloads** model weights (`detector.py` line 6, `depth.py` line 11) before caching.

---

## STEP 3 — Extra things the repo does that are NOT in your feature list

1. **OCR / sign reading** — `ocr.py` (`TextReader`) + the "Sign reads: …" branch in `navigation.py` (lines 67–74) + blue overlays in `utils.py`. Not in your 10 points.
2. **Video-file processing + saving an annotated `output.mp4`** — `video_processor.py` lines 18, 28–31, 63–64. A recording feature, not requested.
3. **Live visual overlay window** — `utils.py` draws boxes, OCR polylines, an "AUDIO:" bar (`cv2.imshow`). Debug/visual aid, not in the list (the list only wants spoken output).
4. **GPU/CUDA auto-selection** — `config.py` line 3.
5. **Frame-skipping for OCR** — `video_processor.py` line 46 (performance tuning).
6. **Colab/IPython audio support with gTTS** — `speech.py`. Off-list and harmful to the offline requirement.
7. **Depth Anything relative-depth map** — exceeds feature 3 (which only needs 3 buckets), but it is what powers the buckets.

---

## STEP 4 — requirements.txt vs. actual imports

**Third-party modules actually imported by the code:**
`ultralytics`, `transformers`, `torch`, `numpy`, `cv2`→`opencv-python`, `PIL`→`pillow`, `easyocr`, `pyttsx3`, plus optional `IPython` and `gtts` (only inside `speech.py`).

**In requirements.txt but NOT directly imported by the project code:**

| Package | Verdict |
|---|---|
| `torchvision` | Not imported anywhere. It is a **transitive dependency** of ultralytics, so it is fine to keep, but the project itself never uses it. |
| `gtts` | Used only in `speech.py`'s **Colab/fallback** branches. In the normal offline Windows path it is **unused** — and it is an **online** dependency you would want to drop (feature 10). |

**Used in code but MISSING from requirements.txt:**

| Package | Where | Notes |
|---|---|---|
| `IPython` | `speech.py` lines 7–8 | Imported (optionally). Not listed. Harmful: if present, it flips the code into the online gTTS path. |
| `speech_recognition` | — | Not used yet, but **required to build feature 9**. |
| `pyaudio` | — | Not used yet, but needed for microphone capture for feature 9. |
| `vosk` (optional) | — | Recommended for a **fully offline** ASR engine for feature 9. |

**Summary:** requirements.txt is missing nothing for the code *as it exists*, but it (a) carries `gtts` which conflicts with your offline requirement, (b) lists `torchvision` that the project doesn't directly import, and (c) has none of the speech-recognition packages you'll need for feature 9.

---

## STEP 5 — What needs to be built, ranked easiest → hardest

| # | Missing item | Target file(s) | Difficulty | Why |
|---|---|---|---|---|
| 1 | **Rename/define buckets as close / medium / far** and make labels consistent everywhere | `config.py` + `navigation.py` (`_get_depth_level`) | Very easy | Rename 3 labels + adjust 2 thresholds; pure relabeling. |
| 2 | **Non-blocking, offline-only TTS**: run pyttsx3 in a worker thread with a queue; delete the Colab/gTTS branches so it always stays offline | `speech.py` | Easy | Self-contained; use `threading.Thread` + `queue.Queue`, keep `engine.say` in the thread. Satisfies feature 8 fully and cleans feature 10. |
| 3 | **Richer sentence** including distance + side (e.g. "Chair, close, on your left") and describe Far/background objects too | `navigation.py` (`evaluate`, sentence line 64) | Easy | Just string-building; add distance word. |
| 4 | **Real scene tracker** (object identity across frames via IoU/centroid matching) instead of only the key cooldown; clean up stale entries | `navigation.py` | Medium | Add a small track list with IDs + last-seen, feed them into the cooldown key. |
| 5 | **Hazard priority queue + urgent class list**: explicit hazard classes in config, announce urgent immediately, queue/defer background, and speak more than just `instructions[0]` | `config.py` + `navigation.py` + `video_processor.py` | Medium | Needs a class list, a prioritized pending queue, and changing the loop to drain the queue instead of taking index 0. |
| 6 | **Voice question answering**: offline speech recognition input + question intent parsing + answer synthesized from the current scene state | `speech.py` (recognition + synthesis) + `navigation.py`/`video_processor.py` (expose scene state) + new `requirements.txt` entries (`SpeechRecognition`, `PyAudio`, optional `vosk`) | Hard | New subsystem; needs mic capture, offline ASR engine, threaded listener, and a "what is in front of me" answer routine. |
| 7 | **Offline hardening / packaging**: pre-download & bundle `yolov8s.pt` and the Depth Anything weights, remove gTTS, force local-model loading | `config.py`, `detector.py`, `depth.py`, `speech.py` + local weights folder | Hard | Involves model bundling, offline load paths, and removing all network fallbacks. |

### Notes on file placement (avoiding unnecessary new files)
- Items 1, 3, 4, 5 live naturally in **`navigation.py`** (thresholds/classes in **`config.py`**), since it is already the decision brain.
- Items 2 and 6 belong in **`speech.py`** (already the audio module — TTS ×2 and ASR), with the scene snapshot for Q&A exposed by **`video_processor.py`**.
- Item 7 touches **`config.py` / `detector.py` / `depth.py` / `speech.py`** plus a weights folder.

---

## Flags worth noting before building

1. `speech.py`'s IPython branch will silently switch you to **online gTTS** if IPython is installed — a real offline-compliance risk. Remove it early (item 2).
2. `video_processor.py` speaks only `instructions[0]`, so multiple hazards per frame are dropped — this must change for feature 6 to truly work (item 5).

**Recommended first steps:** item 1 (bucket rename), then item 2 (non-blocking offline TTS) — both low-risk and they unblock the rest.
