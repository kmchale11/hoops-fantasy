import { createFeedAdapter } from "@/ingestion/feed";
import { runIngestion } from "@/ingestion/ingest";
import { decideIngestion, loadScheduleState } from "@/ingestion/schedule";
import { hasBearerSecret, unauthorized } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { getDb } from "@/lib/server-db";

export const maxDuration = 60;

/**
 * Called every 15 minutes by the scheduler (see supabase/schedule-ingestion.sql).
 * Runs ingestion only when it's due; add ?force=1 to run regardless.
 */
export async function POST(request: Request) {
  const config = loadConfig();
  if (!hasBearerSecret(request, config.cronSecret)) return unauthorized();

  const db = getDb();
  const now = new Date();
  const force = new URL(request.url).searchParams.get("force") === "1";

  if (!force) {
    const decision = decideIngestion(await loadScheduleState(db, now));
    if (!decision.run) {
      return Response.json({ ran: false, reason: decision.reason });
    }
  }

  const result = await runIngestion(db, createFeedAdapter(config), {
    now,
    // The mock season has fixed dates, so take all of it rather than the weeks around today.
    windowDays: config.feedSource === "mock" ? 365 : 21,
  });
  return Response.json({ ran: true, ...result }, { status: result.status === "failed" ? 500 : 200 });
}
