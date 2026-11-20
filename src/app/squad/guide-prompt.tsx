"use client";

import Link from "next/link";
import { useState } from "react";
import { GUIDE_COOKIE } from "@/lib/guide-cookie";
import styles from "./squad.module.css";

/** Remembers on this device, for a year, that the visitor knows how to play. */
export function markGuideSeen() {
  document.cookie = `${GUIDE_COOKIE}=1; Max-Age=${365 * 24 * 3600}; Path=/; SameSite=Lax`;
}

/** "New here?" on the squad page, until How to play is opened or this is dismissed. */
export default function GuidePrompt() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <aside className={styles.guide} aria-label="New here?">
      <p>
        <strong>New here?</strong> Learn how squads, captains and scoring work.
      </p>
      <div className={styles.guideActions}>
        <Link href="/how-to-play" className={styles.guideLink}>
          How to play
        </Link>
        <button
          type="button"
          className={styles.guideDismiss}
          onClick={() => {
            markGuideSeen();
            setOpen(false);
          }}
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
