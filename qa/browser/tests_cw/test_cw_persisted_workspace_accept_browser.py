"""CW-012 local-only editor proof: persisted workspaces and reviewed 'В сюжет'.

Runs the current HTML in real Chromium against a synthetic REST mock. Server
contract/SQLite transactions are covered separately by Node tests. This test
never touches a live Site, D1, MCP provider or user plot.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HTML = (ROOT / "site/public/index.html").read_text(encoding="utf-8")
PROJECT = "cw-synthetic-project"

def story():
    return {
        "version": 1, "revision": 1, "view": None,
        "nodes": [
            {"id": "n1", "title": "Начало", "description": "Канон", "x": 50, "y": 90, "parent": None},
            {"id": "n2", "title": "Старый поворот", "description": "Приостановлен", "x": 290, "y": 90, "parent": None},
            {"id": "n3", "title": "Последствие", "description": "Остаётся", "x": 530, "y": 90, "parent": None},
            {"id": "a", "title": "Новая завязка", "description": "Черновик А", "x": 150, "y": 510,
             "parent": None, "workspaceId": "w1", "draftBranchId": "alpha"},
            {"id": "b", "title": "Развилка", "description": "Черновик Б", "x": 460, "y": 510,
             "parent": None, "workspaceId": "w1", "draftBranchId": "alpha"},
            {"id": "c", "title": "Другая версия", "description": "Черновик В", "x": 150, "y": 710,
             "parent": None, "workspaceId": "w1", "draftBranchId": "beta"}
        ],
        "edges": [
            {"id": "e1", "from": "n1", "to": "n2", "type": "precedes"},
            {"id": "e2", "from": "n2", "to": "n3", "type": "causes"},
            {"id": "e3", "from": "n1", "to": "n3", "type": "enables"},
            {"id": "ea", "from": "a", "to": "b", "type": "precedes",
             "workspaceId": "w1", "draftRelation": "internal", "draftBranchId": "alpha"}
        ],
        "fields": [], "lanes": [],
        "workspaces": [{"id": "w1", "taskId": "gn1", "x": 95, "y": 450,
                        "width": 1050, "height": 500}],
        "replacements": [{"id": "r1", "state": "open", "sourceNodeIds": ["n2"],
                          "suspendedEdgeIds": ["e1", "e2"], "sourceGraphRevision": 0}],
        "gapNotes": [{"id": "gn1", "title": "Заметка", "text": "Подготовить две ветви",
                      "x": 100, "y": 320, "status": "pending", "parent": None}],
        "gapLinks": []
    }

def main():
    db = {"graph": story(), "revision": 1, "previews": 0,
          "applies": 0, "generic_writes": 0, "receipts": {}, "force_conflict": False}
    errors = []

    def plan(command):
        workspace_id = command["workspaceId"]
        selected = command["nodeIds"]
        active = {node["id"] for node in db["graph"]["nodes"]
                  if not node.get("workspaceId") and node["id"] != "n2"}
        selected_set = set(selected)
        if len(selected) != 1:
            raise AssertionError("Browser acceptance is intentionally single-node")
        pending = []
        ready = []
        for edge in db["graph"]["edges"]:
            if edge.get("workspaceId") != workspace_id:
                continue
            if not (edge["from"] in selected_set or edge["to"] in selected_set):
                continue
            if edge.get("draftRelation") == "internal" and (
                edge["from"] in active or edge["from"] in selected_set
            ) and (edge["to"] in active or edge["to"] in selected_set):
                ready.append(edge["id"])
            else:
                pending.append(edge["id"])
        return {"workspaceId": workspace_id, "acceptNodeIds": selected,
                "promoteEdgeIds": ready, "reviewEdgeIds": pending,
                "autoRewiredEdgeIds": []}

    def route(request):
        req = request.request
        path = urlsplit(req.url).path
        method = req.method

        def reply(body, status=200):
            request.fulfill(status=status, content_type="application/json",
                            body=json.dumps(body, ensure_ascii=False))

        if path == "/" and method == "GET":
            request.fulfill(status=200, content_type="text/html; charset=utf-8", body=HTML)
        elif path == "/api/health":
            reply({"ok": True, "requiresAuthorization": True,
                   "authenticated": True, "authMode": "sites-native"})
        elif path == "/api/projects" and method == "GET":
            reply({"projects": [{"id": PROJECT, "name": "Синтетическая история",
                                 "revision": db["revision"]}]})
        elif path == "/api/projects/" + PROJECT and method == "GET":
            reply({"id": PROJECT, "name": "Синтетическая история", "revision": db["revision"],
                   "graph": copy.deepcopy(db["graph"])})
        elif path == "/api/projects/" + PROJECT and method == "PUT":
            db["generic_writes"] += 1
            reply({"error": "GENERIC_PUT_NOT_ALLOWED"}, 422)
        elif path == "/api/projects/" + PROJECT + "/workflow/preview" and method == "POST":
            body = json.loads(req.post_data or "{}")
            assert body["command"]["kind"] == "accept_draft"
            if body["expectedRevision"] != db["revision"]:
                reply({"error": "REVISION_CONFLICT"}, 409)
                return
            db["previews"] += 1
            reply({"projectId": PROJECT, "expectedRevision": db["revision"],
                   "kind": "accept_draft", "preview": plan(body["command"])})
        elif path == "/api/projects/" + PROJECT + "/workflow/apply" and method == "POST":
            body = json.loads(req.post_data or "{}")
            command = body["command"]
            assert command["kind"] == "accept_draft"
            operation_id = body["operationId"]
            assert operation_id
            prior = db["receipts"].get(operation_id)
            if prior:
                reply({**prior, "replayed": True})
                return
            if db["force_conflict"]:
                db["force_conflict"] = False
                db["revision"] += 1
                db["graph"]["revision"] = db["revision"]
                reply({"error": "REVISION_CONFLICT", "message": "Конфликт ревизий"}, 409)
                return
            if body["expectedRevision"] != db["revision"]:
                reply({"error": "REVISION_CONFLICT"}, 409)
                return
            assert command["expectedPreview"] == plan(command), "Exact reviewed decision required"
            chosen = set(command["nodeIds"])
            for node in db["graph"]["nodes"]:
                if node["id"] in chosen:
                    assert node["workspaceId"] == command["workspaceId"]
                    node.pop("workspaceId")
                    node.pop("draftBranchId", None)
            for edge in db["graph"]["edges"]:
                if edge["id"] in command["expectedPreview"]["promoteEdgeIds"]:
                    edge.pop("workspaceId")
                    edge.pop("draftRelation")
                    edge.pop("draftBranchId", None)
            db["revision"] += 1
            db["graph"]["revision"] = db["revision"]
            db["applies"] += 1
            result = {"projectId": PROJECT, "revision": db["revision"],
                      "operationId": operation_id, "kind": "accept_draft", "replayed": False}
            db["receipts"][operation_id] = result
            reply(result)
        else:
            reply({"error": "NOT_FOUND"}, 404)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1365, "height": 920})
        context.route("https://plot.local/**", route)
        page = context.new_page()
        page.on("pageerror", lambda exception: errors.append(str(exception)))
        page.goto("https://plot.local/")
        page.wait_for_function(
            "() => window.__graphite && __graphite.getRemote().connected "
            "&& __graphite.getRemote().revision === 1 "
            "&& document.querySelectorAll('.cw-preview-card').length === 3"
        )

        # Canonical plot must not render draft nodes or suspended original.
        assert page.locator('[data-node="n1"]').count() == 1
        assert page.locator('[data-node="n3"]').count() == 1
        assert page.locator('[data-node="n2"]').count() == 0
        for node_id in ("a", "b", "c"):
            assert page.locator('[data-node="' + node_id + '"]').count() == 0
            assert page.locator('[data-cw-node="' + node_id + '"]').count() == 1
        assert page.locator('[data-edge="e1"]').count() == 0
        assert page.locator('[data-edge="e2"]').count() == 0
        assert page.locator('[data-edge="e3"]').count() == 1

        # Ordinary editor does not expose a write path until QA explicitly
        # enables the client test switch. This does NOT enable the Site server.
        assert page.get_by_role("button", name="В сюжет").count() == 0
        assert db["generic_writes"] == 0
        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        assert page.locator(".cw-accept-trigger").count() == 0

        page.locator('[data-cw-node="a"]').click()
        page.locator('[data-cw-workspace="w1"] .cw-draft-selection-actions button').first.click()
        page.locator(".cw-accept-review").wait_for()
        assert db["previews"] == 1
        assert "1 событие" in page.locator(".cw-accept-review").inner_text()
        assert db["applies"] == 0
        page.get_by_role("button", name="Принять в сюжет").click()
        page.wait_for_function(
            "() => __graphite.getRemote().revision === 2 "
            "&& document.querySelector('[data-node=\"a\"]') "
            "&& document.querySelector('[data-cw-node=\"b\"]')"
        )
        assert db["applies"] == 1
        assert db["generic_writes"] == 0
        assert page.locator('[data-edge="ea"]').count() == 0
        assert page.locator('[data-cw-node="a"]').count() == 0
        assert page.locator('[data-cw-node="c"]').count() == 1
        assert db["graph"]["nodes"][3].get("workspaceId") is None
        assert db["graph"]["nodes"][4]["workspaceId"] == "w1"

        # Accept the following node separately; the original internal link
        # becomes canonical only when both endpoints are approved.
        page.locator('[data-cw-node="b"]').click()
        page.locator('[data-cw-workspace="w1"] .cw-draft-selection-actions button').first.click()
        page.locator(".cw-accept-review").wait_for()
        assert "1" in page.locator(".cw-accept-review").inner_text()
        page.get_by_role("button", name="Принять в сюжет").click()
        page.wait_for_function(
            "() => __graphite.getRemote().revision === 3 "
            "&& document.querySelector('[data-edge=\"ea\"]') "
            "&& document.querySelector('[data-cw-node=\"c\"]')"
        )
        assert db["applies"] == 2
        assert db["generic_writes"] == 0

        # State is not merely local: reloading gives the same current canon.
        page.reload()
        page.wait_for_function(
            "() => window.__graphite && __graphite.getRemote().connected "
            "&& __graphite.getRemote().revision === 3 "
            "&& document.querySelector('[data-node=\"a\"]') "
            "&& document.querySelector('[data-node=\"b\"]')"
        )
        assert page.locator('[data-cw-node="c"]').count() == 1
        assert page.locator(".cw-accept-trigger").count() == 0
        assert page.locator('[data-node="n2"]').count() == 0
        assert page.locator('[data-edge="ea"]').count() == 1

        # A second operation from an outdated preview fails; no local
        # canonization, and no generic PUT fallback.
        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        page.locator('[data-cw-node="c"]').click()
        page.locator('[data-cw-workspace="w1"] .cw-draft-selection-actions button').first.click()
        page.locator(".cw-accept-review").wait_for()
        db["force_conflict"] = True
        page.get_by_role("button", name="Принять в сюжет").click()
        page.wait_for_function(
            "() => !document.querySelector('.cw-accept-review') "
            "&& document.querySelector('[data-cw-node=\"c\"]')"
        )
        assert page.locator('[data-node="c"]').count() == 0
        assert db["applies"] == 2
        assert db["generic_writes"] == 0
        assert not errors, errors

        context.close()
        browser.close()
    print(json.dumps({"result": "PASS", "accepted": 2, "remaining": 1,
                      "generic_puts": db["generic_writes"], "server_revisions": db["revision"],
                      "cases": ["persisted drafts", "protected originals", "review before apply",
                                "sequential edge promotion", "reload", "stale apply rejects"]},
                     ensure_ascii=False))

if __name__ == "__main__":
    main()
