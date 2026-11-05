"""CW-003: draft edge target reconnect with isolated revision-CAS workflow.

Synthetic graph and mocked REST only. Existing edge must survive all cancels
and rejected attempts with unchanged ID, source and type.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from test_cw_persisted_workspace_accept_browser import story

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
PROJECT="cw003-draft-rewire-qa"
ORIGIN="http://127.0.0.1:8788"

def main():
    db={"graph":story(),"revision":1,"put":0,"preview":0,"apply":0,
        "force_conflict":False,"receipts":{}}
    errors=[]
    def plan(command):
        assert command["kind"]=="rewire_draft_edge"
        area=command["workspaceId"]
        edge_id=command["edgeId"];to=command["to"]
        edge=next(e for e in db["graph"]["edges"] if e["id"]==edge_id)
        nodes={n["id"]:n for n in db["graph"]["nodes"]}
        assert edge["workspaceId"]==area=="w1"
        assert edge["draftRelation"]=="internal"
        assert edge["from"]!=to and edge["to"]!=to
        assert nodes[to]["workspaceId"]==area
        assert not any(e["id"]!=edge_id and e.get("workspaceId")==area
           and e["from"]==edge["from"] and e["to"]==to
           for e in db["graph"]["edges"])
        after={**edge,"to":to}
        original_from=nodes[edge["from"]];target=nodes[to]
        if original_from.get("draftBranchId")==target.get("draftBranchId"):
            if original_from.get("draftBranchId"):
                after["draftBranchId"]=original_from["draftBranchId"]
        else:after.pop("draftBranchId",None)
        return {"workspaceId":area,"operation":"rewire",
          "edgeId":edge_id,"before":copy.deepcopy(edge),"after":after,
          "targetBefore":{"id":to,"workspaceId":area,
                          "draftBranchId":target.get("draftBranchId")},
          "affectedDraftEdgeIds":[edge_id],"autoRewiredEdgeIds":[]}

    def route(request):
        req=request.request;path=urlsplit(req.url).path;method=req.method
        def reply(obj,status=200):
            request.fulfill(status=status,content_type="application/json",
                            body=json.dumps(obj,ensure_ascii=False))
        if path=="/":
            request.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
        elif path=="/api/health":
            reply({"ok":True,"authenticated":True,"authMode":"node-loopback",
                   "workflowEnabled":True})
        elif path=="/api/projects" and method=="GET":
            reply({"projects":[{"id":PROJECT,"name":"Draft Rewire QA",
                                 "revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and method=="GET":
            reply({"id":PROJECT,"name":"Draft Rewire QA","revision":db["revision"],
                   "graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and method=="PUT":
            db["put"]+=1
            reply({"error":"GENERIC_PUT_FORBIDDEN"},422)
        elif path=="/api/projects/"+PROJECT+"/workflow/preview":
            body=json.loads(req.post_data or "{}")
            if body["expectedRevision"]!=db["revision"]:
                reply({"error":"REVISION_CONFLICT","message":"stale"},409);return
            try:result=plan(body["command"])
            except (AssertionError,KeyError,StopIteration):
                reply({"error":"DRAFT_EDGE_INVALID","message":"invalid"},422);return
            db["preview"]+=1
            reply({"kind":"rewire_draft_edge","projectId":PROJECT,
                   "expectedRevision":db["revision"],"preview":result})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply":
            body=json.loads(req.post_data or "{}")
            op=body["operationId"]
            if op in db["receipts"]:
                reply({**db["receipts"][op],"replayed":True});return
            if db["force_conflict"] or body["expectedRevision"]!=db["revision"]:
                db["force_conflict"]=False
                db["revision"]+=1;db["graph"]["revision"]=db["revision"]
                reply({"error":"REVISION_CONFLICT","message":"stale"},409);return
            command=body["command"]
            assert command["expectedPreview"]==plan(command)
            new_edge=copy.deepcopy(command["expectedPreview"]["after"])
            idx=next(i for i,e in enumerate(db["graph"]["edges"])
                     if e["id"]==command["edgeId"])
            db["graph"]["edges"][idx]=new_edge
            db["revision"]+=1;db["graph"]["revision"]=db["revision"]
            db["apply"]+=1
            result={"projectId":PROJECT,"revision":db["revision"],
                    "operationId":op,"kind":"rewire_draft_edge","replayed":False}
            db["receipts"][op]=result;reply(result)
        else:reply({"error":"NOT_FOUND"},404)

    def endpoint(page,node_id):
        card=page.locator('[data-cw-node="'+node_id+'"]')
        rect=card.bounding_box()
        assert rect is not None,node_id
        return rect["x"]+36,rect["y"]+26

    def drag(page,edge_id,target_id=None,finish=True):
        handle=page.locator('[data-cw-rewire-edge="'+edge_id+'"]')
        # No parent-card hover or selected edge is required to grab this port.
        rect=handle.bounding_box()
        assert rect is not None,edge_id
        start=(rect["x"]+rect["width"]/2,rect["y"]+rect["height"]/2)
        end=endpoint(page,target_id) if target_id else (1050,810)
        page.mouse.move(*start);page.mouse.down()
        page.mouse.move(*end,steps=13)
        if finish:page.mouse.up()

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1440,"height":950})
        context.route(ORIGIN+"/**",route)
        page=context.new_page();page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto(ORIGIN+"/")
        page.wait_for_function(
            "() => window.__graphite&&__graphite.getRemote().connected"
            "&&document.querySelectorAll('[data-cw-node]').length===3"
        )
        page.evaluate("()=>__graphite.fit()")
        handle=page.locator('[data-cw-rewire-edge="ea"]')
        assert handle.count()==1
        style=handle.evaluate("""el=>({
          pointer:getComputedStyle(el).pointerEvents,
          rest:getComputedStyle(el,'::after').opacity,
          radius:getComputedStyle(el,'::after').borderRadius
        })""")
        assert style=={"pointer":"auto","rest":"0","radius":"50%"},style
        handle.hover()
        assert handle.evaluate("el=>getComputedStyle(el,'::after').opacity")=="1"
        assert page.locator('[data-cw-socket="ea:target"].cw-preview-socket-hover').count()==1
        assert db["apply"]==db["put"]==0
        old=copy.deepcopy(db["graph"]["edges"])
        drag(page,"ea","c",finish=False)
        assert page.locator(".cw-draft-link-guide").count()==1
        assert page.locator(".cw-draft-link-candidate:not([hidden])").count()==1
        assert db["graph"]["edges"]==old
        assert page.evaluate("()=>__graphite.getState().edges.find(e=>e.id==='ea').to")=="b"
        page.keyboard.press("Escape");page.mouse.up()
        assert db["apply"]==0
        assert page.locator(".cw-draft-link-guide").count()==0
        assert db["graph"]["edges"]==old

        drag(page,"ea",None)
        assert db["apply"]==0 and db["graph"]["edges"]==old
        drag(page,"ea","c")
        page.wait_for_function(
            "() => __graphite.getRemote().revision===2"
            "&&__graphite.getState().edges.find(e=>e.id==='ea').to==='c'"
        )
        edge=next(e for e in db["graph"]["edges"] if e["id"]=="ea")
        assert edge["from"]=="a" and edge["to"]=="c"
        assert edge["type"]=="precedes" and edge["workspaceId"]=="w1"
        assert db["apply"]==1 and db["put"]==0
        assert len(db["graph"]["edges"])==len(old)

        page.reload()
        page.wait_for_function(
            "() => __graphite.getRemote().connected"
            "&&__graphite.getRemote().revision===2"
        )
        page.evaluate("()=>__graphite.fit()")
        assert page.locator('[data-cw-rewire-edge="ea"]').count()==1
        assert page.evaluate("()=>__graphite.getState().edges.find(e=>e.id==='ea').to")=="c"
        db["force_conflict"]=True
        drag(page,"ea","b")
        page.wait_for_function("()=>__graphite.getRemote().blocked",timeout=6000)
        assert db["apply"]==1 and db["put"]==0
        assert next(e for e in db["graph"]["edges"] if e["id"]=="ea")["to"]=="c"
        assert page.evaluate("()=>__graphite.getState().edges.find(e=>e.id==='ea').to")=="c"
        assert not errors,errors
        context.close();browser.close()
    print(json.dumps({"result":"PASS","writes":db["apply"],
      "cases":["ready on direct hover","no square",
       "immutable preview","Esc","off-target","same ID and type",
       "server readback","reload","stale CAS"]}))

if __name__=="__main__":
    main()
