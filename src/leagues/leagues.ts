import type { Db } from "@/lib/db";
import { withUserRole } from "@/lib/user-role";

export const NAME_RULE = "League names must be 3–40 characters";

/** The same check the database makes, for instant feedback. */
export function leagueNameError(name: string): string | null {
  const length = [...name.trim()].length;
  return length >= 3 && length <= 40 ? null : NAME_RULE;
}

/** Errors the league functions raise for the user to read: see the leagues migration. */
const USER_ERRORS = new Set(["HF003", "HF010", "HF011", "HF012", "HF013"]);

/**
 * Messages the league page may show from its ?error= parameter. Anything else is ignored, so
 * a crafted link can't put its own words on the page.
 */
export const LEAGUE_PAGE_ERRORS = [
  "Only the league admin can do that",
  "To leave your own league, use Leave league",
  "You're not in that league",
  "That member couldn't be found",
  "Finish signing up before joining leagues",
];

export type LeagueResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Runs a league function as the user, turning the database's league errors into messages. */
async function asMember<T>(db: Db, userId: string, fn: (tx: Db) => Promise<T>): Promise<LeagueResult<{ value: T }>> {
  try {
    return { ok: true, value: await withUserRole(db, userId, fn) };
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    if (code && USER_ERRORS.has(code)) return { ok: false, error: message ?? "" };
    throw error;
  }
}

export async function createLeague(
  db: Db,
  userId: string,
  name: string,
): Promise<LeagueResult<{ leagueId: number; inviteCode: string }>> {
  const result = await asMember(db, userId, (tx) =>
    tx.query<{ id: number; invite_code: string }>(
      `select id::int as id, invite_code from create_league($1)`,
      [name],
    ),
  );
  if (!result.ok) return result;
  const [row] = result.value;
  return { ok: true, leagueId: row.id, inviteCode: row.invite_code };
}

export async function joinLeague(db: Db, userId: string, code: string): Promise<LeagueResult<{ leagueId: number }>> {
  const result = await asMember(db, userId, (tx) =>
    tx.query<{ id: number }>(`select join_league($1)::int as id`, [code]),
  );
  return result.ok ? { ok: true, leagueId: result.value[0].id } : result;
}

export async function leaveLeague(db: Db, userId: string, leagueId: number): Promise<LeagueResult<object>> {
  const result = await asMember(db, userId, (tx) => tx.query(`select leave_league($1)`, [leagueId]));
  return result.ok ? { ok: true } : result;
}

export async function removeMember(
  db: Db,
  adminId: string,
  leagueId: number,
  memberId: string,
): Promise<LeagueResult<object>> {
  const result = await asMember(db, adminId, (tx) =>
    tx.query(`select remove_league_member($1, $2)`, [leagueId, memberId]),
  );
  return result.ok ? { ok: true } : result;
}

export async function regenerateInviteCode(
  db: Db,
  adminId: string,
  leagueId: number,
): Promise<LeagueResult<{ inviteCode: string }>> {
  const result = await asMember(db, adminId, (tx) =>
    tx.query<{ code: string }>(`select regenerate_invite_code($1) as code`, [leagueId]),
  );
  return result.ok ? { ok: true, inviteCode: result.value[0].code } : result;
}

export interface LeagueSummary {
  id: number;
  name: string;
  members: number;
  isAdmin: boolean;
}

/** The leagues the user is in, read through row-level security. */
export async function myLeagues(db: Db, userId: string): Promise<LeagueSummary[]> {
  return withUserRole(db, userId, (tx) =>
    tx.query<LeagueSummary>(
      `select l.id::int as id, l.name, l.admin_user_id = auth.uid() as "isAdmin",
              (select count(*)::int from league_members m where m.league_id = l.id) as members
         from mini_leagues l
         join league_members me on me.league_id = l.id and me.user_id = auth.uid()
        order by lower(l.name), l.id`,
    ),
  );
}

export interface Standing {
  rank: number;
  userId: string;
  teamName: string;
  managerName: string;
  seasonTotal: number;
  roundPoints: number;
}

export interface LeagueView {
  id: number;
  name: string;
  inviteCode: string;
  isAdmin: boolean;
  /** The latest round whose games are all over; null before any round has finished. */
  round: { id: number; name: string } | null;
  standings: Standing[];
}

/** The most recent round that has locked and whose games are all over (or whose window has ended). */
export async function latestCompletedRound(db: Db, now: Date): Promise<{ id: number; name: string } | null> {
  const [round] = await db.query<{ id: number; name: string }>(
    `select round_id::int as id, name from round_deadlines
      where deadline <= $1 and (games_finished or ends_at <= $1)
      order by number desc limit 1`,
    [now],
  );
  return round ?? null;
}

/**
 * A league and its standings, read as the user. Null when the league doesn't exist or the user
 * isn't a member, which row-level security makes indistinguishable.
 */
export async function getLeague(db: Db, userId: string, leagueId: number, now: Date): Promise<LeagueView | null> {
  const round = await latestCompletedRound(db, now);
  return withUserRole(db, userId, async (tx) => {
    const [league] = await tx.query<{ id: number; name: string; inviteCode: string; isAdmin: boolean }>(
      `select id::int as id, name, invite_code as "inviteCode", admin_user_id = auth.uid() as "isAdmin"
         from mini_leagues where id = $1`,
      [leagueId],
    );
    if (!league) return null;
    const rows = await tx.query<{
      rank: number;
      user_id: string;
      team_name: string;
      manager_name: string;
      season_total: string;
      round_points: string;
    }>(`select rank::int as rank, user_id, team_name, manager_name, season_total, round_points
          from league_standings($1, $2)`, [leagueId, round?.id ?? null]);
    return {
      ...league,
      round,
      standings: rows.map((r) => ({
        rank: r.rank,
        userId: r.user_id,
        teamName: r.team_name,
        managerName: r.manager_name,
        seasonTotal: Number(r.season_total),
        roundPoints: Number(r.round_points),
      })),
    };
  });
}
