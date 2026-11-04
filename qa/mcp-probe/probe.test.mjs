import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';

const SERVER = new URL('./server.mjs', import.meta.url);

function startProbe(stateFile) {
  const child = spawn(process.execPath, [SERVER.pathname], {
    env: { ...process.env, GRAPHITE_MCP_PROBE_STATE_FILE: stateFile },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let nextId = 1;
  const pending = new Map();
  const output = createInterface({ input: child.stdout, crlfDelay: Infinity });
  output.on('line', line => {
    const data = JSON.parse(line);
    const entry = pending.get(data.id);
    if (entry) {
      clearTimeout(entry.timeout);
      pending.delete(data.id);
      entry.resolve(data);
    }
  });
  child.on('exit', code => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timeout);
      entry.reject(new Error('Probe exited early: ' + code));
    }
    pending.clear();
  });
  const call = (method, params = {}) => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Timeout waiting for ' + method));
      }, 5000);
      pending.set(id, { resolve, reject, timeout });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  };
  const notify = method =>
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
  const close = async () => {
    if (child.exitCode !== null) return;
    const done = new Promise(resolve => child.once('exit', resolve));
    child.stdin.end();
    await done;
  };
  return { call, notify, close, child };
}

test('standalone MCP probe discovers read/write, guards writes and persists only synthetic data', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'graphite-mcp-probe-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const stateFile = join(dir, 'synthetic.json');
  const probe = startProbe(stateFile);
  t.after(() => probe.child.kill());

  const init = await probe.call('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'synthetic-ci', version: '1' },
  });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  probe.notify('notifications/initialized');

  const listed = await probe.call('tools/list');
  assert.deepEqual(listed.result.tools.map(item => item.name),
    ['read_probe_value', 'write_probe_value']);
  assert.equal(listed.result.tools[0].annotations.readOnlyHint, true);
  assert.equal(listed.result.tools[1].annotations.readOnlyHint, false);

  const read = () => probe.call('tools/call',
    { name: 'read_probe_value', arguments: {} });
  const first = await read();
  assert.deepEqual(first.result.structuredContent,
    { value: 'synthetic-one', revision: 0, synthetic: true });

  const rejected = await probe.call('tools/call', {
    name: 'write_probe_value',
    arguments: { value: 'private-data', expected_revision: 0 },
  });
  assert.equal(rejected.result.isError, true);
  assert.equal(rejected.result.content[0].text.includes('INVALID_ARGUMENTS'), true);
  assert.equal((await read()).result.structuredContent.revision, 0);

  const write = await probe.call('tools/call', {
    name: 'write_probe_value',
    arguments: { value: 'synthetic-two', expected_revision: 0 },
  });
  assert.deepEqual(write.result.structuredContent,
    { value: 'synthetic-two', revision: 1, synthetic: true, saved: true });
  assert.deepEqual((await read()).result.structuredContent,
    { value: 'synthetic-two', revision: 1, synthetic: true });

  const stale = await probe.call('tools/call', {
    name: 'write_probe_value',
    arguments: { value: 'synthetic-one', expected_revision: 0 },
  });
  assert.equal(stale.result.isError, true);
  assert.match(stale.result.content[0].text, /REVISION_CONFLICT/);
  assert.deepEqual(JSON.parse(readFileSync(stateFile, 'utf8')),
    { value: 'synthetic-two', revision: 1 });

  await probe.close();
  const restarted = startProbe(stateFile);
  t.after(() => restarted.child.kill());
  const afterRestart = await restarted.call('tools/call', {
    name: 'read_probe_value', arguments: {},
  });
  assert.deepEqual(afterRestart.result.structuredContent,
    { value: 'synthetic-two', revision: 1, synthetic: true });
  await restarted.close();
});
