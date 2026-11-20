import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import styles from "./how-to-play.module.css";

/** How to play's last button. Signed in: straight to the squad. Otherwise: sign in first. */
export default async function NextStep() {
  const user = await getSessionUser();
  return user ? (
    <Link href="/squad" className={styles.cta}>
      Pick my squad
    </Link>
  ) : (
    <Link href="/sign-in?next=%2Fsquad" className={styles.cta}>
      Sign in to play
    </Link>
  );
}
