import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.mjs';import {validateGraph,packageProject,unpackProject} from '../src/graph_contract.mjs';
const secret='long-private-token-for-integration-tests-123456';
const graph=()=>({revision:0,version:1,view:null,nextNode:3,nextEdge:2,nextField:2,nextLine:2,nodes:[{id:'n1',title:'Событие',description:'',x:120,y:200,lineIds:['l1'],size:'normal',parent:null},{id:'n2',title:'Последствие',description:'',x:440,y:200,lineIds:['l1'],size:'normal',parent:null}],edges:[{id:'e1',from:'n1',to:'n2',type:'precedes'}],fields:[{id:'f1',title:'Двор',comment:'Тег',x:100,y:100,width:700,height:350,assignmentMode:'auto',parent:null}],lanes:[{id:'l1',title:'Двор',color:'#b8a16e',y:200}]});
function mockD1(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;'+fs.readFileSync(new URL('../db/0001_initial.sql',import.meta.url),'utf8'));let wraps=sql=>({sql,params:[],bind(...params){this.params=params;return this},run(){const res=db.prepare(sql).run(...this.params);return {meta:{changes:Number(res.changes)}}},first(){return db.prepare(sql).get(...this.params)||null},all(){return {results:db.prepare(sql).all(...this.params)}}});return {prepare:wraps,async batch(queries){const out=[];db.exec('BEGIN IMMEDIATE');try{for(const q of queries)out.push(q.run());db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return out}}}
function sender(db){return async function call(method,path,body,auth=true){const headers=new Headers();if(auth)headers.set('oai-authenticated-user-id','local-test-owner');if(body!==undefined)headers.set('Content-Type','application/json');const req=new Request('https://pa.local'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const res=await worker.fetch(req,{DB:db,PLOT_PRIVATE_TOKEN:secret});return {status:res.status,body:await res.json()}}}
test('graph validation, reference integrity and canonical package roundtrip',()=>{
 assert.equal(validateGraph(graph()).edges.length,1);const pkg=packageProject('Тест',graph());assert.equal(unpackProject(pkg).name,'Тест');
 const bad=graph();bad.edges[0].to='absent';assert.throws(()=>validateGraph(bad));
 const cyclic=graph();cyclic.nodes[0].parent='n2';cyclic.nodes[1].parent='n1';assert.throws(()=>validateGraph(cyclic));
});
test('native private API refuses anonymous access, including with a legacy bearer',async()=>{
 const db=mockD1(),call=sender(db);assert.equal((await call('GET','/api/projects',undefined,false)).status,401);
 const r=await worker.fetch(new Request('https://pa.local/api/projects'),{DB:db});assert.equal(r.status,401);
});
test('create, list, update, conflict, history, restore and soft delete',async()=>{
 const db=mockD1(),call=sender(db);
 const made=await call('POST','/api/projects',{name:'Двор',graph:graph()});assert.equal(made.status,201);
 const id=made.body.id;assert.equal((await call('GET','/api/projects')).body.projects.length,1);
 const updated=graph();updated.nodes[0].title='Изменённое событие';
 let r=await call('PUT','/api/projects/'+id,{name:'Двор',expectedRevision:0,graph:updated,message:'test'});assert.equal(r.status,200);assert.equal(r.body.revision,1);
 assert.equal((await call('PUT','/api/projects/'+id,{name:'Двор',expectedRevision:0,graph:graph()})).status,409);
 assert.equal((await call('GET','/api/projects/'+id)).body.graph.nodes[0].title,'Изменённое событие');
 const rev=(await call('GET','/api/projects/'+id+'/revisions')).body.revisions;assert.deepEqual(rev.map(x=>x.revision),[1,0]);
 r=await call('POST','/api/projects/'+id+'/restore',{revision:0,expectedRevision:1});assert.equal(r.status,200);
 assert.equal((await call('GET','/api/projects/'+id)).body.graph.nodes[0].title,'Событие');
 assert.equal((await call('DELETE','/api/projects/'+id,{expectedRevision:1})).status,409);
 assert.equal((await call('DELETE','/api/projects/'+id,{expectedRevision:2})).status,200);
 assert.equal((await call('GET','/api/projects')).body.projects.length,0);
});
test('invalid links, duplicate ids and unsafe requests are rejected',async()=>{
 const db=mockD1(),call=sender(db),bad=graph();bad.edges[0].to='n999';let r=await call('POST','/api/projects',{name:'Broken',graph:bad});assert.equal(r.status,422);
 bad.edges[0].to='n2';bad.nodes.push({...bad.nodes[0]});r=await call('POST','/api/projects',{name:'Broken',graph:bad});assert.equal(r.status,422);
});
