import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDraftAcceptance,canonicalProjection,previewDraftAcceptance,validateCreativeWorkflowGraph} from '../src/creative_workflow_contract.mjs';
const clone=x=>structuredClone(x);
function story(){return {version:1,revision:7,view:null,nodes:[{id:'n1',title:'Начало',x:10,y:10,status:'proposed'},{id:'n2',title:'Находка',x:350,y:10},{id:'n3',title:'Последствие',x:700,y:10},{id:'a',title:'Уходит',x:10,y:250,workspaceId:'w1',status:'proposed'},{id:'b',title:'Падает',x:350,y:250,workspaceId:'w1'},{id:'c',title:'Находит',x:700,y:250,workspaceId:'w1'}],edges:[{id:'e1',from:'n1',to:'n2',type:'precedes'},{id:'e2',from:'n2',to:'n3',type:'causes'},{id:'ea',from:'a',to:'b',type:'precedes',workspaceId:'w1',draftRelation:'internal'},{id:'eb',from:'b',to:'c',type:'precedes',workspaceId:'w1',draftRelation:'internal'},{id:'ep',from:'n1',to:'a',type:'causes',workspaceId:'w1',draftRelation:'boundary-proposal'}],fields:[],lanes:[],workspaces:[{id:'w1',taskId:'task1',x:0,y:200,width:950,height:210}]}}
function ids(arr){return arr.map(x=>x.id)}
test('accepting a/b preserves original graph and IDs, and promotes only internal a-b',()=>{
 const source=story(),original=clone(source),plan=previewDraftAcceptance(source,{workspaceId:'w1',nodeIds:['a','b']});
 const {graph:g,changes}=applyDraftAcceptance(source,{workspaceId:'w1',nodeIds:['a','b'],expectedPreview:plan,expectedRevision:7});
 assert.deepEqual(source,original);assert.deepEqual(changes,plan);assert.deepEqual(ids(canonicalProjection(g).nodes),['n1','n2','n3','a','b']);
 assert.deepEqual(ids(canonicalProjection(g).edges),['e1','e2','ea']);assert.equal(g.nodes.find(n=>n.id==='a').x,10);
 assert.equal(g.nodes.find(n=>n.id==='b').status,undefined);
 assert.equal(g.edges.find(e=>e.id==='ea').workspaceId,undefined);assert.equal(g.nodes.find(n=>n.id==='c').workspaceId,'w1');
 assert.equal(g.edges.find(e=>e.id==='ep').draftRelation,'boundary-proposal');assert.equal(g.edges.find(e=>e.id==='eb').workspaceId,'w1');
 assert.equal(g.revision,7,'pure transformer never claims a durable revision increment');
});
test('final acceptance must resolve pending boundary proposals before removing frame',()=>{
 const first=applyDraftAcceptance(story(),{workspaceId:'w1',nodeIds:['a','b']}).graph;
 const before=clone(first);
 assert.throws(()=>applyDraftAcceptance(first,{workspaceId:'w1',nodeIds:['c']}),
  e=>e.code==='WORKSPACE_UNRESOLVED_RELATIONS'&&e.message.includes('ep'));
 assert.deepEqual(first,before,'blocked action never mutates source');
 // An independent guarded drop_boundary_relation command has discarded ep.
 const resolved=clone(first);resolved.edges=resolved.edges.filter(e=>e.id!=='ep');
 const preview=previewDraftAcceptance(resolved,{workspaceId:'w1',nodeIds:['c']});
 assert.equal(preview.removeWorkspace,true);
 assert.deepEqual(preview.removeGapLinkIds,[]);
 const second=applyDraftAcceptance(resolved,{workspaceId:'w1',nodeIds:['c'],
  expectedPreview:preview}).graph;
 assert.deepEqual(ids(canonicalProjection(second).edges),['e1','e2','ea','eb']);
 assert.equal(second.workspaces.length,0,'no empty frame after final acceptance');
 assert.equal(second.edges.some(e=>e.workspaceId==='w1'),false);
});
test('accepting a first leaves a-b internal; accepting b later promotes it',()=>{
 const first=applyDraftAcceptance(story(),{workspaceId:'w1',nodeIds:['a']}).graph;
 assert.deepEqual(ids(canonicalProjection(first).edges),['e1','e2']);
 assert.equal(first.edges.find(e=>e.id==='ea').draftRelation,'internal');
 const second=applyDraftAcceptance(first,{workspaceId:'w1',nodeIds:['b']}).graph;
 assert.deepEqual(ids(canonicalProjection(second).edges),['e1','e2','ea']);
});
test('accept c first, then a and b; no implicit disposal of external proposal',()=>{
 const first=applyDraftAcceptance(story(),{workspaceId:'w1',nodeIds:['c']}).graph;
 assert.deepEqual(ids(canonicalProjection(first).edges),['e1','e2']);
 assert.throws(()=>applyDraftAcceptance(first,{workspaceId:'w1',nodeIds:['a','b']}),
  e=>e.code==='WORKSPACE_UNRESOLVED_RELATIONS');
 const resolved=clone(first);resolved.edges=resolved.edges.filter(e=>e.id!=='ep');
 const second=applyDraftAcceptance(resolved,{workspaceId:'w1',nodeIds:['a','b']}).graph;
 assert.deepEqual(ids(canonicalProjection(second).edges),['e1','e2','ea','eb']);
 assert.equal(second.workspaces.length,0);
});
test('invalid revision aborts with no side effects',()=>{
 const g=story(),before=clone(g);
 assert.throws(()=>applyDraftAcceptance(g,{workspaceId:'w1',nodeIds:['a'],expectedRevision:6}),e=>e.code==='REVISION_CONFLICT');
 assert.deepEqual(g,before);
});
test('stale preview rejects with no partial changes',()=>{
 const g=story(),before=clone(g),preview=previewDraftAcceptance(g,{workspaceId:'w1',nodeIds:['a']});
 preview.promoteEdgeIds.push('e1');
 assert.throws(()=>applyDraftAcceptance(g,{workspaceId:'w1',nodeIds:['a'],expectedPreview:preview}),e=>e.code==='PREVIEW_STALE');
 assert.deepEqual(g,before);
});
test('cannot accept a node already in canon, unknown, duplicate or from another area',()=>{
 const g=story(),before=clone(g);g.workspaces.push({id:'w2',x:0,y:800,width:100,height:100});g.nodes.push({id:'z',title:'Другой',workspaceId:'w2',x:10,y:800});
 for(const bad of [['n1'],['missing'],['a','a'],['a','z'],[]])assert.throws(()=>applyDraftAcceptance(g,{workspaceId:'w1',nodeIds:bad}),e=>e.code==='SELECTION_INVALID');
 assert.deepEqual(g.nodes.slice(0,before.nodes.length),before.nodes);
});
test('final acceptance removes only its workspace, not the other area',()=>{
 const g=story();g.workspaces.push({id:'w2',x:0,y:700,width:150,height:150});g.nodes.push({id:'z',title:'Другой',workspaceId:'w2',x:10,y:800});
 g.edges=g.edges.filter(e=>e.id!=='ep');
 const {graph:next}=applyDraftAcceptance(g,{workspaceId:'w1',nodeIds:['a','b','c']});
 assert.equal(next.nodes.find(n=>n.id==='z').workspaceId,'w2');
 assert.equal(canonicalProjection(next).nodes.some(n=>n.id==='z'),false);
 assert.deepEqual(next.workspaces,[g.workspaces[1]]);
});
test('partial acceptance never changes a suspended original or its old edges',()=>{
 const g=story();g.replacements=[{id:'r1',state:'open',sourceNodeIds:['n2'],suspendedEdgeIds:['e1','e2']}];
 const {graph:next}=applyDraftAcceptance(g,{workspaceId:'w1',nodeIds:['a','b']});
 assert.deepEqual(ids(canonicalProjection(next).nodes),['n1','n3','a','b']);
 assert.deepEqual(ids(canonicalProjection(next).edges),['ea']);
 assert.deepEqual(next.replacements,g.replacements);assert.deepEqual(next.edges.slice(0,2),g.edges.slice(0,2));
});
test('result validates against workflow contract and survives JSON serialization',()=>{
 const {graph:g}=applyDraftAcceptance(story(),{workspaceId:'w1',nodeIds:['a','b']});
 assert.doesNotThrow(()=>validateCreativeWorkflowGraph(g));const loaded=JSON.parse(JSON.stringify(g));assert.doesNotThrow(()=>validateCreativeWorkflowGraph(loaded));
 assert.deepEqual(ids(canonicalProjection(g).nodes),['n1','n2','n3','a','b']);
});
test('non-consecutive selections preserve order, content, colors and scene geometry',()=>{
 const g=story();g.nodes.find(n=>n.id==='c').color='#b8a16e';g.nodes.find(n=>n.id==='a').description='Задумал побег';
 const accepted=applyDraftAcceptance(g,{workspaceId:'w1',nodeIds:['c','a']}).graph;
 assert.deepEqual(ids(canonicalProjection(accepted).nodes),['n1','n2','n3','a','c']);
 assert.equal(accepted.nodes.find(n=>n.id==='a').description,'Задумал побег');assert.equal(accepted.nodes.find(n=>n.id==='c').color,'#b8a16e');
 assert.equal(accepted.nodes.find(n=>n.id==='a').y,250);
});
test('unrelated canonical arrow is not retargeted or duplicated',()=>{
 const g=story(),next=applyDraftAcceptance(g,{workspaceId:'w1',nodeIds:['a','b']}).graph;
 assert.deepEqual(next.edges.slice(0,2),g.edges.slice(0,2));
 assert.equal(next.edges.filter(e=>e.from==='n1'&&e.to==='n2').length,1);
});

test('partial acceptance retains cross-boundary arrow ID, orientation, semantic type and ownership',()=>{
 const input=story(),baseline=clone(input);
 const {graph:after}=applyDraftAcceptance(input,{
  workspaceId:'w1',nodeIds:['a','b'],expectedRevision:7,
  expectedPreview:previewDraftAcceptance(input,{workspaceId:'w1',nodeIds:['a','b']})
 });
 const pending=after.edges.find(e=>e.id==='eb');
 assert.deepEqual(pending,baseline.edges.find(e=>e.id==='eb'));
 assert.equal(after.nodes.find(n=>n.id==='b').workspaceId,undefined);
 assert.equal(after.nodes.find(n=>n.id==='c').workspaceId,'w1');
 assert.equal(pending.from,'b');assert.equal(pending.to,'c');
 assert.equal(pending.type,'precedes');
 assert.equal(pending.draftRelation,'internal');
 assert.equal(pending.workspaceId,'w1');
 assert.equal(canonicalProjection(after).edges.some(e=>e.id==='eb'),false);
 assert.deepEqual(input,baseline);
 assert.doesNotThrow(()=>validateCreativeWorkflowGraph(JSON.parse(JSON.stringify(after))));
});
test('canon-to-canon proposal remains editorial while a draft still exists',()=>{
 const input=story();
 const {graph:after}=applyDraftAcceptance(input,{workspaceId:'w1',nodeIds:['a','b']});
 const proposed=after.edges.find(e=>e.id==='ep');
 assert.equal(proposed.from,'n1');assert.equal(proposed.to,'a');
 assert.equal(proposed.workspaceId,'w1');assert.equal(proposed.draftRelation,'boundary-proposal');
 assert.equal(canonicalProjection(after).edges.some(e=>e.id==='ep'),false);
 assert.doesNotThrow(()=>validateCreativeWorkflowGraph(after));
});
test('final acceptance atomically removes stale legacy note and its editorial links',()=>{
 const input=story();input.edges=input.edges.filter(e=>e.id!=='ep');
 input.gapNotes=[{id:'task1',title:'Old task',text:'Processed',x:8,y:40,status:'pending'}];
 input.gapLinks=[{id:'old-link',from:{kind:'gap_note',id:'task1'},
  to:{kind:'plot_node',id:'n1'}}];
 const baseline=clone(input);
 const p=previewDraftAcceptance(input,{workspaceId:'w1',nodeIds:['a','b','c']});
 assert.equal(p.removeWorkspace,true);
 assert.equal(p.removeNoteId,'task1');
 assert.deepEqual(p.removeGapLinkIds,['old-link']);
 const result=applyDraftAcceptance(input,{workspaceId:'w1',nodeIds:['a','b','c'],
  expectedRevision:7,expectedPreview:p});
 assert.deepEqual(result.graph.workspaces,[]);
 assert.deepEqual(result.graph.gapNotes,[]);
 assert.deepEqual(result.graph.gapLinks,[]);
 assert.deepEqual(ids(canonicalProjection(result.graph).edges),['e1','e2','ea','eb']);
 assert.deepEqual(input,baseline);
 assert.doesNotThrow(()=>validateCreativeWorkflowGraph(result.graph));
});
test('shared task source prevents destructive final-area cleanup',()=>{
 const input=story();input.edges=input.edges.filter(e=>e.id!=='ep');
 input.workspaces.push({id:'w2',taskId:'task1',x:1600,y:140,width:300,height:200});
 input.nodes.push({id:'foreign',title:'Other',x:1700,y:160,workspaceId:'w2'});
 const before=clone(input);
 assert.throws(()=>previewDraftAcceptance(input,{workspaceId:'w1',nodeIds:['a','b','c']}),
  e=>e.code==='WORKSPACE_SOURCE_SHARED');
 assert.deepEqual(input,before);
});
