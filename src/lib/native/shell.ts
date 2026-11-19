import { APP_LINK_PATHS, APP_URL_SCHEME, PRODUCTION_URL } from "@/lib/app-identity";

/** What the iOS and Android apps add to the page (window.Capacitor). Absent on the website. */
interface NativeShell {
  isNativePlatform(): boolean;
  Plugins: {
    App?: {
      addListener(event: "appUrlOpen", fn: (e: { url: string }) => void): Promise<{ remove(): Promise<void> }>;
    };
    Browser?: {
      open(options: { url: string }): Promise<void>;
    };
    Share?: {
      share(options: { title: string; text: string; url: string; dialogTitle?: string }): Promise<unknown>;
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
 * our website, or Google sign-in returning to the app's own scheme
 * (ie.hoopsfantasy.app://auth/callback?code=…). Anything else gives null, so a link can't send
 * the app somewhere unexpected.
 */
export function inAppPath(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol === `${APP_URL_SCHEME}:`) {
    return url.host === "auth" && url.pathname === "/callback" ? `/auth/callback${url.search}` : null;
  }
  if (url.protocol !== "https:" || url.host !== new URL(PRODUCTION_URL).host) return null;
  if (!linkPatterns.some((p) => p.test(url.pathname))) return null;
  return url.pathname + url.search + url.hash;
}
