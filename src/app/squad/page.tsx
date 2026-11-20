import type { Metadata } from "next";
import { cookies } from "next/headers";
import InstallOffer from "@/app/pwa/install-offer";
import { getLeaderboardPosition } from "@/leagues/leaderboard";
import { GUIDE_COOKIE } from "@/lib/guide-cookie";
import { requireCompleteAccount } from "@/lib/guards";
import { getDb } from "@/lib/server-db";
import { listPlayers } from "@/squads/players";
import { getLatestSquad, getSquadWindow, lockedRounds, type RoundInfo } from "@/squads/squads";
import GuidePrompt from "./guide-prompt";
import SquadBuilder from "./squad-builder";
import styles from "./squad.module.css";

export const metadata: Metadata = { title: "Your squad" };

export const instant = false;

const forClient = (round: RoundInfo | null) =>
  round && { name: round.name, deadline: round.deadline.toISOString() };

/** Only users who are signed in, 18+ and have accepted the terms get here. */
export default async function SquadPage() {
  const { user, profile } = await requireCompleteAccount("/squad");
  const db = getDb();
  const now = new Date();
  const [squadWindow, played, squad, position, seenGuide] = await Promise.all([
    getSquadWindow(db, now),
    lockedRounds(db, now),
    getLatestSquad(db, user.id),
    getLeaderboardPosition(db, user.id),
    cookies().then((c) => c.has(GUIDE_COOKIE)),
  ]);
  const lastRound = played.at(-1) ?? null;
  const players = await listPlayers(db, lastRound?.id ?? null);
  const round = squadWindow.locked ?? squadWindow.open;

  return (
    <main>
      <InstallOffer />
      {!seenGuide && <GuidePrompt />}
      <header className={styles.header}>
        <div>
          {round && <span className="eyebrow">{round.name}</span>}
          <h1>My squad</h1>
          <span className="muted">{profile.teamName}</span>
        </div>
        {position && (
          <div className={styles.season}>
            <span className={styles.seasonValue}>{position.seasonTotal.toFixed(1)}</span>
            <span className="muted">season pts · #{position.rank}</span>
          </div>
        )}
      </header>
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
