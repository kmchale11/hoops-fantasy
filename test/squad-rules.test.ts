import { describe, expect, it } from "vitest";
import { squadRuleErrors, type SquadCandidate } from "@/squads/rules";
import { createTestDb } from "./helpers/db";

function player(id: number, price: number | null, team = `Team ${id}`): SquadCandidate {
  return { id, name: `Player ${id}`, teamId: id, teamName: team, price };
}

/** 8 players from 8 teams costing 12.5 each: exactly 100.0. */
const valid = () => Array.from({ length: 8 }, (_, i) => player(i + 1, 12.5));

describe("squad rules", () => {
  it("accepts a valid squad", () => {
    expect(squadRuleErrors(valid(), 1)).toEqual([]);
  });

  it("rejects an over-budget squad, showing the amount over", () => {
    const squad = valid();
    squad[0].price = 14.0;
    expect(squadRuleErrors(squad, 1)).toEqual(["Over budget by 1.5 credits"]);
  });

  it("rejects 7 players", () => {
    expect(squadRuleErrors(valid().slice(0, 7), 1)).toEqual(["Pick 8 players (you have 7)"]);
  });

  it("rejects 4 players from one team, naming it", () => {
    const squad = valid().map((p, i) => (i < 4 ? { ...p, teamId: 100, teamName: "Ballina Braves" } : p));
    expect(squadRuleErrors(squad, 1)).toEqual(["Too many players from Ballina Braves (3 max)"]);
  });

  it("requires a captain from the squad", () => {
    expect(squadRuleErrors(valid(), null)).toEqual(["Pick a captain from your squad"]);
    expect(squadRuleErrors(valid(), 99)).toEqual(["Pick a captain from your squad"]);
  });

  it("rejects an unpriced player", () => {
    const squad = valid();
    squad[2].price = null;
    expect(squadRuleErrors(squad, 1)).toEqual(["Player 3 isn't available to pick yet"]);
  });
});

describe("player prices", () => {
  it("allows 4.0 to 15.0 in steps of 0.5", async () => {
    const { db } = await createTestDb();
    await db.query(`insert into competitions (external_id, name, season) values ('c', 'SL', '2026-27')`);
    await db.query(`insert into players (external_id, full_name) values ('p1', 'A')`);
    for (const ok of ["4.0", "8.5", "15.0"]) {
      await db.query(`insert into player_prices (player_id, price) values (1, $1)
                      on conflict (player_id) do update set price = excluded.price`, [ok]);
    }
    for (const bad of ["3.5", "15.5", "5.25", "5.04"]) {
      await expect(db.query(`update player_prices set price = $1 where player_id = 1`, [bad])).rejects.toThrow(
        /player_prices_range/,
      );
    }
  });
});
