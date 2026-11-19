"use client";

import { useActionState, useState } from "react";
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

/** Copies the full invite link, built from the address the user is on. */
export function CopyInviteLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.secondary}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(new URL(path, window.location.href).toString());
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Link copied" : "Copy invite link"}
    </button>
  );
}
