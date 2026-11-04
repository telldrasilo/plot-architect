import test from 'node:test';
import assert from 'node:assert/strict';
import {applyStartReplacement,previewReplacementStart,applyDraftAcceptance,canonicalProjection,validateCreativeWorkflowGraph,assertProtectedOriginalsUnchanged} from '../src/creative_workflow_contract.mjs';
import {applyReplacementReconnection,previewReplacementReconnection} from '../src/creative_workflow_reconnection.mjs';
import {previewCompleteReplacement,applyCompleteReplacement,previewCancelReplacement,applyCancelReplacement} from '../src/creative_workflow_lifecycle.mjs';

const clone=x=>structuredClone(x);
const ids=items=>items.map(x=>x.id);
const raises=(fn,code)=>assert.throws(fn,e=>e?.code===code);
function story(){
  return {revision:10,version:1,view:null,
    nodes:[
      {id:'n1',title:'Начало',x:10,y:0},
      {id:'n2',title:'Исходник',description:'Старый поворот',x:240,y:0,status:'approved'},
      {id:'n3',title:'Следствие',x:480,y:0},
      {id:'n4',title:'Побочная линия',x:700,y:0},
      {id:'x',title:'Новая сцена',x:250,y:300,workspaceId:'w1',status:'proposed'},
      {id:'y',title:'Альтернатива',x:470,y:300,workspaceId:'w1'}],
    edges:[
      {id:'e1',from:'n1',to:'n2',type:'precedes'},
      {id:'e2',from:'n2',to:'n3',type:'causes'},
      {id:'e3',from:'n2',to:'n4',type:'hinders'},
      {id:'e4',from:'n3',to:'n4',type:'enables'},
      {id:'ed',from:'x',to:'y',type:'precedes',workspaceId:'w1',draftRelation:'internal'}],
    workspaces:[{id:'w1',taskId:'task1',x:100,y:220,width:700,height:280}],
    fields:[],lanes:[]
  };
}
function begin(base=story()){
  const original=clone(base),expectedPreview=previewReplacementStart(base,['n2']);
  const result=applyStartReplacement(base,{replacementId:'r1',sourceNodeIds:['n2'],expectedPreview,expectedRevision:10});
  return {baseline:original,graph:result.graph};
}
const completePreview=g=>previewCompleteReplacement(g,{replacementId:'r1'});
const close=(g,acknowledgeUnresolved=false)=>applyCompleteReplacement(g,{replacementId:'r1',expectedPreview:completePreview(g),expectedRevision:10,acknowledgeUnresolved}).graph;
const cancelPreview=(g,baseline)=>previewCancelReplacement(g,{replacementId:'r1',baselineGraph:baseline});
const cancel=(g,baseline)=>applyCancelReplacement(g,{replacementId:'r1',baselineGraph:baseline,expectedPreview:cancelPreview(g,baseline),expectedRevision:10}).graph;
function resolve(g,decisions){
  const expectedPreview=previewReplacementReconnection(g,{replacementId:'r1',decisions});
  return applyReplacementReconnection(g,{replacementId:'r1',decisions,expectedPreview,expectedRevision:10}).graph;
}
test('starting replacement stores an exact revision pointer, not duplicated source texts',()=>{
  const {graph:g}=begin();
  assert.equal(g.replacements[0].sourceGraphRevision,10);
  assert.deepEqual(Object.keys(g.replacements[0]).sort(),['id','sourceGraphRevision','sourceNodeIds','state','suspendedEdgeIds'].sort());
});
test('completion preserves original nodes and links, does not invent causal edges',()=>{
  const {graph:g}=begin(),before=clone(g),plan=completePreview(g);
  assert.deepEqual(plan.unresolvedEdgeIds,['e1','e2','e3']);
  const result=applyCompleteReplacement(g,{replacementId:'r1',expectedPreview:plan,expectedRevision:10,acknowledgeUnresolved:true});
  assert.deepEqual(g,before);assert.equal(result.graph.replacements[0].state,'completed');
  assert.deepEqual(result.graph.nodes,g.nodes);assert.deepEqual(result.graph.edges,g.edges);
  assert.deepEqual(ids(canonicalProjection(result.graph).nodes),['n1','n3','n4']);
  assert.deepEqual(ids(canonicalProjection(result.graph).edges),['e4']);
  assert.deepEqual(result.changes.unresolvedEdgeIds,['e1','e2','e3']);assert.equal(result.changes.autoRewiredEdgeIds.length,0);
});
test('unfinished boundary questions require explicit acknowledgement to complete',()=>{
  const {graph:g}=begin(),before=clone(g);
  raises(()=>applyCompleteReplacement(g,{replacementId:'r1',expectedPreview:completePreview(g),expectedRevision:10}),'UNRESOLVED_ACK_REQUIRED');
  assert.deepEqual(g,before);
});
test('completion with all old edges resolved needs no unresolved acknowledgement',()=>{
  const {graph:g}=begin();const decided=resolve(g,[{edgeId:'e1',decision:'drop'},{edgeId:'e2',decision:'drop'},{edgeId:'e3',decision:'drop'}]);
  const after=close(decided);assert.equal(after.replacements[0].state,'completed');
  assert.deepEqual(completePreview(decided).unresolvedEdgeIds,[]);assert.deepEqual(after.replacements[0].edgeResolutions,decided.replacements[0].edgeResolutions);
});
test('completed originals remain retired and drafts remain isolated',()=>{
  const {graph:g}=begin();const done=close(g,true);
  assert.equal(done.nodes.find(n=>n.id==='x').workspaceId,'w1');
  assert.deepEqual(ids(canonicalProjection(done).nodes),['n1','n3','n4']);
  assert.deepEqual(done.replacements[0].suspendedEdgeIds,['e1','e2','e3']);
  raises(()=>completePreview(done),'REPLACEMENT_NOT_OPEN');
});
test('a completed replacement cannot silently transition back to open',()=>{
  const {graph:g}=begin(),completed=close(g,true),altered=clone(completed);altered.replacements[0].state='open';
  raises(()=>assertProtectedOriginalsUnchanged(completed,altered),'REPLACEMENT_STATE_CHANGED');
});
test('completion rejects stale preview after a relation decision',()=>{
  const {graph:g}=begin(),old=completePreview(g),changed=resolve(g,[{edgeId:'e1',decision:'drop'}]);
  raises(()=>applyCompleteReplacement(changed,{replacementId:'r1',expectedPreview:old,expectedRevision:10,acknowledgeUnresolved:true}),'PREVIEW_STALE');
});
test('completion checks revision and explicit review without side effects',()=>{
  const {graph:g}=begin(),before=clone(g);
  raises(()=>applyCompleteReplacement(g,{replacementId:'r1',expectedRevision:10,acknowledgeUnresolved:true}),'PREVIEW_REQUIRED');
  raises(()=>applyCompleteReplacement(g,{replacementId:'r1',expectedPreview:completePreview(g),expectedRevision:9,acknowledgeUnresolved:true}),'REVISION_CONFLICT');
  assert.deepEqual(g,before);
});
test('pristine cancel restores original node and all arrows, retains workspace',()=>{
  const {baseline,graph:g}=begin(),original=clone(g),p=cancelPreview(g,baseline);
  assert.equal(p.canCancel,true);assert.deepEqual(p.blockers,[]);
  const restored=cancel(g,baseline);assert.deepEqual(g,original);
  assert.deepEqual(ids(canonicalProjection(restored).nodes),['n1','n2','n3','n4']);
  assert.deepEqual(ids(canonicalProjection(restored).edges),['e1','e2','e3','e4']);
  assert.equal(restored.nodes.find(n=>n.id==='x').workspaceId,'w1');
  assert.equal(restored.replacements.length,0);
});
test('draft changes after start do not prevent safe restoration of untouched canon',()=>{
  const {baseline,graph:g}=begin();g.nodes.find(n=>n.id==='x').title='Пересмотренная идея';g.workspaces[0].x=800;
  const p=cancelPreview(g,baseline);assert.equal(p.canCancel,true);
  const restored=cancel(g,baseline);assert.equal(restored.nodes.find(n=>n.id==='x').title,'Пересмотренная идея');
  assert.equal(restored.workspaces[0].x,800);
});
test('accepted new story event after start blocks restoration to avoid duplicate scene',()=>{
  const {baseline,graph:g}=begin(),withAccepted=applyDraftAcceptance(g,{workspaceId:'w1',nodeIds:['x']}).graph;
  const p=cancelPreview(withAccepted,baseline);assert.equal(p.canCancel,false);
  assert.ok(p.blockers.includes('CANON_CHANGED_SINCE_REPLACEMENT'));
  const before=clone(withAccepted);raises(()=>cancel(withAccepted,baseline),'RESTORE_CONFLICT');assert.deepEqual(withAccepted,before);
});
test('accepted internal plot arrow also blocks restoring original, even if other draft remains',()=>{
  const {baseline,graph:g}=begin(),withAccepted=applyDraftAcceptance(g,{workspaceId:'w1',nodeIds:['x','y']}).graph;
  assert.equal(cancelPreview(withAccepted,baseline).canCancel,false);assert.equal(canonicalProjection(withAccepted).edges.some(e=>e.id==='ed'),true);
});
test('intervening canonical text edit blocks cancellation without clobbering author changes',()=>{
  const {baseline,graph:g}=begin();g.nodes.find(n=>n.id==='n3').title='Другое следствие';
  const p=cancelPreview(g,baseline);assert.deepEqual(p.blockers,['CANON_CHANGED_SINCE_REPLACEMENT']);
  raises(()=>cancel(g,baseline),'RESTORE_CONFLICT');
});
test('intervening unrelated canonical relation edit also blocks conservative cancellation',()=>{
  const {baseline,graph:g}=begin();g.edges.find(e=>e.id==='e4').type='causes';
  assert.ok(cancelPreview(g,baseline).blockers.includes('CANON_CHANGED_SINCE_REPLACEMENT'));
});
test('a resolved drop and a reconnection independently block cancellation',()=>{
  for(const decisions of [
    [{edgeId:'e1',decision:'drop'}],
    [{edgeId:'e1',decision:'drop'},{edgeId:'e2',decision:'drop'}]
  ]){
    const {baseline,graph:g}=begin(),decided=resolve(g,decisions);
    const p=cancelPreview(decided,baseline);assert.ok(p.blockers.includes('DECISIONS_ALREADY_APPLIED'));raises(()=>cancel(decided,baseline),'RESTORE_CONFLICT');
  }
});
test('a genuine rerouted arrow cannot be silently lost by cancellation',()=>{
  const {baseline,graph:g}=begin();
  const accepted=applyDraftAcceptance(g,{workspaceId:'w1',nodeIds:['x']}).graph;
  const decided=resolve(accepted,[{edgeId:'e1',decision:'rewire',newEdge:{id:'new1',from:'n1',to:'x',type:'precedes'}}]);
  const p=cancelPreview(decided,baseline);assert.equal(p.canCancel,false);
  assert.ok(p.blockers.includes('DECISIONS_ALREADY_APPLIED'));assert.ok(p.blockers.includes('CANON_CHANGED_SINCE_REPLACEMENT'));
});
test('changed preserved original itself must never be accepted as a safe restore',()=>{
  const {baseline,graph:g}=begin();g.nodes.find(n=>n.id==='n2').description='Незаметно изменили исходник';
  const p=cancelPreview(g,baseline);assert.equal(p.canCancel,false);assert.ok(p.blockers.includes('ORIGINALS_CHANGED'));
});
test('missing recorded revision or trusted baseline must reject restoring',()=>{
  const {baseline,graph:g}=begin();delete g.replacements[0].sourceGraphRevision;
  raises(()=>previewCancelReplacement(g,{replacementId:'r1',baselineGraph:baseline}),'TRUSTED_BASELINE_REQUIRED');
  const newPair=begin();raises(()=>previewCancelReplacement(newPair.graph,{replacementId:'r1'}),'TRUSTED_BASELINE_REQUIRED');
});
test('a mismatching baseline revision cannot be silently substituted',()=>{
  const {baseline,graph:g}=begin();baseline.revision=9;
  raises(()=>cancelPreview(g,baseline),'BASELINE_REVISION_MISMATCH');
});
test('cancel is refused after completion',()=>{
  const {baseline,graph:g}=begin(),done=close(g,true);
  raises(()=>cancelPreview(done,baseline),'REPLACEMENT_NOT_OPEN');
});
test('cancel rejects stale review and wrong in-memory revision without side effects',()=>{
  const {baseline,graph:g}=begin(),p=cancelPreview(g,baseline),before=clone(g);
  const tampered={...p,restoreNodeIds:['n3']};
  raises(()=>applyCancelReplacement(g,{replacementId:'r1',baselineGraph:baseline,expectedPreview:tampered,expectedRevision:10}),'PREVIEW_STALE');
  raises(()=>applyCancelReplacement(g,{replacementId:'r1',baselineGraph:baseline,expectedPreview:p,expectedRevision:11}),'REVISION_CONFLICT');
  assert.deepEqual(g,before);
});
test('a second replacement after the baseline blocks cancellation of first',()=>{
  const base=story();base.nodes.push({id:'n5',title:'Независимый эпизод',x:1000,y:0});
  const {baseline,graph:g}=begin(base);
  const prev=previewReplacementStart(g,['n5']),next=applyStartReplacement(g,{replacementId:'r2',sourceNodeIds:['n5'],expectedPreview:prev,expectedRevision:10}).graph;
  const p=cancelPreview(next,baseline);assert.equal(p.canCancel,false);assert.ok(p.blockers.includes('CANON_CHANGED_SINCE_REPLACEMENT'));
});
test('completion and cancellation are non-mutating, JSON-roundtrip validated',()=>{
  const {baseline,graph:g}=begin();
  const completed=close(g,true);assert.doesNotThrow(()=>validateCreativeWorkflowGraph(JSON.parse(JSON.stringify(completed))));
  const canceled=cancel(g,baseline);assert.doesNotThrow(()=>validateCreativeWorkflowGraph(JSON.parse(JSON.stringify(canceled))));
  assert.equal(g.replacements[0].state,'open');assert.equal(g.revision,10);
});
