/**
 * CW-010 pure mixed reconnection of suspended original plot edges.
 * No editor/API/MCP integration and no durable persistence or revision change.
 */
import {
  CreativeWorkflowContractError,
  validateCreativeWorkflowGraph,
  canonicalProjection,
  assertProtectedOriginalsUnchanged
} from './creative_workflow_contract.mjs';

const fail=(code,message)=>{throw new CreativeWorkflowContractError(code,message)};
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&x.length>0&&x.length<=80;
const types=new Set(['precedes','causes','enables','hinders']);

/**
 * Review each affected old edge independently. 'review' is an explicit deferral
 * with no graph mutation; 'drop' records an editorial decision without deleting
 * the immutable old edge; 'rewire' creates an explicitly approved fresh plot edge.
 * The old arrow remains suspended, preserving its original ID and semantics.
 */
export function previewReplacementReconnection(graph,{replacementId,decisions}={}){
  validateCreativeWorkflowGraph(graph);
  const replacement=(graph.replacements??[]).find(r=>r.id===replacementId);
  if(!replacement)fail('REPLACEMENT_NOT_FOUND',String(replacementId));
  if(replacement.state!=='open')fail('REPLACEMENT_NOT_OPEN',replacementId);
  if(!Array.isArray(decisions)||decisions.length===0||decisions.length>100)fail('DECISIONS_INVALID','1–100 decisions required');
  const oldEdges=new Map(graph.edges.map(e=>[e.id,e]));
  const oldSourceIds=new Set(replacement.sourceNodeIds);
  const suspended=new Set(replacement.suspendedEdgeIds);
  const alreadyResolved=new Set((replacement.edgeResolutions??[]).map(d=>d.edgeId));
  const active=canonicalProjection(graph);
  const activeIds=new Set(active.nodes.map(n=>n.id));
  const usedNewIds=new Set(graph.edges.map(e=>e.id));
  const triples=new Set(active.edges.map(e=>JSON.stringify([e.from,e.to,e.type])));
  const reviewedIds=new Set(),seen=new Set();
  const normalized=[],originalEdges=[],newEdges=[],droppedEdgeIds=[],deferredEdgeIds=[];
  for(const d of decisions){
    if(!isObject(d)||!id(d.edgeId)||seen.has(d.edgeId)||!['rewire','drop','review'].includes(d.decision))
      fail('DECISION_INVALID','unique suspended edge ID and valid action required');
    seen.add(d.edgeId);
    if(!suspended.has(d.edgeId))fail('EDGE_NOT_SUSPENDED',d.edgeId);
    if(alreadyResolved.has(d.edgeId))fail('EDGE_ALREADY_RESOLVED',d.edgeId);
    const original=oldEdges.get(d.edgeId);
    if(!original)fail('EDGE_NOT_FOUND',d.edgeId);
    reviewedIds.add(original.from);reviewedIds.add(original.to);
    originalEdges.push(structuredClone(original));
    if(d.decision==='rewire'){
      if(Object.keys(d).some(k=>!['edgeId','decision','newEdge'].includes(k))||!isObject(d.newEdge))fail('DECISION_INVALID',d.edgeId);
      const e=d.newEdge;
      if(Object.keys(e).some(k=>!['id','from','to','type'].includes(k))||!id(e.id)||!id(e.from)||!id(e.to)||!types.has(e.type)||e.from===e.to)
        fail('NEW_EDGE_INVALID',d.edgeId);
      if(usedNewIds.has(e.id))fail('EDGE_ID_CONFLICT',e.id);
      if(!activeIds.has(e.from)||!activeIds.has(e.to))fail('TARGET_NOT_CANONICAL',d.edgeId);
      if(!oldSourceIds.has(original.from)&&e.from!==original.from||!oldSourceIds.has(original.to)&&e.to!==original.to)
        fail('EXTERNAL_ENDPOINT_CHANGED',d.edgeId);
      const triple=JSON.stringify([e.from,e.to,e.type]);
      if(triples.has(triple))fail('DUPLICATE_PLOT_EDGE',d.edgeId);
      triples.add(triple);usedNewIds.add(e.id);
      const edge={id:e.id,from:e.from,to:e.to,type:e.type};
      newEdges.push(edge);
      reviewedIds.add(edge.from);reviewedIds.add(edge.to);
      normalized.push({edgeId:d.edgeId,decision:'rewire',newEdge:edge});
    }else{
      if(Object.keys(d).some(k=>!['edgeId','decision'].includes(k)))fail('DECISION_INVALID',d.edgeId);
      normalized.push({edgeId:d.edgeId,decision:d.decision});
      if(d.decision==='drop')droppedEdgeIds.push(d.edgeId);
      else deferredEdgeIds.push(d.edgeId);
    }
  }
  const newlyResolved=new Set([...normalized.filter(d=>d.decision==='rewire').map(d=>d.edgeId),...droppedEdgeIds]);
  const unresolvedEdgeIds=replacement.suspendedEdgeIds.filter(edgeId=>!alreadyResolved.has(edgeId)&&!newlyResolved.has(edgeId));
  const reviewedNodes=graph.nodes.filter(n=>reviewedIds.has(n.id)).map(n=>structuredClone(n));
  return {replacementId,decisions:normalized,originalEdges,reviewedNodes,newEdges,droppedEdgeIds,deferredEdgeIds,unresolvedEdgeIds};
}

/**
 * Apply the reviewed choices to a cloned graph, or fail with zero side effects.
 * Durable atomicity, real server CAS and idempotent receipts remain outside
 * this pure in-memory contract.
 */
export function applyReplacementReconnection(graph,{replacementId,decisions,expectedPreview,expectedRevision}={}){
  if(expectedRevision!==undefined&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||graph?.revision!==expectedRevision))
    fail('REVISION_CONFLICT','graph revision differs from requested revision');
  const plan=previewReplacementReconnection(graph,{replacementId,decisions});
  if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','explicit review is required');
  if(JSON.stringify(plan)!==JSON.stringify(expectedPreview))fail('PREVIEW_STALE','reviewed relations or surrounding events changed');
  if(!plan.newEdges.length&&!plan.droppedEdgeIds.length)fail('NO_RESOLUTIONS','deferral alone does not require a write');
  const next=structuredClone(graph);
  const target=next.replacements.find(r=>r.id===replacementId);
  target.edgeResolutions??=[];
  for(const d of plan.decisions){
    if(d.decision==='review')continue;
    if(d.decision==='drop')target.edgeResolutions.push({edgeId:d.edgeId,decision:'drop'});
    else {
      next.edges.push(structuredClone(d.newEdge));
      target.edgeResolutions.push({edgeId:d.edgeId,decision:'rewire',newEdgeId:d.newEdge.id});
    }
  }
  validateCreativeWorkflowGraph(next);
  assertProtectedOriginalsUnchanged(graph,next);
  return {graph:next,changes:{replacementId,rewired:target.edgeResolutions.filter(d=>plan.decisions.some(x=>x.edgeId===d.edgeId&&x.decision==='rewire')),droppedEdgeIds:plan.droppedEdgeIds,unresolvedEdgeIds:plan.unresolvedEdgeIds}};
}
