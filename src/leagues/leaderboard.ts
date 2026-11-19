import type { Db } from "@/lib/db";

export const LEADERBOARD_PAGE_SIZE = 50;

export interface LeaderboardRow {
  rank: number;
  userId: string;
  teamName: string;
  managerName: string;
  seasonTotal: number;
}

/**
 * Every user who has saved a squad, by season total, highest first. Ties share a rank and the
 * next rank skips (1, 2, 2, 4). Equal totals are listed by team name.
 */
const RANKED = `
  with totals as (
    select s.user_id, coalesce(sum(u.points), 0) as total
      from (select distinct user_id from squads) s
      left join user_round_scores u on u.user_id = s.user_id
     group by s.user_id
  )
  select rank() over (order by t.total desc)::int as rank,
         row_number() over (order by t.total desc, lower(p.team_name), p.user_id)::int as position,
         t.user_id, p.team_name, p.manager_name, t.total
    from totals t join profiles p on p.user_id = t.user_id`;

type RankedRow = {
  rank: number;
  position: number;
  user_id: string;
  team_name: string;
  manager_name: string;
  total: string;
};

const toRow = (r: RankedRow): LeaderboardRow => ({
  rank: r.rank,
  userId: r.user_id,
  teamName: r.team_name,
  managerName: r.manager_name,
  seasonTotal: Number(r.total),
});

export interface LeaderboardPage {
  rows: LeaderboardRow[];
  /** 1-based. */
  page: number;
  pages: number;
  users: number;
}

export async function getLeaderboard(db: Db, page: number, pageSize = LEADERBOARD_PAGE_SIZE): Promise<LeaderboardPage> {
  const [{ users }] = await db.query<{ users: number }>(`select count(distinct user_id)::int as users from squads`);
  const pages = Math.max(1, Math.ceil(users / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const rows = await db.query<RankedRow>(
    `select * from (${RANKED}) ranked where position > $1 and position <= $2 order by position`,
    [(current - 1) * pageSize, current * pageSize],
  );
  return { rows: rows.map(toRow), page: current, pages, users };
}

/** Where the user sits, and which page that's on; null if they haven't saved a squad. */
export async function getLeaderboardPosition(
  db: Db,
  userId: string,
  pageSize = LEADERBOARD_PAGE_SIZE,
): Promise<(LeaderboardRow & { page: number }) | null> {
  const [row] = await db.query<RankedRow>(`select * from (${RANKED}) ranked where user_id = $1`, [userId]);
  return row ? { ...toRow(row), page: Math.ceil(row.position / pageSize) } : null;
}
