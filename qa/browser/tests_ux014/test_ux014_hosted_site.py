"""UX-014 Site UI regression with a wholly synthetic in-memory REST backend.

Uses the actual embedded editor, real Chromium and no production Site/D1.
Run: python qa/browser/tests_ux014/test_ux014_hosted_site.py
"""
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HTML = (ROOT / "site/public/index.html").read_text(encoding="utf-8")
PROJECT_ID = "qa-synthetic-ux014"
NAME = "Synthetic UX-014"


def initial_graph():
    return {
        "version": 1, "revision": 0, "view": None,
        "nextNode": 3, "nextEdge": 2, "nextField": 2, "nextLine": 2,
        "nodes": [
            {"id": "n1", "title": "Source", "description": "Original fact",
             "x": 120, "y": 160, "parent": None, "lineIds": ["l1"], "size": "normal",
             "manualFieldIds": ["f1"], "status": "approved"},
            {"id": "n2", "title": "Consequence", "description": "Preserved",
             "x": 480, "y": 170, "parent": None, "lineIds": ["l1"], "size": "normal"},
        ],
        "edges": [{"id": "e1", "from": "n1", "to": "n2", "type": "causes"}],
        "fields": [{"id": "f1", "title": "Tag", "comment": "", "x": 60, "y": 100,
                    "width": 770, "height": 330, "assignmentMode": "auto", "parent": None}],
        "lanes": [{"id": "l1", "title": "Main", "color": "#b8a16e", "y": 200}],
    }


def main():
    db = {"revision": 0, "graph": initial_graph(), "writes": []}
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
            respond({"projects": [{"id": PROJECT_ID, "name": NAME, "revision": db["revision"]}]})
        elif path == "/api/projects/" + PROJECT_ID and method == "GET":
            respond({"id": PROJECT_ID, "name": NAME, "revision": db["revision"],
                     "graph": db["graph"]})
        elif path == "/api/projects/" + PROJECT_ID and method == "PUT":
            payload = json.loads(request.post_data or "{}")
            if payload.get("expectedRevision") != db["revision"]:
                respond({"error": "REVISION_CONFLICT", "currentRevision": db["revision"]}, 409)
                return
            db["graph"] = payload["graph"]
            db["revision"] += 1
            db["writes"].append({"revision": db["revision"], "graph": db["graph"]})
            respond({"id": PROJECT_ID, "name": NAME, "revision": db["revision"]})
        else:
            respond({"error": "NOT_FOUND"}, 404)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1365, "height": 920})
        context.route("https://plot.local/**", serve)
        page = context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto("https://plot.local/")
        page.wait_for_function("window.__graphite && __graphite.getRemote().connected")
        assert page.evaluate("() => __graphite.getRemote().connected")
        page.evaluate("() => __graphite.selectNode('n1')")
        page.locator("#i-rewrite").click()
        # Wait for the new draft to persist before testing the next edit;
        # otherwise the existing debounce correctly coalesces both writes.
        page.wait_for_function("() => __graphite.getRemote().revision >= 1 && !__graphite.getRemote().dirty")
        assert page.locator("#rewrite-heading").is_visible()
        assert page.locator(".ux014-generate").is_disabled()
        assert db["graph"]["nodes"][0]["description"] == "Original fact"

        task = "Strengthen conflict while preserving the source and cause."
        page.locator("#ux014-task").fill(task)
        page.wait_for_function("() => __graphite.getRemote().revision >= 2 && !__graphite.getRemote().dirty")
        assert db["graph"]["eventRewrites"][0]["taskText"] == task
        assert db["graph"]["eventRewrites"][0]["offerVariants"] is True
        assert db["graph"]["nodes"][0]["title"] == "Source"
        assert db["graph"]["nodes"][0]["description"] == "Original fact"
        assert db["graph"]["nodes"][0]["manualFieldIds"] == ["f1"]
        assert db["graph"]["edges"] == initial_graph()["edges"]
        assert db["graph"]["fields"] == initial_graph()["fields"]

        page.locator("#ux014-offer").uncheck()
        page.wait_for_function("() => __graphite.getRemote().revision >= 3 && !__graphite.getRemote().dirty")
        assert db["graph"]["eventRewrites"][0]["offerVariants"] is False

        page.reload()
        page.wait_for_function("window.__graphite && __graphite.getRemote().connected")
        page.evaluate("() => __graphite.selectNode('n1')")
        assert page.locator("#ux014-task").input_value() == task
        assert not page.locator("#ux014-offer").is_checked()

        page.locator("#ux014-cancel").click()
        page.wait_for_function("() => __graphite.getRemote().revision >= 4 && !__graphite.getRemote().dirty")
        assert db["graph"]["eventRewrites"] == []
        page.reload()
        page.wait_for_function("window.__graphite && __graphite.getRemote().connected")
        page.evaluate("() => __graphite.selectNode('n1')")
        assert page.locator("#field-title").input_value() == "Source"
        assert db["graph"]["edges"] == initial_graph()["edges"]

        # Simulate a simultaneous server revision from another editor/MCP writer.
        page.locator("#i-rewrite").click()
        page.wait_for_function("() => __graphite.getRemote().revision >= 5 && !__graphite.getRemote().dirty")
        db["revision"] += 1
        db["graph"]["nodes"][0]["description"] = "Updated elsewhere"
        page.locator("#ux014-task").fill("Local draft must survive 409")
        page.wait_for_function("() => __graphite.getRemote().blocked === true")
        assert db["graph"]["eventRewrites"][0]["taskText"] == ""
        assert db["graph"]["nodes"][0]["description"] == "Updated elsewhere"
        assert page.evaluate("() => __graphite.getEventRewrites()[0].taskText") == "Local draft must survive 409"

        page.reload()
        # connectSite marks itself connected before openProject finishes reading
        # the pending local backup. Wait for recovery rather than that early flag.
        page.wait_for_function("() => window.__graphite && __graphite.getRemote().connected && __graphite.getRemote().blocked")
        page.evaluate("() => __graphite.selectNode('n1')")
        assert page.locator("#ux014-task").input_value() == "Local draft must survive 409"
        assert not errors, errors
        context.close()
        browser.close()
    print(json.dumps({"result": "PASS", "writes": len(db["writes"]),
                      "scenarios": ["create", "type", "toggle", "reload",
                                    "cancel", "409", "local recovery"]}))


if __name__ == "__main__":
    main()
