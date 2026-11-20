import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { APP_NAME, INDEPENDENCE_NOTICE } from "@/lib/app-identity";
import { SCORING_CATEGORIES, SCORING_LABELS, SCORING_WEIGHTS, signedWeight } from "@/scoring/score";
import { BUDGET, CAPTAIN_MULTIPLIER, MAX_PER_TEAM, SLOTS, SQUAD_SIZE } from "@/squads/rules";
import NextStep from "./next-step";
import SeenGuide from "./seen-guide";
import styles from "./how-to-play.module.css";

export const metadata: Metadata = {
  title: "How to play",
  description: `How ${APP_NAME} works: squads, captains, deadlines, scoring and leagues.`,
};

const MULTIPLIER_WORDS: Record<number, string> = { 2: "double", 3: "triple" };
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The slots as chips: G G F F C Flex. */
const SLOT_CHIPS = [
  ...Array<string>(SLOTS.G).fill("G"),
  ...Array<string>(SLOTS.F).fill("F"),
  ...Array<string>(SLOTS.C).fill("C"),
  ...Array<string>(SLOTS.FLEX).fill("Flex"),
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className={styles.step} aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`}>
        <span className={styles.number} aria-hidden="true">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Public. Every number comes from the constants the game enforces (SLOTS, BUDGET and so on),
 * so this page can't contradict the rules.
 */
export default function HowToPlayPage() {
  const multiplier = MULTIPLIER_WORDS[CAPTAIN_MULTIPLIER] ?? `${CAPTAIN_MULTIPLIER}×`;
  return (
    <main className={styles.page}>
      <SeenGuide />
      <h1>How to play</h1>
      <p className={styles.lead}>
        Pick {SQUAD_SIZE} real players from the Irish league before each round. They score you points for what they
        actually do on court.
      </p>

      <Step n={1} title="Build your squad">
        <ul className={styles.chips} aria-label="Squad slots">
          {SLOT_CHIPS.map((chip, i) => (
            <li key={i} className={chip === "Flex" ? styles.flex : undefined}>
              {chip}
            </li>
          ))}
        </ul>
        <ul>
          <li>
            {count(SLOTS.G, "guard", "guards")}, {count(SLOTS.F, "forward", "forwards")},{" "}
            {count(SLOTS.C, "centre", "centres")} and {count(SLOTS.FLEX, "flex player", "flex players")} from any
            position
          </li>
          <li>{BUDGET} credits to spend. Better players cost more.</li>
          <li>No more than {MAX_PER_TEAM} players from the same club</li>
        </ul>
      </Step>

      <Step n={2} title="Pick a captain">
        <p>
          Your captain scores <strong>{multiplier} points</strong>. Choose someone you trust to have a big game. You
          can change captain every round.
        </p>
      </Step>

      <Step n={3} title="Beat the deadline">
        <p>
          Your squad locks at the <strong>first tip-off</strong> of each round. Forget to log in? Your last squad and
          captain carry over automatically.
        </p>
      </Step>

      <Step n={4} title="Score points">
        <ul className={styles.weights} aria-label="Points per stat">
          {SCORING_CATEGORIES.map((category) => (
            <li key={category}>
              <span className={styles.weight}>{signedWeight(SCORING_WEIGHTS[category])}</span>
              <span className={styles.per}>per {SCORING_LABELS[category].toLowerCase()}</span>
            </li>
          ))}
        </ul>
        <ul>
          <li>Postponed game? That player scores 0 for the round.</li>
          <li>If the league corrects a stat, your score updates too.</li>
        </ul>
        <p>
          <Link href="/scoring">Full scoring rules</Link>
        </p>
      </Step>

      <Step n={5} title="Play with friends">
        <p>
          Everyone is on the <strong>leaderboard</strong>. For bragging rights, start a private league for your club,
          workplace or friends and share its 6-letter invite code.
        </p>
      </Step>

      <Step n={6} title="Never miss a deadline">
        <p>
          Turn on reminders to hear 24 hours and 1 hour before your squad locks, and when results are in. Add the app
          to your home screen to open it in one tap.
        </p>
      </Step>

      <p className={styles.small}>Free to play. No entry fees and no prizes. You must be 18 or over.</p>
      <p className={styles.small}>{INDEPENDENCE_NOTICE}</p>

      <Suspense
        fallback={
          <Link href="/squad" className={styles.cta}>
            Pick my squad
          </Link>
        }
      >
        <NextStep />
      </Suspense>
    </main>
  );
}
