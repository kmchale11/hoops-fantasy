"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createLeague,
  joinLeague,
  leagueNameError,
  leaveLeague,
  regenerateInviteCode,
  removeMember,
} from "@/leagues/leagues";
import { getDb } from "@/lib/server-db";
import { getAccount } from "@/lib/session";

export interface LeagueFormState {
  error: string | null;
  value: string;
}

async function signedInUser(): Promise<string | null> {
  const account = await getAccount();
  return account.status === "ready" ? account.user.id : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGN_IN_FIRST = "Sign in and finish signing up first";

export async function createLeagueAction(_prev: LeagueFormState, formData: FormData): Promise<LeagueFormState> {
  const name = String(formData.get("name") ?? "");
  const userId = await signedInUser();
  if (!userId) return { error: SIGN_IN_FIRST, value: name };
  const invalid = leagueNameError(name);
  if (invalid) return { error: invalid, value: name };

  const result = await createLeague(getDb(), userId, name);
  if (!result.ok) return { error: result.error, value: name };
  revalidatePath("/leagues");
  redirect(`/leagues/${result.leagueId}?created=1`);
}

export async function joinLeagueAction(_prev: LeagueFormState, formData: FormData): Promise<LeagueFormState> {
  const code = String(formData.get("code") ?? "");
  const userId = await signedInUser();
  if (!userId) return { error: SIGN_IN_FIRST, value: code };
  if (!code.trim()) return { error: "Enter the 6-character code you were sent", value: code };

  const result = await joinLeague(getDb(), userId, code);
  if (!result.ok) return { error: result.error, value: code };
  revalidatePath("/leagues");
  redirect(`/leagues/${result.leagueId}`);
}

function leagueIdFrom(formData: FormData): number {
  const id = Number(formData.get("league"));
  if (!Number.isSafeInteger(id)) redirect("/leagues");
  return id;
}

/** Leaves, removes and new codes report problems on the league page itself. */
function backToLeague(leagueId: number, error?: string): never {
  revalidatePath(`/leagues/${leagueId}`);
  redirect(`/leagues/${leagueId}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

export async function leaveLeagueAction(formData: FormData): Promise<void> {
  const leagueId = leagueIdFrom(formData);
  const userId = await signedInUser();
  if (!userId) redirect(`/sign-in?next=/leagues/${leagueId}`);
  const result = await leaveLeague(getDb(), userId, leagueId);
  if (!result.ok) backToLeague(leagueId, result.error);
  revalidatePath("/leagues");
  redirect("/leagues?left=1");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const leagueId = leagueIdFrom(formData);
  const userId = await signedInUser();
  if (!userId) redirect(`/sign-in?next=/leagues/${leagueId}`);
  const memberId = String(formData.get("member") ?? "");
  if (!UUID.test(memberId)) backToLeague(leagueId, "That member couldn't be found");
  const result = await removeMember(getDb(), userId, leagueId, memberId);
  backToLeague(leagueId, result.ok ? undefined : result.error);
}

export async function regenerateCodeAction(formData: FormData): Promise<void> {
  const leagueId = leagueIdFrom(formData);
  const userId = await signedInUser();
  if (!userId) redirect(`/sign-in?next=/leagues/${leagueId}`);
  const result = await regenerateInviteCode(getDb(), userId, leagueId);
  backToLeague(leagueId, result.ok ? undefined : result.error);
}
