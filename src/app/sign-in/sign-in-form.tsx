"use client";

import { useActionState } from "react";
import styles from "@/app/forms.module.css";
import { sendMagicLink, signInWithGoogle, type MagicLinkState } from "./actions";

export default function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className={styles.card} role="status">
        <p className={styles.success}>Check your email</p>
        <p>
          We sent a sign-in link to <strong>{state.email}</strong>. It works once and expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <form action={action}>
        <label className={styles.label} htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className={styles.input}
          defaultValue={state.status === "error" ? state.email : ""}
        />
        <button className={styles.button} type="submit" disabled={pending} style={{ width: "100%" }}>
          {pending ? "Sending…" : "Email me a sign-in link"}
        </button>
        {state.status === "error" && (
          <p className={styles.error} role="alert">
            {state.message}
          </p>
        )}
      </form>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button className={styles.secondary} type="submit">
          Continue with Google
        </button>
      </form>
    </div>
  );
}
