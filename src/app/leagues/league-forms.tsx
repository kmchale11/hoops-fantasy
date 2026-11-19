"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import styles from "@/app/forms.module.css";
import { createLeagueAction, joinLeagueAction, type LeagueFormState } from "./actions";

export function CreateLeagueForm() {
  const [state, action, pending] = useActionState<LeagueFormState, FormData>(createLeagueAction, {
    error: null,
    value: "",
  });
  return (
    <form className={styles.card} action={action}>
      <label className={styles.label} htmlFor="league-name">
        League name
      </label>
      <input
        id="league-name"
        name="name"
        className={styles.input}
        defaultValue={state.value}
        maxLength={40}
        required
        aria-invalid={Boolean(state.error)}
        aria-describedby="league-name-hint"
      />
      <p id="league-name-hint" className={styles.hint}>
        3–40 characters, like your club, workplace or group chat.
      </p>
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create league"}
      </button>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function JoinLeagueForm({ code = "" }: { code?: string }) {
  const [state, action, pending] = useActionState<LeagueFormState, FormData>(joinLeagueAction, {
    error: null,
    value: code,
  });
  return (
    <form className={styles.card} action={action}>
      <label className={styles.label} htmlFor="invite-code">
        Invite code
      </label>
      <input
        id="invite-code"
        name="code"
        className={styles.input}
        defaultValue={state.value}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={12}
        required
        aria-invalid={Boolean(state.error)}
      />
      <p className={styles.hint}>The 6-character code from whoever runs the league.</p>
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "Joining…" : "Join league"}
      </button>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

const noSubscribe = () => () => {};

/** The invite message: the league name and its full /join/<code> link, built from the address the user is on. */
export function inviteMessage(leagueName: string, path: string, origin: string) {
  const url = new URL(path, origin).toString();
  return { title: `Join ${leagueName} on Hoops Fantasy`, text: `Join my league "${leagueName}" on Hoops Fantasy`, url };
}

/**
 * Shares or copies a league invite. Where the browser has a share sheet (phones, and some
 * desktops), "Share invite" opens it; copying the link always works as well.
 */
export function ShareInvite({ leagueName, path }: { leagueName: string; path: string }) {
  const [copied, setCopied] = useState(false);
  // Only known in the browser, so the server renders without the share button.
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const message = () => inviteMessage(leagueName, path, window.location.href);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message().url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    try {
      await navigator.share(message());
    } catch (error) {
      // Closing the share sheet isn't a failure; anything else falls back to copying.
      if (!(error instanceof DOMException && error.name === "AbortError")) await copy();
    }
  }

  return (
    <>
      {canShare && (
        <button type="button" className={styles.button} onClick={share}>
          Share invite
        </button>
      )}
      <button type="button" className={styles.secondary} onClick={copy}>
        {copied ? "Link copied" : "Copy invite link"}
      </button>
    </>
  );
}
