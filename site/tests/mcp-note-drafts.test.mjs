import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.mjs';

function storage(withReceipt=true){
 const sql=new DatabaseSync(':memory:');
 sql.exec('PRAGMA foreign_keys=ON;'+fs.readFileSync(new URL('../db/0001_initial.sql',import.meta.url),'utf8'));
 if(withReceipt)sql.exec('CREATE TABLE cw_operation_receipts (project_id TEXT NOT NULL,operation_id TEXT NOT NULL,request_hash TEXT NOT NULL,response_json TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(project_id,operation_id),FOREIGN KEY(project_id) REFERENCES plot_projects(id))');
 const db={
  prepare(statement){return {params:[],bind(...args){this.params=args;return this},
   run(){const r=sql.prepare(statement).run(...this.params);return {meta:{changes:Number(r.changes)}}},
   first(){return sql.prepare(statement).get(...this.params)??null},
   all(){return {results:sql.prepare(statement).all(...this.params)}}
  }},
  async batch(queries){sql.exec('BEGIN IMMEDIATE');try{
   const results=queries.map(q=>q.run());sql.exec('COMMIT');return results;
  }catch(e){sql.exec('ROLLBACK');throw e}}
 };
 return {sql,db};
}
function graph(){
 return {version:1,revision:0,view:null,nodes:[
  {id:'n1',title:'Причина',description:'Первые разногласия',x:100,y:100,parent:null},
  {id:'n2',title:'Конфликт',description:'Нерешённый вопрос',x:420,y:100,parent:null},
  {id:'n3',title:'Итог',description:'После переговоров',x:740,y:100,parent:null}
 ],edges:[
  {id:'e1',from:'n1',to:'n2',type:'precedes'},
  {id:'e2',from:'n2',to:'n3',type:'causes'}
 ],fields:[],lanes:[],gapNotes:[
  {id:'gn1',title:'Выбор наследника',text:'Предложи две разные идеи, не меняй канон',x:320,y:420,parent:null,status:'pending'},
  {id:'gn2',title:'SECRET_UNRELATED_NOTE',text:'Секретная отдельная заметка',x:2400,y:420,parent:null,status:'pending'}
 ],gapLinks:[{id:'gl1',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'n2'}}]};
}
async function call(env,method,path,body,owner=true,origin){
 const headers={};if(owner)headers['oai-authenticated-user-id']='synthetic-owner';
 if(body!==undefined)headers['Content-Type']='application/json';
 if(origin)headers.Origin=origin;
 const r=await worker.fetch(new Request('https://graphite.local'+path,{
  method,headers,body:body===undefined?undefined:JSON.stringify(body)
 }),env);
 const text=await r.text();
 return {status:r.status,data:text?JSON.parse(text):null};
}
async function make(env){
 const r=await call(env,'POST','/api/projects',{name:'Синтетическая история',graph:graph()});
 assert.equal(r.status,201,JSON.stringify(r.data));return r.data.id;
}
async function mcp(env,name,args,owner=true){
 const r=await call(env,'POST','/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}},owner);
 const answer=r.data.result;
 return {status:r.status,data:answer?.isError?{error:JSON.parse(answer.content[0].text)}:answer?.structuredContent??answer};
}
const proposal=()=>({kind:'alternatives',groups:[
 {title:'Поворот один',events:[{key:'a',title:'Свидетель передумывает',description:'Обнаружено противоречие'}],relations:[]},
 {title:'Поворот два',events:[
  {key:'b',title:'Тайный договор',description:'Есть новая улика'},
  {key:'c',title:'Открытое выступление',description:'Спор усиливается'}
 ],relations:[{from:'b',to:'c',type:'causes'}]}
]});
const values=(id,revision=0,generation='generationStableA1')=>({
 project_id:id,note_id:'gn1',source_revision:revision,generation_id:generation,proposal:proposal()
});
const counters=(sql,id)=>({
 revision:sql.prepare('SELECT revision FROM plot_projects WHERE id=?').get(id).revision,
 history:sql.prepare('SELECT COUNT(*) n FROM plot_revisions WHERE project_id=?').get(id).n,
 receipts:sql.prepare('SELECT COUNT(*) n FROM cw_operation_receipts WHERE project_id=?').get(id).n
});

test('new MCP tools are visible; owner can find and read bounded notes without revealing unrelated notes',async()=>{
 const {db}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await make(env);
 const list=await call(env,'POST','/mcp',{jsonrpc:'2.0',id:2,method:'tools/list'});
 assert.equal(list.status,200);
 const names=list.data.result.tools.map(t=>t.name);
 for(const name of ['list_note_tasks','get_note_task','preview_note_drafts','save_note_drafts'])assert.ok(names.includes(name));
 assert.equal(names.length,11);
 const found=await mcp(env,'list_note_tasks',{project_id:id,query:'наследника'});
 assert.deepEqual(found.data.notes.map(n=>n.id),['gn1']);
 assert.equal(found.data.revision,0);
 const task=await mcp(env,'get_note_task',{project_id:id,note_id:'gn1'});
 assert.equal(task.data.task.text,'Предложи две разные идеи, не меняй канон');
 assert.deepEqual(task.data.context.linkedStoryNodes.map(n=>n.id),['n1','n2','n3']);
 assert.match(task.data.structureGuidance,/не навязывай три варианта/);
 assert.ok(!JSON.stringify(task.data).includes('SECRET_UNRELATED_NOTE'));
 const denied=await mcp(env,'get_note_task',{project_id:id,note_id:'gn1'},false);
 assert.equal(denied.data.error.error,'AUTH_REQUIRED');
 const canon=await mcp(env,'get_project',{project_id:id,detail:'full'});
 assert.equal(Object.hasOwn(canon.data.graph,'gapNotes'),false);
});

test('preview never writes; save is reviewed, isolated, atomic and replay-safe',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await make(env);
 const args=values(id);
 const preview=await mcp(env,'preview_note_drafts',args);
 assert.equal(preview.status,200,JSON.stringify(preview.data));
 assert.equal(preview.data.saved,false);
 assert.match(preview.data.review_token,/^[0-9a-f]{64}$/);
 assert.deepEqual(preview.data.summary,{kind:'alternatives',groupCount:2,nodeCount:3,edgeCount:1});
 assert.equal(preview.data.draft_preview.events.length,3);
 assert.equal(preview.data.draft_preview.relations.length,1);
 assert.deepEqual(counters(sql,id),{revision:0,history:1,receipts:0});
 const wrong=await mcp(env,'save_note_drafts',{...args,review_token:'0'.repeat(64)});
 assert.equal(wrong.data.error.error,'TOOL_ERROR');
 assert.match(wrong.data.error.message,/REVIEW_TOKEN_MISMATCH/);
 assert.deepEqual(counters(sql,id),{revision:0,history:1,receipts:0});
 const approved={...args,review_token:preview.data.review_token};
 const saved=await mcp(env,'save_note_drafts',approved);
 assert.equal(saved.status,200,JSON.stringify(saved.data));
 assert.equal(saved.data.saved,true);
 assert.equal(saved.data.replayed,false);
 assert.equal(saved.data.canon_changed,false);
 assert.deepEqual(counters(sql,id),{revision:1,history:2,receipts:1});
 const replay=await mcp(env,'save_note_drafts',approved);
 assert.equal(replay.data.saved,true);
 assert.equal(replay.data.replayed,true);
 assert.deepEqual(counters(sql,id),{revision:1,history:2,receipts:1});
 const canon=await mcp(env,'get_project',{project_id:id,detail:'full'});
 assert.deepEqual(canon.data.graph.nodes.map(n=>n.id),['n1','n2','n3']);
 const project=await call(env,'GET','/api/projects/'+id);
 assert.equal(project.data.graph.workspaces.length,1);
 assert.equal(project.data.graph.nodes.filter(n=>n.workspaceId).length,3);
 assert.equal(project.data.graph.edges.filter(e=>e.workspaceId).length,1);
 assert.equal(project.data.graph.gapNotes[0].text,graph().gapNotes[0].text);
 const duplicate=await mcp(env,'preview_note_drafts',args);
 assert.match(duplicate.data.error.message,/WORKSPACE_CONFLICT|REVISION_CONFLICT/);
});

test('disabled workflow and missing receipt store fail closed, while note reads remain possible',async()=>{
 for(const config of [{withReceipt:true,flag:false},{withReceipt:false,flag:true}]){
  const {db,sql}=storage(config.withReceipt),env={DB:db,...(config.flag?{CW_WORKFLOW_ENABLED:'true'}:{})},id=await make(env);
  assert.equal((await mcp(env,'list_note_tasks',{project_id:id})).data.notes.length,2);
  const attempt=await mcp(env,'preview_note_drafts',values(id));
  assert.ok(attempt.data.error);
  assert.match(attempt.data.error.message,config.flag?/WORKFLOW_STORAGE_UNAVAILABLE/:/WORKFLOW_DISABLED/);
  const raw=sql.prepare('SELECT revision FROM plot_projects WHERE id=?').get(id);
  assert.equal(raw.revision,0);
 }
});

test('stale proposal never rebases or overwrites and only exact reviewed proposal can save',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await make(env),args=values(id);
 const preview=await mcp(env,'preview_note_drafts',args);
 assert.match(preview.data.review_token,/^[0-9a-f]{64}$/);
 const before=await call(env,'GET','/api/projects/'+id);
 const updated=structuredClone(before.data.graph);updated.nodes[0].description='Изменено автором';
 const changed=await call(env,'PUT','/api/projects/'+id,{
  name:before.data.name,expectedRevision:0,graph:updated,message:'author change'
 });
 assert.equal(changed.status,200);
 const stale=await mcp(env,'save_note_drafts',{...args,review_token:preview.data.review_token});
 assert.ok(stale.data.error);
 assert.match(stale.data.error.message,/REVISION_CONFLICT/);
 assert.deepEqual(counters(sql,id),{revision:1,history:2,receipts:0});
 const tampered=await mcp(env,'save_note_drafts',{...args,
  proposal:{kind:'single',groups:[proposal().groups[0]]},
  review_token:preview.data.review_token
 });
 assert.ok(tampered.data.error);
 assert.deepEqual(counters(sql,id),{revision:1,history:2,receipts:0});
});

test('invalid note requests, unknown fields and cross-origin writes cannot reach the workflow',async()=>{
 const {db,sql}=storage(),env={DB:db,CW_WORKFLOW_ENABLED:'true'},id=await make(env);
 for(const [name,args] of [
  ['list_note_tasks',{project_id:id,status:'strange'}],
  ['get_note_task',{project_id:id,note_id:'unknown'}],
  ['get_note_task',{project_id:id,note_id:'gn1',extra:'rawGraph'}],
  ['preview_note_drafts',{...values(id),generation_id:'bad'}],
  ['preview_note_drafts',{...values(id),proposal:{...proposal(),intrusive:'yes'}}],
  ['save_note_drafts',{...values(id),review_token:'wrong'}]
 ]){
  const r=await mcp(env,name,args);assert.ok(r.data.error,name);
 }
 const origin=await call(env,'POST','/mcp',{jsonrpc:'2.0',id:3,
  method:'tools/call',params:{name:'save_note_drafts',arguments:{...values(id),review_token:'0'.repeat(64)}}},
 true,'https://evil.example');
 assert.equal(origin.status,403);
 assert.deepEqual(counters(sql,id),{revision:0,history:1,receipts:0});
});
