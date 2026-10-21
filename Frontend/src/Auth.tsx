import {
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { signIn, signUp, type Session } from "./auth.ts"
import { continueWithGoogle } from "./api"
import { LumiMark, PageLumi, goTo } from "./Pages"

type Mode = "signin" | "signup"
type FieldErrors = Partial<
  Record<"name" | "email" | "password" | "confirmPassword" | "terms" | "form", string>
>

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function AuthIcon({
  name,
}: {
  name: "eye" | "eyeOff" | "shield" | "volume" | "error" | "arrow"
}) {
  const paths: Record<string, ReactNode> = {
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-2.1 3M6.6 6.6C3.6 8.5 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4.1-.9" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    volume: <path d="M11 5 6 9H3v6h3l5 4zM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" />,
    error: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </>
    ),
    arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function AuthLumi() {
  return <PageLumi mood="happy" />
}

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null
  return (
    <p className="field-error" id={id} role="alert">
      <AuthIcon name="error" />
      {children}
    </p>
  )
}

export default function Auth({
  onAuthenticated,
  initialMode = "signin",
}: {
  onAuthenticated: (session: Session, isNew: boolean) => void
  initialMode?: Mode
}) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [password, setPassword] = useState("")
  const [terms, setTerms] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode)
    setErrors({})
    setPassword("")
    setShowPassword(false)
    requestAnimationFrame(() => {
      ;(nextMode === "signup" ? nameRef : emailRef).current?.focus()
    })
  }

  const validate = (data: FormData): FieldErrors => {
    const nextErrors: FieldErrors = {}
    const name = String(data.get("name") ?? "").trim()
    const email = String(data.get("email") ?? "").trim()
    const enteredPassword = String(data.get("password") ?? "")
    const confirmPassword = String(data.get("confirmPassword") ?? "")

    if (mode === "signup" && !name) nextErrors.name = "Please tell us your name."
    if (!email) nextErrors.email = "Please enter your email address."
    else if (!emailPattern.test(email))
      nextErrors.email = "Enter a valid email address."
    if (!enteredPassword)
      nextErrors.password = "Please enter your password."
    else if (enteredPassword.length < 8)
      nextErrors.password = "Use at least 8 characters."
    if (mode === "signup" && enteredPassword !== confirmPassword)
      nextErrors.confirmPassword = "Those passwords don’t match yet."
    if (mode === "signup" && !terms)
      nextErrors.terms = "Please agree to the terms to continue."

    return nextErrors
  }

  const focusFirstError = (nextErrors: FieldErrors) => {
    const refs = {
      name: nameRef,
      email: emailRef,
      password: passwordRef,
      confirmPassword: confirmRef,
    }
    const first = (["name", "email", "password", "confirmPassword"] as const).find(
      (field) => nextErrors[field],
    )
    if (first) requestAnimationFrame(() => refs[first].current?.focus())
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const nextErrors = validate(data)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      focusFirstError(nextErrors)
      return
    }

    setSubmitting(true)
    setErrors({})
    try {
      const email = String(data.get("email"))
      const enteredPassword = String(data.get("password"))
      const session =
        mode === "signup"
          ? await signUp(String(data.get("name")), email, enteredPassword)
          : await signIn(email, enteredPassword, keepSignedIn)
      onAuthenticated(session, mode === "signup")
    } catch (error) {
      const message =
        error instanceof Error && error.message === "DUPLICATE_EMAIL"
          ? "An account with this email already exists."
          : "That email and password don’t match."
      const next = mode === "signup" ? { email: message } : { form: message }
      setErrors(next)
      requestAnimationFrame(() => emailRef.current?.focus())
    } finally {
      setSubmitting(false)
    }
  }

  const strength = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  return (
    <main className="auth-shell">
      <section className="auth-story" aria-labelledby="auth-story-title">
        <button type="button" className="auth-brand auth-brand-button" onClick={() => goTo("landing")}>
          <LumiMark />
          <span>
            <strong>Sight</strong>
            <small>Companion</small>
          </span>
        </button>
        <div className="auth-story-copy">
          <span className="auth-kicker">Your world, made clearer</span>
          <h1 id="auth-story-title">
            A voice that
            <br />
            <em>sees with you.</em>
          </h1>
          <p>
            Calm, real-time guidance that helps you understand and move through
            your surroundings with confidence.
          </p>
          <div className="auth-lumi-wrap">
            <div className="auth-speech" aria-live="polite">
              <strong>
                {mode === "signin" ? "Welcome back!" : "Nice to meet you!"}
              </strong>
              <span>Lumi is ready when you are.</span>
            </div>
            <AuthLumi />
          </div>
          <div className="auth-badges">
            <span><AuthIcon name="shield" /> 100% offline</span>
            <span><AuthIcon name="volume" /> Voice-first guidance</span>
          </div>
        </div>
      </section>

      <section className="auth-form-panel" aria-labelledby="auth-title">
        <button type="button" className="auth-mobile-brand auth-brand-button" onClick={() => goTo("landing")}>
          <LumiMark />
          <strong>Sight Companion</strong>
        </button>
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={mode === "signin" ? "active" : ""}
              onClick={() => switchMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "active" : ""}
              onClick={() => switchMode("signup")}
            >
              Sign up
            </button>
          </div>
          <div className="auth-heading">
            <span className="auth-kicker">
              {mode === "signin" ? "WELCOME BACK" : "JOIN SIGHT COMPANION"}
            </span>
            <h2 id="auth-title">
              {mode === "signin" ? "Good to see you" : "Create your account"}
            </h2>
            <p>
              {mode === "signin"
                ? "Sign in to continue with your personal settings."
                : "Everything stays securely on this device."}
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {errors.form && (
              <div className="form-error" role="alert">
                <AuthIcon name="error" />
                {errors.form}
              </div>
            )}
            {mode === "signup" && (
              <div className="auth-field">
                <label htmlFor="auth-name">Name</label>
                <input
                  ref={nameRef}
                  id="auth-name"
                  name="name"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  placeholder="How should Lumi greet you?"
                />
                <FieldError id="name-error">{errors.name}</FieldError>
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="auth-email">Email</label>
              <input
                ref={emailRef}
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                placeholder="you@example.com"
              />
              <FieldError id="email-error">{errors.email}</FieldError>
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <div className="password-wrap">
                <input
                  ref={passwordRef}
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  placeholder={mode === "signin" ? "Enter your password" : "At least 8 characters"}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  <AuthIcon name={showPassword ? "eyeOff" : "eye"} />
                </button>
              </div>
              <FieldError id="password-error">{errors.password}</FieldError>
              {mode === "signup" && (
                <div className="password-strength">
                  <div aria-hidden="true">
                    {[1, 2, 3, 4].map((segment) => (
                      <i key={segment} className={segment <= strength ? "filled" : ""} />
                    ))}
                  </div>
                  <span>
                    {strength < 2 ? "Keep going" : strength < 4 ? "Good password" : "Strong password"}
                  </span>
                </div>
              )}
            </div>
            {mode === "signup" && (
              <div className="auth-field">
                <label htmlFor="auth-confirm">Confirm password</label>
                <input
                  ref={confirmRef}
                  id="auth-confirm"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
                  placeholder="Enter it once more"
                />
                <FieldError id="confirm-error">{errors.confirmPassword}</FieldError>
              </div>
            )}
            {mode === "signup" && (
              <div>
                <label className="auth-check">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(event) => setTerms(event.target.checked)}
                  />
                  <span>I agree to the Terms and Privacy Policy.</span>
                </label>
                <FieldError id="terms-error">{errors.terms}</FieldError>
              </div>
            )}
            {mode === "signin" && (
              <div className="auth-signin-options">
                <label className="auth-check">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(event) => setKeepSignedIn(event.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                <button type="button" onClick={() => goTo("forgot")}>
                  Forgot password?
                </button>
              </div>
            )}
            <button className="auth-primary" type="submit" disabled={submitting}>
              {submitting
                ? "Securing your account…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              {!submitting && <AuthIcon name="arrow" />}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>
          <button
            type="button"
            className="auth-guest"
            onClick={async () =>
              onAuthenticated(await continueWithGoogle(), mode === "signup")
            }
          >
            Continue as guest
          </button>
          <p className="auth-switch">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                const nextMode = mode === "signin" ? "signup" : "signin"
                switchMode(nextMode)
                goTo(nextMode === "signin" ? "login" : "signup")
              }}
            >
              {mode === "signin" ? "Create an account" : "Sign in instead"}
            </button>
          </p>
          <p className="auth-privacy">
            <AuthIcon name="shield" />
            Private by design. Your account never leaves this device.
          </p>
        </div>
      </section>
    </main>
  )
}
