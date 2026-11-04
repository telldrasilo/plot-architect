import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDraftAcceptance,applyStartReplacement,previewReplacementStart,canonicalProjection,validateCreativeWorkflowGraph,assertProtectedOriginalsUnchanged} from '../src/creative_workflow_contract.mjs';
import {previewReplacementReconnection,applyReplacementReconnection} from '../src/creative_workflow_reconnection.mjs';
const copy=x=>structuredClone(x);
const ids=items=>items.map(x=>x.id);
function story(){return {
 version:1,revision:12,view:null,
 nodes:[
  {id:'n1',title:'Начало',x:0,y:0},
  {id:'n2',title:'Поворот',description:'Исходный выбор',x:200,y:0},
  {id:'n3',title:'Последствие',x:400,y:0},
  {id:'n4',title:'Соперник',x:600,y:0},
  {id:'n5',title:'Финал',x:800,y:0},
  {id:'x',title:'Новый эпизод',x:200,y:200,workspaceId:'w1',status:'proposed'},
  {id:'y',title:'Новая развязка',x:400,y:200,workspaceId:'w1'},
  {id:'z',title:'Не принято',x:600,y:200,workspaceId:'w1'}],
 edges:[
  {id:'e1',from:'n1',to:'n2',type:'precedes'},
  {id:'e2',from:'n2',to:'n3',type:'causes'},
  {id:'e3',from:'n2',to:'n4',type:'enables'},
  {id:'e4',from:'n4',to:'n2',type:'hinders'},
  {id:'e5',from:'n4',to:'n5',type:'precedes'},
  {id:'ex',from:'x',to:'y',type:'precedes',workspaceId:'w1',draftRelation:'internal'}],
 fields:[],lanes:[],workspaces:[{id:'w1',taskId:'task',x:100,y:150,width:750,height:220}]
}}
function started(sources=['n2']){const g=story(),preview=previewReplacementStart(g,sources);return applyStartReplacement(g,{replacementId:'r1',sourceNodeIds:sources,expectedPreview:preview,expectedRevision:12}).graph}
function accepted(sources=['n2']){return applyDraftAcceptance(started(sources),{workspaceId:'w1',nodeIds:['x','y']}).graph}
const rewire=(edgeId,id,from,to,type)=>({edgeId,decision:'rewire',newEdge:{id,from,to,type}});
const drop=edgeId=>({edgeId,decision:'drop'});
const review=edgeId=>({edgeId,decision:'review'});
const plan=(g,decisions)=>previewReplacementReconnection(g,{replacementId:'r1',decisions});
const apply=(g,decisions)=>applyReplacementReconnection(g,{replacementId:'r1',decisions,expectedPreview:plan(g,decisions),expectedRevision:12});
const failure=(work,code)=>assert.throws(work,e=>e?.code===code);

test('mixed rewire/drop/review retains originals, promotes only approved new arrows, leaves uncertainty',()=>{
 const g=accepted(),before=copy(g),decisions=[rewire('e1','new1','n1','x','precedes'),rewire('e2','new2','y','n3','enables'),drop('e3'),review('e4')];
 const p=plan(g,decisions);assert.deepEqual(p.unresolvedEdgeIds,['e4']);assert.deepEqual(p.deferredEdgeIds,['e4']);assert.deepEqual(p.droppedEdgeIds,['e3']);
 const r=apply(g,decisions),next=r.graph;assert.deepEqual(g,before);assert.deepEqual(next.nodes,g.nodes);assert.deepEqual(next.edges.slice(0,g.edges.length),g.edges);
 assert.deepEqual(ids(canonicalProjection(next).nodes),['n1','n3','n4','n5','x','y']);
 assert.deepEqual(ids(canonicalProjection(next).edges),['e5','ex','new1','new2']);
 assert.deepEqual(next.replacements[0].edgeResolutions,[{edgeId:'e1',decision:'rewire',newEdgeId:'new1'},{edgeId:'e2',decision:'rewire',newEdgeId:'new2'},{edgeId:'e3',decision:'drop'}]);
 assert.deepEqual(r.changes.unresolvedEdgeIds,['e4']);assert.equal(next.revision,12);assert.equal(next.nodes.find(n=>n.id==='z').workspaceId,'w1');
});
test('later resolution can close only remaining suspended relation without changing previous choices',()=>{
 const first=apply(accepted(),[rewire('e1','new1','n1','x','precedes'),drop('e3')]).graph;
 const second=apply(first,[rewire('e4','new4','n4','x','hinders')]).graph;
 assert.deepEqual(second.replacements[0].edgeResolutions,[{edgeId:'e1',decision:'rewire',newEdgeId:'new1'},{edgeId:'e3',decision:'drop'},{edgeId:'e4',decision:'rewire',newEdgeId:'new4'}]);
 assert.deepEqual(plan(second,[review('e2')]).unresolvedEdgeIds,['e2']);
 assert.deepEqual(ids(canonicalProjection(second).edges),['e5','ex','new1','new4']);
});
test('drop records resolution but never physically deletes the original arrow',()=>{
 const g=started(),next=apply(g,[drop('e1')]).graph;
 assert.equal(next.edges.length,g.edges.length);assert.deepEqual(next.edges.find(e=>e.id==='e1'),g.edges.find(e=>e.id==='e1'));
 assert.deepEqual(next.replacements[0].edgeResolutions,[{edgeId:'e1',decision:'drop'}]);
});
test('review-only batch is not persisted and never invents a causal link',()=>{
 const g=accepted(),before=copy(g),decisions=[review('e1'),review('e2')];const p=plan(g,decisions);
 assert.deepEqual(p.unresolvedEdgeIds,['e1','e2','e3','e4']);failure(()=>apply(g,decisions),'NO_RESOLUTIONS');assert.deepEqual(g,before);
});
test('internal old arrow may rewire both ends after replacing two events',()=>{
 const g=accepted(['n2','n3']);const d=rewire('e2','new2','x','y','causes');const next=apply(g,[d]).graph;
 assert.deepEqual(next.edges.find(e=>e.id==='new2'),d.newEdge);assert.deepEqual(ids(canonicalProjection(next).edges),['e5','ex','new2']);
});
test('cannot redirect external endpoint or reverse an old arrows direction',()=>{
 const g=accepted();failure(()=>plan(g,[rewire('e1','new1','n5','x','precedes')]),'EXTERNAL_ENDPOINT_CHANGED');
 failure(()=>plan(g,[rewire('e4','new4','x','n4','hinders')]),'EXTERNAL_ENDPOINT_CHANGED');
});
test('draft and retired endpoints cannot be made canonical',()=>{
 const g=accepted();failure(()=>plan(g,[rewire('e1','new1','n1','z','precedes')]),'TARGET_NOT_CANONICAL');
 failure(()=>plan(g,[rewire('e1','new1','n1','n2','precedes')]),'TARGET_NOT_CANONICAL');
});
test('new relation type must be an explicitly valid plot relation',()=>{
 const g=accepted();failure(()=>plan(g,[rewire('e1','new1','n1','x','friendship')]),'NEW_EDGE_INVALID');
 failure(()=>plan(g,[rewire('e1','new1','n1','x','')]),'NEW_EDGE_INVALID');
});
test('new arrow ID cannot collide with any existing or another new arrow in the same batch',()=>{
 const g=accepted();failure(()=>plan(g,[rewire('e1','e1','n1','x','precedes')]),'EDGE_ID_CONFLICT');
 failure(()=>plan(g,[rewire('e1','new','n1','x','precedes'),rewire('e2','new','y','n3','causes')]),'EDGE_ID_CONFLICT');
});
test('proposed duplicate cause/link is rejected before any change',()=>{
 const g=accepted();g.edges.push({id:'existing',from:'n1',to:'x',type:'precedes'});
 failure(()=>plan(g,[rewire('e1','new1','n1','x','precedes')]),'DUPLICATE_PLOT_EDGE');
 failure(()=>plan(accepted(),[rewire('e1','new1','n1','x','precedes'),rewire('e4','new4','n1','x','precedes')]),'EXTERNAL_ENDPOINT_CHANGED');
});
test('each suspended old arrow may receive at most one decision',()=>{
 const g=accepted();failure(()=>plan(g,[drop('e1'),rewire('e1','new1','n1','x','precedes')]),'DECISION_INVALID');
 const resolved=apply(g,[drop('e1')]).graph;failure(()=>plan(resolved,[rewire('e1','new1','n1','x','precedes')]),'EDGE_ALREADY_RESOLVED');
});
test('other plot arrow cannot be passed as suspended and replacement must exist and remain open',()=>{
 const g=accepted();failure(()=>plan(g,[drop('e5')]),'EDGE_NOT_SUSPENDED');
 failure(()=>previewReplacementReconnection(g,{replacementId:'missing',decisions:[drop('e1')]}),'REPLACEMENT_NOT_FOUND');
 const completed=copy(g);completed.replacements[0].state='completed';failure(()=>plan(completed,[drop('e1')]),'REPLACEMENT_NOT_OPEN');
});
test('invalid decisions and extra edge fields cannot bypass confirmation',()=>{
 const g=accepted();failure(()=>plan(g,[]),'DECISIONS_INVALID');
 failure(()=>plan(g,[{edgeId:'e1',decision:'rewire',newEdge:{id:'new1',from:'n1',to:'x',type:'precedes',workspaceId:'w1'}}]),'NEW_EDGE_INVALID');
 failure(()=>plan(g,[{edgeId:'e1',decision:'drop',newEdge:{id:'injected'}}]),'DECISION_INVALID');
});
test('stale preview detects altered original relation and new endpoint text',()=>{
 for(const edit of [g=>{g.edges.find(e=>e.id==='e1').type='hinders'},g=>{g.nodes.find(n=>n.id==='x').title='Новое содержание'}]){
  const g=accepted(),decisions=[rewire('e1','new1','n1','x','precedes')],old=plan(g,decisions);edit(g);const before=copy(g);
  failure(()=>applyReplacementReconnection(g,{replacementId:'r1',decisions,expectedPreview:old,expectedRevision:12}),'PREVIEW_STALE');assert.deepEqual(g,before);
 }
});
test('unrelated content change need not invalidate targeted review',()=>{
 const g=accepted(),decisions=[rewire('e1','new1','n1','x','precedes')],p=plan(g,decisions);g.nodes.find(n=>n.id==='n5').title='Новый эпилог';
 const result=applyReplacementReconnection(g,{replacementId:'r1',decisions,expectedPreview:p,expectedRevision:12});assert.equal(result.graph.nodes.find(n=>n.id==='n5').title,'Новый эпилог');
});
test('a plan and matching in-memory revision are required, with no partial side effects',()=>{
 const g=accepted(),before=copy(g),decisions=[drop('e1')];
 failure(()=>applyReplacementReconnection(g,{replacementId:'r1',decisions,expectedRevision:12}),'PREVIEW_REQUIRED');
 failure(()=>applyReplacementReconnection(g,{replacementId:'r1',decisions,expectedPreview:plan(g,decisions),expectedRevision:11}),'REVISION_CONFLICT');
 assert.deepEqual(g,before);
});
test('one invalid decision aborts the entire batch without any new edges',()=>{
 const g=accepted(),before=copy(g);failure(()=>applyReplacementReconnection(g,{replacementId:'r1',decisions:[rewire('e1','new1','n1','x','precedes'),rewire('e2','bad','y','n5','causes')],expectedPreview:{},expectedRevision:12}),'EXTERNAL_ENDPOINT_CHANGED');
 assert.deepEqual(g,before);
});
test('previously resolved relation cannot silently disappear or be rewritten',()=>{
 const g=apply(accepted(),[rewire('e1','new1','n1','x','precedes')]).graph;
 const removed=copy(g);removed.replacements[0].edgeResolutions=[];
 failure(()=>assertProtectedOriginalsUnchanged(g,removed),'RESOLUTION_CHANGED');
 const edited=copy(g);edited.replacements[0].edgeResolutions[0].decision='drop';delete edited.replacements[0].edgeResolutions[0].newEdgeId;
 failure(()=>assertProtectedOriginalsUnchanged(g,edited),'RESOLUTION_CHANGED');
});
test('validator rejects broken decision references and disappearing canonical replacement links',()=>{
 const g=apply(accepted(),[rewire('e1','new1','n1','x','precedes')]).graph;
 const missing=copy(g);missing.edges=missing.edges.filter(e=>e.id!=='new1');failure(()=>validateCreativeWorkflowGraph(missing),'RESOLUTION_TARGET_INVALID');
 const malformed=copy(g);malformed.replacements[0].edgeResolutions.push({edgeId:'e2',decision:'drop',newEdgeId:'fake'});failure(()=>validateCreativeWorkflowGraph(malformed),'RESOLUTION_INVALID');
 const detached=copy(g);detached.edges.find(e=>e.id==='new1').from='n5';failure(()=>validateCreativeWorkflowGraph(detached),'EXTERNAL_ENDPOINT_CHANGED');
});
test('one replacement resolution does not affect a second independent replacement',()=>{
 const g=accepted();g.replacements.push({id:'r2',state:'open',sourceNodeIds:['n5'],suspendedEdgeIds:['e5']});
 const p=plan(g,[drop('e1')]);const r=applyReplacementReconnection(g,{replacementId:'r1',decisions:[drop('e1')],expectedPreview:p,expectedRevision:12});
 assert.deepEqual(r.graph.replacements[1],g.replacements[1]);assert.equal(canonicalProjection(r.graph).nodes.some(n=>n.id==='n5'),false);
});
test('stored outcomes survive JSON roundtrip and keep unresolved edges isolated',()=>{
 const g=apply(accepted(),[rewire('e1','new1','n1','x','precedes'),drop('e3'),review('e4')]).graph;
 const loaded=JSON.parse(JSON.stringify(g));assert.doesNotThrow(()=>validateCreativeWorkflowGraph(loaded));
 assert.deepEqual(ids(canonicalProjection(loaded).edges),['e5','ex','new1']);assert.deepEqual(plan(loaded,[review('e2')]).unresolvedEdgeIds,['e2','e4']);
});
