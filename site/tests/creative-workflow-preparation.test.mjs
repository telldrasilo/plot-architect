import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {validateGraph} from '../src/graph_contract.mjs';
import {validateServerGraph,assertOrdinaryGraphWrite,assertOrdinaryGraphCreation,canonicalReadGraph} from '../src/creative_workflow_server_boundary.mjs';
import {canonicalProjection,previewReplacementStart} from '../src/creative_workflow_contract.mjs';
import {
  previewCreatePreparation,applyCreatePreparation,
  previewCancelPreparation,applyCancelPreparation
} from '../src/creative_workflow_preparation.mjs';
import {previewWorkflowCommand,commitWorkflowCommand} from '../src/creative_workflow_transactional_spike.mjs';

const story=()=>validateServerGraph({
 version:1,revision:0,view:null,fields:[],lanes:[],
 nodes:[
  {id:'A',title:'До',x:0,y:0},
  {id:'B',title:'Поворот',description:'Старый вариант',x:300,y:0},
  {id:'C',title:'После',x:600,y:0}
 ],
 edges:[
  {id:'in',from:'A',to:'B',type:'precedes'},
  {id:'out',from:'B',to:'C',type:'causes'}
 ]});
const begin=(g,id='p1')=>applyCreatePreparation(g,{
  preparationId:id,sourceNodeId:'B',
  expectedRevision:g.revision,
  expectedPreview:previewCreatePreparation(g,{sourceNodeId:'B'})
});
const reject=(fn,code)=>assert.throws(fn,e=>e?.code===code);

test('preparation start is canon-neutral, durable, and separate from CW-010',()=>{
 const g=story(),old=canonicalProjection(g),result=begin(g);
 assert.deepEqual(canonicalProjection(result.graph),old);
 assert.equal(result.graph.replacements,undefined);
 assert.equal(result.graph.gapNotes,undefined);
 assert.equal(result.graph.eventRewrites,undefined);
 const p=result.graph.replacementPreparations[0];
 assert.deepEqual({id:p.id,state:p.state,sourceNodeId:p.sourceNodeId,sourceRevision:p.sourceRevision},
   {id:'p1',state:'open',sourceNodeId:'B',sourceRevision:0});
 assert.deepEqual(p.incidentEdges.map(e=>e.id),['in','out']);
 assert.deepEqual(p.candidateSelections,[]);
 assert.deepEqual(p.edgeDecisions,[]);
 assert.deepEqual(canonicalProjection(JSON.parse(JSON.stringify(result.graph))),old);
 assert.deepEqual(canonicalReadGraph(result.graph),canonicalReadGraph(g));
});
test('repeated start, legacy conflict, nested sources and stale review fail closed',()=>{
 const g=story(),p=previewCreatePreparation(g,{sourceNodeId:'B'});
 const later=structuredClone(g);later.edges[1].type='hinders';
 reject(()=>applyCreatePreparation(later,{sourceNodeId:'B',preparationId:'p',expectedPreview:p,expectedRevision:0}),'PREVIEW_STALE');
 const prepared=begin(g).graph;
 reject(()=>previewCreatePreparation(prepared,{sourceNodeId:'B'}),'PREPARATION_CONFLICT');
 reject(()=>previewReplacementStart(prepared,['B']),'PREPARATION_CONFLICT');
 const nested=story();nested.nodes.push({id:'child',title:'Внутри',parent:'B',x:1,y:1});
 reject(()=>previewCreatePreparation(nested,{sourceNodeId:'B'}),'PREPARATION_NESTED_SOURCE');
 const protectedSource=story();protectedSource.nodes[1].protected=true;
 reject(()=>previewCreatePreparation(protectedSource,{sourceNodeId:'B'}),'PREPARATION_PROTECTED_SOURCE');
 // approved is a normal default and must not block ordinary stories.
 assert.equal(g.nodes[1].status,'approved');
 assert.equal(previewCreatePreparation(g,{sourceNodeId:'B'}).sourceNodeId,'B');
});
test('ordinary PUT/import cannot forge or delete a preparation',()=>{
 const g=story(),p=begin(g).graph;
 reject(()=>assertOrdinaryGraphCreation(p),'EXPLICIT_WORKFLOW_COMMAND_REQUIRED');
 reject(()=>assertOrdinaryGraphWrite(g,p),'EXPLICIT_WORKFLOW_COMMAND_REQUIRED');
 reject(()=>assertOrdinaryGraphWrite(p,g),'EXPLICIT_WORKFLOW_COMMAND_REQUIRED');
 const tampered=structuredClone(p);tampered.replacementPreparations[0].state='applied';
 reject(()=>assertOrdinaryGraphWrite(p,tampered),'EXPLICIT_WORKFLOW_COMMAND_REQUIRED');
 const edited=structuredClone(p);edited.nodes.find(n=>n.id==='B').description='Новая трактовка';
 assert.equal(assertOrdinaryGraphWrite(p,edited).nodes.find(n=>n.id==='B').description,'Новая трактовка');
 const removed=structuredClone(p);removed.nodes=removed.nodes.filter(n=>n.id!=='B');
 removed.edges=removed.edges.filter(e=>e.from!=='B'&&e.to!=='B');
 reject(()=>assertOrdinaryGraphWrite(p,removed),'PREPARATION_SOURCE_MISSING');
});
test('cancel is a separate reviewed command; canon stays exactly the same',()=>{
 const g=begin(story()).graph,old=canonicalProjection(g);
 const expectedPreview=previewCancelPreparation(g,{preparationId:'p1'});
 const result=applyCancelPreparation(g,{preparationId:'p1',expectedRevision:0,expectedPreview});
 assert.equal(result.graph.replacementPreparations[0].state,'cancelled');
 assert.deepEqual(canonicalProjection(result.graph),old);
 assert.equal(result.changes.retainsDrafts,true);
 reject(()=>previewCancelPreparation(result.graph,{preparationId:'p1'}),'PREPARATION_NOT_OPEN');
 assert.doesNotThrow(()=>previewCreatePreparation(result.graph,{sourceNodeId:'B'}));
});

function sqliteDb(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON;'+fs.readFileSync(new URL('../db/0001_initial.sql',import.meta.url),'utf8'));
 sqlite.exec('CREATE TABLE cw_operation_receipts (project_id TEXT NOT NULL, operation_id TEXT NOT NULL, request_hash TEXT NOT NULL, response_json TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(project_id,operation_id), FOREIGN KEY(project_id) REFERENCES plot_projects(id))');
 const wrap=sql=>({params:[],bind(...args){this.params=args;return this},
   run(){const r=sqlite.prepare(sql).run(...this.params);return {meta:{changes:Number(r.changes)}}},
   first(){return sqlite.prepare(sql).get(...this.params)??null},
   all(){return {results:sqlite.prepare(sql).all(...this.params)}}
 });
 const db={prepare:wrap,async batch(statements){
   sqlite.exec('BEGIN IMMEDIATE');
   try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results}
   catch(e){sqlite.exec('ROLLBACK');throw e}
 }};
 const graph=validateGraph(story()),ts='2026-11-08T00:00:00Z',json=JSON.stringify(graph);
 sqlite.prepare('INSERT INTO plot_projects (id,name,graph_json,revision,created_at,updated_at) VALUES (?,?,?,0,?,?)').run('project-1','Synthetic',json,ts,ts);
 sqlite.prepare('INSERT INTO plot_revisions (project_id,revision,graph_json,message,created_at) VALUES (?,?,?,?,?)').run('project-1',0,json,'Create',ts);
 return {db,sqlite};
}
const stored=sqlite=>JSON.parse(sqlite.prepare('SELECT graph_json FROM plot_projects WHERE id=?').get('project-1').graph_json);
const counts=sqlite=>({
 revision:sqlite.prepare('SELECT revision FROM plot_projects WHERE id=?').get('project-1').revision,
 history:sqlite.prepare('SELECT count(*) AS n FROM plot_revisions').get().n,
 receipts:sqlite.prepare('SELECT count(*) AS n FROM cw_operation_receipts').get().n
});
test('SQLite guarded preview/start/replay/cancel records atomic history and receipts',async()=>{
 const {db,sqlite}=sqliteDb(),g=stored(sqlite),before=canonicalProjection(g);
 const command={kind:'create_preparation',sourceNodeId:'B',preparationId:'p1'};
 const preview=await previewWorkflowCommand(db,{projectId:'project-1',expectedRevision:0,command});
 const args={projectId:'project-1',expectedRevision:0,operationId:'op-start',command:{...command,expectedPreview:preview.preview}};
 const first=await commitWorkflowCommand(db,args);
 assert.equal(first.revision,1);
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
 assert.deepEqual(canonicalProjection(stored(sqlite)),before);
 assert.equal((await commitWorkflowCommand(db,args)).replayed,true);
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
 const cancel={kind:'cancel_preparation',preparationId:'p1'};
 const p2=await previewWorkflowCommand(db,{projectId:'project-1',expectedRevision:1,command:cancel});
 const last=await commitWorkflowCommand(db,{projectId:'project-1',expectedRevision:1,
   operationId:'op-cancel',command:{...cancel,expectedPreview:p2.preview}});
 assert.equal(last.revision,2);
 assert.deepEqual(counts(sqlite),{revision:2,history:3,receipts:2});
 assert.deepEqual(canonicalProjection(stored(sqlite)),before);
 assert.equal(stored(sqlite).replacementPreparations[0].state,'cancelled');
});
test('failed receipt insertion rolls back preparation and history together',async()=>{
 const {db,sqlite}=sqliteDb();
 sqlite.exec("CREATE TRIGGER reject_receipt BEFORE INSERT ON cw_operation_receipts BEGIN SELECT RAISE(ABORT,'blocked receipt'); END");
 const c={kind:'create_preparation',sourceNodeId:'B',preparationId:'p1'};
 const p=await previewWorkflowCommand(db,{projectId:'project-1',expectedRevision:0,command:c});
 await assert.rejects(()=>commitWorkflowCommand(db,{projectId:'project-1',expectedRevision:0,
  operationId:'op-start',command:{...c,expectedPreview:p.preview}}),/blocked receipt/);
 assert.deepEqual(counts(sqlite),{revision:0,history:1,receipts:0});
 assert.equal(stored(sqlite).replacementPreparations,undefined);
});
