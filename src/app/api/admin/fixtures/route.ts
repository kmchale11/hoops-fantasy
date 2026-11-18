import { hasBearerSecret, unauthorized } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { getDb } from "@/lib/server-db";

/** Recent and upcoming fixtures, for the CSV import picker. */
export async function GET(request: Request) {
  // Temporary: replaced by the is_admin role in add-user-accounts.
  if (!hasBearerSecret(request, loadConfig().adminToken)) return unauthorized();

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
