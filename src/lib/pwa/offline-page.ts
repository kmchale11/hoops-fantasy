import { APP_NAME, THEME_COLOR } from "@/lib/app-identity";

interface OfflinePage {
  title: string;
  heading: string;
  message: string;
  /** What "Try again" runs. */
  retry: string;
}

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The offline screen: one self-contained HTML document (inline styles, no scripts beyond the
 * retry button), so it renders with no network at all. The service worker caches the website's
 * copy (OFFLINE_HTML), and the native app bundles its own (appOfflineHtml).
 */
function offlinePage({ title, heading, message, retry }: OfflinePage): string {
  return `<!doctype html>
<html lang="en-IE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${THEME_COLOR}">
<title>${escape(title)}</title>
<style>
  :root { color-scheme: dark; --bg: #10141c; --fg: #f2f4f7; --muted: #9aa3b2; --accent: #ff6b1a; --on-accent: #10141c; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px 16px; background: var(--bg); color: var(--fg);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; text-align: center;
  }
  main { max-width: 360px; }
  svg { width: 96px; height: 96px; }
  h1 {
    font-family: "Barlow Condensed", "Arial Narrow", sans-serif; font-size: 1.9rem; font-weight: 800;
    text-transform: uppercase; line-height: 1.05; margin: 16px 0 8px;
  }
  p { color: var(--muted); margin: 0 0 24px; line-height: 1.5; }
  button {
    font: inherit; font-weight: 700; min-height: 48px; padding: 12px 32px; border: none; border-radius: 14px;
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
  <h1>${escape(heading)}</h1>
  <p>${escape(message)}</p>
  <button type="button" onclick="${escape(retry)}">Try again</button>
</main>
</body>
</html>
`;
}

export const OFFLINE_HTML = offlinePage({
  title: `No connection · ${APP_NAME}`,
  heading: "You're offline",
  message: `${APP_NAME} needs a connection to show your squad and scores. Check your signal or Wi-Fi, then try again.`,
  retry: "location.reload()",
});

/**
 * The native app's copy, written into mobile/www/ at each sync. The app shows it whenever the
 * website fails to load, which on Android includes error responses, so it doesn't claim the
 * phone is offline. It's served from inside the app, so "Try again" goes to the website's
 * start page by its full address.
 */
export function appOfflineHtml(siteUrl: string): string {
  return offlinePage({
    title: APP_NAME,
    heading: `Can't reach ${APP_NAME}`,
    message: "Your squad and scores need a connection. Check your signal or Wi-Fi, then try again.",
    retry: `location.replace(${JSON.stringify(new URL("/start", siteUrl).href)})`,
  });
}
