import subprocess
ps_cmd = (
    "Add-Type -AssemblyName System.Speech; "
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
    "$synth.Rate = 1; "
    "$synth.Volume = 100; "
    "$synth.Speak('Hello, this is a TTS test from Python subprocess')"
)
print("Running PowerShell TTS...")
r = subprocess.run(
    ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
    capture_output=True, text=True, timeout=20
)
print(f"Return code: {r.returncode}")
if r.stderr:
    print(f"Stderr: {r.stderr[:300]}")
else:
    print("No errors — if you heard audio, PowerShell TTS works!")
