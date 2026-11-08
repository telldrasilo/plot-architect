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

import {previewApplyPreparation,applyPreparation} from '../src/creative_workflow_preparation_apply.mjs';

function readyGraph({selectAll=false}={}){
 const original=story();
 original.workspaces=[{id:'w1',taskId:'old-task',x:50,y:200,width:750,height:270}];
 original.nodes.push(
  {id:'X',title:'Новый X',x:120,y:260,workspaceId:'w1'},
  {id:'Y',title:'Новый Y',x:390,y:260,workspaceId:'w1'},
  {id:'Z',title:'Невыбранный Z',x:650,y:260,workspaceId:'w1'});
 original.edges.push(
  {id:'xy',from:'X',to:'Y',type:'precedes',workspaceId:'w1',draftRelation:'internal'},
  {id:'yz',from:'Y',to:'Z',type:'causes',workspaceId:'w1',draftRelation:'internal'});
 const g=begin(validateServerGraph(original)).graph;
 const p=g.replacementPreparations[0];
 p.candidateSelections=(selectAll?['X','Y','Z']:['X','Y']).map(nodeId=>({nodeId,workspaceId:'w1'}));
 p.edgeDecisions=[
  {edgeId:'in',decision:'rewire',newEdge:{id:'new-in',from:'A',to:'X',type:'precedes'}},
  {edgeId:'out',decision:'drop'}
 ];
 return validateServerGraph(g);
}
test('pure full-graph apply retires B only at commit, preserves history and unresolved Y→Z draft edge',()=>{
 const g=readyGraph(),before=canonicalProjection(g);
 assert.deepEqual(before.nodes.map(n=>n.id),['A','B','C']);
 const preview=previewApplyPreparation(g,{preparationId:'p1'});
 assert.deepEqual(preview.promoteEdgeIds,['xy']);
 assert.deepEqual(preview.editorialBoundaryEdgeIds,['yz']);
 assert.deepEqual(preview.retainedDraftIds,['Z']);
 const applied=applyPreparation(g,{preparationId:'p1',expectedRevision:0,expectedPreview:preview});
 assert.equal(g.replacementPreparations[0].state,'open');
 assert.equal(applied.graph.replacementPreparations[0].state,'applied');
 const now=canonicalProjection(applied.graph);
 assert.deepEqual(now.nodes.map(n=>n.id),['A','C','X','Y']);
 assert.deepEqual(now.edges.map(e=>e.id),['xy','new-in']);
 assert.equal(applied.graph.nodes.find(n=>n.id==='B').title,'Поворот');
 assert.deepEqual(applied.graph.edges.filter(e=>['in','out'].includes(e.id)),g.edges.slice(0,2));
 assert.equal(applied.graph.edges.find(e=>e.id==='yz').draftRelation,'boundary-proposal');
 assert.equal(applied.graph.workspaces[0].id,'w1');
 assert.deepEqual(applied.graph.replacementPreparations[0].sourceSnapshot,g.nodes.find(n=>n.id==='B'));
 reject(()=>assertOrdinaryGraphWrite(applied.graph,{...applied.graph,
   nodes:applied.graph.nodes.map(n=>n.id==='B'?{...n,title:'Подделка'}:n)}),'PROTECTED_NODE_CHANGED');
});
test('all candidates selected promotes all internal edges and removes only emptied workspace',()=>{
 const g=readyGraph({selectAll:true});
 const p=previewApplyPreparation(g,{preparationId:'p1'});
 assert.deepEqual(p.promoteEdgeIds,['xy','yz']);
 assert.deepEqual(p.removedWorkspaceIds,['w1']);
 const next=applyPreparation(g,{preparationId:'p1',expectedRevision:0,expectedPreview:p}).graph;
 assert.deepEqual(next.workspaces,[]);
 assert.equal(next.nodes.find(n=>n.id==='Z').workspaceId,undefined);
 assert.deepEqual(canonicalProjection(next).edges.map(e=>e.id),['xy','yz','new-in']);
});
test('apply requires full resolution, correct source snapshot and exact approved preview',()=>{
 const g=readyGraph(),p=g.replacementPreparations[0];
 const incomplete=structuredClone(g);incomplete.replacementPreparations[0].edgeDecisions.pop();
 reject(()=>previewApplyPreparation(incomplete,{preparationId:'p1'}),'PREPARATION_UNRESOLVED');
 const staleB=structuredClone(g);staleB.nodes.find(n=>n.id==='B').description='Смена смысла';
 reject(()=>previewApplyPreparation(staleB,{preparationId:'p1'}),'PREPARATION_STALE');
 const addedEdge=structuredClone(g);addedEdge.edges.push({id:'fresh',from:'A',to:'B',type:'enables'});
 reject(()=>previewApplyPreparation(addedEdge,{preparationId:'p1'}),'PREPARATION_STALE');
 const plan=previewApplyPreparation(g,{preparationId:'p1'});
 reject(()=>applyPreparation(g,{preparationId:'p1',expectedRevision:0,
  expectedPreview:{...plan,acceptedNodeIds:['X']}}),'PREVIEW_STALE');
 const invalid=structuredClone(g);invalid.replacementPreparations[0].edgeDecisions[0].newEdge.to='C';
 reject(()=>previewApplyPreparation(invalid,{preparationId:'p1'}),'PREPARATION_REWIRE_ENDPOINT');
});
test('discarding or keeping a draft relation to retired B must be explicit',()=>{
 const g=readyGraph();
 g.edges.push({id:'to-B',from:'X',to:'B',type:'precedes',workspaceId:'w1',draftRelation:'boundary-proposal'});
 reject(()=>previewApplyPreparation(g,{preparationId:'p1'}),'PREPARATION_DRAFT_REFERENCE');
});
test('guarded SQLite apply writes one atomic graph, history and receipt; replay is idempotent',async()=>{
 const {db,sqlite}=sqliteDb(),g=readyGraph();
 sqlite.prepare('UPDATE plot_projects SET graph_json=? WHERE id=?').run(JSON.stringify(g),'project-1');
 const command={kind:'apply_preparation',preparationId:'p1'};
 const preview=await previewWorkflowCommand(db,{projectId:'project-1',expectedRevision:0,command});
 const args={projectId:'project-1',expectedRevision:0,operationId:'apply-1',
  command:{...command,expectedPreview:preview.preview}};
 const first=await commitWorkflowCommand(db,args);
 assert.equal(first.revision,1);
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
 assert.equal(stored(sqlite).replacementPreparations[0].state,'applied');
 assert.deepEqual(canonicalProjection(stored(sqlite)).nodes.map(n=>n.id),['A','C','X','Y']);
 assert.deepEqual(first.changes.rewiredEdges.map(e=>e.id),['new-in']);
 assert.equal((await commitWorkflowCommand(db,args)).replayed,true);
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
});
test('receipt insertion failure rolls back the entire preparation apply',async()=>{
 const {db,sqlite}=sqliteDb(),g=readyGraph();
 sqlite.prepare('UPDATE plot_projects SET graph_json=? WHERE id=?').run(JSON.stringify(g),'project-1');
 sqlite.exec("CREATE TRIGGER fail_apply_receipt BEFORE INSERT ON cw_operation_receipts BEGIN SELECT RAISE(ABORT,'receipt blocked'); END");
 const command={kind:'apply_preparation',preparationId:'p1'};
 const p=await previewWorkflowCommand(db,{projectId:'project-1',expectedRevision:0,command});
 await assert.rejects(()=>commitWorkflowCommand(db,{projectId:'project-1',expectedRevision:0,operationId:'apply-1',
  command:{...command,expectedPreview:p.preview}}),/receipt blocked/);
 assert.deepEqual(counts(sqlite),{revision:0,history:1,receipts:0});
 assert.equal(stored(sqlite).replacementPreparations[0].state,'open');
});

import {previewSetPreparationCandidates,applySetPreparationCandidates,
        previewSetPreparationDecisions,applySetPreparationDecisions} from '../src/creative_workflow_preparation_edit.mjs';
import {previewDraftAcceptance} from '../src/creative_workflow_contract.mjs';
import {previewDiscardDraftNodes} from '../src/creative_workflow_draft_discard.mjs';

const reviewCandidates=(g,candidates)=>applySetPreparationCandidates(g,{
 preparationId:'p1',candidates,expectedRevision:g.revision,
 expectedPreview:previewSetPreparationCandidates(g,{preparationId:'p1',candidates})
}).graph;
const reviewDecisions=(g,decisions)=>applySetPreparationDecisions(g,{
 preparationId:'p1',decisions,expectedRevision:g.revision,
 expectedPreview:previewSetPreparationDecisions(g,{preparationId:'p1',decisions})
}).graph;
test('selection is explicit, persistent, canon-neutral and independent of original taskId',()=>{
 const prepared=readyGraph(),p=prepared.replacementPreparations[0];
 p.candidateSelections=[];p.edgeDecisions=[];
 const candidates=[{workspaceId:'w1',nodeId:'X'},{workspaceId:'w1',nodeId:'Y'}];
 const before=canonicalProjection(prepared);
 const selected=reviewCandidates(prepared,candidates);
 assert.deepEqual(selected.replacementPreparations[0].candidateSelections,candidates);
 assert.deepEqual(canonicalProjection(selected),before);
 assert.deepEqual(prepared.replacementPreparations[0].candidateSelections,[]);
 reject(()=>assertOrdinaryGraphWrite(prepared,selected),'EXPLICIT_WORKFLOW_COMMAND_REQUIRED');
 reject(()=>previewDraftAcceptance(selected,{workspaceId:'w1',nodeIds:['X']}),'PREPARATION_CANDIDATE_RESERVED');
 reject(()=>previewDiscardDraftNodes(selected,{workspaceId:'w1',nodeIds:['X']}),'PREPARATION_CANDIDATE_RESERVED');
 assert.deepEqual(previewDraftAcceptance(selected,{workspaceId:'w1',nodeIds:['Z']}).acceptNodeIds,['Z']);
});
test('decisions are explicit and partial: unresolved always blocks final apply',()=>{
 const initial=readyGraph(),p=initial.replacementPreparations[0];
 p.edgeDecisions=[];
 const partial=reviewDecisions(initial,[{edgeId:'out',decision:'drop'}]);
 assert.deepEqual(partial.replacementPreparations[0].edgeDecisions,[{edgeId:'out',decision:'drop'}]);
 reject(()=>previewApplyPreparation(partial,{preparationId:'p1'}),'PREPARATION_UNRESOLVED');
 const decisions=[
  {edgeId:'in',decision:'rewire',newEdge:{id:'fresh-in',from:'A',to:'X',type:'precedes'}},
  {edgeId:'out',decision:'drop'}
 ];
 const next=reviewDecisions(partial,decisions);
 assert.deepEqual(previewApplyPreparation(next,{preparationId:'p1'}).rewiredEdges.map(e=>e.id),['fresh-in']);
 const invalid=[{edgeId:'in',decision:'rewire',newEdge:{id:'bad',from:'A',to:'C',type:'precedes'}}];
 reject(()=>previewSetPreparationDecisions(next,{preparationId:'p1',decisions:invalid}),'PREPARATION_DECISION_ENDPOINT');
 const less=[{workspaceId:'w1',nodeId:'Y'}];
 reject(()=>previewSetPreparationCandidates(next,{preparationId:'p1',candidates:less}),'PREPARATION_DECISION_CONFLICT');
});
test('candidate ownership is enforced across existing workspaces',()=>{
 const g=readyGraph();g.nodes.push({id:'D',title:'Отдельное',x:900,y:0});
 g.nodes.push({id:'Q',title:'Альтернатива из другого задания',x:900,y:300,workspaceId:'w2'});
 g.workspaces.push({id:'w2',taskId:'another-task',x:850,y:250,width:400,height:300});
 const p=previewCreatePreparation(g,{sourceNodeId:'D'});
 const other=applyCreatePreparation(g,{preparationId:'p2',sourceNodeId:'D',expectedRevision:0,expectedPreview:p}).graph;
 reject(()=>previewSetPreparationCandidates(other,{preparationId:'p2',
   candidates:[{workspaceId:'w1',nodeId:'X'}]}),'PREPARATION_CANDIDATE_CONFLICT');
 const expanded=reviewCandidates(other,[
  {workspaceId:'w1',nodeId:'X'},
  {workspaceId:'w1',nodeId:'Y'},
  {workspaceId:'w2',nodeId:'Q'}]);
 assert.equal(expanded.replacementPreparations[0].candidateSelections.length,3);
 assert.equal(expanded.replacementPreparations[0].candidateSelections.at(-1).workspaceId,'w2');
 assert.equal(expanded.nodes.find(n=>n.id==='Q').workspaceId,'w2');
});
test('SQLite review commands persist selection then decisions without changing canon',async()=>{
 const {db,sqlite}=sqliteDb(),g=readyGraph();
 g.replacementPreparations[0].candidateSelections=[];
 g.replacementPreparations[0].edgeDecisions=[];
 sqlite.prepare('UPDATE plot_projects SET graph_json=? WHERE id=?').run(JSON.stringify(g),'project-1');
 const before=canonicalProjection(stored(sqlite));
 const candidates=[{workspaceId:'w1',nodeId:'X'},{workspaceId:'w1',nodeId:'Y'}];
 const select={kind:'set_preparation_candidates',preparationId:'p1',candidates};
 const p1=await previewWorkflowCommand(db,{projectId:'project-1',expectedRevision:0,command:select});
 await commitWorkflowCommand(db,{projectId:'project-1',operationId:'select-1',expectedRevision:0,
   command:{...select,expectedPreview:p1.preview}});
 assert.deepEqual(canonicalProjection(stored(sqlite)),before);
 const decisions=[
  {edgeId:'in',decision:'rewire',newEdge:{id:'new-in',from:'A',to:'X',type:'precedes'}},
  {edgeId:'out',decision:'drop'}
 ];
 const decide={kind:'set_preparation_decisions',preparationId:'p1',decisions};
 const p2=await previewWorkflowCommand(db,{projectId:'project-1',expectedRevision:1,command:decide});
 await commitWorkflowCommand(db,{projectId:'project-1',operationId:'decide-1',expectedRevision:1,
   command:{...decide,expectedPreview:p2.preview}});
 assert.deepEqual(canonicalProjection(stored(sqlite)),before);
 const commit={kind:'apply_preparation',preparationId:'p1'};
 const p3=await previewWorkflowCommand(db,{projectId:'project-1',expectedRevision:2,command:commit});
 await commitWorkflowCommand(db,{projectId:'project-1',operationId:'commit-1',expectedRevision:2,
   command:{...commit,expectedPreview:p3.preview}});
 assert.deepEqual(counts(sqlite),{revision:3,history:4,receipts:3});
 assert.deepEqual(canonicalProjection(stored(sqlite)).nodes.map(n=>n.id),['A','C','X','Y']);
});
