"""CW: draft drop-to-plot and grouped acceptance, with synthetic REST only.

Real Chromium exercises the exact editor HTML. No live Site, D1 or user story.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from test_cw_persisted_workspace_accept_browser import story

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
PROJECT="cw-draft-drop-qa"

def main():
    graph=story()
    # A tall card reproduces the real reported overlap: a fixed 125px
    # drop-review offset previously covered the lower part of its text.
    graph["nodes"][1]["description"]="Длинное описание подготовленного события. " * 13
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
        result={"workspaceId":area,"acceptNodeIds":selected,"promoteEdgeIds":promoted,
                "reviewEdgeIds":reviewed,"autoRewiredEdgeIds":[]}
        if "placements" in command:
            by_pos={p["nodeId"]:p for p in command["placements"]}
            assert set(by_pos)==selected_set
            result["positionChanges"]=[
                {"nodeId":node_id,
                 "before":{"x":by_id[node_id]["x"],"y":by_id[node_id]["y"]},
                 "after":{"x":by_pos[node_id]["x"],"y":by_pos[node_id]["y"]}}
                for node_id in selected
            ]
        return result

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
            by_pos={p["nodeId"]:p for p in command.get("placements",[])}
            for node in db["graph"]["nodes"]:
                if node["id"] in chosen:
                    if node["id"] in by_pos:
                        node["x"]=by_pos[node["id"]]["x"]
                        node["y"]=by_pos[node["id"]]["y"]
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


    def drag(page,node_id,dx,dy):
        card=page.locator('[data-cw-node="'+node_id+'"]')
        rect=card.bounding_box()
        assert rect is not None
        x,y=rect["x"]+31,rect["y"]+25
        page.mouse.move(x,y)
        page.mouse.down()
        page.mouse.move(x+dx,y+dy,steps=12)
        page.mouse.up()

    def assert_review_next_to_card(page,node_id):
        geometry=page.evaluate("""nodeId => {
            const panel=document.querySelector('.cw-accept-review.cw-drop-review');
            const card=[...document.querySelectorAll('.cw-preview-card')]
                .find(el=>el.dataset.cwNode===nodeId);
            if(!panel||!card)return null;
            const a=panel.getBoundingClientRect(),b=card.getBoundingClientRect();
            const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
            const h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
            return {
                overlap:w*h,
                gap:Math.min(
                    Math.abs(a.left-b.right),Math.abs(b.left-a.right),
                    Math.abs(a.top-b.bottom),Math.abs(b.top-a.bottom)
                ),
                visible:a.left>=8&&a.top>=8
                    &&a.right<=document.documentElement.clientWidth-8
                    &&a.bottom<=document.documentElement.clientHeight-8,
                cardHeight:b.height
            };
        }""",node_id)
        assert geometry is not None
        assert geometry["overlap"]==0, geometry
        assert geometry["visible"], geometry

    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1440,"height":920})
        context.route("https://plot.local/**",api)
        page=context.new_page()
        page.on("pageerror",lambda exc:errors.append(str(exc)))
        page.goto("https://plot.local/")
        page.wait_for_function(
            "() => window.__graphite&&__graphite.getRemote().connected"
            "&&__graphite.getRemote().revision===1"
            "&&document.querySelectorAll('.cw-preview-card').length===4"
        )
        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        page.evaluate("() => __graphite.fit()")
        assert page.locator(".cw-accept-review").count()==0
        assert db["put"]==db["applies"]==0

        # Leaving the fixed transition boundary creates only a ghost and a
        # review. Escape returns the original draft without changing the DB.
        state_before=page.evaluate("() => __graphite.getState()")
        drag(page,"a",20,-178)
        page.locator(".cw-accept-review.cw-drop-review").wait_for()
        assert page.locator(".cw-drop-ghost").count()==1
        assert_review_next_to_card(page,"a")
        assert page.locator('[data-cw-node="a"]').bounding_box()["height"]>125
        assert page.evaluate("() => __graphite.getState()")==state_before, "ghost preview must not mutate any plot node"
        assert "1 событие" in page.locator(".cw-accept-review").inner_text()
        assert db["previews"]==1 and db["applies"]==0 and db["put"]==0
        assert page.evaluate("() => __graphite.getState().nodes.find(n=>n.id==='a').workspaceId")=="w1"
        page.keyboard.press("Escape")
        assert page.locator(".cw-drop-ghost").count()==0
        assert page.locator(".cw-accept-review").count()==0
        assert page.evaluate("() => __graphite.getState()")==state_before
        assert db["graph"]==before

        # A selected pair moves together. Preview reports internal edges,
        # and an explicit confirmation saves both positions and memberships.
        page.locator('[data-cw-node="a"]').click()
        page.locator('[data-cw-node="b"]').click(modifiers=["Control"])
        assert set(page.evaluate("() => __graphite.getCWSelectedDraftIds()"))=={"a","b"}
        drag(page,"a",20,-178)
        page.locator(".cw-accept-review.cw-drop-review").wait_for()
        assert page.locator(".cw-drop-ghost").count()==2
        assert_review_next_to_card(page,"a")
        assert db["reviewed"]["acceptNodeIds"]==["a","b"]
        assert db["reviewed"]["promoteEdgeIds"]==["ea"]
        assert len(db["reviewed"]["positionChanges"])==2
        assert db["applies"]==0 and db["put"]==0
        assert db["graph"]==before
        assert page.evaluate("() => __graphite.getState()")==state_before
        old_pos={n["id"]:(n["x"],n["y"]) for n in before["nodes"]}
        placements={v["nodeId"]:(v["after"]["x"],v["after"]["y"])
                    for v in db["reviewed"]["positionChanges"]}
        assert placements["a"][1]<old_pos["a"][1]
        assert placements["b"][1]-old_pos["b"][1]==placements["a"][1]-old_pos["a"][1]
        page.get_by_role("button",name="Принять в сюжет").click()
        page.wait_for_function(
            "() => __graphite.getRemote().revision===2"
            "&& document.querySelector('[data-node=\"a\"]')"
            "&& document.querySelector('[data-node=\"b\"]')"
        )
        assert db["applies"]==1 and db["put"]==0
        assert len(db["receipts"])==1
        assert db["graph"]["edges"][:3]==before["edges"][:3]
        for nid in ("a","b"):
            node=next(n for n in db["graph"]["nodes"] if n["id"]==nid)
            assert node.get("workspaceId") is None
            assert (node["x"],node["y"])==placements[nid]
        assert next(n for n in db["graph"]["nodes"] if n["id"]=="c")["workspaceId"]=="w1"
        assert next(e for e in db["graph"]["edges"] if e["id"]=="ea").get("workspaceId") is None

        page.reload()
        page.wait_for_function(
            "() => __graphite.getRemote().connected&&__graphite.getRemote().revision===2"
            "&&document.querySelectorAll('.cw-preview-card').length===2"
        )
        for nid in ("a","b"):
            node=page.evaluate("(id) => __graphite.getState().nodes.find(n=>n.id===id)",nid)
            assert (node["x"],node["y"])==placements[nid]

        # Concurrent update stops acceptance; no partial graph mutation.
        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        page.evaluate("() => __graphite.fit()")
        drag(page,"c",0,-300)
        page.locator(".cw-accept-review.cw-drop-review").wait_for()
        assert_review_next_to_card(page,"c")
        db["force_conflict"]=True
        page.get_by_role("button",name="Принять в сюжет").click()
        page.wait_for_function("() => !document.querySelector('.cw-accept-review')")
        assert db["applies"]==1 and db["put"]==0
        assert next(n for n in db["graph"]["nodes"] if n["id"]=="c")["workspaceId"]=="w1"
        assert page.locator('[data-node="c"]').count()==0
        assert not errors,errors
        context.close()
        browser.close()

    print(json.dumps({"result":"PASS","accepted":2,"batches":db["applies"],
      "cases":["drag-out preview no write","Escape cancel","group coordinates",
        "one accepted revision","reload","stale CAS rejected","canon isolation",
        "nonoverlap for tall, grouped and remaining cards"]},
      ensure_ascii=False))


if __name__=="__main__":
    main()
