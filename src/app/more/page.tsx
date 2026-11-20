import type { Metadata } from "next";
import Link from "next/link";
import InstallRow from "@/app/pwa/install-row";
import { signOut } from "@/app/sign-in/actions";
import { getLeaderboardPosition } from "@/leagues/leaderboard";
import { requireUser } from "@/lib/guards";
import { getDb } from "@/lib/server-db";
import styles from "./more.module.css";

export const metadata: Metadata = { title: "More" };

export const instant = false;

function Row({ href, label, hint, badge }: { href: string; label: string; hint: string; badge?: string }) {
  return (
    <li>
      <Link href={href} className={styles.row}>
        <span>
          {label}
          {badge && <span className={styles.badge}>{badge}</span>}
        </span>
        <span className={styles.hint}>{hint}</span>
      </Link>
    </li>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

export default async function MorePage() {
  const account = await requireUser("/more");
  const profile = account.status === "ready" ? account.profile : null;
  const position = profile ? await getLeaderboardPosition(getDb(), account.user.id) : null;

  return (
    <main className={styles.page}>
      <h1>More</h1>

      <section aria-label="Your profile" className={styles.profile}>
        <span className={styles.avatar} aria-hidden="true">
          {profile ? initials(profile.teamName) : "?"}
        </span>
        <span>
          <span className={styles.team}>{profile?.teamName ?? "Finish setting up your team"}</span>
          <span className={styles.hint}>
            {profile
              ? [profile.managerName, position && `#${position.rank} overall`].filter(Boolean).join(" · ")
              : account.user.email}
          </span>
        </span>
      </section>

      <nav aria-labelledby="more-help">
        <h2 id="more-help" className={styles.group}>
          Help
        </h2>
        <ul className={styles.list}>
          <Row href="/how-to-play" label="How to play" hint="Squads, deadlines, captains and leagues" />
          <Row href="/scoring" label="How scoring works" hint="Points for every stat" />
        </ul>
      </nav>

      <nav aria-labelledby="more-you">
        <h2 id="more-you" className={styles.group}>
          You
        </h2>
        <ul className={styles.list}>
          {profile ? (
            <Row href="/account/notifications" label="Notifications" hint="Deadline reminders and round results" />
          ) : (
            <Row href="/welcome?next=/more" label="Finish signing up" hint="Pick your team name to start playing" />
          )}
          <Row href="/account" label="Your account" hint="Manager and team name, delete account" />
          <li>
            <InstallRow className={styles.row} hintClassName={styles.hint} />
          </li>
          {profile?.isAdmin && (
            <Row
              href="/admin"
              label="Admin"
              badge="Admins only"
              hint="Player prices and positions, box-score import"
            />
          )}
        </ul>
      </nav>

      <form action={signOut} className={styles.signOut}>
        <button type="submit">Sign out</button>
      </form>
      <p className={styles.footer}>Free to play · no prizes · 18+</p>
    </main>
  );
}
