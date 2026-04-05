import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb } from "./index.js";

const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") ?? "durandal.db";

const db = createDb(DB_PATH);
migrate(db, { migrationsFolder: "./drizzle" });

console.log("Migrations complete.");
