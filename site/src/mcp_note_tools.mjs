/**
 * Owner-only MCP adapter for addressable editorial notes and reviewed draft
 * staging. No direct D1 mutation, project migration or automatic canon changes.
 * The existing opt-in workflow REST preview/apply routes own the transaction.
 */
import {listNoteTasks} from './creative_workflow_note_context.mjs';
import {prepareNoteProcessingTask,prepareNoteStageWrite} from './creative_workflow_note_handoff.mjs';
import {previewStageNoteAlternatives} from './creative_workflow_note_staging.mjs';

const shape={type:'object',additionalProperties:false};
const projectId={type:'string',minLength:1,maxLength:80};
const noteId={type:'string',minLength:1,maxLength:80};
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
const stagingInputs={
 project_id:projectId,note_id:noteId,source_revision:revision,
 generation_id:generationId,proposal
};
const objectOutput=(required,properties)=>({type:'object',properties,required});
export const noteTools=[
 {name:'list_note_tasks',title:'Найти редакторские заметки',description:'Показать только адресные заметки проекта (не сюжетные факты). Можно искать по тексту; возвращает ID и краткий фрагмент. Без изменений.',inputSchema:{...shape,properties:{project_id:projectId,query:{type:'string',maxLength:150},status:{enum:['pending','all']},limit:{type:'integer',minimum:1,maximum:20}},required:['project_id']},outputSchema:objectOutput(['project_id','revision','notes','total','truncated'],{project_id:projectId,revision,notes:{type:'array'},total:{type:'integer'},truncated:{type:'boolean'}}),annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'get_note_task',title:'Прочитать задание из заметки',description:'Прочитать указанную заметку и только явно связанные действующие сюжетные элементы; получить руководство по свободной творческой структуре. Черновики и скрытые оригиналы не раскрываются.',inputSchema:{...shape,properties:{project_id:projectId,note_id:noteId,neighbors:{type:'boolean'}},required:['project_id','note_id']},outputSchema:objectOutput(['project_id','revision','task','context','structureGuidance','requiredOutput'],{project_id:projectId,revision,task:{type:'object'},context:{type:'object'},structureGuidance:{type:'string'},requiredOutput:{type:'object'}}),annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'preview_note_drafts',title:'Предпросмотр черновиков по заметке',description:'Подготовить и проверить через защищённый workflow черновые события и внутренние связи без записи. Сначала прочитайте get_note_task и используйте его ревизию. Не навязывайте количество альтернатив. Верните предложения автору для согласования; review_token нужен для сохранения.',inputSchema:{...shape,properties:stagingInputs,required:Object.keys(stagingInputs)},outputSchema:objectOutput(['project_id','source_revision','generation_id','review_token','summary','draft_preview','saved'],{project_id:projectId,source_revision:revision,generation_id:generationId,review_token:{type:'string'},summary:{type:'object'},draft_preview:{type:'object'},saved:{const:false}}),annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'save_note_drafts',title:'Сохранить согласованные черновики',description:'Только после явного согласия автора и preview_note_drafts: сохраните тот же proposal, source_revision, стабильный generation_id и review_token через защищённый workflow/apply. Это сохраняет отдельные черновики, НЕ принимает события в канон и не меняет исходную заметку. Повтор того же запроса безопасен.',inputSchema:{...shape,properties:{...stagingInputs,review_token:{type:'string',pattern:'^[0-9a-f]{64}$'}},required:[...Object.keys(stagingInputs),'review_token']},outputSchema:objectOutput(['project_id','revision','saved','replayed','summary','canon_changed'],{project_id:projectId,revision,replayed:{type:'boolean'},saved:{const:true},summary:{type:'object'},canon_changed:{const:false}}),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}}
];
const permittedFields={
 list_note_tasks:['project_id','query','status','limit'],
 get_note_task:['project_id','note_id','neighbors'],
 preview_note_drafts:Object.keys(stagingInputs),
 save_note_drafts:[...Object.keys(stagingInputs),'review_token']
};
export const isNoteTool=name=>Object.hasOwn(permittedFields,name);
const invalid=message=>{throw new Error(message)};
const readGraph=p=>({...p.graph,revision:p.revision});
const showPreview=p=>({
 workspace:{id:p.workspace.id,taskId:p.workspace.taskId,
  x:p.workspace.x,y:p.workspace.y,width:p.workspace.width,height:p.workspace.height},
 groups:p.branchSummaries,
 events:p.proposedNodes.map(n=>({id:n.id,title:n.title,description:n.description,
  x:n.x,y:n.y,branch_id:n.draftBranchId})),
 relations:p.proposedEdges.map(e=>({from:e.from,to:e.to,type:e.type,branch_id:e.draftBranchId})),
 canon_changed:false
});

/**
 * Dependencies deliberately reuse MCP's authenticated internal REST caller.
 * Saving never calls a generic graph PUT or bypasses receipt/CAS semantics.
 */
export async function callNoteTool(name,args,request,env,{getCurrent,rest,digest},internalApi){
 if(!isNoteTool(name)||!args||typeof args!=='object'||Array.isArray(args)||
    Object.keys(args).some(k=>!permittedFields[name].includes(k)))
  invalid('Недопустимые поля инструмента заметок');
 const p=await getCurrent(request,internalApi,args.project_id);
 if(name==='list_note_tasks'){
  const found=listNoteTasks(readGraph(p),{query:args.query,status:args.status,limit:args.limit});
  return {project_id:p.id,...found};
 }
 if(name==='get_note_task'){
  const task=prepareNoteProcessingTask(readGraph(p),{noteId:args.note_id,neighbors:args.neighbors});
  return {project_id:p.id,...task};
 }
 // Exact source revision is required; never rebase a model's proposal.
 if(!Number.isSafeInteger(args.source_revision)||args.source_revision<0)
  invalid('Нужна исходная ревизия заметки');
 let graph=readGraph(p);
 if(p.revision!==args.source_revision){
  if(name!=='save_note_drafts'||p.revision<args.source_revision)
   invalid('REVISION_CONFLICT: проект изменился после чтения заметки');
  // A retry after a successful apply needs the ORIGINAL immutable snapshot
  // to reconstruct the SAME command and receipt hash; no stale new write is
  // possible because the workflow CAS rejects it if no matching receipt exists.
  const row=await env.DB.prepare('SELECT graph_json FROM plot_revisions WHERE project_id=? AND revision=?')
   .bind(p.id,args.source_revision).first();
  if(!row)invalid('REVISION_CONFLICT: исходная ревизия недоступна');
  graph={...JSON.parse(row.graph_json),revision:args.source_revision};
 }
 const prepared=prepareNoteStageWrite(graph,{
  noteId:args.note_id,sourceRevision:args.source_revision,
  generationId:args.generation_id,proposal:args.proposal
 });
 // Preview endpoint confirms the opt-in switch and receipt store; pure
 // recomputation on save is verified AGAIN by workflow/apply under CAS.
 const path='/api/projects/'+p.id+'/workflow/';
 const preview=name==='preview_note_drafts'
  ?(await rest(request,internalApi,'POST',path+'preview',{
    expectedRevision:prepared.expectedRevision,command:prepared.command
   })).preview
  :previewStageNoteAlternatives(graph,prepared.command);
 const reviewToken=await digest({
  project_id:p.id,source_revision:prepared.expectedRevision,
  generation_id:prepared.operationId,command:prepared.command,preview
 });
 if(name==='preview_note_drafts'){
  return {project_id:p.id,source_revision:prepared.expectedRevision,
   generation_id:prepared.operationId,review_token:reviewToken,
   summary:prepared.summary,draft_preview:showPreview(preview),saved:false};
 }
 if(typeof args.review_token!=='string'||args.review_token!==reviewToken)
  invalid('REVIEW_TOKEN_MISMATCH: повторите точный предпросмотр перед сохранением');
 const saved=await rest(request,internalApi,'POST',path+'apply',{
  expectedRevision:prepared.expectedRevision,operationId:prepared.operationId,
  command:{...prepared.command,expectedPreview:preview}
 });
 return {project_id:p.id,revision:saved.revision,saved:true,
  replayed:!!saved.replayed,summary:prepared.summary,canon_changed:false};
}
