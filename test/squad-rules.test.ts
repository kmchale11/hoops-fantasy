import { describe, expect, it } from "vitest";
import { squadRuleErrors, type Position, type SquadCandidate } from "@/squads/rules";
import { createTestDb } from "./helpers/db";

function player(id: number, position: Position | null, price: number | null = 10, team = `Team ${id}`): SquadCandidate {
  return { id, name: `Player ${id}`, teamId: id, teamName: team, price, position };
}

/** 6 players from 6 teams costing 10.0 each (exactly 60.0), with the given positions. */
const squadOf = (...positions: (Position | null)[]) => positions.map((pos, i) => player(i + 1, pos));
/** 2 guards, 2 forwards, a centre and a third guard in the flex slot. */
const valid = () => squadOf("G", "G", "F", "F", "C", "G");

describe("squad rules", () => {
  it("accepts a valid squad", () => {
    expect(squadRuleErrors(valid(), 1)).toEqual([]);
  });

  it("rejects an over-budget squad, showing the amount over", () => {
    const squad = valid();
    squad[0].price = 11.5;
    expect(squadRuleErrors(squad, 1)).toEqual(["Over budget by 1.5 credits"]);
  });

  it("rejects 5 players, and the old size of 8", () => {
    expect(squadRuleErrors(valid().slice(0, 5), 1)).toEqual(["Pick 6 players (you have 5)"]);
    const eight = [...valid(), player(7, "G", 0), player(8, "F", 0)];
    expect(squadRuleErrors(eight, 1)).toEqual(["Pick 6 players (you have 8)"]);
  });

  it("rejects 3 or 4 players from one club, naming it, and allows 2", () => {
    const fromBallina = (n: number) =>
      valid().map((p, i) => (i < n ? { ...p, teamId: 100, teamName: "Ballina Braves" } : p));
    expect(squadRuleErrors(fromBallina(4), 1)).toEqual(["Too many players from Ballina Braves (2 max)"]);
    expect(squadRuleErrors(fromBallina(3), 1)).toEqual(["Too many players from Ballina Braves (2 max)"]);
    expect(squadRuleErrors(fromBallina(2), 1)).toEqual([]);
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

describe("positions", () => {
  it("accepts 3 guards, 2 forwards and a centre, the third guard in the flex slot", () => {
    expect(squadRuleErrors(squadOf("G", "G", "G", "F", "F", "C"), 1)).toEqual([]);
  });

  it("needs a centre", () => {
    expect(squadRuleErrors(squadOf("G", "G", "G", "F", "F", "F"), 1)).toEqual(["Pick a centre"]);
  });

  it("needs 2 guards", () => {
    expect(squadRuleErrors(squadOf("G", "F", "F", "F", "C", "C"), 1)).toEqual(["Pick 2 guards (you have 1)"]);
  });

  it("needs 2 forwards", () => {
    expect(squadRuleErrors(squadOf("G", "G", "G", "F", "C", "C"), 1)).toEqual(["Pick 2 forwards (you have 1)"]);
  });

  it("lets one player without a position fill the flex slot", () => {
    expect(squadRuleErrors(squadOf("G", "G", "F", "F", "C", null), 1)).toEqual([]);
  });

  it("rejects a second player without a position", () => {
    expect(squadRuleErrors(squadOf("G", "G", "F", "F", null, null), 1)).toEqual([
      "Pick a centre",
      "Only one player without a position can be picked (in the flex spot)",
    ]);
  });

  it("lists every rule broken, in order", () => {
    const squad = squadOf("C", "C", "C", null, null).map((p) => ({ ...p, price: 13, teamId: 1, teamName: "Ballina" }));
    expect(squadRuleErrors(squad, null)).toEqual([
      "Pick 6 players (you have 5)",
      "Over budget by 5.0 credits",
      "Too many players from Ballina (2 max)",
      "Pick a captain from your squad",
      "Pick 2 guards (you have 0)",
      "Pick 2 forwards (you have 0)",
      "Only one player without a position can be picked (in the flex spot)",
    ]);
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
