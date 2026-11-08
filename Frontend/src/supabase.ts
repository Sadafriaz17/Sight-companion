import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  // Keep the app usable in offline/demo mode, but log the misconfiguration.
  console.warn("Supabase env vars are missing; authentication and persistence are disabled.")
}

export const supabase = url && key ? createClient(url, key) : null

export function isSupabaseConfigured(): boolean {
  return Boolean(supabase)
}
