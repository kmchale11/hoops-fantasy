import type { Db } from "@/lib/db";
import type { PushMessage, PushSender, PushTarget } from "./sender";

export type NotificationKind = "deadline_24h" | "deadline_1h" | "results";

/** One notification for one device. lockAt is the round's deadline when it was chosen. */
export interface DueNotification {
  subscriptionId: number;
  target: PushTarget;
  kind: NotificationKind;
  roundId: number;
  roundName: string;
  lockAt: Date;
  /** The user's round score, for results. */
  points: number | null;
}

/**
 * How long before the scheduler's mark a notification may go out. Ticks are every 15 minutes,
 * so each reminder goes on the first tick in the 15 minutes up to its mark: up to 15 minutes
 * early, never late. A tick that misses the window (the scheduler was down) sends nothing.
 */
export const TICK_MINUTES = 15;

const TARGET_COLUMNS = `s.id::int as subscription_id, s.kind as target_kind, s.endpoint, s.web_keys`;

type Row = {
  subscription_id: number;
  target_kind: "web" | "fcm";
  endpoint: string;
  web_keys: { p256dh: string; auth: string } | null;
  kind: NotificationKind;
  round_id: number;
  round_name: string;
  lock_at: Date;
  points: string | null;
};

const toDue = (r: Row): DueNotification => ({
  subscriptionId: r.subscription_id,
  target: { kind: r.target_kind, endpoint: r.endpoint, webKeys: r.web_keys },
  kind: r.kind,
  roundId: r.round_id,
  roundName: r.round_name,
  lockAt: new Date(r.lock_at),
  points: r.points === null ? null : Number(r.points),
});

const NOT_SENT = `not exists (
  select 1 from notifications_sent n
   where n.subscription_id = s.id and n.kind = d.kind and n.round_id = d.round_id and n.lock_at = d.lock_at)`;

/**
 * Reminders 24 hours and 1 hour before each upcoming round locks, for users with deadline
 * reminders on. Keyed on the current deadline, so if the first game moves, reminders for
 * the new time are due and the old time's can no longer match.
 */
export async function dueDeadlineReminders(db: Db, now: Date): Promise<DueNotification[]> {
  const rows = await db.query<Row>(
    `with d as (
       select r.round_id, r.name as round_name, r.deadline as lock_at, k.kind
         from round_deadlines r
        cross join (values ('deadline_24h', interval '24 hours'), ('deadline_1h', interval '1 hour')) k (kind, before)
        where r.deadline > $1
          and $1 >= r.deadline - k.before - make_interval(mins => $2)
          and $1 <= r.deadline - k.before
     )
     select ${TARGET_COLUMNS}, d.kind, d.round_id::int as round_id, d.round_name, d.lock_at, null as points
       from d
       join notification_preferences p on p.enabled_at is not null and p.deadline_reminders
       join push_subscriptions s on s.user_id = p.user_id
      where ${NOT_SENT}
      order by s.id`,
    [now, TICK_MINUTES],
  );
  return rows.map(toDue);
}

/**
 * Results for the latest round whose games are all over (postponed games don't hold it up),
 * for users with round results on who had a squad in it. Users who turned notifications on
 * after the round's window closed aren't sent an old result.
 */
export async function dueRoundResults(db: Db, now: Date): Promise<DueNotification[]> {
  const rows = await db.query<Row>(
    `with d as (
       select round_id, name as round_name, deadline as lock_at, ends_at, 'results' as kind
         from round_deadlines
        where games_finished and deadline <= $1
        order by number desc limit 1
     )
     select ${TARGET_COLUMNS}, d.kind, d.round_id::int as round_id, d.round_name, d.lock_at, u.points
       from d
       join user_round_scores u on u.round_id = d.round_id
       join notification_preferences p
         on p.user_id = u.user_id and p.enabled_at is not null and p.round_results and p.enabled_at <= d.ends_at
       join push_subscriptions s on s.user_id = u.user_id
      where ${NOT_SENT}
      order by s.id`,
    [now],
  );
  return rows.map(toDue);
}

const dublin = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Dublin", ...options });
const clock = dublin({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const day = dublin({ weekday: "short", day: "numeric", month: "short" });
const hour = dublin({ hour: "numeric", hourCycle: "h23" });

/** Results aren't sent from 22:00 to 08:00 Irish time; they wait for the first tick from 08:00. */
export function inQuietHours(now: Date): boolean {
  const h = Number(hour.format(now));
  return h >= 22 || h < 8;
}

export function messageFor(n: DueNotification): PushMessage {
  if (n.kind === "results") {
    return {
      title: `${n.roundName} results`,
      body: `You scored ${(n.points ?? 0).toFixed(1)} points. See how your players did.`,
      url: "/results",
      tag: `results-${n.roundId}`,
    };
  }
  const time = clock.format(n.lockAt);
  return {
    title: `${n.roundName} locks at ${time}`,
    body:
      n.kind === "deadline_24h"
        ? `That's ${day.format(n.lockAt)}. Check your squad and captain before then.`
        : "That's in an hour. Last chance to change your squad.",
    url: "/squad",
    tag: `deadline-${n.roundId}`,
  };
}

export interface PassResult {
  sent: number;
  failed: number;
  removed: number;
}

/**
 * Sends everything due. Each notification is recorded before it's sent, so if the job runs
 * twice (or overlaps itself) the second run finds the record and skips it. A failed send
 * removes its record so the next tick tries again; a device the service no longer knows is
 * removed altogether.
 */
export async function runNotificationPass(db: Db, sender: PushSender, now: Date): Promise<PassResult> {
  const due = [...(await dueDeadlineReminders(db, now)), ...(inQuietHours(now) ? [] : await dueRoundResults(db, now))];
  const result: PassResult = { sent: 0, failed: 0, removed: 0 };

  for (const n of due) {
    const key = [n.subscriptionId, n.kind, n.roundId, n.lockAt];
    const claimed = await db.query(
      `insert into notifications_sent (subscription_id, kind, round_id, lock_at, sent_at)
       values ($1, $2, $3, $4, $5) on conflict do nothing returning 1`,
      [...key, now],
    );
    if (claimed.length === 0) continue;

    const outcome = await sender.send(n.target, messageFor(n));
    if (outcome === "sent") {
      result.sent++;
    } else if (outcome === "unregistered") {
      await db.query(`delete from push_subscriptions where id = $1`, [n.subscriptionId]);
      result.removed++;
    } else {
      await db.query(
        `delete from notifications_sent where subscription_id = $1 and kind = $2 and round_id = $3 and lock_at = $4`,
        key,
      );
      result.failed++;
    }
  }
  return result;
}
