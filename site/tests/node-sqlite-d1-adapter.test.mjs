import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {createNodeSqliteD1Adapter} from '../src/node_sqlite_d1_adapter.mjs';
import {validateGraph} from '../src/graph_contract.mjs';
import {previewDraftAcceptance, canonicalProjection} from '../src/creative_workflow_contract.mjs';
import {assertWorkflowReceiptStore, commitWorkflowCommand} from '../src/creative_workflow_transactional_spike.mjs';

const schema = readFileSync(new URL('../drizzle/0001_initial.sql', import.meta.url), 'utf8');
const receiptsSchema = readFileSync(new URL('../drizzle/0002_cw_operation_receipts.sql', import.meta.url), 'utf8');
const now = '2026-11-05T00:00:00.000Z';
const id = 'synthetic-portable-db';
const fixture = () => validateGraph({
  version: 1, revision: 0, view: null,
  nodes: [
    {id: 'n1', title: 'Начало', description: '', x: 0, y: 0},
    {id: 'n2', title: 'Следствие', description: '', x: 240, y: 0},
    ...['a', 'b', 'c'].map((nodeId, i) => ({
      id: nodeId, title: 'Черновик ' + nodeId, description: '',
      x: 100 + i * 220, y: 320, workspaceId: 'w1'
    }))
  ],
  edges: [
    {id: 'e0', from: 'n1', to: 'n2', type: 'precedes'},
    {id: 'ea', from: 'a', to: 'b', type: 'precedes', workspaceId: 'w1', draftRelation: 'internal'},
    {id: 'eb', from: 'b', to: 'c', type: 'precedes', workspaceId: 'w1', draftRelation: 'internal'}
  ],
  workspaces: [{id: 'w1', taskId: 'task', x: 80, y: 260, width: 850, height: 300}],
  fields: [], lanes: []
});

function localStorage(t, receipts = true) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(schema);
  if (receipts) sqlite.exec(receiptsSchema);
  return {sqlite, db: createNodeSqliteD1Adapter(sqlite)};
}
function seed(sqlite, graph = fixture()) {
  const serialized = JSON.stringify(graph);
  sqlite.prepare('INSERT INTO plot_projects (id,name,graph_json,revision,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    .run(id, 'Synthetic test', serialized, 0, now, now);
  sqlite.prepare('INSERT INTO plot_revisions (project_id,revision,graph_json,message,created_at) VALUES (?,?,?,?,?)')
    .run(id, 0, serialized, 'Initial', now);
  return graph;
}
function counts(sqlite) {
  return {
    revision: sqlite.prepare('SELECT revision FROM plot_projects WHERE id=?').get(id).revision,
    history: sqlite.prepare('SELECT COUNT(*) AS n FROM plot_revisions WHERE project_id=?').get(id).n,
    receipts: sqlite.prepare('SELECT COUNT(*) AS n FROM cw_operation_receipts WHERE project_id=?').get(id).n
  };
}
const acceptance = graph => ({
  kind: 'accept_draft', workspaceId: 'w1', nodeIds: ['a', 'b'],
  expectedPreview: previewDraftAcceptance(graph, {workspaceId: 'w1', nodeIds: ['a', 'b']})
});

// Contract-only integration tests: no HTTP server, auth bypass, user project, or hosted D1.
test('Node SQLite adapter supports D1 prepare/bind/first/all/run without implicit migrations', async t => {
  const {sqlite, db} = localStorage(t, false);
  assert.equal(Object.hasOwn(db, 'sqlite'), false);
  assert.equal(db.prepare('SELECT id FROM plot_projects').first(), null);
  assert.deepEqual(db.prepare('SELECT id FROM plot_projects').all().results, []);
  await assert.rejects(assertWorkflowReceiptStore(db), error => error?.code === 'WORKFLOW_STORAGE_UNAVAILABLE');
  const created = db.prepare('INSERT INTO plot_projects (id,name,graph_json,revision,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    .bind(id, 'Synthetic', '{}', 0, now, now).run();
  assert.equal(created.meta.changes, 1);
  assert.equal(db.prepare('SELECT name FROM plot_projects WHERE id=?').bind(id).first('name'), 'Synthetic');
  assert.deepEqual(db.prepare('SELECT id FROM plot_projects WHERE id=?').bind(id).all().results, [{id}]);
  assert.throws(() => db.prepare('SELECT ?').bind({unsafe: true}), TypeError);
  assert.throws(() => db.prepare('SELECT ?').bind(Infinity), TypeError);
  assert.throws(() => db.batch([{}]), TypeError);
  assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length, 0);
});

test('reviewed draft acceptance is atomic, replay-safe and excludes unaccepted nodes from canon', async t => {
  const {sqlite, db} = localStorage(t);
  const graph = seed(sqlite);
  const args = {projectId: id, operationId: 'accept-1', expectedRevision: 0, command: acceptance(graph)};
  const result = await commitWorkflowCommand(db, args);
  assert.equal(result.revision, 1);
  assert.equal(result.replayed, false);
  assert.deepEqual(counts(sqlite), {revision: 1, history: 2, receipts: 1});
  const current = JSON.parse(sqlite.prepare('SELECT graph_json FROM plot_projects WHERE id=?').get(id).graph_json);
  assert.deepEqual(canonicalProjection(current).nodes.map(n => n.id), ['n1', 'n2', 'a', 'b']);
  assert.deepEqual(canonicalProjection(current).edges.map(e => e.id), ['e0', 'ea']);
  assert.ok(current.nodes.some(n => n.id === 'c' && n.workspaceId === 'w1'));
  const repeated = await commitWorkflowCommand(db, args);
  assert.equal(repeated.replayed, true);
  assert.deepEqual(counts(sqlite), {revision: 1, history: 2, receipts: 1});
  await assert.rejects(commitWorkflowCommand(db, {...args, operationId: 'accept-stale'}),
    error => error?.code === 'REVISION_CONFLICT');
  assert.deepEqual(counts(sqlite), {revision: 1, history: 2, receipts: 1});
});

test('same-connection changes() protects CAS-dependent history and receipt inserts', t => {
  const {sqlite, db} = localStorage(t);
  seed(sqlite);
  const stale = db.batch([
    db.prepare('UPDATE plot_projects SET revision=1 WHERE id=? AND revision=9').bind(id),
    db.prepare('INSERT INTO plot_revisions (project_id,revision,graph_json,message,created_at) SELECT id,revision,graph_json,?,? FROM plot_projects WHERE id=? AND revision=1 AND changes()=1').bind('stale', now, id),
    db.prepare('INSERT INTO cw_operation_receipts (project_id,operation_id,request_hash,response_json,revision,created_at) SELECT id,?,?,?,?,? FROM plot_projects WHERE id=? AND revision=1 AND changes()=1').bind('stale', 'hash', '{}', 1, now, id)
  ]);
  assert.deepEqual(stale.map(s => s.meta.changes), [0, 0, 0]);
  assert.deepEqual(counts(sqlite), {revision: 0, history: 1, receipts: 0});
});

test('failed third statement rolls back project update and immutable revision snapshot', t => {
  const {sqlite, db} = localStorage(t);
  seed(sqlite);
  const command = (operationId, targetRev) => [
    db.prepare('UPDATE plot_projects SET revision=? WHERE id=? AND revision=?').bind(targetRev, id, targetRev - 1),
    db.prepare('INSERT INTO plot_revisions (project_id,revision,graph_json,message,created_at) SELECT id,revision,graph_json,?,? FROM plot_projects WHERE id=? AND revision=? AND changes()=1').bind('test', now, id, targetRev),
    db.prepare('INSERT INTO cw_operation_receipts (project_id,operation_id,request_hash,response_json,revision,created_at) SELECT id,?,?,?,?,? FROM plot_projects WHERE id=? AND revision=? AND changes()=1').bind(operationId, 'hash', '{}', targetRev, now, id, targetRev)
  ];
  assert.deepEqual(db.batch(command('same-operation', 1)).map(s => s.meta.changes), [1, 1, 1]);
  assert.deepEqual(counts(sqlite), {revision: 1, history: 2, receipts: 1});
  assert.throws(() => db.batch(command('same-operation', 2)), /UNIQUE|constraint/i);
  assert.deepEqual(counts(sqlite), {revision: 1, history: 2, receipts: 1});
});

test('one batch cannot contain prepared statements from another SQLite connection', t => {
  const first = localStorage(t), second = localStorage(t);
  assert.throws(() => first.db.batch([second.db.prepare('SELECT 1')]), TypeError);
});
