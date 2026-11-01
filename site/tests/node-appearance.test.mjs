import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGraph,packageProject,unpackProject} from '../src/graph_contract.mjs';
const graph=()=>({version:0.8,revision:0,nodes:[{id:'n1',title:'Набор учеников',description:'',x:20,y:30,parent:null,size:'normal',status:'proposed',lineIds:['l1'],manualFieldIds:[],autoFieldIds:[],manualTags:[]}],edges:[],fields:[],lanes:[{id:'l1',title:'Основная',color:'#b8a16e',y:0}]});
test('new optional node width, height, palette preserve through export/import',()=>{
 const g=graph();g.nodes[0].width=422;g.nodes[0].height=212;g.nodes[0].color='#998ba7';
 const validated=validateGraph(g);assert.equal(validated.nodes[0].width,422);
 const pkg=packageProject('Демо',validated);
 const result=unpackProject(pkg);assert.deepEqual(result.graph.nodes[0],validated.nodes[0]);
});
test('old nodes without appearance fields remain compatible',()=>{
 const x=validateGraph(graph());assert.equal(x.nodes[0].width,undefined);assert.equal(x.nodes[0].color,undefined);
});
test('invalid appearance data rejects without changing the source',()=>{
 for(const patch of [{width:0},{width:99999},{height:20},{color:'#ff00ee'},{width:'220'}]){
  const g=graph();Object.assign(g.nodes[0],patch);const before=structuredClone(g);assert.throws(()=>validateGraph(g));assert.deepEqual(g,before);
 }
});
