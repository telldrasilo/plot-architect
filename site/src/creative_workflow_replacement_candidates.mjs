/**
 * CW-010 C3b: explicit, author-selected candidate provenance for a replacement.
 *
 * A candidate is NOT inferred to be a replacement because of its coordinates,
 * title, timing or proximity. Eligibility is bounded by an immutable project
 * revision loaded from the server; the author alone decides which eligible
 * canon events are related. This command NEVER changes the canonical graph,
 * erases an alternative or reactivates an old relation.
 */
import {
  CreativeWorkflowContractError,
  validateCreativeWorkflowGraph,
  canonicalProjection,
  assertProtectedOriginalsUnchanged
} from './creative_workflow_contract.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
const revision=x=>Number.isSafeInteger(x)&&x>=0;
const clone=x=>structuredClone(x);

/**
 * A server-sourced baseline is mandatory. Unknown legacy provenance is NEVER
 * silently inferred. A node that was already canonical when replacement began
 * cannot be retrospectively claimed as a newly accepted candidate.
 */
export function previewLinkReplacementCandidates(graph,{
  replacementId,nodeIds=[],baselineGraph
}={}){
  validateCreativeWorkflowGraph(graph);
  if(!Array.isArray(nodeIds)||nodeIds.length>80||new Set(nodeIds).size!==nodeIds.length||
     nodeIds.some(x=>!id(x)))fail('CANDIDATE_SELECTION_INVALID','unique candidate node IDs required');
  const r=(graph.replacements??[]).find(x=>x.id===replacementId);
  if(!r)fail('REPLACEMENT_NOT_FOUND',String(replacementId));
  if(!['open','completed'].includes(r.state))fail('REPLACEMENT_STATE_INVALID',String(replacementId));
  if(!revision(r.sourceGraphRevision)||!baselineGraph)
    fail('TRUSTED_BASELINE_REQUIRED','historical replacement source revision required');
  validateCreativeWorkflowGraph(baselineGraph);
  if(baselineGraph.revision!==r.sourceGraphRevision||
     (baselineGraph.replacements??[]).some(x=>x.id===replacementId))
    fail('BASELINE_REVISION_MISMATCH','baseline is not the recorded pre-replacement graph');
  const baselineNodes=new Map(baselineGraph.nodes.map(n=>[n.id,n]));
  const previouslyCanonical=new Set(canonicalProjection(baselineGraph).nodes.map(n=>n.id));
  const already=new Set(r.candidateNodeIds??[]);
  const ownedByOthers=new Set((graph.replacements??[])
    .filter(x=>x.id!==replacementId).flatMap(x=>x.candidateNodeIds??[]));
  const available=canonicalProjection(graph).nodes.filter(n=>
    !previouslyCanonical.has(n.id)&&!already.has(n.id)&&!ownedByOthers.has(n.id));
  const availableMap=new Map(available.map(n=>[n.id,n]));
  for(const nodeId of nodeIds){
    if(already.has(nodeId))fail('CANDIDATE_ALREADY_LINKED',nodeId);
    if(ownedByOthers.has(nodeId))fail('CANDIDATE_OWNED_BY_ANOTHER_REPLACEMENT',nodeId);
    if(previouslyCanonical.has(nodeId))fail('CANDIDATE_PREEXISTING_CANON',nodeId);
    if(!availableMap.has(nodeId))fail('CANDIDATE_NOT_ACTIVE_CANON',nodeId);
  }
  const origNodes=r.sourceNodeIds.map(n=>graph.nodes.find(x=>x.id===n));
  const oldEdges=r.suspendedEdgeIds.map(n=>graph.edges.find(x=>x.id===n));
  const candidates=available.map(n=>({
    node:clone(n),
    provenance:baselineNodes.has(n.id)?'draft_at_start':'created_after_start'
  }));
  const comparable=x=>(x?.title||'').trim().toLocaleLowerCase();
  const sameTitle=new Set(origNodes.map(comparable).filter(Boolean));
  return {
    replacementId,sourceGraphRevision:r.sourceGraphRevision,state:r.state,
    originalNodes:clone(origNodes),suspendedEdges:clone(oldEdges),
    alreadyLinkedNodeIds:[...(r.candidateNodeIds??[])],
    availableCandidates:candidates,selectedNodeIds:[...nodeIds],
    possibleExactTitleDuplicates:nodeIds.filter(nodeId=>
      sameTitle.has(comparable(availableMap.get(nodeId))))
  };
}
export function applyLinkReplacementCandidates(graph,{
  replacementId,nodeIds,baselineGraph,expectedPreview,expectedRevision
}={}){
  if(!revision(expectedRevision)||graph.revision!==expectedRevision)
    fail('REVISION_CONFLICT','project revision changed since review');
  if(!Array.isArray(nodeIds)||!nodeIds.length)
    fail('CANDIDATE_SELECTION_INVALID','explicit nonempty author selection required');
  const preview=previewLinkReplacementCandidates(graph,{replacementId,nodeIds,baselineGraph});
  if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','explicit candidate review required');
  if(JSON.stringify(expectedPreview)!==JSON.stringify(preview))
    fail('PREVIEW_STALE','candidate review differs from current graph/history');
  const next=clone(graph);
  const r=next.replacements.find(x=>x.id===replacementId);
  r.candidateNodeIds=[...(r.candidateNodeIds??[]),...nodeIds];
  validateCreativeWorkflowGraph(next);
  assertProtectedOriginalsUnchanged(graph,next);
  return {graph:next,changes:{
    replacementId,linkedNodeIds:[...nodeIds],
    totalLinkedNodeIds:[...r.candidateNodeIds],originalPreserved:true,
    canonicalNodesChanged:[],canonicalEdgesChanged:[]
  }};
}
