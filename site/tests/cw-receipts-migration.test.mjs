import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.mjs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const baseline=read('../drizzle/0001_initial.sql');
const receipts=read('../drizzle/0002_cw_operation_receipts.sql');
const journal=JSON.parse(read('../drizzle/meta/_journal.json'));
const fresh=()=>{const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON;'+baseline);return sql};
function adapter(sql){
 return {
  prepare(statement){return {params:[],bind(...params){this.params=params;return this},
   run(){const x=sql.prepare(statement).run(...this.params);return {meta:{changes:Number(x.changes)}}},
   first(){return sql.prepare(statement).get(...this.params)??null},
   all(){return {results:sql.prepare(statement).all(...this.params)}}
  }},
  async batch(actions){sql.exec('BEGIN IMMEDIATE');try{
   const out=actions.map(x=>x.run());sql.exec('COMMIT');return out;
  }catch(error){sql.exec('ROLLBACK');throw error}}
 };
}
const story=()=>({
 version:1,revision:0,view:null,
 nodes:[{id:'n1',title:'Исходная сцена',description:'Сюжетный факт',x:80,y:100,parent:null}],
 edges:[],fields:[],lanes:[],
 gapNotes:[{id:'note1',title:'Идея',text:'Предложи две разные линии развития',x:300,y:400,parent:null,status:'pending'}],
 gapLinks:[{id:'gl1',from:{kind:'gap_note',id:'note1'},to:{kind:'plot_node',id:'n1'}}]
});
async function call(db,method,path,body,enabled=false){
 const headers={'oai-authenticated-user-id':'synthetic-owner'};
 if(body!==undefined)headers['content-type']='application/json';
 const r=await worker.fetch(new Request('https://graphite.test'+path,{
  method,headers,body:body===undefined?undefined:JSON.stringify(body)
 }),{DB:db,...(enabled?{CW_WORKFLOW_ENABLED:'true'}:{})});
 return {status:r.status,data:await r.json()};
}
const path=id=>'/api/projects/'+id+'/workflow/';
const stage=()=>({kind:'stage_note',noteId:'note1',
 workspaceId:'workspace1',workspace:{x:200,y:500,width:720,height:400},
 branches:[
  {id:'branch1',title:'Первая идея',nodes:[
   {id:'draft1',title:'Новый поворот',description:'Часть альтернативы',x:240,y:550}
  ],edges:[]},
  {id:'branch2',title:'Другая идея',nodes:[
   {id:'draft2',title:'Иная причина',description:'Вторая альтернатива',x:490,y:550}
  ],edges:[]}
 ]});
const count=(sql,id)=>({
 revision:sql.prepare('SELECT revision FROM plot_projects WHERE id=?').get(id).revision,
 history:sql.prepare('SELECT COUNT(*) n FROM plot_revisions WHERE project_id=?').get(id).n,
 receipts:sql.prepare('SELECT COUNT(*) n FROM cw_operation_receipts WHERE project_id=?').get(id).n
});

test('migration is strictly additive, journaled, repeatable and retains existing story data',()=>{
 assert.deepEqual(journal.entries.map(e=>e.tag),['0001_initial','0002_cw_operation_receipts']);
 for(const sql of [baseline,receipts]){
  assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE|ALTER|UPDATE|REPLACE|INSERT)\b\s+(?:TABLE|FROM|INTO)?/i);
 }
 const sql=fresh(),before=sql.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name IN ('plot_projects','plot_revisions') ORDER BY name").all();
 const original={name:'История',graph:JSON.stringify(story()),date:'2026-11-04T00:00:00Z'};
 sql.prepare('INSERT INTO plot_projects (id,name,graph_json,revision,created_at,updated_at) VALUES (?,?,?,?,?,?)')
  .run('existing',original.name,original.graph,9,original.date,original.date);
 sql.prepare('INSERT INTO plot_revisions (project_id,revision,graph_json,message,created_at) VALUES (?,?,?,?,?)')
  .run('existing',9,original.graph,'Сохранённая версия',original.date);
 const oldProject=sql.prepare('SELECT * FROM plot_projects WHERE id=?').get('existing');
 const oldHistory=sql.prepare('SELECT * FROM plot_revisions WHERE project_id=?').all('existing');
 sql.exec(receipts);
 sql.exec(receipts); // IF NOT EXISTS must not lose data on repeat execution
 const after=sql.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name IN ('plot_projects','plot_revisions') ORDER BY name").all();
 assert.deepEqual(after,before);
 assert.deepEqual(sql.prepare('SELECT * FROM plot_projects WHERE id=?').get('existing'),oldProject);
 assert.deepEqual(sql.prepare('SELECT * FROM plot_revisions WHERE project_id=?').all('existing'),oldHistory);
 const columns=sql.prepare('PRAGMA table_info(cw_operation_receipts)').all();
 assert.deepEqual(columns.map(c=>c.name),['project_id','operation_id','request_hash','response_json','revision','created_at']);
 assert.deepEqual(columns.filter(c=>c.pk).map(c=>c.name),['project_id','operation_id']);
 assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
 assert.throws(()=>sql.prepare('INSERT INTO cw_operation_receipts VALUES (?,?,?,?,?,?)')
  .run('nonexistent','op','hash','{}',0,original.date));
 sql.close();
});

test('migration-backed preview→stage→partial author acceptance uses CAS, history and replay; canon stays isolated',async()=>{
 const sql=fresh();sql.exec(receipts);const db=adapter(sql);
 const created=await call(db,'POST','/api/projects',{name:'Новая синтетическая история',graph:story()});
 assert.equal(created.status,201,JSON.stringify(created.data));
 const id=created.data.id,command=stage();
 assert.deepEqual(count(sql,id),{revision:0,history:1,receipts:0});
 const closed=await call(db,'POST',path(id)+'preview',{expectedRevision:0,command});
 assert.equal(closed.status,404);assert.equal(closed.data.error,'WORKFLOW_DISABLED');
 const reviewed=await call(db,'POST',path(id)+'preview',{expectedRevision:0,command},true);
 assert.equal(reviewed.status,200,JSON.stringify(reviewed.data));
 assert.equal(reviewed.data.preview.proposedNodes.length,2);
 assert.deepEqual(count(sql,id),{revision:0,history:1,receipts:0});
 const body={expectedRevision:0,operationId:'generation1',command:{...command,expectedPreview:reviewed.data.preview}};
 const first=await call(db,'POST',path(id)+'apply',body,true);
 assert.equal(first.status,200,JSON.stringify(first.data));
 assert.equal(first.data.replayed,false);
 const replay=await call(db,'POST',path(id)+'apply',body,true);
 assert.equal(replay.status,200);assert.equal(replay.data.replayed,true);
 assert.deepEqual(count(sql,id),{revision:1,history:2,receipts:1});
 const project=await call(db,'GET','/api/projects/'+id);
 assert.equal(project.data.graph.nodes.filter(n=>n.workspaceId).length,2);
 assert.deepEqual(project.data.graph.gapNotes,story().gapNotes);
 const canon=await call(db,'POST','/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',
  params:{name:'get_project',arguments:{project_id:id,detail:'full'}}});
 assert.deepEqual(canon.data.result.structuredContent.graph.nodes.map(n=>n.id),['n1']);
 const accept={kind:'accept_draft',workspaceId:'workspace1',nodeIds:['draft1']};
 const planned=await call(db,'POST',path(id)+'preview',{expectedRevision:1,command:accept},true);
 assert.equal(planned.status,200,JSON.stringify(planned.data));
 const confirmed=await call(db,'POST',path(id)+'apply',{
  expectedRevision:1,operationId:'authorAccept1',
  command:{...accept,expectedPreview:planned.data.preview}
 },true);
 assert.equal(confirmed.status,200,JSON.stringify(confirmed.data));
 assert.deepEqual(count(sql,id),{revision:2,history:3,receipts:2});
 const final=await call(db,'GET','/api/projects/'+id);
 assert.deepEqual(final.data.graph.nodes.filter(n=>n.workspaceId).map(n=>n.id),['draft2']);
 assert.deepEqual(final.data.graph.gapNotes,story().gapNotes);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM cw_operation_receipts').get().n,2);
 assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
 sql.close();
});

test('receipt unique key, stale revision and failed write preserve all original rows',async()=>{
 const sql=fresh();sql.exec(receipts);const db=adapter(sql);
 const created=await call(db,'POST','/api/projects',{name:'Синтетическая проверка',graph:story()});
 const id=created.data.id,c=stage();
 const review=await call(db,'POST',path(id)+'preview',{expectedRevision:0,command:c},true);
 assert.equal(review.status,200);
 const payload={expectedRevision:0,operationId:'stable_id',command:{...c,expectedPreview:review.data.preview}};
 assert.equal((await call(db,'POST',path(id)+'apply',payload,true)).status,200);
 const mismatch={...payload,command:{...payload.command,branches:[
  {...payload.command.branches[0],title:'Другой вариант'},payload.command.branches[1]
 ]}};
 const reused=await call(db,'POST',path(id)+'apply',mismatch,true);
 assert.equal(reused.status,409);assert.equal(reused.data.error,'OPERATION_ID_REUSED');
 const stale=await call(db,'POST',path(id)+'apply',{...payload,operationId:'different_id'},true);
 assert.equal(stale.status,409);assert.equal(stale.data.error,'REVISION_CONFLICT');
 assert.deepEqual(count(sql,id),{revision:1,history:2,receipts:1});
 const row=sql.prepare('SELECT operation_id,request_hash,revision FROM cw_operation_receipts WHERE project_id=?').get(id);
 assert.equal(row.operation_id,'stable_id');assert.equal(row.revision,1);
 sql.close();
});
