/**
 * CW-007/010 server boundary for the existing single-JSON project.
 * The editor's authenticated REST GET remains full-fidelity. Ordinary MCP
 * read tools receive ONLY the canonical projection. Generic graph writes are
 * deliberately not allowed to stage/promote draft material or rewrite the
 * protected originals: those transitions require a future explicit, reviewed
 * and transactionally persisted command.
 *
 * This module introduces no endpoint, tool schema, D1 table, or migration.
 */
import {validateGraph} from './graph_contract.mjs';
import {
  CreativeWorkflowContractError,
  validateCreativeWorkflowGraph,
  canonicalProjection
} from './creative_workflow_contract.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const scopeOf=x=>x.workspaceId??null;
// JSON object property order has no semantic meaning. Normalizing a graph
// (especially re-adding derived autoFieldIds) can change insertion order,
// so stringifying raw records incorrectly reports protected-node mutations.
function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value!==null&&typeof value==='object')
    return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
const exact=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
// Computed memberships never authorize an ordinary change to a draft.
// Ignore them for comparison but retain the authoritative stored object.
function protectedNodeContent(node){
  const result={...node};
  delete result.autoFieldIds;
  return result;
}
const byId=items=>new Map(items.map(item=>[item.id,item]));

/** Validate the legacy contract plus explicit workflow ownership rules. */
export function validateServerGraph(input){
  const graph=validateGraph(input);
  validateCreativeWorkflowGraph(graph);
  const active=canonicalProjection(graph);
  const activeNodeIds=new Set(active.nodes.map(n=>n.id));
  const activeFieldIds=new Set(active.fields.map(f=>f.id));
  for(const n of graph.nodes){
    if(scopeOf(n)!==null){
      // Working areas are peer canvases, not node hierarchy levels.
      if(n.parent!==null)fail('DRAFT_PARENT_INVALID',n.id);
      continue;
    }
    if(!activeNodeIds.has(n.id))continue; // protected, retired original
    if(n.parent!==null&&!activeNodeIds.has(n.parent))fail('CANON_PARENT_INVALID',n.id);
    for(const fieldId of [...(n.manualFieldIds??[]),...(n.autoFieldIds??[])]){
      if(!activeFieldIds.has(fieldId))fail('CANON_FIELD_INVALID',n.id);
    }
  }
  return graph;
}

/**
 * Strict whitelist for ordinary ChatGPT context. No raw graph spread: notes,
 * area metadata, replacement snapshots and future extensions are not exposed.
 * Keep legacy counters/view for backward-compatible get_project(detail=full).
 */
export function canonicalReadGraph(input){
  const g=validateServerGraph(input),projection=canonicalProjection(g);
  const result={};
  for(const key of ['version','revision','nextNode','nextEdge','nextField','nextLine']){
    if(g[key]!==undefined)result[key]=structuredClone(g[key]);
  }
  const activeIds=new Set(projection.nodes.map(n=>n.id));
  result.view=g.view===null||activeIds.has(g.view)?g.view:null;
  result.nodes=projection.nodes;
  result.edges=projection.edges;
  result.fields=projection.fields;
  result.lanes=projection.lanes;
  return result;
}

/**
 * Ordinary REST PUT/MCP patch is an editor update, NOT acceptance or
 * replacement. Block any mutation/deletion of drafts, work areas, suspended
 * originals, replacement records and previously resolved original arrows.
 * Canonical events/relations may still be edited by existing tools.
 */
export function assertOrdinaryGraphWrite(previousRaw,nextRaw){
  const previous=validateServerGraph(previousRaw),next=validateServerGraph(nextRaw);
  if(!exact(previous.workspaces??[],next.workspaces??[])||
     !exact(previous.replacements??[],next.replacements??[]))
    fail('EXPLICIT_WORKFLOW_COMMAND_REQUIRED','working areas and replacements are read-only to generic PUT');

  const oldNodes=byId(previous.nodes),oldEdges=byId(previous.edges);
  const frozenNodeIds=new Set([
    ...previous.nodes.filter(n=>scopeOf(n)!==null).map(n=>n.id),
    ...(previous.replacements??[]).flatMap(r=>r.sourceNodeIds)
  ]);
  const frozenEdgeIds=new Set([
    ...previous.edges.filter(e=>scopeOf(e)!==null).map(e=>e.id),
    ...(previous.replacements??[]).flatMap(r=>r.suspendedEdgeIds)
  ]);
  const newNodes=byId(next.nodes),newEdges=byId(next.edges);
  // Authored replacement candidates remain auditable after later edits.
  // Ordinary generic PUT cannot erase a linked candidate without a distinct,
  // reviewed workflow. Unlike protected originals, their text is editable.
  for(const candidateId of (previous.replacements??[]).flatMap(r=>r.candidateNodeIds??[]))
    if(!newNodes.has(candidateId))fail('PROTECTED_CANDIDATE_REMOVED',candidateId);
  for(const id of frozenNodeIds){
    if(!newNodes.has(id)||!exact(protectedNodeContent(oldNodes.get(id)),
      protectedNodeContent(newNodes.get(id))))
      fail('PROTECTED_NODE_CHANGED',id);
  }
  for(const id of frozenEdgeIds){
    if(!newEdges.has(id)||!exact(oldEdges.get(id),newEdges.get(id)))
      fail('PROTECTED_EDGE_CHANGED',id);
  }
  // Return unchanged protected records from storage, never the client copies.
  // Ordinary PUT may update canon/notes but cannot rewrite draft metadata,
  // even when a calculated field was recomputed by the browser.
  next.nodes=next.nodes.map(n=>frozenNodeIds.has(n.id)?oldNodes.get(n.id):n);
  next.edges=next.edges.map(e=>frozenEdgeIds.has(e.id)?oldEdges.get(e.id):e);
  for(const n of next.nodes){
    const previousNode=oldNodes.get(n.id);
    if(previousNode&&!exact(scopeOf(previousNode),scopeOf(n)))
      fail('WORKSPACE_MEMBERSHIP_CHANGED',n.id);
    if(!previousNode&&(scopeOf(n)!==null||n.draftBranchId!==undefined))
      fail('EXPLICIT_WORKFLOW_COMMAND_REQUIRED','a new draft must be staged by the reviewed operation');
  }
  for(const e of next.edges){
    const prior=oldEdges.get(e.id);
    if(prior&&!exact(scopeOf(prior),scopeOf(e)))
      fail('WORKSPACE_MEMBERSHIP_CHANGED',e.id);
    if(!prior&&(scopeOf(e)!==null||e.draftRelation!==undefined||e.draftBranchId!==undefined))
      fail('EXPLICIT_WORKFLOW_COMMAND_REQUIRED','a new draft relation must be staged by the reviewed operation');
  }
  return next;
}

/** Creating or restoring a whole project may not bypass explicit CW commands. */
export function assertOrdinaryGraphCreation(graphRaw){
  const graph=validateServerGraph(graphRaw);
  if((graph.workspaces??[]).length||(graph.replacements??[]).length||
    graph.nodes.some(n=>scopeOf(n)!==null)||
    graph.edges.some(e=>scopeOf(e)!==null))
    fail('EXPLICIT_WORKFLOW_COMMAND_REQUIRED','new projects cannot import isolated drafts by ordinary POST');
  return graph;
}
