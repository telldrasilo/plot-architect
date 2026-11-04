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
  }
  const originalNodes=new Set(),suspended=new Set(),replacementIds=new Set();
  for(const r of replacements){
    if(!obj(r)||!id(r.id)||replacementIds.has(r.id)||!['open','completed'].includes(r.state)
      ||!Array.isArray(r.sourceNodeIds)||!r.sourceNodeIds.length||!Array.isArray(r.suspendedEdgeIds))fail('REPLACEMENT_INVALID','identity, state or arrays');
    replacementIds.add(r.id);
    if(new Set(r.sourceNodeIds).size!==r.sourceNodeIds.length||new Set(r.suspendedEdgeIds).size!==r.suspendedEdgeIds.length)fail('REPLACEMENT_INVALID',r.id+' duplicate source');
    for(const sourceId of r.sourceNodeIds){
      const n=nodes.get(sourceId);
      if(!n||workspaceOf(n)!==null||originalNodes.has(sourceId))fail('SOURCE_INVALID',sourceId);
      originalNodes.add(sourceId);
    }
    for(const edgeId of r.suspendedEdgeIds){
      const e=edges.get(edgeId);
      if(!e||workspaceOf(e)!==null||suspended.has(edgeId))fail('SUSPENSION_INVALID',edgeId);
      if(!r.sourceNodeIds.includes(e.from)&&!r.sourceNodeIds.includes(e.to))fail('SUSPENSION_INVALID',edgeId+' not incident to replacement');
      suspended.add(edgeId);
    }
  }
  for(const e of graph.edges){
    if(!nodes.has(e.from)||!nodes.has(e.to)||e.from===e.to)fail('EDGE_INVALID',e.id);
    const w=workspaceOf(e),from=workspaceOf(nodes.get(e.from)),to=workspaceOf(nodes.get(e.to));
    if(w===null){
      if(own(e,'draftRelation'))fail('EDGE_INVALID',e.id+' unowned draft relation');
      if(from!==null||to!==null)fail('CANON_DRAFT_EDGE',e.id);
      if((originalNodes.has(e.from)||originalNodes.has(e.to))&&!isSuspended(e,suspended))fail('SUSPENSION_INCOMPLETE',e.id);
    }else{
      if(!areaIds.has(w)||!['internal','boundary-proposal'].includes(e.draftRelation))fail('DRAFT_EDGE_INVALID',e.id);
      if(from!==null&&from!==w||to!==null&&to!==w)fail('CROSS_WORKSPACE_EDGE',e.id);
      if(originalNodes.has(e.from)||originalNodes.has(e.to))fail('DRAFT_TO_ORIGINAL',e.id);
      if(e.draftRelation==='internal'&&from!==w&&to!==w)fail('STALE_INTERNAL_EDGE',e.id);
    }
  }
  return graph;
}

/** Returns only an active plot projection. Never include notes, drafts or originals. */
export function canonicalProjection(graph){
  validateCreativeWorkflowGraph(graph);
  const retired=new Set((graph.replacements??[]).flatMap(r=>r.sourceNodeIds));
  const suspended=new Set((graph.replacements??[]).flatMap(r=>r.suspendedEdgeIds));
  const nodes=graph.nodes.filter(n=>workspaceOf(n)===null&&!retired.has(n.id));
  const ids=new Set(nodes.map(n=>n.id));
  const edges=graph.edges.filter(e=>workspaceOf(e)===null&&!suspended.has(e.id)&&ids.has(e.from)&&ids.has(e.to));
  const fields=(graph.fields??[]).filter(f=>f.parent===null||f.parent===undefined||ids.has(f.parent));
  // Explicit whitelist prevents leaking editorial overlays through the projection.
  return {nodes:structuredClone(nodes),edges:structuredClone(edges),fields:structuredClone(fields),lanes:structuredClone(graph.lanes??[])};
}

/** Preview only; creates no graph changes, no implied external plot relations. */
export function previewDraftAcceptance(graph,{workspaceId,nodeIds}){
  validateCreativeWorkflowGraph(graph);
  if(!id(workspaceId)||!(graph.workspaces??[]).some(a=>a.id===workspaceId))fail('WORKSPACE_NOT_FOUND',String(workspaceId));
  if(!Array.isArray(nodeIds)||!nodeIds.length||new Set(nodeIds).size!==nodeIds.length)fail('SELECTION_INVALID','nonempty unique selection required');
  const selected=new Set(nodeIds),{nodes}=indexes(graph);
  for(const n of selected)if(!nodes.has(n)||workspaceOf(nodes.get(n))!==workspaceId)fail('SELECTION_INVALID',n);
  const retired=new Set((graph.replacements??[]).flatMap(r=>r.sourceNodeIds));
  const becomesCanon=n=>selected.has(n)||(workspaceOf(nodes.get(n))===null&&!retired.has(n));
  const promoteEdgeIds=[],reviewEdgeIds=[];
  for(const e of graph.edges){
    if(workspaceOf(e)!==workspaceId||!selected.has(e.from)&&!selected.has(e.to))continue;
    if(e.draftRelation==='internal'&&becomesCanon(e.from)&&becomesCanon(e.to))promoteEdgeIds.push(e.id);
    else reviewEdgeIds.push(e.id);
  }
  return {workspaceId,acceptNodeIds:[...selected],promoteEdgeIds,reviewEdgeIds,autoRewiredEdgeIds:[]};
}

/** Preview of a truly explicit replacement; does not modify canon. */
export function previewStartReplacement(graph,sourceNodeIds){
  validateCreativeWorkflowGraph(graph);
  if(!Array.isArray(sourceNodeIds)||!sourceNodeIds.length||new Set(sourceNodeIds).size!==sourceNodeIds.length)fail('SELECTION_INVALID','sources');
  const active=new Set(canonicalProjection(graph).nodes.map(n=>n.id));
  for(const id of sourceNodeIds)if(!active.has(id))fail('SOURCE_INVALID',id);
  const chosen=new Set(sourceNodeIds);
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
export function applyDraftAcceptance(graph,{workspaceId,nodeIds,expectedPreview,expectedRevision}={}){
  if(expectedRevision!==undefined){
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||graph?.revision!==expectedRevision)fail('REVISION_CONFLICT','graph revision differs from requested revision');
  }
  const plan=previewDraftAcceptance(graph,{workspaceId,nodeIds});
  if(expectedPreview!==undefined&&JSON.stringify(expectedPreview)!==JSON.stringify(plan))fail('PREVIEW_STALE','acceptance plan changed');
  const accepted=new Set(plan.acceptNodeIds),promoted=new Set(plan.promoteEdgeIds);
  const next=structuredClone(graph);
  for(const n of next.nodes)if(accepted.has(n.id))delete n.workspaceId;
  for(const e of next.edges)if(promoted.has(e.id)){
    delete e.workspaceId;
    delete e.draftRelation;
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
    suspendedEdgeIds:[...current.suspendedEdgeIds]
  });
  validateCreativeWorkflowGraph(next);
  assertProtectedOriginalsUnchanged(graph,next);
  return {graph:next,changes:{replacementId,sourceNodeIds:[...current.sourceNodeIds],suspendedEdgeIds:[...current.suspendedEdgeIds],autoRewiredEdgeIds:[]}};
}
