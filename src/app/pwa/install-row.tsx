"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { isIosSafari, isStandalone, noSubscription, type InstallPromptEvent } from "./install-offer";

/**
 * "Add to home screen" on the More page. Opens the browser's install prompt where there is one,
 * and otherwise says how to do it. Not shown inside the installed or native app.
 */
export default function InstallRow({ className, hintClassName }: { className: string; hintClassName: string }) {
  const show = useSyncExternalStore(noSubscription, () => !isStandalone(), () => false);
  const ios = useSyncExternalStore(noSubscription, isIosSafari, () => false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [explain, setExplain] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show) return null;
  return (
    <button
      type="button"
      className={className}
      aria-expanded={promptEvent ? undefined : explain}
      onClick={async () => {
        if (promptEvent) await promptEvent.prompt();
        else setExplain(!explain);
      }}
    >
      <span>Add to home screen</span>
      <span className={hintClassName}>
        {explain
          ? ios
            ? "Tap Share, then Add to Home Screen."
            : "Open your browser's menu and choose Install app or Add to Home screen."
          : "Open it like an app"}
      </span>
    </button>
  );
}
