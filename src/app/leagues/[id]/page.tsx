import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/forms.module.css";
import table from "@/app/standings.module.css";
import { getLeague, LEAGUE_PAGE_ERRORS } from "@/leagues/leagues";
import { requireCompleteAccount } from "@/lib/guards";
import { getDb } from "@/lib/server-db";
import { leaveLeagueAction, regenerateCodeAction, removeMemberAction } from "../actions";
import { CopyInviteLink, JoinLeagueForm } from "../league-forms";

export const metadata: Metadata = { title: "League · Hoops Fantasy" };

export const instant = false;

const points = (n: number) => n.toFixed(1);

/** A league's standings for its members. Everyone else gets a prompt to join with a code. */
export default async function LeaguePage({ params, searchParams }: PageProps<"/leagues/[id]">) {
  const { id } = await params;
  const { created, error } = await searchParams;
  const { user } = await requireCompleteAccount(`/leagues/${id}`);
  const leagueId = Number(id);
  const league = Number.isSafeInteger(leagueId) ? await getLeague(getDb(), user.id, leagueId, new Date()) : null;

  if (!league) {
    return (
      <main>
        <p className="muted">
          <Link href="/leagues">Your leagues</Link>
        </p>
        <h1>Join this league</h1>
        <p>Only members can see a league&apos;s table. Enter the invite code you were sent to join.</p>
        <JoinLeagueForm />
      </main>
    );
  }

  // The short form opens the app when it is installed.
  const invitePath = `/join/${league.inviteCode}`;
  return (
    <main>
      <p className="muted">
        <Link href="/leagues">Your leagues</Link> · <Link href="/leaderboard">Leaderboard</Link>
      </p>
      <h1>{league.name}</h1>
      {created && (
        <p className={styles.notice}>League created. Share the invite code below so people can join.</p>
      )}
      {typeof error === "string" && LEAGUE_PAGE_ERRORS.includes(error) && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <table className={table.table}>
        <thead>
          <tr>
            <th scope="col" className={table.rank}>
              #
            </th>
            <th scope="col">Team</th>
            <th scope="col" className={table.num}>
              {league.round?.name ?? "Round"}
            </th>
            <th scope="col" className={table.num}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {league.standings.map((s) => (
            <tr key={s.userId} className={s.userId === user.id ? table.me : undefined}>
              <td className={table.rank}>{s.rank}</td>
              <th scope="row">
                {s.teamName}
                <span className={table.manager}>
                  {s.managerName}
                  {s.userId === user.id && " (you)"}
                </span>
              </th>
              <td className={table.num}>{league.round ? points(s.roundPoints) : "–"}</td>
              <td className={table.num}>{points(s.seasonTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!league.round && <p className="muted">Round scores show here once the first round is over.</p>}

      <section className={`${styles.card} ${table.section}`} aria-labelledby="invite">
        <h2 id="invite" className={styles.label}>
          Invite code
        </h2>
        <p className={table.code}>{league.inviteCode}</p>
        <p className={styles.hint}>
          Anyone with this code can join. Send them the code or this link: <Link href={invitePath}>{invitePath}</Link>
        </p>
        <CopyInviteLink path={invitePath} />
        {league.isAdmin && (
          <form action={regenerateCodeAction}>
            <input type="hidden" name="league" value={league.id} />
            <button className={styles.secondary} type="submit">
              Get a new code
            </button>
            <p className={styles.hint}>The old code stops working. Everyone already in the league stays in.</p>
          </form>
        )}
      </section>

      {league.isAdmin && league.standings.length > 1 && (
        <details className={table.section}>
          <summary>Remove members</summary>
          <ul className={table.list}>
            {league.standings
              .filter((s) => s.userId !== user.id)
              .map((s) => (
                <li key={s.userId}>
                  <span>
                    {s.teamName} <span className="muted">({s.managerName})</span>
                  </span>
                  <form action={removeMemberAction} className={table.inline}>
                    <input type="hidden" name="league" value={league.id} />
                    <input type="hidden" name="member" value={s.userId} />
                    <button className={table.link} type="submit" aria-label={`Remove ${s.teamName}`}>
                      Remove
                    </button>
                  </form>
                </li>
              ))}
          </ul>
        </details>
      )}

      <details className={table.section}>
        <summary>Leave this league</summary>
        <form action={leaveLeagueAction}>
          <input type="hidden" name="league" value={league.id} />
          <p>
            You can rejoin later with the invite code.
            {league.isAdmin &&
              (league.standings.length > 1
                ? " The longest-standing member will take over running it."
                : " You're the only member, so the league will be deleted.")}
          </p>
          <button className={styles.danger} type="submit">
            Leave league
          </button>
        </form>
      </details>
    </main>
  );
}
