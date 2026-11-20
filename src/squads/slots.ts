import { BUDGET, MAX_PER_TEAM, SLOTS, type Position, type SquadCandidate } from "./rules";

export type Slot = Position | "FLEX";

/** The slots in the order the squad is shown. */
export const SLOT_ORDER: Slot[] = ["G", "F", "C", "FLEX"];

/** What each slot is called on screen, and who can fill it. */
export const SLOT_LABELS: Record<Slot, { group: string; accepts: string }> = {
  G: { group: "Guards", accepts: "Guard" },
  F: { group: "Forwards", accepts: "Forward" },
  C: { group: "Centre", accepts: "Centre" },
  FLEX: { group: "Flex", accepts: "Any position" },
};

/** Can this player go in this slot? Flex takes anyone, including players with no position. */
export function fits(player: Pick<SquadCandidate, "position">, slot: Slot): boolean {
  return slot === "FLEX" || player.position === slot;
}

/**
 * Where each picked player is shown. Squads store no slots: the dearest guards (then by name)
 * fill the guard slots, and so on, and everyone left over is in Flex. Flex holds more than one
 * only while a squad breaks the rules.
 */
export function fillSlots<T extends SquadCandidate>(players: T[]): Record<Slot, T[]> {
  const sorted = [...players].sort((a, b) => (b.price ?? 0) - (a.price ?? 0) || a.name.localeCompare(b.name, "en-IE"));
  const slots: Record<Slot, T[]> = { G: [], F: [], C: [], FLEX: [] };
  for (const p of sorted) {
    if (p.position !== null && slots[p.position].length < SLOTS[p.position]) slots[p.position].push(p);
    else slots.FLEX.push(p);
  }
  return slots;
}

/** How many of each slot are still empty. */
export function openSlots(players: SquadCandidate[]): Record<Slot, number> {
  const filled = fillSlots(players);
  return {
    G: SLOTS.G - filled.G.length,
    F: SLOTS.F - filled.F.length,
    C: SLOTS.C - filled.C.length,
    FLEX: Math.max(0, SLOTS.FLEX - filled.FLEX.length),
  };
}

const tenths = (n: number) => Math.round(n * 10);

/** Credits left after the given squad, exactly (prices are in tenths). */
export function budgetLeft(players: SquadCandidate[]): number {
  return (tenths(BUDGET) - players.reduce((sum, p) => sum + tenths(p.price ?? 0), 0)) / 10;
}

/**
 * Why a player can't be added to the squad right now, or null if they can: the same rules the
 * save checks, so the picker never offers a player the save would reject for these reasons.
 */
export function pickProblem(player: SquadCandidate, squad: SquadCandidate[]): string | null {
  if (squad.some((p) => p.id === player.id)) return "Already in your squad";
  if (player.teamId === null || player.price === null) return "Not available to pick yet";
  const over = tenths(player.price) - tenths(budgetLeft(squad));
  if (over > 0) return `Over budget by ${(over / 10).toFixed(1)}`;
  const sameClub = squad.filter((p) => p.teamId === player.teamId).length;
  if (sameClub >= MAX_PER_TEAM) return `${sameClub} from ${player.teamName} already`;
  return null;
}
