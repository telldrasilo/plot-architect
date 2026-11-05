"""CW-011 same-canvas visual prototype with no canonical writes or deployment.

Uses current Graphite HTML and actual Chromium with a fully synthetic API. The
new working-area visual layer is deliberately ephemeral and is not the shipped
editorial workflow, a generator, or a persistence endpoint.
"""
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HTML = (ROOT / "site/public/index.html").read_text(encoding="utf-8")
PROJECT_ID = "qa-cw-preview"


def main():
    project = {
        "version": 1, "revision": 0, "view": None,
        "nodes": [
            {"id": "n1", "title": "Завязка", "description": "Исходное событие",
             "x": 90, "y": 80, "parent": None, "lineIds": [], "size": "normal"},
            {"id": "n2", "title": "Следствие", "description": "Следует по сюжету",
             "x": 460, "y": 80, "parent": None, "lineIds": [], "size": "normal"}
        ],
        "edges": [{"id": "e1", "from": "n1", "to": "n2", "type": "precedes"}],
        "fields": [], "lanes": []
    }
    db = {"graph": project, "revision": 0, "writes": 0}
    errors = []

    def serve(route):
        request = route.request
        path = urlsplit(request.url).path

        def ok(data, code=200):
            route.fulfill(status=code, content_type="application/json",
                          body=json.dumps(data, ensure_ascii=False))
        if path == "/" and request.method == "GET":
            route.fulfill(status=200, content_type="text/html; charset=utf-8", body=HTML)
        elif path == "/api/health":
            ok({"ok": True, "authenticated": True, "authMode": "sites-native"})
        elif path == "/api/projects" and request.method == "GET":
            ok({"projects": [{"id": PROJECT_ID, "name": "CW synthetic",
                              "revision": db["revision"]}]})
        elif path == "/api/projects/" + PROJECT_ID and request.method == "GET":
            ok({"id": PROJECT_ID, "name": "CW synthetic",
                "revision": db["revision"], "graph": db["graph"]})
        elif path == "/api/projects/" + PROJECT_ID and request.method == "PUT":
            db["writes"] += 1
            ok({"error": "PREVIEW_MUST_NOT_WRITE"}, 403)
        else:
            ok({"error": "NOT_FOUND"}, 404)

    # Four branches of independent lengths: 1, 2, 3 and 1 nodes.
    nodes = []
    edges = []
    for i, count in enumerate([1, 2, 3, 1]):
        prefix = "branch" + str(i + 1)
        y = 430 + i * 155
        for j in range(count):
            nodes.append({
                "id": prefix + "-n" + str(j + 1),
                "title": "Событие " + str(i + 1) + "." + str(j + 1),
                "description": "Пробный поворот, не часть сюжета",
                "x": 145 + j * 270, "y": y,
                "workspaceId": "w1", "draftBranchId": prefix
            })
            if j:
                edges.append({
                    "id": prefix + "-e" + str(j),
                    "from": prefix + "-n" + str(j),
                    "to": prefix + "-n" + str(j + 1),
                    "workspaceId": "w1", "draftRelation": "internal"
                })
    preview = {
        "workspaces": [{"id": "w1", "x": 95, "y": 370, "width": 1250, "height": 820}],
        "nodes": nodes, "edges": edges
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1365, "height": 920})
        context.route("https://plot.local/**", serve)
        page = context.new_page()
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.goto("https://plot.local/")
        page.wait_for_function(
            "() => window.__graphite && __graphite.getRemote().connected "
            "&& __graphite.getProjectIndex().activeId === 'qa-cw-preview' "
            "&& __graphite.getState().nodes.length === 2 "
            "&& __graphite.getState().nodes[0].title === 'Завязка' "
            "&& !__graphite.getRemote().busy && !__graphite.getRemote().dirty"
        )
        before = page.evaluate("() => __graphite.getState()")
        remote_before = page.evaluate("() => __graphite.getRemote().revision")
        page.evaluate("s => __graphite.setCreativeWorkspacePreview(s)", preview)
        page.evaluate("() => __graphite.fit()")
        assert page.locator(".cw-preview-area").count() == 1
        assert page.locator(".cw-preview-card").count() == 7
        assert page.locator(".cw-preview-link").count() == 3
        assert "не в сюжете" in page.locator(".cw-preview-area-head").inner_text()
        assert "Вариант 4" in page.locator('[data-cw-node="branch4-n1"]').inner_text()
        assert page.locator('[data-cw-node="branch1-n1"]').get_attribute("aria-label").startswith("Черновик:")

        # Mouse drag changes only transient preview coordinates; neither
        # canonical state nor the synthetic Site API receives a write.
        card = page.locator('[data-cw-node="branch2-n1"]')
        old = page.evaluate("() => __graphite.getCreativeWorkspacePreview().nodes.find(n => n.id === 'branch2-n1')")
        box = card.bounding_box()
        assert box is not None
        mx, my = box["x"] + box["width"]/2, box["y"] + box["height"]/2
        page.mouse.move(mx, my)
        page.mouse.down()
        page.mouse.move(mx + 90, my + 40, steps=5)
        page.mouse.up()
        changed = page.evaluate("() => __graphite.getCreativeWorkspacePreview().nodes.find(n => n.id === 'branch2-n1')")
        assert changed["x"] > old["x"]
        assert changed["y"] > old["y"]
        assert page.evaluate("() => __graphite.getState()") == before
        assert page.evaluate("() => __graphite.getRemote().revision") == remote_before
        assert db["writes"] == 0

        # Reject ambiguous/mixed endpoints. This is only a visual fixture,
        # never a route capable of approving a plot relation.
        invalid = json.loads(json.dumps(preview))
        invalid["edges"].append({
            "id": "outside", "from": "n1", "to": "branch2-n1",
            "workspaceId": "w1", "draftRelation": "internal"
        })
        failure = page.evaluate("""value => {
            try { __graphite.setCreativeWorkspacePreview(value); return false }
            catch { return true }
        }""", invalid)
        assert failure is True
        assert page.locator(".cw-preview-card").count() == 7

        # A preview can be dismissed without touching local or remote graph.
        page.evaluate("() => __graphite.setCreativeWorkspacePreview(null)")
        assert page.locator(".cw-preview-area").count() == 0
        assert page.evaluate("() => __graphite.getState()") == before
        page.reload()
        page.wait_for_function(
            "() => window.__graphite && __graphite.getRemote().connected "
            "&& __graphite.getProjectIndex().activeId === 'qa-cw-preview' "
            "&& __graphite.getState().nodes.length === 2 "
            "&& __graphite.getState().nodes[0].title === 'Завязка' "
            "&& !__graphite.getRemote().busy && !__graphite.getRemote().dirty"
        )
        assert page.locator(".cw-preview-card").count() == 0
        assert db["writes"] == 0
        assert db["graph"] == project
        assert not errors, errors
        context.close()
        browser.close()

    print(json.dumps({
        "result": "PASS", "branches": 4, "draft_cards": 7,
        "draft_arrows": 3, "remote_writes": db["writes"],
        "scenarios": ["same canvas", "four branches", "draft-only drag",
                      "invalid cross-scope edge", "dismiss", "reload"]
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
