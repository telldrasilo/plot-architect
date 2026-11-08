/**
 * UX-RPL-E / P1: addressable saved-draft iteration context.
 *
 * A pure, bounded, read-only building block. No note resurrection, LLM,
 * MCP tool/schema registration, Site call or user-data write.
 * Permission to expose this through MCP is a separate owner decision.
 */
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';
import {CreativeWorkflowContractError} from './creative_workflow_contract.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
const text=(value,max)=>String(value??'').slice(0,max);
const MAX_SELECTED=16,MAX_NEIGHBORS=16,MAX_EDGES=48;

/**
 * Only explicitly selected saved drafts (and, if requested, a bounded one-hop
 * same-workspace neighborhood). Not a canonical plot projection, not an
 * unbounded dump of other variants/tasks, and not a new editorial note.
 */
export function getSavedDraftIterationContext(raw,{
 workspaceId,nodeIds,neighbors=false
}={}){
 const graph=validateServerGraph(raw);
 if(!id(workspaceId)||!(graph.workspaces??[]).some(w=>w.id===workspaceId))
  fail('DRAFT_ITERATION_WORKSPACE_INVALID','an existing saved workspace is required');
 if(!Array.isArray(nodeIds)||nodeIds.length<1||nodeIds.length>MAX_SELECTED||
   new Set(nodeIds).size!==nodeIds.length||nodeIds.some(x=>!id(x))||
   typeof neighbors!=='boolean')
  fail('DRAFT_ITERATION_SELECTION_INVALID','1–16 distinct draft IDs and boolean neighbors required');
 const sourceIds=new Set(nodeIds);
 const drafts=new Map(graph.nodes.filter(n=>n.workspaceId===workspaceId).map(n=>[n.id,n]));
 for(const x of sourceIds)if(!drafts.has(x))
  fail('DRAFT_ITERATION_NOT_OWNED','source must be an existing draft of this workspace: '+x);
 const internal=graph.edges.filter(e=>e.workspaceId===workspaceId&&
   e.draftRelation==='internal'&&drafts.has(e.from)&&drafts.has(e.to));
 const relatedIds=new Set();
 if(neighbors)for(const e of internal){
  if(sourceIds.has(e.from)&&!sourceIds.has(e.to))relatedIds.add(e.to);
  if(sourceIds.has(e.to)&&!sourceIds.has(e.from))relatedIds.add(e.from);
 }
 const linked=[...relatedIds].sort();
 const includedNeighborIds=linked.slice(0,MAX_NEIGHBORS);
 const included=new Set([...sourceIds,...includedNeighborIds]);
 const selected=nodeIds.map(x=>drafts.get(x));
 const linkedNodes=includedNeighborIds.map(x=>drafts.get(x));
 const relationships=internal.filter(e=>included.has(e.from)&&included.has(e.to));
 const projectRelations=graph.edges.filter(e=>
  (sourceIds.has(e.from)||sourceIds.has(e.to))&&
  !(e.workspaceId===workspaceId&&e.draftRelation==='internal'));
 // Do not disclose canonical or cross-boundary neighbor text. A bounded
 // count signals there are external/editorial relations requiring attention.
 return {
  revision:graph.revision,
  scope:{workspaceId,sourceNodeIds:[...nodeIds]},
  sourceDrafts:selected.map(n=>({
   id:n.id,title:text(n.title,300),description:text(n.description,3000),
   draftBranchId:n.draftBranchId??null
  })),
  sameWorkspaceNeighbors:linkedNodes.map(n=>({
   id:n.id,title:text(n.title,300),description:text(n.description,1200),
   draftBranchId:n.draftBranchId??null
  })),
  internalRelations:relationships.slice(0,MAX_EDGES).map(e=>({
   id:e.id,from:e.from,to:e.to,type:e.type
  })),
  editorialBoundaryRelationCount:Math.min(projectRelations.length,1000),
  truncated:{neighbors:linked.length>MAX_NEIGHBORS,
   internalRelations:relationships.length>MAX_EDGES,
   sourceDescriptions:selected.some(n=>String(n.description??'').length>3000),
   neighborDescriptions:linkedNodes.some(n=>String(n.description??'').length>1200)},
  requiredOutput:{
   kind:'single | alternatives',
   groups:[{
    title:'Новое предложение',
    events:[{key:'uniqueKey',title:'Краткий сюжетный блок',description:'Краткое описание'}],
    relations:[{from:'uniqueKey',to:'otherKey',type:'precedes | causes | enables | hinders'}]
   }],
   safety:'Сохранить новые версии рядом, не заменять и не принимать исходные черновики; не изменять сюжет.'
  }
 };
}
