"use client";

import { useOffline } from "next/offline";
import styles from "./pwa.module.css";

/** Shown while the connection is down. Next keeps taps and saves pending and retries them. */
export default function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div role="status" className={styles.offline}>
      You&apos;re offline. We&apos;ll carry on when your connection is back.
    </div>
  );
}
