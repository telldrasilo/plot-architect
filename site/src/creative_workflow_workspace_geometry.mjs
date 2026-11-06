/**
 * CW-055-C: saved frame geometry and group movement for a persisted workspace.
 * A move translates the frame and ALL owned draft cards in one reviewed CAS.
 * A resize changes only the saved frame: membership and draft coordinates
 * are never derived from visual containment. Neither operation edits canon.
 */
import {
  CreativeWorkflowContractError,canonicalProjection,assertProtectedOriginalsUnchanged
} from './creative_workflow_contract.mjs';
import {validateServerGraph} from './creative_workflow_server_boundary.mjs';

const fail=(code,message)=>{throw new CreativeWorkflowContractError(code,message)};
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const coordinate=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1_000_000;
const bounds=area=>({x:area.x,y:area.y,width:area.width,height:area.height});

export function previewWorkspaceGeometry(graph,{workspaceId,mode,geometry}={}){
  validateServerGraph(graph);
  if(!id(workspaceId))fail('WORKSPACE_NOT_FOUND',String(workspaceId));
  const area=(graph.workspaces??[]).find(a=>a.id===workspaceId);
  if(!area)fail('WORKSPACE_NOT_FOUND',workspaceId);
  if(mode!=='move'&&mode!=='resize')
    fail('WORKSPACE_GEOMETRY_MODE_INVALID','move or resize required');
  if(!isObj(geometry)||Object.keys(geometry).length!==4||
     Object.keys(geometry).some(k=>!['x','y','width','height'].includes(k))||
     ![geometry.x,geometry.y,geometry.width,geometry.height].every(coordinate)||
     geometry.width<1||geometry.height<1)
    fail('WORKSPACE_GEOMETRY_INVALID','explicit bounded x, y, width and height required');
  const before=bounds(area),after=bounds(geometry);
  if(Object.keys(before).every(k=>before[k]===after[k]))
    fail('WORKSPACE_GEOMETRY_UNCHANGED','no change to saved frame');
  if(mode==='move'&&(after.width!==before.width||after.height!==before.height))
    fail('WORKSPACE_GEOMETRY_INVALID','move cannot resize the frame');
  if(mode==='resize'){
    if(after.x!==before.x||after.y!==before.y||after.width<250||after.height<140)
      fail('WORKSPACE_GEOMETRY_INVALID','resize keeps top-left and requires >=250x140');
  }
  const delta={x:after.x-before.x,y:after.y-before.y};
  const changes=[];
  if(mode==='move'){
    for(const n of graph.nodes.filter(n=>n.workspaceId===workspaceId)){
      const x=n.x+delta.x,y=n.y+delta.y;
      if(!coordinate(x)||!coordinate(y))
        fail('WORKSPACE_MEMBER_OUT_OF_RANGE',n.id);
      changes.push({nodeId:n.id,before:{x:n.x,y:n.y},after:{x,y}});
    }
  }
  const changedIds=new Set(changes.map(n=>n.nodeId));
  const edges=graph.edges.filter(e=>e.workspaceId===workspaceId&&(
    changedIds.has(e.from)||changedIds.has(e.to)
  )).map(e=>e.id);
  return {
    workspaceId,mode,before,after,delta,positionChanges:changes,
    affectedDraftEdgeIds:edges,autoRewiredEdgeIds:[]
  };
}

export function applyWorkspaceGeometry(graph,{
  workspaceId,mode,geometry,expectedPreview,expectedRevision
}={}){
  if(expectedRevision!==undefined&&
     (!Number.isSafeInteger(expectedRevision)||expectedRevision<0||
      graph?.revision!==expectedRevision))
    fail('REVISION_CONFLICT','graph changed since geometry preview');
  const plan=previewWorkspaceGeometry(graph,{workspaceId,mode,geometry});
  if(expectedPreview===undefined)fail('PREVIEW_REQUIRED','exact geometry review required');
  if(JSON.stringify(expectedPreview)!==JSON.stringify(plan))
    fail('PREVIEW_STALE','workspace frame or draft positions changed');
  const next=structuredClone(graph);
  const area=next.workspaces.find(w=>w.id===workspaceId);
  Object.assign(area,plan.after);
  const positions=new Map(plan.positionChanges.map(p=>[p.nodeId,p.after]));
  for(const n of next.nodes)if(positions.has(n.id))
    Object.assign(n,positions.get(n.id));
  validateServerGraph(next);
  assertProtectedOriginalsUnchanged(graph,next);
  if(JSON.stringify(canonicalProjection(graph))!==JSON.stringify(canonicalProjection(next)))
    fail('CANON_CHANGED','workspace geometry cannot alter the plot');
  return {graph:next,changes:{
    workspaceId,mode,before:plan.before,after:plan.after,
    movedDraftNodeIds:plan.positionChanges.map(x=>x.nodeId),
    affectedDraftEdgeIds:plan.affectedDraftEdgeIds,
    autoRewiredEdgeIds:[]
  }};
}
