"""CW-010 A: explicit reviewed replacement and non-canonical original on the real UI.

All requests are intercepted by a synthetic owner-only Node-like REST seam.
Neither a user's plot nor Site/D1/MCP, nor a persistent SQLite file is touched.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
ORIGIN="http://127.0.0.1:8788"
PROJECT="cw010-start-synthetic"

def plot():
    return {
        "version":1,"revision":0,"view":None,
        "nextNode":5,"nextEdge":4,"nextField":1,"nextLine":2,
        "nodes":[
            {"id":"a","title":"До поворота","description":"Начальный факт",
             "x":110,"y":100,"parent":None,"lineIds":["l1"],"size":"normal"},
            {"id":"b","title":"Поворот","description":"Исходное событие без сокращений",
             "x":480,"y":150,"parent":None,"lineIds":["l1"],"size":"normal"},
            {"id":"c","title":"Последствие","description":"Другой сюжетный факт",
             "x":850,"y":160,"parent":None,"lineIds":["l1"],"size":"normal"},
        ],
        "edges":[
            {"id":"ab","from":"a","to":"b","type":"precedes"},
            {"id":"bc","from":"b","to":"c","type":"causes"}
        ],
        "fields":[],"lanes":[{"id":"l1","title":"Линия","color":"#b8a16e","y":150}],
        "replacements":[]
    }

def main():
    initial=plot()
    db={"graph":copy.deepcopy(initial),"revision":0,
        "generic":0,"previews":0,"applies":0,"operations":set()}
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
            answer({"ok":True,"authenticated":True,"authMode":"node-loopback",
                    "workflowEnabled":True})
        elif path=="/api/projects" and req.method=="GET":
            answer({"projects":[{"id":PROJECT,"name":"CW-010 QA","revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and req.method=="GET":
            answer({"id":PROJECT,"name":"CW-010 QA","revision":db["revision"],
                    "graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and req.method=="PUT":
            body=json.loads(req.post_data or "{}")
            assert body["expectedRevision"]==db["revision"]
            assert not body["graph"].get("replacements"),"ordinary PUT cannot start replacement"
            db["graph"]=copy.deepcopy(body["graph"])
            db["revision"]+=1
            db["graph"]["revision"]=db["revision"]
            db["generic"]+=1
            answer({"id":PROJECT,"revision":db["revision"]})
        elif path=="/api/projects/"+PROJECT+"/workflow/preview" and req.method=="POST":
            body=json.loads(req.post_data or "{}")
            assert body["expectedRevision"]==db["revision"],body
            command=body["command"]
            assert command["kind"]=="start_replacement",command
            assert command["sourceNodeIds"]==["b"],command
            assert "expectedPreview" not in command
            db["previews"]+=1
            original=next(n for n in db["graph"]["nodes"] if n["id"]=="b")
            suspended=[e for e in db["graph"]["edges"] if "b" in (e["from"],e["to"])]
            plan={"sourceNodeIds":["b"],"suspendedEdgeIds":[e["id"] for e in suspended],
                  "autoRewiredEdgeIds":[],"originalNodes":[copy.deepcopy(original)],
                  "suspendedEdges":copy.deepcopy(suspended),"affectedDraftEdgeIds":[]}
            answer({"projectId":PROJECT,"expectedRevision":db["revision"],
                    "kind":"start_replacement","preview":plan})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply" and req.method=="POST":
            body=json.loads(req.post_data or "{}")
            cmd=body["command"]
            assert body["expectedRevision"]==db["revision"],body
            assert cmd["kind"]=="start_replacement" and cmd["sourceNodeIds"]==["b"]
            assert cmd["replacementId"] and body["operationId"]
            assert body["operationId"] not in db["operations"],"duplicate write"
            current=next(n for n in db["graph"]["nodes"] if n["id"]=="b")
            pending=[e for e in db["graph"]["edges"] if "b" in (e["from"],e["to"])]
            review=cmd["expectedPreview"]
            assert review["originalNodes"]==[current]
            assert review["suspendedEdges"]==pending
            assert review["suspendedEdgeIds"]==[e["id"] for e in pending]
            before=copy.deepcopy(db["graph"]["nodes"]),copy.deepcopy(db["graph"]["edges"])
            db["graph"]["replacements"].append({
                "id":cmd["replacementId"],"state":"open",
                "sourceNodeIds":["b"],
                "suspendedEdgeIds":review["suspendedEdgeIds"],
                "sourceGraphRevision":db["revision"]
            })
            assert (db["graph"]["nodes"],db["graph"]["edges"])==before
            db["revision"]+=1
            db["graph"]["revision"]=db["revision"]
            db["operations"].add(body["operationId"])
            db["applies"]+=1
            answer({"projectId":PROJECT,"kind":"start_replacement",
                    "operationId":body["operationId"],"revision":db["revision"],
                    "replayed":False})
        else:
            answer({"error":"NOT_FOUND"},404)

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1450,"height":950})
        context.route(ORIGIN+"/**",serve)
        page=context.new_page()
        page.on("pageerror",lambda exc:errors.append(str(exc)))
        page.goto(ORIGIN+"/")
        page.wait_for_function(
            "()=>window.__graphite&&__graphite.getRemote().connected"
            " &&document.querySelector('[data-node=b]')")
        assert page.locator('[data-edge="ab"]').count()==1
        assert page.locator('[data-edge="bc"]').count()==1
        page.locator('[data-node="b"]').click()
        page.locator("#i-start-replacement").click()
        review=page.locator("#cw-start-replacement-dialog")
        review.wait_for()
        assert "До поворота → Поворот" in review.inner_text()
        assert "Поворот → Последствие" in review.inner_text()
        assert "Следом" in review.inner_text()
        assert "Причина" in review.inner_text()
        assert db["generic"]==db["applies"]==0
        assert db["graph"]==initial
        # Esc cancels the reviewed operation. No server apply or interrupted plot.
        page.keyboard.press("Escape")
        assert review.count()==0
        assert db["previews"]==1 and db["applies"]==0
        assert page.locator('[data-edge="bc"]').count()==1

        # The older "Переработать событие" remains purely editorial.
        page.locator("#i-rewrite").click()
        page.wait_for_function(
            "()=>__graphite.getRemote().connected && !__graphite.getRemote().dirty"
            " && !__graphite.getRemote().busy && __graphite.getEventRewrites().length===1")
        assert db["generic"]==1 and not db["graph"]["replacements"]
        assert page.locator('[data-edge="bc"]').count()==1
        page.locator("#ux014-start-replacement").click()
        review.wait_for()
        assert "Исходное событие" in review.inner_text()
        assert db["applies"]==0

        page.locator("#cw-start-replacement-confirm").click()
        page.wait_for_function(
            "()=>__graphite.getState().replacements?.[0]?.state==='open'"
            " && !__graphite.getRemote().busy && !__graphite.getRemote().dirty")
        assert db["applies"]==1
        assert db["graph"]["nodes"]==plot()["nodes"]
        assert db["graph"]["edges"]==plot()["edges"]
        assert not any(e["from"]=="a" and e["to"]=="c" for e in db["graph"]["edges"])
        assert page.locator('[data-node="b"]').count()==0
        assert page.locator('[data-cw-original="b"]').count()==1
        original=page.locator('[data-cw-original="b"]')
        assert "На замене" in original.inner_text()
        assert "Исходное событие без сокращений" in original.inner_text()
        assert page.locator('[data-edge="ab"]').count()==0
        assert page.locator('[data-edge="bc"]').count()==0
        assert page.locator('[data-node="a"]').count()==1
        assert page.locator('[data-node="c"]').count()==1
        assert "Приостановлено связей: 2" in page.locator("#inspector").inner_text()
        assert page.locator("#field-title").count()==0
        assert page.locator("#i-delete").count()==0

        # The old item is noncanonical, read-only and physically on its old pin.
        assert original.evaluate("el=>Math.round(parseFloat(el.style.left))")==480
        assert original.evaluate("el=>Math.round(parseFloat(el.style.top))")==150
        original.click()
        assert "На замене" in page.locator("#inspector").inner_text()
        before=copy.deepcopy(db["graph"])
        page.evaluate("()=>__graphite.setZoomForTest(0.38)")
        semantic=page.locator(".pa-semantic-item.cw-original-overview")
        semantic.wait_for()
        coords=semantic.bounding_box()
        if coords:
            x,y=coords["x"]+coords["width"]/2,coords["y"]+coords["height"]/2
            page.mouse.move(x,y);page.mouse.down()
            page.mouse.move(x+30,y+20,steps=5);page.mouse.up()
        assert db["graph"]==before,"semantic zoom moved original"
        semantic.click()
        assert "На замене" in page.locator("#inspector").inner_text()
        page.reload()
        page.wait_for_function(
            "()=>window.__graphite &&__graphite.getRemote().connected"
            " &&document.querySelector('[data-cw-original=b]')")
        assert page.locator('[data-cw-original="b"]').count()==1
        assert page.locator('[data-edge="bc"]').count()==0
        assert db["applies"]==1

        # Stage C will implement the review/history UI. A completed original is
        # already excluded from the active canvas, but still stored unchanged.
        db["graph"]["replacements"][0]["state"]="completed"
        db["revision"]+=1
        db["graph"]["revision"]=db["revision"]
        page.reload()
        page.wait_for_function(
            "()=>window.__graphite &&__graphite.getRemote().connected"
            " &&__graphite.getState().replacements?.[0]?.state==='completed'")
        assert page.locator('[data-cw-original="b"]').count()==0
        assert page.locator('[data-node="b"]').count()==0
        assert any(n["id"]=="b" for n in db["graph"]["nodes"])
        assert db["graph"]["edges"]==plot()["edges"]
        assert db["applies"]==1 and not errors,errors
        context.close()
        browser.close()
    print(json.dumps({"result":"PASS","preview":db["previews"],"applies":db["applies"],
      "checks":["separate editorial vs replacement","Esc cancellation",
                "reviewed start and readback","immutable dim original",
                "no old edges or invented A->C","zoom pan and F5",
                "completed original hidden, preserved in data"]},ensure_ascii=False))

if __name__=="__main__":
    main()
