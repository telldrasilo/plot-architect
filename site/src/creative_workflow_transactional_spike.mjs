/**
 * CW-007/010 isolated transactional storage spike. NOT imported by worker,
 * editor, MCP, or any deployed route. Its cw_operation_receipts table exists
 * ONLY in the synthetic tests; production use requires a separate migration
 * authorization, authenticated routing and an audited release.
 *
 * A single source of story truth remains plot_projects.graph_json. The
 * receipt table holds operation metadata only, never a competing story graph.
 */
import {createHash} from 'node:crypto';
import {validateGraph} from './graph_contract.mjs';
import {
  CreativeWorkflowContractError,
  validateCreativeWorkflowGraph,
  applyDraftAcceptance,
  applyStartReplacement
} from './creative_workflow_contract.mjs';
import {applyReplacementReconnection} from './creative_workflow_reconnection.mjs';
import {
  applyCompleteReplacement,
  applyCancelReplacement
} from './creative_workflow_lifecycle.mjs';

const fail=(code,detail)=>{throw new CreativeWorkflowContractError(code,detail)};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const validRevision=x=>Number.isSafeInteger(x)&&x>=0;
const fields={
  accept_draft:['workspaceId','nodeIds','expectedPreview'],
  start_replacement:['replacementId','sourceNodeIds','expectedPreview'],
  reconnect:['replacementId','decisions','expectedPreview'],
  complete:['replacementId','expectedPreview','acknowledgeUnresolved'],
  cancel:['replacementId','expectedPreview']
};
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(object(value))return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
function digest(value){
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function commandValidation(command){
  if(!object(command)||!Object.hasOwn(fields,command.kind))fail('COMMAND_INVALID','unknown command');
  const allowed=new Set(['kind',...fields[command.kind]]);
  if(Object.keys(command).some(k=>!allowed.has(k))||!Object.hasOwn(command,'expectedPreview'))
    fail('COMMAND_INVALID','unexpected field or missing reviewed preview');
}
function verifiedGraph(raw,revision){
  const normalized=validateGraph(raw);
  normalized.revision=revision; // server row, not graph_json or client, is authoritative
  validateCreativeWorkflowGraph(normalized);
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
    case 'accept_draft':return applyDraftAcceptance(graph,args);
    case 'start_replacement':return applyStartReplacement(graph,args);
    case 'reconnect':return applyReplacementReconnection(graph,args);
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
export async function commitSyntheticWorkflowCommand(db,{
  projectId,operationId,expectedRevision,command
}={}){
  if(!validId(projectId)||!validId(operationId)||!validRevision(expectedRevision))
    fail('REQUEST_INVALID','project ID, operation ID and expected revision required');
  commandValidation(command);
  const requestHash=digest({expectedRevision,command});
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
  return {...response,replayed:false};
}
