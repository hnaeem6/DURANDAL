import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export * from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _dbPath: string | null = null;

export function createDb(dbPath: string) {
  if (_db && _dbPath === dbPath) return _db;
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  _db = drizzle(sqlite, { schema });
  _dbPath = dbPath;
  return _db;
}

export type DurandalDb = ReturnType<typeof createDb>;
