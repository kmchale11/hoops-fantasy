"use client";

import { useActionState, useState } from "react";
import styles from "@/app/forms.module.css";
import { nativeShell } from "@/lib/native/shell";
import { appGoogleSignInUrl, sendMagicLink, signInWithGoogle, type MagicLinkState } from "./actions";

/** In the app, Google sign-in opens in the phone's browser sheet instead of the web view. */
async function googleInApp(event: React.FormEvent<HTMLFormElement>, next: string, failed: () => void) {
  const browser = nativeShell()?.Plugins.Browser;
  if (!browser) return;
  event.preventDefault();
  const url = await appGoogleSignInUrl(next);
  if (url) await browser.open({ url });
  else failed();
}

export default function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });
  const [googleFailed, setGoogleFailed] = useState(false);

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
      <form action={signInWithGoogle} onSubmit={(event) => googleInApp(event, next, () => setGoogleFailed(true))}>
        <input type="hidden" name="next" value={next} />
        <button className={styles.secondary} type="submit">
          Continue with Google
        </button>
        {googleFailed && (
          <p className={styles.error} role="alert">
            We couldn&apos;t start Google sign-in. Try again, or use your email address.
          </p>
        )}
      </form>
    </div>
  );
}
