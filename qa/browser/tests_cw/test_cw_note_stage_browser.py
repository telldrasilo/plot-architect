"""CW-013: note -> authored alternatives -> reviewed staging on one synthetic canvas.

The browser runs real Graphite HTML but gets synthetic prepared branches and a
strict mocked workflow API. It does not generate story content, deploy a Site,
touch D1, register MCP tools, or read any personal story.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HTML = (ROOT / "site/public/index.html").read_text(encoding="utf-8")
PROJECT_ID = "cw-stage-synthetic"
NOTE = "gn1"


def base_graph():
    return {
        "version": 1, "revision": 0, "view": None,
        "nodes": [
            {"id": "n1", "title": "Начало", "description": "Каноническая завязка",
             "x": 90, "y": 80, "parent": None},
            {"id": "n2", "title": "Выбор", "description": "Открытое решение",
             "x": 420, "y": 80, "parent": None},
            {"id": "n3", "title": "Следствие", "description": "Канонический результат",
             "x": 750, "y": 80, "parent": None},
        ],
        "edges": [
            {"id": "e1", "from": "n1", "to": "n2", "type": "precedes"},
            {"id": "e2", "from": "n2", "to": "n3", "type": "causes"},
        ],
        "fields": [], "lanes": [],
        "gapNotes": [
            {"id": NOTE, "title": "Заметка", "text": "Предложить несколько возможных путей",
             "x": 160, "y": 350, "parent": None, "offerVariants": True,
             "status": "pending"}
        ],
        "gapLinks": [
            {"id": "gl1", "from": {"kind": "gap_note", "id": NOTE},
             "to": {"kind": "plot_node", "id": "n2"}}
        ]
    }


def prepared_branches():
    branches = []
    for i, count in enumerate([1, 2, 3, 1]):
        code = "v" + str(i + 1)
        items = [{"id": code + "-n" + str(j + 1),
                  "title": "Вариант " + str(i + 1) + " · событие " + str(j + 1),
                  "description": "Это только предложение",
                  "x": 180 + 260*j, "y": 600 + 160*i}
                 for j in range(count)]
        links = [{"id": code + "-e" + str(j),
                  "from": code + "-n" + str(j),
                  "to": code + "-n" + str(j + 1),
                  "type": "precedes"} for j in range(1, count)]
        branches.append({"id": code, "title": "Подход " + str(i + 1),
                         "nodes": items, "edges": links})
    return {"workspaceId": "w1",
            "workspace": {"x": 110, "y": 545, "width": 1200, "height": 850},
            "branches": branches}


def preview_plan(graph, command):
    assert command["kind"] == "stage_note"
    assert command["noteId"] == NOTE
    assert command["workspaceId"] == "w1"
    assert command["branches"] == prepared_branches()["branches"]
    assert not graph.get("workspaces"), "The note may have only one staged workspace"
    note = next(n for n in graph["gapNotes"] if n["id"] == NOTE)
    assert note["status"] == "pending"
    nodes, edges, summaries = [], [], []
    for branch in command["branches"]:
        for item in branch["nodes"]:
            nodes.append({
                **item, "workspaceId": command["workspaceId"],
                "draftBranchId": branch["id"], "status": "proposed", "parent": None
            })
        for edge in branch["edges"]:
            edges.append({
                **edge, "workspaceId": command["workspaceId"],
                "draftBranchId": branch["id"], "draftRelation": "internal"
            })
        summaries.append({
            "id": branch["id"], "title": branch["title"],
            "nodeCount": len(branch["nodes"]), "edgeCount": len(branch["edges"])
        })
    return {
        "noteId": NOTE, "workspaceId": command["workspaceId"],
        "sourceNote": copy.deepcopy(note),
        "contextualLinks": copy.deepcopy(graph["gapLinks"]),
        "workspace": {"id": "w1", "taskId": NOTE, **command["workspace"]},
        "branchSummaries": summaries, "proposedNodes": nodes,
        "proposedEdges": edges, "replacesCanonicalNodeIds": [], "autoRewiredEdgeIds": []
    }


def main():
    original = base_graph()
    db = {"graph": copy.deepcopy(original), "revision": 0,
          "previews": 0, "applies": 0, "generic_puts": 0,
          "last_preview": None, "receipts": {}, "force_conflict": False,
          "listing_unavailable": False}
    errors = []

    def serve(route):
        request = route.request
        path = urlsplit(request.url).path
        method = request.method

        def reply(data, code=200):
            route.fulfill(status=code, content_type="application/json",
                          body=json.dumps(data, ensure_ascii=False))

        if path == "/" and method == "GET":
            route.fulfill(status=200, content_type="text/html; charset=utf-8", body=HTML)
        elif path == "/api/health":
            is_local = urlsplit(request.url).hostname == "127.0.0.1"
            reply({"ok": True, "authenticated": True,
                   "authMode": "node-loopback" if is_local else "sites-native",
                   "workflowEnabled": is_local})
        elif path == "/api/projects" and method == "GET":
            if db["listing_unavailable"]:
                reply({"error": "TEST_LISTING_UNAVAILABLE"}, 503)
            else:
                reply({"projects": [{"id": PROJECT_ID, "name": "Synthetic stage note",
                                     "revision": db["revision"]}]})
        elif path == "/api/projects/" + PROJECT_ID and method == "GET":
            reply({"id": PROJECT_ID, "name": "Synthetic stage note",
                   "revision": db["revision"], "graph": copy.deepcopy(db["graph"])})
        elif path == "/api/projects/" + PROJECT_ID and method == "PUT":
            db["generic_puts"] += 1
            reply({"error": "GENERIC_PUT_FORBIDDEN"}, 422)
        elif path == "/api/projects/" + PROJECT_ID + "/workflow/preview":
            assert method == "POST"
            body = json.loads(request.post_data or "{}")
            if body["expectedRevision"] != db["revision"]:
                reply({"error": "REVISION_CONFLICT"}, 409)
                return
            db["previews"] += 1
            try:
                plan = preview_plan(db["graph"], body["command"])
            except (AssertionError, StopIteration):
                reply({"error": "WORKSPACE_CONFLICT"}, 422)
                return
            db["last_preview"] = copy.deepcopy(plan)
            reply({"projectId": PROJECT_ID, "expectedRevision": db["revision"],
                   "kind": "stage_note", "preview": plan})
        elif path == "/api/projects/" + PROJECT_ID + "/workflow/apply":
            assert method == "POST"
            body = json.loads(request.post_data or "{}")
            command = body["command"]
            assert command["kind"] == "stage_note"
            operation_id = body["operationId"]
            assert isinstance(operation_id, str) and operation_id
            if operation_id in db["receipts"]:
                reply({**db["receipts"][operation_id], "replayed": True})
                return
            if db["force_conflict"]:
                db["force_conflict"] = False
                db["revision"] += 1
                db["graph"]["revision"] = db["revision"]
                reply({"error": "REVISION_CONFLICT"}, 409)
                return
            if body["expectedRevision"] != db["revision"]:
                reply({"error": "REVISION_CONFLICT"}, 409)
                return
            assert command["expectedPreview"] == preview_plan(db["graph"], command)
            plan = command["expectedPreview"]
            db["graph"]["workspaces"] = [copy.deepcopy(plan["workspace"])]
            db["graph"]["nodes"].extend(copy.deepcopy(plan["proposedNodes"]))
            db["graph"]["edges"].extend(copy.deepcopy(plan["proposedEdges"]))
            db["revision"] += 1
            db["graph"]["revision"] = db["revision"]
            db["applies"] += 1
            result = {"projectId": PROJECT_ID, "revision": db["revision"],
                      "operationId": operation_id, "kind": "stage_note",
                      "replayed": False}
            db["receipts"][operation_id] = result
            reply(result)
        else:
            reply({"error": "NOT_FOUND"}, 404)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1365, "height": 920})
        context.route("https://plot.local/**", serve)
        page = context.new_page()
        page.on("pageerror", lambda exception: errors.append(str(exception)))
        page.goto("https://plot.local/")
        page.wait_for_function(
            "() => window.__graphite && __graphite.getRemote().connected "
            "&& __graphite.getState().gapNotes?.some(n => n.id === 'gn1')"
        )

        # No production-facing fake generator or save action.
        page.locator('[data-gap-note="gn1"]').click()
        assert page.get_by_role("button", name="Разместить варианты").count() == 0
        assert db["previews"] == 0 and db["applies"] == 0
        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        page.evaluate("proposal => __graphite.setCWPreparedNoteAlternativesForTest('gn1',proposal)",
                      prepared_branches())
        assert page.get_by_role("button", name="Разместить варианты").count() == 1
        assert "Подготовлено 4 ветвей" in page.locator('[data-gap-note="gn1"]').inner_text()

        # Preview only: explicit cancellation cannot save anything.
        page.get_by_role("button", name="Разместить варианты").click()
        page.locator(".cw-note-stage-review").wait_for()
        assert db["previews"] == 1
        assert db["applies"] == 0
        assert page.locator(".cw-note-stage-review").inner_text().count("7 событий") == 1
        assert db["graph"] == original
        page.locator("#cw-stage-cancel").click()
        assert page.locator(".cw-note-stage-review").count() == 0
        assert db["applies"] == 0

        # Concurrent revision invalidates the reviewed command; no draft
        # should be staged or accepted, and no generic PUT may bypass CAS.
        page.get_by_role("button", name="Разместить варианты").click()
        page.locator(".cw-note-stage-review").wait_for()
        db["force_conflict"] = True
        page.locator("#cw-stage-confirm").click()
        page.wait_for_function("() => !document.querySelector('.cw-note-stage-review')")
        assert db["revision"] == 1
        assert db["applies"] == 0
        assert not db["graph"].get("workspaces")
        assert db["generic_puts"] == 0

        # Reload the authoritative graph, reattach the synthetic prepared
        # input and explicitly review again at the new revision.
        page.reload()
        page.wait_for_function(
            "() => window.__graphite && __graphite.getRemote().connected "
            "&& __graphite.getRemote().revision === 1"
        )
        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        page.locator('[data-gap-note="gn1"]').click()
        page.evaluate("proposal => __graphite.setCWPreparedNoteAlternativesForTest('gn1',proposal)",
                      prepared_branches())
        page.get_by_role("button", name="Разместить варианты").click()
        page.locator(".cw-note-stage-review").wait_for()
        assert db["applies"] == 0
        page.locator("#cw-stage-confirm").click()
        page.wait_for_function(
            "() => __graphite.getRemote().revision === 2 "
            "&& document.querySelectorAll('.cw-preview-card').length === 7"
        )
        assert db["applies"] == 1
        assert db["generic_puts"] == 0
        assert db["graph"]["nodes"][:3] == original["nodes"]
        assert db["graph"]["edges"][:2] == original["edges"]
        assert db["graph"]["gapNotes"] == original["gapNotes"]
        assert db["graph"]["gapLinks"] == original["gapLinks"]
        assert db["graph"]["workspaces"][0]["taskId"] == NOTE
        assert len([n for n in db["graph"]["nodes"] if "workspaceId" in n]) == 7
        assert page.locator(".cw-preview-link").count() == 3
        # A staged note is replaced visually, while the source task and
        # editorial context remain in the saved graph for provenance.
        assert page.locator('[data-gap-note="gn1"]').count() == 0
        assert page.locator('[data-gap-link="gl1"]').count() == 0
        assert page.evaluate("() => __graphite.getSelected()") is None
        assert page.locator('[data-node="v1-n1"]').count() == 0
        assert page.locator('[data-edge="e1"]').count() == 1
        assert page.locator('[data-edge="e2"]').count() == 1
        assert page.get_by_role("button", name="Разместить варианты").count() == 0

        # Reload gets the same saved drafts; test-only staging is not persisted.
        page.reload()
        page.wait_for_function(
            "() => window.__graphite && __graphite.getRemote().connected "
            "&& __graphite.getRemote().revision === 2 "
            "&& document.querySelectorAll('.cw-preview-card').length === 7"
        )
        assert page.locator(".cw-preview-area").count() == 1
        assert page.locator('[data-gap-note="gn1"]').count() == 0
        assert page.locator('[data-gap-link="gl1"]').count() == 0
        assert page.locator(".cw-accept-trigger").count() == 0
        assert page.locator('[data-node="v2-n1"]').count() == 0
        assert db["generic_puts"] == 0
        assert not errors, errors
        context.close()

        # The ordinary authenticated Node loopback advertises its workflow
        # feature. No QA switch is needed to interact with persisted drafts.
        local = browser.new_context(viewport={"width": 1365, "height": 920})
        local.route("http://127.0.0.1:8788/**", serve)
        local_page = local.new_page()
        local_page.on("pageerror", lambda exception: errors.append(str(exception)))
        local_page.goto("http://127.0.0.1:8788/")
        local_page.wait_for_function(
            "() => __graphite.getRemote().connected "
            "&& document.querySelectorAll('.cw-movable-draft').length === 7"
        )
        assert local_page.evaluate("() => __graphite.getCWWorkflowTestMode()") is False
        assert local_page.locator(".cw-movable-draft").count() == 7
        assert local_page.locator(".cw-draft-check").count() == 0
        assert local_page.locator('[data-gap-note="gn1"]').count() == 0
        local_page.locator(".cw-movable-draft").first.click()
        assert local_page.locator(".cw-draft-selection-actions").count() == 1
        assert db["applies"] == 1 and db["generic_puts"] == 0

        # Crash after a completed write may leave a stale browser marker.
        # If the copies are identical it must not block ordinary dragging.
        local_page.evaluate("""id => {
            localStorage.setItem('pa-site01-pending-' + id, '1');
        }""", PROJECT_ID)
        local_page.reload()
        local_page.wait_for_function(
            "() => __graphite.getRemote().connected && !__graphite.getRemote().blocked"
            "&& document.querySelectorAll('.cw-movable-draft').length === 7"
        )
        assert local_page.evaluate(
            "id => localStorage.getItem('pa-site01-pending-' + id)", PROJECT_ID
        ) is None

        # A genuinely different local draft must remain protected and
        # recoverable without silent overwriting of the browser copy.
        local_page.evaluate("""id => {
            const key = 'pa-site01-graph-' + id;
            const graph = JSON.parse(localStorage.getItem(key));
            graph.nodes.find(n => n.id === 'v1-n1').title = 'Unsynced local draft';
            localStorage.setItem(key, JSON.stringify(graph));
            localStorage.setItem('pa-site01-pending-' + id, '1');
        }""", PROJECT_ID)
        local_page.reload()
        local_page.wait_for_function(
            "() => __graphite.getRemote().connected && __graphite.getRemote().blocked"
            "&& __graphite.getState().nodes.find(n => n.id === 'v1-n1').title === 'Unsynced local draft'"
        )
        assert local_page.locator(".cw-movable-draft").count() == 7
        local_page.locator('[data-cw-node="v1-n1"]').click()
        assert "Запись заблокирована" in local_page.locator("#toast").inner_text()
        assert db["graph"]["nodes"][-7]["title"] != "Unsynced local draft"

        # User-initiated recovery downloads the complete local graph first.
        local_page.locator("#projects-open").click()
        assert local_page.locator("#pm-recover").is_visible()
        local_page.once("dialog", lambda dialog: dialog.accept())
        with local_page.expect_download() as downloaded:
            local_page.locator("#pm-recover").click()
        backup = json.loads(Path(downloaded.value.path()).read_text(encoding="utf-8"))
        assert any(n["title"] == "Unsynced local draft"
                   for n in backup["project"]["graph"]["nodes"])
        local_page.wait_for_function(
            "() => __graphite.getRemote().connected && !__graphite.getRemote().blocked"
            "&& __graphite.getState().nodes.find(n => n.id === 'v1-n1').title !== 'Unsynced local draft'"
        )
        assert local_page.evaluate(
            "id => localStorage.getItem('pa-site01-pending-' + id)", PROJECT_ID
        ) is None
        assert db["generic_puts"] == 0

        # Health success alone is not permission to edit without a project.
        db["listing_unavailable"] = True
        local_page.reload()
        local_page.wait_for_function(
            "() => window.__graphite && !__graphite.getRemote().connected"
            "&& document.querySelector('#saved').textContent.includes('Graphite Local не подключён')"
        )
        assert local_page.locator(".cw-movable-draft").count() == 0
        assert not errors, errors
        local.close()
        browser.close()

    print(json.dumps({
        "result": "PASS", "branches": 4, "draft_nodes": 7,
        "internal_edges": 3, "staging_writes": db["applies"],
        "generic_puts": db["generic_puts"],
        "cases": ["disabled by default", "prepared branches", "preview",
                  "cancel", "concurrent conflict", "explicit save",
                  "canonical isolation", "reload", "local workflow auto-activation",
                  "stale-marker reconciliation", "backup-first recovery",
                  "health without project listing is disconnected"]
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
