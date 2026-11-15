# Sight Companion review and deployment plan

## Architecture found

- `Frontend/` is a React 19 + TypeScript + Vite single-page app with hash routes and Supabase browser authentication.
- `Backend/app.py` is a Flask API that imports the AI modules from `Sight-companion-ai/` and currently owns a server-side OpenCV camera thread.
- `Sight-companion-ai/` contains YOLO detection, Depth Anything depth estimation, EasyOCR, navigation, annotation, and speech modules.
- `database/supabase_setup.sql` defines user-scoped profiles, preferences, detection, OCR, activity, and contact tables with RLS policies.
- `Dockerfile` and `render.yaml` target a separate Render Docker backend and static frontend.

## Implementation decisions

1. Replace the server-webcam assumption with browser `getUserMedia()` for the actual visitor device camera.
2. Add a multipart browser-frame inference endpoint. It will decode each submitted frame, run the existing YOLO/depth/OCR/navigation pipeline, return detections with pixel boxes and frame dimensions, and keep persistence asynchronous.
3. Render the browser video and a transparent canvas overlay in the frontend. Scale boxes from inference-frame coordinates to the displayed video coordinates.
4. Make camera start/stop and cleanup browser-owned, including permission errors, route unmount cleanup, and mobile-facing camera constraints.
5. Preserve existing Flask routes for status, history, preferences, profile, OCR, speech, and activity; make status describe browser-camera mode.
6. Add production-safe CORS/API configuration, a route manifest, and Render documentation/configuration without exposing secrets.
7. Verify with frontend build/typecheck, Python syntax/import checks where dependencies permit, endpoint smoke tests, and honest limitations for physical camera/YOLO/Render testing.

## Design direction

- **Quiet assistive clarity** (0.07): preserve the existing Lumi lavender/mint identity, use calm panels, large touch targets, strong focus states, and high-contrast camera status messaging.
- **Clinical dashboard** (0.04): not selected.
- **Playful companion** (0.03): not selected.

### Selected design movement: quiet assistive clarity

Core principles: calm hierarchy, visible state, touch-first controls, and no hidden camera activity. The existing purple/lavender identity remains the signature; camera states and AI alerts use semantic green/amber/red accents. Layouts remain fluid with a single-column mobile mode and a camera/assistant split on larger screens. Motion is restrained and respects reduced-motion preferences. Typography keeps the existing friendly sans-serif hierarchy and readable line lengths. Brand voice is warm, direct, and safety-aware: “Lumi is ready when you are.” and “Camera is on this device; nothing is uploaded except the frame needed for detection.”

## Deployment shape

Render should run the frontend as a static service and the Flask AI API as a Docker web service. Browser camera access requires the published frontend to be HTTPS. AI model download and CPU/RAM requirements remain a deployment constraint; the backend does not and must not access a server webcam.
