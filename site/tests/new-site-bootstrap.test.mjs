import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Official Sites starter configuration intentionally has no old project link.
// Tests never contact Sites, GitHub or a real database.
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('fresh-site manifest provisions its own project and DB binding',()=>{
  const config=JSON.parse(read('../.openai/hosting.json'));
  assert.deepEqual(config,{d1:'DB',r2:null});
  assert.equal(Object.hasOwn(config,'project_id'),false);
});

test('local dummy D1 identifier cannot be mistaken for hosted database',()=>{
  const local=JSON.parse(read('../wrangler.sites.jsonc'));
  assert.equal(local.main,'./src/sites-vite-entry.mjs');
  assert.deepEqual(local.d1_databases?.map(d=>d.binding),['DB']);
  assert.deepEqual(local.d1_databases?.map(d=>d.database_id),['00000000-0000-0000-0000-000000000001']);
  assert.equal(local.d1_databases[0].migrations_dir,'drizzle');
});

test('fresh D1 migration remains additive and provides revision storage',()=>{
  const sql=read('../drizzle/0001_initial.sql');
  for(const entity of ['plot_projects','plot_revisions']){
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS '+entity+' ('),entity);
  }
  for(const forbidden of ['DROP TABLE','DELETE FROM','TRUNCATE'])assert.ok(!sql.toUpperCase().includes(forbidden),forbidden);
  const journal=JSON.parse(read('../drizzle/meta/_journal.json'));
  assert.deepEqual(journal.entries.map(x=>x.tag),['0001_initial','0002_cw_operation_receipts']);
  const receipts=read('../drizzle/0002_cw_operation_receipts.sql');
  assert.ok(receipts.includes('CREATE TABLE IF NOT EXISTS cw_operation_receipts ('));
  assert.ok(receipts.includes('PRIMARY KEY (project_id, operation_id)'));
  assert.ok(receipts.includes('FOREIGN KEY (project_id) REFERENCES plot_projects(id)'));
  for(const forbidden of ['DROP TABLE','DELETE FROM','TRUNCATE','ALTER TABLE'])assert.ok(!receipts.toUpperCase().includes(forbidden),forbidden);
});

test('native Sites/Vite setup and existing MCP seven-tool contract stay intact',()=>{
  const cfg=read('../sites-vite-compat/vite.config.mjs');
  assert.ok(cfg.includes('sites()'));
  assert.ok(cfg.includes("cloudflare({ configPath: './wrangler.sites.jsonc'"));
  const mcp=read('../src/mcp_server.mjs');
  for(const name of ['list_projects','create_project','get_project','get_context','get_changes','preview_patch','apply_patch']){
    assert.ok(mcp.includes("name:'"+name+"'"),name);
  }
});

test('second release smoke: browser tab provides a visible revision signal without changing JS',()=>{
  const html=read('../public/index.html');
  const editor=read('../src/editor.js');
  assert.ok(html.includes('<title>Plot Architect · Graphite</title>'));
  assert.ok(html.includes(editor),'UI editor must remain identical to canonical script');
});
