import test from 'node:test';
import assert from 'node:assert/strict';
import {previewEditDraftText,applyEditDraftText} from '../src/creative_workflow_draft_text.mjs';
import {canonicalReadGraph,assertOrdinaryGraphWrite,validateServerGraph} from '../src/creative_workflow_server_boundary.mjs';

const error=code=>e=>e?.code===code;
const graph=()=>validateServerGraph({
 version:1,revision:3,view:null,fields:[],lanes:[],
 nodes:[
  {id:'n1',title:'Canon',description:'Canon description',x:20,y:30,parent:null},
  {id:'a',title:'Черновик А',description:'Первый вариант',x:50,y:400,parent:null,
   workspaceId:'w1',draftBranchId:'single'},
  {id:'b',title:'Черновик Б',description:'Второй эпизод',x:280,y:400,parent:null,
   workspaceId:'w1',draftBranchId:'single'},
  {id:'c',title:'Other',description:'untouched',x:800,y:400,parent:null,
   workspaceId:'w2',draftBranchId:'beta'}
 ],
 edges:[{id:'ea',from:'a',to:'b',type:'precedes',workspaceId:'w1',
  draftBranchId:'single',draftRelation:'internal'}],
 workspaces:[{id:'w1',x:0,y:360,width:720,height:360},
  {id:'w2',x:760,y:360,width:420,height:360}],
 replacements:[]
});
const command=(title='Изменённый черновик',description='Новая подробная идея')=>
 ({workspaceId:'w1',nodeId:'a',title,description});

test('review and apply change draft text only, preserving canon, geometry and all edges',()=>{
 const g=graph(),before=structuredClone(g),args=command();
 const p=previewEditDraftText(g,args);
 assert.deepEqual(p,{workspaceId:'w1',nodeId:'a',
  before:{title:'Черновик А',description:'Первый вариант'},
  after:{title:args.title,description:args.description},autoRewiredEdgeIds:[]});
 assert.deepEqual(g,before,'preview is read only');
 const next=applyEditDraftText(g,{...args,expectedPreview:p,expectedRevision:3}).graph;
 assert.equal(next.nodes[1].title,args.title);
 assert.equal(next.nodes[1].description,args.description);
 assert.equal(next.nodes[1].workspaceId,'w1');
 assert.deepEqual(next.nodes[0],before.nodes[0]);
 assert.deepEqual(next.nodes.slice(2),before.nodes.slice(2));
 assert.deepEqual(next.edges,before.edges);
 assert.deepEqual(next.workspaces,before.workspaces);
 assert.deepEqual(canonicalReadGraph(next),canonicalReadGraph(before));
 assert.deepEqual(before,g);
 assert.doesNotThrow(()=>validateServerGraph(next));
});

test('canonical, foreign and unknown targets cannot be edited as drafts',()=>{
 const g=graph();
 for(const nodeId of ['n1','c','missing']){
  assert.throws(()=>previewEditDraftText(g,{...command(),nodeId}),error('DRAFT_TARGET_INVALID'));
 }
 assert.throws(()=>previewEditDraftText(g,{...command(),workspaceId:'w3'}),error('WORKSPACE_NOT_FOUND'));
 assert.throws(()=>previewEditDraftText(g,{...command(),workspaceId:'w2'}),error('DRAFT_TARGET_INVALID'));
});

test('new text is bounded; rejected before any mutation',()=>{
 const g=graph(),before=structuredClone(g);
 for(const args of [
  command('','valid'),command('  ','valid'),command(' leading','valid'),
  command('trailing ','valid'),command('x'.repeat(301),'valid'),
  command('valid','x'.repeat(20001)),command('valid',null),
  command(42,'valid'),command('valid',undefined)
 ])assert.throws(()=>previewEditDraftText(g,args),error('DRAFT_TEXT_INVALID'));
 assert.throws(()=>previewEditDraftText(g,{...command(),title:'Черновик А',description:'Первый вариант'}),
  error('DRAFT_TEXT_UNCHANGED'));
 assert.deepEqual(g,before);
});

test('stale preview, missing preview and revision conflict fail closed',()=>{
 const g=graph(),before=structuredClone(g),args=command(),p=previewEditDraftText(g,args);
 assert.throws(()=>applyEditDraftText(g,{...args,expectedRevision:3}),error('PREVIEW_REQUIRED'));
 assert.throws(()=>applyEditDraftText(g,{...args,expectedPreview:p,expectedRevision:2}),
  error('REVISION_CONFLICT'));
 assert.throws(()=>applyEditDraftText(g,{...args,title:'Other',expectedPreview:p,expectedRevision:3}),
  error('PREVIEW_STALE'));
 assert.throws(()=>applyEditDraftText(g,{...args,expectedPreview:{...p,before:{title:'Forged',description:'First'}},expectedRevision:3}),
  error('PREVIEW_STALE'));
 assert.deepEqual(g,before);
});

test('ordinary PUT cannot edit draft text or escape isolation',()=>{
 const g=graph(),forged=structuredClone(g);
 forged.nodes[1].title='Bypass';
 assert.throws(()=>assertOrdinaryGraphWrite(g,forged),error('PROTECTED_NODE_CHANGED'));
});

test('HTML-like descriptions are data, not plot source markup',()=>{
 const g=graph(),args=command('Новая история','<script>alert(1)</script> & текст');
 const p=previewEditDraftText(g,args);
 const next=applyEditDraftText(g,{...args,expectedPreview:p,expectedRevision:3}).graph;
 assert.equal(next.nodes[1].description,args.description);
 assert.deepEqual(canonicalReadGraph(next),canonicalReadGraph(g));
});
