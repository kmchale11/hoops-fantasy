import type { Metadata } from "next";
import Link from "next/link";
import { requireCompleteAccount } from "@/lib/guards";
import { getDb } from "@/lib/server-db";
import { listPlayers } from "@/squads/players";
import { getLatestSquad, getSquadWindow, lockedRounds, type RoundInfo } from "@/squads/squads";
import InstallOffer from "@/app/pwa/install-offer";
import SquadBuilder from "./squad-builder";

export const metadata: Metadata = { title: "Your squad · Hoops Fantasy" };

export const instant = false;

const forClient = (round: RoundInfo | null) =>
  round && { name: round.name, deadline: round.deadline.toISOString() };

/** Only users who are signed in, 18+ and have accepted the terms get here. */
export default async function SquadPage() {
  const { user, profile } = await requireCompleteAccount("/squad");
  const db = getDb();
  const now = new Date();
  const [squadWindow, played, squad] = await Promise.all([
    getSquadWindow(db, now),
    lockedRounds(db, now),
    getLatestSquad(db, user.id),
  ]);
  const lastRound = played.at(-1) ?? null;
  const players = await listPlayers(db, lastRound?.id ?? null);

  return (
    <main>
      <InstallOffer />
      <h1>{profile.teamName}</h1>
      <p className="muted">
        <Link href="/results">Results</Link> · <Link href="/leagues">Leagues</Link> ·{" "}
        <Link href="/leaderboard">Leaderboard</Link> · <Link href="/scoring">How scoring works</Link> ·{" "}
        <Link href="/account">Your account</Link>
      </p>
      <SquadBuilder
        players={players}
        initialPlayerIds={squad?.playerIds ?? []}
        initialCaptainId={squad?.captainId ?? null}
        open={forClient(squadWindow.open)}
        locked={forClient(squadWindow.locked)}
        pointsRound={lastRound?.name ?? null}
        now={now.toISOString()}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null}
      />
    </main>
  );
}
