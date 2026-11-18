/**
 * Minimal database interface used by ingestion. Production uses node-postgres
 * against Supabase; tests use PGlite (in-process Postgres) with the same SQL.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs fn inside a transaction; commits if it resolves, rolls back if it throws. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

interface PgQueryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

interface PgPoolLike extends PgQueryable {
  connect(): Promise<PgQueryable & { release(): void }>;
}

/** Wraps a node-postgres Pool. */
export function pgDb(pool: PgPoolLike): Db {
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await pool.query(sql, params);
      return result.rows as T[];
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      const client = await pool.connect();
      const tx: Db = {
        async query<R>(sql: string, params: unknown[] = []) {
          const result = await client.query(sql, params);
          return result.rows as R[];
        },
        transaction: (inner) => inner(tx),
      };
      try {
        await client.query("begin");
        const value = await fn(tx);
        await client.query("commit");
        return value;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
