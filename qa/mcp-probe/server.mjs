// Stage-0 Graphite portability experiment only.
// Isolated stdio MCP server: no network listener, Graphite data, API, or secrets.
import { randomUUID } from 'node:crypto';
import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const PROTOCOL_VERSION = '2025-06-18';
const STATE_FILE = process.env.GRAPHITE_MCP_PROBE_STATE_FILE
  || join(tmpdir(), 'graphite-mcp-stdio-probe.local.json');
const ALLOWED_VALUES = ['synthetic-one', 'synthetic-two'];
const INITIAL_STATE = Object.freeze({ value: 'synthetic-one', revision: 0 });

function readState() {
  let raw;
  try { raw = readFileSync(STATE_FILE, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return { ...INITIAL_STATE };
    throw error;
  }
  const value = JSON.parse(raw);
  if (!value || !ALLOWED_VALUES.includes(value.value)
      || !Number.isSafeInteger(value.revision) || value.revision < 0) {
    throw new Error('Invalid local probe state');
  }
  return { value: value.value, revision: value.revision };
}

function writeState(state) {
  const temp = STATE_FILE + '.' + randomUUID() + '.tmp';
  try {
    writeFileSync(temp, JSON.stringify(state) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    renameSync(temp, STATE_FILE);
  } catch (error) {
    try { unlinkSync(temp); } catch { /* no temporary file to remove */ }
    throw error;
  }
}

const tools = [
  {
    name: 'read_probe_value',
    title: 'Read synthetic MCP test value',
    description: 'Read a synthetic local test value and its revision. This server cannot read Graphite projects.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'write_probe_value',
    title: 'Write synthetic MCP test value',
    description: 'Only after explicit user approval, update the local synthetic value. Read first to obtain expected_revision. Never touches Graphite projects.',
    inputSchema: {
      type: 'object',
      properties: {
        value: { type: 'string', enum: ALLOWED_VALUES },
        expected_revision: { type: 'integer', minimum: 0 },
      },
      required: ['value', 'expected_revision'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

function toolResult(value, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    ...(isError ? { isError: true } : { structuredContent: value }),
  };
}

function invokeTool(name, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return toolResult({ error: 'INVALID_ARGUMENTS' }, true);
  }
  if (name === 'read_probe_value') {
    if (Object.keys(args).length) return toolResult({ error: 'INVALID_ARGUMENTS' }, true);
    return toolResult({ ...readState(), synthetic: true });
  }
  if (name === 'write_probe_value') {
    if (Object.keys(args).some(key => !['value', 'expected_revision'].includes(key))
      || !ALLOWED_VALUES.includes(args.value)
      || !Number.isSafeInteger(args.expected_revision) || args.expected_revision < 0) {
      return toolResult({ error: 'INVALID_ARGUMENTS' }, true);
    }
    const current = readState();
    if (args.expected_revision !== current.revision) {
      return toolResult({ error: 'REVISION_CONFLICT', current_revision: current.revision }, true);
    }
    const next = { value: args.value, revision: current.revision + 1 };
    writeState(next);
    return toolResult({ ...next, synthetic: true, saved: true });
  }
  return toolResult({ error: 'UNKNOWN_TOOL' }, true);
}

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}
function fail(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

function handle(line) {
  let message;
  try { message = JSON.parse(line); }
  catch { fail(null, -32700, 'Parse error'); return; }
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    fail(message?.id ?? null, -32600, 'Invalid request'); return;
  }
  if (message.id === undefined) return; // JSON-RPC notifications have no response.
  try {
    if (message.method === 'initialize') {
      respond(message.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'graphite-mcp-connection-probe', version: '0.1.0' },
        instructions: 'Synthetic connection test only. Read before writing; write only when explicitly approved. No Graphite data is available.',
      });
    } else if (message.method === 'ping') {
      respond(message.id, {});
    } else if (message.method === 'tools/list') {
      respond(message.id, { tools });
    } else if (message.method === 'tools/call') {
      const { name, arguments: args = {} } = message.params || {};
      respond(message.id, invokeTool(name, args));
    } else {
      fail(message.id, -32601, 'Method not found');
    }
  } catch {
    // Do not expose paths, state or internal errors through the MCP endpoint.
    fail(message.id, -32603, 'Local probe error');
  }
}

createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', handle);
