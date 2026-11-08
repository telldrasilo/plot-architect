/**
 * Graphite Local owner-only MCP: addressable SAVED draft iterations.
 * Four tools reuse authenticated project GET and guarded workflow preview/apply.
 * They never recreate consumed notes, expose full projects, call an LLM inside
 * Graphite, or bypass CAS, operation receipts, canonical protection.
 */
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';
import {prepareSavedDraftIterationTask,prepareDraftIterationStageWrite} from './creative_workflow_draft_iteration_handoff.mjs';
import {previewStageDraftIteration} from './creative_workflow_draft_iteration_stage.mjs';

const shape={type:'object',additionalProperties:false};
const projectId={type:'string',minLength:1,maxLength:80};
const workspaceId={type:'string',minLength:1,maxLength:80};
const nodeIds={type:'array',items:{type:'string',minLength:1,maxLength:80},minItems:1,maxItems:16,uniqueItems:true};
const revision={type:'integer',minimum:0};
const generationId={type:'string',pattern:'^[A-Za-z][A-Za-z0-9_-]{7,39}$'};
const relation={...shape,properties:{
 from:{type:'string'},to:{type:'string'},type:{enum:['precedes','causes','enables','hinders']}
},required:['from','to','type']};
const proposal={...shape,properties:{
 kind:{enum:['single','alternatives']},
 groups:{type:'array',minItems:1,maxItems:32,items:{...shape,properties:{
  title:{type:'string',minLength:1,maxLength:160},
  events:{type:'array',minItems:1,maxItems:128,items:{...shape,properties:{
   key:{type:'string',pattern:'^[A-Za-z][A-Za-z0-9_-]{0,39}$'},
   title:{type:'string',minLength:1,maxLength:300},
   description:{type:'string',maxLength:20000}
  },required:['key','title']}},
  relations:{type:'array',items:relation}
 },required:['title','events','relations']}}
},required:['kind','groups']};
const stageFields={
 project_id:projectId,workspace_id:workspaceId,node_ids:nodeIds,
 source_revision:revision,generation_id:generationId,proposal
};
const output=(required,properties)=>({type:'object',properties,required});
const reviewToken={type:'string',pattern:'^[0-9a-f]{64}$'};
export const draftIterationTools=[
 {name:'list_saved_drafts',title:'Найти сохранённые черновики',description:'Прочитать только ID, названия и рабочие области сохранённых черновиков. Позволяет выбрать конкретный Y; не раскрывает тексты других вариантов и канонический сюжет. Только чтение.',inputSchema:{...shape,properties:{project_id:projectId,query:{type:'string',maxLength:150},workspace_id:workspaceId,limit:{type:'integer',minimum:1,maximum:20}},required:['project_id']},outputSchema:output(['project_id','revision','drafts','total','truncated'],{project_id:projectId,revision,drafts:{type:'array'},total:{type:'integer'},truncated:{type:'boolean'}}),annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'get_saved_draft_task',title:'Переработать сохранённый черновик',description:'Получить точный текст выбранного сохранённого Y или группы (по ID и workspace_id), при желании только ближайшие внутренние события, без прочих вариантов и канонического сюжета. Подготовить творческое решение для отдельной рабочей области. Только чтение.',inputSchema:{...shape,properties:{project_id:projectId,workspace_id:workspaceId,node_ids:nodeIds,neighbors:{type:'boolean'}},required:['project_id','workspace_id','node_ids']},outputSchema:output(['project_id','revision','scope','sourceDrafts','sameWorkspaceNeighbors','internalRelations','structureGuidance','iterationGuidance'],{project_id:projectId,revision,scope:{type:'object'},sourceDrafts:{type:'array'},sameWorkspaceNeighbors:{type:'array'},internalRelations:{type:'array'},structureGuidance:{type:'string'},iterationGuidance:{type:'string'}}),annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'preview_draft_iteration',title:'Предпросмотр новой версии черновика',description:'Без записи проверить новое творческое предложение по ранее прочитанному сохранённому Y. Количество альтернатив задаёт автор; ни исходный Y, ни канон не изменяются. Показать варианты автору и получить review_token для отдельного сохранения.',inputSchema:{...shape,properties:stageFields,required:Object.keys(stageFields)},outputSchema:output(['project_id','source_revision','generation_id','review_token','summary','draft_preview','saved'],{project_id:projectId,source_revision:revision,generation_id:generationId,review_token,summary:{type:'object'},draft_preview:{type:'object'},saved:{const:false}}),annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'save_draft_iteration',title:'Сохранить согласованную версию рядом',description:'Только после явного согласия автора и preview_draft_iteration сохранить те же предложения и review_token в новой рабочей области. Исходный Y и старые связи остаются, канон не меняется; повтор с тем же generation_id идемпотентен.',inputSchema:{...shape,properties:{...stageFields,review_token:reviewToken},required:[...Object.keys(stageFields),'review_token']},outputSchema:output(['project_id','revision','saved','replayed','summary','canon_changed','source_drafts_retained'],{project_id:projectId,revision,replayed:{type:'boolean'},saved:{const:true},summary:{type:'object'},canon_changed:{const:false},source_drafts_retained:{const:true}}),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}}
];

const permittedFields={
 list_saved_drafts:['project_id','workspace_id','query','limit'],
 get_saved_draft_task:['project_id','workspace_id','node_ids','neighbors'],
 preview_draft_iteration:Object.keys(stageFields),
 save_draft_iteration:[...Object.keys(stageFields),'review_token']
};
export const isDraftIterationTool=name=>Object.hasOwn(permittedFields,name);
const invalid=message=>{throw new Error(message)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const rawGraph=p=>({...p.graph,revision:p.revision});
const showPreview=preview=>({
 workspace:{...preview.workspace},
 groups:preview.branchSummaries,
 events:preview.proposedNodes.map(n=>({
  id:n.id,title:n.title,description:n.description,x:n.x,y:n.y,
  branch_id:n.draftBranchId
 })),
 relations:preview.proposedEdges.map(e=>({
  id:e.id,from:e.from,to:e.to,type:e.type,branch_id:e.draftBranchId
 })),
 source_node_ids:[...preview.sourceNodeIds],
 source_drafts_retained:true,canon_changed:false
});
function listSavedDrafts(raw,{workspaceId,query='',limit=12}={}){
 const graph=validateServerGraph(raw);
 if(workspaceId!==undefined&&(!id(workspaceId)||
     !(graph.workspaces??[]).some(w=>w.id===workspaceId)))
  invalid('WORKSPACE_NOT_FOUND: неизвестная рабочая область');
 if(typeof query!=='string'||query.length>150||!Number.isSafeInteger(limit)||
    limit<1||limit>20)
  invalid('DRAFT_QUERY_INVALID: query до 150 символов и limit 1–20');
 const q=query.trim().toLocaleLowerCase('ru');
 const found=graph.nodes.filter(n=>n.workspaceId&&
   (workspaceId===undefined||workspaceId===n.workspaceId)&&
   (!q||(String(n.title??'')+' '+n.id).toLocaleLowerCase('ru').includes(q)));
 return {revision:graph.revision,total:found.length,truncated:found.length>limit,
  drafts:found.slice(0,limit).map(n=>({
   node_id:n.id,workspace_id:n.workspaceId,
   title:String(n.title??'').slice(0,300),
   draft_branch_id:n.draftBranchId??null
  }))};
}

/**
 * Dependencies are the SAME internal REST caller as existing note MCP tools.
 * Only source revision snapshot may be retrieved for exact idempotent replay.
 */
export async function callDraftIterationTool(name,args,request,env,{getCurrent,rest,digest},internalApi){
 if(!isDraftIterationTool(name)||!args||typeof args!=='object'||Array.isArray(args)||
    Object.keys(args).some(k=>!permittedFields[name].includes(k)))
  invalid('Недопустимые поля инструмента черновиков');
 if(!id(args.project_id))invalid('PROJECT_ID_INVALID');
 const p=await getCurrent(request,internalApi,args.project_id);
 if(name==='list_saved_drafts'){
  return {project_id:p.id,...listSavedDrafts(rawGraph(p),{
   workspaceId:args.workspace_id,query:args.query,limit:args.limit??12
  })};
 }
 if(name==='get_saved_draft_task'){
  return {project_id:p.id,...prepareSavedDraftIterationTask(rawGraph(p),{
   workspaceId:args.workspace_id,nodeIds:args.node_ids,
   neighbors:args.neighbors??false
  })};
 }
 if(!Number.isSafeInteger(args.source_revision)||args.source_revision<0)
  invalid('REVISION_INVALID: требуется исходная ревизия');
 let graph=rawGraph(p);
 if(p.revision!==args.source_revision){
  if(name!=='save_draft_iteration'||p.revision<args.source_revision)
   invalid('REVISION_CONFLICT: проект изменился после чтения черновика');
  // Safe replay only: historical baseline recreates exact request/hash;
  // guarded CAS rejects any different or previously uncommitted command.
  const row=await env.DB.prepare(
    'SELECT graph_json FROM plot_revisions WHERE project_id=? AND revision=?'
  ).bind(p.id,args.source_revision).first();
  if(!row)invalid('REVISION_CONFLICT: исходная ревизия недоступна');
  graph={...JSON.parse(row.graph_json),revision:args.source_revision};
 }
 const prepared=prepareDraftIterationStageWrite(graph,{
  sourceWorkspaceId:args.workspace_id,sourceNodeIds:args.node_ids,
  sourceRevision:args.source_revision,
  generationId:args.generation_id,proposal:args.proposal
 });
 const path='/api/projects/'+encodeURIComponent(p.id)+'/workflow/';
 const preview=name==='preview_draft_iteration'?
  (await rest(request,internalApi,'POST',path+'preview',{
   expectedRevision:prepared.expectedRevision,command:prepared.command
  })).preview:
  previewStageDraftIteration(graph,prepared.command);
 const expectedToken=await digest({
  project_id:p.id,source_revision:prepared.expectedRevision,
  generation_id:prepared.operationId,command:prepared.command,preview
 });
 if(name==='preview_draft_iteration'){
  return {
   project_id:p.id,source_revision:prepared.expectedRevision,
   generation_id:prepared.operationId,review_token:expectedToken,
   summary:prepared.summary,draft_preview:showPreview(preview),saved:false
  };
 }
 if(typeof args.review_token!=='string'||args.review_token!==expectedToken)
  invalid('REVIEW_TOKEN_MISMATCH: сохранение возможно только после точного предпросмотра');
 const saved=await rest(request,internalApi,'POST',path+'apply',{
  expectedRevision:prepared.expectedRevision,
  operationId:prepared.operationId,
  command:{...prepared.command,expectedPreview:preview}
 });
 return {project_id:p.id,revision:saved.revision,saved:true,
  replayed:!!saved.replayed,summary:prepared.summary,canon_changed:false,
  source_drafts_retained:true};
}
