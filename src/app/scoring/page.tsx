import type { Metadata } from "next";
import Link from "next/link";
import {
  SCORING_CATEGORIES,
  SCORING_WEIGHTS,
  scoreStatLine,
  type ScoringCategory,
  type ScoringStatLine,
} from "@/scoring/score";
import styles from "./scoring.module.css";

export const metadata: Metadata = {
  title: "How scoring works · Hoops Fantasy",
  description: "How a player's box score turns into fantasy points.",
};

const LABELS: Record<ScoringCategory, string> = {
  pts: "Point",
  reb: "Rebound",
  ast: "Assist",
  stl: "Steal",
  blk: "Block",
  tov: "Turnover",
};

const EXAMPLE: ScoringStatLine = { pts: 18, reb: 4, ast: 6, stl: 2, blk: 0, tov: 3 };

/** Signed, with a real minus sign: +1.2, −1. */
function signed(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`;
}

/** Public: everything here comes from SCORING_WEIGHTS, so it always matches the real maths. */
export default function ScoringPage() {
  return (
    <main>
      <p className="muted">
        <Link href="/">Hoops Fantasy</Link>
      </p>
      <h1>How scoring works</h1>
      <p>Every player earns fantasy points from their box score in each game they play.</p>

      <table className={styles.table}>
        <caption className={styles.caption}>Points per stat</caption>
        <thead>
          <tr>
            <th scope="col">Each…</th>
            <th scope="col" className={styles.num}>
              Fantasy points
            </th>
          </tr>
        </thead>
        <tbody>
          {SCORING_CATEGORIES.map((category) => (
            <tr key={category} data-category={category}>
              <th scope="row">{LABELS[category]}</th>
              <td className={styles.num}>{signed(SCORING_WEIGHTS[category])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className={styles.h2}>Example</h2>
      <p>
        A guard with {EXAMPLE.pts} points, {EXAMPLE.reb} rebounds, {EXAMPLE.ast} assists, {EXAMPLE.stl} steals,{" "}
        {EXAMPLE.blk} blocks and {EXAMPLE.tov} turnovers scores{" "}
        <strong>{scoreStatLine(EXAMPLE).toFixed(1)}</strong> fantasy points.
      </p>

      <h2 className={styles.h2}>The fine print</h2>
      <ul className={styles.list}>
        <li>The total is rounded to one decimal place. Turnovers can push it below zero.</li>
        <li>Players who don&apos;t get on court, or whose game is postponed, score 0.</li>
        <li>Points during a live game are provisional until the final buzzer.</li>
        <li>If the official scorer corrects a box score later, points are recalculated automatically.</li>
        <li>If a player plays twice in one round, both games count.</li>
      </ul>
    </main>
  );
}
