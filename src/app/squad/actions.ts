"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/server-db";
import { getAccount } from "@/lib/session";
import { saveSquad } from "@/squads/squads";

export interface SaveSquadState {
  errors: string[];
  savedAt: string | null;
}

/** Saves the builder's squad. The database checks the rules and the deadline. */
export async function saveSquadAction(_prev: SaveSquadState, formData: FormData): Promise<SaveSquadState> {
  const account = await getAccount();
  if (account.status !== "ready") return { errors: ["Sign in and finish signing up first"], savedAt: null };

  const ids = String(formData.get("players") ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number);
  const captainField = String(formData.get("captain") ?? "");
  const captain = captainField ? Number(captainField) : null;
  if (ids.some((id) => !Number.isSafeInteger(id)) || (captain !== null && !Number.isSafeInteger(captain))) {
    return { errors: ["That squad couldn't be read. Reload the page and try again."], savedAt: null };
  }

  const result = await saveSquad(getDb(), account.user.id, ids, captain);
  if (!result.ok) return { errors: result.errors, savedAt: null };
  revalidatePath("/squad");
  return { errors: [], savedAt: new Date().toISOString() };
}
