import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {DatabaseSync} from 'node:sqlite';
import {newProject,getProjectRevision,insertSyntheticGraph,getNodes,getViewport,listPendingTasks,commitSyntheticAddNode,previewGroupMoveV2,commitGroupMoveV2,startVariantSetV2,stageOneVariantV2,getReadyVariantsV2,sealVariantSetV2} from '../src/v2_store.mjs';
import {createEmptyV2Graph} from '../src/editorial_contract.mjs';
const ddl=fs.readFileSync(new URL('../db/0002_v2_isolated.sql',import.meta.url),'utf8');
function memoryDB({legacy=false}={}){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON;');
 if(legacy)sqlite.exec(fs.readFileSync(new URL('../db/0001_initial.sql',import.meta.url),'utf8'));
 sqlite.exec(ddl);
 const wrap=sql=>({sql,params:[],bind(...values){this.params=values;return this},run(){const r=sqlite.prepare(sql).run(...this.params);return {meta:{changes:Number(r.changes)}}},first(){return sqlite.prepare(sql).get(...this.params)||null},all(){return {results:sqlite.prepare(sql).all(...this.params)}}});
 return {sqlite,prepare:wrap,async batch(statements){const results=[];sqlite.exec('BEGIN IMMEDIATE');try{for(const q of statements)results.push(q.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}},close(){sqlite.close()}};
}
const base=async(db,id='p1')=>await newProject(db,{project_id:id,owner_id:'owner',name:'Тест'});
const node=(node_id,x=0)=>({node_id,title:`Нода ${node_id}`,description:'Тест',kind:'event',status:'draft',parent_id:null,x,y:30,width:200,height:120});
test('P2 additive schema coexists with old monolithic tables without backfill or alteration',async()=>{
 const db=memoryDB({legacy:true});db.sqlite.prepare('INSERT INTO plot_projects(id,name,graph_json,revision,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('legacy','old','{"nodes":[]}',5,'t','t');
 await base(db);await insertSyntheticGraph(db,{...createEmptyV2Graph('p1'),plot_nodes:[node('new')]});
 const old=db.sqlite.prepare('SELECT graph_json,revision FROM plot_projects WHERE id=?').get('legacy');assert.deepEqual({...old},{graph_json:'{"nodes":[]}',revision:5});
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM plot_nodes_v2').get().n,1);db.close();
});
test('P2 zero-affected-row CAS must throw SQL ABORT, rollback all writes',async()=>{
 const db=memoryDB();await base(db);let first=await commitSyntheticAddNode(db,{project_id:'p1',owner_id:'owner',expected_revision:0,operation_id:'op1',node:node('a')});assert.equal(first.committed_revision,1);
 await assert.rejects(()=>commitSyntheticAddNode(db,{project_id:'p1',owner_id:'owner',expected_revision:0,operation_id:'op2',node:node('b')}),e=>e.code==='REVISION_CONFLICT');
 assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM plot_nodes_v2").get().n,1);
 assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM operation_receipts_v2").get().n,1);
 assert.equal(await getProjectRevision(db,'p1','owner'),1);db.close();
});
test('P2 failure in middle of batch rolls back receipt, node and journal',async()=>{
 const db=memoryDB();await base(db);
 await assert.rejects(()=>commitSyntheticAddNode(db,{project_id:'p1',owner_id:'owner',expected_revision:0,operation_id:'bad',node:node('a'),force_failure:true}),e=>e.code==='TRANSACTION_ABORTED');
 for(const table of ['plot_nodes_v2','changes_v2','change_items_v2','operation_receipts_v2'])assert.equal(db.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0,table);
 assert.equal(await getProjectRevision(db,'p1','owner'),0);db.close();
});
test('P2 repeated same operation produces stable receipt, different digest rejected',async()=>{
 const db=memoryDB();await base(db);const args={project_id:'p1',owner_id:'owner',expected_revision:0,operation_id:'same',node:node('a')};
 const a=await commitSyntheticAddNode(db,args),b=await commitSyntheticAddNode(db,args);assert.deepEqual(a,b);
 await assert.rejects(()=>commitSyntheticAddNode(db,{...args,node:node('different')}),e=>e.code==='IDEMPOTENCY_CONFLICT');
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM plot_nodes_v2').get().n,1);db.close();
});
test('P2 cannot use project ID across owners',async()=>{
 const db=memoryDB();await base(db);await assert.rejects(()=>getNodes(db,{project_id:'p1',owner_id:'other'}),e=>e.code==='PROJECT_NOT_FOUND');db.close();
});
test('P2 task revision trigger rejects wrong task revisions and incomplete state',async()=>{
 const db=memoryDB();await base(db);db.sqlite.prepare("INSERT INTO editorial_tasks_v2(project_id,task_id,kind,status,offer_variants,task_revision,created_seq) VALUES('p1','t','gap_note','open',1,5,1)").run();
 assert.throws(()=>db.sqlite.prepare("INSERT INTO operation_receipts_v2(project_id,operation_id,request_digest,expected_revision,expected_task_id,expected_task_revision,committed_revision,result_json,created_at) VALUES('p1','op','hash',0,'t',4,1,'{}','t')").run(),/TASK_REVISION_CONFLICT/);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM operation_receipts_v2').get().n,0);db.close();
});
test('P2 bounded indexed query with project-bound cursors and viewport filters',async()=>{
 const db=memoryDB();await base(db);const g=createEmptyV2Graph('p1');g.plot_nodes=Array.from({length:30},(_,i)=>node('n'+String(i).padStart(3,'0'),i*100));await insertSyntheticGraph(db,g);
 let q=await getNodes(db,{project_id:'p1',owner_id:'owner',limit:11});assert.equal(q.nodes.length,11);assert.equal(q.truncated,true);
 let next=await getNodes(db,{project_id:'p1',owner_id:'owner',limit:11,cursor:q.next_cursor});assert.equal(next.nodes.length,11);assert.notEqual(q.nodes[0].node_id,next.nodes[0].node_id);
 let box=await getViewport(db,{project_id:'p1',owner_id:'owner',bounds:{x:900,y:0,width:300,height:200},limit:10});assert.deepEqual(box.nodes.map(n=>n.node_id),['n008','n009','n010','n011']);
 await commitSyntheticAddNode(db,{project_id:'p1',owner_id:'owner',expected_revision:0,operation_id:'extra',node:node('z')});
 await assert.rejects(()=>getNodes(db,{project_id:'p1',owner_id:'owner',cursor:q.next_cursor,limit:11}),e=>e.code==='STALE_CURSOR');db.close();
});
test('P2 queue pagination returns open/regeneration tasks, no notes-as-tasks duplicates',async()=>{
 const db=memoryDB();await base(db);
 const insert=db.sqlite.prepare('INSERT INTO editorial_tasks_v2(project_id,task_id,kind,status,title,offer_variants,task_revision,created_seq) VALUES(?,?,?,?,?,1,0,?)');
 insert.run('p1','gap','gap_note','open','Gap',0);insert.run('p1','rewrite','rewrite_field','regeneration_requested','Rewrite',1);insert.run('p1','ready','gap_note','variants_ready','Ready',2);
 const first=await listPendingTasks(db,{project_id:'p1',owner_id:'owner',limit:1});assert.equal(first.tasks.length,1);assert.equal(first.truncated,true);
 const second=await listPendingTasks(db,{project_id:'p1',owner_id:'owner',limit:1,cursor:first.next_cursor});assert.deepEqual(second.tasks.map(t=>t.task_id),['rewrite']);db.close();
});
test('P2 v2 schema rejects wrong plot kinds, editorial misuse, FK delete',async()=>{
 const db=memoryDB();await base(db);
 assert.throws(()=>db.sqlite.prepare('INSERT INTO plot_nodes_v2(project_id,node_id,title,kind,status,x,y,width,height) VALUES(?,?,?,?,?,?,?,?,?)').run('p1','n','bad','note','draft',0,0,200,120),/CHECK constraint failed/);
 assert.throws(()=>db.sqlite.prepare("INSERT INTO edges_v2(project_id,edge_id,relation_scope,source_kind,source_id,target_kind,target_id,edge_type) VALUES('p1','e','editorial','plot_node','x','semantic_field','f',NULL)").run(),/DANGLING_ENDPOINT|CHECK constraint failed/);
 db.close();
});


test('P2 group move save pins + editorial membership + journal in one atomic write',async()=>{
 const db=memoryDB();await base(db);let g=createEmptyV2Graph('p1');g.plot_nodes=[node('n',0)];g.semantic_fields=[{field_id:'sf',title:'Секция',parent_id:null,assignment_mode:'auto',x:0,y:0,width:260,height:210}];
 g.editorial_tasks=[{task_id:'task',kind:'rewrite_field',status:'open',offer_variants:true,task_revision:0}];
 g.editorial_fields=[{editorial_field_id:'ef',task_id:'task',title:'На переработку',parent_id:null,x:300,y:200,width:500,height:300}];await insertSyntheticGraph(db,g);
 const args={project_id:'p1',owner_id:'owner',node_ids:['n'],dx:370,dy:240,editorial_task_id:'task'};const preview=await previewGroupMoveV2(db,args);
 assert.deepEqual(preview.lost_semantic_ids,[{node_id:'n',field_id:'sf'}]);
 const res=await commitGroupMoveV2(db,{...args,expected_revision:preview.expected_revision,preview_digest:preview.preview_digest,policy:'save',operation_id:'move1'});assert.equal(res.committed_revision,1);
 assert.equal(db.sqlite.prepare('SELECT x FROM plot_nodes_v2 WHERE node_id=?').get('n').x,370);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM node_semantic_pins_v2').get().n,1);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM editorial_memberships_v2').get().n,1);
 const repeat=await commitGroupMoveV2(db,{...args,expected_revision:0,preview_digest:preview.preview_digest,policy:'save',operation_id:'move1'});assert.deepEqual(repeat,res);
 db.close();
});
test('P2 group move drop loses only auto tags; stale preview conflicts with no writes',async()=>{
 const db=memoryDB();await base(db);let g=createEmptyV2Graph('p1');g.plot_nodes=[node('n',0)];g.semantic_fields=[{field_id:'sf',title:'Секция',parent_id:null,assignment_mode:'auto',x:0,y:0,width:260,height:210}];await insertSyntheticGraph(db,g);
 const args={project_id:'p1',owner_id:'owner',node_ids:['n'],dx:300,dy:250};const preview=await previewGroupMoveV2(db,args);
 const done=await commitGroupMoveV2(db,{...args,expected_revision:0,preview_digest:preview.preview_digest,policy:'drop',operation_id:'move1'});assert.equal(done.committed_revision,1);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM node_semantic_pins_v2').get().n,0);
 await assert.rejects(()=>commitGroupMoveV2(db,{...args,expected_revision:0,preview_digest:preview.preview_digest,policy:'save',operation_id:'move2'}),e=>e.code==='REVISION_CONFLICT');
 assert.equal(db.sqlite.prepare('SELECT x FROM plot_nodes_v2 WHERE node_id=?').get('n').x,300);db.close();
});

const gapVariant=(i)=>({schema_version:'plot-architect/v2',variant_id:'v'+i,task_id:'t',source_node_ids:[],new_nodes:[{temp_id:'local-'+i,title:'Альтернатива '+i,kind:'event'}],new_edges:[],boundary_decisions:[],semantic_pin_plan:[],placement_constraints:{prefer:'vertical'}});
test('P2 staging 2 of 3 variants is invisible and cannot seal; all 3 seal atomically',async()=>{
 const db=memoryDB();await base(db);db.sqlite.prepare("INSERT INTO editorial_tasks_v2(project_id,task_id,kind,status,offer_variants,task_revision,created_seq) VALUES('p1','t','gap_note','open',1,0,0)").run();
 await startVariantSetV2(db,{project_id:'p1',owner_id:'owner',task_id:'t',set_id:'set1',generation_no:1,expected_count:3});
 for(let i=1;i<=2;i++)await stageOneVariantV2(db,{project_id:'p1',owner_id:'owner',set_id:'set1',variant:gapVariant(i),ordinal:i});
 assert.deepEqual((await getReadyVariantsV2(db,{project_id:'p1',owner_id:'owner',task_id:'t'})).variants,[]);
 await assert.rejects(()=>sealVariantSetV2(db,{project_id:'p1',owner_id:'owner',set_id:'set1',expected_revision:0,expected_task_revision:0,operation_id:'seal1'}),e=>e.code==='INCOMPLETE_VARIANT_SET');
 await stageOneVariantV2(db,{project_id:'p1',owner_id:'owner',set_id:'set1',variant:gapVariant(3),ordinal:3});
 const params={project_id:'p1',owner_id:'owner',set_id:'set1',expected_revision:0,expected_task_revision:0,operation_id:'seal1'};
 const receipt=await sealVariantSetV2(db,params);assert.equal(receipt.committed_revision,1);assert.equal(receipt.active_variants.length,3);
 assert.equal((await getReadyVariantsV2(db,{project_id:'p1',owner_id:'owner',task_id:'t'})).variants.length,3);
 assert.deepEqual(await sealVariantSetV2(db,params),receipt);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM changes_v2').get().n,1);db.close();
});
test('P2 one prepared solution for offer_variants=false, no phantom three variants',async()=>{
 const db=memoryDB();await base(db);db.sqlite.prepare("INSERT INTO editorial_tasks_v2(project_id,task_id,kind,status,offer_variants,task_revision,created_seq) VALUES('p1','t','gap_note','open',0,0,0)").run();
 await assert.rejects(()=>startVariantSetV2(db,{project_id:'p1',owner_id:'owner',task_id:'t',set_id:'wrong',generation_no:1,expected_count:3}),e=>e.code==='VARIANT_COUNT_MISMATCH');
 await startVariantSetV2(db,{project_id:'p1',owner_id:'owner',task_id:'t',set_id:'one',generation_no:1,expected_count:1});
 await stageOneVariantV2(db,{project_id:'p1',owner_id:'owner',set_id:'one',variant:gapVariant(1),ordinal:1});
 await sealVariantSetV2(db,{project_id:'p1',owner_id:'owner',set_id:'one',expected_revision:0,expected_task_revision:0,operation_id:'seal1'});
 assert.equal((await getReadyVariantsV2(db,{project_id:'p1',owner_id:'owner',task_id:'t'})).variants.length,1);db.close();
});
test('P2 incomplete or corrupt boundary prevents seal without half-ready status',async()=>{
 const db=memoryDB();await base(db);const g=createEmptyV2Graph('p1');g.plot_nodes=[node('a',0),node('b',300),node('c',650)];
 g.editorial_tasks=[{task_id:'t',kind:'rewrite_field',status:'open',task_revision:0,offer_variants:false}];g.editorial_fields=[{editorial_field_id:'f',task_id:'t',title:'Rewrite',parent_id:null,x:300,y:0,width:260,height:250}];g.editorial_memberships=[{task_id:'t',node_id:'b'}];
 g.edges=[{edge_id:'e1',relation_scope:'plot',source:{kind:'plot_node',id:'a'},target:{kind:'plot_node',id:'b'},type:'precedes'},{edge_id:'e2',relation_scope:'plot',source:{kind:'plot_node',id:'b'},target:{kind:'plot_node',id:'c'},type:'causes'}];
 await insertSyntheticGraph(db,g);await startVariantSetV2(db,{project_id:'p1',owner_id:'owner',task_id:'t',set_id:'set',generation_no:1,expected_count:1});
 const variant={schema_version:'plot-architect/v2',variant_id:'one',task_id:'t',source_node_ids:['b'],new_nodes:[{temp_id:'replacement',title:'Новое',kind:'event'}],new_edges:[],boundary_decisions:[{edge_id:'e1',decision:'rewire',new_endpoint_temp_id:'replacement',rationale:'Вход'}],semantic_pin_plan:[],placement_constraints:{prefer:'vertical'}};
 await stageOneVariantV2(db,{project_id:'p1',owner_id:'owner',set_id:'set',variant,ordinal:1});
 await assert.rejects(()=>sealVariantSetV2(db,{project_id:'p1',owner_id:'owner',set_id:'set',expected_revision:0,expected_task_revision:0,operation_id:'seal'}),e=>e.code==='VARIANT_BOUNDARY_INCOMPLETE');
 assert.equal(db.sqlite.prepare("SELECT status FROM variant_sets_v2 WHERE set_id='set'").get().status,'staged');
 assert.deepEqual((await getReadyVariantsV2(db,{project_id:'p1',owner_id:'owner',task_id:'t'})).variants,[]);db.close();
});

test('P2 polymorphic edge triggers reject dangling refs even when SQL CHECK scope is valid',async()=>{
 const db=memoryDB();await base(db);const cmd=db.sqlite.prepare(`INSERT INTO edges_v2(project_id,edge_id,relation_scope,source_kind,source_id,target_kind,target_id,edge_type) VALUES(?,?,?,?,?,?,?,?)`);
 assert.throws(()=>cmd.run('p1','e','plot','plot_node','absent-a','plot_node','absent-b','precedes'),/DANGLING_ENDPOINT/);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM edges_v2').get().n,0);db.close();
});

test('P2 approved rewrite source is protected: no sealed set, no project revision change',async()=>{
 const db=memoryDB();await base(db);const g=createEmptyV2Graph('p1');g.plot_nodes=[{...node('n',0),status:'approved'}];
 g.editorial_tasks=[{task_id:'t',kind:'rewrite_field',status:'open',task_revision:0,offer_variants:false}];
 g.editorial_fields=[{editorial_field_id:'ef',task_id:'t',title:'Rewrite',parent_id:null,x:0,y:0,width:280,height:200}];g.editorial_memberships=[{task_id:'t',node_id:'n'}];
 await insertSyntheticGraph(db,g);await startVariantSetV2(db,{project_id:'p1',owner_id:'owner',task_id:'t',set_id:'set',generation_no:1,expected_count:1});
 const plan={schema_version:'plot-architect/v2',variant_id:'v',task_id:'t',source_node_ids:['n'],new_nodes:[{temp_id:'new',title:'Новая сцена',kind:'event'}],new_edges:[],boundary_decisions:[],semantic_pin_plan:[],placement_constraints:{prefer:'vertical'}};
 await stageOneVariantV2(db,{project_id:'p1',owner_id:'owner',set_id:'set',variant:plan,ordinal:1});
 await assert.rejects(()=>sealVariantSetV2(db,{project_id:'p1',owner_id:'owner',set_id:'set',expected_revision:0,expected_task_revision:0,operation_id:'seal'}),e=>e.code==='APPROVED_SOURCE');
 assert.equal(await getProjectRevision(db,'p1','owner'),0);assert.equal(db.sqlite.prepare("SELECT status FROM variant_sets_v2 WHERE set_id='set'").get().status,'staged');db.close();
});
