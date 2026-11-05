"""CW-015: saved draft geometry, reviewed CAS and reload in real Chromium.

Uses the actual Graphite editor HTML with a synthetic project REST backend. No
published Site, D1, MCP, plugin, or user story is accessed or modified.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from test_cw_persisted_workspace_accept_browser import story

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
PROJECT="cw-draft-move-qa"

def main():
    graph=story()
    graph["workspaces"].append({
        "id":"w2","taskId":"gn2","x":1240,"y":450,"width":420,"height":450
    })
    graph["nodes"].append({
        "id":"d","title":"Чужая область","description":"Отдельная версия",
        "x":1280,"y":540,"parent":None,"workspaceId":"w2","draftBranchId":"gamma"
    })
    original=copy.deepcopy(graph)
    db={"revision":1,"graph":graph,"previews":0,"applies":0,"put":0,
        "receipts":{},"last_preview":None,"force_conflict":False}
    errors=[]

    def plan(command):
        assert command["kind"]=="move_drafts"
        area=next(a for a in db["graph"]["workspaces"] if a["id"]==command["workspaceId"])
        moves=command["moves"]
        assert isinstance(moves,list) and 1<=len(moves)<=128
        assert len({m["nodeId"] for m in moves})==len(moves)
        by_id={n["id"]:n for n in db["graph"]["nodes"]}
        change=[]
        for move in moves:
            node=by_id[move["nodeId"]]
            assert node["workspaceId"]==area["id"]
            assert set(move)=={"nodeId","x","y"}
            assert abs(move["x"])<=1_000_000 and abs(move["y"])<=1_000_000
            assert (move["x"],move["y"])!=(node["x"],node["y"])
            change.append({"nodeId":node["id"],"before":{"x":node["x"],"y":node["y"]},
                           "after":{"x":move["x"],"y":move["y"]}})
        moved={item["nodeId"] for item in change}
        edges=[e["id"] for e in db["graph"]["edges"]
               if e.get("workspaceId")==area["id"] and
               (e["from"] in moved or e["to"] in moved)]
        return {"workspaceId":area["id"],"positionChanges":change,
                "affectedDraftEdgeIds":edges,"autoRewiredEdgeIds":[]}

    def handle(route):
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
            reply({"projects":[{"id":PROJECT,"name":"Move QA","revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and method=="GET":
            reply({"id":PROJECT,"name":"Move QA","revision":db["revision"],"graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and method=="PUT":
            db["put"]+=1;reply({"error":"GENERIC_WRITE_FORBIDDEN"},422)
        elif path=="/api/projects/"+PROJECT+"/workflow/preview":
            body=json.loads(req.post_data or "{}")
            if body["expectedRevision"]!=db["revision"]:
                reply({"error":"REVISION_CONFLICT"},409);return
            try: result=plan(body["command"])
            except (AssertionError,KeyError,StopIteration):
                reply({"error":"MOVE_SELECTION_INVALID"},422);return
            db["previews"]+=1
            db["last_preview"]=copy.deepcopy(result)
            reply({"projectId":PROJECT,"expectedRevision":db["revision"],
                   "kind":"move_drafts","preview":result})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply":
            body=json.loads(req.post_data or "{}")
            command=body["command"]
            assert command["kind"]=="move_drafts"
            operation_id=body["operationId"]
            assert operation_id
            old=db["receipts"].get(operation_id)
            if old:
                reply({**old,"replayed":True});return
            if db["force_conflict"]:
                db["force_conflict"]=False
                db["revision"]+=1
                db["graph"]["revision"]=db["revision"]
                reply({"error":"REVISION_CONFLICT","message":"Stale draft coordinates"},409);return
            if body["expectedRevision"]!=db["revision"]:
                reply({"error":"REVISION_CONFLICT"},409);return
            assert command["expectedPreview"]==plan(command)==db["last_preview"]
            by_id={n["id"]:n for n in db["graph"]["nodes"]}
            for move in command["moves"]:
                by_id[move["nodeId"]]["x"]=move["x"]
                by_id[move["nodeId"]]["y"]=move["y"]
            db["revision"]+=1
            db["graph"]["revision"]=db["revision"]
            db["applies"]+=1
            result={"projectId":PROJECT,"revision":db["revision"],
                    "operationId":operation_id,"kind":"move_drafts","replayed":False}
            db["receipts"][operation_id]=result
            reply(result)
        else:
            reply({"error":"NOT_FOUND"},404)

    def drag(page,node_id,dx,dy):
        card=page.locator('[data-cw-node="'+node_id+'"]')
        rect=card.bounding_box()
        assert rect is not None
        # Top-left title is not a button or checkbox, so it starts drag.
        x,y=rect["x"]+31,rect["y"]+25
        page.mouse.move(x,y)
        page.mouse.down()
        page.mouse.move(x+dx,y+dy,steps=8)
        page.mouse.up()

    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1440,"height":920})
        context.route("https://plot.local/**",handle)
        page=context.new_page()
        page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto("https://plot.local/")
        page.wait_for_function(
            "() => window.__graphite&&__graphite.getRemote().connected"
            "&&__graphite.getRemote().revision===1"
            "&&document.querySelectorAll('.cw-preview-card').length===4"
        )
        page.evaluate("() => __graphite.fit()")
        assert page.locator(".cw-movable-draft").count()==0
        assert page.locator(".cw-draft-check").count()==0
        assert page.locator(".cw-accept-trigger").count()==0
        assert page.locator('[data-node="n2"]').count()==0
        assert page.locator('[data-edge="e1"]').count()==0
        assert page.locator('[data-edge="e2"]').count()==0
        assert db["put"]==0

        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        assert page.locator(".cw-movable-draft").count()==4
        drag(page,"a",85,45)
        page.wait_for_function("() => __graphite.getRemote().revision===2")
        first=next(n for n in db["graph"]["nodes"] if n["id"]=="a")
        assert first["x"]>150 and first["y"]>510
        assert db["applies"]==1 and db["previews"]==1 and db["put"]==0
        assert page.evaluate("() => __graphite.getCWPendingDraftMoves()")==[]
        assert page.locator(".cw-move-review").count()==0
        assert page.locator(".cw-draft-move-actions").count()==0

        # Direct selection, Ctrl-click grouping and drag operate on the same
        # two cards; no checkbox or explicit save is part of the workflow.
        page.locator('[data-cw-node="a"]').click()
        page.locator('[data-cw-node="b"]').click(modifiers=["Control"])
        assert set(page.evaluate("() => __graphite.getCWSelectedDraftIds()"))=={"a","b"}
        before={n["id"]:(n["x"],n["y"]) for n in db["graph"]["nodes"] if n["id"] in ("a","b")}
        drag(page,"a",65,42)
        page.wait_for_function("() => __graphite.getRemote().revision===3")
        after={n["id"]:(n["x"],n["y"]) for n in db["graph"]["nodes"] if n["id"] in ("a","b")}
        assert after["a"]!=before["a"] and after["b"]!=before["b"]
        assert (after["a"][0]-before["a"][0],after["a"][1]-before["a"][1])==(
            after["b"][0]-before["b"][0],after["b"][1]-before["b"][1])
        assert db["last_preview"]["affectedDraftEdgeIds"]==["ea"]
        assert db["applies"]==2 and db["put"]==0
        assert db["graph"]["edges"]==original["edges"]
        assert db["graph"]["replacements"]==original["replacements"]

        # Switching to another area is allowed; batches remain individually
        # scoped by workspace ID and cannot merge unrelated drafts.
        page.evaluate("() => __graphite.fit()")
        drag(page,"d",50,30)
        page.wait_for_function("() => __graphite.getRemote().revision===4")
        assert db["last_preview"]["workspaceId"]=="w2"
        assert db["applies"]==3 and db["put"]==0

        # Reload confirms server persistence, not only transient drag pixels.
        page.reload()
        page.wait_for_function(
            "() => __graphite.getRemote().connected"
            "&&__graphite.getRemote().revision===4"
            "&&document.querySelectorAll('.cw-preview-card').length===4"
        )
        for node_id,xy in after.items():
            stored=page.evaluate("(id) => __graphite.getState().nodes.find(n=>n.id===id)",node_id)
            assert (stored["x"],stored["y"])==xy
        assert page.locator(".cw-movable-draft").count()==0
        assert page.locator('[data-node="a"]').count()==0

        # A concurrent server-side revision must fail closed and preserve
        # pending positions for diagnosis, not update the canonical story.
        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        page.evaluate("() => __graphite.fit()")
        db["force_conflict"]=True
        original_c=next(n for n in db["graph"]["nodes"] if n["id"]=="c")["x"]
        drag(page,"c",45,25)
        page.locator(".cw-draft-move-actions[role=alert]").wait_for()
        assert db["applies"]==3 and db["put"]==0
        assert next(n for n in db["graph"]["nodes"] if n["id"]=="c")["x"]==original_c
        assert any(m["nodeId"]=="c" for m in page.evaluate("() => __graphite.getCWPendingDraftMoves()"))
        assert page.locator(".cw-draft-check").count()==0
        assert not errors,errors
        context.close();browser.close()
    print(json.dumps({"result":"PASS","revisions_written":db["applies"],
      "draft_arrows_unchanged":True,"generic_puts":db["put"],
      "cases":["direct drag autosave","Ctrl-click group","cross-workspace moves",
        "one CAS per batch","reload","stale conflict","original preserved"]},ensure_ascii=False))

if __name__=="__main__":
    main()
