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
            assert area["x"]<=move["x"]<=area["x"]+area["width"]-208
            assert area["y"]<=move["y"]<=area["y"]+area["height"]-105
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
        assert page.locator('[data-node="n2"]').count()==0
        assert page.locator('[data-edge="e1"]').count()==0
        assert page.locator('[data-edge="e2"]').count()==0
        assert page.locator('[data-edge="e3"]').count()==1
        assert db["put"]==0

        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        assert page.locator(".cw-movable-draft").count()==4
        drag(page,"a",85,45)
        pending=page.evaluate("() => __graphite.getCWPendingDraftMoves()")
        assert len(pending)==1 and pending[0]["nodeId"]=="a",pending
        assert pending[0]["x"]>150 and pending[0]["y"]>510
        assert page.evaluate("() => __graphite.getState().nodes.find(n=>n.id==='a').x")==150
        assert db["graph"]==original
        assert db["applies"]==0
        assert db["put"]==0

        # Another area cannot be silently included in the pending move batch.
        drag(page,"d",65,35)
        assert page.evaluate("() => __graphite.getCWPendingDraftMoves()")==pending
        assert db["put"]==0
        assert page.locator('[data-cw-workspace="w1"] .cw-draft-move-actions').count()==1
        page.get_by_role("button",name="Сохранить расположение").click()
        page.locator(".cw-move-review").wait_for()
        assert db["previews"]==1 and db["applies"]==0
        assert "сюжет и смысл связей не изменятся" in page.locator(".cw-move-review").inner_text()
        page.get_by_role("button",name="Вернуться").click()
        assert page.locator(".cw-move-review").count()==0
        assert len(page.evaluate("() => __graphite.getCWPendingDraftMoves()"))==1

        # Accumulate another card in the same area, then approve both in one
        # revision. The internal arrow keeps exactly the same semantic type.
        drag(page,"b",65,42)
        pending=page.evaluate("() => __graphite.getCWPendingDraftMoves()")
        assert {m["nodeId"] for m in pending}=={"a","b"},pending
        page.get_by_role("button",name="Сохранить расположение").click()
        page.locator(".cw-move-review").wait_for()
        assert "2 карточек" in page.locator(".cw-move-review").inner_text()
        assert db["last_preview"]["affectedDraftEdgeIds"]==["ea"]
        page.get_by_role("button",name="Подтвердить расположение").click()
        page.wait_for_function(
            "() => __graphite.getRemote().revision===2"
            "&&!document.querySelector('.cw-draft-move-actions')"
            "&&document.querySelectorAll('.cw-preview-card').length===4"
        )
        assert db["applies"]==1 and db["put"]==0
        assert len(db["receipts"])==1
        assert page.evaluate("() => __graphite.getCWPendingDraftMoves()")==[]
        for target in pending:
            saved=next(n for n in db["graph"]["nodes"] if n["id"]==target["nodeId"])
            assert (saved["x"],saved["y"])==(target["x"],target["y"])
        assert db["graph"]["edges"]==original["edges"]
        assert db["graph"]["replacements"]==original["replacements"]
        assert db["graph"]["nodes"][1]["title"]==original["nodes"][1]["title"]

        # Reload proves these coordinates are persisted, not just an overlay.
        page.reload()
        page.wait_for_function(
            "() => window.__graphite&&__graphite.getRemote().connected"
            "&&__graphite.getRemote().revision===2"
            "&&document.querySelectorAll('.cw-preview-card').length===4"
        )
        for target in pending:
            node=page.evaluate("(id) => __graphite.getState().nodes.find(n=>n.id===id)",target["nodeId"])
            assert (node["x"],node["y"])==(target["x"],target["y"])
        assert page.locator(".cw-movable-draft").count()==0
        assert page.locator('[data-node="a"]').count()==0

        # A server-side concurrent revision change rejects a later movement
        # as a unit, without promoting or moving any stored graph node.
        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        page.evaluate("() => __graphite.fit()")
        drag(page,"c",55,25)
        assert len(page.evaluate("() => __graphite.getCWPendingDraftMoves()"))==1
        page.get_by_role("button",name="Сохранить расположение").click()
        page.locator(".cw-move-review").wait_for()
        db["force_conflict"]=True
        page.get_by_role("button",name="Подтвердить расположение").click()
        page.wait_for_function("() => !document.querySelector('.cw-move-review')")
        assert db["applies"]==1 and db["put"]==0
        assert next(n for n in db["graph"]["nodes"] if n["id"]=="c")["x"]==150
        assert page.locator('[data-node="c"]').count()==0
        page.get_by_role("button",name="Сбросить").click()
        assert page.evaluate("() => __graphite.getCWPendingDraftMoves()")==[]
        assert not errors,errors
        context.close();browser.close()
    print(json.dumps({"result":"PASS","saved_cards":2,"revisions_written":1,
      "draft_arrows_unchanged":True,"generic_puts":db["put"],
      "cases":["ephemeral drag","same-area guard","explicit review","cancel",
        "one CAS","reload","stale conflict","preserve original"]},ensure_ascii=False))

if __name__=="__main__":
    main()
