"""
gunicorn.conf.py — Production Gunicorn configuration for Render.com

IMPORTANT: workers must be 1.
The camera capture thread and AI component singletons live in process memory.
Multiple workers would each try to open the camera and load models separately,
causing conflicts and OOM errors.
"""
import os

# Bind to Render's injected PORT (default 10000)
bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"

# Single worker process — camera state must not be duplicated across processes
workers = 1

# Multiple threads within the single worker for concurrent HTTP requests
threads = 4
worker_class = "gthread"

# Generous timeout — AI model loading can take 60-120 s on cold start
timeout = 180
keepalive = 5

# Restart workers after this many requests to prevent memory leaks
max_requests = 500
max_requests_jitter = 50

# Do NOT preload the app — let the worker import lazily so models load on demand
preload_app = False

# Log to stdout (Render captures this)
errorlog = "-"
accesslog = "-"
loglevel = "info"

