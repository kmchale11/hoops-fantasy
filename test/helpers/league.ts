import { createProfile } from "@/accounts/profile";
import type { Db } from "@/lib/db";
import { createAuthUser } from "./db";

export const TEAMS = ["Ballina Braves", "Killester", "Moycullen", "Tralee Titans"] as const;

/** Each team's four players, in ID order: a guard, a forward, a centre and another guard. */
export const TEAM_POSITIONS = ["G", "F", "C", "G"] as const;

/**
 * A small league: 4 teams with 4 players each (IDs 1–16, team by team, positions as
 * TEAM_POSITIONS), every player priced 10.0, so any 6 of them cost exactly 60.0.
 */
export async function seedLeague(db: Db): Promise<void> {
  await db.query(`insert into competitions (external_id, name, season) values ('sl', 'Super League', '2026-27')`);
  for (const [i, name] of TEAMS.entries()) {
    await db.query(`insert into teams (external_id, competition_id, name, short_name) values ($1, 1, $2, $3)`, [
      `t${i + 1}`,
      name,
      name.slice(0, 3).toUpperCase(),
    ]);
    for (let j = 1; j <= 4; j++) {
      await db.query(
        `insert into players (external_id, full_name, current_team_id, position) values ($1, $2, $3, $4)`,
        [`p${i * 4 + j}`, `${name.split(" ")[0]} Player ${j}`, i + 1, TEAM_POSITIONS[j - 1]],
      );
    }
  }
  await db.query(`insert into player_prices (player_id, price) select id, 10.0 from players`);
}

/**
 * A valid squad: guard and forward from Ballina (1, 2) and Killester (5, 6), Moycullen's centre
 * (11) and a third guard from Tralee (13) in the flex slot.
 */
export const VALID_SQUAD = [1, 2, 5, 6, 11, 13];

export async function addRound(db: Db, number: number, startsAt: Date, endsAt: Date): Promise<number> {
  const [row] = await db.query<{ id: number }>(
    `insert into rounds (number, name, starts_at, ends_at) values ($1, $2, $3, $4) returning id::int as id`,
    [number, `Round ${number}`, startsAt, endsAt],
  );
  return row.id;
}

export async function addFixture(
  db: Db,
  home: number,
  away: number,
  tipOff: Date,
  status: "scheduled" | "live" | "final" | "postponed" = "scheduled",
): Promise<number> {
  const [row] = await db.query<{ id: number }>(
    `insert into fixtures (external_id, competition_id, home_team_id, away_team_id, tip_off, status)
     values ($1, 1, $2, $3, $4, $5) returning id::int as id`,
    [`f-${home}-${away}-${tipOff.toISOString()}`, home, away, tipOff, status],
  );
  return row.id;
}

/** A user who has finished sign-up. */
export async function addManager(db: Db, name: string): Promise<string> {
  const id = await createAuthUser(db, `${name.toLowerCase()}@example.ie`);
  const result = await createProfile(
    db,
    id,
    { managerName: name, teamName: `${name}'s Team`, ageConfirmed: true, termsAccepted: true },
    new Date("2026-09-01T12:00:00Z"),
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return id;
}

/** Saves a squad at a given time, as the server would at that moment. */
export async function saveSquadAt(db: Db, userId: string, players: number[], captain: number, at: Date) {
  await db.query(`select save_squad_at($1, $2::bigint[], $3, $4)`, [userId, players, captain, at]);
}
