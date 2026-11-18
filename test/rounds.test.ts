import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { createTestDb } from "./helpers/db";

let db: Db;

async function addFixture(externalId: string, tipOff: string) {
  const [{ id }] = await db.query<{ id: number }>(
    `insert into fixtures (external_id, competition_id, home_team_id, away_team_id, tip_off, status)
     values ($1, 1, 1, 2, $2, 'scheduled') returning id`,
    [externalId, tipOff],
  );
  return id;
}

async function roundOf(fixtureId: number) {
  const [row] = await db.query<{ number: number }>(
    `select r.number from fixture_rounds fr join rounds r on r.id = fr.round_id where fr.fixture_id = $1`,
    [fixtureId],
  );
  return row?.number ?? null;
}

beforeEach(async () => {
  ({ db } = await createTestDb());
  await db.query(`insert into competitions (external_id, name, season) values ('c', 'Super League', '2026-27')`);
  await db.query(
    `insert into teams (external_id, competition_id, name, short_name)
     values ('a', 1, 'Ballina Braves', 'BAL'), ('b', 1, 'Tralee Titans', 'TRA')`,
  );
  // Friday 00:00 to Monday 00:00, Irish time (GMT after the clocks go back).
  await db.query(
    `insert into rounds (number, name, starts_at, ends_at) values
       (7, 'Round 7', '2026-11-06T00:00:00Z', '2026-11-09T00:00:00Z'),
       (8, 'Round 8', '2026-11-13T00:00:00Z', '2026-11-16T00:00:00Z')`,
  );
});

describe("fixture to round assignment", () => {
  it("puts a fixture in the round its tip-off falls in", async () => {
    expect(await roundOf(await addFixture("sat", "2026-11-07T19:30:00Z"))).toBe(7);
    expect(await roundOf(await addFixture("sun", "2026-11-15T16:00:00Z"))).toBe(8);
  });

  it("includes the start of a round and excludes its end", async () => {
    expect(await roundOf(await addFixture("start", "2026-11-06T00:00:00Z"))).toBe(7);
    expect(await roundOf(await addFixture("end", "2026-11-09T00:00:00Z"))).toBeNull();
  });

  it("leaves a midweek fixture between rounds unassigned", async () => {
    expect(await roundOf(await addFixture("wed", "2026-11-11T19:45:00Z"))).toBeNull();
  });

  it("follows the fixture when its tip-off moves", async () => {
    const id = await addFixture("moved", "2026-11-07T19:30:00Z");
    await db.query(`update fixtures set tip_off = '2026-11-14T19:30:00Z' where id = $1`, [id]);
    expect(await roundOf(id)).toBe(8);
  });

  it("rejects overlapping rounds", async () => {
    await expect(
      db.query(
        `insert into rounds (number, name, starts_at, ends_at)
         values (9, 'Round 9', '2026-11-15T00:00:00Z', '2026-11-20T00:00:00Z')`,
      ),
    ).rejects.toThrow(/conflicting key value|exclusion/);
  });
});
