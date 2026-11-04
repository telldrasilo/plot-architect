import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalReadGraph,validateServerGraph,assertOrdinaryGraphWrite} from '../src/creative_workflow_server_boundary.mjs';
import {previewMoveDraftNodes,applyMoveDraftNodes} from '../src/creative_workflow_draft_move.mjs';

const copy=value=>structuredClone(value);
const error=(fn,code)=>assert.throws(fn,e=>e.code===code);
function graph(){
  return validateServerGraph({
    version:1,revision:6,view:null,fields:[],lanes:[],
    nodes:[
      {id:'n1',title:'Существующий факт',description:'Канон',x:40,y:40,parent:null},
      {id:'n2',title:'Оригинал',description:'Защищён',x:340,y:40,parent:null},
      {id:'n3',title:'Последствие',description:'Канон',x:640,y:40,parent:null},
      {id:'a',title:'Черновик А',description:'',x:150,y:530,parent:null,workspaceId:'w1',draftBranchId:'alpha'},
      {id:'b',title:'Черновик Б',description:'',x:420,y:530,parent:null,workspaceId:'w1',draftBranchId:'alpha'},
      {id:'c',title:'Черновик В',description:'',x:150,y:750,parent:null,workspaceId:'w1',draftBranchId:'beta'},
      {id:'other',title:'Другая область',description:'',x:1260,y:530,parent:null,workspaceId:'w2',draftBranchId:'gamma'}
    ],
    edges:[
      {id:'e1',from:'n1',to:'n2',type:'precedes'},
      {id:'e2',from:'n2',to:'n3',type:'causes'},
      {id:'e3',from:'n1',to:'n3',type:'enables'},
      {id:'ea',from:'a',to:'b',type:'precedes',workspaceId:'w1',draftBranchId:'alpha',draftRelation:'internal'}
    ],
    workspaces:[
      {id:'w1',taskId:'gn1',x:100,y:480,width:1050,height:650},
      {id:'w2',taskId:'gn2',x:1230,y:480,width:420,height:450}
    ],
    replacements:[{id:'r1',state:'open',sourceNodeIds:['n2'],suspendedEdgeIds:['e1','e2'],sourceGraphRevision:4}]
  });
}
const move=(nodeId='a',x=180,y=590)=>({nodeId,x,y});
function apply(g,moves=[move()],workspaceId='w1'){
  const preview=previewMoveDraftNodes(g,{workspaceId,moves});
  return applyMoveDraftNodes(g,{workspaceId,moves,expectedPreview:preview,expectedRevision:g.revision});
}
test('review includes exact old/new coordinates and affected draft links',()=>{
  const g=graph(),before=copy(g),p=previewMoveDraftNodes(g,{workspaceId:'w1',moves:[move('a',230,600)]});
  assert.deepEqual(p,{workspaceId:'w1',positionChanges:[{nodeId:'a',before:{x:150,y:530},after:{x:230,y:600}}],
    affectedDraftEdgeIds:['ea'],autoRewiredEdgeIds:[]});
  assert.deepEqual(g,before);
});
test('one draft movement changes only x/y while preserving canon, original and edge data',()=>{
  const g=graph(),old=copy(g),prior=canonicalReadGraph(g);
  const result=apply(g,[move('a',260,640)]);
  assert.deepEqual(canonicalReadGraph(result.graph),prior);
  assert.equal(result.graph.nodes.find(n=>n.id==='a').x,260);
  assert.equal(result.graph.nodes.find(n=>n.id==='a').y,640);
  assert.deepEqual(result.graph.nodes.find(n=>n.id==='n2'),old.nodes.find(n=>n.id==='n2'));
  assert.deepEqual(result.graph.edges,old.edges);
  assert.deepEqual(result.graph.replacements,old.replacements);
  assert.deepEqual(g,old);
  assert.deepEqual(result.changes.movedNodeIds,['a']);
  assert.deepEqual(result.changes.autoRewiredEdgeIds,[]);
});
test('multi-node positioning is an atomic pure graph transformation',()=>{
  const g=graph(),result=apply(g,[move('a',240,640),move('b',500,640)]);
  assert.equal(result.graph.nodes.find(n=>n.id==='a').x,240);
  assert.equal(result.graph.nodes.find(n=>n.id==='b').x,500);
  assert.deepEqual(result.changes.affectedDraftEdgeIds,['ea']);
  assert.equal(result.graph.nodes.find(n=>n.id==='c').x,150);
  assert.doesNotThrow(()=>validateServerGraph(JSON.parse(JSON.stringify(result.graph))));
});
test('an unrelated workspace is never moved by a first-workspace request',()=>{
  const g=graph();
  error(()=>previewMoveDraftNodes(g,{workspaceId:'w1',moves:[move('other',1290,600)]}),'MOVE_TARGET_INVALID');
  assert.equal(g.nodes.find(n=>n.id==='other').x,1260);
});
test('canon and replaced original are forbidden movement targets',()=>{
  const g=graph();
  for(const id of ['n1','n2','n3']){
    error(()=>previewMoveDraftNodes(g,{workspaceId:'w1',moves:[move(id,200,560)]}),'MOVE_TARGET_INVALID');
  }
});
test('no external arrow or replacement can be created as a side effect',()=>{
  const g=graph(),result=apply(g,[move('a',200,600)]);
  assert.equal(result.graph.edges.length,g.edges.length);
  assert.equal(result.graph.replacements.length,g.replacements.length);
  assert.deepEqual(result.graph.edges,g.edges);
});
test('workspace borders include draft footprint, and out-of-area coordinates fail closed',()=>{
  const g=graph();
  for(const target of [move('a',99,600),move('a',200,479),move('a',1100,600),move('a',200,1080)]){
    error(()=>previewMoveDraftNodes(g,{workspaceId:'w1',moves:[target]}),'MOVE_OUT_OF_AREA');
  }
  const p=previewMoveDraftNodes(g,{workspaceId:'w1',moves:[move('a',942,1025)]});
  assert.equal(p.positionChanges.length,1);
});
test('review refuses nonfinite coordinates, oversize numbers and nonnumeric strings',()=>{
  const g=graph();
  for(const value of [NaN,Infinity,-Infinity,'200',1_000_001]){
    error(()=>previewMoveDraftNodes(g,{workspaceId:'w1',moves:[move('a',value,580)]}),'MOVE_COORDINATES_INVALID');
  }
});
test('duplicate IDs, unknown fields, empty and huge batches are rejected',()=>{
  const g=graph();
  error(()=>previewMoveDraftNodes(g,{workspaceId:'w1',moves:[]}),'MOVE_SELECTION_INVALID');
  error(()=>previewMoveDraftNodes(g,{workspaceId:'w1',moves:[move(),move()]}),'MOVE_SELECTION_INVALID');
  error(()=>previewMoveDraftNodes(g,{workspaceId:'w1',moves:[{...move(),status:'approved'}]}),'MOVE_SELECTION_INVALID');
  error(()=>previewMoveDraftNodes(g,{workspaceId:'w1',moves:[move(),...Array.from({length:128},(_,i)=>move('item'+i))]}),'MOVE_SELECTION_INVALID');
});
test('unchanged target coordinates are not a write operation',()=>{
  error(()=>previewMoveDraftNodes(graph(),{workspaceId:'w1',moves:[move('a',150,530)]}),'MOVE_UNCHANGED');
});
test('preview is mandatory and stale review is rejected without mutation',()=>{
  const g=graph(),before=copy(g),moves=[move('a',200,600)];
  error(()=>applyMoveDraftNodes(g,{workspaceId:'w1',moves,expectedRevision:6}),'PREVIEW_REQUIRED');
  const stale=previewMoveDraftNodes(g,{workspaceId:'w1',moves});
  stale.positionChanges[0].after.y=650;
  error(()=>applyMoveDraftNodes(g,{workspaceId:'w1',moves,expectedPreview:stale,expectedRevision:6}),'PREVIEW_STALE');
  assert.deepEqual(g,before);
});
test('revision mismatch fails closed even when reviewed coordinates are still valid',()=>{
  const g=graph(),moves=[move('a',200,600)],p=previewMoveDraftNodes(g,{workspaceId:'w1',moves});
  error(()=>applyMoveDraftNodes(g,{workspaceId:'w1',moves,expectedPreview:p,expectedRevision:7}),'REVISION_CONFLICT');
});
test('ordinary PUT cannot bypass the reviewed draft movement',()=>{
  const old=graph(),modified=copy(old);
  modified.nodes.find(n=>n.id==='a').x+=50;
  error(()=>assertOrdinaryGraphWrite(old,modified),'PROTECTED_NODE_CHANGED');
});
test('second-workspace draft may be moved through its own exact review',()=>{
  const g=graph(),target=move('other',1280,610),result=apply(g,[target],'w2');
  assert.equal(result.graph.nodes.find(n=>n.id==='other').x,1280);
  assert.equal(result.graph.nodes.find(n=>n.id==='a').x,150);
});
