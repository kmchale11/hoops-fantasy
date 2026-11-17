import type { Db } from "@/lib/db";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const ACTIVE_INTERVAL_MS = 15 * MINUTE_MS;
export const QUIET_INTERVAL_MS = 6 * HOUR_MS;
/** The scheduler fires every 15 minutes, so allow a little jitter either side. */
const TOLERANCE_MS = MINUTE_MS;

export interface ScheduleState {
  now: Date;
  lastRunStartedAt: Date | null;
  /** A fixture is live, finished in the last 48 hours, or due to have tipped off. */
  hasActiveFixture: boolean;
}

export interface ScheduleDecision {
  run: boolean;
  intervalMs: number;
  reason: string;
}

/** Decides whether this scheduler tick should run ingestion. Pure, so it's easy to test. */
export function decideIngestion({ now, lastRunStartedAt, hasActiveFixture }: ScheduleState): ScheduleDecision {
  const intervalMs = hasActiveFixture ? ACTIVE_INTERVAL_MS : QUIET_INTERVAL_MS;
  const mode = hasActiveFixture ? "game window" : "quiet period";

  if (!lastRunStartedAt) {
    return { run: true, intervalMs, reason: "No previous run" };
  }
  const elapsed = now.getTime() - lastRunStartedAt.getTime();
  if (elapsed >= intervalMs - TOLERANCE_MS) {
    return { run: true, intervalMs, reason: `${mode}: due` };
  }
  const minutesLeft = Math.ceil((intervalMs - elapsed) / MINUTE_MS);
  return { run: false, intervalMs, reason: `${mode}: next run in about ${minutesLeft} min` };
}

/** Reads what decideIngestion needs from the database. */
export async function loadScheduleState(db: Db, now: Date): Promise<ScheduleState> {
  const [last] = await db.query<{ started_at: Date }>(
    `select started_at from ingestion_runs order by started_at desc limit 1`,
  );

  // "Finished within 48 hours" is approximated as tipping off within the last 50.
  // Scheduled games due to tip off now also count, so we notice them going live quickly.
  const [active] = await db.query<{ active: boolean }>(
    `select exists (
       select 1 from fixtures
        where status = 'live'
           or (status = 'final' and tip_off >= $1::timestamptz - interval '50 hours')
           or (status = 'scheduled' and tip_off between $1::timestamptz - interval '3 hours'
                                               and $1::timestamptz + interval '15 minutes')
     ) as active`,
    [now],
  );

  return {
    now,
    lastRunStartedAt: last ? new Date(last.started_at) : null,
    hasActiveFixture: active.active,
  };
}
