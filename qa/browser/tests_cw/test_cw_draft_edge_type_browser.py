"""CW-003: contextual editor changes only internal draft relation meaning.

Runs in synthetic Chromium with mocked local REST. No production Site, D1,
MCP, user plots or ordinary graph PUT are touched.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from test_cw_persisted_workspace_accept_browser import story

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
PROJECT="cw003-draft-type-qa"
ORIGIN="http://127.0.0.1:8788"
TYPES={"precedes","causes","enables","hinders"}


def main():
    data={"graph":story(),"revision":1,"put":0,"preview":0,"apply":0,
          "force_conflict":False,"receipts":{}}
    errors=[]
    baseline=copy.deepcopy(data["graph"])
    edge0=next(e for e in baseline["edges"] if e["id"]=="ea")
    assert edge0["workspaceId"]=="w1" and edge0["draftRelation"]=="internal"
    assert edge0["type"]=="precedes"

    def plan(command):
        assert command["kind"]=="set_draft_edge_type"
        assert set(command)=={"kind","workspaceId","edgeId","newType"}
        assert command["workspaceId"]=="w1" and command["edgeId"]=="ea"
        assert command["newType"] in TYPES
        old=next(e for e in data["graph"]["edges"] if e["id"]==command["edgeId"])
        assert old["workspaceId"]=="w1" and old["draftRelation"]=="internal"
        assert old["type"]!=command["newType"]
        after={**old,"type":command["newType"]}
        return {"workspaceId":"w1","operation":"type","edgeId":"ea",
                "before":copy.deepcopy(old),"after":after,
                "affectedDraftEdgeIds":["ea"],"autoRewiredEdgeIds":[]}

    def route(request):
        req=request.request
        url=urlsplit(req.url).path
        method=req.method
        def reply(body,status=200):
            request.fulfill(status=status,content_type="application/json",
                            body=json.dumps(body,ensure_ascii=False))
        if url=="/":
            request.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
        elif url=="/api/health":
            reply({"ok":True,"authenticated":True,"authMode":"node-loopback",
                   "workflowEnabled":True})
        elif url=="/api/projects" and method=="GET":
            reply({"projects":[{"id":PROJECT,"name":"Draft Type QA",
                                "revision":data["revision"]}]})
        elif url=="/api/projects/"+PROJECT and method=="GET":
            reply({"id":PROJECT,"name":"Draft Type QA","revision":data["revision"],
                   "graph":copy.deepcopy(data["graph"])})
        elif url=="/api/projects/"+PROJECT and method=="PUT":
            data["put"]+=1
            reply({"error":"GENERIC_PUT_FORBIDDEN"},422)
        elif url=="/api/projects/"+PROJECT+"/workflow/preview":
            body=json.loads(req.post_data or "{}")
            if body["expectedRevision"]!=data["revision"]:
                reply({"error":"REVISION_CONFLICT","message":"stale"},409)
                return
            try:
                review=plan(body["command"])
            except (AssertionError,KeyError,StopIteration):
                reply({"error":"DRAFT_EDGE_INVALID","message":"invalid"},422)
                return
            data["preview"]+=1
            reply({"kind":"set_draft_edge_type","projectId":PROJECT,
                   "expectedRevision":data["revision"],"preview":review})
        elif url=="/api/projects/"+PROJECT+"/workflow/apply":
            body=json.loads(req.post_data or "{}")
            command=body["command"]
            op=body["operationId"]
            if op in data["receipts"]:
                reply({**data["receipts"][op],"replayed":True})
                return
            if data["force_conflict"] or body["expectedRevision"]!=data["revision"]:
                data["force_conflict"]=False
                data["revision"]+=1
                data["graph"]["revision"]=data["revision"]
                reply({"error":"REVISION_CONFLICT","message":"stale"},409)
                return
            expected=command["expectedPreview"]
            clean={k:v for k,v in command.items() if k!="expectedPreview"}
            assert expected==plan(clean)
            before=next(e for e in data["graph"]["edges"] if e["id"]=="ea")
            updated=copy.deepcopy(expected["after"])
            assert updated["id"]==before["id"] and updated["from"]==before["from"]
            assert updated["to"]==before["to"] and updated["workspaceId"]==before["workspaceId"]
            idx=next(i for i,e in enumerate(data["graph"]["edges"]) if e["id"]=="ea")
            data["graph"]["edges"][idx]=updated
            data["revision"]+=1
            data["graph"]["revision"]=data["revision"]
            data["apply"]+=1
            result={"projectId":PROJECT,"revision":data["revision"],"operationId":op,
                    "kind":"set_draft_edge_type","replayed":False}
            data["receipts"][op]=result
            reply(result)
        else:
            reply({"error":"NOT_FOUND"},404)

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1440,"height":950})
        context.route(ORIGIN+"/**",route)
        page=context.new_page()
        page.on("pageerror",lambda error:errors.append(str(error)))
        page.goto(ORIGIN+"/")
        page.wait_for_function(
            "() => window.__graphite && __graphite.getRemote().connected"
            " && document.querySelectorAll('[data-cw-node]').length===3"
        )
        page.evaluate("()=>__graphite.fit()")
        hit=page.locator('[data-cw-edge-hit="ea"]')
        assert hit.count()==1
        # The relation can be selected by keyboard without dragging a node.
        hit.focus()
        page.keyboard.press("Enter")
        panel=page.locator('[data-cw-edge-type-panel="ea"]')
        assert panel.count()==1
        picker=panel.locator('[data-cw-edge-type="ea"]')
        assert set(picker.locator("option").evaluate_all(
            "options => options.map(o=>o.value)"))==TYPES
        assert picker.input_value()=="precedes"
        assert panel.get_by_text("Сохранить").is_disabled()
        picker.select_option("hinders")
        assert "мешает" in panel.locator("small").inner_text()
        assert data["apply"]==0 and data["put"]==0
        assert data["graph"]["edges"]==baseline["edges"]
        panel.get_by_text("Отмена").click()
        assert page.locator('[data-cw-edge-type-panel="ea"]').count()==0
        assert data["apply"]==0

        # Real pointer selection and explicit save via preview/apply/readback.
        page.locator('[data-cw-edge-hit="ea"]').click(force=True)
        panel=page.locator('[data-cw-edge-type-panel="ea"]')
        assert panel.count()==1
        panel.locator("select").select_option("enables")
        panel.get_by_text("Сохранить").click()
        page.wait_for_function(
            "() => __graphite.getRemote().revision===2"
            " && __graphite.getState().edges.find(e=>e.id==='ea').type==='enables'"
        )
        assert data["preview"]==1 and data["apply"]==1 and data["put"]==0
        saved=next(e for e in data["graph"]["edges"] if e["id"]=="ea")
        assert saved["type"]=="enables" and saved["id"]==edge0["id"]
        assert saved["from"]==edge0["from"] and saved["to"]==edge0["to"]
        assert all(e==next(x for x in baseline["edges"] if x["id"]==e["id"])
                   for e in data["graph"]["edges"] if e["id"]!="ea")
        page.reload()
        page.wait_for_function(
            "() => __graphite.getRemote().connected"
            " && __graphite.getRemote().revision===2"
        )
        page.evaluate("()=>__graphite.fit()")
        assert page.evaluate(
            "()=>__graphite.getState().edges.find(e=>e.id==='ea').type")=="enables"

        page.locator('[data-cw-edge-hit="ea"]').focus()
        page.keyboard.press("Enter")
        panel=page.locator('[data-cw-edge-type-panel="ea"]')
        assert panel.locator("select").input_value()=="enables"
        panel.locator("select").select_option("causes")
        data["force_conflict"]=True
        panel.get_by_text("Сохранить").click()
        page.wait_for_function("()=>__graphite.getRemote().blocked",timeout=6000)
        assert data["apply"]==1 and data["put"]==0
        assert next(e for e in data["graph"]["edges"] if e["id"]=="ea")["type"]=="enables"
        assert page.evaluate(
            "()=>__graphite.getState().edges.find(e=>e.id==='ea').type")=="enables"
        assert not errors,errors
        context.close()
        browser.close()
    print(json.dumps({"result":"PASS","applied":data["apply"],
                      "cases":["keyboard","pointer","four types","cancel",
                               "preview/apply","readback","reload","stale CAS",
                               "no generic PUT","unchanged endpoints"]}))


if __name__=="__main__":
    main()
