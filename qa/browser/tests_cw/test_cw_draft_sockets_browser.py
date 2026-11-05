"""CW-004: real Chrome rendering for independent draft sockets, synthetic graph only."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
from test_cw_persisted_workspace_accept_browser import story

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")

def snap(page):
    return page.evaluate("""() => ({
      ports:[...document.querySelectorAll('[data-cw-socket]')].map(p=>({
        key:p.dataset.cwSocket,node:p.dataset.cwSocketNode,role:p.dataset.cwSocketRole,
        x:+p.getAttribute('cx'),y:+p.getAttribute('cy'),
        hit:getComputedStyle(p).pointerEvents
      })),
      paths:[...document.querySelectorAll('[data-cw-edge]')].map(p=>({
        id:p.dataset.cwEdge,d:p.getAttribute('d'),className:p.getAttribute('class'),
        marker:p.getAttribute('marker-end')
      })),
      directions:[...document.querySelectorAll('[data-cw-edge-direction]')].map(arrow=>{
        const path=[...document.querySelectorAll('[data-cw-edge]')]
          .find(p=>p.dataset.cwEdge===arrow.dataset.cwEdgeDirection);
        const mid=path?.getPointAtLength(path.getTotalLength()/2);
        const transform=arrow.transform.baseVal.consolidate()?.matrix;
        return {id:arrow.dataset.cwEdgeDirection,
          centered:!!mid&&!!transform&&Math.hypot(transform.e-mid.x,transform.f-mid.y)<.01,
          pointer:getComputedStyle(arrow).pointerEvents,
          length:path?.getTotalLength()};
      }),
      hitPaths:[...document.querySelectorAll('[data-cw-edge-hit]')]
        .map(p=>({id:p.dataset.cwEdgeHit,d:p.getAttribute('d')})),
      cards:[...document.querySelectorAll('[data-cw-node]')].map(p=>({
        id:p.dataset.cwNode,height:p.offsetHeight
      }))
    })""")

def main():
    errors=[]
    g=story()
    # loadFixture bypasses the server's normalizer; provide the same
    # required canonical-node shape that a real project read returns.
    for node in g["nodes"]:
        node.setdefault("lineIds",[])
    g["edges"].extend([
      {"id":"eb","from":"c","to":"b","type":"causes",
       "workspaceId":"w1","draftRelation":"internal","draftBranchId":"beta"},
      {"id":"ec","from":"a","to":"b","type":"enables",
       "workspaceId":"w1","draftRelation":"internal","draftBranchId":"alpha"},
    ])
    next(n for n in g["nodes"] if n["id"]=="b")["description"]=(
       "Большая карточка с длинным описанием, которое переносится по строкам. " * 6
    )
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.on("pageerror",lambda exc:errors.append(str(exc)))
        page.set_content(HTML,wait_until="load")
        page.evaluate("(graph)=>__graphite.loadFixture(graph)",g)
        page.evaluate("()=>__graphite.setZoomForTest(1)")
        visual=page.evaluate("""() => [...document.querySelectorAll('[data-cw-socket]')].map(
          el=>el.getBoundingClientRect().width)""")
        assert all(abs(d-10)<1.5 for d in visual),visual
        result=snap(page)
        # Validate the screen-space midpoint, not just world-space coordinates.
        alignment=page.evaluate("""() => [...document.querySelectorAll('[data-cw-socket]')].map(el=>{
          const card=document.querySelector('[data-cw-node="'+el.dataset.cwSocketNode+'"]');
          const r=el.getBoundingClientRect(),b=card.getBoundingClientRect();
          return Math.abs(r.left+r.width/2-
            (el.dataset.cwSocketRole==='source'?b.right:b.left));
        })""")
        assert all(delta<1.5 for delta in alignment),alignment
        assert len(result["paths"])==3,result
        assert len(result["ports"])==6,result
        assert len(result["directions"])==len(result["paths"])==3,result
        assert all(a["centered"] and a["pointer"]=="none" and a["length"]>0
                   for a in result["directions"]),result["directions"]
        ports={v["key"]:v for v in result["ports"]}
        box=next(c for c in result["cards"] if c["id"]=="b")
        assert box["height"]>105,box
        for e in ("ea","eb","ec"):
            begin=ports[e+":source"];end=ports[e+":target"]
            path=next(p for p in result["paths"] if p["id"]==e)
            assert path["d"].startswith(f'M {begin["x"]} {begin["y"]} '),path
            assert path["d"].endswith(f'{end["x"]} {end["y"]}'),path
            assert path["marker"] is None, "full path must not terminate in an SVG arrow"
            arrow=next(a for a in result["directions"] if a["id"]==e)
            assert arrow["centered"],arrow
            # The hit-path only exists while draft editing is enabled.
            hit=next((h for h in result["hitPaths"] if h["id"]==e),None)
            if hit is not None:
                assert hit["d"]==path["d"],"an editable hit path must cover the full connection"
            assert begin["hit"]=="none" and end["hit"]=="none"
        assert len({ports[e+":target"]["y"] for e in ("ea","eb","ec")})==3
        assert "causes" in next(p for p in result["paths"] if p["id"]=="eb")["className"]
        assert "enables" in next(p for p in result["paths"] if p["id"]=="ec")["className"]
        initial={(v["key"],v["x"],v["y"]) for v in result["ports"]}
        page.evaluate("()=>__graphite.setZoomForTest(.55)")
        # Compact overview simplifies draft socket chrome but never changes edges.
        assert not snap(page)["ports"]
        assert page.locator('.cw-draft-edge-select').count()==0
        page.evaluate("()=>__graphite.setZoomForTest(1)")
        assert {(v["key"],v["x"],v["y"]) for v in snap(page)["ports"]}==initial
        assert page.evaluate("()=>__graphite.getState().edges.length")==6
        assert not errors,errors
        browser.close()
    print(json.dumps({"result":"PASS","ports":6,
      "checks":["measured tall card","three independent inbound sockets",
        "full socket-to-socket drafts with real path midpoint arrows","zoom invariance","no changes to graph"]}))

if __name__=="__main__":
    main()
