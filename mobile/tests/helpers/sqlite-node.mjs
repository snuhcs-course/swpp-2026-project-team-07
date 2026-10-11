import { DatabaseSync } from 'node:sqlite';
// Native boundary fixture: real SQLite queries, injectable I/O failures.
export const sqliteFaults = { before: null, opened: 0, closed: 0 };
export function openDatabaseSync() {
  sqliteFaults.before?.('open');
  const db = new DatabaseSync(process.env.ONLOUD_TEST_DB || ':memory:');
  sqliteFaults.opened++;
  return {
    closeSync() { sqliteFaults.closed++; db.close(); },
    execSync(sql) { sqliteFaults.before?.('exec', sql); return db.exec(sql); },
    runSync(sql, ...args) { sqliteFaults.before?.('run', sql, args); return db.prepare(sql).run(...args); },
    getFirstSync(sql, ...args) { sqliteFaults.before?.('get', sql, args); return db.prepare(sql).get(...args); },
    getAllSync(sql, ...args) { sqliteFaults.before?.('all', sql, args); return db.prepare(sql).all(...args); },
  };
}
