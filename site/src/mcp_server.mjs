/**
 * Plot Architect MCP 0.1 candidate: stateless MCP Streamable HTTP/JSON-RPC for the owner-private Site.
 * This adapter never changes D1 directly. All writes reuse the existing guarded REST API.
 * No OpenAI API is called and no credentials are embedded.
 */
import {validateGraph} from './graph_contract.mjs';
import {canonicalReadGraph,assertOrdinaryGraphWrite} from './creative_workflow_server_boundary.mjs';
import {noteTools,isNoteTool,callNoteTool} from './mcp_note_tools.mjs';
import {draftIterationTools,isDraftIterationTool,callDraftIterationTool} from './mcp_draft_iteration_tools.mjs';
const VERSION='2025-06-18';
const DATA_LIMIT=1250000;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','MCP-Protocol-Version':VERSION}});
const errorText=(error,code='TOOL_ERROR')=>({isError:true,content:[{type:'text',text:JSON.stringify({error:code,message:String(error).slice(0,500)})}]});
const reply=data=>({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data});
const shape={type:'object',additionalProperties:false};
const operationSchema={oneOf:[
 {...shape,properties:{op:{const:'add_node'},temp_id:{type:'string',pattern:'^[a-zA-Z][a-zA-Z0-9_-]{0,39}$'},title:{type:'string',minLength:1,maxLength:300},description:{type:'string',maxLength:20000},x:{type:'number'},y:{type:'number'},parent:{type:['string','null']},line_ids:{type:'array',items:{type:'string'},maxItems:20}},required:['op','title']},
 {...shape,properties:{op:{const:'update_node'},id:{type:'string'},changes:{...shape,properties:{title:{type:'string',minLength:1,maxLength:300},description:{type:'string',maxLength:20000},x:{type:'number'},y:{type:'number'}},minProperties:1}},required:['op','id','changes']},
 {...shape,properties:{op:{const:'add_edge'},from:{type:'string'},to:{type:'string'},edge_type:{enum:['precedes','causes','enables','hinders']}},required:['op','from','to']},
 {...shape,properties:{op:{const:'update_edge'},id:{type:'string'},edge_type:{enum:['precedes','causes','enables','hinders']}},required:['op','id','edge_type']},
 {...shape,properties:{op:{const:'add_field'},title:{type:'string',minLength:1,maxLength:300},comment:{type:'string',maxLength:10000},x:{type:'number'},y:{type:'number'},width:{type:'number',minimum:100},height:{type:'number',minimum:80}},required:['op','title']},
 {...shape,properties:{op:{const:'update_field'},id:{type:'string'},changes:{...shape,properties:{title:{type:'string',minLength:1,maxLength:300},comment:{type:'string',maxLength:10000}},minProperties:1}},required:['op','id','changes']}
]};
const tools=[
 {name:'list_projects',title:'Список сюжетных проектов',description:'Получить список проектов и серверные ревизии. Только чтение; не придумывать проекты по памяти.',inputSchema:{...shape,properties:{}},annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'create_project',title:'Создать пустой сюжетный проект',description:'Создать новый пустой проект по прямой просьбе владельца. Возвращает ID и ревизию 0. Повторный вызов создаст ещё один проект; не используйте для открытия существующего.',inputSchema:{...shape,properties:{name:{type:'string',minLength:1,maxLength:160}},required:['name']},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},
 {name:'get_project',title:'Прочитать сюжетный проект',description:'Прочитать текущую ревизию, заголовки и структуру. Включить detail=full только для небольшого графа.',inputSchema:{...shape,properties:{project_id:{type:'string',minLength:1,maxLength:80},detail:{enum:['summary','full']}},required:['project_id']},annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'get_context',title:'Получить фрагмент сюжета',description:'Найти конкретные события по фразе или ID и связанные события на расстоянии до 1 стрелки; для больших историй вместо полного графа.',inputSchema:{...shape,properties:{project_id:{type:'string',minLength:1,maxLength:80},query:{type:'string',maxLength:150},node_ids:{type:'array',items:{type:'string',maxLength:80},maxItems:30},neighbors:{type:'boolean'}},required:['project_id']},annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'get_changes',title:'Изменения проекта после ревизии',description:'Сопоставить актуальный граф с конкретной ранее сохранённой ревизией; показать изменённые идентификаторы нод, полей и связей.',inputSchema:{...shape,properties:{project_id:{type:'string',minLength:1,maxLength:80},since_revision:{type:'integer',minimum:0}},required:['project_id','since_revision']},annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'preview_patch',title:'Предпросмотр предложенных сюжетных изменений',description:'Рассчитать добавление/редактирование событий, полей и связей БЕЗ записи. Возвращает preview_token для точного применения после согласия пользователя.',inputSchema:{...shape,properties:{project_id:{type:'string',minLength:1,maxLength:80},expected_revision:{type:'integer',minimum:0},operations:{type:'array',items:operationSchema,minItems:1,maxItems:40}},required:['project_id','expected_revision','operations']},annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'apply_patch',title:'Применить проверенный сюжетный пакет',description:'Изменить граф атомарно при совпадении ревизии и preview_token. Нельзя применять несогласованные изменения. Не удаляет ноды и проекты.',inputSchema:{...shape,properties:{project_id:{type:'string',minLength:1,maxLength:80},expected_revision:{type:'integer',minimum:0},operations:{type:'array',items:operationSchema,minItems:1,maxItems:40},preview_token:{type:'string',pattern:'^[0-9a-f]{64}$'}},required:['project_id','expected_revision','operations','preview_token']},annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},
 ...noteTools,
 ...draftIterationTools
];
for(const tool of tools){
 if(tool.outputSchema)continue; // Note tools declare their precise output contract.
 const properties={};
 switch(tool.name){
  case 'list_projects': properties.projects={type:'array',items:{type:'object'}};break;
  case 'create_project':properties.project_id={type:'string'};properties.name={type:'string'};properties.revision={const:0};properties.created={const:true};break;
  case 'get_project':properties.project_id={type:'string'};properties.revision={type:'integer'};break;
  case 'get_context':properties.project_id={type:'string'};properties.nodes={type:'array',items:{type:'object'}};break;
  case 'get_changes':properties.project_id={type:'string'};properties.from_revision={type:'integer'};properties.to_revision={type:'integer'};break;
  case 'preview_patch':properties.project_id={type:'string'};properties.preview_token={type:'string'};properties.changes={type:'array',items:{type:'object'}};break;
  case 'apply_patch':properties.project_id={type:'string'};properties.revision={type:'integer'};properties.saved={const:true};break;
 }
 tool.outputSchema={type:'object',properties,required:Object.keys(properties)};
}
// Match the editor's blankGraph() project template; no plot events, links or fields.
const blankGraph=()=>({version:1,revision:0,nextNode:1,nextEdge:1,nextField:1,nextLine:2,view:null,nodes:[],edges:[],fields:[],lanes:[{id:'l1',title:'Основная линия',color:'#b8a16e',y:200}]});
const goodId=s=>typeof s==='string'&&/^[A-Za-z0-9-]{1,80}$/.test(s);
const mcpIsObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const safeText=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const saneNum=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1_000_000;
function validateArgs(a,required){if(!mcpIsObj(a))throw new Error('Ожидается объект аргументов');for(const k of required)if(a[k]===undefined)throw new Error('Не указан параметр '+k);if(a.project_id!==undefined&&!goodId(a.project_id))throw new Error('Неверный project_id')}
async function rest(request,internalApi,method,path,body){
 const url=new URL(path,request.url),headers=new Headers();
 const identity=request.headers.get('oai-authenticated-user-id');
 if(identity)headers.set('oai-authenticated-user-id',identity);
 if(body!==undefined)headers.set('Content-Type','application/json');
 const req=new Request(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const res=await internalApi(req);let parsed;
 try{parsed=await res.json()}catch{throw new Error('Некорректный ответ Site API')}
 if(!res.ok){const e=new Error(String(parsed.error||parsed.message||res.status));e.status=res.status;e.response=parsed;throw e}
 return parsed;
}
async function getCurrent(request,api,id){return rest(request,api,'GET','/api/projects/'+id)}
const digest=async obj=>{const bytes=new TextEncoder().encode(JSON.stringify(obj));const b=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('')};
function applyGraphOps(original,operations){
 if(!Array.isArray(operations)||operations.length<1||operations.length>40)throw new Error('От 1 до 40 операций');
 const graph=structuredClone(original), created={nodes:{},edges:{},fields:{}};
 const used={nodes:new Set(graph.nodes.map(v=>v.id)),edges:new Set(graph.edges.map(v=>v.id)),fields:new Set(graph.fields.map(v=>v.id))};
 const next=kind=>{const key={nodes:'nextNode',edges:'nextEdge',fields:'nextField'}[kind],prefix={nodes:'n',edges:'e',fields:'f'}[kind];let value=Number(graph[key])||1,id;do{id=prefix+value++}while(used[kind].has(id));graph[key]=value;used[kind].add(id);return id};
 const resolve=id=>typeof id==='string'&&id.startsWith('$')?created.nodes[id.slice(1)]:id;
 const details=[];
 for(const [index,op] of operations.entries()){
  if(!mcpIsObj(op)||!safeText(op.op,30))throw new Error('Неверная операция #'+(index+1));
  if(op.op==='add_node'){
    if(!safeText(op.title,300))throw new Error('Укажите название события');
    if(op.description!==undefined&&typeof op.description!=='string')throw new Error('Неверное описание');
    if(op.temp_id!==undefined&&(!/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(op.temp_id)||created.nodes[op.temp_id]))throw new Error('temp_id должен быть уникален');
    const id=next('nodes');let parent=op.parent??graph.view??null;if(parent!==null&&!(graph.nodes.some(n=>n.id===parent)))throw new Error('Неизвестный родитель');
    const defaultX=Math.max(80,...graph.nodes.filter(n=>n.parent===parent).map(n=>n.x+340));
    const x=op.x??defaultX,y=op.y??180;
    if(!saneNum(x)||!saneNum(y))throw new Error('Неверные координаты');
    const node={id,title:op.title.trim(),description:(op.description||'').slice(0,20000),x,y,parent,size:'normal',status:'proposed',lineIds:graph.lanes.length?[graph.lanes[0].id]:[],manualFieldIds:[],manualTags:[],autoFieldIds:[]};
    if(op.line_ids!==undefined){if(!Array.isArray(op.line_ids)||op.line_ids.some(v=>!graph.lanes.some(l=>l.id===v)))throw new Error('Неизвестная сюжетная линия');node.lineIds=op.line_ids}
    graph.nodes.push(node);if(op.temp_id)created.nodes[op.temp_id]=id;details.push({op:op.op,id,title:node.title});
  }else if(op.op==='update_node'){
    const node=graph.nodes.find(n=>n.id===resolve(op.id));if(!node)throw new Error('Нода для изменения не найдена');
    const allowed=['title','description','x','y'];if(!mcpIsObj(op.changes)||!Object.keys(op.changes).length||Object.keys(op.changes).some(k=>!allowed.includes(k)))throw new Error('Недопустимые поля изменения ноды');
    if(op.changes.title!==undefined&&!safeText(op.changes.title,300))throw new Error('Неверный заголовок');
    if(op.changes.description!==undefined&&(typeof op.changes.description!=='string'||op.changes.description.length>20000))throw new Error('Неверное описание');
    if(['x','y'].some(k=>op.changes[k]!==undefined&&!saneNum(op.changes[k])))throw new Error('Неверные координаты');
    Object.assign(node,op.changes);details.push({op:op.op,id:node.id,changes:Object.keys(op.changes)});
  }else if(op.op==='add_edge'){
    const from=resolve(op.from),to=resolve(op.to),type=op.edge_type||'precedes';
    if(!graph.nodes.some(n=>n.id===from)||!graph.nodes.some(n=>n.id===to)||from===to)throw new Error('Неверные концы стрелки');
    if(!['precedes','causes','enables','hinders'].includes(type))throw new Error('Неверный тип связи');
    if(graph.edges.some(e=>e.from===from&&e.to===to&&e.type===type))throw new Error('Такая связь уже есть');
    const id=next('edges');graph.edges.push({id,from,to,type});details.push({op:op.op,id,from,to,type});
  }else if(op.op==='update_edge'){
    const edge=graph.edges.find(e=>e.id===op.id);if(!edge)throw new Error('Стрелка не найдена');
    if(!['precedes','causes','enables','hinders'].includes(op.edge_type))throw new Error('Неверный тип связи');
    edge.type=op.edge_type;details.push({op:op.op,id:edge.id,edge_type:edge.type});
  }else if(op.op==='add_field'){
    if(!safeText(op.title,300))throw new Error('Неверное название поля');
    const id=next('fields'),x=op.x??100,y=op.y??100,width=op.width??700,height=op.height??350;
    if(![x,y,width,height].every(saneNum)||width<100||height<80)throw new Error('Неверная геометрия поля');
    if(op.comment!==undefined&&(typeof op.comment!=='string'||op.comment.length>10000))throw new Error('Неверный комментарий');
    const field={id,title:op.title.trim(),comment:op.comment||'',x,y,width,height,color:'#b8a16e',assignmentMode:'auto',parent:graph.view??null};graph.fields.push(field);details.push({op:op.op,id,title:field.title});
  }else if(op.op==='update_field'){
    const field=graph.fields.find(f=>f.id===op.id);if(!field)throw new Error('Поле не найдено');
    const allowed=['title','comment'];if(!mcpIsObj(op.changes)||!Object.keys(op.changes).length||Object.keys(op.changes).some(k=>!allowed.includes(k)))throw new Error('Недопустимые изменения поля');
    if(op.changes.title!==undefined&&!safeText(op.changes.title,300))throw new Error('Неверное название поля');
    if(op.changes.comment!==undefined&&(typeof op.changes.comment!=='string'||op.changes.comment.length>10000))throw new Error('Неверный комментарий');
    Object.assign(field,op.changes);details.push({op:op.op,id:field.id,changes:Object.keys(op.changes)});
  }else throw new Error('Операция не поддерживается: '+op.op);
 }
 validateGraph(graph);
 return {graph,created,details};
}
function countDiff(before,after){
 const results={};for(const key of ['nodes','edges','fields']){
  const first=new Map(before[key].map(x=>[x.id,JSON.stringify(x)])),second=new Map(after[key].map(x=>[x.id,JSON.stringify(x)]));
  const added=[],removed=[],updated=[];for(const [id,value] of second){if(!first.has(id))added.push(id);else if(first.get(id)!==value)updated.push(id)}for(const id of first.keys())if(!second.has(id))removed.push(id);
  results[key]={added,removed,updated};
 }return results;
}
async function callTool(name,args,request,env,internalApi){
 if(!request.headers.get('oai-authenticated-user-id')?.trim())throw Object.assign(new Error('Доступ только владельцу'),{status:401});
 if(!env.DB)throw Object.assign(new Error('Хранилище недоступно'),{status:503});
 if(name==='list_projects'){validateArgs(args,[]);const r=await rest(request,internalApi,'GET','/api/projects');return {projects:r.projects||[]}}
 if(name==='create_project'){
  validateArgs(args,['name']);
  if(Object.keys(args).some(k=>k!=='name')||!safeText(args.name,160))throw new Error('Название проекта должно содержать от 1 до 160 символов');
  const created=await rest(request,internalApi,'POST','/api/projects',{name:args.name.trim(),graph:blankGraph()});
  return {project_id:created.id,name:created.name,revision:created.revision,created:true};
 }
 validateArgs(args,['project_id']);
 if(isNoteTool(name))return callNoteTool(name,args,request,env,{getCurrent,rest,digest},internalApi);
 if(isDraftIterationTool(name))return callDraftIterationTool(name,args,request,env,{getCurrent,rest,digest},internalApi);
 if(name==='get_project'){
  if(args.detail!==undefined&&!['summary','full'].includes(args.detail))throw new Error('Неверный detail');
  const p=await getCurrent(request,internalApi,args.project_id),g=canonicalReadGraph(p.graph);
  if(args.detail==='full'){if(JSON.stringify(g).length>DATA_LIMIT)throw new Error('Граф слишком велик, используйте get_context');return {project_id:p.id,name:p.name,revision:p.revision,graph:g}}
  return {project_id:p.id,name:p.name,revision:p.revision,counts:{nodes:g.nodes.length,edges:g.edges.length,fields:g.fields.length},fields:g.fields.map(f=>({id:f.id,title:f.title,comment:f.comment||''})),sample_nodes:g.nodes.slice(0,30).map(n=>({id:n.id,title:n.title,description:n.description?.slice(0,250)})),truncated:g.nodes.length>30};
 }
 if(name==='get_context'){
  if(!args.query&&!(Array.isArray(args.node_ids)&&args.node_ids.length))throw new Error('Укажите query или node_ids');
  const p=await getCurrent(request,internalApi,args.project_id),g=canonicalReadGraph(p.graph),requested=new Set(Array.isArray(args.node_ids)?args.node_ids:[]);
  if(args.query){const q=String(args.query).toLowerCase().trim();if(q.length>150)throw new Error('Слишком длинный запрос');for(const n of g.nodes){if((n.title+' '+n.description).toLowerCase().includes(q))requested.add(n.id);if(requested.size>=30)break}}
  if(requested.size>30)throw new Error('Можно запросить не более 30 событий');
  const picked=new Set(requested);if(args.neighbors!==false){for(const e of g.edges)if(requested.has(e.from)||requested.has(e.to)){picked.add(e.from);picked.add(e.to)}}
  const nodes=g.nodes.filter(n=>picked.has(n.id)).slice(0,90),keep=new Set(nodes.map(n=>n.id));
  const edges=g.edges.filter(e=>keep.has(e.from)&&keep.has(e.to)).slice(0,200);
  return {project_id:p.id,revision:p.revision,nodes,edges,fields:g.fields.filter(f=>nodes.some(n=>(n.manualFieldIds||[]).includes(f.id)||(n.autoFieldIds||[]).includes(f.id))),truncated:picked.size>90};
 }
 if(name==='get_changes'){
  if(!Number.isSafeInteger(args.since_revision)||args.since_revision<0)throw new Error('Неверная ревизия');
  const p=await getCurrent(request,internalApi,args.project_id);if(args.since_revision>p.revision)throw new Error('Запрошена будущая ревизия');
  const old=await env.DB.prepare('SELECT graph_json FROM plot_revisions WHERE project_id=? AND revision=?').bind(p.id,args.since_revision).first();if(!old)throw new Error('Исторический снимок отсутствует');
  return {project_id:p.id,from_revision:args.since_revision,to_revision:p.revision,changes:countDiff(canonicalReadGraph(JSON.parse(old.graph_json)),canonicalReadGraph(p.graph))};
 }
 if(name==='preview_patch'||name==='apply_patch'){
  if(!Number.isSafeInteger(args.expected_revision)||args.expected_revision<0)throw new Error('Неверная ожидаемая ревизия');
  const p=await getCurrent(request,internalApi,args.project_id);
  if(p.revision!==args.expected_revision)throw Object.assign(new Error('REVISION_CONFLICT: сначала прочитайте свежий граф'),{status:409,currentRevision:p.revision});
  const {graph,created,details}=applyGraphOps(p.graph,args.operations);
  // Generic MCP patch may update active plot only. It must not stage/promote
  // drafts, alter replacement records or edit a suspended original.
  assertOrdinaryGraphWrite(p.graph,graph);
  const preview_token=await digest({project_id:p.id,expected_revision:p.revision,operations:args.operations});
  if(name==='preview_patch')return {project_id:p.id,expected_revision:p.revision,preview_token,changes:details,created,counts_before:{nodes:canonicalReadGraph(p.graph).nodes.length,edges:canonicalReadGraph(p.graph).edges.length,fields:canonicalReadGraph(p.graph).fields.length},counts_after:{nodes:canonicalReadGraph(graph).nodes.length,edges:canonicalReadGraph(graph).edges.length,fields:canonicalReadGraph(graph).fields.length},warning:'Предпросмотр: запись не выполнена'};
  if(args.preview_token!==preview_token)throw new Error('preview_token не соответствует предпросмотру');
  const saved=await rest(request,internalApi,'PUT','/api/projects/'+p.id,{name:p.name,expectedRevision:p.revision,graph,message:'MCP: '+details.map(d=>d.op).join(', ').slice(0,350)});
  return {project_id:p.id,revision:saved.revision,changes:details,created,saved:true};
 }
 throw new Error('Неизвестный инструмент '+name);
}
export async function handleMcp(request,env,internalApi){
 const requestOrigin=request.headers.get('Origin');
 if(requestOrigin&&requestOrigin!==new URL(request.url).origin)return json({jsonrpc:'2.0',id:null,error:{code:-32003,message:'Origin denied'}},403);
 if(request.headers.get('content-type')&&!request.headers.get('content-type').toLowerCase().startsWith('application/json'))return json({jsonrpc:'2.0',id:null,error:{code:-32600,message:'JSON content type required'}},415);
 if(request.method!=='POST')return new Response('Use POST for MCP Streamable HTTP',{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
 const size=Number(request.headers.get('content-length')||0);if(size>200_000)return json({error:'MCP_REQUEST_TOO_LARGE'},413);
 let body;try{const raw=await request.text();if(raw.length>200_000)throw new Error('too large');body=JSON.parse(raw)}catch{return json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}},400)}
 if(!mcpIsObj(body)||body.jsonrpc!=='2.0'||typeof body.method!=='string'||Array.isArray(body))return json({jsonrpc:'2.0',id:body?.id??null,error:{code:-32600,message:'Invalid request'}},400);
 if(body.id===undefined)return new Response(null,{status:202,headers:{'Cache-Control':'no-store'}});
 const result=data=>json({jsonrpc:'2.0',id:body.id,result:data});
 const failure=(code,message)=>json({jsonrpc:'2.0',id:body.id,error:{code,message}});
 if(body.method==='initialize')return result({protocolVersion:VERSION,capabilities:{tools:{listChanged:false}},serverInfo:{name:'Plot Architect',version:'0.1.0'}});
 if(body.method==='ping')return result({});
 if(body.method==='tools/list')return result({tools});
 if(body.method!=='tools/call')return failure(-32601,'Method not found');
 const name=body.params?.name,args=body.params?.arguments??{};
 if(!tools.some(t=>t.name===name))return failure(-32602,'Unknown tool');
 try{return result(reply(await callTool(name,args,request,env,internalApi)))}catch(e){const message=e?.message||String(e);const code=e?.status===409?'REVISION_CONFLICT':e?.status===401?'AUTH_REQUIRED':'TOOL_ERROR';return result(errorText(message,code))}
}
