$p = "D:\Sight_Companion\Frontend\src\Pages.tsx"
$c = Get-Content $p -Raw

$start = $c.IndexOf("export function ProfilePage")
$end = $c.IndexOf("export function AboutPage")
if ($start -ge 0 -and $end -gt $start) {
  $head = $c.Substring(0, $start)
  $tail = $c.Substring($end)
  $newFunc = @'
export function ProfilePage({ session, onDelete }: { session: Session; onDelete: () => void }) {
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState(session.name)
  const [email, setEmail] = useState(session.isGuest ? "" : session.email)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    if (!session.isGuest) {
      getProfile().then((p) => { if (!cancelled) { setProfile(p); setLoading(false) } }).catch(() => setLoading(false))
    } else {
      setLoading(false)
    }
    return () => { cancelled = true }
  }, [session])

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const updates: { full_name?: string; email?: string } = {}
      if (name && name !== session.name) updates.full_name = name
      if (email && email !== session.email) updates.email = email
      if (Object.keys(updates).length) {
        const updated = await updateProfile(updates)
        if (updated) {
          setProfile(updated)
          const current = currentSession()
          if (current) {
            updateSession({ ...current, name: updated.full_name || current.name, email: updated.email || current.email })
          }
        }
      }
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile.")
    } finally {
      setBusy(false)
    }
  }

  return <div className="page new-page"><NewTopbar eyebrow="ACCOUNT" title="Your profile" copy="Manage your details on this device." mood="happy" /><section className="new-card profile-new"><div className="profile-photo">{session.name.charAt(0).toUpperCase()}</div><button className="secondary-button">Change photo</button>{error && <p className="new-error" role="alert">{error}</p>}<form onSubmit={handleSave}><label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>New password<input type="password" placeholder="Leave blank to keep your password" /><small>Password changes use the Forgot password flow.</small></label>{saved && <p className="new-success" role="status"><MiniIcon name="check" /> Profile saved.</p>}<button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></form><nav className="profile-links" aria-label="More pages"><button onClick={() => goTo("history")}>History</button><button onClick={() => goTo("notifications")}>Notifications</button><button onClick={() => goTo("settings")}>Settings</button><button onClick={() => goTo("about")}>About</button><button onClick={() => goTo("help")}>Help</button></nav><div className="delete-zone"><h2>Delete account</h2><p>This removes the local account from this device.</p><button className="danger-new" onClick={async () => { await deleteLocalAccount(); onDelete() }}><MiniIcon name="trash" /> Delete account</button></div></section></div>
}
'@
  $c = $head + $newFunc + $tail
  Set-Content $p $c
  "PROFILE_REPLACED"
} else {
  "NOT FOUND start=$start end=$end"
}
