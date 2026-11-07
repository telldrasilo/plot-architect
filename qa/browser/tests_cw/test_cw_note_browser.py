"""CW-006/007 browser seam: actual standalone note UI with synthetic REST.

Tests the real bundled Graphite editor's note persistence, editorial context
link and reload. It deliberately does NOT claim that AI generation or workspace
isolation is already implemented in that editor. Those are isolated Node tests.
No production Site, D1 or real user stories are touched.
"""
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HTML = (ROOT / "site/public/index.html").read_text(encoding="utf-8")
PROJECT_ID = "qa-synthetic-cw-note"


def initial_graph():
    return {
        "version": 1, "revision": 0, "view": None,
        "nextNode": 3, "nextEdge": 2, "nextField": 1, "nextLine": 2,
        "nodes": [
            {"id": "n1", "title": "До события", "description": "Canon", "x": 100, "y": 80,
             "parent": None, "lineIds": ["l1"], "size": "normal"},
            {"id": "n2", "title": "Предмет заметки", "description": "Original story", "x": 440, "y": 80,
             "parent": None, "lineIds": ["l1"], "size": "normal"},
        ],
        "edges": [{"id": "e1", "from": "n1", "to": "n2", "type": "precedes"}],
        "fields": [],
        "lanes": [{"id": "l1", "title": "Main", "color": "#b8a16e", "y": 120}],
    }


def assert_note_inspector_adjacent(page, note_id):
    geometry = page.evaluate("""id => {
      const card=[...document.querySelectorAll('[data-gap-note]')]
        .find(n=>n.dataset.gapNote===id);
      const inspector=document.querySelector('#inspector');
      const canvas=document.querySelector('#canvas');
      if(!card||!inspector||inspector.hidden)return null;
      const a=card.getBoundingClientRect(),b=inspector.getBoundingClientRect();
      const frame=canvas.getBoundingClientRect();
      const overlap=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))
        *Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      return {overlap,visible:b.left>=frame.left+7&&b.top>=frame.top+7
        &&b.right<=frame.right-7&&b.bottom<=frame.bottom-7,
        near:inspector.classList.contains('near-node'),
        distance:Math.min(Math.abs(b.left-a.right),Math.abs(a.left-b.right),
          Math.abs(b.top-a.bottom),Math.abs(a.top-b.bottom))};
    }""",note_id)
    assert geometry is not None, "note inspector was not rendered"
    assert geometry["near"] and geometry["visible"], geometry
    assert geometry["overlap"] == 0, geometry
    assert geometry["distance"] <= 24, geometry


def main():
    db = {"revision": 0, "graph": initial_graph(), "writes": 0}
    errors = []

    def serve(route):
        request = route.request
        path = urlsplit(request.url).path
        method = request.method

        def respond(data, status=200):
            route.fulfill(status=status, content_type="application/json",
                          body=json.dumps(data, ensure_ascii=False))

        if path == "/" and method == "GET":
            route.fulfill(status=200, content_type="text/html; charset=utf-8", body=HTML)
        elif path == "/api/health" and method == "GET":
            respond({"ok": True, "authenticated": True, "authMode": "sites-native"})
        elif path == "/api/projects" and method == "GET":
            respond({"projects": [{"id": PROJECT_ID, "name": "Synthetic Note", "revision": db["revision"]}]})
        elif path == "/api/projects/" + PROJECT_ID and method == "GET":
            respond({"id": PROJECT_ID, "name": "Synthetic Note", "revision": db["revision"],
                     "graph": db["graph"]})
        elif path == "/api/projects/" + PROJECT_ID and method == "PUT":
            payload = json.loads(request.post_data or "{}")
            if payload.get("expectedRevision") != db["revision"]:
                respond({"error": "REVISION_CONFLICT", "currentRevision": db["revision"]}, 409)
                return
            db["graph"] = payload["graph"]
            db["revision"] += 1
            db["writes"] += 1
            respond({"id": PROJECT_ID, "name": "Synthetic Note", "revision": db["revision"]})
        else:
            respond({"error": "NOT_FOUND"}, 404)

    task = "Предложи четыре разные ветви по 1–3 события, без автоматической замены."
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1365, "height": 920})
        context.route("https://plot.local/**", serve)
        page = context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto("https://plot.local/")
        page.wait_for_function(
            "() => window.__graphite && __graphite.getRemote().connected "
            "&& __graphite.getState().nodes.some(n => n.id === 'n2' && n.title === 'Предмет заметки')"
        )
        note_id = page.evaluate("() => __graphite.newGapNote({x:120,y:370})")
        assert note_id.startswith("gn")
        page.locator("#inspector:not([hidden])").wait_for()
        assert_note_inspector_adjacent(page, note_id)
        # A user may still deliberately pin the same settings on the right.
        page.locator("#pin-inspect").click()
        assert not page.locator("#inspector").evaluate(
            "(el) => el.classList.contains('near-node')"
        )
        assert "Рядом" in page.locator("#pin-inspect").inner_text()
        page.locator("#pin-inspect").click()
        assert_note_inspector_adjacent(page, note_id)
        page.evaluate("() => __graphite.setZoomForTest(0.85)")
        assert_note_inspector_adjacent(page, note_id)
        page.wait_for_function("() => __graphite.getRemote().revision >= 1 && !__graphite.getRemote().dirty && !__graphite.getRemote().busy")
        page.evaluate("([id, text]) => __graphite.setGapNoteText(id,text)", [note_id, task])
        try:
            page.wait_for_function("() => __graphite.getRemote().revision >= 2 && !__graphite.getRemote().dirty && !__graphite.getRemote().busy", timeout=7000)
        except Exception:
            print(json.dumps({
                "debug": "note save stalled",
                "db_revision": db["revision"],
                "db_writes": db["writes"],
                "remote": page.evaluate("() => __graphite.getRemote()"),
                "editor_note": page.evaluate("(id) => __graphite.getGapNotes().find(n=>n.id===id)", note_id),
                "page_errors": errors,
                "toast": page.locator("#toast").inner_text(),
            }, ensure_ascii=False), flush=True)
            raise
        page.evaluate("id => __graphite.beginGapLink('gap_note',id)", note_id)
        page.evaluate("() => __graphite.completeGapLink('plot_node','n2')")
        page.wait_for_function("() => __graphite.getRemote().revision >= 3 && !__graphite.getRemote().dirty && !__graphite.getRemote().busy")

        assert len(db["graph"]["gapNotes"]) == 1
        assert db["graph"]["gapNotes"][0]["text"] == task
        # CW-006: old persisted offerVariants must not control or advertise a number of ideas.
        assert page.locator("#gap-offer").count() == 0
        assert "Предлагать три варианта" not in page.locator("#inspector").inner_text()
        assert "3 варианта" not in page.locator('[data-gap-note="' + note_id + '"]').inner_text()
        assert db["graph"]["gapLinks"][0]["to"] == {"kind": "plot_node", "id": "n2"}
        def core_fields(items):
            return [(n["id"], n["title"], n["description"], n["x"], n["y"]) for n in items]
        assert core_fields(db["graph"]["nodes"]) == core_fields(initial_graph()["nodes"])
        assert db["graph"]["edges"] == initial_graph()["edges"]
        assert "workspaces" not in db["graph"], "browser does not yet stage prepared alternatives"

        page.reload()
        page.wait_for_function(
            "([id, value]) => window.__graphite && __graphite.getRemote().connected "
            "&& __graphite.getRemote().revision >= 3 "
            "&& __graphite.getGapNotes().find(n=>n.id===id)?.text===value",
            arg=[note_id, task],
        )
        note = page.locator('[data-gap-note="' + note_id + '"]')
        assert note.count() == 1
        assert "Редакторское задание" in note.inner_text()
        assert "не сюжетное событие" not in note.inner_text()
        assert note.locator(".gap-note-head").inner_text().strip()=="▤ Заметка"
        assert note.locator(".gap-note-title").count()==0
        assert note.locator(".gap-note-body").inner_text()==task
        assert task not in note.locator(".gap-note-head").inner_text()
        assert page.evaluate("() => __graphite.getGapLinks().length") == 1
        note.click()
        assert_note_inspector_adjacent(page, note_id)
        assert len(db["graph"]["nodes"]) == 2

        # CW-102: two pending tasks must be distinguishable without gn IDs.
        # Legacy stored names remain exactly "Заметка" until an explicit rename.
        second = page.evaluate("() => __graphite.newGapNote({x:780,y:390})")
        page.wait_for_function("() => !__graphite.getRemote().busy && !__graphite.getRemote().dirty")
        task2 = ("Проверить мотивы свидетеля перед решением. " +
                 "Оценить протоколы и достоверность утверждений. "*9)
        page.evaluate("([id,value])=>__graphite.setGapNoteText(id,value)", [second, task2])
        page.wait_for_function(
            "id => !__graphite.getRemote().busy && !__graphite.getRemote().dirty"
            " && __graphite.getGapNotes().find(n=>n.id===id)?.text.startsWith('Проверить')",
            arg=second)
        first = page.locator(f'[data-gap-note="{note_id}"]')
        other = page.locator(f'[data-gap-note="{second}"]')
        first_head = first.locator(".gap-note-head").inner_text()
        second_head = other.locator(".gap-note-head").inner_text()
        assert first_head == second_head == "▤ Заметка"
        assert first.locator(".gap-note-title").count()==0
        assert other.locator(".gap-note-title").count()==0
        assert first.locator(".gap-note-body").inner_text()==task
        assert other.locator(".gap-note-body").inner_text()==task2
        assert "Предложи четыре" not in first_head
        assert "Проверить мотивы" not in second_head
        assert note_id not in first.inner_text() and second not in other.inner_text()
        assert [n["title"] for n in db["graph"]["gapNotes"]] == ["Заметка", "Заметка"]
        # Long task stays readable in inspector, but the card shows at most
        # four lines. No repeated 52-character heading is permitted.
        geometry=other.locator(".gap-note-body").evaluate("""el=>{
            const css=getComputedStyle(el);
            return {clamp:css.webkitLineClamp,visible:el.clientHeight,
                    natural:el.scrollHeight,line:parseFloat(css.lineHeight),
                    padding:parseFloat(css.paddingTop)+parseFloat(css.paddingBottom)};
        }""")
        assert geometry["clamp"]=="4",geometry
        assert geometry["visible"]<=geometry["line"]*4+geometry["padding"]+2,geometry
        assert geometry["natural"]>geometry["visible"],geometry
        other.click()
        assert page.locator("#gap-text").input_value()==task2
        # A user-authored title overrides the excerpt, and persists after reload.
        page.locator(f'[data-gap-note="{second}"]').click()
        page.locator("#gap-title").fill("Проверка свидетельства")
        page.locator("#gap-title").press("Tab")
        page.wait_for_function(
            "id => !__graphite.getRemote().busy && !__graphite.getRemote().dirty"
            " && __graphite.getGapNotes().find(n=>n.id===id)?.title==='Проверка свидетельства'",
            arg=second)
        assert page.locator(f'[data-gap-note="{second}"] .gap-note-head').inner_text()=="▤ Заметка"
        assert page.locator(f'[data-gap-note="{second}"] .gap-note-title').inner_text()=="Проверка свидетельства"
        assert page.locator(f'[data-gap-note="{second}"] .gap-note-body').inner_text()==task2
        assert db["graph"]["gapNotes"][0]["title"] == "Заметка"
        assert len(db["graph"]["nodes"]) == 2
        assert db["graph"]["edges"] == initial_graph()["edges"]
        page.reload()
        page.wait_for_function(
            "id => __graphite.getRemote().connected &&"
            " __graphite.getGapNotes().find(n=>n.id===id)?.title==='Проверка свидетельства'",
            arg=second)
        assert page.locator(f'[data-gap-note="{note_id}"] .gap-note-head').inner_text()=="▤ Заметка"
        assert page.locator(f'[data-gap-note="{note_id}"] .gap-note-body').inner_text()==task
        assert page.locator(f'[data-gap-note="{second}"] .gap-note-head').inner_text()=="▤ Заметка"
        assert page.locator(f'[data-gap-note="{second}"] .gap-note-title').inner_text()=="Проверка свидетельства"
        assert page.locator(f'[data-gap-note="{second}"] .gap-note-body').inner_text()==task2
        assert [n["title"] for n in db["graph"]["gapNotes"]] == [
            "Заметка", "Проверка свидетельства"]
        # Exact title==task must also avoid repeating the same words in card.
        first.click()
        page.locator("#gap-title").fill(task)
        page.locator("#gap-title").press("Tab")
        page.wait_for_function(
            "([id,title]) => !__graphite.getRemote().busy && !__graphite.getRemote().dirty"
            " && __graphite.getGapNotes().find(n=>n.id===id)?.title===title",
            arg=[note_id,task])
        assert first.locator(".gap-note-title").inner_text()==task
        assert first.locator(".gap-note-body").count()==0
        assert page.locator("#gap-text").input_value()==task
        assert not errors, errors
        context.close()
        browser.close()
    print(json.dumps({"result": "PASS", "writes": db["writes"],
                      "scenarios": ["create note", "edit task", "link to canonical event",
                                    "persist via synthetic Site API", "reload and isolate editorial link",
                                    "note inspector adjacent and right dock", "zoom/reload layout"]},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
