/**
 * UX-RPL-E P1: atomic, reviewed staging of a NEW draft iteration.
 * This operation does not create/revive gapNotes, alter prior workspace/draft
 * content, call an LLM, register an MCP tool, or accept anything into canon.
 * The creator supplies explicit new IDs/layout; a later authorized adapter
 * can compile model proposals into this same guarded contract.
 */
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';
import {canonicalProjection,CreativeWorkflowContractError} from './creative_workflow_contract.mjs';
import {getSavedDraftIterationContext} from './creative_workflow_draft_iteration_context.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1000000;
const allowed=(o,keys)=>obj(o)&&Object.keys(o).every(k=>keys.includes(k));
const text=(v,max)=>typeof v==='string'&&v.length<=max;
const types=new Set(['precedes','causes','enables','hinders']);

export function previewStageDraftIteration(graph,{
 sourceWorkspaceId,sourceNodeIds,workspaceId,workspace,branches
}={}){
 const g=validateServerGraph(graph);
 const source=getSavedDraftIterationContext(g,{
  workspaceId:sourceWorkspaceId,nodeIds:sourceNodeIds,neighbors:false
 });
 if(!id(workspaceId)||[...g.nodes,...g.edges,...g.fields,...(g.workspaces??[])]
   .some(x=>x.id===workspaceId))
  fail('ITERATION_WORKSPACE_CONFLICT','new unique workspace ID required');
 if(!allowed(workspace,['x','y','width','height'])||
    ![workspace.x,workspace.y,workspace.width,workspace.height].every(finite)||
    workspace.width<250||workspace.height<160)
  fail('ITERATION_WORKSPACE_GEOMETRY','bounded positive placement required');
 if(!Array.isArray(branches)||branches.length<1||branches.length>32)
  fail('ITERATION_BRANCHES_INVALID','1–32 new creative groups required');
 const used=new Set([
  ...g.nodes.map(x=>x.id),...g.edges.map(x=>x.id),
  ...g.fields.map(x=>x.id),...(g.workspaces??[]).map(x=>x.id),
  ...(g.gapNotes??[]).map(x=>x.id),workspaceId
 ]);
 const branchIds=new Set(),newNodes=[],newEdges=[],branchSummaries=[];
 for(const branch of branches){
  if(!allowed(branch,['id','title','nodes','edges'])||!id(branch.id)||
     branchIds.has(branch.id)||used.has(branch.id)||!text(branch.title,160)||
     !branch.title.trim()||!Array.isArray(branch.nodes)||branch.nodes.length<1||
     !Array.isArray(branch.edges))
   fail('ITERATION_BRANCH_INVALID','new branch ID, name, nodes and edges required');
  branchIds.add(branch.id);used.add(branch.id);
  const local=new Set();
  for(const n of branch.nodes){
   if(!allowed(n,['id','title','description','x','y'])||!id(n.id)||
      used.has(n.id)||!text(n.title,300)||!n.title.trim()||
      !text(n.description??'',20000)||!finite(n.x)||!finite(n.y))
    fail('ITERATION_NODE_INVALID','new unique ID, title, description and coordinates required');
   used.add(n.id);local.add(n.id);
   newNodes.push({id:n.id,title:n.title,description:n.description??'',x:n.x,y:n.y,
      status:'proposed',parent:null,workspaceId,draftBranchId:branch.id});
  }
  for(const e of branch.edges){
   if(!allowed(e,['id','from','to','type'])||!id(e.id)||used.has(e.id)||
      !local.has(e.from)||!local.has(e.to)||e.from===e.to||!types.has(e.type))
    fail('ITERATION_EDGE_INVALID','new directed relation must remain inside its group');
   used.add(e.id);
   if(newEdges.some(x=>x.from===e.from&&x.to===e.to&&x.type===e.type))
    fail('ITERATION_EDGE_DUPLICATE','one semantic relation per same pair/type');
   newEdges.push({id:e.id,from:e.from,to:e.to,type:e.type,
      workspaceId,draftBranchId:branch.id,draftRelation:'internal'});
  }
  branchSummaries.push({id:branch.id,title:branch.title,
    nodeCount:branch.nodes.length,edgeCount:branch.edges.length});
 }
 if(newNodes.length>256||newEdges.length>512)
  fail('ITERATION_TOO_LARGE','technical safety limits exceeded');
 const oldArea=g.workspaces.find(w=>w.id===sourceWorkspaceId);
 const a={x:workspace.x,y:workspace.y,width:workspace.width,height:workspace.height};
 if(a.x<oldArea.x+oldArea.width&&a.x+a.width>oldArea.x&&
    a.y<oldArea.y+oldArea.height&&a.y+a.height>oldArea.y)
  fail('ITERATION_OVERLAPPING_WORKSPACE','new version should not obscure original working area');
 return {
  sourceWorkspaceId,sourceNodeIds:[...sourceNodeIds],
  sourceDraftSnapshots:source.sourceDrafts,
  workspace:{id:workspaceId,...structuredClone(workspace)},
  branchSummaries,
  proposedNodes:newNodes,proposedEdges:newEdges,
  untouchedSource:true,canonicalChanged:false
 };
}

export function applyStageDraftIteration(graph,{
 sourceWorkspaceId,sourceNodeIds,workspaceId,workspace,branches,
 expectedPreview,expectedRevision
}={}){
 if(!Number.isSafeInteger(expectedRevision)||graph?.revision!==expectedRevision)
  fail('REVISION_CONFLICT','reviewed revision no longer current');
 if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','author approval is required');
 const preview=previewStageDraftIteration(graph,{
  sourceWorkspaceId,sourceNodeIds,workspaceId,workspace,branches
 });
 if(JSON.stringify(preview)!==JSON.stringify(expectedPreview))
  fail('PREVIEW_STALE','source draft or new proposal changed');
 const original=validateServerGraph(graph);
 const canon=canonicalProjection(original);
 const next=structuredClone(original);
 next.workspaces??=[];
 next.workspaces.push(structuredClone(preview.workspace));
 next.nodes.push(...structuredClone(preview.proposedNodes));
 next.edges.push(...structuredClone(preview.proposedEdges));
 validateServerGraph(next);
 if(JSON.stringify(canonicalProjection(next))!==JSON.stringify(canon))
  fail('CANON_CHANGED','draft iteration cannot alter canonical plot');
 if(next.nodes.filter(n=>n.workspaceId===sourceWorkspaceId).length!==
    original.nodes.filter(n=>n.workspaceId===sourceWorkspaceId).length)
  fail('ITERATION_SOURCE_CHANGED','source workspace was altered');
 return {graph:next,changes:{
  sourceWorkspaceId,sourceNodeIds:[...sourceNodeIds],workspaceId,
  stagedNodeIds:preview.proposedNodes.map(n=>n.id),
  stagedEdgeIds:preview.proposedEdges.map(e=>e.id),
  canonChanged:false,sourceDraftsRetained:true
 }};
}
