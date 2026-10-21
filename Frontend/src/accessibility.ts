import { useEffect, useState } from "react"

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
  const [preferences, setPreferences] = useState(readPreferences)
  useEffect(() => {
    localStorage.setItem(preferenceKey, JSON.stringify(preferences))
    applyPreferences(preferences)
  }, [preferences])
  return { preferences, setPreferences }
}
