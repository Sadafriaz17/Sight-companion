import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { getDetectionResultsSync, getDetectionResults, getActivity, type ActivityItem } from "./api"
import { type Preferences } from "./accessibility"
import { speak, stopSpeaking } from "./voice"
import { PageLumi, goTo } from "./Pages"

type IconName = "camera" | "mic" | "volume" | "stop" | "copy" | "search" | "shield" | "alert" | "check"
function AppIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    camera: <><path d="M4 7h4l2-2h4l2 2h4v12H4z" /><circle cx="12" cy="13" r="4" /></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    volume: <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15 9a4 4 0 0 1 0 6" /></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5H5v11h3" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    alert: <><path d="M12 3 2 21h20z" /><path d="M12 9v5M12 17h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{paths[name]}</svg>
}

function PageHead({ title, copy, mood = "happy" }: { title: string; copy: string; mood?: "happy" | "alert" | "listening" | "proud" }) {
  useEffect(() => speak(title), [title])
  return <header className="tool-head"><div><p className="eyebrow">SIGHT COMPANION</p><h1>{title}</h1><p>{copy}</p></div><PageLumi mood={mood} /></header>
}

export function LivePage() {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [state, setState] = useState<"off" | "asking" | "loading" | "ready" | "denied" | "lost">("off")
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState("")
  const [facing, setFacing] = useState<"environment" | "user">("environment")
  const [muted, setMuted] = useState(false)
  // Start with sync mock data for instant render; polling updates asynchronously
  const [detections, setDetections] = useState(getDetectionResultsSync())
  const [loadingDetections, setLoadingDetections] = useState(false)

  // Poll for fresh detections from the backend every 3 seconds when camera is on
  useEffect(() => {
    if (state !== "ready") return
    let cancelled = false
    const poll = async () => {
      setLoadingDetections(true)
      const fresh = await getDetectionResults()
      if (!cancelled) setDetections(fresh)
      setLoadingDetections(false)
    }
    void poll()
    const interval = window.setInterval(() => void poll(), 3000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [state])

  const last = detections[0]?.message ?? "No objects detected."

  const stopCamera = () => {
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    setState("off")
  }
  const startCamera = async (nextFacing = facing, chosen = deviceId) => {
    if (!navigator.mediaDevices?.getUserMedia) return setState("lost")
    setState("asking")
    try {
      stream.current?.getTracks().forEach((track) => track.stop())
      setState("loading")
      const media = await navigator.mediaDevices.getUserMedia({ video: chosen ? { deviceId: { exact: chosen } } : { facingMode: { ideal: nextFacing } }, audio: false })
      stream.current = media
      if (video.current) {
        video.current.srcObject = media
        await video.current.play()
      }
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((item) => item.kind === "videoinput"))
      media.getVideoTracks()[0]?.addEventListener("ended", () => setState("lost"))
      setState("ready")
      if (!muted) speak(last)
    } catch {
      setState("denied")
    }
  }
  useEffect(() => () => stream.current?.getTracks().forEach((track) => track.stop()), [])

  return <div className="page tool-page"><PageHead title="Live view" copy="Point your camera ahead. Lumi will speak what is nearby." mood={state === "ready" ? "listening" : "happy"} />
    <div className="live-new-grid"><section className="new-card camera-new"><div className="camera-new-top"><strong>Camera</strong><select aria-label="Choose camera" value={deviceId} onChange={(event) => { setDeviceId(event.target.value); void startCamera(facing, event.target.value) }}><option value="">Automatic camera</option>{devices.map((item, index) => <option value={item.deviceId} key={item.deviceId}>{item.label || `Camera ${index + 1}`}</option>)}</select></div>
      <div className="real-camera"><video ref={video} playsInline muted />
        {state !== "ready" && <div className="camera-state" role="status"><AppIcon name="camera" /><h2>{state === "off" ? "Camera is off" : state === "asking" ? "Allow camera access" : state === "loading" ? "Starting camera" : state === "denied" ? "Camera access is blocked" : "Camera connection lost"}</h2><p>{state === "denied" ? "Open your browser settings, allow Camera for this site, then try again." : state === "lost" ? "Check your camera, then reconnect." : "Your camera picture stays on this device."}</p><button className="primary-button" onClick={() => void startCamera()}>{state === "off" ? "Turn on camera" : "Try again"}</button></div>}
        {state === "ready" && <span className="live-status">Live picture</span>}
      </div>
      <div className="camera-action-row">{state === "ready" ? <button className="secondary-button" onClick={stopCamera}>Turn camera off</button> : null}<button className="secondary-button switch-camera" onClick={() => { const next = facing === "environment" ? "user" : "environment"; setFacing(next); void startCamera(next, "") }}>Switch camera</button></div>
    </section>
    <aside className="new-card detection-panel"><p className="eyebrow">WHAT LUMI SEES {loadingDetections && <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>updating…</span>}</p><div className="danger-banner"><AppIcon name="alert" /><div><strong>Careful</strong><p>{last}</p></div></div>{detections.length ? detections.map((item) => <article className={`result-row ${item.level}`} key={item.label}><span>{item.level === "safe" ? "Safe" : "Careful"}</span><div><strong>{item.label}</strong><p>{item.direction}</p></div><b>{item.distance}</b></article>) : <div className="empty-inline">No objects found. Move the camera slowly.</div>}
      <div className="speech-controls"><button onClick={() => speak(last, true)}><AppIcon name="volume" /> Repeat last message</button><button onClick={() => { setMuted(!muted); if (!muted) stopSpeaking() }}><AppIcon name="volume" /> {muted ? "Unmute" : "Mute"}</button><button onClick={stopSpeaking}><AppIcon name="stop" /> Stop</button></div>
    </aside></div>
  </div>
}

type Chat = { from: "you" | "lumi"; text: string }
const chatKey = "sight-companion:chats"
export function AskLumiPage() {
  const [messages, setMessages] = useState<Chat[]>(() => { try { return JSON.parse(localStorage.getItem(chatKey) ?? "[]") } catch { return [] } })
  const [text, setText] = useState("")
  const [status, setStatus] = useState<"ready" | "listening" | "thinking" | "speaking">("ready")
  useEffect(() => localStorage.setItem(chatKey, JSON.stringify(messages)), [messages])
  const ask = (question = text) => {
    if (!question.trim()) return
    setMessages((old) => [...old, { from: "you", text: question }]); setText(""); setStatus("thinking")
    window.setTimeout(() => {
      const answer = question.toLowerCase().includes("safe") ? "The path looks clear, but keep listening for nearby alerts." : question.toLowerCase().includes("sign") ? "The sign says: Design Lab, Room 204." : "There is a chair slightly left, a backpack to the right, and a door ahead."
      setMessages((old) => [...old, { from: "lumi", text: answer }]); setStatus("speaking"); speak(answer, false, () => setStatus("ready"))
      window.setTimeout(() => setStatus("ready"), 3500)
    }, 700)
  }
  const listen = () => {
    const SpeechRecognition = (window as unknown as { webkitSpeechRecognition?: new () => { lang: string; start: () => void; onresult: (event: { results: { 0: { 0: { transcript: string } } }[] }) => void; onerror: () => void } }).webkitSpeechRecognition
    if (!SpeechRecognition) return setStatus("ready")
    const recognition = new SpeechRecognition(); recognition.lang = "en-US"; setStatus("listening")
    recognition.onresult = (event) => { const words = event.results[0][0].transcript; setText(words); ask(words) }
    recognition.onerror = () => setStatus("ready"); recognition.start()
  }
  return <div className="page tool-page"><PageHead title="Ask Lumi" copy="Ask a question with your voice or type it below." mood="listening" /><section className="new-card chat-card"><div className="quick-asks">{["What is in front of me?", "Read this sign", "Is it safe to walk?"].map((item) => <button key={item} onClick={() => ask(item)}>{item}</button>)}</div><div className="chat-log" aria-live="polite">{messages.length ? messages.map((message, index) => <div className={`chat-bubble ${message.from}`} key={`${message.text}-${index}`}><strong>{message.from === "you" ? "You" : "Lumi"}</strong>{message.text}</div>) : <div className="chat-empty"><PageLumi /><h2>What would you like to know?</h2><p>Your chats stay on this device.</p></div>}</div><p className="chat-status" role="status">{status === "ready" ? "Ready" : status === "listening" ? "Listening…" : status === "thinking" ? "Thinking…" : "Speaking…"}</p><div className="ask-compose"><button className="voice-main" onClick={listen}><AppIcon name="mic" /> Speak to Lumi</button><label><span className="sr-only">Type your question</span><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") ask() }} placeholder="Type your question" /></label><button className="primary-button" onClick={() => ask()}>Send</button></div></section></div>
}

const signItems = ["Design Lab — Room 204", "Exit — Keep clear", "Platform 2"]
export function SignsPage() {
  const [query, setQuery] = useState("")
  const filtered = signItems.filter((item) => item.toLowerCase().includes(query.toLowerCase()))
  return <div className="page tool-page"><PageHead title="Signs" copy="Find text Lumi has read for you." /><label className="search-large"><AppIcon name="search" /><span className="sr-only">Search signs</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search signs and text" /></label><section className="sign-list">{filtered.length ? filtered.map((item, index) => <article className="new-card sign-card" key={item}><span>Read {index + 1}</span><h2>{item}</h2><div><button onClick={() => speak(item, true)}><AppIcon name="volume" /> Read again</button><button onClick={() => void navigator.clipboard.writeText(item)}><AppIcon name="copy" /> Copy</button></div></article>) : <div className="new-empty"><PageLumi mood="listening" /><h2>No signs found</h2><p>Try another search, or use Live view to read a sign.</p><button className="primary-button" onClick={() => goTo("live")}>Open Live view</button></div>}</section></div>
}

export function SafetyPage() {
  const [sound, setSound] = useState(true), [vibrate, setVibrate] = useState(true), [sensitivity, setSensitivity] = useState(2)
  const test = () => {
    speak("Danger. An object is very close.", true)
    if (sound) { const context = new AudioContext(); const oscillator = context.createOscillator(); oscillator.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .25) }
    if (vibrate) navigator.vibrate?.([180, 80, 180])
  }
  return <div className="page tool-page"><PageHead title="Safety" copy="Choose how Lumi warns you when something is close." mood="alert" /><div className="safety-levels">{[["safe","Safe","The path is clear."],["careful","Careful","Something is nearby."],["danger","Danger","Stop. Something is very close."]].map(([level,title,copy]) => <article className={`new-card level-${level}`} key={level}><AppIcon name={level === "safe" ? "check" : "alert"} /><strong>{title}</strong><p>{copy}</p></article>)}</div><div className="settings-layout"><section className="new-card safety-settings"><h2>Alert choices</h2><label><span><strong>Alert sound</strong><small>Play a clear warning sound.</small></span><input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} /></label><label><span><strong>Vibration</strong><small>Vibrate on supported phones.</small></span><input type="checkbox" checked={vibrate} onChange={(event) => setVibrate(event.target.checked)} /></label><label className="range-label"><strong>Alert sensitivity: {["Low","Medium","High"][sensitivity - 1]}</strong><input type="range" min="1" max="3" value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} /></label><button className="primary-button" onClick={test}>Test alert</button></section><section className="new-card future-sensors"><h2>Future connections</h2>{["Distance sensor","Sound based detector"].map((item) => <article key={item}><AppIcon name="shield" /><div><strong>{item}</strong><p>Not connected yet</p></div></article>)}</section></div></div>
}

export function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getActivity()
      .then((data) => { if (!cancelled) { setItems(data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const typeLabel: Record<ActivityItem["type"], string> = {
    object: "Careful",
    sign: "Sign",
    safe: "Safe",
    session: "Session",
  }

  return (
    <div className="page tool-page">
      <PageHead title="Activity" copy="Review recent sessions, signs, and safety alerts." mood="proud" />
      <section className="new-card activity-combined">
        {loading && (
          <p role="status" style={{ padding: "1rem", opacity: 0.6 }}>Loading activity…</p>
        )}
        {error && (
          <p role="alert" style={{ padding: "1rem", color: "var(--color-careful, #e07b39)" }}>
            Could not load activity right now. Please try again later.
          </p>
        )}
        {!loading && !error && items.map((item) => (
          <article key={item.id}>
            <span>{typeLabel[item.type]}</span>
            <div>
              <h2>{item.title}</h2>
              <p>{item.time}</p>
            </div>
          </article>
        ))}
        {!loading && !error && items.length === 0 && (
          <p style={{ padding: "1rem", opacity: 0.6 }}>No activity yet. Start a live session to see records here.</p>
        )}
      </section>
    </div>
  )
}

export function SettingsPage({ preferences, setPreferences }: { preferences: Preferences; setPreferences: Dispatch<SetStateAction<Preferences>> }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => { const load = () => setVoices(speechSynthesis.getVoices()); load(); speechSynthesis.addEventListener("voiceschanged", load); return () => speechSynthesis.removeEventListener("voiceschanged", load) }, [])
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences((old) => ({ ...old, [key]: value }))
  return <div className="page tool-page"><PageHead title="Settings" copy="Make Sight Companion comfortable for you." /><div className="settings-layout"><section className="new-card settings-form"><h2>Voice</h2><label className="choice-row"><span><strong>Voice guidance</strong><small>Speak messages and page titles.</small></span><input type="checkbox" checked={preferences.voiceOn} onChange={(event) => update("voiceOn", event.target.checked)} /></label><label>Voice choice<select value={preferences.voice} onChange={(event) => update("voice", event.target.value)}><option value="">Device default</option>{voices.map((voice) => <option key={voice.name}>{voice.name}</option>)}</select></label><label>Voice speed: {preferences.rate.toFixed(1)}<input type="range" min=".5" max="2" step=".1" value={preferences.rate} onChange={(event) => update("rate", Number(event.target.value))} /></label><label>Voice volume: {Math.round(preferences.volume * 100)}%<input type="range" min="0" max="1" step=".1" value={preferences.volume} onChange={(event) => update("volume", Number(event.target.value))} /></label><button className="secondary-button" onClick={() => speak("Hello, I'm Lumi. This is how I sound.", true)}>Preview voice</button></section><section className="new-card settings-form"><h2>Display and movement</h2><label className="choice-row"><span><strong>High contrast</strong><small>Make text and borders stronger.</small></span><input type="checkbox" checked={preferences.contrast} onChange={(event) => update("contrast", event.target.checked)} /></label><label>Text size: {["Standard","Large","Extra large"][preferences.textSize - 1]}<input type="range" min="1" max="3" value={preferences.textSize} onChange={(event) => update("textSize", Number(event.target.value))} /></label><label className="choice-row"><span><strong>Reduced motion</strong><small>Remove moving effects.</small></span><input type="checkbox" checked={preferences.reducedMotion} onChange={(event) => update("reducedMotion", event.target.checked)} /></label></section></div></div>
}
