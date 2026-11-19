import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { MockFeedAdapter } from "@/ingestion/feed/mock/adapter";
import { mockPriceCsv, mockPrices } from "@/ingestion/feed/mock/prices";
import { runIngestion } from "@/ingestion/ingest";
import type { Db } from "@/lib/db";
import { importPriceCsv, parsePrice } from "@/squads/prices";
import { BUDGET, SQUAD_SIZE } from "@/squads/rules";
import { createTestDb } from "./helpers/db";

const CSV_PATH = "supabase/mock-prices.csv";

describe("mock player prices", () => {
  const prices = mockPrices();
  const byPrice = [...prices].sort((a, b) => b.price - a.price);

  it("gives every rostered player a valid price", () => {
    expect(prices).toHaveLength(120);
    for (const { price } of prices) expect(parsePrice(price.toFixed(1))).toEqual({ price });
  });

  it("makes the budget a real choice", () => {
    const total = (ps: typeof prices) => ps.reduce((sum, p) => sum + p.price, 0);
    // The eight best players don't fit, but a squad of eight mid-priced players does.
    expect(total(byPrice.slice(0, SQUAD_SIZE))).toBeGreaterThan(BUDGET);
    const middle = Math.floor(prices.length / 2);
    expect(total(byPrice.slice(middle, middle + SQUAD_SIZE))).toBeLessThan(BUDGET);
    // Players who haven't played cost the minimum.
    expect(prices.find((p) => p.playerExternalId === "mock-p-bal-11")!.price).toBe(4);
  });

  it("matches the committed CSV", () => {
    expect(readFileSync(CSV_PATH, "utf8")).toBe(mockPriceCsv());
  });

  describe("importing the CSV", () => {
    let db: Db;
    beforeEach(async () => {
      ({ db } = await createTestDb());
      await runIngestion(db, new MockFeedAdapter(1), { now: new Date("2026-10-12T10:00:00Z") });
    });

    it("prices every mock player", async () => {
      expect(await importPriceCsv(db, readFileSync(CSV_PATH, "utf8"), new Date())).toEqual({ ok: true, updated: 120 });
      const [{ count }] = await db.query<{ count: number }>(`select count(*)::int as count from player_prices`);
      expect(count).toBe(120);
    });
  });
});
