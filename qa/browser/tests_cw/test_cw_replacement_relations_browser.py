"""CW-010 B: unified original-relation review, defer, reconnect and reload.

All Graphite endpoints are synthetic intercepted REST. No owner story, D1,
Site, MCP registration or on-disk SQLite is accessed.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
ORIGIN="http://127.0.0.1:8788"
PROJECT="cw010-relations-qa"

def graph():
    nodes=[]
    for id,title,x,y in [
        ("a","Исходная причина",100,60),
        ("b","Старый поворот",450,180),
        ("c","Последствие",1020,185),
        ("d","Другой вход",105,410),
        ("x","Новый поворот",700,490),
        ("y","Новая развязка",1020,490),
    ]:
        nodes.append({"id":id,"title":title,"description":title+" · описание",
                      "x":x,"y":y,"parent":None,"lineIds":["l1"],
                      "size":"normal"})
    edges=[
        {"id":"e1","from":"a","to":"b","type":"precedes"},
        {"id":"e2","from":"b","to":"c","type":"causes"},
        {"id":"e3","from":"d","to":"b","type":"hinders"},
        {"id":"e4","from":"x","to":"y","type":"precedes"},
    ]
    return {"version":1,"revision":14,"view":None,"nextNode":10,
            "nextEdge":6,"nextField":1,"nextLine":2,
            "nodes":nodes,"edges":edges,"fields":[],
            "lanes":[{"id":"l1","title":"Тестовая","color":"#b8a16e","y":160}],
            "replacements":[{"id":"replace-b","state":"open","sourceNodeIds":["b"],
                             "suspendedEdgeIds":["e1","e2","e3"],
                             "sourceGraphRevision":13,"edgeResolutions":[]}]}

def main():
    original=graph()
    db={"graph":copy.deepcopy(original),"revision":14,"previews":0,
        "applies":0,"generic":0,"requests":[],"operations":set()}
    errors=[]
    def serve(route):
        req=route.request
        path=urlsplit(req.url).path
        def answer(data,status=200):
            route.fulfill(status=status,content_type="application/json",
                          body=json.dumps(data,ensure_ascii=False))
        if path=="/" and req.method=="GET":
            route.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
        elif path=="/api/health":
            answer({"ok":True,"authenticated":True,"authMode":"node-loopback",
                    "workflowEnabled":True})
        elif path=="/api/projects" and req.method=="GET":
            answer({"projects":[{"id":PROJECT,"name":"Synthetic relation test",
                                 "revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and req.method=="GET":
            answer({"id":PROJECT,"name":"Synthetic relation test",
                    "revision":db["revision"],"graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and req.method=="PUT":
            db["generic"]+=1
            answer({"error":"PROTECTED_ORIGINAL"},422)
        elif path=="/api/projects/"+PROJECT+"/workflow/preview" and req.method=="POST":
            body=json.loads(req.post_data or "{}")
            assert body["expectedRevision"]==db["revision"]
            cmd=body["command"]
            assert cmd["kind"]=="reconnect"
            assert cmd["replacementId"]=="replace-b"
            assert len(cmd["decisions"])==1 and "expectedPreview" not in cmd
            d=cmd["decisions"][0]
            assert d["edgeId"] in ("e1","e2","e3")
            assert d["decision"] in ("rewire","drop"),"deferral never needs a write"
            assert d["edgeId"] not in [
                v["edgeId"] for v in db["graph"]["replacements"][0]["edgeResolutions"]]
            old=next(e for e in db["graph"]["edges"] if e["id"]==d["edgeId"])
            next_edge=d.get("newEdge")
            if next_edge is not None:
                assert d["decision"]=="rewire"
                assert next_edge["id"] not in [e["id"] for e in db["graph"]["edges"]]
                assert next_edge["from"]!=next_edge["to"]
                assert next_edge["type"] in ("precedes","causes","enables","hinders")
                if old["from"]!="b":assert next_edge["from"]==old["from"]
                if old["to"]!="b":assert next_edge["to"]==old["to"]
                assert next_edge["from"]!="b" and next_edge["to"]!="b"
            else:
                assert d["decision"]=="drop"
            used={old["from"],old["to"]}
            if next_edge:used.update([next_edge["from"],next_edge["to"]])
            reviewed=[n for n in db["graph"]["nodes"] if n["id"] in used]
            resolved={v["edgeId"] for v in db["graph"]["replacements"][0]["edgeResolutions"]}
            resolved.add(d["edgeId"])
            plan={"replacementId":"replace-b","decisions":[copy.deepcopy(d)],
                  "originalEdges":[copy.deepcopy(old)],"reviewedNodes":copy.deepcopy(reviewed),
                  "newEdges":[copy.deepcopy(next_edge)] if next_edge else [],
                  "droppedEdgeIds":[d["edgeId"]] if not next_edge else [],
                  "deferredEdgeIds":[],
                  "unresolvedEdgeIds":[e for e in ("e1","e2","e3") if e not in resolved]}
            db["previews"]+=1
            db["requests"].append(copy.deepcopy(plan))
            answer({"projectId":PROJECT,"kind":"reconnect",
                    "expectedRevision":db["revision"],"preview":plan})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply" and req.method=="POST":
            body=json.loads(req.post_data or "{}")
            assert body["expectedRevision"]==db["revision"]
            assert body["operationId"] not in db["operations"]
            cmd=body["command"]
            assert cmd["kind"]=="reconnect" and cmd["replacementId"]=="replace-b"
            d=cmd["decisions"][0]
            assert cmd["expectedPreview"]==db["requests"][-1]
            assert d==cmd["expectedPreview"]["decisions"][0]
            assert d["edgeId"] not in [v["edgeId"] for v in
                db["graph"]["replacements"][0]["edgeResolutions"]]
            if d["decision"]=="rewire":
                edge=d["newEdge"]
                db["graph"]["edges"].append(copy.deepcopy(edge))
                decision={"edgeId":d["edgeId"],"decision":"rewire",
                          "newEdgeId":edge["id"]}
            else:
                decision={"edgeId":d["edgeId"],"decision":"drop"}
            db["graph"]["replacements"][0]["edgeResolutions"].append(decision)
            db["revision"]+=1
            db["graph"]["revision"]=db["revision"]
            db["operations"].add(body["operationId"])
            db["applies"]+=1
            answer({"kind":"reconnect","projectId":PROJECT,"revision":db["revision"],
                    "operationId":body["operationId"],"replayed":False})
        else:
            answer({"error":"NOT_FOUND"},404)

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1450,"height":980})
        context.route(ORIGIN+"/**",serve)
        page=context.new_page()
        page.on("pageerror",lambda error:errors.append(str(error)))
        page.goto(ORIGIN+"/")
        page.wait_for_function(
            "()=>window.__graphite&&__graphite.getRemote().connected"
            "&&document.querySelector('[data-cw-original=b]')")
        assert page.locator('[data-node="b"]').count()==0
        assert page.locator('[data-edge="e1"]').count()==0
        assert page.locator('[data-edge="e2"]').count()==0
        page.locator('[data-cw-original="b"]').focus()
        page.keyboard.press("Enter")
        inspector=page.locator("#inspector")
        assert "Приостановленные связи · 0 из 3 решены" in inspector.inner_text()
        assert inspector.locator('[data-cw-old-edge]').count()==3
        assert "Исходная причина → Старый поворот" in inspector.inner_text()
        assert "Старый поворот → Последствие" in inspector.inner_text()
        assert "Другой вход → Старый поворот" in inspector.inner_text()
        assert "Следом" in inspector.inner_text()
        assert "Причина" in inspector.inner_text()
        assert "Препятствует" in inspector.inner_text()
        assert page.locator("#cw-reconnect-confirm").count()==0
        assert page.locator("#cw-complete-replacement").count()==0

        # Deferral is an explicit nonmutating choice: replacement stays open.
        inspector.locator('[data-cw-defer="e1"]').click()
        assert db["previews"]==db["applies"]==db["generic"]==0
        inspector.locator("#cw-replacement-postpone").click()
        assert inspector.is_hidden()
        assert db["graph"]["replacements"][0]["state"]=="open"
        page.reload()
        page.wait_for_function(
            "()=>window.__graphite&&__graphite.getRemote().connected"
            "&&document.querySelector('[data-cw-original=b]')")
        page.locator('[data-cw-original="b"]').click()
        assert "0 из 3 решены" in inspector.inner_text()

        # Dropping one original link requires preview and second confirmation.
        inspector.locator('[data-cw-drop="e3"]').click()
        preview=page.locator("#cw-reconnect-review")
        preview.wait_for()
        assert "Другой вход → Старый поворот" in preview.inner_text()
        assert "Препятствует" in preview.inner_text()
        assert db["applies"]==0
        page.keyboard.press("Escape")
        assert preview.count()==0 and db["applies"]==0
        inspector.locator('[data-cw-drop="e3"]').click()
        preview.wait_for()
        page.locator("#cw-reconnect-confirm").click()
        page.wait_for_function(
            "()=>__graphite.getState().replacements[0].edgeResolutions?.length===1"
            "&&!__graphite.getRemote().busy&&!__graphite.getRemote().dirty")
        assert db["applies"]==1
        assert db["graph"]["replacements"][0]["edgeResolutions"]==[
            {"edgeId":"e3","decision":"drop"}]
        assert "1 из 3 решены" in inspector.inner_text()
        assert "Не использовать · решение сохранено" in inspector.inner_text()
        assert inspector.locator('[data-cw-drop="e3"]').count()==0
        assert db["graph"]["edges"][:4]==original["edges"]

        # No automatic type or target. Explicitly select both for rewire.
        inspector.locator('[data-cw-rewire="e1"]').click()
        form=inspector.locator('[data-cw-rewire-form="e1"]')
        assert form.count()==1
        assert "Начало сохранено: Исходная причина" in form.inner_text()
        assert form.locator('[data-cw-choice-type]').input_value()==""
        form.locator('[data-cw-review-rewire="e1"]').click()
        assert db["previews"]==2,"empty endpoint/type must not send a request"
        form.locator('[data-cw-choice-to]').select_option("x")
        form.locator('[data-cw-review-rewire="e1"]').click()
        assert db["previews"]==2,"type requires explicit selection"
        form.locator('[data-cw-choice-type]').select_option("precedes")
        form.locator('[data-cw-review-rewire="e1"]').click()
        preview.wait_for()
        assert "Исходная причина → Новый поворот" in preview.inner_text()
        assert "Следом" in preview.inner_text()
        assert db["applies"]==1
        page.locator("#cw-reconnect-confirm").click()
        page.wait_for_function(
            "()=>__graphite.getState().replacements[0].edgeResolutions?.length===2"
            "&&!__graphite.getRemote().busy&&!__graphite.getRemote().dirty")
        assert db["applies"]==2
        approved=next(e for e in db["graph"]["edges"] if e["from"]=="a" and e["to"]=="x")
        assert approved["type"]=="precedes" and approved["id"] not in ("e1","e2","e3")
        assert len(db["graph"]["edges"])==5
        assert "2 из 3 решены" in inspector.inner_text()
        assert "Переподключено" in inspector.inner_text()
        assert inspector.locator('[data-cw-rewire="e1"]').count()==0
        assert db["graph"]["edges"][:4]==original["edges"]
        assert not any(e["from"]=="a" and e["to"]=="c" for e in db["graph"]["edges"])
        assert page.locator('[data-edge="e1"]').count()==0
        assert page.locator('[data-edge="e2"]').count()==0
        assert page.locator('[data-edge="'+approved["id"]+'"]').count()==1

        inspector.locator("#cw-replacement-postpone").click()
        page.reload()
        page.wait_for_function(
            "()=>window.__graphite&&__graphite.getRemote().connected"
            "&&document.querySelector('[data-cw-original=b]')")
        page.locator('[data-cw-original="b"]').click()
        assert "2 из 3 решены" in inspector.inner_text()
        assert inspector.locator('[data-cw-drop="e2"]').count()==1
        assert db["graph"]["replacements"][0]["state"]=="open"

        # Resolve remaining outgoing original, preserving external C endpoint.
        inspector.locator('[data-cw-rewire="e2"]').click()
        form=inspector.locator('[data-cw-rewire-form="e2"]')
        assert "Конец сохранён: Последствие" in form.inner_text()
        form.locator('[data-cw-choice-from]').select_option("y")
        form.locator('[data-cw-choice-type]').select_option("enables")
        form.locator('[data-cw-review-rewire="e2"]').click()
        preview.wait_for()
        assert "Новая развязка → Последствие" in preview.inner_text()
        assert "Делает возможным" in preview.inner_text()
        page.locator("#cw-reconnect-confirm").click()
        page.wait_for_function(
            "()=>__graphite.getState().replacements[0].edgeResolutions?.length===3"
            "&&!__graphite.getRemote().busy&&!__graphite.getRemote().dirty")
        assert db["applies"]==3 and db["generic"]==0
        assert "3 из 3 решены" in inspector.inner_text()
        assert db["graph"]["replacements"][0]["state"]=="open"
        assert len(db["graph"]["edges"])==6
        assert db["graph"]["edges"][:4]==original["edges"]
        assert page.locator("#cw-complete-replacement").count()==0
        assert page.locator('[data-cw-original="b"]').count()==1

        page.reload()
        page.wait_for_function(
            "()=>window.__graphite&&__graphite.getRemote().connected"
            "&&document.querySelector('[data-cw-original=b]')")
        page.locator('[data-cw-original="b"]').click()
        assert "3 из 3 решены" in inspector.inner_text()
        assert db["graph"]["nodes"]==original["nodes"],"original/neighbor text or position changed"
        assert db["graph"]["edges"][:4]==original["edges"]
        assert len(db["operations"])==3
        assert not errors,errors
        context.close()
        browser.close()
    print(json.dumps({"result":"PASS","previews":db["previews"],
        "applies":db["applies"],
        "checks":["multi-edge review","drop preview and Esc","explicit endpoint and type",
                  "separate new IDs","postpone and F5","no implicit canon edges"]},
        ensure_ascii=False))

if __name__=="__main__":
    main()
