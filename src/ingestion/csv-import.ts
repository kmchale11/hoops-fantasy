import type { Db } from "@/lib/db";
import { STAT_KEYS, type StatValues } from "./feed/types";
import { emptyCounts, scoreTouchedFixture, writeBoxScore } from "./ingest";
import { statLineProblems } from "./validate";

/**
 * Manual fallback for when the feed is down: an admin uploads one fixture's box score.
 *
 * Columns (header row required, any order):
 *   player_external_id (optional), player_name, team, minutes, pts, reb, ast, stl, blk, tov, fgm, fga, ftm, fta
 *
 * A player is matched by player_external_id if given, otherwise by exact name (ignoring case)
 * on a team in that fixture, where team is the team's name or short name.
 * Row numbers in errors count the header as row 1, matching a spreadsheet.
 */

export interface CsvRowError {
  row: number;
  message: string;
}

export type CsvImportResult =
  | { ok: true; imported: number; runId: number }
  | { ok: false; errors: CsvRowError[] };

const REQUIRED_COLUMNS = ["player_name", "team", ...STAT_KEYS] as const;

/** Parses CSV text, handling quoted fields with commas, quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export async function importFixtureCsv(
  db: Db,
  input: { fixtureExternalId: string; csv: string; now?: Date },
): Promise<CsvImportResult> {
  const now = input.now ?? new Date();
  const fail = (errors: CsvRowError[]): CsvImportResult => ({ ok: false, errors });

  const [fixture] = await db.query<{
    id: number;
    status: string;
    home_team_id: number;
    away_team_id: number;
  }>(
    `select id, status, home_team_id, away_team_id from fixtures where external_id = $1`,
    [input.fixtureExternalId],
  );
  if (!fixture) return fail([{ row: 0, message: `Fixture ${input.fixtureExternalId} not found` }]);
  if (fixture.status === "postponed") {
    return fail([{ row: 0, message: "This fixture is postponed, so it can't have stats" }]);
  }

  const rows = parseCsv(input.csv);
  if (rows.length < 2) return fail([{ row: 0, message: "The file needs a header row and at least one player" }]);

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) return fail([{ row: 1, message: `Missing columns: ${missing.join(", ")}` }]);
  const col = (name: string) => header.indexOf(name);

  const teams = await db.query<{ id: number; name: string; short_name: string }>(
    `select id, name, short_name from teams where id = any($1)`,
    [[fixture.home_team_id, fixture.away_team_id]],
  );
  const players = await db.query<{ external_id: string; full_name: string; current_team_id: number }>(
    `select external_id, full_name, current_team_id from players where current_team_id = any($1)`,
    [[fixture.home_team_id, fixture.away_team_id]],
  );

  const errors: CsvRowError[] = [];
  const lines: (StatValues & { playerExternalId: string })[] = [];
  const seen = new Map<string, number>();

  rows.slice(1).forEach((cells, i) => {
    const rowNumber = i + 2;
    const cell = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "").trim() : "");
    const name = cell("player_name");
    const teamText = cell("team").toLowerCase();

    let externalId = cell("player_external_id");
    if (externalId) {
      if (!players.some((p) => p.external_id === externalId)) {
        errors.push({ row: rowNumber, message: `Unknown player ID "${externalId}" for this fixture` });
        return;
      }
    } else {
      const team = teams.find(
        (t) => t.name.toLowerCase() === teamText || t.short_name.toLowerCase() === teamText,
      );
      if (!team) {
        errors.push({ row: rowNumber, message: `"${cell("team")}" isn't one of the teams in this fixture` });
        return;
      }
      const matches = players.filter(
        (p) => p.current_team_id === team.id && p.full_name.toLowerCase() === name.toLowerCase(),
      );
      if (matches.length !== 1) {
        errors.push({
          row: rowNumber,
          message:
            matches.length === 0
              ? `Unknown player "${name}" on ${team.name}`
              : `More than one "${name}" on ${team.name}; use player_external_id`,
        });
        return;
      }
      externalId = matches[0].external_id;
    }

    if (seen.has(externalId)) {
      errors.push({ row: rowNumber, message: `Same player as row ${seen.get(externalId)}` });
      return;
    }
    seen.set(externalId, rowNumber);

    const stats: Record<string, number> = {};
    for (const key of STAT_KEYS) {
      const raw = cell(key);
      stats[key] = raw === "" ? NaN : Number(raw);
    }
    const problems = statLineProblems(stats);
    if (problems.length > 0) {
      errors.push({ row: rowNumber, message: problems.join("; ") });
      return;
    }
    lines.push({ playerExternalId: externalId, ...(stats as unknown as StatValues) });
  });

  if (errors.length > 0) return fail(errors);

  const counts = emptyCounts();
  const [run] = await db.query<{ id: number }>(
    `insert into ingestion_runs (source, started_at, status) values ('csv', $1, 'running') returning id`,
    [now],
  );
  await db.transaction(async (tx) => {
    await writeBoxScore(tx, fixture.id, { lines }, {
      now,
      flagCorrections: fixture.status === "final",
      counts,
    });
    // An uploaded box score is a finished game.
    await tx.query(`update fixtures set status = 'final', updated_at = $2 where id = $1`, [fixture.id, now]);
    await scoreTouchedFixture(tx, fixture.id, now, counts);
  });
  counts.boxScores = 1;
  await db.query(
    `update ingestion_runs set status = 'succeeded', counts = $2, finished_at = $3 where id = $1`,
    [run.id, JSON.stringify(counts), now],
  );

  return { ok: true, imported: lines.length, runId: run.id };
}
