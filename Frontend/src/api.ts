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
import { supabase } from "./supabase"

const CONFIGURED_API = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "")

function apiCandidates(): string[] {
  const out: string[] = []
  const add = (v: string) => { const n = v.replace(/\/$/, ""); if (n && !out.includes(n)) out.push(n) }
  add(CONFIGURED_API)
  // localhost/127.0.0.1 can resolve differently in some Windows/browser setups
  try {
    const u = new URL(CONFIGURED_API)
    if (u.hostname === "localhost") { u.hostname = "127.0.0.1"; add(u.toString().replace(/\/$/, "")) }
    else if (u.hostname === "127.0.0.1") { u.hostname = "localhost"; add(u.toString().replace(/\/$/, "")) }
  } catch { /* ignore */ }
  if (!CONFIGURED_API.includes("localhost") && !CONFIGURED_API.includes("127.0.0.1")) {
    add("http://127.0.0.1:5000")
  }
  return out
}

let resolvedApiBase = CONFIGURED_API
export const getApiBase = () => resolvedApiBase
// Back-compat export (static at module init); prefer getApiBase() for display after probing.
export let API_BASE = resolvedApiBase

// Stream/frame URLs are derived at use time via helpers to follow resolved base.
export const streamUrl = () => `${getApiBase()}/api/camera/stream`
export const frameUrl = () => `${getApiBase()}/api/camera/frame`

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

export type Preferences = {
  voice_on: boolean
  contrast: boolean
  text_size: number
  rate: number
  volume: number
  voice: string
  reduced_motion: boolean
  backend_speech: boolean
}

export type Profile = {
  id: string
  email: string
  full_name: string | null
  is_guest: boolean
  created_at: string
  updated_at: string
}

// ─── Low-level fetch helpers ──────────────────────────────────────────────────

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = { Accept: "application/json" }
  try {
    const session = await supabase?.auth.getSession()
    const token = session?.data?.session?.access_token
    if (token) headers["Authorization"] = `Bearer ${token}`
  } catch {
    // Never block API calls if auth session lookup fails
  }
  return headers
}

async function get<T>(path: string, opts?: { timeoutMs?: number; auth?: boolean }): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 8000)
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      headers: opts?.auth === false ? { Accept: "application/json" } : await getAuthHeaders(),
      signal: controller.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function post<T>(path: string, body?: unknown, opts?: { timeoutMs?: number; auth?: boolean }): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 15000)
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(opts?.auth === false ? {} : await getAuthHeaders()),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function put<T>(path: string, body?: unknown, opts?: { timeoutMs?: number; auth?: boolean }): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 10000)
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(opts?.auth === false ? {} : await getAuthHeaders()),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function wait(ms = 450) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

// ─── Health / Status ──────────────────────────────────────────────────────────

async function fetchJson<T>(base: string, path: string, timeoutMs: number): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Probe configured API base and IPv4/IPv6 localhost variants.
 * On success, locks resolved base so stream/start/status use the reachable address.
 */
async function probeBackend(): Promise<{ base: string; status: BackendStatus } | null> {
  for (const base of apiCandidates()) {
    const status = await fetchJson<BackendStatus>(base, "/api/status", 5000)
    if (status?.ok) return { base, status }
    const health = await fetchJson<{ ok: boolean }>(base, "/api/health", 3500)
    if (health?.ok) {
      // Health reachable but status failed — still treat backend as reachable.
      resolvedApiBase = base
      API_BASE = base
      return { base, status: status ?? ({ ok: true } as BackendStatus) }
    }
  }
  return null
}

export async function pingBackend(): Promise<boolean> {
  const probe = await probeBackend()
  if (probe) {
    resolvedApiBase = probe.base
    API_BASE = probe.base
    return true
  }
  return false
}

export async function getBackendStatus(): Promise<BackendStatus | null> {
  const probe = await probeBackend()
  if (!probe) return null
  resolvedApiBase = probe.base
  API_BASE = probe.base
  // Prefer full status when probe returned a fallback status
  if (probe.status && (probe.status as BackendStatus).camera) return probe.status as BackendStatus
  return fetchJson<BackendStatus>(probe.base, "/api/status", 5000)
}

// ─── Camera controls ──────────────────────────────────────────────────────────

/** Tell the backend to open the camera and start the AI pipeline. */
export async function startCamera(): Promise<{ ok: boolean; message?: string; error?: string }> {
  const data = await post<{ ok: boolean; message?: string; error?: string }>("/api/camera/start")
  if (data) return data
  // Distinguish "backend unreachable" from "request failed"
  const reachable = await pingBackend()
  return { ok: false, message: reachable ? "Camera start request failed." : "Backend unreachable." }
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

// ─── Detection history ───────────────────────────────────────────────────────

/**
 * Returns the authenticated user's detection event history.
 */
export async function getDetectionHistory(limit = 50): Promise<unknown[]> {
  const data = await get<{ detection_events: unknown[] }>(`/api/detection-history?limit=${limit}`)
  return data?.detection_events ?? []
}

// ─── OCR history ─────────────────────────────────────────────────────────────

/**
 * Returns the authenticated user's OCR result history.
 */
export async function getOcrHistory(limit = 50): Promise<unknown[]> {
  const data = await get<{ ocr_results: unknown[] }>(`/api/ocr-history?limit=${limit}`)
  return data?.ocr_results ?? []
}

// ─── Activity history ────────────────────────────────────────────────────────

/**
 * Returns the authenticated user's activity log history from Supabase.
 */
export async function getActivityHistory(limit = 50): Promise<unknown[]> {
  const data = await get<{ activity_log: unknown[] }>(`/api/activity-history?limit=${limit}`)
  return data?.activity_log ?? []
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile | null> {
  const data = await get<{ profile: Profile }>("/api/profile")
  return data?.profile ?? null
}

export async function updateProfile(updates: Partial<Profile>): Promise<Profile | null> {
  const data = await put<{ profile: Profile }>("/api/profile", updates)
  return data?.profile ?? null
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export async function getPreferences(): Promise<Preferences | null> {
  const data = await get<{ preferences: Preferences }>("/api/preferences")
  return data?.preferences ?? null
}

export async function updatePreferences(prefs: Partial<Preferences>): Promise<Preferences | null> {
  const data = await put<{ preferences: Preferences }>("/api/preferences", prefs)
  return data?.preferences ?? null
}

// ─── Auth helpers (Supabase) ──────────────────────────────────────────────────

export async function continueWithGoogle(): Promise<Session> {
  if (!supabase) throw new Error("Supabase is not configured.")
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google" })
  if (error) throw error
  // OAuth redirects; return current cached session if available.
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error("Google sign-in did not complete.")
  return {
    id: data.session.user.id,
    name: data.session.user.user_metadata?.full_name || data.session.user.email?.split("@")[0] || "User",
    email: data.session.user.email ?? "",
    isGuest: false,
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.")
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/#new-password`,
  })
  if (error) throw error
}

export async function setNewPassword(password: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.")
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function deleteLocalAccount(): Promise<void> {
  await wait()
  localStorage.removeItem("sight-companion:accounts")
}
