"""CW-014 grouped acceptance on a synthetic persisted Graphite workspace.

Browser uses real editor HTML and mock REST. Group selection must be single-
workspace, previewed and accepted as one receipt/revision. No Site, D1 or MCP.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from test_cw_persisted_workspace_accept_browser import story

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
PROJECT="cw-group-qa"

def main():
    graph=story()
    graph["workspaces"].append({"id":"w2","taskId":"gn2","x":1260,"y":450,"width":420,"height":400})
    graph["nodes"].append({"id":"d","title":"Независимая версия","description":"Вторая область",
                            "x":1300,"y":510,"parent":None,"workspaceId":"w2","draftBranchId":"gamma"})
    before=copy.deepcopy(graph)
    db={"revision":1,"graph":graph,"previews":0,"applies":0,"put":0,"receipts":{},
        "force_conflict":False,"reviewed":None}
    errors=[]

    def plan(command):
        assert command["kind"]=="accept_draft"
        area=command["workspaceId"]
        selected=command["nodeIds"]
        assert isinstance(selected,list) and selected and len(selected)==len(set(selected))
        active={n["id"] for n in db["graph"]["nodes"] if "workspaceId" not in n and n["id"]!="n2"}
        by_id={n["id"]:n for n in db["graph"]["nodes"]}
        assert all(by_id[x].get("workspaceId")==area for x in selected)
        selected_set=set(selected)
        promoted,reviewed=[],[]
        for e in db["graph"]["edges"]:
            if e.get("workspaceId")!=area or not (e["from"] in selected_set or e["to"] in selected_set):
                continue
            eligible={*active,*selected_set}
            if e.get("draftRelation")=="internal" and e["from"] in eligible and e["to"] in eligible:
                promoted.append(e["id"])
            else:
                reviewed.append(e["id"])
        return {"workspaceId":area,"acceptNodeIds":selected,"promoteEdgeIds":promoted,
                "reviewEdgeIds":reviewed,"autoRewiredEdgeIds":[]}

    def api(route):
        req=route.request
        path=urlsplit(req.url).path
        method=req.method
        def reply(value,status=200):
            route.fulfill(status=status,content_type="application/json",
                          body=json.dumps(value,ensure_ascii=False))
        if path=="/" and method=="GET":
            route.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
        elif path=="/api/health":
            reply({"ok":True,"authenticated":True,"authMode":"sites-native"})
        elif path=="/api/projects" and method=="GET":
            reply({"projects":[{"id":PROJECT,"name":"Grouped acceptance","revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and method=="GET":
            reply({"id":PROJECT,"name":"Grouped acceptance","revision":db["revision"],
                   "graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and method=="PUT":
            db["put"]+=1;reply({"error":"GENERIC_WRITE_FORBIDDEN"},422)
        elif path=="/api/projects/"+PROJECT+"/workflow/preview":
            body=json.loads(req.post_data or "{}")
            if body["expectedRevision"]!=db["revision"]:
                reply({"error":"REVISION_CONFLICT"},409);return
            try: preview=plan(body["command"])
            except (KeyError,AssertionError):
                reply({"error":"SELECTION_INVALID"},422);return
            db["previews"]+=1
            db["reviewed"]=copy.deepcopy(preview)
            reply({"projectId":PROJECT,"kind":"accept_draft",
                   "expectedRevision":db["revision"],"preview":preview})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply":
            body=json.loads(req.post_data or "{}")
            command=body["command"]
            key=body["operationId"]
            assert key
            if key in db["receipts"]:
                reply({**db["receipts"][key],"replayed":True});return
            if db["force_conflict"]:
                db["force_conflict"]=False;db["revision"]+=1
                db["graph"]["revision"]=db["revision"]
                reply({"error":"REVISION_CONFLICT","message":"Old review"},409);return
            if body["expectedRevision"]!=db["revision"]:
                reply({"error":"REVISION_CONFLICT"},409);return
            assert command["expectedPreview"]==plan(command)
            assert command["expectedPreview"]==db["reviewed"]
            chosen=set(command["nodeIds"])
            for node in db["graph"]["nodes"]:
                if node["id"] in chosen:
                    node.pop("workspaceId")
                    node.pop("draftBranchId",None)
            for edge in db["graph"]["edges"]:
                if edge["id"] in command["expectedPreview"]["promoteEdgeIds"]:
                    edge.pop("workspaceId")
                    edge.pop("draftRelation")
                    edge.pop("draftBranchId",None)
            db["revision"]+=1
            db["graph"]["revision"]=db["revision"]
            db["applies"]+=1
            result={"projectId":PROJECT,"revision":db["revision"],
                    "operationId":key,"replayed":False,"kind":"accept_draft"}
            db["receipts"][key]=result
            reply(result)
        else:
            reply({"error":"NOT_FOUND"},404)

    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1365,"height":920})
        context.route("https://plot.local/**",api)
        page=context.new_page()
        page.on("pageerror",lambda exc:errors.append(str(exc)))
        page.goto("https://plot.local/")
        page.wait_for_function(
            "() => window.__graphite&&__graphite.getRemote().connected"
            "&&__graphite.getRemote().revision===1"
            "&&document.querySelectorAll('.cw-preview-card').length===4"
        )
        assert page.locator(".cw-draft-check").count()==0
        assert page.locator('[data-node="n2"]').count()==0
        for node_id in ("a","b","c","d"):
            assert page.locator('[data-cw-node="'+node_id+'"]').count()==1
            assert page.locator('[data-node="'+node_id+'"]').count()==0

        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        assert page.locator(".cw-draft-check").count()==4

        def pick(node_id):
            page.locator('[data-cw-node="'+node_id+'"] .cw-draft-check').check()
        # A selection made in a different workspace replaces, never mixes,
        # the prior selection. No generic state/REST writes occur.
        pick("a")
        assert page.evaluate("() => __graphite.getCWSelectedDraftIds()")==["a"]
        pick("d")
        assert page.evaluate("() => __graphite.getCWSelectedDraftIds()")==["d"]
        assert page.locator('[data-cw-node="a"] .cw-draft-check').is_checked() is False
        assert page.locator('[data-cw-workspace="w1"] .cw-draft-selection-actions').count()==0
        assert page.locator('[data-cw-workspace="w2"] .cw-draft-selection-actions').count()==1
        page.locator('[data-cw-workspace="w2"] .cw-draft-selection-actions button').last.click()
        assert page.evaluate("() => __graphite.getCWSelectedDraftIds()")==[]

        pick("a");pick("b")
        assert page.evaluate("() => __graphite.getCWSelectedDraftIds()")==["a","b"]
        assert page.locator('[data-cw-workspace="w1"] .cw-draft-selection-actions').inner_text().find("Выбрано: 2")>=0
        assert db["applies"]==0 and db["put"]==0

        # Preview is one operation, not two sequential calls.
        page.locator('[data-cw-workspace="w1"] .cw-draft-selection-actions button').first.click()
        page.locator(".cw-accept-review").wait_for()
        assert db["reviewed"]["acceptNodeIds"]==["a","b"]
        assert db["reviewed"]["promoteEdgeIds"]==["ea"]
        assert db["reviewed"]["reviewEdgeIds"]==[]
        assert "2 событие(ий)" in page.locator(".cw-accept-review").inner_text()
        assert "внутренних связей: 1" in page.locator(".cw-accept-review").inner_text()
        assert db["applies"]==0
        assert db["graph"]==before
        page.get_by_role("button",name="Отмена").click()
        assert page.locator(".cw-accept-review").count()==0
        assert page.evaluate("() => __graphite.getCWSelectedDraftIds()")==["a","b"]

        # Stale revision cancels entire selected batch; nothing canonical
        # changes, even though the backend has advanced its revision.
        page.locator('[data-cw-workspace="w1"] .cw-draft-selection-actions button').first.click()
        page.locator(".cw-accept-review").wait_for()
        db["force_conflict"]=True
        page.get_by_role("button",name="Принять в сюжет").click()
        page.wait_for_function("() => !document.querySelector('.cw-accept-review')")
        assert db["applies"]==0
        assert any(n.get("workspaceId")=="w1" and n["id"]=="a" for n in db["graph"]["nodes"])
        assert page.locator('[data-node="a"]').count()==0
        assert db["put"]==0

        # Reload clears stale selection. Reselect both and commit the batch
        # as one new revision, including its internal link.
        page.reload()
        page.wait_for_function(
            "() => window.__graphite&&__graphite.getRemote().connected"
            "&&__graphite.getRemote().revision===2"
            "&&document.querySelectorAll('.cw-preview-card').length===4"
        )
        assert page.evaluate("() => __graphite.getCWSelectedDraftIds()")==[]
        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        pick("a");pick("b")
        page.locator('[data-cw-workspace="w1"] .cw-draft-selection-actions button').first.click()
        page.locator(".cw-accept-review").wait_for()
        page.get_by_role("button",name="Принять в сюжет").click()
        page.wait_for_function(
            "() => __graphite.getRemote().revision===3"
            "&&document.querySelector('[data-node=\"a\"]')"
            "&&document.querySelector('[data-node=\"b\"]')"
            "&&document.querySelector('[data-edge=\"ea\"]')"
        )
        assert db["applies"]==1
        assert db["put"]==0
        assert len(db["receipts"])==1
        assert page.evaluate("() => __graphite.getCWSelectedDraftIds()")==[]
        assert page.locator('[data-cw-node="c"]').count()==1
        assert page.locator('[data-cw-node="d"]').count()==1
        assert page.locator('[data-node="n2"]').count()==0
        assert page.locator('[data-edge="e1"]').count()==0
        assert page.locator('[data-edge="e2"]').count()==0
        assert db["graph"]["nodes"][1]["title"]=="Старый поворот"
        assert not errors,errors
        context.close();browser.close()
    print(json.dumps({
        "result":"PASS","accepted":2,"remaining":2,
        "accepted_links":1,"batches":db["applies"],"generic_writes":db["put"],
        "cases":["single-area grouping","cross-workspace reset","review and cancel",
                 "atomic conflict","one batch","reload","original preserved"]
    },ensure_ascii=False))

if __name__=="__main__":
    main()
