import type { CsvRowError } from "@/ingestion/csv-import";
import { parseCsv } from "@/ingestion/csv-import";
import type { Db } from "@/lib/db";

export const MIN_PRICE = 4;
export const MAX_PRICE = 15;
export const PRICE_RULE = `Prices must be ${MIN_PRICE.toFixed(1)}–${MAX_PRICE.toFixed(1)} in steps of 0.5`;

/** Parses "8.5" into 8.5; blank means unpriced (null). Returns an error message otherwise. */
export function parsePrice(text: string): { price: number | null } | { error: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { price: null };
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { error: PRICE_RULE };
  const price = Number(trimmed);
  if (price < MIN_PRICE || price > MAX_PRICE || !Number.isInteger(price * 2)) return { error: PRICE_RULE };
  return { price };
}

export interface PriceChange {
  playerId: number;
  /** Null clears the price, making the player unavailable. */
  price: number | null;
}

/** Applies every change in one transaction. */
export async function setPrices(db: Db, changes: PriceChange[], now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    for (const { playerId, price } of changes) {
      if (price === null) {
        await tx.query(`delete from player_prices where player_id = $1`, [playerId]);
      } else {
        await tx.query(
          `insert into player_prices (player_id, price, updated_at) values ($1, $2, $3)
           on conflict (player_id) do update set price = excluded.price, updated_at = excluded.updated_at
           where player_prices.price is distinct from excluded.price`,
          [playerId, price, now],
        );
      }
    }
  });
}

export type PriceImportResult = { ok: true; updated: number } | { ok: false; errors: CsvRowError[] };

/**
 * Sets prices from a CSV with a header row and columns `price` plus either
 * `player_external_id` or `player_name` and `team` (name or short name). Nothing is saved
 * unless every row is valid. Row numbers count the header as row 1.
 */
export async function importPriceCsv(db: Db, csv: string, now: Date): Promise<PriceImportResult> {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return { ok: false, errors: [{ row: 0, message: "The file is empty" }] };
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const [idCol, nameCol, teamCol, priceCol] = ["player_external_id", "player_name", "team", "price"].map(col);
  if (priceCol < 0 || (idCol < 0 && (nameCol < 0 || teamCol < 0))) {
    return {
      ok: false,
      errors: [{ row: 1, message: "Columns needed: price, and player_external_id or player_name and team" }],
    };
  }

  const players = await db.query<{ id: number; external_id: string; name: string; team: string; short: string }>(
    `select p.id::int as id, p.external_id, lower(p.full_name) as name, lower(t.name) as team, lower(t.short_name) as short
       from players p left join teams t on t.id = p.current_team_id`,
  );

  const errors: CsvRowError[] = [];
  const changes: PriceChange[] = [];
  rows.forEach((cells, i) => {
    const row = i + 2;
    const cell = (c: number) => (c >= 0 ? (cells[c] ?? "").trim() : "");
    const externalId = cell(idCol);
    let matches;
    if (externalId) {
      matches = players.filter((p) => p.external_id === externalId);
    } else {
      const name = cell(nameCol).toLowerCase();
      const team = cell(teamCol).toLowerCase();
      matches = players.filter((p) => p.name === name && (p.team === team || p.short === team));
    }
    if (matches.length !== 1) {
      errors.push({ row, message: matches.length ? "More than one player matches" : "No matching player" });
      return;
    }
    const parsed = parsePrice(cell(priceCol));
    if ("error" in parsed) errors.push({ row, message: parsed.error });
    else if (parsed.price === null) errors.push({ row, message: "Price is missing" });
    else changes.push({ playerId: matches[0].id, price: parsed.price });
  });

  if (errors.length) return { ok: false, errors };
  await setPrices(db, changes, now);
  return { ok: true, updated: changes.length };
}
