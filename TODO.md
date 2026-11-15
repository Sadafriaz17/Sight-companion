# Sight Companion implementation checklist

- [ ] Browser camera uses the actual laptop/phone camera through `getUserMedia`, requests permission, shows the live preview, supports front/back selection where available, and stops on control/unmount.
- [ ] Browser frames are sent to the Flask API and processed by the existing YOLO implementation; no dummy detections or server-webcam dependency remains.
- [ ] Frontend renders real detection boxes, labels, and confidence scores aligned to the displayed video across responsive sizes.
- [ ] Depth, OCR, navigation, speech, Ask Lumi, history, activity, safety, settings, and auth remain connected to their real implementations with clear loading/error states.
- [ ] Flask routes, auth headers, CORS, Supabase RLS-scoped persistence, and production API URL handling are synchronized.
- [ ] Frontend is responsive on desktop, tablet, and mobile with no horizontal overflow and usable touch targets.
- [ ] Render Docker/static service configuration, health endpoint, model paths, environment variables, and deployment instructions are accurate.
- [ ] Run and record frontend build/type checks, Python syntax/import checks, backend smoke tests, inference checks where dependencies/models are available, and manual camera/Render verification limits.
