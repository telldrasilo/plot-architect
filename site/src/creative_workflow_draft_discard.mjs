/**
 * CW-055-B: explicit, reviewed disposal of one or more unaccepted draft nodes.
 *
 * All incident editorial relations are enumerated for author confirmation.
 * Only protected draft data from ONE workspace may be removed; no plot node,
 * canonical relation, replacement or field is silently rewritten.
 *
 * When deleting the last draft, the empty area and its original one-shot note
 * (if still present in legacy snapshots) are removed atomically. Fail closed
 * if any unresolved workspace relation would be left without its owner.
 */
import {
  CreativeWorkflowContractError,canonicalProjection,assertProtectedOriginalsUnchanged
} from './creative_workflow_contract.mjs';
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value);
const own=(obj,key)=>Object.hasOwn(obj,key);
const gapRefers=(link,kind,key)=>link?.from?.kind===kind&&link.from.id===key||
  link?.to?.kind===kind&&link.to.id===key;

export function previewDiscardDraftNodes(graph,{workspaceId,nodeIds}={}){
  validateServerGraph(graph);
  const area=(graph.workspaces??[]).find(a=>a.id===workspaceId);
  if(!id(workspaceId)||!area)fail('WORKSPACE_NOT_FOUND',String(workspaceId));
  if(!Array.isArray(nodeIds)||nodeIds.length<1||nodeIds.length>128||
     nodeIds.some(x=>!id(x))||new Set(nodeIds).size!==nodeIds.length)
    fail('DISCARD_SELECTION_INVALID','1–128 unique draft IDs required');
  const nodes=new Map(graph.nodes.map(n=>[n.id,n]));
  for(const key of nodeIds)
    if(nodes.get(key)?.workspaceId!==workspaceId)
      fail('DISCARD_TARGET_INVALID',key);
  const discarded=new Set(nodeIds);
  if((graph.replacementPreparations??[]).some(p=>p.state==='open'&&
     p.candidateSelections.some(c=>discarded.has(c.nodeId))))
    fail('PREPARATION_CANDIDATE_RESERVED','cancel or deselect preparation before discarding');
  if((graph.eventRewrites??[]).some(x=>discarded.has(x.nodeId))||
     (graph.fields??[]).some(x=>discarded.has(x.parent))||
     graph.nodes.some(x=>discarded.has(x.parent)))
    fail('DISCARD_DEPENDENCY','a non-draft object still refers to the selected draft');

  const incident=graph.edges.filter(e=>discarded.has(e.from)||discarded.has(e.to));
  if(incident.some(e=>e.workspaceId!==workspaceId))
    fail('DISCARD_PROTECTED_EDGE','selected node has an edge outside this workspace');

  const remaining=graph.nodes.filter(n=>n.workspaceId===workspaceId&&!discarded.has(n.id));
  const removeWorkspace=remaining.length===0;
  const remainingEdges=graph.edges.filter(e=>e.workspaceId===workspaceId&&!incident.includes(e));
  if(removeWorkspace&&remainingEdges.length)
    fail('DISCARD_UNRESOLVED_RELATIONS','workspace has relations with no remaining draft nodes');

  // The one-shot task note may predate the approved immediate-on-stage cleanup.
  // It may be removed only if no other workspace references its taskId.
  const noteId=removeWorkspace&&id(area.taskId)?area.taskId:null;
  if(noteId&&(graph.workspaces??[]).some(x=>x.id!==workspaceId&&x.taskId===noteId))
    fail('DISCARD_SHARED_SOURCE_NOTE','source note is shared by another workspace');
  const removeNoteId=noteId&&(graph.gapNotes??[]).some(n=>n.id===noteId)?noteId:null;
  const removedGapLinks=(graph.gapLinks??[]).filter(link=>
    nodeIds.some(nodeId=>gapRefers(link,'plot_node',nodeId))||
    (removeNoteId&&gapRefers(link,'gap_note',removeNoteId)));

  return {
    workspaceId,
    nodeIds:[...nodeIds],
    removedDrafts:nodeIds.map(key=>{
      const n=nodes.get(key);
      return {id:key,title:n.title,draftBranchId:n.draftBranchId??null};
    }),
    affectedRelations:incident.map(e=>({
      id:e.id,from:e.from,to:e.to,type:e.type,
      draftRelation:e.draftRelation,
      fromTitle:nodes.get(e.from)?.title??'',
      toTitle:nodes.get(e.to)?.title??''
    })),
    removedGapLinks:removedGapLinks.map(l=>({id:l.id,from:l.from,to:l.to})),
    remainingNodeIds:remaining.map(n=>n.id),
    removeWorkspace,
    removeNoteId,
    autoRewiredEdgeIds:[]
  };
}

export function applyDiscardDraftNodes(graph,{
  workspaceId,nodeIds,expectedPreview,expectedRevision
}={}){
  if(expectedRevision!==undefined&&
     (!Number.isSafeInteger(expectedRevision)||expectedRevision<0||
       graph?.revision!==expectedRevision))
    fail('REVISION_CONFLICT','graph revision changed since review');
  const plan=previewDiscardDraftNodes(graph,{workspaceId,nodeIds});
  if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','author review is mandatory');
  if(JSON.stringify(expectedPreview)!==JSON.stringify(plan))
    fail('PREVIEW_STALE','selected drafts or affected relations changed');
  const removedIds=new Set(plan.nodeIds);
  const removedEdges=new Set(plan.affectedRelations.map(x=>x.id));
  const removedLinks=new Set(plan.removedGapLinks.map(x=>x.id));
  const next=structuredClone(graph);
  next.nodes=next.nodes.filter(n=>!removedIds.has(n.id));
  next.edges=next.edges.filter(e=>!removedEdges.has(e.id));
  if(plan.removeWorkspace)
    next.workspaces=next.workspaces.filter(a=>a.id!==workspaceId);
  if(plan.removeNoteId)
    next.gapNotes=next.gapNotes.filter(n=>n.id!==plan.removeNoteId);
  if(removedLinks.size)
    next.gapLinks=(next.gapLinks??[]).filter(l=>!removedLinks.has(l.id));
  validateServerGraph(next);
  assertProtectedOriginalsUnchanged(graph,next);
  if(JSON.stringify(canonicalProjection(graph))!==JSON.stringify(canonicalProjection(next)))
    fail('CANON_CHANGED','discarding drafts must not change the active plot');
  return {graph:next,changes:{
    workspaceId,
    removedNodeIds:plan.nodeIds,
    removedEdgeIds:[...removedEdges],
    removedGapLinkIds:[...removedLinks],
    removedWorkspace:plan.removeWorkspace,
    removedNoteId:plan.removeNoteId,
    autoRewiredEdgeIds:[]
  }};
}
