import { describe, expect, it } from "vitest";
import type { Position, SquadCandidate } from "@/squads/rules";
import { fillSlots, fits, openSlots } from "@/squads/slots";

let nextId = 1;
const player = (name: string, position: Position | null, price = 8): SquadCandidate => ({
  id: nextId++,
  name,
  teamId: nextId,
  teamName: `Team ${nextId}`,
  price,
  position,
});
const names = (slots: Record<string, SquadCandidate[]>) =>
  Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, v.map((p) => p.name)]));

describe("squad slots", () => {
  it("puts the third guard in flex, keeping the two dearest in the guard slots", () => {
    const squad = [
      player("Cheap Guard", "G", 5),
      player("Star Guard", "G", 13),
      player("Mid Guard", "G", 9),
      player("Forward A", "F"),
      player("Forward B", "F"),
      player("Centre", "C"),
    ];
    expect(names(fillSlots(squad))).toEqual({
      G: ["Star Guard", "Mid Guard"],
      F: ["Forward A", "Forward B"],
      C: ["Centre"],
      FLEX: ["Cheap Guard"],
    });
    expect(openSlots(squad)).toEqual({ G: 0, F: 0, C: 0, FLEX: 0 });
  });

  it("puts a player without a position in flex, whatever their price", () => {
    const squad = [player("Unknown", null, 15), player("Guard", "G"), player("Centre", "C")];
    expect(names(fillSlots(squad))).toEqual({ G: ["Guard"], F: [], C: ["Centre"], FLEX: ["Unknown"] });
    expect(openSlots(squad)).toEqual({ G: 1, F: 2, C: 0, FLEX: 0 });
  });

  it("breaks price ties by name", () => {
    const squad = [player("Zach", "F", 8), player("Aaron", "F", 8), player("Méabh", "F", 8)];
    expect(fillSlots(squad).F.map((p) => p.name)).toEqual(["Aaron", "Méabh"]);
    expect(fillSlots(squad).FLEX.map((p) => p.name)).toEqual(["Zach"]);
  });

  it("lets anyone fill flex, but only the right position fill the others", () => {
    expect(fits({ position: null }, "FLEX")).toBe(true);
    expect(fits({ position: "C" }, "FLEX")).toBe(true);
    expect(fits({ position: "C" }, "C")).toBe(true);
    expect(fits({ position: "G" }, "C")).toBe(false);
    expect(fits({ position: null }, "G")).toBe(false);
  });
});
