export function LegalFooter() {
  return (
    <footer className="legal-footer" aria-label="Legal information">
      <a href="/privacy">Privacy Policy</a>
      <span aria-hidden="true">|</span>
      <a href="/terms">Terms of Service</a>
      <span aria-hidden="true">|</span>
      <a href="/refund">Refund Policy</a>
    </footer>
  );
}

export default function LegalPage({ title, children }) {
  return (
    <main className="app-shell legal-shell">
      <article className="legal-page" aria-labelledby="legal-page-title">
        <p className="quest-label">LEARNING QUEST</p>
        <h1 id="legal-page-title">{title}</h1>
        <div className="legal-page-content">{children}</div>
        <a className="legal-back-link" href="/">Back to the app</a>
      </article>
      <LegalFooter />
    </main>
  );
}
