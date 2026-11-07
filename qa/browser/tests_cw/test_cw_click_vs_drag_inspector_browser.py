"""Mouse gesture regression: click opens inspector, drag never does.

Runs against the actual bundled Graphite editor in isolated Chromium with
only a synthetic story. No localhost production server or user graph.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HTML = (ROOT / "site/public/index.html").read_text(encoding="utf-8")


def center(locator):
    box = locator.bounding_box()
    assert box and box["width"] > 0 and box["height"] > 0, "missing hit area"
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


def drag(page, locator, dx=46, dy=25):
    start = center(locator)
    page.mouse.move(*start)
    page.mouse.down()
    page.mouse.move(start[0] + dx, start[1] + dy, steps=7)
    page.mouse.up()


def fixture():
    return {
        "version": 1, "revision": 1, "view": None,
        "nextNode": 3, "nextEdge": 1, "nextField": 2, "nextLine": 2,
        "nodes": [
            {"id": "n1", "title": "Event A", "description": "One", "x": 150, "y": 240,
             "parent": None, "lineIds": ["l1"]},
            {"id": "n2", "title": "Event B", "description": "Two", "x": 550, "y": 250,
             "parent": None, "lineIds": ["l1"]}
        ],
        "edges": [], "fields": [
            {"id": "f1", "title": "Situation", "color": "#b8a16e",
             "x": 80, "y": 140, "width": 900, "height": 460,
             "parent": None, "assignmentMode": "auto"}
        ],
        "lanes": [{"id": "l1", "title": "Main", "color": "#b8a16e", "y": 180}]
    }


def node_xy(page, node_id):
    return page.evaluate(
        "id => {const n=__graphite.getState().nodes.find(n=>n.id===id);return [n.x,n.y]}",
        node_id,
    )


def assert_closed(page, label):
    assert not page.locator("#inspector").is_visible(), label


def assert_open(page, label):
    assert page.locator("#inspector").is_visible(), label


def main():
    with sync_playwright() as play:
        browser = play.chromium.launch(headless=True, args=["--no-sandbox",
                                                            "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": 1560, "height": 940})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.evaluate("""() => {
          window.__memoryLocal={};
          Object.defineProperty(window,'localStorage',{value:{
            getItem:k=>window.__memoryLocal[k]??null,
            setItem:(k,v)=>{window.__memoryLocal[k]=String(v)},
            removeItem:k=>{delete window.__memoryLocal[k]},
            clear:()=>{window.__memoryLocal={}}
          }});
        }""")
        page.set_content(HTML, wait_until="load")
        page.evaluate("(graph)=>__graphite.loadFixture(graph)", fixture())
        page.evaluate("()=>__graphite.setZoomForTest(1)")
        card = page.locator('[data-node="n1"]')
        assert_closed(page, "inspector starts closed")

        # Normal click is a deliberate request for details.
        card.click()
        assert_open(page, "ordinary event click opens settings")

        # Dragging an ALREADY selected card must not redisplay its settings.
        before = node_xy(page, "n1")
        drag(page, card)
        after = node_xy(page, "n1")
        assert after[0] > before[0] + 35 and after[1] > before[1] + 18
        assert_closed(page, "selected event drag must not reopen inspector")

        card = page.locator('[data-node="n1"]')
        card.click()
        assert_open(page, "first intentional click after drag reopens settings")
        page.locator("#close-inspect").click()

        # Dragging an unselected event still moves it without opening settings.
        before = node_xy(page, "n1")
        drag(page, page.locator('[data-node="n1"]'), 35, 20)
        after = node_xy(page, "n1")
        assert after != before
        assert_closed(page, "unselected event drag must not open inspector")

        # Group movement preserves selection but is not a request to inspect.
        page.evaluate("()=>__graphite.selectNodes(['n1','n2'])")
        before = {key: node_xy(page, key) for key in ("n1", "n2")}
        drag(page, page.locator('[data-node="n1"]'), 22, 15)
        assert all(node_xy(page, key) != before[key] for key in before)
        assert page.evaluate("()=>__graphite.getSelection().length") == 2
        assert_closed(page, "group drag must not show inspector")

        # A standalone task note has its own click / drag handlers.
        note_id = page.evaluate("()=>__graphite.newGapNote({x:170,y:665})")
        assert note_id
        assert_open(page, "new note may deliberately open its editor")
        page.locator("#close-inspect").click()
        before = page.evaluate("(id)=>__graphite.getGapNotes().find(n=>n.id===id).x", note_id)
        drag(page, page.locator(f'[data-gap-note="{note_id}"]'), 36, 14)
        after = page.evaluate("(id)=>__graphite.getGapNotes().find(n=>n.id===id).x", note_id)
        assert after > before + 25
        assert_closed(page, "note drag must not open settings")
        page.locator(f'[data-gap-note="{note_id}"]').click()
        assert_open(page, "note click still opens settings")
        page.locator("#close-inspect").click()

        # A semantic field opens on click but not on frame translation.
        field = page.locator('[data-field="f1"] .field-head')
        field.click()
        assert_open(page, "field click opens settings")
        page.locator("#close-inspect").click()
        drag(page, page.locator('[data-field="f1"] .field-head'), 22, 15)
        assert_closed(page, "semantic field drag must not show inspector")
        page.locator('[data-field="f1"] .field-head').click()
        assert_open(page, "field settings still open on click")
        page.locator("#close-inspect").click()

        # Editorial field also has a click handler separate from pointerup.
        page.evaluate("()=>__graphite.createEditorialField({x:800,y:640})")
        page.locator("#entry").fill("Rewrite this part")
        page.locator("#dialog button.primary").click()
        assert_open(page, "creating editorial field deliberately opens inspector")
        page.locator("#close-inspect").click()
        drag(page, page.locator(".editorial-field .editorial-head"), 23, 13)
        assert_closed(page, "editorial field drag must not open inspector")
        page.locator(".editorial-field .editorial-head").click()
        assert_open(page, "editorial field click opens settings")
        page.locator("#close-inspect").click()

        # Compact and map representations use a second drag implementation.
        page.evaluate("()=>__graphite.selectNodes([])")
        page.evaluate("()=>__graphite.setZoomForTest(.48)")
        marker = page.locator('.pa-semantic-item[data-zoom-node="n1"] .pa-semantic-dot')
        drag(page, marker, 35, 19)
        assert_closed(page, "compact semantic node drag must not open inspector")
        page.evaluate("()=>__graphite.selectNodes([])")
        page.evaluate("()=>__graphite.setZoomForTest(.24)")
        marker = page.locator('.pa-semantic-item[data-zoom-node="n1"] .pa-semantic-dot')
        drag(page, marker, 40, 18)
        assert_closed(page, "map marker drag must not open inspector")
        page.locator('.pa-semantic-item[data-zoom-node="n1"] .pa-semantic-dot').click()
        assert_open(page, "map marker click still opens selected event")
        assert not errors, errors
        browser.close()
    print("PASS: click/drag separation on nodes, group, note, fields and semantic zoom")


if __name__ == "__main__":
    main()
