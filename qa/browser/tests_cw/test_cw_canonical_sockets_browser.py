"""CW-004: independent canonical edge sockets in actual Chromium, synthetic only."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")

def synthetic():
    nodes=[
      {"id":"n1","title":"Источник 1","description":"Короткое событие","x":80,"y":100,"lineIds":["l1"],"parent":None},
      {"id":"n2","title":"Источник 2","description":"Второе событие","x":85,"y":330,"lineIds":["l1"],"parent":None},
      {"id":"n3","title":"Источник 3","description":"Третье событие","x":90,"y":550,"lineIds":["l1"],"parent":None},
      {"id":"n4","title":"Получатель","description":"Очень длинное описание " * 14,
       "x":660,"y":240,"width":300,"lineIds":["l1"],"parent":None},
    ]
    return {"version":.8,"revision":0,"nextNode":5,"nextEdge":5,
      "nextLine":2,"nextField":1,"view":None,"nodes":nodes,
      "edges":[
        {"id":"e1","from":"n1","to":"n4","type":"precedes"},
        {"id":"e2","from":"n2","to":"n4","type":"enables"},
        {"id":"e3","from":"n3","to":"n4","type":"causes"},
        {"id":"e4","from":"n4","to":"n1","type":"precedes"}
      ],"fields":[],"lanes":[{"id":"l1","title":"Главная","color":"#b8a16e","y":100}]}

def socket_snapshot(page):
    return page.evaluate("""() => {
      const ports=[...document.querySelectorAll('[data-edge-socket]')].map(el=>({
       key:el.dataset.edgeSocket,node:el.dataset.socketNode,
       role:el.dataset.socketRole,x:+el.getAttribute('cx'),y:+el.getAttribute('cy'),
       pointer:getComputedStyle(el).pointerEvents,
       visible:getComputedStyle(el).display!=='none'
      }));
      const d=Object.fromEntries([...document.querySelectorAll('[data-edge]')].map(el=>[
       el.dataset.edge,el.querySelector('path.edge').getAttribute('d')
      ]));
      return {ports,d,mode:__graphite.getSemanticZoom()};
    }""")

def main():
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.on("pageerror",lambda exc:errors.append(str(exc)))
        page.set_content(HTML,wait_until="load")
        fixture=synthetic()
        page.evaluate("(g)=>__graphite.loadFixture(g)",fixture)
        page.evaluate("()=>__graphite.setZoomForTest(1)")
        # Variant C: there is no competing large + button on the node boundary.
        assert page.locator(".node-add").count()==0
        page.locator('[data-node="n1"]').click(position={"x":50,"y":56})
        add_action=page.locator('[data-node="n1"] [data-command="after"]')
        assert add_action.count()==1
        assert add_action.get_attribute("aria-label")=="Продолжить сюжет"
        assert page.locator('[data-node="n1"] [data-link-source="n1"]').count()==1
        add_action.click()
        assert page.locator("#dialog h2").inner_text()=="Продолжить сюжет"
        page.locator("#cancel").click()
        assert page.evaluate("()=>__graphite.getState().edges.length")==4
        result=socket_snapshot(page)
        assert result["mode"]=="full",result["mode"]
        # Actual rendered circles must be centered on the measured card edge.
        alignment=page.evaluate("""() => [...document.querySelectorAll('[data-edge-socket]')].map(el=>{
          const card=document.querySelector('[data-node="'+el.dataset.socketNode+'"]');
          const r=el.getBoundingClientRect(),b=card.getBoundingClientRect();
          const center=r.left+r.width/2;
          return Math.abs(center-(el.dataset.socketRole==='source'?b.right:b.left));
        })""")
        assert all(delta<1.5 for delta in alignment),alignment

        # Canonical selection gets a viewport-space relation toolbar.
        page.locator('[data-edge-target="e1"]').click(force=True)
        toolbar=page.locator('[data-cw-edge-toolbar="canon:e1"]')
        assert toolbar.count()==1
        assert toolbar.locator('select').input_value()=="precedes"
        assert toolbar.get_by_text("Сохранить").is_disabled()
        toolbar.get_by_text("Отмена").click()
        assert page.locator('[data-cw-edge-toolbar]').count()==0
        page.evaluate("()=>__graphite.setZoomForTest(1)")
        visual=page.evaluate("""() => [...document.querySelectorAll('[data-edge-socket]')].map(
          el=>el.getBoundingClientRect().width)""")
        assert all(abs(d-10)<1.5 for d in visual),visual
        page.evaluate("()=>__graphite.setZoomForTest(.75)")
        scaled=page.evaluate("""() => [...document.querySelectorAll('[data-edge-socket]')].map(
          el=>el.getBoundingClientRect().width)""")
        assert all(abs(d-10)<1.5 for d in scaled),scaled
        page.evaluate("()=>__graphite.setZoomForTest(1)")
        assert len(result["ports"])==8,result
        ports={v["key"]:v for v in result["ports"]}
        for e in fixture["edges"]:
            source=ports[e["id"]+":source"]
            target=ports[e["id"]+":target"]
            assert source["node"]==e["from"] and source["role"]=="source"
            assert target["node"]==e["to"] and target["role"]=="target"
            assert source["pointer"]=="none" and target["pointer"]=="none"
            path=result["d"][e["id"]]
            assert path.startswith(f'M{source["x"]},{source["y"]} '),path
            assert path.endswith(f'{target["x"]},{target["y"]}'),path
        assert len({ports[f'e{i}:target']["y"] for i in (1,2,3)})==3
        initial={v["key"]:(v["x"],v["y"]) for v in result["ports"]}
        page.evaluate("()=>__graphite.setZoomForTest(.27)")
        zoomed=socket_snapshot(page)
        assert zoomed["mode"] in ("compact","map"),zoomed
        assert not zoomed["ports"],zoomed
        page.evaluate("()=>__graphite.setZoomForTest(1)")
        again=socket_snapshot(page)
        assert {v["key"]:(v["x"],v["y"]) for v in again["ports"]}==initial
        changed=synthetic()
        next(n for n in changed["nodes"] if n["id"]=="n4")["y"]+=160
        page.evaluate("(g)=>__graphite.loadFixture(g)",changed)
        moved=socket_snapshot(page)
        assert {v["key"] for v in moved["ports"]}==set(initial)
        assert {v["key"]:(v["x"],v["y"]) for v in moved["ports"]}!=initial
        assert page.evaluate("()=>__graphite.getState().edges.length")==4
        assert not errors,errors
        browser.close()
    print(json.dumps({"result":"PASS","ports":8,
      "checks":["individual anchors","separate incoming","zoom hides sockets",
       "identity after resize and reload","no pointer interception"]}))

if __name__=="__main__":
    main()
