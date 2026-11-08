import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.mjs';

function dbHarness(withReceipts=true){
 const sql=new DatabaseSync(':memory:');
 sql.exec('PRAGMA foreign_keys=ON;'+fs.readFileSync(new URL('../db/0001_initial.sql',import.meta.url),'utf8'));
 if(withReceipts)sql.exec('CREATE TABLE cw_operation_receipts (project_id TEXT NOT NULL,operation_id TEXT NOT NULL,request_hash TEXT NOT NULL,response_json TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(project_id,operation_id),FOREIGN KEY(project_id) REFERENCES plot_projects(id))');
 const db={prepare(statement){return {params:[],bind(...args){this.params=args;return this},
  run(){const r=sql.prepare(statement).run(...this.params);return {meta:{changes:Number(r.changes)}}},
  first(){return sql.prepare(statement).get(...this.params)??null},
  all(){return {results:sql.prepare(statement).all(...this.params)}}
 }},async batch(items){sql.exec('BEGIN IMMEDIATE');try{
   const results=items.map(x=>x.run());sql.exec('COMMIT');return results
  }catch(e){sql.exec('ROLLBACK');throw e}}
 };
 return {sql,db};
}
function graph(){return {
 version:1,revision:0,view:null,
 nodes:[
  {id:'a',title:'Секрет канона',description:'PRIVATE_CANON_TEXT',x:90,y:90,parent:null},
  {id:'b',title:'Последствие',x:500,y:90,parent:null}
 ],
 edges:[{id:'ab',from:'a',to:'b',type:'causes'}],
 fields:[],lanes:[],
 gapNotes:[
  {id:'taskA',title:'Первый черновик',text:'Создай два новых события',x:120,y:400,parent:null,status:'pending'},
  {id:'taskB',title:'SECRET_UNRELATED_NOTE',text:'Не показывать',x:750,y:400,parent:null,status:'pending'}
 ],gapLinks:[]
 }}
async function call(env,method,path,body,owner=true,origin){
 const headers={};if(owner)headers['oai-authenticated-user-id']='synthetic-owner';
 if(body!==undefined)headers['Content-Type']='application/json';
 if(origin)headers.Origin=origin;
 const res=await worker.fetch(new Request('https://graphite.local'+path,{
  method,headers,body:body===undefined?undefined:JSON.stringify(body)
 }),env);
 const txt=await res.text();return {status:res.status,data:txt?JSON.parse(txt):null};
}
async function project(env){
 const p=await call(env,'POST','/api/projects',{name:'Synthetic P1',graph:graph()});
 assert.equal(p.status,201,JSON.stringify(p.data));return p.data.id;
}
async function mcp(env,name,args,owner=true){
 const r=await call(env,'POST','/mcp',{
  jsonrpc:'2.0',id:20,method:'tools/call',params:{name,arguments:args}
 },owner);
 const result=r.data?.result;
 return {status:r.status,data:result?.isError?
  {error:JSON.parse(result.content[0].text)}:result?.structuredContent??result};
}
const initialProposal={kind:'single',groups:[{
 title:'Сохранённый Y',events:[
  {key:'y',title:'Исходный Y',description:'OLD_DRAFT_TEXT'},
  {key:'z',title:'Соседний Z',description:'OLD_NEIGHBOR_TEXT'}
 ],relations:[{from:'y',to:'z',type:'precedes'}]
}]};
const iterationProposal={kind:'alternatives',groups:[
 {title:'Новый вариант 1',events:[
  {key:'x',title:'Свежий X',description:'Новая мотивация'}
 ],relations:[]},
 {title:'Новый вариант 2',events:[
  {key:'y',title:'Следующий Y',description:'Иная мотивация'},
  {key:'z',title:'Поворот Z',description:'Скрытое следствие'}
 ],relations:[{from:'y',to:'z',type:'enables'}]}
]};
const counters=(sql,id)=>({
 revision:sql.prepare('SELECT revision FROM plot_projects WHERE id=?').get(id).revision,
 history:sql.prepare('SELECT COUNT(*) n FROM plot_revisions WHERE project_id=?').get(id).n,
 receipts:sql.prepare('SELECT COUNT(*) n FROM cw_operation_receipts WHERE project_id=?').get(id).n
});
async function seeded(env){
 const id=await project(env);
 const noteArgs={project_id:id,note_id:'taskA',source_revision:0,
  generation_id:'InitialGenerationA11',proposal:initialProposal};
 const p=await mcp(env,'preview_note_drafts',noteArgs);
 assert.equal(p.status,200,JSON.stringify(p.data));
 assert.equal(p.data.saved,false);
 const saved=await mcp(env,'save_note_drafts',{...noteArgs,review_token:p.data.review_token});
 assert.equal(saved.data.saved,true,JSON.stringify(saved.data));
 const first=await call(env,'GET','/api/projects/'+id);
 const initial=first.data.graph;
 const workspace=initial.workspaces[0];
 const y=initial.nodes.find(n=>n.workspaceId===workspace.id&&n.title==='Исходный Y');
 assert.ok(y);
 return {id,workspaceId:workspace.id,yId:y.id,graph:initial};
}
const args=seed=>({
 project_id:seed.id,workspace_id:seed.workspaceId,node_ids:[seed.yId],
 source_revision:1,generation_id:'IterationGenerationB22',proposal:iterationProposal
});

test('MCP exposes four new tools without replacing note tools, and owner-only scoped reads',async()=>{
 const {db}=dbHarness(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},seed=await seeded(env);
 const all=await call(env,'POST','/mcp',{jsonrpc:'2.0',id:1,method:'tools/list'});
 const names=all.data.result.tools.map(t=>t.name);
 assert.equal(names.length,15);
 for(const n of ['get_note_task','save_note_drafts','list_saved_drafts',
    'get_saved_draft_task','preview_draft_iteration','save_draft_iteration'])
  assert.ok(names.includes(n));
 const found=await mcp(env,'list_saved_drafts',{project_id:seed.id,query:'Исходный'});
 assert.deepEqual(found.data.drafts.map(x=>x.node_id),[seed.yId]);
 assert.equal(found.data.revision,1);
 assert.equal(JSON.stringify(found.data).includes('OLD_DRAFT_TEXT'),false);
 const task=await mcp(env,'get_saved_draft_task',{
  project_id:seed.id,workspace_id:seed.workspaceId,node_ids:[seed.yId],neighbors:true
 });
 assert.equal(task.data.sourceDrafts[0].description,'OLD_DRAFT_TEXT');
 assert.equal(task.data.sameWorkspaceNeighbors.length,1);
 assert.equal(task.data.internalRelations[0].type,'precedes');
 assert.match(task.data.structureGuidance,/не навязывай три варианта/);
 assert.doesNotMatch(JSON.stringify(task.data),/PRIVATE_CANON_TEXT|SECRET_UNRELATED_NOTE/);
 assert.equal(task.data.revision,1);
 const denied=await mcp(env,'get_saved_draft_task',{
  project_id:seed.id,workspace_id:seed.workspaceId,node_ids:[seed.yId]
 },false);
 assert.equal(denied.data.error.error,'AUTH_REQUIRED');
 const regularProject=await mcp(env,'get_project',{project_id:seed.id,detail:'full'});
 assert.deepEqual(regularProject.data.graph.nodes.map(n=>n.id),['a','b']);
});

test('MCP preview is pure; approval token, save and replay preserve Y, old note and canon',async()=>{
 const {db,sql}=dbHarness(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},seed=await seeded(env);
 const request=args(seed),before=counters(sql,seed.id);
 const preview=await mcp(env,'preview_draft_iteration',request);
 assert.equal(preview.status,200,JSON.stringify(preview.data));
 assert.equal(preview.data.saved,false);
 assert.match(preview.data.review_token,/^[0-9a-f]{64}$/);
 assert.deepEqual(preview.data.summary.groupCount,2);
 assert.deepEqual(preview.data.summary.nodeCount,3);
 assert.equal(preview.data.draft_preview.events.length,3);
 assert.equal(preview.data.draft_preview.relations.length,1);
 assert.equal(preview.data.draft_preview.source_drafts_retained,true);
 assert.deepEqual(counters(sql,seed.id),before);
 const wrong=await mcp(env,'save_draft_iteration',{...request,review_token:'a'.repeat(64)});
 assert.match(wrong.data.error.message,/REVIEW_TOKEN_MISMATCH/);
 assert.deepEqual(counters(sql,seed.id),before);
 const ok={...request,review_token:preview.data.review_token};
 const saved=await mcp(env,'save_draft_iteration',ok);
 assert.equal(saved.status,200,JSON.stringify(saved.data));
 assert.equal(saved.data.saved,true);
 assert.equal(saved.data.replayed,false);
 assert.equal(saved.data.canon_changed,false);
 assert.equal(saved.data.source_drafts_retained,true);
 assert.deepEqual(counters(sql,seed.id),{revision:2,history:3,receipts:2});
 const retry=await mcp(env,'save_draft_iteration',ok);
 assert.equal(retry.data.replayed,true,JSON.stringify(retry.data));
 assert.deepEqual(counters(sql,seed.id),{revision:2,history:3,receipts:2});
 const actual=(await call(env,'GET','/api/projects/'+seed.id)).data.graph;
 assert.equal(actual.nodes.find(n=>n.id===seed.yId).description,'OLD_DRAFT_TEXT');
 assert.equal(actual.workspaces.find(w=>w.id===seed.workspaceId).taskId,'taskA');
 assert.equal(actual.gapNotes.some(n=>n.id==='taskA'),false);
 assert.equal(actual.gapNotes.some(n=>n.id==='taskB'),true);
 assert.equal(actual.workspaces.length,2);
 assert.equal(actual.nodes.filter(n=>n.workspaceId&&n.workspaceId!==seed.workspaceId).length,3);
 assert.equal(actual.edges.filter(e=>e.workspaceId&&e.workspaceId!==seed.workspaceId).length,1);
 const projection=await mcp(env,'get_project',{project_id:seed.id,detail:'full'});
 assert.deepEqual(projection.data.graph.nodes.map(n=>n.id),['a','b']);
 const secondPreview=await mcp(env,'preview_draft_iteration',request);
 assert.match(secondPreview.data.error.message,/REVISION_CONFLICT/);
});

test('MCP stale review, token/payload mismatch and foreign draft selection fail closed',async()=>{
 const {db,sql}=dbHarness(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},seed=await seeded(env);
 const request=args(seed),preview=await mcp(env,'preview_draft_iteration',request);
 assert.match(preview.data.review_token,/^[0-9a-f]{64}$/);
 const alien=await mcp(env,'get_saved_draft_task',{
  project_id:seed.id,workspace_id:seed.workspaceId,node_ids:['a']
 });
 assert.match(alien.data.error.message,/DRAFT_ITERATION_NOT_OWNED/);
 const other=await mcp(env,'preview_draft_iteration',{
  ...request,node_ids:['a']
 });
 assert.match(other.data.error.message,/DRAFT_ITERATION_NOT_OWNED/);
 const mismatch=await mcp(env,'save_draft_iteration',{
  ...request,proposal:{kind:'single',groups:[iterationProposal.groups[0]]},
  review_token:preview.data.review_token
 });
 assert.match(mismatch.data.error.message,/REVIEW_TOKEN_MISMATCH/);
 const modified=(await call(env,'GET','/api/projects/'+seed.id)).data;
 const graph=structuredClone(modified.graph);
 graph.nodes.find(n=>n.id==='a').description='Новое авторское решение';
 const put=await call(env,'PUT','/api/projects/'+seed.id,{
  name:modified.name,expectedRevision:1,graph,message:'synthetic author edit'
 });
 assert.equal(put.status,200,JSON.stringify(put.data));
 const stale=await mcp(env,'save_draft_iteration',{
  ...request,review_token:preview.data.review_token
 });
 assert.match(stale.data.error.message,/REVISION_CONFLICT/);
 assert.deepEqual(counters(sql,seed.id),{revision:2,history:3,receipts:1});
});

test('MCP rejects unknown fields, invalid identifiers, disabled workflow and missing receipts',async()=>{
 const {db,sql}=dbHarness(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},seed=await seeded(env);
 for(const [tool,values] of [
  ['list_saved_drafts',{project_id:seed.id,limit:100}],
  ['list_saved_drafts',{project_id:seed.id,workspace_id:'w99'}],
  ['get_saved_draft_task',{project_id:seed.id,workspace_id:seed.workspaceId,node_ids:[seed.yId],extra:'graph'}],
  ['get_saved_draft_task',{project_id:seed.id,workspace_id:seed.workspaceId,node_ids:[seed.yId,seed.yId]}],
  ['preview_draft_iteration',{...args(seed),generation_id:'short'}],
  ['preview_draft_iteration',{...args(seed),proposal:{...iterationProposal,secret:'inject'}}],
  ['save_draft_iteration',{...args(seed),review_token:'invalid'}]
 ]){
  const result=await mcp(env,tool,values);
  assert.ok(result.data.error,tool);
 }
 const origin=await call(env,'POST','/mcp',{
  jsonrpc:'2.0',id:3,method:'tools/call',
  params:{name:'save_draft_iteration',arguments:{
   ...args(seed),review_token:'a'.repeat(64)
  }}
 },true,'https://evil.example');
 assert.equal(origin.status,403);
 assert.deepEqual(counters(sql,seed.id),{revision:1,history:2,receipts:1});
 for(const flag of [false,true]){
  const fixture=dbHarness(flag),localEnv={DB:fixture.db,...(flag?{}:{CW_WORKFLOW_ENABLED:'true'})};
  const id=await project(localEnv);
  const list=await mcp(localEnv,'list_saved_drafts',{project_id:id});
  assert.equal(list.status,200,JSON.stringify(list.data));
  const preview=await mcp(localEnv,'preview_draft_iteration',{
   project_id:id,workspace_id:'no-workspace',node_ids:['y'],
   source_revision:0,generation_id:'SomeGenerationD33',proposal:iterationProposal
  });
  assert.ok(preview.data.error);
 }
});
