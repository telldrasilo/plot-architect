/**
 * UX-RPL-GESTURE-01 C: exact, guarded author choices for local replacement.
 * Selection is not geometry, a generated task ID, or a promotion to canon.
 * Decisions resolve original incident edges without changing plot edges.
 */
import {CreativeWorkflowContractError,canonicalProjection} from './creative_workflow_contract.mjs';
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';

const fail=(code,message)=>{throw new CreativeWorkflowContractError(code,message)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const checked=(graph,preparationId)=>{
 const g=validateServerGraph(graph);
 const p=(g.replacementPreparations??[]).find(p=>p.id===preparationId);
 if(!p||p.state!=='open')fail('PREPARATION_NOT_OPEN',String(preparationId));
 return {g,p};
};
function requireCandidate(g,p,c){
 const n=g.nodes.find(n=>n.id===c.nodeId);
 if(!n||n.workspaceId!==c.workspaceId||
    !(g.workspaces??[]).some(w=>w.id===c.workspaceId))
   fail('PREPARATION_CANDIDATE_INVALID',c.nodeId);
 if((g.replacements??[]).some(r=>r.sourceNodeIds.includes(c.nodeId)||
    (r.candidateNodeIds??[]).includes(c.nodeId))||
    (g.replacementPreparations??[]).some(x=>x.id!==p.id&&x.state==='open'&&
      x.candidateSelections.some(y=>y.nodeId===c.nodeId)))
   fail('PREPARATION_CANDIDATE_CONFLICT',c.nodeId);
}
export function previewSetPreparationCandidates(graph,{preparationId,candidates}={}){
 const {g,p}=checked(graph,preparationId);
 if(!Array.isArray(candidates)||candidates.length>80)
   fail('PREPARATION_SELECTION_INVALID','explicit bounded candidate array required');
 const seen=new Set();
 for(const c of candidates){
   if(!c||typeof c!=='object'||Array.isArray(c)||
      Object.keys(c).sort().join(',')!=='nodeId,workspaceId'||
      !id(c.nodeId)||!id(c.workspaceId)||seen.has(c.nodeId))
     fail('PREPARATION_SELECTION_INVALID','unique workspaceId/nodeId required');
   seen.add(c.nodeId);
   requireCandidate(g,p,c);
 }
 // Existing approved-looking rewires cannot silently retarget or lose a
 // selected endpoint. Author must first edit the decision explicitly.
 for(const d of p.edgeDecisions){
   if(d.decision==='rewire'){
     const old=p.incidentEdges.find(e=>e.id===d.edgeId);
     const target=old?.from===p.sourceNodeId?d.newEdge?.from:d.newEdge?.to;
     if(!seen.has(target))fail('PREPARATION_DECISION_CONFLICT',d.edgeId);
   }
 }
 return {preparationId,previousCandidates:structuredClone(p.candidateSelections),
   candidates:structuredClone(candidates),
   addedNodeIds:candidates.filter(c=>!p.candidateSelections.some(old=>old.nodeId===c.nodeId)).map(c=>c.nodeId),
   removedNodeIds:p.candidateSelections.filter(old=>!seen.has(old.nodeId)).map(c=>c.nodeId),
   canonicalChanged:false};
}
export function applySetPreparationCandidates(graph,{
 preparationId,candidates,expectedPreview,expectedRevision
}={}){
 if(!Number.isSafeInteger(expectedRevision)||graph.revision!==expectedRevision)
   fail('REVISION_CONFLICT','graph changed since candidate review');
 const p=previewSetPreparationCandidates(graph,{preparationId,candidates});
 if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','candidate review required');
 if(!exact(p,expectedPreview))fail('PREVIEW_STALE','candidate selection changed');
 const next=structuredClone(graph);
 next.replacementPreparations.find(x=>x.id===preparationId).candidateSelections=structuredClone(candidates);
 validateServerGraph(next);
 if(!exact(canonicalProjection(graph),canonicalProjection(next)))
   fail('CANON_CHANGED','selection cannot promote candidates');
 return {graph:next,changes:p};
}

export function previewSetPreparationDecisions(graph,{preparationId,decisions}={}){
 const {g,p}=checked(graph,preparationId);
 if(!Array.isArray(decisions)||decisions.length>p.incidentEdges.length)
   fail('PREPARATION_DECISIONS_INVALID','explicit bounded decisions required');
 const oldEdges=new Map(p.incidentEdges.map(e=>[e.id,e]));
 const selected=new Set(p.candidateSelections.map(c=>c.nodeId));
 const seen=new Set(),newIds=new Set();
 const graphEdgeIds=new Set(g.edges.map(e=>e.id));
 for(const d of decisions){
   if(!d||typeof d!=='object'||Array.isArray(d)||!id(d.edgeId)||
      !oldEdges.has(d.edgeId)||seen.has(d.edgeId)||!['rewire','drop'].includes(d.decision))
     fail('PREPARATION_DECISIONS_INVALID','decision for distinct old edge required');
   seen.add(d.edgeId);
   if(d.decision==='drop'){
     if(Object.keys(d).sort().join(',')!=='decision,edgeId')
       fail('PREPARATION_DECISIONS_INVALID',d.edgeId);
   }else{
     if(Object.keys(d).sort().join(',')!=='decision,edgeId,newEdge'||
        !d.newEdge||typeof d.newEdge!=='object'||
        Object.keys(d.newEdge).sort().join(',')!=='from,id,to,type')
       fail('PREPARATION_DECISIONS_INVALID',d.edgeId);
     const e=d.newEdge,old=oldEdges.get(d.edgeId);
     if(!id(e.id)||graphEdgeIds.has(e.id)||newIds.has(e.id)||
        !id(e.from)||!id(e.to)||e.from===e.to||
        !['precedes','causes','enables','hinders'].includes(e.type))
       fail('PREPARATION_DECISIONS_INVALID','invalid future edge '+d.edgeId);
     newIds.add(e.id);
     if(old.from===p.sourceNodeId?
          (!selected.has(e.from)||e.to!==old.to):
          (!selected.has(e.to)||e.from!==old.from))
       fail('PREPARATION_DECISION_ENDPOINT',d.edgeId);
   }
 }
 return {preparationId,
   previousDecisions:structuredClone(p.edgeDecisions),
   decisions:structuredClone(decisions),
   unresolvedOldEdgeIds:p.incidentEdges.filter(e=>!seen.has(e.id)).map(e=>e.id),
   canonicalChanged:false};
}
export function applySetPreparationDecisions(graph,{
 preparationId,decisions,expectedPreview,expectedRevision
}={}){
 if(!Number.isSafeInteger(expectedRevision)||graph.revision!==expectedRevision)
   fail('REVISION_CONFLICT','graph changed since relation review');
 const plan=previewSetPreparationDecisions(graph,{preparationId,decisions});
 if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','relation review required');
 if(!exact(plan,expectedPreview))fail('PREVIEW_STALE','old relation decisions changed');
 const next=structuredClone(graph);
 next.replacementPreparations.find(x=>x.id===preparationId).edgeDecisions=structuredClone(decisions);
 validateServerGraph(next);
 if(!exact(canonicalProjection(graph),canonicalProjection(next)))
   fail('CANON_CHANGED','decisions cannot change canon before apply');
 return {graph:next,changes:plan};
}
