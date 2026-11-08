console.log("GET /api/preferences without token")
let r = await fetch("http://localhost:5000/api/preferences")
let j = await r.json().catch(() => ({}))
console.log("  status:", r.status, JSON.stringify(j))

console.log("\nGET /api/preferences with invalid token")
r = await fetch("http://localhost:5000/api/preferences", { headers: { Authorization: "Bearer invalid.token.value" } })
j = await r.json().catch(() => ({}))
console.log("  status:", r.status, JSON.stringify(j))

console.log("\nPOST /api/camera/start without token")
r = await fetch("http://localhost:5000/api/camera/start", { method: "POST" })
j = await r.json().catch(() => ({}))
console.log("  status:", r.status, JSON.stringify(j))
