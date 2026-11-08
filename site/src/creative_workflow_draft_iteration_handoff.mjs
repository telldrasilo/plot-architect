/**
 * UX-RPL-E P1: compile a model-authored iteration into the EXISTING reviewed
 * stage_draft_iteration workflow command. Pure; no MCP/schema/tool registration,
 * LLM call, archived note, editor mutation or new persistence mechanism.
 */
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';
import {CreativeWorkflowContractError} from './creative_workflow_contract.mjs';
import {getSavedDraftIterationContext} from './creative_workflow_draft_iteration_context.mjs';
import {previewStageDraftIteration} from './creative_workflow_draft_iteration_stage.mjs';
import {CREATIVE_STRUCTURE_GUIDANCE,validateCreativeProposal} from './creative_workflow_proposal_compiler.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const validGenerationId=x=>typeof x==='string'&&/^[A-Za-z][A-Za-z0-9_-]{7,39}$/.test(x);
const W=208,GX=64,PX=36,PY=54,BOTTOM=40,ROW=44;
const finite=x=>Number.isFinite(x)&&Math.abs(x)<1000000;
const height=e=>Math.min(2500,Math.max(132,
  90+Math.ceil(e.title.length/23)*21+
  (e.description?Math.ceil(e.description.length/25)*19+10:0)));
const overlap=(a,b)=>a.x<b.x+b.width+30&&a.x+a.width+30>b.x&&
  a.y<b.y+b.height+30&&a.y+a.height+30>b.y;
function placement(graph,source,width,height){
 const obstacles=[
  ...(graph.workspaces??[]).map(w=>({x:w.x,y:w.y,width:w.width,height:w.height})),
  ...graph.nodes.filter(n=>!n.workspaceId).map(n=>({
   x:n.x,y:n.y,width:270,height:Math.max(150,n.height??150)
  })),
  ...(graph.gapNotes??[]).map(n=>({x:n.x,y:n.y,width:270,height:180}))
 ];
 const gap=80;
 const choices=[
  [source.x+source.width+gap,source.y],
  [source.x,source.y+source.height+gap],
  [source.x-width-gap,source.y],
  [source.x,source.y-height-gap]
 ];
 for(let ring=0;ring<24;ring++){
  const y=source.y+source.height+gap+ring*(height+gap);
  for(const dx of [0,width+gap,-width-gap])
   choices.push([source.x+dx,y]);
 }
 for(const [x,y] of choices){
  const candidate={x,y,width,height};
  if([x,y,x+width,y+height].every(finite)&&
     !obstacles.some(o=>overlap(candidate,o)))
   return {x,y,width,height};
 }
 fail('ITERATION_LAYOUT_NO_SPACE','no unobstructed bounded workspace position');
}

export function prepareSavedDraftIterationTask(graph,{
 workspaceId,nodeIds,neighbors=false
}={}){
 const selection=getSavedDraftIterationContext(graph,{workspaceId,nodeIds,neighbors});
 return {
  ...selection,
  structureGuidance:CREATIVE_STRUCTURE_GUIDANCE,
  iterationGuidance:'Сохранить новое предложение рядом с исходным Y как отдельные черновики. Никаких изменений исходных черновиков, канона и старой заметки.'
 };
}

export function prepareDraftIterationStageWrite(graph,{
 sourceWorkspaceId,sourceNodeIds,sourceRevision,generationId,proposal
}={}){
 const current=validateServerGraph(graph);
 if(!Number.isSafeInteger(sourceRevision)||sourceRevision<0||
    sourceRevision!==current.revision)
  fail('REVISION_CONFLICT','project has changed since selected draft was read');
 if(!validGenerationId(generationId))
  fail('ITERATION_GENERATION_ID_INVALID','stable generation ID required');
 const context=getSavedDraftIterationContext(current,{
  workspaceId:sourceWorkspaceId,nodeIds:sourceNodeIds
 });
 const shape=validateCreativeProposal(proposal);
 const heights=proposal.groups.map(group=>Math.max(...group.events.map(height)));
 const columns=Math.max(...proposal.groups.map(group=>group.events.length));
 const width=PX*2+columns*W+(columns-1)*GX;
 const totalHeight=PY+BOTTOM+heights.reduce((a,b)=>a+b,0)+ROW*(heights.length-1);
 if(!finite(width)||!finite(totalHeight))
  fail('ITERATION_LAYOUT_INVALID','new proposal dimensions exceed canvas bounds');
 const sourceArea=current.workspaces.find(w=>w.id===sourceWorkspaceId);
 const workspace=placement(current,sourceArea,width,totalHeight);
 const workspaceId='iw-'+generationId;
 let cursorY=workspace.y+PY;
 const branches=proposal.groups.map((group,i)=>{
  const branchId='ib-'+generationId+'-'+i,known=new Map();
  const nodes=group.events.map((event,j)=>{
   const id='in-'+generationId+'-'+i+'-'+j;
   known.set(event.key,id);
   return {id,title:event.title,description:event.description??'',
    x:workspace.x+PX+j*(W+GX),y:cursorY};
  });
  const edges=group.relations.map((edge,j)=>({
   id:'ie-'+generationId+'-'+i+'-'+j,
   from:known.get(edge.from),to:known.get(edge.to),type:edge.type
  }));
  cursorY+=heights[i]+ROW;
  return {id:branchId,title:group.title,nodes,edges};
 });
 const command={kind:'stage_draft_iteration',sourceWorkspaceId,
  sourceNodeIds:[...sourceNodeIds],workspaceId,workspace,branches};
 // Validate exact proposed command against the domain boundary before
 // routing through authenticated workflow preview/apply.
 const preview=previewStageDraftIteration(current,command);
 return {
  expectedRevision:sourceRevision,operationId:generationId,command,
  summary:{kind:proposal.kind,groupCount:branches.length,
   nodeCount:shape.nodeCount,edgeCount:shape.edgeCount,
   sourceWorkspaceId,sourceNodeIds:[...context.scope.sourceNodeIds]},
  layout:workspace,
  preview:{newWorkspaceId:preview.workspace.id,
   proposedNodeCount:preview.proposedNodes.length,
   proposedEdgeCount:preview.proposedEdges.length},
  previewRequired:true,canonChanged:false
 };
}
