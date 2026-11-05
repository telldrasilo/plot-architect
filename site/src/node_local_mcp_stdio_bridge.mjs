/**
 * Local MCP stdio -> loopback HTTP bridge.
 *
 * Only the existing authenticated Graphite Node /mcp endpoint handles MCP
 * methods or writes. This bridge holds no database connection and does not
 * define alternate tools or bypass the local HTTP authentication boundary.
 * Never log tool parameters, auth headers or local Graphite responses.
 */
import {createInterface} from 'node:readline';

const MAX_FRAME = 200_000;
const TIMEOUT_MS = 30_000;

export function assertLocalMcpUrl(value) {
  if (typeof value !== 'string') throw new TypeError('Local MCP URL is required');
  const u = new URL(value);
  if (u.protocol !== 'http:' || u.hostname !== '127.0.0.1' ||
    !u.port || u.pathname !== '/mcp' || u.username || u.password ||
    u.search || u.hash || u.origin !== 'http://127.0.0.1:' + u.port) {
    throw new TypeError('MCP target must be http://127.0.0.1:<port>/mcp');
  }
  return u.toString();
}

export function createLocalMcpStdioBridge({
  input, output, targetUrl, token, fetchImpl = fetch, timeoutMs = TIMEOUT_MS
} = {}) {
  if (!input?.on || !output?.write) throw new TypeError('Stdio streams required');
  const url = assertLocalMcpUrl(targetUrl);
  if (typeof token !== 'string' || token.length < 40) throw new TypeError('Strong local token required');

  const rl = createInterface({input, crlfDelay: Infinity});
  let queue = Promise.resolve();
  const send = response => {
    output.write(JSON.stringify(response) + '\n');
  };
  const fault = (id, code, message) => send({
    jsonrpc: '2.0', id, error: {code, message}
  });

  async function handle(raw) {
    if (Buffer.byteLength(raw, 'utf8') > MAX_FRAME) {
      return fault(null, -32700, 'MCP frame too large');
    }
    let message;
    try { message = JSON.parse(raw); } catch {
      return fault(null, -32700, 'MCP parse error');
    }
    if (!message || typeof message !== 'object' || Array.isArray(message) ||
      message.jsonrpc !== '2.0' || typeof message.method !== 'string' ||
      (message.id !== undefined && (message.id === null ||
        (typeof message.id !== 'string' && typeof message.id !== 'number')))) {
      return fault(message?.id ?? null, -32600, 'Invalid MCP request');
    }
    if (message.id === undefined) return; // no response for notifications
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: raw,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error'
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        return fault(message.id, -32000, 'Local Graphite MCP endpoint unavailable');
      }
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > MAX_FRAME) {
        return fault(message.id, -32000, 'Local MCP response too large');
      }
      const result = JSON.parse(text);
      if (!result || result.jsonrpc !== '2.0' || result.id !== message.id ||
        (!Object.hasOwn(result, 'result') && !Object.hasOwn(result, 'error'))) {
        return fault(message.id, -32000, 'Invalid local MCP response');
      }
      send(result);
    } catch {
      // Neither token nor Graphite project contents are exposed on errors.
      fault(message.id, -32000, 'Local Graphite MCP endpoint unavailable');
    }
  }

  rl.on('line', raw => {
    // Preserve strict initialize -> tools/list -> tools/call order. One
    // in-process SQLite writer also avoids overlapping Graphite transactions.
    queue = queue.then(() => handle(raw)).catch(() => {
      fault(null, -32603, 'Local MCP bridge error');
    });
  });
  return {
    async drained() {
      await queue;
    },
    close() { rl.close(); }
  };
}
