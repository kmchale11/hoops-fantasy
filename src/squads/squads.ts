import type { Db } from "@/lib/db";
import { withUserRole } from "@/lib/user-role";

export interface RoundInfo {
  id: number;
  number: number;
  name: string;
  /** When the round locks: its first tip-off. */
  deadline: Date;
}

export interface SquadWindow {
  /** The round squads are being picked for; null when no round is scheduled. */
  open: RoundInfo | null;
  /** The round in progress, during which no changes are allowed. */
  locked: RoundInfo | null;
}

const ROUND_COLUMNS = `round_id::int as id, number, name, deadline`;

export async function getSquadWindow(db: Db, now: Date): Promise<SquadWindow> {
  const [w] = await db.query<{ open_round_id: string | null; locked_round_id: string | null }>(
    `select open_round_id, locked_round_id from squad_window($1)`,
    [now],
  );
  const ids = [w.open_round_id, w.locked_round_id].filter((id) => id !== null);
  const rounds = ids.length
    ? await db.query<RoundInfo>(`select ${ROUND_COLUMNS} from round_deadlines where round_id = any($1::bigint[])`, [
        ids,
      ])
    : [];
  const find = (id: string | null) => rounds.find((r) => id !== null && r.id === Number(id)) ?? null;
  return { open: find(w.open_round_id), locked: find(w.locked_round_id) };
}

/** Rounds that have locked, oldest first. */
export async function lockedRounds(db: Db, now: Date): Promise<RoundInfo[]> {
  return db.query<RoundInfo>(
    `select ${ROUND_COLUMNS} from round_deadlines where deadline <= $1 order by number`,
    [now],
  );
}

export interface SavedSquad {
  roundId: number;
  roundNumber: number;
  captainId: number;
  playerIds: number[];
  carriedForward: boolean;
}

/** The user's most recent squad, which the builder starts from. */
export async function getLatestSquad(db: Db, userId: string): Promise<SavedSquad | null> {
  const [squad] = await db.query<SavedSquad>(
    `select s.round_id::int as "roundId", r.number as "roundNumber", s.captain_player_id::int as "captainId",
            s.carried_forward as "carriedForward",
            array(select sp.player_id::int from squad_players sp where sp.squad_id = s.id order by sp.player_id)
              as "playerIds"
       from squads s join rounds r on r.id = s.round_id
      where s.user_id = $1
      order by r.number desc
      limit 1`,
    [userId],
  );
  return squad ?? null;
}

export type SaveSquadResult = { ok: true; squadId: number } | { ok: false; errors: string[] };

/**
 * Saves a squad for the open round through save_squad(), as the user, so the database checks
 * the rules and the deadline. Rule errors come back one per broken rule.
 */
export async function saveSquad(
  db: Db,
  userId: string,
  playerIds: number[],
  captainId: number | null,
): Promise<SaveSquadResult> {
  try {
    const [row] = await withUserRole(db, userId, (tx) =>
      tx.query<{ id: string }>(`select save_squad($1::bigint[], $2) as id`, [playerIds, captainId]),
    );
    return { ok: true, squadId: Number(row.id) };
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    if (code === "HF001") return { ok: false, errors: (message ?? "").split("\n") };
    if (code === "HF002" || code === "HF003") return { ok: false, errors: [message ?? ""] };
    throw error;
  }
}

/** Recalculates every user's round scores from the latest fantasy points. */
export async function refreshUserScores(db: Db): Promise<void> {
  await db.query(`select refresh_user_round_scores()`);
}

/**
 * Run on every scheduler tick: gives users who made no changes their previous squad for any
 * round that has locked, then refreshes scores. Returns how many squads were carried forward.
 */
export async function lockRounds(db: Db, now: Date): Promise<number> {
  const [row] = await db.query<{ n: number }>(`select carry_forward_squads($1) as n`, [now]);
  await refreshUserScores(db);
  return row.n;
}

export interface RoundResult {
  round: RoundInfo;
  points: number;
  players: { id: number; name: string; points: number; captain: boolean }[];
}

/**
 * A user's score for every locked round, oldest first. Rounds before their first squad score
 * 0, so joining late gives no advantage. The season total is the sum of these.
 */
export async function getSeasonResults(db: Db, userId: string, now: Date): Promise<RoundResult[]> {
  const rounds = await lockedRounds(db, now);
  const scores = await db.query<{ round_id: number; points: string }>(
    `select round_id::int as round_id, points from user_round_scores where user_id = $1`,
    [userId],
  );
  const players = await db.query<{ round_id: number; id: number; name: string; points: string; captain: boolean }>(
    `select s.round_id::int as round_id, p.id::int as id, p.full_name as name,
            coalesce(rp.points, 0) as points, p.id = s.captain_player_id as captain
       from squads s
       join squad_players sp on sp.squad_id = s.id
       join players p on p.id = sp.player_id
       left join player_round_points rp on rp.player_id = sp.player_id and rp.round_id = s.round_id
      where s.user_id = $1
      order by p.id = s.captain_player_id desc, coalesce(rp.points, 0) desc, p.full_name`,
    [userId],
  );
  return rounds.map((round) => ({
    round,
    points: Number(scores.find((s) => s.round_id === round.id)?.points ?? 0),
    players: players
      .filter((p) => p.round_id === round.id)
      .map(({ id, name, points, captain }) => ({ id, name, points: Number(points), captain })),
  }));
}
