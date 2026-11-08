import { supabase } from "./supabase"

export type Session = {
  id: string
  name: string
  email: string
  isGuest: boolean
}

const SESSION_KEY = "sight-companion:session"

let cachedSession: Session | null = null
const listeners = new Set<(s: Session | null) => void>()

function mapUser(user: any): Session {
  return {
    id: user.id,
    name:
      (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
      (user.email ? user.email.split("@")[0] : "User"),
    email: user.email ?? "",
    isGuest: false,
  }
}

function setCached(session: Session | null) {
  cachedSession = session
  if (session) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch {}
  } else {
    try { localStorage.removeItem(SESSION_KEY) } catch {}
  }
  listeners.forEach((fn) => fn(session))
}

try {
  const raw = localStorage.getItem(SESSION_KEY)
  if (raw) cachedSession = JSON.parse(raw) as Session
} catch {
  cachedSession = null
}

export function currentSession(): Session | null {
  return cachedSession
}

export function onAuthChange(cb: (s: Session | null) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
/** Update the cached session and notify listeners (e.g. after a profile edit). */
export function updateSession(session: Session): void {
  setCached(session)
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    setCached(data.session ? mapUser(data.session.user) : null)
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    setCached(session ? mapUser(session.user) : null)
  })
}

export async function signUp(name: string, email: string, password: string): Promise<Session> {
  if (!supabase) throw new Error("AUTH_UNAVAILABLE")
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { full_name: name.trim() } },
  })
  if (error) throw error
  if (!data.user) throw new Error("SIGNUP_FAILED")
  const session = mapUser(data.user)
  setCached(session)
  return session
}

export async function signIn(email: string, password: string, _keepSignedIn: boolean): Promise<Session> {
  if (!supabase) throw new Error("AUTH_UNAVAILABLE")
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw error
  if (!data.user) throw new Error("INVALID_CREDENTIALS")
  const session = mapUser(data.user)
  setCached(session)
  return session
}

export function signOut(): void {
  if (supabase) {
    supabase.auth.signOut().catch(() => {})
  }
  setCached(null)
}

export function guestSession(): Session {
  const session: Session = { id: "guest", name: "Guest", email: "Offline demo", isGuest: true }
  setCached(session)
  return session
}
