import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import { listPlayers } from "@/squads/players";
import { auth, form, redirectOf, resetAuth } from "./helpers/auth";
import { createTestDb } from "./helpers/db";
import { addManager, seedLeague } from "./helpers/league";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);

const { default: PricesPage } = await import("@/app/admin/prices/page");
const { importPrices, savePrices } = await import("@/app/admin/prices/actions");

const editState = { errors: {}, message: null, saved: null };
const importState = { errors: [], message: null, updated: null };

let db: Db;
let admin: string;
let player: string;

const priceOf = async (id: number) => (await listPlayers(db, null)).find((p) => p.id === id)!.price;
const positionOf = async (id: number) => (await listPlayers(db, null)).find((p) => p.id === id)!.position;

beforeEach(async () => {
  ({ db } = await createTestDb());
  resetAuth(db);
  await seedLeague(db);
  admin = await addManager(db, "Aoife");
  player = await addManager(db, "Ciaran");
  await db.query(`update profiles set is_admin = true where user_id = $1`, [admin]);
  auth.user = { id: admin, email: "aoife@example.ie" };
});

describe("price editor", () => {
  it("lists players with their prices for admins only", async () => {
    const html = renderToStaticMarkup(await PricesPage());
    expect(html).toContain("Ballina Player 1");
    expect(html).toContain('value="10.0"');

    auth.user = { id: player, email: "ciaran@example.ie" };
    expect(await redirectOf(() => PricesPage())).toBe("404");
  });

  it("saves prices and clears a blank one", async () => {
    const result = await savePrices(editState, form({ "price-1": "8.5", "price-2": "" }));
    expect(result).toMatchObject({ saved: 2, message: null });
    expect(await priceOf(1)).toBe(8.5);
    expect(await priceOf(2)).toBeNull();
  });

  it("saves nothing if any price breaks the rules", async () => {
    const result = await savePrices(editState, form({ "price-1": "8.5", "price-2": "15.5", "price-3": "6.25" }));
    expect(result.errors).toEqual({
      2: "Prices must be 4.0–15.0 in steps of 0.5",
      3: "Prices must be 4.0–15.0 in steps of 0.5",
    });
    expect(await priceOf(1)).toBe(10);
  });

  it("rejects non-admins", async () => {
    auth.user = { id: player, email: "ciaran@example.ie" };
    expect(await savePrices(editState, form({ "price-1": "4.0" }))).toMatchObject({ message: "Admins only" });
    expect(await savePrices(editState, form({ "position-1": "C" }))).toMatchObject({ message: "Admins only" });
    expect(await positionOf(1)).toBe("G");
    expect(await importPrices(importState, form({ csv: "player_external_id,price\np1,4.0" }))).toMatchObject({
      message: "Admins only",
    });
    expect(await priceOf(1)).toBe(10);
  });
});

describe("positions", () => {
  it("shows each player's position and flags those without one", async () => {
    await db.query(`update players set position = null where id = 3`);
    const html = renderToStaticMarkup(await PricesPage());
    expect(html).toContain("1 player needs a position");
    expect(html.match(/Needs a position/g)).toHaveLength(1);
    expect(html).toMatch(/name="position-3"[^>]*>(?:(?!<\/select>).)*<option value="" selected="">Not set/);
    expect(html).toMatch(/name="position-11"[^>]*>(?:(?!<\/select>).)*<option value="C" selected="">Centre/);
  });

  it("saves positions with prices, and clears one left blank", async () => {
    const result = await savePrices(editState, form({ "position-1": "F", "position-2": "", "price-1": "9.5" }));
    expect(result).toMatchObject({ message: null });
    expect(await positionOf(1)).toBe("F");
    expect(await positionOf(2)).toBe(null);
    expect(await priceOf(1)).toBe(9.5);
  });

  it("saves nothing if a position isn't Guard, Forward or Centre", async () => {
    const result = await savePrices(editState, form({ "position-1": "F", "position-2": "Wing" }));
    expect(result.errors).toEqual({ 2: "Choose Guard, Forward or Centre" });
    expect(await positionOf(1)).toBe("G");
  });
});

describe("price CSV import", () => {
  it("matches players by name and team, or by external ID", async () => {
    const csv = 'player_name,team,price\n"Ballina Player 1",BAL,9.0\n"Killester Player 2",Killester,4.5\n';
    expect(await importPrices(importState, form({ csv }))).toMatchObject({ updated: 2 });
    expect(await importPrices(importState, form({ csv: "player_external_id,price\np16,15.0" }))).toMatchObject({
      updated: 1,
    });
    expect([await priceOf(1), await priceOf(6), await priceOf(16)]).toEqual([9, 4.5, 15]);
  });

  it("saves nothing when a row is wrong, naming the row", async () => {
    const csv = "player_name,team,price\nBallina Player 1,BAL,9.0\nNobody,BAL,5.0\nBallina Player 2,BAL,3.0\n";
    const result = await importPrices(importState, form({ csv }));
    expect(result.errors).toEqual([
      { row: 3, message: "No matching player" },
      { row: 4, message: "Prices must be 4.0–15.0 in steps of 0.5" },
    ]);
    expect(await priceOf(1)).toBe(10);
  });
});
