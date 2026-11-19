import { APP_LINK_PATHS, PRODUCTION_URL } from "@/lib/app-identity";

/** What the iOS and Android apps add to the page (window.Capacitor). Absent on the website. */
interface NativeShell {
  isNativePlatform(): boolean;
  Plugins: {
    App?: {
      addListener(event: "appUrlOpen", fn: (e: { url: string }) => void): Promise<{ remove(): Promise<void> }>;
    };
  };
}

/** The app's native features, or null on the website. */
export function nativeShell(): NativeShell | null {
  const shell = (globalThis as { Capacitor?: NativeShell }).Capacitor;
  return shell?.isNativePlatform() ? shell : null;
}

const linkPatterns = APP_LINK_PATHS.map(
  (p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`),
);

/**
 * The page to show for a link the phone opened in the app: a league invite or sign-in link on
 * our website. Anything else gives null, so a link can't send the app somewhere unexpected.
 */
export function inAppPath(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.host !== new URL(PRODUCTION_URL).host) return null;
  if (!linkPatterns.some((p) => p.test(url.pathname))) return null;
  return url.pathname + url.search + url.hash;
}
