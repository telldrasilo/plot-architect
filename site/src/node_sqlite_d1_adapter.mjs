/**
 * D1-shaped adapter for an independently managed Node.js SQLite connection.
 * Not imported by Sites Worker, MCP or deployed routes. This module does not
 * open databases, apply migrations, authenticate callers, or start a server.
 *
 * A single synchronous SQLite connection is required because Graphite's
 * operation receipts depend on the previous statement's changes() result.
 * The caller owns connection lifecycle and must configure its local database.
 */
const validValue = value => {
  if (value === null || typeof value === 'string' || typeof value === 'bigint') return value;
  if (typeof value === 'boolean') return Number(value);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Uint8Array) return value;
  throw new TypeError('Unsupported SQLite bind value');
};

const plain = row => row == null ? null : {...row};

class LocalD1Statement {
  #adapter;
  #sqlite;
  #sql;
  #values;
  constructor(adapter, sqlite, sql, values = []) {
    this.#adapter = adapter;
    this.#sqlite = sqlite;
    this.#sql = sql;
    this.#values = values;
  }
  belongsTo(adapter) { return this.#adapter === adapter; }
  bind(...values) {
    return new LocalD1Statement(this.#adapter, this.#sqlite, this.#sql, values.map(validValue));
  }
  #prepared() {
    return this.#sqlite.prepare(this.#sql);
  }
  first(column) {
    const row = plain(this.#prepared().get(...this.#values));
    if (column === undefined) return row;
    if (row === null) return null;
    if (!Object.hasOwn(row, column)) throw new Error('D1 first(): unknown column');
    return row[column];
  }
  all() {
    return {
      results: this.#prepared().all(...this.#values).map(plain),
      success: true,
      meta: {changes: 0}
    };
  }
  run() {
    const result = this.#prepared().run(...this.#values);
    return {
      success: true,
      meta: {changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid)}
    };
  }
}

export function createNodeSqliteD1Adapter(sqlite) {
  if (!sqlite || typeof sqlite.prepare !== 'function' || typeof sqlite.exec !== 'function') {
    throw new TypeError('Expected an open Node.js SQLite connection');
  }
  const adapter = {
    prepare(sql) {
      if (typeof sql !== 'string' || !sql.trim()) throw new TypeError('SQL statement required');
      return new LocalD1Statement(adapter, sqlite, sql);
    },
    batch(statements) {
      if (!Array.isArray(statements) || !statements.length ||
        statements.some(s => !(s instanceof LocalD1Statement) || !s.belongsTo(adapter))) {
        throw new TypeError('D1 batch requires statements prepared by this adapter');
      }
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        // Synchronous, same-connection execution preserves SQLite changes().
        const results = statements.map(s => s.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  };
  return adapter;
}
