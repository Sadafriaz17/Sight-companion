# Sight Companion — Frontend

The web dashboard for Sight Companion. Built with React 19, TypeScript, Vite, and Tailwind CSS v4.

---

## What it is

A browser app that shows:
- **Home** — welcome screen with quick links
- **Live view** — camera feed + live object detection results (spoken aloud)
- **Ask Lumi** — voice or text chat with the AI guide
- **Signs** — recently read signs and labels
- **Safety** — alert settings and sensitivity
- **Activity** — recent sessions and detections
- **Settings** — voice, text size, contrast, motion

All user accounts and chats are stored locally in the browser (no server needed for auth). Detection data is fetched from the Backend API when available.

---

## Install

You need **Node.js 18+** and **npm** (or pnpm).

```bash
cd Frontend
npm install
```

---

## Set the .env file

Copy the example and set the backend address:

```bash
copy .env.example .env
```

Open `.env` and set:

```
VITE_API_URL=http://localhost:5000
```

- If the Backend is not running, the app falls back to built-in demo data automatically.
- The `.env` file is not committed to git.

---

## Run in development

```bash
npm run dev
```

Opens at **http://localhost:5173**

---

## Build for production

```bash
npm run build
```

Output goes to `dist/`. Serve with any static file host.

---

## Project structure

```
Frontend/
  src/
    main.tsx        — entry point
    App.tsx         — router + shell layout
    AppPages.tsx    — Live, Ask Lumi, Signs, Safety, Activity, Settings
    Pages.tsx       — Landing, Auth, Profile, Notifications, History, Help, About, Legal
    Auth.tsx        — sign-in / sign-up UI
    api.ts          — all backend calls (one file, reads VITE_API_URL)
    auth.ts         — local account management (localStorage)
    voice.ts        — browser speech synthesis (TTS)
    accessibility.ts — preferences hook
    index.css       — all styles
  index.html
  vite.config.ts
  .env             — your local settings (not in git)
  .env.example     — template (committed to git)
```