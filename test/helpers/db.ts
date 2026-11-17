import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "@/lib/db";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** A fresh in-memory Postgres with every migration applied. */
export async function createTestDb(): Promise<{ db: Db; pg: PGlite }> {
  const pg = new PGlite();
  for (const file of migrationFiles()) {
    await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return { db: pgliteDb(pg), pg };
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
