/**
 * api.ts — all backend calls live here.
 *
 * The backend base URL comes from the .env file (VITE_API_URL).
 * Falls back to http://localhost:5000 when the env var is not set.
 *
 * The backend owns the camera (Python/OpenCV). The browser does NOT
 * access the webcam directly — it displays the annotated MJPEG stream
 * served by the Flask backend at /api/camera/stream.
 */

import { guestSession, type Session } from "./auth.ts"

const API = import.meta.env.VITE_API_URL || "http://localhost:5000"

// ─── Public stream URL (used directly in <img src> tags) ─────────────────────
export const STREAM_URL = `${API}/api/camera/stream`
export const FRAME_URL  = `${API}/api/camera/frame`

// ─── Types ────────────────────────────────────────────────────────────────────

export type DetectionResult = {
  label: string
  confidence: number
  box: [number, number, number, number]
  distance: string
  direction: string
  level: "safe" | "careful" | "danger"
  message: string
}

export type ActivityItem = {
  id: number
  type: "object" | "sign" | "safe" | "session"
  title: string
  time: string
}

export type OcrResult = {
  text: string
  confidence: number
}

export type CameraStatus = {
  running: boolean
  error: string | null
  frames_processed: number
}

export type AiStatus = {
  ready: boolean
  error: string | null
  components: Record<string, boolean>
}

export type BackendStatus = {
  ok: boolean
  ai: AiStatus
  camera: CameraStatus
  speech: { enabled: boolean }
  pipeline: { detections: number; ocr_results: number }
}

// ─── Low-level fetch helpers ──────────────────────────────────────────────────

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function post<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function wait(ms = 450) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

// ─── Health / Status ──────────────────────────────────────────────────────────

/**
 * Ping the backend to see if it is running.
 * Returns true when reachable, false otherwise.
 */
export async function pingBackend(): Promise<boolean> {
  const data = await get<{ ok: boolean }>("/api/health")
  return data?.ok === true
}

/**
 * Returns full system status (AI readiness, camera, speech, pipeline).
 */
export async function getBackendStatus(): Promise<BackendStatus | null> {
  return get<BackendStatus>("/api/status")
}

// ─── Camera controls ──────────────────────────────────────────────────────────

/** Tell the backend to open the camera and start the AI pipeline. */
export async function startCamera(): Promise<{ ok: boolean; message?: string }> {
  const data = await post<{ ok: boolean; message?: string }>("/api/camera/start")
  return data ?? { ok: false, message: "Backend unreachable." }
}

/** Tell the backend to stop the camera and release hardware. */
export async function stopCamera(): Promise<{ ok: boolean; message?: string }> {
  const data = await post<{ ok: boolean; message?: string }>("/api/camera/stop")
  return data ?? { ok: false, message: "Backend unreachable." }
}

// ─── Detections ───────────────────────────────────────────────────────────────

/**
 * Returns the latest object detections from the backend.
 * Returns an empty array when the backend is not running.
 */
export async function getDetectionResults(): Promise<DetectionResult[]> {
  const data = await get<DetectionResult[]>("/api/detections")
  return data ?? []
}

/**
 * Sync stub used for initial state before the first poll completes.
 */
export function getDetectionResultsSync(): DetectionResult[] {
  return []
}

// ─── OCR ─────────────────────────────────────────────────────────────────────

/** Returns the latest passively-detected OCR results. */
export async function getOcrResults(): Promise<OcrResult[]> {
  const data = await get<OcrResult[]>("/api/ocr/results")
  return data ?? []
}

/** Trigger an active OCR read on the current camera frame. */
export async function triggerOcrRead(): Promise<{ ok: boolean; results: OcrResult[] }> {
  const data = await post<{ ok: boolean; results: OcrResult[] }>("/api/ocr/read")
  return data ?? { ok: false, results: [] }
}

// ─── Speech ───────────────────────────────────────────────────────────────────

/** Toggle backend voice guidance on/off. Returns the new state. */
export async function toggleSpeech(): Promise<{ ok: boolean; speech_enabled: boolean }> {
  const data = await post<{ ok: boolean; speech_enabled: boolean }>("/api/speech/toggle")
  return data ?? { ok: false, speech_enabled: false }
}

/** Ask the backend to speak a specific message. */
export async function speakText(text: string): Promise<void> {
  await post("/api/speech/speak", { text })
}

// ─── Activity ─────────────────────────────────────────────────────────────────

/**
 * Returns recent activity log items derived from AI results.
 */
export async function getActivity(): Promise<ActivityItem[]> {
  const data = await get<ActivityItem[]>("/api/activity")
  return data ?? []
}

// ─── Contact form ─────────────────────────────────────────────────────────────

/**
 * Sends a contact message to the backend.
 */
export async function submitContactMessage(message: {
  name: string
  email: string
  message: string
}): Promise<void> {
  const result = await post("/api/contact", message)
  if (result === null) {
    await wait(600)
  }
}

// ─── Auth helpers (local only, no backend) ───────────────────────────────────

export async function continueWithGoogle(): Promise<Session> {
  await wait()
  return guestSession()
}

export async function requestPasswordReset(_email: string): Promise<void> {
  await wait()
}

export async function setNewPassword(_password: string): Promise<void> {
  await wait()
}

export async function deleteLocalAccount(): Promise<void> {
  await wait()
  localStorage.removeItem("sight-companion:accounts")
}
