"""Dense CW-004 connection layout, visual rail and LOD in isolated Chromium.

All 20/100 relations must retain unique logical sockets. No Site, server, D1,
MCP, plugin or author projects are touched.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")

def synthetic(count):
    nodes=[{"id":"hub","title":"Общий результат","description":"Связанные события",
            "x":950,"y":170,"lineIds":["l1"],"parent":None}]
    nodes.extend({"id":"s"+str(i),"title":"Причина "+str(i),
                  "description":"Различимое событие",
                  "x":20,"y":i*76-900,"lineIds":["l1"],"parent":None}
                 for i in range(count))
    edges=[{"id":"e"+str(i),"from":"s"+str(i),"to":"hub","type":"precedes"}
           for i in range(count)]
    return {"version":.8,"revision":0,"nextNode":count+2,
            "nextEdge":count+1,"nextLine":2,"nextField":1,"view":None,
            "nodes":nodes,"edges":edges,"fields":[],
            "lanes":[{"id":"l1","title":"Главная","color":"#b8a16e","y":80}]}

def snap(page):
    return page.evaluate("""() => ({
      ports:[...document.querySelectorAll('[data-edge-socket]')].map(p=>({
        id:p.dataset.edgeSocket,role:p.dataset.socketRole,
        node:p.dataset.socketNode,x:+p.getAttribute('cx'),y:+p.getAttribute('cy')
      })),
      rail:[...document.querySelectorAll('[data-socket-rail]')].map(p=>({
        id:p.dataset.socketRail,d:p.getAttribute('d'),
        pointer:getComputedStyle(p).pointerEvents
      })),
      zoom:__graphite.getSemanticZoom(),
      edges:__graphite.getState().edges.length
    })""")

def main():
    errors=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.set_content(HTML,wait_until="load")
        for count in (20,100):
            graph=synthetic(count)
            page.evaluate("(g)=>__graphite.loadFixture(g)",graph)
            page.evaluate("()=>__graphite.setZoomForTest(1)")
            a=snap(page)
            assert a["zoom"]=="full",a
            assert a["edges"]==count
            assert len(a["ports"])==2*count,(count,len(a["ports"]))
            assert len({p["id"] for p in a["ports"]})==2*count
            targets=[p for p in a["ports"] if p["role"]=="target"]
            assert len(targets)==count and all(p["node"]=="hub" for p in targets)
            assert len({p["y"] for p in targets})==count
            assert len({p["x"] for p in targets})==1
            rails=[p for p in a["rail"] if p["id"]=="hub:target"]
            assert len(rails)==1,rails
            assert rails[0]["pointer"]=="none"
            assert "M 950 " in rails[0]["d"],rails[0]
            prior={(p["id"],p["x"],p["y"]) for p in a["ports"]}
            page.evaluate("()=>__graphite.setZoomForTest(.5)")
            compact=snap(page)
            assert compact["zoom"] in ("compact","map"),compact
            assert not compact["ports"] and not compact["rail"],compact
            assert compact["edges"]==count
            page.evaluate("()=>__graphite.setZoomForTest(1)")
            again=snap(page)
            assert {(p["id"],p["x"],p["y"]) for p in again["ports"]}==prior
        assert not errors,errors
        browser.close()
    print(json.dumps({"result":"PASS","counts":[20,100],
      "checks":["per-edge identity","explicit rail","noninteractive rail",
                "dense LOD hides chrome","zoom restore","no graph changes"]}))

if __name__=="__main__":
    main()
