/**
 * CW-007/010 isolated transactional storage spike. NOT imported by worker,
 * editor, MCP, or any deployed route. Its cw_operation_receipts table exists
 * ONLY in the synthetic tests; production use requires a separate migration
 * authorization, authenticated routing and an audited release.
 *
 * A single source of story truth remains plot_projects.graph_json. The
 * receipt table holds operation metadata only, never a competing story graph.
 */
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';
import {previewStageNoteAlternatives,applyStageNoteAlternatives} from './creative_workflow_note_staging.mjs';
import {previewStageDraftIteration,applyStageDraftIteration} from './creative_workflow_draft_iteration_stage.mjs';
import {previewMoveDraftNodes,applyMoveDraftNodes} from './creative_workflow_draft_move.mjs';
import {previewWorkspaceGeometry,applyWorkspaceGeometry} from './creative_workflow_workspace_geometry.mjs';
import {previewEditDraftText,applyEditDraftText} from './creative_workflow_draft_text.mjs';
import {previewDiscardDraftNodes,applyDiscardDraftNodes} from './creative_workflow_draft_discard.mjs';
import {previewDropBoundaryRelation,applyDropBoundaryRelation} from './creative_workflow_boundary_drop.mjs';
import {
  previewAddDraftEdge,applyAddDraftEdge,
  previewRewireDraftEdge,applyRewireDraftEdge,
  previewSetDraftEdgeType,applySetDraftEdgeType
} from './creative_workflow_draft_edges.mjs';
import {
  CreativeWorkflowContractError,
  validateCreativeWorkflowGraph,
  previewDraftAcceptance,
  previewReplacementStart,
  applyDraftAcceptance,
  applyStartReplacement
} from './creative_workflow_contract.mjs';
import {previewReplacementReconnection,applyReplacementReconnection} from './creative_workflow_reconnection.mjs';
import {previewCreatePreparation,applyCreatePreparation,previewCancelPreparation,applyCancelPreparation} from './creative_workflow_preparation.mjs';
import {previewApplyPreparation,applyPreparation} from './creative_workflow_preparation_apply.mjs';
import {previewSetPreparationCandidates,applySetPreparationCandidates,previewSetPreparationDecisions,applySetPreparationDecisions} from './creative_workflow_preparation_edit.mjs';
import {previewLinkReplacementCandidates,applyLinkReplacementCandidates} from './creative_workflow_replacement_candidates.mjs';
import {previewPostCanonReview,applyPostCanonReview} from './creative_workflow_postcanon_review.mjs';
import {
  previewCompleteReplacement,
  previewCancelReplacement,
  applyCompleteReplacement,
  applyCancelReplacement
} from './creative_workflow_lifecycle.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const validRevision=x=>Number.isSafeInteger(x)&&x>=0;
const fields={
  stage_note:['noteId','workspaceId','workspace','branches','expectedPreview'],
  stage_draft_iteration:['sourceWorkspaceId','sourceNodeIds','workspaceId','workspace','branches','expectedPreview'],
  move_drafts:['workspaceId','moves','expectedPreview'],
  set_workspace_geometry:['workspaceId','mode','geometry','expectedPreview'],
  edit_draft_text:['workspaceId','nodeId','title','description','expectedPreview'],
  discard_drafts:['workspaceId','nodeIds','expectedPreview'],
  drop_boundary_relation:['workspaceId','edgeId','expectedPreview'],
  add_draft_edge:['workspaceId','edge','expectedPreview'],
  rewire_draft_edge:['workspaceId','edgeId','to','expectedPreview'],
  set_draft_edge_type:['workspaceId','edgeId','newType','expectedPreview'],
  accept_draft:['workspaceId','nodeIds','placements','expectedPreview'],
  create_preparation:['preparationId','sourceNodeId','expectedPreview'],
  cancel_preparation:['preparationId','expectedPreview'],
  apply_preparation:['preparationId','expectedPreview'],
  set_preparation_candidates:['preparationId','candidates','expectedPreview'],
  set_preparation_decisions:['preparationId','decisions','expectedPreview'],
  start_replacement:['replacementId','sourceNodeIds','expectedPreview'],
  reconnect:['replacementId','decisions','expectedPreview'],
  link_replacement_candidates:['replacementId','nodeIds','expectedPreview'],
  review_replacement:['replacementId','originalAction','candidateDecisions','edgeDecisions','acknowledgedTitleConflicts','expectedPreview'],
  complete:['replacementId','expectedPreview'],
  cancel:['replacementId','expectedPreview']
};
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(object(value))return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
async function digest(value){
  const bytes=new TextEncoder().encode(JSON.stringify(canonical(value)));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
function commandValidation(command,requiresReview=true){
  if(!object(command)||!Object.hasOwn(fields,command.kind))fail('COMMAND_INVALID','unknown command');
  const allowed=new Set(['kind',...fields[command.kind]]);
  if(Object.keys(command).some(k=>!allowed.has(k))||
    (requiresReview&&!Object.hasOwn(command,'expectedPreview'))||
    (!requiresReview&&Object.hasOwn(command,'expectedPreview')))
    fail('COMMAND_INVALID','unexpected field or invalid review field');
}
function verifiedGraph(raw,revision){
  const normalized=validateServerGraph(raw);
  normalized.revision=revision; // server row, not graph_json or client, is authoritative
  return normalized;
}
async function readReceipt(db,projectId,operationId){
  return db.prepare(
    'SELECT request_hash,response_json FROM cw_operation_receipts WHERE project_id=? AND operation_id=?'
  ).bind(projectId,operationId).first();
}
function replay(receipt,requestHash){
  if(receipt.request_hash!==requestHash)fail('OPERATION_ID_REUSED','same operation ID with different command');
  return {...JSON.parse(receipt.response_json),replayed:true};
}
async function runDomain(db,projectId,graph,expectedRevision,command){
  const args={...command,expectedRevision};
  switch(command.kind){
    case 'stage_note':return applyStageNoteAlternatives(graph,args);
    case 'stage_draft_iteration':return applyStageDraftIteration(graph,args);
    case 'move_drafts':return applyMoveDraftNodes(graph,args);
    case 'set_workspace_geometry':return applyWorkspaceGeometry(graph,args);
    case 'edit_draft_text':return applyEditDraftText(graph,args);
    case 'discard_drafts':return applyDiscardDraftNodes(graph,args);
    case 'drop_boundary_relation':return applyDropBoundaryRelation(graph,args);
    case 'add_draft_edge':return applyAddDraftEdge(graph,args);
    case 'rewire_draft_edge':return applyRewireDraftEdge(graph,args);
    case 'set_draft_edge_type':return applySetDraftEdgeType(graph,args);
    case 'accept_draft':return applyDraftAcceptance(graph,args);
    case 'create_preparation':return applyCreatePreparation(graph,args);
    case 'cancel_preparation':return applyCancelPreparation(graph,args);
    case 'apply_preparation':return applyPreparation(graph,args);
    case 'set_preparation_candidates':return applySetPreparationCandidates(graph,args);
    case 'set_preparation_decisions':return applySetPreparationDecisions(graph,args);
    case 'start_replacement':return applyStartReplacement(graph,args);
    case 'reconnect':return applyReplacementReconnection(graph,args);
    case 'link_replacement_candidates':{
      const baselineGraph=await baselineFromHistory(db,projectId,graph,command.replacementId);
      return applyLinkReplacementCandidates(graph,{...args,baselineGraph});
    }
    case 'review_replacement':{
      const baselineGraph=await baselineFromHistory(db,projectId,graph,command.replacementId);
      return applyPostCanonReview(graph,{...args,baselineGraph});
    }
    case 'complete':return applyCompleteReplacement(graph,args);
    case 'cancel':{
      // Always load the baseline from THIS project's immutable history.
      // Any attempted caller-supplied baselineGraph is forbidden by commandValidation.
      const r=(graph.replacements??[]).find(x=>x.id===command.replacementId);
      if(!r||!validRevision(r.sourceGraphRevision))fail('TRUSTED_BASELINE_REQUIRED','recorded source revision missing');
      const row=await db.prepare(
        'SELECT graph_json FROM plot_revisions WHERE project_id=? AND revision=?'
      ).bind(projectId,r.sourceGraphRevision).first();
      if(!row)fail('TRUSTED_BASELINE_REQUIRED','original historical revision unavailable');
      const baselineGraph=verifiedGraph(JSON.parse(row.graph_json),r.sourceGraphRevision);
      return applyCancelReplacement(graph,{...args,baselineGraph});
    }
    default:fail('COMMAND_INVALID','unsupported command');
  }
}

/**
 * Reference transactional writer on a D1-shaped DB abstraction.
 * Owner authentication/authorization MUST be enforced by any future caller.
 * Never invoke it against production D1: receipt schema is not deployed.
 *
 * A request ID and normalized command digest are scoped to one project.
 * Same request replay returns its original response even after newer revisions.
 * A stale/different request fails closed. The CAS update, immutable revision
 * snapshot and receipt insert MUST be committed in one DB batch.
 */
export async function commitWorkflowCommand(db,{
  projectId,operationId,expectedRevision,command
}={}){
  if(!validId(projectId)||!validId(operationId)||!validRevision(expectedRevision))
    fail('REQUEST_INVALID','project ID, operation ID and expected revision required');
  commandValidation(command);
  await assertWorkflowReceiptStore(db);
  const requestHash=await digest({expectedRevision,command});
  const previousReceipt=await readReceipt(db,projectId,operationId);
  if(previousReceipt)return replay(previousReceipt,requestHash);
  const row=await db.prepare(
    'SELECT id,name,revision,graph_json FROM plot_projects WHERE id=? AND deleted_at IS NULL'
  ).bind(projectId).first();
  if(!row)fail('PROJECT_NOT_FOUND',projectId);
  if(row.revision!==expectedRevision)fail('REVISION_CONFLICT','project changed since preview');
  const graph=verifiedGraph(JSON.parse(row.graph_json),row.revision);
  const outcome=await runDomain(db,projectId,graph,expectedRevision,command);
  const nextRevision=expectedRevision+1;
  if(!validRevision(nextRevision))fail('REVISION_INVALID','revision overflow');
  const updated=verifiedGraph(outcome.graph,nextRevision);
  // validateGraph guards current snapshot size and structural constraints.
  const serialized=JSON.stringify(updated);
  const response={
    projectId,operationId,revision:nextRevision,
    kind:command.kind,changes:outcome.changes
  };
  const timestamp=new Date().toISOString();
  // 'changes()' in the second and third statements is evaluated in the same
  // SQLite connection and batch, following the immediately prior statement.
  const results=await db.batch([
    db.prepare(
      'UPDATE plot_projects SET graph_json=?,revision=?,updated_at=? WHERE id=? AND revision=? AND deleted_at IS NULL'
    ).bind(serialized,nextRevision,timestamp,projectId,expectedRevision),
    db.prepare(
      "INSERT INTO plot_revisions (project_id,revision,graph_json,message,created_at) SELECT id,revision,graph_json,?,? FROM plot_projects WHERE id=? AND revision=? AND deleted_at IS NULL AND changes()=1"
    ).bind('CW '+command.kind,timestamp,projectId,nextRevision),
    db.prepare(
      "INSERT INTO cw_operation_receipts (project_id,operation_id,request_hash,response_json,revision,created_at) SELECT id,?,?,?,?,? FROM plot_projects WHERE id=? AND revision=? AND deleted_at IS NULL AND changes()=1"
    ).bind(operationId,requestHash,JSON.stringify(response),nextRevision,timestamp,projectId,nextRevision)
  ]);
  if(results?.[0]?.meta?.changes!==1){
    // Another concurrent caller won the CAS. The receipt may now exist if
    // both requests carried the same ID and digest.
    const concurrent=await readReceipt(db,projectId,operationId);
    if(concurrent)return replay(concurrent,requestHash);
    fail('REVISION_CONFLICT','compare-and-swap lost to a concurrent writer');
  }
  if(results?.[1]?.meta?.changes!==1||results?.[2]?.meta?.changes!==1)
    fail('BATCH_INVARIANT','history and receipt must be written with graph');
  // The new local replacement must not report success merely because CAS
  // advanced the row. Confirm the EXACT persisted result and receipt.
  // If this readback is interrupted, the same operationId safely replays.
  if(command.kind==='apply_preparation'){
    const saved=await db.prepare(
      'SELECT revision,graph_json FROM plot_projects WHERE id=? AND deleted_at IS NULL'
    ).bind(projectId).first();
    const receipt=await readReceipt(db,projectId,operationId);
    if(!saved||saved.revision!==nextRevision||
       JSON.stringify(canonical(verifiedGraph(JSON.parse(saved.graph_json),nextRevision)))!==JSON.stringify(canonical(updated))||
       !receipt||receipt.request_hash!==requestHash||
       JSON.stringify(canonical(JSON.parse(receipt.response_json)))!==JSON.stringify(canonical(response)))
      fail('WORKFLOW_READBACK_UNVERIFIED','atomic replacement result or receipt could not be confirmed');
  }
  return {...response,replayed:false};
}


// Legacy name retained for the existing isolated SQLite spike tests.
export const commitSyntheticWorkflowCommand=commitWorkflowCommand;

/**
 * Explicit capability guard. Fail closed if the receipt table has not been
 * approved and installed. Does not create or migrate D1 resources.
 */
export async function assertWorkflowReceiptStore(db){
  try{
    await db.prepare('SELECT operation_id FROM cw_operation_receipts LIMIT 0').all();
  }catch{
    fail('WORKFLOW_STORAGE_UNAVAILABLE','cw_operation_receipts table is not available');
  }
}

async function baselineFromHistory(db,projectId,graph,replacementId){
  const replacement=(graph.replacements??[]).find(r=>r.id===replacementId);
  if(!replacement||!validRevision(replacement.sourceGraphRevision))
    fail('TRUSTED_BASELINE_REQUIRED','recorded source revision missing');
  const saved=await db.prepare('SELECT graph_json FROM plot_revisions WHERE project_id=? AND revision=?')
    .bind(projectId,replacement.sourceGraphRevision).first();
  if(!saved)fail('TRUSTED_BASELINE_REQUIRED','historical revision not found');
  return verifiedGraph(JSON.parse(saved.graph_json),replacement.sourceGraphRevision);
}

/**
 * Read-only reviewed preview; the same project revision and proposal must
 * be submitted later to commitWorkflowCommand. No receipt is created here.
 */
export async function previewWorkflowCommand(db,{projectId,expectedRevision,command}={}){
  if(!validId(projectId)||!validRevision(expectedRevision))
    fail('REQUEST_INVALID','project ID and expected revision required');
  commandValidation(command,false);
  await assertWorkflowReceiptStore(db);
  const record=await db.prepare('SELECT id,revision,graph_json FROM plot_projects WHERE id=? AND deleted_at IS NULL')
    .bind(projectId).first();
  if(!record)fail('PROJECT_NOT_FOUND',projectId);
  if(record.revision!==expectedRevision)fail('REVISION_CONFLICT','project changed since preview');
  const graph=verifiedGraph(JSON.parse(record.graph_json),record.revision);
  let preview;
  switch(command.kind){
    case 'stage_note': preview=previewStageNoteAlternatives(graph,command);break;
    case 'stage_draft_iteration': preview=previewStageDraftIteration(graph,command);break;
    case 'move_drafts': preview=previewMoveDraftNodes(graph,command);break;
    case 'set_workspace_geometry': preview=previewWorkspaceGeometry(graph,command);break;
    case 'edit_draft_text': preview=previewEditDraftText(graph,command);break;
    case 'discard_drafts': preview=previewDiscardDraftNodes(graph,command);break;
    case 'drop_boundary_relation': preview=previewDropBoundaryRelation(graph,command);break;
    case 'add_draft_edge': preview=previewAddDraftEdge(graph,command);break;
    case 'rewire_draft_edge': preview=previewRewireDraftEdge(graph,command);break;
    case 'set_draft_edge_type': preview=previewSetDraftEdgeType(graph,command);break;
    case 'accept_draft': preview=previewDraftAcceptance(graph,command);break;
    case 'create_preparation': preview=previewCreatePreparation(graph,command);break;
    case 'cancel_preparation': preview=previewCancelPreparation(graph,command);break;
    case 'apply_preparation': preview=previewApplyPreparation(graph,command);break;
    case 'set_preparation_candidates': preview=previewSetPreparationCandidates(graph,command);break;
    case 'set_preparation_decisions': preview=previewSetPreparationDecisions(graph,command);break;
    case 'start_replacement': preview=previewReplacementStart(graph,command.sourceNodeIds);break;
    case 'reconnect': preview=previewReplacementReconnection(graph,command);break;
    case 'link_replacement_candidates':{
      const baselineGraph=await baselineFromHistory(db,projectId,graph,command.replacementId);
      preview=previewLinkReplacementCandidates(graph,{...command,baselineGraph});
      break;
    }
    case 'review_replacement':{
      const baselineGraph=await baselineFromHistory(db,projectId,graph,command.replacementId);
      preview=previewPostCanonReview(graph,{...command,baselineGraph});
      break;
    }
    case 'complete': preview=previewCompleteReplacement(graph,command);break;
    case 'cancel':{
      const baselineGraph=await baselineFromHistory(db,projectId,graph,command.replacementId);
      preview=previewCancelReplacement(graph,{...command,baselineGraph});
      break;
    }
    default:fail('COMMAND_INVALID','unsupported command');
  }
  return {projectId,expectedRevision,kind:command.kind,preview};
}
