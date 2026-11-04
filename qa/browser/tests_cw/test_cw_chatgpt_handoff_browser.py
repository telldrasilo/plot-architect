"""CW-016: manual ChatGPT handoff in real Chromium with synthetic Site REST.

This does not call or imitate a model. The example JSON is a fixture standing
in for content pasted by an author from an actual ChatGPT conversation.
"""
import json
import copy
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from test_cw_note_stage_browser import base_graph

HTML=(Path(__file__).resolve().parents[3]/"site/public/index.html").read_text(encoding="utf-8")
PROJECT="cw-handoff-synthetic"
SECRET="SECRET_DRAFT_NOT_FOR_CHATGPT"
RETIRED="RETIRED_ORIGINAL_NOT_FOR_CHATGPT"

def source():
    g=base_graph()
    g["nodes"][1]["title"]=RETIRED
    g["nodes"].append({"id":"secret","title":SECRET,"description":"Only a draft",
                       "x":180,"y":700,"parent":None,"workspaceId":"w-old","draftBranchId":"old"})
    g["edges"].append({"id":"e3","from":"n1","to":"n3","type":"enables"})
    g["workspaces"]=[{"id":"w-old","taskId":"other","x":120,"y":650,"width":420,"height":350}]
    g["replacements"]=[{"id":"r1","state":"open","sourceNodeIds":["n2"],
                         "suspendedEdgeIds":["e1","e2"],"sourceGraphRevision":0}]
    g["gapLinks"].append({"id":"gl2","from":{"kind":"gap_note","id":"gn1"},
                          "to":{"kind":"plot_node","id":"n1"}})
    return g

def answer():
    branches=[]
    for i,length in enumerate([1,2,3,1]):
        keys=["step"+str(j+1) for j in range(length)]
        branches.append({"title":"Ветвь "+str(i+1),
            "events":[{"key":key,"title":"Шаг "+str(i+1)+"."+str(j+1),
                       "description":"Авторский черновой вариант"} for j,key in enumerate(keys)],
            "relations":[{"from":keys[j],"to":keys[j+1],"type":"precedes"}
                         for j in range(length-1)]})
    return json.dumps({"branches":branches},ensure_ascii=False)

def main():
    original=source()
    db={"graph":copy.deepcopy(original),"revision":0,"previews":0,"applies":0,"put":0}
    errors=[]

    def staged(command):
        assert command["kind"]=="stage_note" and command["noteId"]=="gn1"
        assert command["workspaceId"].startswith("genw-")
        assert [len(b["nodes"]) for b in command["branches"]]==[1,2,3,1]
        assert [len(b["edges"]) for b in command["branches"]]==[0,1,2,0]
        graph_nodes=[]
        graph_edges=[]
        summaries=[]
        for branch in command["branches"]:
            own={n["id"] for n in branch["nodes"]}
            assert len(own)==len(branch["nodes"])
            for n in branch["nodes"]:
                graph_nodes.append({**n,"status":"proposed","parent":None,
                    "workspaceId":command["workspaceId"],"draftBranchId":branch["id"]})
            for edge in branch["edges"]:
                assert edge["from"] in own and edge["to"] in own
                graph_edges.append({**edge,"workspaceId":command["workspaceId"],
                    "draftBranchId":branch["id"],"draftRelation":"internal"})
            summaries.append({"id":branch["id"],"title":branch["title"],
                              "nodeCount":len(branch["nodes"]),"edgeCount":len(branch["edges"])})
        context=[e for e in db["graph"]["gapLinks"] if
                 e["from"]=={"kind":"gap_note","id":"gn1"} or
                 e["to"]=={"kind":"gap_note","id":"gn1"}]
        return {"noteId":"gn1","workspaceId":command["workspaceId"],
                "sourceNote":copy.deepcopy(db["graph"]["gapNotes"][0]),
                "contextualLinks":copy.deepcopy(context),
                "workspace":{"id":command["workspaceId"],"taskId":"gn1",**command["workspace"]},
                "branchSummaries":summaries,"proposedNodes":graph_nodes,
                "proposedEdges":graph_edges,"replacesCanonicalNodeIds":[],
                "autoRewiredEdgeIds":[]}

    def serve(route):
        req=route.request
        url=urlsplit(req.url).path
        def send(data,status=200):
            route.fulfill(status=status,content_type="application/json",
                          body=json.dumps(data,ensure_ascii=False))
        if url=="/" and req.method=="GET":
            route.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
        elif url=="/api/health":
            send({"ok":True,"authenticated":True,"authMode":"sites-native"})
        elif url=="/api/projects" and req.method=="GET":
            send({"projects":[{"id":PROJECT,"name":"Handoff","revision":db["revision"]}]})
        elif url=="/api/projects/"+PROJECT and req.method=="GET":
            send({"id":PROJECT,"name":"Handoff","revision":db["revision"],"graph":db["graph"]})
        elif url=="/api/projects/"+PROJECT and req.method=="PUT":
            db["put"]+=1
            send({"error":"GENERIC_PUT_DENIED"},422)
        elif url=="/api/projects/"+PROJECT+"/workflow/preview":
            body=json.loads(req.post_data)
            assert body["expectedRevision"]==db["revision"]
            db["previews"]+=1
            send({"projectId":PROJECT,"expectedRevision":db["revision"],
                  "kind":"stage_note","preview":staged(body["command"])})
        elif url=="/api/projects/"+PROJECT+"/workflow/apply":
            body=json.loads(req.post_data)
            assert body["expectedRevision"]==db["revision"]
            plan=staged(body["command"])
            assert body["command"]["expectedPreview"]==plan
            db["graph"]["workspaces"].append(copy.deepcopy(plan["workspace"]))
            db["graph"]["nodes"].extend(copy.deepcopy(plan["proposedNodes"]))
            db["graph"]["edges"].extend(copy.deepcopy(plan["proposedEdges"]))
            db["revision"]+=1
            db["graph"]["revision"]=db["revision"]
            db["applies"]+=1
            send({"projectId":PROJECT,"revision":db["revision"],"kind":"stage_note",
                  "operationId":body["operationId"],"replayed":False})
        else:
            send({"error":"NOT_FOUND"},404)

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1440,"height":920})
        context.route("https://plot.local/**",serve)
        page=context.new_page()
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto("https://plot.local/")
        page.wait_for_function("() => window.__graphite && __graphite.getRemote().connected")
        page.locator('[data-gap-note="gn1"]').click()
        assert page.locator("#cw-handoff-request").count()==0
        page.evaluate("() => __graphite.setCWWorkflowTestMode(true)")
        page.locator("#cw-handoff-request").click()
        prompt=page.locator("#cw-handoff-prompt").input_value()
        assert "Предложить несколько возможных путей" in prompt
        assert "Начало" in prompt and "Следствие" in prompt
        assert SECRET not in prompt and RETIRED not in prompt
        assert '"e1"' not in prompt and '"e2"' not in prompt
        assert "Верни ТОЛЬКО один JSON-объект" in prompt
        invalid=[
            chr(96)*3+"json\n"+answer()+"\n"+chr(96)*3,
            '{"branches":[{"title":"A","events":[{"key":"a","title":"A","status":"approved"}],"relations":[]}]}',
            '{"branches":[{"title":"A","events":[{"key":"a","title":"A"}],"relations":[{"from":"a","to":"other","type":"causes"}]}]}'
        ]
        for bad in invalid:
            page.locator("#cw-handoff-answer").fill(bad)
            page.locator("#cw-handoff-import").click()
            assert page.locator("#cw-stage-note").count()==0
        assert db["previews"]==0 and db["applies"]==0
        assert db["graph"]==original

        page.locator("#cw-handoff-answer").fill(answer())
        page.locator("#cw-handoff-import").click()
        assert page.locator("#cw-stage-note").count()==1
        assert "Подготовлено 4 ветвей" in page.locator('[data-gap-note="gn1"]').inner_text()
        assert db["graph"]==original
        page.locator("#cw-stage-note").click()
        page.locator(".cw-note-stage-review").wait_for()
        assert db["previews"]==1 and db["applies"]==0
        assert "7 событий" in page.locator(".cw-note-stage-review").inner_text()
        page.locator("#cw-stage-confirm").click()
        page.wait_for_function("() => __graphite.getRemote().revision===1 && document.querySelectorAll('.cw-preview-card').length===8")
        assert db["applies"]==1 and db["put"]==0
        assert db["graph"]["nodes"][:len(original["nodes"])]==original["nodes"]
        assert db["graph"]["edges"][:len(original["edges"])]==original["edges"]
        assert db["graph"]["gapNotes"]==original["gapNotes"]
        assert db["graph"]["gapLinks"]==original["gapLinks"]
        assert page.locator('[data-node="n2"]').count()==0
        page.reload()
        page.wait_for_function("() => window.__graphite && __graphite.getRemote().connected && __graphite.getRemote().revision===1 && document.querySelectorAll('.cw-preview-card').length===8")
        assert db["put"]==0 and not errors,errors
        context.close()
        browser.close()
    print(json.dumps({"result":"PASS","branches":4,"draft_nodes":7,"staging_writes":1,
        "generic_writes":db["put"],"cases":["canonical prompt","strict JSON","no model stub",
        "explicit preview","explicit save","reload"]},ensure_ascii=False))

if __name__=="__main__":
    main()
