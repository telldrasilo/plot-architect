"""CW-003: connect internal draft cards by one drag; protected workflow only.

Uses real Chromium and a fresh synthetic local REST mock. No user history, Site,
MCP or production D1 is accessed.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from test_cw_persisted_workspace_accept_browser import story

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
PROJECT="cw003-draft-connect-qa"
ORIGIN="http://127.0.0.1:8788"

def main():
    db={"graph":story(),"revision":1,"put":0,"preview":0,"apply":0,
        "force_conflict":False,"receipts":{}}
    errors=[]
    def plan(command):
        assert command["kind"]=="add_draft_edge"
        area=command["workspaceId"];draft=command["edge"]
        assert set(draft)=={"id","from","to","type"}
        nodes={n["id"]:n for n in db["graph"]["nodes"]}
        assert area=="w1" and draft["from"]!=draft["to"]
        assert nodes[draft["from"]]["workspaceId"]==area
        assert nodes[draft["to"]]["workspaceId"]==area
        assert not any(e["id"]==draft["id"] or (
            e.get("workspaceId")==area and
            e["from"]==draft["from"] and e["to"]==draft["to"]
        ) for e in db["graph"]["edges"])
        source,target=nodes[draft["from"]],nodes[draft["to"]]
        branch=source.get("draftBranchId") if (
            source.get("draftBranchId") and
            source.get("draftBranchId")==target.get("draftBranchId")
        ) else None
        result={"workspaceId":area,"operation":"add",
          "edge":{**draft,"workspaceId":area,"draftRelation":"internal"},
          "sourceBefore":{"id":source["id"],"workspaceId":area,
                          "draftBranchId":source.get("draftBranchId")},
          "targetBefore":{"id":target["id"],"workspaceId":area,
                          "draftBranchId":target.get("draftBranchId")},
          "affectedDraftEdgeIds":[],"autoRewiredEdgeIds":[]}
        if branch:result["edge"]["draftBranchId"]=branch
        return result

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
            reply({"projects":[{"id":PROJECT,"name":"Draft socket QA",
                                 "revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and method=="GET":
            reply({"id":PROJECT,"name":"Draft socket QA","revision":db["revision"],
                   "graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and method=="PUT":
            db["put"]+=1
            reply({"error":"GENERIC_PUT_FORBIDDEN"},422)
        elif path=="/api/projects/"+PROJECT+"/workflow/preview":
            body=json.loads(req.post_data or "{}")
            if body["expectedRevision"]!=db["revision"]:
                reply({"error":"REVISION_CONFLICT","message":"stale"},409);return
            try:result=plan(body["command"])
            except (AssertionError,KeyError):
                reply({"error":"DRAFT_EDGE_INVALID","message":"invalid draft edge"},422);return
            db["preview"]+=1
            reply({"kind":"add_draft_edge","projectId":PROJECT,
                   "expectedRevision":db["revision"],"preview":result})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply":
            body=json.loads(req.post_data or "{}")
            op=body["operationId"]
            if op in db["receipts"]:
                reply({**db["receipts"][op],"replayed":True});return
            if db["force_conflict"] or body["expectedRevision"]!=db["revision"]:
                db["force_conflict"]=False
                db["revision"]+=1;db["graph"]["revision"]=db["revision"]
                reply({"error":"REVISION_CONFLICT","message":"stale graph"},409);return
            command=body["command"]
            assert command["expectedPreview"]==plan(command)
            db["graph"]["edges"].append(copy.deepcopy(command["expectedPreview"]["edge"]))
            db["revision"]+=1;db["graph"]["revision"]=db["revision"]
            db["apply"]+=1
            result={"projectId":PROJECT,"revision":db["revision"],
                    "operationId":op,"kind":"add_draft_edge","replayed":False}
            db["receipts"][op]=result
            reply(result)
        else:reply({"error":"NOT_FOUND"},404)

    def endpoint(page,node_id):
        card=page.locator('[data-cw-node="'+node_id+'"]')
        rect=card.bounding_box()
        assert rect is not None,node_id
        return rect["x"]+36,rect["y"]+25

    def drag(page,source_id,target_id=None,finish=True):
        card=page.locator('[data-cw-node="'+source_id+'"]')
        card.hover(position={"x":35,"y":25})
        handle=page.locator('[data-cw-link-source="'+source_id+'"]')
        rect=handle.bounding_box()
        assert rect is not None,source_id
        x,y=rect["x"]+rect["width"]/2,rect["y"]+rect["height"]/2
        end=endpoint(page,target_id) if target_id else (1040,810)
        page.mouse.move(x,y);page.mouse.down()
        page.mouse.move(*end,steps=13)
        if finish:page.mouse.up()

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1440,"height":950})
        context.route(ORIGIN+"/**",route)
        page=context.new_page()
        page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto(ORIGIN+"/")
        page.wait_for_function(
            "() => window.__graphite&&__graphite.getRemote().connected"
            "&&document.querySelectorAll('[data-cw-node]').length===3"
        )
        page.evaluate("()=>__graphite.fit()")
        assert db["put"]==db["apply"]==0
        drag(page,"a","c",finish=False)
        assert page.locator(".cw-draft-link-guide").count()==1
        assert page.locator(".cw-draft-link-candidate:not([hidden])").count()==1
        assert page.locator(".cw-draft-link-target").count()==1
        assert db["apply"]==0
        assert page.evaluate("()=>__graphite.getState().edges.length")==4
        page.mouse.up()
        page.wait_for_function(
            "() => __graphite.getRemote().revision===2"
            "&&__graphite.getState().edges.length===5"
        )
        assert db["apply"]==1 and db["put"]==0
        new=next(e for e in db["graph"]["edges"] if e["id"].startswith("dedge-"))
        assert new["from"]=="a" and new["to"]=="c"
        assert new["workspaceId"]=="w1" and new["type"]=="precedes"
        assert new["draftRelation"]=="internal"
        assert page.locator('[data-cw-socket="'+new["id"]+':source"]').count()==1
        assert page.locator('[data-cw-socket="'+new["id"]+':target"]').count()==1

        drag(page,"c","b",finish=False)
        page.keyboard.press("Escape");page.mouse.up()
        assert db["apply"]==1
        assert page.locator(".cw-draft-link-guide").count()==0
        drag(page,"a","b")
        assert db["apply"]==1,"existing a->b duplicate must be rejected"
        drag(page,"a",None)
        assert db["apply"]==1

        page.reload()
        page.wait_for_function(
            "() => __graphite.getRemote().connected"
            "&&__graphite.getRemote().revision===2"
        )
        assert page.evaluate("()=>__graphite.getState().edges.length")==5
        page.evaluate("()=>__graphite.fit()")
        db["force_conflict"]=True
        drag(page,"c","b")
        page.wait_for_function("()=>__graphite.getRemote().blocked",timeout=6000)
        assert db["apply"]==1 and db["put"]==0
        assert page.evaluate("()=>__graphite.getState().edges.length")==5
        assert not errors,errors
        context.close();browser.close()
    print(json.dumps({"result":"PASS","writes":1,
      "cases":["draft drag preview","guarded workflow","readback",
       "Esc","duplicate","empty","reload","conflict"]}))

if __name__=="__main__":
    main()
