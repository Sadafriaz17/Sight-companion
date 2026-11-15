# Sight Companion deployment

Sight Companion has two Render services: a static Vite frontend and a Dockerized Flask/AI backend. The browser, not Render, owns the physical camera. On the published HTTPS frontend, the Live view requests the visitor's laptop or phone camera with `getUserMedia`, shows the video locally, sends compressed frames to `POST /api/camera/frame`, and draws the real YOLO boxes returned by Flask on a canvas overlay. Render never needs access to a webcam.

## Render services

Create the services from `render.yaml`, or configure them manually as follows.

| Service | Type | Build | Start / publish |
|---|---|---|---|
| `sight-companion-backend` | Docker web service | Dockerfile at repository root, context `.` | Gunicorn command is defined in the Dockerfile; health check `/api/health` |
| `sight-companion-frontend` | Static site | `cd Frontend && npm ci && npm run build` | Publish directory `Frontend/dist`; rewrite `/*` to `/index.html` |

The backend should use a plan with enough memory for CPU PyTorch, Ultralytics, Transformers, EasyOCR, and their model caches. The repository's Docker image installs CPU-only PyTorch and downloads the YOLO weights during the image build. Depth and OCR model files may download on first use and are cached under `/app/.cache`; cold starts and inference latency depend on the selected Render resources.

## Environment variables

Set these in the backend service. Values are secrets or project-specific and must not be committed:

- `FLASK_DEBUG=0`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `FRONTEND_URL=https://<actual-frontend-host>.onrender.com`
- `TRANSFORMERS_CACHE=/app/.cache/hf`
- `HF_HOME=/app/.cache/hf`
- `EASYOCR_MODULE_PATH=/app/.cache/easyocr`

Set these in the frontend static service before building:

- `VITE_API_URL=https://<actual-backend-host>.onrender.com`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The public Supabase publishable/anonymous key is intended for browser use; never put a Supabase service-role key in `VITE_*` variables or frontend source. Run `database/supabase_setup.sql` in the Supabase SQL editor before testing account-scoped persistence.

## Verification after deployment

1. Open `https://<backend-host>.onrender.com/api/health` and confirm a JSON success response.
2. Open the frontend over HTTPS, sign in or continue as a guest, and open Live view.
3. Allow camera permission. Confirm the local video preview is visible and the browser camera indicator is on.
4. Start the device camera and confirm the frontend sends frames and the panel changes to Live. Point at a visible object; real YOLO labels and confidence boxes should appear over the preview when the model detects it.
5. Turn the camera off, navigate away, and confirm the browser camera indicator turns off.
6. Test camera denial, a device without a camera, mobile portrait layout, camera switching, OCR, speech controls, Supabase history, and profile/preferences.
7. Inspect Render logs for model download, memory, timeout, CORS, and Supabase errors.

Physical camera access, live model inference quality, Supabase credentials, and Render resource behavior were not testable in this sandbox. They require the deployed HTTPS site, configured Supabase project, and a real camera device.
