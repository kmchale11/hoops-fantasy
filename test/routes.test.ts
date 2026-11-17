import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import { count, createTestDb } from "./helpers/db";

let testDb: Db;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-db", () => ({ getDb: () => testDb }));

const { POST: cron } = await import("@/app/api/cron/ingest/route");
const { POST: importCsv } = await import("@/app/api/admin/import/route");
const { GET: listFixtures } = await import("@/app/api/admin/fixtures/route");
const { hasBearerSecret } = await import("@/lib/auth");

const req = (url: string, init: RequestInit & { token?: string } = {}) =>
  new Request(`http://localhost${url}`, {
    ...init,
    headers: { ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}), "Content-Type": "application/json" },
  });

beforeEach(async () => {
  ({ db: testDb } = await createTestDb());
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.stubEnv("ADMIN_TOKEN", "admin-token");
  vi.stubEnv("FEED_SOURCE", "mock");
  vi.stubEnv("MOCK_STAGE", "1");
});

describe("hasBearerSecret", () => {
  it("never matches when the secret is unset", () => {
    expect(hasBearerSecret(req("/", { token: "anything" }), undefined)).toBe(false);
  });
  it("rejects a wrong token of the same length", () => {
    expect(hasBearerSecret(req("/", { token: "cron-secreX" }), "cron-secret")).toBe(false);
  });
});

describe("POST /api/cron/ingest", () => {
  it("rejects requests without the cron secret", async () => {
    const res = await cron(req("/api/cron/ingest", { method: "POST", token: "wrong" }));
    expect(res.status).toBe(401);
    expect(await count(testDb, "ingestion_runs")).toBe(0);
  });

  it("runs ingestion when due, then skips until the next interval", async () => {
    const first = await cron(req("/api/cron/ingest", { method: "POST", token: "cron-secret" }));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ran: true, status: "succeeded" });
    expect(await count(testDb, "teams")).toBe(10);

    const second = await cron(req("/api/cron/ingest", { method: "POST", token: "cron-secret" }));
    const body = await second.json();
    expect(body.ran).toBe(false);
    expect(body.reason).toMatch(/next run in about/);
  });

  it("runs regardless of schedule with ?force=1", async () => {
    await cron(req("/api/cron/ingest", { method: "POST", token: "cron-secret" }));
    const forced = await cron(req("/api/cron/ingest?force=1", { method: "POST", token: "cron-secret" }));
    expect((await forced.json()).ran).toBe(true);
    expect(await count(testDb, "ingestion_runs")).toBe(2);
  });
});

describe("admin endpoints", () => {
  it("require the admin token", async () => {
    expect((await listFixtures(req("/api/admin/fixtures", { token: "cron-secret" }))).status).toBe(401);
    const res = await importCsv(
      req("/api/admin/import", { method: "POST", body: JSON.stringify({ fixtureExternalId: "x", csv: "" }) }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 422 with row errors for a bad upload", async () => {
    await cron(req("/api/cron/ingest", { method: "POST", token: "cron-secret" }));
    const res = await importCsv(
      req("/api/admin/import", {
        method: "POST",
        token: "admin-token",
        body: JSON.stringify({
          fixtureExternalId: "mock-f-r3-g1",
          csv: "player_name,team,minutes,pts,reb,ast,stl,blk,tov,fgm,fga,ftm,fta\nNobody,Ballina Braves,1,0,0,0,0,0,0,0,0,0,0",
        }),
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.errors[0].row).toBe(2);
  });

  it("rejects a body that isn't the expected JSON", async () => {
    const res = await importCsv(req("/api/admin/import", { method: "POST", token: "admin-token", body: "nope" }));
    expect(res.status).toBe(400);
  });
});
