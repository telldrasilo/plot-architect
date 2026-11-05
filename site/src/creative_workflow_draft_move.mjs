/**
 * CW-015: reviewed movement of persisted draft cards inside their working area.
 * Only coordinates can change; ownership, story facts, arrows and replacement
 * records are preserved. This is a pure graph transform, not a REST write.
 */
import {
  CreativeWorkflowContractError,
  canonicalProjection,
  assertProtectedOriginalsUnchanged
} from './creative_workflow_contract.mjs';
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const own=(x,k)=>Object.hasOwn(x,k);
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validId=x=>typeof x==='string'&&x.length>0&&x.length<=80;
const coordinate=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1_000_000;
// Workspaces are visual groupings, not movement cages. The existing
// coordinate guard protects storage against NaN, infinity and huge values.

/** Read-only preview, snapshots exact before and after geometry. */
export function previewMoveDraftNodes(graph,{workspaceId,moves}={}){
  validateServerGraph(graph);
  const area=(graph.workspaces??[]).find(a=>a.id===workspaceId);
  if(!validId(workspaceId)||!area)fail('WORKSPACE_NOT_FOUND',String(workspaceId));
  if(!Array.isArray(moves)||moves.length<1||moves.length>128)
    fail('MOVE_SELECTION_INVALID','1–128 draft positions required');
  const nodes=new Map(graph.nodes.map(n=>[n.id,n])),seen=new Set(),positionChanges=[];
  for(const move of moves){
    if(!isObj(move)||Object.keys(move).some(k=>!['nodeId','x','y'].includes(k))
      ||!validId(move.nodeId)||seen.has(move.nodeId))
      fail('MOVE_SELECTION_INVALID','unique nodeId, x, y only');
    seen.add(move.nodeId);
    const n=nodes.get(move.nodeId);
    if(!n||n.workspaceId!==workspaceId)
      fail('MOVE_TARGET_INVALID',move.nodeId);
    if(!coordinate(move.x)||!coordinate(move.y))
      fail('MOVE_COORDINATES_INVALID',move.nodeId);
    if(move.x===n.x&&move.y===n.y)
      fail('MOVE_UNCHANGED',move.nodeId);
    positionChanges.push({
      nodeId:move.nodeId,before:{x:n.x,y:n.y},after:{x:move.x,y:move.y}
    });
  }
  const moved=new Set(positionChanges.map(x=>x.nodeId));
  const affectedDraftEdgeIds=graph.edges
    .filter(e=>e.workspaceId===workspaceId&&(moved.has(e.from)||moved.has(e.to)))
    .map(e=>e.id);
  return {workspaceId,positionChanges,affectedDraftEdgeIds,autoRewiredEdgeIds:[]};
}
/** Apply an explicitly reviewed batch; no acceptance or implied story edits. */
export function applyMoveDraftNodes(graph,{
  workspaceId,moves,expectedPreview,expectedRevision
}={}){
  if(expectedRevision!==undefined&&
    (!Number.isSafeInteger(expectedRevision)||expectedRevision<0||graph?.revision!==expectedRevision))
    fail('REVISION_CONFLICT','graph revision changed since review');
  const actual=previewMoveDraftNodes(graph,{workspaceId,moves});
  if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','review of requested coordinates required');
  if(JSON.stringify(actual)!==JSON.stringify(expectedPreview))
    fail('PREVIEW_STALE','draft positions or affected arrows changed');
  const next=structuredClone(graph);
  const byId=new Map(next.nodes.map(n=>[n.id,n]));
  for(const item of actual.positionChanges){
    const node=byId.get(item.nodeId);
    node.x=item.after.x;node.y=item.after.y;
  }
  validateServerGraph(next);
  assertProtectedOriginalsUnchanged(graph,next);
  const before=canonicalProjection(graph),after=canonicalProjection(next);
  if(JSON.stringify(before)!==JSON.stringify(after))
    fail('CANON_CHANGED','moving drafts must not change canon');
  return {graph:next,changes:{
    workspaceId,
    movedNodeIds:actual.positionChanges.map(x=>x.nodeId),
    affectedDraftEdgeIds:[...actual.affectedDraftEdgeIds],
    autoRewiredEdgeIds:[]
  }};
}
