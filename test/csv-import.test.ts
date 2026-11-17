import { describe, expect, it } from "vitest";
import { importFixtureCsv, parseCsv } from "@/ingestion/csv-import";
import { MockFeedAdapter } from "@/ingestion/feed/mock/adapter";
import { runIngestion } from "@/ingestion/ingest";
import type { Db } from "@/lib/db";
import { count, createTestDb } from "./helpers/db";

// Round 3 hasn't been played in stage 1, so its fixtures have no stats yet.
const FIXTURE = "mock-f-r3-g1";
const HEADER = "player_name,team,minutes,pts,reb,ast,stl,blk,tov,fgm,fga,ftm,fta";

async function setup() {
  const { db } = await createTestDb();
  await runIngestion(db, new MockFeedAdapter(1), { now: new Date("2026-10-12T10:00:00Z") });
  return db;
}

async function rosterFor(db: Db, fixtureExternalId: string) {
  return db.query<{ full_name: string; external_id: string; team: string; short_name: string }>(
    `select p.full_name, p.external_id, t.name as team, t.short_name
       from fixtures f
       join teams t on t.id in (f.home_team_id, f.away_team_id)
       join players p on p.current_team_id = t.id
      where f.external_id = $1
      order by p.id`,
    [fixtureExternalId],
  );
}

async function statsFor(db: Db, fixtureExternalId: string) {
  const [row] = await db.query<{ n: number }>(
    `select count(*)::int as n from player_game_stats s join fixtures f on f.id = s.fixture_id where f.external_id = $1`,
    [fixtureExternalId],
  );
  return row.n;
}

describe("parseCsv", () => {
  it("handles quoted fields, escaped quotes and Windows line endings", () => {
    expect(parseCsv('a,b\r\n"O\'Brien, Seán","say ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["O'Brien, Seán", 'say "hi"'],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("importFixtureCsv", () => {
  it("saves a valid upload and reports how many rows were imported", async () => {
    const db = await setup();
    const roster = await rosterFor(db, FIXTURE);
    const csv = [
      HEADER,
      `"${roster[0].full_name}",${roster[0].team},32,21,6,4,1,0,2,8,15,3,4`,
      `"${roster[1].full_name}",${roster[1].short_name},28,10,3,7,2,1,3,4,9,2,2`,
    ].join("\n");

    const result = await importFixtureCsv(db, { fixtureExternalId: FIXTURE, csv });

    expect(result).toMatchObject({ ok: true, imported: 2 });
    expect(await statsFor(db, FIXTURE)).toBe(2);
    const [fixture] = await db.query<{ status: string }>(`select status from fixtures where external_id = $1`, [FIXTURE]);
    expect(fixture.status).toBe("final");
    const [run] = await db.query<{ source: string; status: string }>(
      `select source, status from ingestion_runs where source = 'csv'`,
    );
    expect(run).toEqual({ source: "csv", status: "succeeded" });
  });

  it("matches by player_external_id when given", async () => {
    const db = await setup();
    const [player] = await rosterFor(db, FIXTURE);
    const csv = `player_external_id,${HEADER}\n${player.external_id},anything,anything,30,12,5,2,0,0,1,5,10,2,2`;
    const result = await importFixtureCsv(db, { fixtureExternalId: FIXTURE, csv });
    expect(result).toMatchObject({ ok: true, imported: 1 });
  });

  it("rejects an unknown player with the row number and saves nothing", async () => {
    const db = await setup();
    const roster = await rosterFor(db, FIXTURE);
    const csv = [
      HEADER,
      `"${roster[0].full_name}",${roster[0].team},32,21,6,4,1,0,2,8,15,3,4`,
      `Joe Bloggs,${roster[0].team},20,4,1,0,0,0,1,2,5,0,0`,
    ].join("\n");

    const result = await importFixtureCsv(db, { fixtureExternalId: FIXTURE, csv });

    expect(result).toEqual({
      ok: false,
      errors: [{ row: 3, message: `Unknown player "Joe Bloggs" on ${roster[0].team}` }],
    });
    expect(await statsFor(db, FIXTURE)).toBe(0);
    expect(await count(db, "ingestion_runs")).toBe(1); // only the feed run
  });

  it("applies the same stat rules as the feed", async () => {
    const db = await setup();
    const [player] = await rosterFor(db, FIXTURE);
    const csv = `${HEADER}\n"${player.full_name}",${player.team},30,12,5,2,0,0,1,9,5,2,2`;
    const result = await importFixtureCsv(db, { fixtureExternalId: FIXTURE, csv });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].message).toMatch(/fgm cannot be more than fga/);
  });

  it("rejects a player listed twice", async () => {
    const db = await setup();
    const [p] = await rosterFor(db, FIXTURE);
    const line = `"${p.full_name}",${p.team},30,12,5,2,0,0,1,5,10,2,2`;
    const result = await importFixtureCsv(db, { fixtureExternalId: FIXTURE, csv: `${HEADER}\n${line}\n${line}` });
    expect(result).toEqual({ ok: false, errors: [{ row: 3, message: "Same player as row 2" }] });
  });

  it("rejects a team that isn't in the fixture", async () => {
    const db = await setup();
    const [p] = await rosterFor(db, FIXTURE);
    const result = await importFixtureCsv(db, {
      fixtureExternalId: FIXTURE,
      csv: `${HEADER}\n"${p.full_name}",Nowhere Knights,30,12,5,2,0,0,1,5,10,2,2`,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatchObject({ row: 2 });
  });

  it("reports missing columns", async () => {
    const db = await setup();
    const result = await importFixtureCsv(db, { fixtureExternalId: FIXTURE, csv: "player_name,team,pts\nA,B,1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].message).toMatch(/Missing columns: minutes/);
  });

  it("refuses stats for a postponed fixture", async () => {
    const db = await setup();
    await db.query(`update fixtures set status = 'postponed' where external_id = $1`, [FIXTURE]);
    const result = await importFixtureCsv(db, { fixtureExternalId: FIXTURE, csv: `${HEADER}\nA,B,1,1,1,1,1,1,1,1,1,1,1` });
    expect(result).toEqual({ ok: false, errors: [{ row: 0, message: "This fixture is postponed, so it can't have stats" }] });
  });
});
