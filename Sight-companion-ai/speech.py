import queue
import threading
import subprocess
import sys


class SpeechEngine:
    """
    Reliable Windows TTS engine.

    Strategy:
      1. Primary  — PowerShell System.Speech (always works on Windows,
                    no COM threading issues, no re-init problems).
      2. Fallback — pyttsx3 re-initialised fresh for every call
                    (covers non-Windows / edge cases).

    A single daemon worker thread owns all speech so the video loop
    is never blocked. Queue size = 1 so stale alerts are dropped
    instead of piling up.
    """

    def __init__(self):
        self._q = queue.Queue(maxsize=1)
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _speak_powershell(self, text: str) -> bool:
        """Speak via PowerShell System.Speech. Returns True on success."""
        safe = text.replace("'", "").replace('"', "").replace("`", "")
        ps_cmd = (
            "Add-Type -AssemblyName System.Speech; "
            "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            "$synth.Rate   = 1; "
            "$synth.Volume = 100; "
            f"$synth.Speak('{safe}')"
        )
        try:
            result = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
                timeout=20,
                creationflags=subprocess.CREATE_NO_WINDOW,
                capture_output=True,
            )
            if result.returncode == 0:
                return True
            print(f"[TTS-PS] error: {result.stderr.decode(errors='ignore').strip()}")
        except Exception as e:
            print(f"[TTS-PS] exception: {e}")
        return False

    def _speak_pyttsx3(self, text: str) -> bool:
        """Re-initialize pyttsx3 fresh for every call (avoids COM state issues)."""
        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.setProperty("rate", 155)
            engine.setProperty("volume", 1.0)
            engine.say(text)
            engine.runAndWait()
            engine.stop()
            return True
        except Exception as e:
            print(f"[TTS-py3] exception: {e}")
        return False

    def _worker(self):
        """Dedicated thread — processes speech requests one at a time."""
        while True:
            text = self._q.get()
            if text is None:
                break  # shutdown signal

            # Try PowerShell first (most reliable on Windows)
            if sys.platform == "win32":
                if self._speak_powershell(text):
                    continue
            # Fallback
            self._speak_pyttsx3(text)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def speak(self, text: str):
        if not text:
            return
        print(f"🔊 AUDIO OUT: '{text}'")
        # Drop if queue is full — never let stale alerts pile up
        try:
            self._q.put_nowait(text)
        except queue.Full:
            pass  # Already has a pending message; skip this one

    def shutdown(self):
        """Signal the worker to exit cleanly."""
        self._q.put(None)
