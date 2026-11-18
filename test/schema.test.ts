import { describe, expect, it } from "vitest";
import { createTestDb, migrationFiles } from "./helpers/db";

describe("database migrations", () => {
  it("apply cleanly to an empty database", async () => {
    expect(migrationFiles().length).toBeGreaterThan(0);
    const { db } = await createTestDb();
    const tables = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' order by table_name`,
    );
    expect(tables.map((t) => t.table_name)).toEqual([
      "competitions",
      "fixture_rounds",
      "fixtures",
      "ingestion_runs",
      "player_fantasy_points",
      "player_game_stats",
      "player_round_points",
      "player_team_history",
      "players",
      "profiles",
      "rounds",
      "teams",
    ]);
  });

  it("enforces unique external IDs", async () => {
    const { db } = await createTestDb();
    await db.query(`insert into competitions (external_id, name, season) values ('c1', 'Super League', '2026-27')`);
    await expect(
      db.query(`insert into competitions (external_id, name, season) values ('c1', 'Dupe', '2026-27')`),
    ).rejects.toThrow(/unique/i);
  });

  it("allows only one open team spell per player", async () => {
    const { db } = await createTestDb();
    await db.query(`insert into competitions (external_id, name, season) values ('c1', 'SL', '2026-27')`);
    await db.query(
      `insert into teams (external_id, competition_id, name, short_name) values ('t1', 1, 'A', 'A'), ('t2', 1, 'B', 'B')`,
    );
    await db.query(`insert into players (external_id, full_name, current_team_id) values ('p1', 'X', 1)`);
    await db.query(`insert into player_team_history (player_id, team_id, started_on) values (1, 1, '2026-10-01')`);
    await expect(
      db.query(`insert into player_team_history (player_id, team_id, started_on) values (1, 2, '2026-10-02')`),
    ).rejects.toThrow(/unique/i);
  });
});
