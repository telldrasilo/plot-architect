/** CW-003: reviewed internal arrow edits inside ONE draft workspace.
 *
 * Ordinary graph PUT cannot edit protected drafts. These pure transformations
 * are applied only through the existing authenticated revision-CAS workflow.
 * They do not accept drafts, modify canon or reconnect external plot edges.
 */
import {CreativeWorkflowContractError,canonicalProjection,
  assertProtectedOriginalsUnchanged} from './creative_workflow_contract.mjs';
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const type=x=>['precedes','causes','enables','hinders'].includes(x);
const own=(o,k)=>Object.hasOwn(o,k);

function context(graph,workspaceId){
 validateServerGraph(graph);
 if(!id(workspaceId)||!(graph.workspaces??[]).some(a=>a.id===workspaceId))
  fail('WORKSPACE_NOT_FOUND',String(workspaceId));
 return {nodes:new Map(graph.nodes.map(n=>[n.id,n])),
  edges:new Map(graph.edges.map(e=>[e.id,e]))};
}
function requireNode(nodes,nodeId,workspaceId){
 if(!id(nodeId)||nodes.get(nodeId)?.workspaceId!==workspaceId)
  fail('DRAFT_TARGET_INVALID',String(nodeId));
}
function duplicate(graph,workspaceId,from,to,ignoreId){
 if(graph.edges.some(e=>e.workspaceId===workspaceId&&e.from===from&&e.to===to
   &&e.id!==ignoreId))fail('DRAFT_EDGE_DUPLICATE',from+'→'+to);
}
function verifyReview(actual,expectedPreview,revision,graph){
 if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<0
   ||graph.revision!==revision))fail('REVISION_CONFLICT','graph revision changed');
 if(!obj(expectedPreview))fail('PREVIEW_REQUIRED','approved exact preview required');
 if(JSON.stringify(actual)!==JSON.stringify(expectedPreview))
  fail('PREVIEW_STALE','draft edge or endpoints changed');
}
function isolated(graph,next){
 validateServerGraph(next);
 assertProtectedOriginalsUnchanged(graph,next);
 if(JSON.stringify(canonicalProjection(graph))!==JSON.stringify(canonicalProjection(next)))
  fail('CANON_CHANGED','draft arrow edit cannot change plot');
}
export function previewAddDraftEdge(graph,{workspaceId,edge}={}){
 const {nodes,edges}=context(graph,workspaceId);
 if(!obj(edge)||Object.keys(edge).some(k=>!['id','from','to','type'].includes(k))
   ||!id(edge.id)||!id(edge.from)||!id(edge.to)||edge.from===edge.to
   ||!type(edge.type))fail('DRAFT_EDGE_INVALID','new edge ID, endpoints and type required');
 if(edges.has(edge.id))fail('EDGE_ID_CONFLICT',edge.id);
 requireNode(nodes,edge.from,workspaceId);
 requireNode(nodes,edge.to,workspaceId);
 duplicate(graph,workspaceId,edge.from,edge.to);
 const from=nodes.get(edge.from),to=nodes.get(edge.to);
 const draftBranchId=from.draftBranchId&&from.draftBranchId===to.draftBranchId
  ?from.draftBranchId:undefined;
 return {workspaceId,operation:'add',edge:{
  id:edge.id,from:edge.from,to:edge.to,type:edge.type,
  workspaceId,draftRelation:'internal',
  ...(draftBranchId?{draftBranchId}:{})
 },sourceBefore:{id:from.id,workspaceId:from.workspaceId,
   draftBranchId:from.draftBranchId??null},
 targetBefore:{id:to.id,workspaceId:to.workspaceId,
   draftBranchId:to.draftBranchId??null},
 affectedDraftEdgeIds:[],autoRewiredEdgeIds:[]};
}
export function applyAddDraftEdge(graph,{workspaceId,edge,expectedPreview,
 expectedRevision}={}){
 const plan=previewAddDraftEdge(graph,{workspaceId,edge});
 verifyReview(plan,expectedPreview,expectedRevision,graph);
 const next=structuredClone(graph);
 next.edges.push(structuredClone(plan.edge));
 isolated(graph,next);
 return {graph:next,changes:{workspaceId,edgeId:plan.edge.id,
  addedEdge:structuredClone(plan.edge),autoRewiredEdgeIds:[]}};
}
export function previewRewireDraftEdge(graph,{workspaceId,edgeId,to}={}){
 const {nodes,edges}=context(graph,workspaceId);
 if(!id(edgeId)||!id(to))fail('DRAFT_EDGE_INVALID','edge ID and destination required');
 const old=edges.get(edgeId);
 if(!old||old.workspaceId!==workspaceId||old.draftRelation!=='internal')
  fail('DRAFT_EDGE_NOT_FOUND',String(edgeId));
 requireNode(nodes,old.from,workspaceId);
 requireNode(nodes,to,workspaceId);
 if(old.to===to)fail('DRAFT_EDGE_UNCHANGED',edgeId);
 if(old.from===to)fail('DRAFT_EDGE_SELF_LINK',edgeId);
 duplicate(graph,workspaceId,old.from,to,edgeId);
 // Recompute branch identity only when both new endpoints belong to it.
 const from=nodes.get(old.from),newTo=nodes.get(to);
 const after={...old,to};
 if(from.draftBranchId&&from.draftBranchId===newTo.draftBranchId)
  after.draftBranchId=from.draftBranchId;
 else delete after.draftBranchId;
 return {workspaceId,operation:'rewire',edgeId,before:structuredClone(old),
  after:structuredClone(after),targetBefore:{id:newTo.id,
   workspaceId:newTo.workspaceId,draftBranchId:newTo.draftBranchId??null},
  affectedDraftEdgeIds:[edgeId],autoRewiredEdgeIds:[]};
}
export function applyRewireDraftEdge(graph,{workspaceId,edgeId,to,expectedPreview,
 expectedRevision}={}){
 const plan=previewRewireDraftEdge(graph,{workspaceId,edgeId,to});
 verifyReview(plan,expectedPreview,expectedRevision,graph);
 const next=structuredClone(graph),index=next.edges.findIndex(e=>e.id===edgeId);
 next.edges[index]=structuredClone(plan.after);
 isolated(graph,next);
 return {graph:next,changes:{workspaceId,edgeId,
  before:plan.before,after:plan.after,autoRewiredEdgeIds:[]}};
}

/** Review a change of relation meaning without modifying endpoints or canon. */
export function previewSetDraftEdgeType(graph,{workspaceId,edgeId,newType}={}){
 const {nodes,edges}=context(graph,workspaceId);
 if(!id(edgeId)||!type(newType))
  fail('DRAFT_EDGE_INVALID','edge ID and approved relation type required');
 const old=edges.get(edgeId);
 if(!old||old.workspaceId!==workspaceId||old.draftRelation!=='internal')
  fail('DRAFT_EDGE_NOT_FOUND',String(edgeId));
 requireNode(nodes,old.from,workspaceId);
 requireNode(nodes,old.to,workspaceId);
 if(old.type===newType)fail('DRAFT_EDGE_UNCHANGED',edgeId);
 const after={...old,type:newType};
 return {workspaceId,operation:'type',edgeId,before:structuredClone(old),
  after:structuredClone(after),affectedDraftEdgeIds:[edgeId],
  autoRewiredEdgeIds:[]};
}
export function applySetDraftEdgeType(graph,{workspaceId,edgeId,newType,
 expectedPreview,expectedRevision}={}){
 const plan=previewSetDraftEdgeType(graph,{workspaceId,edgeId,newType});
 verifyReview(plan,expectedPreview,expectedRevision,graph);
 const next=structuredClone(graph),index=next.edges.findIndex(e=>e.id===edgeId);
 next.edges[index]=structuredClone(plan.after);
 isolated(graph,next);
 return {graph:next,changes:{workspaceId,edgeId,before:plan.before,
  after:plan.after,autoRewiredEdgeIds:[]}};
}
