import type { StatValues } from "@/ingestion/feed/types";

/**
 * Fantasy points per unit of each stat. The worker and the public /scoring page both
 * import this, so the published rules can't drift from the maths.
 */
export const SCORING_WEIGHTS = {
  pts: 1,
  reb: 1.2,
  ast: 1.5,
  stl: 3,
  blk: 3,
  tov: -1,
} as const;

export type ScoringWeights = Record<keyof typeof SCORING_WEIGHTS, number>;
export type ScoringCategory = keyof ScoringWeights;

/** The parts of a box-score line that earn fantasy points. */
export type ScoringStatLine = Pick<StatValues, ScoringCategory>;

export const SCORING_CATEGORIES = Object.keys(SCORING_WEIGHTS) as ScoringCategory[];

/**
 * Fantasy points for one player in one fixture. Rounds once, on the total, to one
 * decimal place, so per-category rounding errors can't compound.
 */
export function scoreStatLine(stats: ScoringStatLine, weights: ScoringWeights = SCORING_WEIGHTS): number {
  let total = 0;
  for (const category of SCORING_CATEGORIES) {
    total += stats[category] * weights[category];
  }
  const rounded = Math.round(total * 10) / 10;
  // Avoid returning -0, which would display as "-0.0".
  return rounded === 0 ? 0 : rounded;
}
