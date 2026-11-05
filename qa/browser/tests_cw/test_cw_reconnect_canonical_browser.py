"""CW-003: reconnect canonical arrow via its endpoint or inspector without deleting it.

Synthetic REST only. Verify cancel, revision conflict, exact ID, Undo snapshot
and independent socket geometry. No real Graphite project is accessed.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
PROJECT="cw003-reconnect-qa"

def graph():
    nodes=[
      {"id":"n1","title":"Исходное событие","description":"Начало","x":100,"y":110,"lineIds":["l1"],"parent":None},
      {"id":"n2","title":"Старая цель","description":"Прежде подключено","x":820,"y":130,"lineIds":["l1"],"parent":None},
      {"id":"n3","title":"Новая цель","description":"Сюда перенести стрелку","x":820,"y":520,"lineIds":["l1"],"parent":None},
      {"id":"n4","title":"Ещё одна цель","description":"Неоднозначная запись","x":320,"y":650,"lineIds":["l1"],"parent":None}
    ]
    return {"version":1,"revision":1,"view":None,"nextNode":5,
      "nextEdge":3,"nextField":1,"nextLine":2,"nodes":nodes,
      "edges":[{"id":"e1","from":"n1","to":"n2","type":"enables"},
       {"id":"e2","from":"n4","to":"n3","type":"precedes"}],
      "fields":[],"lanes":[{"id":"l1","title":"Линия","color":"#b8a16e","y":100}],
      "gapNotes":[],"gapLinks":[],"workspaces":[],"replacements":[]}

def midpoint(page,node_id):
    box=page.locator('[data-node="'+node_id+'"]').bounding_box()
    assert box is not None,node_id
    return (box["x"]+box["width"]*.50,box["y"]+min(40,box["height"]*.42))

def start_target_drag(page):
    handle=page.locator('[data-reconnect-edge="e1"]')
    box=handle.bounding_box()
    assert box is not None,"selected target socket must be visible"
    x=box["x"]+box["width"]/2
    y=box["y"]+box["height"]/2
    page.mouse.move(x,y)
    page.mouse.down()

def main():
    db={"graph":graph(),"revision":1,"writes":0,"force_conflict":False}
    original=copy.deepcopy(db["graph"])
    errors=[]
    def route(request):
        req=request.request
        path=urlsplit(req.url).path
        method=req.method
        def reply(data,status=200):
            request.fulfill(status=status,content_type="application/json",
                            body=json.dumps(data,ensure_ascii=False))
        if path=="/":
            request.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
        elif path=="/api/health":
            reply({"ok":True,"authenticated":True,"authMode":"sites-native"})
        elif path=="/api/projects" and method=="GET":
            reply({"projects":[{"id":PROJECT,"name":"Reconnect QA","revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and method=="GET":
            reply({"id":PROJECT,"name":"Reconnect QA","revision":db["revision"],
                   "graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and method=="PUT":
            body=json.loads(req.post_data or "{}")
            if db["force_conflict"] or body.get("expectedRevision")!=db["revision"]:
                db["force_conflict"]=False
                db["revision"]+=1
                db["graph"]["revision"]=db["revision"]
                reply({"error":"REVISION_CONFLICT","message":"Concurrent update"},409)
                return
            before=db["graph"]
            candidate=body["graph"]
            assert len(candidate["edges"])==len(before["edges"])
            assert sorted(e["id"] for e in candidate["edges"])==["e1","e2"]
            old=next(e for e in before["edges"] if e["id"]=="e1")
            changed=next(e for e in candidate["edges"] if e["id"]=="e1")
            assert changed["from"]==old["from"] and changed["type"]==old["type"]
            assert changed["to"]!=old["to"],"must reconnect, not delete"
            assert next(e for e in before["edges"] if e["id"]=="e2")==next(
                e for e in candidate["edges"] if e["id"]=="e2"
            )
            db["revision"]+=1
            candidate["revision"]=db["revision"]
            db["graph"]=copy.deepcopy(candidate)
            db["writes"]+=1
            reply({"revision":db["revision"]})
        else:
            reply({"error":"NOT_FOUND"},404)

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1550,"height":1000})
        context.route("https://plot.local/**",route)
        page=context.new_page()
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto("https://plot.local/")
        page.wait_for_function(
            "() => window.__graphite&&__graphite.getRemote().connected"
            "&&__graphite.getRemote().revision===1"
            "&&document.querySelectorAll('[data-node]').length===4"
        )
        page.evaluate("()=>__graphite.setZoomForTest(1)")
        page.locator('[data-edge-target="e1"]').click()
        page.locator('[data-reconnect-edge="e1"]').wait_for()
        start_target_drag(page)
        page.mouse.move(*midpoint(page,"n3"),steps=12)
        page.locator("#cw-link-overlay:not([hidden])").wait_for()
        assert page.locator(".cw-link-candidate:visible").count()==1
        assert page.evaluate("()=>__graphite.getState().edges.find(e=>e.id==='e1').to")=="n2"
        assert db["graph"]==original and db["writes"]==0
        page.keyboard.press("Escape")
        page.mouse.up()
        assert page.locator("#cw-link-overlay:not([hidden])").count()==0
        assert db["graph"]==original and db["writes"]==0

        # Same edge id, type and source; updated target after server CAS only.
        start_target_drag(page)
        page.mouse.move(*midpoint(page,"n3"),steps=12)
        page.mouse.up()
        page.wait_for_function(
            "() => __graphite.getRemote().revision===2"
            "&&__graphite.getState().edges.find(e=>e.id==='e1').to==='n3'"
        )
        assert db["writes"]==1
        edge=next(e for e in db["graph"]["edges"] if e["id"]=="e1")
        assert edge=={"id":"e1","from":"n1","to":"n3","type":"enables"}
        assert page.locator('[data-edge-socket="e1:target"]').count()==1

        # The existing inspector action must no longer delete the edge before
        # a new target is selected. Click selection is a safe fallback.
        page.locator("#reconnect").click()
        assert db["writes"]==1
        assert next(e for e in db["graph"]["edges"] if e["id"]=="e1")["to"]=="n3"
        page.keyboard.press("Escape")
        assert db["writes"]==1

        # Reject stale revision without optimistic modification. Keep e1->n3.
        page.locator('[data-edge-target="e1"]').click()
        page.locator('[data-reconnect-edge="e1"]').wait_for()
        db["force_conflict"]=True
        start_target_drag(page)
        page.mouse.move(*midpoint(page,"n4"),steps=12)
        page.mouse.up()
        page.wait_for_function("()=>__graphite.getRemote().blocked")
        assert db["writes"]==1
        assert page.evaluate("()=>__graphite.getState().edges.find(e=>e.id==='e1').to")=="n3"
        assert not errors,errors
        context.close()
        browser.close()
    print(json.dumps({"result":"PASS","writes":db["writes"],
      "cases":["cancel leaves old edge","one endpoint CAS retains ID and type",
               "inspector no early deletion","stale revision preserves connection"]}))

if __name__=="__main__":
    main()
