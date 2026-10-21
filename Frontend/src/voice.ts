import { readPreferences } from "./accessibility"

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
}

export function speak(text: string, force = false, onEnd?: () => void) {
  const settings = readPreferences()
  if (!force && !settings.voiceOn) return
  stopSpeaking()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = settings.rate
  utterance.volume = settings.volume
  const selected = speechSynthesis.getVoices().find((voice) => voice.name === settings.voice)
  if (selected) utterance.voice = selected
  if (onEnd) utterance.onend = onEnd
  speechSynthesis.speak(utterance)
}
