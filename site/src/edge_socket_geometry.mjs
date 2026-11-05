/**
 * CW-004: deterministic, data-only geometry for independent per-edge sockets.
 *
 * This module never mutates a graph, stores coordinates, measures the DOM,
 * or implies anything about causality. Callers provide measured world-space
 * rectangles and active edges from ONE visible scope (canon or workspace).
 */
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const validRect=r=>r&&[r.x,r.y,r.width,r.height].every(finite)
  &&r.width>0&&r.height>0;
export const socketKey=(edgeId,role)=>edgeId+':'+role;
const centerY=r=>r.y+r.height/2;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const DEFAULTS=Object.freeze({minGap:20,maxGap:30,inset:16,railOffset:16});

/** UI-only metrics in screen pixels, separate from graph/world coordinates.
 *  Dense sockets use nearest-port resolution, not overlapping click targets.
 */
const SOCKET_UI_DEFAULTS=Object.freeze({
 visualDiameterPx:10, mouseHitDiameterPx:24, touchHitDiameterPx:40,
 clearancePx:2
});
export function socketUiMetrics({
 scale=1,input='mouse',minSeparationWorld=Infinity,options={}
}={}){
 const cfg={...SOCKET_UI_DEFAULTS,...options};
 if(!finite(scale)||scale<=0||!['mouse','touch'].includes(input)
   ||!(minSeparationWorld===Infinity||finite(minSeparationWorld)&&minSeparationWorld>=0)
   ||Object.values(cfg).some(v=>!finite(v)||v<0)
   ||cfg.visualDiameterPx<=0||cfg.mouseHitDiameterPx<cfg.visualDiameterPx
   ||cfg.touchHitDiameterPx<cfg.visualDiameterPx)
  throw new TypeError('Invalid socket screen metrics');
 const visualPx=cfg.visualDiameterPx;
 const desiredHitPx=input==='touch'?cfg.touchHitDiameterPx:cfg.mouseHitDiameterPx;
 const separationPx=minSeparationWorld*scale;
 const direct=separationPx>=desiredHitPx+cfg.clearancePx;
 const effectiveHitPx=direct?desiredHitPx:Math.max(0,Math.min(desiredHitPx,separationPx-cfg.clearancePx));
 return {
  visualDiameterPx:visualPx,hitDiameterPx:desiredHitPx,
  effectiveHitDiameterPx:effectiveHitPx,resolution:direct?'direct':'nearest',
  visualRadiusWorld:visualPx/(2*scale),hitRadiusWorld:effectiveHitPx/(2*scale)
 };
}

/** Card-edge anchor; only an explicitly flagged overflow rail moves away. */
export function socketBoundaryX(rect,role){
 if(!validRect(rect)||!['source','target'].includes(role))
  throw new TypeError('Invalid socket boundary');
 return role==='source'?rect.x+rect.width:rect.x;
}

function rectFor(node,bounds){
 const b=bounds instanceof Map?bounds.get(node.id):bounds?.[node.id];
 const r=b??node;
 return validRect(r)?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
}

/**
 * Returns independent ports for every visible edge endpoint.
 * Maps retain stable insertion order by node ID, role, opposite-center Y
 * and finally edge ID; input edge array order does not change the output.
 */
export function layoutEdgeSockets({nodes=[],edges=[],bounds={},mode='full',options={}}={}){
 const ports=new Map(),byNode=new Map(),warnings=[];
 if(mode!=='full')return {ports,byNode,warnings};
 const cfg={...DEFAULTS,...options};
 if(!finite(cfg.minGap)||cfg.minGap<=0||!finite(cfg.maxGap)
   ||cfg.maxGap<cfg.minGap||!finite(cfg.inset)||cfg.inset<0
   ||!finite(cfg.railOffset)||cfg.railOffset<0)
  throw new TypeError('Invalid socket spacing options');
 const cards=new Map();
 for(const node of nodes){
  if(!node||typeof node.id!=='string'||cards.has(node.id))
   throw new TypeError('Duplicate or invalid node ID');
  const rect=rectFor(node,bounds);
  if(!rect)throw new TypeError('Invalid card dimensions: '+node.id);
  cards.set(node.id,rect);
  byNode.set(node.id,{incoming:[],outgoing:[]});
 }
 const groups=new Map();
 for(const edge of edges){
  if(!edge||typeof edge.id!=='string'||typeof edge.from!=='string'
    ||typeof edge.to!=='string'||edge.from===edge.to)
   throw new TypeError('Invalid edge identity');
  if(!cards.has(edge.from)||!cards.has(edge.to))continue;
  for(const [nodeId,role,otherId] of [
   [edge.from,'source',edge.to],[edge.to,'target',edge.from]
  ]){
   const key=socketKey(edge.id,role);
   if(ports.has(key))throw new TypeError('Duplicate edge endpoint: '+key);
   const scope=edge.workspaceId??'plot';
   const port={key,edgeId:edge.id,role,nodeId,otherId,scope,
     side:role==='source'?'right':'left',x:0,y:0,rail:false,ordinal:0};
   ports.set(key,port);
   const groupKey=nodeId+'\u0000'+role;
   if(!groups.has(groupKey))groups.set(groupKey,[]);
   groups.get(groupKey).push(port);
  }
 }
 for(const nodeId of [...cards.keys()].sort()){
  const rect=cards.get(nodeId);
  for(const role of ['source','target']){
   const group=groups.get(nodeId+'\u0000'+role)??[];
   group.sort((a,b)=>cmp(centerY(cards.get(a.otherId)),centerY(cards.get(b.otherId)))
     ||cmp(a.otherId,b.otherId)||cmp(a.edgeId,b.edgeId));
   const available=Math.max(0,rect.height-2*cfg.inset);
   const overflowing=group.length>1&&(group.length-1)*cfg.minGap>available;
   const gap=group.length<=1?0:overflowing?cfg.minGap
     :Math.max(cfg.minGap,Math.min(cfg.maxGap,available/(group.length-1)));
   const first=centerY(rect)-(group.length-1)*gap/2;
   const boundaryX=socketBoundaryX(rect,role);
   const x=boundaryX+(overflowing?(role==='source'?cfg.railOffset:-cfg.railOffset):0);
   for(let i=0;i<group.length;i++){
    const p=group[i];p.x=x;p.y=first+i*gap;p.boundaryX=boundaryX;p.rail=overflowing;p.ordinal=i;
    byNode.get(nodeId)[role==='source'?'outgoing':'incoming'].push(p);
   }
   if(overflowing)warnings.push({code:'SOCKET_RAIL',nodeId,role,
     count:group.length,requiredHeight:(group.length-1)*cfg.minGap+cfg.inset*2,
     actualHeight:rect.height});
  }
 }
 return {ports,byNode,warnings};
}

/** Compute an unused temporary socket without displacing existing endpoints. */
export function proposeFreeSocket({nodeId,role,layout,bounds,options={}}={}){
 if(role!=='source'&&role!=='target')throw new TypeError('Invalid socket role');
 const cfg={...DEFAULTS,...options};
 const rect=rectFor({id:nodeId},bounds);
 if(!rect)throw new TypeError('Unknown card dimensions: '+nodeId);
 const occupied=layout?.byNode?.get(nodeId)?.[role==='source'?'outgoing':'incoming']??[];
 const cy=centerY(rect);
 let y=cy;
 for(let i=0;i<=occupied.length*3+3;i++){
  const offset=i===0?0:(Math.ceil(i/2)*cfg.minGap)*(i%2?1:-1);
  const candidate=cy+offset;
  if(occupied.every(p=>Math.abs(candidate-p.y)>=cfg.minGap-1e-8)){
   y=candidate;break;
  }
 }
 const rail=y<rect.y+cfg.inset||y>rect.y+rect.height-cfg.inset
  ||occupied.some(p=>p.rail);
 const boundaryX=socketBoundaryX(rect,role);
 const x=boundaryX+(rail?(role==='source'?cfg.railOffset:-cfg.railOffset):0);
 return {key:'new:'+nodeId+':'+role,nodeId,role,
  side:role==='source'?'right':'left',x,y,boundaryX,rail,temporary:true};
}
