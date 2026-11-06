import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.mjs';
import {validateServerGraph,canonicalReadGraph} from '../src/creative_workflow_server_boundary.mjs';
import {listNoteTasks} from '../src/creative_workflow_note_context.mjs';
import {prepareNoteProcessingTask,prepareNoteStageWrite} from '../src/creative_workflow_note_handoff.mjs';

const copy=x=>structuredClone(x);
const rejected=(fn,code)=>assert.throws(fn,e=>e?.code===code);
const PROJECT='synthetic-note-handoff';
function graph(){
 return validateServerGraph({
  version:1,revision:0,view:null,
  nodes:[
   {id:'n1',title:'Первые переговоры',description:'Начались',x:0,y:40,parent:null},
   {id:'n2',title:'Политический конфликт',description:'Старый спор',x:300,y:40,parent:null},
   {id:'n3',title:'Следствие',description:'Стороны расходятся',x:600,y:40,parent:null},
   {id:'nRet',title:'SECRET_RETIRED',description:'Приостановленная версия',x:900,y:40,parent:null},
   {id:'draftOld',title:'SECRET_DRAFT',description:'Неучтённый черновик',x:1000,y:700,parent:null,workspaceId:'wold',draftBranchId:'old'}
  ],
  edges:[
   {id:'e1',from:'n1',to:'n2',type:'precedes'},
   {id:'e2',from:'n2',to:'n3',type:'causes'},
   {id:'eRet',from:'nRet',to:'n3',type:'causes'}
  ],
  fields:[{id:'f1',title:'Переговоры',comment:'Контекст исходной сцены',x:0,y:0,width:920,height:200}],
  lanes:[],
  gapNotes:[
   {id:'gn1',title:'Конфликт наследников',text:'Предложи четыре разные идеи развития, число событий в каждой — по смыслу',x:250,y:410,parent:null,status:'pending'},
   {id:'gn2',title:'SECRET_UNRELATED_NOTE',text:'Скрытая редакторская мысль',x:2000,y:400,parent:null,status:'pending'}
  ],
  gapLinks:[
   {id:'gl1',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'n2'}},
   {id:'gl2',from:{kind:'gap_note',id:'gn1'},to:{kind:'semantic_field',id:'f1'}},
   {id:'gl3',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'nRet'}},
   {id:'gl4',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'draftOld'}}
  ],
  workspaces:[{id:'wold',taskId:'gn2',x:900,y:620,width:480,height:400}],
  replacements:[{id:'r0',state:'open',sourceNodeIds:['nRet'],suspendedEdgeIds:['eRet'],sourceGraphRevision:0}]
 });
}
const event=(key,title)=>({key,title,description:'Лаконичный сюжетный блок'});
const alternatives=()=>({kind:'alternatives',groups:[1,3,2,1].map((length,i)=>({
 title:'Идея '+(i+1),
 events:Array.from({length},(_,j)=>event('e'+j,'Событие '+(i+1)+'.'+(j+1))),
 relations:Array.from({length:length-1},(_,j)=>({from:'e'+j,to:'e'+(j+1),type:'causes'}))
}))});
function storage(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('PRAGMA foreign_keys=ON;'+fs.readFileSync(new URL('../db/0001_initial.sql',import.meta.url),'utf8'));
 sql.exec('CREATE TABLE cw_operation_receipts (project_id TEXT NOT NULL,operation_id TEXT NOT NULL,request_hash TEXT NOT NULL,response_json TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(project_id,operation_id),FOREIGN KEY(project_id) REFERENCES plot_projects(id))');
 const prepare=statement=>({params:[],bind(...args){this.params=args;return this},
  run(){const r=sql.prepare(statement).run(...this.params);return {meta:{changes:Number(r.changes)}}},
  first(){return sql.prepare(statement).get(...this.params)??null},
  all(){return {results:sql.prepare(statement).all(...this.params)}}
 });
 const db={prepare,async batch(actions){
  sql.exec('BEGIN IMMEDIATE');
  try{const out=actions.map(a=>a.run());sql.exec('COMMIT');return out}
  catch(error){sql.exec('ROLLBACK');throw error}
 }};
 return {sql,db};
}
function seed(sql,raw=graph()){
 const now='2026-11-04T16:00:00Z',serial=JSON.stringify(raw);
 sql.prepare('INSERT INTO plot_projects (id,name,graph_json,revision,created_at,updated_at) VALUES (?,?,?,0,?,?)')
   .run(PROJECT,'Синтетический сюжет',serial,now,now);
 sql.prepare('INSERT INTO plot_revisions (project_id,revision,graph_json,message,created_at) VALUES (?,?,?,?,?)')
   .run(PROJECT,0,serial,'Создание',now);
}
const current=sql=>{
 const row=sql.prepare('SELECT graph_json,revision FROM plot_projects WHERE id=?').get(PROJECT);
 const g=validateServerGraph(JSON.parse(row.graph_json));g.revision=row.revision;return g;
};
const counters=sql=>({
 revision:sql.prepare('SELECT revision FROM plot_projects WHERE id=?').get(PROJECT).revision,
 history:sql.prepare('SELECT COUNT(*) n FROM plot_revisions WHERE project_id=?').get(PROJECT).n,
 receipts:sql.prepare('SELECT COUNT(*) n FROM cw_operation_receipts WHERE project_id=?').get(PROJECT).n
});
async function request(db,method,path,body,flag=true){
 const headers=new Headers({'oai-authenticated-user-id':'synthetic-owner'});
 if(body!==undefined)headers.set('Content-Type','application/json');
 const r=await worker.fetch(
  new Request('https://plot.local'+path,{method,headers,
   body:body===undefined?undefined:JSON.stringify(body)}),
  {DB:db,...(flag?{CW_WORKFLOW_ENABLED:'true'}:{})}
 );
 const raw=await r.text();
 return {status:r.status,data:raw?JSON.parse(raw):null};
}
const url='/api/projects/'+PROJECT+'/workflow/';
const preview=(db,revision,command)=>request(db,'POST',url+'preview',{expectedRevision:revision,command});
const apply=(db,revision,operationId,command)=>request(db,'POST',url+'apply',{expectedRevision:revision,operationId,command});

test('one complete synthetic note → ChatGPT-shaped answer → draft area → author picks nodes',async()=>{
 const {sql,db}=storage();seed(sql);
 const source=current(sql),original=copy(source),canonicalBefore=canonicalReadGraph(source);
 const found=listNoteTasks(source,{query:'наследников'});
 assert.deepEqual(found.notes.map(n=>n.id),['gn1']);
 const task=prepareNoteProcessingTask(source,{noteId:found.notes[0].id});
 assert.equal(task.revision,0);
 assert.match(task.structureGuidance,/не сжимай сюжет ради экономии/);
 assert.deepEqual(task.context.linkedStoryNodes.map(n=>n.id),['n1','n2','n3']);
 assert.deepEqual(task.context.linkedFields.map(f=>f.id),['f1']);
 const message=JSON.stringify(task);
 for(const secret of ['SECRET_DRAFT','SECRET_RETIRED','SECRET_UNRELATED_NOTE'])
  assert.ok(!message.includes(secret),'No hidden story or unrelated note in creative input: '+secret);
 const prepared=prepareNoteStageWrite(source,{
  noteId:'gn1',sourceRevision:task.revision,generationId:'generationStable0001',
  proposal:alternatives()
 });
 assert.equal(prepared.expectedRevision,0);
 assert.equal(prepared.operationId,'generationStable0001');
 assert.deepEqual(prepared.summary,{kind:'alternatives',groupCount:4,nodeCount:7,edgeCount:3});
 assert.deepEqual(prepared.command.branches.map(b=>b.nodes.length),[1,3,2,1]);
 assert.deepEqual(current(sql),original,'preparation does not write');
 const review=await preview(db,prepared.expectedRevision,prepared.command);
 assert.equal(review.status,200,JSON.stringify(review.data));
 assert.equal(review.data.preview.proposedNodes.length,7);
 assert.equal(review.data.preview.proposedEdges.length,3);
 assert.deepEqual(counters(sql),{revision:0,history:1,receipts:0});
 const reviewedCommand={...prepared.command,expectedPreview:review.data.preview};
 const first=await apply(db,0,prepared.operationId,reviewedCommand);
 assert.equal(first.status,200,JSON.stringify(first.data));
 const again=await apply(db,0,prepared.operationId,reviewedCommand);
 assert.equal(again.status,200);assert.equal(again.data.replayed,true);
 assert.deepEqual(counters(sql),{revision:1,history:2,receipts:1});
 const staged=current(sql);
 assert.deepEqual(canonicalReadGraph(staged),{...canonicalBefore,revision:1});
 assert.deepEqual(staged.gapNotes,original.gapNotes.filter(n=>n.id!=='gn1'));
 assert.deepEqual(staged.gapLinks,original.gapLinks.filter(l=>
  !(l.from?.kind==='gap_note'&&l.from.id==='gn1')&&
  !(l.to?.kind==='gap_note'&&l.to.id==='gn1')));
 assert.equal(staged.workspaces.length,2);
 assert.equal(staged.nodes.filter(n=>n.workspaceId===prepared.command.workspaceId).length,7);
 assert.equal(staged.edges.filter(e=>e.workspaceId===prepared.command.workspaceId).length,3);
 const fullMcp=await request(db,'POST','/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',
  params:{name:'get_project',arguments:{project_id:PROJECT,detail:'full'}}});
 assert.equal(fullMcp.status,200);
 assert.deepEqual(fullMcp.data.result.structuredContent.graph.nodes.map(n=>n.id),['n1','n2','n3']);
 assert.ok(!JSON.stringify(fullMcp.data).includes('Событие 1.1'));
 rejected(()=>prepareNoteProcessingTask(staged,{noteId:'gn1'}),'WORKSPACE_CONFLICT');
 rejected(()=>prepareNoteStageWrite(staged,{
  noteId:'gn1',sourceRevision:0,generationId:'anotherGeneration1',proposal:alternatives()
 }),'REVISION_CONFLICT');
 // Author selects two of the three linked nodes of group 2, not all
 // alternatives. Their internal connection becomes canonical; the other
 // five proposals remain draft, and external original arrows stay intact.
 const group=prepared.command.branches[1],chosen=group.nodes.slice(0,2).map(n=>n.id);
 const acceptance={kind:'accept_draft',workspaceId:prepared.command.workspaceId,nodeIds:chosen};
 const review2=await preview(db,1,acceptance);
 assert.equal(review2.status,200);
 assert.equal(review2.data.preview.promoteEdgeIds.length,1);
 const saved=await apply(db,1,'authorAcceptance0001',{...acceptance,expectedPreview:review2.data.preview});
 assert.equal(saved.status,200,JSON.stringify(saved.data));
 assert.deepEqual(counters(sql),{revision:2,history:3,receipts:2});
 const resulting=current(sql);
 const canon=canonicalReadGraph(resulting);
 assert.equal(canon.nodes.length,5);
 assert.equal(canon.edges.length,3);
 assert.equal(resulting.nodes.filter(n=>n.workspaceId===prepared.command.workspaceId).length,5);
 assert.equal(resulting.edges.filter(e=>e.workspaceId===prepared.command.workspaceId).length,2);
 assert.deepEqual(resulting.gapNotes,staged.gapNotes);
 assert.deepEqual(resulting.replacements,original.replacements);
});
test('one idea can be one concise event; no forced three alternatives',async()=>{
 const {sql,db}=storage();seed(sql);
 const source=current(sql),task=prepareNoteProcessingTask(source,{noteId:'gn1'});
 const plan=prepareNoteStageWrite(source,{noteId:'gn1',sourceRevision:task.revision,
  generationId:'generationSingle0002',
  proposal:{kind:'single',groups:[{title:'Одна сюжетная идея',
    events:[event('a','Новый необычный поворот')],relations:[]}]}
 });
 assert.equal(plan.summary.groupCount,1);assert.equal(plan.summary.nodeCount,1);
 const review=await preview(db,0,plan.command);
 assert.equal(review.status,200);
 const applied=await apply(db,0,plan.operationId,{...plan.command,expectedPreview:review.data.preview});
 assert.equal(applied.status,200);
 assert.equal(current(sql).nodes.filter(n=>n.workspaceId===plan.command.workspaceId).length,1);
 assert.equal(canonicalReadGraph(current(sql)).nodes.length,3);
});
test('stale generation fails without partial write; disabled server switch remains off',async()=>{
 const {sql,db}=storage();seed(sql);
 const source=current(sql),task=prepareNoteProcessingTask(source,{noteId:'gn1'});
 const prepared=prepareNoteStageWrite(source,{noteId:'gn1',sourceRevision:task.revision,
  generationId:'generationConflict0003',proposal:alternatives()});
 const unavailable=await request(db,'POST',url+'preview',{expectedRevision:0,command:prepared.command},false);
 assert.equal(unavailable.status,404);
 assert.equal(unavailable.data.error,'WORKFLOW_DISABLED');
 const bad={...alternatives(),intrusiveStatus:'approved'};
 rejected(()=>prepareNoteStageWrite(source,{noteId:'gn1',sourceRevision:task.revision,
  generationId:'generationBad0004',proposal:bad}),'PROPOSAL_INVALID');
 assert.deepEqual(counters(sql),{revision:0,history:1,receipts:0});
 const first=await preview(db,0,prepared.command);assert.equal(first.status,200);
 const altered=structuredClone(source);altered.nodes[0].description='Позднейшее изменение';
 const oldTime='2026-11-04T16:00:00Z';
 sql.prepare('UPDATE plot_projects SET graph_json=?,revision=1,updated_at=? WHERE id=?')
  .run(JSON.stringify({...altered,revision:1}),oldTime,PROJECT);
 const late=await apply(db,0,prepared.operationId,{...prepared.command,expectedPreview:first.data.preview});
 assert.equal(late.status,409);assert.equal(late.data.error,'REVISION_CONFLICT');
 assert.equal(current(sql).workspaces.length,1);
 assert.equal(current(sql).nodes.filter(n=>n.workspaceId===prepared.command.workspaceId).length,0);
 assert.equal(counters(sql).receipts,0);
});
