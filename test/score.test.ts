import { describe, expect, it } from "vitest";
import { SCORING_WEIGHTS, scoreStatLine, type ScoringStatLine } from "@/scoring/score";

const line = (stats: Partial<ScoringStatLine>): ScoringStatLine => ({
  pts: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  tov: 0,
  ...stats,
});

describe("scoreStatLine", () => {
  it("scores a typical guard line as 34.8", () => {
    expect(scoreStatLine(line({ pts: 18, reb: 4, ast: 6, stl: 2, blk: 0, tov: 3 }))).toBe(34.8);
  });

  it("can go negative", () => {
    expect(scoreStatLine(line({ tov: 2 }))).toBe(-2);
  });

  it("scores an all-zero line as exactly 0, not -0", () => {
    expect(Object.is(scoreStatLine(line({})), 0)).toBe(true);
  });

  it("uses the published weights", () => {
    expect(SCORING_WEIGHTS).toEqual({ pts: 1, reb: 1.2, ast: 1.5, stl: 3, blk: 3, tov: -1 });
  });

  describe("rounding", () => {
    it("cleans up floating-point noise (3 × 1.2 is 3.5999… in floating point)", () => {
      expect(3 * 1.2).not.toBe(3.6);
      expect(scoreStatLine(line({ reb: 3 }))).toBe(3.6);
    });

    it("rounds once on the total rather than per category", () => {
      // 7 × 1.2 + 3 × 1.5 = 8.4 + 4.5 = 12.9
      expect(scoreStatLine(line({ reb: 7, ast: 3 }))).toBe(12.9);
    });

    it("rounds a custom weighting to one decimal place", () => {
      const weights = { pts: 1, reb: 1.25, ast: 1.5, stl: 3, blk: 3, tov: -1 };
      // 1.25 → 1.3 and 1.25 × 3 = 3.75 → 3.8 (half rounds up)
      expect(scoreStatLine(line({ reb: 1 }), weights)).toBe(1.3);
      expect(scoreStatLine(line({ reb: 3 }), weights)).toBe(3.8);
    });

    it("handles a big night without drift", () => {
      // 41 + 20.4 + 16.5 + 12 + 9 − 6
      expect(scoreStatLine(line({ pts: 41, reb: 17, ast: 11, stl: 4, blk: 3, tov: 6 }))).toBe(92.9);
    });
  });
});
