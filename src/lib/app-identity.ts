/**
 * The native app's identity, in one place. The app ID and name are placeholders until the
 * domain and store name are confirmed; mobile/capacitor.config.ts reads the same values.
 */
export const APP_ID = "ie.hoopsfantasy.app";
export const APP_NAME = "Hoops Fantasy";
/** The live website the native app loads. A placeholder until the domain is confirmed. */
export const PRODUCTION_URL = "https://hoopsfantasy.ie";
/** Google sign-in returns to the app through this scheme (see design.md). */
export const APP_URL_SCHEME = APP_ID;

/** Paths that open in the app when it's installed: league invites and sign-in links. */
export const APP_LINK_PATHS = ["/join/*", "/auth/callback*"];

type Env = Record<string, string | undefined>;

/** The Apple Developer team that signs the iOS app, e.g. "A1B2C3D4E5". */
export function appleTeamId(env: Env = process.env): string | null {
  const id = env.APPLE_TEAM_ID?.trim();
  return id && /^[A-Z0-9]{10}$/.test(id) ? id : null;
}

/** SHA-256 fingerprints of the Android signing certificates (Play app signing, plus upload key). */
export function androidCertFingerprints(env: Env = process.env): string[] {
  return (env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
}
