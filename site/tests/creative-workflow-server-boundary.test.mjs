import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.mjs';
import {canonicalReadGraph,validateServerGraph,assertOrdinaryGraphWrite} from '../src/creative_workflow_server_boundary.mjs';

function storage(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('PRAGMA foreign_keys=ON;'+fs.readFileSync(new URL('../db/0001_initial.sql',import.meta.url),'utf8'));
 const prepare=query=>({
  params:[],bind(...args){this.params=args;return this},
  first(){return sql.prepare(query).get(...this.params)??null},
  all(){return {results:sql.prepare(query).all(...this.params)}},
  run(){const r=sql.prepare(query).run(...this.params);return {meta:{changes:Number(r.changes)}}}
 });
 return {sql,db:{prepare,async batch(batch){sql.exec('BEGIN IMMEDIATE');try{const result=batch.map(s=>s.run());sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}}}};
}
function base(){
 return {version:1,revision:0,view:null,nodes:[
  {id:'n1',title:'Вступление',description:'Сюжет начинается',x:100,y:100,parent:null},
  {id:'n2',title:'Старый поворот',description:'Выводится на замену',x:350,y:100,parent:null},
  {id:'n3',title:'Последствие',description:'Остаётся действующим',x:600,y:100,parent:null}],
  edges:[{id:'e1',from:'n1',to:'n2',type:'precedes'},
   {id:'e2',from:'n2',to:'n3',type:'causes'},
   {id:'e3',from:'n1',to:'n3',type:'enables'}],
  fields:[{id:'f1',title:'Основная тема',comment:'Сюжет',x:90,y:50,width:800,height:350,assignmentMode:'auto',parent:null}],
  lanes:[{id:'l1',title:'Основная линия',color:'#b8a16e',y:120}]};
}
const secret='СЕКРЕТНАЯ-НЕПРИНЯТАЯ-ВЕТВЬ';
function withDraft(){
 const g=base();
 g.workspaces=[{id:'w1',taskId:'gn1',x:150,y:500,width:900,height:370}];
 g.nodes.push(
  {id:'draft-a',title:secret,description:'Не канон',x:190,y:550,parent:null,workspaceId:'w1',draftBranchId:'v1'},
  {id:'draft-b',title:'Пока гипотеза',description:'Черновой итог',x:490,y:550,parent:null,workspaceId:'w1',draftBranchId:'v1'}
 );
 g.edges.push({id:'ed',from:'draft-a',to:'draft-b',type:'precedes',workspaceId:'w1',draftBranchId:'v1',draftRelation:'internal'});
 g.replacements=[{id:'r1',state:'open',sourceNodeIds:['n2'],suspendedEdgeIds:['e1','e2'],sourceGraphRevision:0}];
 g.gapNotes=[{id:'gn1',title:'Заметка',text:'СЕКРЕТ-РЕДАКТОРСКОГО-ЗАДАНИЯ',x:150,y:450,parent:null,status:'pending'}];
 g.gapLinks=[{id:'gl1',from:{kind:'gap_note',id:'gn1'},to:{kind:'plot_node',id:'n2'}}];
 g.editorialNotes=[{id:'en1',text:'НЕПОКАЗЫВАТЬ-В-КОНТЕКСТЕ'}];
 return g;
}
async function api(db,method,path,body,authorized=true){
 const headers={};if(authorized)headers['oai-authenticated-user-id']='owner';
 if(body!==undefined)headers['content-type']='application/json';
 const response=await worker.fetch(new Request('https://plot.local'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),{DB:db});
 return {status:response.status,body:await response.json()};
}
async function mcp(db,name,args,authorized=true){
 const req={jsonrpc:'2.0',id:34,method:'tools/call',params:{name,arguments:args}};
 const res=await api(db,'POST','/mcp',req,authorized);
 const data=res.body.result;
 return data?.isError?{error:JSON.parse(data.content[0].text)}:data?.structuredContent??data;
}
async function project(storage){
 const r=await api(storage.db,'POST','/api/projects',{name:'Синтетическая история',graph:base()});
 assert.equal(r.status,201);return r.body.id;
}
function installDraft(sql,id,graph=withDraft()){
 sql.prepare('UPDATE plot_projects SET graph_json=?,revision=1 WHERE id=?').run(JSON.stringify(graph),id);
 sql.prepare('INSERT INTO plot_revisions (project_id,revision,graph_json,message,created_at) VALUES (?,?,?,?,?)')
  .run(id,1,JSON.stringify(graph),'CW-TEST','2026-11-04T00:00:00Z');
}
test('legacy proposed is canonical; no workflow data is needed for old projects',()=>{
 const g=base();g.nodes[0].status='proposed';
 assert.deepEqual(canonicalReadGraph(g).nodes.map(n=>n.id),['n1','n2','n3']);
 assert.equal(canonicalReadGraph(g).nodes[0].status,'proposed');
});
test('one canonical read whitelist excludes drafts, replacement originals and editorial metadata',()=>{
 const full=withDraft(),clean=canonicalReadGraph(full);
 assert.deepEqual(clean.nodes.map(n=>n.id),['n1','n3']);
 assert.deepEqual(clean.edges.map(e=>e.id),['e3']);
 assert.deepEqual(clean.fields.map(f=>f.id),['f1']);
 for(const field of ['workspaces','replacements','gapNotes','gapLinks','editorialNotes'])assert.equal(Object.hasOwn(clean,field),false);
 assert.equal(JSON.stringify(clean).includes(secret),false);
 assert.equal(JSON.stringify(clean).includes('СЕКРЕТ-РЕДАКТОРСКОГО-ЗАДАНИЯ'),false);
 assert.equal(JSON.stringify(full).includes(secret),true);
});
test('normal REST editor GET preserves full project; MCP full/summary shows only canon',async()=>{
 const st=storage(),id=await project(st);installDraft(st.sql,id);
 const rest=await api(st.db,'GET','/api/projects/'+id);
 assert.equal(rest.status,200);
 assert.equal(rest.body.graph.workspaces[0].id,'w1');
 assert.equal(rest.body.graph.nodes.find(n=>n.id==='draft-a').title,secret);
 const full=await mcp(st.db,'get_project',{project_id:id,detail:'full'});
 assert.deepEqual(full.graph.nodes.map(n=>n.id),['n1','n3']);
 assert.deepEqual(full.graph.edges.map(e=>e.id),['e3']);
 assert.equal(full.graph.view,null);
 assert.equal(JSON.stringify(full).includes(secret),false);
 const summary=await mcp(st.db,'get_project',{project_id:id});
 assert.deepEqual(summary.counts,{nodes:2,edges:1,fields:1});
 assert.deepEqual(summary.sample_nodes.map(n=>n.id),['n1','n3']);
 assert.equal(JSON.stringify(summary).includes(secret),false);
});
test('MCP context query, exact ID and neighbors never return drafts or retired original',async()=>{
 const st=storage(),id=await project(st);installDraft(st.sql,id);
 const secretQuery=await mcp(st.db,'get_context',{project_id:id,query:secret});
 assert.deepEqual(secretQuery.nodes,[]);
 const exact=await mcp(st.db,'get_context',{project_id:id,node_ids:['draft-a','n2']});
 assert.deepEqual(exact.nodes,[]);
 const neighbors=await mcp(st.db,'get_context',{project_id:id,node_ids:['n1'],neighbors:true});
 assert.deepEqual(neighbors.nodes.map(n=>n.id),['n1','n3']);
 assert.deepEqual(neighbors.edges.map(e=>e.id),['e3']);
 assert.equal(JSON.stringify(neighbors).includes(secret),false);
});
test('MCP revision diff excludes draft and hidden original IDs from added/updated changes',async()=>{
 const st=storage(),id=await project(st);installDraft(st.sql,id);
 const change=await mcp(st.db,'get_changes',{project_id:id,since_revision:0});
 assert.equal(change.from_revision,0);
 assert.deepEqual(change.changes.nodes.added,[]);
 assert.deepEqual(change.changes.nodes.removed,['n2']);
 assert.deepEqual(change.changes.edges.added,[]);
 assert.deepEqual(change.changes.edges.removed,['e1','e2']);
 assert.equal(JSON.stringify(change).includes('draft-a'),false);
});
test('legacy REST PUT rejects changing, removing or promoting draft nodes without increasing revision',async()=>{
 const st=storage(),id=await project(st);installDraft(st.sql,id);
 for(const mutate of [
  g=>{g.nodes.find(n=>n.id==='draft-a').title='Подмена'},
  g=>{delete g.nodes.find(n=>n.id==='draft-a').workspaceId;delete g.nodes.find(n=>n.id==='draft-a').draftBranchId},
  g=>{g.nodes=g.nodes.filter(n=>n.id!=='draft-b');g.edges=g.edges.filter(e=>e.id!=='ed')},
  g=>{g.workspaces[0].width+=100},
  g=>{g.replacements[0].state='completed'},
  g=>{g.nodes.find(n=>n.id==='n2').description='Изменён оригинал'},
  g=>{g.edges.find(e=>e.id==='e1').type='hinders'}
 ]){
  const g=structuredClone(withDraft());mutate(g);
  const response=await api(st.db,'PUT','/api/projects/'+id,{name:'Синтетическая история',expectedRevision:1,graph:g});
  assert.equal(response.status,422,JSON.stringify(response.body));
 }
 assert.equal((await api(st.db,'GET','/api/projects/'+id)).body.revision,1);
});
test('ordinary POST rejects forged new workspace graphs, accepts legacy projects',async()=>{
 const st=storage();
 assert.equal((await api(st.db,'POST','/api/projects',{name:'Новый сюжет',graph:base()})).status,201);
 const reject=await api(st.db,'POST','/api/projects',{name:'Нельзя импортировать черновик',graph:withDraft()});
 assert.equal(reject.status,422);
 assert.equal((await api(st.db,'GET','/api/projects')).body.projects.length,1);
});
test('MCP patch cannot update draft node, suspended original, suspended edge or connect canon to draft',async()=>{
 const st=storage(),id=await project(st);installDraft(st.sql,id);
 for(const operations of [
  [{op:'update_node',id:'draft-a',changes:{title:'Ложный канон'}}],
  [{op:'update_node',id:'n2',changes:{title:'Изменение оригинала'}}],
  [{op:'update_edge',id:'e1',edge_type:'hinders'}],
  [{op:'add_edge',from:'n1',to:'draft-a',edge_type:'precedes'}],
  [{op:'add_node',title:'Вложенный черновик',parent:'draft-a'}]
 ]){
  const value=await mcp(st.db,'preview_patch',{project_id:id,expected_revision:1,operations});
  assert.ok(value.error,JSON.stringify(operations));
 }
 assert.equal((await api(st.db,'GET','/api/projects/'+id)).body.revision,1);
});
test('ordinary MCP can still safely edit canonical node with drafts present',async()=>{
 const st=storage(),id=await project(st);installDraft(st.sql,id);
 const operations=[{op:'update_node',id:'n1',changes:{title:'Новая завязка'}}];
 const args={project_id:id,expected_revision:1,operations};
 const preview=await mcp(st.db,'preview_patch',args);
 assert.ok(preview.preview_token,JSON.stringify(preview));
 assert.deepEqual(preview.counts_before,{nodes:2,edges:1,fields:1});
 const done=await mcp(st.db,'apply_patch',{...args,preview_token:preview.preview_token});
 assert.equal(done.saved,true);assert.equal(done.revision,2);
 const rest=await api(st.db,'GET','/api/projects/'+id);
 assert.equal(rest.body.graph.nodes.find(n=>n.id==='n1').title,'Новая завязка');
 assert.equal(rest.body.graph.nodes.find(n=>n.id==='draft-a').title,secret);
 assert.equal(rest.body.graph.replacements[0].sourceNodeIds[0],'n2');
});
test('generic REST PUT may edit canonical story but cannot silently add a new draft',async()=>{
 const st=storage(),id=await project(st);installDraft(st.sql,id);
 const valid=structuredClone(withDraft());valid.nodes.find(n=>n.id==='n1').description='Уточнение';
 const okay=await api(st.db,'PUT','/api/projects/'+id,{name:'Синтетическая история',expectedRevision:1,graph:valid});
 assert.equal(okay.status,200);
 const withNew=structuredClone(valid);
 withNew.nodes.push({id:'draft-c',title:'Лишний',description:'',x:700,y:650,parent:null,workspaceId:'w1'});
 const reject=await api(st.db,'PUT','/api/projects/'+id,{name:'Синтетическая история',expectedRevision:2,graph:withNew});
 assert.equal(reject.status,422);
 assert.equal((await api(st.db,'GET','/api/projects/'+id)).body.revision,2);
});
test('legacy whole-project restore cannot erase existing editorial area through old route',async()=>{
 const st=storage(),id=await project(st);installDraft(st.sql,id);
 const restored=await api(st.db,'POST','/api/projects/'+id+'/restore',{revision:0,expectedRevision:1});
 assert.equal(restored.status,422);
 assert.equal((await api(st.db,'GET','/api/projects/'+id)).body.revision,1);
});
test('invalid canon parent, missing owner or cross-scope link fail before writes',()=>{
 const g=withDraft();g.nodes.find(n=>n.id==='n1').parent='draft-a';
 assert.throws(()=>validateServerGraph(g),e=>e.code==='CANON_PARENT_INVALID');
 const orphan=withDraft();orphan.nodes.find(n=>n.id==='draft-a').workspaceId='unknown';
 assert.throws(()=>validateServerGraph(orphan),e=>e.code==='WORKSPACE_NOT_FOUND');
 const edge=withDraft();edge.edges.push({id:'bad',from:'n1',to:'draft-a',type:'precedes'});
 assert.throws(()=>validateServerGraph(edge),e=>e.code==='CANON_DRAFT_EDGE');
});
test('pure write guard accepts benign legacy graph update and rejects workflow creation',()=>{
 const before=base(),after=structuredClone(before);
 after.nodes[0].title='Изменённый канон';
 assert.equal(assertOrdinaryGraphWrite(before,after).nodes[0].title,'Изменённый канон');
 assert.throws(()=>assertOrdinaryGraphWrite(before,withDraft()),e=>e.code==='EXPLICIT_WORKFLOW_COMMAND_REQUIRED');
});

test('ordinary graph write tolerates draft key ordering and derived tags without changing stored drafts',()=>{
  // Server normalization inserts autoFieldIds before size. Browser-side
  // persistentGraph removes it and server normalization re-appends it last.
  const stored=validateServerGraph(withDraft());
  const draftStored=structuredClone(stored.nodes.find(n=>n.id==='draft-a'));
  const incoming=structuredClone(stored);
  const draft=incoming.nodes.find(n=>n.id==='draft-a');
  delete draft.autoFieldIds;
  draft.autoFieldIds=['f1']; // computed browser-only metadata; never accepted as a draft edit
  incoming.gapNotes[0].text='Уточнённое авторское задание';
  incoming.nodes.find(n=>n.id==='n1').title='Изменён канон';
  const normalized=validateServerGraph(incoming);
  assert.notEqual(JSON.stringify(draftStored),JSON.stringify(normalized.nodes.find(n=>n.id==='draft-a')),
    'regression: raw JSON comparison would block this harmless technical difference');
  const saved=assertOrdinaryGraphWrite(stored,incoming);
  assert.equal(saved.gapNotes[0].text,'Уточнённое авторское задание');
  assert.equal(saved.nodes.find(n=>n.id==='n1').title,'Изменён канон');
  assert.deepEqual(saved.nodes.find(n=>n.id==='draft-a'),draftStored,
    'server-owned protected draft is copied back byte-for-byte');
  assert.deepEqual(saved.edges.filter(e=>e.workspaceId),stored.edges.filter(e=>e.workspaceId));
  assert.deepEqual(saved.replacements,stored.replacements);
});
test('ordinary PUT can save note text with reordered staged draft keys but cannot edit draft content',async()=>{
  const st=storage(),id=await project(st);
  const stored=validateServerGraph(withDraft());
  installDraft(st.sql,id,stored);
  const incoming=structuredClone((await api(st.db,'GET','/api/projects/'+id)).body.graph);
  // Mirrors persistentGraph(): calculated autoFieldIds removed from each
  // draft, and the browser computes its own value while rendering.
  for(const node of incoming.nodes)delete node.autoFieldIds;
  incoming.gapNotes[0].text='Согласованный текст задачи';
  const saved=await api(st.db,'PUT','/api/projects/'+id,{
    name:'Синтетическая история',expectedRevision:1,graph:incoming
  });
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  assert.equal(saved.body.revision,2);
  const readback=(await api(st.db,'GET','/api/projects/'+id)).body.graph;
  assert.equal(readback.gapNotes[0].text,'Согласованный текст задачи');
  for(const id of ['draft-a','draft-b','n2']){
    assert.deepEqual(readback.nodes.find(n=>n.id===id),
      stored.nodes.find(n=>n.id===id),'protected node '+id+' unchanged');
  }
  const malicious=structuredClone(readback);
  malicious.nodes.find(n=>n.id==='draft-a').x+=50;
  malicious.gapNotes[0].text='Следующее редактирование';
  const rejected=await api(st.db,'PUT','/api/projects/'+id,{
    name:'Синтетическая история',expectedRevision:2,graph:malicious
  });
  assert.equal(rejected.status,422,JSON.stringify(rejected.body));
  assert.match(rejected.body.message,/PROTECTED_NODE_CHANGED/);
  const after=(await api(st.db,'GET','/api/projects/'+id)).body;
  assert.equal(after.revision,2);
  assert.equal(after.graph.gapNotes[0].text,'Согласованный текст задачи');
});
test('ordinary PUT rejects meaningful changes even with reordered keys',()=>{
  const before=validateServerGraph(withDraft());
  for(const edit of [
    n=>{n.title='Чужое заглавие'},
    n=>{n.description='Подмена содержания'},
    n=>{n.x+=1},
    n=>{n.workspaceId='w-forged'},
    n=>{n.manualTags.push('скрытое изменение')}
  ]){
    const next=structuredClone(before),node=next.nodes.find(n=>n.id==='draft-a');
    edit(node);
    assert.throws(()=>assertOrdinaryGraphWrite(before,next),
      e=>e.code==='PROTECTED_NODE_CHANGED'||e.code==='WORKSPACE_NOT_FOUND');
  }
});
