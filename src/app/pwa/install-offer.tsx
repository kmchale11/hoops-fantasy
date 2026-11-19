"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./pwa.module.css";

export const DISMISS_KEY = "hf-install-dismissed-at";
export const DISMISS_DAYS = 30;

/** Chrome's install event, which TypeScript's DOM types don't include. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** For browser-only values that don't change while the page is open. */
const noSubscription = () => () => {};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function dismissedRecently(now: number): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && now - at < DISMISS_DAYS * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

/** iPhone and iPad Safari, which has no install prompt: people add the site from the Share menu. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * Offers to install the app, for signed-in users only (pages render it only for them). Hidden
 * inside the installed app and for 30 days after it's dismissed.
 */
export default function InstallOffer() {
  // False on the server and during hydration, so the offer only ever appears in the browser.
  const eligible = useSyncExternalStore(
    noSubscription,
    () => !isStandalone() && !dismissedRecently(Date.now()),
    () => false,
  );
  const ios = useSyncExternalStore(noSubscription, isIosSafari, () => false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!eligible || ios) return;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => setClosed(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [eligible, ios]);

  if (!eligible || closed || (!ios && !promptEvent)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private browsing: it just shows again next time.
    }
    setClosed(true);
  };

  return (
    <aside className={styles.install} aria-label="Install the app">
      {promptEvent ? (
        <>
          <p>Add Hoops Fantasy to your home screen to check your squad in one tap.</p>
          <button
            type="button"
            className={styles.primary}
            onClick={async () => {
              await promptEvent.prompt();
              const { outcome } = await promptEvent.userChoice;
              if (outcome === "dismissed") dismiss();
              else setClosed(true);
            }}
          >
            Install app
          </button>
        </>
      ) : (
        <p>
          Add Hoops Fantasy to your home screen: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
        </p>
      )}
      <button type="button" className={styles.dismiss} onClick={dismiss}>
        Not now
      </button>
    </aside>
  );
}
