/** CW-055: guarded edits of draft event text, never ordinary story PUT.
 * Only title and description of one node in the named working area may change.
 * The pure preview/apply pair is used by the existing authenticated
 * revision-CAS workflow; it does not change workspace membership or canon.
 */
import {
 CreativeWorkflowContractError,canonicalProjection,assertProtectedOriginalsUnchanged
} from './creative_workflow_contract.mjs';
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';

const fail=(code,message)=>{throw new CreativeWorkflowContractError(code,message)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const validText=(value,max)=>typeof value==='string'&&value.length<=max;

export function previewEditDraftText(graph,{workspaceId,nodeId,title,description}={}){
 validateServerGraph(graph);
 if(!id(workspaceId)||!(graph.workspaces??[]).some(area=>area.id===workspaceId))
  fail('WORKSPACE_NOT_FOUND',String(workspaceId));
 const node=graph.nodes.find(n=>n.id===nodeId);
 if(!id(nodeId)||node?.workspaceId!==workspaceId)
  fail('DRAFT_TARGET_INVALID',String(nodeId));
 if(!validText(title,300)||!title.trim()||title!==title.trim()||
    !validText(description,20000))
  fail('DRAFT_TEXT_INVALID','nonempty trimmed title <=300 and description <=20000 required');
 const before={title:node.title,description:node.description??''};
 const after={title,description};
 if(before.title===after.title&&before.description===after.description)
  fail('DRAFT_TEXT_UNCHANGED','no text change');
 return {workspaceId,nodeId,before,after,autoRewiredEdgeIds:[]};
}

export function applyEditDraftText(graph,{
 workspaceId,nodeId,title,description,expectedPreview,expectedRevision
}={}){
 if(expectedRevision!==undefined&&(!Number.isSafeInteger(expectedRevision)||
    expectedRevision<0||graph?.revision!==expectedRevision))
  fail('REVISION_CONFLICT','graph revision changed since review');
 const actual=previewEditDraftText(graph,{workspaceId,nodeId,title,description});
 if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','exact review required');
 if(JSON.stringify(actual)!==JSON.stringify(expectedPreview))
  fail('PREVIEW_STALE','draft text changed since review');
 const next=structuredClone(graph);
 const node=next.nodes.find(n=>n.id===nodeId);
 node.title=title;node.description=description;
 validateServerGraph(next);
 assertProtectedOriginalsUnchanged(graph,next);
 if(JSON.stringify(canonicalProjection(graph))!==JSON.stringify(canonicalProjection(next)))
  fail('CANON_CHANGED','draft text must not alter canon');
 return {graph:next,changes:{workspaceId,nodeId,changedFields:[
  ...(actual.before.title!==title?['title']:[]),
  ...(actual.before.description!==description?['description']:[])
 ],autoRewiredEdgeIds:[]}};
}
