# Sight Companion

A low cost AI vision assistant that helps visually impaired people understand what is around them.

A laptop webcam watches the scene. The system spots objects, judges how close they are, says which side they are on, and speaks short warnings like "Chair on your left." It is built to run fully offline.

**Status:** In development. This is a final year project.
**Authors:** Sadaf Riaz and Sara
**Built on:** the open source assistive-vision-ai project by Abhishek Krishna A M, extended with scene tracking, hazard priority, offline hardening, and voice questions.

---

## What it does

| Feature | What it does for the user | Status |
|---|---|---|
| Object detection | Finds objects and possible obstacles | Done |
| Side detection | Says if an object is on the left, ahead, or on the right | Done |
| Distance levels | Says if an object is close, medium, or far | In progress |
| Scene tracking | Does not repeat the same warning again and again | In progress |
| Hazard priority | Speaks the most urgent obstacle first | In progress |
| Offline speech | Speaks warnings without freezing the video | In progress |
| Voice questions | Ask "What is in front of me?" and hear the answer | Not started |
| Sign reading | Reads text on signs when nothing urgent is near | Done (optional extra) |

Distance levels are estimates, not measurements, and are given in simple steps rather than exact numbers.

---

## How it works

1. The camera captures a frame.
2. The system finds the objects in it.
3. It estimates how near each object is.
4. It decides which objects matter: close ones first, and only once in a while for the same object.
5. It speaks the warning aloud.

When nothing urgent is near, it can also read signs.

---

## What is in this repository

| Item | What it holds |
|---|---|
| Sight-companion-ai | The current vision and speech code. Start here to run the system. |
| Backend | The readme for the vision and speech system. |
| Frontend | The readme and files for the dashboard (planned). |
| Sight_Companion_Analysis.md | Our analysis of the base project and the list of gaps we are closing. |

Each folder has its own readme with more detail.

---

## How to run (Windows)

**You need:** Python 3.10+, Node.js 18+, Git, a webcam, speakers or headphones.

---

### Step 1 — Clone and install Python packages

```
git clone https://github.com/Sadafriaz17/Sight-companion.git
cd Sight-companion
```

Create a virtual environment and install all Python packages in one command:

```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

If you have an NVIDIA GPU and want CUDA-accelerated PyTorch, install torch first then re-run the line above:

```
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
```

---

### Step 2 — Run the AI pipeline

This starts the camera, object detection, depth estimation, sign reading, and speech.

```
venv\Scripts\activate
cd Sight-companion-ai
python main.py
```

A window opens with the camera feed and detections drawn on screen. Press **q** to stop.

---

### Step 3 — Run the Backend API (new terminal)

This starts the Flask server that the dashboard uses to fetch detection data.

```
venv\Scripts\activate
cd Backend
python app.py
```

The API runs at **http://localhost:5000**

To check it is running, open http://localhost:5000 in a browser. You should see:
```
{"service": "Sight Companion Backend", "status": "ok"}
```

---

### Step 4 — Run the Frontend dashboard (new terminal)

This starts the web dashboard.

```
cd Frontend
copy .env.example .env
npm install
npm run dev
```

The dashboard opens at **http://localhost:5173**

The `.env` file tells the dashboard where the Backend is. The default value (`http://localhost:5000`) is already correct if you followed Step 3.

---

### Running everything together

Open three separate terminal windows, all starting from `D:\Sight_Companion`:

| Terminal | Command |
|---|---|
| 1 — AI pipeline | `venv\Scripts\activate` → `cd Sight-companion-ai` → `python main.py` |
| 2 — Backend API | `venv\Scripts\activate` → `cd Backend` → `python app.py` |
| 3 — Frontend | `cd Frontend` → `npm run dev` |

You can run any one of these on its own. The Frontend shows built-in demo data when the Backend is not running.

---

## Team and work division

| Person | Owns |
|---|---|
| Sadaf | Vision and decision logic: detection, distance, side, scene tracking, hazard priority |
| Sara | Voice and speech: offline and non blocking speech, voice questions |

---

## Progress

| Area | Status |
|---|---|
| Camera capture, object detection, side detection | Done |
| Distance level names and limits | In progress |
| Non blocking, fully offline speech | In progress |
| Scene tracking across frames | In progress |
| Hazard priority queue | In progress |
| Offline model bundling | In progress |
| Voice questions | Not started |
| Dashboard | Planned |

---

## Limitations

This is an assistive prototype. It is not a replacement for a cane, a guide dog, or trained mobility support.

- Distance is estimated, not measured with a sensor.
- Detection can miss objects or name them wrongly.
- Results depend on light, angle, and image quality.
- Audio guidance is harder to hear in noisy places.
- It runs on a laptop for now, not on a phone or a wearable.
- It has been tested by the project team only, not by visually impaired users.
- No one should rely on it alone for safe movement.

---

## Future improvements

- Real world distance checks against measured values
- Object tracking with steady IDs between frames
- A vehicle approach sensor and a sound frequency detector, suggested during project review
- A friendly dashboard for presenting and monitoring the system
- Support for phones and wearable cameras
- GPS based outdoor navigation

---

## Acknowledgements

Built on top of the open source assistive-vision-ai project by Abhishek Krishna A M, used as a starting point and extended by our team.
