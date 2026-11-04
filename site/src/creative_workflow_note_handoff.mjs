/**
 * CW-019: pure ChatGPT-to-Graphite handoff contract.
 *
 * These are INTERNAL building blocks for later approved MCP read/write tools.
 * ChatGPT decides the creative content, number of events and alternative
 * structure. The server only validates, places and stages; the author alone
 * promotes drafts into canonical plot. No registered MCP schema or route.
 */
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';
import {CreativeWorkflowContractError} from './creative_workflow_contract.mjs';
import {getNoteTaskContext} from './creative_workflow_note_context.mjs';
import {
  CREATIVE_STRUCTURE_GUIDANCE,compileNoteProposal
} from './creative_workflow_proposal_compiler.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};

/** A bounded editorial task and semantic instructions, NOT an entire plot. */
export function prepareNoteProcessingTask(graph,{noteId,neighbors=true}={}){
 const context=getNoteTaskContext(graph,{noteId,neighbors});
 if(context.task.hasWorkspace)
  fail('WORKSPACE_CONFLICT','note already has a staged working area');
 return {
  ...context,
  structureGuidance:CREATIVE_STRUCTURE_GUIDANCE,
  requiredOutput:{
   kind:'single | alternatives',
   groups:[{
    title:'Название предложения',
    events:[{key:'uniqueKey',title:'Краткий сюжетный блок',description:'Краткое описание'}],
    relations:[{from:'uniqueKey',to:'otherKey',type:'precedes | causes | enables | hinders'}]
   }],
   meaning:'single = одно творческое решение (может содержать несколько событий); alternatives = несколько разных решений, длина каждого произвольна',
   safety:'только новые черновики и их внутренние связи; не переписывать действующий сюжет'
  }
 };
}

/**
 * Bind model output to the exact revision from which its note/context came.
 * This is a command PREPARATION, not a write or server preview. The caller
 * must obtain workflow/preview then workflow/apply with expectedPreview and
 * the SAME stable generation/operation ID. Never retry with fresh IDs.
 */
export function prepareNoteStageWrite(graph,{noteId,sourceRevision,generationId,proposal}={}){
 const current=validateServerGraph(graph);
 if(!Number.isSafeInteger(sourceRevision)||sourceRevision<0||
    current.revision!==sourceRevision)
  fail('REVISION_CONFLICT','the note or plot changed after ChatGPT read it');
 const prepared=compileNoteProposal(current,{noteId,generationId,proposal});
 return {
  expectedRevision:sourceRevision,
  operationId:generationId,
  command:prepared.command,
  summary:prepared.shape,
  previewRequired:true,
  canonChanged:false
 };
}
