import { useEffect, useState, type ReactNode } from "react"
import Auth from "./Auth.tsx"
import { currentSession, signOut, type Session } from "./auth.ts"
import { usePreferences } from "./accessibility"
import { speak } from "./voice"
import { ActivityPage, AskLumiPage, LivePage, SafetyPage, SettingsPage, SignsPage } from "./AppPages"
import { AboutPage, FirstWelcomePage, HelpPage, LandingPage, LumiMark, NotificationsPage, PageLumi, PasswordPage, ProfilePage, SetupPage, SystemPage, goTo, type Route } from "./Pages"
import { PrivacyPage, TermsPage } from "./LegalPages"

type Page = "welcome" | "live" | "ask" | "signs" | "safety" | "activity" | "settings" | "notifications" | "profile" | "about" | "help" | "privacy" | "terms"
const protectedPages: Page[] = ["welcome","live","ask","signs","safety","activity","settings","notifications","profile","about","help","privacy","terms"]
const routes: Route[] = ["landing","login","signup","forgot","check-email","new-password","verified","first-welcome","setup",...protectedPages,"not-found","error"]

function readRoute(hasSession: boolean): Route {
  const hash = window.location.hash.slice(1) as Route
  if (!hash) return hasSession ? "welcome" : "landing"
  return routes.includes(hash) ? hash : "not-found"
}

type IconName = "home" | "camera" | "ask" | "signs" | "safety" | "activity" | "settings" | "more" | "eye"
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    camera: <><path d="M4 7h4l2-2h4l2 2h4v12H4z" /><circle cx="12" cy="13" r="4" /></>,
    ask: <><path d="M21 12a8 8 0 0 1-8 8H5l-3 2 1-5a9 9 0 1 1 18-5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
    signs: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    safety: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{paths[name]}</svg>
}

const nav: { id: Page; label: string; icon: IconName }[] = [
  { id: "welcome", label: "Home", icon: "home" }, { id: "live", label: "Live view", icon: "camera" },
  { id: "ask", label: "Ask Lumi", icon: "ask" }, { id: "signs", label: "Signs", icon: "signs" },
  { id: "safety", label: "Safety", icon: "safety" }, { id: "activity", label: "Activity", icon: "activity" },
  { id: "settings", label: "Settings", icon: "settings" },
]

function Home({ name }: { name: string }) {
  return <div className="page tool-page"><header className="home-hero"><div><p className="eyebrow">WELCOME BACK</p><h1>Hello, {name}.</h1><p>Lumi is ready to help you understand what is around you.</p><button className="primary-button" onClick={() => goTo("live")}>Start Live view</button></div><div className="home-lumi"><div className="lumi-speech"><strong>Hi, I’m Lumi!</strong><span>Let’s explore together.</span></div><PageLumi mood="happy" /></div></header><section className="home-actions">{nav.slice(1,6).map((item) => <button key={item.id} onClick={() => goTo(item.id)}><Icon name={item.icon} /><span><strong>{item.label}</strong><small>{item.id === "ask" ? "Ask a question" : item.id === "live" ? "Use your camera" : `Open ${item.label}`}</small></span></button>)}</section></div>
}

function Shell({ page, session, onSignOut, children }: { page: Page; session: Session; onSignOut: () => void; children: ReactNode }) {
  const [profileOpen, setProfileOpen] = useState(false), [moreOpen, setMoreOpen] = useState(false)
  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={() => goTo("landing")} aria-label="Sight Companion landing page"><LumiMark /><span><strong>Sight</strong><small>Companion</small></span></button><nav aria-label="Main navigation">{nav.map((item) => <button className={`nav-item ${page === item.id ? "active" : ""}`} key={item.id} onClick={() => goTo(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav><div className="sidebar-help"><PageLumi mood="happy" /><strong>Need a hand?</strong><p>Lumi is always here to guide you.</p><button onClick={() => goTo("help")}>Get support</button></div></aside><main className="app-main"><header className="account-bar"><span>All camera work stays on this device</span><button onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}><span className="avatar">{session.name[0].toUpperCase()}</span>{session.name}<Icon name="more" /></button>{profileOpen && <div className="profile-menu">{[["notifications","Notifications"],["profile","Profile"],["help","Help"],["about","About"]].map(([id,label]) => <button key={id} onClick={() => goTo(id as Page)}>{label}</button>)}<button onClick={onSignOut}>Log out</button></div>}</header>{children}</main><nav className="mobile-navigation" aria-label="Mobile navigation">{nav.filter((item) => ["welcome","live","ask","activity"].includes(item.id)).map((item) => <button className={page === item.id ? "active" : ""} key={item.id} onClick={() => goTo(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>)}<button onClick={() => setMoreOpen(!moreOpen)}><Icon name="more" /><span>More</span></button></nav>{moreOpen && <div className="more-sheet" role="dialog" aria-label="More pages"><h2>More</h2>{nav.filter((item) => !["welcome","live","ask","activity"].includes(item.id)).map((item) => <button key={item.id} onClick={() => { setMoreOpen(false); goTo(item.id) }}><Icon name={item.icon} />{item.label}</button>)}<button onClick={() => goTo("profile")}>Profile</button><button onClick={() => setMoreOpen(false)}>Close</button></div>}</div>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(currentSession)
  const [route, setRoute] = useState<Route>(() => readRoute(Boolean(currentSession())))
  const { preferences, setPreferences } = usePreferences()
  useEffect(() => { const update = () => setRoute(readRoute(Boolean(currentSession()))); window.addEventListener("hashchange", update); return () => window.removeEventListener("hashchange", update) }, [])
  useEffect(() => {
    const titles: Partial<Record<Route, string>> = { landing: "Sight Companion", login: "Log in", signup: "Sign up", welcome: "Home", live: "Live view", ask: "Ask Lumi", signs: "Signs", safety: "Safety", activity: "Activity", settings: "Settings", profile: "Profile", help: "Help", about: "About", privacy: "Privacy", terms: "Terms" }
    const title = titles[route]
    if (title) speak(title)
  }, [route])
  if (route === "not-found") return <SystemPage />
  if (route === "error") return <SystemPage error />
  if (!session) {
    if (["landing","privacy","terms","help","about"].includes(route)) return route === "landing" ? <LandingPage /> : route === "privacy" ? <PrivacyPage /> : route === "terms" ? <TermsPage /> : route === "help" ? <HelpPage /> : <AboutPage />
    if (["forgot","check-email","new-password","verified"].includes(route)) return <PasswordPage route={route as "forgot" | "check-email" | "new-password" | "verified"} />
    sessionStorage.setItem("sight-companion:intended-route", route)
    return <Auth key={route} initialMode={route === "signup" ? "signup" : "signin"} onAuthenticated={(next, isNew) => { setSession(next); const intended = sessionStorage.getItem("sight-companion:intended-route"); sessionStorage.removeItem("sight-companion:intended-route"); goTo(isNew ? "first-welcome" : intended && protectedPages.includes(intended as Page) ? intended as Route : "welcome") }} />
  }
  if (route === "landing") return <LandingPage />
  const logout = () => { signOut(); setSession(null); goTo("landing") }
  if (route === "first-welcome") return <FirstWelcomePage />
  if (route === "setup") return <SetupPage />
  const page = protectedPages.includes(route as Page) ? route as Page : "welcome"
  let content: ReactNode = <Home name={session.name} />
  if (page === "live") content = <LivePage />
  else if (page === "ask") content = <AskLumiPage />
  else if (page === "signs") content = <SignsPage />
  else if (page === "safety") content = <SafetyPage />
  else if (page === "activity") content = <ActivityPage />
  else if (page === "settings") content = <SettingsPage preferences={preferences} setPreferences={setPreferences} />
  else if (page === "profile") content = <ProfilePage session={session} onDelete={logout} />
  else if (page === "notifications") content = <NotificationsPage />
  else if (page === "help") content = <HelpPage />
  else if (page === "about") content = <AboutPage />
  else if (page === "privacy") content = <PrivacyPage />
  else if (page === "terms") content = <TermsPage />
  return <Shell page={page} session={session} onSignOut={logout}>{content}</Shell>
}
