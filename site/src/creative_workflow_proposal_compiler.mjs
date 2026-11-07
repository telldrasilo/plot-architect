/**
 * CW-018: prepare concise plot proposals for the existing reviewed stage_note
 * transaction. No LLM, network call, MCP registration, database write or UI.
 *
 * A creative proposal is semantically decomposed by ChatGPT into 1+ plot
 * blocks. This adapter NEVER decides that one block is cheaper or that all
 * alternatives need the same length. It validates relationships and lays out
 * those blocks near the source note without moving the existing story.
 */
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';
import {CreativeWorkflowContractError} from './creative_workflow_contract.mjs';
import {previewStageNoteAlternatives} from './creative_workflow_note_staging.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exactFields=(x,fields)=>obj(x)&&Object.keys(x).every(k=>fields.includes(k));
const string=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const generationId=x=>typeof x==='string'&&/^[A-Za-z][A-Za-z0-9_-]{7,39}$/.test(x);
const key=x=>typeof x==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(x);
const types=new Set(['precedes','causes','enables','hinders']);
const WIDTH=208,GAP_X=64,PAD_X=36,PAD_TOP=48,ROW_GAP=44,BOTTOM=36;
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1_000_000;
const ceil=(n,d)=>Math.ceil(n/d);

/** Conceptual instructions, not a deterministic classifier or number quota. */
export const CREATIVE_STRUCTURE_GUIDANCE=[
 'Интерпретируй свободное авторское задание как творческий запрос, а не как приказ всегда генерировать варианты.',
 'Сначала придумай содержательное решение; затем выдели самостоятельные сюжетные изменения и связи.',
 'Каждая нода — краткий сюжетный блок, не фрагмент художественной прозы и не абзац произвольной длины.',
 'Одна нода и несколько нод равноценны: не сжимай сюжет ради экономии и не дроби ради количества.',
 'Несколько событий одной цепочки не означают несколько альтернатив.',
 'Разные альтернативы могут содержать разное количество событий; не навязывай три варианта или одинаковую длину.',
 'Количество альтернатив определяется только намерением автора; явно указанное количество сохраняй.',
 'Не создавай канонические факты и внешние стрелки: результат — предложения для отдельной рабочей области.'
].join('\n');

function estimatedHeight(node){
 // Conservative visual footprint of a 208px editable draft card with
 // wrapping labels and description; the editor's actual size remains dynamic.
 const titleLines=ceil(node.title.length,23);
 const descriptionLines=node.description?ceil(node.description.length,25):0;
 return Math.max(132,86+titleLines*21+(descriptionLines?12+descriptionLines*19:0));
}
const overlap=(a,b)=>a.x<b.x+b.width+28&&a.x+a.width+28>b.x
  &&a.y<b.y+b.height+28&&a.y+a.height+28>b.y;

// A note can be much taller than the old 158px shortcut: the editor wraps
// the task body and, for default titles, displays a contextual excerpt.
function estimatedNoteHeight(note){
 // Mirror the compact card: small fixed "Заметка" kind, optional author
 // title (2 lines), task body (4 lines). The complete task lives in inspector.
 const text=String(note.text??''),title=String(note.title||'').trim();
 const custom=title&&title!=='Заметка'?title:'';
 const titleLines=custom?Math.min(2,ceil(Array.from(custom).length/30)):0;
 const distinctBody=!custom||custom!==text.trim();
 const textLines=distinctBody?Math.min(4,text.split(/\r?\n/).reduce((sum,line)=>
  sum+Math.max(1,ceil(Array.from(line).length,30)),0)):0;
 // Conservative footprint: kind line, clipped title/body, footer and padding.
 return Math.max(158,78+titleLines*20+textLines*21);
}
function availablePosition(graph,note,width,height,{singleCard=false}={}){
 const sourceHeight=estimatedNoteHeight(note);
 const obstacles=[
  ...(graph.workspaces??[]).map(w=>({x:w.x,y:w.y,width:w.width,height:w.height})),
  ...(graph.nodes??[]).map(n=>({
   x:n.x,y:n.y,width:n.width??270,
   height:Math.max(n.height??0,estimatedHeight(n)+30)
  })),
  ...(graph.gapNotes??[]).map(n=>({
   x:n.x,y:n.y,width:272,height:estimatedNoteHeight(n)
  }))
 ];
 const vacant=(x,y)=>{
  const candidate={x,y,width,height};
  return [x,y,x+width,y+height].every(finite)
   &&!obstacles.some(rect=>overlap(candidate,rect));
 };
 if(singleCard){
  // A lone proposed event deserves a compact, adjacent workspace. Search
  // each side of the source note before the general multi-branch fallback.
  // Never displace surrounding plot nodes, notes, or older workspaces.
  const gap=60,nearby=[
   [note.x+272+gap,note.y],
   [note.x,note.y+sourceHeight+gap],
   [note.x-width-gap,note.y],
   [note.x,note.y-height-gap],
   [note.x+272+gap,note.y+sourceHeight-height],
   [note.x-width-gap,note.y+sourceHeight-height]
  ];
  for(const [x,y] of nearby)
   if(vacant(x,y))return {x,y};
 }
 const homeX=Math.round(note.x-30),homeY=Math.round(note.y+sourceHeight+52);
 const offsets=[0,width+180,-width-180];
 for(let ring=0;ring<40;ring++){
  const y=homeY+ring*(height+110);
  for(const dx of offsets){
   const x=homeX+dx;
   if(vacant(x,y))return {x,y};
  }
 }
 fail('LAYOUT_NO_SPACE','no unobstructed nearby working-area position found');
}
function validatedProposal(proposal){
 if(!exactFields(proposal,['kind','groups'])||
    !['single','alternatives'].includes(proposal.kind)||
    !Array.isArray(proposal.groups)||proposal.groups.length<1||proposal.groups.length>32)
  fail('PROPOSAL_INVALID','expect kind single/alternatives and 1–32 authored groups');
 if(proposal.kind==='single'&&proposal.groups.length!==1)fail('PROPOSAL_INVALID','single proposal needs one group');
 if(proposal.kind==='alternatives'&&proposal.groups.length<2)fail('PROPOSAL_INVALID','alternatives need at least two authored groups');
 let totalNodes=0,totalEdges=0;
 for(const group of proposal.groups){
  if(!exactFields(group,['title','events','relations'])||!string(group.title,160)||
     !Array.isArray(group.events)||!group.events.length||group.events.length>128||
     !Array.isArray(group.relations))fail('GROUP_INVALID','group title, events and relations required');
  const keys=new Set(),relations=new Set();
  for(const event of group.events){
   if(!exactFields(event,['key','title','description'])||!key(event.key)||
     keys.has(event.key)||!string(event.title,300)||
     (event.description!==undefined&&
      (typeof event.description!=='string'||event.description.length>20000)))
    fail('EVENT_INVALID','unique key, concise title and optional description required');
   keys.add(event.key);totalNodes++;
  }
  for(const edge of group.relations){
   if(!exactFields(edge,['from','to','type'])||!keys.has(edge.from)||
     !keys.has(edge.to)||edge.from===edge.to||!types.has(edge.type))
    fail('RELATION_INVALID','typed relations stay within one creative group');
   const signature=edge.from+'|'+edge.to+'|'+edge.type;
   if(relations.has(signature))fail('RELATION_INVALID','duplicate internal relation');
   relations.add(signature);totalEdges++;
  }
 }
 if(totalNodes>256||totalEdges>512)fail('PROPOSAL_TOO_LARGE','safety limit, not an aesthetic node quota');
 return {nodeCount:totalNodes,edgeCount:totalEdges};
}

/**
 * Compile model-authored meaning into a trusted, explicit stage_note command.
 * generationId must be stable for one requested generation. No extra external
 * graph data or prose is admitted into the command.
 */
export function compileNoteProposal(raw,{noteId,generationId:genId,proposal}={}){
 const graph=validateServerGraph(raw);
 if(!string(noteId,80)||!generationId(genId))
  fail('PROPOSAL_ID_INVALID','existing note and stable generation ID required');
 const note=(graph.gapNotes??[]).find(n=>n.id===noteId);
 if(!note)fail('NOTE_NOT_FOUND',noteId);
 if(note.status!=='pending'||!string(note.text,8000))
  fail('NOTE_NOT_READY','nonempty pending note required');
 const {nodeCount,edgeCount}=validatedProposal(proposal);
 const groupHeights=proposal.groups.map(group=>
  Math.max(...group.events.map(estimatedHeight))
 );
 const maxColumns=Math.max(...proposal.groups.map(group=>group.events.length));
 const width=PAD_X*2+maxColumns*WIDTH+(maxColumns-1)*GAP_X;
 const height=PAD_TOP+BOTTOM+groupHeights.reduce((a,b)=>a+b,0)
  +(proposal.groups.length-1)*ROW_GAP;
 const {x,y}=availablePosition(graph,note,width,height,{
  singleCard:proposal.kind==='single'&&nodeCount===1
 });
 const workspaceId='gw-'+genId;
 let rowY=y+PAD_TOP;
 const branches=proposal.groups.map((group,index)=>{
  const branchId='gb-'+genId+'-'+index,ids=new Map();
  const nodes=group.events.map((e,j)=>{
   const id='gn-'+genId+'-'+index+'-'+j;
   ids.set(e.key,id);
   return {id,title:e.title,description:e.description??'',
    x:x+PAD_X+j*(WIDTH+GAP_X),y:rowY};
  });
  const edges=group.relations.map((e,j)=>({
   id:'ge-'+genId+'-'+index+'-'+j,
   from:ids.get(e.from),to:ids.get(e.to),type:e.type
  }));
  rowY+=groupHeights[index]+ROW_GAP;
  return {id:branchId,title:group.title,nodes,edges};
 });
 const command={kind:'stage_note',noteId,workspaceId,
  workspace:{x,y,width,height},branches};
 // Verify against the exact existing server-side ownership and ID contract.
 const preview=previewStageNoteAlternatives(graph,command);
 return {command,
  shape:{kind:proposal.kind,groupCount:branches.length,nodeCount,edgeCount},
  layout:{x,y,width,height},
  preview:{workspaceId:preview.workspaceId,stagedNodeCount:preview.proposedNodes.length,
   stagedEdgeCount:preview.proposedEdges.length}
 };
}
