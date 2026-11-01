import {handleMcp} from './mcp_server.mjs';
import {validateGraph,GraphValidationError} from './graph_contract.mjs';
const j=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const problem=(msg,status=400,code='BAD_REQUEST')=>j({error:code,message:msg},status);
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const jsonBody=async(req)=>{const len=Number(req.headers.get('content-length')||0);if(len>2_300_000)throw new Error('Слишком большой запрос');const txt=await req.text();if(txt.length>2_300_000)throw new Error('Слишком большой запрос');return JSON.parse(txt)};
async function permitted(request,env){
  // Sites dispatch supplies this identity only after the Site access policy.
  // Deployment is restricted to a verified owner-only Site; no service bypass.
  return !!request.headers.get('oai-authenticated-user-id')?.trim();
}
async function getRecord(db,id){return db.prepare('SELECT id,name,revision,graph_json,created_at,updated_at FROM plot_projects WHERE id=? AND deleted_at IS NULL').bind(id).first()}
async function change(db,id,expectedRevision,graph,name,message){
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)return problem('Нужна ожидаемая ревизия',422,'INVALID_REVISION');
  const old=await getRecord(db,id);if(!old)return problem('Проект не найден',404,'NOT_FOUND');
  if(old.revision!==expectedRevision)return j({error:'REVISION_CONFLICT',expectedRevision,currentRevision:old.revision},409);
  const next=expectedRevision+1,ts=now();
  const result=await db.batch([
    db.prepare('UPDATE plot_projects SET name=?, graph_json=?, revision=?, updated_at=? WHERE id=? AND revision=? AND deleted_at IS NULL').bind(name,JSON.stringify(graph),next,ts,id,expectedRevision),
    db.prepare('INSERT INTO plot_revisions (project_id,revision,graph_json,message,created_at) SELECT id,revision,graph_json,?,? FROM plot_projects WHERE id=? AND revision=? AND deleted_at IS NULL AND changes()=1').bind(String(message||'Изменение').slice(0,500),ts,id,next)
  ]);
  if((result?.[0]?.meta?.changes??0)!==1)return j({error:'REVISION_CONFLICT',message:'Состояние обновилось параллельно'},409);
  return j({id,name,revision:next,updatedAt:ts});
}
async function api(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/health')return j({ok:!!env.DB,requiresAuthorization:true,version:'pa-site-01-sites',authMode:'sites-native',authenticated:await permitted(request,env)});
 if(!env.DB)return problem('D1 binding DB не настроен',503,'STORAGE_UNAVAILABLE');
 if(!await permitted(request,env))return problem('Требуется вход владельца через ChatGPT',401,'AUTH_REQUIRED');
 const method=request.method;
 if(!['GET','HEAD','OPTIONS'].includes(method)&&request.headers.has('Origin')&&request.headers.get('Origin')!==url.origin)return problem('Недопустимый источник запроса',403,'ORIGIN_DENIED');
 if(path==='/api/projects'){
   if(method==='GET'){const items=await env.DB.prepare('SELECT id,name,revision,created_at,updated_at FROM plot_projects WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100').all();return j({projects:items.results||[]})}
   if(method==='POST'){
      const body=await jsonBody(request);const name=String(body.name||'Новая история').trim().slice(0,160);
      if(!name)return problem('Название обязательно',422);
      const graph=validateGraph(body.graph);const id=uuid(),ts=now(),data=JSON.stringify(graph);
      await env.DB.batch([
       env.DB.prepare('INSERT INTO plot_projects (id,name,graph_json,revision,created_at,updated_at) VALUES (?,?,?,0,?,?)').bind(id,name,data,ts,ts),
       env.DB.prepare('INSERT INTO plot_revisions (project_id,revision,graph_json,message,created_at) VALUES (?,?,?,?,?)').bind(id,0,data,'Создание',ts)
      ]);return j({id,name,revision:0,graph,createdAt:ts,updatedAt:ts},201)
   }
   return problem('Метод не поддерживается',405);
 }
 const m=/^\/api\/projects\/([a-zA-Z0-9-]{1,80})(?:\/(revisions|restore))?$/.exec(path);
 if(!m)return problem('Маршрут не найден',404,'NOT_FOUND');
 const [,id,action]=m;
 if(action==='revisions'&&method==='GET'){
  if(!await getRecord(env.DB,id))return problem('Проект не найден',404,'NOT_FOUND');
  const rows=await env.DB.prepare('SELECT revision,message,created_at FROM plot_revisions WHERE project_id=? ORDER BY revision DESC LIMIT 100').bind(id).all();return j({revisions:rows.results||[]});
 }
 if(action==='restore'&&method==='POST'){
  const body=await jsonBody(request),r=Number(body.revision);
  if(!Number.isSafeInteger(r)||r<0)return problem('Неверная ревизия',422);
  const old=await env.DB.prepare('SELECT graph_json FROM plot_revisions WHERE project_id=? AND revision=?').bind(id,r).first();
  if(!old)return problem('Версия не найдена',404,'NOT_FOUND');
  const current=await getRecord(env.DB,id);if(!current)return problem('Проект не найден',404);
  return change(env.DB,id,body.expectedRevision,validateGraph(JSON.parse(old.graph_json)),current.name,'Восстановление ревизии '+r);
 }
 if(!action){
  if(method==='GET'){const p=await getRecord(env.DB,id);return p?j({id:p.id,name:p.name,revision:p.revision,graph:JSON.parse(p.graph_json),createdAt:p.created_at,updatedAt:p.updated_at}):problem('Проект не найден',404,'NOT_FOUND')}
  if(method==='PUT'){
   const body=await jsonBody(request);const graph=validateGraph(body.graph);const name=String(body.name||'').trim().slice(0,160);
   if(!name)return problem('Название обязательно',422);
   return change(env.DB,id,body.expectedRevision,graph,name,body.message);
  }
  if(method==='DELETE'){
   const body=await jsonBody(request),exp=body.expectedRevision;
   const p=await getRecord(env.DB,id);if(!p)return problem('Проект не найден',404,'NOT_FOUND');
   if(p.revision!==exp)return j({error:'REVISION_CONFLICT',currentRevision:p.revision},409);
   const r=await env.DB.prepare('UPDATE plot_projects SET deleted_at=?,revision=revision+1 WHERE id=? AND revision=? AND deleted_at IS NULL').bind(now(),id,exp).run();
   return r.meta.changes===1?j({deleted:true}):j({error:'REVISION_CONFLICT'},409);
  }
 }
 return problem('Метод не поддерживается',405);
}
export default {
 async fetch(request,env){
   const url=new URL(request.url);
   if(url.pathname==='/mcp')return handleMcp(request,env,(req)=>api(req,env));
   if(url.pathname.startsWith('/api/')){
     try{return await api(request,env)}catch(e){const msg=String(e?.message||e);if(e instanceof GraphValidationError||e instanceof SyntaxError||/JSON|Некоррект|Неверн|Слишком|Превышен|Отсутствующ|Цикл|Повтор|Недопустим/.test(msg))return problem(msg,422,'INVALID_GRAPH');console.error('API error',e);return problem('Внутренняя ошибка сервера',500,'SERVER_ERROR')}
   }
   if(!await permitted(request,env))return new Response('Требуется вход владельца через ChatGPT',{status:401,headers:{'Cache-Control':'no-store'}});
   if((url.pathname==='/'||url.pathname==='/index.html')&&request.method==='GET')return new Response(env.PLOT_HTML||'Build missing',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
   return new Response('Not found',{status:404});
 }
};