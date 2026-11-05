import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {PassThrough} from 'node:stream';
import {createInterface} from 'node:readline';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {createGraphiteLoopbackServer} from '../src/node_local_server.mjs';
import {assertLocalMcpUrl,createLocalMcpStdioBridge} from '../src/node_local_mcp_stdio_bridge.mjs';
import {localTunnelLaunchOptions} from '../src/node_local_tunnel_launch.mjs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const secret = () => randomBytes(32).toString('base64url');

function local(t) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  db.exec(readFileSync(new URL('../drizzle/0001_initial.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../drizzle/0002_cw_operation_receipts.sql', import.meta.url), 'utf8'));
  const token = secret();
  const server = createGraphiteLoopbackServer({database: db, editorHtml: html, token});
  t.after(async () => {await server.close();db.close();});
  return {server, db, token};
}

test('stdio target is strictly loopback /mcp, not a public transport', () => {
  assert.equal(assertLocalMcpUrl('http://127.0.0.1:8788/mcp'), 'http://127.0.0.1:8788/mcp');
  for (const invalid of [
    'https://127.0.0.1:8788/mcp','http://localhost:8788/mcp',
    'http://127.0.0.1:8788/api/projects', 'http://127.0.0.1:8788/mcp?token=secret',
    'http://127.0.0.1:8788/mcp#x', 'http://username@127.0.0.1:8788/mcp',
    'http://127.0.0.1/mcp','http://127.0.0.2:8788/mcp',
    'http://127.0.0.1:8788/mcp/../api'
  ]) assert.throws(() => assertLocalMcpUrl(invalid), TypeError);
});

test('tunnel launcher protects key in env and cannot inherit wrong profile or destination', () => {
  const key = secret(), platformKey = 'sk-' + 'a'.repeat(55), origin = 'http://127.0.0.1:8788';
  const config = localTunnelLaunchOptions({
    clientExe: process.platform === 'win32' ? 'C:\\Graphite\\tunnel-client.exe' : '/opt/tunnel-client',
    tunnelId: 'tunnel_6ae84b2112e4819180b875a027acba36',
    platformKey, localToken: key, localOrigin: origin,
    inheritedEnv: {
      TUNNEL_CLIENT_PROFILE: 'graphite-probe',
      MCP_COMMAND: 'some-other-mcp',
      MCP_SERVER_URL: 'https://untrusted.example/mcp',
      GRAPHITE_OLD_TOKEN: 'keep',
      PATH: process.env.PATH
    }
  });
  assert.deepEqual(config.args.slice(0, 3), ['run','--control-plane.tunnel-id','tunnel_6ae84b2112e4819180b875a027acba36']);
  assert.deepEqual(config.args.slice(3, 4), ['--mcp.command']);
  assert.match(config.args[4], /^node ".*mcp-local-stdio\.mjs"$/);
  assert.equal(config.options.env.GRAPHITE_LOCAL_MCP_URL, origin + '/mcp');
  assert.equal(config.options.env.GRAPHITE_LOCAL_MCP_TOKEN, key);
  assert.equal(config.options.env.CONTROL_PLANE_API_KEY, platformKey);
  for (const name of ['TUNNEL_CLIENT_PROFILE','MCP_COMMAND','MCP_SERVER_URL']) {
    assert.equal(config.options.env[name], undefined);
  }
  assert.ok(!JSON.stringify(config.args).includes(key));
  assert.ok(!JSON.stringify(config.args).includes(platformKey));
  assert.equal(config.options.stdio, 'inherit');
  assert.throws(() => localTunnelLaunchOptions({...{
    clientExe: './tunnel-client', tunnelId: 'tunnel_6ae84b2112e4819180b875a027acba36',
    platformKey, localToken: key, localOrigin: origin
  }}), TypeError);
  assert.throws(() => localTunnelLaunchOptions({
    clientExe: config.command, tunnelId: 'invalid', platformKey,
    localToken: key, localOrigin: origin
  }), TypeError);
});

test('real stdio child bridges Graphite MCP read/write and REST without a second SQLite connection', async t => {
  const h = local(t);
  const origin = await h.server.listen(0);
  const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/mcp-local-stdio.mjs', import.meta.url))], {
    cwd: new URL('..', import.meta.url),
    stdio: ['pipe','pipe','pipe'],
    env: {
      ...process.env, GRAPHITE_LOCAL_MCP_URL: origin + '/mcp',
      GRAPHITE_LOCAL_MCP_TOKEN: h.token
    }
  });
  t.after(() => {child.kill();});
  const pending = new Map();
  const lines = createInterface({input: child.stdout, crlfDelay: Infinity});
  lines.on('line', text => {
    const msg = JSON.parse(text);
    const callbacks = pending.get(msg.id);
    if (callbacks) {pending.delete(msg.id);callbacks.resolve(msg);}
  });
  let nextId = 0;
  const call = (method, params) => {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {pending.delete(id);reject(new Error('Timed out on stdio MCP'))}, 10_000);
      pending.set(id, {resolve: result => {clearTimeout(timeout);resolve(result);}});
      child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,...params?{params}:{}}) + '\n');
    });
  };
  const initialized = await call('initialize', {protocolVersion:'2025-06-18',capabilities:{}});
  assert.equal(initialized.result.protocolVersion,'2025-06-18');
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}) + '\n');
  const list = await call('tools/list');
  const names = list.result.tools.map(tool => tool.name);
  for (const name of ['create_project','get_project','preview_patch','apply_patch','get_note_task']) {
    assert.ok(names.includes(name), name);
  }
  const created = await call('tools/call', {name:'create_project',arguments:{name:'Synthetic MCP bridge story'}});
  const result = created.result.structuredContent;
  assert.equal(result.created, true);
  const id = result.project_id;
  const rest = await fetch(origin + '/api/projects/' + id, {
    headers: {Authorization:'Bearer ' + h.token}
  });
  assert.equal(rest.status, 200);
  assert.equal((await rest.json()).name,'Synthetic MCP bridge story');
  const patch = {project_id: id,expected_revision: 0,
    operations:[{op:'add_node',title:'Synthetic new event'}]};
  const preview = await call('tools/call', {name:'preview_patch',arguments:patch});
  assert.ok(preview.result.structuredContent.preview_token);
  const saved = await call('tools/call', {name:'apply_patch',
    arguments:{...patch,preview_token:preview.result.structuredContent.preview_token}});
  assert.equal(saved.result.structuredContent.saved,true);
  assert.equal(saved.result.structuredContent.revision,1);
  const full = await call('tools/call', {name:'get_project',arguments:{project_id:id,detail:'full'}});
  assert.equal(full.result.structuredContent.graph.nodes[0].title,'Synthetic new event');
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM plot_revisions WHERE project_id=?').get(id).n, 2);
});

test('bridge never forwards unauthenticated or public URL MCP traffic', async t => {
  const {token,server} = local(t);
  const origin = await server.listen(0);
  const input = new PassThrough(), output = new PassThrough();
  let raw = '';
  output.on('data', chunk => raw += chunk.toString());
  const bridge = createLocalMcpStdioBridge({
    input,output,targetUrl:origin+'/mcp',token:'f'.repeat(43)
  });
  input.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})+'\n');
  input.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'ping'})+'\n');
  await new Promise(resolve => setImmediate(resolve));
  await bridge.drained();
  const answers = raw.trim().split('\n').map(JSON.parse);
  assert.equal(answers.length,2);
  assert.deepEqual(answers.map(a=>a.id),[1,2]);
  assert.ok(answers.every(answer => answer.error.code === -32000));
  assert.ok(!raw.includes(token));
  bridge.close();
});

test('local tunnel stdio entry refuses to start without an ephemeral key', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/mcp-local-stdio.mjs', import.meta.url))], {
    cwd: new URL('..', import.meta.url),
    stdio: ['ignore','pipe','pipe'],
    env: {...process.env,GRAPHITE_LOCAL_MCP_URL:'http://127.0.0.1:8788/mcp',
      GRAPHITE_LOCAL_MCP_TOKEN: ''}
  });
  let err='';
  child.stderr.on('data', data => err += data.toString());
  const code = await new Promise(resolve => child.once('exit', resolve));
  assert.equal(code,1);
  assert.match(err,/missing or invalid local runtime configuration/);
  assert.ok(!err.includes('GRAPHITE_LOCAL_MCP_TOKEN='));
});
