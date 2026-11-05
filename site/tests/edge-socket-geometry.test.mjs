import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutEdgeSockets,proposeFreeSocket,socketKey} from '../src/edge_socket_geometry.mjs';

const card=(id,x=0,y=0,w=208,h=110)=>({id,x,y,width:w,height:h});
const edgesTo=(n,target='hub')=>Array.from({length:n},(_,i)=>({
 id:'e'+i,from:'source'+i,to:target,type:'precedes'
}));
function fixture(count=3,height=110){
 const nodes=[card('hub',1200,90,260,height),
  ...Array.from({length:count},(_,i)=>card('source'+i,10,i*47,208,105))];
 return {nodes,edges:edgesTo(count)};
}
const all=(layout)=>[...layout.ports.values()].map(p=>({...p}));
const at=(layout,id,role)=>layout.ports.get(socketKey(id,role));

test('each real edge receives its own source and target keys; graph is unchanged',()=>{
 const {nodes,edges}=fixture(3),before=structuredClone({nodes,edges});
 const layout=layoutEdgeSockets({nodes,edges});
 assert.equal(layout.ports.size,6);
 for(const e of edges){
  assert.equal(at(layout,e.id,'source').nodeId,e.from);
  assert.equal(at(layout,e.id,'target').nodeId,e.to);
  assert.notEqual(at(layout,e.id,'source').key,at(layout,e.id,'target').key);
  assert.equal(at(layout,e.id,'source').side,'right');
  assert.equal(at(layout,e.id,'target').side,'left');
 }
 assert.deepEqual({nodes,edges},before);
});

test('1, 2, 3 and 5 inbound sockets occupy unique vertical positions',()=>{
 for(const count of [1,2,3,5]){
  const layout=layoutEdgeSockets(fixture(count,170));
  const ports=layout.byNode.get('hub').incoming;
  assert.equal(ports.length,count);
  const y=ports.map(p=>p.y);
  assert.equal(new Set(y).size,count);
  for(let i=1;i<y.length;i++)assert.ok(y[i]-y[i-1]>=20);
  assert.ok(ports.every(p=>p.nodeId==='hub'&&p.role==='target'));
 }
});

test('overflow rail supports 20 and 100 connections without an artificial limit',()=>{
 for(const count of [20,100]){
  const f=fixture(count,105),layout=layoutEdgeSockets(f);
  const ports=layout.byNode.get('hub').incoming;
  assert.equal(ports.length,count);
  assert.equal(layout.ports.size,count*2);
  assert.equal(layout.warnings.length,1);
  assert.equal(layout.warnings[0].code,'SOCKET_RAIL');
  assert.ok(ports.every(p=>p.rail&&p.x===1184));
  for(let i=1;i<count;i++)assert.ok(ports[i].y-ports[i-1].y>=20);
  assert.equal(new Set(ports.map(p=>p.key)).size,count);
 }
});

test('input edge order does not influence endpoint coordinate or sort',()=>{
 const f=fixture(8,210);
 const a=layoutEdgeSockets(f);
 const b=layoutEdgeSockets({...f,edges:f.edges.slice().reverse()});
 const snap=layout=>[...layout.ports].sort(([x],[y])=>x.localeCompare(y));
 assert.deepEqual(snap(a),snap(b));
});

test('opposite arcs, reverse arrows and mixed outgoing/incoming have distinct port roles',()=>{
 const nodes=[card('a'),card('b',300,50),card('c',600,250)];
 const edges=[
  {id:'e1',from:'a',to:'b'},
  {id:'e2',from:'b',to:'a'},
  {id:'e3',from:'a',to:'c'}
 ];
 const layout=layoutEdgeSockets({nodes,edges});
 assert.equal(layout.byNode.get('a').incoming.length,1);
 assert.equal(layout.byNode.get('a').outgoing.length,2);
 assert.notEqual(at(layout,'e1','source').y,at(layout,'e3','source').y);
 assert.equal(at(layout,'e2','target').nodeId,'a');
 assert.equal(at(layout,'e1','target').nodeId,'b');
});

test('measured bounds determine socket geometry and resize can reflow with unchanged identity',()=>{
 const nodes=[card('x'),card('y',300,20),card('z',350,300)];
 const edges=[{id:'e1',from:'x',to:'y'},{id:'e2',from:'x',to:'z'}];
 const before=layoutEdgeSockets({nodes,edges});
 const resized=layoutEdgeSockets({nodes,edges,bounds:{x:{x:0,y:0,width:330,height:300}}});
 assert.notEqual(at(before,'e1','source').x,at(resized,'e1','source').x);
 assert.notEqual(at(before,'e1','source').y,at(resized,'e1','source').y);
 assert.equal(at(before,'e1','source').key,at(resized,'e1','source').key);
 assert.deepEqual(nodes[0],card('x'),'measurements never change model coordinates');
});

test('scope is carried without cross-writing or changing edge meaning',()=>{
 const nodes=[card('a'),card('b',300,0)];
 const edges=[{id:'d1',from:'a',to:'b',workspaceId:'w1',draftRelation:'internal',type:'hinders'}];
 const l=layoutEdgeSockets({nodes,edges});
 assert.equal(at(l,'d1','source').scope,'w1');
 assert.equal(at(l,'d1','target').scope,'w1');
 assert.equal(edges[0].type,'hinders');
});

test('compact and map modes do not create interactive endpoints',()=>{
 const f=fixture(3);
 for(const mode of ['compact','map']){
  const l=layoutEdgeSockets({...f,mode});
  assert.equal(l.ports.size,0);
  assert.equal(l.byNode.size,0);
 }
});

test('new provisional socket is separate, and does not move occupied endpoints',()=>{
 const f=fixture(5,105);
 const l=layoutEdgeSockets(f);
 const before=all(l);
 const free=proposeFreeSocket({nodeId:'hub',role:'target',layout:l,
  bounds:Object.fromEntries(f.nodes.map(n=>[n.id,n]))});
 assert.equal(free.temporary,true);
 assert.equal(free.nodeId,'hub');
 assert.equal(free.rail,true);
 assert.ok(l.byNode.get('hub').incoming.every(p=>Math.abs(p.y-free.y)>=20));
 assert.deepEqual(all(l),before);
});

test('zero edges and negative coordinates are valid; invalid dimensions reject',()=>{
 const no=layoutEdgeSockets({nodes:[card('lonely',-20000,-30000)],edges:[]});
 assert.equal(no.ports.size,0);
 assert.equal(no.byNode.get('lonely').incoming.length,0);
 assert.throws(()=>layoutEdgeSockets({nodes:[card('bad',0,0,0)],edges:[]}),TypeError);
 assert.throws(()=>layoutEdgeSockets({nodes:[card('bad'),card('bad')],edges:[]}),TypeError);
});

test('duplicate endpoint identities are rejected rather than sharing one socket',()=>{
 const nodes=[card('a'),card('b',400,0)];
 const edges=[{id:'duplicate',from:'a',to:'b'},{id:'duplicate',from:'a',to:'b'}];
 assert.throws(()=>layoutEdgeSockets({nodes,edges}),/Duplicate edge endpoint/);
});
