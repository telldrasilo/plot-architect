import test from 'node:test';
import assert from 'node:assert/strict';
import {getSavedDraftIterationContext} from '../src/creative_workflow_draft_iteration_context.mjs';

const graph=()=>{
 const nodes=[
  {id:'A',title:'Канон: закрытая тайна',description:'Секреты',x:0,y:0},
  {id:'B',title:'Канон: граница',x:200,y:0},
  {id:'y',title:'Исходный Y',description:'Нужно доработать мотив',x:30,y:200,workspaceId:'w1',draftBranchId:'g1'},
  {id:'z',title:'Соседний Z',description:'Ближайшая связь',x:250,y:200,workspaceId:'w1',draftBranchId:'g1'},
  {id:'u',title:'Чужая альтернатива',description:'Скрытый черновик',x:470,y:200,workspaceId:'w1',draftBranchId:'g2'},
  {id:'x',title:'Стороннее задание',description:'Не показывать',x:800,y:200,workspaceId:'w2',draftBranchId:'g3'}
 ];
 return {
  version:1,revision:4,view:null,nodes,
  edges:[
   {id:'canon',from:'A',to:'B',type:'causes'},
   {id:'yz',from:'y',to:'z',type:'precedes',workspaceId:'w1',draftRelation:'internal'},
   {id:'zu',from:'z',to:'u',type:'hinders',workspaceId:'w1',draftRelation:'internal'},
   {id:'ya',from:'y',to:'A',type:'enables',workspaceId:'w1',draftRelation:'boundary-proposal'}
  ],
  fields:[],lanes:[],workspaces:[
   {id:'w1',taskId:'old-task-consumed',x:0,y:150,width:740,height:350},
   {id:'w2',taskId:'unrelated-task',x:790,y:150,width:350,height:350}
  ],
  gapNotes:[],replacementPreparations:[]
 };
};
const reject=(fn,code)=>assert.throws(fn,e=>e?.code===code);

test('P1 context shows only explicitly selected saved Y, with no canon or other drafts',()=>{
 const before=graph(),snapshot=structuredClone(before);
 const r=getSavedDraftIterationContext(before,{workspaceId:'w1',nodeIds:['y']});
 assert.equal(r.revision,4);
 assert.deepEqual(r.scope,{workspaceId:'w1',sourceNodeIds:['y']});
 assert.deepEqual(r.sourceDrafts.map(n=>n.id),['y']);
 assert.deepEqual(r.sameWorkspaceNeighbors,[]);
 assert.deepEqual(r.internalRelations,[]);
 assert.equal(r.editorialBoundaryRelationCount,1);
 assert.equal(JSON.stringify(r).includes('Секреты'),false);
 assert.equal(JSON.stringify(r).includes('Не показывать'),false);
 assert.equal(JSON.stringify(r).includes('Скрытый черновик'),false);
 assert.deepEqual(before,snapshot);
 assert.equal(before.gapNotes.length,0);
});
test('P1 optional one-hop context is bounded and never expands across other branches/projects',()=>{
 const r=getSavedDraftIterationContext(graph(),{workspaceId:'w1',nodeIds:['y'],neighbors:true});
 assert.deepEqual(r.sameWorkspaceNeighbors.map(n=>n.id),['z']);
 assert.deepEqual(r.internalRelations.map(e=>e.id),['yz']);
 assert.equal(JSON.stringify(r).includes('Скрытый черновик'),false);
 assert.equal(JSON.stringify(r).includes('Стороннее задание'),false);
 assert.equal(JSON.stringify(r).includes('Канон: закрытая тайна'),false);
});
test('P1 rejects nonexistent workspaces, foreign/canonical IDs and repeated or oversized selections',()=>{
 const g=graph();
 reject(()=>getSavedDraftIterationContext(g,{workspaceId:'w9',nodeIds:['y']}),'DRAFT_ITERATION_WORKSPACE_INVALID');
 reject(()=>getSavedDraftIterationContext(g,{workspaceId:'w1',nodeIds:['x']}),'DRAFT_ITERATION_NOT_OWNED');
 reject(()=>getSavedDraftIterationContext(g,{workspaceId:'w1',nodeIds:['A']}),'DRAFT_ITERATION_NOT_OWNED');
 reject(()=>getSavedDraftIterationContext(g,{workspaceId:'w1',nodeIds:['y','y']}),'DRAFT_ITERATION_SELECTION_INVALID');
 reject(()=>getSavedDraftIterationContext(g,{workspaceId:'w1',nodeIds:[],neighbors:true}),'DRAFT_ITERATION_SELECTION_INVALID');
 reject(()=>getSavedDraftIterationContext(g,{workspaceId:'w1',nodeIds:['y'],neighbors:'yes'}),'DRAFT_ITERATION_SELECTION_INVALID');
});
test('P1 source cannot be silently replaced by note recreation',()=>{
 const g=graph(),before=JSON.stringify(g);
 const r=getSavedDraftIterationContext(g,{workspaceId:'w1',nodeIds:['y']});
 assert.equal(r.requiredOutput.safety.includes('не заменять'),true);
 assert.equal(JSON.stringify(g),before);
 assert.equal(g.workspaces[0].taskId,'old-task-consumed');
});
