# Sight Companion

A real time, low cost AI vision assistant designed to help visually impaired individuals understand their surroundings. The system uses a laptop webcam to detect objects, estimate distance, and provide prioritized, spoken audio guidance, fully offline. It also supports spoken questions, so a user can ask what is nearby and get a spoken answer.

This is a final year project, built on top of the open source [assistive-vision-ai](https://github.com/Abhishek-Krishna-A-M/assistive-vision-ai) project and extended from there.

**Authors:** Sadaf Riaz and Sara
**Status:** In development

---

## Features

- **Object Detection** — Detects objects and potential obstacles using YOLOv8.
- **Distance Estimation** — Estimates depth to identify objects that may pose a collision risk, reported in simple buckets: close, medium, far. *(bucket naming and thresholds being finalized)*
- **Side Detection** — Reports whether an object is on the left, center, or right.
- **Scene Tracking** — Avoids repeating the same announcement every frame. *(currently basic, a real cross-frame tracker is in progress)*
- **Hazard Priority** — Speaks urgent obstacles first, so the system does not talk constantly. *(an explicit hazard class list and priority queue are in progress)*
- **Text-to-Speech (TTS)** — Converts guidance into spoken audio, fully offline, using pyttsx3. *(currently blocks the main loop, being moved to a background thread)*
- **Voice Questions** — Ask a question out loud, like "what is in front of me," and get a spoken answer. *(not yet started)*
- **Text Recognition (OCR)** — Reads visible text and signs using EasyOCR, kept from the base project as an optional extra feature.

---

## 💻 Windows Setup

### 1. Prerequisites

Install the following:

- **Python:** 3.10 (recommended, for best compatibility with PyTorch, Ultralytics, and EasyOCR together)
- **Miniconda:** [Download here](https://docs.conda.io/en/latest/miniconda.html)
- **Git:** Required to clone and push to the repository
- **Webcam:** Required for live inference
- **Microphone:** Required for voice questions
- **Speakers or headphones:** Required for audio guidance

> **Important:** During Python installation (if installing separately), enable **Add Python to PATH**.

### 2. Clone the Project

```bash
git clone https://github.com/Sadafriaz17/Sight-companion.git
cd Sight-companion
```

### 3. Create and Activate the Conda Environment

```bash
conda create -n sight-companion python=3.10 -y
conda activate sight-companion
```

### 4. Install PyTorch

**CPU only (most laptops):**
```bash
pip install torch torchvision torchaudio
```

**With an NVIDIA GPU (CUDA 12.1 build):**
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

> **Note:** The correct PyTorch and CUDA combination depends on your GPU and driver. If the command above does not match your system, check the official [PyTorch installation instructions](https://pytorch.org/get-started/locally/).

### 5. Install Project Dependencies

```bash
pip install -r requirements.txt
pip install SpeechRecognition vosk pyaudio
```

If `pyaudio` fails to install on Windows, run:
```bash
conda install -c anaconda pyaudio -y
```

---

## ▶️ Running the Application

### Live Webcam

Make sure your webcam is connected and your speakers or headphones are enabled.

```bash
python main.py
```

A window opens showing the camera feed with detections and an overlay.

To stop the application:
1. Click the video window.
2. Press **`q`**.

### Test Using a Video File

Open `main.py` and configure the video source:

```python
processor.process_video(
    source_path="my_test_video.mp4",
    output_path="output.mp4"
)
```

Then run:
```bash
python main.py
```

The processed video will be saved as `output.mp4`.

---

## 📁 Project Structure

```
Sight-companion/
│
├── main.py
├── video_processor.py
├── config.py
├── detector.py
├── depth.py
├── ocr.py
├── navigation.py
├── speech.py
├── utils.py
├── requirements.txt
└── README.md
```

### File Descriptions

| File | Purpose |
|---|---|
| `main.py` | Application entry point |
| `video_processor.py` | Coordinates the pipeline and processes video frames |
| `config.py` | Thresholds, cooldown values, hazard class list, and model configuration |
| `detector.py` | YOLOv8 object detection |
| `depth.py` | Distance estimation |
| `navigation.py` | Decides what matters and builds the spoken sentence, including hazard priority and scene tracking |
| `speech.py` | Text-to-speech output and voice question handling |
| `utils.py` | Drawing and display helpers |
| `ocr.py` | Text detection and recognition using EasyOCR (optional feature) |

---

## 🧠 Processing Pipeline

```
Camera / Video
      │
      ▼
┌─────────────────┐
│  Video Frame    │
└────────┬────────┘
         │
         ├───────────────┐
         ▼               ▼
┌──────────────┐  ┌──────────────┐
│ YOLOv8       │  │ Depth        │
│ Detection    │  │ Estimation   │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                ▼
       ┌─────────────────┐
       │ Navigation      │
       │ Engine          │
       │ (scene tracker, │
       │ hazard priority)│
       └────────┬────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
   Important         Not Relevant
     Event               │
        │                └── Ignore
        ▼
┌─────────────────┐
│ Text-to-Speech  │
└────────┬────────┘
         │
         ▼
    Audio Guidance

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Microphone     │ ──▶ │ Speech            │ ──▶ │ Spoken Answer   │
│  (push to talk) │     │ Recognition       │     │ (same TTS step) │
└─────────────────┘     │ + Scene Lookup    │     └─────────────────┘
                         └──────────────────┘
                         (in progress)
```

The navigation engine reduces unnecessary speech and prioritizes what is most useful for immediate obstacle awareness.

---

## ⚙️ Performance Tuning

Running object detection and depth estimation together can be demanding on CPU-only systems.

### Reduce Processing Frequency

If the video is lagging, increase the cooldown value in `config.py`:

```python
COOLDOWN_SECONDS = 4.0
```

### Disable OCR

OCR is one of the more expensive components. If text recognition is not required, disable it in `main.py`:

```python
run_ocr = False
```

### Use GPU Acceleration

On a system with a compatible NVIDIA GPU, configuring PyTorch with CUDA substantially reduces inference time compared with CPU-only execution.

---

## 🔊 Troubleshooting

### Application Is Slow or Laggy

Try:
- Increasing `COOLDOWN_SECONDS`
- Disabling OCR with `run_ocr = False`
- Using a compatible NVIDIA GPU with CUDA acceleration
- Reducing the input video resolution

### No Audio

Check that:
- System volume is enabled
- The correct audio output device is selected
- Speakers or headphones are connected
- The application is running inside the activated conda environment

On Windows, `pyttsx3` normally uses the native **SAPI5** speech engine.

### No Microphone Input (voice questions)

Check that:
- The correct input device is selected in Windows sound settings
- `pyaudio` installed correctly (see setup step 5)
- The offline Vosk model has been downloaded (see setup instructions in the project notes)

### `ModuleNotFoundError`

Make sure the conda environment is activated:
```bash
conda activate sight-companion
```
Then reinstall the dependencies:
```bash
pip install -r requirements.txt
```

---

## ⚠️ Limitations

This system is an **assistive prototype**, not a replacement for a cane, guide dog, trained mobility aid, or independent navigation technology.

- Distance is estimated, not measured with a dedicated sensor, and is reported in simple buckets rather than exact numbers.
- Object detection can miss objects or produce incorrect classifications.
- Detection and OCR performance depend on lighting, angle, and image quality.
- Audio guidance may become less reliable in noisy environments.
- Runs on a laptop for now, not a phone or wearable device.
- Testing so far has been done by the project team, not by visually impaired users.

Users should not rely exclusively on this system for safety-critical navigation.

---

## 🛠️ Technology Stack

- **Python**
- **YOLOv8** — Object Detection
- **Depth Anything** — Distance Estimation
- **EasyOCR** — Optical Character Recognition (optional)
- **OpenCV** — Video and image processing
- **pyttsx3** — Text-to-Speech
- **SpeechRecognition + Vosk** — Offline voice questions
- **PyTorch** — Deep Learning Framework

---

## 👥 Team and Work Division

| Person | Owns | Files |
|---|---|---|
| **Sadaf** | Vision and decision logic: detection, distance, side, scene tracking, hazard priority | `navigation.py`, `config.py`, `detector.py`, `depth.py` |
| **Sara** | Voice and speech: fully offline, non-blocking speech output, voice question answering | `speech.py`, `requirements.txt` |

---

## 📌 Current Progress and Next Steps

| Area | Status |
|---|---|
| Camera capture, object detection, side detection | Done |
| Distance bucket naming and thresholds | In progress |
| Non-blocking, fully offline speech | In progress |
| Real scene tracking across frames | In progress |
| Hazard priority queue | In progress |
| Voice question answering | Not started |
| Offline model bundling | In progress |

## 📌 Future Improvements

- Real-world distance calibration against measured values
- Object tracking between frames with persistent IDs
- GPS-based outdoor navigation
- Support for mobile or edge devices
- Hardware integration with wearable cameras and audio devices

---

## Acknowledgements

Built on top of the open source [assistive-vision-ai](https://github.com/Abhishek-Krishna-A-M/assistive-vision-ai) project by Abhishek Krishna A M, used as a starting point and extended with scene tracking, hazard prioritization, offline hardening, and voice question answering.
