import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previewPostCanonReview,applyPostCanonReview
} from '../src/creative_workflow_postcanon_review.mjs';
import {
  canonicalProjection,assertProtectedOriginalsUnchanged,validateCreativeWorkflowGraph
} from '../src/creative_workflow_contract.mjs';

const copy=x=>structuredClone(x);
const bad=(action,code)=>assert.throws(action,error=>error.code===code);
const baseline=()=>({
  version:1,revision:0,view:null,
  nodes:[{id:'a',title:'Start',x:0,y:0},{id:'b',title:'Old turn',description:'Original',x:200,y:0},
    {id:'c',title:'Finish',x:400,y:0}],
  edges:[{id:'e1',from:'a',to:'b',type:'precedes'},
    {id:'e2',from:'b',to:'c',type:'causes'}],fields:[],lanes:[]
});
function current({completed=false}={}){
 const graph=baseline();
 graph.revision=4;
 graph.nodes.push({id:'x',title:'New outcome',x:200,y:300},
   {id:'y',title:'Old turn',x:450,y:300});
 graph.replacements=[{id:'r1',state:completed?'completed':'open',
   sourceNodeIds:['b'],suspendedEdgeIds:['e1','e2'],
   sourceGraphRevision:0,candidateNodeIds:['x','y']}];
 return graph;
}
const options=(overrides={})=>({
 replacementId:'r1',baselineGraph:baseline(),originalAction:'keep_replaced',
 candidateDecisions:[{nodeId:'x',decision:'keep'},{nodeId:'y',decision:'archive'}],
 edgeDecisions:[{edgeId:'e1',decision:'keep_suspended'},
   {edgeId:'e2',decision:'keep_suspended'}],
 acknowledgedTitleConflicts:[],...overrides
});
function apply(g,opts){
 const plan=previewPostCanonReview(g,opts);
 return applyPostCanonReview(g,{...opts,expectedPreview:plan,expectedRevision:g.revision});
}
test('read-only preview lists all sources, candidates and suspended relations; no invented choice',()=>{
 const g=current(),original=copy(g);
 const plan=previewPostCanonReview(g,{replacementId:'r1',baselineGraph:baseline()});
 assert.equal(plan.selectionComplete,false);
 assert.deepEqual(plan.candidateNodes.map(n=>n.id),['x','y']);
 assert.deepEqual(plan.suspendedEdges.map(e=>e.id),['e1','e2']);
 assert.deepEqual(plan.originalNodes.map(n=>n.id),['b']);
 assert.deepEqual(g,original);
});
test('explicitly archive Y without erasing original, X, Y or old arrows',()=>{
 const g=current(),opts=options(),before=copy(g);
 const plan=previewPostCanonReview(g,opts);
 assert.equal(plan.selectionComplete,true);
 assert.deepEqual(plan.blockers,[]);
 assert.deepEqual(plan.wouldArchiveCandidateNodeIds,['y']);
 const result=apply(g,opts);
 assert.deepEqual(canonicalProjection(result.graph).nodes.map(x=>x.id),['a','c','x']);
 assert.deepEqual(canonicalProjection(result.graph).edges,[]);
 assert.deepEqual(result.graph.nodes,before.nodes);
 assert.deepEqual(result.graph.edges,before.edges);
 assert.deepEqual(result.graph.replacements[0].postCanonReviews[0].candidateDecisions,
   opts.candidateDecisions);
 assert.deepEqual(g,before);
 bad(()=>assertProtectedOriginalsUnchanged(result.graph,{...result.graph,
   replacements:[{...result.graph.replacements[0],postCanonReviews:[]}]}),'POST_CANON_REVIEW_CHANGED');
});
test('restoring original explicitly restores only selected old edge',()=>{
 const g=current({completed:true}),opts=options({
   originalAction:'restore',
   edgeDecisions:[{edgeId:'e1',decision:'restore'},
     {edgeId:'e2',decision:'keep_suspended'}]
 });
 const result=apply(g,opts),r=result.graph.replacements[0];
 assert.equal(r.state,'restored');
 assert.deepEqual(canonicalProjection(result.graph).nodes.map(n=>n.id),['a','b','c','x']);
 assert.deepEqual(canonicalProjection(result.graph).edges.map(e=>e.id),['e1']);
 assert.deepEqual(result.graph.edges,g.edges);
 validateCreativeWorkflowGraph(result.graph);
 assert.equal(result.changes.originalAndCandidatesPreserved,true);
});
test('title conflicts need explicit per-node acknowledgements, not heuristic deletion',()=>{
 const g=current(),opts=options({originalAction:'restore',
  candidateDecisions:[{nodeId:'x',decision:'keep'},{nodeId:'y',decision:'keep'}]});
 const plan=previewPostCanonReview(g,opts);
 assert.deepEqual(plan.possibleTitleConflicts,['b','y']);
 assert.deepEqual(plan.blockers,['TITLE_CONFLICT_UNACKNOWLEDGED:b','TITLE_CONFLICT_UNACKNOWLEDGED:y']);
 bad(()=>applyPostCanonReview(g,{...opts,expectedPreview:plan,expectedRevision:4}),'REVIEW_CONFLICT');
 const permitted=options({...opts,acknowledgedTitleConflicts:['b','y']});
 assert.deepEqual(previewPostCanonReview(g,permitted).blockers,[]);
 const ok=apply(g,permitted);
 assert.deepEqual(canonicalProjection(ok.graph).nodes.map(n=>n.id),['a','b','c','x','y']);
});
test('archiving linked candidate or a parent refuses implicit edge/child loss',()=>{
 const g=current();
 g.edges.push({id:'e3',from:'x',to:'y',type:'precedes'});
 const opts=options();
 const plan=previewPostCanonReview(g,opts);
 assert.deepEqual(plan.blockers,['CANDIDATE_HAS_RELATIONS:y']);
 bad(()=>applyPostCanonReview(g,{...opts,expectedPreview:plan,expectedRevision:4}),'REVIEW_CONFLICT');
 assert.equal(g.replacements[0].postCanonReviews,undefined);
});
test('restoring already-rewired original relation is blocked',()=>{
 const g=current();
 g.edges.push({id:'e3',from:'a',to:'x',type:'precedes'});
 g.replacements[0].edgeResolutions=[{edgeId:'e1',decision:'rewire',newEdgeId:'e3'}];
 const opts=options({originalAction:'restore',
  edgeDecisions:[{edgeId:'e1',decision:'restore'},{edgeId:'e2',decision:'keep_suspended'}]});
 const plan=previewPostCanonReview(g,opts);
 assert.deepEqual(plan.blockers,['REWIRED_RELATION_CONFLICT:e1']);
 bad(()=>applyPostCanonReview(g,{...opts,expectedPreview:plan,expectedRevision:4}),'REVIEW_CONFLICT');
});
test('all candidates and suspended edges need explicit decisions; stale and forged history fail',()=>{
 const g=current(),opts=options();
 for(const incomplete of [
  {candidateDecisions:opts.candidateDecisions.slice(0,1)},
  {edgeDecisions:opts.edgeDecisions.slice(0,1)}
 ])bad(()=>previewPostCanonReview(g,{...opts,...incomplete}),'REVIEW_DECISIONS_INCOMPLETE');
 bad(()=>previewPostCanonReview(g,{...opts,originalAction:'restore',
  edgeDecisions:opts.edgeDecisions,acknowledgedTitleConflicts:['b']}),'REVIEW_DECISION_INVALID');
 const plan=previewPostCanonReview(g,opts);
 bad(()=>applyPostCanonReview(g,{...opts,expectedPreview:plan,expectedRevision:3}),'REVISION_CONFLICT');
 bad(()=>applyPostCanonReview(g,{...opts,expectedPreview:{...plan,blockers:['fake']},expectedRevision:4}),'PREVIEW_STALE');
 bad(()=>previewPostCanonReview(g,{...opts,baselineGraph:{...baseline(),revision:99}}),'BASELINE_REVISION_MISMATCH');
 bad(()=>previewPostCanonReview(g,{...opts,baselineGraph:undefined}),'TRUSTED_BASELINE_REQUIRED');
});
test('subsequent guarded revision may re-include previously archived scene',()=>{
 let g=apply(current(),options()).graph;
 const opts=options({candidateDecisions:[
  {nodeId:'x',decision:'keep'},{nodeId:'y',decision:'keep'}]});
 const result=apply(g,opts);
 assert.deepEqual(canonicalProjection(result.graph).nodes.map(n=>n.id),['a','c','x','y']);
 assert.equal(result.graph.replacements[0].postCanonReviews.length,2);
 assert.deepEqual(result.graph.replacements[0].postCanonReviews[0].candidateDecisions[1],
  {nodeId:'y',decision:'archive'});
});
