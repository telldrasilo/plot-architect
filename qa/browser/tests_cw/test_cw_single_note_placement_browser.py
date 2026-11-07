"""CW-102: one draft card stays next to its source task at multiple viewport scales.

Actual bundled editor in Chromium with a synthetic read-only API. The compiler's
world-space collision search is asserted by Node tests; here we verify that its
single-card layout displays beside a note and does not move canonical neighbors
under zoom and pan. No real stories, Site, SQLite or MCP mutations.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HTML = (ROOT / "site/public/index.html").read_text(encoding="utf-8")
PROJECT = "cw102-single-layout"

def main():
    graph = {
        "version": 1, "revision": 0, "view": None,
        "nodes": [
            {"id": "n1", "title": "Соседняя сцена", "description": "Не двигать",
             "x": 65, "y": 80, "parent": None},
            {"id": "n2", "title": "Следствие", "description": "Тоже не двигать",
             "x": 470, "y": 80, "parent": None}
        ],
        "edges": [{"id": "e1", "from": "n1", "to": "n2", "type": "precedes"}],
        "fields": [], "lanes": [],
        "gapNotes": [
            {"id": "gn1", "title": "Заметка",
             "text": "Составь одно небольшое событие для проверки интерфейса",
             "x": 100, "y": 450, "status": "pending", "parent": None}
        ]
    }
    saved = copy.deepcopy(graph)
    db = {"writes": 0}
    errors = []

    def serve(route):
        request = route.request
        path = urlsplit(request.url).path
        def ok(value,code=200):
            route.fulfill(status=code, content_type="application/json",
                          body=json.dumps(value,ensure_ascii=False))
        if path == "/" and request.method == "GET":
            route.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
        elif path == "/api/health":
            ok({"ok":True,"authenticated":True,"authMode":"sites-native"})
        elif path == "/api/projects" and request.method == "GET":
            ok({"projects":[{"id":PROJECT,"name":"Synthetic single","revision":0}]})
        elif path == "/api/projects/" + PROJECT and request.method == "GET":
            ok({"id":PROJECT,"name":"Synthetic single","revision":0,"graph":graph})
        elif request.method in ("PUT","POST","PATCH","DELETE"):
            db["writes"] += 1
            ok({"error":"READ_ONLY_FIXTURE"},403)
        else:
            ok({"error":"NOT_FOUND"},404)

    # Mirrors compiler's one-card right-side candidate: note.x + 272 + 60.
    x,y = 100+272+60,450
    proposal = {
        "workspaces":[{"id":"ws1","x":x,"y":y,"width":280,"height":250}],
        "nodes":[{"id":"draft1","title":"Один сюжетный блок",
                  "description":"Черновик остаётся за границами канона",
                  "x":x+36,"y":y+48,"workspaceId":"ws1","draftBranchId":"one"}],
        "edges":[]
    }

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,
            args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1365,"height":920})
        context.route("https://plot.local/**",serve)
        page=context.new_page()
        page.on("pageerror",lambda error:errors.append(str(error)))
        page.goto("https://plot.local/")
        page.wait_for_function(
            "() => window.__graphite && __graphite.getRemote().connected"
            " && document.querySelector('[data-gap-note=gn1]')")
        page.evaluate("p=>__graphite.setCreativeWorkspacePreview(p)",proposal)
        page.evaluate("()=>__graphite.fit()")
        assert page.locator('[data-cw-node="draft1"]').count()==1
        assert page.locator('[data-gap-note="gn1"]').count()==1
        assert "Черновик" in page.locator('[data-cw-node="draft1"]').inner_text()

        def geometry():
            return page.evaluate("""() => {
              const selectors=['[data-gap-note="gn1"]','[data-cw-node="draft1"]',
                 '[data-cw-workspace="ws1"]','[data-node="n1"]','[data-node="n2"]'];
              const r=selectors.map(s=>document.querySelector(s).getBoundingClientRect());
              const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*
                 Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
              return {noteDraft:overlap(r[0],r[1]),noteFrame:overlap(r[0],r[2]),
                canonDraft:[overlap(r[3],r[1]),overlap(r[4],r[1])],
                canonFrame:[overlap(r[3],r[2]),overlap(r[4],r[2])],
                gap:r[1].left-r[0].right,
                frameInside:r[1].left>=r[2].left-1&&r[1].right<=r[2].right+1 &&
                  r[1].top>=r[2].top-1&&r[1].bottom<=r[2].bottom+1};
            }""")

        for zoom in (0.65,0.9,1.2):
            page.evaluate("z=>__graphite.setZoomForTest(z)",zoom)
            g=geometry()
            assert g["noteDraft"]==0 and g["noteFrame"]==0,g
            assert g["canonDraft"]==[0,0] and g["canonFrame"]==[0,0],g
            assert g["gap"]>8 and g["frameInside"],g
            assert page.evaluate("()=>__graphite.getState().nodes")==saved["nodes"]
            assert db["writes"]==0

        original_pan=page.evaluate("()=>__graphite.getPan()")
        page.mouse.move(1190,780)
        page.mouse.down(button="middle")
        page.mouse.move(1270,815,steps=5)
        page.mouse.up(button="middle")
        changed_pan=page.evaluate("()=>__graphite.getPan()")
        assert changed_pan!=original_pan,(original_pan,changed_pan)
        after=geometry()
        assert after["noteDraft"]==0 and after["canonDraft"]==[0,0],after
        assert db["writes"]==0 and graph==saved

        page.evaluate("()=>__graphite.setCreativeWorkspacePreview(null)")
        assert page.locator(".cw-preview-card").count()==0
        page.reload()
        page.wait_for_function("()=>window.__graphite && __graphite.getRemote().connected")
        assert page.locator(".cw-preview-card").count()==0
        assert db["writes"]==0 and graph==saved
        assert not errors,errors
        context.close()
        browser.close()
    print(json.dumps({"result":"PASS","zooms":[.65,.9,1.2],
        "checks":["source adjacency","no canonical collision",
                  "zoom and pan","no persistence or canon movement"]},
        ensure_ascii=False))

if __name__=="__main__":
    main()
