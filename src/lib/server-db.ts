import "server-only";
import { Pool } from "pg";
import { loadConfig } from "./config";
import { pgDb, type Db } from "./db";

let db: Db | undefined;

/** One shared connection pool per server instance. */
export function getDb(): Db {
  if (db) return db;
  const { databaseUrl } = loadConfig();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. See .env.example.");
  }
  db = pgDb(new Pool({ connectionString: databaseUrl, max: 3 }));
  return db;
}
