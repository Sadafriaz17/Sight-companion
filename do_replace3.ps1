$p = "D:\Sight_Companion\Frontend\src\Pages.tsx"
$c = Get-Content $p -Raw

$start = $c.IndexOf("const initialHistory")
$end = $c.IndexOf("export function NotificationsPage")
if ($start -ge 0 -and $end -gt $start) {
  $head = $c.Substring(0, $start)
  $tail = $c.Substring($end)
  $newFunc = @'
export function HistoryPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getActivityHistory()
      .then((data) => {
        if (!cancelled) {
          setItems(data)
          setSelected(data[0] || null)
          setLoading(false)
        }
      })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const visible = items.filter((item: any) => item.title.toLowerCase().includes(query.toLowerCase()))
  const typeLabel: Record<string, string> = {
    object: "Object",
    sign: "Sign",
    safe: "Safe",
    session: "Session",
    settings: "Settings",
    auth: "Auth",
  }

  return (
    <div className="page new-page">
      <NewTopbar eyebrow="SESSIONS" title="History" copy="Find and review your saved sessions." mood="listening" />
      <div className="new-search-row">
        <label><MiniIcon name="search" /><span className="sr-only">Search history</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sessions" /></label>
      </div>
      {loading && <p role="status" style={{ padding: "1rem", opacity: 0.6 }}>Loading activity…</p>}
      {error && <p role="alert" style={{ padding: "1rem", color: "var(--color-careful, #e07b39)" }}>Could not load activity right now. Please try again later.</p>}
      {!loading && !error && items.length === 0 && (
        <EmptyState title="No activity yet" copy="Start a live session to build your history." action="Open Live view" onAction={() => goTo("live")} />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="new-split">
          <section className="new-card history-new">
            {visible.map((item: any) => (
              <button
                key={item.id}
                className={selected?.id === item.id ? "active" : ""}
                onClick={() => setSelected(item)}
              >
                <span className="public-icon"><MiniIcon name="clock" /></span>
                <span>
                  <strong>{item.title}</strong><br />
                  <small>{item.created_at || item.time || "Just now"} · {typeLabel[item.type] || item.type}</small>
                </span>
              </button>
            ))}
          </section>
          {selected && (
            <section className="new-card history-detail">
              <p className="eyebrow">SESSION DETAILS</p>
              <h2>{selected.title}</h2>
              <p>{selected.created_at || selected.time || "Just now"}</p>
              <div><strong>Type:</strong> {typeLabel[selected.type] || selected.type}</div>
              <div><strong>Meta:</strong> {JSON.stringify(selected.metadata || {})}</div>
              <button className="danger-new" onClick={() => { const next = items.filter((item: any) => item.id !== selected.id); setItems(next); setSelected(next[0] || null) }}><MiniIcon name="trash" /> Delete session</button>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
'@
  $c = $head + $newFunc + $tail
  Set-Content $p $c
  "HISTORY_REPLACED"
} else {
  "NOT FOUND start=$start end=$end"
}
