export type Session = {
  id: string
  name: string
  email: string
  isGuest: boolean
}

type StoredAccount = {
  id: string
  name: string
  email: string
  salt: string
  passwordHash: string
}

const ACCOUNTS_KEY = "sight-companion:accounts"
const SESSION_KEY = "sight-companion:session"
const ITERATIONS = 210_000

function readAccounts(): StoredAccount[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]")
  } catch {
    return []
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

async function derivePassword(password: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: ITERATIONS,
    },
    keyMaterial,
    256,
  )
  return bytesToBase64(new Uint8Array(bits))
}

function saveSession(session: Session, persistent: boolean): Session {
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(SESSION_KEY)
  const storage = persistent ? localStorage : sessionStorage
  storage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<Session> {
  const normalizedEmail = email.trim().toLowerCase()
  const accounts = readAccounts()

  if (accounts.some((account) => account.email === normalizedEmail)) {
    throw new Error("DUPLICATE_EMAIL")
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const account: StoredAccount = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    salt: bytesToBase64(salt),
    passwordHash: await derivePassword(password, salt),
  }
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]))

  return saveSession(
    {
      id: account.id,
      name: account.name,
      email: account.email,
      isGuest: false,
    },
    false,
  )
}

export async function signIn(
  email: string,
  password: string,
  keepSignedIn: boolean,
): Promise<Session> {
  const normalizedEmail = email.trim().toLowerCase()
  const account = readAccounts().find((item) => item.email === normalizedEmail)

  if (
    !account ||
    (await derivePassword(password, base64ToBytes(account.salt))) !==
      account.passwordHash
  ) {
    throw new Error("INVALID_CREDENTIALS")
  }

  return saveSession(
    {
      id: account.id,
      name: account.name,
      email: account.email,
      isGuest: false,
    },
    keepSignedIn,
  )
}

export function signOut(): void {
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(SESSION_KEY)
}

export function currentSession(): Session | null {
  const value =
    sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY)
  if (!value) return null

  try {
    return JSON.parse(value) as Session
  } catch {
    signOut()
    return null
  }
}

export function guestSession(): Session {
  return saveSession(
    {
      id: "guest",
      name: "Guest",
      email: "Offline demo",
      isGuest: true,
    },
    false,
  )
}
