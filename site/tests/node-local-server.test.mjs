import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request as httpRequest} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {openGraphiteLocalStorage} from '../src/node_local_storage.mjs';
import {createGraphiteLoopbackServer} from '../src/node_local_server.mjs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const secret = () => randomBytes(32).toString('base64url');

async function harness(t, {workflowEnabled = false} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'graphite-node-local-'));
  let sqlite = openGraphiteLocalStorage(join(dir, 'independent.sqlite'));
  const key = secret();
  let server = createGraphiteLoopbackServer({database: sqlite, editorHtml: html,
    token: key, workflowEnabled});
  let origin = await server.listen(0);
  t.after(async () => {
    await server.close();
    sqlite.close();
    rmSync(dir, {recursive: true, force: true});
  });
  const call = (path, method = 'GET', {cookie, authorization, headers = {}, json, body, originHeader} = {}) =>
    fetch(origin + path, {
      method, redirect: 'manual',
      headers: {
        ...cookie ? {Cookie: cookie} : {},
        ...authorization ? {Authorization: 'Bearer ' + authorization} : {},
        ...json !== undefined ? {'Content-Type': 'application/json'} : {},
        ...originHeader ? {Origin: originHeader} : {},
        ...headers
      },
      ...json !== undefined ? {body: JSON.stringify(json)} : {},
      ...body !== undefined ? {body} : {}
    });
  const mcp = async (method, params, {authorization = key, cookie, originHeader} = {}) => {
    const res = await call('/mcp', 'POST', {
      authorization, cookie, originHeader,
      json: {jsonrpc: '2.0', id: 12, method, ...(params ? {params} : {})}
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return {status: res.status, data};
  };
  return {dir, key, call, mcp, get origin() {return origin;},
    get sqlite() {return sqlite;}, get server() {return server;},
    async restart() {
      await server.close(); sqlite.close();
      sqlite = openGraphiteLocalStorage(join(dir, 'independent.sqlite'));
      server = createGraphiteLoopbackServer({database: sqlite, editorHtml: html,
        token: key, workflowEnabled});
      origin = await server.listen(0);
    }};
}

test('local-only listener, forbidden native identity spoof, cookie isolation and CSRF enforcement', async t => {
  const h = await harness(t);
  assert.equal(h.server.address.address, '127.0.0.1');
  const anon = await h.call('/api/projects');
  assert.equal(anon.status, 401);
  assert.equal((await h.call('/')).headers.get('location'), '/__local/login');
  assert.equal((await h.call('/api/projects', 'GET', {
    headers: {'oai-authenticated-user-id': 'fake-owner'}
  })).status, 401);
  const anonymousMcp = await h.mcp('tools/list', undefined, {authorization: ''});
  assert.equal(anonymousMcp.status, 401);
  assert.equal((await h.call('/__local/login', 'POST', {
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: 'key=' + encodeURIComponent(h.key)
  })).status, 403);
  assert.equal((await h.call('/__local/login', 'POST', {
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    originHeader: h.origin, body: 'key=wrong'
  })).status, 401);
  const form = await h.call('/__local/login', 'POST', {
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    originHeader: h.origin, body: 'key=' + encodeURIComponent(h.key)
  });
  assert.equal(form.status, 303);
  assert.equal(form.headers.get('location'), '/');
  assert.match(form.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const cookie = form.headers.get('set-cookie').split(';')[0];
  const ui = await h.call('/', 'GET', {cookie});
  assert.equal(ui.status, 200);
  assert.match(await ui.text(), /Plot Architect · Graphite/);
  const health = await (await h.call('/api/health', 'GET', {cookie})).json();
  assert.equal(health.ok, true);
  assert.equal(health.authMode, 'node-loopback');
  assert.equal((await h.call('/api/projects', 'POST', {cookie, json: {}})).status, 403);
  assert.equal((await h.call('/api/projects', 'POST', {
    cookie, originHeader: 'https://attacker.test', json: {}
  })).status, 403);
  assert.equal((await h.call('/api/projects', 'POST', {
    authorization: h.key, originHeader: 'https://attacker.test', json: {}
  })).status, 403);
  assert.equal((await h.mcp('tools/list', undefined, {authorization: '', cookie})).status, 401);
  assert.equal((await h.call('/api/projects', 'GET', {
    cookie, headers: {'oai-authenticated-user-id': 'injected'}
  })).status, 200);
  // fetch() normalizes Host; a raw Node HTTP request exercises Host denial.
  const spoofedHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(h.origin + '/api/projects', {
      headers: {Host: 'external.example', Authorization: 'Bearer ' + h.key}
    }, response => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    request.once('error', reject);
    request.end();
  });
  assert.equal(spoofedHostStatus, 403);
  const logout = await h.call('/__local/logout', 'POST', {cookie, originHeader: h.origin});
  assert.equal(logout.status, 303);
  assert.equal((await h.call('/api/projects', 'GET', {cookie})).status, 401);
});

test('Node editor REST and MCP read/write the same persistent local SQLite database', async t => {
  const h = await harness(t);
  const form = await h.call('/__local/login', 'POST', {
    originHeader: h.origin,
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: 'key=' + encodeURIComponent(h.key)
  });
  assert.equal(form.status, 303);
  const cookie = form.headers.get('set-cookie').split(';')[0];
  const listed = await h.mcp('tools/list');
  assert.equal(listed.status, 200);
  assert.ok(listed.data.result.tools.some(tool => tool.name === 'create_project'));
  assert.ok(listed.data.result.tools.some(tool => tool.name === 'save_note_drafts'));
  const created = await h.mcp('tools/call', {name: 'create_project',
    arguments: {name: 'Синтетическая история'}});
  assert.equal(created.status, 200);
  const projectId = created.data.result.structuredContent.project_id;
  assert.equal(created.data.result.structuredContent.revision, 0);
  const projects = await (await h.call('/api/projects', 'GET', {cookie})).json();
  assert.deepEqual(projects.projects.map(item => item.id), [projectId]);
  const path = '/api/projects/' + projectId;
  const original = await (await h.call(path, 'GET', {cookie})).json();
  assert.equal(original.revision, 0);
  const edited = await h.call(path, 'PUT', {cookie, originHeader: h.origin, json: {
    name: 'Изменение через браузер', expectedRevision: 0, graph: original.graph
  }});
  assert.equal(edited.status, 200, await edited.text());
  const fromMcp = await h.mcp('tools/call', {
    name: 'get_project', arguments: {project_id: projectId, detail: 'full'}
  });
  assert.equal(fromMcp.data.result.structuredContent.name, 'Изменение через браузер');
  assert.equal(fromMcp.data.result.structuredContent.revision, 1);
  const args = {
    project_id: projectId, expected_revision: 1,
    operations: [{op: 'add_node', title: 'Новый синтетический поворот', x: 140, y: 160}]
  };
  const preview = await h.mcp('tools/call', {name: 'preview_patch', arguments: args});
  assert.equal(preview.status, 200);
  const token = preview.data.result.structuredContent.preview_token;
  const saved = await h.mcp('tools/call', {
    name: 'apply_patch', arguments: {...args, preview_token: token}
  });
  assert.equal(saved.data.result.structuredContent.saved, true);
  const fromRest = await (await h.call(path, 'GET', {cookie})).json();
  assert.equal(fromRest.revision, 2);
  assert.equal(fromRest.graph.nodes.length, 1);
  assert.equal(fromRest.graph.nodes[0].title, 'Новый синтетический поворот');
  await h.restart();
  const persisted = await h.mcp('tools/call', {
    name: 'get_project', arguments: {project_id: projectId, detail: 'full'}
  });
  assert.equal(persisted.data.result.structuredContent.revision, 2);
  assert.equal(persisted.data.result.structuredContent.graph.nodes.length, 1);
  assert.deepEqual(h.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
});

test('missing workflow receipt store and unknown SQLite schemas fail closed', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'graphite-node-schema-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const foreignFile = join(dir, 'foreign.sqlite');
  const foreign = new DatabaseSync(foreignFile);
  foreign.exec('CREATE TABLE unrelated (id TEXT PRIMARY KEY)');
  foreign.prepare('INSERT INTO unrelated(id) VALUES (?)').run('preserve-me');
  foreign.close();
  assert.throws(() => openGraphiteLocalStorage(foreignFile), /not recognized/);
  const check = new DatabaseSync(foreignFile);
  assert.equal(check.prepare('SELECT id FROM unrelated').get().id, 'preserve-me');
  assert.equal(check.prepare("SELECT name FROM sqlite_master WHERE name='plot_projects'").get(), undefined);
  check.close();
  const scratch = openGraphiteLocalStorage(join(dir, 'new.sqlite'));
  assert.ok(scratch.prepare("SELECT name FROM sqlite_master WHERE name='cw_operation_receipts'").get());
  scratch.close();
});

test('MCP rejects foreign browser Origin even with a valid local bearer token', async t => {
  const h = await harness(t);
  const res = await h.mcp('tools/list', undefined, {originHeader: 'https://malicious.invalid'});
  assert.equal(res.status, 403);
  const ok = await h.mcp('tools/list', undefined, {authorization: h.key});
  assert.equal(ok.status, 200);
});
