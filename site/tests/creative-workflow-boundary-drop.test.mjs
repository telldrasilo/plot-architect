import test from 'node:test';
import assert from 'node:assert/strict';
import {previewDropBoundaryRelation,applyDropBoundaryRelation}
 from '../src/creative_workflow_boundary_drop.mjs';
import {canonicalReadGraph,validateServerGraph,assertOrdinaryGraphWrite}
 from '../src/creative_workflow_server_boundary.mjs';

const failure=code=>err=>err?.code===code;
const graph=()=>validateServerGraph({
 version:1,revision:4,view:null,fields:[],lanes:[],
 nodes:[
  {id:'n1',title:'Existing plot',description:'',x:0,y:0,parent:null},
  {id:'n2',title:'Accepted part',description:'',x:200,y:0,parent:null},
  {id:'a',title:'Draft A',description:'',x:100,y:400,parent:null,workspaceId:'w1'},
  {id:'b',title:'Draft B',description:'',x:400,y:400,parent:null,workspaceId:'w1'}
 ],
 edges:[
  {id:'canon',from:'n1',to:'n2',type:'causes'},
  {id:'internal',from:'a',to:'b',type:'precedes',workspaceId:'w1',
   draftRelation:'internal'},
  {id:'pending',from:'n2',to:'a',type:'enables',workspaceId:'w1',
   draftRelation:'boundary-proposal'},
  {id:'canon-pending',from:'n1',to:'n2',type:'hinders',workspaceId:'w1',
   draftRelation:'boundary-proposal'}
 ],
 workspaces:[{id:'w1',taskId:'gn1',x:100,y:350,width:900,height:300}],
 replacements:[]
});
const options=edgeId=>({workspaceId:'w1',edgeId});

test('boundary proposal rejection only removes the chosen editorial arrow',()=>{
 const g=graph(),before=structuredClone(g),canon=canonicalReadGraph(g);
 const p=previewDropBoundaryRelation(g,options('pending'));
 assert.deepEqual(p,{workspaceId:'w1',edgeId:'pending',
  relation:{id:'pending',from:'n2',to:'a',type:'enables',
   draftRelation:'boundary-proposal',fromTitle:'Accepted part',toTitle:'Draft A'},
  autoRewiredEdgeIds:[]});
 const {graph:next,changes}=applyDropBoundaryRelation(g,{...options('pending'),
  expectedPreview:p,expectedRevision:4});
 assert.deepEqual(changes,{workspaceId:'w1',removedEdgeId:'pending',autoRewiredEdgeIds:[]});
 assert.equal(next.edges.some(e=>e.id==='pending'),false);
 assert.deepEqual(next.edges.filter(e=>e.id!=='pending'),before.edges.filter(e=>e.id!=='pending'));
 assert.deepEqual(next.nodes,before.nodes);
 assert.deepEqual(next.workspaces,before.workspaces);
 assert.deepEqual(canonicalReadGraph(next),canon);
 assert.deepEqual(g,before);
});

test('canon-to-canon unresolved proposal can be discarded without editing canon',()=>{
 const g=graph(),before=canonicalReadGraph(g);
 const plan=previewDropBoundaryRelation(g,options('canon-pending'));
 const next=applyDropBoundaryRelation(g,{...options('canon-pending'),expectedPreview:plan}).graph;
 assert.equal(next.edges.some(e=>e.id==='canon-pending'),false);
 assert.equal(next.edges.some(e=>e.id==='canon'),true);
 assert.deepEqual(canonicalReadGraph(next),before);
});

test('partially accepted internal arrow is a removable editorial boundary',()=>{
 const g=graph();
 g.nodes.find(n=>n.id==='a').workspaceId=undefined;
 const p=previewDropBoundaryRelation(g,options('internal'));
 assert.equal(p.relation.from,'a');
 assert.equal(p.relation.to,'b');
 const next=applyDropBoundaryRelation(g,{...options('internal'),expectedPreview:p}).graph;
 assert.equal(next.edges.some(e=>e.id==='internal'),false);
 assert.deepEqual(canonicalReadGraph(next),canonicalReadGraph(g));
});

test('ordinary canon edges and internal draft-to-draft edges are never targets',()=>{
 const g=graph(),before=structuredClone(g);
 for(const edgeId of ['canon','internal','missing']){
  assert.throws(()=>previewDropBoundaryRelation(g,options(edgeId)),
   failure(edgeId==='internal'?'BOUNDARY_EDGE_REQUIRED':'BOUNDARY_EDGE_NOT_FOUND'));
 }
 assert.throws(()=>previewDropBoundaryRelation(g,{workspaceId:'missing',edgeId:'pending'}),
  failure('WORKSPACE_NOT_FOUND'));
 assert.deepEqual(g,before);
});

test('stale preview, absent review and revision mismatch fail without touching graph',()=>{
 const g=graph(),before=structuredClone(g),p=previewDropBoundaryRelation(g,options('pending'));
 assert.throws(()=>applyDropBoundaryRelation(g,{...options('pending')}),
  failure('PREVIEW_REQUIRED'));
 assert.throws(()=>applyDropBoundaryRelation(g,{...options('pending'),expectedPreview:p,
  expectedRevision:3}),failure('REVISION_CONFLICT'));
 assert.throws(()=>applyDropBoundaryRelation(g,{...options('pending'),expectedPreview:{
  ...p,relation:{...p.relation,type:'causes'}}}),failure('PREVIEW_STALE'));
 assert.deepEqual(g,before);
});

test('generic PUT cannot bypass reviewed deletion',()=>{
 const g=graph(),other=structuredClone(g);
 other.edges=other.edges.filter(e=>e.id!=='pending');
 assert.throws(()=>assertOrdinaryGraphWrite(g,other),failure('PROTECTED_EDGE_CHANGED'));
});
