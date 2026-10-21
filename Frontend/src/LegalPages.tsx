import { PageLumi, goTo } from "./Pages"

function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const privacy = kind === "privacy"

  return (
    <main className="simple-public legal-page">
      <button className="simple-brand" onClick={() => goTo("landing")}>
        Sight Companion
      </button>
      <article className="simple-public-card">
        <PageLumi mood="proud" />
        <p className="eyebrow">{privacy ? "PRIVACY" : "TERMS"}</p>
        <h1>
          {privacy ? "Your information stays yours" : "Simple terms of use"}
        </h1>
        {privacy ? (
          <>
            <h2>Camera pictures</h2>
            <p>
              Camera pictures are used on your device. We do not upload or save
              them.
            </p>
            <h2>Your account</h2>
            <p>
              Your account, settings, chats, and activity stay in this browser.
            </p>
            <h2>Your control</h2>
            <p>
              You can clear your local account from Profile at any time.
            </p>
          </>
        ) : (
          <>
            <h2>Use with care</h2>
            <p>
              Sight Companion can help, but it can make mistakes. Use your
              usual mobility tools and skills.
            </p>
            <h2>Safety</h2>
            <p>
              Do not rely on Sight Companion alone for roads, traffic, or other
              danger.
            </p>
            <h2>Your device</h2>
            <p>
              You are responsible for camera and sound permission on your
              device.
            </p>
          </>
        )}
        <button className="primary-button" onClick={() => goTo("landing")}>
          Back to home
        </button>
      </article>
    </main>
  )
}

export function PrivacyPage() {
  return <LegalPage kind="privacy" />
}

export function TermsPage() {
  return <LegalPage kind="terms" />
}
