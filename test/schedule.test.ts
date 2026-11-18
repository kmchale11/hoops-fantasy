import { describe, expect, it } from "vitest";
import { MockFeedAdapter } from "@/ingestion/feed/mock/adapter";
import { runIngestion } from "@/ingestion/ingest";
import { decideIngestion, loadScheduleState } from "@/ingestion/schedule";
import { createTestDb } from "./helpers/db";

const at = (iso: string) => new Date(iso);
const minutesAfter = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

describe("decideIngestion", () => {
  const last = at("2026-10-24T19:00:00Z");

  it("runs when there has never been a run", () => {
    expect(decideIngestion({ now: last, lastRunStartedAt: null, hasActiveFixture: false }).run).toBe(true);
  });

  it("game night: runs again after 15 minutes", () => {
    const state = { lastRunStartedAt: last, hasActiveFixture: true };
    expect(decideIngestion({ ...state, now: minutesAfter(last, 15) }).run).toBe(true);
    expect(decideIngestion({ ...state, now: minutesAfter(last, 10) }).run).toBe(false);
  });

  it("tolerates a scheduler tick that arrives a few seconds early", () => {
    const decision = decideIngestion({
      now: new Date(minutesAfter(last, 15).getTime() - 5_000),
      lastRunStartedAt: last,
      hasActiveFixture: true,
    });
    expect(decision.run).toBe(true);
  });

  it("quiet midweek: waits 6 hours", () => {
    const state = { lastRunStartedAt: last, hasActiveFixture: false };
    expect(decideIngestion({ ...state, now: minutesAfter(last, 15) }).run).toBe(false);
    expect(decideIngestion({ ...state, now: minutesAfter(last, 5 * 60) }).run).toBe(false);
    expect(decideIngestion({ ...state, now: minutesAfter(last, 6 * 60) }).run).toBe(true);
  });
});

describe("loadScheduleState", () => {
  it("is active while a game is live", async () => {
    const { db } = await createTestDb();
    const now = at("2026-10-24T19:15:00Z");
    await runIngestion(db, new MockFeedAdapter(3), { now });
    const state = await loadScheduleState(db, minutesAfter(now, 15));
    expect(state.hasActiveFixture).toBe(true);
    expect(state.lastRunStartedAt?.toISOString()).toBe(now.toISOString());
  });

  it("is active for 48 hours after a game finishes, then goes quiet", async () => {
    const { db } = await createTestDb();
    // Round 2 tipped off 10 Oct 18:30 UTC; round 3 is not until the 17th.
    await runIngestion(db, new MockFeedAdapter(1), { now: at("2026-10-11T09:00:00Z") });
    expect((await loadScheduleState(db, at("2026-10-12T10:00:00Z"))).hasActiveFixture).toBe(true);
    expect((await loadScheduleState(db, at("2026-10-14T10:00:00Z"))).hasActiveFixture).toBe(false);
  });

  it("is active when a scheduled game is due to tip off", async () => {
    const { db } = await createTestDb();
    await runIngestion(db, new MockFeedAdapter(1), { now: at("2026-10-14T10:00:00Z") });
    // Round 3 is still "scheduled" in the database but due at 18:30.
    expect((await loadScheduleState(db, at("2026-10-17T18:20:00Z"))).hasActiveFixture).toBe(true);
    expect((await loadScheduleState(db, at("2026-10-17T12:00:00Z"))).hasActiveFixture).toBe(false);
  });
});
