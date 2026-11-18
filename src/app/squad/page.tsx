import type { Metadata } from "next";
import Link from "next/link";
import { requireCompleteAccount } from "@/lib/guards";

export const metadata: Metadata = { title: "Your squad · Hoops Fantasy" };

export const instant = false;

/**
 * Placeholder until add-squad-selection. The guard is the point: only users who are
 * signed in, 18+ and have accepted the terms get here.
 */
export default async function SquadPage() {
  const { profile } = await requireCompleteAccount("/squad");
  return (
    <main>
      <h1>{profile.teamName}</h1>
      <p>Squad selection opens soon. You&apos;ll pick 8 players and a captain each round.</p>
      <p>
        <Link href="/account">Your account</Link>
      </p>
    </main>
  );
}
