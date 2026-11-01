/** PA-SPEC-CONSOLIDATION-01 P1: standalone v2 schema validator.
 * Production legacy graph_contract.mjs remains unchanged. This module is not a deployed API.
 */
export const SCHEMA_VERSION = 'plot-architect/v2';
export const PLOT_KINDS = Object.freeze(['event','process','action','decision','state','condition','container']);
export const PLOT_STATUSES = Object.freeze(['draft','proposed','approved','archived']);
export const PLOT_EDGE_TYPES = Object.freeze(['precedes','causes','enables','hinders']);
export const TASK_KINDS = Object.freeze(['gap_note','rewrite_field']);
export const TASK_STATUSES = Object.freeze(['open','variants_ready','regeneration_requested','committed','deleted']);
const enc = new TextEncoder();
export const utf8Bytes = input => enc.encode(typeof input === 'string' ? input : JSON.stringify(input)).length;
export class ContractV2Error extends Error {
  constructor(code,message) { super(message); this.name='ContractV2Error'; this.code=code; }
}
const fail=(code,message)=>{throw new ContractV2Error(code,message)};
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const text=v=>typeof v==='string'&&v.length>0;
const arr=v=>Array.isArray(v);
function keys(v,required,optional=[],ctx='record') {
  if(!obj(v))fail('SCHEMA_INVALID',`${ctx}: object required`);
  for(const k of required)if(!Object.hasOwn(v,k))fail('SCHEMA_INVALID',`${ctx}: ${k} missing`);
  for(const k of Object.keys(v))if(!required.includes(k)&&!optional.includes(k))fail('SCHEMA_UNKNOWN_FIELD',`${ctx}: ${k}`);
}
function id(v,ctx) {if(!text(v)||v.length>128||utf8Bytes(v)>512)fail('INVALID_ID',ctx)}
function unique(records,property,ctx) {
  const seen=new Set();for(const v of records){id(v[property],`${ctx} ID`);if(seen.has(v[property]))fail('DUPLICATE_ID',`${ctx}: ${v[property]}`);seen.add(v[property]);}
  return seen;
}
function rect(v,ctx,minWidth=40,minHeight=30){
  for(const k of ['x','y','width','height'])if(!finite(v[k]))fail('INVALID_GEOMETRY',`${ctx} ${k}`);
  if(v.width<minWidth||v.height<minHeight||v.width>10000||v.height>10000)fail('INVALID_GEOMETRY',ctx);
}
function belongs(v,ids,ctx){if(v!==null&&!ids.has(v))fail('DANGLING_REFERENCE',`${ctx}: ${v}`)}
function checkParentCycles(nodes){
  const parents=new Map(nodes.map(n=>[n.node_id,n.parent_id]));
  for(const n of nodes){const seen=new Set([n.node_id]);let cursor=n.parent_id;while(cursor!==null){if(seen.has(cursor))fail('PARENT_CYCLE',n.node_id);seen.add(cursor);cursor=parents.get(cursor)??null;}}
}
export function validateV2Graph(g) {
  keys(g,['schema_version','project_id','plot_nodes','semantic_fields','edges','editorial_tasks','editorial_notes','editorial_fields','editorial_memberships','node_semantic_pins'],[],'graph');
  if(g.schema_version!==SCHEMA_VERSION)fail('SCHEMA_VERSION_UNSUPPORTED',String(g.schema_version));
  id(g.project_id,'project_id');
  for(const name of ['plot_nodes','semantic_fields','edges','editorial_tasks','editorial_notes','editorial_fields','editorial_memberships','node_semantic_pins'])if(!arr(g[name]))fail('SCHEMA_INVALID',`${name} must be array`);
  const nodes=unique(g.plot_nodes,'node_id','plot node'), fields=unique(g.semantic_fields,'field_id','semantic field');
  const tasks=unique(g.editorial_tasks,'task_id','editorial task');
  const notes=unique(g.editorial_notes,'note_id','editorial note');
  unique(g.editorial_fields,'editorial_field_id','editorial field');unique(g.edges,'edge_id','edge');
  for(const n of g.plot_nodes){
    keys(n,['node_id','title','kind','status','parent_id','x','y','width','height'],['description','manual_tags'],'plot node');
    if(!PLOT_KINDS.includes(n.kind))fail('INVALID_PLOT_KIND',String(n.kind));
    if(!PLOT_STATUSES.includes(n.status))fail('INVALID_PLOT_STATUS',String(n.status));
    if(!text(n.title)||utf8Bytes(n.title)>1600||n.description!==undefined&&(typeof n.description!=='string'||utf8Bytes(n.description)>160000))fail('INVALID_TEXT','plot node');
    if(n.parent_id!==null)id(n.parent_id,'node.parent_id');
    belongs(n.parent_id,nodes,'node parent');rect(n,'plot node',180,95);
    if(n.manual_tags!==undefined&&(!arr(n.manual_tags)||n.manual_tags.some(t=>typeof t!=='string')))fail('INVALID_TAGS',n.node_id);
  }
  checkParentCycles(g.plot_nodes);
  for(const f of g.semantic_fields){
    keys(f,['field_id','title','parent_id','assignment_mode','x','y','width','height'],['comment'],'semantic field');
    if(!text(f.title)||!['auto','manual','mixed'].includes(f.assignment_mode))fail('INVALID_SEMANTIC_FIELD',f.field_id);
    belongs(f.parent_id,nodes,'semantic field parent');rect(f,'semantic field',100,80);
  }
  for(const t of g.editorial_tasks){
    keys(t,['task_id','kind','status','offer_variants','task_revision'],['title','active_set_id'],'editorial task');
    if(!TASK_KINDS.includes(t.kind)||!TASK_STATUSES.includes(t.status)||typeof t.offer_variants!=='boolean'||!Number.isSafeInteger(t.task_revision)||t.task_revision<0)fail('INVALID_EDITORIAL_TASK',t.task_id);
    if(t.title!==undefined&&(!text(t.title)||utf8Bytes(t.title)>1600))fail('INVALID_EDITORIAL_TASK','title');
  }
  const taskKinds=new Map(g.editorial_tasks.map(t=>[t.task_id,t.kind]));
  const gapAnchorCount=new Map(),fieldCount=new Map();
  for(const n of g.editorial_notes){
    keys(n,['note_id','task_id','role','text','parent_id','x','y','width','height'],[],'editorial note');
    belongs(n.task_id,tasks,'note task');belongs(n.parent_id,nodes,'note parent');rect(n,'editorial note',140,80);
    if(!['task_anchor','instruction'].includes(n.role)||typeof n.text!=='string'||utf8Bytes(n.text)>160000)fail('INVALID_EDITORIAL_NOTE',n.note_id);
    if(n.role==='task_anchor'){
      if(taskKinds.get(n.task_id)!=='gap_note')fail('INVALID_EDITORIAL_ROLE',n.note_id);
      gapAnchorCount.set(n.task_id,(gapAnchorCount.get(n.task_id)??0)+1);
    } else if(taskKinds.get(n.task_id)!=='rewrite_field')fail('INVALID_EDITORIAL_ROLE',n.note_id);
  }
  for(const f of g.editorial_fields){
    keys(f,['editorial_field_id','task_id','title','parent_id','x','y','width','height'],['color_token'],'editorial field');
    belongs(f.task_id,tasks,'editorial field task');belongs(f.parent_id,nodes,'editorial field parent');rect(f,'editorial field',100,80);
    if(taskKinds.get(f.task_id)!=='rewrite_field'||!text(f.title))fail('INVALID_EDITORIAL_FIELD',f.editorial_field_id);
    fieldCount.set(f.task_id,(fieldCount.get(f.task_id)??0)+1);
  }
  for(const t of g.editorial_tasks){
    if(t.kind==='gap_note'&&(gapAnchorCount.get(t.task_id)??0)!==1)fail('EDITORIAL_CARDINALITY',t.task_id);
    if(t.kind==='rewrite_field'&&(fieldCount.get(t.task_id)??0)!==1)fail('EDITORIAL_CARDINALITY',t.task_id);
  }
  const memberships=new Set();
  for(const m of g.editorial_memberships){
    keys(m,['task_id','node_id'],['source'],'editorial membership');belongs(m.task_id,tasks,'membership task');belongs(m.node_id,nodes,'membership node');
    if(taskKinds.get(m.task_id)!=='rewrite_field')fail('INVALID_MEMBERSHIP',m.task_id);
    const key=`${m.task_id}\0${m.node_id}`;if(memberships.has(key))fail('DUPLICATE_MEMBERSHIP',key);memberships.add(key);
  }
  const pins=new Set();
  for(const p of g.node_semantic_pins){
    keys(p,['node_id','field_id'],[],'semantic pin');belongs(p.node_id,nodes,'pin node');belongs(p.field_id,fields,'pin field');
    const key=`${p.node_id}\0${p.field_id}`;if(pins.has(key))fail('DUPLICATE_PIN',key);pins.add(key);
  }
  const endpoints={plot_node:nodes,editorial_note:notes,semantic_field:fields};
  for(const e of g.edges){
    keys(e,['edge_id','relation_scope','source','target','type'],[],'edge');
    for(const side of ['source','target']){
      const end=e[side];keys(end,['kind','id'],[],'endpoint');
      if(!endpoints[end.kind]||!endpoints[end.kind].has(end.id))fail('DANGLING_ENDPOINT',`${e.edge_id}:${side}`);
    }
    if(e.source.kind===e.target.kind&&e.source.id===e.target.id)fail('EDGE_SELF_LINK',e.edge_id);
    if(e.relation_scope==='plot'){
      if(e.source.kind!=='plot_node'||e.target.kind!=='plot_node'||!PLOT_EDGE_TYPES.includes(e.type))fail('INVALID_PLOT_EDGE',e.edge_id);
    }else if(e.relation_scope==='editorial'){
      if(e.type!==null||!['editorial_note','plot_node','semantic_field'].includes(e.source.kind)||!['editorial_note','plot_node','semantic_field'].includes(e.target.kind)||e.source.kind!=='editorial_note'&&e.target.kind!=='editorial_note')fail('INVALID_EDITORIAL_EDGE',e.edge_id);
    }else fail('INVALID_RELATION_SCOPE',e.edge_id);
  }
  return g;
}
export function createEmptyV2Graph(projectId){
  id(projectId,'projectId');return {schema_version:SCHEMA_VERSION,project_id:projectId,plot_nodes:[],semantic_fields:[],edges:[],editorial_tasks:[],editorial_notes:[],editorial_fields:[],editorial_memberships:[],node_semantic_pins:[]};
}
/** Explicit read-only adapter; no legacy write, migration or ID reassignment. */
export function importLegacyForInspection(g,projectId='legacy-preview'){
  if(!obj(g)||!arr(g.nodes)||!arr(g.edges)||!arr(g.fields))fail('LEGACY_FORMAT_INVALID','legacy graph');
  const out=createEmptyV2Graph(projectId);
  for(const n of g.nodes){
    const kind=n.kind??'event';if(!PLOT_KINDS.includes(kind))fail('LEGACY_UNSUPPORTED_KIND',String(kind));
    out.plot_nodes.push({node_id:n.id,title:n.title,description:n.description??'',kind,status:n.status??'approved',parent_id:n.parent??null,x:n.x,y:n.y,width:n.width??270,height:n.height??130,manual_tags:n.manualTags??[]});
  }
  out.semantic_fields=g.fields.map(f=>({field_id:f.id,title:f.title,parent_id:f.parent??null,assignment_mode:f.assignmentMode??'auto',x:f.x,y:f.y,width:f.width,height:f.height,comment:f.comment??''}));
  out.edges=g.edges.map(e=>({edge_id:e.id,relation_scope:'plot',source:{kind:'plot_node',id:e.from},target:{kind:'plot_node',id:e.to},type:e.type}));
  for(const n of g.nodes)for(const fieldId of n.manualFieldIds??[])out.node_semantic_pins.push({node_id:n.id,field_id:fieldId});
  return validateV2Graph(out);
}
export function effectiveSemanticMembership(graph,nodeId,bounds=null){
  const n=graph.plot_nodes.find(x=>x.node_id===nodeId);if(!n)fail('DANGLING_REFERENCE',nodeId);
  const p=new Set(graph.node_semantic_pins.filter(x=>x.node_id===nodeId).map(x=>x.field_id));
  const r={...n,...bounds};const cx=r.x+r.width/2,cy=r.y+r.height/2;
  for(const f of graph.semantic_fields)if(f.parent_id===n.parent_id&&['auto','mixed'].includes(f.assignment_mode)&&cx>=f.x&&cx<f.x+f.width&&cy>=f.y&&cy<f.y+f.height)p.add(f.field_id);
  return [...p].sort();
}
export function previewGroupTransfer(graph,nodeIds,dx,dy){
  const ids=new Set(nodeIds);if(ids.size!==nodeIds.length||!ids.size||!finite(dx)||!finite(dy))fail('INVALID_MOVE','move request');
  const items=graph.plot_nodes.filter(x=>ids.has(x.node_id));if(items.length!==ids.size)fail('DANGLING_REFERENCE','selected node');
  if(new Set(items.map(x=>x.parent_id)).size!==1)fail('CROSS_PARENT_MOVE','selected nodes');
  const loss=[];const gained=[];
  for(const n of items){const before=new Set(effectiveSemanticMembership(graph,n.node_id));const after=new Set(effectiveSemanticMembership(graph,n.node_id,{x:n.x+dx,y:n.y+dy}));
    for(const f of before)if(!after.has(f))loss.push({node_id:n.node_id,field_id:f});
    for(const f of after)if(!before.has(f))gained.push({node_id:n.node_id,field_id:f});
  }
  return {moved_ids:[...ids],dx,dy,lost_semantic_ids:loss,gained_semantic_ids:gained,requires_confirmation:loss.length>0};
}
/** Validate sealed variant structure; boundary coverage must be exact. */
export function validatePreparedVariant(graph,variant,taskId){
  keys(variant,['schema_version','variant_id','task_id','source_node_ids','new_nodes','new_edges','boundary_decisions','semantic_pin_plan','placement_constraints'],['review_flags','source_project_revision','task_revision','context_fingerprint','payload_sha256'],'variant');
  if(variant.schema_version!==SCHEMA_VERSION||variant.task_id!==taskId)fail('VARIANT_SCHEMA_INVALID','task/schema mismatch');
  if(!arr(variant.source_node_ids)||!arr(variant.new_nodes)||!arr(variant.new_edges)||!arr(variant.boundary_decisions)||!arr(variant.semantic_pin_plan)||!obj(variant.placement_constraints))fail('VARIANT_SCHEMA_INVALID','invalid arrays/placement');
  const task=graph.editorial_tasks.find(t=>t.task_id===taskId);if(!task)fail('DANGLING_REFERENCE','task');
  const selected=new Set(graph.editorial_memberships.filter(x=>x.task_id===taskId).map(x=>x.node_id));
  if(task.kind==='gap_note'&&variant.source_node_ids.length)fail('VARIANT_SOURCE_MISMATCH','gap note must not replace plot events');
  if(task.kind==='rewrite_field'&&(variant.source_node_ids.length!==selected.size||new Set(variant.source_node_ids).size!==selected.size||variant.source_node_ids.some(x=>!selected.has(x))))fail('VARIANT_SOURCE_MISMATCH','rewrite scope differs');
  const newIds=unique(variant.new_nodes,'temp_id','variant temp node');
  for(const n of variant.new_nodes){if(!text(n.title)||!PLOT_KINDS.includes(n.kind)||n.kind==='note')fail('VARIANT_NODE_INVALID','invalid node');}
  for(const e of variant.new_edges){if(!newIds.has(e.from)||!newIds.has(e.to)||!PLOT_EDGE_TYPES.includes(e.type)||e.from===e.to)fail('VARIANT_EDGE_INVALID','invalid internal edge');}
  const boundary=graph.edges.filter(e=>e.relation_scope==='plot'&&(selected.has(e.source.id)!==selected.has(e.target.id)));
  const required=new Set(boundary.map(e=>e.edge_id));
  const seen=new Set();
  for(const d of variant.boundary_decisions){
    if(!required.has(d.edge_id)||seen.has(d.edge_id))fail('VARIANT_BOUNDARY_INVALID',d.edge_id);
    seen.add(d.edge_id);
    if(!['rewire','keep','drop','review'].includes(d.decision))fail('VARIANT_BOUNDARY_INVALID','decision');
    if(['drop','rewire','keep'].includes(d.decision)&&!text(d.rationale))fail('VARIANT_BOUNDARY_INVALID','rationale');
    if(d.decision==='rewire'&&!newIds.has(d.new_endpoint_temp_id))fail('VARIANT_BOUNDARY_INVALID','endpoint');
  }
  if(seen.size!==required.size)fail('VARIANT_BOUNDARY_INCOMPLETE',`${seen.size}/${required.size}`);
  if(variant.boundary_decisions.some(x=>x.decision==='review'))return {valid:false,review_required:true,boundary_count:required.size};
  return {valid:true,review_required:false,boundary_count:required.size};
}
