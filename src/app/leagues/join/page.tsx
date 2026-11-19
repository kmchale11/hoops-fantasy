import type { Metadata } from "next";
import Link from "next/link";
import { requireCompleteAccount } from "@/lib/guards";
import { JoinLeagueForm } from "../league-forms";

export const metadata: Metadata = { title: "Join a league · Hoops Fantasy" };

export const instant = false;

/** Where invite links land, with the code filled in. Signing in first keeps the code. */
export default async function JoinPage({ searchParams }: PageProps<"/leagues/join">) {
  const { code } = await searchParams;
  const prefill = typeof code === "string" ? code.slice(0, 12) : "";
  await requireCompleteAccount(prefill ? `/leagues/join?code=${encodeURIComponent(prefill)}` : "/leagues/join");

  return (
    <main>
      <p className="muted">
        <Link href="/leagues">Your leagues</Link>
      </p>
      <h1>Join a league</h1>
      <JoinLeagueForm code={prefill} />
    </main>
  );
}
