/** CW-055: explicitly refuse an unresolved editor-owned relation.
 *
 * Never delete canonical arrows or unrelated internal draft links.
 * No rewiring, canonization or movement. The same preview is required for CAS.
 */
import {
 CreativeWorkflowContractError,canonicalProjection,assertProtectedOriginalsUnchanged
} from './creative_workflow_contract.mjs';
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';
const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x);

export function previewDropBoundaryRelation(graph,{workspaceId,edgeId}={}){
 validateServerGraph(graph);
 if(!id(workspaceId)||(graph.workspaces??[]).every(a=>a.id!==workspaceId))
  fail('WORKSPACE_NOT_FOUND',String(workspaceId));
 const e=graph.edges.find(e=>e.id===edgeId);
 if(!id(edgeId)||!e||e.workspaceId!==workspaceId||
    !['internal','boundary-proposal'].includes(e.draftRelation))
  fail('BOUNDARY_EDGE_NOT_FOUND',String(edgeId));
 const from=graph.nodes.find(n=>n.id===e.from),to=graph.nodes.find(n=>n.id===e.to);
 const fromDraft=from?.workspaceId===workspaceId,toDraft=to?.workspaceId===workspaceId;
 // Internal draft↔draft removal is tracked separately as #103; this command
 // only resolves a relation crossing canon/draft or a canon↔canon proposal.
 if(fromDraft&&toDraft||(!fromDraft&&!toDraft&&e.draftRelation!=='boundary-proposal'))
  fail('BOUNDARY_EDGE_REQUIRED','select a pending boundary relation');
 return {
  workspaceId,edgeId,relation:{
   id:e.id,from:e.from,to:e.to,type:e.type,
   draftRelation:e.draftRelation,fromTitle:from.title,toTitle:to.title
  },autoRewiredEdgeIds:[]
 };
}
export function applyDropBoundaryRelation(graph,{
 workspaceId,edgeId,expectedPreview,expectedRevision
}={}){
 if(expectedRevision!==undefined&&(!Number.isSafeInteger(expectedRevision)||
    expectedRevision<0||graph?.revision!==expectedRevision))
  fail('REVISION_CONFLICT','project changed');
 const plan=previewDropBoundaryRelation(graph,{workspaceId,edgeId});
 if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','exact author review required');
 if(JSON.stringify(plan)!==JSON.stringify(expectedPreview))
  fail('PREVIEW_STALE','selected relation changed since preview');
 const next=structuredClone(graph);
 next.edges=next.edges.filter(e=>e.id!==edgeId);
 validateServerGraph(next);
 assertProtectedOriginalsUnchanged(graph,next);
 if(JSON.stringify(canonicalProjection(graph))!==JSON.stringify(canonicalProjection(next)))
  fail('CANON_CHANGED','refusing editorial relation must not change canon');
 return {graph:next,changes:{
  workspaceId,removedEdgeId:edgeId,autoRewiredEdgeIds:[]
 }};
}
