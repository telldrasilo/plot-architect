import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalProjection} from '../src/creative_workflow_contract.mjs';
import {validateServerGraph} from '../src/creative_workflow_server_boundary.mjs';
import {
 prepareSavedDraftIterationTask,prepareDraftIterationStageWrite
} from '../src/creative_workflow_draft_iteration_handoff.mjs';
import {previewStageDraftIteration,applyStageDraftIteration} from '../src/creative_workflow_draft_iteration_stage.mjs';

const story=()=>validateServerGraph({
 version:1,revision:8,view:null,nodes:[
  {id:'a',title:'Событие канона',x:0,y:0},
  {id:'y',title:'Черновик Y',description:'Исходный вариант',x:70,y:230,workspaceId:'w1',draftBranchId:'old'}
 ],
 edges:[],fields:[],lanes:[],
 workspaces:[{id:'w1',taskId:'consumed-note',x:20,y:180,width:480,height:300}],
 gapNotes:[]
});
const proposal={
 kind:'single',
 groups:[{title:'Новое решение',events:[
  {key:'first',title:'Первый сюжетный блок',description:'Новая мотивация'},
  {key:'second',title:'Второй сюжетный блок',description:'Последствие'}
 ],relations:[{from:'first',to:'second',type:'causes'}]}]
};
const generationId='iterationABC123';
const args={sourceWorkspaceId:'w1',sourceNodeIds:['y'],
 sourceRevision:8,generationId,proposal};
const reject=(fn,code)=>assert.throws(fn,e=>e?.code===code);

test('P1 task returns scoped saved drafts with author-intent instructions and no note',()=>{
 const task=prepareSavedDraftIterationTask(story(),{workspaceId:'w1',nodeIds:['y']});
 assert.deepEqual(task.sourceDrafts.map(n=>n.id),['y']);
 assert.match(task.structureGuidance,/не навязывай три варианта/);
 assert.match(task.iterationGuidance,/Никаких изменений исходных черновиков/);
 assert.doesNotMatch(JSON.stringify(task),/Событие канона/);
});
test('P1 compiled proposal stages next to Y without changing Y, its consumed note or canon',()=>{
 const original=story(),before=canonicalProjection(original);
 const prepared=prepareDraftIterationStageWrite(original,args);
 assert.equal(prepared.command.kind,'stage_draft_iteration');
 assert.equal(prepared.summary.nodeCount,2);
 assert.equal(prepared.summary.edgeCount,1);
 assert.equal(prepared.layout.x>=original.workspaces[0].x+original.workspaces[0].width,true);
 assert.equal(prepared.command.workspaceId,'iw-'+generationId);
 const p=previewStageDraftIteration(original,prepared.command);
 const next=applyStageDraftIteration(original,{...prepared.command,
  expectedPreview:p,expectedRevision:8}).graph;
 assert.deepEqual(canonicalProjection(next),before);
 assert.deepEqual(next.nodes.find(n=>n.id==='y'),original.nodes.find(n=>n.id==='y'));
 assert.equal(next.workspaces.find(w=>w.id==='w1').taskId,'consumed-note');
 assert.equal(next.gapNotes.length,0);
 assert.deepEqual(next.nodes.filter(n=>n.workspaceId==='iw-'+generationId).map(n=>n.title),
  ['Первый сюжетный блок','Второй сюжетный блок']);
 assert.equal(next.edges.find(e=>e.id==='ie-'+generationId+'-0-0').type,'causes');
 assert.deepEqual(original,story());
});
test('P1 compiler preserves author-requested four alternatives with variable lengths',()=>{
 const groups=Array.from({length:4},(_,i)=>({
  title:'Вариант '+(i+1),
  events:Array.from({length:i+1},(_,j)=>({key:'node'+j,title:'Событие '+j})),
  relations:[]
 }));
 const compiled=prepareDraftIterationStageWrite(story(),{
  ...args,generationId:'fourBranches123',
  proposal:{kind:'alternatives',groups}
 });
 assert.equal(compiled.summary.groupCount,4);
 assert.equal(compiled.summary.nodeCount,10);
 assert.deepEqual(compiled.command.branches.map(b=>b.nodes.length),[1,2,3,4]);
});
test('P1 rejects stale revisions, malformed structure and source outside workspace',()=>{
 reject(()=>prepareDraftIterationStageWrite(story(),{...args,sourceRevision:7}),'REVISION_CONFLICT');
 reject(()=>prepareDraftIterationStageWrite(story(),{...args,sourceNodeIds:['a']}),'DRAFT_ITERATION_NOT_OWNED');
 reject(()=>prepareDraftIterationStageWrite(story(),{
  ...args,generationId:'short'
 }),'ITERATION_GENERATION_ID_INVALID');
 reject(()=>prepareDraftIterationStageWrite(story(),{
  ...args,proposal:{kind:'single',groups:[...proposal.groups,proposal.groups[0]]}
 }),'PROPOSAL_INVALID');
 reject(()=>prepareDraftIterationStageWrite(story(),{
  ...args,proposal:{kind:'single',groups:[{title:'Без стрелок',events:[
   {key:'a',title:'Вариант'},
   {key:'b',title:'Продолжение'}
  ],relations:[{from:'a',to:'missing',type:'precedes'}]}]}
 }),'RELATION_INVALID');
});
