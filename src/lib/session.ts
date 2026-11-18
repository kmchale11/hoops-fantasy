import "server-only";
import { connection } from "next/server";
import { getProfile, type Profile } from "@/accounts/profile";
import { authConfigured, createClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/server-db";

export interface SessionUser {
  id: string;
  email: string | null;
}

export type Account =
  | { status: "signed-out" }
  | { status: "needs-profile"; user: SessionUser }
  | { status: "ready"; user: SessionUser; profile: Profile };

/** The signed-in user, verified with Supabase Auth (not just read from the cookie). */
export async function getSessionUser(): Promise<SessionUser | null> {
  // Always per-request, even when auth isn't configured at build time; otherwise Next would
  // prerender guarded pages as a fixed redirect or 404.
  await connection();
  if (!authConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Where the visitor is in sign-up: signed out, signed in without a profile, or ready to play. */
export async function getAccount(): Promise<Account> {
  const user = await getSessionUser();
  if (!user) return { status: "signed-out" };
  const profile = await getProfile(getDb(), user.id);
  return profile ? { status: "ready", user, profile } : { status: "needs-profile", user };
}
