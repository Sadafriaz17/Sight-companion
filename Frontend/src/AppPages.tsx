/**
 * AppPages.tsx — authenticated in-app pages
 *
 * LivePage architecture change
 * ----------------------------
 * The Python backend owns the physical camera (via OpenCV + YOLO).
 * The browser does NOT call getUserMedia() for the live feed.
 * Instead, LivePage:
 *   1. POSTs /api/camera/start  → backend opens the camera + AI pipeline
 *   2. Displays  <img src={STREAM_URL}>  → backend MJPEG stream
 *   3. Polls     /api/detections  every 2 s for structured results
 *   4. POSTs /api/camera/stop   when the user turns the camera off
 *
 * This avoids the "Camera access is blocked" error that occurred when both
 * the browser AND the Python process tried to open the same webcam.
 */

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import {
  STREAM_URL,
  startCamera,
  stopCamera,
  getDetectionResults,
  getDetectionResultsSync,
  triggerOcrRead,
  toggleSpeech,
  speakText,
  getActivity,
  getBackendStatus,
  type DetectionResult,
  type ActivityItem,
  type OcrResult,
} from "./api"
import { type Preferences } from "./accessibility"
import { speak, stopSpeaking } from "./voice"
import { PageLumi, goTo } from "./Pages"

// ─── Shared icon component ───────────────────────────────────────────────────

type IconName = "camera" | "mic" | "volume" | "stop" | "copy" | "search" | "shield" | "alert" | "check" | "ocr" | "refresh"
function AppIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    camera:  <><path d="M4 7h4l2-2h4l2 2h4v12H4z" /><circle cx="12" cy="13" r="4" /></>,
    mic:     <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    volume:  <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15 9a4 4 0 0 1 0 6" /></>,
    stop:    <rect x="6" y="6" width="12" height="12" rx="2" />,
    copy:    <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5H5v11h3" /></>,
    search:  <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
    shield:  <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    alert:   <><path d="M12 3 2 21h20z" /><path d="M12 9v5M12 17h.01" /></>,
    check:   <path d="m5 12 4 4L19 6" />,
    ocr:     <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h10M7 12h6M7 15h8" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{paths[name]}</svg>
}

function PageHead({ title, copy, mood = "happy" }: { title: string; copy: string; mood?: "happy" | "alert" | "listening" | "proud" }) {
  useEffect(() => speak(title), [title])
  return <header className="tool-head"><div><p className="eyebrow">SIGHT COMPANION</p><h1>{title}</h1><p>{copy}</p></div><PageLumi mood={mood} /></header>
}

// ─── LivePage ────────────────────────────────────────────────────────────────

type CamState = "off" | "starting" | "ready" | "error" | "backend-down"

export function LivePage() {
  const imgRef = useRef<HTMLImageElement>(null)
  const [camState, setCamState] = useState<CamState>("off")
  const [camError, setCamError]  = useState<string>("")
  const [backendUp, setBackendUp] = useState<boolean | null>(null)

  // Detections
  const [detections, setDetections] = useState<DetectionResult[]>(getDetectionResultsSync())
  const [loadingDet, setLoadingDet] = useState(false)

  // OCR
  const [ocrResults, setOcrResults] = useState<OcrResult[]>([])
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError]     = useState("")

  // Speech
  const [speechOn, setSpeechOn] = useState(true)

  // ── Check backend availability on mount & periodically ────────────────────
  useEffect(() => {
    let cancelled = false
    const check = () => {
      getBackendStatus().then((s) => {
        if (!cancelled) setBackendUp(s !== null)
      })
    }
    check()
    const interval = setInterval(check, 3000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // ── Poll detections while camera is running ───────────────────────────────
  useEffect(() => {
    if (camState !== "ready") return
    let cancelled = false
    const poll = async () => {
      setLoadingDet(true)
      const fresh = await getDetectionResults()
      if (!cancelled) {
        setDetections(fresh)
        setLoadingDet(false)
      }
    }
    void poll()
    const iv = window.setInterval(() => void poll(), 2000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [camState])

  // ── Camera controls ───────────────────────────────────────────────────────
  const handleStartCamera = async () => {
    setCamState("starting")
    setCamError("")
    const res = await startCamera()
    if (res.ok) {
      // Give the backend ~1 s to open the camera before the stream img loads
      await new Promise<void>((r) => setTimeout(r, 1000))
      setCamState("ready")
    } else {
      setCamError(res.message ?? "Failed to start camera.")
      setCamState("error")
    }
  }

  const handleStopCamera = async () => {
    await stopCamera()
    setDetections([])
    setCamState("off")
  }

  // ── OCR ──────────────────────────────────────────────────────────────────
  const handleOcrRead = async () => {
    setOcrLoading(true)
    setOcrError("")
    const res = await triggerOcrRead()
    setOcrLoading(false)
    if (res.ok) {
      setOcrResults(res.results)
      if (res.results.length === 0) setOcrError("No text found in the current frame.")
    } else {
      setOcrError("OCR failed. Make sure the camera is running.")
    }
  }

  // ── Speech toggle ─────────────────────────────────────────────────────────
  const handleSpeechToggle = async () => {
    const res = await toggleSpeech()
    setSpeechOn(res.speech_enabled)
  }

  // ── Derived UI values ─────────────────────────────────────────────────────
  const last = detections[0]?.message ?? "No objects detected."

  // ── Status messages ───────────────────────────────────────────────────────
  const stateLabel: Record<CamState, string> = {
    off:           "Camera is off",
    starting:      "Starting AI pipeline…",
    ready:         "Live",
    error:         "Camera error",
    "backend-down": "Backend not reachable",
  }

  const stateHint: Record<CamState, string> = {
    off:           backendUp === false
                    ? "The Python backend is not running. See the README for start instructions."
                    : "The AI processes your camera on this machine. Frames are never uploaded.",
    starting:      "Loading YOLO and depth models. This may take 10–30 seconds on first run.",
    ready:         "",
    error:         camError || "Check that no other app is using the camera.",
    "backend-down": "Start the backend with: python Backend/app.py",
  }

  return (
    <div className="page tool-page">
      <PageHead
        title="Live view"
        copy="Lumi sees through your camera and speaks what is nearby."
        mood={camState === "ready" ? "listening" : "happy"}
      />

      <div className="live-new-grid">

        {/* ── Camera panel ─────────────────────────────────────────────── */}
        <section className="new-card camera-new">
          <div className="camera-new-top">
            <strong>AI Camera</strong>
            {camState === "ready" && (
              <span className="live-status">Live</span>
            )}
            {loadingDet && camState === "ready" && (
              <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>updating…</span>
            )}
          </div>

          <div className="real-camera">
            {/* MJPEG stream from the Python backend */}
            {camState === "ready" && (
              <img
                ref={imgRef}
                id="live-stream"
                src={STREAM_URL}
                alt="Live annotated camera feed from AI backend"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            )}

            {/* Overlay shown when camera is off / loading / errored */}
            {camState !== "ready" && (
              <div className="camera-state" role="status">
                <AppIcon name="camera" />
                <h2>{stateLabel[camState]}</h2>
                <p>{stateHint[camState]}</p>
                {(camState === "off" || camState === "error") && backendUp !== false && (
                  <button
                    id="btn-start-camera"
                    className="primary-button"
                    onClick={() => void handleStartCamera()}
                  >
                    {camState === "error" ? "Try again" : "Start AI camera"}
                  </button>
                )}
                {camState === "starting" && (
                  <p style={{ marginTop: "0.5rem", opacity: 0.7, fontSize: "0.85rem" }}>
                    Loading AI models into memory…
                  </p>
                )}
                {backendUp === false && (
                  <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" }}>
                    <code style={{ fontSize: "0.8rem", opacity: 0.85, padding: "0.35rem 0.6rem", background: "rgba(0,0,0,0.3)", borderRadius: "6px" }}>
                      .\Sight-companion-ai\venv\Scripts\python.exe Backend\app.py
                    </code>
                    <button
                      className="primary-button"
                      style={{ fontSize: "0.85rem", padding: "0.35rem 0.9rem", marginTop: "0.25rem" }}
                      onClick={() => {
                        getBackendStatus().then((s) => {
                          setBackendUp(s !== null)
                          if (s !== null) handleStartCamera()
                        })
                      }}
                    >
                      Connect & Start
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action row */}
          <div className="camera-action-row">
            {camState === "ready" ? (
              <button
                id="btn-stop-camera"
                className="secondary-button"
                onClick={() => void handleStopCamera()}
              >
                Turn camera off
              </button>
            ) : null}

            <button
              id="btn-speech-toggle"
              className="secondary-button"
              onClick={() => void handleSpeechToggle()}
              title={speechOn ? "Mute backend voice" : "Unmute backend voice"}
            >
              <AppIcon name="volume" />
              {speechOn ? "Mute" : "Unmute"}
            </button>
          </div>
        </section>

        {/* ── Detection / OCR panel ────────────────────────────────────── */}
        <aside className="new-card detection-panel">
          <p className="eyebrow">WHAT LUMI SEES</p>

          {/* Latest alert banner */}
          <div className="danger-banner">
            <AppIcon name="alert" />
            <div>
              <strong>Guidance</strong>
              <p>{last}</p>
            </div>
          </div>

          {/* Detections list */}
          {detections.length > 0 ? (
            detections.map((item) => (
              <article className={`result-row ${item.level}`} key={item.label + item.direction}>
                <span>{item.level === "safe" ? "Safe" : item.level === "danger" ? "Danger" : "Careful"}</span>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.direction}</p>
                </div>
                <b>{item.distance !== "N/A" ? item.distance : ""}</b>
              </article>
            ))
          ) : (
            <div className="empty-inline">
              {camState === "ready"
                ? "No objects detected. Move camera slowly."
                : "Start the camera to see detections."}
            </div>
          )}

          {/* OCR section */}
          <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1rem" }}>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>TEXT RECOGNITION (OCR)</p>
            <button
              id="btn-ocr-read"
              className="secondary-button"
              onClick={() => void handleOcrRead()}
              disabled={ocrLoading || camState !== "ready"}
              style={{ marginBottom: "0.5rem" }}
            >
              <AppIcon name="ocr" />
              {ocrLoading ? "Reading…" : "Read text in frame"}
            </button>
            {ocrError && (
              <p role="alert" style={{ fontSize: "0.8rem", color: "var(--color-careful, #e07b39)", margin: "0.25rem 0" }}>
                {ocrError}
              </p>
            )}
            {ocrResults.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
                {ocrResults.map((r, i) => (
                  <li key={i} style={{ fontSize: "0.85rem", padding: "0.2rem 0", opacity: 0.9 }}>
                    "{r.text}" <span style={{ opacity: 0.5 }}>({Math.round(r.confidence * 100)}%)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Speech controls */}
          <div className="speech-controls" style={{ marginTop: "1rem" }}>
            <button
              id="btn-speak-last"
              onClick={() => void speakText(last)}
              disabled={camState !== "ready"}
            >
              <AppIcon name="volume" /> Repeat guidance
            </button>
            <button id="btn-stop-speech" onClick={stopSpeaking}>
              <AppIcon name="stop" /> Stop
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ─── AskPage ─────────────────────────────────────────────────────────────────

type Chat = { from: "you" | "lumi"; text: string }
const chatKey = "sight-companion:chats"

export function AskLumiPage() {
  const [messages, setMessages] = useState<Chat[]>(() => {
    try { return JSON.parse(localStorage.getItem(chatKey) || "[]") } catch { return [] }
  })
  const [text, setText] = useState("")
  const [status, setStatus] = useState<"ready" | "listening" | "thinking" | "speaking">("ready")

  const add = (msg: Chat) => setMessages((prev) => {
    const next = [...prev, msg]
    localStorage.setItem(chatKey, JSON.stringify(next.slice(-40)))
    return next
  })

  const ask = async (q = text.trim()) => {
    if (!q) return
    add({ from: "you", text: q })
    setText("")
    setStatus("thinking")

    // Simple rule-based replies using actual detection data
    let reply = "I'm not sure. Try pointing the camera at the area."

    // Fetch latest detections for context-aware replies
    const dets = await getDetectionResults()
    const ql = q.toLowerCase()

    if (ql.includes("front") || ql.includes("ahead") || ql.includes("see")) {
      if (dets.length === 0) reply = "I can't see anything right now. Make sure the camera is on."
      else reply = `I can see: ${dets.map((d) => `${d.label} ${d.direction}`).join(", ")}.`
    } else if (ql.includes("sign") || ql.includes("read") || ql.includes("text")) {
      const ocr = await triggerOcrRead()
      if (ocr.results.length > 0) reply = `I can read: ${ocr.results.map((r) => r.text).join("; ")}.`
      else reply = "I don't see any clear text right now."
    } else if (ql.includes("safe") || ql.includes("walk")) {
      const dangerous = dets.filter((d) => d.level === "danger" || d.level === "careful")
      if (dangerous.length === 0) reply = "The path looks clear. Walk with care."
      else reply = `Careful — I can see ${dangerous.map((d) => d.label + " " + d.direction).join(", ")}.`
    }

    setStatus("speaking")
    add({ from: "lumi", text: reply })
    speak(reply)
    await new Promise<void>((r) => setTimeout(r, 1200))
    setStatus("ready")
  }

  const listen = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert("Speech recognition is not supported in this browser. Please type your question."); return }
    const rec = new SR()
    rec.lang = "en-US"
    rec.onstart = () => setStatus("listening")
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript; setText(t); void ask(t) }
    rec.onerror = () => setStatus("ready")
    rec.onend = () => { if (status === "listening") setStatus("ready") }
    rec.start()
  }

  return (
    <div className="page tool-page">
      <PageHead title="Ask Lumi" copy="Ask a question with your voice or type it below." mood="listening" />
      <section className="new-card chat-card">
        <div className="quick-asks">
          {["What is in front of me?", "Read this sign", "Is it safe to walk?"].map((item) => (
            <button key={item} onClick={() => void ask(item)}>{item}</button>
          ))}
        </div>
        <div className="chat-log" aria-live="polite">
          {messages.length ? messages.map((message, index) => (
            <div className={`chat-bubble ${message.from}`} key={`${message.text}-${index}`}>
              <strong>{message.from === "you" ? "You" : "Lumi"}</strong>{message.text}
            </div>
          )) : (
            <div className="chat-empty">
              <PageLumi />
              <h2>What would you like to know?</h2>
              <p>Your chats stay on this device.</p>
            </div>
          )}
        </div>
        <p className="chat-status" role="status">
          {status === "ready" ? "Ready" : status === "listening" ? "Listening…" : status === "thinking" ? "Thinking…" : "Speaking…"}
        </p>
        <div className="ask-compose">
          <button className="voice-main" onClick={listen}><AppIcon name="mic" /> Speak to Lumi</button>
          <label>
            <span className="sr-only">Type your question</span>
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void ask() }} placeholder="Type your question" />
          </label>
          <button className="primary-button" onClick={() => void ask()}>Send</button>
        </div>
      </section>
    </div>
  )
}
export { AskLumiPage as AskPage }

// ─── SignsPage ────────────────────────────────────────────────────────────────

export function SignsPage() {
  const [query, setQuery] = useState("")
  const [ocrItems, setOcrItems] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    const res = await triggerOcrRead()
    if (res.ok && res.results.length > 0) {
      setOcrItems((prev) => {
        const next = [...new Set([...res.results.map((r) => r.text), ...prev])]
        return next.slice(0, 20)
      })
    }
    setLoading(false)
  }

  const filtered = ocrItems.filter((item) => item.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="page tool-page">
      <PageHead title="Signs" copy="Find text Lumi has read for you." />
      <label className="search-large">
        <AppIcon name="search" />
        <span className="sr-only">Search signs</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search signs and text" />
      </label>
      <div style={{ marginBottom: "1rem" }}>
        <button id="btn-refresh-ocr" className="secondary-button" onClick={() => void refresh()} disabled={loading}>
          <AppIcon name="refresh" /> {loading ? "Reading…" : "Scan for text now"}
        </button>
      </div>
      <section className="sign-list">
        {filtered.length ? filtered.map((item, index) => (
          <article className="new-card sign-card" key={item}>
            <span>Read {index + 1}</span>
            <h2>{item}</h2>
            <div>
              <button onClick={() => speak(item, true)}><AppIcon name="volume" /> Read again</button>
              <button onClick={() => void navigator.clipboard.writeText(item)}><AppIcon name="copy" /> Copy</button>
            </div>
          </article>
        )) : (
          <div className="new-empty">
            <PageLumi mood="listening" />
            <h2>No signs found</h2>
            <p>Click "Scan for text now" with the camera running, or use Live view.</p>
            <button className="primary-button" onClick={() => goTo("live")}>Open Live view</button>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── SafetyPage ───────────────────────────────────────────────────────────────

export function SafetyPage() {
  const [sound, setSound] = useState(true)
  const [vibrate, setVibrate] = useState(true)
  const [sensitivity, setSensitivity] = useState(2)

  const test = () => {
    speak("Danger. An object is very close.", true)
    if (sound) {
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      oscillator.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.25)
    }
    if (vibrate) navigator.vibrate?.([180, 80, 180])
  }

  return (
    <div className="page tool-page">
      <PageHead title="Safety" copy="Choose how Lumi warns you when something is close." mood="alert" />
      <div className="safety-levels">
        {[
          ["safe", "Safe", "The path is clear."],
          ["careful", "Careful", "Something is nearby."],
          ["danger", "Danger", "Stop. Something is very close."],
        ].map(([level, title, copy]) => (
          <article className={`new-card level-${level}`} key={level}>
            <AppIcon name={level === "safe" ? "check" : "alert"} />
            <strong>{title}</strong>
            <p>{copy}</p>
          </article>
        ))}
      </div>
      <div className="settings-layout">
        <section className="new-card safety-settings">
          <h2>Alert choices</h2>
          <label>
            <span><strong>Alert sound</strong><small>Play a clear warning sound.</small></span>
            <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
          </label>
          <label>
            <span><strong>Vibration</strong><small>Vibrate on supported phones.</small></span>
            <input type="checkbox" checked={vibrate} onChange={(e) => setVibrate(e.target.checked)} />
          </label>
          <label className="range-label">
            <strong>Alert sensitivity: {["Low", "Medium", "High"][sensitivity - 1]}</strong>
            <input type="range" min="1" max="3" value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} />
          </label>
          <button className="primary-button" onClick={test}>Test alert</button>
        </section>
        <section className="new-card future-sensors">
          <h2>Future connections</h2>
          {["Distance sensor", "Sound based detector"].map((item) => (
            <article key={item}>
              <AppIcon name="shield" />
              <div><strong>{item}</strong><p>Not connected yet</p></div>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}

// ─── ActivityPage ─────────────────────────────────────────────────────────────

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
        {loading && <p role="status" style={{ padding: "1rem", opacity: 0.6 }}>Loading activity…</p>}
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

// ─── SettingsPage ─────────────────────────────────────────────────────────────

export function SettingsPage({ preferences, setPreferences }: { preferences: Preferences; setPreferences: Dispatch<SetStateAction<Preferences>> }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    const load = () => setVoices(speechSynthesis.getVoices())
    load()
    speechSynthesis.addEventListener("voiceschanged", load)
    return () => speechSynthesis.removeEventListener("voiceschanged", load)
  }, [])
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setPreferences((old) => ({ ...old, [key]: value }))

  return (
    <div className="page tool-page">
      <PageHead title="Settings" copy="Make Sight Companion comfortable for you." />
      <div className="settings-layout">
        <section className="new-card settings-form">
          <h2>Voice</h2>
          <label className="choice-row">
            <span><strong>Voice guidance</strong><small>Speak messages and page titles.</small></span>
            <input type="checkbox" checked={preferences.voiceOn} onChange={(e) => update("voiceOn", e.target.checked)} />
          </label>
          <label>Voice choice
            <select value={preferences.voice} onChange={(e) => update("voice", e.target.value)}>
              <option value="">Device default</option>
              {voices.map((voice) => <option key={voice.name}>{voice.name}</option>)}
            </select>
          </label>
          <label>Voice speed: {preferences.rate.toFixed(1)}
            <input type="range" min=".5" max="2" step=".1" value={preferences.rate} onChange={(e) => update("rate", Number(e.target.value))} />
          </label>
          <label>Voice volume: {Math.round(preferences.volume * 100)}%
            <input type="range" min="0" max="1" step=".1" value={preferences.volume} onChange={(e) => update("volume", Number(e.target.value))} />
          </label>
          <button className="secondary-button" onClick={() => speak("Hello, I'm Lumi. This is how I sound.", true)}>Preview voice</button>
        </section>
        <section className="new-card settings-form">
          <h2>Display and movement</h2>
          <label className="choice-row">
            <span><strong>High contrast</strong><small>Make text and borders stronger.</small></span>
            <input type="checkbox" checked={preferences.contrast} onChange={(e) => update("contrast", e.target.checked)} />
          </label>
          <label>Text size: {["Standard", "Large", "Extra large"][preferences.textSize - 1]}
            <input type="range" min="1" max="3" value={preferences.textSize} onChange={(e) => update("textSize", Number(e.target.value))} />
          </label>
          <label className="choice-row">
            <span><strong>Reduced motion</strong><small>Remove moving effects.</small></span>
            <input type="checkbox" checked={preferences.reducedMotion} onChange={(e) => update("reducedMotion", e.target.checked)} />
          </label>
        </section>
      </div>
    </div>
  )
}
