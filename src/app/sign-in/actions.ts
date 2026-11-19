"use server";

import { redirect } from "next/navigation";
import { APP_URL_SCHEME } from "@/lib/app-identity";
import { safeNext } from "@/lib/guards";
import { requestOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Emails a one-hour sign-in link. New addresses get an account automatically. */
export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL.test(email)) return { status: "error", message: "Enter a valid email address", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await requestOrigin()}/auth/callback`, shouldCreateUser: true },
  });
  if (error) {
    return {
      status: "error",
      message: "We couldn't send the link just now. Wait a minute and try again.",
      email,
    };
  }
  return { status: "sent", email };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/sign-in?error=failed");
  redirect(data.url);
}

/**
 * Google sign-in from the iOS and Android apps. Google won't run inside the app's web view, so
 * the app opens the returned address in the phone's browser sheet. Google then sends the user
 * back to the app's own link scheme, and the app finishes at /auth/callback in its web view,
 * which holds the code verifier this call stores. Null if sign-in can't start.
 */
export async function appGoogleSignInUrl(next: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${APP_URL_SCHEME}://auth/callback?next=${encodeURIComponent(safeNext(next))}`,
      skipBrowserRedirect: true,
    },
  });
  return error || !data.url ? null : data.url;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
