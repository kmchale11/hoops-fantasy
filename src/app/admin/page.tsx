import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/guards";
import styles from "@/app/more/more.module.css";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

// Checks the admin role per request; non-admins get a 404.
export const instant = false;

export default async function AdminPage() {
  await requireAdminPage();
  return (
    <main className={styles.page}>
      <h1>Admin</h1>
      <ul className={styles.list}>
        <li>
          <Link href="/admin/prices" className={styles.row}>
            <span>Player prices and positions</span>
            <span className={styles.hint}>Set prices before the season, and positions for squad slots</span>
          </Link>
        </li>
        <li>
          <Link href="/admin/import" className={styles.row}>
            <span>Import a box score</span>
            <span className={styles.hint}>Upload a game&apos;s stats by hand if the feed is down</span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
