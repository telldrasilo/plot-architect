import test from 'node:test';
import assert from 'node:assert/strict';
import {validateServerGraph} from '../src/creative_workflow_server_boundary.mjs';
import {listNoteTasks,getNoteTaskContext} from '../src/creative_workflow_note_context.mjs';

const deep=x=>structuredClone(x),fail=(fn,code)=>assert.throws(fn,e=>e?.code===code);
function graph(){
 return validateServerGraph({
  version:1,revision:7,view:null,
  nodes:[
   {id:'n1',title:'Причина',description:'Установлено',x:0,y:0,parent:null},
   {id:'n2',title:'Конфликт',description:'Причинная точка',x:260,y:0,parent:null},
   {id:'n3',title:'Последствие',description:'Открыто',x:520,y:0,parent:null},
   {id:'n4',title:'Дальняя сцена',description:'Не связана непосредственно',x:780,y:0,parent:null},
   {id:'n9',title:'HIDDEN_UNRELATED',description:'Чужой сюжетный участок',x:0,y:900,parent:null},
   {id:'nret',title:'HIDDEN_RETIRED',description:'Приостановленный оригинал',x:0,y:300,parent:null},
   {id:'draft',title:'HIDDEN_DRAFT',description:'Непринятая альтернатива',x:300,y:700,parent:null,workspaceId:'w0',draftBranchId:'b0'}
  ],
  edges:[
   {id:'e12',from:'n1',to:'n2',type:'causes'},
   {id:'e23',from:'n2',to:'n3',type:'enables'},
   {id:'e34',from:'n3',to:'n4',type:'precedes'},
   {id:'er',from:'nret',to:'n2',type:'causes'}
  ],
  fields:[{id:'f1',title:'Переговоры',comment:'Ограниченное поле',x:0,y:0,width:400,height:400},
          {id:'f2',title:'HIDDEN_OTHER_FIELD',comment:'Не связанное поле',x:500,y:500,width:400,height:400}],
  lanes:[],
  gapNotes:[
   {id:'gn1',title:'Идея конфликта',text:'Придумай здесь неожиданный сюжетный поворот',status:'pending',x:100,y:470,parent:null},
   {id:'gn2',title:'Связанная заметка',text:'Предположения о конфликте',status:'pending',x:400,y:470,parent:null},
   {id:'gn3',title:'HIDDEN_OTHER_NOTE',text:'Секрет другого задания',status:'pending',x:800,y:470,parent:null},
   {id:'gn4',title:'Завершено',text:'Готовый результат',status:'done',x:1100,y:470,parent:null}
  ],
  gapLinks:[
   {id:'g1',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'n2'}},
   {id:'g2',from:{kind:'gap_note',id:'gn1'},to:{kind:'semantic_field',id:'f1'}},
   {id:'g3',from:{kind:'gap_note',id:'gn1'},to:{kind:'gap_note',id:'gn2'}},
   {id:'g4',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'nret'}},
   {id:'g5',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'draft'}}
  ],
  workspaces:[{id:'w0',taskId:'gn3',x:100,y:640,width:650,height:550}],
  replacements:[{id:'r0',state:'open',sourceNodeIds:['nret'],suspendedEdgeIds:['er'],sourceGraphRevision:6}]
 });
}
test('search finds note text/title only and gives compact bounded previews',()=>{
 const original=graph(),snapshot=deep(original);
 const result=listNoteTasks(original,{query:'конфликт'});
 assert.deepEqual(result.notes.map(n=>n.id),['gn1','gn2']);
 assert.equal(result.revision,7);
 assert.equal(result.notes[0].textPreview,'Придумай здесь неожиданный сюжетный поворот');
 assert.equal(result.notes[0].hasWorkspace,false);
 const all=listNoteTasks(original,{status:'all'});
 assert.equal(all.total,4);
 assert.equal(all.notes.find(n=>n.id==='gn3').hasWorkspace,true);
 assert.equal(all.notes.find(n=>n.id==='gn4').status,'done');
 assert.deepEqual(original,snapshot,'read-only projection');
});
test('search pagination reports truncation rather than silently losing notes',()=>{
 const result=listNoteTasks(graph(),{status:'all',limit:2});
 assert.equal(result.notes.length,2);assert.equal(result.total,4);assert.equal(result.truncated,true);
});
test('exact note reads linked context, provenance and one-hop active story only',()=>{
 const g=graph(),response=getNoteTaskContext(g,{noteId:'gn1'});
 assert.deepEqual(response.task,{
  id:'gn1',title:'Идея конфликта',text:'Придумай здесь неожиданный сюжетный поворот',
  status:'pending',hasWorkspace:false
 });
 assert.deepEqual(response.context.linkedStoryNodes.map(n=>n.id),['n1','n2','n3']);
 assert.deepEqual(response.context.activeStoryRelations.map(e=>e.type),['causes','enables']);
 assert.deepEqual(response.context.linkedFields.map(f=>f.id),['f1']);
 assert.deepEqual(response.context.linkedNotes.map(n=>n.id),['gn2']);
 assert.equal(response.context.provenance,'explicit_note_links_and_active_one_hop');
 assert.deepEqual(response.context.truncated,{
  storyNodes:false,storyRelations:false,linkedFields:false,linkedNotes:false
 });
 const str=JSON.stringify(response);
 for(const secret of ['HIDDEN_DRAFT','HIDDEN_RETIRED','HIDDEN_UNRELATED','HIDDEN_OTHER_FIELD','HIDDEN_OTHER_NOTE']){
  assert.ok(!str.includes(secret),'No unrelated or retired text: '+secret);
 }
});
test('neighbors are optional; explicit links alone are sufficient for single note',()=>{
 const response=getNoteTaskContext(graph(),{noteId:'gn1',neighbors:false});
 assert.deepEqual(response.context.linkedStoryNodes.map(n=>n.id),['n2']);
 assert.deepEqual(response.context.activeStoryRelations,[]);
});
test('no geometric proximity adds an unrelated object to a note context',()=>{
 const g=graph();
 // Close the unrelated canonical node to the note without linking it.
 g.nodes.find(n=>n.id==='n9').x=100;g.nodes.find(n=>n.id==='n9').y=460;
 assert.ok(!JSON.stringify(getNoteTaskContext(g,{noteId:'gn1'})).includes('HIDDEN_UNRELATED'));
});
test('full description is bounded; no large unrelated prose is exposed',()=>{
 const g=graph();g.nodes.find(n=>n.id==='n2').description='X'.repeat(5000);
 const response=getNoteTaskContext(g,{noteId:'gn1'});
 assert.equal(response.context.linkedStoryNodes.find(n=>n.id==='n2').description.length,1200);
 assert.ok(JSON.stringify(response).length<15000);
});
test('note already staged in a working area is clearly marked without exposing its contents',()=>{
 const r=getNoteTaskContext(graph(),{noteId:'gn3'});
 assert.equal(r.task.hasWorkspace,true);
 assert.equal(r.context.linkedStoryNodes.length,0);
 assert.equal(r.context.linkedNotes.length,0);
});
test('invalid queries, IDs, ready states and limits fail safely',()=>{
 const g=graph();
 for(const invalid of [{query:3},{query:'x'.repeat(151)},{limit:21},{limit:0},{status:'strange'}])
  fail(()=>listNoteTasks(g,invalid),'NOTE_QUERY_INVALID');
 for(const invalid of [{noteId:''},{noteId:'missing'},{noteId:'gn4'},{noteId:'gn1',neighbors:1}]){
  const code=invalid.noteId==='missing'?'NOTE_NOT_FOUND':invalid.noteId==='gn4'?'NOTE_NOT_READY':'NOTE_QUERY_INVALID';
  fail(()=>getNoteTaskContext(g,invalid),code);
 }
});
test('one-hop context is capped to protect model context costs',()=>{
 const g=graph();
 for(let i=0;i<40;i++){
  const id='extra'+i;
  g.nodes.push({id,title:'Событие '+i,description:'',x:1200+i*30,y:0,parent:null});
  g.edges.push({id:'link'+i,from:'n2',to:id,type:'enables'});
 }
 const r=getNoteTaskContext(g,{noteId:'gn1'});
 assert.equal(r.context.linkedStoryNodes.length,24);
 assert.equal(r.context.truncated.storyNodes,true);
 assert.ok(!JSON.stringify(r).includes('Событие 39'));
});
