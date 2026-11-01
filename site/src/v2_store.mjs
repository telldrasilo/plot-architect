/** P2 isolated normalized storage spike. No routes, no deployment, no legacy SQL writes. */
import {createHash} from 'node:crypto';
import {validateV2Graph,utf8Bytes} from './editorial_contract.mjs';
export class V2StoreError extends Error {constructor(code,message){super(message);this.code=code;this.name='V2StoreError'}}
const err=(code,msg)=>{throw new V2StoreError(code,msg)};
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const iso=()=>new Date().toISOString();
const p=(db,sql,...values)=>db.prepare(sql).bind(...values);
const first=async(db,sql,...values)=>await p(db,sql,...values).first();
const all=async(db,sql,...values)=>(await p(db,sql,...values).all()).results;
export async function newProject(db,{project_id,owner_id,name}) {
 if(!project_id||!owner_id||!name)err('INVALID_INPUT','project_id, owner_id, name required');
 const t=iso();await p(db,`INSERT INTO projects_v2(project_id,owner_id,name,revision,schema_version,created_at,updated_at) VALUES(?,?,?,0,'plot-architect/v2',?,?)`,project_id,owner_id,name,t,t).run();
 return {project_id,revision:0};
}
export async function getProjectRevision(db,projectId,ownerId){
 const result=await first(db,'SELECT revision FROM projects_v2 WHERE project_id=? AND owner_id=?',projectId,ownerId);
 if(!result)err('PROJECT_NOT_FOUND','project not found / not authorized');return result.revision;
}
export async function insertSyntheticGraph(db,graph){
 validateV2Graph(graph); // only synthetic fixture setup in a disposable DB
 const id=graph.project_id;
 const stmts=[];
 for(const n of graph.plot_nodes)stmts.push(p(db,'INSERT INTO plot_nodes_v2(project_id,node_id,parent_id,title,description,kind,status,x,y,width,height) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,n.node_id,n.parent_id,n.title,n.description??'',n.kind,n.status,n.x,n.y,n.width,n.height));
 for(const f of graph.semantic_fields)stmts.push(p(db,'INSERT INTO semantic_fields_v2(project_id,field_id,parent_id,title,assignment_mode,x,y,width,height) VALUES(?,?,?,?,?,?,?,?,?)',id,f.field_id,f.parent_id,f.title,f.assignment_mode,f.x,f.y,f.width,f.height));
 for(const t of graph.editorial_tasks)stmts.push(p(db,'INSERT INTO editorial_tasks_v2(project_id,task_id,kind,status,title,offer_variants,task_revision,created_seq) VALUES(?,?,?,?,?,?,?,?)',id,t.task_id,t.kind,t.status,t.title??'',t.offer_variants?1:0,t.task_revision,graph.editorial_tasks.indexOf(t)));
 for(const n of graph.editorial_notes)stmts.push(p(db,'INSERT INTO editorial_notes_v2(project_id,note_id,task_id,role,body,parent_id,x,y,width,height) VALUES(?,?,?,?,?,?,?,?,?,?)',id,n.note_id,n.task_id,n.role,n.text,n.parent_id,n.x,n.y,n.width,n.height));
 for(const f of graph.editorial_fields)stmts.push(p(db,'INSERT INTO editorial_fields_v2(project_id,editorial_field_id,task_id,title,parent_id,x,y,width,height) VALUES(?,?,?,?,?,?,?,?,?)',id,f.editorial_field_id,f.task_id,f.title,f.parent_id,f.x,f.y,f.width,f.height));
 for(const m of graph.editorial_memberships)stmts.push(p(db,'INSERT INTO editorial_memberships_v2(project_id,task_id,node_id,source) VALUES(?,?,?,?)',id,m.task_id,m.node_id,m.source??'explicit'));
 for(const m of graph.node_semantic_pins)stmts.push(p(db,'INSERT INTO node_semantic_pins_v2(project_id,node_id,field_id) VALUES(?,?,?)',id,m.node_id,m.field_id));
 for(const e of graph.edges)stmts.push(p(db,'INSERT INTO edges_v2(project_id,edge_id,relation_scope,source_kind,source_id,target_kind,target_id,edge_type) VALUES(?,?,?,?,?,?,?,?)',id,e.edge_id,e.relation_scope,e.source.kind,e.source.id,e.target.kind,e.target.id,e.type));
 if(stmts.length)await db.batch(stmts);
 return {inserted:stmts.length};
}
/** Read bounded rows only. Opaque cursor bound to project + filter (not cryptographically authenticated). */
function encodeCursor(o){return Buffer.from(JSON.stringify(o)).toString('base64url')}
function decodeCursor(s){try{const o=JSON.parse(Buffer.from(s,'base64url').toString());if(!o||typeof o!=='object')throw Error();return o}catch{err('INVALID_CURSOR','bad cursor')}}
function pageLimit(limit){if(!Number.isInteger(limit)||limit<1||limit>250)err('INVALID_PAGE_LIMIT','1..250');return limit}
export async function getNodes(db,{project_id,owner_id,cursor=null,limit=100,parent_id=null}){
 const rev=await getProjectRevision(db,project_id,owner_id);const cap=pageLimit(limit);
 let after='';if(cursor){const c=decodeCursor(cursor);if(c.project_id!==project_id||c.parent_id!==parent_id||c.revision!==rev)err('STALE_CURSOR','cursor does not match project/filter/revision');after=c.after;}
 const rows=await all(db,`SELECT node_id,title,kind,status,parent_id,x,y,width,height FROM plot_nodes_v2 WHERE project_id=? AND parent_id IS ? AND node_id>? ORDER BY node_id LIMIT ?`,project_id,parent_id,after,cap+1);
 const hasMore=rows.length>cap;const items=rows.slice(0,cap);
 return {project_id,revision:rev,nodes:items,truncated:hasMore,next_cursor:hasMore?encodeCursor({project_id,parent_id,revision:rev,after:items.at(-1).node_id}):null};
}
export async function getViewport(db,{project_id,owner_id,parent_id=null,bounds,limit=100,cursor=null}){
 const rev=await getProjectRevision(db,project_id,owner_id);const cap=pageLimit(limit);
 if(!bounds||!['x','y','width','height'].every(k=>Number.isFinite(bounds[k]))||bounds.width<=0||bounds.height<=0)err('INVALID_BOUNDS','viewport');
 const signature=hash({project_id,parent_id,bounds});let afterX=bounds.x-10000,afterId='';
 if(cursor){const c=decodeCursor(cursor);if(c.project_id!==project_id||c.signature!==signature||c.revision!==rev)err('STALE_CURSOR','viewport changed');afterX=c.afterX;afterId=c.afterId;}
 // width<=10000 (v2 contract), so x >= left-10000 safely excludes non-overlapping rows.
 // Index idx_v2_nodes_xy permits bounded spatial search instead of a full project scan.
 const rows=await all(db,`SELECT node_id,title,x,y,width,height,kind,status FROM plot_nodes_v2 INDEXED BY idx_v2_nodes_xy
 WHERE project_id=? AND parent_id IS ? AND x>=? AND x<?
   AND (x>? OR (x=? AND node_id>?))
   AND x+width>? AND y<? AND y+height>?
 ORDER BY x,node_id LIMIT ?`,project_id,parent_id,bounds.x-10000,bounds.x+bounds.width,afterX,afterX,afterId,bounds.x,bounds.y+bounds.height,bounds.y,cap+1);
 const items=rows.slice(0,cap);const more=rows.length>cap;
 return {project_id,revision:rev,nodes:items,truncated:more,next_cursor:more?encodeCursor({project_id,revision:rev,signature,afterX:items.at(-1).x,afterId:items.at(-1).node_id}):null};
}

export async function listPendingTasks(db,{project_id,owner_id,limit=50,cursor=null}){
 const rev=await getProjectRevision(db,project_id,owner_id),cap=pageLimit(limit);
 let created=-1,after='';if(cursor){const c=decodeCursor(cursor);if(c.project_id!==project_id||c.revision!==rev)err('STALE_CURSOR','task queue changed');created=c.created;after=c.after;}
 const rows=await all(db,`SELECT task_id,kind,status,title,task_revision,created_seq FROM editorial_tasks_v2 WHERE project_id=? AND status IN ('open','regeneration_requested') AND (created_seq>? OR (created_seq=? AND task_id>?)) ORDER BY created_seq,task_id LIMIT ?`,project_id,created,created,after,cap+1);
 const items=rows.slice(0,cap);const more=rows.length>cap;
 return {tasks:items,revision:rev,truncated:more,next_cursor:more?encodeCursor({project_id,revision:rev,created:items.at(-1).created_seq,after:items.at(-1).task_id}):null};
}
/** Synthetic, non-destructive atomic commit demonstration.
 * Runs prepared statements in ONE D1 db.batch transaction. Receipt trigger turns bad CAS into SQL ABORT.
 * Not a production commit_task_variant or a general auth endpoint.
 */
export async function commitSyntheticAddNode(db,{project_id,owner_id,expected_revision,operation_id,node,force_failure=false}){
 if(!operation_id||!node?.node_id||!node.title||!Number.isSafeInteger(expected_revision))err('INVALID_INPUT','commit');
 await getProjectRevision(db,project_id,owner_id);
 const canonical={project_id,expected_revision,node,force_failure},digest=hash(canonical);
 const existing=await first(db,'SELECT request_digest,result_json FROM operation_receipts_v2 WHERE project_id=? AND operation_id=?',project_id,operation_id);
 if(existing){if(existing.request_digest!==digest)err('IDEMPOTENCY_CONFLICT','same operation ID with different payload');return JSON.parse(existing.result_json)}
 const result={project_id,operation_id,committed_revision:expected_revision+1,node_id:node.node_id};const when=iso();
 const statements=[
   p(db,'INSERT INTO operation_receipts_v2(project_id,operation_id,request_digest,expected_revision,committed_revision,result_json,created_at) VALUES(?,?,?,?,?,?,?)',project_id,operation_id,digest,expected_revision,expected_revision+1,JSON.stringify(result),when),
   p(db,'INSERT INTO plot_nodes_v2(project_id,node_id,parent_id,title,description,kind,status,x,y,width,height) VALUES(?,?,?,?,?,?,?,?,?,?,?)',project_id,node.node_id,null,node.title,node.description??'',node.kind??'event','proposed',node.x,node.y,node.width??230,node.height??120),
   p(db,'UPDATE projects_v2 SET revision=revision+1,updated_at=? WHERE project_id=? AND revision=?',when,project_id,expected_revision),
   p(db,'INSERT INTO changes_v2(project_id,revision,operation_id,actor,summary,created_at) VALUES(?,?,?,?,?,?)',project_id,expected_revision+1,operation_id,'synthetic','add node',when),
   p(db,'INSERT INTO change_items_v2(project_id,revision,seq,forward_json,inverse_json) VALUES(?,?,?,?,?)',project_id,expected_revision+1,0,JSON.stringify({op:'create_node',node_id:node.node_id}),JSON.stringify({op:'delete_node',node_id:node.node_id}))
 ];
 if(force_failure)statements.splice(2,0,p(db,'INSERT INTO plot_nodes_v2(project_id,node_id,parent_id,title,description,kind,status,x,y,width,height) VALUES(?,?,?,?,?,?,?,?,?,?,?)',project_id,node.node_id,null,'DUPLICATE','', 'event','draft',0,0,230,120));
 try{await db.batch(statements)}catch(e){
  const message=String(e?.message??e);
  if(message.includes('REVISION_CONFLICT'))err('REVISION_CONFLICT',message);
  if(message.includes('UNIQUE')||message.includes('constraint'))err('TRANSACTION_ABORTED',message);
  throw e;
 }
 return result;
}

/** P2 preview for safe group move on an isolated v2 project. No writes. */
async function moveSnapshot(db,{project_id,owner_id,node_ids,dx,dy,editorial_task_id=null}){
 const revision=await getProjectRevision(db,project_id,owner_id);
 if(!Array.isArray(node_ids)||node_ids.length===0||node_ids.length>100||new Set(node_ids).size!==node_ids.length||!Number.isFinite(dx)||!Number.isFinite(dy))err('INVALID_MOVE','invalid node set or translation');
 const nodes=[];for(const id of node_ids){const n=await first(db,'SELECT node_id,parent_id,x,y,width,height FROM plot_nodes_v2 WHERE project_id=? AND node_id=?',project_id,id);if(!n)err('NODE_NOT_FOUND',id);nodes.push(n)}
 const parentId=nodes[0].parent_id;if(nodes.some(n=>n.parent_id!==parentId))err('CROSS_PARENT_MOVE','different parent levels');
 const fields=await all(db,'SELECT field_id,parent_id,assignment_mode,x,y,width,height FROM semantic_fields_v2 WHERE project_id=? AND parent_id IS ? LIMIT 1001',project_id,parentId);
 if(fields.length>1000)err('TOO_MANY_FIELDS','bounded preview exceeded');
 const slots=nodes.map(()=>'?').join(',');
 const pins=await all(db,`SELECT node_id,field_id FROM node_semantic_pins_v2 WHERE project_id=? AND node_id IN (${slots})`,project_id,...nodes.map(n=>n.node_id));
 let ef=null;
 if(editorial_task_id!==null){
  ef=await first(db,`SELECT ef.x,ef.y,ef.width,ef.height,ef.parent_id FROM editorial_fields_v2 ef JOIN editorial_tasks_v2 t ON t.project_id=ef.project_id AND t.task_id=ef.task_id WHERE ef.project_id=? AND ef.task_id=? AND t.status IN ('open','variants_ready','regeneration_requested')`,project_id,editorial_task_id);
  if(!ef||ef.parent_id!==parentId)err('EDITORIAL_TASK_INVALID','field/task mismatch');
  for(const n of nodes){const cx=n.x+dx+n.width/2,cy=n.y+dy+n.height/2;if(!(cx>=ef.x&&cx<ef.x+ef.width&&cy>=ef.y&&cy<ef.y+ef.height))err('EDITORIAL_DROP_OUTSIDE','each selected center must be inside editorial field');}
 }
 const losses=[],gained=[];
 for(const n of nodes){
  const pinned=new Set(pins.filter(p=>p.node_id===n.node_id).map(p=>p.field_id));
  const effective=(offsetX,offsetY)=>{const out=new Set(pinned),cx=n.x+offsetX+n.width/2,cy=n.y+offsetY+n.height/2;
   for(const f of fields)if(['auto','mixed'].includes(f.assignment_mode)&&cx>=f.x&&cx<f.x+f.width&&cy>=f.y&&cy<f.y+f.height)out.add(f.field_id);return out;};
  const before=effective(0,0),after=effective(dx,dy);
  for(const field_id of before)if(!after.has(field_id))losses.push({node_id:n.node_id,field_id});
  for(const field_id of after)if(!before.has(field_id))gained.push({node_id:n.node_id,field_id});
 }
 return {project_id,revision,node_ids:[...node_ids],dx,dy,editorial_task_id,losses,gained,nodes,fields};
}
export async function previewGroupMoveV2(db,args){
 const snapshot=await moveSnapshot(db,args);
 const preview_digest=hash(snapshot);
 return {project_id:snapshot.project_id,expected_revision:snapshot.revision,node_ids:snapshot.node_ids,dx:snapshot.dx,dy:snapshot.dy,editorial_task_id:snapshot.editorial_task_id,lost_semantic_ids:snapshot.losses,gained_semantic_ids:snapshot.gained,requires_confirmation:snapshot.losses.length>0,preview_digest};
}
/** Transactional proof: group move + manual semantic pin retention + optional editorial membership. */
export async function commitGroupMoveV2(db,{project_id,owner_id,node_ids,dx,dy,editorial_task_id=null,expected_revision,preview_digest,policy,operation_id}){
 if(!['save','drop'].includes(policy)||!operation_id||!preview_digest)err('INVALID_INPUT','policy and preview required');
 await getProjectRevision(db,project_id,owner_id);
 const digest=hash({project_id,node_ids,dx,dy,editorial_task_id,expected_revision,preview_digest,policy});
 const existing=await first(db,'SELECT request_digest,result_json FROM operation_receipts_v2 WHERE project_id=? AND operation_id=?',project_id,operation_id);
 if(existing){if(existing.request_digest!==digest)err('IDEMPOTENCY_CONFLICT','different request');return JSON.parse(existing.result_json)}
 const snapshot=await moveSnapshot(db,{project_id,owner_id,node_ids,dx,dy,editorial_task_id});
 if(snapshot.revision!==expected_revision)err('REVISION_CONFLICT','stale preview');
 if(hash(snapshot)!==preview_digest)err('PREVIEW_STALE','preview differs');
 const when=iso(),committed_revision=expected_revision+1;
 const result={project_id,operation_id,committed_revision,moved_ids:node_ids,semantic_tags_saved:policy==='save'?snapshot.losses:[],editorial_task_id};
 const statements=[p(db,'INSERT INTO operation_receipts_v2(project_id,operation_id,request_digest,expected_revision,committed_revision,result_json,created_at) VALUES(?,?,?,?,?,?,?)',project_id,operation_id,digest,expected_revision,committed_revision,JSON.stringify(result),when)];
 for(const n of snapshot.nodes)statements.push(p(db,'UPDATE plot_nodes_v2 SET x=?,y=? WHERE project_id=? AND node_id=?',n.x+dx,n.y+dy,project_id,n.node_id));
 if(policy==='save')for(const lost of snapshot.losses)statements.push(p(db,'INSERT OR IGNORE INTO node_semantic_pins_v2(project_id,node_id,field_id) VALUES(?,?,?)',project_id,lost.node_id,lost.field_id));
 if(editorial_task_id)for(const n of snapshot.nodes)statements.push(p(db,'INSERT OR IGNORE INTO editorial_memberships_v2(project_id,task_id,node_id,source) VALUES(?,?,?,?)',project_id,editorial_task_id,n.node_id,'drag'));
 statements.push(p(db,'UPDATE projects_v2 SET revision=revision+1,updated_at=? WHERE project_id=? AND revision=?',when,project_id,expected_revision));
 statements.push(p(db,'INSERT INTO changes_v2(project_id,revision,operation_id,actor,summary,created_at) VALUES(?,?,?,?,?,?)',project_id,committed_revision,operation_id,'owner','group_move',when));
 statements.push(p(db,'INSERT INTO change_items_v2(project_id,revision,seq,forward_json,inverse_json) VALUES(?,?,?,?,?)',project_id,committed_revision,0,JSON.stringify({op:'group_move',nodes:node_ids,dx,dy,semantic_pins_added:result.semantic_tags_saved,editorial_task_id}),JSON.stringify({op:'group_move',nodes:node_ids,dx:-dx,dy:-dy,remove_pins:result.semantic_tags_saved,remove_task_membership_if_added:true})));
 try{await db.batch(statements)}catch(e){if(String(e.message).includes('REVISION_CONFLICT'))err('REVISION_CONFLICT',e.message);throw e}
 return result;
}

/** P2 variant staging: staged bytes are invisible to ready variant readers. */
export async function startVariantSetV2(db,{project_id,owner_id,task_id,set_id,generation_no,expected_count}){
 await getProjectRevision(db,project_id,owner_id);
 if(!set_id||!task_id||!Number.isSafeInteger(generation_no)||generation_no<1||![1,3].includes(expected_count))err('INVALID_VARIANT_SET','start variant set');
 const task=await first(db,'SELECT offer_variants,status FROM editorial_tasks_v2 WHERE project_id=? AND task_id=?',project_id,task_id);
 if(!task||!['open','variants_ready','regeneration_requested'].includes(task.status))err('EDITORIAL_TASK_INVALID','bad task');
 if((task.offer_variants?3:1)!==expected_count)err('VARIANT_COUNT_MISMATCH','expected 3 or 1 according to checkbox');
 await p(db,'INSERT INTO variant_sets_v2(project_id,set_id,task_id,generation_no,status,digest,expected_count) VALUES(?,?,?,? ,?,?,?)',project_id,set_id,task_id,generation_no,'staged','pending',expected_count).run();
 return {set_id,status:'staged'};
}
export async function stageOneVariantV2(db,{project_id,owner_id,set_id,variant,ordinal}){
 await getProjectRevision(db,project_id,owner_id);
 const set=await first(db,'SELECT task_id,status,expected_count FROM variant_sets_v2 WHERE project_id=? AND set_id=?',project_id,set_id);
 if(!set||set.status!=='staged'||!Number.isInteger(ordinal)||ordinal<1||ordinal>set.expected_count)err('VARIANT_STAGE_INVALID','set or ordinal');
 if(!variant||variant.task_id!==set.task_id||!variant.variant_id)err('VARIANT_STAGE_INVALID','task mismatch');
 const data=JSON.stringify(variant),bytes=utf8Bytes(data);
 if(bytes>500000)err('VARIANT_TOO_LARGE','single variant chunk > 500000 UTF-8 bytes; chunk upload not yet implemented');
 const digest=hash(data);
 await db.batch([
  p(db,'INSERT INTO variants_v2(project_id,variant_id,set_id,ordinal,status,digest) VALUES(?,?,?,?,?,?)',project_id,variant.variant_id,set_id,ordinal,'staged',digest),
  p(db,'INSERT INTO variant_chunks_v2(project_id,variant_id,chunk_no,data,byte_length,sha256) VALUES(?,?,?,?,?,?)',project_id,variant.variant_id,0,data,bytes,digest)
 ]);
 return {variant_id:variant.variant_id,status:'staged',bytes,digest};
}
export async function getReadyVariantsV2(db,{project_id,owner_id,task_id}){
 await getProjectRevision(db,project_id,owner_id);
 const task=await first(db,'SELECT status,active_set_id FROM editorial_tasks_v2 WHERE project_id=? AND task_id=?',project_id,task_id);
 if(!task)err('EDITORIAL_TASK_INVALID','missing task');
 if(task.status!=='variants_ready'||!task.active_set_id)return {task_id,variants:[]};
 const rows=await all(db,`SELECT v.variant_id,v.ordinal,v.digest FROM variants_v2 v JOIN variant_sets_v2 s ON s.project_id=v.project_id AND s.set_id=v.set_id
 WHERE v.project_id=? AND v.set_id=? AND v.status='sealed' AND s.status='sealed' ORDER BY v.ordinal`,project_id,task.active_set_id);
 return {task_id,variants:rows};
}
/** Collect ONLY affected scope and its boundaries, never entire large plot. */
async function boundedVariantContext(db,project_id,task){
 const ms=await all(db,'SELECT node_id FROM editorial_memberships_v2 WHERE project_id=? AND task_id=? LIMIT 101',project_id,task.task_id);
 if(ms.length>100)err('CONTEXT_TOO_LARGE','source set >100');
 const ids=ms.map(m=>m.node_id),idSet=new Set(ids),nodes=[];
 for(const node_id of ids){
  const n=await first(db,'SELECT node_id,status,kind,parent_id FROM plot_nodes_v2 WHERE project_id=? AND node_id=?',project_id,node_id);
  if(!n)err('CONTEXT_INCOMPLETE',node_id);
  if(!['draft','proposed'].includes(n.status))err('APPROVED_SOURCE','approved/archived source protected');
  if((await first(db,'SELECT node_id FROM plot_nodes_v2 WHERE project_id=? AND parent_id=? LIMIT 1',project_id,node_id)))err('DESCENDANTS_PRESENT','has children');
  nodes.push(n);
 }
 const edges=[];
 for(const node_id of ids){
  const found=await all(db,`SELECT edge_id,source_id,target_id,edge_type FROM edges_v2
 WHERE project_id=? AND relation_scope='plot' AND ((source_kind='plot_node' AND source_id=?) OR (target_kind='plot_node' AND target_id=?)) LIMIT 1001`,project_id,node_id,node_id);
  if(found.length>1000)err('CONTEXT_TOO_LARGE','too many edges');
  for(const e of found)if(!edges.some(x=>x.edge_id===e.edge_id))edges.push({edge_id:e.edge_id,relation_scope:'plot',source:{kind:'plot_node',id:e.source_id},target:{kind:'plot_node',id:e.target_id},type:e.edge_type});
 }
 if(edges.length>2000)err('CONTEXT_TOO_LARGE','too many selected edges');
 return {editorial_tasks:[{task_id:task.task_id,kind:task.kind}],editorial_memberships:ids.map(node_id=>({task_id:task.task_id,node_id})),plot_nodes:nodes,edges};
}
/** Safe sealing of all three/single variants together; only staged sets are accepted.
 * Still NOT a graph replacement and NOT a published Site integration.
 */
export async function sealVariantSetV2(db,{project_id,owner_id,set_id,expected_revision,expected_task_revision,operation_id}){
 const revision=await getProjectRevision(db,project_id,owner_id);
 const request_digest=hash({project_id,set_id,expected_revision,expected_task_revision});
 const receipt=await first(db,'SELECT request_digest,result_json FROM operation_receipts_v2 WHERE project_id=? AND operation_id=?',project_id,operation_id);
 if(receipt){if(receipt.request_digest!==request_digest)err('IDEMPOTENCY_CONFLICT','different seal content');return JSON.parse(receipt.result_json)}
 if(revision!==expected_revision)err('REVISION_CONFLICT','stale project');
 const set=await first(db,'SELECT task_id,status,expected_count FROM variant_sets_v2 WHERE project_id=? AND set_id=?',project_id,set_id);
 if(!set||set.status!=='staged')err('VARIANT_SEAL_INVALID','not staged');
 const task=await first(db,'SELECT task_id,kind,status,task_revision,active_set_id FROM editorial_tasks_v2 WHERE project_id=? AND task_id=?',project_id,set.task_id);
 if(!task||task.task_revision!==expected_task_revision||!['open','variants_ready','regeneration_requested'].includes(task.status))err('TASK_REVISION_CONFLICT','task stale');
 const vars=await all(db,'SELECT variant_id,ordinal,digest FROM variants_v2 WHERE project_id=? AND set_id=? AND status=? ORDER BY ordinal',project_id,set_id,'staged');
 if(vars.length!==set.expected_count||vars.some((v,i)=>v.ordinal!==i+1))err('INCOMPLETE_VARIANT_SET','must have all contiguous variants');
 const {validatePreparedVariant}=await import('./editorial_contract.mjs');
 const graph=await boundedVariantContext(db,project_id,task);
 for(const v of vars){
  const chunks=await all(db,'SELECT chunk_no,data,byte_length,sha256 FROM variant_chunks_v2 WHERE project_id=? AND variant_id=? ORDER BY chunk_no',project_id,v.variant_id);
  if(chunks.length!==1||chunks[0].chunk_no!==0||chunks[0].byte_length!==utf8Bytes(chunks[0].data)||chunks[0].sha256!==hash(chunks[0].data)||v.digest!==chunks[0].sha256)err('VARIANT_PAYLOAD_CORRUPT',v.variant_id);
  let data;try{data=JSON.parse(chunks[0].data)}catch{err('VARIANT_PAYLOAD_CORRUPT','JSON')}
  const review=validatePreparedVariant(graph,data,task.task_id);
  if(!review.valid)err('REVIEW_REQUIRED','unresolved boundary');
  if(task.kind==='rewrite_field'&&data.boundary_decisions.some(d=>d.decision!=='rewire'))err('REVIEW_REQUIRED','unsupported boundary policy in v1');
 }
 const when=iso(),result={project_id,task_id:set.task_id,set_id,active_variants:vars.map(v=>v.variant_id),committed_revision:expected_revision+1};
 const commands=[p(db,'INSERT INTO operation_receipts_v2(project_id,operation_id,request_digest,expected_revision,expected_task_id,expected_task_revision,committed_revision,result_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)',project_id,operation_id,request_digest,expected_revision,task.task_id,expected_task_revision,expected_revision+1,JSON.stringify(result),when)];
 for(const v of vars)commands.push(p(db,"UPDATE variants_v2 SET status='sealed' WHERE project_id=? AND variant_id=? AND status='staged'",project_id,v.variant_id));
 commands.push(p(db,"UPDATE variant_sets_v2 SET status='sealed',digest=? WHERE project_id=? AND set_id=? AND status='staged'",hash(vars.map(v=>v.digest)),project_id,set_id));
 commands.push(p(db,"UPDATE editorial_tasks_v2 SET status='variants_ready',active_set_id=?,task_revision=task_revision+1 WHERE project_id=? AND task_id=? AND task_revision=?",set_id,project_id,task.task_id,expected_task_revision));
 commands.push(p(db,'UPDATE projects_v2 SET revision=revision+1,updated_at=? WHERE project_id=? AND revision=?',when,project_id,expected_revision));
 commands.push(p(db,'INSERT INTO changes_v2(project_id,revision,operation_id,actor,summary,created_at) VALUES(?,?,?,?,?,?)',project_id,expected_revision+1,operation_id,'chatgpt','seal variants',when));
 commands.push(p(db,'INSERT INTO change_items_v2(project_id,revision,seq,forward_json,inverse_json) VALUES(?,?,?,?,?)',project_id,expected_revision+1,0,JSON.stringify({op:'seal_variants',task_id:set.task_id,set_id}),JSON.stringify({op:'restore_active_variants',task_id:set.task_id,active_set_id:task.active_set_id,task_status:task.status})));
 try{await db.batch(commands)}catch(e){if(String(e.message).includes('REVISION_CONFLICT'))err('REVISION_CONFLICT',e.message);if(String(e.message).includes('TASK_REVISION_CONFLICT'))err('TASK_REVISION_CONFLICT',e.message);throw e}
 return result;
}
