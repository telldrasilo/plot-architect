import test from 'node:test';
import assert from 'node:assert/strict';
import {applyStartReplacement,previewReplacementStart,canonicalProjection,validateCreativeWorkflowGraph,assertProtectedOriginalsUnchanged} from '../src/creative_workflow_contract.mjs';
const clone=x=>structuredClone(x);
const names=arr=>arr.map(x=>x.id);
function story(){return {
  version:1,revision:9,view:null,
  nodes:[{id:'n1',title:'Начало',x:10,y:30,status:'proposed'},{id:'n2',title:'Поворот',description:'Здесь происходит выбор',x:210,y:30,status:'approved'},{id:'n3',title:'Итог',x:410,y:30},{id:'n4',title:'Следствие',x:610,y:30},{id:'n5',title:'Отдельно',x:810,y:30},{id:'n6',title:'Независимо',x:1000,y:30}],
  edges:[{id:'e1',from:'n1',to:'n2',type:'precedes'},{id:'e2',from:'n2',to:'n3',type:'causes'},{id:'e3',from:'n2',to:'n4',type:'enables'},{id:'e4',from:'n4',to:'n2',type:'hinders'},{id:'e5',from:'n3',to:'n5',type:'precedes'},{id:'e6',from:'n5',to:'n6',type:'precedes'}],
  fields:[],lanes:[]
}}
const plan=(g,ids)=>previewReplacementStart(g,ids);
const begin=(g,ids,id='replace-1')=>applyStartReplacement(g,{replacementId:id,sourceNodeIds:ids,expectedPreview:plan(g,ids),expectedRevision:g.revision});
test('replacement preview captures exact original node and all incident directed typed edges',()=>{
 const g=story(),p=plan(g,['n2']);assert.deepEqual(p.sourceNodeIds,['n2']);assert.deepEqual(p.suspendedEdgeIds,['e1','e2','e3','e4']);
 assert.deepEqual(p.originalNodes,[g.nodes[1]]);assert.deepEqual(p.suspendedEdges,g.edges.slice(0,4));assert.deepEqual(p.affectedDraftEdgeIds,[]);
});
test('explicit begin suspends original and all affected arrows without modifying source',()=>{
 const g=story(),before=clone(g),r=begin(g,['n2']);assert.deepEqual(g,before);assert.deepEqual(r.graph.nodes,g.nodes);assert.deepEqual(r.graph.edges,g.edges);
 assert.deepEqual(r.graph.replacements,[{id:'replace-1',state:'open',sourceNodeIds:['n2'],suspendedEdgeIds:['e1','e2','e3','e4'],sourceGraphRevision:9}]);
 assert.deepEqual(names(canonicalProjection(r.graph).nodes),['n1','n3','n4','n5','n6']);assert.deepEqual(names(canonicalProjection(r.graph).edges),['e5','e6']);
 assert.deepEqual(r.changes.autoRewiredEdgeIds,[]);assert.equal(r.graph.revision,9);
});
test('many sources preserve internal edges and all boundary edges in one replacement',()=>{
 const g=story(),r=begin(g,['n2','n3']);assert.deepEqual(r.changes.suspendedEdgeIds,['e1','e2','e3','e4','e5']);
 assert.deepEqual(names(canonicalProjection(r.graph).nodes),['n1','n4','n5','n6']);assert.deepEqual(names(canonicalProjection(r.graph).edges),['e6']);
});
test('source text mutation after preview rejects before any changes',()=>{
 const g=story(),p=plan(g,['n2']);g.nodes[1].description='Смысл изменился';const before=clone(g);
 assert.throws(()=>applyStartReplacement(g,{replacementId:'r',sourceNodeIds:['n2'],expectedPreview:p,expectedRevision:9}),e=>e.code==='PREVIEW_STALE');assert.deepEqual(g,before);
});
test('old edge type change with same IDs invalidates preview',()=>{
 const g=story(),p=plan(g,['n2']);g.edges[1].type='hinders';const before=clone(g);
 assert.throws(()=>applyStartReplacement(g,{replacementId:'r',sourceNodeIds:['n2'],expectedPreview:p,expectedRevision:9}),e=>e.code==='PREVIEW_STALE');assert.deepEqual(g,before);
});
test('changed edge endpoint or new incident edge invalidates preview',()=>{
 for(const change of [g=>{g.edges[1].to='n6'},g=>{g.edges.push({id:'e7',from:'n6',to:'n2',type:'causes'})}]){
  const g=story(),p=plan(g,['n2']);change(g);const before=clone(g);
  assert.throws(()=>applyStartReplacement(g,{replacementId:'r',sourceNodeIds:['n2'],expectedPreview:p,expectedRevision:9}),e=>e.code==='PREVIEW_STALE');assert.deepEqual(g,before);
 }
});
test('unrelated plot edits do not invalidate a targeted review',()=>{
 const g=story(),p=plan(g,['n2']);g.nodes.find(n=>n.id==='n6').title='Новый эпилог';const r=applyStartReplacement(g,{replacementId:'r',sourceNodeIds:['n2'],expectedPreview:p,expectedRevision:9});assert.equal(r.graph.nodes.at(-1).title,'Новый эпилог');
});
test('requires explicit preview, stable ID and matching in-memory revision',()=>{
 const g=story(),p=plan(g,['n2']),before=clone(g);
 assert.throws(()=>applyStartReplacement(g,{replacementId:'r',sourceNodeIds:['n2'],expectedRevision:9}),e=>e.code==='PREVIEW_REQUIRED');
 assert.throws(()=>applyStartReplacement(g,{replacementId:'',sourceNodeIds:['n2'],expectedPreview:p,expectedRevision:9}),e=>e.code==='REPLACEMENT_ID_INVALID');
 assert.throws(()=>applyStartReplacement(g,{replacementId:'r',sourceNodeIds:['n2'],expectedPreview:p,expectedRevision:8}),e=>e.code==='REVISION_CONFLICT');assert.deepEqual(g,before);
});
test('cannot replace already-retired originals or duplicate replacement IDs',()=>{
 const g=begin(story(),['n2']).graph;assert.throws(()=>plan(g,['n2']),e=>e.code==='SOURCE_INVALID');
 assert.throws(()=>applyStartReplacement(g,{replacementId:'replace-1',sourceNodeIds:['n6'],expectedPreview:plan(g,['n6']),expectedRevision:9}),e=>e.code==='REPLACEMENT_ID_CONFLICT');
});
test('separate replacement sharing a suspended old edge is forbidden',()=>{
 const g=begin(story(),['n2']).graph;assert.throws(()=>plan(g,['n3']),e=>e.code==='REPLACEMENT_CONFLICT');
});
test('disjoint replacements coexist without disturbing each others preserved originals',()=>{
 const first=begin(story(),['n2']).graph,original=clone(first.replacements[0]);const next=begin(first,['n6'],'replace-2').graph;
 assert.equal(next.replacements.length,2);assert.deepEqual(next.replacements[0],original);assert.deepEqual(next.replacements[1].suspendedEdgeIds,['e6']);
 assert.equal(assertProtectedOriginalsUnchanged(first,next),true);
});
test('existing drafts and unrelated proposals remain isolated and intact',()=>{
 const g=story();g.workspaces=[{id:'w1',x:0,y:240,width:400,height:160}];g.nodes.push({id:'draft',title:'Альтернатива',x:100,y:300,workspaceId:'w1'});
 g.edges.push({id:'ed',from:'n5',to:'draft',type:'causes',workspaceId:'w1',draftRelation:'boundary-proposal'});
 const r=begin(g,['n2']);assert.deepEqual(r.graph.workspaces,g.workspaces);assert.deepEqual(r.graph.edges.at(-1),g.edges.at(-1));
 assert.equal(canonicalProjection(r.graph).nodes.some(n=>n.id==='draft'),false);
});
test('draft proposals targeting retired source are explicitly blocked, never erased',()=>{
 const g=story();g.workspaces=[{id:'w1',x:0,y:240,width:400,height:160}];g.nodes.push({id:'draft',title:'Черновик',x:100,y:300,workspaceId:'w1'});
 g.edges.push({id:'ed',from:'n2',to:'draft',type:'causes',workspaceId:'w1',draftRelation:'boundary-proposal'});
 const p=plan(g,['n2']);assert.deepEqual(p.affectedDraftEdgeIds,['ed']);const before=clone(g);
 assert.throws(()=>applyStartReplacement(g,{replacementId:'r',sourceNodeIds:['n2'],expectedPreview:p,expectedRevision:9}),e=>e.code==='DRAFT_REFERENCE_CONFLICT');assert.deepEqual(g,before);
});
test('result remains valid after JSON roundtrip; original protected afterwards',()=>{
 const result=begin(story(),['n2']).graph,next=JSON.parse(JSON.stringify(result));assert.doesNotThrow(()=>validateCreativeWorkflowGraph(next));
 next.nodes.find(n=>n.id==='n2').title='Случайная правка';assert.throws(()=>assertProtectedOriginalsUnchanged(result,next),e=>e.code==='ORIGINAL_CHANGED');
});
