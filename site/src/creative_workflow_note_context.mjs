/**
 * CW-017: addressable, read-only context for ChatGPT note tasks.
 *
 * A note is an editorial instruction, never a plot fact. This pure adapter is
 * ready for a future owner-approved MCP surface; it registers no tool or route.
 * Project data remains a single D1 graph JSON: it is decoded server-side, but
 * only bounded, explicitly relevant information is returned to the model.
 */
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';
import {canonicalProjection,CreativeWorkflowContractError} from './creative_workflow_contract.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const id=v=>typeof v==='string'&&v.length>0&&v.length<=80;
const text=(value,max)=>String(value??'').slice(0,max);
const validStatus=status=>status==='pending'||status==='all';
const validLimit=n=>Number.isSafeInteger(n)&&n>=1&&n<=20;

/** Bounded search across editorial notes, not canonical event descriptions. */
export function listNoteTasks(raw,{query='',status='pending',limit=12}={}){
 const graph=validateServerGraph(raw);
 if(typeof query!=='string'||query.length>150||!validStatus(status)||!validLimit(limit))
  fail('NOTE_QUERY_INVALID','query max 150 characters, status pending/all, limit 1–20');
 const q=query.trim().toLocaleLowerCase('ru');
 const areas=new Set((graph.workspaces??[]).map(a=>a.taskId).filter(Boolean));
 const matches=(graph.gapNotes??[]).filter(n=>
  n&&id(n.id)&&(status==='all'||n.status==='pending')&&
  (!q||(String(n.title??'')+' '+String(n.text??'')).toLocaleLowerCase('ru').includes(q))
 );
 return {
  revision:graph.revision,
  notes:matches.slice(0,limit).map(n=>({
   id:n.id,title:text(n.title||'Заметка',160),textPreview:text(n.text,180),
   status:n.status??'pending',hasWorkspace:areas.has(n.id)
  })),
  total:matches.length,truncated:matches.length>limit
 };
}

/**
 * Only the specified note, its explicit editorial links and a small active
 * canonical neighborhood. Never spread the raw project, hidden replacements,
 * suspended edges, unrelated notes or workspace candidates into the response.
 */
export function getNoteTaskContext(raw,{noteId,neighbors=true}={}){
 const graph=validateServerGraph(raw);
 if(!id(noteId)||typeof neighbors!=='boolean')fail('NOTE_QUERY_INVALID','valid noteId and neighbors required');
 const note=(graph.gapNotes??[]).find(n=>n?.id===noteId);
 if(!note)fail('NOTE_NOT_FOUND',noteId);
 if(typeof note.text!=='string'||!note.text.trim()||note.status!=='pending')
  fail('NOTE_NOT_READY','a nonempty pending note is required');
 const projection=canonicalProjection(graph);
 const liveNodes=new Map(projection.nodes.map(n=>[n.id,n]));
 const liveFields=new Map(projection.fields.map(f=>[f.id,f]));
 const notes=new Map((graph.gapNotes??[]).filter(n=>id(n?.id)).map(n=>[n.id,n]));
 const links=(graph.gapLinks??[]).flatMap(link=>{
  const from=link?.from,to=link?.to;
  if(from?.kind==='gap_note'&&from.id===noteId&&to?.kind)
   return [{kind:to.kind,id:to.id}];
  if(to?.kind==='gap_note'&&to.id===noteId&&from?.kind)
   return [{kind:from.kind,id:from.id}];
  return [];
 });
 // Direct links must not implicitly expose retired originals or foreign
 // drafts. Their raw IDs and text are not reflected in returned payloads.
 const direct=[...new Set(links.filter(l=>l.kind==='plot_node'&&liveNodes.has(l.id)).map(l=>l.id))];
 const chosen=new Set(direct.slice(0,24));
 if(neighbors){
  for(const e of projection.edges){
   if(chosen.size>=24)break;
   if(direct.includes(e.from))chosen.add(e.to);
   if(chosen.size>=24)break;
   if(direct.includes(e.to))chosen.add(e.from);
  }
 }
 const selected=projection.nodes.filter(n=>chosen.has(n.id)),selectedIds=new Set(selected.map(n=>n.id));
 const relations=projection.edges.filter(e=>selectedIds.has(e.from)&&selectedIds.has(e.to));
 const relatedFields=[...new Set(links.filter(l=>l.kind==='semantic_field'&&liveFields.has(l.id)).map(l=>l.id))];
 const relatedNotes=[...new Set(links.filter(l=>l.kind==='gap_note'&&l.id!==noteId&&notes.has(l.id)).map(l=>l.id))];
 const workspaces=(graph.workspaces??[]).filter(w=>w.taskId===noteId);
 return {
  revision:graph.revision,
  task:{id:note.id,title:text(note.title||'Заметка',160),text:note.text,
    status:note.status,hasWorkspace:workspaces.length>0},
  context:{
   linkedStoryNodes:selected.map(n=>({id:n.id,title:text(n.title,300),description:text(n.description,1200)})),
   activeStoryRelations:relations.slice(0,50).map(e=>({from:e.from,to:e.to,type:e.type})),
   linkedFields:relatedFields.slice(0,8).map(fieldId=>{
    const f=liveFields.get(fieldId);
    return {id:f.id,title:text(f.title,300),comment:text(f.comment,1200)};
   }),
   linkedNotes:relatedNotes.slice(0,8).map(otherId=>{
    const n=notes.get(otherId);
    return {id:n.id,title:text(n.title||'Заметка',160),textPreview:text(n.text,280)};
   }),
   provenance:'explicit_note_links_and_active_one_hop',
   truncated:{
    storyNodes:direct.length>24||(neighbors&&projection.edges.some(e=>
      (direct.includes(e.from)&&!selectedIds.has(e.to))||
      (direct.includes(e.to)&&!selectedIds.has(e.from)))),
    storyRelations:relations.length>50,
    linkedFields:relatedFields.length>8,linkedNotes:relatedNotes.length>8
   }
  }
 };
}
