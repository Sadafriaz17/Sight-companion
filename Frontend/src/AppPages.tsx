/**
 * Authenticated application pages. LivePage owns the visitor's device camera
 * in the browser and sends sampled JPEG frames to Flask for real AI inference.
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import {
  getApiBase,
  startCamera,
  stopCamera,
  getDetectionResults,
  inferCameraFrame,
  getDetectionResultsSync,
  triggerOcrRead,
  toggleSpeech,
  speakText,
  getActivityHistory,
  getOcrHistory,
  getBackendStatus,
  type BackendStatus,
  type DetectionResult,
  type OcrResult,
} from "./api"
import { type Preferences } from "./accessibility"
import { preferenceKey, readPreferences } from "./accessibility"
import { speak, stopSpeaking } from "./voice"
import { PageLumi, goTo } from "./Pages"
// â”€â”€â”€ Shared icon component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
// â”€â”€â”€ LivePage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// --- LumiChatPanel -----------------------------------------------------------
// Shared Lumi chat/voice panel reused in LivePage's right panel.
type Chat = { from: "you" | "lumi"; text: string }
const liveChatKey = "sight-companion:live-chats"

function LumiChatPanel({ camReady, compact }: { camReady: boolean; compact?: boolean }) {
  const [messages, setMessages] = useState<Chat[]>(() => {
    try { return JSON.parse(localStorage.getItem(liveChatKey) || "[]") } catch { return [] }
  })
  const [text, setText] = useState("")
  const [status, setStatus] = useState<"ready" | "listening" | "thinking" | "speaking">("ready")
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, status])

  const add = (msg: Chat) => setMessages((prev) => {
    const next = [...prev, msg]
    localStorage.setItem(liveChatKey, JSON.stringify(next.slice(-40)))
    return next
  })

  const ask = async (q = text.trim()) => {
    if (!q) return
    add({ from: "you", text: q })
    setText("")
    setStatus("thinking")
    const dets = await getDetectionResults()
    const ql = q.toLowerCase()
    let reply = "I am not sure. Try pointing the camera at the area and ask again."
    if (ql.includes("front") || ql.includes("ahead") || ql.includes("see") || ql.includes("surround") || ql.includes("descri")) {
      if (dets.length === 0) reply = camReady ? "I can't detect anything right now. Move the camera slowly." : "Start the camera first so I can see your surroundings."
      else reply = "I can see: " + dets.map((d) => d.label + " " + d.direction + (d.distance !== "N/A" ? " (" + d.distance + ")" : "")).join(", ") + "."
    } else if (ql.includes("sign") || ql.includes("read") || ql.includes("text")) {
      const ocr = await triggerOcrRead()
      if (ocr.results.length > 0) reply = "I can read: " + ocr.results.map((r) => r.text).join("; ") + "."
      else reply = "I don't see any clear text right now."
    } else if (ql.includes("safe") || ql.includes("walk") || ql.includes("obstacle") || ql.includes("path")) {
      const dangerous = dets.filter((d) => d.level === "danger" || d.level === "careful")
      if (dangerous.length === 0) reply = dets.length === 0 ? (camReady ? "I don't see any objects. Keep moving carefully." : "Start the camera so I can check your path.") : "The path looks clear. Walk with care."
      else reply = "Careful - I can see " + dangerous.map((d) => d.label + " " + d.direction).join(", ") + "."
    } else if (ql.includes("repeat") || ql.includes("say again")) {
      const lastLumi = [...messages].reverse().find((m) => m.from === "lumi")
      reply = lastLumi ? lastLumi.text : "Nothing to repeat yet."
    } else if (ql.includes("danger") || ql.includes("warning") || ql.includes("close") || ql.includes("near")) {
      const danger = dets.filter((d) => d.level === "danger")
      if (danger.length === 0) reply = "No dangerous objects detected right now."
      else reply = "Warning: " + danger.map((d) => d.label + " is " + d.direction + (d.distance !== "N/A" ? " at " + d.distance : "")).join("; ") + "."
    } else if (dets.length > 0) {
      reply = "Based on what I can see - " + dets.map((d) => d.label + " " + d.direction).join(", ") + " - I am not sure how to answer that. Try asking what is in front of me or is it safe to walk."
    }
    setStatus("speaking")
    add({ from: "lumi", text: reply })
    speak(reply)
    await new Promise<void>((r) => setTimeout(r, 1200))
    setStatus("ready")
  }

  const listen = () => {
    type SRCtor = new () => { lang: string; onstart: (() => void) | null; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void }
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) { alert("Speech recognition is not supported in this browser. Please type your question."); return }
    const rec = new SR()
    rec.lang = "en-US"
    rec.onstart = () => setStatus("listening")
    rec.onresult = (e) => { const t = e.results[0][0].transcript; setText(t); void ask(t) }
    rec.onerror = () => setStatus("ready")
    rec.onend = () => { if (status === "listening") setStatus("ready") }
    rec.start()
  }

  const quickAsks = ["What is in front of me?", "Read this sign", "Is it safe to walk?", "Describe my surroundings"]

  return (
    <div className={compact ? "lcp lcp-compact" : "lcp"}>

      {/* Quick suggestion chips */}
      <div className="lcp-chips">
        {["What's in front of me?", "Read this sign", "Safe to walk?", "Describe surroundings"].map((item) => (
          <button key={item} className="lcp-chip" onClick={() => void ask(item)} disabled={status === "thinking"}>
            {item}
          </button>
        ))}
      </div>

      {/* Scrollable chat area */}
      <div className="lcp-messages" aria-live="polite" role="log">
        {messages.length === 0 && status !== "thinking" && (
          <div className="lcp-empty">
            <div className="lcp-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                <path d="M8 12s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>
              </svg>
            </div>
            <p className="lcp-empty-title">Hi, I'm Lumi</p>
            <p className="lcp-empty-hint">{camReady ? "Camera is live. Ask me anything about what I see." : "Start the camera, then ask me anything."}</p>
          </div>
        )}
        {messages.map((message, index) => (
          <div className={`lcp-bubble lcp-bubble-${message.from}`} key={`${message.text}-${index}`}>
            <div className="lcp-bubble-label">{message.from === "you" ? "You" : "Lumi"}</div>
            <div className="lcp-bubble-text">{message.text}</div>
          </div>
        ))}
        {status === "thinking" && (
          <div className="lcp-bubble lcp-bubble-lumi">
            <div className="lcp-bubble-label">Lumi</div>
            <div className="lcp-bubble-text">
              <span className="lcp-dots" aria-label="Lumi is thinking">
                <span /><span /><span />
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Status bar */}
      <div className="lcp-statusbar" role="status" aria-live="polite">
        <span className={`lcp-status-dot lcp-status-${status}`} />
        <span>{status === "ready" ? "Ready" : status === "listening" ? "Listening..." : status === "thinking" ? "Thinking..." : "Speaking..."}</span>
      </div>

      {/* Input row */}
      <div className="lcp-input-row">
        <button
          className={`lcp-mic${status === "listening" ? " lcp-mic-active" : ""}`}
          onClick={listen}
          aria-label={status === "listening" ? "Listening..." : "Speak to Lumi"}
          title={status === "listening" ? "Listening..." : "Tap to speak"}
          disabled={status === "thinking"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        <input
          className="lcp-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void ask() }}
          placeholder="Ask Lumi..."
          aria-label="Type your question"
          disabled={status === "thinking"}
        />
        <button
          className="lcp-send"
          onClick={() => void ask()}
          disabled={status === "thinking" || !text.trim()}
          aria-label="Send message"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"/>
          </svg>
        </button>
        <button
          className="lcp-stop"
          onClick={stopSpeaking}
          aria-label="Stop speaking"
          title="Stop Lumi speaking"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
type CamState = "checking" | "backend-down" | "off" | "starting" | "ready" | "error"

export function LivePage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameBusyRef = useRef(false)
  const lastSpokenRef = useRef("")
  const lastSpokenAtRef = useRef(0)
  const [camState, setCamState] = useState<CamState>("off")
  const [camError, setCamError] = useState("")
  const [backendUp, setBackendUp] = useState<boolean | null>(null)
  const [frameError, setFrameError] = useState("")
  const [detections, setDetections] = useState<DetectionResult[]>([])
  const [ocrResults, setOcrResults] = useState<OcrResult[]>([])
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState("")
  const [speechOn, setSpeechOn] = useState(true)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")

  const stopDeviceCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const startDeviceCamera = useCallback(async (mode = facingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support camera access.")
    stopDeviceCamera()
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })
    streamRef.current = stream
    if (!videoRef.current) throw new Error("Camera preview is unavailable.")
    videoRef.current.srcObject = stream
    await videoRef.current.play()
  }, [facingMode, stopDeviceCamera])

  const drawDetections = useCallback((items: DetectionResult[], sourceWidth: number, sourceHeight: number) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || !sourceWidth || !sourceHeight) return
    const rect = video.getBoundingClientRect()
    // Match CSS object-fit: cover: scale uniformly and account for cropped edges.
    const scale = Math.max(rect.width / sourceWidth, rect.height / sourceHeight)
    const offsetX = (rect.width - sourceWidth * scale) / 2
    const offsetY = (rect.height - sourceHeight * scale) / 2
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(rect.width * dpr))
    canvas.height = Math.max(1, Math.round(rect.height * dpr))
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, rect.width, rect.height)
    ctx.font = "600 14px system-ui, sans-serif"
    items.forEach((item) => {
      const [x1, y1, x2, y2] = item.box
      const x = x1 * scale + offsetX, y = y1 * scale + offsetY, width = (x2 - x1) * scale, height = (y2 - y1) * scale
      const color = item.level === "danger" ? "#ff6b6b" : item.level === "careful" ? "#ffc857" : "#70e3b2"
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(x, y, width, height)
      const label = `${item.label || item.name || "object"} ${Math.round(item.confidence * 100)}%`
      const labelWidth = ctx.measureText(label).width + 14
      ctx.fillStyle = color; ctx.fillRect(x, Math.max(0, y - 26), labelWidth, 24)
      ctx.fillStyle = "#211a2c"; ctx.fillText(label, x + 7, Math.max(17, y - 9))
    })
  }, [])

  const sendFrame = useCallback(async () => {
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || frameBusyRef.current) return
    const capture = document.createElement("canvas")
    const maxWidth = 960
    const scale = Math.min(1, maxWidth / video.videoWidth)
    capture.width = Math.max(1, Math.round(video.videoWidth * scale))
    capture.height = Math.max(1, Math.round(video.videoHeight * scale))
    capture.getContext("2d")?.drawImage(video, 0, 0, capture.width, capture.height)
    frameBusyRef.current = true
    await new Promise<void>((resolve) => capture.toBlob(async (blob) => {
      if (blob) {
        const result = await inferCameraFrame(blob)
        if (result?.ok) {
          setFrameError("")
          setDetections(result.detections)
          drawDetections(result.detections, result.width, result.height)
          const priority = [...result.detections].sort((a, b) => {
            const rank = (level: DetectionResult["level"]) => level === "danger" ? 0 : level === "careful" ? 1 : 2
            return rank(a.level) - rank(b.level)
          })[0]
          const now = Date.now()
          if (priority && (priority.message !== lastSpokenRef.current || now - lastSpokenAtRef.current > 6000) && now - lastSpokenAtRef.current > 3500) {
            lastSpokenRef.current = priority.message
            lastSpokenAtRef.current = now
            speak(priority.message)
          }
        } else {
          setFrameError("Frame inference is unavailable. Check the Flask backend and its AI model logs.")
        }
      }
      frameBusyRef.current = false; resolve()
    }, "image/jpeg", 0.72))
  }, [drawDetections])

  useEffect(() => {
    if (camState !== "ready") return
    const timer = window.setInterval(() => void sendFrame(), 700)
    return () => window.clearInterval(timer)
  }, [camState, sendFrame])

  useEffect(() => () => { stopDeviceCamera(); void stopCamera() }, [stopDeviceCamera])

  const handleStartCamera = async () => {
    setCamState("starting"); setCamError("")
    const status = await getBackendStatus()
    if (!status) { setBackendUp(false); setCamState("backend-down"); setCamError(`Cannot reach ${getApiBase()}.`); return }
    setBackendUp(true)
    const registered = await startCamera()
    if (!registered.ok) { setCamState("error"); setCamError(registered.error || registered.message || "Could not start the camera session."); return }
    try { await startDeviceCamera(); setCamState("ready") }
    catch (error) { await stopCamera(); setCamState("error"); setCamError(error instanceof DOMException && error.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access in your browser and try again." : error instanceof Error ? error.message : "The camera could not be started.") }
  }
  const handleStopCamera = async () => { stopDeviceCamera(); await stopCamera(); setDetections([]); setOcrResults([]); setFrameError(""); setCamState("off") }
  const handleSwitchCamera = async () => {
    const next = facingMode === "environment" ? "user" : "environment"
    setFacingMode(next)
    if (camState === "ready") { try { await startDeviceCamera(next) } catch { setCamError("That camera is not available on this device.") } }
  }
  const handleOcrRead = async () => { setOcrLoading(true); setOcrError(""); const res = await triggerOcrRead(); setOcrLoading(false); if (res.ok) { setOcrResults(res.results); if (!res.results.length) setOcrError("No text found in the current frame.") } else setOcrError("OCR failed. Keep the camera running and try again.") }
  const handleSpeechToggle = async () => {
    const next = !readPreferences().voiceOn
    localStorage.setItem(preferenceKey, JSON.stringify({ ...readPreferences(), voiceOn: next }))
    const res = await toggleSpeech()
    setSpeechOn(next && (res.ok ? res.speech_enabled : true))
  }
  const stateLabel: Record<CamState, string> = { checking: "Checking backend…", "backend-down": "Backend not reachable", off: "Camera is off", starting: "Starting camera…", ready: "Live", error: "Camera error" }
  return (
    <div className="page tool-page">
      <PageHead title="Live view" copy="Lumi sees through your device camera and speaks what is nearby." mood={camState === "ready" ? "listening" : "happy"} />
      <div className="live-new-grid">
        <section className="new-card camera-new">
          <div className="camera-new-top"><strong>Device camera</strong>{camState === "ready" && <span className="live-status">Live</span>}{backendUp && camState !== "ready" && <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>Backend connected</span>}</div>
          <div className="real-camera">
            <video ref={videoRef} playsInline muted aria-label="Live camera preview" />
            <canvas ref={canvasRef} className="detection-overlay" aria-hidden="true" />
            {camState !== "ready" && <div className="camera-state" role="status"><AppIcon name="camera" /><h2>{stateLabel[camState]}</h2><p>{camError || (camState === "backend-down" ? `Cannot reach ${getApiBase()}.` : "Your browser camera stays on this device. Start it when you are ready.")}</p>{(camState === "off" || camState === "error" || camState === "backend-down") && <button className="primary-button" onClick={() => void handleStartCamera()}>{camState === "error" ? "Try again" : "Start device camera"}</button>}</div>}
          </div>
          <div className="camera-action-row">{camState === "ready" && <><button className="secondary-button" onClick={() => void handleStopCamera()}>Turn camera off</button><button className="secondary-button" onClick={() => void handleSwitchCamera()}>Switch camera</button></>}{<button className="secondary-button" onClick={() => void handleSpeechToggle()}><AppIcon name="volume" /> {speechOn ? "Mute guidance" : "Unmute guidance"}</button>}</div>{frameError && <p className="camera-error-text" role="alert">{frameError}</p>}
        </section>
        <aside className="lumi-panel"><div className="lumi-panel-header"><div className="lumi-panel-title"><div className="lumi-avatar">L</div><div><p className="lumi-panel-name">Lumi</p><p className="lumi-panel-sub">AI Vision Assistant</p></div></div></div><div className={`lumi-detection-strip${detections.length === 0 ? " lumi-detection-empty" : ""}`}>{detections.length === 0 ? <span className="lumi-det-label">{camState === "ready" ? "Scanning environment…" : "Camera offline"}</span> : <><span className="lumi-det-label">Lumi sees</span><div className="lumi-det-tags">{detections.slice(0, 4).map((item) => <span key={item.label + item.direction} className={`lumi-det-tag lumi-det-${item.level}`}>{item.label}</span>)}</div></>}</div><LumiChatPanel camReady={camState === "ready"} compact /><div className="lumi-ocr-section"><button className="lumi-ocr-btn" onClick={() => void handleOcrRead()} disabled={ocrLoading || camState !== "ready"}><AppIcon name="ocr" />{ocrLoading ? "Reading text…" : "Read text in frame"}</button>{ocrError && <p className="lumi-ocr-error" role="alert">{ocrError}</p>}{ocrResults.map((r, i) => <div className="lumi-ocr-item" key={i}><span className="lumi-ocr-text">“{r.text}”</span><span className="lumi-ocr-conf">{Math.round(r.confidence * 100)}%</span></div>)}</div></aside>
      </div>
    </div>
  )
}
export function AskLumiPage() {
  const chatKey = "sight-companion:chats"
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
      else reply = `Careful - I can see ${dangerous.map((d) => d.label + " " + d.direction).join(", ")}.`
    }
    setStatus("speaking")
    add({ from: "lumi", text: reply })
    speak(reply)
    await new Promise<void>((r) => setTimeout(r, 1200))
    setStatus("ready")
  }
  const listen = () => {
    type SRConstructor = new () => { lang: string; onstart: (() => void) | null; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void }
    const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) { alert("Speech recognition is not supported in this browser. Please type your question."); return }
    const rec = new SR()
    rec.lang = "en-US"
    rec.onstart = () => setStatus("listening")
    rec.onresult = (e) => { const t = e.results[0][0].transcript; setText(t); void ask(t) }
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
// â”€â”€â”€ SignsPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function SignsPage() {
  const [query, setQuery] = useState("")
  const [ocrItems, setOcrItems] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let cancelled = false
    getOcrHistory()
      .then((data) => {
        if (!cancelled && data.length > 0) {
          setOcrItems(data.map((r: any) => r.text).slice(0, 20))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
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
// â”€â”€â”€ SafetyPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
// â”€â”€â”€ ActivityPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function ActivityPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getActivityHistory()
      .then((data) => { if (!cancelled) { setItems(data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [])
  const typeLabel: Record<string, string> = {
    object: "Careful",
    sign: "Sign",
    safe: "Safe",
    session: "Session",
    settings: "Settings",
    auth: "Auth",
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
        {!loading && !error && items.map((item, index) => (
          <article key={item.id || index}>
            <span>{typeLabel[item.type] || item.type}</span>
            <div>
              <h2>{item.title}</h2>
              <p>{item.created_at || item.time || "Just now"}</p>
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
// â”€â”€â”€ SettingsPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function SettingsPage({ preferences, setPreferences, loading }: { preferences: Preferences; setPreferences: Dispatch<SetStateAction<Preferences>>; loading?: boolean }) {
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
      {loading && <p role="status" style={{ padding: "1rem", opacity: 0.6 }}>Loading settings…</p>}
      {!loading && (
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
      )}
    </div>
  )
}
