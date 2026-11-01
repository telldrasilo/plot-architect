import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateGraph} from '../src/graph_contract.mjs';

const editor=readFileSync(new URL('../src/editor.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

function synthetic(){
  return {
    version:1,revision:0,nextNode:2,nextEdge:1,nextField:1,nextLine:2,
    view:null,
    lanes:[{id:'l1',title:'Synthetic line',color:'#b8a16e',y:100}],
    nodes:[{id:'n1',title:'Synthetic event',description:'No real user data',x:120,y:140,
      lineIds:['l1'],parent:null,size:'normal',width:325,height:180,color:'#8a9d83'}],
    edges:[],fields:[],
    eventRewrites:[{nodeId:'n1',baseRevision:0,taskText:'Synthetic rewrite task',offerVariants:true,status:'pending'}],
    editorialFields:[{id:'ef1',title:'Synthetic work',memberIds:['n1']}],
    gapNotes:[{id:'gn1',text:'Synthetic note'}],
    editorialNotes:[{fieldId:'ef1',text:'Synthetic note 2'}],
    gapLinks:[]
  };
}

test('Release A: graph validation preserves visual and editorial overlay fields on synthetic roundtrip',()=>{
  const g=synthetic();
  const valid=validateGraph(g);
  const saved=JSON.parse(JSON.stringify(valid));
  const loaded=validateGraph(saved);
  assert.deepEqual(loaded.eventRewrites,g.eventRewrites);
  assert.deepEqual(loaded.editorialFields,g.editorialFields);
  assert.deepEqual(loaded.gapNotes,g.gapNotes);
  assert.deepEqual(loaded.editorialNotes,g.editorialNotes);
  for(const key of ['width','height','color'])assert.equal(loaded.nodes[0][key],g.nodes[0][key]);
  assert.equal(loaded.nodes[0].description,'No real user data');
});

test('Release A: standalone HTML includes exact editor source',()=>{
  assert.ok(editor.length>1000);
  assert.ok(html.includes(editor),'inline editor script must match src/editor.js exactly');
});

test('Release A: single-event rewrite cannot start while remote-connected',()=>{
  const start=editor.indexOf('function beginEventRewrite(id){');
  assert.ok(start>=0,'beginEventRewrite must exist');
  const near=editor.slice(start,start+380);
  assert.match(near,/if\(remote\.connected\)return/,'connected Site must block local-only event rewrite');
});

// Include the first-connect safety regression in the CI preflight suite.
import './release-a-empty-bootstrap.test.mjs';
