// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerListing } from "@/squads/players";
import type { Position } from "@/squads/rules";

vi.mock("@/app/squad/actions", () => ({ saveSquadAction: vi.fn() }));
vi.mock("@/app/account/notifications/actions", () => ({}));
const { default: SquadBuilder } = await import("@/app/squad/squad-builder");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEAMS = ["Ballina Braves", "Killester", "Moycullen", "Tralee Titans"];
const POSITIONS: Position[] = ["G", "F", "C", "G"];

/** The test league: 4 teams of 4 (guard, forward, centre, guard), IDs 1–16, priced 10.0. */
function league(prices: Record<number, number> = {}): PlayerListing[] {
  return TEAMS.flatMap((team, t) =>
    POSITIONS.map((position, j) => {
      const id = t * 4 + j + 1;
      return {
        id,
        externalId: `p${id}`,
        name: `${team.split(" ")[0]} Player ${j + 1}`,
        teamId: t + 1,
        teamName: team,
        teamShort: team.slice(0, 3).toUpperCase(),
        position,
        price: prices[id] ?? 10,
        available: true,
        roundPoints: 20 - id,
      };
    }),
  );
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(players: PlayerListing[], picked: number[]) {
  act(() =>
    root.render(
      <SquadBuilder
        players={players}
        initialPlayerIds={picked}
        initialCaptainId={null}
        open={{ name: "Round 5", deadline: new Date(Date.now() + 86_400_000).toISOString() }}
        locked={null}
        pointsRound="Round 4"
        now={new Date().toISOString()}
      />,
    ),
  );
}
const button = (text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;
/** Each listed player's name and the note under it: points, or why they can't be added. */
const listed = () =>
  [...container.querySelectorAll('[aria-label="Players"] li')].map((li) => ({
    name: li.querySelector("span span")!.firstChild!.textContent,
    note: li.querySelector("span span + span")!.textContent,
    canAdd: li.querySelector("button") !== null,
  }));

describe("player picker", () => {
  it("lists only centres when picking for the centre slot", () => {
    render(league(), []);
    act(() => button("Add a centre").click());
    expect(container.querySelector("h2")!.textContent).toBe("Pick your centre");
    expect(listed().map((p) => p.name)).toEqual([
      "Ballina Player 3",
      "Killester Player 3",
      "Moycullen Player 3",
      "Tralee Player 3",
    ]);
    expect(container.querySelector('[aria-label="Position"]')).toBeNull();
  });

  it("dims players who can't be added for the flex slot, saying why", () => {
    // Ballina's guard and forward, Killester's guard and forward and Moycullen's centre: 52.0, leaving 8.0.
    render(league({ 1: 12, 3: 7.5, 13: 6, 14: 12.5 }), [1, 2, 5, 6, 11]);
    act(() => button("Add a flex player").click());
    expect(container.textContent).toContain("up to 8.0 cr");

    const byName = Object.fromEntries(listed().map((p) => [p.name, p]));
    expect(byName["Ballina Player 3"]).toEqual({ name: "Ballina Player 3", note: "2 from Ballina Braves already", canAdd: false });
    expect(byName["Tralee Player 2"]).toEqual({ name: "Tralee Player 2", note: "Over budget by 4.5", canAdd: false });
    expect(byName["Ballina Player 1"].note).toBe("Already in your squad");
    expect(byName["Tralee Player 1"]).toMatchObject({ canAdd: true, note: "7.0 pts in Round 4" });
    // Players who can be added come first.
    expect(listed().findIndex((p) => !p.canAdd)).toBeGreaterThan(listed().findLastIndex((p) => p.canAdd));
  });

  it("narrows the flex picker by position, and adds the chosen player to the squad", () => {
    render(league(), [1, 2, 5, 6, 11]);
    act(() => button("Add a flex player").click());
    act(() => button("Centres").click());
    expect(listed().every((p) => p.name!.endsWith("Player 3"))).toBe(true);

    act(() => container.querySelector<HTMLButtonElement>('button[class*="add"]')!.click());
    expect(container.textContent).toContain("6 / 6");
    expect(container.textContent).toContain("Squad full");
  });
});
