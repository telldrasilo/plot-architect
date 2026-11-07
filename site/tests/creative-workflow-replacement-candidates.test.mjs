import test from 'node:test';
import assert from 'node:assert/strict';
import {previewReplacementStart,applyStartReplacement,applyDraftAcceptance,
  previewDraftAcceptance,canonicalProjection,assertProtectedOriginalsUnchanged}
  from '../src/creative_workflow_contract.mjs';
import {previewLinkReplacementCandidates,applyLinkReplacementCandidates}
  from '../src/creative_workflow_replacement_candidates.mjs';

const copy=x=>structuredClone(x);
const fails=(fn,code)=>assert.throws(fn,e=>e.code===code);
const base=()=>({
  version:1,revision:5,view:null,
  nodes:[{id:'a',title:'Начало',x:0,y:0},
    {id:'b',title:'Исходный поворот',description:'Старое событие',x:200,y:0},
    {id:'c',title:'Последствие',x:400,y:0},
    {id:'x',title:'Исходный поворот',description:'Новая трактовка',x:200,y:250,workspaceId:'w1'},
    {id:'y',title:'Идея Y',x:450,y:250,workspaceId:'w1'}],
  edges:[{id:'e1',from:'a',to:'b',type:'precedes'},
    {id:'e2',from:'b',to:'c',type:'causes'}],
  workspaces:[{id:'w1',x:60,y:200,width:800,height:300}],fields:[],lanes:[]
});
function setup(){
  const baseline=base(),review=previewReplacementStart(baseline,['b']);
  const started=applyStartReplacement(baseline,{replacementId:'r1',
    sourceNodeIds:['b'],expectedPreview:review,expectedRevision:5}).graph;
  const accepted=applyDraftAcceptance(started,{workspaceId:'w1',nodeIds:['x'],
    expectedPreview:previewDraftAcceptance(started,{workspaceId:'w1',nodeIds:['x']}),
    expectedRevision:5}).graph;
  return {baseline,started,accepted};
}
test('candidate list excludes preexisting canon and drafts, shows original and explicit title collision',()=>{
  const {baseline,accepted}=setup();
  const preview=previewLinkReplacementCandidates(accepted,{replacementId:'r1',
    nodeIds:['x'],baselineGraph:baseline});
  assert.deepEqual(preview.availableCandidates.map(x=>x.node.id),['x']);
  assert.deepEqual(preview.availableCandidates.map(x=>x.provenance),['draft_at_start']);
  assert.deepEqual(preview.possibleExactTitleDuplicates,['x']);
  assert.deepEqual(preview.originalNodes.map(x=>x.id),['b']);
  assert.deepEqual(preview.suspendedEdges.map(x=>x.id),['e1','e2']);
  assert.deepEqual(preview.alreadyLinkedNodeIds,[]);
});
test('explicit attribution is append-only metadata and never removes new canon or old arrows',()=>{
  const {baseline,accepted}=setup(),before=copy(accepted);
  const preview=previewLinkReplacementCandidates(accepted,{replacementId:'r1',nodeIds:['x'],baselineGraph:baseline});
  const result=applyLinkReplacementCandidates(accepted,{replacementId:'r1',nodeIds:['x'],
    baselineGraph:baseline,expectedPreview:preview,expectedRevision:5});
  assert.deepEqual(accepted,before);
  assert.deepEqual(canonicalProjection(result.graph),canonicalProjection(accepted));
  assert.deepEqual(result.graph.replacements[0].candidateNodeIds,['x']);
  assert.deepEqual(result.graph.edges,accepted.edges);
  assert.equal(result.changes.canonicalNodesChanged.length,0);
  const truncated=copy(result.graph);truncated.replacements[0].candidateNodeIds=[];
  fails(()=>assertProtectedOriginalsUnchanged(result.graph,truncated),'CANDIDATE_PROVENANCE_CHANGED');
});
test('baseline is trusted and a previously canonical node cannot be attributed',()=>{
  const {baseline,accepted}=setup();
  fails(()=>previewLinkReplacementCandidates(accepted,{replacementId:'r1',nodeIds:['a'],baselineGraph:baseline}),
    'CANDIDATE_PREEXISTING_CANON');
  fails(()=>previewLinkReplacementCandidates(accepted,{replacementId:'r1',nodeIds:['y'],baselineGraph:baseline}),
    'CANDIDATE_NOT_ACTIVE_CANON');
  fails(()=>previewLinkReplacementCandidates(accepted,{replacementId:'r1',nodeIds:['x']}),
    'TRUSTED_BASELINE_REQUIRED');
  const forged=copy(baseline);forged.revision=6;
  fails(()=>previewLinkReplacementCandidates(accepted,{replacementId:'r1',nodeIds:['x'],baselineGraph:forged}),
    'BASELINE_REVISION_MISMATCH');
});
test('review required, stale review and wrong revision fail without mutations',()=>{
  const {baseline,accepted}=setup(),before=copy(accepted);
  const preview=previewLinkReplacementCandidates(accepted,{replacementId:'r1',nodeIds:['x'],baselineGraph:baseline});
  const args={replacementId:'r1',nodeIds:['x'],baselineGraph:baseline,expectedRevision:5};
  fails(()=>applyLinkReplacementCandidates(accepted,args),'PREVIEW_REQUIRED');
  fails(()=>applyLinkReplacementCandidates(accepted,{...args,expectedPreview:preview,expectedRevision:6}),'REVISION_CONFLICT');
  fails(()=>applyLinkReplacementCandidates(accepted,{...args,expectedPreview:{...preview,selectedNodeIds:[]}}),'PREVIEW_STALE');
  fails(()=>applyLinkReplacementCandidates(accepted,{...args,nodeIds:[],expectedPreview:preview}),'CANDIDATE_SELECTION_INVALID');
  assert.deepEqual(accepted,before);
});
test('same candidate cannot be claimed twice, even by a later replacement',()=>{
  const {baseline,accepted}=setup();
  const initial=previewLinkReplacementCandidates(accepted,{replacementId:'r1',nodeIds:['x'],baselineGraph:baseline});
  const linked=applyLinkReplacementCandidates(accepted,{replacementId:'r1',nodeIds:['x'],
    baselineGraph:baseline,expectedPreview:initial,expectedRevision:5}).graph;
  fails(()=>previewLinkReplacementCandidates(linked,{replacementId:'r1',nodeIds:['x'],baselineGraph:baseline}),
    'CANDIDATE_ALREADY_LINKED');
  const secondPreview=previewReplacementStart(linked,['c']);
  const second=applyStartReplacement(linked,{replacementId:'r2',sourceNodeIds:['c'],
    expectedPreview:secondPreview,expectedRevision:5}).graph;
  // A second independent replacement cannot take ownership of X, even with its
  // own authentic source revision.
  fails(()=>previewLinkReplacementCandidates(second,{replacementId:'r2',nodeIds:['x'],baselineGraph:linked}),
    'CANDIDATE_OWNED_BY_ANOTHER_REPLACEMENT');
});
test('created-after-start canon can be attributed, but no other event is inferred',()=>{
  const {baseline,started}=setup();
  const newCanon=copy(started);
  newCanon.nodes.push({id:'z',title:'Новое событие',x:1000,y:200});
  const preview=previewLinkReplacementCandidates(newCanon,{replacementId:'r1',nodeIds:['z'],baselineGraph:baseline});
  assert.deepEqual(preview.availableCandidates.map(x=>x.node.id),['z']);
  assert.equal(preview.availableCandidates[0].provenance,'created_after_start');
  const linked=applyLinkReplacementCandidates(newCanon,{replacementId:'r1',nodeIds:['z'],baselineGraph:baseline,
    expectedPreview:preview,expectedRevision:5}).graph;
  assert.deepEqual(linked.replacements[0].candidateNodeIds,['z']);
  assert.deepEqual(canonicalProjection(linked),canonicalProjection(newCanon));
});
