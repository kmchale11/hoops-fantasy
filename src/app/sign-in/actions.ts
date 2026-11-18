"use server";

import { redirect } from "next/navigation";
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
