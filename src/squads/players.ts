import type { Db } from "@/lib/db";
import { isAvailable, type SquadCandidate } from "./rules";

export interface PlayerListing extends SquadCandidate {
  externalId: string;
  teamShort: string | null;
  available: boolean;
  /** Fantasy points in the given round, or null if they didn't feature. */
  roundPoints: number | null;
}

/** Every player with their team, price and points in one round (pass null to skip points). */
export async function listPlayers(db: Db, pointsRoundId: number | null): Promise<PlayerListing[]> {
  const rows = await db.query<{
    id: number;
    externalId: string;
    name: string;
    teamId: number | null;
    teamName: string | null;
    teamShort: string | null;
    price: string | null;
    roundPoints: string | null;
  }>(
    `select p.id::int as id, p.external_id as "externalId", p.full_name as name,
            t.id::int as "teamId", t.name as "teamName", t.short_name as "teamShort",
            pp.price, rp.points as "roundPoints"
       from players p
       left join teams t on t.id = p.current_team_id
       left join player_prices pp on pp.player_id = p.id
       left join player_round_points rp on rp.player_id = p.id and rp.round_id = $1
      order by t.name nulls last, p.full_name`,
    [pointsRoundId],
  );
  return rows.map((r) => {
    const player = {
      ...r,
      price: r.price === null ? null : Number(r.price),
      roundPoints: r.roundPoints === null ? null : Number(r.roundPoints),
    };
    return { ...player, available: isAvailable(player) };
  });
}
