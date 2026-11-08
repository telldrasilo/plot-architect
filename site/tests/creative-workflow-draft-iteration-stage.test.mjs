import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {validateServerGraph,assertOrdinaryGraphWrite,assertOrdinaryGraphCreation} from '../src/creative_workflow_server_boundary.mjs';
import {canonicalProjection} from '../src/creative_workflow_contract.mjs';
import {previewStageDraftIteration,applyStageDraftIteration} from '../src/creative_workflow_draft_iteration_stage.mjs';
import {previewWorkflowCommand,commitWorkflowCommand} from '../src/creative_workflow_transactional_spike.mjs';

const story=()=>validateServerGraph({
 version:1,revision:0,view:null,
 nodes:[
  {id:'a',title:'Канон',x:0,y:0},
  {id:'y',title:'Старый черновик Y',description:'Оригинальный замысел',x:30,y:220,workspaceId:'w1',draftBranchId:'old-branch'},
  {id:'z',title:'Другой черновик',x:340,y:220,workspaceId:'w1',draftBranchId:'old-branch'}
 ],
 edges:[{id:'old-edge',from:'y',to:'z',type:'causes',workspaceId:'w1',draftBranchId:'old-branch',draftRelation:'internal'}],
 fields:[],lanes:[],workspaces:[{id:'w1',taskId:'consumed-note',x:0,y:180,width:670,height:290}],
 gapNotes:[]
});
const cmd=()=>({
 kind:'stage_draft_iteration',sourceWorkspaceId:'w1',sourceNodeIds:['y'],
 workspaceId:'w2',workspace:{x:780,y:180,width:600,height:300},
 branches:[{id:'iteration-1',title:'Вариант рядом',nodes:[
  {id:'new-y1',title:'Новое событие',description:'Другой ход',x:830,y:250},
  {id:'new-y2',title:'Дополнение',x:1110,y:250}
 ],edges:[{id:'new-edge',from:'new-y1',to:'new-y2',type:'precedes'}]}]
});
const reject=(fn,code)=>assert.throws(fn,e=>e?.code===code);

test('P1 saves new versions without overwriting Y, reviving note or changing canonical plot',()=>{
 const original=story(),before=canonicalProjection(original),command=cmd();
 const preview=previewStageDraftIteration(original,command);
 assert.deepEqual(preview.sourceNodeIds,['y']);
 assert.equal(preview.untouchedSource,true);
 const next=applyStageDraftIteration(original,{...command,expectedRevision:0,expectedPreview:preview}).graph;
 assert.deepEqual(canonicalProjection(next),before);
 assert.deepEqual(next.nodes.find(n=>n.id==='y'),original.nodes.find(n=>n.id==='y'));
 assert.deepEqual(next.edges.find(e=>e.id==='old-edge'),original.edges.find(e=>e.id==='old-edge'));
 assert.equal(next.gapNotes.length,0);
 assert.equal(next.workspaces.find(w=>w.id==='w1').taskId,'consumed-note');
 assert.deepEqual(next.workspaces.map(w=>w.id),['w1','w2']);
 assert.deepEqual(next.nodes.filter(n=>n.workspaceId==='w2').map(n=>n.id),['new-y1','new-y2']);
 assert.equal(next.edges.find(e=>e.id==='new-edge').workspaceId,'w2');
 assert.deepEqual(original,story());
 reject(()=>assertOrdinaryGraphWrite(original,next),'EXPLICIT_WORKFLOW_COMMAND_REQUIRED');
 reject(()=>assertOrdinaryGraphCreation(next),'EXPLICIT_WORKFLOW_COMMAND_REQUIRED');
});
test('P1 stale preview, wrong revision, reused IDs, foreign source and overlap fail safely',()=>{
 const g=story(),command=cmd(),p=previewStageDraftIteration(g,command);
 const changed=structuredClone(g);changed.nodes.find(n=>n.id==='y').description='Старый Y изменён';
 reject(()=>applyStageDraftIteration(changed,{...command,expectedRevision:0,expectedPreview:p}),'PREVIEW_STALE');
 reject(()=>applyStageDraftIteration(g,{...command,expectedRevision:2,expectedPreview:p}),'REVISION_CONFLICT');
 reject(()=>previewStageDraftIteration(g,{...command,sourceNodeIds:['a']}),'DRAFT_ITERATION_NOT_OWNED');
 reject(()=>previewStageDraftIteration(g,{...command,workspaceId:'w1'}),'ITERATION_WORKSPACE_CONFLICT');
 reject(()=>previewStageDraftIteration(g,{...command,workspace:{x:50,y:200,width:500,height:300}}),'ITERATION_OVERLAPPING_WORKSPACE');
 reject(()=>previewStageDraftIteration(g,{...command,branches:[{id:'dup',title:'Duplicate',nodes:[
  {id:'y',title:'Подмена Y',x:830,y:250}
 ],edges:[]}]}),'ITERATION_NODE_INVALID');
 reject(()=>previewStageDraftIteration(g,{...command,branches:[{id:'branch-2',title:'Invalid outside',nodes:[
  {id:'new-y',title:'One',x:830,y:250}
 ],edges:[{id:'edge-foreign',from:'new-y',to:'a',type:'precedes'}]}]}),'ITERATION_EDGE_INVALID');
});
function createDb(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON;'+fs.readFileSync(new URL('../db/0001_initial.sql',import.meta.url),'utf8'));
 sqlite.exec('CREATE TABLE cw_operation_receipts (project_id TEXT NOT NULL,operation_id TEXT NOT NULL,request_hash TEXT NOT NULL,response_json TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(project_id,operation_id),FOREIGN KEY(project_id) REFERENCES plot_projects(id))');
 const wrap=sql=>({params:[],bind(...args){this.params=args;return this},run(){
  const r=sqlite.prepare(sql).run(...this.params);return {meta:{changes:Number(r.changes)}}
 },first(){return sqlite.prepare(sql).get(...this.params)??null},all(){
  return {results:sqlite.prepare(sql).all(...this.params)}
 }});
 const db={prepare:wrap,async batch(statements){
  sqlite.exec('BEGIN IMMEDIATE');
  try{const r=statements.map(s=>s.run());sqlite.exec('COMMIT');return r}
  catch(e){sqlite.exec('ROLLBACK');throw e}
 }};
 const g=story(),json=JSON.stringify(g),time='2026-11-08T00:00:00Z';
 sqlite.prepare('INSERT INTO plot_projects(id,name,graph_json,revision,created_at,updated_at) VALUES(?,?,?,0,?,?)').run('test-project','P1',json,time,time);
 sqlite.prepare('INSERT INTO plot_revisions(project_id,revision,graph_json,message,created_at) VALUES(?,?,?,?,?)').run('test-project',0,json,'Initial',time);
 return {db,sqlite};
}
const stored=sqlite=>JSON.parse(sqlite.prepare('SELECT graph_json FROM plot_projects WHERE id=?').get('test-project').graph_json);
const counts=sqlite=>({
 revision:sqlite.prepare('SELECT revision FROM plot_projects').get().revision,
 revisions:sqlite.prepare('SELECT count(*) AS n FROM plot_revisions').get().n,
 receipts:sqlite.prepare('SELECT count(*) AS n FROM cw_operation_receipts').get().n
});
test('P1 reviewed SQLite stage records once with CAS, receipt replay and no note resurrection',async()=>{
 const {db,sqlite}=createDb(),before=canonicalProjection(story()),command=cmd();
 const p=await previewWorkflowCommand(db,{projectId:'test-project',expectedRevision:0,command});
 assert.equal(p.preview.canonicalChanged,false);
 const args={projectId:'test-project',expectedRevision:0,operationId:'iteration-op1',
  command:{...command,expectedPreview:p.preview}};
 const r=await commitWorkflowCommand(db,args);
 assert.equal(r.revision,1);
 assert.deepEqual(counts(sqlite),{revision:1,revisions:2,receipts:1});
 assert.deepEqual(canonicalProjection(stored(sqlite)),before);
 assert.equal(stored(sqlite).workspaces.length,2);
 assert.equal(stored(sqlite).gapNotes.length,0);
 assert.equal((await commitWorkflowCommand(db,args)).replayed,true);
 assert.deepEqual(counts(sqlite),{revision:1,revisions:2,receipts:1});
});
test('P1 receipt failure rolls back all staged new nodes/workspace',async()=>{
 const {db,sqlite}=createDb();
 sqlite.exec("CREATE TRIGGER block_iteration_receipt BEFORE INSERT ON cw_operation_receipts BEGIN SELECT RAISE(ABORT,'receipt blocked'); END");
 const command=cmd(),p=await previewWorkflowCommand(db,{projectId:'test-project',expectedRevision:0,command});
 await assert.rejects(()=>commitWorkflowCommand(db,{projectId:'test-project',expectedRevision:0,
  operationId:'iteration-op1',command:{...command,expectedPreview:p.preview}}),/receipt blocked/);
 assert.deepEqual(counts(sqlite),{revision:0,revisions:1,receipts:0});
 assert.deepEqual(stored(sqlite).workspaces.map(w=>w.id),['w1']);
});
