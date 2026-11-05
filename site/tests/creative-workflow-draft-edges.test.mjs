import test from 'node:test';
import assert from 'node:assert/strict';
import {
 previewAddDraftEdge,applyAddDraftEdge,
 previewRewireDraftEdge,applyRewireDraftEdge,
 previewSetDraftEdgeType,applySetDraftEdgeType
} from '../src/creative_workflow_draft_edges.mjs';
import {canonicalProjection,previewDraftAcceptance,applyDraftAcceptance}
 from '../src/creative_workflow_contract.mjs';

const graph=()=>({
 revision:12,version:1,view:null,
 nodes:[
  {id:'n1',title:'Original',description:'',x:0,y:0},
  {id:'a',title:'A',description:'',x:20,y:200,workspaceId:'w1',draftBranchId:'alpha'},
  {id:'b',title:'B',description:'',x:250,y:200,workspaceId:'w1',draftBranchId:'alpha'},
  {id:'c',title:'C',description:'',x:510,y:200,workspaceId:'w1',draftBranchId:'beta'},
  {id:'d',title:'D',description:'',x:250,y:600,workspaceId:'w2',draftBranchId:'gamma'}
 ],
 edges:[
  {id:'ea',from:'a',to:'b',type:'causes',workspaceId:'w1',
   draftRelation:'internal',draftBranchId:'alpha'}
 ],
 workspaces:[
  {id:'w1',taskId:'note1',x:0,y:170,width:900,height:400},
  {id:'w2',taskId:'note2',x:0,y:590,width:900,height:400}
 ],fields:[],lanes:[]
});
const error=(code)=>e=>e?.code===code;

test('preview is read-only and add writes an isolated internal relation exactly once',()=>{
 const original=graph(),before=structuredClone(original);
 const edge={id:'ec',from:'a',to:'c',type:'enables'};
 const plan=previewAddDraftEdge(original,{workspaceId:'w1',edge});
 assert.equal(plan.edge.workspaceId,'w1');
 assert.equal(plan.edge.draftRelation,'internal');
 assert.equal(plan.edge.draftBranchId,undefined,
  'cross-variant link is not arbitrarily assigned to an alternative');
 assert.deepEqual(original,before);
 const {graph:next}=applyAddDraftEdge(original,{
  workspaceId:'w1',edge,expectedPreview:plan,expectedRevision:12
 });
 assert.equal(next.edges.length,2);
 assert.equal(next.edges[1].id,'ec');
 assert.equal(next.edges[1].type,'enables');
 assert.deepEqual(canonicalProjection(next),canonicalProjection(original));
 assert.deepEqual(original,before);
 assert.throws(()=>previewAddDraftEdge(next,{workspaceId:'w1',edge}),error('EDGE_ID_CONFLICT'));
});

test('rewire changes one target, retains edge ID, source and semantic type',()=>{
 const before=graph();
 const p=previewRewireDraftEdge(before,{workspaceId:'w1',edgeId:'ea',to:'c'});
 const {graph:after}=applyRewireDraftEdge(before,{
  workspaceId:'w1',edgeId:'ea',to:'c',expectedPreview:p,expectedRevision:12
 });
 assert.deepEqual(p.before,before.edges[0]);
 assert.equal(after.edges.length,1);
 assert.equal(after.edges[0].id,'ea');
 assert.equal(after.edges[0].to,'c');
 assert.equal(after.edges[0].type,'causes');
 assert.equal(after.edges[0].draftBranchId,undefined);
 assert.equal(before.edges[0].to,'b');
 assert.deepEqual(canonicalProjection(before),canonicalProjection(after));
});

test('all scope breaks, duplicates, malicious payloads and self-links reject',()=>{
 const g=graph();
 for(const edge of [
  {id:'new',from:'a',to:'n1',type:'precedes'},
  {id:'new',from:'a',to:'d',type:'precedes'},
  {id:'new',from:'a',to:'a',type:'precedes'},
  {id:'new',from:'a',to:'c',type:'not-causal'},
  {id:'new',from:'a',to:'c',type:'causes',workspaceId:'w2'}
 ])assert.throws(()=>previewAddDraftEdge(g,{workspaceId:'w1',edge}));
 assert.throws(()=>previewAddDraftEdge(g,{
  workspaceId:'w1',edge:{id:'ee',from:'a',to:'b',type:'precedes'}
 }),error('DRAFT_EDGE_DUPLICATE'));
 for(const to of ['n1','d','a','b'])
  assert.throws(()=>previewRewireDraftEdge(g,{workspaceId:'w1',edgeId:'ea',to}));
 assert.throws(()=>previewRewireDraftEdge(g,{
  workspaceId:'w2',edgeId:'ea',to:'d'
 }),error('DRAFT_EDGE_NOT_FOUND'));
});

test('stale plan and stale revision reject with source graph unchanged',()=>{
 const g=graph(),edge={id:'ec',from:'a',to:'c',type:'precedes'};
 const plan=previewAddDraftEdge(g,{workspaceId:'w1',edge});
 const saved=structuredClone(g);
 assert.throws(()=>applyAddDraftEdge(g,{
  workspaceId:'w1',edge:{...edge,type:'causes'},expectedPreview:plan,
  expectedRevision:12
 }),error('PREVIEW_STALE'));
 assert.throws(()=>applyAddDraftEdge(g,{
  workspaceId:'w1',edge,expectedPreview:plan,expectedRevision:11
 }),error('REVISION_CONFLICT'));
 const rewire=previewRewireDraftEdge(g,{workspaceId:'w1',edgeId:'ea',to:'c'});
 assert.throws(()=>applyRewireDraftEdge(g,{
  workspaceId:'w1',edgeId:'ea',to:'c',expectedRevision:12,
  expectedPreview:{...rewire,edgeId:'forged'}
 }),error('PREVIEW_STALE'));
 assert.deepEqual(g,saved);
});

test('newly created draft arrow is promoted only when both ends are accepted',()=>{
 const g=graph(),edge={id:'ec',from:'a',to:'c',type:'hinders'};
 const p=previewAddDraftEdge(g,{workspaceId:'w1',edge});
 const amended=applyAddDraftEdge(g,{
  workspaceId:'w1',edge,expectedPreview:p
 }).graph;
 const accept=previewDraftAcceptance(amended,{
  workspaceId:'w1',nodeIds:['a','c']
 });
 assert.deepEqual(accept.promoteEdgeIds,['ec']);
 assert.deepEqual(accept.reviewEdgeIds,['ea']);
 const after=applyDraftAcceptance(amended,{
  workspaceId:'w1',nodeIds:['a','c'],expectedPreview:accept
 }).graph;
 assert.equal(after.edges.find(e=>e.id==='ec').workspaceId,undefined);
 assert.equal(after.edges.find(e=>e.id==='ea').workspaceId,'w1');
 assert.equal(after.nodes.find(n=>n.id==='b').workspaceId,'w1');
});

test('type edit retains both endpoints and does not infer cause from geometry',()=>{
 const original=graph(),before=structuredClone(original);
 const plan=previewSetDraftEdgeType(original,{
  workspaceId:'w1',edgeId:'ea',newType:'hinders'
 });
 assert.equal(plan.before.type,'causes');
 assert.equal(plan.after.type,'hinders');
 assert.equal(plan.after.from,'a');
 assert.equal(plan.after.to,'b');
 assert.deepEqual(original,before,'preview must never mutate source');
 const {graph:after}=applySetDraftEdgeType(original,{
  workspaceId:'w1',edgeId:'ea',newType:'hinders',
  expectedPreview:plan,expectedRevision:12
 });
 assert.equal(after.edges[0].type,'hinders');
 assert.equal(after.edges[0].id,'ea');
 assert.equal(after.edges[0].workspaceId,'w1');
 assert.deepEqual(canonicalProjection(after),canonicalProjection(original));
 assert.deepEqual(original,before);
});
test('type review rejects foreign, unchanged, illegal and stale changes',()=>{
 const g=graph(),p=previewSetDraftEdgeType(g,{
  workspaceId:'w1',edgeId:'ea',newType:'enables'
 });
 assert.throws(()=>previewSetDraftEdgeType(g,{
  workspaceId:'w2',edgeId:'ea',newType:'enables'
 }),error('DRAFT_EDGE_NOT_FOUND'));
 assert.throws(()=>previewSetDraftEdgeType(g,{
  workspaceId:'w1',edgeId:'ea',newType:'causes'
 }),error('DRAFT_EDGE_UNCHANGED'));
 assert.throws(()=>previewSetDraftEdgeType(g,{
  workspaceId:'w1',edgeId:'ea',newType:'new-unknown'
 }),error('DRAFT_EDGE_INVALID'));
 assert.throws(()=>applySetDraftEdgeType(g,{
  workspaceId:'w1',edgeId:'ea',newType:'hinders',
  expectedPreview:p,expectedRevision:12
 }),error('PREVIEW_STALE'));
 assert.throws(()=>applySetDraftEdgeType(g,{
  workspaceId:'w1',edgeId:'ea',newType:'enables',
  expectedPreview:p,expectedRevision:11
 }),error('REVISION_CONFLICT'));
 assert.equal(g.edges[0].type,'causes');
});
