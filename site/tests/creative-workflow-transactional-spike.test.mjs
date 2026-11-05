import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {validateGraph} from '../src/graph_contract.mjs';
import {previewDraftAcceptance,previewReplacementStart,canonicalProjection} from '../src/creative_workflow_contract.mjs';
import {previewReplacementReconnection} from '../src/creative_workflow_reconnection.mjs';
import {previewCompleteReplacement,previewCancelReplacement} from '../src/creative_workflow_lifecycle.mjs';
import {previewStageNoteAlternatives} from '../src/creative_workflow_note_staging.mjs';
import {commitSyntheticWorkflowCommand,previewWorkflowCommand} from '../src/creative_workflow_transactional_spike.mjs';

const clone=x=>structuredClone(x);
const fails=async(fn,code)=>await assert.rejects(fn,e=>e?.code===code);
const fixture=()=>({
  revision:0,version:1,view:null,
  nodes:[{id:'n1',title:'Начало',description:'',x:0,y:0},{id:'n2',title:'Поворот',description:'Старый поворот сюжета',x:250,y:0},
    {id:'n3',title:'Следствие',description:'',x:500,y:0},
    ...['a','b','c'].map((id,i)=>({id,title:id,description:'',x:i*210,y:250,workspaceId:'w1'}))],
  edges:[{id:'e1',from:'n1',to:'n2',type:'precedes'},{id:'e2',from:'n2',to:'n3',type:'causes'},
    {id:'ea',from:'a',to:'b',type:'precedes',workspaceId:'w1',draftRelation:'internal'},
    {id:'eb',from:'b',to:'c',type:'precedes',workspaceId:'w1',draftRelation:'internal'}],
  workspaces:[{id:'w1',taskId:'task',x:100,y:200,width:950,height:270}],fields:[],lanes:[]
});
function syntheticDB({receipts=true,onBeforeBatch}={}){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON;'+fs.readFileSync(new URL('../db/0001_initial.sql',import.meta.url),'utf8'));
  if(receipts)sqlite.exec('CREATE TABLE cw_operation_receipts (project_id TEXT NOT NULL, operation_id TEXT NOT NULL, request_hash TEXT NOT NULL, response_json TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(project_id,operation_id), FOREIGN KEY(project_id) REFERENCES plot_projects(id))');
  const wrap=sql=>({params:[],bind(...args){this.params=args;return this},
    run(){const r=sqlite.prepare(sql).run(...this.params);return {meta:{changes:Number(r.changes)}}},
    first(){return sqlite.prepare(sql).get(...this.params)??null},
    all(){return {results:sqlite.prepare(sql).all(...this.params)}}
  });
  const db={prepare:wrap,async batch(statements){
    if(onBeforeBatch){const callback=onBeforeBatch;onBeforeBatch=null;callback(sqlite)}
    sqlite.exec('BEGIN IMMEDIATE');
    try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results}
    catch(e){sqlite.exec('ROLLBACK');throw e}
  }};
  return {db,sqlite};
}
function seed(sqlite,id='project-1',sourceGraph=fixture()){
  const graph=validateGraph(sourceGraph),now='2026-11-04T00:00:00Z',serialized=JSON.stringify(graph);
  sqlite.prepare('INSERT INTO plot_projects (id,name,graph_json,revision,created_at,updated_at) VALUES (?,?,?,0,?,?)').run(id,'Синтетический сюжет',serialized,now,now);
  sqlite.prepare('INSERT INTO plot_revisions (project_id,revision,graph_json,message,created_at) VALUES (?,?,?,?,?)').run(id,0,serialized,'Создание',now);
}
function current(sqlite,id='project-1'){
  const r=sqlite.prepare('SELECT graph_json,revision FROM plot_projects WHERE id=?').get(id);
  const g=validateGraph(JSON.parse(r.graph_json));g.revision=r.revision;return g;
}
function historical(sqlite,revision,id='project-1'){
  const r=sqlite.prepare('SELECT graph_json FROM plot_revisions WHERE project_id=? AND revision=?').get(id,revision);
  const g=validateGraph(JSON.parse(r.graph_json));g.revision=revision;return g;
}
function counts(sqlite,id='project-1'){
  return {revision:sqlite.prepare('SELECT revision FROM plot_projects WHERE id=?').get(id).revision,
    history:sqlite.prepare('SELECT COUNT(*) AS n FROM plot_revisions WHERE project_id=?').get(id).n,
    receipts:sqlite.prepare('SELECT COUNT(*) AS n FROM cw_operation_receipts WHERE project_id=?').get(id).n};
}
function command(g,kind,extra={}){
  if(kind==='accept_draft'){
    const nodeIds=extra.nodeIds??['a','b'];return {kind,workspaceId:'w1',nodeIds,expectedPreview:previewDraftAcceptance(g,{workspaceId:'w1',nodeIds})};
  }
  if(kind==='start_replacement')return {kind,replacementId:'r1',sourceNodeIds:['n2'],expectedPreview:previewReplacementStart(g,['n2'])};
  if(kind==='reconnect'){
    const decisions=extra.decisions??[{edgeId:'e1',decision:'drop'}];
    return {kind,replacementId:'r1',decisions,expectedPreview:previewReplacementReconnection(g,{replacementId:'r1',decisions})};
  }
  if(kind==='complete')return {kind,replacementId:'r1',expectedPreview:previewCompleteReplacement(g,{replacementId:'r1'}),acknowledgeUnresolved:true};
  throw Error('unknown command');
}
const send=(db,command,revision=0,operationId='operation-1',projectId='project-1')=>commitSyntheticWorkflowCommand(db,{projectId,operationId,expectedRevision:revision,command});
const start=(db,sqlite)=>send(db,command(current(sqlite),'start_replacement'),0,'start');
const accept=(db,sqlite)=>send(db,command(current(sqlite),'accept_draft'),0,'accept');

test('one atomic accept saves exactly one snapshot and one operation receipt',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);
  const r=await accept(db,sqlite);assert.equal(r.replayed,false);assert.equal(r.revision,1);
  assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
  assert.deepEqual(canonicalProjection(current(sqlite)).nodes.map(n=>n.id),['n1','n2','n3','a','b']);
  assert.deepEqual(canonicalProjection(current(sqlite)).edges.map(e=>e.id),['e1','e2','ea']);
  assert.deepEqual(historical(sqlite,1),current(sqlite));
});
test('same request ID and content replay without new write, even after other revisions',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);
  const c=command(current(sqlite),'accept_draft',{nodeIds:['a']});
  const first=await send(db,c,0,'one');const repeated=await send(db,clone(c),0,'one');
  assert.deepEqual(repeated,{...first,replayed:true});
  await send(db,command(current(sqlite),'accept_draft',{nodeIds:['b']}),1,'two');
  assert.equal((await send(db,c,0,'one')).replayed,true);
  assert.deepEqual(counts(sqlite),{revision:2,history:3,receipts:2});
});
test('canonical object key order does not change request identity',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);
  const c=command(current(sqlite),'accept_draft',{nodeIds:['a']});
  await send(db,c,0,'same');
  const c2={expectedPreview:clone(c.expectedPreview),nodeIds:['a'],workspaceId:'w1',kind:'accept_draft'};
  assert.equal((await send(db,c2,0,'same')).replayed,true);
});
test('reuse operation ID with different content fails closed',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);
  await send(db,command(current(sqlite),'accept_draft',{nodeIds:['a']}),0,'same');
  await fails(()=>send(db,command(current(sqlite),'accept_draft',{nodeIds:['b']}),0,'same'),'OPERATION_ID_REUSED');
  assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
});
test('stale project revision fails before any mutation or receipt',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);await accept(db,sqlite);
  await fails(()=>send(db,command(current(sqlite),'accept_draft',{nodeIds:['c']}),0,'stale'),'REVISION_CONFLICT');
  assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
});
test('start replacement records authoritative row revision, not stale JSON revision',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);
  const g=current(sqlite);g.revision=999;
  sqlite.prepare('UPDATE plot_projects SET graph_json=?').run(JSON.stringify(g));
  await start(db,sqlite);
  assert.equal(current(sqlite).replacements[0].sourceGraphRevision,0);
  assert.deepEqual(canonicalProjection(current(sqlite)).nodes.map(n=>n.id),['n1','n3']);
});
test('cancellation loads trusted baseline from project-specific revision history',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);await start(db,sqlite);
  const g=current(sqlite),baseline=historical(sqlite,0);
  const expectedPreview=previewCancelReplacement(g,{replacementId:'r1',baselineGraph:baseline});
  assert.equal(expectedPreview.canCancel,true);
  const r=await send(db,{kind:'cancel',replacementId:'r1',expectedPreview},1,'cancel');
  assert.equal(r.revision,2);assert.deepEqual(counts(sqlite),{revision:2,history:3,receipts:2});
  assert.deepEqual(canonicalProjection(current(sqlite)).nodes.map(n=>n.id),['n1','n2','n3']);
});
test('client-provided baseline injection is rejected',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);await start(db,sqlite);
  const g=current(sqlite),expectedPreview=previewCancelReplacement(g,{replacementId:'r1',baselineGraph:historical(sqlite,0)});
  await fails(()=>send(db,{kind:'cancel',replacementId:'r1',expectedPreview,baselineGraph:g},1,'inject'),'COMMAND_INVALID');
  assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
});
test('cancel after accepting a replacement scene blocks duplicate canon',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);await start(db,sqlite);
  await send(db,command(current(sqlite),'accept_draft',{nodeIds:['a']}),1,'accept-a');
  const g=current(sqlite),expectedPreview=previewCancelReplacement(g,{replacementId:'r1',baselineGraph:historical(sqlite,0)});
  assert.equal(expectedPreview.canCancel,false);
  await fails(()=>send(db,{kind:'cancel',replacementId:'r1',expectedPreview},2,'cancel'),'RESTORE_CONFLICT');
  assert.deepEqual(counts(sqlite),{revision:2,history:3,receipts:2});
});
test('full command chain: start, accept, rewire and complete',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);await start(db,sqlite);
  await send(db,command(current(sqlite),'accept_draft'),1,'accept');
  const decisions=[{edgeId:'e1',decision:'rewire',newEdge:{id:'new1',from:'n1',to:'a',type:'precedes'}},{edgeId:'e2',decision:'drop'}];
  await send(db,command(current(sqlite),'reconnect',{decisions}),2,'reconnect');
  await send(db,command(current(sqlite),'complete'),3,'complete');
  assert.deepEqual(counts(sqlite),{revision:4,history:5,receipts:4});
  assert.equal(current(sqlite).replacements[0].state,'completed');
  assert.deepEqual(canonicalProjection(current(sqlite)).edges.map(e=>e.id),['ea','new1']);
});
test('stale preview does not consume receipt or write',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);const c=command(current(sqlite),'accept_draft');
  c.expectedPreview.promoteEdgeIds.push('invented');
  await fails(()=>send(db,c,0,'bad'),'PREVIEW_STALE');
  assert.deepEqual(counts(sqlite),{revision:0,history:1,receipts:0});
});
test('missing receipt table fails before any story mutation',async()=>{
  const {db,sqlite}=syntheticDB({receipts:false});seed(sqlite);
  await assert.rejects(()=>send(db,command(current(sqlite),'accept_draft'),0,'bad'),/no such table|cw_operation_receipts/i);
  assert.equal(sqlite.prepare('SELECT revision FROM plot_projects').get().revision,0);
});
test('receipt failure rolls back graph update and revision insert',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);const before=current(sqlite);
  sqlite.exec("CREATE TRIGGER reject_receipt BEFORE INSERT ON cw_operation_receipts BEGIN SELECT RAISE(ABORT,'blocked receipt'); END");
  await assert.rejects(()=>send(db,command(current(sqlite),'accept_draft'),0,'bad'),/blocked receipt/);
  assert.deepEqual(current(sqlite),before);assert.deepEqual(counts(sqlite),{revision:0,history:1,receipts:0});
});
test('revision history insertion failure rolls back entire transaction',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);
  sqlite.exec("CREATE TRIGGER reject_history BEFORE INSERT ON plot_revisions WHEN NEW.revision>0 BEGIN SELECT RAISE(ABORT,'blocked history'); END");
  await assert.rejects(()=>send(db,command(current(sqlite),'accept_draft'),0,'bad'),/blocked history/);
  assert.deepEqual(counts(sqlite),{revision:0,history:1,receipts:0});
});
test('a concurrent writer winning compare-and-swap leaves no orphan receipt',async()=>{
  const {db,sqlite}=syntheticDB({onBeforeBatch:s=>{
    s.prepare('UPDATE plot_projects SET revision=1 WHERE id=? AND revision=0').run('project-1');
    const data=s.prepare('SELECT graph_json FROM plot_projects WHERE id=?').get('project-1').graph_json;
    s.prepare('INSERT INTO plot_revisions (project_id,revision,graph_json,message,created_at) VALUES (?,?,?,?,?)').run('project-1',1,data,'other writer','2026-11-04T00:00:00Z');
  }});seed(sqlite);
  await fails(()=>send(db,command(current(sqlite),'accept_draft'),0,'lost'),'REVISION_CONFLICT');
  assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:0});
  assert.equal(current(sqlite).nodes.find(n=>n.id==='a').workspaceId,'w1');
});
test('receipts are project-scoped, not global story state',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite,'project-1');seed(sqlite,'project-2');
  for(const id of ['project-1','project-2']){
    const r=await send(db,command(current(sqlite,id),'accept_draft'),0,'same-id',id);
    assert.equal(r.projectId,id);assert.equal(r.replayed,false);
  }
  assert.deepEqual(counts(sqlite,'project-1'),{revision:1,history:2,receipts:1});
  assert.deepEqual(counts(sqlite,'project-2'),{revision:1,history:2,receipts:1});
});
test('unknown command, forged graph and disallowed fields are rejected',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite);
  await fails(()=>send(db,{kind:'write_everything',expectedPreview:{}},0,'bad1'),'COMMAND_INVALID');
  await fails(()=>send(db,{...command(current(sqlite),'accept_draft'),graph:{nodes:[]}},0,'bad2'),'COMMAND_INVALID');
  assert.deepEqual(counts(sqlite),{revision:0,history:1,receipts:0});
});


function noteProject(){
  const g=fixture();
  g.gapNotes=[{id:'gn1',title:'Заметка',text:'Предложи два развития истории, не затрагивая исходную причинность',x:110,y:530,parent:null,status:'pending',offerVariants:true}];
  g.gapLinks=[{id:'gl1',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'n2'}}];
  return g;
}
function noteCommand(g){
  const workspace={x:100,y:580,width:1100,height:460};
  const branches=[
    {id:'first',title:'Первый путь',nodes:[
      {id:'new-a',title:'Герой уходит',x:150,y:620},
      {id:'new-b',title:'Теряет опору',x:380,y:620}
    ],edges:[{id:'new-ab',from:'new-a',to:'new-b',type:'precedes'}]},
    {id:'second',title:'Второй путь',nodes:[{id:'new-c',title:'Остаётся',x:150,y:820}],edges:[]}
  ];
  const spec={noteId:'gn1',workspaceId:'w-note',workspace,branches};
  return {kind:'stage_note',...spec,expectedPreview:previewStageNoteAlternatives(g,spec)};
}
test('staging a real-shape standalone note through synthetic CAS keeps canon and context intact',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite,'project-1',noteProject());
  const before=canonicalProjection(current(sqlite));
  const r=await send(db,noteCommand(current(sqlite)),0,'stage-note');
  assert.equal(r.revision,1);assert.equal(r.changes.stagedNodeIds.length,3);
  assert.deepEqual(canonicalProjection(current(sqlite)),before);
  assert.equal(current(sqlite).workspaces.find(w=>w.id==='w-note').taskId,'gn1');
  assert.equal(current(sqlite).gapLinks[0].id,'gl1');
  assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
});
test('one synthetic history from note to alternatives, partial acceptance, replacement and reconnection',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite,'project-1',noteProject());
  const stagedCommand=noteCommand(current(sqlite));
  await send(db,stagedCommand,0,'stage-note');
  assert.equal((await send(db,stagedCommand,0,'stage-note')).replayed,true);
  const now=current(sqlite),nodeIds=['new-a','new-b'];
  await send(db,{kind:'accept_draft',workspaceId:'w-note',nodeIds,
    expectedPreview:previewDraftAcceptance(now,{workspaceId:'w-note',nodeIds})},1,'accept-subset');
  const accepted=current(sqlite);
  assert.ok(canonicalProjection(accepted).edges.some(e=>e.id==='new-ab'));
  assert.equal(accepted.nodes.find(n=>n.id==='new-c').workspaceId,'w-note');
  assert.equal(accepted.nodes.find(n=>n.id==='new-a').draftBranchId,undefined);
  assert.deepEqual(canonicalProjection(accepted).edges.map(e=>e.id),['e1','e2','new-ab']);
  await send(db,command(accepted,'start_replacement'),2,'start-replacement');
  const started=current(sqlite);
  assert.deepEqual(canonicalProjection(started).nodes.map(n=>n.id),['n1','n3','new-a','new-b']);
  const choices=[
    {edgeId:'e1',decision:'rewire',newEdge:{id:'edge-new-1',from:'n1',to:'new-a',type:'precedes'}},
    {edgeId:'e2',decision:'rewire',newEdge:{id:'edge-new-2',from:'new-b',to:'n3',type:'causes'}}
  ];
  await send(db,command(started,'reconnect',{decisions:choices}),3,'choose-links');
  await send(db,command(current(sqlite),'complete'),4,'complete-replacement');
  assert.deepEqual(counts(sqlite),{revision:5,history:6,receipts:5});
  const result=current(sqlite);
  assert.equal(result.replacements[0].state,'completed');
  assert.deepEqual(canonicalProjection(result).edges.map(e=>e.id),['new-ab','edge-new-1','edge-new-2']);
  assert.equal(result.nodes.find(n=>n.id==='new-c').workspaceId,'w-note');
  assert.equal(result.gapNotes[0].text,noteProject().gapNotes[0].text);
  assert.equal(result.gapLinks[0].to.id,'n2','editorial note association is retained, not auto-rewired');
});
test('same note cannot be staged twice with different request ID, without a new story revision',async()=>{
  const {db,sqlite}=syntheticDB();seed(sqlite,'project-1',noteProject());
  const initialCommand=noteCommand(current(sqlite));
  await send(db,initialCommand,0,'stage-one');
  // A distinct operation ID attempts the old reviewed payload against the
  // current project. The server must reject the occupied task/area.
  await fails(()=>send(db,initialCommand,1,'stage-two'),'WORKSPACE_CONFLICT');
  assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
});

test('drop acceptance writes placement plus membership in one CAS, history and receipt',async()=>{
 const {db,sqlite}=syntheticDB();seed(sqlite);
 const before=current(sqlite),nodeIds=['a','b'];
 const placements=[{nodeId:'b',x:790,y:-120},{nodeId:'a',x:560,y:-120}];
 const command={kind:'accept_draft',workspaceId:'w1',nodeIds,placements,
  expectedPreview:previewDraftAcceptance(before,{workspaceId:'w1',nodeIds,placements})};
 const first=await send(db,command,0,'drop-a-b');
 assert.equal(first.revision,1);
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
 const saved=current(sqlite);
 for(const p of placements){
  const n=saved.nodes.find(n=>n.id===p.nodeId);
  assert.equal(n.workspaceId,undefined);
  assert.deepEqual({x:n.x,y:n.y},{x:p.x,y:p.y});
 }
 assert.equal(saved.nodes.find(n=>n.id==='c').workspaceId,'w1');
 assert.equal(saved.edges.find(e=>e.id==='ea').workspaceId,undefined);
 assert.equal(saved.edges.find(e=>e.id==='eb').workspaceId,'w1');
 assert.deepEqual(saved.edges.slice(0,2),before.edges.slice(0,2));
 assert.deepEqual(historical(sqlite,1),saved);
 assert.equal((await send(db,command,0,'drop-a-b')).replayed,true);
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
 await fails(()=>send(db,{...command,placements:[{nodeId:'a',x:570,y:-120},
  {nodeId:'b',x:790,y:-120}]},0,'drop-a-b'),'OPERATION_ID_REUSED');
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
});
test('preview placement cannot mutate data and concurrent stale write fails closed',async()=>{
 const {db,sqlite}=syntheticDB();seed(sqlite);
 const before=current(sqlite),nodeIds=['a','b'];
 const placements=[{nodeId:'a',x:550,y:-220},{nodeId:'b',x:790,y:-220}];
 const dropCommand={kind:'accept_draft',workspaceId:'w1',nodeIds,placements,
  expectedPreview:previewDraftAcceptance(before,{workspaceId:'w1',nodeIds,placements})};
 const snapshot=JSON.stringify(current(sqlite));
 await send(db,command(current(sqlite),'accept_draft',{nodeIds:['c']}),0,'second-editor');
 await fails(()=>send(db,dropCommand,0,'stale-drop'),'REVISION_CONFLICT');
 assert.equal(current(sqlite).nodes.find(n=>n.id==='a').workspaceId,'w1');
 assert.equal(current(sqlite).nodes.find(n=>n.id==='a').x,0);
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
 assert.ok(snapshot.includes('"workspaceId":"w1"'));
});

test('draft arrow create is one verified revision and receipt without canon changes',async()=>{
 const {db,sqlite}=syntheticDB();seed(sqlite);
 const original=current(sqlite),edge={id:'ec',from:'a',to:'c',type:'hinders'};
 const command={kind:'add_draft_edge',workspaceId:'w1',edge};
 const preview=(await previewWorkflowCommand(db,{
  projectId:'project-1',expectedRevision:0,command
 })).preview;
 assert.equal(preview.edge.id,'ec');
 assert.deepEqual(current(sqlite),original,'preview does not write');
 const full={...command,expectedPreview:preview};
 const result=await send(db,full,0,'draft-create-1');
 assert.equal(result.revision,1);
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
 assert.deepEqual(canonicalProjection(current(sqlite)),canonicalProjection(original));
 assert.equal(current(sqlite).edges.find(e=>e.id==='ec').workspaceId,'w1');
 assert.equal((await send(db,full,0,'draft-create-1')).replayed,true);
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
 await fails(()=>send(db,{...full,edge:{...edge,type:'causes'}},0,'draft-create-1'),'OPERATION_ID_REUSED');
 assert.deepEqual(historical(sqlite,1),current(sqlite));
});
test('draft rewire preserves source edge ID and type with CAS and stale rejection',async()=>{
 const {db,sqlite}=syntheticDB();seed(sqlite);
 const g=current(sqlite),command={kind:'rewire_draft_edge',workspaceId:'w1',
  edgeId:'eb',to:'a'};
 const preview=(await previewWorkflowCommand(db,{
  projectId:'project-1',expectedRevision:0,command
 })).preview;
 assert.equal(preview.before.to,'c');
 assert.equal(preview.after.to,'a');
 const result=await send(db,{...command,expectedPreview:preview},0,'draft-rewire-1');
 assert.equal(result.revision,1);
 const next=current(sqlite),edge=next.edges.find(e=>e.id==='eb');
 assert.equal(edge.to,'a');
 assert.equal(edge.from,'b');
 assert.equal(edge.type,'precedes');
 assert.equal(edge.workspaceId,'w1');
 assert.deepEqual(canonicalProjection(next),canonicalProjection(g));
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
 await fails(()=>send(db,{kind:'add_draft_edge',workspaceId:'w1',
  edge:{id:'ee',from:'c',to:'a',type:'precedes'},expectedPreview:preview},
  0,'stale-draft-create'),'REVISION_CONFLICT');
 assert.equal(current(sqlite).edges.length,g.edges.length);
});

test('draft relation type is one isolated revision with idempotent receipt',async()=>{
 const {db,sqlite}=syntheticDB();seed(sqlite);
 const original=current(sqlite);
 const command={kind:'set_draft_edge_type',workspaceId:'w1',edgeId:'ea',newType:'enables'};
 const preview=(await previewWorkflowCommand(db,{
  projectId:'project-1',expectedRevision:0,command
 })).preview;
 assert.equal(preview.before.type,'precedes');
 assert.equal(preview.after.type,'enables');
 assert.deepEqual(current(sqlite),original,'preview is read-only');
 const full={...command,expectedPreview:preview};
 const applied=await send(db,full,0,'draft-type-1');
 assert.equal(applied.revision,1);
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
 const updated=current(sqlite);
 assert.equal(updated.edges.find(e=>e.id==='ea').type,'enables');
 assert.deepEqual(canonicalProjection(updated),canonicalProjection(original));
 assert.equal((await send(db,full,0,'draft-type-1')).replayed,true);
 await fails(()=>send(db,{...full,newType:'hinders'},0,'draft-type-1'),'OPERATION_ID_REUSED');
 await fails(()=>send(db,full,0,'draft-type-stale'),'REVISION_CONFLICT');
 assert.deepEqual(counts(sqlite),{revision:1,history:2,receipts:1});
 assert.deepEqual(historical(sqlite,1),updated);
});
