/**
 * api.ts — all backend calls live here.
 *
 * The backend base URL comes from the .env file (VITE_API_URL).
 * If the backend is unreachable, functions fall back to mock data so the
 * app keeps working in offline / demo mode.
 *
 * Add real backend calls here as new routes become available.
 * Page components must never hardcode the server address.
 */

import { guestSession, type Session } from "./auth.ts"

const API = import.meta.env.VITE_API_URL || "http://localhost:5000"

// ─── Types ───────────────────────────────────────────────────────────────────

export type DetectionResult = {
  label: string
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

// ─── Mock data (used when backend is not available) ───────────────────────────

const MOCK_DETECTIONS: DetectionResult[] = [
  {
    label: "Chair",
    distance: "1.2 m",
    direction: "Ahead, slightly left",
    level: "careful",
    message: "Chair, 1.2 metres ahead. Move a little right.",
  },
  {
    label: "Backpack",
    distance: "2.8 m",
    direction: "Ahead, to the right",
    level: "safe",
    message: "Backpack, 2.8 metres to the right.",
  },
  {
    label: "Door",
    distance: "4.1 m",
    direction: "Directly ahead",
    level: "safe",
    message: "Door, 4.1 metres ahead.",
  },
]

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 1, type: "object", title: "Chair detected nearby", time: "Today at 10:42 AM" },
  { id: 2, type: "sign", title: "Design Lab — Room 204 read aloud", time: "Today at 10:38 AM" },
  { id: 3, type: "safe", title: "Clear path confirmed", time: "Today at 10:30 AM" },
  { id: 4, type: "session", title: "Morning session · 24 minutes", time: "Today at 8:15 AM" },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
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

// ─── Detection ───────────────────────────────────────────────────────────────

/**
 * Returns the latest object detections from the backend.
 * Falls back to mock data if the backend is not running.
 * Backend route: GET /api/detections
 */
export async function getDetectionResults(): Promise<DetectionResult[]> {
  const data = await get<DetectionResult[]>("/api/detections")
  return data ?? MOCK_DETECTIONS
}

/**
 * Sync version used by LivePage for instant first render.
 * Returns mock data immediately; real polling replaces this when backend is ready.
 */
export function getDetectionResultsSync(): DetectionResult[] {
  return MOCK_DETECTIONS
}

// ─── Activity ────────────────────────────────────────────────────────────────

/**
 * Returns recent activity items from the backend.
 * Falls back to mock data if the backend is not running.
 * Backend route: GET /api/activity
 */
export async function getActivity(): Promise<ActivityItem[]> {
  const data = await get<ActivityItem[]>("/api/activity")
  return data ?? MOCK_ACTIVITY
}

// ─── Contact form ─────────────────────────────────────────────────────────────

/**
 * Sends a contact message to the backend.
 * Backend route: POST /api/contact
 */
export async function submitContactMessage(message: {
  name: string
  email: string
  message: string
}): Promise<void> {
  const result = await post("/api/contact", message)
  if (result === null) {
    // Backend not available — silently succeed in demo mode
    await wait(600)
  }
}

// ─── Auth helpers (no backend — all local) ────────────────────────────────────

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
