import type { Metadata } from "next";
import Link from "next/link";
import table from "@/app/standings.module.css";
import { getLeaderboard, getLeaderboardPosition } from "@/leagues/leaderboard";
import { requireCompleteAccount } from "@/lib/guards";
import { getDb } from "@/lib/server-db";

export const metadata: Metadata = { title: "Leaderboard · Hoops Fantasy" };

export const instant = false;

const points = (n: number) => n.toFixed(1);

/** Every user with a squad, by season total. The signed-in user's row is highlighted. */
export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  const { user } = await requireCompleteAccount("/leaderboard");
  const { page } = await searchParams;
  const db = getDb();
  const [board, me] = await Promise.all([
    getLeaderboard(db, Number(typeof page === "string" ? page : 1)),
    getLeaderboardPosition(db, user.id),
  ]);
  const pageLink = (n: number) => (n === 1 ? "/leaderboard" : `/leaderboard?page=${n}`);

  return (
    <main>
      <p className="muted">
        <Link href="/squad">Your squad</Link> · <Link href="/leagues">Your leagues</Link>
      </p>
      <h1>Leaderboard</h1>
      {me ? (
        <p>
          You&apos;re ranked <strong>{me.rank}</strong> of {board.users} with {points(me.seasonTotal)} points.
          {me.page !== board.page && (
            <>
              {" "}
              <Link href={pageLink(me.page)}>Show my position</Link>
            </>
          )}
        </p>
      ) : (
        <p className="muted">
          <Link href="/squad">Pick a squad</Link> to appear on the leaderboard.
        </p>
      )}

      {board.rows.length === 0 ? (
        <p className="muted">Nobody has picked a squad yet.</p>
      ) : (
        <table className={table.table}>
          <thead>
            <tr>
              <th scope="col" className={table.rank}>
                #
              </th>
              <th scope="col">Team</th>
              <th scope="col" className={table.num}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((r) => (
              <tr
                key={r.userId}
                className={r.userId === user.id ? table.me : undefined}
                aria-current={r.userId === user.id ? "true" : undefined}
              >
                <td className={table.rank}>{r.rank}</td>
                <th scope="row">
                  {r.teamName}
                  <span className={table.manager}>
                    {r.managerName}
                    {r.userId === user.id && " (you)"}
                  </span>
                </th>
                <td className={table.num}>{points(r.seasonTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {board.pages > 1 && (
        <nav className={table.pager} aria-label="Leaderboard pages">
          {board.page > 1 ? <Link href={pageLink(board.page - 1)}>Previous</Link> : <span />}
          <span className="muted">
            Page {board.page} of {board.pages}
          </span>
          {board.page < board.pages ? <Link href={pageLink(board.page + 1)}>Next</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
