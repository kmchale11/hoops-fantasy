/**
 * The offline screen: one self-contained HTML document (inline styles, no scripts beyond the
 * retry button), so it renders with no network at all. The service worker caches it, and the
 * native app bundles a copy (APP_OFFLINE_HTML).
 */
export const OFFLINE_HTML = `<!doctype html>
<html lang="en-IE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b6e4f">
<title>No connection · Hoops Fantasy</title>
<style>
  :root { --bg: #ffffff; --fg: #171717; --muted: #5f6368; --accent: #0b6e4f; --on-accent: #ffffff; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0f1115; --fg: #ececec; --muted: #a0a4ab; --accent: #3fbf8f; --on-accent: #0f1115; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px 16px; background: var(--bg); color: var(--fg);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; text-align: center;
  }
  main { max-width: 360px; }
  svg { width: 96px; height: 96px; }
  h1 { font-size: 1.4rem; margin: 16px 0 8px; }
  p { color: var(--muted); margin: 0 0 24px; line-height: 1.5; }
  button {
    font: inherit; font-weight: 600; padding: 12px 32px; border: none; border-radius: 8px;
    color: var(--on-accent); background: var(--accent); cursor: pointer;
  }
</style>
</head>
<body>
<main>
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <rect width="100" height="100" rx="22" fill="#0b6e4f"/>
    <circle cx="50" cy="50" r="37" fill="#f28c28" stroke="#3b1d06" stroke-width="2.2"/>
    <g fill="none" stroke="#3b1d06" stroke-width="2.2" stroke-linecap="round">
      <line x1="13" y1="50" x2="87" y2="50"/><line x1="50" y1="13" x2="50" y2="87"/>
      <path d="M27 21 Q43 50 27 79"/><path d="M73 21 Q57 50 73 79"/>
    </g>
  </svg>
  <h1>You're offline</h1>
  <p>Hoops Fantasy needs a connection to show your squad and scores. Check your signal or Wi-Fi, then try again.</p>
  <button type="button" onclick="location.reload()">Try again</button>
</main>
</body>
</html>
`;

/**
 * The native app's copy, written into mobile/www/ at each sync. The app shows it whenever the
 * website fails to load, which on Android includes error responses, so it doesn't claim the
 * phone is offline. It's served from inside the app, so "Try again" goes to the website's
 * start page by its full address.
 */
export function appOfflineHtml(siteUrl: string): string {
  const start = JSON.stringify(new URL("/start", siteUrl).href).replace(/"/g, "&quot;");
  return OFFLINE_HTML.replace("<title>No connection · Hoops Fantasy</title>", "<title>Hoops Fantasy</title>")
    .replace("<h1>You're offline</h1>", "<h1>Can't reach Hoops Fantasy</h1>")
    .replace(
      "Hoops Fantasy needs a connection to show your squad and scores. Check your signal or Wi-Fi, then try again.",
      "Your squad and scores need a connection. Check your signal or Wi-Fi, then try again.",
    )
    .replace(`onclick="location.reload()"`, `onclick="location.replace(${start})"`);
}
