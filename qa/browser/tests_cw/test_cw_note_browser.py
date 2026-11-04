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
            "&& __graphite.getState().nodes.some(n => n.id === 'n2')"
        )
        note_id = page.evaluate("() => __graphite.newGapNote({x:120,y:370})")
        assert note_id.startswith("gn")
        page.wait_for_function("() => __graphite.getRemote().revision >= 1 && !__graphite.getRemote().dirty")
        page.evaluate("([id, text]) => __graphite.setGapNoteText(id,text)", [note_id, task])
        page.wait_for_timeout(1800)
        diagnostic = {
            "remote": page.evaluate("() => __graphite.getRemote()"),
            "localNote": page.evaluate("id => __graphite.getGapNotes().find(n => n.id === id)", note_id),
            "serverRevision": db["revision"],
            "serverNote": (db["graph"].get("gapNotes") or [None])[0],
            "pageErrors": errors,
        }
        print("CW-NOTE diagnostic " + json.dumps(diagnostic, ensure_ascii=False), flush=True)
        page.wait_for_function("() => __graphite.getRemote().revision >= 2 && !__graphite.getRemote().dirty", timeout=3500)
        page.evaluate("id => __graphite.beginGapLink('gap_note',id)", note_id)
        page.evaluate("() => __graphite.completeGapLink('plot_node','n2')")
        page.wait_for_function("() => __graphite.getRemote().revision >= 3 && !__graphite.getRemote().dirty")

        assert len(db["graph"]["gapNotes"]) == 1
        assert db["graph"]["gapNotes"][0]["text"] == task
        assert db["graph"]["gapNotes"][0]["offerVariants"] is True  # legacy UI flag, not new policy
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
        assert "не сюжетное событие" in note.inner_text()
        assert page.evaluate("() => __graphite.getGapLinks().length") == 1
        assert len(db["graph"]["nodes"]) == 2
        assert not errors, errors
        context.close()
        browser.close()
    print(json.dumps({"result": "PASS", "writes": db["writes"],
                      "scenarios": ["create note", "edit task", "link to canonical event",
                                    "persist via synthetic Site API", "reload and isolate editorial link"]},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
