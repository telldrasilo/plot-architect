"""CW-055: edit persisted draft text through reviewed CAS, without ordinary PUT.
Synthetic Graphite HTML/REST only: no Site, live MCP, D1 or user project.
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
PROJECT="cw055-draft-text-qa"

def main():
    graph=story()
    # One coherent chain is one solution regardless of node count.
    for node in graph["nodes"]:
        if node.get("workspaceId")=="w1":
            node["draftBranchId"]="single"
    for edge in graph["edges"]:
        if edge.get("workspaceId")=="w1":
            edge["draftBranchId"]="single"
    db={"graph":graph,"revision":1,"preview":0,"apply":0,"put":0,
        "force_conflict":False,"receipts":{}}
    errors=[]
    original=copy.deepcopy(graph)
    def plan(command):
        assert set(command)=={"kind","workspaceId","nodeId","title","description"}
        assert command["kind"]=="edit_draft_text"
        assert command["workspaceId"]=="w1"
        node=next(n for n in db["graph"]["nodes"] if n["id"]==command["nodeId"])
        assert node["workspaceId"]=="w1"
        title=command["title"]
        description=command["description"]
        assert isinstance(title,str) and 0<len(title)<=300 and title==title.strip()
        assert isinstance(description,str) and len(description)<=20000
        before={"title":node["title"],"description":node.get("description","")}
        after={"title":title,"description":description}
        assert before!=after
        return {"workspaceId":"w1","nodeId":node["id"],"before":before,
                "after":after,"autoRewiredEdgeIds":[]}
    def route(intercept):
        req=intercept.request
        path=urlsplit(req.url).path
        method=req.method
        def reply(payload,status=200):
            intercept.fulfill(status=status,content_type="application/json",
                              body=json.dumps(payload,ensure_ascii=False))
        if path=="/" and method=="GET":
            intercept.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
        elif path=="/api/health":
            reply({"ok":True,"authenticated":True,"authMode":"node-loopback",
                   "workflowEnabled":True})
        elif path=="/api/projects" and method=="GET":
            reply({"projects":[{"id":PROJECT,"name":"Draft Text QA","revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and method=="GET":
            reply({"id":PROJECT,"name":"Draft Text QA","revision":db["revision"],
                   "graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and method=="PUT":
            db["put"]+=1
            reply({"error":"PROTECTED_NODE_CHANGED"},422)
        elif path=="/api/projects/"+PROJECT+"/workflow/preview":
            payload=json.loads(req.post_data or "{}")
            if payload["expectedRevision"]!=db["revision"]:
                reply({"error":"REVISION_CONFLICT","message":"Stale project"},409)
                return
            try:
                p=plan(payload["command"])
            except (AssertionError,KeyError,StopIteration):
                reply({"error":"DRAFT_TEXT_INVALID"},422)
                return
            db["preview"]+=1
            reply({"kind":"edit_draft_text","projectId":PROJECT,
                   "expectedRevision":db["revision"],"preview":p})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply":
            payload=json.loads(req.post_data or "{}")
            op=payload["operationId"]
            assert op
            if op in db["receipts"]:
                reply({**db["receipts"][op],"replayed":True})
                return
            if db["force_conflict"] or payload["expectedRevision"]!=db["revision"]:
                db["force_conflict"]=False
                db["revision"]+=1
                db["graph"]["revision"]=db["revision"]
                reply({"error":"REVISION_CONFLICT","message":"Stale draft"},409)
                return
            command=payload["command"]
            expected=command["expectedPreview"]
            clean={k:v for k,v in command.items() if k!="expectedPreview"}
            assert expected==plan(clean)
            node=next(n for n in db["graph"]["nodes"] if n["id"]==command["nodeId"])
            node["title"]=command["title"]
            node["description"]=command["description"]
            db["revision"]+=1
            db["graph"]["revision"]=db["revision"]
            db["apply"]+=1
            result={"projectId":PROJECT,"revision":db["revision"],"operationId":op,
                    "kind":"edit_draft_text","replayed":False}
            db["receipts"][op]=result
            reply(result)
        else:
            reply({"error":"NOT_FOUND"},404)

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1440,"height":920})
        context.route(ORIGIN+"/**",route)
        page=context.new_page()
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(ORIGIN+"/")
        page.wait_for_function(
            "() => window.__graphite && __graphite.getRemote().connected"
            " && document.querySelectorAll('.cw-preview-card').length===3")
        page.evaluate("()=>__graphite.fit()")
        labels=page.locator(".cw-preview-kind").all_inner_texts()
        assert len(labels)==3 and all(x=="Черновик" for x in labels),labels
        assert db["apply"]==0 and db["put"]==0
        card=page.locator('[data-cw-node="a"]')
        card.hover()
        page.locator('[data-cw-edit-draft="a"]').click()
        panel=page.locator('[data-cw-draft-editor="a"]')
        assert panel.count()==1
        assert panel.locator("input").input_value()=="Новая завязка"
        assert panel.locator("textarea").input_value()=="Черновик А"
        panel.locator("input").fill("Промежуточное название")
        panel.locator("textarea").fill("Отмена не меняет граф")
        panel.get_by_role("button",name="Отмена").click()
        assert page.locator("[data-cw-draft-editor]").count()==0
        assert db["preview"]==0 and db["apply"]==0
        assert db["graph"]==original

        card.hover()
        page.locator('[data-cw-edit-draft="a"]').click()
        panel=page.locator('[data-cw-draft-editor="a"]')
        title="Новая глава с поворотом"
        description="<img src=x onerror=alert(1)> — просто описание"
        panel.locator("input").fill(title)
        panel.locator("textarea").fill(description)
        assert db["apply"]==0
        panel.get_by_role("button",name="Сохранить").click()
        page.wait_for_function(
            "() => __graphite.getRemote().revision===2"
            " && __graphite.getState().nodes.find(n=>n.id==='a').title==='Новая глава с поворотом'")
        assert db["preview"]==1 and db["apply"]==1 and db["put"]==0
        assert next(n for n in db["graph"]["nodes"] if n["id"]=="a")["description"]==description
        assert db["graph"]["edges"]==original["edges"]
        assert db["graph"]["replacements"]==original["replacements"]
        assert next(n for n in db["graph"]["nodes"] if n["id"]=="n1")==original["nodes"][0]
        assert page.locator('[data-cw-node="a"] p').inner_text()==description
        assert page.locator('[data-cw-node="a"] img').count()==0
        page.reload()
        page.wait_for_function(
            "() => __graphite.getRemote().connected"
            " && __graphite.getRemote().revision===2")
        assert page.locator('[data-cw-node="a"] strong').first.inner_text()==title
        assert page.locator('[data-cw-draft-editor]').count()==0

        page.evaluate("()=>__graphite.fit()")
        page.locator('[data-cw-node="b"]').hover()
        page.locator('[data-cw-edit-draft="b"]').click()
        panel=page.locator('[data-cw-draft-editor="b"]')
        panel.locator("input").fill("Изменение при конфликте")
        db["force_conflict"]=True
        panel.get_by_role("button",name="Сохранить").click()
        page.wait_for_function("()=>__graphite.getRemote().blocked",timeout=6000)
        assert db["apply"]==1 and db["put"]==0
        assert next(n for n in db["graph"]["nodes"] if n["id"]=="b")["title"]=="Развилка"
        assert page.evaluate("()=>__graphite.getState().nodes.find(n=>n.id==='b').title")=="Развилка"
        assert not errors,errors
        context.close();browser.close()
    print(json.dumps({"result":"PASS","writes":db["apply"],
                      "cases":["single-result label","edit/cancel","reviewed CAS",
                               "HTML-like text safe","reload","stale conflict",
                               "protected canon","no generic PUT"]},ensure_ascii=False))

if __name__=="__main__":
    main()
