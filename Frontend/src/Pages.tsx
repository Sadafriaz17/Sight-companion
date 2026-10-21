import { useId, useState, type FormEvent, type ReactNode } from "react"
import {
  deleteLocalAccount,
  requestPasswordReset,
  setNewPassword,
  submitContactMessage,
} from "./api"
import type { Session } from "./auth.ts"

export type Route =
  | "landing"
  | "login"
  | "signup"
  | "forgot"
  | "check-email"
  | "new-password"
  | "verified"
  | "first-welcome"
  | "setup"
  | "welcome"
  | "live"
  | "ask"
  | "signs"
  | "safety"
  | "activity"
  | "settings"
  | "history"
  | "notifications"
  | "profile"
  | "about"
  | "help"
  | "privacy"
  | "terms"
  | "not-found"
  | "error"

export function goTo(route: Route) {
  window.location.hash = route
  window.scrollTo({ top: 0, behavior: "smooth" })
}

function MiniIcon({
  name,
  size = 20,
}: {
  name:
    | "arrow"
    | "camera"
    | "check"
    | "clock"
    | "eye"
    | "help"
    | "lock"
    | "mail"
    | "search"
    | "shield"
    | "sparkles"
    | "volume"
    | "bell"
    | "user"
    | "trash"
  size?: number
}) {
  const paths: Record<string, ReactNode> = {
    arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
    camera: <><path d="M4 7h4l2-2h4l2 2h4v12H4z" /><circle cx="12" cy="13" r="4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M10 9a2 2 0 1 1 3 1.7c-1 .5-1 1-1 2M12 17h.01" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    sparkles: <path d="m12 3-1.2 3.3L7.5 7.5l3.3 1.2L12 12l1.2-3.3 3.3-1.2-3.3-1.2zM5 14l-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8z" />,
    volume: <path d="M11 5 6 9H3v6h3l5 4zM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" />,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" /></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

export function PageLumi({ mood = "happy" }: { mood?: "happy" | "alert" | "listening" | "proud" }) {
  const smiling = mood === "happy" || mood === "proud"
  const id = useId().replace(/:/g, "")
  return (
    <svg className="page-lumi" viewBox="0 0 320 280" role="img" aria-label={`Lumi looking ${mood}`}>
      <defs>
        <linearGradient id={`lumi-shell-${id}`} x1=".15" y1=".05" x2=".85" y2=".95">
          <stop stopColor="#B7A8F0" /><stop offset=".58" stopColor="#A292E7" /><stop offset="1" stopColor="#7A64D2" />
        </linearGradient>
        <linearGradient id={`lumi-screen-${id}`} x1=".08" y1=".02" x2=".92" y2=".98">
          <stop stopColor="#3B3152" /><stop offset=".6" stopColor="#302641" /><stop offset="1" stopColor="#261D36" />
        </linearGradient>
        <linearGradient id={`lumi-body-${id}`} x1=".1" y1=".05" x2=".85" y2=".9">
          <stop stopColor="#FFFFFF" /><stop offset=".72" stopColor="#F5F2FF" /><stop offset="1" stopColor="#E7E0FF" />
        </linearGradient>
        <linearGradient id={`lumi-lens-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#F7FBFF" /><stop offset="1" stopColor="#D8E4F2" />
        </linearGradient>
        <filter id={`lumi-shadow-${id}`} x="-35%" y="-30%" width="170%" height="180%">
          <feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#49377D" floodOpacity=".22" />
        </filter>
      </defs>
      <ellipse cx="157" cy="255" rx="93" ry="14" fill="#4E3D80" opacity=".12" />
      <g filter={`url(#lumi-shadow-${id})`}>
        <path d="M119 60 105 25M201 60l14-35" fill="none" stroke="#7762D1" strokeWidth="10" strokeLinecap="round" />
        <circle cx="101" cy="18" r="12" fill="#FFF1B8" stroke="#7762D1" strokeWidth="7" />
        <circle cx="219" cy="18" r="12" fill="#FFF1B8" stroke="#7762D1" strokeWidth="7" />
        <path d="M65 183 27 198M255 181l27 13" fill="none" stroke="#8D79DE" strokeWidth="22" strokeLinecap="round" />
        <path d="M65 183 27 198M255 181l27 13" fill="none" stroke="#F1EDFF" strokeWidth="9" strokeLinecap="round" />
        <rect x="48" y="54" width="214" height="190" rx="98" fill={`url(#lumi-shell-${id})`} />
        <rect x="62" y="69" width="186" height="160" rx="80" fill={`url(#lumi-body-${id})`} />
        <path d="M72 197c28 29 139 38 168-17-10 34-39 49-91 49-35 0-61-10-77-32Z" fill="#E5DEFF" opacity=".72" />
        <rect x="77" y="91" width="156" height="105" rx="47" fill={`url(#lumi-screen-${id})`} />
        <path d="M91 106c35-15 88-13 124 4" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" opacity=".05" />
        {smiling ? (
          <path d="M111 151q0-22 18-22t18 22M169 151q0-22 18-22t18 22" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
        ) : (
          <>
            <ellipse cx="129" cy="142" rx="8" ry={mood === "listening" ? 12 : 9} fill="#FFF9C8" />
            <ellipse cx="187" cy="142" rx="8" ry={mood === "listening" ? 12 : 9} fill="#FFF9C8" />
            <circle cx="131" cy="140" r="3" fill="#5F49B8" /><circle cx="189" cy="140" r="3" fill="#5F49B8" />
          </>
        )}
        <ellipse cx="97" cy="176" rx="10" ry="5" fill="#F58B91" /><ellipse cx="213" cy="176" rx="10" ry="5" fill="#F58B91" />
        {mood === "alert" ? <ellipse cx="158" cy="173" rx="7" ry="9" fill="#FFFFFF" /> : <path d="M146 171q12 6 24 0" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />}
        <rect x="84" y="225" width="62" height="31" rx="16" fill="#8069D8" /><rect x="169" y="225" width="62" height="31" rx="16" fill="#8069D8" />
        <circle cx="260" cy="215" r="39" fill={`url(#lumi-lens-${id})`} stroke="#614BB5" strokeWidth="11" />
        <path d="m287 243 27 30" fill="none" stroke="#614BB5" strokeWidth="13" strokeLinecap="round" />
        <path d="M244 183c15 0 30 6 40 16" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" opacity=".5" />
      </g>
      {mood === "proud" && <path d="m282 62 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#E5B54A" />}
    </svg>
  )
}

export function LumiMark() {
  return <span className="lumi-brand-mark" aria-hidden="true"><svg viewBox="0 0 56 56"><rect width="56" height="56" rx="17" fill="#E9E3FF" /><path d="m28 24-4-10m18 10 4-10" stroke="#755DCE" strokeWidth="3.5" strokeLinecap="round" /><circle cx="23" cy="12" r="3" fill="#FFF1B8" stroke="#755DCE" strokeWidth="2" /><circle cx="47" cy="12" r="3" fill="#FFF1B8" stroke="#755DCE" strokeWidth="2" /><rect x="13" y="20" width="46" height="40" rx="20" fill="#A897EA" /><rect x="17" y="24" width="38" height="32" rx="16" fill="#FBFAFF" /><rect x="20" y="29" width="35" height="22" rx="10" fill="#302641" /><path d="M28 42q0-6 5-6t5 6M43 42q0-6 5-6t5 6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" /><ellipse cx="24" cy="47" rx="2.5" ry="1.4" fill="#F58B91" /></svg></span>
}

function Brand() {
  return <span className="site-brand"><LumiMark /><span><strong>Sight</strong><small>Companion</small></span></span>
}

function SiteHeader() {
  const [open, setOpen] = useState(false)
  return (
    <header className="site-header">
      <button onClick={() => goTo("landing")} aria-label="Sight Companion home"><Brand /></button>
      <button className="site-menu-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Close menu" : "Menu"}</button>
      <nav className={open ? "site-nav-open" : ""} aria-label="Website navigation">
        <a href="#features" onClick={() => setOpen(false)}>Features</a><a href="#how" onClick={() => setOpen(false)}>How it works</a><button onClick={() => goTo("help")}>Help</button><button className="mobile-site-action" onClick={() => goTo("login")}>Log in</button><button className="mobile-site-action" onClick={() => goTo("signup")}>Get started</button>
      </nav>
      <div><button className="site-login" onClick={() => goTo("login")}>Log in</button><button className="primary-button" onClick={() => goTo("signup")}>Get started</button></div>
    </header>
  )
}

export function LoadingPage() {
  return <main className="route-loading" role="status" aria-live="polite"><span className="loading-orbit"><MiniIcon name="sparkles" /></span><strong>Getting things ready…</strong></main>
}

export function LandingPage() {
  const features = [
    ["eye", "Understand surroundings", "Recognises everyday objects and where they are."],
    ["volume", "Hear helpful guidance", "Speaks short, calm descriptions when you need them."],
    ["shield", "Move with confidence", "Warns you when an object is very close."],
    ["mail", "Read visible text", "Reads clear signs and labels aloud."],
    ["clock", "Review activity", "Returns to useful moments from recent sessions."],
    ["lock", "Stay private", "Camera processing remains on this device."],
  ] as const
  return (
    <div className="public-page">
      <SiteHeader />
      <main>
        <section className="public-hero">
          <div><span className="hero-kicker"><MiniIcon name="sparkles" size={16} /> Your world, made clearer</span><h1>A friendly voice for what’s around you.</h1><p>Sight Companion describes nearby objects, reads signs, and gives clear spoken warnings—all offline.</p><button className="primary-button" onClick={() => goTo("signup")}>Get started <MiniIcon name="arrow" /></button></div>
          <div className="public-lumi"><div className="lumi-speech"><strong>Hi, I’m Lumi!</strong><span>Let’s explore together.</span></div><PageLumi /></div>
        </section>
        <section className="public-trust"><span><MiniIcon name="shield" /> 100% offline</span><span><MiniIcon name="lock" /> Private by design</span><span><MiniIcon name="volume" /> Voice-first guidance</span></section>
        <section className="public-section" id="how"><div className="public-heading"><p className="eyebrow">HOW IT WORKS</p><h2>Three simple steps</h2></div><div className="public-grid three">{[["camera","Open the camera","Point your device ahead."],["eye","Lumi looks around","Objects and signs are checked on your device."],["volume","Lumi speaks","Hear short, useful guidance."]].map(([icon,title,copy], index) => <article className="public-card" key={title}><b>{index + 1}</b><span className="public-icon"><MiniIcon name={icon as "camera" | "eye" | "volume"} /></span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
        <section className="public-section public-soft" id="features"><div className="public-heading"><p className="eyebrow">BUILT FOR SAFETY</p><h2>Support that stays simple</h2><p>Clear words, spoken warnings, and controls that are easy to find.</p></div><div className="public-grid three">{features.map(([icon,title,copy]) => <article className="public-card" key={title}><span className="public-icon"><MiniIcon name={icon} /></span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
        <section className="public-section"><div className="public-heading"><p className="eyebrow">WHO IT IS FOR</p><h2>Made with blind and low vision people</h2><p>Use Sight Companion at home, at work, or while exploring a familiar place.</p></div><div className="public-grid three"><article className="public-card"><span className="public-icon"><MiniIcon name="volume" /></span><h3>Voice first</h3><p>Important information is spoken in short, clear phrases.</p></article><article className="public-card"><span className="public-icon"><MiniIcon name="eye" /></span><h3>Easy to see</h3><p>Large controls and strong contrast support many kinds of vision.</p></article><article className="public-card"><span className="public-icon"><MiniIcon name="shield" /></span><h3>Your choices</h3><p>Change voice, text, alerts, contrast, and movement at any time.</p></article></div></section>
        <section className="public-section public-soft"><div className="public-heading"><p className="eyebrow">PRIVACY IN SIMPLE WORDS</p><h2>Your camera stays private</h2><p>Sight Companion works on your device. Camera pictures are not uploaded or saved.</p><button className="secondary-button" onClick={() => goTo("privacy")}>Read our Privacy page</button></div></section>
        <section className="public-section"><div className="public-heading"><p className="eyebrow">COMMON QUESTIONS</p><h2>Good to know</h2></div><div className="faq-list"><details open><summary>Does it need the internet?</summary><p>No. Camera checks and speech work offline.</p></details><details><summary>Are camera images uploaded?</summary><p>No. Visual processing stays on your device.</p></details><details><summary>Can I change the voice?</summary><p>Yes. Voice and display choices are available in Settings.</p></details></div></section>
        <section className="public-cta"><PageLumi mood="proud" /><div><h2>Ready to explore with Lumi?</h2><p>Create your local account and choose your preferences.</p></div><button className="primary-button" onClick={() => goTo("signup")}>Get started <MiniIcon name="arrow" /></button></section>
      </main>
      <footer className="site-footer"><button className="site-footer-brand" onClick={() => goTo("landing")} aria-label="Sight Companion landing page"><Brand /></button><p>Your friendly offline guide.</p><nav><button onClick={() => goTo("help")}>Help</button><button onClick={() => goTo("privacy")}>Privacy</button><button onClick={() => goTo("terms")}>Terms</button><button onClick={() => goTo("help")}>Contact</button></nav></footer>
    </div>
  )
}

export function PasswordPage({ route }: { route: "forgot" | "check-email" | "new-password" | "verified" }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const submitEmail = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.")
    setBusy(true); await requestPasswordReset(email); goTo("check-email")
  }
  const submitPassword = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 8) return setError("Use at least 8 characters.")
    setBusy(true); await setNewPassword(password); goTo("verified")
  }
  const content = {
    forgot: ["Reset your password", "Enter your email and we’ll send reset steps."],
    "check-email": ["Check your email", "We sent password reset steps to your email."],
    "new-password": ["Set a new password", "Choose a password with at least 8 characters."],
    verified: ["Email verified", "Your account is ready to use."],
  }[route]
  return (
    <main className="simple-public"><button className="simple-brand" onClick={() => goTo("landing")}><Brand /></button><section className="simple-public-card"><PageLumi mood={route === "verified" ? "proud" : "listening"} /><p className="eyebrow">SIGHT COMPANION</p><h1>{content[0]}</h1><p>{content[1]}</p>
      {route === "forgot" && <form onSubmit={submitEmail}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(error)} /></label>{error && <p className="new-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button></form>}
      {route === "check-email" && <><span className="success-circle"><MiniIcon name="mail" size={30} /></span><button className="primary-button" onClick={() => goTo("new-password")}>Open reset link</button></>}
      {route === "new-password" && <form onSubmit={submitPassword}><label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(error)} /></label>{error && <p className="new-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button></form>}
      {route === "verified" && <><span className="success-circle"><MiniIcon name="check" size={30} /></span><button className="primary-button" onClick={() => goTo("login")}>Continue to log in</button></>}
      <button className="simple-link" onClick={() => goTo("login")}>Back to log in</button>
    </section></main>
  )
}

export function FirstWelcomePage() {
  return <main className="setup-new"><section><PageLumi mood="happy" /><div><p className="eyebrow">WELCOME TO SIGHT COMPANION</p><h1>Let’s make it yours.</h1><p>Lumi will help you choose the few settings needed for clear voice guidance.</p><button className="primary-button" onClick={() => goTo("setup")}>Begin setup <MiniIcon name="arrow" /></button></div></section></main>
}

export function SetupPage() {
  const [camera, setCamera] = useState(true)
  const [voice, setVoice] = useState(true)
  return <main className="setup-new"><section><PageLumi mood="listening" /><div><p className="eyebrow">QUICK SETUP</p><h1>Choose what Lumi can use</h1><div className="setup-options"><label><span className="public-icon"><MiniIcon name="camera" /></span><span><strong>Camera</strong><small>Needed to understand what is ahead.</small></span><input type="checkbox" checked={camera} onChange={(event) => setCamera(event.target.checked)} /></label><label><span className="public-icon"><MiniIcon name="volume" /></span><span><strong>Speaker</strong><small>Needed to speak guidance aloud.</small></span><input type="checkbox" checked={voice} onChange={(event) => setVoice(event.target.checked)} /></label><label>Voice<select><option>Warm and friendly</option><option>Calm and clear</option></select></label><label>Text size<select><option>Large</option><option>Standard</option><option>Extra large</option></select></label></div><button className="primary-button" disabled={!camera || !voice} onClick={() => goTo("welcome")}>Start Sight Companion</button></div></section></main>
}

function NewTopbar({ eyebrow, title, copy, mood = "happy" }: { eyebrow: string; title: string; copy: string; mood?: "happy" | "alert" | "listening" | "proud" }) {
  return <header className="new-page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></div><PageLumi mood={mood} /></header>
}

export function EmptyState({ title, copy, action, onAction }: { title: string; copy: string; action: string; onAction: () => void }) {
  return <section className="new-empty"><PageLumi mood="listening" /><h2>{title}</h2><p>{copy}</p><button className="primary-button" onClick={onAction}>{action}</button></section>
}

const initialHistory = [
  { id: 1, date: "Today", time: "10:42 AM", title: "Morning session", detail: "47 objects · 18 voice guides" },
  { id: 2, date: "Today", time: "8:15 AM", title: "Kitchen session", detail: "12 objects · 4 voice guides" },
  { id: 3, date: "Yesterday", time: "4:30 PM", title: "Afternoon session", detail: "31 objects · 9 voice guides" },
]

export function HistoryPage() {
  const [items, setItems] = useState(initialHistory)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("All")
  const [selected, setSelected] = useState(initialHistory[0])
  const visible = items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) && (filter === "All" || item.date === filter))
  return <div className="page new-page"><NewTopbar eyebrow="SESSIONS" title="History" copy="Find and review your saved sessions." mood="listening" /><div className="new-search-row"><label><MiniIcon name="search" /><span className="sr-only">Search history</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sessions" /></label><div>{["All","Today","Yesterday"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div></div>{visible.length ? <div className="new-split"><section className="new-card history-new">{["Today","Yesterday"].map((date) => <div key={date}><h2>{date}</h2>{visible.filter((item) => item.date === date).map((item) => <button className={selected?.id === item.id ? "active" : ""} onClick={() => setSelected(item)} key={item.id}><span className="public-icon"><MiniIcon name="clock" /></span><span><strong>{item.title}</strong><small>{item.time} · {item.detail}</small></span></button>)}</div>)}</section>{selected && <section className="new-card history-detail"><p className="eyebrow">SESSION DETAILS</p><h2>{selected.title}</h2><p>{selected.date} at {selected.time}</p><div><strong>Highlights</strong><p>Chair nearby on the left. One sign read aloud. Clear path for most of the session.</p></div><button className="danger-new" onClick={() => { const next = items.filter((item) => item.id !== selected.id); setItems(next); setSelected(next[0]) }}><MiniIcon name="trash" /> Delete session</button></section>}</div> : <EmptyState title="No sessions found" copy="Try another search or start a new live session." action="Open Live view" onAction={() => goTo("live")} />}</div>
}

export function NotificationsPage() {
  const [items, setItems] = useState([
    ["Nearby object alert", "Chair detected 1.2 metres ahead.", "10 minutes ago"],
    ["Session ready", "Your camera and voice settings are ready.", "Today"],
    ["Privacy check complete", "All processing is staying on this device.", "Yesterday"],
  ])
  return <div className="page new-page"><NewTopbar eyebrow="UPDATES" title="Notifications" copy="Helpful updates from Sight Companion." mood="alert" />{items.length ? <section className="new-card notification-list">{items.map(([title,copy,time]) => <article key={title}><span className="public-icon"><MiniIcon name="bell" /></span><div><h2>{title}</h2><p>{copy}</p><small>{time}</small></div></article>)}<button className="secondary-button" onClick={() => setItems([])}>Clear notifications</button></section> : <EmptyState title="You’re all caught up" copy="New updates will appear here." action="Go home" onAction={() => goTo("welcome")} />}</div>
}

export function ProfilePage({ session, onDelete }: { session: Session; onDelete: () => void }) {
  const [saved, setSaved] = useState(false)
  return <div className="page new-page"><NewTopbar eyebrow="ACCOUNT" title="Your profile" copy="Manage your details on this device." mood="happy" /><section className="new-card profile-new"><div className="profile-photo">{session.name.charAt(0).toUpperCase()}</div><button className="secondary-button">Change photo</button><form onSubmit={(event) => { event.preventDefault(); setSaved(true) }}><label>Name<input defaultValue={session.name} /></label><label>Email<input type="email" defaultValue={session.isGuest ? "" : session.email} /></label><label>New password<input type="password" placeholder="Leave blank to keep your password" /></label>{saved && <p className="new-success" role="status"><MiniIcon name="check" /> Profile saved.</p>}<button className="primary-button">Save profile</button></form><nav className="profile-links" aria-label="More pages"><button onClick={() => goTo("history")}>History</button><button onClick={() => goTo("notifications")}>Notifications</button><button onClick={() => goTo("settings")}>Settings</button><button onClick={() => goTo("about")}>About</button><button onClick={() => goTo("help")}>Help</button></nav><div className="delete-zone"><h2>Delete account</h2><p>This removes the local account from this device.</p><button className="danger-new" onClick={async () => { await deleteLocalAccount(); onDelete() }}><MiniIcon name="trash" /> Delete account</button></div></section></div>
}

export function AboutPage() {
  return <div className="page new-page"><NewTopbar eyebrow="ABOUT" title="A friendly guide, built for privacy" copy="Sight Companion helps visually impaired people understand nearby spaces through clear spoken guidance." mood="proud" /><div className="new-public-grid"><section className="new-card"><span className="public-icon"><MiniIcon name="sparkles" /></span><h2>Our mission</h2><p>Make useful visual information easier to hear, without making the experience feel complicated.</p></section><section className="new-card"><span className="public-icon"><MiniIcon name="shield" /></span><h2>Privacy first</h2><p>Camera processing stays on your device. Images are not uploaded or stored.</p></section><section className="new-card team-wide"><div><p className="eyebrow">THE TEAM</p><h2>Designed with care</h2><p>Our product team works with accessibility specialists and people with lived experience of visual impairment.</p></div><PageLumi mood="listening" /></section></div></div>
}

function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const privacy = kind === "privacy"
  return <main className="simple-public legal-page"><button className="simple-brand" onClick={() => goTo("landing")}><Brand /></button><article className="simple-public-card"><PageLumi mood="proud" /><p className="eyebrow">{privacy ? "PRIVACY" : "TERMS"}</p><h1>{privacy ? "Your information stays yours" : "Simple terms of use"}</h1>{privacy ? <><h2>Camera pictures</h2><p>Camera pictures are used on your device. We do not upload or save them.</p><h2>Your account</h2><p>Your account, settings, chats, and activity stay in this browser.</p><h2>Your control</h2><p>You can clear your local account from Profile at any time.</p></> : <><h2>Use with care</h2><p>Sight Companion can help, but it can make mistakes. Use your usual mobility tools and skills.</p><h2>Safety</h2><p>Do not rely on Sight Companion alone for roads, traffic, or other danger.</p><h2>Your device</h2><p>You are responsible for camera and sound permission on your device.</p></>}<button className="primary-button" onClick={() => goTo("landing")}>Back to home</button></article></main>
}

export function PrivacyPage() { return <LegalPage kind="privacy" /> }
export function TermsPage() { return <LegalPage kind="terms" /> }

export function HelpPage() {
  const [sent, setSent] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); await submitContactMessage({ name: String(data.get("name")), email: String(data.get("email")), message: String(data.get("message")) }); setSent(true)
  }
  return <div className="page new-page"><NewTopbar eyebrow="SUPPORT" title="How can we help?" copy="Read a quick guide or send a message." mood="listening" /><div className="new-public-grid"><section className="new-card"><span className="public-icon"><MiniIcon name="camera" /></span><h2>Start Live view</h2><p>Open Live view, point the camera ahead, and choose Resume camera.</p></section><section className="new-card"><span className="public-icon"><MiniIcon name="volume" /></span><h2>Hear guidance</h2><p>Keep Voice guidance on to hear object, distance, and sign alerts.</p></section><section className="new-card faq-wide"><h2>Common questions</h2><details><summary>Can I use it offline?</summary><p>Yes. Sight Companion works on your device.</p></details><details><summary>Where can I change text size?</summary><p>Open Settings, then Display & controls.</p></details></section><section className="new-card contact-wide"><h2>Contact us</h2>{sent ? <p className="new-success"><MiniIcon name="check" /> Your message is ready. Thank you.</p> : <form onSubmit={submit}><label>Name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Message<textarea name="message" rows={5} required /></label><button className="primary-button">Send message</button></form>}</section></div></div>
}

export function SystemPage({ error = false }: { error?: boolean }) {
  return <main className="system-new"><PageLumi mood={error ? "alert" : "listening"} /><p className="eyebrow">{error ? "SOMETHING WENT WRONG" : "PAGE NOT FOUND"}</p><h1>{error ? "Lumi needs a moment" : "We can’t find that page"}</h1><p>{error ? "Your information is safe. Please try again." : "The link may be old. Let’s take you somewhere useful."}</p><button className="primary-button" onClick={() => goTo(error ? "welcome" : "landing")}>{error ? "Try again" : "Go to home"}</button></main>
}
