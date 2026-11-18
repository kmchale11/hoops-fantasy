"use server";

import { revalidatePath } from "next/cache";
import type { CsvRowError } from "@/ingestion/csv-import";
import { getDb } from "@/lib/server-db";
import { getAccount } from "@/lib/session";
import { importPriceCsv, parsePrice, setPrices, type PriceChange } from "@/squads/prices";

export interface PriceEditState {
  /** Player ID to error message. */
  errors: Record<number, string>;
  message: string | null;
  saved: number | null;
}

export interface PriceImportState {
  errors: CsvRowError[];
  message: string | null;
  updated: number | null;
}

async function isAdmin() {
  const account = await getAccount();
  return account.status === "ready" && account.profile.isAdmin;
}

/** Saves every `price-<playerId>` field. A blank field clears the price. All or nothing. */
export async function savePrices(_prev: PriceEditState, formData: FormData): Promise<PriceEditState> {
  if (!(await isAdmin())) return { errors: {}, message: "Admins only", saved: null };

  const errors: Record<number, string> = {};
  const changes: PriceChange[] = [];
  for (const [key, value] of formData) {
    const match = /^price-(\d+)$/.exec(key);
    if (!match) continue;
    const playerId = Number(match[1]);
    const parsed = parsePrice(String(value));
    if ("error" in parsed) errors[playerId] = parsed.error;
    else changes.push({ playerId, price: parsed.price });
  }
  if (Object.keys(errors).length) return { errors, message: "Nothing was saved. Fix the prices marked below.", saved: null };

  await setPrices(getDb(), changes, new Date());
  revalidatePath("/admin/prices");
  return { errors: {}, message: null, saved: changes.length };
}

export async function importPrices(_prev: PriceImportState, formData: FormData): Promise<PriceImportState> {
  if (!(await isAdmin())) return { errors: [], message: "Admins only", updated: null };
  const result = await importPriceCsv(getDb(), String(formData.get("csv") ?? ""), new Date());
  if (!result.ok) return { errors: result.errors, message: "Nothing was saved. Fix these and try again:", updated: null };
  revalidatePath("/admin/prices");
  return { errors: [], message: null, updated: result.updated };
}
