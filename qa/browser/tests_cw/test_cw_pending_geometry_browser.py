"""Recovery from pending browser edits, using the real editor and synthetic SQLite REST.

No real plot, connected Site, D1, tunnel, MCP service or user browser state.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from test_cw_persisted_workspace_accept_browser import story

ROOT = Path(__file__).resolve().parents[3]
HTML = (ROOT / "site/public/index.html").read_text(encoding="utf-8")
PROJECT = "cw-pending-position-qa"


def main():
    graph = story()
    graph["revision"] = 12
    db = {"revision": 12, "graph": graph, "writes": 0}
    errors = []

    def serve(route):
        request = route.request
        path = urlsplit(request.url).path
        method = request.method

        def reply(data, status=200):
            route.fulfill(status=status, content_type="application/json",
                          body=json.dumps(data, ensure_ascii=False))

        if path == "/" and method == "GET":
            route.fulfill(status=200, content_type="text/html; charset=utf-8", body=HTML)
        elif path == "/api/health":
            reply({"ok": True, "authenticated": True, "authMode": "node-loopback",
                   "workflowEnabled": True})
        elif path == "/api/projects" and method == "GET":
            reply({"projects": [{"id": PROJECT, "name": "Synthetic note recovery",
                                 "revision": db["revision"]}]})
        elif path == "/api/projects/" + PROJECT and method == "GET":
            reply({"id": PROJECT, "name": "Synthetic note recovery",
                   "revision": db["revision"], "graph": copy.deepcopy(db["graph"])})
        elif path == "/api/projects/" + PROJECT and method == "PUT":
            body = json.loads(request.post_data or "{}")
            if body.get("expectedRevision") != db["revision"]:
                reply({"error": "REVISION_CONFLICT"}, 409)
                return
            proposal = body["graph"]
            previous = db["graph"]
            # This synthetic server accepts ONLY an exact, single note move.
            assert proposal["nodes"] == previous["nodes"]
            assert proposal["edges"] == previous["edges"]
            assert proposal["workspaces"] == previous["workspaces"]
            assert proposal["replacements"] == previous["replacements"]
            assert proposal["gapNotes"][0]["id"] == previous["gapNotes"][0]["id"]
            assert proposal["gapNotes"][0]["text"] == previous["gapNotes"][0]["text"]
            assert proposal["gapNotes"][0]["x"] == previous["gapNotes"][0]["x"]
            assert proposal["gapNotes"][0]["y"] == previous["gapNotes"][0]["y"] + 35
            assert proposal["revision"] == previous["revision"]
            db["graph"] = copy.deepcopy(proposal)
            db["revision"] += 1
            db["writes"] += 1
            reply({"id": PROJECT, "revision": db["revision"]})
        else:
            reply({"error": "NOT_FOUND"}, 404)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=[
            "--no-sandbox", "--disable-dev-shm-usage"
        ])
        context = browser.new_context(viewport={"width": 1380, "height": 930},
                                      accept_downloads=True)
        context.route("http://127.0.0.1:8788/**", serve)
        page = context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto("http://127.0.0.1:8788/")
        page.wait_for_function(
            "() => __graphite.getRemote().connected && __graphite.getRemote().revision === 12"
        )
        assert page.locator(".cw-movable-draft").count() == 3

        # Revision and derived automatic field tags are NOT substantive edits.
        page.evaluate("""id => {
            const key = 'pa-site01-graph-' + id;
            const g = JSON.parse(localStorage.getItem(key));
            g.revision = 13;
            for (const n of g.nodes) n.autoFieldIds = ['derived-field'];
            localStorage.setItem(key, JSON.stringify(g));
            localStorage.setItem('pa-site01-pending-' + id, '1');
        }""", PROJECT)
        page.reload()
        page.wait_for_function(
            "() => __graphite.getRemote().connected && !__graphite.getRemote().blocked"
            "&& __graphite.getRemote().revision === 12"
        )
        assert page.evaluate(
            "id => localStorage.getItem('pa-site01-pending-' + id)", PROJECT
        ) is None
        assert db["writes"] == 0

        # Exactly the observed user's case: revision + derived fields +
        # a vertical move of an existing note, with all draft text preserved.
        page.evaluate("""id => {
            const key = 'pa-site01-graph-' + id;
            const g = JSON.parse(localStorage.getItem(key));
            g.revision = 13;
            for (const n of g.nodes) n.autoFieldIds = ['derived-field'];
            g.gapNotes[0].y += 35;
            localStorage.setItem(key, JSON.stringify(g));
            localStorage.setItem('pa-site01-pending-' + id, '1');
        }""", PROJECT)
        old = copy.deepcopy(db["graph"])
        page.reload()
        page.wait_for_function(
            "() => __graphite.getRemote().connected && __graphite.getRemote().blocked"
            "&& __graphite.getRemote().dirty"
        )
        assert db["writes"] == 0
        page.locator("#projects-open").click()
        assert page.locator("#pm-save-note-positions").is_visible()
        assert page.locator("#pm-recover").is_visible()
        assert "положение" in page.locator("#pm-status").inner_text().lower()
        page.once("dialog", lambda dialog: dialog.accept())
        with page.expect_download() as downloaded:
            page.locator("#pm-save-note-positions").click()
        backup = json.loads(Path(downloaded.value.path()).read_text(encoding="utf-8"))
        assert backup["project"]["graph"]["gapNotes"][0]["y"] == old["gapNotes"][0]["y"] + 35
        page.wait_for_function(
            "() => __graphite.getRemote().connected && !__graphite.getRemote().blocked"
            "&& __graphite.getRemote().revision === 13"
        )
        assert db["writes"] == 1
        assert db["graph"]["gapNotes"][0]["y"] == old["gapNotes"][0]["y"] + 35
        assert db["graph"]["gapNotes"][0]["text"] == old["gapNotes"][0]["text"]
        assert db["graph"]["nodes"] == old["nodes"]
        assert db["graph"]["edges"] == old["edges"]
        assert page.evaluate(
            "id => localStorage.getItem('pa-site01-pending-' + id)", PROJECT
        ) is None

        page.reload()
        page.wait_for_function(
            "() => __graphite.getRemote().connected && !__graphite.getRemote().blocked"
        )
        assert db["writes"] == 1

        # A changed title is NOT a position-only change.
        page.evaluate("""id => {
            const key = 'pa-site01-graph-' + id;
            const g = JSON.parse(localStorage.getItem(key));
            g.nodes[0].title = 'Changed in browser only';
            g.gapNotes[0].y += 10;
            localStorage.setItem(key, JSON.stringify(g));
            localStorage.setItem('pa-site01-pending-' + id, '1');
        }""", PROJECT)
        page.reload()
        page.wait_for_function(
            "() => __graphite.getRemote().connected && __graphite.getRemote().blocked"
        )
        page.locator("#projects-open").click()
        assert not page.locator("#pm-save-note-positions").is_visible()
        assert page.locator("#pm-recover").is_visible()
        assert db["writes"] == 1
        page.locator("#pm-close").click()

        # Restore a position-only conflict, then force a concurrent revision
        # change: the old preview is no longer authorized to write.
        page.evaluate("""id => {
            const key = 'pa-site01-graph-' + id;
            const g = JSON.parse(localStorage.getItem(key));
            g.nodes[0].title = 'Начало';
            localStorage.setItem(key, JSON.stringify(g));
        }""", PROJECT)
        page.reload()
        page.wait_for_function(
            "() => __graphite.getRemote().connected && __graphite.getRemote().blocked"
        )
        page.locator("#projects-open").click()
        assert page.locator("#pm-save-note-positions").is_visible()
        db["revision"] += 1  # unrelated change from a second client
        page.once("dialog", lambda dialog: dialog.accept())
        with page.expect_download():
            page.locator("#pm-save-note-positions").click()
        page.wait_for_function(
            "() => document.querySelector('#pm-error')?.textContent.includes('SQLite изменилась')"
        )
        assert "SQLite изменилась" in page.locator("#pm-error").inner_text()
        assert db["writes"] == 1
        assert page.evaluate("() => __graphite.getRemote().blocked") is True
        assert not errors, errors
        context.close()
        browser.close()

    print(json.dumps({
        "result": "PASS", "writes": db["writes"],
        "cases": ["derived revision-only auto-unblock",
                  "note position-only reviewed CAS", "backup first",
                  "drafts and links untouched", "reload",
                  "text difference stays blocked", "concurrent revision rejected"]
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
