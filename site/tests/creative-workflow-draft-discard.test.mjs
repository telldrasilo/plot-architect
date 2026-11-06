import test from 'node:test';
import assert from 'node:assert/strict';
import {previewDiscardDraftNodes,applyDiscardDraftNodes} from '../src/creative_workflow_draft_discard.mjs';
import {canonicalReadGraph,validateServerGraph,assertOrdinaryGraphWrite}
 from '../src/creative_workflow_server_boundary.mjs';

const error=code=>e=>e?.code===code;
const graph=()=>validateServerGraph({
 version:1,revision:7,view:null,
 fields:[],lanes:[],
 nodes:[
  {id:'n1',title:'Canon',description:'Unchanged',x:0,y:0,parent:null},
  {id:'n2',title:'Result',description:'Unchanged',x:250,y:0,parent:null},
  {id:'a',title:'Draft A',description:'A',x:0,y:400,parent:null,
   workspaceId:'w1',draftBranchId:'alpha'},
  {id:'b',title:'Draft B',description:'B',x:250,y:400,parent:null,
   workspaceId:'w1',draftBranchId:'alpha'},
  {id:'c',title:'Other branch',description:'C',x:0,y:650,parent:null,
   workspaceId:'w1',draftBranchId:'beta'},
  {id:'other',title:'Foreign draft',description:'',x:1300,y:400,parent:null,
   workspaceId:'w2',draftBranchId:'gamma'}
 ],
 edges:[
  {id:'e1',from:'n1',to:'n2',type:'causes'},
  {id:'ea',from:'a',to:'b',type:'precedes',workspaceId:'w1',
   draftRelation:'internal',draftBranchId:'alpha'},
  {id:'eb',from:'n2',to:'a',type:'enables',workspaceId:'w1',
   draftRelation:'boundary-proposal'}
 ],
 workspaces:[{id:'w1',taskId:'gn1',x:0,y:360,width:900,height:500},
  {id:'w2',taskId:'gn2',x:1200,y:360,width:500,height:400}],
 gapNotes:[{id:'gn1',title:'Note',text:'Source instruction',status:'pending',x:100,y:300,parent:null},
  {id:'gn2',title:'Other note',text:'Other task',status:'pending',x:1300,y:300,parent:null}],
 gapLinks:[
  {id:'gl1',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'n1'}},
  {id:'gl2',from:{kind:'gap_note',id:'gn2'},to:{kind:'plot_node',id:'n2'}}
 ],
 replacements:[]
});
const preview=(g,ids)=>previewDiscardDraftNodes(g,{workspaceId:'w1',nodeIds:ids});
const apply=(g,ids)=>applyDiscardDraftNodes(g,{workspaceId:'w1',nodeIds:ids,
 expectedRevision:g.revision,expectedPreview:preview(g,ids)});

test('preview exposes exact nodes, incident arrows and no implied rewiring',()=>{
 const g=graph(),before=structuredClone(g),p=preview(g,['a']);
 assert.deepEqual(p.nodeIds,['a']);
 assert.deepEqual(p.removedDrafts,[{id:'a',title:'Draft A',draftBranchId:'alpha'}]);
 assert.deepEqual(p.affectedRelations.map(x=>x.id),['ea','eb']);
 assert.equal(p.affectedRelations[1].draftRelation,'boundary-proposal');
 assert.equal(p.affectedRelations[1].fromTitle,'Result');
 assert.deepEqual(p.remainingNodeIds,['b','c']);
 assert.equal(p.removeWorkspace,false);
 assert.equal(p.removeNoteId,null);
 assert.deepEqual(p.autoRewiredEdgeIds,[]);
 assert.deepEqual(g,before);
});

test('single draft discard removes incident editorial links, not canon, siblings or note',()=>{
 const g=graph(),old=structuredClone(g),canon=canonicalReadGraph(g);
 const out=apply(g,['a']);
 const next=out.graph;
 assert.equal(next.nodes.some(n=>n.id==='a'),false);
 assert.deepEqual(next.nodes.filter(n=>n.id!=='a'),old.nodes.filter(n=>n.id!=='a'));
 assert.deepEqual(next.edges,[old.edges[0]]);
 assert.deepEqual(next.workspaces,old.workspaces);
 assert.deepEqual(next.gapNotes,old.gapNotes);
 assert.deepEqual(next.gapLinks,old.gapLinks);
 assert.deepEqual(canonicalReadGraph(next),canon);
 assert.deepEqual(out.changes.removedEdgeIds,['ea','eb']);
 assert.deepEqual(g,old);
 assert.doesNotThrow(()=>validateServerGraph(next));
});

test('whole branch may be discarded without destroying a different branch',()=>{
 const g=graph(),out=apply(g,['a','b']);
 assert.deepEqual(out.changes.removedNodeIds,['a','b']);
 assert.equal(out.graph.nodes.some(n=>n.id==='c'),true);
 assert.equal(out.graph.nodes.some(n=>n.id==='other'),true);
 assert.equal(out.graph.workspaces.length,2);
 assert.deepEqual(canonicalReadGraph(out.graph),canonicalReadGraph(g));
});

test('last draft removal also cleans empty workspace, stale one-shot note and note links',()=>{
 const g=graph(),canon=canonicalReadGraph(g);
 const p=preview(g,['a','b','c']);
 assert.equal(p.removeWorkspace,true);
 assert.equal(p.removeNoteId,'gn1');
 assert.deepEqual(p.removedGapLinks.map(x=>x.id),['gl1']);
 assert.deepEqual(p.remainingNodeIds,[]);
 const next=apply(g,['a','b','c']).graph;
 assert.equal(next.workspaces.some(w=>w.id==='w1'),false);
 assert.equal(next.gapNotes.some(n=>n.id==='gn1'),false);
 assert.equal(next.gapLinks.some(n=>n.id==='gl1'),false);
 assert.equal(next.gapNotes.some(n=>n.id==='gn2'),true);
 assert.equal(next.gapLinks.some(n=>n.id==='gl2'),true);
 assert.deepEqual(canonicalReadGraph(next),canon);
});

test('deleting a draft also removes editorial links directly pointing at it',()=>{
 const g=graph();
 g.gapLinks.push({id:'gl3',from:{kind:'gap_note',id:'gn2'},
  to:{kind:'plot_node',id:'a'}});
 const p=preview(g,['a']);
 assert.deepEqual(p.removedGapLinks.map(x=>x.id),['gl3']);
 const next=apply(g,['a']).graph;
 assert.equal(next.gapLinks.some(l=>l.id==='gl3'),false);
 assert.equal(next.gapLinks.some(l=>l.id==='gl2'),true);
});

test('foreign, canonical, duplicate and oversized selections reject without changing graph',()=>{
 const g=graph(),before=structuredClone(g);
 for(const ids of [[],['n1'],['other'],['absent'],['a','a'],['a',42],
   Array.from({length:129},(_,i)=>'x'+i)]){
  assert.throws(()=>preview(g,ids),error(ids.length===0||ids.length>128||
    ids.some(x=>typeof x!=='string')||new Set(ids).size!==ids.length
      ?'DISCARD_SELECTION_INVALID':'DISCARD_TARGET_INVALID'));
 }
 assert.throws(()=>previewDiscardDraftNodes(g,{workspaceId:'absent',nodeIds:['a']}),
  error('WORKSPACE_NOT_FOUND'));
 assert.deepEqual(g,before);
});

test('a last-draft operation cannot drop orphan unresolved workspace relations',()=>{
 const g=graph();
 // An internal edge between two already accepted plot nodes may not be
 // retained as "internal", but boundary-proposal is a valid pending item.
 g.edges.push({id:'pending',from:'n1',to:'n2',type:'hinders',
  workspaceId:'w1',draftRelation:'boundary-proposal'});
 assert.doesNotThrow(()=>validateServerGraph(g));
 assert.throws(()=>preview(g,['a','b','c']),error('DISCARD_UNRESOLVED_RELATIONS'));
 assert.equal(g.edges.some(e=>e.id==='pending'),true);
});

test('shared note, protected references and unexpected canonical edge block removal',()=>{
 const g=graph();
 g.workspaces[1].taskId='gn1';
 assert.throws(()=>preview(g,['a','b','c']),error('DISCARD_SHARED_SOURCE_NOTE'));
 const bad=graph();
 bad.eventRewrites=[{nodeId:'a',taskText:'Do not lose this',offerVariants:false,
   status:'pending',baseRevision:1}];
 assert.throws(()=>preview(bad,['a']),error('DISCARD_DEPENDENCY'));
});

test('review and revision are mandatory: stale or forged plan fails closed',()=>{
 const g=graph(),before=structuredClone(g),p=preview(g,['a']);
 assert.throws(()=>applyDiscardDraftNodes(g,{workspaceId:'w1',nodeIds:['a'],
  expectedRevision:7}),error('PREVIEW_REQUIRED'));
 assert.throws(()=>applyDiscardDraftNodes(g,{workspaceId:'w1',nodeIds:['a'],
  expectedRevision:8,expectedPreview:p}),error('REVISION_CONFLICT'));
 assert.throws(()=>applyDiscardDraftNodes(g,{workspaceId:'w1',nodeIds:['b'],
  expectedRevision:7,expectedPreview:p}),error('PREVIEW_STALE'));
 assert.throws(()=>applyDiscardDraftNodes(g,{workspaceId:'w1',nodeIds:['a'],
  expectedRevision:7,expectedPreview:{...p,affectedRelations:[]}}),error('PREVIEW_STALE'));
 assert.deepEqual(g,before);
});

test('ordinary editor PUT cannot remove protected draft nodes or relationships',()=>{
 const g=graph(),forged=structuredClone(g);
 forged.nodes=forged.nodes.filter(n=>n.id!=='a');
 forged.edges=forged.edges.filter(e=>!['ea','eb'].includes(e.id));
 assert.throws(()=>assertOrdinaryGraphWrite(g,forged),error('PROTECTED_NODE_CHANGED'));
});
