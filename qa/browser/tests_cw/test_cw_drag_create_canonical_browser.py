"""CW-003: drag-to-connect, cancel and one guarded canonical save in Chromium.

Only a synthetic REST handler and fresh graph are used. No user data, D1,
OpenAI Site or plugin.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
PROJECT="cw003-canonical-synthetic"

def graph():
    return {
      "version":.8,"revision":1,"view":None,
      "nextNode":4,"nextEdge":1,"nextLine":2,"nextField":1,
      "nodes":[
       {"id":"n1","title":"Источник","description":"Завязка","x":95,"y":180,
        "lineIds":["l1"],"size":"normal","parent":None},
       {"id":"n2","title":"Соседнее событие","description":"Независимая сцена",
        "x":100,"y":470,"lineIds":["l1"],"size":"normal","parent":None},
       {"id":"n3","title":"Последствие","description":"Цель нового соединения",
        "x":790,"y":270,"lineIds":["l1"],"size":"normal","parent":None}
      ],
      "edges":[],"fields":[],"lanes":[{"id":"l1","title":"Линия","color":"#b8a16e","y":100}],
      "gapNotes":[],"gapLinks":[],"workspaces":[],"replacements":[]
    }

def drag(page,source,target_x,target_y,finish=True):
    handle=page.locator('[data-link-source="'+source+'"]')
    # Reveal the contextual handle by entering the real card first.
    card=page.locator('[data-node="'+source+'"]')
    card.hover(position={"x":40,"y":35})
    box=handle.bounding_box()
    assert box is not None,source
    start=(box["x"]+box["width"]/2,box["y"]+box["height"]/2)
    page.mouse.move(*start)
    page.mouse.down()
    page.mouse.move(target_x,target_y,steps=12)
    if finish:page.mouse.up()

def midpoint(page,node_id):
    rect=page.locator('[data-node="'+node_id+'"]').bounding_box()
    assert rect is not None,node_id
    return rect["x"]+rect["width"]*.48,rect["y"]+min(38,rect["height"]*.45)

def main():
    db={"graph":graph(),"revision":1,"put":0,"force_conflict":False}
    errors=[]
    def route(response):
        req=response.request
        path=urlsplit(req.url).path
        method=req.method
        def reply(data,status=200):
            response.fulfill(status=status,content_type="application/json",
                             body=json.dumps(data,ensure_ascii=False))
        if path=="/":
            response.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
        elif path=="/api/health":
            reply({"ok":True,"authenticated":True,"authMode":"sites-native"})
        elif path=="/api/projects" and method=="GET":
            reply({"projects":[{"id":PROJECT,"name":"Socket QA","revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and method=="GET":
            reply({"id":PROJECT,"name":"Socket QA","revision":db["revision"],
                   "graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and method=="PUT":
            data=json.loads(req.post_data or "{}")
            if db["force_conflict"] or data["expectedRevision"]!=db["revision"]:
                db["force_conflict"]=False
                db["revision"]+=1
                db["graph"]["revision"]=db["revision"]
                reply({"error":"REVISION_CONFLICT","message":"Other editor changed the project"},409)
                return
            updated=data["graph"]
            assert len(updated["edges"])==len(db["graph"]["edges"])+1
            db["revision"]+=1;updated["revision"]=db["revision"]
            db["graph"]=copy.deepcopy(updated)
            db["put"]+=1
            reply({"revision":db["revision"]})
        else:
            reply({"error":"NOT_FOUND"},404)

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1440,"height":940})
        context.route("https://plot.local/**",route)
        page=context.new_page()
        page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto("https://plot.local/")
        page.wait_for_function(
            "() => window.__graphite&&__graphite.getRemote().connected"
            "&&__graphite.getRemote().revision===1"
            "&&document.querySelectorAll('[data-node]').length===3"
        )
        page.evaluate("()=>__graphite.setZoomForTest(1)")
        assert db["put"]==0
        end=midpoint(page,"n3")
        drag(page,"n1",*end,finish=False)
        page.locator("#cw-link-overlay:not([hidden])").wait_for()
        assert db["put"]==0
        assert page.evaluate("()=>__graphite.getState().edges.length")==0
        assert page.locator(".cw-link-candidate:visible").count()==1
        page.mouse.up()
        page.wait_for_function(
            "() => __graphite.getRemote().revision===2"
            "&&__graphite.getState().edges.length===1"
        )
        assert db["put"]==1 and db["revision"]==2
        assert db["graph"]["edges"]==[{"id":"e1","from":"n1","to":"n3","type":"precedes"}]
        assert page.locator('[data-edge-socket="e1:source"]').count()==1
        assert page.locator('[data-edge-socket="e1:target"]').count()==1

        # A duplicate, empty drop, and Esc must not write or change the graph.
        page.locator("#close-inspect").click()
        drag(page,"n1",*midpoint(page,"n3"))
        assert db["put"]==1
        drag(page,"n2",530,660,finish=False)
        page.keyboard.press("Escape")
        page.mouse.up()
        assert db["put"]==1
        assert page.locator("#cw-link-overlay:not([hidden])").count()==0
        drag(page,"n2",530,660)
        assert db["put"]==1
        assert page.evaluate("()=>__graphite.getState().edges.length")==1

        # A revision conflict must not introduce an optimistic edge in the
        # browser; the remote project's revision is now ahead.
        db["force_conflict"]=True
        drag(page,"n3",*midpoint(page,"n2"))
        page.wait_for_function("() => __graphite.getRemote().blocked")
        assert db["put"]==1
        assert page.evaluate("()=>__graphite.getState().edges.length")==1
        assert not errors,errors
        context.close()
        browser.close()
    print(json.dumps({"result":"PASS","writes":1,
      "cases":["drag preview without write","drop one server CAS",
               "unique sockets","duplicate","empty drop","Escape","stale revision"]}))

if __name__=="__main__":
    main()
