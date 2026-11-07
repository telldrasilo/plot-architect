import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGraph,packageProject,unpackProject} from '../src/graph_contract.mjs';
import {canonicalProjection} from '../src/creative_workflow_contract.mjs';
import {canonicalReadGraph,assertOrdinaryGraphWrite} from '../src/creative_workflow_server_boundary.mjs';

const fixture=()=>({
 version:1,revision:0,nextNode:2,nextEdge:1,nextField:2,nextLine:2,view:null,
 nodes:[{id:'n1',title:'Синтетическая сцена',description:'',x:120,y:100,size:'normal',
   parent:null,status:'approved',lineIds:['l1'],manualFieldIds:[],manualTags:[],autoFieldIds:[]}],
 edges:[],fields:[{id:'f1',title:'Место',comment:'',x:0,y:0,width:600,height:400,
  color:'#b8a16e',parent:null,assignmentMode:'auto'}],
 lanes:[{id:'l1',title:'Линия',y:200,color:'#b8a16e'}],
 canvasTexts:[{id:'ct-1',x:150,y:500,width:450,parent:null,blocks:[
  {type:'heading',runs:[{text:'Тест 01'}]},
  {type:'paragraph',runs:[{text:'Нажмите на '},{text:'B',italic:true}]},
  {type:'quote',runs:[{text:'Не менять сюжет',underline:true}]}
 ]}]
});
test('single-JSON annotation survives validation, export and import without changing semantics',()=>{
 const graph=validateGraph(fixture());
 assert.deepEqual(unpackProject(packageProject('Синтетика',graph)).graph.canvasTexts,fixture().canvasTexts);
 assert.deepEqual(canonicalProjection(graph).nodes.map(n=>n.id),['n1']);
 assert.ok(!Object.hasOwn(canonicalProjection(graph),'canvasTexts'));
 assert.ok(!Object.hasOwn(canonicalReadGraph(graph),'canvasTexts'));
});
test('generic write updates text but cannot cause plot node or edge changes implicitly',()=>{
 const old=fixture(),updated=structuredClone(old);
 updated.canvasTexts[0].blocks[1].runs[0].text='Нажмите позже';
 updated.canvasTexts[0].x=230;
 const result=assertOrdinaryGraphWrite(old,updated);
 assert.deepEqual(result.nodes,validateGraph(old).nodes);
 assert.deepEqual(result.edges,[]);
 assert.equal(result.canvasTexts[0].x,230);
});
test('malformed annotation rejected in ordinary server write',()=>{
 const old=fixture(),updated=structuredClone(old);
 updated.canvasTexts[0].blocks[0].runs[0].click='alert(1)';
 assert.throws(()=>assertOrdinaryGraphWrite(old,updated),/CANVAS_TEXT_INVALID/);
});
