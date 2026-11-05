import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCreativeWorkflowGraph,canonicalProjection,previewDraftAcceptance,applyDraftAcceptance,previewStartReplacement,assertProtectedOriginalsUnchanged} from '../src/creative_workflow_contract.mjs';
const clone=x=>structuredClone(x);
function base(){return {nodes:[{id:'n1',title:'Начало',x:0,y:0,status:'proposed'},{id:'n2',title:'Середина',x:220,y:0},{id:'n3',title:'Итог',x:440,y:0}],edges:[{id:'e1',from:'n1',to:'n2',type:'precedes'},{id:'e2',from:'n2',to:'n3',type:'causes'}],fields:[],lanes:[]}}
function drafts(){const g=base();g.workspaces=[{id:'w1',taskId:'task1',x:10,y:200,width:550,height:250}];g.nodes.push(...['a','b','c'].map((id,i)=>({id,title:id,x:i*100,y:250,workspaceId:'w1'})));g.edges.push({id:'ea',from:'a',to:'b',type:'precedes',workspaceId:'w1',draftRelation:'internal'},{id:'eb',from:'b',to:'c',type:'precedes',workspaceId:'w1',draftRelation:'internal'},{id:'ep',from:'n1',to:'a',type:'causes',workspaceId:'w1',draftRelation:'boundary-proposal'});return g}
const bad=(g,code)=>assert.throws(()=>validateCreativeWorkflowGraph(g),e=>e.code===code);
test('old graphs and proposed status remain canonical; optional workflow objects',()=>{const g=base();assert.equal(canonicalProjection(g).nodes.length,3);assert.equal(canonicalProjection(g).nodes[0].status,'proposed')});
test('draft nodes and edges never leak into canonical projection',()=>{const g=drafts();const p=canonicalProjection(g);assert.deepEqual(p.nodes.map(n=>n.id),['n1','n2','n3']);assert.deepEqual(p.edges.map(e=>e.id),['e1','e2']);assert.equal('workspaces' in p,false)});
test('invalid area IDs and missing owners rejected',()=>{const g=drafts();g.workspaces.push({...g.workspaces[0]});bad(g,'WORKSPACE_INVALID');const h=drafts();h.nodes.at(-1).workspaceId='none';bad(h,'WORKSPACE_NOT_FOUND')});
test('malformed bounds and cross-workspace drafts rejected',()=>{const g=drafts();g.workspaces[0].width=-1;bad(g,'WORKSPACE_INVALID');const h=drafts();h.workspaces.push({id:'w2',x:100,y:100,width:200,height:200});h.nodes.at(-1).workspaceId='w2';bad(h,'CROSS_WORKSPACE_EDGE')});
test('unowned plot edge cannot point to draft',()=>{const g=drafts();g.edges.push({id:'oops',from:'n1',to:'a',type:'causes'});bad(g,'CANON_DRAFT_EDGE')});
test('draft edge must have editorial origin and stay owned',()=>{const g=drafts();delete g.edges.at(-1).draftRelation;bad(g,'DRAFT_EDGE_INVALID');const h=drafts();delete h.edges.at(-1).workspaceId;bad(h,'EDGE_INVALID')});
test('accepting a and b promotes only internal a-b; no rewiring',()=>{const g=drafts(),copy=clone(g);const v=previewDraftAcceptance(g,{workspaceId:'w1',nodeIds:['a','b']});assert.deepEqual(v.promoteEdgeIds,['ea']);assert.deepEqual(v.reviewEdgeIds,['eb','ep']);assert.deepEqual(v.autoRewiredEdgeIds,[]);assert.deepEqual(g,copy)});
test('sequential acceptance of c can promote original internal b-c edge',()=>{const g=drafts();for(const n of g.nodes)if(['a','b'].includes(n.id))delete n.workspaceId;const ea=g.edges.find(e=>e.id==='ea');delete ea.workspaceId;delete ea.draftRelation;validateCreativeWorkflowGraph(g);const v=previewDraftAcceptance(g,{workspaceId:'w1',nodeIds:['c']});assert.deepEqual(v.promoteEdgeIds,['eb']);assert.deepEqual(v.reviewEdgeIds,[])});
test('boundary proposal never auto-promotes when endpoints become canonical',()=>{const g=drafts();const n=g.nodes.find(n=>n.id==='a');delete n.workspaceId;const v=previewDraftAcceptance(g,{workspaceId:'w1',nodeIds:['b']});assert.equal(v.promoteEdgeIds.includes('ep'),false);assert.ok(!canonicalProjection(g).edges.some(e=>e.id==='ep'))});
test('cannot select wrong, duplicate or already accepted nodes',()=>{const g=drafts();for(const ids of [['n1'],['a','a'],[],['absent']])assert.throws(()=>previewDraftAcceptance(g,{workspaceId:'w1',nodeIds:ids}),e=>e.code==='SELECTION_INVALID')});
test('partial acceptance leaves legacy canon links untouched',()=>{const g=drafts();const p=previewDraftAcceptance(g,{workspaceId:'w1',nodeIds:['a','b']});assert.deepEqual(p.promoteEdgeIds,['ea']);assert.deepEqual(g.edges.slice(0,2).map(e=>[e.from,e.to,e.type]),[['n1','n2','precedes'],['n2','n3','causes']])});
test('explicit replacement preview identifies all incident edges and changes nothing',()=>{const g=drafts();const before=clone(g);assert.deepEqual(previewStartReplacement(g,['n2']),{sourceNodeIds:['n2'],suspendedEdgeIds:['e1','e2'],autoRewiredEdgeIds:[]});assert.deepEqual(g,before)});
test('retired event and its suspended edges disappear from projection',()=>{const g=drafts();g.replacements=[{id:'r1',state:'open',sourceNodeIds:['n2'],suspendedEdgeIds:['e1','e2']}];const p=canonicalProjection(g);assert.deepEqual(p.nodes.map(n=>n.id),['n1','n3']);assert.deepEqual(p.edges,[])});
test('cannot suspend only one of several old links',()=>{const g=base();g.replacements=[{id:'r',state:'open',sourceNodeIds:['n2'],suspendedEdgeIds:['e1']}];bad(g,'SUSPENSION_INCOMPLETE')});
test('cannot suspend an edge unrelated to replacement',()=>{const g=base();g.replacements=[{id:'r',state:'open',sourceNodeIds:['n3'],suspendedEdgeIds:['e1','e2']}];bad(g,'SUSPENSION_INVALID')});
test('overlapping replacements cannot independently suspend shared edge',()=>{const g=base();g.replacements=[{id:'r1',state:'open',sourceNodeIds:['n1'],suspendedEdgeIds:['e1']},{id:'r2',state:'open',sourceNodeIds:['n2'],suspendedEdgeIds:['e1','e2']}];bad(g,'SUSPENSION_INVALID')});
test('replaced original cannot receive draft plot edge',()=>{const g=drafts();g.replacements=[{id:'r',state:'open',sourceNodeIds:['n2'],suspendedEdgeIds:['e1','e2']}];g.edges.push({id:'ec',from:'n2',to:'a',type:'precedes',workspaceId:'w1',draftRelation:'boundary-proposal'});bad(g,'DRAFT_TO_ORIGINAL')});
test('protect originals from casual node mutations while replacement exists',()=>{const g=base();g.replacements=[{id:'r',state:'open',sourceNodeIds:['n2'],suspendedEdgeIds:['e1','e2']}];const next=clone(g);next.nodes[1].title='Unauthorized';assert.throws(()=>assertProtectedOriginalsUnchanged(g,next),e=>e.code==='ORIGINAL_CHANGED')});
test('protect suspended edge endpoint and type',()=>{const g=base();g.replacements=[{id:'r',state:'open',sourceNodeIds:['n2'],suspendedEdgeIds:['e1','e2']}];const next=clone(g);next.edges[0].from='n3';assert.throws(()=>assertProtectedOriginalsUnchanged(g,next),e=>e.code==='ORIGINAL_CHANGED')});
test('replacing a selected source only by explicit command',()=>{const g=drafts();assert.throws(()=>previewStartReplacement(g,['a']),e=>e.code==='SOURCE_INVALID');assert.deepEqual(previewStartReplacement(g,['n1']).suspendedEdgeIds,['e1'])});
test('ordinary drag geometry never changes canon membership',()=>{const g=drafts();g.nodes.find(n=>n.id==='a').x=9999;g.workspaces[0].x=9999;assert.deepEqual(canonicalProjection(g).nodes.map(n=>n.id),['n1','n2','n3'])});
test('removing workspace is invalid while draft members remain',()=>{const g=drafts();g.workspaces=[];bad(g,'WORKSPACE_NOT_FOUND')});
test('normal graph editable despite unrelated replacement original frozen',()=>{const g=base();g.replacements=[{id:'r',state:'open',sourceNodeIds:['n2'],suspendedEdgeIds:['e1','e2']}];const next=clone(g);next.nodes[2].title='Other text';assert.equal(assertProtectedOriginalsUnchanged(g,next),true)});
test('cannot start a second replacement that shares suspended old edge',()=>{const g=base();g.replacements=[{id:'r',state:'open',sourceNodeIds:['n2'],suspendedEdgeIds:['e1','e2']}];assert.throws(()=>previewStartReplacement(g,['n3']),e=>e.code==='REPLACEMENT_CONFLICT')});

test('drop preview validates and atomically applies exact selected positions and links',()=>{
 const g=drafts(),original=clone(g),nodeIds=['a','b'];
 const placements=[{nodeId:'b',x:750,y:-280},{nodeId:'a',x:510,y:-280}];
 const preview=previewDraftAcceptance(g,{workspaceId:'w1',nodeIds,placements});
 assert.deepEqual(preview.positionChanges.map(x=>x.nodeId),nodeIds,'stable selected order');
 assert.deepEqual(preview.promoteEdgeIds,['ea']);
 assert.deepEqual(preview.reviewEdgeIds,['eb','ep']);
 assert.deepEqual(g,original,'preview is read-only');
 const applied=applyDraftAcceptance(g,{workspaceId:'w1',nodeIds,placements,expectedPreview:preview});
 assert.equal(applied.graph.nodes.find(n=>n.id==='a').x,510);
 assert.equal(applied.graph.nodes.find(n=>n.id==='b').y,-280);
 assert.equal(applied.graph.nodes.find(n=>n.id==='c').workspaceId,'w1');
 assert.equal(applied.graph.nodes.find(n=>n.id==='c').x,200);
 assert.equal(applied.graph.edges.find(e=>e.id==='ea').workspaceId,undefined);
 assert.equal(applied.graph.edges.find(e=>e.id==='eb').workspaceId,'w1');
 assert.deepEqual(applied.graph.edges.slice(0,2),original.edges.slice(0,2));
 assert.deepEqual(g,original,'source remains untouched');
});
test('drop contract rejects missing, duplicate, extra, malformed or unsafe coordinates',()=>{
 const g=drafts(),ids=['a','b'],params={workspaceId:'w1',nodeIds:ids};
 const invalid=[
  [{nodeId:'a',x:4,y:4}],
  [{nodeId:'a',x:4,y:4},{nodeId:'a',x:7,y:5}],
  [{nodeId:'a',x:4,y:4},{nodeId:'c',x:7,y:5}],
  [{nodeId:'a',x:Infinity,y:4},{nodeId:'b',x:7,y:5}],
  [{nodeId:'a',x:4,y:4},{nodeId:'b',x:1_000_001,y:5}],
  [{nodeId:'a',x:4,y:4,workspaceId:'w1'},{nodeId:'b',x:7,y:5}],
 ];
 for(const placements of invalid)
  assert.throws(()=>previewDraftAcceptance(g,{...params,placements}),e=>e.code==='PLACEMENTS_INVALID');
});
test('stale reviewed coordinates reject entire acceptance before any change',()=>{
 const g=drafts(),nodeIds=['a'],placements=[{nodeId:'a',x:510,y:620}];
 const preview=previewDraftAcceptance(g,{workspaceId:'w1',nodeIds,placements});
 assert.throws(()=>applyDraftAcceptance(g,{workspaceId:'w1',nodeIds,
  placements:[{nodeId:'a',x:530,y:620}],expectedPreview:preview}),e=>e.code==='PREVIEW_STALE');
 assert.equal(g.nodes.find(n=>n.id==='a').workspaceId,'w1');
 assert.equal(g.nodes.find(n=>n.id==='a').x,0);
 assert.equal(previewDraftAcceptance(g,{workspaceId:'w1',nodeIds}).positionChanges,undefined,
  'legacy acceptance has no placement requirements');
});
