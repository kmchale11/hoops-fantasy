import Link from "next/link";
import { APP_NAME, INDEPENDENCE_NOTICE } from "@/lib/app-identity";
import { BUDGET, SQUAD_SIZE } from "@/squads/rules";
import styles from "./home.module.css";

export default function Home() {
  return (
    <main className={styles.home}>
      <p className="eyebrow">Free to play · Super League</p>
      <h1>{APP_NAME}</h1>
      <p className={styles.lead}>
        Pick {SQUAD_SIZE} players for {BUDGET} credits before each round, captain one to double their points, then
        compete with everyone and in private leagues with your club, workplace or friends.
      </p>
      <div className={styles.actions}>
        <Link href="/squad" className={styles.primary}>
          Pick your squad
        </Link>
        <Link href="/how-to-play" className={styles.secondary}>
          How to play
        </Link>
      </div>
      <footer className={styles.footer}>
        <p>{INDEPENDENCE_NOTICE}</p>
        <p>
          Free to play · no prizes · 18+ · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </p>
      </footer>
    </main>
  );
}
