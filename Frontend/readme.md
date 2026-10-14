# Sight Companion Frontend

A cute, friendly dashboard for Sight Companion. It lets the presenter or a helper watch the system live: the camera view, what is being spoken, and which objects are close.

**Status:** Planned. The design and page list are ready. The pages are not built yet.

It runs fully offline. It does not use the internet for fonts, icons, or scripts.

---

## What it shows

- The live camera with detection boxes
- The current spoken warning, in a speech bubble from the mascot
- Hazard cards with the object, how close it is, and which side
- A simple left, ahead, and right view with glowing dots
- A history of spoken warnings
- A list of signs the system has read

---

## Pages

| Page | What it is for |
|---|---|
| Welcome | A friendly start screen with the mascot |
| Setup | Pick the camera, test the voice, and start |
| Live | The main page: camera, warning, hazards, and controls |
| History | All spoken warnings with the time, with simple filters |
| Signs | All text the system has read |
| Voice Questions | Coming soon. Ask what is in front of you and hear the answer |
| Safety Sensors | Coming soon. A vehicle approach sensor and a sound frequency detector |
| Settings | Larger text, calmer motion, mascot on or off, and color choice |
| About | What the project is, how it works, and the team |
| Help | Simple fixes for common problems |

The Coming soon pages are honest previews. They show no fake data.

---

## Look and feel

- Light, airy, and pastel, in soft purple, peach, mint, and butter yellow
- Big rounded cards with soft shadows
- Warning colors: coral for very close, yellow for close, mint for far
- A friendly robot mascot named Sadi, drawn by us, with moods for calm, alert, happy, and sleepy
- A floating pill shaped menu with round icons
- Soft, short animations with no flashing

---

## Easy for everyone to use

- Works fully with the keyboard
- Clear focus outlines
- Labels on every control
- Large, high contrast text
- Respects the reduced motion setting
- Looks good on a laptop and on a projector

---

## How it will work

A small local server starts the Sight Companion system, then sends the camera view and live updates to the pages in the browser. The pages also send simple commands back: start, stop, mute, and choose camera. Everything stays on your own computer.

One command will start it all. The exact command and the browser address will be added here when the server is built.

---

## What it will not do

- No accounts or logins
- No online services
- No changes to how objects are found, how distance is judged, or how speech works

---

## Status

| Part | Status |
|---|---|
| Design and page list | Done |
| Shared style, menu, and mascot | Planned |
| Live page | Planned |
| Other pages | Planned |
| Local server | Planned |
| Voice Questions page | Waiting for the backend feature |
| Safety Sensors page | Waiting for the hardware idea |

---

## Team

Sadaf Riaz and Sara