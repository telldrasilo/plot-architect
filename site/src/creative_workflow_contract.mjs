/**
 * CW-007/010 reference contract for the proposed single-JSON creative workflow.
 * Pure, opt-in and NOT wired into the deployed editor, REST API, D1 or MCP.
 * Existing node.status remains an editorial status, not a canon/draft switch.
 */
export class CreativeWorkflowContractError extends Error {
  constructor(code, detail) { super(code+': '+detail); this.name='CreativeWorkflowContractError'; this.code=code; }
}
const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&x.length>0&&x.length<=80;
const own=(x,k)=>Object.hasOwn(x,k);
const workspaceOf=x=>x.workspaceId??null;
const isSuspended=(e,suspended)=>suspended.has(e.id);
const indexes=g=>({nodes:new Map(g.nodes.map(n=>[n.id,n])),edges:new Map(g.edges.map(e=>[e.id,e]))});

/** Validates only new workflow invariants; caller still uses legacy validateGraph. */
export function validateCreativeWorkflowGraph(graph){
  if(!obj(graph)||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))fail('GRAPH_INVALID','nodes/edges required');
  const areas=graph.workspaces??[],replacements=graph.replacements??[];
  if(!Array.isArray(areas)||!Array.isArray(replacements))fail('WORKFLOW_INVALID','workspaces/replacements must be arrays');
  const areaIds=new Set();
  for(const a of areas){
    if(!obj(a)||!id(a.id)||areaIds.has(a.id))fail('WORKSPACE_INVALID','unique workspace ID required');
    areaIds.add(a.id);
    if(![a.x,a.y,a.width,a.height].every(v=>typeof v==='number'&&Number.isFinite(v))||a.width<=0||a.height<=0)fail('WORKSPACE_INVALID',a.id+' invalid bounds');
    if(a.taskId!==undefined&&!id(a.taskId))fail('WORKSPACE_INVALID',a.id+' invalid task ID');
  }
  const {nodes,edges}=indexes(graph);
  if(nodes.size!==graph.nodes.length||edges.size!==graph.edges.length)fail('ID_DUPLICATE','node or edge');
  for(const n of graph.nodes){
    const w=workspaceOf(n);
    if(w!==null&&!areaIds.has(w))fail('WORKSPACE_NOT_FOUND',n.id);
    if(n.draftBranchId!==undefined&&(!id(n.draftBranchId)||w===null))fail('DRAFT_BRANCH_INVALID',n.id);
  }
  const originalNodes=new Set(),retiredSources=new Set(),suspended=new Set(),
   seenOldEdges=new Set(),replacementIds=new Set(),candidateOwners=new Set(),archivedCandidates=new Set();
  for(const r of replacements){
    if(!obj(r)||!id(r.id)||replacementIds.has(r.id)||!['open','completed','restored'].includes(r.state)
      ||!Array.isArray(r.sourceNodeIds)||!r.sourceNodeIds.length||!Array.isArray(r.suspendedEdgeIds)
      ||(r.sourceGraphRevision!==undefined&&(!Number.isSafeInteger(r.sourceGraphRevision)||r.sourceGraphRevision<0)))fail('REPLACEMENT_INVALID','identity, state, revision or arrays');
    replacementIds.add(r.id);
    if(new Set(r.sourceNodeIds).size!==r.sourceNodeIds.length||new Set(r.suspendedEdgeIds).size!==r.suspendedEdgeIds.length)fail('REPLACEMENT_INVALID',r.id+' duplicate source');
    const reviews=r.postCanonReviews??[];
    if(!Array.isArray(reviews)||reviews.length>50)fail('POST_CANON_REVIEW_INVALID',r.id);
    for(const review of reviews){
      if(!obj(review)||Object.keys(review).sort().join(',')!==
          'acknowledgedTitleConflicts,candidateDecisions,edgeDecisions,originalAction'||
         !['keep_replaced','restore'].includes(review.originalAction)||
         !Array.isArray(review.candidateDecisions)||!Array.isArray(review.edgeDecisions)||
         !Array.isArray(review.acknowledgedTitleConflicts)||
         new Set(review.acknowledgedTitleConflicts).size!==review.acknowledgedTitleConflicts.length||
         review.acknowledgedTitleConflicts.some(x=>!id(x)))
       fail('POST_CANON_REVIEW_INVALID',r.id);
      const cids=new Set(),eids=new Set();
      for(const c of review.candidateDecisions){
        if(!obj(c)||Object.keys(c).sort().join(',')!=='decision,nodeId'||
          !id(c.nodeId)||!r.candidateNodeIds?.includes(c.nodeId)||cids.has(c.nodeId)||
          !['keep','archive'].includes(c.decision))fail('POST_CANON_REVIEW_INVALID',r.id+' candidate');
        cids.add(c.nodeId);
      }
      for(const e of review.edgeDecisions){
        if(!obj(e)||Object.keys(e).sort().join(',')!=='decision,edgeId'||
           !id(e.edgeId)||!r.suspendedEdgeIds.includes(e.edgeId)||eids.has(e.edgeId)||
           !['keep_suspended','restore'].includes(e.decision))fail('POST_CANON_REVIEW_INVALID',r.id+' relation');
        eids.add(e.edgeId);
      }
      if(eids.size!==r.suspendedEdgeIds.length||
         (review.originalAction!=='restore'&&review.edgeDecisions.some(e=>e.decision==='restore')))
        fail('POST_CANON_REVIEW_INVALID',r.id+' original relation coverage');
    }
    const latest=reviews.at(-1);
    if((r.state==='restored')!==(latest?.originalAction==='restore'))
      fail('POST_CANON_REVIEW_INVALID',r.id+' state/outcome mismatch');
    if(r.state==='restored'&&reviews.some((x,i)=>i!==reviews.length-1&&x.originalAction==='restore'))
      fail('POST_CANON_REVIEW_INVALID',r.id+' cannot redo restored original');
    for(const c of latest?.candidateDecisions??[])if(c.decision==='archive')archivedCandidates.add(c.nodeId);
    if(r.candidateNodeIds!==undefined){
      if(!Array.isArray(r.candidateNodeIds)||r.candidateNodeIds.length>80||
         new Set(r.candidateNodeIds).size!==r.candidateNodeIds.length)
        fail('CANDIDATE_PROVENANCE_INVALID',r.id+' invalid candidate IDs');
      for(const candidateId of r.candidateNodeIds){
        if(!id(candidateId)||!nodes.has(candidateId)||r.sourceNodeIds.includes(candidateId)||
           candidateOwners.has(candidateId))
          fail('CANDIDATE_PROVENANCE_INVALID',r.id+' duplicate, missing or original candidate '+candidateId);
        candidateOwners.add(candidateId);
      }
    }
    for(const sourceId of r.sourceNodeIds){
      const n=nodes.get(sourceId);
      if(!n||workspaceOf(n)!==null||originalNodes.has(sourceId))fail('SOURCE_INVALID',sourceId);
      originalNodes.add(sourceId);
      if(r.state!=='restored')retiredSources.add(sourceId);
    }
    for(const edgeId of r.suspendedEdgeIds){
      const e=edges.get(edgeId);
      if(!e||workspaceOf(e)!==null||seenOldEdges.has(edgeId))fail('SUSPENSION_INVALID',edgeId);
      if(!r.sourceNodeIds.includes(e.from)&&!r.sourceNodeIds.includes(e.to))fail('SUSPENSION_INVALID',edgeId+' not incident to replacement');
      seenOldEdges.add(edgeId);
      if(r.state!=='restored'||!latest?.edgeDecisions.some(x=>x.edgeId===edgeId&&x.decision==='restore'))
        suspended.add(edgeId);
    }
  }
  for(const e of graph.edges){
    if(!nodes.has(e.from)||!nodes.has(e.to)||e.from===e.to)fail('EDGE_INVALID',e.id);
    const w=workspaceOf(e),from=workspaceOf(nodes.get(e.from)),to=workspaceOf(nodes.get(e.to));
    if(e.draftBranchId!==undefined&&(!id(e.draftBranchId)||w===null))fail('DRAFT_BRANCH_INVALID',e.id);
    if(w===null){
      if(own(e,'draftRelation'))fail('EDGE_INVALID',e.id+' unowned draft relation');
      if(from!==null||to!==null)fail('CANON_DRAFT_EDGE',e.id);
      if((retiredSources.has(e.from)||retiredSources.has(e.to))&&!isSuspended(e,suspended))fail('SUSPENSION_INCOMPLETE',e.id);
    }else{
      if(!areaIds.has(w)||!['internal','boundary-proposal'].includes(e.draftRelation))fail('DRAFT_EDGE_INVALID',e.id);
      if(from!==null&&from!==w||to!==null&&to!==w)fail('CROSS_WORKSPACE_EDGE',e.id);
      if(originalNodes.has(e.from)||originalNodes.has(e.to))fail('DRAFT_TO_ORIGINAL',e.id);
      if(e.draftRelation==='internal'&&from!==w&&to!==w)fail('STALE_INTERNAL_EDGE',e.id);
    }
  }
  // Optional per-original-edge outcomes. Unlisted suspended edges remain unresolved.
  // The old edge is never edited or removed; rewiring creates a distinct plot edge.
  const newLinks=new Set();
  for(const r of replacements){
    const outcomes=r.edgeResolutions??[];
    if(!Array.isArray(outcomes))fail('RESOLUTION_INVALID',r.id);
    const seenOriginals=new Set(),owned=new Set(r.sourceNodeIds);
    for(const result of outcomes){
      if(!obj(result)||!id(result.edgeId)||!r.suspendedEdgeIds.includes(result.edgeId)||seenOriginals.has(result.edgeId)
        ||!['rewire','drop'].includes(result.decision))fail('RESOLUTION_INVALID',r.id);
      seenOriginals.add(result.edgeId);
      if(result.decision==='drop'){
        if(Object.keys(result).some(k=>!['edgeId','decision'].includes(k)))fail('RESOLUTION_INVALID',result.edgeId);
        continue;
      }
      if(Object.keys(result).some(k=>!['edgeId','decision','newEdgeId'].includes(k))||!id(result.newEdgeId)
        ||newLinks.has(result.newEdgeId)||result.edgeId===result.newEdgeId)fail('RESOLUTION_INVALID',result.edgeId);
      newLinks.add(result.newEdgeId);
      const original=edges.get(result.edgeId),newEdge=edges.get(result.newEdgeId);
      if(!original||!newEdge||suspended.has(result.newEdgeId)||workspaceOf(newEdge)!==null
        ||!['precedes','causes','enables','hinders'].includes(newEdge.type))fail('RESOLUTION_TARGET_INVALID',result.edgeId);
      const from=nodes.get(newEdge.from),to=nodes.get(newEdge.to);
      if(!from||!to||workspaceOf(from)!==null||workspaceOf(to)!==null
        ||originalNodes.has(from.id)||originalNodes.has(to.id))fail('RESOLUTION_TARGET_INVALID',result.edgeId);
      if((!owned.has(original.from)&&newEdge.from!==original.from)
        ||(!owned.has(original.to)&&newEdge.to!==original.to))fail('EXTERNAL_ENDPOINT_CHANGED',result.edgeId);
    }
  }
  // New canon-neutral replacement preparations are independent of legacy
  // replacements[], which retire the original immediately.
  const preparations=graph.replacementPreparations??[];
  if(!Array.isArray(preparations)||preparations.length>100)
    fail('PREPARATIONS_INVALID','bounded preparation array required');
  const pids=new Set(),openSources=new Set(),openOldEdges=new Set(),openCandidates=new Set();
  for(const p of preparations){
    if(!obj(p)||!id(p.id)||pids.has(p.id)||
      !['open','cancelled','applied'].includes(p.state)||
      !id(p.sourceNodeId)||!Number.isSafeInteger(p.sourceRevision)||
      p.sourceRevision<0||!obj(p.sourceSnapshot)||
      p.sourceSnapshot.id!==p.sourceNodeId||
      !Array.isArray(p.incidentEdges)||p.incidentEdges.length>15000||
      !Array.isArray(p.candidateSelections)||p.candidateSelections.length>80||
      !Array.isArray(p.edgeDecisions)||p.edgeDecisions.length>15000||
      Object.keys(p).some(k=>!['id','state','sourceNodeId','sourceRevision','sourceSnapshot',
       'incidentEdges','candidateSelections','edgeDecisions'].includes(k)))
      fail('PREPARATIONS_INVALID','invalid preparation record');
    pids.add(p.id);
    const oldEdges=new Set();
    for(const e of p.incidentEdges){
      if(!obj(e)||!id(e.id)||oldEdges.has(e.id)||!id(e.from)||!id(e.to)||
         !['precedes','causes','enables','hinders'].includes(e.type)||
         e.from!==p.sourceNodeId&&e.to!==p.sourceNodeId||
         workspaceOf(e)!==null)
        fail('PREPARATIONS_INVALID',p.id+' invalid incident edge snapshot');
      oldEdges.add(e.id);
    }
    const candidateIds=new Set();
    for(const c of p.candidateSelections){
      if(!obj(c)||Object.keys(c).sort().join(',')!=='nodeId,workspaceId'||
         !id(c.workspaceId)||!id(c.nodeId)||candidateIds.has(c.nodeId))
        fail('PREPARATIONS_INVALID',p.id+' invalid candidate');
      candidateIds.add(c.nodeId);
      if(p.state==='open'){
        const node=nodes.get(c.nodeId);
        if(!areaIds.has(c.workspaceId)||!node||workspaceOf(node)!==c.workspaceId)
          fail('PREPARATION_CANDIDATE_STALE',c.nodeId);
        if(openCandidates.has(c.nodeId))
          fail('PREPARATION_CANDIDATE_CONFLICT',c.nodeId);
        openCandidates.add(c.nodeId);
      }
    }
    const decided=new Set();
    for(const d of p.edgeDecisions){
      if(!obj(d)||!id(d.edgeId)||!oldEdges.has(d.edgeId)||decided.has(d.edgeId)||
         !['rewire','drop'].includes(d.decision))
        fail('PREPARATIONS_INVALID',p.id+' invalid edge decision');
      decided.add(d.edgeId);
    }
    if(p.state==='open'){
      if(openSources.has(p.sourceNodeId))
        fail('PREPARATION_CONFLICT','duplicate open preparation for original');
      openSources.add(p.sourceNodeId);
      // A live preparation may become stale after an ordinary edit, but its
      // source must remain addressable: deleting it is a protected operation.
      if(!nodes.has(p.sourceNodeId)||workspaceOf(nodes.get(p.sourceNodeId))!==null)
        fail('PREPARATION_SOURCE_MISSING',p.sourceNodeId);
      for(const e of p.incidentEdges){
        if(openOldEdges.has(e.id))fail('PREPARATION_CONFLICT','shared incident edge');
        openOldEdges.add(e.id);
      }
      for(const r of replacements)if(r.state!=='restored'&&(
        r.sourceNodeIds.includes(p.sourceNodeId)||
        r.suspendedEdgeIds.some(id=>oldEdges.has(id))))
        fail('PREPARATION_LEGACY_CONFLICT',p.id);
    }
  }
  return graph;
}

/** Returns only an active plot projection. Never include notes, drafts or originals. */
export function canonicalProjection(graph){
  validateCreativeWorkflowGraph(graph);
  const retired=new Set((graph.replacements??[]).flatMap(r=>
    r.state==='restored'?[]:r.sourceNodeIds));
  for(const p of graph.replacementPreparations??[])if(p.state==='applied')retired.add(p.sourceNodeId);
  for(const r of graph.replacements??[]){
    const recent=(r.postCanonReviews??[]).at(-1);
    for(const c of recent?.candidateDecisions??[])if(c.decision==='archive')retired.add(c.nodeId);
  }
  const suspended=new Set((graph.replacements??[]).flatMap(r=>{
    const reviewed=r.state==='restored'?(r.postCanonReviews??[]).at(-1):null;
    const allowed=new Set(reviewed?.edgeDecisions.filter(d=>d.decision==='restore').map(d=>d.edgeId)??[]);
    return r.suspendedEdgeIds.filter(id=>!allowed.has(id));
  }));
  for(const p of graph.replacementPreparations??[])if(p.state==='applied')
    for(const e of p.incidentEdges)suspended.add(e.id);
  const nodes=graph.nodes.filter(n=>workspaceOf(n)===null&&!retired.has(n.id));
  const ids=new Set(nodes.map(n=>n.id));
  const edges=graph.edges.filter(e=>workspaceOf(e)===null&&!suspended.has(e.id)&&ids.has(e.from)&&ids.has(e.to));
  const fields=(graph.fields??[]).filter(f=>f.parent===null||f.parent===undefined||ids.has(f.parent));
  // Explicit whitelist prevents leaking editorial overlays through the projection.
  return {nodes:structuredClone(nodes),edges:structuredClone(edges),fields:structuredClone(fields),lanes:structuredClone(graph.lanes??[])};
}

/** Preview only; creates no graph changes, no implied external plot relations. */
function reviewedDraftPlacements(graph,nodeIds,placements){
 if(placements===undefined)return undefined; // Preserve the original API contract.
 if(!Array.isArray(placements)||placements.length!==nodeIds.length)
  fail('PLACEMENTS_INVALID','one position is required for each selected draft');
 const source=new Map(graph.nodes.map(n=>[n.id,n])),allowed=new Set(nodeIds),seen=new Set();
 const changes=[];
 for(const p of placements){
  if(!obj(p)||Object.keys(p).some(k=>!['nodeId','x','y'].includes(k))
    ||!allowed.has(p.nodeId)||seen.has(p.nodeId)
    ||typeof p.x!=='number'||!Number.isFinite(p.x)||Math.abs(p.x)>1_000_000
    ||typeof p.y!=='number'||!Number.isFinite(p.y)||Math.abs(p.y)>1_000_000)
   fail('PLACEMENTS_INVALID','unique valid positions for exactly the selected drafts');
  seen.add(p.nodeId);
 }
 // The preview has stable ordering by the selection, independent of user input order.
 for(const nodeId of nodeIds){
  const from=source.get(nodeId),to=placements.find(p=>p.nodeId===nodeId);
  changes.push({nodeId,before:{x:from.x,y:from.y},after:{x:to.x,y:to.y}});
 }
 return changes;
}
export function previewDraftAcceptance(graph,{workspaceId,nodeIds,placements}={}){
  validateCreativeWorkflowGraph(graph);
  if(!id(workspaceId)||!(graph.workspaces??[]).some(a=>a.id===workspaceId))fail('WORKSPACE_NOT_FOUND',String(workspaceId));
  if(!Array.isArray(nodeIds)||!nodeIds.length||new Set(nodeIds).size!==nodeIds.length)fail('SELECTION_INVALID','nonempty unique selection required');
  const selected=new Set(nodeIds),{nodes}=indexes(graph);
  if((graph.replacementPreparations??[]).some(p=>p.state==='open'&&
     p.candidateSelections.some(c=>selected.has(c.nodeId))))
    fail('PREPARATION_CANDIDATE_RESERVED','explicit preparation apply required');

  for(const n of selected)if(!nodes.has(n)||workspaceOf(nodes.get(n))!==workspaceId)fail('SELECTION_INVALID',n);
  const retired=new Set((graph.replacements??[]).flatMap(r=>r.sourceNodeIds));
  const becomesCanon=n=>selected.has(n)||(workspaceOf(nodes.get(n))===null&&!retired.has(n));
  const promoteEdgeIds=[],reviewEdgeIds=[];
  for(const e of graph.edges){
    if(workspaceOf(e)!==workspaceId||!selected.has(e.from)&&!selected.has(e.to))continue;
    if(e.draftRelation==='internal'&&becomesCanon(e.from)&&becomesCanon(e.to))promoteEdgeIds.push(e.id);
    else reviewEdgeIds.push(e.id);
  }
  const positionChanges=reviewedDraftPlacements(graph,nodeIds,placements);
  const remainingDrafts=graph.nodes.filter(n=>workspaceOf(n)===workspaceId&&!selected.has(n.id));
  const removeWorkspace=remainingDrafts.length===0;
  // An editor-owned edge cannot survive without a workspace. Before accepting
  // the LAST draft, require the author to resolve each unpromoted relation
  // explicitly, via the protected boundary-relation workflow. Never drop it.
  const promoted=new Set(promoteEdgeIds);
  const pendingOwnedEdges=removeWorkspace
   ?graph.edges.filter(e=>workspaceOf(e)===workspaceId&&!promoted.has(e.id))
   :[];
  if(pendingOwnedEdges.length)
   fail('WORKSPACE_UNRESOLVED_RELATIONS',pendingOwnedEdges.map(e=>e.id).join(','));
  const area=(graph.workspaces??[]).find(a=>a.id===workspaceId);
  const noteId=removeWorkspace&&typeof area?.taskId==='string'?area.taskId:null;
  if(noteId&&(graph.workspaces??[]).some(w=>w.id!==workspaceId&&w.taskId===noteId))
   fail('WORKSPACE_SOURCE_SHARED','another area references original task');
  // New staged workspaces have no note, but legacy areas may retain one.
  const removeNoteId=noteId&&(graph.gapNotes??[]).some(n=>n.id===noteId)?noteId:null;
  const removeGapLinkIds=removeNoteId?(graph.gapLinks??[]).filter(l=>
   l?.from?.kind==='gap_note'&&l.from.id===removeNoteId||
   l?.to?.kind==='gap_note'&&l.to.id===removeNoteId).map(l=>l.id):[];
  return {workspaceId,acceptNodeIds:[...selected],promoteEdgeIds,reviewEdgeIds,
   removeWorkspace,removeNoteId,removeGapLinkIds,autoRewiredEdgeIds:[],
   ...(positionChanges===undefined?{}:{positionChanges})};
}

/** Preview of a truly explicit replacement; does not modify canon. */
export function previewStartReplacement(graph,sourceNodeIds){
  validateCreativeWorkflowGraph(graph);
  if(!Array.isArray(sourceNodeIds)||!sourceNodeIds.length||new Set(sourceNodeIds).size!==sourceNodeIds.length)fail('SELECTION_INVALID','sources');
  const active=new Set(canonicalProjection(graph).nodes.map(n=>n.id));
  for(const id of sourceNodeIds)if(!active.has(id))fail('SOURCE_INVALID',id);
  const chosen=new Set(sourceNodeIds);
  const allIncident=new Set(graph.edges.filter(e=>workspaceOf(e)===null&&
    (chosen.has(e.from)||chosen.has(e.to))).map(e=>e.id));
  if((graph.replacementPreparations??[]).some(p=>p.state==='open'&&
    (chosen.has(p.sourceNodeId)||p.incidentEdges.some(e=>allIncident.has(e.id)))))
    fail('PREPARATION_CONFLICT','legacy start conflicts with active preparation');
  const suspendedEdgeIds=graph.edges.filter(e=>workspaceOf(e)===null&&(chosen.has(e.from)||chosen.has(e.to))).map(e=>e.id);
  const alreadySuspended=new Set((graph.replacements??[]).flatMap(r=>r.suspendedEdgeIds));
  if(suspendedEdgeIds.some(id=>alreadySuspended.has(id)))fail('REPLACEMENT_CONFLICT','shared old boundary edge');
  return {sourceNodeIds:[...chosen],suspendedEdgeIds,autoRewiredEdgeIds:[]};
}

/** Prevent ordinary edits from rewriting protected originals while a replacement persists. */
export function assertProtectedOriginalsUnchanged(previous,next){
  validateCreativeWorkflowGraph(previous);validateCreativeWorkflowGraph(next);
  const a=indexes(previous),b=indexes(next),replacements=new Map((next.replacements??[]).map(r=>[r.id,r]));
  for(const r of previous.replacements??[]){
    const match=replacements.get(r.id);
    if(!match)fail('REPLACEMENT_REMOVED',r.id+' requires explicit cancel operation');
    if(JSON.stringify(r.sourceNodeIds)!==JSON.stringify(match.sourceNodeIds)||JSON.stringify(r.suspendedEdgeIds)!==JSON.stringify(match.suspendedEdgeIds))fail('REPLACEMENT_CHANGED',r.id);
    if(r.sourceGraphRevision!==match.sourceGraphRevision)fail('REPLACEMENT_CHANGED',r.id+' baseline revision');
    if(r.state==='completed'&&!['completed','restored'].includes(match.state)||
       r.state==='restored'&&match.state!=='restored')
      fail('REPLACEMENT_STATE_CHANGED',r.id+' replacement state cannot reopen implicitly');
    const previousReviews=r.postCanonReviews??[],laterReviews=match.postCanonReviews??[];
    if(previousReviews.length>laterReviews.length||previousReviews.some((v,i)=>
      JSON.stringify(v)!==JSON.stringify(laterReviews[i])))
      fail('POST_CANON_REVIEW_CHANGED',r.id);
    if(match.state==='restored'&&r.state!=='restored'&&
       laterReviews.at(-1)?.originalAction!=='restore')
      fail('POST_CANON_REVIEW_CHANGED',r.id+' restoration requires reviewed outcome');
    const pastCandidates=r.candidateNodeIds??[],nextCandidates=match.candidateNodeIds??[];
    if(pastCandidates.length>nextCandidates.length||
       pastCandidates.some((candidateId,i)=>candidateId!==nextCandidates[i]))
      fail('CANDIDATE_PROVENANCE_CHANGED',r.id);
    const past=r.edgeResolutions??[],now=match.edgeResolutions??[];
    if(past.length>now.length||past.some((decision,i)=>JSON.stringify(decision)!==JSON.stringify(now[i])))fail('RESOLUTION_CHANGED',r.id);
    for(const nodeId of r.sourceNodeIds)if(JSON.stringify(a.nodes.get(nodeId))!==JSON.stringify(b.nodes.get(nodeId)))fail('ORIGINAL_CHANGED',nodeId);
    for(const edgeId of r.suspendedEdgeIds)if(JSON.stringify(a.edges.get(edgeId))!==JSON.stringify(b.edges.get(edgeId)))fail('ORIGINAL_CHANGED',edgeId);
  }
  return true;
}


/**
 * Apply an approved draft selection as one pure graph transformation.
 * This does NOT persist or increment a revision: callers must perform a guarded
 * single-snapshot save (or equivalent transactional CAS) on the server.
 * expectedPreview guards against an outdated review of affected edges;
 * expectedRevision, when supplied, checks this in-memory graph's revision only.
 */
export function applyDraftAcceptance(graph,{workspaceId,nodeIds,placements,expectedPreview,expectedRevision}={}){
  if(expectedRevision!==undefined){
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||graph?.revision!==expectedRevision)fail('REVISION_CONFLICT','graph revision differs from requested revision');
  }
  const plan=previewDraftAcceptance(graph,{workspaceId,nodeIds,placements});
  if(expectedPreview!==undefined&&JSON.stringify(expectedPreview)!==JSON.stringify(plan))fail('PREVIEW_STALE','acceptance plan changed');
  const accepted=new Set(plan.acceptNodeIds),promoted=new Set(plan.promoteEdgeIds);
  const next=structuredClone(graph);
  const positions=new Map((plan.positionChanges??[]).map(p=>[p.nodeId,p.after]));
  for(const n of next.nodes)if(accepted.has(n.id)){
    if(positions.has(n.id)){n.x=positions.get(n.id).x;n.y=positions.get(n.id).y}
    delete n.workspaceId;
    delete n.draftBranchId;
  }
  for(const e of next.edges)if(promoted.has(e.id)){
    delete e.workspaceId;
    delete e.draftRelation;
    delete e.draftBranchId;
  }
  if(plan.removeWorkspace)
   next.workspaces=(next.workspaces??[]).filter(w=>w.id!==workspaceId);
  if(plan.removeNoteId){
   next.gapNotes=(next.gapNotes??[]).filter(n=>n.id!==plan.removeNoteId);
   const affected=new Set(plan.removeGapLinkIds);
   next.gapLinks=(next.gapLinks??[]).filter(l=>!affected.has(l.id));
  }
  validateCreativeWorkflowGraph(next);
  assertProtectedOriginalsUnchanged(graph,next);
  return {graph:next,changes:plan};
}


/**
 * Detailed review snapshot for an explicit replacement. Unlike the legacy
 * ID-only preview, captures exact source content and affected arrow semantics,
 * so changing an endpoint/type/text invalidates an outstanding review.
 * Draft references are reported as blockers rather than silently discarded.
 */
export function previewReplacementStart(graph,sourceNodeIds){
  const base=previewStartReplacement(graph,sourceNodeIds);
  const selected=new Set(base.sourceNodeIds),{nodes,edges}=indexes(graph);
  const affectedDraftEdgeIds=graph.edges
    .filter(e=>workspaceOf(e)!==null&&(selected.has(e.from)||selected.has(e.to)))
    .map(e=>e.id);
  return {
    ...base,
    originalNodes:base.sourceNodeIds.map(id=>structuredClone(nodes.get(id))),
    suspendedEdges:base.suspendedEdgeIds.map(id=>structuredClone(edges.get(id))),
    affectedDraftEdgeIds
  };
}

/**
 * Begin a truly explicit replacement as one pure in-memory graph change.
 * Original nodes and all incident plot edges remain byte-for-byte unchanged;
 * a replacement record suspends them from the canonical projection.
 *
 * The review is mandatory. No D1 write, revision increment, recovery,
 * cancellation, generation or external-edge rewiring occurs here. A future
 * caller must use authoritative server-side CAS for durable atomicity.
 */
export function applyStartReplacement(graph,{replacementId,sourceNodeIds,expectedPreview,expectedRevision}={}){
  if(expectedRevision!==undefined&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||graph?.revision!==expectedRevision))
    fail('REVISION_CONFLICT','graph revision differs from requested revision');
  if(!id(replacementId))fail('REPLACEMENT_ID_INVALID','stable replacement ID required');
  const current=previewReplacementStart(graph,sourceNodeIds);
  if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','explicit review required before replacement');
  if(JSON.stringify(expectedPreview)!==JSON.stringify(current))fail('PREVIEW_STALE','source material or affected links changed');
  if((graph.replacements??[]).some(r=>r.id===replacementId))fail('REPLACEMENT_ID_CONFLICT',replacementId);
  if(current.affectedDraftEdgeIds.length)fail('DRAFT_REFERENCE_CONFLICT',current.affectedDraftEdgeIds.join(','));
  const next=structuredClone(graph);
  next.replacements??=[];
  next.replacements.push({
    id:replacementId,state:'open',
    sourceNodeIds:[...current.sourceNodeIds],
    suspendedEdgeIds:[...current.suspendedEdgeIds],
    // Only a revision pointer; the trusted old graph must be loaded from the
    // server's revision history for any future safe cancellation.
    ...(Number.isSafeInteger(graph.revision)&&graph.revision>=0?{sourceGraphRevision:graph.revision}:{})
  });
  validateCreativeWorkflowGraph(next);
  assertProtectedOriginalsUnchanged(graph,next);
  return {graph:next,changes:{replacementId,sourceNodeIds:[...current.sourceNodeIds],suspendedEdgeIds:[...current.suspendedEdgeIds],autoRewiredEdgeIds:[]}};
}
