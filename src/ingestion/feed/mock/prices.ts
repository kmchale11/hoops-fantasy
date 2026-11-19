import { scoreStatLine } from "@/scoring/score";
import { buildMockSeason } from "./season";

export interface MockPrice {
  playerExternalId: string;
  playerName: string;
  teamName: string;
  price: number;
}

/** Credits per average fantasy point, so a 50-point player costs the 15.0 maximum. */
const CREDITS_PER_POINT = 0.22;

/**
 * Starting prices for every mock player, from their average fantasy points in rounds 1–2
 * (the games played by stage 1), on a straight line from 4.0 and rounded to the nearest 0.5.
 * Players who haven't played cost 4.0. A budget of 100 then buys a squad of eight players
 * averaging about 38 points a game, so a team of the very best players doesn't fit.
 */
export function mockPrices(): MockPrice[] {
  const season = buildMockSeason(1);
  const points = new Map<string, number[]>();
  for (const boxScore of season.boxScores.values()) {
    for (const line of boxScore.lines) {
      points.set(line.playerExternalId, [...(points.get(line.playerExternalId) ?? []), scoreStatLine(line)]);
    }
  }

  return season.teams.flatMap((team) =>
    season.rosters.get(team.externalId)!.map((player) => {
      const games = points.get(player.externalId) ?? [];
      const average = games.length ? games.reduce((sum, p) => sum + p, 0) / games.length : 0;
      const price = Math.min(15, Math.max(4, Math.round((4 + average * CREDITS_PER_POINT) * 2) / 2));
      return { playerExternalId: player.externalId, playerName: player.fullName, teamName: team.name, price };
    }),
  );
}

/** The prices as a CSV that /admin/prices can import. */
export function mockPriceCsv(): string {
  const quote = (s: string) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = mockPrices().map((p) =>
    [p.playerExternalId, quote(p.playerName), quote(p.teamName), p.price.toFixed(1)].join(","),
  );
  return ["player_external_id,player_name,team,price", ...rows].join("\n") + "\n";
}
