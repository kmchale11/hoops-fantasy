import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboardPosition } from "@/leagues/leaderboard";
import { requireCompleteAccount } from "@/lib/guards";
import { getDb } from "@/lib/server-db";
import { CAPTAIN_MULTIPLIER, POSITION_NAMES } from "@/squads/rules";
import { fillSlots } from "@/squads/slots";
import { getSeasonResults, type RoundResultPlayer } from "@/squads/squads";
import styles from "./results.module.css";

export const metadata: Metadata = { title: "Results" };

export const instant = false;

const points = (n: number) => n.toFixed(1);

/** What's under a player's name: their slot if flex, and why they scored nothing if postponed. */
function note(p: RoundResultPlayer, flex: boolean): string {
  const parts = [
    flex && `Flex${p.position ? ` · ${POSITION_NAMES[p.position]}` : ""}`,
    p.postponed ? "game postponed" : p.captain && `${points(p.points)} × ${CAPTAIN_MULTIPLIER}`,
    !flex && !p.postponed && !p.captain && p.teamName,
  ].filter(Boolean) as string[];
  const text = parts.join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One locked round at a time (the latest unless ?round= picks another), and the season total. */
export default async function ResultsPage({ searchParams }: PageProps<"/results">) {
  const { user } = await requireCompleteAccount("/results");
  const db = getDb();
  const [results, position, { round: asked }] = await Promise.all([
    getSeasonResults(db, user.id, new Date()),
    getLeaderboardPosition(db, user.id),
    searchParams,
  ]);
  const total = results.reduce((sum, r) => sum + Math.round(r.points * 10), 0) / 10;

  if (results.length === 0) {
    return (
      <main>
        <h1>Results</h1>
        <p className="muted">No rounds have been played yet. Your points show here once the first round locks.</p>
      </main>
    );
  }

  const found = results.findIndex((r) => String(r.round.number) === asked);
  const i = found >= 0 ? found : results.length - 1;
  const { round, points: roundPoints, rank, average, players } = results[i];
  const flexIds = new Set(fillSlots(players).FLEX.map((p) => p.id));
  const roundLink = (n: number) => `/results?round=${results[n].round.number}`;

  return (
    <main className={styles.page}>
      <header>
        <div className={styles.top}>
          <span className="eyebrow">{round.name}</span>
          <nav aria-label="Choose round" className={styles.rounds}>
            {i > 0 ? (
              <Link href={roundLink(i - 1)} className={styles.step}>
                <span aria-hidden="true">‹</span>
                <span className="sr-only">Previous round</span>
              </Link>
            ) : (
              <span className={styles.stepOff} aria-hidden="true">
                ‹
              </span>
            )}
            {i < results.length - 1 ? (
              <Link href={roundLink(i + 1)} className={styles.step}>
                <span aria-hidden="true">›</span>
                <span className="sr-only">Next round</span>
              </Link>
            ) : (
              <span className={styles.stepOff} aria-hidden="true">
                ›
              </span>
            )}
          </nav>
        </div>
        <h1 className={styles.score}>
          {points(roundPoints)}
          <span className={styles.scoreLabel}>points this round</span>
        </h1>
      </header>

      <section aria-label="How you did" className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Round rank</span>
          <span className={styles.tileValue}>{rank ? `#${rank}` : "–"}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Average</span>
          <span className={styles.tileValue}>{average === null ? "–" : points(average)}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Season</span>
          <span className={styles.tileValue}>
            {points(total)}
            {position && <span className={styles.tileOf}> · #{position.rank}</span>}
          </span>
        </div>
      </section>

      {players.length === 0 ? (
        <p className="muted">No squad this round, so 0 points.</p>
      ) : (
        <ul className={styles.lines} aria-label="Points by player">
          {players.map((p) => (
            <li key={p.id} className={styles.line}>
              <span className={styles.club} aria-hidden="true">
                {p.teamShort ?? "–"}
              </span>
              <span className={styles.who}>
                <span className={styles.name}>
                  {p.name}
                  {p.captain && <span className={styles.captain}>C ×{CAPTAIN_MULTIPLIER}</span>}
                </span>
                <span className={p.postponed ? styles.warn : styles.sub}>{note(p, flexIds.has(p.id))}</span>
              </span>
              <span className={p.postponed ? styles.zero : styles.pts}>
                {points(p.captain ? p.points * CAPTAIN_MULTIPLIER : p.points)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.small}>
        Scores update if the league corrects a stat line. <Link href="/scoring">How scoring works</Link>
      </p>
    </main>
  );
}
