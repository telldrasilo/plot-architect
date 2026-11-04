/**
 * CW-006/007 synthetic editor integration seam: turn a *prepared* alternative
 * payload for an existing standalone note into isolated draft graph objects.
 *
 * This does NOT generate with AI, arrange nodes, render workspace UI, or wire
 * any editor/API/MCP route. Existing gapNotes / gapLinks are left intact.
 * A note's legacy offerVariants flag is intentionally ignored (CW-006).
 */
import {validateGraph} from './graph_contract.mjs';
import {
  CreativeWorkflowContractError,
  validateCreativeWorkflowGraph,
  canonicalProjection,
  assertProtectedOriginalsUnchanged
} from './creative_workflow_contract.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&x.length>0&&x.length<=80;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const limited=(x,max)=>typeof x==='string'&&x.length<=max;
const allowed=(o,keys)=>Object.keys(o).every(k=>keys.includes(k));
const types=new Set(['precedes','causes','enables','hinders']);

/**
 * The caller supplies explicitly laid-out proposals. Bounding-box collision
 * detection and creative generation remain intentionally out of scope.
 * A technical ceiling (32 branches, 256 total nodes) is not a UX default of
 * exactly three alternatives.
 */
export function previewStageNoteAlternatives(graph,{noteId,workspaceId,workspace,branches}={}){
  validateGraph(graph);
  validateCreativeWorkflowGraph(graph);
  if(!id(noteId)||!id(workspaceId)||!Array.isArray(graph.gapNotes))
    fail('NOTE_INVALID','existing standalone note required');
  const note=graph.gapNotes.find(n=>n.id===noteId);
  if(!obj(note))fail('NOTE_NOT_FOUND',noteId);
  if(!limited(note.text,8000)||!note.text.trim()||note.status!=='pending')
    fail('NOTE_NOT_READY','nonempty pending note required');
  if((graph.workspaces??[]).some(w=>w.id===workspaceId||w.taskId===noteId))
    fail('WORKSPACE_CONFLICT','note already has an area or ID is taken');
  if(!obj(workspace)||!allowed(workspace,['x','y','width','height'])||
    ![workspace.x,workspace.y,workspace.width,workspace.height].every(finite)||
    workspace.width<=0||workspace.height<=0)
    fail('WORKSPACE_GEOMETRY_INVALID','explicit canvas bounds required');
  if(!Array.isArray(branches)||!branches.length||branches.length>32)
    fail('BRANCHES_INVALID','1–32 explicit, prepared branches required');
  const registered=new Set([
    ...graph.nodes.map(n=>n.id),...graph.edges.map(e=>e.id),
    ...graph.fields.map(f=>f.id),...(graph.workspaces??[]).map(a=>a.id)
  ]);
  registered.add(workspaceId);
  const seenBranchIds=new Set(),nodes=[],edges=[],labels=[];
  for(const branch of branches){
    if(!obj(branch)||!allowed(branch,['id','title','nodes','edges'])||!id(branch.id)||
      seenBranchIds.has(branch.id)||!limited(branch.title,160)||
      !Array.isArray(branch.nodes)||!branch.nodes.length||!Array.isArray(branch.edges))
      fail('BRANCH_INVALID','unique branch with nonempty nodes required');
    seenBranchIds.add(branch.id);
    const branchIds=new Set();
    for(const candidate of branch.nodes){
      if(!obj(candidate)||!allowed(candidate,['id','title','description','x','y'])||
        !id(candidate.id)||registered.has(candidate.id)||!limited(candidate.title,300)||
        !candidate.title.trim()||!limited(candidate.description??'',20000)||
        !finite(candidate.x)||!finite(candidate.y))
        fail('CANDIDATE_NODE_INVALID','id, title and explicit canvas coordinates required');
      registered.add(candidate.id);branchIds.add(candidate.id);
      nodes.push({
        id:candidate.id,title:candidate.title,description:candidate.description??'',
        x:candidate.x,y:candidate.y,status:'proposed',
        parent:null,workspaceId,draftBranchId:branch.id
      });
    }
    for(const candidate of branch.edges){
      if(!obj(candidate)||!allowed(candidate,['id','from','to','type'])||
        !id(candidate.id)||registered.has(candidate.id)||
        !branchIds.has(candidate.from)||!branchIds.has(candidate.to)||
        candidate.from===candidate.to||!types.has(candidate.type))
        fail('CANDIDATE_EDGE_INVALID','internal directed relation and unique edge ID required');
      registered.add(candidate.id);
      edges.push({
        id:candidate.id,from:candidate.from,to:candidate.to,type:candidate.type,
        workspaceId,draftBranchId:branch.id,draftRelation:'internal'
      });
    }
    labels.push({id:branch.id,title:branch.title,nodeCount:branch.nodes.length,edgeCount:branch.edges.length});
  }
  if(nodes.length>256||edges.length>512)fail('PROPOSAL_TOO_LARGE','prepared payload exceeds technical safeguard');
  const contextualLinks=(graph.gapLinks??[]).filter(l=>
    l?.from?.kind==='gap_note'&&l.from.id===noteId||
    l?.to?.kind==='gap_note'&&l.to.id===noteId
  );
  return {
    noteId,workspaceId,
    sourceNote:structuredClone(note),
    contextualLinks:structuredClone(contextualLinks),
    workspace:{id:workspaceId,taskId:noteId,...structuredClone(workspace)},
    branchSummaries:labels,
    proposedNodes:nodes,proposedEdges:edges,
    replacesCanonicalNodeIds:[],autoRewiredEdgeIds:[]
  };
}
/**
 * Stage an already prepared proposal; never accept it automatically.
 * Preserve original story content, note, context links and their coordinates.
 * No persistent write or revision bump occurs in this pure operation.
 */
export function applyStageNoteAlternatives(graph,{noteId,workspaceId,workspace,branches,expectedPreview,expectedRevision}={}){
  if(expectedRevision!==undefined&&
    (!Number.isSafeInteger(expectedRevision)||expectedRevision<0||graph?.revision!==expectedRevision))
    fail('REVISION_CONFLICT','graph revision differs from review');
  const plan=previewStageNoteAlternatives(graph,{noteId,workspaceId,workspace,branches});
  if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','author review of prepared proposal required');
  if(JSON.stringify(expectedPreview)!==JSON.stringify(plan))
    fail('PREVIEW_STALE','note or prepared alternatives changed');
  const next=structuredClone(graph);
  next.workspaces??=[];
  next.workspaces.push(structuredClone(plan.workspace));
  next.nodes.push(...structuredClone(plan.proposedNodes));
  next.edges.push(...structuredClone(plan.proposedEdges));
  validateGraph(next);
  validateCreativeWorkflowGraph(next);
  assertProtectedOriginalsUnchanged(graph,next);
  // No new plot facts are introduced by staging. Compare canon projections
  // rather than relying on a visual/semantic status like 'proposed'.
  const before=canonicalProjection(graph),after=canonicalProjection(next);
  if(JSON.stringify(before)!==JSON.stringify(after))
    fail('CANON_CHANGED','staging must not touch existing story');
  return {graph:next,changes:{
    noteId,workspaceId,branchIds:plan.branchSummaries.map(b=>b.id),
    stagedNodeIds:plan.proposedNodes.map(n=>n.id),stagedEdgeIds:plan.proposedEdges.map(e=>e.id),
    autoRewiredEdgeIds:[]
  }};
}
