import { adminRouteError } from "@/lib/guards";
import { getDb } from "@/lib/server-db";

/** Recent and upcoming fixtures, for the CSV import picker. */
export async function GET() {
  const denied = await adminRouteError();
  if (denied) return denied;

  const fixtures = await getDb().query(
    `select f.external_id as "externalId", f.tip_off as "tipOff", f.status,
            h.name as "home", a.name as "away",
            (select count(*)::int from player_game_stats s where s.fixture_id = f.id) as "statLines"
       from fixtures f
       join teams h on h.id = f.home_team_id
       join teams a on a.id = f.away_team_id
      where f.tip_off <= now() + interval '7 days'
      order by f.tip_off desc, f.external_id
      limit 100`,
  );
  return Response.json({ fixtures });
}
