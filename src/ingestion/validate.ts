import { STAT_KEYS, type StatValues } from "./feed/types";

/** Raised when feed or CSV data breaks the data contract. Nothing is written for that fixture. */
export class FeedDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedDataError";
  }
}

/**
 * Returns the problems with a stat line, or an empty list if it's valid.
 * The same rules apply to feed data and admin CSV imports.
 */
export function statLineProblems(line: object): string[] {
  const problems: string[] = [];
  const fields = line as Record<string, unknown>;

  for (const key of STAT_KEYS) {
    const value = fields[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      problems.push(`${key} must be a whole number of 0 or more`);
    }
  }
  if (problems.length > 0) return problems;

  const s = line as unknown as StatValues;
  if (s.minutes > 60) problems.push("minutes cannot be more than 60");
  if (s.fgm > s.fga) problems.push("fgm cannot be more than fga");
  if (s.ftm > s.fta) problems.push("ftm cannot be more than fta");

  // Every made field goal is worth 2 or 3, so points must sit in this range.
  const minPts = 2 * s.fgm + s.ftm;
  const maxPts = 3 * s.fgm + s.ftm;
  if (s.pts < minPts || s.pts > maxPts) {
    problems.push(`pts (${s.pts}) doesn't match field goals and free throws (expected ${minPts}–${maxPts})`);
  }

  return problems;
}
