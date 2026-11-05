/**
 * Browser-only session persistence for the Node 127.0.0.1 editor.
 *
 * On disk: SHA-256 hashes of unguessable cookie IDs and their expiries.
 * Never store the cookie, the ephemeral MCP Bearer token, Platform API keys,
 * user graphs, or session values in the Git repository.
 *
 * A malformed session file fails closed instead of silently logging the owner
 * back in. The existing local SQLite database is never accessed here.
 */
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {
  existsSync, lstatSync, mkdirSync, readFileSync, renameSync,
  unlinkSync, writeFileSync
} from 'node:fs';
import {dirname, isAbsolute} from 'node:path';

export const PERSISTENT_BROWSER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MEMORY_SESSION_MS = 8 * 60 * 60 * 1000;
const MAX_SESSIONS = 10;
const COOKIE_ID = /^[A-Za-z0-9_-]{43}$/;
const HASH = /^[a-f0-9]{64}$/;

const fingerprint = value => createHash('sha256').update(value).digest('hex');

export function createGraphiteBrowserSessionStore({
  filePath = null,
  ttlMs = filePath ? PERSISTENT_BROWSER_SESSION_MS : MEMORY_SESSION_MS,
  clock = Date.now
} = {}) {
  if (filePath !== null && (typeof filePath !== 'string' || !isAbsolute(filePath))) {
    throw new TypeError('Absolute browser-session file path required');
  }
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > PERSISTENT_BROWSER_SESSION_MS ||
      typeof clock !== 'function') {
    throw new TypeError('Invalid browser session lifetime');
  }
  let sessions = new Map();
  if (filePath && existsSync(filePath)) {
    const stat = lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) {
      throw new Error('Local browser-session file not recognized');
    }
    // Restrict persisted credentials to the owning user on POSIX; Windows
    // inherits the per-user ACL of %USERPROFILE%\.graphite-local.
    if (process.platform !== 'win32' && (stat.mode & 0o077)) {
      throw new Error('Local browser-session file permissions are too broad');
    }
    let value;
    try { value = JSON.parse(readFileSync(filePath, 'utf8')); }
    catch { throw new Error('Local browser-session file invalid'); }
    if (!value || value.version !== 1 || !Array.isArray(value.sessions) ||
      value.sessions.length > MAX_SESSIONS) {
      throw new Error('Local browser-session file invalid');
    }
    for (const entry of value.sessions) {
      if (!entry || typeof entry.hash !== 'string' || !HASH.test(entry.hash) ||
        !Number.isSafeInteger(entry.expires) || entry.expires < 0 ||
        sessions.has(entry.hash)) {
        throw new Error('Local browser-session file invalid');
      }
      // Expired records are not reactivated even after a process restart.
      if (entry.expires > clock()) sessions.set(entry.hash, entry.expires);
    }
  }

  function persist(next) {
    if (!filePath) return;
    mkdirSync(dirname(filePath), {recursive: true, mode: 0o700});
    const tmp = filePath + '.' + randomUUID() + '.tmp';
    try {
      writeFileSync(tmp, JSON.stringify({
        version: 1,
        sessions: [...next].map(([hash, expires]) => ({hash, expires}))
      }) + '\n', {encoding: 'utf8', mode: 0o600, flag: 'wx'});
      renameSync(tmp, filePath);
    } catch {
      try { unlinkSync(tmp); } catch { /* may not exist */ }
      throw new Error('Unable to persist local browser sessions');
    }
  }
  function publish(next) {
    // Commit to memory only after durable persistence succeeds.
    persist(next);
    sessions = next;
  }
  function live() {
    const current = clock();
    return new Map([...sessions].filter(([, expires]) => expires > current));
  }
  return {
    maxAgeSeconds: Math.ceil(ttlMs / 1000),
    issue() {
      const id = randomBytes(32).toString('base64url');
      const next = live();
      next.set(fingerprint(id), clock() + ttlMs);
      while (next.size > MAX_SESSIONS) next.delete(next.keys().next().value);
      publish(next);
      return id;
    },
    isValid(id) {
      if (typeof id !== 'string' || !COOKIE_ID.test(id)) return false;
      const expiry = sessions.get(fingerprint(id));
      return expiry !== undefined && expiry > clock();
    },
    revoke(id) {
      if (typeof id !== 'string' || !COOKIE_ID.test(id)) return;
      const next = live();
      if (!next.delete(fingerprint(id))) return;
      publish(next);
    }
  };
}
