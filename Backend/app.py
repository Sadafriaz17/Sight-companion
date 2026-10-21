"""
app.py — Sight Companion Backend API

Runs as a Flask web server so the Frontend can fetch detection data.
All routes return JSON. CORS is enabled for the Vite dev server.

Start with:
    python app.py

The server listens on http://localhost:5000
"""

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)

# Allow the Vite dev server (and any local origin) to call this API.
# In production, restrict origins to your deployed Frontend domain.
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])


# ─── Health check ────────────────────────────────────────────────────────────

@app.get("/")
def health():
    """Simple health check. Returns ok so you know the server is running."""
    return jsonify({"status": "ok", "service": "Sight Companion Backend"})


# ─── Detections ──────────────────────────────────────────────────────────────

# This is placeholder data. When the Python AI (Sight-companion-ai) is running
# and exposes a socket or shared queue, replace this list with a real read.
_mock_detections = [
    {
        "label": "Chair",
        "distance": "1.2 m",
        "direction": "Ahead, slightly left",
        "level": "careful",
        "message": "Chair, 1.2 metres ahead. Move a little right.",
    },
    {
        "label": "Backpack",
        "distance": "2.8 m",
        "direction": "Ahead, to the right",
        "level": "safe",
        "message": "Backpack, 2.8 metres to the right.",
    },
    {
        "label": "Door",
        "distance": "4.1 m",
        "direction": "Directly ahead",
        "level": "safe",
        "message": "Door, 4.1 metres ahead.",
    },
]


@app.get("/api/detections")
def get_detections():
    """
    Returns the latest object detections.
    Frontend polls this every few seconds while the camera is on.

    Replace _mock_detections with real data from the AI module when ready.
    """
    return jsonify(_mock_detections)


# ─── Activity log ─────────────────────────────────────────────────────────────

_mock_activity = [
    {"id": 1, "type": "object", "title": "Chair detected nearby",              "time": "Today at 10:42 AM"},
    {"id": 2, "type": "sign",   "title": "Design Lab — Room 204 read aloud",   "time": "Today at 10:38 AM"},
    {"id": 3, "type": "safe",   "title": "Clear path confirmed",               "time": "Today at 10:30 AM"},
    {"id": 4, "type": "session","title": "Morning session · 24 minutes",       "time": "Today at 8:15 AM"},
]


@app.get("/api/activity")
def get_activity():
    """
    Returns recent activity log items.
    Replace _mock_activity with a real database or log file read when ready.
    """
    return jsonify(_mock_activity)


# ─── Contact form ─────────────────────────────────────────────────────────────

@app.post("/api/contact")
def post_contact():
    """
    Receives a contact message from the Help page.
    Currently just logs it. Wire up email or a database here when ready.
    """
    data = request.get_json(silent=True) or {}
    name    = data.get("name", "").strip()
    email   = data.get("email", "").strip()
    message = data.get("message", "").strip()

    if not name or not email or not message:
        return jsonify({"ok": False, "error": "All fields are required."}), 400

    # TODO: send email or save to database
    print(f"[Contact] from={name} <{email}> | {message[:80]}")

    return jsonify({"ok": True})


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    print(f"Sight Companion Backend running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
