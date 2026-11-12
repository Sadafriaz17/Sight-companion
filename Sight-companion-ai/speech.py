import queue
import threading
import subprocess
import sys


class SpeechEngine:
    """
    Cross-platform TTS engine for Sight Companion backend.

    Platform strategy:
      Windows — PowerShell System.Speech (primary) → pyttsx3 (fallback)
      Linux   — espeak-ng (if installed) → silent no-op (cloud servers have
                no audio output; the frontend handles TTS via Web Speech API)

    A single daemon worker thread owns all speech so the video loop
    is never blocked. Queue size = 1 so stale alerts are dropped
    instead of piling up.
    """

    def __init__(self):
        self._q: queue.Queue = queue.Queue(maxsize=1)
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _speak_powershell(self, text: str) -> bool:
        """Speak via PowerShell System.Speech (Windows only). Returns True on success."""
        # subprocess.CREATE_NO_WINDOW is Windows-only — guard before use
        if sys.platform != "win32":
            return False
        safe = text.replace("'", "").replace('"', "").replace("`", "")
        ps_cmd = (
            "Add-Type -AssemblyName System.Speech; "
            "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            "$synth.Rate   = 1; "
            "$synth.Volume = 100; "
            f"$synth.Speak('{safe}')"
        )
        try:
            CREATE_NO_WINDOW = 0x08000000  # Windows-only flag, accessed by value
            result = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
                timeout=20,
                creationflags=CREATE_NO_WINDOW,
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
            import pyttsx3  # noqa: PLC0415 — optional dep, not available on Linux
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

    def _speak_espeak(self, text: str) -> bool:
        """Use espeak-ng on Linux if available. Returns True on success."""
        if sys.platform == "win32":
            return False
        try:
            result = subprocess.run(
                ["espeak-ng", "-s", "160", text],
                timeout=15,
                capture_output=True,
            )
            return result.returncode == 0
        except FileNotFoundError:
            # espeak-ng not installed — silent no-op on cloud servers
            return False
        except Exception as e:
            print(f"[TTS-espeak] exception: {e}")
            return False

    def _worker(self):
        """Dedicated thread — processes speech requests one at a time."""
        while True:
            text = self._q.get()
            if text is None:
                break  # shutdown signal

            if sys.platform == "win32":
                # Windows: PowerShell primary, pyttsx3 fallback
                if self._speak_powershell(text):
                    continue
                self._speak_pyttsx3(text)
            else:
                # Linux/Mac: try espeak-ng, otherwise silent (cloud has no audio)
                self._speak_espeak(text)

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
