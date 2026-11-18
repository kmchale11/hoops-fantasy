/**
 * Squad rules, shared by the squad builder (instant feedback) and the server. The database's
 * save_squad() re-checks the same rules and returns the same messages in the same order.
 */

export const SQUAD_SIZE = 8;
export const BUDGET = 100;
export const MAX_PER_TEAM = 3;

export interface SquadCandidate {
  id: number;
  name: string;
  /** Null when the player has no current team. */
  teamId: number | null;
  teamName: string | null;
  /** Null when no price has been set yet. */
  price: number | null;
}

/** A player can be picked once they have a current team and a price. */
export function isAvailable(player: SquadCandidate): boolean {
  return player.teamId !== null && player.price !== null;
}

/** Every rule the squad breaks, in a fixed order. Empty means the squad is valid. */
export function squadRuleErrors(players: SquadCandidate[], captainId: number | null): string[] {
  const errors: string[] = [];
  const unique = [...new Map(players.map((p) => [p.id, p])).values()];

  if (unique.length < players.length) errors.push("You've picked the same player twice");
  for (const p of unique) {
    if (!isAvailable(p)) errors.push(`${p.name} isn't available to pick yet`);
  }
  if (unique.length !== SQUAD_SIZE) errors.push(`Pick ${SQUAD_SIZE} players (you have ${unique.length})`);

  // Work in tenths so 0.1 steps add up exactly.
  const tenths = unique.reduce((sum, p) => sum + Math.round((p.price ?? 0) * 10), 0);
  if (tenths > BUDGET * 10) errors.push(`Over budget by ${((tenths - BUDGET * 10) / 10).toFixed(1)} credits`);

  const perTeam = new Map<number, { name: string; n: number }>();
  for (const p of unique) {
    if (p.teamId === null || p.teamName === null) continue;
    const team = perTeam.get(p.teamId) ?? { name: p.teamName, n: 0 };
    perTeam.set(p.teamId, { ...team, n: team.n + 1 });
  }
  // Plain character order, matching the database's `collate "C"`.
  const crowded = [...perTeam.values()].filter((t) => t.n > MAX_PER_TEAM).map((t) => t.name);
  for (const team of crowded.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    errors.push(`Too many players from ${team} (${MAX_PER_TEAM} max)`);
  }

  if (captainId === null || !unique.some((p) => p.id === captainId)) errors.push("Pick a captain from your squad");
  return errors;
}
