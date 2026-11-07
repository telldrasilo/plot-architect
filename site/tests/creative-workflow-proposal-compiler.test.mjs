import test from 'node:test';
import assert from 'node:assert/strict';
import {validateServerGraph} from '../src/creative_workflow_server_boundary.mjs';
import {canonicalProjection} from '../src/creative_workflow_contract.mjs';
import {previewStageNoteAlternatives,applyStageNoteAlternatives} from '../src/creative_workflow_note_staging.mjs';
import {CREATIVE_STRUCTURE_GUIDANCE,compileNoteProposal} from '../src/creative_workflow_proposal_compiler.mjs';

const clone=x=>structuredClone(x),fail=(f,code)=>assert.throws(f,e=>e?.code===code);
function graph(){
 return validateServerGraph({
  version:1,revision:7,view:null,
  nodes:[
   {id:'n1',title:'Исходный факт',description:'Факт остаётся',x:0,y:0,parent:null},
   {id:'n2',title:'Исходная сцена',description:'Нельзя перемещать',x:240,y:0,parent:null},
   {id:'n3',title:'Следствие',description:'Известно',x:480,y:0,parent:null}
  ],
  edges:[{id:'e1',from:'n1',to:'n2',type:'precedes'},
         {id:'e2',from:'n2',to:'n3',type:'causes'}],
  fields:[],lanes:[],
  gapNotes:[{id:'gn1',title:'Заметка',text:'Придумай здесь неожиданную фишку',status:'pending',x:180,y:420,parent:null},
            {id:'gn2',title:'Другая заметка',text:'Другое задание',status:'pending',x:180,y:730,parent:null}],
  gapLinks:[{id:'gl1',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'n2'}}],
  workspaces:[{id:'w0',taskId:'gn2',x:160,y:850,width:1200,height:500}]
 });
}
const event=(key,title='Сюжетный блок',description='Краткое содержание')=>({key,title,description});
const single=(count=1)=>({
 kind:'single',groups:[{
  title:'Одна идея',events:Array.from({length:count},(_,j)=>event('s'+j)),
  relations:Array.from({length:count-1},(_,j)=>({from:'s'+j,to:'s'+(j+1),type:'precedes'}))
 }]
});
const alternatives=(counts=[1,3,2,1])=>({
 kind:'alternatives',groups:counts.map((count,i)=>({
  title:'Подход '+(i+1),
  events:Array.from({length:count},(_,j)=>event('e'+j,'Блок '+(i+1)+'.'+(j+1))),
  relations:Array.from({length:count-1},(_,j)=>({from:'e'+j,to:'e'+(j+1),type:'causes'}))
 }))
});
const compile=(g,proposal,id='reqStable0123')=>compileNoteProposal(g,{noteId:'gn1',generationId:id,proposal});
test('one creative idea is one block, not three imposed alternatives',()=>{
 const g=graph(),old=clone(g),result=compile(g,single(1));
 assert.deepEqual(result.shape,{kind:'single',groupCount:1,nodeCount:1,edgeCount:0});
 assert.equal(result.command.branches.length,1);
 assert.equal(result.command.branches[0].nodes.length,1);
 assert.equal(result.command.branches[0].edges.length,0);
 assert.deepEqual(g,old);
});
test('single event is placed beside its source note, not down the multi-branch spiral',()=>{
 const g=graph(),old=clone(g),note=g.gapNotes[0];
 const result=compile(g,single(1)),area=result.command.workspace;
 assert.equal(area.x,note.x+272+60);
 assert.equal(area.y,note.y);
 assert.equal(result.command.branches[0].nodes[0].x,area.x+36);
 assert.equal(result.command.branches[0].nodes[0].y,area.y+48);
 assert.deepEqual(g,old,'compilation cannot move the source note or canonical neighbors');
 const preview=previewStageNoteAlternatives(g,result.command);
 const staged=applyStageNoteAlternatives(g,{...result.command,
  expectedPreview:preview,expectedRevision:g.revision});
 assert.deepEqual(canonicalProjection(staged.graph),canonicalProjection(g));
});
test('blocked adjacent side selects another nearby position without moving canon',()=>{
 const g=graph(),note=g.gapNotes[0];
 g.nodes.push({id:'block-right',title:'Сосед',description:'Занимает место справа',
  x:note.x+332,y:note.y,parent:null});
 const old=clone(g),area=compile(g,single(1)).command.workspace;
 assert.equal(area.x,note.x-280-60,'right and bottom occupied, use left side');
 assert.equal(area.y,note.y);
 assert.deepEqual(g,old);
});
test('clamped long task keeps a single draft close to its compact note',()=>{
 const text='Подготовить содержательное событие со множеством ограничений и пояснений. '.repeat(8);
 const g=validateServerGraph({version:1,revision:5,view:null,nodes:[
  {id:'right',title:'Сосед справа',description:'Занято',x:900,y:500,parent:null},
  {id:'left',title:'Сосед слева',description:'Занято',x:180,y:500,parent:null}
 ],edges:[],fields:[],lanes:[],gapNotes:[
  {id:'gn1',title:'Заметка',text,status:'pending',x:500,y:500,parent:null}
 ]});
 // The right/left blockers are positioned directly at the one-card candidates.
 const note=g.gapNotes[0],area=compile(g,single(1)).command.workspace;
 assert.equal(area.x,note.x,'place lone event under the long note');
 assert.ok(area.y>=note.y+210,'leave vertical space for the rendered note');
 assert.ok(area.y<note.y+300,'a four-line card must not reserve the full hidden task height');
});
test('a custom two-line title reserves extra space below the same task',()=>{
 const g=validateServerGraph({version:1,revision:5,view:null,nodes:[
  {id:'right',title:'Занято справа',description:'',x:900,y:500,parent:null},
  {id:'left',title:'Занято слева',description:'',x:180,y:500,parent:null}
 ],edges:[],fields:[],lanes:[],gapNotes:[
  {id:'gn1',title:'Заметка',text:'Длинное предложение с ограничениями. '.repeat(15),
   status:'pending',x:500,y:500,parent:null}
 ]});
 const basic=compile(g,single(1)).command.workspace;
 const custom=clone(g);
 custom.gapNotes[0].title='Авторский заголовок с длинным уточнением и важными деталями';
 const named=compile(custom,single(1)).command.workspace;
 assert.equal(named.x,basic.x);
 assert.ok(named.y>basic.y,'custom title must not collide with the staged workspace');
 assert.deepEqual(g.nodes,custom.nodes,'the plot is never moved for note placement');
});

test('world translation keeps the single-card placement relative to its note',()=>{
 const g=graph(),first=compile(g,single(1)).command.workspace;
 const moved=clone(g),dx=1250,dy=920;
 for(const n of [...moved.nodes,...moved.gapNotes,...moved.workspaces]){
  n.x+=dx;n.y+=dy;
 }
 const second=compile(moved,single(1)).command.workspace;
 assert.deepEqual([second.x-first.x,second.y-first.y],[dx,dy]);
});

test('one idea may contain multiple linked blocks and remain one proposal',()=>{
 const result=compile(graph(),single(3));
 assert.deepEqual(result.shape,{kind:'single',groupCount:1,nodeCount:3,edgeCount:2});
 const nodes=result.command.branches[0].nodes;
 assert.equal(nodes.length,3);
 assert.equal(result.command.branches[0].edges[0].from,nodes[0].id);
});
test('four alternatives have independent lengths [1,3,2,1] and typed internal arrows',()=>{
 const result=compile(graph(),alternatives());
 assert.deepEqual(result.command.branches.map(b=>b.nodes.length),[1,3,2,1]);
 assert.deepEqual(result.command.branches.map(b=>b.edges.length),[0,2,1,0]);
 assert.equal(result.shape.nodeCount,7);
 assert.equal(result.shape.edgeCount,3);
 assert.equal(new Set(result.command.branches.flatMap(b=>b.nodes.map(n=>n.id))).size,7);
});
test('model chooses creative shape; compiler cannot silently shorten long branches',()=>{
 const result=compile(graph(),alternatives([7,1,5]));
 assert.deepEqual(result.command.branches.map(b=>b.nodes.length),[7,1,5]);
 assert.equal(result.shape.nodeCount,13);
});
test('stable generation identifier yields exact command for safe replay',()=>{
 const g=graph(),proposal=alternatives([1,2]);
 assert.deepEqual(compile(g,proposal).command,compile(g,proposal).command);
 assert.notEqual(compile(g,proposal).command.workspaceId,compile(g,proposal,'anotherSeed123').command.workspaceId);
});
test('candidate working area avoids existing plot, notes and old workspace',()=>{
 const g=graph(),result=compile(g,alternatives([2,3]));
 const area=result.command.workspace;
 const hit=(a,b)=>a.x<b.x+b.width+28&&a.x+a.width+28>b.x
   &&a.y<b.y+b.height+28&&a.y+a.height+28>b.y;
 for(const old of [
  ...g.nodes.map(n=>({x:n.x,y:n.y,width:270,height:220})),
  ...g.gapNotes.map(n=>({x:n.x,y:n.y,width:272,height:158})),
  ...g.workspaces.map(w=>({x:w.x,y:w.y,width:w.width,height:w.height}))
 ])assert.equal(hit(area,old),false);
 for(const b of result.command.branches)for(const n of b.nodes){
  assert.ok(n.x>=area.x&&n.y>=area.y);
  assert.ok(n.x+208<=area.x+area.width);
  assert.ok(n.y+132<=area.y+area.height);
 }
});
test('review and stage remain canonical no-ops until an explicit apply',()=>{
 const g=graph(),original=clone(g),compiled=compile(g,alternatives([1,2,3]));
 const preview=previewStageNoteAlternatives(g,compiled.command);
 assert.equal(preview.proposedNodes.length,6);
 assert.deepEqual(g,original);
 const saved=applyStageNoteAlternatives(g,{...compiled.command,expectedPreview:preview,expectedRevision:g.revision});
 assert.deepEqual(canonicalProjection(saved.graph),canonicalProjection(g));
 assert.deepEqual(saved.graph.gapNotes,g.gapNotes.filter(n=>n.id!=='gn1'));
 assert.equal(saved.graph.gapNotes[0].id,'gn2','unrelated pending task survives');
 assert.deepEqual(saved.graph.gapLinks,[]);
 assert.equal(saved.changes.removedNoteId,'gn1');
 assert.deepEqual(saved.graph.nodes.slice(0,g.nodes.length),g.nodes);
 assert.deepEqual(saved.graph.edges.slice(0,g.edges.length),g.edges);
 assert.equal(saved.changes.stagedNodeIds.length,6);
});
test('same generation is not staged twice for one note',()=>{
 const g=graph(),compiled=compile(g,single(1));
 const preview=previewStageNoteAlternatives(g,compiled.command);
 const saved=applyStageNoteAlternatives(g,{...compiled.command,expectedPreview:preview}).graph;
 fail(()=>compile(saved,single(1)),'NOTE_NOT_FOUND');
});
test('unknown injected fields and cross-group references are rejected',()=>{
 const g=graph();
 const malicious={...single(1),hidden:true};
 fail(()=>compile(g,malicious),'PROPOSAL_INVALID');
 const unsafe=single(1);unsafe.groups[0].events[0].status='approved';
 fail(()=>compile(g,unsafe),'EVENT_INVALID');
 const bad=single(2);bad.groups[0].relations[0].to='canonicalN2';
 fail(()=>compile(g,bad),'RELATION_INVALID');
 const duplicates=single(2);duplicates.groups[0].events[1].key='s0';
 fail(()=>compile(g,duplicates),'EVENT_INVALID');
});
test('semantically invalid group-count claims fail without forcing three branches',()=>{
 const g=graph();
 const mismatch=single(1);mismatch.kind='alternatives';
 fail(()=>compile(g,mismatch),'PROPOSAL_INVALID');
 const mismatch2=alternatives([1,1]);mismatch2.kind='single';
 fail(()=>compile(g,mismatch2),'PROPOSAL_INVALID');
});
test('IDs and status are validated; all source graph objects remain untouched',()=>{
 const g=graph(),old=clone(g);
 fail(()=>compileNoteProposal(g,{noteId:'gn1',generationId:'short',proposal:single()}),'PROPOSAL_ID_INVALID');
 fail(()=>compileNoteProposal(g,{noteId:'unknown',generationId:'reqStable0123',proposal:single()}),'NOTE_NOT_FOUND');
 g.gapNotes.find(n=>n.id==='gn1').status='done';
 fail(()=>compile(g,single()),'NOTE_NOT_READY');
 assert.deepEqual(old.nodes,g.nodes);
});
test('guidance actively rejects node/token economy and fixed branch symmetry',()=>{
 assert.match(CREATIVE_STRUCTURE_GUIDANCE,/не сжимай сюжет ради экономии/);
 assert.match(CREATIVE_STRUCTURE_GUIDANCE,/не навязывай три варианта/);
 assert.match(CREATIVE_STRUCTURE_GUIDANCE,/краткий сюжетный блок/);
});
