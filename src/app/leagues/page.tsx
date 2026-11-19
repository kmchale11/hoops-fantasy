import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/forms.module.css";
import table from "@/app/standings.module.css";
import { myLeagues } from "@/leagues/leagues";
import { requireCompleteAccount } from "@/lib/guards";
import { getDb } from "@/lib/server-db";
import { CreateLeagueForm, JoinLeagueForm } from "./league-forms";

export const metadata: Metadata = { title: "Leagues · Hoops Fantasy" };

export const instant = false;

export default async function LeaguesPage({ searchParams }: PageProps<"/leagues">) {
  const { user } = await requireCompleteAccount("/leagues");
  const { left } = await searchParams;
  const leagues = await myLeagues(getDb(), user.id);

  return (
    <main>
      <p className="muted">
        <Link href="/squad">Your squad</Link> · <Link href="/leaderboard">Leaderboard</Link>
      </p>
      <h1>Your leagues</h1>
      {left && <p className={styles.notice}>You&apos;ve left the league.</p>}

      {leagues.length === 0 ? (
        <p className="muted">You&apos;re not in any leagues yet. Create one or join with a code.</p>
      ) : (
        <ul className={table.list}>
          {leagues.map((l) => (
            <li key={l.id}>
              <Link href={`/leagues/${l.id}`}>{l.name}</Link>
              <span className="muted">
                {l.members} {l.members === 1 ? "member" : "members"}
                {l.isAdmin && " · you run it"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2>Join a league</h2>
      <JoinLeagueForm />

      <h2 className={table.section}>Create a league</h2>
      <CreateLeagueForm />
    </main>
  );
}
