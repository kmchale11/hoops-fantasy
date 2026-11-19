"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import styles from "@/app/forms.module.css";
import type { NotificationSettings as Settings } from "@/notifications/settings";
import { saveNotificationKinds } from "./actions";
import { HELP, turnOffNotifications, turnOnNotifications } from "./turn-on";

/** The master switch plus a switch for each kind of notification. */
export default function NotificationSettings({
  initial,
  vapidPublicKey,
}: {
  initial: Settings;
  vapidPublicKey: string | null;
}) {
  const [settings, setSettings] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // If the browser already blocks notifications, say how to allow them before anyone taps.
  const blocked = useSyncExternalStore(
    () => () => {},
    () => "Notification" in window && Notification.permission === "denied",
    () => false,
  );
  const shown = message ?? (!settings.enabled && blocked ? HELP.denied : null);

  if (!vapidPublicKey) {
    return <p className="muted">Notifications aren&apos;t available yet.</p>;
  }

  const turnOn = () =>
    startTransition(async () => {
      const outcome = await turnOnNotifications(vapidPublicKey);
      if (outcome.status === "enabled") {
        setSettings(outcome.settings);
        setMessage(null);
      } else {
        setMessage(outcome.status === "error" ? outcome.message : HELP[outcome.status]);
      }
    });

  const turnOff = () =>
    startTransition(async () => {
      const result = await turnOffNotifications();
      if (result.ok) setSettings(result.settings);
      setMessage(result.ok ? null : result.error);
    });

  const setKind = (kind: "deadlineReminders" | "roundResults", on: boolean) =>
    startTransition(async () => {
      const result = await saveNotificationKinds({ ...settings, [kind]: on });
      if (result.ok) setSettings(result.settings);
      setMessage(result.ok ? null : result.error);
    });

  return (
    <div className={styles.card}>
      <p>
        Notifications are <strong>{settings.enabled ? "on" : "off"}</strong>.
      </p>
      {settings.enabled ? (
        <button type="button" className={styles.secondary} onClick={turnOff} disabled={pending}>
          Turn off notifications
        </button>
      ) : (
        <button type="button" className={styles.button} onClick={turnOn} disabled={pending}>
          Turn on notifications
        </button>
      )}
      {shown && (
        <p className={styles.error} role="alert">
          {shown}
        </p>
      )}

      <fieldset disabled={!settings.enabled || pending} style={{ border: 0, padding: 0, margin: "8px 0 0" }}>
        <legend className={styles.label}>Send me</legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="deadlineReminders"
            checked={settings.deadlineReminders}
            onChange={(e) => setKind("deadlineReminders", e.target.checked)}
          />
          <span>Deadline reminders, 24 hours and 1 hour before your squad locks</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="roundResults"
            checked={settings.roundResults}
            onChange={(e) => setKind("roundResults", e.target.checked)}
          />
          <span>Round results, with your score (never between 22:00 and 08:00)</span>
        </label>
      </fieldset>
    </div>
  );
}
