/**
 * UX-RPL-GESTURE-01 A: protected, canon-neutral preparation of ONE event.
 * No AI invocation, automatic note, legacy replacement, external write or
 * published schema change. Durable writes go through reviewed workflow CAS.
 */
import {
 CreativeWorkflowContractError,canonicalProjection,validateCreativeWorkflowGraph
} from './creative_workflow_contract.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const scope=x=>x.workspaceId??null;

export function previewCreatePreparation(graph,{sourceNodeId}={}){
 validateCreativeWorkflowGraph(graph);
 if(!id(sourceNodeId))fail('PREPARATION_SOURCE_INVALID','one source ID required');
 const source=canonicalProjection(graph).nodes.find(n=>n.id===sourceNodeId);
 if(!source)fail('PREPARATION_SOURCE_INVALID','source must be an active canonical event');
 if(source.parent!==null&&source.parent!==undefined||
    graph.nodes.some(n=>n.parent===sourceNodeId))
   fail('PREPARATION_NESTED_SOURCE','child graph or nested event requires separate contract');
 // Explicit protection must never be silently bypassed. The legacy graph
 // has no authoritative runtime eligibility system: do not infer it from
 // status=approved, which is a normalizer default.
 if(source.protected===true||source.runtimeBound===true||source.locked===true)
   fail('PREPARATION_PROTECTED_SOURCE','explicitly protected or runtime-bound event');
 const edges=canonicalProjection(graph).edges.filter(e=>e.from===sourceNodeId||e.to===sourceNodeId);
 const edgeIds=new Set(edges.map(e=>e.id));
 if((graph.replacementPreparations??[]).some(p=>
   p.state==='open'&&(p.sourceNodeId===sourceNodeId||
     p.incidentEdges.some(e=>edgeIds.has(e.id)))))
   fail('PREPARATION_CONFLICT','open preparation on source or incident relation');
 if((graph.replacements??[]).some(r=>r.state!=='restored'&&(
   r.sourceNodeIds.includes(sourceNodeId)||
   r.suspendedEdgeIds.some(x=>edgeIds.has(x)))))
   fail('PREPARATION_LEGACY_CONFLICT','legacy replacement owns source or relation');
 // A draft edge referring directly to B cannot be implicitly included in
 // the new plan. It remains an independent editorial proposal.
 return {
   sourceNodeId,
   sourceNode:structuredClone(source),
   incidentEdges:structuredClone(edges),
   affectedDraftEdgeIds:graph.edges.filter(e=>scope(e)!==null&&
     (e.from===sourceNodeId||e.to===sourceNodeId)).map(e=>e.id),
   canonicalChanged:false
 };
}

export function applyCreatePreparation(graph,{
 preparationId,sourceNodeId,expectedPreview,expectedRevision
}={}){
 if(!Number.isSafeInteger(expectedRevision)||graph.revision!==expectedRevision)
   fail('REVISION_CONFLICT','authoritative graph revision differs');
 if(!id(preparationId))fail('PREPARATION_ID_INVALID','stable ID required');
 if((graph.replacementPreparations??[]).some(p=>p.id===preparationId))
   fail('PREPARATION_ID_CONFLICT',preparationId);
 const plan=previewCreatePreparation(graph,{sourceNodeId});
 if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','reviewed preview required');
 if(!exact(plan,expectedPreview))fail('PREVIEW_STALE','source or original relations changed');
 const next=structuredClone(graph);
 next.replacementPreparations??=[];
 next.replacementPreparations.push({
   id:preparationId,state:'open',sourceNodeId,
   sourceRevision:expectedRevision,
   sourceSnapshot:structuredClone(plan.sourceNode),
   incidentEdges:structuredClone(plan.incidentEdges),
   candidateSelections:[],
   edgeDecisions:[]
 });
 validateCreativeWorkflowGraph(next);
 return {graph:next,changes:{preparationId,sourceNodeId,
   incidentEdgeIds:plan.incidentEdges.map(e=>e.id),canonicalChanged:false}};
}

export function previewCancelPreparation(graph,{preparationId}={}){
 validateCreativeWorkflowGraph(graph);
 const p=(graph.replacementPreparations??[]).find(p=>p.id===preparationId);
 if(!p||p.state!=='open')fail('PREPARATION_NOT_OPEN',String(preparationId));
 return {preparationId,sourceNodeId:p.sourceNodeId,
   candidateNodeIds:p.candidateSelections.map(c=>c.nodeId),
   canonicalChanged:false,retainsDrafts:true};
}
export function applyCancelPreparation(graph,{
 preparationId,expectedPreview,expectedRevision
}={}){
 if(!Number.isSafeInteger(expectedRevision)||graph.revision!==expectedRevision)
   fail('REVISION_CONFLICT','authoritative graph revision differs');
 const plan=previewCancelPreparation(graph,{preparationId});
 if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','reviewed preview required');
 if(!exact(plan,expectedPreview))fail('PREVIEW_STALE','preparation changed');
 const next=structuredClone(graph);
 next.replacementPreparations.find(p=>p.id===preparationId).state='cancelled';
 validateCreativeWorkflowGraph(next);
 return {graph:next,changes:plan};
}
