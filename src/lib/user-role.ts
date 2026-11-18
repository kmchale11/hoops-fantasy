import type { Db } from "./db";

/**
 * Runs fn in a transaction as a signed-in user, through Supabase's `authenticated` role, so
 * row-level security and function grants apply exactly as they would through Supabase's API.
 * Only call with a user ID the server has verified.
 */
export async function withUserRole<T>(db: Db, userId: string, fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("set local role authenticated");
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    return fn(tx);
  });
}
