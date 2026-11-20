import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/guards";
import { getDb } from "@/lib/server-db";
import { listPlayers } from "@/squads/players";
import { PriceEditor, PriceImport } from "./price-forms";

export const metadata: Metadata = {
  title: "Player prices and positions",
  robots: { index: false },
};

// Checks the admin role per request; non-admins get a 404.
export const instant = false;

export default async function PricesPage() {
  await requireAdminPage();
  const players = await listPlayers(getDb(), null);
  const unpriced = players.filter((p) => p.price === null).length;
  const unpositioned = players.filter((p) => p.position === null).length;

  return (
    <main>
      <h1>Player prices and positions</h1>
      <p className="muted">
        Set once before the season. Unpriced players can&apos;t be picked
        {unpriced > 0 ? ` (${unpriced} unpriced right now)` : ""}.
      </p>
      {unpositioned > 0 && (
        <p role="status">
          {unpositioned === 1 ? "1 player needs" : `${unpositioned} players need`} a position. Until then they can only
          be picked for the flex slot.
        </p>
      )}
      <PriceEditor
        players={players.map((p) => ({
          id: p.id,
          name: p.name,
          team: p.teamName,
          price: p.price,
          position: p.position,
        }))}
      />
      <h2>Import from a spreadsheet</h2>
      <PriceImport />
    </main>
  );
}
