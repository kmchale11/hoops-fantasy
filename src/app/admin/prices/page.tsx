import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/guards";
import { getDb } from "@/lib/server-db";
import { listPlayers } from "@/squads/players";
import { PriceEditor, PriceImport } from "./price-forms";

export const metadata: Metadata = {
  title: "Player prices · Hoops Fantasy",
  robots: { index: false },
};

// Checks the admin role per request; non-admins get a 404.
export const instant = false;

export default async function PricesPage() {
  await requireAdminPage();
  const players = await listPlayers(getDb(), null);
  const unpriced = players.filter((p) => p.price === null).length;

  return (
    <main>
      <h1>Player prices</h1>
      <p className="muted">
        Set once before the season. Unpriced players can&apos;t be picked
        {unpriced > 0 ? ` (${unpriced} unpriced right now)` : ""}.
      </p>
      <PriceEditor
        players={players.map((p) => ({ id: p.id, name: p.name, team: p.teamName, price: p.price }))}
      />
      <h2>Import from a spreadsheet</h2>
      <PriceImport />
    </main>
  );
}
