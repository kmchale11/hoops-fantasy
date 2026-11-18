import type { Metadata } from "next";
import Link from "next/link";
import { requireCompleteAccount } from "@/lib/guards";
import { getDb } from "@/lib/server-db";
import { getSeasonResults } from "@/squads/squads";
import styles from "./results.module.css";

export const metadata: Metadata = { title: "Results · Hoops Fantasy" };

export const instant = false;

const points = (n: number) => n.toFixed(1);

/** The user's score for each round that has locked, newest first, and their season total. */
export default async function ResultsPage() {
  const { user, profile } = await requireCompleteAccount("/results");
  const results = await getSeasonResults(getDb(), user.id, new Date());
  const total = results.reduce((sum, r) => sum + Math.round(r.points * 10), 0) / 10;

  return (
    <main>
      <p className="muted">
        <Link href="/squad">Your squad</Link>
      </p>
      <h1>{profile.teamName}</h1>
      <p className={styles.total}>
        Season total <strong>{points(total)}</strong>
      </p>

      {results.length === 0 && <p className="muted">No rounds have been played yet.</p>}

      {[...results].reverse().map(({ round, points: roundPoints, players }) => (
        <section key={round.id} className={styles.round}>
          <h2 className={styles.h2}>
            <span>{round.name}</span>
            <span>{points(roundPoints)}</span>
          </h2>
          {players.length === 0 ? (
            <p className="muted">No squad this round, so 0 points.</p>
          ) : (
            <table className={styles.table}>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">
                      {p.name}
                      {p.captain && <span className={styles.captain}> (C) ×2</span>}
                    </th>
                    <td className={styles.num}>{points(p.captain ? p.points * 2 : p.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </main>
  );
}
