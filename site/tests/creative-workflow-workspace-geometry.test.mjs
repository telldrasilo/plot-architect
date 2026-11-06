import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWorkspaceGeometry,applyWorkspaceGeometry}
 from '../src/creative_workflow_workspace_geometry.mjs';
import {validateServerGraph,canonicalReadGraph,assertOrdinaryGraphWrite}
 from '../src/creative_workflow_server_boundary.mjs';

const fails=code=>err=>err?.code===code;
function graph(){
 return validateServerGraph({
  version:1,revision:8,view:null,fields:[],lanes:[],
  nodes:[
   {id:'canon',title:'Existing canon',x:10,y:35,parent:null,description:''},
   {id:'canon2',title:'Other canon',x:310,y:35,parent:null,description:''},
   {id:'draft-a',title:'First draft',x:140,y:450,parent:null,workspaceId:'w1',
    draftBranchId:'one'},
   {id:'draft-b',title:'Second draft',x:450,y:450,parent:null,workspaceId:'w1',
    draftBranchId:'one'},
   {id:'draft-outside',title:'Already outside',x:1290,y:940,parent:null,
    workspaceId:'w1',draftBranchId:'two'},
   {id:'another',title:'Other area',x:1700,y:450,parent:null,workspaceId:'w2'}
  ],
  edges:[
   {id:'plot',from:'canon',to:'canon2',type:'precedes'},
   {id:'draft-edge',from:'draft-a',to:'draft-b',type:'causes',
    workspaceId:'w1',draftRelation:'internal'},
   {id:'draft-boundary',from:'canon',to:'draft-a',type:'enables',
    workspaceId:'w1',draftRelation:'boundary-proposal'}
  ],
  workspaces:[
   {id:'w1',taskId:'note1',x:100,y:420,width:1000,height:520},
   {id:'w2',taskId:'note2',x:1600,y:420,width:500,height:520}
  ],
  gapNotes:[],gapLinks:[],replacements:[]
 });
}
const move={workspaceId:'w1',mode:'move',
 geometry:{x:210,y:560,width:1000,height:520}};
const resize={workspaceId:'w1',mode:'resize',
 geometry:{x:100,y:420,width:370,height:180}};
const perform=(g,cmd)=>applyWorkspaceGeometry(g,{
 ...cmd,expectedRevision:g.revision,
 expectedPreview:previewWorkspaceGeometry(g,cmd)
});

test('moving saved frame translates every owned draft, including outside card, and no canon',()=>{
 const g=graph(),before=structuredClone(g),projection=canonicalReadGraph(g);
 const preview=previewWorkspaceGeometry(g,move);
 assert.deepEqual(preview.before,{x:100,y:420,width:1000,height:520});
 assert.deepEqual(preview.delta,{x:110,y:140});
 assert.deepEqual(preview.positionChanges.map(x=>x.nodeId),
  ['draft-a','draft-b','draft-outside']);
 assert.deepEqual(preview.affectedDraftEdgeIds,['draft-edge','draft-boundary']);
 assert.deepEqual(preview.autoRewiredEdgeIds,[]);
 assert.deepEqual(g,before,'preview must be read-only');
 const next=perform(g,move).graph;
 assert.deepEqual(next.workspaces[0],{...before.workspaces[0],...move.geometry});
 for(const id of ['draft-a','draft-b','draft-outside']){
  const a=before.nodes.find(n=>n.id===id);
  const b=next.nodes.find(n=>n.id===id);
  assert.equal(b.x,a.x+110);assert.equal(b.y,a.y+140);
  assert.equal(b.workspaceId,'w1');
 }
 assert.deepEqual(next.workspaces[1],before.workspaces[1]);
 assert.deepEqual(next.nodes.filter(n=>n.workspaceId!=='w1'),
  before.nodes.filter(n=>n.workspaceId!=='w1'));
 assert.deepEqual(next.edges,before.edges);
 assert.deepEqual(canonicalReadGraph(next),projection);
 assert.deepEqual(g,before);
});

test('resizing only changes the persisted border, even if cards extend outside it',()=>{
 const g=graph(),before=structuredClone(g),preview=previewWorkspaceGeometry(g,resize);
 assert.deepEqual(preview.positionChanges,[]);
 assert.deepEqual(preview.affectedDraftEdgeIds,[]);
 assert.deepEqual(preview.after,resize.geometry);
 const next=perform(g,resize).graph;
 assert.deepEqual(next.nodes,before.nodes);
 assert.deepEqual(next.edges,before.edges);
 assert.deepEqual(next.workspaces[0],{...before.workspaces[0],...resize.geometry});
 assert.deepEqual(canonicalReadGraph(next),canonicalReadGraph(before));
 assert.doesNotThrow(()=>validateServerGraph(next));
});

test('guarded validation rejects forged mode and illegal geometry',()=>{
 const g=graph(),before=structuredClone(g);
 const invalid=[
  {...move,mode:'accept'}, {...move,workspaceId:'missing'},
  {...move,geometry:{...move.geometry,width:200}},
  {...move,geometry:{...move.geometry,x:NaN}},
  {...move,geometry:{...move.geometry,x:Infinity}},
  {...move,geometry:{...move.geometry,x:1_000_001}},
  {...move,geometry:{...move.geometry,extra:1}},
  {...resize,geometry:{...resize.geometry,x:101}},
  {...resize,geometry:{...resize.geometry,width:249}},
  {...resize,geometry:{...resize.geometry,height:139}},
  {...move,geometry:{x:100,y:420,width:1000,height:520}}
 ];
 for(const cmd of invalid)
  assert.throws(()=>previewWorkspaceGeometry(g,cmd));
 assert.deepEqual(g,before);
});

test('move fails closed when an owned node exceeds coordinate bounds',()=>{
 const g=graph();
 const cmd={...move,geometry:{...move.geometry,x:999_999}};
 assert.throws(()=>previewWorkspaceGeometry(g,cmd),fails('WORKSPACE_MEMBER_OUT_OF_RANGE'));
});

test('stale preview, mismatched review and revisions reject without mutation',()=>{
 const g=graph(),before=structuredClone(g),p=previewWorkspaceGeometry(g,move);
 assert.throws(()=>applyWorkspaceGeometry(g,{...move}),fails('PREVIEW_REQUIRED'));
 assert.throws(()=>applyWorkspaceGeometry(g,{...move,expectedRevision:7,expectedPreview:p}),
  fails('REVISION_CONFLICT'));
 assert.throws(()=>applyWorkspaceGeometry(g,{...move,
  geometry:{...move.geometry,x:212},expectedPreview:p}),
  fails('PREVIEW_STALE'));
 assert.throws(()=>applyWorkspaceGeometry(g,{...move,expectedPreview:{...p,affectedDraftEdgeIds:[]}}),
  fails('PREVIEW_STALE'));
 assert.deepEqual(g,before);
});

test('ordinary REST PUT cannot adjust saved frame or translate protected drafts',()=>{
 const g=graph(),forged=structuredClone(g);
 forged.workspaces[0].x=220;
 assert.throws(()=>assertOrdinaryGraphWrite(g,forged),
  fails('EXPLICIT_WORKFLOW_COMMAND_REQUIRED'));
 const another=structuredClone(g);
 another.nodes.find(n=>n.id==='draft-a').x+=20;
 assert.throws(()=>assertOrdinaryGraphWrite(g,another),fails('PROTECTED_NODE_CHANGED'));
});
