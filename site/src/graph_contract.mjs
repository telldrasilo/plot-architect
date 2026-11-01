export const FORMAT='plot-architect/project-1';
export const MAX_GRAPH_BYTES=2_000_000;
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v,max=200)=>typeof v==='string'&&v.length<=max;
const num=v=>typeof v==='number'&&Number.isFinite(v);
const uniq=list=>new Set(list).size===list.length;
export class GraphValidationError extends Error{constructor(message){super(message);this.name='GraphValidationError'}}
function error(s){throw new GraphValidationError(s)}
export function normalizeGraph(g){
  if(!isObj(g))error('Граф должен быть объектом');
  const out=structuredClone(g);
  for(const k of ['nodes','edges','fields','lanes'])if(!Array.isArray(out[k]))out[k]=[];
  out.view=out.view??null;
  out.revision=Number.isSafeInteger(out.revision)&&out.revision>=0?out.revision:0;
  for(const n of out.nodes){if(!Array.isArray(n.lineIds))n.lineIds=[];if(!Array.isArray(n.manualFieldIds))n.manualFieldIds=[];if(!Array.isArray(n.manualTags))n.manualTags=[];if(!Array.isArray(n.autoFieldIds))n.autoFieldIds=[];n.parent=n.parent??null;n.description=n.description??'';n.size=n.size??'normal';n.status=n.status??'approved'}
  for(const f of out.fields){f.parent=f.parent??null;f.comment=f.comment??'';f.assignmentMode=f.assignmentMode??'auto'}
  for(const [singular,plural] of [['nextNode','nodes'],['nextEdge','edges'],['nextField','fields'],['nextLine','lanes']]) {
    const prefix={nextNode:'n',nextEdge:'e',nextField:'f',nextLine:'l'}[singular];
    const m=out[plural].reduce((v,x)=>Math.max(v,Number(new RegExp('^'+prefix+'(\\d+)$').exec(x.id||'')?.[1]||0)),0);
    if(!Number.isSafeInteger(out[singular])||out[singular]<=m)out[singular]=m+1;
  }
  return out;
}
export function validateGraph(raw){
  const g=normalizeGraph(raw);
  if(JSON.stringify(g).length>MAX_GRAPH_BYTES)error('Размер проекта превышает 2 МБ');
  if(g.nodes.length>5000||g.edges.length>15000||g.fields.length>1000)error('Превышен лимит элементов');
  for(const arr of [g.nodes,g.edges,g.fields,g.lanes])if(!uniq(arr.map(o=>o?.id)))error('Повторяющийся ID');
  const ids=new Set(g.nodes.map(x=>x.id)),fids=new Set(g.fields.map(x=>x.id)),lids=new Set(g.lanes.map(x=>x.id));
  for(const n of g.nodes){
    if(!str(n.id,80)||!str(n.title,300)||!str(n.description,20000)||!num(n.x)||!num(n.y))error('Некорректная нода');
    if(!['mini','normal','expanded'].includes(n.size))error('Неизвестный размер ноды');
    if(n.width!==undefined&&(!num(n.width)||n.width<180||n.width>780))error('Некорректная ширина ноды');
    if(n.height!==undefined&&(!num(n.height)||n.height<95||n.height>640))error('Некорректная высота ноды');
    if(n.color!==undefined&&!['#b8a16e','#8a9d83','#b17f72','#998ba7','#84a6a4'].includes(n.color))error('Некорректный цвет ноды');
    if(n.parent!==null&&!ids.has(n.parent))error('Невалидный родитель ноды');
    if(n.lineIds.some(x=>!lids.has(x)))error('Нода ссылается на отсутствующую линию');
    if(n.manualFieldIds.some(x=>!fids.has(x)))error('Отсутствующее поле в ручных тегах');
  }
  for(const e of g.edges){if(!str(e.id,80)||!ids.has(e.from)||!ids.has(e.to)||e.from===e.to||!str(e.type,40))error('Некорректная связь');}
  for(const f of g.fields){
    if(!str(f.id,80)||!str(f.title,300)||!str(f.comment,10000)||![f.x,f.y,f.width,f.height].every(num)||f.width<100||f.height<80||!['auto','manual','mixed'].includes(f.assignmentMode))error('Некорректное поле');
    if(f.parent!==null&&!ids.has(f.parent))error('Неверный родитель поля');
  }
  for(const l of g.lanes)if(!str(l.id,80)||!str(l.title,300))error('Некорректная сюжетная линия');
  const parents=new Map(g.nodes.map(n=>[n.id,n.parent]));for(const n of g.nodes){let p=n.parent,seen=new Set([n.id]);while(p!==null){if(seen.has(p))error('Цикл вложенности');seen.add(p);p=parents.get(p)??null}}
  return g;
}
export function packageProject(name,graph,id='local'){
  return {format:FORMAT,exportedAt:new Date().toISOString(),project:{id,name,graph:validateGraph(graph)}};
}
export function unpackProject(payload){
 if(!isObj(payload))error('Некорректный JSON');
 if(payload.format===FORMAT){if(!isObj(payload.project)||!str(payload.project.name,160))error('Некорректный пакет');return {name:payload.project.name,graph:validateGraph(payload.project.graph)}}
 if(Array.isArray(payload.nodes)&&Array.isArray(payload.edges))return {name:'Импортированный сюжет',graph:validateGraph(payload)};
 if(payload.format?.startsWith('plot-ux-prototype/')&&Array.isArray(payload.nodes))return {name:'Импортированный сюжет',graph:validateGraph(payload)};
 error('Формат проекта не поддерживается');
}
