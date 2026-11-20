"use client";

import { APP_NAME } from "@/lib/app-identity";
import type { NotificationSettings } from "@/notifications/settings";
import { disableNotifications, enableNotifications } from "./actions";

export type TurnOnOutcome =
  | { status: "enabled"; settings: NotificationSettings }
  | { status: "denied" }
  | { status: "install-first" }
  | { status: "unsupported" }
  | { status: "error"; message: string };

export const HELP: Record<"denied" | "install-first" | "unsupported", string> = {
  denied:
    `Notifications are blocked for ${APP_NAME}. To allow them, open your phone's Settings (or this browser's site settings), turn notifications on for ${APP_NAME}, then try again.`,
  "install-first":
    `On iPhone, notifications work once ${APP_NAME} is on your Home Screen: tap Share, then Add to Home Screen, and open it from there. Or get the app from the App Store.`,
  unsupported: `This browser can't show notifications. Try Chrome, Edge, Firefox or Safari, or the ${APP_NAME} app.`,
};

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** VAPID public keys are URL-safe base64; the Push API wants the raw bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * Only ever called from a tap on "Turn on": shows the browser's permission prompt, subscribes
 * this browser for Web Push and stores it. A declined prompt leaves notifications off.
 */
export async function turnOnNotifications(vapidPublicKey: string): Promise<TurnOnOutcome> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return { status: isIos() && !isStandalone() ? "install-first" : "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) }));
    const result = await enableNotifications({ kind: "web", ...subscription.toJSON() });
    return result.ok ? { status: "enabled", settings: result.settings } : { status: "error", message: result.error };
  } catch {
    return { status: "error", message: "Notifications couldn't be turned on. Please try again." };
  }
}

/** Turns notifications off and unsubscribes this browser. */
export async function turnOffNotifications() {
  let endpoint: string | null = null;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) {
      endpoint = subscription.endpoint;
      await subscription.unsubscribe();
    }
  } catch {
    // Still turn them off on the server.
  }
  return disableNotifications(endpoint);
}
