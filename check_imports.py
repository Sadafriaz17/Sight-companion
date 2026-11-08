import sys
mods = ["flask", "flask_cors", "supabase", "dotenv", "cv2", "numpy", "PIL",
        "ultralytics", "torch", "transformers", "easyocr", "pyttsx3"]
failed = []
for m in mods:
    try:
        __import__(m)
    except Exception as e:
        failed.append((m, str(e)))
if failed:
    for m, e in failed:
        print(f"FAIL {m}: {e}")
    sys.exit(1)
print("ALL BACKEND IMPORTS OK")

sys.path.insert(0, r"D:\Sight_Companion\Sight-companion-ai")
ai_mods = ["config", "detector", "depth", "ocr", "navigation", "speech", "utils", "video_processor"]
failed = []
for m in ai_mods:
    try:
        __import__(m)
    except Exception as e:
        failed.append((m, str(e)))
if failed:
    for m, e in failed:
        print(f"FAIL {m}: {e}")
    sys.exit(1)
print("ALL AI MODULE IMPORTS OK")
