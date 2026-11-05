/**
 * Graphite development-only HTTP transport for independent Node.js + SQLite.
 *
 * SECURITY BOUNDARY:
 * - binds ONLY to 127.0.0.1 and rejects unexpected Host headers;
 * - never trusts caller-supplied Sites identity; injects an identity only
 *   AFTER verifying the local browser session or bearer token;
 * - MCP requires Authorization: Bearer header (browser cookies forbidden);
 * - cookie-authenticated writes require an exact same-origin Origin;
 * - no OAuth, TLS, public tunnel or reverse-proxy support: NOT for deployment.
 *
 * Existing Worker REST/MCP logic and business validations are unchanged.
 */
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import worker from './worker.mjs';
import {createNodeSqliteD1Adapter} from './node_sqlite_d1_adapter.mjs';
import {createGraphiteBrowserSessionStore} from './node_local_browser_sessions.mjs';

const COOKIE = 'graphite_local_session';
const MAX_BODY = 2_300_000;
const MCP_MAX_BODY = 200_000;
const loginHtml = [
  '<!doctype html><html lang="ru"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>Graphite · локальный вход</title><style>',
  ':root{color-scheme:dark;font:16px system-ui}',
  'body{min-height:100vh;display:grid;place-items:center;margin:0;background:#181818;color:#efefed}',
  'main{box-sizing:border-box;width:min(420px,calc(100vw - 32px));padding:30px;background:#252525;border:1px solid #42413e;border-radius:16px}',
  'h1{font-size:22px;margin:0 0 18px}p{color:#bcbab5;font-size:13px;line-height:1.6}',
  'label{display:block;margin:18px 0 7px;font-size:13px}',
  'input{box-sizing:border-box;width:100%;padding:11px;background:#1e1e1e;border:1px solid #666;color:white;border-radius:8px}',
  'button{margin-top:18px;padding:11px 16px;border-radius:8px;border:1px solid #9b8965;background:#827254;color:white;cursor:pointer}',
  '</style></head><body><main><h1>Graphite · локальный вход</h1>',
  '<p>Только разработка на этом компьютере. Введи временный ключ из окна PowerShell, где запущен сервер. Не используй этот сервер в публичной сети.</p>',
  '<form action="/__local/login" method="post" autocomplete="off">',
  '<label for="key">Локальный ключ</label><input id="key" name="key" type="password" required autofocus>',
  '<button type="submit">Открыть редактор</button></form></main></body></html>'
].join('');

const noStore = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer'};
const safeMatch = (submitted, trusted) => {
  if (typeof submitted !== 'string' || typeof trusted !== 'string') return false;
  const a = Buffer.from(submitted), b = Buffer.from(trusted);
  return a.length === b.length && timingSafeEqual(a, b);
};
const readCookie = header => {
  const match = String(header || '').match(/(?:^|;\s*)graphite_local_session=([A-Za-z0-9_-]{20,128})(?:;|$)/);
  return match?.[1] || '';
};
const reply = (res, status, message, headers = {}) => {
  res.writeHead(status, {...noStore, 'Content-Type': 'text/plain; charset=utf-8', ...headers});
  res.end(message);
};
const deny = (res, status = 401) =>
  reply(res, status, status === 401 ? 'Local authorization required' : 'Forbidden',
    status === 401 ? {'WWW-Authenticate': 'Bearer realm="graphite-local"'} : {});
const readBody = async (req, maxBytes) => {
  const size = Number(req.headers['content-length']);
  if (Number.isFinite(size) && size > maxBytes) throw new RangeError('PAYLOAD_TOO_LARGE');
  const parts = [];
  let bytes = 0;
  for await (const part of req) {
    bytes += part.length;
    if (bytes > maxBytes) throw new RangeError('PAYLOAD_TOO_LARGE');
    parts.push(part);
  }
  return Buffer.concat(parts).toString('utf8');
};

export function createGraphiteLoopbackServer({database, editorHtml, token,
  workflowEnabled = false, browserSessions} = {}) {
  if (!database || typeof database.prepare !== 'function') throw new TypeError('SQLite DB required');
  if (typeof editorHtml !== 'string' || !editorHtml.includes('<!doctype html>')) {
    throw new TypeError('Canonical Graphite editor HTML required');
  }
  if (typeof token !== 'string' || token.length < 40) throw new TypeError('Strong local token required');
  const db = createNodeSqliteD1Adapter(database);
  const sessions = browserSessions ?? createGraphiteBrowserSessionStore();
  if (typeof sessions.issue !== 'function' ||
    typeof sessions.isValid !== 'function' ||
    typeof sessions.revoke !== 'function' ||
    !Number.isSafeInteger(sessions.maxAgeSeconds)) {
    throw new TypeError('Browser session store invalid');
  }
  let failedLogins = 0, failedWindow = Date.now();
  const server = createServer((req, res) => {
    void handle(req, res).catch(error => {
      if (!res.headersSent) reply(res, error instanceof RangeError ? 413 : 500, 'Local request failed');
      else res.end();
      // Never log request bodies, credentials, plots or bearer tokens.
      if (!(error instanceof RangeError)) console.error('Graphite local request error:', error?.name || 'Error');
    });
  });

  async function handle(req, res) {
    const address = server.address();
    if (!address || address.address !== '127.0.0.1') return deny(res, 403);
    const origin = 'http://127.0.0.1:' + address.port;
    if (req.headers.host !== '127.0.0.1:' + address.port ||
      !req.url?.startsWith('/') || req.url.startsWith('//') || req.url.includes('\\')) {
      return deny(res, 403);
    }
    const url = new URL(req.url, origin);
    const path = url.pathname;
    const method = req.method;
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7) : '';
    const tokenOk = safeMatch(bearer, token);
    const session = readCookie(req.headers.cookie);
    const cookieOk = !!session && sessions.isValid(session);
    const foreignOrigin = !!req.headers.origin && req.headers.origin !== origin;
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);

    if (path === '/__local/login' && method === 'GET') {
      // The default no-referrer policy makes browsers send Origin: null for
      // ordinary HTML form POSTs. Keep the exact-origin check on POST and
      // use same-origin only for this local login document (no cross-site Referer).
      return reply(res, 200, loginHtml, {'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'same-origin',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
    }
    if (path === '/__local/login' && method === 'POST') {
      if (req.headers.origin !== origin ||
        !String(req.headers['content-type'] || '').startsWith('application/x-www-form-urlencoded')) {
        return deny(res, 403);
      }
      if (Date.now() - failedWindow > 60_000) { failedWindow = Date.now(); failedLogins = 0; }
      if (failedLogins >= 10) return reply(res, 429, 'Too many local login attempts');
      const params = new URLSearchParams(await readBody(req, 8192));
      if (!safeMatch(params.get('key'), token)) {
        failedLogins++;
        return deny(res);
      }
      failedLogins = 0;
      const sid = sessions.issue();
      return reply(res, 303, '', {'Location': '/',
        'Set-Cookie': COOKIE + '=' + sid + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + sessions.maxAgeSeconds});
    }
    if (path === '/__local/logout' && method === 'POST') {
      if (!cookieOk || req.headers.origin !== origin) return deny(res, 403);
      sessions.revoke(session);
      return reply(res, 303, '', {'Location': '/__local/login',
        'Set-Cookie': COOKIE + '=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
    }
    if (path.startsWith('/__local/')) return reply(res, 404, 'Not found');

    // No browser cookie is ever sufficient for an MCP call.
    if (path === '/mcp' && !tokenOk) return deny(res);
    if (path !== '/mcp' && !cookieOk && !tokenOk) {
      if (path === '/' || path === '/index.html') return reply(res, 303, '', {Location: '/__local/login'});
      return deny(res);
    }
    // A browser session must provide an actual same-origin Origin for any
    // write. A local CLI bearer request without an Origin is allowed.
    if (foreignOrigin || (mutating && !tokenOk && req.headers.origin !== origin)) {
      return deny(res, 403);
    }
    if (path !== '/mcp' && path !== '/' && path !== '/index.html' && !path.startsWith('/api/')) {
      return reply(res, 404, 'Not found');
    }
    // The inherited Worker reports sites-native; the local gateway must
    // identify its actual auth/storage mode without modifying hosted code.
    if (path === '/api/health' && method === 'GET') {
      return reply(res, 200, JSON.stringify({
        ok: true, requiresAuthorization: true,
        version: 'graphite-node-local-dev', authMode: 'node-loopback',
        authenticated: true
      }), {'Content-Type': 'application/json; charset=utf-8'});
    }

    const headers = new Headers();
    const forbidden = new Set([
      'host', 'cookie', 'authorization', 'content-length', 'oai-authenticated-user-id',
      'forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'
    ]);
    for (const [name, value] of Object.entries(req.headers)) {
      if (!forbidden.has(name) && typeof value === 'string') headers.set(name, value);
    }
    // Only the loopback gateway can assert this identity, after auth above.
    headers.set('oai-authenticated-user-id', 'verified-node-local-owner');
    const raw = mutating ? await readBody(req, path === '/mcp' ? MCP_MAX_BODY : MAX_BODY) : undefined;
    const request = new Request(origin + req.url, {
      method, headers, ...(raw !== undefined ? {body: raw} : {})
    });
    const env = {DB: db, PLOT_HTML: editorHtml,
      ...(workflowEnabled ? {CW_WORKFLOW_ENABLED: 'true'} : {})};
    const response = await worker.fetch(request, env);
    const responseHeaders = {...noStore};
    for (const [name, value] of response.headers) {
      if (!['content-length', 'set-cookie'].includes(name.toLowerCase())) responseHeaders[name] = value;
    }
    res.writeHead(response.status, responseHeaders);
    res.end(Buffer.from(await response.arrayBuffer()));
  }

  return {
    async listen(port = 8788) {
      if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw new TypeError('Invalid port');
      await new Promise((resolve, reject) => {
        const onError = error => {server.off('listening', resolve); reject(error);};
        server.once('error', onError);
        server.listen(port, '127.0.0.1', () => {server.off('error', onError); resolve();});
      });
      return 'http://127.0.0.1:' + server.address().port;
    },
    async close() {
      if (server.listening) await new Promise((resolve, reject) =>
        server.close(error => error ? reject(error) : resolve()));
    },
    get listening() {return server.listening;},
    get address() {return server.address();}
  };
}
