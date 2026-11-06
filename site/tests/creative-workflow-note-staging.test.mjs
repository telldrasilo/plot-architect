import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGraph} from '../src/graph_contract.mjs';
import {canonicalProjection,applyDraftAcceptance,validateCreativeWorkflowGraph} from '../src/creative_workflow_contract.mjs';
import {previewStageNoteAlternatives,applyStageNoteAlternatives} from '../src/creative_workflow_note_staging.mjs';

const clone=x=>structuredClone(x);
const mustFail=(fn,code)=>assert.throws(fn,e=>e?.code===code);
function graph(){
  return validateGraph({
    revision:7,version:1,view:null,
    nodes:[{id:'n1',title:'До',description:'Факт',x:0,y:0},{id:'n2',title:'Между',description:'История',x:240,y:0},{id:'n3',title:'После',description:'Последствие',x:480,y:0}],
    edges:[{id:'e1',from:'n1',to:'n2',type:'precedes'},{id:'e2',from:'n2',to:'n3',type:'causes'}],
    fields:[],lanes:[],
    gapNotes:[{id:'gn1',title:'Заметка',text:'Предложи четыре разных пути развития событий.',x:120,y:400,parent:null,offerVariants:false,status:'pending'}],
    gapLinks:[{id:'gl1',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'n2'}}]
  });
}
const area={x:40,y:590,width:1450,height:700};
const branch=(id,baseX=80,baseY=650,count=2)=>({
  id,title:'Подход '+id,
  nodes:Array.from({length:count},(_,i)=>({id:id+'_n'+(i+1),title:id+' событие '+(i+1),description:'Детали варианта',x:baseX+i*230,y:baseY})),
  edges:Array.from({length:count-1},(_,i)=>({id:id+'_e'+(i+1),from:id+'_n'+(i+1),to:id+'_n'+(i+2),type:'precedes'}))
});
const variants=(n=4)=>Array.from({length:n},(_,i)=>branch('b'+(i+1),80,650+i*155,i%2+1));
const input=(g,branches=variants())=>({noteId:'gn1',workspaceId:'w1',workspace:area,branches});
const review=(g,options=input(g))=>previewStageNoteAlternatives(g,options);
const stage=(g,options=input(g))=>applyStageNoteAlternatives(g,{...options,expectedPreview:review(g,options),expectedRevision:g.revision});
test('legacy gap note and context link produce four independently sized branches, not three forced variants',()=>{
  const g=graph(),original=clone(g),o=input(g),preview=review(g,o);
  assert.equal(preview.branchSummaries.length,4);
  assert.deepEqual(preview.branchSummaries.map(v=>v.nodeCount),[1,2,1,2]);
  assert.deepEqual(preview.contextualLinks,g.gapLinks);
  assert.equal(preview.deleteSourceNoteOnCommit,true);
  assert.deepEqual(preview.removeSourceLinkIds,['gl1']);
  assert.equal(preview.sourceNote.offerVariants,false,'legacy checkbox must not select count');
  assert.deepEqual(g,original);
});
test('staging alters no canonical plot node/edge, never creates a gap by implication',()=>{
  const g=graph(),original=clone(g),before=canonicalProjection(g),result=stage(g);
  assert.deepEqual(g,original);assert.deepEqual(canonicalProjection(result.graph),before);
  assert.equal(result.graph.replacements,undefined);assert.equal(result.graph.workspaces[0].taskId,'gn1');
  assert.deepEqual(result.graph.gapNotes,[]);
  assert.deepEqual(result.graph.gapLinks,[]);
  assert.equal(result.changes.removedNoteId,'gn1');
  assert.deepEqual(result.changes.removedGapLinkIds,['gl1']);
  assert.deepEqual(result.changes.autoRewiredEdgeIds,[]);
  assert.equal(result.graph.revision,7);
});
test('each staged branch creates nodes on the same canvas and only its own internal arrows',()=>{
  const {graph:g}=stage(graph());
  assert.deepEqual(g.workspaces[0],{id:'w1',taskId:'gn1',...area});
  assert.equal(g.nodes.filter(n=>n.workspaceId==='w1').length,6);
  assert.equal(g.edges.filter(e=>e.workspaceId==='w1').length,2);
  assert.deepEqual(g.nodes.filter(n=>n.workspaceId==='w1').map(n=>n.draftBranchId),['b1','b2','b2','b3','b4','b4']);
  assert.doesNotThrow(()=>validateCreativeWorkflowGraph(g));
});
test('accept subset across two alternatives while leaving other branches as drafts',()=>{
  const original=stage(graph()).graph;
  const {graph:g}=applyDraftAcceptance(original,{workspaceId:'w1',nodeIds:['b2_n1','b2_n2','b4_n1']});
  const canon=canonicalProjection(g);
  assert.deepEqual(canon.nodes.map(n=>n.id),['n1','n2','n3','b2_n1','b2_n2','b4_n1']);
  assert.ok(canon.edges.some(e=>e.id==='b2_e1'));
  assert.ok(!canon.edges.some(e=>e.id==='b4_e1'));
  assert.equal(g.nodes.find(n=>n.id==='b4_n2').workspaceId,'w1');
  for(const n of canon.nodes)assert.equal(n.draftBranchId,undefined);
  for(const e of canon.edges)assert.equal(e.draftBranchId,undefined);
  assert.deepEqual(original.nodes.find(n=>n.id==='b2_n1').workspaceId,'w1');
});
test('sequential acceptance of a later branch node promotes original internal arrow',()=>{
  const first=applyDraftAcceptance(stage(graph()).graph,{workspaceId:'w1',nodeIds:['b4_n1']}).graph;
  assert.ok(!canonicalProjection(first).edges.some(e=>e.id==='b4_e1'));
  const second=applyDraftAcceptance(first,{workspaceId:'w1',nodeIds:['b4_n2']}).graph;
  assert.ok(canonicalProjection(second).edges.some(e=>e.id==='b4_e1'));
  assert.equal(second.edges.find(e=>e.id==='b4_e1').draftBranchId,undefined);
});
test('one branch with multiple events is valid; four branches and one single event are not required defaults',()=>{
  const g=graph();
  const one=stage(g,input(g,[branch('only',100,650,3)]));
  assert.equal(one.graph.workspaces.length,1);
  assert.equal(one.changes.stagedNodeIds.length,3);
  assert.deepEqual(one.changes.branchIds,['only']);
});
test('same note cannot be staged twice under any area ID',()=>{
  const staged=stage(graph()).graph;
  mustFail(()=>review(staged,input(staged)),'WORKSPACE_CONFLICT');
  mustFail(()=>review(staged,{...input(staged),workspaceId:'w2'}),'WORKSPACE_CONFLICT');
});
test('existing canonical IDs and duplicate candidate IDs are rejected',()=>{
  const g=graph(),bad=variants(1);bad[0].nodes[0].id='n2';
  mustFail(()=>review(g,input(g,bad)),'CANDIDATE_NODE_INVALID');
  const duplicates=variants(2);duplicates[1].nodes[0].id=duplicates[0].nodes[0].id;
  mustFail(()=>review(g,input(g,duplicates)),'CANDIDATE_NODE_INVALID');
});
test('prepared links cannot point to canonical story or another alternative branch',()=>{
  const g=graph(),b=variants(2);
  b[0].edges=[{id:'link',from:b[0].nodes[0].id,to:'n2',type:'precedes'}];
  mustFail(()=>review(g,input(g,b)),'CANDIDATE_EDGE_INVALID');
  b[0].edges=[{id:'link',from:b[0].nodes[0].id,to:b[1].nodes[0].id,type:'precedes'}];
  mustFail(()=>review(g,input(g,b)),'CANDIDATE_EDGE_INVALID');
});
test('no generated payload can inject status, parent, ownership or extra metadata',()=>{
  for(const property of ['status','workspaceId','parent','manualFieldIds']){
    const g=graph(),b=variants(1);b[0].nodes[0][property]=property==='status'?'approved':'spoof';
    mustFail(()=>review(g,input(g,b)),'CANDIDATE_NODE_INVALID');
  }
});
test('invalid relationship type or injected edge properties cannot pass staging',()=>{
  const g=graph(),b=variants(2);b[1].edges[0].type='unknown';
  mustFail(()=>review(g,input(g,b)),'CANDIDATE_EDGE_INVALID');
  b[1].edges[0].type='precedes';b[1].edges[0].workspaceId='evil';
  mustFail(()=>review(g,input(g,b)),'CANDIDATE_EDGE_INVALID');
});
test('stale note text, context links or proposed alternatives invalidate reviewed preview',()=>{
  const g=graph(),o=input(g),p=review(g,o);
  for(const modify of [x=>{x.gapNotes[0].text+=' Новая просьба'},x=>{x.gapLinks.push({id:'gl2',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'n1'}})}]){
    const changed=clone(g);modify(changed);
    mustFail(()=>applyStageNoteAlternatives(changed,{...o,expectedPreview:p,expectedRevision:7}),'PREVIEW_STALE');
  }
  const b=variants();b[0].nodes[0].title='Подменённый вариант';
  mustFail(()=>applyStageNoteAlternatives(g,{...input(g,b),expectedPreview:p,expectedRevision:7}),'PREVIEW_STALE');
});
test('missing author review or stale local revision reject with zero side effects',()=>{
  const g=graph(),before=clone(g),o=input(g);
  mustFail(()=>applyStageNoteAlternatives(g,{...o,expectedRevision:7}),'PREVIEW_REQUIRED');
  mustFail(()=>applyStageNoteAlternatives(g,{...o,expectedPreview:review(g,o),expectedRevision:8}),'REVISION_CONFLICT');
  assert.deepEqual(g,before);
});
test('empty, nonpending, and nonexistent notes are not staging sources',()=>{
  for(const edit of [g=>{g.gapNotes[0].text='   '},g=>{g.gapNotes[0].status='done'},g=>{g.gapNotes=[]}]){
    const g=graph();edit(g);mustFail(()=>review(g,input(g)),g.gapNotes.length?'NOTE_NOT_READY':'NOTE_NOT_FOUND');
  }
});
test('technical capacity limits are explicit, independent of a fixed variant count',()=>{
  const g=graph();
  mustFail(()=>review(g,input(g,[])),'BRANCHES_INVALID');
  mustFail(()=>review(g,input(g,variants(33))),'BRANCHES_INVALID');
  const huge=[branch('large',10,10,257)];
  mustFail(()=>review(g,input(g,huge)),'PROPOSAL_TOO_LARGE');
});
test('valid one-shot staging survives JSON serialization without retaining the source task',()=>{
  const g=stage(graph()).graph,loaded=JSON.parse(JSON.stringify(g));
  assert.doesNotThrow(()=>validateGraph(loaded));
  assert.doesNotThrow(()=>validateCreativeWorkflowGraph(loaded));
  assert.deepEqual(loaded.gapNotes,[]);
  assert.deepEqual(loaded.gapLinks,[]);
  assert.equal(loaded.workspaces[0].taskId,'gn1');
});
test('an ambiguous note relationship alone never starts a canonical replacement',()=>{
  const g=stage(graph()).graph;
  assert.equal((g.replacements??[]).length,0);
  assert.deepEqual(canonicalProjection(g).edges.map(e=>e.id),['e1','e2']);
});

test('one-shot cleanup does not remove unrelated pending notes or their links',()=>{
 const g=graph();
 g.gapNotes.push({id:'gn2',title:'Later',text:'Independent task',x:200,y:400,status:'pending'});
 g.gapLinks.push({id:'gl2',from:{kind:'gap_note',id:'gn2'},to:{kind:'plot_node',id:'n3'}});
 const original=clone(g),plan=review(g),result=stage(g);
 assert.deepEqual(plan.removeSourceLinkIds,['gl1']);
 assert.deepEqual(result.graph.gapNotes,[original.gapNotes[1]]);
 assert.deepEqual(result.graph.gapLinks,[original.gapLinks[1]]);
 assert.deepEqual(result.graph.nodes.slice(0,3),original.nodes);
 assert.deepEqual(result.graph.edges.slice(0,2),original.edges);
 assert.deepEqual(g,original);
});
