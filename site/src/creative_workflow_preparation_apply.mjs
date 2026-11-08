/**
 * UX-RPL-GESTURE-01 B: reviewed, single-snapshot local replacement.
 * Pure domain transformation: NO database access, no model calls, no
 * generation, no ordinary draft acceptance, no legacy CW-010 transition.
 */
import {CreativeWorkflowContractError,canonicalProjection} from './creative_workflow_contract.mjs';
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const stable=value=>Array.isArray(value)?value.map(stable):
  value&&typeof value==='object'?
    Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const exact=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const owned=x=>x.workspaceId??null;
const meaningfulNode=n=>{
  const copy={...n};delete copy.autoFieldIds;return copy;
};
const edgeKey=e=>JSON.stringify([e.from,e.to,e.type]);

/**
 * The exact future graph is built once in memory. Preview returns only
 * a bounded, read-only representation of that SAME transformation.
 */
function build(graph,preparationId){
 const g=validateServerGraph(graph),p=(g.replacementPreparations??[]).find(p=>p.id===preparationId);
 if(!p||p.state!=='open')fail('PREPARATION_NOT_OPEN',String(preparationId));
 const nodes=new Map(g.nodes.map(n=>[n.id,n]));
 const edges=new Map(g.edges.map(e=>[e.id,e]));
 const source=nodes.get(p.sourceNodeId);
 const sourceDiff=[];
 if(!source||!exact(meaningfulNode(source),meaningfulNode(p.sourceSnapshot)))
   sourceDiff.push('source:'+p.sourceNodeId);
 const currentIncident=g.edges.filter(e=>owned(e)===null&&
   (e.from===p.sourceNodeId||e.to===p.sourceNodeId));
 const past=new Map(p.incidentEdges.map(e=>[e.id,e]));
 const current=new Map(currentIncident.map(e=>[e.id,e]));
 for(const [edgeId,old] of past)
   if(!current.has(edgeId)||!exact(old,current.get(edgeId)))
     sourceDiff.push('edge:'+edgeId);
 for(const edgeId of current.keys())if(!past.has(edgeId))
   sourceDiff.push('new-edge:'+edgeId);
 if(sourceDiff.length)
   fail('PREPARATION_STALE',sourceDiff.join(','));
 if(!p.candidateSelections.length)
   fail('PREPARATION_EMPTY','select at least one existing draft');
 const selected=new Map(),byWorkspace=new Map();
 for(const c of p.candidateSelections){
   const n=nodes.get(c.nodeId),area=(g.workspaces??[]).find(w=>w.id===c.workspaceId);
   if(!n||!area||owned(n)!==c.workspaceId||selected.has(c.nodeId))
     fail('PREPARATION_CANDIDATE_STALE',c.nodeId);
   if(c.nodeId===p.sourceNodeId||n.parent!==null)
     fail('PREPARATION_CANDIDATE_INVALID',c.nodeId);
   if((g.replacements??[]).some(r=>(r.candidateNodeIds??[]).includes(c.nodeId)||
      r.sourceNodeIds.includes(c.nodeId))||
      (g.replacementPreparations??[]).some(other=>other.id!==p.id&&
       other.state==='open'&&other.candidateSelections.some(x=>x.nodeId===c.nodeId)))
      fail('PREPARATION_CANDIDATE_CONFLICT',c.nodeId);
   selected.set(c.nodeId,c);
   if(!byWorkspace.has(c.workspaceId))byWorkspace.set(c.workspaceId,[]);
   byWorkspace.get(c.workspaceId).push(c.nodeId);
 }
 const decisions=new Map(p.edgeDecisions.map(d=>[d.edgeId,d]));
 if(decisions.size!==p.incidentEdges.length||
    p.incidentEdges.some(e=>!decisions.has(e.id)))
   fail('PREPARATION_UNRESOLVED','every old incident relation needs a decision');

 // Draft edges to B are not magically resolved by rewiring canonical arrows.
 // Old B will become retired and must not remain a live draft dependency.
 const draftToB=g.edges.filter(e=>owned(e)!==null&&
   (e.from===p.sourceNodeId||e.to===p.sourceNodeId));
 if(draftToB.length)
   fail('PREPARATION_DRAFT_REFERENCE',draftToB.map(e=>e.id).join(','));

 const rewires=[],drops=[];
 const canonicalPairs=new Set(g.edges.filter(e=>owned(e)===null&&!past.has(e.id))
  .map(edgeKey));
 const plotEdgeIds=new Set(g.edges.map(e=>e.id));
 for(const old of p.incidentEdges){
   const decision=decisions.get(old.id);
   if(decision.decision==='drop'){
     if(Object.keys(decision).sort().join(',')!=='decision,edgeId')
       fail('PREPARATION_DECISION_INVALID',old.id);
     drops.push(old.id);continue;
   }
   if(Object.keys(decision).sort().join(',')!=='decision,edgeId,newEdge'||
      !decision.newEdge||typeof decision.newEdge!=='object'||
      Object.keys(decision.newEdge).sort().join(',')!=='from,id,to,type')
     fail('PREPARATION_DECISION_INVALID',old.id);
   const e=decision.newEdge;
   if(!id(e.id)||plotEdgeIds.has(e.id)||!['precedes','causes','enables','hinders'].includes(e.type)||
      !id(e.from)||!id(e.to)||e.from===e.to)
     fail('PREPARATION_REWIRE_INVALID',old.id);
   // An unaffected endpoint must stay exactly where it was. Only the
   // replacement side can point to one of the explicitly selected drafts.
   if(old.from===p.sourceNodeId?
        (!selected.has(e.from)||e.to!==old.to):
        (!selected.has(e.to)||e.from!==old.from))
     fail('PREPARATION_REWIRE_ENDPOINT',old.id);
   if(canonicalPairs.has(edgeKey(e)))
     fail('PREPARATION_DUPLICATE_RELATION',old.id);
   canonicalPairs.add(edgeKey(e));plotEdgeIds.add(e.id);
   rewires.push(structuredClone(e));
 }
 const chosen=new Set(selected.keys()),promoted=[],boundary=[],removeAreas=[];
 const staged=structuredClone(g);
 for(const n of staged.nodes)if(chosen.has(n.id)){
   delete n.workspaceId;delete n.draftBranchId;
 }
 for(const edge of staged.edges){
   const both=chosen.has(edge.from)&&chosen.has(edge.to);
   const one=chosen.has(edge.from)!==chosen.has(edge.to);
   if(owned(edge)!==null&&both&&edge.draftRelation==='internal'){
      if(canonicalPairs.has(edgeKey(edge)))
        fail('PREPARATION_DUPLICATE_RELATION',edge.id);
      canonicalPairs.add(edgeKey(edge));
      promoted.push(edge.id);
      delete edge.workspaceId;delete edge.draftRelation;delete edge.draftBranchId;
   }else if(owned(edge)!==null&&one){
      boundary.push(edge.id);
      if(edge.draftRelation==='internal')edge.draftRelation='boundary-proposal';
   }
 }
 for(const [wid] of byWorkspace){
   const remaining=staged.nodes.some(n=>owned(n)===wid);
   if(remaining)continue;
   // A workspace cannot disappear while retaining any editorial relation.
   if(staged.edges.some(e=>owned(e)===wid))
     fail('PREPARATION_WORKSPACE_RELATIONS','resolve draft boundaries before full promotion: '+wid);
   removeAreas.push(wid);
 }
 staged.workspaces=(staged.workspaces??[]).filter(w=>!removeAreas.includes(w.id));
 // Existing one-shot note clean-up follows the acceptance policy only if a
 // selected workspace is actually emptied (normally CW-055 already did it).
 const noteIds=new Set(g.workspaces.filter(w=>removeAreas.includes(w.id)).map(w=>w.taskId)
   .filter(x=>typeof x==='string'));
 for(const noteId of noteIds)
   if(staged.workspaces.some(w=>w.taskId===noteId))
     fail('PREPARATION_SHARED_NOTE','another workspace keeps task '+noteId);
 const consumed=new Set((staged.gapNotes??[]).filter(n=>noteIds.has(n.id)).map(n=>n.id));
 if(consumed.size){
   staged.gapNotes=staged.gapNotes.filter(n=>!consumed.has(n.id));
   staged.gapLinks=(staged.gapLinks??[]).filter(l=>
     !((l.from?.kind==='gap_note'&&consumed.has(l.from.id))||
       (l.to?.kind==='gap_note'&&consumed.has(l.to.id))));
 }
 staged.edges.push(...rewires);
 staged.replacementPreparations.find(x=>x.id===preparationId).state='applied';
 validateServerGraph(staged);
 const projection=canonicalProjection(staged);
 const active=new Set(projection.nodes.map(n=>n.id));
 if(active.has(p.sourceNodeId)||[...chosen].some(x=>!active.has(x)))
   fail('PREPARATION_CANON_INVALID','applied sources/candidates disagree with projection');
 const canonicalEdgeIds=new Set(projection.edges.map(e=>e.id));
 if(p.incidentEdges.some(e=>canonicalEdgeIds.has(e.id))||
    rewires.some(e=>!canonicalEdgeIds.has(e.id)))
   fail('PREPARATION_CANON_INVALID','incorrect old/new relation visibility');
 const plan={
   preparationId,sourceNodeId:p.sourceNodeId,
   acceptedNodeIds:[...chosen],
   promoteEdgeIds:promoted,
   editorialBoundaryEdgeIds:boundary,
   originalEdgeIds:p.incidentEdges.map(e=>e.id),
   droppedEdgeIds:drops,rewiredEdges:rewires,
   removedWorkspaceIds:removeAreas,
   retainedDraftIds:staged.nodes.filter(n=>owned(n)!==null).map(n=>n.id),
   canonicalChanged:true
 };
 return {graph:staged,plan};
}
export function previewApplyPreparation(graph,{preparationId}={}){
 return build(graph,preparationId).plan;
}
export function applyPreparation(graph,{preparationId,expectedPreview,expectedRevision}={}){
 if(!Number.isSafeInteger(expectedRevision)||graph.revision!==expectedRevision)
   fail('REVISION_CONFLICT','graph revision differs from approved preview');
 if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','explicit approved preview required');
 const result=build(graph,preparationId);
 if(!exact(expectedPreview,result.plan))
   fail('PREVIEW_STALE','approved result differs from current graph');
 return {graph:result.graph,changes:result.plan};
}
