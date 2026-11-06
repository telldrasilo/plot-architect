"""CW-055-C: actual Chromium frame drag/resize, keyboard and server CAS.

Only synthetic editor graph and mocked local REST. Never connects to owner data,
production Site, production D1, a plugin or real MCP.
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
PROJECT="cw055-workspace-geometry-qa"


def main():
    source=story()
    db={"graph":copy.deepcopy(source),"revision":1,"preview":0,
        "apply":0,"put":0,"conflict":False,"receipts":{}}
    errors=[]

    def plan(command):
        assert set(command)=={"kind","workspaceId","mode","geometry"}
        assert command["kind"]=="set_workspace_geometry"
        assert command["mode"] in ("move","resize")
        area=next(w for w in db["graph"]["workspaces"]
                  if w["id"]==command["workspaceId"])
        before={k:area[k] for k in ("x","y","width","height")}
        after=command["geometry"]
        assert set(after)==set(before)
        assert all(isinstance(after[k],(int,float)) for k in before)
        assert before!=after
        if command["mode"]=="move":
            assert after["width"]==before["width"]
            assert after["height"]==before["height"]
        else:
            assert (after["x"],after["y"])==(before["x"],before["y"])
            assert after["width"]>=250 and after["height"]>=140
        delta={"x":after["x"]-before["x"],"y":after["y"]-before["y"]}
        nodes=[n for n in db["graph"]["nodes"]
               if n.get("workspaceId")==command["workspaceId"]]
        position_changes=([{"nodeId":n["id"],
          "before":{"x":n["x"],"y":n["y"]},
          "after":{"x":n["x"]+delta["x"],"y":n["y"]+delta["y"]}}
          for n in nodes] if command["mode"]=="move" else [])
        moved={p["nodeId"] for p in position_changes}
        relations=[e["id"] for e in db["graph"]["edges"]
                   if e.get("workspaceId")==command["workspaceId"] and
                      (e["from"] in moved or e["to"] in moved)]
        return {"workspaceId":command["workspaceId"],"mode":command["mode"],
                "before":before,"after":after,"delta":delta,
                "positionChanges":position_changes,
                "affectedDraftEdgeIds":relations,"autoRewiredEdgeIds":[]}

    def route(intercept):
        req=intercept.request
        path=urlsplit(req.url).path
        method=req.method

        def reply(payload,status=200):
            intercept.fulfill(status=status,content_type="application/json",
                              body=json.dumps(payload,ensure_ascii=False))

        if path=="/" and method=="GET":
            intercept.fulfill(status=200,content_type="text/html; charset=utf-8",
                              body=HTML)
        elif path=="/api/health":
            reply({"ok":True,"authenticated":True,"authMode":"node-loopback",
                   "workflowEnabled":True})
        elif path=="/api/projects" and method=="GET":
            reply({"projects":[{"id":PROJECT,"name":"Workspace Geometry QA",
                                "revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and method=="GET":
            reply({"id":PROJECT,"name":"Workspace Geometry QA",
                   "revision":db["revision"],"graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and method=="PUT":
            db["put"]+=1
            reply({"error":"EXPLICIT_WORKFLOW_COMMAND_REQUIRED"},422)
        elif path=="/api/projects/"+PROJECT+"/workflow/preview":
            body=json.loads(req.post_data or "{}")
            if body["expectedRevision"]!=db["revision"]:
                reply({"error":"REVISION_CONFLICT","message":"stale"},409)
                return
            try: p=plan(body["command"])
            except (AssertionError,KeyError,StopIteration):
                reply({"error":"WORKSPACE_GEOMETRY_INVALID"},422)
                return
            db["preview"]+=1
            reply({"projectId":PROJECT,"expectedRevision":db["revision"],
                   "kind":"set_workspace_geometry","preview":p})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply":
            body=json.loads(req.post_data or "{}")
            operation_id=body["operationId"]
            if operation_id in db["receipts"]:
                reply({**db["receipts"][operation_id],"replayed":True})
                return
            if db["conflict"] or body["expectedRevision"]!=db["revision"]:
                db["conflict"]=False
                db["revision"]+=1
                db["graph"]["revision"]=db["revision"]
                reply({"error":"REVISION_CONFLICT","message":"stale"},409)
                return
            command=body["command"]
            expected=command["expectedPreview"]
            clean={k:v for k,v in command.items() if k!="expectedPreview"}
            assert expected==plan(clean)
            area=next(a for a in db["graph"]["workspaces"]
                      if a["id"]==command["workspaceId"])
            area.update(copy.deepcopy(command["geometry"]))
            for change in expected["positionChanges"]:
                node=next(n for n in db["graph"]["nodes"]
                          if n["id"]==change["nodeId"])
                node.update(change["after"])
            db["revision"]+=1
            db["graph"]["revision"]=db["revision"]
            db["apply"]+=1
            receipt={"projectId":PROJECT,"revision":db["revision"],
                     "operationId":operation_id,
                     "kind":"set_workspace_geometry","replayed":False}
            db["receipts"][operation_id]=receipt
            reply(receipt)
        else: reply({"error":"NOT_FOUND"},404)

    def frame(): return copy.deepcopy(db["graph"]["workspaces"][0])

    def owned():
        return {n["id"]:(n["x"],n["y"]) for n in db["graph"]["nodes"]
                if n.get("workspaceId")=="w1"}

    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,
            args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1500,"height":1050})
        context.route(ORIGIN+"/**",route)
        page=context.new_page()
        page.on("pageerror",lambda error:errors.append(str(error)))
        page.goto(ORIGIN+"/")

        def loaded(revision):
            page.wait_for_function(
                """rev => window.__graphite &&
                    __graphite.getRemote().connected &&
                    __graphite.getRemote().revision===rev &&
                    document.querySelector('[data-cw-workspace="w1"]')""",
                arg=revision)

        loaded(1)
        page.evaluate("()=>__graphite.fit()")
        title=page.locator('[data-cw-workspace-move="w1"]')
        resize=page.locator('[data-cw-workspace-resize="w1"]')
        assert title.count()==1 and resize.count()==1
        old_nodes=owned()
        old_edges=copy.deepcopy(db["graph"]["edges"])
        old_canon=[copy.deepcopy(n) for n in db["graph"]["nodes"]
                   if not n.get("workspaceId")]

        # Keyboard group translation. Every member moves with the same delta.
        before=frame()
        title.focus()
        page.keyboard.press("ArrowRight")
        loaded(2)
        assert frame()["x"]==before["x"]+20
        assert all(owned()[key]==(x+20,y) for key,(x,y) in old_nodes.items())
        assert db["apply"]==1 and db["put"]==0
        assert db["graph"]["edges"]==old_edges

        # Keyboard resizing changes the frame, never a draft position.
        prior_nodes=owned()
        before=frame()
        resize.focus()
        page.keyboard.press("ArrowRight")
        loaded(3)
        assert frame()["width"]==before["width"]+20
        assert owned()==prior_nodes
        assert db["apply"]==2
        assert page.locator('[data-cw-workspace="w1"]').evaluate(
            "el => parseInt(el.style.width)") == frame()["width"]

        # Pointer group movement must not mutate local graph before release.
        page.evaluate("()=>__graphite.fit()")
        title=page.locator('[data-cw-workspace-move="w1"]')
        rect=title.bounding_box()
        assert rect and rect["width"]>0,rect
        sx=rect["x"]+min(55,rect["width"]/3)
        sy=rect["y"]+rect["height"]/2
        before=frame()
        before_nodes=owned()
        page.mouse.move(sx,sy)
        page.mouse.down()
        page.mouse.move(sx+64,sy+46,steps=8)
        assert frame()==before and owned()==before_nodes
        assert page.evaluate(
            "()=>__graphite.getState().workspaces.find(a=>a.id==='w1').x"
        )==before["x"]
        page.mouse.up()
        loaded(4)
        dx=frame()["x"]-before["x"]
        dy=frame()["y"]-before["y"]
        assert dx>0 and dy>0,(dx,dy)
        assert all(owned()[key]==(x+dx,y+dy)
                   for key,(x,y) in before_nodes.items())
        assert db["apply"]==3 and db["put"]==0

        # Corner handle resizes without moving ANY draft or changing ownership.
        page.evaluate("()=>__graphite.fit()")
        resize=page.locator('[data-cw-workspace-resize="w1"]')
        rect=resize.bounding_box()
        assert rect and rect["width"]>0,rect
        sx=rect["x"]+rect["width"]/2
        sy=rect["y"]+rect["height"]/2
        before=frame()
        before_nodes=owned()
        page.mouse.move(sx,sy)
        page.mouse.down()
        page.mouse.move(sx+66,sy+48,steps=6)
        assert frame()==before and owned()==before_nodes
        page.mouse.up()
        loaded(5)
        assert frame()["width"]>before["width"]
        assert frame()["height"]>before["height"]
        assert frame()["x"]==before["x"] and frame()["y"]==before["y"]
        assert owned()==before_nodes
        assert db["apply"]==4
        assert [n for n in db["graph"]["nodes"] if not n.get("workspaceId")]==old_canon
        assert db["graph"]["edges"]==old_edges

        # Escape cancels an in-progress pointer drag; nothing persisted.
        page.evaluate("()=>__graphite.fit()")
        rect=page.locator('[data-cw-workspace-move="w1"]').bounding_box()
        sx=rect["x"]+40;sy=rect["y"]+rect["height"]/2
        prior=frame()
        page.mouse.move(sx,sy)
        page.mouse.down()
        page.mouse.move(sx+80,sy+35,steps=5)
        page.keyboard.press("Escape")
        page.mouse.up()
        assert frame()==prior and db["apply"]==4
        assert page.locator('[data-cw-workspace="w1"]').evaluate(
            "el => parseInt(el.style.left)")==prior["x"]

        # Stale CAS must not mutate draft state or be treated as success.
        resize=page.locator('[data-cw-workspace-resize="w1"]')
        resize.focus()
        before=frame();before_nodes=owned()
        db["conflict"]=True
        page.keyboard.press("ArrowRight")
        page.wait_for_function("()=>__graphite.getRemote().blocked",timeout=6000)
        assert db["apply"]==4 and db["put"]==0
        assert frame()==before and owned()==before_nodes
        page.reload()
        loaded(6)
        assert frame()==before
        assert owned()==before_nodes
        assert not errors,errors
        context.close()
        browser.close()
    print(json.dumps({
        "result":"PASS","writes":db["apply"],"genericPUT":db["put"],
        "cases":["keyboard translate","keyboard resize",
                 "pointer group move","pointer corner resize",
                 "no optimistic plot mutation","escape cancel","stale CAS",
                 "reload","canon unchanged","internal edges unchanged"]
    },ensure_ascii=False))


if __name__=="__main__":
    main()
