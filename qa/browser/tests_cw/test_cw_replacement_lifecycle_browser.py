"""CW-010 C2: guarded complete/cancel UI, Escape, reload and no silent rollback.

All responses are synthetic intercepted REST; no owner data or persistent SQLite.
Actual server contract and transactional safety are tested by site Node tests.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HTML = (ROOT / "site/public/index.html").read_text(encoding="utf-8")
ORIGIN = "http://127.0.0.1:8788"
PROJECT = "cw010-lifecycle-synthetic"

def initial(resolved=(), blocked=False):
    nodes = [
        {"id":n, "title":title, "description":title+" description",
         "x":x, "y":60, "parent":None, "lineIds":["l1"], "size":"normal"}
        for n,title,x in [
            ("a","Cause",90), ("b","Original scene",420), ("c","Consequence",830)
        ]
    ]
    if blocked:
        nodes.append({"id":"x","title":"Accepted new canon","description":"A new scene",
                      "x":620,"y":380,"parent":None,"lineIds":["l1"],"size":"normal"})
    edges = [
        {"id":"e1","from":"a","to":"b","type":"precedes"},
        {"id":"e2","from":"b","to":"c","type":"causes"}
    ]
    replacement = {"id":"r1","state":"open","sourceNodeIds":["b"],
                   "suspendedEdgeIds":["e1","e2"],"sourceGraphRevision":13,
                   "edgeResolutions":[{"edgeId":edge_id,"decision":"drop"} for edge_id in resolved]}
    return {"version":1,"revision":14,"view":None,"nextNode":8,
            "nextEdge":3,"nextField":1,"nextLine":2,
            "nodes":nodes,"edges":edges,"fields":[],
            "lanes":[{"id":"l1","title":"Story","color":"#b8a16e","y":150}],
            "replacements":[replacement]}

def main():
    db={"graph":initial(),"revision":14,"blocked":False,"previews":0,
        "applies":0,"operations":set(),"planned":None,"generic":0}
    errors=[]
    def serve(route):
        req=route.request
        path=urlsplit(req.url).path
        def answer(data,status=200):
            route.fulfill(status=status,content_type="application/json",
                          body=json.dumps(data,ensure_ascii=False))
        if path=="/" and req.method=="GET":
            route.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
        elif path=="/api/health":
            answer({"ok":True,"authenticated":True,"authMode":"node-loopback","workflowEnabled":True})
        elif path=="/api/projects" and req.method=="GET":
            answer({"projects":[{"id":PROJECT,"name":"Synthetic lifecycle","revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and req.method=="GET":
            answer({"id":PROJECT,"name":"Synthetic lifecycle",
                    "revision":db["revision"],"graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and req.method=="PUT":
            db["generic"]+=1
            answer({"error":"PROTECTED_ORIGINAL"},422)
        elif path=="/api/projects/"+PROJECT+"/workflow/preview" and req.method=="POST":
            body=json.loads(req.post_data or "{}")
            assert body["expectedRevision"]==db["revision"]
            command=body["command"]
            assert set(command)=={"kind","replacementId"}
            assert command["replacementId"]=="r1"
            assert command["kind"] in ("complete","cancel")
            r=next(x for x in db["graph"]["replacements"] if x["id"]=="r1")
            old_nodes=[copy.deepcopy(n) for n in db["graph"]["nodes"] if n["id"]=="b"]
            old_edges=[copy.deepcopy(e) for e in db["graph"]["edges"] if e["id"] in ("e1","e2")]
            unresolved=[eid for eid in ("e1","e2") if eid not in
                        [d["edgeId"] for d in r.get("edgeResolutions",[])]]
            if command["kind"]=="complete":
                plan={"replacementId":"r1","sourceNodeIds":["b"],
                      "originalNodes":old_nodes,"suspendedEdges":old_edges,
                      "edgeResolutions":copy.deepcopy(r.get("edgeResolutions",[])),
                      "unresolvedEdgeIds":unresolved}
            else:
                blockers=["CANON_CHANGED_SINCE_REPLACEMENT"] if db["blocked"] else []
                plan={"replacementId":"r1","sourceGraphRevision":13,
                      "canCancel":not blockers,"blockers":blockers,
                      "restoreNodeIds":["b"],"restoreEdgeIds":["e1","e2"]}
            db["previews"]+=1
            db["planned"]=copy.deepcopy(plan)
            answer({"projectId":PROJECT,"expectedRevision":db["revision"],
                    "kind":command["kind"],"preview":plan})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply" and req.method=="POST":
            body=json.loads(req.post_data or "{}")
            assert body["expectedRevision"]==db["revision"]
            assert body["operationId"] not in db["operations"]
            command=body["command"]
            assert command["expectedPreview"]==db["planned"]
            r=next(x for x in db["graph"]["replacements"] if x["id"]=="r1")
            if command["kind"]=="complete":
                assert not db["planned"]["unresolvedEdgeIds"]
                r["state"]="completed"
            else:
                assert command["kind"]=="cancel" and db["planned"]["canCancel"]
                db["graph"]["replacements"]=[]
            db["revision"]+=1
            db["graph"]["revision"]=db["revision"]
            db["applies"]+=1
            db["operations"].add(body["operationId"])
            answer({"projectId":PROJECT,"kind":command["kind"],
                    "revision":db["revision"],"operationId":body["operationId"]})
        else:
            answer({"error":"NOT_FOUND"},404)

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1450,"height":980})
        context.route(ORIGIN+"/**",serve)
        page=context.new_page()
        page.on("pageerror",lambda err:errors.append(str(err)))
        def ready():
            page.wait_for_function(
                "()=>window.__graphite&&__graphite.getRemote().connected"
                "&&!__graphite.getRemote().busy&&!__graphite.getRemote().dirty")
        page.goto(ORIGIN+"/")
        ready()
        original=copy.deepcopy(db["graph"]["nodes"][1])
        old_edges=copy.deepcopy(db["graph"]["edges"])
        page.locator('[data-cw-original="b"]').click()
        inspector=page.locator("#inspector")
        assert inspector.locator("#cw-complete-replacement").is_disabled()
        assert "Завершение недоступно" in inspector.inner_text()
        assert db["previews"]==db["applies"]==0

        # Cancel requires an exact guarded server preview; Escape never writes.
        inspector.locator("#cw-cancel-replacement").click()
        dialog=page.locator("#cw-replacement-lifecycle-dialog")
        dialog.wait_for()
        assert "Original scene" in dialog.inner_text()
        assert db["previews"]==1 and db["applies"]==0
        page.keyboard.press("Escape")
        assert dialog.count()==0 and db["applies"]==0
        inspector.locator("#cw-cancel-replacement").click()
        dialog.wait_for()
        dialog.locator("#cw-lifecycle-confirm").click()
        page.wait_for_function(
            "()=>__graphite.getState().replacements.length===0"
            "&&!__graphite.getRemote().busy&&!__graphite.getRemote().dirty")
        assert db["applies"]==1
        assert page.locator('[data-cw-original="b"]').count()==0
        assert page.locator('[data-node="b"]').count()==1
        assert db["graph"]["nodes"][1]==original
        assert db["graph"]["edges"]==old_edges
        page.reload();ready()
        assert page.locator('[data-node="b"]').count()==1

        # 2/2 explicit resolutions allow completion; original is not removed.
        db.update({"graph":initial(resolved=("e1","e2")),"revision":14,
                   "blocked":False,"planned":None,"operations":set()})
        page.reload();ready()
        page.locator('[data-cw-original="b"]').click()
        assert inspector.locator("#cw-complete-replacement").is_enabled()
        inspector.locator("#cw-complete-replacement").click()
        dialog.wait_for()
        assert "Все 2 прежних отношений уже разобраны" in dialog.inner_text()
        page.keyboard.press("Escape")
        assert dialog.count()==0 and db["applies"]==1
        inspector.locator("#cw-complete-replacement").click()
        dialog.wait_for()
        dialog.locator("#cw-lifecycle-confirm").click()
        page.wait_for_function(
            "()=>__graphite.getState().replacements[0].state==='completed'"
            "&&!__graphite.getRemote().busy&&!__graphite.getRemote().dirty")
        assert db["applies"]==2
        assert db["graph"]["nodes"][1]==original
        assert db["graph"]["edges"]==old_edges
        assert page.locator('[data-cw-original="b"]').count()==0
        assert page.locator('[data-node="b"]').count()==0
        page.reload();ready()
        assert page.locator('[data-cw-original="b"]').count()==0

        # A changed canon is NEVER restored with a generic rollback.
        db.update({"graph":initial(blocked=True),"revision":14,
                   "blocked":True,"planned":None,"operations":set()})
        page.reload();ready()
        page.locator('[data-cw-original="b"]').click()
        inspector.locator("#cw-cancel-replacement").click()
        dialog.wait_for()
        assert "Отмена небезопасна" in dialog.inner_text()
        assert "изменился действующий сюжет" in dialog.inner_text()
        assert dialog.locator("#cw-lifecycle-confirm").count()==0
        dialog.locator("#cw-lifecycle-cancel").click()
        assert db["applies"]==2 and db["generic"]==0
        assert db["graph"]["replacements"][0]["state"]=="open"
        assert len(db["graph"]["nodes"])==4
        assert not errors,errors
        browser.close()
        print("CW-010 C2 synthetic Chromium: guarded complete/cancel, Esc, reload, blocked restore OK")

if __name__=="__main__":
    main()
