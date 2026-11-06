"""CW-055-D: cross-boundary editorial relations remain visible and selectable.

Synthetic Graphite canvas with A already canonical and B/C still in draft.
No live Site/D1/MCP or user stories are accessed.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from test_cw_persisted_workspace_accept_browser import story

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
ORIGIN="http://127.0.0.1:8788"
PROJECT="cw055-boundary-qa"

def main():
    graph=story()
    a=next(n for n in graph["nodes"] if n["id"]=="a")
    a.pop("workspaceId")
    a.pop("draftBranchId",None)
    graph["edges"].append({
        "id":"proposal-n3-c","from":"n3","to":"c","type":"enables",
        "workspaceId":"w1","draftRelation":"boundary-proposal"
    })
    graph["edges"].append({
        "id":"proposal-n1-a","from":"n1","to":"a","type":"hinders",
        "workspaceId":"w1","draftRelation":"boundary-proposal"
    })
    db={"graph":copy.deepcopy(graph),"revision":1,"previews":0,"applies":0,"generic":0}
    errors=[]
    def route(intercept):
        req=intercept.request
        path=urlsplit(req.url).path
        def answer(content,status=200):
            intercept.fulfill(status=status,content_type="application/json",
                              body=json.dumps(content,ensure_ascii=False))
        if path=="/" and req.method=="GET":
            intercept.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
        elif path=="/api/health":
            answer({"ok":True,"authenticated":True,"authMode":"node-loopback",
                    "workflowEnabled":True})
        elif path=="/api/projects" and req.method=="GET":
            answer({"projects":[{"id":PROJECT,"name":"Boundary QA","revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and req.method=="GET":
            answer({"id":PROJECT,"name":"Boundary QA","revision":db["revision"],
                    "graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and req.method=="PUT":
            db["generic"]+=1
            answer({"error":"PROTECTED_EDGE_CHANGED"},422)
        elif path=="/api/projects/"+PROJECT+"/workflow/preview" and req.method=="POST":
            payload=json.loads(req.post_data or "{}")
            assert payload["expectedRevision"]==db["revision"]
            command=payload["command"]
            assert command["workspaceId"]=="w1"
            db["previews"]+=1
            if command["kind"]=="accept_draft":
                assert command["nodeIds"]==["b"],command
                answer({"kind":"accept_draft","projectId":PROJECT,"expectedRevision":1,
                        "preview":{"workspaceId":"w1","acceptNodeIds":["b"],
                        "promoteEdgeIds":["ea"],"reviewEdgeIds":[],
                        "autoRewiredEdgeIds":[]}})
            else:
                assert command["kind"]=="drop_boundary_relation",command
                edge=next(e for e in db["graph"]["edges"] if e["id"]==command["edgeId"])
                assert edge["workspaceId"]=="w1"
                nodes={n["id"]:n for n in db["graph"]["nodes"]}
                plan={"workspaceId":"w1","edgeId":edge["id"],
                    "relation":{"id":edge["id"],"from":edge["from"],"to":edge["to"],
                    "type":edge["type"],"draftRelation":edge["draftRelation"],
                    "fromTitle":nodes[edge["from"]]["title"],
                    "toTitle":nodes[edge["to"]]["title"]},
                    "autoRewiredEdgeIds":[]}
                answer({"kind":"drop_boundary_relation","projectId":PROJECT,
                        "expectedRevision":db["revision"],"preview":plan})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply":
            payload=json.loads(req.post_data or "{}")
            command=payload["command"]
            assert command["kind"]=="drop_boundary_relation",command
            assert payload["expectedRevision"]==db["revision"]
            edge=next(e for e in db["graph"]["edges"] if e["id"]==command["edgeId"])
            nodes={n["id"]:n for n in db["graph"]["nodes"]}
            assert command["expectedPreview"]["relation"]=={
                "id":edge["id"],"from":edge["from"],"to":edge["to"],
                "type":edge["type"],"draftRelation":edge["draftRelation"],
                "fromTitle":nodes[edge["from"]]["title"],
                "toTitle":nodes[edge["to"]]["title"]}
            db["graph"]["edges"]=[e for e in db["graph"]["edges"]
                                  if e["id"]!=edge["id"]]
            db["revision"]+=1
            db["graph"]["revision"]=db["revision"]
            db["applies"]+=1
            answer({"kind":"drop_boundary_relation","projectId":PROJECT,
                    "revision":db["revision"],"operationId":payload["operationId"],
                    "replayed":False})
        else:
            answer({"error":"NOT_FOUND"},404)

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1440,"height":980})
        context.route(ORIGIN+"/**",route)
        page=context.new_page()
        page.on("pageerror",lambda ex:errors.append(str(ex)))
        page.goto(ORIGIN+"/")
        page.wait_for_function(
            "()=>window.__graphite&&__graphite.getRemote().connected"
            "&&document.querySelector('[data-cw-boundary-edge=ea]')")
        page.evaluate("()=>__graphite.fit()")
        assert page.locator('[data-node="a"]').count()==1
        assert page.locator('[data-cw-node="b"]').count()==1
        assert page.locator('[data-edge="ea"]').count()==0
        assert page.locator('[data-edge="proposal-n3-c"]').count()==0
        assert page.locator('[data-cw-edge="ea"]').count()==0
        for key in ["ea","proposal-n3-c","proposal-n1-a"]:
            line=page.locator(f'[data-cw-boundary-edge="{key}"]')
            assert line.count()==1
            assert line.get_attribute("d").startswith("M ")
            assert page.locator(f'[data-cw-boundary-hit="{key}"]').count()==1
            assert page.locator(f'[data-cw-boundary-direction="{key}"]').count()==1
        assert page.locator('[data-cw-boundary-edge="ea"]').evaluate(
            "el=>getComputedStyle(el).strokeDasharray")!="none"
        assert db["previews"]==0 and db["applies"]==0 and db["generic"]==0

        # Keyboard accessible selection opens an editorial review panel, never
        # the canonical edge editing toolbar.
        hit=page.locator('[data-cw-boundary-hit="ea"]')
        hit.focus()
        hit.press("Enter")
        panel=page.locator('[data-cw-boundary-details="ea"]')
        panel.wait_for()
        text=panel.inner_text()
        assert "Не в сюжете" in text and "Новая завязка" in text and "Развилка" in text
        assert "Следом" in text
        assert page.locator('[data-cw-edge-toolbar="draft:ea"]').count()==0
        assert db["previews"]==0
        # Explicit action only begins the existing guarded acceptance review.
        panel.get_by_role("button",name="В сюжет: Развилка").click()
        page.locator(".cw-accept-review").wait_for()
        assert db["previews"]==1 and db["applies"]==0
        assert page.locator('[data-edge="ea"]').count()==0
        page.get_by_role("button",name="Отмена").last.click()
        assert db["applies"]==0

        # Canon-to-canon proposal is still editorial and inspectable.
        hit=page.locator('[data-cw-boundary-hit="proposal-n1-a"]')
        hit.focus();hit.press("Enter")
        panel=page.locator('[data-cw-boundary-details="proposal-n1-a"]')
        panel.wait_for()
        assert "Препятствует" in panel.inner_text()
        assert panel.get_by_role("button",name="В сюжет").count()==0
        # First review and cancel: no changes to plot or workspace.
        panel.get_by_role("button",name="Не использовать связь").click()
        panel=page.locator('[data-cw-boundary-details="proposal-n1-a"]')
        panel.get_by_role("button",name="Подтвердить отказ").wait_for(timeout=6000)
        assert db["applies"]==0
        panel.get_by_role("button",name="Отмена").click()
        assert db["applies"]==0
        assert page.locator('[data-cw-boundary-edge="proposal-n1-a"]').count()==1
        page.locator('[data-cw-boundary-hit="proposal-n1-a"]').focus()
        page.locator('[data-cw-boundary-hit="proposal-n1-a"]').press("Enter")
        panel=page.locator('[data-cw-boundary-details="proposal-n1-a"]')
        panel.get_by_role("button",name="Не использовать связь").click()
        panel.get_by_role("button",name="Подтвердить отказ").click()
        page.wait_for_function("()=>__graphite.getRemote().revision===2")
        assert db["applies"]==1 and db["generic"]==0
        assert page.locator('[data-cw-boundary-edge="proposal-n1-a"]').count()==0
        assert next(e for e in db["graph"]["edges"] if e["id"]=="e3")==next(
            e for e in graph["edges"] if e["id"]=="e3")
        assert all(n==m for n,m in zip(db["graph"]["nodes"],graph["nodes"]))
        # A proposal from canon to C can be selected independently.
        page.locator('[data-cw-boundary-hit="proposal-n3-c"]').focus()
        page.locator('[data-cw-boundary-hit="proposal-n3-c"]').press("Enter")
        assert "Другая версия" in page.locator(
            '[data-cw-boundary-details="proposal-n3-c"]').inner_text()
        page.reload()
        page.wait_for_function(
            "()=>window.__graphite&&__graphite.getRemote().connected"
            "&&document.querySelectorAll('[data-cw-boundary-edge]').length===2")
        assert page.locator('[data-edge="ea"]').count()==0
        assert page.locator('[data-cw-boundary-edge="ea"]').count()==1
        assert [e["id"] for e in db["graph"]["edges"]]==[
            e["id"] for e in graph["edges"] if e["id"]!="proposal-n1-a"]
        assert db["applies"]==1 and db["generic"]==0
        assert not errors,errors
        context.close();browser.close()
    print(json.dumps({"result":"PASS","scenarios":["partial-acceptance cross-boundary",
      "directed muted line","keyboard details","guarded next acceptance",
      "canon-to-canon proposal remains editorial","no generic PUT","reload"]},
      ensure_ascii=False))

if __name__=="__main__":
    main()
