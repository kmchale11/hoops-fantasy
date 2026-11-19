import { createFeedAdapter } from "@/ingestion/feed";
import { runIngestion } from "@/ingestion/ingest";
import { decideIngestion, loadScheduleState } from "@/ingestion/schedule";
import { hasBearerSecret, unauthorized } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { getDb } from "@/lib/server-db";
import { runNotificationPass, type PassResult } from "@/notifications/notify";
import { createPushSender } from "@/notifications/push";
import { lockRounds } from "@/squads/squads";

export const maxDuration = 60;

/**
 * Called every 15 minutes by the scheduler (see supabase/schedule-ingestion.sql).
 * Locks rounds whose deadline has passed (carrying squads forward) and sends any notifications
 * that are due, then runs ingestion only when it's due; add ?force=1 to run regardless.
 */
export async function POST(request: Request) {
  const config = loadConfig();
  if (!hasBearerSecret(request, config.cronSecret)) return unauthorized();

  const db = getDb();
  const now = new Date();
  const force = new URL(request.url).searchParams.get("force") === "1";

  // Every tick, whether or not ingestion is due: rounds lock at their first tip-off.
  const carriedForward = await lockRounds(db, now);
  // Also every tick: deadlines don't follow the data sync's schedule.
  const notifications = await sendNotifications(now);

  if (!force) {
    const decision = decideIngestion(await loadScheduleState(db, now));
    if (!decision.run) {
      return Response.json({ ran: false, reason: decision.reason, carriedForward, notifications });
    }
  }

  const result = await runIngestion(db, createFeedAdapter(config), {
    now,
    // The mock season has fixed dates, so take all of it rather than the weeks around today.
    windowDays: config.feedSource === "mock" ? 365 : 21,
  });
  return Response.json({ ran: true, carriedForward, notifications, ...result }, { status: result.status === "failed" ? 500 : 200 });
}

/** A notification failure is reported but never stops the data sync. */
async function sendNotifications(now: Date): Promise<PassResult | { error: string } | null> {
  const sender = createPushSender(loadConfig());
  if (!sender) return null;
  try {
    return await runNotificationPass(getDb(), sender, now);
  } catch (error) {
    console.error("Notification pass failed", error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
