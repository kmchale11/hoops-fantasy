import { importFixtureCsv } from "@/ingestion/csv-import";
import { hasBearerSecret, unauthorized } from "@/lib/auth";
import { loadConfig } from "@/lib/config";
import { getDb } from "@/lib/server-db";

const MAX_CSV_BYTES = 200_000;

/** Body: { fixtureExternalId: string, csv: string } */
export async function POST(request: Request) {
  // Temporary: replaced by the is_admin role in add-user-accounts.
  if (!hasBearerSecret(request, loadConfig().adminToken)) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON with fixtureExternalId and csv" }, { status: 400 });
  }
  const { fixtureExternalId, csv } = (body ?? {}) as Record<string, unknown>;
  if (typeof fixtureExternalId !== "string" || typeof csv !== "string") {
    return Response.json({ error: "Send JSON with fixtureExternalId and csv" }, { status: 400 });
  }
  if (csv.length > MAX_CSV_BYTES) {
    return Response.json({ error: "That file is too big for one fixture" }, { status: 413 });
  }

  const result = await importFixtureCsv(getDb(), { fixtureExternalId, csv });
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
