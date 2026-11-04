import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.mjs';

function storage(receipts=true){
 const sql=new DatabaseSync(':memory:');
 sql.exec('PRAGMA foreign_keys=ON;'+fs.readFileSync(new URL('../db/0001_initial.sql',import.meta.url),'utf8'));
 if(receipts)sql.exec('CREATE TABLE cw_operation_receipts (project_id TEXT NOT NULL,operation_id TEXT NOT NULL,request_hash TEXT NOT NULL,response_json TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(project_id,operation_id),FOREIGN KEY(project_id) REFERENCES plot_projects(id))');
 const prepare=query=>({params:[],bind(...args){this.params=args;return this},
  run(){const v=sql.prepare(query).run(...this.params);return {meta:{changes:Number(v.changes)}}},
  first(){return sql.prepare(query).get(...this.params)??null},
  all(){return {results:sql.prepare(query).all(...this.params)}}
 });
 const db={prepare,async batch(statements){
  sql.exec('BEGIN IMMEDIATE');
  try{const result=statements.map(s=>s.run());sql.exec('COMMIT');return result}
  catch(e){sql.exec('ROLLBACK');throw e}
 }};
 return {sql,db};
}
const story=()=>({version:1,revision:0,view:null,
 nodes:[{id:'n1',title:'Начало',description:'',x:20,y:30,parent:null},
  {id:'n2',title:'Исходный поворот',description:'Старое решение',x:300,y:30,parent:null},
  {id:'n3',title:'Последствие',description:'',x:580,y:30,parent:null}],
 edges:[{id:'e1',from:'n1',to:'n2',type:'precedes'},{id:'e2',from:'n2',to:'n3',type:'causes'}],
 fields:[],lanes:[],gapNotes:[{id:'gn1',title:'Заметка',text:'Два пути.',x:100,y:400,parent:null,status:'pending'}],
 gapLinks:[{id:'gl1',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'n2'}}]
});
async function request(env,method,path,body,auth=true,extras={}){
 const headers=new Headers(extras);
 if(auth)headers.set('oai-authenticated-user-id','synthetic-owner');
 if(body!==undefined)headers.set('Content-Type','application/json');
 const res=await worker.fetch(new Request('https://plot.local'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 const raw=await res.text();return {status:res.status,data:raw?JSON.parse(raw):null};
}
const path=id=>'/api/projects/'+id+'/workflow/';
async function create(env){
 const r=await request(env,'POST','/api/projects',{name:'Synthetic',graph:story()});
 assert.equal(r.status,201,JSON.stringify(r.data));return r.data.id;
}
const stage=()=>({kind:'stage_note',noteId:'gn1',workspaceId:'w1',workspace:{x:90,y:450,width:950,height:480},
 branches:[{id:'a',title:'Ветка А',nodes:[{id:'draft-a',title:'Иной путь',x:130,y:510},{id:'draft-b',title:'Результат',x:400,y:510}],edges:[{id:'draft-ab',from:'draft-a',to:'draft-b',type:'precedes'}]},
  {id:'b',title:'Ветка Б',nodes:[{id:'draft-c',title:'Вариант',x:130,y:740}],edges:[]}]});
const preview=(env,id,revision,command)=>request(env,'POST',path(id)+'preview',{expectedRevision:revision,command});
async function apply(env,id,revision,operationId,command){
 const p=await preview(env,id,revision,command);
 assert.equal(p.status,200,JSON.stringify(p.data));
 return request(env,'POST',path(id)+'apply',{expectedRevision:revision,operationId,command:{...command,expectedPreview:p.data.preview}});
}
const graph=async(env,id)=>{const p=await request(env,'GET','/api/projects/'+id);assert.equal(p.status,200);return p.data};
const counts=(sql,id)=>({revision:sql.prepare('SELECT revision FROM plot_projects WHERE id=?').get(id).revision,
 history:sql.prepare('SELECT COUNT(*) n FROM plot_revisions WHERE project_id=?').get(id).n,
 receipts:sql.prepare('SELECT COUNT(*) n FROM cw_operation_receipts WHERE project_id=?').get(id).n});

test('new workflow routes are disabled by default, even when receipt table exists',async()=>{
 const {db}=storage(),env={DB:db},id=await create(env);
 const r=await preview(env,id,0,stage());assert.equal(r.status,404);assert.equal(r.data.error,'WORKFLOW_DISABLED');
});
test('opt-in refuses both preview and apply without a receipt table',async()=>{
 const {db,sql}=storage(false),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 const a=await preview(env,id,0,stage());
 const b=await request(env,'POST',path(id)+'apply',{expectedRevision:0,operationId:'op',command:{...stage(),expectedPreview:{}}});
 assert.equal(a.status,503);assert.equal(b.status,503);assert.equal(a.data.error,'WORKFLOW_STORAGE_UNAVAILABLE');
 assert.equal(sql.prepare('SELECT revision FROM plot_projects WHERE id=?').get(id).revision,0);
});
test('preview is read-only and unreviewed apply fails without a receipt',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 const p=await preview(env,id,0,stage());assert.equal(p.status,200,JSON.stringify(p.data));
 assert.deepEqual(p.data.preview.proposedNodes.map(n=>n.id),['draft-a','draft-b','draft-c']);
 assert.deepEqual(counts(sql,id),{revision:0,history:1,receipts:0});
 const a=await request(env,'POST',path(id)+'apply',{expectedRevision:0,operationId:'unreviewed',command:stage()});
 assert.equal(a.status,422);assert.equal(a.data.error,'COMMAND_INVALID');
 assert.deepEqual(counts(sql,id),{revision:0,history:1,receipts:0});
});
test('staging writes full editor graph while normal MCP full read remains canonical',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 const a=await apply(env,id,0,'stage',stage());assert.equal(a.status,200,JSON.stringify(a.data));
 assert.deepEqual(counts(sql,id),{revision:1,history:2,receipts:1});
 const g=await graph(env,id);assert.equal(g.graph.nodes.length,6);assert.equal(g.graph.workspaces[0].taskId,'gn1');
 const rpc=await request(env,'POST','/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_project',arguments:{project_id:id,detail:'full'}}});
 assert.equal(rpc.status,200);
 assert.deepEqual(rpc.data.result.structuredContent.graph.nodes.map(n=>n.id),['n1','n2','n3']);
 assert.equal(JSON.stringify(rpc.data).includes('draft-a'),false);
});
test('same operation replays; reused ID with altered command rejects without change',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 const c=stage(),p=await preview(env,id,0,c),body={expectedRevision:0,operationId:'stable',command:{...c,expectedPreview:p.data.preview}};
 const one=await request(env,'POST',path(id)+'apply',body),two=await request(env,'POST',path(id)+'apply',body);
 assert.equal(one.status,200);assert.equal(two.status,200);assert.equal(two.data.replayed,true);
 const bad=structuredClone(body);bad.command.branches[0].title='Новый заголовок';
 const diff=await request(env,'POST',path(id)+'apply',bad);
 assert.equal(diff.status,409);assert.equal(diff.data.error,'OPERATION_ID_REUSED');
 assert.deepEqual(counts(sql,id),{revision:1,history:2,receipts:1});
});
test('owner-only and origin checks cover opt-in endpoints',async()=>{
 const {db}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 const payload={expectedRevision:0,command:stage()};
 assert.equal((await request(env,'POST',path(id)+'preview',payload,false)).status,401);
 assert.equal((await request(env,'POST',path(id)+'preview',payload,true,{Origin:'https://evil.example'})).status,403);
 assert.equal((await request(env,'GET',path(id)+'preview')).status,405);
});
test('unknown fields, injected reviews and stale revisions fail before writing',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 for(const body of [{expectedRevision:0,command:stage(),baselineGraph:story()},
  {expectedRevision:0,command:{...stage(),expectedPreview:{}}},{expectedRevision:-1,command:stage()}]){
  const r=await request(env,'POST',path(id)+'preview',body);assert.equal(r.status,422,JSON.stringify(r.data));
 }
 const stale=await preview(env,id,1,stage());assert.equal(stale.status,409);
 assert.deepEqual(counts(sql,id),{revision:0,history:1,receipts:0});
});
test('whole stage→partial acceptance→replace→reconnect→complete succeeds via SQLite CAS',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 let r=await apply(env,id,0,'stage',stage());assert.equal(r.status,200,JSON.stringify(r.data));
 r=await apply(env,id,1,'accept',{kind:'accept_draft',workspaceId:'w1',nodeIds:['draft-a','draft-b']});
 assert.equal(r.status,200,JSON.stringify(r.data));
 let g=(await graph(env,id)).graph;
 assert.equal(g.nodes.find(n=>n.id==='draft-c').workspaceId,'w1');
 assert.equal(g.edges.find(e=>e.id==='draft-ab').workspaceId,undefined);
 r=await apply(env,id,2,'replace',{kind:'start_replacement',replacementId:'r1',sourceNodeIds:['n2']});
 assert.equal(r.status,200,JSON.stringify(r.data));
 g=(await graph(env,id)).graph;assert.equal(g.replacements[0].sourceGraphRevision,2);
 r=await apply(env,id,3,'reconnect',{kind:'reconnect',replacementId:'r1',decisions:[
  {edgeId:'e1',decision:'rewire',newEdge:{id:'new-e1',from:'n1',to:'draft-a',type:'precedes'}},
  {edgeId:'e2',decision:'rewire',newEdge:{id:'new-e2',from:'draft-b',to:'n3',type:'causes'}}
 ]});
 assert.equal(r.status,200,JSON.stringify(r.data));
 r=await apply(env,id,4,'complete',{kind:'complete',replacementId:'r1',acknowledgeUnresolved:false});
 assert.equal(r.status,200,JSON.stringify(r.data));
 assert.deepEqual(counts(sql,id),{revision:5,history:6,receipts:5});
 g=(await graph(env,id)).graph;assert.equal(g.replacements[0].state,'completed');
 assert.equal(g.nodes.find(n=>n.id==='n2').title,'Исходный поворот');
 const rpc=await request(env,'POST','/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_context',arguments:{project_id:id,node_ids:['n1'],neighbors:true}}});
 assert.equal(rpc.status,200);
 assert.deepEqual(rpc.data.result.structuredContent.edges.map(e=>e.id),['new-e1']);
 assert.equal(JSON.stringify(rpc.data).includes('draft-c'),false);
});
test('cancel uses trusted historical revision from DB, not client-supplied baseline',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 const r=await apply(env,id,0,'start',{kind:'start_replacement',replacementId:'r1',sourceNodeIds:['n2']});
 assert.equal(r.status,200,JSON.stringify(r.data));
 const done=await apply(env,id,1,'cancel',{kind:'cancel',replacementId:'r1'});
 assert.equal(done.status,200,JSON.stringify(done.data));
 assert.deepEqual((await graph(env,id)).graph.nodes.map(n=>n.id),['n1','n2','n3']);
 assert.deepEqual(counts(sql,id),{revision:2,history:3,receipts:2});
});
test('cancel after accepting an alternative is blocked without losing revisions',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 await apply(env,id,0,'stage',stage());
 await apply(env,id,1,'start',{kind:'start_replacement',replacementId:'r1',sourceNodeIds:['n2']});
 await apply(env,id,2,'accept',{kind:'accept_draft',workspaceId:'w1',nodeIds:['draft-a']});
 const before=await graph(env,id),cancel={kind:'cancel',replacementId:'r1'},p=await preview(env,id,3,cancel);
 assert.equal(p.status,200);assert.equal(p.data.preview.canCancel,false);
 const r=await request(env,'POST',path(id)+'apply',{expectedRevision:3,operationId:'cancel',command:{...cancel,expectedPreview:p.data.preview}});
 assert.equal(r.status,422);assert.equal(r.data.error,'RESTORE_CONFLICT');
 assert.deepEqual(await graph(env,id),before);assert.deepEqual(counts(sql,id),{revision:3,history:4,receipts:3});
});
test('receipt write failure rolls back new graph and history',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 sql.exec("CREATE TRIGGER refuse_cw BEFORE INSERT ON cw_operation_receipts BEGIN SELECT RAISE(ABORT,'blocked synthetic receipt'); END");
 const p=await preview(env,id,0,stage());assert.equal(p.status,200);
 const r=await request(env,'POST',path(id)+'apply',{expectedRevision:0,operationId:'fail',command:{...stage(),expectedPreview:p.data.preview}});
 assert.equal(r.status,500);assert.deepEqual(counts(sql,id),{revision:0,history:1,receipts:0});
});
test('old generic REST PUT cannot edit a draft staged by the opt-in command',async()=>{
 const {db}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 await apply(env,id,0,'stage',stage());
 const g=await graph(env,id);g.graph.nodes.find(n=>n.id==='draft-a').title='Неявное принятие';
 const r=await request(env,'PUT','/api/projects/'+id,{name:g.name,expectedRevision:1,graph:g.graph});
 assert.equal(r.status,422);assert.equal((await graph(env,id)).revision,1);
});


test('move_drafts is reviewed, persisted, and leaves ordinary MCP canon unchanged',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 await apply(env,id,0,'stage',stage());
 const before=(await graph(env,id)).graph;
 const command={kind:'move_drafts',workspaceId:'w1',moves:[
  {nodeId:'draft-a',x:240,y:620},{nodeId:'draft-b',x:490,y:620}
 ]};
 const previewResult=await preview(env,id,1,command);
 assert.equal(previewResult.status,200);
 assert.deepEqual(previewResult.data.preview.affectedDraftEdgeIds,['draft-ab']);
 assert.deepEqual(counts(sql,id),{revision:1,history:2,receipts:1});
 const result=await apply(env,id,1,'move',command);
 assert.equal(result.status,200,JSON.stringify(result.data));
 assert.deepEqual(counts(sql,id),{revision:2,history:3,receipts:2});
 const moved=(await graph(env,id)).graph;
 assert.equal(moved.nodes.find(n=>n.id==='draft-a').x,240);
 assert.equal(moved.nodes.find(n=>n.id==='draft-b').y,620);
 assert.deepEqual(moved.edges,before.edges);
 assert.deepEqual(moved.replacements??[],before.replacements??[]);
 const rpc=await request(env,'POST','/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',
  params:{name:'get_project',arguments:{project_id:id,detail:'full'}}});
 assert.equal(rpc.status,200);
 assert.deepEqual(rpc.data.result.structuredContent.graph.nodes.map(n=>n.id),['n1','n2','n3']);
});
test('duplicate move operation replays without moving again or creating extra receipt',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 await apply(env,id,0,'stage',stage());
 const command={kind:'move_drafts',workspaceId:'w1',moves:[{nodeId:'draft-a',x:240,y:620}]};
 const p=await preview(env,id,1,command);
 const body={expectedRevision:1,operationId:'stable-move',command:{...command,expectedPreview:p.data.preview}};
 const first=await request(env,'POST',path(id)+'apply',body);
 const replayed=await request(env,'POST',path(id)+'apply',body);
 assert.equal(first.status,200);assert.equal(replayed.status,200);
 assert.equal(replayed.data.replayed,true);
 const tampered=structuredClone(body);tampered.command.moves[0].x=260;
 const rejected=await request(env,'POST',path(id)+'apply',tampered);
 assert.equal(rejected.status,409);assert.equal(rejected.data.error,'OPERATION_ID_REUSED');
 assert.deepEqual(counts(sql,id),{revision:2,history:3,receipts:2});
});
test('stale move command is atomic and cannot partially relocate other draft nodes',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 await apply(env,id,0,'stage',stage());
 const first={kind:'move_drafts',workspaceId:'w1',moves:[{nodeId:'draft-a',x:220,y:570}]};
 const planned=await preview(env,id,1,first);
 await apply(env,id,1,'another-move',{kind:'move_drafts',workspaceId:'w1',
  moves:[{nodeId:'draft-b',x:460,y:560}]});
 const attempted=await request(env,'POST',path(id)+'apply',{
  expectedRevision:1,operationId:'old',command:{...first,expectedPreview:planned.data.preview}
 });
 assert.equal(attempted.status,409);assert.equal(attempted.data.error,'REVISION_CONFLICT');
 const saved=(await graph(env,id)).graph;
 assert.equal(saved.nodes.find(n=>n.id==='draft-a').x,130);
 assert.equal(saved.nodes.find(n=>n.id==='draft-b').x,460);
 assert.deepEqual(counts(sql,id),{revision:2,history:3,receipts:2});
});
test('legacy generic PUT still cannot update moved draft coordinates',async()=>{
 const {db}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await create(env);
 await apply(env,id,0,'stage',stage());
 await apply(env,id,1,'move',{kind:'move_drafts',workspaceId:'w1',
  moves:[{nodeId:'draft-a',x:230,y:610}]});
 const saved=await graph(env,id);const forged=structuredClone(saved.graph);
 forged.nodes.find(n=>n.id==='draft-a').x=260;
 const response=await request(env,'PUT','/api/projects/'+id,{
  name:saved.name,expectedRevision:2,graph:forged
 });
 assert.equal(response.status,422);
 assert.equal((await graph(env,id)).graph.nodes.find(n=>n.id==='draft-a').x,230);
});
