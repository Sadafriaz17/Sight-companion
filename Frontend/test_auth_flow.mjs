import { createClient } from "@supabase/supabase-js"

const url = "https://cfszncvgqxbymnzpamxh.supabase.co"
const key = "sb_publishable_RQFTBEdmj6AiF7dHAeRYbw_q2ntqoHW"

const supabase = createClient(url, key)

const email = `sctest.user.${Date.now()}@gmail.com`
const password = "TestPass123!"

console.log("1. Signing up...")
const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name: "Test User" } },
})
if (signUpError) { console.log("SIGNUP ERROR:", signUpError.message); process.exit(1) }
console.log("   Signed up:", signUpData.user?.id)

const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
if (sessionError) { console.log("SESSION ERROR:", sessionError.message); process.exit(1) }
const token = sessionData.session?.access_token
console.log("   Token present:", Boolean(token))

const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

async function api(path, opts = {}) {
  const res = await fetch("http://localhost:5000" + path, { headers: { ...headers, ...opts.headers }, ...opts })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

console.log("\n2. GET /api/preferences (no prefs yet -> preferences: null)...")
let r = await api("/api/preferences")
console.log("   status:", r.status, JSON.stringify(r.body))

console.log("\n3. PUT /api/preferences (save voice_on=false)...")
r = await api("/api/preferences", { method: "PUT", body: JSON.stringify({ voice_on: false, text_size: 3 }) })
console.log("   status:", r.status, JSON.stringify(r.body))

console.log("\n4. GET /api/preferences (should return saved prefs)...")
r = await api("/api/preferences")
console.log("   status:", r.status, JSON.stringify(r.body))

console.log("\n5. GET /api/profile...")
r = await api("/api/profile")
console.log("   status:", r.status, JSON.stringify(r.body))

console.log("\n6. PUT /api/profile (update full_name)...")
r = await api("/api/profile", { method: "PUT", body: JSON.stringify({ full_name: "Updated Tester" }) })
console.log("   status:", r.status, JSON.stringify(r.body))

console.log("\n7. GET /api/detection-history...")
r = await api("/api/detection-history")
console.log("   status:", r.status, JSON.stringify(r.body))

console.log("\n8. GET /api/ocr-history...")
r = await api("/api/ocr-history")
console.log("   status:", r.status, JSON.stringify(r.body))

console.log("\n9. GET /api/activity-history...")
r = await api("/api/activity-history")
console.log("   status:", r.status, JSON.stringify(r.body))

console.log("\n10. POST /api/camera/start (no camera -> may fail, but auth should pass)...")
r = await api("/api/camera/start", { method: "POST" })
console.log("   status:", r.status, JSON.stringify(r.body))

console.log("\nDONE")
