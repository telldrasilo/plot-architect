import test from 'node:test';
import assert from 'node:assert/strict';
import {validateV2Graph,createEmptyV2Graph,importLegacyForInspection,previewGroupTransfer,effectiveSemanticMembership,validatePreparedVariant,utf8Bytes} from '../src/editorial_contract.mjs';
import {validateGraph} from '../src/graph_contract.mjs';
const clone=x=>structuredClone(x);
function fixture(){
 const g=createEmptyV2Graph('synthetic-p1');
 g.plot_nodes=[
 {node_id:'a',title:'Начало',kind:'event',status:'draft',parent_id:null,x:0,y:10,width:200,height:100},
 {node_id:'b',title:'Центр',kind:'event',status:'draft',parent_id:null,x:260,y:10,width:200,height:100},
 {node_id:'c',title:'Выход',kind:'event',status:'draft',parent_id:null,x:530,y:10,width:200,height:100}];
 g.semantic_fields=[{field_id:'sf',title:'Государство',parent_id:null,assignment_mode:'auto',x:0,y:0,width:500,height:250}];
 g.editorial_tasks=[
 {task_id:'gap',kind:'gap_note',status:'open',offer_variants:true,task_revision:0},
 {task_id:'rewrite',kind:'rewrite_field',status:'open',offer_variants:true,task_revision:0}];
 g.editorial_notes=[
 {note_id:'note-gap',task_id:'gap',role:'task_anchor',text:'Добавить интригу',parent_id:null,x:100,y:350,width:220,height:100},
 {note_id:'instruction',task_id:'rewrite',role:'instruction',text:'Переделать середину',parent_id:null,x:400,y:350,width:220,height:100}];
 g.editorial_fields=[{editorial_field_id:'ef',task_id:'rewrite',title:'На переработку',parent_id:null,x:230,y:0,width:300,height:220}];
 g.editorial_memberships=[{task_id:'rewrite',node_id:'b',source:'explicit'}];
 g.edges=[
 {edge_id:'e1',relation_scope:'plot',source:{kind:'plot_node',id:'a'},target:{kind:'plot_node',id:'b'},type:'precedes'},
 {edge_id:'e2',relation_scope:'plot',source:{kind:'plot_node',id:'b'},target:{kind:'plot_node',id:'c'},type:'causes'},
 {edge_id:'e3',relation_scope:'editorial',source:{kind:'editorial_note',id:'note-gap'},target:{kind:'semantic_field',id:'sf'},type:null},
 {edge_id:'e4',relation_scope:'editorial',source:{kind:'editorial_note',id:'note-gap'},target:{kind:'editorial_note',id:'instruction'},type:null}];
 return g;
}
function variant(){return {schema_version:'plot-architect/v2',variant_id:'v1',task_id:'rewrite',source_node_ids:['b'],new_nodes:[{temp_id:'b-new',title:'Середина',kind:'event'}],new_edges:[],boundary_decisions:[{edge_id:'e1',decision:'rewire',new_endpoint_temp_id:'b-new',rationale:'Вход'}, {edge_id:'e2',decision:'rewire',new_endpoint_temp_id:'b-new',rationale:'Выход'}],semantic_pin_plan:[],placement_constraints:{prefer:'vertical'}}}
const rejects=(x,code)=>assert.throws(()=>validateV2Graph(x),e=>e?.code===code,`expected ${code}`);
test('P1 baseline RED: old contract mistakenly accepts unsupported edge types and plot note',()=>{
 const legacy={nodes:[{id:'a',title:'A',description:'',x:0,y:0},{id:'b',title:'B',description:'',x:300,y:0}],edges:[{id:'e',from:'a',to:'b',type:'anything'}],fields:[],lanes:[]};
 assert.equal(validateGraph(legacy).edges[0].type,'anything');
 legacy.nodes[0].kind='note';assert.equal(validateGraph(legacy).nodes[0].kind,'note');
});
test('P1 valid mixed plot + editorial graph, field and note links, typed direction',()=>{
 const result=validateV2Graph(fixture());assert.equal(result.edges.length,4);assert.equal(result.editorial_tasks.length,2);
});
test('P1 reject note as plot node, unsupported plot edge, and scope masquerading',()=>{
 const a=fixture();a.plot_nodes[0].kind='note';rejects(a,'INVALID_PLOT_KIND');
 const b=fixture();b.edges[0].type='anything';rejects(b,'INVALID_PLOT_EDGE');
 const c=fixture();c.edges[2].relation_scope='plot';rejects(c,'INVALID_PLOT_EDGE');
 const d=fixture();d.edges[2].type='causes';rejects(d,'INVALID_EDITORIAL_EDGE');
});
test('P1 editor links require note on at least one endpoint and forbid editorial field endpoint',()=>{
 const a=fixture();a.edges[2].source={kind:'plot_node',id:'a'};rejects(a,'INVALID_EDITORIAL_EDGE');
 const b=fixture();b.edges[2].target={kind:'editorial_field',id:'ef'};rejects(b,'DANGLING_ENDPOINT');
 const c=fixture();c.edges[2].target={kind:'plot_node',id:'c'};validateV2Graph(c);
});
test('P1 enforce exact task anchors and unique rewrite field',()=>{
 const a=fixture();a.editorial_notes=a.editorial_notes.filter(n=>n.note_id!=='note-gap');rejects(a,'EDITORIAL_CARDINALITY');
 const b=fixture();b.editorial_fields.push({...b.editorial_fields[0],editorial_field_id:'ef2'});rejects(b,'EDITORIAL_CARDINALITY');
});
test('P1 reject dangling endpoints, overlapping bad membership, duplicated pin',()=>{
 const a=fixture();a.edges[0].source.id='missing';rejects(a,'DANGLING_ENDPOINT');
 const b=fixture();b.editorial_memberships.push({...b.editorial_memberships[0]});rejects(b,'DUPLICATE_MEMBERSHIP');
 const c=fixture();c.node_semantic_pins=[{node_id:'a',field_id:'sf'},{node_id:'a',field_id:'sf'}];rejects(c,'DUPLICATE_PIN');
});
test('P1 no silent extra keys or stale schema',()=>{
 const a=fixture();a.plot_nodes[0].unknown=true;rejects(a,'SCHEMA_UNKNOWN_FIELD');
 const b=fixture();b.schema_version='plot-architect/v1';rejects(b,'SCHEMA_VERSION_UNSUPPORTED');
});
test('P1 reject cycles and cross-parent geometry errors',()=>{
 const a=fixture();a.plot_nodes[0].parent_id='b';a.plot_nodes[1].parent_id='a';rejects(a,'PARENT_CYCLE');
 const b=fixture();b.semantic_fields[0].width=0;rejects(b,'INVALID_GEOMETRY');
});
test('P1 auto semantic tags can be preserved as manual pins, no tag loss after move',()=>{
 const g=fixture();const moved=previewGroupTransfer(g,['b'],600,300);
 assert.deepEqual(moved.lost_semantic_ids,[{node_id:'b',field_id:'sf'}]);assert.equal(moved.requires_confirmation,true);
 g.node_semantic_pins.push({node_id:'b',field_id:'sf'});
 assert.deepEqual(previewGroupTransfer(g,['b'],600,300).lost_semantic_ids,[]);
 assert.deepEqual(effectiveSemanticMembership(g,'b',{x:860,y:310}),['sf']);
});
test('P1 group transfer rejects cross-parent and unknown selected IDs',()=>{
 const g=fixture();g.plot_nodes.push({node_id:'parent',title:'Container',kind:'container',status:'draft',parent_id:null,x:800,y:0,width:200,height:100});
 g.plot_nodes[1].parent_id='parent';assert.throws(()=>previewGroupTransfer(g,['a','b'],1,1),x=>x.code==='CROSS_PARENT_MOVE');
 assert.throws(()=>previewGroupTransfer(g,['none'],1,1),x=>x.code==='DANGLING_REFERENCE');
});
test('P1 sealed rewrite plans require exhaustive boundary decisions and actual replacement endpoints',()=>{
 const g=fixture();assert.equal(validatePreparedVariant(g,variant(),'rewrite').boundary_count,2);
 const incomplete=variant();incomplete.boundary_decisions.pop();assert.throws(()=>validatePreparedVariant(g,incomplete,'rewrite'),e=>e.code==='VARIANT_BOUNDARY_INCOMPLETE');
 const bad=variant();bad.boundary_decisions[0].new_endpoint_temp_id='absent';assert.throws(()=>validatePreparedVariant(g,bad,'rewrite'),e=>e.code==='VARIANT_BOUNDARY_INVALID');
 const review=variant();review.boundary_decisions[0].decision='review';assert.equal(validatePreparedVariant(g,review,'rewrite').review_required,true);
});
test('P1 legacy importer is read-only and preserves source; unsupported kind not silently reclassified',()=>{
 const legacy={nodes:[{id:'n1',title:'Начало',x:0,y:0},{id:'n2',title:'Дальше',x:300,y:0}],edges:[{id:'e1',from:'n1',to:'n2',type:'precedes'}],fields:[]};const before=clone(legacy);
 const v2=importLegacyForInspection(legacy,'preview');assert.equal(v2.plot_nodes[0].kind,'event');assert.deepEqual(legacy,before);
 legacy.nodes[0].kind='strange';assert.throws(()=>importLegacyForInspection(legacy,'preview'),e=>e.code==='LEGACY_UNSUPPORTED_KIND');
});
test('P1 UTF-8 lengths correctly count multibyte Russian',()=>{assert.equal(utf8Bytes('тест'),8);assert.equal(utf8Bytes('abc'),3)});
