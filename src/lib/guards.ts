import "server-only";
import { notFound, redirect } from "next/navigation";
import { getAccount, type Account } from "@/lib/session";

/** Only allow same-site paths as post-sign-in destinations, so links can't redirect off-site. */
export function safeNext(next: string | null | undefined, fallback = "/squad"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

/** For pages that need a signed-in user, who may not have finished sign-up yet. */
export async function requireUser(next: string) {
  const account = await getAccount();
  if (account.status === "signed-out") redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return account as Exclude<Account, { status: "signed-out" }>;
}

/**
 * For pages that need a finished account: signed in, 18+ confirmed and terms accepted.
 * Squad selection uses this, so nobody can pick a squad before giving consent.
 */
export async function requireCompleteAccount(next: string) {
  const account = await requireUser(next);
  if (account.status === "needs-profile") redirect(`/welcome?next=${encodeURIComponent(next)}`);
  return account as Extract<Account, { status: "ready" }>;
}

/** For admin pages. Everyone else gets a 404 so admin pages aren't advertised. */
export async function requireAdminPage() {
  const account = await getAccount();
  if (account.status !== "ready" || !account.profile.isAdmin) notFound();
  return account;
}

/** For admin API routes: null when allowed, otherwise the response to send. */
export async function adminRouteError(): Promise<Response | null> {
  const account = await getAccount();
  if (account.status === "signed-out") return Response.json({ error: "Sign in first" }, { status: 401 });
  if (account.status !== "ready" || !account.profile.isAdmin) {
    return Response.json({ error: "Admins only" }, { status: 403 });
  }
  return null;
}
