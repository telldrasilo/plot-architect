"""CW-003: changing an existing arrow endpoint by drag is atomic and reversible.

Uses only synthetic REST and current real Graphite HTML; never user history.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from test_cw_drag_create_canonical_browser import graph, midpoint

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
PROJECT="cw003-rewire-synthetic"

def main():
    first=graph()
    first["edges"]=[{"id":"e1","from":"n1","to":"n3","type":"enables"}]
    first["nextEdge"]=2
    db={"graph":first,"revision":1,"put":0,"force_conflict":False}
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
            reply({"projects":[{"id":PROJECT,"name":"Rewire QA","revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and method=="GET":
            reply({"id":PROJECT,"name":"Rewire QA","revision":db["revision"],
                   "graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and method=="PUT":
            data=json.loads(req.post_data or "{}")
            if db["force_conflict"] or data["expectedRevision"]!=db["revision"]:
                db["force_conflict"]=False
                db["revision"]+=1;db["graph"]["revision"]=db["revision"]
                reply({"error":"REVISION_CONFLICT","message":"Concurrent update"},409)
                return
            updated=data["graph"]
            assert len(updated["edges"]) in (0,1),updated["edges"]
            if updated["edges"]:
                edge=updated["edges"][0]
                assert edge["id"]=="e1" and edge["from"]=="n1" and edge["type"]=="enables"
            else:
                assert any(e["id"]=="e1" for e in db["graph"]["edges"]), (
                    "Only an existing canonical edge may be disconnected")
            db["revision"]+=1;updated["revision"]=db["revision"]
            db["graph"]=copy.deepcopy(updated);db["put"]+=1
            reply({"revision":db["revision"]})
        else:reply({"error":"NOT_FOUND"},404)

    def select_edge(page):
        # Route through the actual SVG click listener, without depending on the
        # synthetic chart's empty SVG path bounding box.
        page.evaluate("""() => {
          const hit=document.querySelector('[data-edge-target="e1"]');
          if(!hit)throw Error('Missing canonical arrow');
          hit.dispatchEvent(new MouseEvent('click',{bubbles:true}));
        }""")
        page.locator('[data-canon-edge-port="e1"]').wait_for()

    def drag_endpoint(page,to=None,finish=True):
        handle=page.locator('[data-canon-edge-port="e1"]')
        rect=handle.bounding_box()
        assert rect is not None
        x=rect["x"]+rect["width"]/2
        y=rect["y"]+rect["height"]/2
        if to:
            tx,ty=midpoint(page,to)
        else:
            tx,ty=510,850
        page.mouse.move(x,y)
        page.mouse.down()
        page.mouse.move(tx,ty,steps=12)
        if finish:page.mouse.up()

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
        # Every target socket is ready before any edge selection.
        socket=page.locator('[data-canon-edge-port="e1"]')
        socket.wait_for()
        assert page.locator("#cw-rewire-handle").count()==0
        assert page.locator("[data-canon-edge-port]").count()==1
        styles=page.evaluate("""() => {
          const el=document.querySelector('[data-canon-edge-port="e1"]');
          return {rest:getComputedStyle(el,'::after').opacity,
           radius:getComputedStyle(el,'::after').borderRadius,
           outline:getComputedStyle(el).outlineStyle};
        }""")
        assert styles["rest"]=="0" and styles["radius"]=="50%",styles
        socket.hover()
        assert page.evaluate("""() => getComputedStyle(
          document.querySelector('[data-canon-edge-port="e1"]'),'::after'
        ).opacity""")=="1"
        assert page.locator('[data-edge-socket="e1:target"].edge-socket-hover').count()==1
        assert db["put"]==0
        drag_endpoint(page,"n2",finish=False)
        page.locator("#cw-link-overlay:not([hidden])").wait_for()
        assert db["put"]==0
        assert page.evaluate("()=>__graphite.getState().edges[0].to")=="n3"
        page.keyboard.press("Escape")
        page.mouse.up()
        assert db["put"]==0
        assert page.locator("#cw-link-overlay:not([hidden])").count()==0
        assert page.evaluate("()=>__graphite.getState().edges[0].to")=="n3"

        # An off-node drop only offers deletion; Cancel preserves the original.
        drag_endpoint(page,None)
        assert page.locator('[data-cw-disconnect-prompt="e1"]').count()==1
        assert db["put"]==0 and db["graph"]["edges"][0]["to"]=="n3"
        page.locator('[data-cw-disconnect-prompt="e1"]').get_by_role(
            "button",name="Отмена").click()
        assert page.locator('[data-cw-disconnect-prompt]').count()==0
        assert db["put"]==0
        # The inspector is an optional keyboard-accessible fallback.
        select_edge(page)
        page.get_by_role("button",name="Переподключить").click()
        assert db["put"]==0
        assert page.evaluate("()=>__graphite.getState().edges[0].to")=="n3"

        drag_endpoint(page,"n2",finish=False)
        assert db["graph"]["edges"][0]["to"]=="n3"
        page.mouse.up()
        page.wait_for_function(
            "() => __graphite.getRemote().revision===2"
            "&&__graphite.getState().edges[0].to==='n2'"
        )
        assert db["put"]==1
        assert db["graph"]["edges"]==[
            {"id":"e1","from":"n1","to":"n2","type":"enables"}
        ]
        assert page.locator('[data-edge-socket="e1:target"]').count()==1
        # The same direct target remains ready after the successful readback.
        same_socket=page.locator('[data-canon-edge-port="e1"]')
        assert same_socket.count()==1
        same_socket.click()
        assert page.locator('[data-cw-edge-toolbar="canon:e1"]').count()==1
        assert db["put"]==1

        page.reload()
        page.wait_for_function(
            "() => __graphite.getRemote().connected"
            "&&__graphite.getRemote().revision===2"
        )
        assert page.evaluate("()=>__graphite.getState().edges[0].to")=="n2"
        page.evaluate("()=>__graphite.setZoomForTest(1)")
        select_edge(page)

        db["force_conflict"]=True
        # The edge inspector can overlap the middle of the right-hand node.
        # Hit the uncovered left side of the target, not the inspector.
        n3=page.locator('[data-node="n3"]').bounding_box()
        assert n3 is not None
        target=(n3["x"]+24,n3["y"]+26)
        handle=page.locator('[data-canon-edge-port="e1"]').bounding_box()
        assert handle is not None
        page.mouse.move(handle["x"]+handle["width"]/2,
                        handle["y"]+handle["height"]/2)
        page.mouse.down()
        page.mouse.move(*target,steps=12)
        assert page.locator('#cw-link-overlay[data-valid="true"]:not([hidden])').count()==1, {
            "target":target,
            "hit":page.evaluate("""({x,y}) => document.elementFromPoint(x,y)
              ?.closest('[data-node]')?.dataset.node??null""",
              {"x":target[0],"y":target[1]})
        }
        page.mouse.up()
        page.wait_for_function("() => __graphite.getRemote().blocked",timeout=5000)
        assert db["put"]==1
        assert db["graph"]["edges"][0]["to"]=="n2"
        assert page.evaluate("()=>__graphite.getState().edges[0].to")=="n2"
        context.close()

        # Use a fresh browser profile after the intentional CAS conflict.
        # Confirmed empty-canvas deletion must be one guarded server mutation.
        revision_before_delete=db["revision"]
        fresh=browser.new_context(viewport={"width":1440,"height":940})
        fresh.route("https://plot.local/**",route)
        page=fresh.new_page()
        page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto("https://plot.local/")
        page.wait_for_function(
            "() => window.__graphite&&__graphite.getRemote().connected"
            "&&__graphite.getState().edges.some(e=>e.id==='e1'&&e.to==='n2')"
        )
        page.evaluate("()=>__graphite.setZoomForTest(1)")
        assert page.locator('[data-canon-edge-port="e1"]').count()==1
        drag_endpoint(page,None)
        confirmation=page.locator('[data-cw-disconnect-prompt="e1"]')
        assert confirmation.count()==1
        assert db["put"]==1 and len(db["graph"]["edges"])==1
        confirmation.get_by_role("button",name="Удалить связь").click()
        page.wait_for_function(
            f"() => __graphite.getState().edges.length===0 "
            f"&&__graphite.getRemote().revision==={revision_before_delete+1}"
        )
        assert db["put"]==2
        assert db["graph"]["edges"]==[] and len(db["graph"]["nodes"])==3
        assert page.locator('[data-canon-edge-port]').count()==0
        assert not errors,errors
        fresh.close();browser.close()
    print(json.dumps({"result":"PASS","writes":db["put"],
      "cases":["direct hover before selection","round highlight, no square",
       "nonpersistent reconnect preview","Esc","off-target confirmation and cancel",
       "inspector non-destructive","one revision and same edge ID",
       "reload","CAS collision leaves original","confirmed guarded disconnect"]}))

if __name__=="__main__":
    main()
