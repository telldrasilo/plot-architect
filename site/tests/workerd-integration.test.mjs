import test from 'node:test';import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {resolve,join} from 'node:path';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
const qaRoot=mkdtempSync(join(tmpdir(),'plot-workerd-test-'));
const migration=()=>spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config','wrangler.preview.jsonc','--persist-to',qaRoot],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false'}});
const firstMigration=migration();assert.equal(firstMigration.status,0,firstMigration.stderr);
const secondMigration=migration();assert.equal(secondMigration.status,0,secondMigration.stderr);assert.match(secondMigration.stdout,/No migrations to apply/);
const options={modules:true,scriptPath:resolve('dist/server/index.js'),compatibilityDate:'2026-05-15',d1Databases:{DB:'00000000-0000-0000-0000-000000000001'},d1Persist:join(qaRoot,'v3/d1')};
const graph={nodes:[{id:'n1',title:'Local D1 integration',description:'QA',x:100,y:120}],edges:[],fields:[],lanes:[]};
test('real workerd + persistent local D1: API lifecycle, conflict, revisions, restart, auth',async()=>{
 let mf=new Miniflare(options);let id;
 const call=async(method,path,body,identity=true)=>{
  const headers={'Content-Type':'application/json'};if(identity)headers['oai-authenticated-user-id']='local-qa-owner';
  const res=await mf.dispatchFetch('https://plot.local'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,data:await res.json()};
 };
 try{
  const db=await mf.getD1Database('DB');const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'plot_%'").all();assert.equal(tables.results.length,2);
  const ledger=await db.prepare('SELECT count(*) AS n FROM d1_migrations WHERE name=?').bind('0001_initial.sql').first();assert.equal(ledger.n,1);
  assert.equal((await call('GET','/api/projects',undefined,false)).status,401);
  const created=await call('POST','/api/projects',{name:'QA local persistence',graph});assert.equal(created.status,201);id=created.data.id;
  assert.ok((await call('GET','/api/projects')).data.projects.some(p=>p.id===id));
  const edited=structuredClone(graph);edited.nodes[0].title='Saved across workerd restart';
  assert.equal((await call('PUT','/api/projects/'+id,{name:'QA updated',graph:edited,expectedRevision:0})).status,200);
  assert.equal((await call('PUT','/api/projects/'+id,{name:'stale',graph,expectedRevision:0})).status,409);
  assert.equal((await call('GET','/api/projects/'+id)).data.graph.nodes[0].title,edited.nodes[0].title);
  assert.deepEqual((await call('GET','/api/projects/'+id+'/revisions')).data.revisions.map(r=>r.revision),[1,0]);
  await mf.dispose();mf=new Miniflare(options);
  assert.equal((await call('GET','/api/projects/'+id)).data.graph.nodes[0].title,edited.nodes[0].title);
  assert.equal((await call('POST','/api/projects/'+id+'/restore',{revision:0,expectedRevision:1})).status,200);
  assert.equal((await call('GET','/api/projects/'+id)).data.graph.nodes[0].title,graph.nodes[0].title);
  assert.equal((await call('DELETE','/api/projects/'+id,{expectedRevision:1})).status,409);
  assert.equal((await call('DELETE','/api/projects/'+id,{expectedRevision:2})).status,200);
  assert.equal((await call('GET','/api/projects/'+id)).status,404);
 }finally{await mf.dispose();rmSync(qaRoot,{recursive:true,force:true})}
});
