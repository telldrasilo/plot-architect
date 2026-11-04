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
test('the second acceptance of c restores original b-c as a plot edge, but not external proposal',()=>{
 const first=applyDraftAcceptance(story(),{workspaceId:'w1',nodeIds:['a','b']}).graph;
 const second=applyDraftAcceptance(first,{workspaceId:'w1',nodeIds:['c']}).graph;
 assert.deepEqual(ids(canonicalProjection(second).edges),['e1','e2','ea','eb']);
 assert.equal(second.edges.find(e=>e.id==='ep').workspaceId,'w1');
 assert.equal(second.edges.find(e=>e.id==='ep').draftRelation,'boundary-proposal');
 assert.equal(second.workspaces.length,1,'workspace retains unresolved editorial relation');
});
test('accepting a first leaves a-b internal; accepting b later promotes it',()=>{
 const first=applyDraftAcceptance(story(),{workspaceId:'w1',nodeIds:['a']}).graph;
 assert.deepEqual(ids(canonicalProjection(first).edges),['e1','e2']);
 assert.equal(first.edges.find(e=>e.id==='ea').draftRelation,'internal');
 const second=applyDraftAcceptance(first,{workspaceId:'w1',nodeIds:['b']}).graph;
 assert.deepEqual(ids(canonicalProjection(second).edges),['e1','e2','ea']);
});
test('accept c first, then a and b; links promote independently of selection order',()=>{
 const first=applyDraftAcceptance(story(),{workspaceId:'w1',nodeIds:['c']}).graph;
 assert.deepEqual(ids(canonicalProjection(first).edges),['e1','e2']);
 const second=applyDraftAcceptance(first,{workspaceId:'w1',nodeIds:['a','b']}).graph;
 assert.deepEqual(ids(canonicalProjection(second).edges),['e1','e2','ea','eb']);
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
test('another area stays isolated and untouched after accepting w1',()=>{
 const g=story();g.workspaces.push({id:'w2',x:0,y:700,width:150,height:150});g.nodes.push({id:'z',title:'Другая версия',workspaceId:'w2',x:10,y:750});
 const {graph:next}=applyDraftAcceptance(g,{workspaceId:'w1',nodeIds:['a','b','c']});
 assert.equal(next.nodes.find(n=>n.id==='z').workspaceId,'w2');assert.equal(canonicalProjection(next).nodes.some(n=>n.id==='z'),false);
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
