# Sight Companion Backend

The backend is the part of Sight Companion that sees and speaks. It reads the camera, finds objects, judges distance, decides what matters, and talks to the user. It runs fully offline.

**Where the code is:** the Python files currently sit in the folder named Sight-companion-ai at the top of the repository. If they are moved into this Backend folder later, every step below stays the same.

---

## What it does

- Reads video from a webcam or from a video file
- Finds objects and obstacles
- Estimates how near each object is
- Says if the object is on the left, ahead, or on the right
- Avoids repeating the same warning
- Speaks the most urgent warning first
- Reads signs as an optional extra
- Answers spoken questions (planned)

---

## Files

| File | Purpose |
|---|---|
| main.py | Starts the system |
| video_processor.py | Runs the full loop for every frame |
| config.py | Settings: models, thresholds, cooldown, hazard classes |
| detector.py | Finds objects with YOLOv8 |
| depth.py | Estimates distance with Depth Anything |
| navigation.py | Decides what matters and builds the spoken sentence |
| speech.py | Speaks warnings and handles voice questions |
| ocr.py | Reads text with EasyOCR (optional) |
| utils.py | Draws boxes and the text bar on screen |
| requirements.txt | All packages to install (one file at the project root) |

---

## Setup (Windows)

You need:
- Python 3.10
- Miniconda
- Git
- A webcam
- Speakers or headphones
- A microphone, for voice questions

1. Get the project:

```
git clone https://github.com/Sadafriaz17/Sight-companion.git
cd Sight-companion
cd Sight-companion-ai
```

2. Create and open the environment:

```
conda create -n sight-companion python=3.10 -y
conda activate sight-companion
```

3. Install all packages from the project root:

```
pip install -r requirements.txt
```

If you have an NVIDIA graphics card and want the CUDA build of PyTorch, install torch separately first:

```
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
```

The right CUDA version depends on your card and driver. Check the official PyTorch install guide if unsure.

If pyaudio fails on Windows:

```
conda install -c anaconda pyaudio -y
```

5. Voice questions also need an offline Vosk model. Download a small English model and keep its folder path. Exact steps will be added when voice questions are built.

The first run downloads the model files once. After that, it works offline.

---

## Run

**Live webcam**

```
python main.py
```

A window opens with the camera feed, the detections, and a bar showing what is being spoken. Click the window and press q to stop.

**Test with a video file**

Open main.py and set the source:

```
processor.process_video(
    source_path="my_test_video.mp4",
    output_path="output.mp4"
)
```

Then run `python main.py`. The result is saved as output.mp4.

**Use a phone camera**

Install a phone camera app such as DroidCam on the phone and the PC, and connect them on the same Wi-Fi. Then change the camera number in main.py. The laptop camera is 0. The phone usually shows as 1 or 2.

---

## How each frame is handled

1. Capture the frame
2. Find objects
3. Estimate distance for each object
4. Work out the side: left, ahead, or right
5. Keep only the objects that matter and put the closest first
6. Skip warnings that were just spoken
7. Speak the warning
8. Every few frames, read signs when nothing urgent is near

---

## Make it faster

Running detection and depth together is heavy on a laptop without a graphics card.

- Raise the cooldown in config.py:

```
COOLDOWN_SECONDS = 4.0
```

- Turn off sign reading in main.py:

```
run_ocr = False
```

- Use an NVIDIA graphics card with the CUDA version of PyTorch.
- Lower the camera resolution.

---

## Troubleshooting

**The video is slow.** Try the speed tips above.

**No sound.** Check the system volume, the output device, and that the environment is active. On Windows, pyttsx3 uses the built in speech engine.

**Wrong camera or black screen.** Change the camera number in main.py. Close any other app that uses the camera.

**No microphone input.** Check the input device in Windows sound settings, that pyaudio installed, and that the Vosk model is downloaded.

**ModuleNotFoundError.** Activate the environment and install again:

```
conda activate sight-companion
pip install -r requirements.txt
```

Run this command from the project root (the folder that contains the Backend and Sight-companion-ai folders).

---

## Work division

| Person | Owns | Files |
|---|---|---|
| Sadaf | Detection, distance, side, scene tracking, hazard priority | navigation.py, config.py, detector.py, depth.py |
| Sara | Offline and non blocking speech, voice questions | speech.py, requirements.txt |

---

## Status

| Area | Status |
|---|---|
| Camera, detection, side detection | Done |
| Distance level names and limits | In progress |
| Non blocking, fully offline speech | In progress |
| Scene tracking across frames | In progress |
| Hazard priority queue | In progress |
| Offline model bundling | In progress |
| Voice questions | Not started |

---

## Limits

Distance is estimated, not measured. Detection can be wrong. This is a prototype and must not be the only aid for safe movement.