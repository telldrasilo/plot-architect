import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {createGraphiteLoopbackServer} from '../src/node_local_server.mjs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
async function harness(t, workflowEnabled) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON;');
  db.exec(readFileSync(new URL('../drizzle/0001_initial.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../drizzle/0002_cw_operation_receipts.sql', import.meta.url), 'utf8'));
  const token = randomBytes(32).toString('base64url');
  const server = createGraphiteLoopbackServer({database:db,editorHtml:html,token,workflowEnabled});
  const origin = await server.listen(0);
  t.after(async()=>{await server.close(); db.close()});
  async function rest(path, method = 'GET', body) {
    const response = await fetch(origin + path, {method,
      headers:{Authorization:'Bearer '+token,...body?{'Content-Type':'application/json'}:{}},
      ...body?{body:JSON.stringify(body)}:{}});
    return {status:response.status,data:await response.json()};
  }
  async function tool(name, args={}) {
    const response = await fetch(origin+'/mcp', {method:'POST',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',
        params:{name,arguments:args}})});
    const data = await response.json();
    return {status:response.status,data:data.result?.structuredContent,
      error:data.result?.content?.[0]?.text || data.error};
  }
  return {db,server,origin,rest,tool};
}

const proposal = {kind:'single',groups:[{
  title:'Три шага',
  events:[
    {key:'note',title:'Создать заметку',description:'Автор формулирует задачу'},
    {key:'context',title:'Прочитать задание',description:'MCP возвращает заметку и контекст'},
    {key:'draft',title:'Подготовить черновики',description:'Рабочая область отделена от канона'}
  ],
  relations:[{from:'note',to:'context',type:'precedes'},
    {from:'context',to:'draft',type:'precedes'}]
}]};

test('local owner note -> preview -> saved draft workspace; canonical graph isolated',async t=>{
 const h=await harness(t,true);
 const created=await h.tool('create_project',{name:'Синтетический тест заметки'});
 assert.equal(created.status,200);
 const id=created.data.project_id;
 const path='/api/projects/'+id;
 const original=await h.rest(path);
 assert.equal(original.data.revision,0);
 const graph=structuredClone(original.data.graph);
 graph.gapNotes=[{id:'gn1',title:'Заметка',text:'Объясни систему по шагам',x:100,y:420,parent:null,status:'pending'}];
 const added=await h.rest(path,'PUT',{name:original.data.name,expectedRevision:0,graph});
 assert.equal(added.status,200,JSON.stringify(added.data));
 const note=await h.tool('get_note_task',{project_id:id,note_id:'gn1'});
 assert.equal(note.data.revision,1);
 const args={project_id:id,note_id:'gn1',source_revision:1,generation_id:'syntheticNoteWorkflow0001',proposal};
 const preview=await h.tool('preview_note_drafts',args);
 assert.equal(preview.status,200);
 assert.equal(preview.data.saved,false,JSON.stringify(preview));
 assert.equal(preview.data.summary.nodeCount,3);
 assert.match(preview.data.review_token,/^[0-9a-f]{64}$/);
 assert.equal((await h.rest(path)).data.revision,1,'preview is read-only');
 const save=await h.tool('save_note_drafts',{...args,review_token:preview.data.review_token});
 assert.equal(save.data.saved,true,JSON.stringify(save));
 assert.equal(save.data.canon_changed,false);
 assert.equal(save.data.revision,2);
 const replay=await h.tool('save_note_drafts',{...args,review_token:preview.data.review_token});
 assert.equal(replay.data.saved,true,JSON.stringify(replay));
 assert.equal(replay.data.replayed,true);
 const staged=await h.rest(path);
 assert.equal(staged.data.revision,2);
 assert.equal(staged.data.graph.gapNotes[0].text,'Объясни систему по шагам');
 assert.equal(staged.data.graph.workspaces.length,1);
 assert.equal(staged.data.graph.workspaces[0].taskId,'gn1');
 const drafts=staged.data.graph.nodes.filter(n=>n.workspaceId===staged.data.graph.workspaces[0].id);
 assert.equal(drafts.length,3);
 const canonical=await h.tool('get_project',{project_id:id,detail:'full'});
 assert.equal(canonical.data.graph.nodes.length,0);
 assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM cw_operation_receipts WHERE project_id=?').get(id).n,1);
});

test('default-off gateway remains isolated and cannot save drafts',async t=>{
 const h=await harness(t,false);
 const list=await h.tool('create_project',{name:'Проверка закрытого режима'});
 const id=list.data.project_id;
 const path='/api/projects/'+id;
 const original=await h.rest(path);
 const graph=structuredClone(original.data.graph);
 graph.gapNotes=[{id:'gn1',title:'Заметка',text:'Синтетический запрос',x:100,y:420,parent:null,status:'pending'}];
 assert.equal((await h.rest(path,'PUT',{name:original.data.name,expectedRevision:0,graph})).status,200);
 const r=await h.tool('preview_note_drafts',{
   project_id:id,note_id:'gn1',source_revision:1,
   generation_id:'syntheticDisabled0001',proposal
 });
 assert.match(r.error,/WORKFLOW_DISABLED/);
 assert.equal((await h.rest(path)).data.revision,1);
});
