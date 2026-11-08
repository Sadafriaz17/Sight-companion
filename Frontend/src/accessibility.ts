import { useEffect, useState } from "react"
import { getPreferences, updatePreferences, type Preferences as ApiPreferences } from "./api"
import { currentSession } from "./auth"

export type Preferences = {
  voiceOn: boolean
  contrast: boolean
  textSize: number
  rate: number
  volume: number
  voice: string
  reducedMotion: boolean
}

export const preferenceKey = "sight-companion:preferences"
export const defaultPreferences: Preferences = {
  voiceOn: true,
  contrast: false,
  textSize: 2,
  rate: 1,
  volume: 1,
  voice: "",
  reducedMotion: false,
}

function apiToLocal(api: ApiPreferences): Preferences {
  return {
    voiceOn: api.voice_on,
    contrast: api.contrast,
    textSize: api.text_size,
    rate: Number(api.rate),
    volume: Number(api.volume),
    voice: api.voice,
    reducedMotion: api.reduced_motion,
  }
}

function localToApi(local: Preferences): Partial<ApiPreferences> {
  return {
    voice_on: local.voiceOn,
    contrast: local.contrast,
    text_size: local.textSize,
    rate: local.rate,
    volume: local.volume,
    voice: local.voice,
    reduced_motion: local.reducedMotion,
    backend_speech: local.voiceOn,
  }
}

export function readPreferences(): Preferences {
  try {
    return { ...defaultPreferences, ...JSON.parse(localStorage.getItem(preferenceKey) ?? "{}") }
  } catch {
    return defaultPreferences
  }
}

export function applyPreferences(value: Preferences) {
  document.documentElement.dataset.contrast = value.contrast ? "high" : "normal"
  document.documentElement.dataset.textSize = String(value.textSize)
  document.documentElement.dataset.motion = value.reducedMotion ? "reduced" : "full"
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences)
  const [loading, setLoading] = useState(false)

  // Load from Supabase on mount if authenticated
  useEffect(() => {
    let mounted = true
    const session = currentSession()
    if (session && !session.isGuest) {
      setLoading(true)
      getPreferences()
        .then((apiPrefs) => {
          if (mounted && apiPrefs) {
            setPreferences(apiToLocal(apiPrefs))
          }
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    localStorage.setItem(preferenceKey, JSON.stringify(preferences))
    applyPreferences(preferences)

    // Sync to Supabase if authenticated
    const session = currentSession()
    if (session && !session.isGuest) {
      updatePreferences(localToApi(preferences)).catch(() => {
        // Silently fail - localStorage is the fallback
      })
    }
  }, [preferences])

  return { preferences, setPreferences, loading }
}
