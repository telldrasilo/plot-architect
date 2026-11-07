/**
 * CW-010 C3b3. Explicit post-canon review: every preserved original, linked
 * accepted scene and suspended relation receives a deliberate author choice.
 *
 * No deletion, inferred causal rewiring or snapshot rollback. Archiving
 * preserves the candidate in graph_json and excludes it from the *projection*
 * only after a reviewed decision. An original can be restored with individually
 * selected old edges; its historical record and all untouched edges survive.
 *
 * For safety, archiving a candidate with any references (even draft edges) is
 * blocked until those references have their own audited workflow. Similarly an
 * old relation that was rewired cannot be revived on top of that new relation.
 */
import {
 CreativeWorkflowContractError,validateCreativeWorkflowGraph,
 canonicalProjection,assertProtectedOriginalsUnchanged
} from './creative_workflow_contract.mjs';
const fail=(code,message)=>{throw new CreativeWorkflowContractError(code,message)};
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
const clone=x=>structuredClone(x);
const own=(x,k)=>Object.hasOwn(x,k);
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
const normalized=x=>(x?.title||'').trim().toLocaleLowerCase();
const sorted=values=>[...values].sort();

function target(graph,replacementId,baselineGraph){
 validateCreativeWorkflowGraph(graph);
 const r=(graph.replacements??[]).find(x=>x.id===replacementId);
 if(!r)fail('REPLACEMENT_NOT_FOUND',String(replacementId));
 if(r.state==='restored')fail('ALREADY_RESTORED','the original is already back in canon');
 if(!Number.isSafeInteger(r.sourceGraphRevision)||!baselineGraph)
  fail('TRUSTED_BASELINE_REQUIRED','historical graph is required');
 validateCreativeWorkflowGraph(baselineGraph);
 if(baselineGraph.revision!==r.sourceGraphRevision||
    (baselineGraph.replacements??[]).some(x=>x.id===replacementId))
  fail('BASELINE_REVISION_MISMATCH','trusted revision is not the source graph');
 if(!(r.candidateNodeIds??[]).length)
  fail('NO_LINKED_CANDIDATES','first explicitly associate the new canonical scenes');
 return r;
}

function choices(list,expectedIds,actions,kind){
 if(!Array.isArray(list)||list.length!==expectedIds.length||
    !Array.isArray(expectedIds)||new Set(expectedIds).size!==expectedIds.length)
  fail('REVIEW_DECISIONS_INCOMPLETE',kind+' must cover every original item');
 const seen=new Set();
 const values=[];
 for(const d of list){
  if(!plain(d)||Object.keys(d).length!==2||
     !id(d[kind])||seen.has(d[kind])||!expectedIds.includes(d[kind])||
     !actions.includes(d.decision))
   fail('REVIEW_DECISION_INVALID',kind+' needs an explicit, unique choice');
  seen.add(d[kind]);values.push({[kind]:d[kind],decision:d.decision});
 }
 if(seen.size!==expectedIds.length)fail('REVIEW_DECISIONS_INCOMPLETE',kind);
 return expectedIds.map(id=>values.find(x=>x[kind]===id));
}

/**
 * Empty decisions return a read-only checklist. A full review includes
 * exact projected effects and blocking conflicts, so the UI can show
 * blockers before a separate irreversible confirmation step.
 */
export function previewPostCanonReview(graph,{
  replacementId,originalAction,candidateDecisions,edgeDecisions,
  acknowledgedTitleConflicts=[],baselineGraph
}={}){
 const r=target(graph,replacementId,baselineGraph);
 const nodes=new Map(graph.nodes.map(n=>[n.id,n]));
 const edges=new Map(graph.edges.map(e=>[e.id,e]));
 const originalNodes=r.sourceNodeIds.map(x=>clone(nodes.get(x)));
 const candidateNodes=r.candidateNodeIds.map(x=>clone(nodes.get(x)));
 const suspendedEdges=r.suspendedEdgeIds.map(x=>clone(edges.get(x)));
 const currentCanon=canonicalProjection(graph);
 const output={
  replacementId,state:r.state,sourceGraphRevision:r.sourceGraphRevision,
  originalNodes,candidateNodes,suspendedEdges,
  edgeResolutions:clone(r.edgeResolutions??[]),
  earlierReviewCount:(r.postCanonReviews??[]).length,
  selectionComplete:false,
  originalAction:null,candidateDecisions:[],edgeDecisions:[],
  acknowledgedTitleConflicts:[],possibleTitleConflicts:[],
  wouldRestoreOriginalNodeIds:[],wouldRestoreEdgeIds:[],
  wouldArchiveCandidateNodeIds:[],wouldKeepCandidateNodeIds:[],blockers:[]
 };
 const incomplete=originalAction===undefined&&candidateDecisions===undefined&&edgeDecisions===undefined;
 if(incomplete){
  if(acknowledgedTitleConflicts?.length)fail('REVIEW_DECISION_INVALID','unpaired title acknowledgement');
  return output;
 }
 if(!['keep_replaced','restore'].includes(originalAction))
  fail('REVIEW_DECISION_INVALID','explicit fate of original required');
 const candidate=choices(candidateDecisions,r.candidateNodeIds,['keep','archive'],'nodeId');
 const relations=choices(edgeDecisions,r.suspendedEdgeIds,
  ['keep_suspended','restore'],'edgeId');
 if(!Array.isArray(acknowledgedTitleConflicts)||acknowledgedTitleConflicts.length>80||
    new Set(acknowledgedTitleConflicts).size!==acknowledgedTitleConflicts.length||
    acknowledgedTitleConflicts.some(x=>!id(x)))
  fail('REVIEW_DECISION_INVALID','invalid title acknowledgements');
 if(originalAction!=='restore'&&relations.some(x=>x.decision==='restore'))
  fail('REVIEW_DECISION_INVALID','old relation requires restored original');
 const archiveIds=candidate.filter(x=>x.decision==='archive').map(x=>x.nodeId);
 const keepIds=candidate.filter(x=>x.decision==='keep').map(x=>x.nodeId);
 const restoreEdgeIds=relations.filter(x=>x.decision==='restore').map(x=>x.edgeId);
 const blockers=[];
 for(const nodeId of archiveIds){
  const n=nodes.get(nodeId);
  if(n?.workspaceId)blockers.push('CANDIDATE_NO_LONGER_CANON:'+nodeId);
  const refs=graph.edges.filter(e=>e.from===nodeId||e.to===nodeId);
  if(refs.length)blockers.push('CANDIDATE_HAS_RELATIONS:'+nodeId);
  if(graph.nodes.some(x=>x.parent===nodeId)||
     (graph.fields??[]).some(x=>x.parent===nodeId))
   blockers.push('CANDIDATE_HAS_CHILDREN:'+nodeId);
  if((graph.replacements??[]).some(other=>other.id!==replacementId&&
      other.sourceNodeIds.includes(nodeId)))
   blockers.push('CANDIDATE_IS_OTHER_ORIGINAL:'+nodeId);
 }
 for(const edgeId of restoreEdgeIds){
  const old=edges.get(edgeId);
  if((r.edgeResolutions??[]).some(d=>d.edgeId===edgeId&&d.decision==='rewire'))
   blockers.push('REWIRED_RELATION_CONFLICT:'+edgeId);
  const other=old.from===r.sourceNodeIds[0]?old.to:old.from;
  if(!r.sourceNodeIds.includes(other)&&!currentCanon.nodes.some(n=>n.id===other))
   blockers.push('OTHER_ENDPOINT_INACTIVE:'+edgeId);
  const existing=currentCanon.edges.find(e=>e.from===old.from&&e.to===old.to&&e.type===old.type);
  if(existing)blockers.push('DUPLICATE_PLOT_EDGE:'+edgeId);
 }
 // Possible duplicates are heuristics, never silently treated as facts.
 const activeCandidates=keepIds.map(n=>nodes.get(n));
 const keptExisting=currentCanon.nodes.filter(n=>!archiveIds.includes(n.id)&&
   !r.candidateNodeIds.includes(n.id));
 const restored=originalAction==='restore'?originalNodes:[];
 const visibleAfter=[...activeCandidates,...keptExisting,...restored];
 const collisions=[];
 for(let i=0;i<visibleAfter.length;i++){
  const n=visibleAfter[i],label=normalized(n);
  if(!label)continue;
  if(visibleAfter.some((other,j)=>i!==j&&normalized(other)===label))
   collisions.push(n.id);
 }
 const conflictIds=sorted(new Set(collisions));
 if(acknowledgedTitleConflicts.some(x=>!conflictIds.includes(x)))
  fail('REVIEW_DECISION_INVALID','only displayed collisions may be acknowledged');
 for(const x of conflictIds)if(!acknowledgedTitleConflicts.includes(x))
  blockers.push('TITLE_CONFLICT_UNACKNOWLEDGED:'+x);
 output.selectionComplete=true;
 output.originalAction=originalAction;
 output.candidateDecisions=candidate;
 output.edgeDecisions=relations;
 output.possibleTitleConflicts=conflictIds;
 output.acknowledgedTitleConflicts=sorted(acknowledgedTitleConflicts);
 output.wouldRestoreOriginalNodeIds=originalAction==='restore'?[...r.sourceNodeIds]:[];
 output.wouldRestoreEdgeIds=restoreEdgeIds;
 output.wouldArchiveCandidateNodeIds=archiveIds;
 output.wouldKeepCandidateNodeIds=keepIds;
 output.blockers=sorted(blockers);
 return output;
}
/**
 * One reviewed transaction with append-only decision audit.
 * The storage adapter owns atomic CAS/history/receipt, never this function.
 */
export function applyPostCanonReview(graph,{
  replacementId,originalAction,candidateDecisions,edgeDecisions,
  acknowledgedTitleConflicts,baselineGraph,expectedPreview,expectedRevision
}={}){
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==graph.revision)
  fail('REVISION_CONFLICT','project changed since review');
 if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','review required before apply');
 const plan=previewPostCanonReview(graph,{replacementId,originalAction,candidateDecisions,
   edgeDecisions,acknowledgedTitleConflicts,baselineGraph});
 if(JSON.stringify(expectedPreview)!==JSON.stringify(plan))
  fail('PREVIEW_STALE','review or graph content changed');
 if(!plan.selectionComplete)fail('REVIEW_DECISIONS_INCOMPLETE','all choices required');
 if(plan.blockers.length)fail('REVIEW_CONFLICT',plan.blockers.join(','));
 const next=clone(graph);
 const r=next.replacements.find(x=>x.id===replacementId);
 r.postCanonReviews??=[];
 r.postCanonReviews.push({
  originalAction:plan.originalAction,
  candidateDecisions:clone(plan.candidateDecisions),
  edgeDecisions:clone(plan.edgeDecisions),
  acknowledgedTitleConflicts:clone(plan.acknowledgedTitleConflicts)
 });
 if(plan.originalAction==='restore')r.state='restored';
 validateCreativeWorkflowGraph(next);
 assertProtectedOriginalsUnchanged(graph,next);
 return {graph:next,changes:{
  replacementId,reviewNumber:r.postCanonReviews.length,
  originalRestored:r.state==='restored',
  restoredNodeIds:plan.wouldRestoreOriginalNodeIds,
  restoredEdgeIds:plan.wouldRestoreEdgeIds,
  archivedCandidateNodeIds:plan.wouldArchiveCandidateNodeIds,
  keptCandidateNodeIds:plan.wouldKeepCandidateNodeIds,
  originalAndCandidatesPreserved:true,autoRewiredEdgeIds:[]
 }};
}
