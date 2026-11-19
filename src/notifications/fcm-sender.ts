import { createSign } from "node:crypto";
import type { PushMessage, PushSender, PushTarget, SendOutcome } from "./sender";

/** The fields of a Firebase service account key that sending needs. */
export interface FirebaseServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

/** The FCM HTTP v1 message for a native app. FCM relays to APNs for iPhones. */
export function fcmMessage(token: string, message: PushMessage) {
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      // Read by the app when the notification is tapped.
      data: { url: message.url },
      android: { priority: "high", ttl: "3600s", notification: { tag: message.tag, click_action: "OPEN_URL" } },
      apns: {
        headers: { "apns-priority": "10", "apns-collapse-id": message.tag },
        payload: { aps: { sound: "default", "thread-id": message.tag } },
      },
    },
  };
}

const base64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

/** A signed JWT exchanged for an access token (Google's service account flow). */
function signedAssertion(account: FirebaseServiceAccount, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.privateKey);
  return `${header}.${claims}.${base64url(signature)}`;
}

/** True when FCM says the token no longer belongs to an installed app. */
function isUnregistered(status: number, body: unknown): boolean {
  const details = (body as { error?: { details?: { errorCode?: string }[] } })?.error?.details ?? [];
  return status === 404 || details.some((d) => d.errorCode === "UNREGISTERED");
}

/** Sends to the iOS and Android apps through Firebase Cloud Messaging's HTTP v1 API. */
export function fcmSender(
  account: FirebaseServiceAccount,
  { fetch: fetchFn = fetch, now = () => new Date() }: { fetch?: typeof fetch; now?: () => Date } = {},
): PushSender {
  let cached: { token: string; expires: number } | null = null;

  async function accessToken(): Promise<string> {
    const at = now().getTime();
    if (cached && cached.expires - 60_000 > at) return cached.token;
    const response = await fetchFn(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signedAssertion(account, now()),
      }),
    });
    if (!response.ok) throw new Error(`Firebase sign-in failed (${response.status})`);
    const { access_token, expires_in } = (await response.json()) as { access_token: string; expires_in: number };
    cached = { token: access_token, expires: at + expires_in * 1000 };
    return access_token;
  }

  return {
    async send(target: PushTarget, message: PushMessage): Promise<SendOutcome> {
      try {
        const response = await fetchFn(
          `https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
            body: JSON.stringify(fcmMessage(target.endpoint, message)),
          },
        );
        if (response.ok) return "sent";
        return isUnregistered(response.status, await response.json().catch(() => null)) ? "unregistered" : "failed";
      } catch {
        return "failed";
      }
    },
  };
}
