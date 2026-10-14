"""
Interactive camera finder with live preview.
Run: .\venv\Scripts\python.exe find_camera.py

It will show a live window for each camera found.
Press Y = this is my phone | N = skip | Q = quit
"""
import cv2, re, os

BACKENDS = [
    ("DSHOW", cv2.CAP_DSHOW),
    ("MSMF",  cv2.CAP_MSMF),
]

print("=" * 55)
print("  Interactive Camera Finder")
print("  Controls in the preview window:")
print("    Y = This is my phone camera")
print("    N = Not my phone, try next")
print("    Q = Quit")
print("=" * 55 + "\n")

phone_index   = None
phone_backend = None
phone_label   = None

for backend_name, backend in BACKENDS:
    if phone_index is not None:
        break
    for idx in range(6):
        # Try to open
        cap = cv2.VideoCapture(idx, backend)
        if not cap.isOpened():
            cap.release()
            continue

        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        label = f"[{backend_name}] Index {idx} — {w}x{h}"
        print(f"Previewing {label} ...")
        print("  Press Y (phone) / N (next) / Q (quit) in the window")

        chosen = None
        while True:
            ret, frame = cap.read()
            if not ret:
                print("  (no frame — skipping)")
                break

            overlay = frame.copy()
            cv2.putText(overlay, f"Is this your PHONE camera?",
                        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.putText(overlay, label,
                        (10, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 1)
            cv2.putText(overlay, "Y = Yes (phone)   N = No (skip)   Q = Quit",
                        (10, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)
            cv2.imshow("Camera Finder — press Y / N / Q", overlay)

            key = cv2.waitKey(1) & 0xFF
            if key == ord('y') or key == ord('Y'):
                chosen = True
                break
            elif key == ord('n') or key == ord('N'):
                chosen = False
                break
            elif key == ord('q') or key == ord('Q'):
                chosen = None
                cap.release()
                cv2.destroyAllWindows()
                print("\nQuitting.")
                exit(0)

        cap.release()
        cv2.destroyAllWindows()

        if chosen:
            phone_index   = idx
            phone_backend = backend_name
            phone_label   = label
            print(f"\n✅ Phone camera identified: {label}")
            break
        else:
            print(f"  Skipped {label}")

# ── Result ──────────────────────────────────────────────────────────────────
if phone_index is None:
    print("\n❌ Phone camera not identified.")
    print("   Make sure DroidCam is open on both phone AND PC, then try again.")
else:
    print(f"\n👉 Updating config.py to use CAMERA_SOURCE = {phone_index}")
    config_path = os.path.join(os.path.dirname(__file__), "config.py")
    with open(config_path, "r") as f:
        content = f.read()
    # Replace the CAMERA_SOURCE line
    content = re.sub(
        r"^CAMERA_SOURCE\s*=.*$",
        f"CAMERA_SOURCE = {phone_index}   # DroidCam detected on [{phone_backend}] {phone_label}",
        content,
        flags=re.MULTILINE,
    )
    with open(config_path, "w") as f:
        f.write(content)

    # Also update video_processor to use the right backend
    if phone_backend == "MSMF":
        vp_path = os.path.join(os.path.dirname(__file__), "video_processor.py")
        with open(vp_path, "r") as f:
            vp = f.read()
        vp = vp.replace("cv2.CAP_DSHOW", "cv2.CAP_MSMF")
        with open(vp_path, "w") as f:
            f.write(vp)
        print("   Also updated video_processor.py to use MSMF backend.")

    print("\n🚀 All done! Now run:  .\\venv\\Scripts\\python.exe main.py")
    print(f"   Your phone camera [{phone_label}] will be used.")
