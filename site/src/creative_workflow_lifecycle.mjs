/**
 * CW-007/010 pure replacement lifecycle: explicit completion and conservative
 * cancellation. No server writes, migration, UI, MCP, or revision increment.
 * Cancellation REQUIRES a trusted graph snapshot from the revision recorded
 * when the replacement began. Never accept user-supplied baseline data as
 * authoritative in a future server integration.
 */
import {
  CreativeWorkflowContractError,
  validateCreativeWorkflowGraph,
  canonicalProjection,
  assertProtectedOriginalsUnchanged
} from './creative_workflow_contract.mjs';

const fail=(code,message)=>{throw new CreativeWorkflowContractError(code,message)};
const clone=value=>structuredClone(value);
const goodRevision=n=>Number.isSafeInteger(n)&&n>=0;
function replacementOf(graph,replacementId){
  validateCreativeWorkflowGraph(graph);
  const r=(graph.replacements??[]).find(x=>x.id===replacementId);
  if(!r)fail('REPLACEMENT_NOT_FOUND',String(replacementId));
  if(r.state!=='open')fail('REPLACEMENT_NOT_OPEN',String(replacementId));
  return r;
}
function checkRevision(graph,expectedRevision){
  if(expectedRevision!==undefined&&(!goodRevision(expectedRevision)||graph?.revision!==expectedRevision))
    fail('REVISION_CONFLICT','graph revision does not match');
}
function checkPreview(expectedPreview,actual){
  if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','explicit review required');
  if(JSON.stringify(expectedPreview)!==JSON.stringify(actual))fail('PREVIEW_STALE','review has changed');
}
function originals(graph,r){
  const nodes=new Map(graph.nodes.map(n=>[n.id,n])),edges=new Map(graph.edges.map(e=>[e.id,e]));
  return {
    originalNodes:r.sourceNodeIds.map(id=>clone(nodes.get(id))),
    suspendedEdges:r.suspendedEdgeIds.map(id=>clone(edges.get(id)))
  };
}
function unresolved(r){
  const handled=new Set((r.edgeResolutions??[]).map(item=>item.edgeId));
  return r.suspendedEdgeIds.filter(id=>!handled.has(id));
}

/**
 * Completion does not connect anything, delete drafts, or release old
 * original nodes. Every suspended original relation MUST be explicitly
 * resolved before completion; the old acknowledgeUnresolved bypass is retired.
 * The protected server applies this same domain guard to direct API calls.
 */
export function previewCompleteReplacement(graph,{replacementId}={}){
  const r=replacementOf(graph,replacementId);
  return {
    replacementId,
    sourceNodeIds:[...r.sourceNodeIds],
    ...originals(graph,r),
    edgeResolutions:clone(r.edgeResolutions??[]),
    unresolvedEdgeIds:unresolved(r)
  };
}
export function applyCompleteReplacement(graph,{replacementId,expectedPreview,expectedRevision}={}){
  checkRevision(graph,expectedRevision);
  const plan=previewCompleteReplacement(graph,{replacementId});
  checkPreview(expectedPreview,plan);
  if(plan.unresolvedEdgeIds.length)
    fail('UNRESOLVED_RELATIONS','every suspended original relation must be explicitly resolved before completion');
  const next=clone(graph);
  next.replacements.find(r=>r.id===replacementId).state='completed';
  validateCreativeWorkflowGraph(next);
  assertProtectedOriginalsUnchanged(graph,next);
  return {graph:next,changes:{
    replacementId,state:'completed',unresolvedEdgeIds:[...plan.unresolvedEdgeIds],
    originalPreserved:true,autoRewiredEdgeIds:[]
  }};
}
function stableProjection(graph){
  const p=canonicalProjection(graph);
  for(const key of ['nodes','edges','fields','lanes'])p[key].sort((a,b)=>a.id.localeCompare(b.id));
  return JSON.stringify(p);
}
/**
 * Conservative guarded cancellation. A trusted baseline must have been loaded
 * from persistent revision history by the server (not passed by an end user).
 * Editorial/draft edits since replacement are permitted, but ANY change to the
 * canonical projection (including accepted nodes, text, or links) blocks
 * restoration rather than risking duplicate scenes or lost changes.
 *
 * This is a pure structural compatibility check; narrative equivalence cannot
 * be proven from graph metadata alone. No broad project snapshot rollback.
 */
export function previewCancelReplacement(graph,{replacementId,baselineGraph}={}){
  const r=replacementOf(graph,replacementId);
  if(!goodRevision(r.sourceGraphRevision)||!baselineGraph)
    fail('TRUSTED_BASELINE_REQUIRED','recorded revision and trusted source snapshot required');
  validateCreativeWorkflowGraph(baselineGraph);
  if(baselineGraph.revision!==r.sourceGraphRevision||
    (baselineGraph.replacements??[]).some(x=>x.id===replacementId))
    fail('BASELINE_REVISION_MISMATCH','snapshot does not represent the recorded prior revision');
  const blockers=[];
  if((r.edgeResolutions??[]).length)blockers.push('DECISIONS_ALREADY_APPLIED');
  const old=originals(baselineGraph,r),now=originals(graph,r);
  if(JSON.stringify(old)!==JSON.stringify(now))blockers.push('ORIGINALS_CHANGED');
  const after=clone(graph);
  after.replacements=after.replacements.filter(x=>x.id!==replacementId);
  try{
    validateCreativeWorkflowGraph(after);
    if(stableProjection(after)!==stableProjection(baselineGraph))blockers.push('CANON_CHANGED_SINCE_REPLACEMENT');
  }catch{
    blockers.push('RESTORED_GRAPH_INVALID');
  }
  return {
    replacementId,sourceGraphRevision:r.sourceGraphRevision,
    canCancel:blockers.length===0,blockers,
    restoreNodeIds:[...r.sourceNodeIds],
    restoreEdgeIds:[...r.suspendedEdgeIds]
  };
}
/** Cancels only a proven unchanged replacement; otherwise fails without writes. */
export function applyCancelReplacement(graph,{replacementId,baselineGraph,expectedPreview,expectedRevision}={}){
  checkRevision(graph,expectedRevision);
  const plan=previewCancelReplacement(graph,{replacementId,baselineGraph});
  checkPreview(expectedPreview,plan);
  if(!plan.canCancel)fail('RESTORE_CONFLICT',plan.blockers.join(','));
  const next=clone(graph);
  next.replacements=next.replacements.filter(x=>x.id!==replacementId);
  validateCreativeWorkflowGraph(next);
  // This special operation is intentionally the only transition allowed to
  // remove an existing replacement record; protected originals were compared
  // against the trusted prior revision above.
  return {graph:next,changes:{
    replacementId,restoredNodeIds:[...plan.restoreNodeIds],
    restoredEdgeIds:[...plan.restoreEdgeIds],
    untouchedDrafts:true,autoRewiredEdgeIds:[]
  }};
}
