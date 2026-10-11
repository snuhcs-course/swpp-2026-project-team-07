import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

let database: SQLiteDatabase | undefined;
function db() {
  if (!database) {
    const opened = openDatabaseSync("outloud.db");
    try {
      opened.execSync("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)");
      database = opened;
    } catch (error) {
      try { opened.closeSync(); } catch { /* Preserve the initialization error. */ }
      throw error;
    }
  }
  return database;
}
export function readStored<T>(key: string): T | null {
  const row = db().getFirstSync<{ value: string }>("SELECT value FROM records WHERE key = ?", key);
  return row ? JSON.parse(row.value) as T : null;
}
export function writeStored(key: string, value: unknown) {
  db().runSync("INSERT INTO records (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, JSON.stringify(value));
}
export function removeStored(key: string) { db().runSync("DELETE FROM records WHERE key = ?", key); }
export function listStored<T>(prefix: string): T[] {
  return db().getAllSync<{ value: string }>("SELECT value FROM records WHERE key LIKE ? ORDER BY key DESC", `${prefix}%`)
    .map(row => JSON.parse(row.value) as T);
}
