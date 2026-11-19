"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import styles from "@/app/forms.module.css";
import { HELP, turnOnNotifications } from "./turn-on";

/**
 * Offered once, after a user's first squad save. The phone's or browser's own permission prompt
 * only appears if they tap "Turn on reminders", because a declined prompt can't be shown again.
 */
export default function ReminderCard({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<"offer" | "on" | "closed" | { help: string }>("offer");
  const [pending, startTransition] = useTransition();
  if (state === "closed") return null;

  if (state === "on") {
    return (
      <aside className={styles.notice} role="status">
        Reminders are on. Change them any time in <Link href="/account/notifications">notification settings</Link>.
      </aside>
    );
  }

  return (
    <aside className={styles.card} aria-labelledby="reminders-heading">
      <h2 id="reminders-heading" className={styles.label}>
        Turn on reminders?
      </h2>
      <p className={styles.hint}>
        We&apos;ll remind you 24 hours and 1 hour before your squad locks, and tell you your score when each
        round ends.
      </p>
      {typeof state === "object" && (
        <p className={styles.error} role="alert">
          {state.help}
        </p>
      )}
      <button
        type="button"
        className={styles.button}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const outcome = await turnOnNotifications(vapidPublicKey);
            if (outcome.status === "enabled") setState("on");
            else setState({ help: outcome.status === "error" ? outcome.message : HELP[outcome.status] });
          })
        }
      >
        Turn on reminders
      </button>
      <button type="button" className={styles.secondary} onClick={() => setState("closed")}>
        Not now
      </button>
    </aside>
  );
}
