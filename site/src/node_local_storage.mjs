/**
 * Local-only Node.js SQLite database bootstrap for Graphite.
 *
 * The default CLI path is outside the checkout and distinct from Wrangler D1.
 * Only a fresh empty database is initialized. An existing unknown/partial
 * database is rejected rather than modified or migrated implicitly.
 */
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const tables = new Set(['plot_projects', 'plot_revisions', 'cw_operation_receipts']);
const schemaFiles = [
  new URL('../drizzle/0001_initial.sql', import.meta.url),
  new URL('../drizzle/0002_cw_operation_receipts.sql', import.meta.url)
];

export function openGraphiteLocalStorage(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim() || filePath === ':memory:') {
    throw new TypeError('A dedicated local SQLite file path is required');
  }
  const path = resolve(filePath);
  mkdirSync(dirname(path), {recursive: true, mode: 0o700});
  const sqlite = new DatabaseSync(path);
  try {
    sqlite.exec('PRAGMA foreign_keys=ON');
    sqlite.exec('PRAGMA busy_timeout=5000');
    sqlite.exec('PRAGMA journal_mode=WAL');
    const names = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all().map(row => row.name);
    if (names.length === 0) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        for (const file of schemaFiles) sqlite.exec(readFileSync(file, 'utf8'));
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    } else if (names.length !== tables.size || names.some(name => !tables.has(name))) {
      throw new Error('Local SQLite schema not recognized; existing database left unchanged');
    }
    if (sqlite.prepare('PRAGMA foreign_key_check').all().length) {
      throw new Error('Existing SQLite database failed foreign key validation');
    }
    return sqlite;
  } catch (error) {
    sqlite.close();
    throw error;
  }
}
