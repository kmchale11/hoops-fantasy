import type { Position } from "@/squads/rules";

const FEED_POSITIONS: Record<string, Position> = {
  G: "G", PG: "G", SG: "G", GUARD: "G", "POINT GUARD": "G", "SHOOTING GUARD": "G",
  F: "F", SF: "F", PF: "F", FORWARD: "F", "SMALL FORWARD": "F", "POWER FORWARD": "F",
  C: "C", CENTER: "C", CENTRE: "C",
};

/**
 * A feed's position as Guard, Forward or Centre. Anything else (a hybrid like "G/F", or none)
 * is null, which keeps whatever an admin set. Matches the mapping in the positions migration.
 */
export function feedPosition(position: string | null): Position | null {
  return position === null ? null : (FEED_POSITIONS[position.trim().toUpperCase()] ?? null);
}
