import type { Metadata } from "next";
import { redirect } from "next/navigation";
import styles from "@/app/forms.module.css";
import { safeNext } from "@/lib/guards";
import { getAccount } from "@/lib/session";
import SignInForm from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

// Reads the session to send signed-in visitors on, so it renders per request.
export const instant = false;

const MESSAGES: Record<string, string> = {
  expired: "That sign-in link has expired or has already been used. Enter your email and we'll send you a new one.",
  failed: "Something went wrong signing you in. Please try again.",
  "other-device":
    "That sign-in link was opened on a different phone, browser or app from the one you asked for it on, so it can't sign you in here. Enter your email below and we'll send a new link to use on this device.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  const error = typeof params.error === "string" ? MESSAGES[params.error] : undefined;

  const account = await getAccount();
  if (account.status === "ready") redirect(next);
  if (account.status === "needs-profile") redirect(`/welcome?next=${encodeURIComponent(next)}`);

  return (
    <main>
      <h1>Sign in</h1>
      <p className="muted">No password needed. New here? Signing in creates your account.</p>
      {error && (
        <p className={styles.notice} role="alert">
          {error}
        </p>
      )}
      <SignInForm next={next} />
    </main>
  );
}
