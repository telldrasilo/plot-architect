"""UX-RPL-GESTURE-01: exact author-facing preparation workflow in Chromium.

Synthetic owner-only REST seam; no real user data, Site, MCP, production D1
or external model. Backend transaction semantics are tested separately in
site/tests/creative-workflow-preparation.test.mjs with temporary SQLite.
"""
import copy
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HTML = (ROOT / "site/public/index.html").read_text(encoding="utf-8")
ORIGIN = "http://127.0.0.1:8788"
PROJECT = "rpl-gesture-synthetic"

def fixture():
    nodes = [
        {"id": key, "title": title, "description": title + " · описание",
         "x": x, "y": y, "parent": None, "lineIds": ["l1"], "size": "normal",
         **({"workspaceId": "w1"} if key in ("x", "y", "z") else {})}
        for key, title, x, y in [
            ("a", "Начало", 100, 80), ("b", "Старый поворот", 460, 80),
            ("c", "Последствие", 870, 80), ("x", "Новый поворот", 140, 370),
            ("y", "Развитие", 450, 370), ("z", "Оставшийся черновик", 780, 370)]
    ]
    return {
        "version": 1, "revision": 0, "view": None, "nextNode": 10,
        "nextEdge": 10, "nextField": 1, "nextLine": 2,
        "nodes": nodes,
        "edges": [
            {"id": "ab", "from": "a", "to": "b", "type": "precedes"},
            {"id": "bc", "from": "b", "to": "c", "type": "causes"},
            {"id": "xy", "from": "x", "to": "y", "type": "precedes",
             "workspaceId": "w1", "draftRelation": "internal"},
            {"id": "yz", "from": "y", "to": "z", "type": "enables",
             "workspaceId": "w1", "draftRelation": "internal"}
        ], "fields": [], "lanes": [
            {"id": "l1", "title": "Основная", "color": "#b8a16e", "y": 100}],
        "workspaces": [
            {"id": "w1", "x": 50, "y": 330, "width": 1040, "height": 270,
             "taskId": "some-existing-task"}],
        "replacementPreparations": []
    }

def main():
    original = fixture()
    db = {"graph": copy.deepcopy(original), "revision": 0,
          "previews": [], "applies": [], "generic": 0, "receipts": {}}
    errors = []

    def generate_preview(cmd):
        kind = cmd["kind"]
        g = db["graph"]
        if kind == "create_preparation":
            assert cmd["sourceNodeId"] == "b"
            source = next(n for n in g["nodes"] if n["id"] == "b")
            incident = [e for e in g["edges"] if "b" in (e["from"], e["to"])]
            return {"sourceNodeId": "b", "sourceNode": copy.deepcopy(source),
                    "incidentEdges": copy.deepcopy(incident),
                    "affectedDraftEdgeIds": [], "canonicalChanged": False}
        p = g["replacementPreparations"][0]
        assert p["id"] == cmd["preparationId"] and p["state"] == "open"
        if kind == "set_preparation_candidates":
            old = p["candidateSelections"]
            new = cmd["candidates"]
            assert all(c["workspaceId"] == "w1" for c in new)
            return {"preparationId": p["id"],
                    "previousCandidates": copy.deepcopy(old),
                    "candidates": copy.deepcopy(new),
                    "addedNodeIds": [c["nodeId"] for c in new if c not in old],
                    "removedNodeIds": [c["nodeId"] for c in old if c not in new],
                    "canonicalChanged": False}
        if kind == "set_preparation_decisions":
            old = p["edgeDecisions"]
            return {"preparationId": p["id"], "previousDecisions": copy.deepcopy(old),
                    "decisions": copy.deepcopy(cmd["decisions"]),
                    "unresolvedOldEdgeIds": [e["id"] for e in p["incidentEdges"]
                      if not any(d["edgeId"] == e["id"] for d in cmd["decisions"])],
                    "canonicalChanged": False}
        if kind == "apply_preparation":
            choices = [c["nodeId"] for c in p["candidateSelections"]]
            assert choices == ["x", "y"]
            decisions = p["edgeDecisions"]
            assert {d["edgeId"] for d in decisions} == {"ab", "bc"}
            rewired = [d["newEdge"] for d in decisions if d["decision"] == "rewire"]
            assert len(rewired) == 1 and rewired[0]["from"] == "a" and rewired[0]["to"] == "x"
            assert any(d["edgeId"] == "bc" and d["decision"] == "drop" for d in decisions)
            return {"preparationId": p["id"], "sourceNodeId": "b",
                    "acceptedNodeIds": choices, "promoteEdgeIds": ["xy"],
                    "editorialBoundaryEdgeIds": ["yz"],
                    "originalEdgeIds": ["ab", "bc"], "droppedEdgeIds": ["bc"],
                    "rewiredEdges": copy.deepcopy(rewired),
                    "removedWorkspaceIds": [], "retainedDraftIds": ["z"],
                    "canonicalChanged": True}
        if kind == "cancel_preparation":
            return {"preparationId": p["id"], "sourceNodeId": "b",
                    "candidateNodeIds": [c["nodeId"] for c in p["candidateSelections"]],
                    "canonicalChanged": False, "retainsDrafts": True}
        raise AssertionError(kind)

    def apply(cmd, plan):
        graph = db["graph"]
        kind = cmd["kind"]
        if kind == "create_preparation":
            graph["replacementPreparations"].append({
                "id": cmd["preparationId"], "state": "open", "sourceNodeId": "b",
                "sourceRevision": db["revision"], "sourceSnapshot": plan["sourceNode"],
                "incidentEdges": plan["incidentEdges"], "candidateSelections": [],
                "edgeDecisions": []})
        else:
            prep = graph["replacementPreparations"][0]
            if kind == "set_preparation_candidates":
                prep["candidateSelections"] = copy.deepcopy(cmd["candidates"])
            elif kind == "set_preparation_decisions":
                prep["edgeDecisions"] = copy.deepcopy(cmd["decisions"])
            elif kind == "apply_preparation":
                prep["state"] = "applied"
                for node in graph["nodes"]:
                    if node["id"] in ("x", "y"):
                        node.pop("workspaceId", None)
                for edge in graph["edges"]:
                    if edge["id"] == "xy":
                        edge.pop("workspaceId", None)
                        edge.pop("draftRelation", None)
                    if edge["id"] == "yz":
                        edge["draftRelation"] = "boundary-proposal"
                graph["edges"].extend(copy.deepcopy(plan["rewiredEdges"]))
            elif kind == "cancel_preparation":
                prep["state"] = "cancelled"
            else:
                raise AssertionError(kind)

    def serve(route):
        req = route.request
        path = urlsplit(req.url).path
        def answer(payload, status=200):
            route.fulfill(status=status, content_type="application/json",
                          body=json.dumps(payload, ensure_ascii=False))
        if path == "/" and req.method == "GET":
            route.fulfill(status=200, content_type="text/html; charset=utf-8", body=HTML)
        elif path == "/api/health":
            answer({"ok": True, "authenticated": True, "authMode": "node-loopback",
                    "workflowEnabled": True})
        elif path == "/api/projects" and req.method == "GET":
            answer({"projects": [{"id": PROJECT, "name": "RPL synthetic",
                                  "revision": db["revision"]}]})
        elif path == "/api/projects/" + PROJECT and req.method == "GET":
            answer({"id": PROJECT, "name": "RPL synthetic",
                    "revision": db["revision"], "graph": copy.deepcopy(db["graph"])})
        elif path == "/api/projects/" + PROJECT and req.method == "PUT":
            # No generic write may mutate the protected preparation.
            payload = json.loads(req.post_data or "{}")
            assert not payload["graph"].get("replacementPreparations")
            db["generic"] += 1
            answer({"id": PROJECT, "revision": db["revision"]})
        elif path in ("/api/projects/" + PROJECT + "/workflow/preview",
                      "/api/projects/" + PROJECT + "/workflow/apply"):
            body = json.loads(req.post_data or "{}")
            command = body["command"]
            assert body["expectedRevision"] == db["revision"], body
            if path.endswith("/preview"):
                assert "expectedPreview" not in command
                plan = generate_preview(command)
                db["previews"].append({"kind": command["kind"], "plan": copy.deepcopy(plan)})
                answer({"projectId": PROJECT, "expectedRevision": db["revision"],
                        "kind": command["kind"], "preview": plan})
            else:
                op = body["operationId"]
                assert op and op not in db["receipts"], "duplicate write"
                assert command["expectedPreview"] == db["previews"][-1]["plan"]
                apply(command, command["expectedPreview"])
                db["revision"] += 1
                db["graph"]["revision"] = db["revision"]
                receipt = {"projectId": PROJECT, "operationId": op,
                           "kind": command["kind"], "revision": db["revision"],
                           "replayed": False}
                db["receipts"][op] = receipt
                db["applies"].append(command["kind"])
                answer(receipt)
        else:
            answer({"error": "NOT_FOUND"}, 404)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True,
                                    **({"executable_path": os.environ["CHROMIUM_BIN"]}
                                       if os.getenv("CHROMIUM_BIN") else {}),
                                    args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1450, "height": 1050})
        context.route(ORIGIN + "/**", serve)
        page = context.new_page()
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.goto(ORIGIN + "/")
        page.wait_for_function(
            "()=>window.__graphite&&__graphite.getRemote().connected"
            "&&document.querySelector('[data-node=b]')")
        assert page.locator('[data-edge="ab"]').count() == 1
        assert page.locator('[data-edge="bc"]').count() == 1
        page.locator('[data-node="b"]').click()
        page.locator("#i-prepare-replacement").click()
        review = page.locator("#cw-prep-review")
        page.wait_for_function(
            "()=>__graphite.getState().replacementPreparations?.[0]?.state==='open'"
            "&&!__graphite.getRemote().busy&&!__graphite.getRemote().dirty")
        assert db["applies"] == ["create_preparation"]
        assert db["previews"][0]["plan"]["canonicalChanged"] is False
        assert review.count() == 0  # no preliminary modal for staging
        assert page.locator('[data-node="b"]').count() == 1
        assert page.locator('[data-edge="ab"]').count() == 1
        assert page.locator('[data-edge="bc"]').count() == 1
        assert page.locator("#inspector").locator("#cw-prep-pick").count() == 1
        # Cancelling an existing plan still deserves explicit confirmation.
        page.locator("#cw-prep-cancel").click()
        review.wait_for()
        assert "Исходник и черновики сохранятся" in review.inner_text()
        page.keyboard.press("Escape")
        assert review.count() == 0
        assert db["applies"] == ["create_preparation"]

        page.locator("#cw-prep-pick").click()
        dialog = page.locator("#cw-prep-candidate-form")
        dialog.wait_for()
        dialog.locator('[data-prep-candidate="x"]').check()
        dialog.locator('[data-prep-candidate="y"]').check()
        dialog.locator("button[type=submit]").click()
        page.wait_for_function(
            "()=>__graphite.getState().replacementPreparations[0].candidateSelections.length===2"
            "&&!__graphite.getRemote().busy")
        assert review.count() == 0
        assert page.locator('[data-node="b"]').count() == 1

        relations = page.locator("#inspector")
        assert relations.locator("[data-prep-old-edge]").count() == 2
        assert page.locator('[data-prep-edge="ab"]').count() == 1
        assert page.locator('[data-prep-edge="bc"]').count() == 1
        assert page.locator('[data-canon-edge-port="bc"]').get_attribute("title") == (
            "Перетащите от исходного события к выбранному черновику")

        def center(locator):
            rect = locator.bounding_box()
            assert rect, "socket or draft must be visible"
            return rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] / 2

        def drag_prepared_arrow(old_edge, draft_id, cancel=False):
            x0, y0 = center(page.locator(f'[data-prep-edge="{old_edge}"]'))
            x1, y1 = center(page.locator(f'[data-cw-node="{draft_id}"]'))
            page.mouse.move(x0, y0)
            page.mouse.down()
            page.mouse.move(x1, y1, steps=12)
            if cancel:
                assert page.locator("#cw-link-overlay").get_attribute("data-preparation") == "true"
                page.keyboard.press("Escape")
            page.mouse.up()

        # Unselected draft and Esc are cancellations, never graph writes.
        drag_prepared_arrow("ab", "z")
        assert page.locator(".cw-prep-type-popover").count() == 0
        drag_prepared_arrow("ab", "x", cancel=True)
        assert page.locator(".cw-prep-type-popover").count() == 0
        assert db["graph"]["replacementPreparations"][0]["edgeDecisions"] == []
        assert db["applies"] == ["create_preparation", "set_preparation_candidates"]

        # Incoming A→B: move B's target socket to selected X, then explicitly
        # choose semantics (the old type is offered, never silently inherited).
        drag_prepared_arrow("ab", "x")
        popup = page.locator(".cw-prep-type-popover")
        popup.wait_for()
        assert "Начало → Новый поворот" in popup.inner_text()
        assert popup.locator('[data-prep-type-choice="precedes"]').inner_text() == "Сохранить: Следом"
        assert db["graph"]["replacementPreparations"][0]["edgeDecisions"] == []
        popup.locator('[data-prep-type-choice="precedes"]').click()
        page.wait_for_function(
            "()=>__graphite.getState().replacementPreparations[0].edgeDecisions.length===1"
            "&&!__graphite.getRemote().busy")
        first_decision = db["graph"]["replacementPreparations"][0]["edgeDecisions"][0]
        assert first_decision["edgeId"] == "ab"
        assert first_decision["newEdge"]["from"] == "a"
        assert first_decision["newEdge"]["to"] == "x"
        assert first_decision["newEdge"]["type"] == "precedes"
        assert page.locator('[data-edge="ab"]').count() == 1

        # A transient inspector edit must not be silently overwritten by drag.
        second = relations.locator('[data-prep-old-edge="bc"]')
        second.locator('[data-prep-mode]').select_option("drop")
        drag_prepared_arrow("bc", "y")
        assert page.locator(".cw-prep-type-popover").count() == 0
        assert len(db["graph"]["replacementPreparations"][0]["edgeDecisions"]) == 1
        second.locator('[data-prep-mode]').select_option("later")

        # Outgoing B→C: moving B's source socket to selected Y must preserve
        # the earlier AB decision and allow an independent type choice.
        drag_prepared_arrow("bc", "y")
        popup.wait_for()
        assert "Развитие → Последствие" in popup.inner_text()
        popup.locator('[data-prep-type-choice="hinders"]').click()
        page.wait_for_function(
            "()=>__graphite.getState().replacementPreparations[0].edgeDecisions.length===2"
            "&&!__graphite.getRemote().busy")
        staged = db["graph"]["replacementPreparations"][0]["edgeDecisions"]
        assert {d["edgeId"] for d in staged} == {"ab", "bc"}
        outgoing = next(d for d in staged if d["edgeId"] == "bc")
        assert (outgoing["newEdge"]["from"], outgoing["newEdge"]["to"],
                outgoing["newEdge"]["type"]) == ("y", "c", "hinders")
        assert page.locator('[data-edge="bc"]').count() == 1
        assert all(not preview["plan"]["canonicalChanged"]
                   for preview in db["previews"])

        # The inspector remains a complete accessible fallback; switching BC
        # to drop must retain the existing AB plan.
        first = relations.locator('[data-prep-old-edge="ab"]')
        second = relations.locator('[data-prep-old-edge="bc"]')
        assert first.locator('[data-prep-mode]').input_value() == "rewire"
        assert first.locator('[data-prep-target-node]').input_value() == "x"
        assert first.locator('[data-prep-target-type]').input_value() == "precedes"
        second.locator('[data-prep-mode]').select_option("drop")
        relations.locator("#cw-prep-save-decisions").click()
        page.wait_for_function(
            "()=>__graphite.getState().replacementPreparations[0].edgeDecisions.some("
            "d=>d.edgeId==='bc'&&d.decision==='drop')"
            "&&!__graphite.getRemote().busy")
        assert review.count() == 0
        assert page.locator('[data-edge="bc"]').count() == 1
        assert db["applies"] == [
            "create_preparation", "set_preparation_candidates",
            "set_preparation_decisions", "set_preparation_decisions",
            "set_preparation_decisions"
        ]

        relations.locator("#cw-prep-apply").click()
        review.wait_for()
        assert "Принять 2 событий" in review.inner_text()
        assert "Сейчас" in review.inner_text()
        assert "После" in review.inner_text()
        assert "Начало → Старый поворот" in review.inner_text()
        assert "Начало → Новый поворот" in review.inner_text()
        assert "Старый поворот → Последствие" in review.inner_text()
        assert page.locator('[data-node="b"]').count() == 1
        page.locator("#cw-prep-confirm").click()
        page.wait_for_function(
            "()=>__graphite.getState().replacementPreparations[0].state==='applied'"
            "&&!__graphite.getRemote().busy&&!__graphite.getRemote().dirty")
        assert db["applies"][-1] == "apply_preparation"
        assert page.locator('[data-node="b"]').count() == 0
        assert page.locator('[data-node="x"]').count() == 1
        assert page.locator('[data-node="y"]').count() == 1
        assert page.locator('[data-edge="ab"]').count() == 0
        assert page.locator('[data-edge="bc"]').count() == 0
        new_edge = next(e for e in db["graph"]["edges"] if e["from"]=="a" and e["to"]=="x")
        assert new_edge["type"] == "precedes"
        assert any(n["id"] == "b" for n in db["graph"]["nodes"])
        assert any(e["id"] == "ab" for e in db["graph"]["edges"])
        assert next(n for n in db["graph"]["nodes"] if n["id"] == "z")["workspaceId"] == "w1"
        assert next(e for e in db["graph"]["edges"] if e["id"] == "yz")["draftRelation"] == "boundary-proposal"
        page.reload()
        page.wait_for_function(
            "()=>__graphite&&__graphite.getRemote().connected"
            "&&__graphite.getState().replacementPreparations?.[0]?.state==='applied'")
        assert page.locator('[data-node="b"]').count() == 0
        assert page.locator('[data-node="x"]').count() == 1
        assert page.locator('[data-edge="ab"]').count() == 0
        # Applied original is discoverable for read-only audit after reload.
        page.locator("#tools-more").click()
        page.locator("#cw-replacement-history").click()
        history = page.locator("#cw-replacement-history-dialog")
        history.wait_for()
        assert "Старый поворот" in history.inner_text()
        assert "Применена" in history.inner_text()
        history.locator('[data-cw-prep-history-id]').click()
        inspector = page.locator("#inspector")
        assert "Применено" in inspector.inner_text()
        assert "Переподключено" in inspector.inner_text()
        assert "Не использовать" in inspector.inner_text()
        assert page.locator('[data-edge="bc"]').count() == 0
        assert db["generic"] == 0
        assert not errors, errors
        context.close()
        browser.close()
    print(json.dumps({"result": "PASS", "operations": db["applies"],
                      "checks": ["canon unchanged before apply", "no redundant staging confirmations",
                                 "Esc cancellation of existing plan",
                                 "explicit candidates", "both B-side socket directions",
                                 "type choice", "unselected/Esc cancellation",
                                 "inspector fallback", "old edge decisions",
                                 "atomic apply", "historical originals",
                                 "unselected draft boundary", "reload"]},
                     ensure_ascii=False))

if __name__ == "__main__":
    main()
