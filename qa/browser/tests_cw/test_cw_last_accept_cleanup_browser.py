"""CW-055-E2: final accepted drafts remove empty area and old source note in Chromium.
Isolated Graphite HTML and synthetic REST only; no production data or deploy.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from test_cw_persisted_workspace_accept_browser import story

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
ORIGIN="http://127.0.0.1:8788"
PROJECT="cw055-final-accept-qa"

def main():
    initial=story()
    db={"graph":copy.deepcopy(initial),"revision":1,"preview":0,"apply":0,
        "put":0,"receipts":{}}
    errors=[]
    def plan(command):
        assert command["kind"]=="accept_draft"
        assert command["workspaceId"]=="w1"
        ids=command["nodeIds"]
        assert set(ids)=={"a","b","c"}
        return {"workspaceId":"w1","acceptNodeIds":ids,
                "promoteEdgeIds":["ea"],"reviewEdgeIds":[],
                "removeWorkspace":True,"removeNoteId":"gn1",
                "removeGapLinkIds":[],"autoRewiredEdgeIds":[]}

    def route(intercept):
        req=intercept.request
        path=urlsplit(req.url).path
        def reply(payload,status=200):
            intercept.fulfill(status=status,content_type="application/json",
                              body=json.dumps(payload,ensure_ascii=False))
        if path=="/" and req.method=="GET":
            intercept.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
        elif path=="/api/health":
            reply({"ok":True,"authenticated":True,"authMode":"node-loopback",
                   "workflowEnabled":True})
        elif path=="/api/projects" and req.method=="GET":
            reply({"projects":[{"id":PROJECT,"name":"Final acceptance QA",
                                "revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and req.method=="GET":
            reply({"id":PROJECT,"name":"Final acceptance QA",
                   "revision":db["revision"],"graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and req.method=="PUT":
            db["put"]+=1
            reply({"error":"PROTECTED_NODE_CHANGED"},422)
        elif path=="/api/projects/"+PROJECT+"/workflow/preview":
            body=json.loads(req.post_data or "{}")
            if body["expectedRevision"]!=db["revision"]:
                reply({"error":"REVISION_CONFLICT"},409);return
            try: p=plan(body["command"])
            except (AssertionError,KeyError,TypeError):
                reply({"error":"SELECTION_INVALID"},422);return
            db["preview"]+=1
            reply({"projectId":PROJECT,"expectedRevision":db["revision"],
                   "kind":"accept_draft","preview":p})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply":
            body=json.loads(req.post_data or "{}")
            op=body["operationId"]
            if op in db["receipts"]:
                reply({**db["receipts"][op],"replayed":True});return
            if body["expectedRevision"]!=db["revision"]:
                reply({"error":"REVISION_CONFLICT"},409);return
            cmd=body["command"]
            assert cmd["expectedPreview"]==plan({k:v for k,v in cmd.items()
                                                  if k!="expectedPreview"})
            for node in db["graph"]["nodes"]:
                if node["id"] in cmd["nodeIds"]:
                    node.pop("workspaceId",None);node.pop("draftBranchId",None)
            for edge in db["graph"]["edges"]:
                if edge["id"]=="ea":
                    edge.pop("workspaceId",None)
                    edge.pop("draftRelation",None)
                    edge.pop("draftBranchId",None)
            db["graph"]["workspaces"]=[]
            db["graph"]["gapNotes"]=[]
            db["graph"]["gapLinks"]=[]
            db["revision"]+=1;db["graph"]["revision"]=db["revision"]
            db["apply"]+=1
            result={"projectId":PROJECT,"revision":db["revision"],
                    "operationId":op,"kind":"accept_draft","replayed":False}
            db["receipts"][op]=result
            reply(result)
        else:
            reply({"error":"NOT_FOUND"},404)

    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,args=["--no-sandbox",
                                                               "--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1450,"height":950})
        context.route(ORIGIN+"/**",route)
        page=context.new_page()
        page.on("pageerror",lambda error:errors.append(str(error)))
        page.goto(ORIGIN+"/")
        page.wait_for_function("()=>window.__graphite && __graphite.getRemote().connected"
                               " && document.querySelectorAll('.cw-preview-card').length===3")
        page.evaluate("()=>__graphite.fit()")
        for key in ["a","b","c"]:
            page.locator(f'[data-cw-node="{key}"]').click()
        assert page.locator('[data-cw-discard-selected="w1"]').count()==1
        page.get_by_role("button",name="В сюжет (3)").click()
        review=page.locator(".cw-accept-review")
        review.wait_for()
        assert "пустая рабочая область исчезнет" in review.inner_text()
        assert db["apply"]==0
        review.get_by_role("button",name="Принять в сюжет").click()
        page.wait_for_function("()=>__graphite.getRemote().revision===2"
                               " && !document.querySelector('[data-cw-workspace=w1]')")
        assert db["apply"]==1 and db["put"]==0
        assert db["graph"]["workspaces"]==[]
        assert db["graph"]["gapNotes"]==[]
        assert db["graph"]["gapLinks"]==[]
        assert all("workspaceId" not in n for n in db["graph"]["nodes"])
        assert db["graph"]["edges"][-1]["id"]=="ea"
        assert "workspaceId" not in db["graph"]["edges"][-1]
        for key in ["a","b","c"]:
            assert page.locator(f'[data-node="{key}"]').count()==1
            assert page.locator(f'[data-cw-node="{key}"]').count()==0
        page.reload()
        page.wait_for_function("()=>window.__graphite&&__graphite.getRemote().connected"
                               " && __graphite.getRemote().revision===2")
        assert page.locator('[data-cw-workspace="w1"]').count()==0
        assert page.locator('[data-edge="ea"]').count()==1
        assert db["preview"]==1 and db["apply"]==1 and db["put"]==0
        assert not errors,errors
        context.close();browser.close()
    print(json.dumps({"result":"PASS","scenarios":["final acceptance",
       "single reviewed CAS","atomic empty frame and legacy note cleanup",
       "canonical relation promoted","reload","no generic PUT"]},ensure_ascii=False))

if __name__=="__main__":
    main()
