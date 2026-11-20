import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "@/lib/db";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");
const SUPABASE_SHIM = join(__dirname, "supabase-shim.sql");

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** A fresh in-memory Postgres with Supabase's auth basics and every migration applied. */
export async function createTestDb(): Promise<{ db: Db; pg: PGlite }> {
  const pg = new PGlite();
  await pg.exec(readFileSync(SUPABASE_SHIM, "utf8"));
  for (const file of migrationFiles()) {
    await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return { db: pgliteDb(pg), pg };
}

/**
 * A database with the migrations before `file` applied, for testing what `file` does to
 * existing data. Call applyRest() to run `file` and everything after it.
 */
export async function createTestDbBefore(file: string): Promise<{ db: Db; applyRest: () => Promise<void> }> {
  const pg = new PGlite();
  await pg.exec(readFileSync(SUPABASE_SHIM, "utf8"));
  const files = migrationFiles();
  if (!files.includes(file)) throw new Error(`No migration ${file}`);
  for (const f of files.filter((f) => f < file)) await pg.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  return {
    db: pgliteDb(pg),
    applyRest: async () => {
      for (const f of files.filter((f) => f >= file)) await pg.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
    },
  };
}

function pgliteDb(pg: PGlite): Db {
  const db: Db = {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await pg.query<T>(sql, params);
      return result.rows;
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return pg.transaction(async (t) => {
        const tx: Db = {
          async query<R>(sql: string, params: unknown[] = []) {
            const result = await t.query<R>(sql, params);
            return result.rows;
          },
          transaction: (inner) => inner(tx),
        };
        return fn(tx);
      });
    },
  };
  return db;
}

export async function count(db: Db, table: string): Promise<number> {
  const [row] = await db.query<{ n: number }>(`select count(*)::int as n from ${table}`);
  return row.n;
}

/** Adds a Supabase Auth user and returns their ID. */
export async function createAuthUser(db: Db, email: string): Promise<string> {
  const [user] = await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]);
  return user.id;
}

/**
 * Runs fn as a signed-in user through Supabase's API role, so row-level security applies.
 * Pass null for a signed-out visitor.
 */
export async function asUser<T>(pg: PGlite, userId: string | null, fn: (q: Db["query"]) => Promise<T>): Promise<T> {
  return pg.transaction(async (tx) => {
    await tx.exec(userId ? "set local role authenticated" : "set local role anon");
    if (userId) await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    return fn(async (sql, params) => (await tx.query(sql, params)).rows as never);
  });
}
