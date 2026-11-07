"""CW-010 C3b2: author-only candidate selection from a completed original's history.
Synthetic HTTP interception only: no real data, SQLite, Site or MCP.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[3]
HTML=(ROOT/"site/public/index.html").read_text(encoding="utf-8")
ORIGIN="http://127.0.0.1:8788"
PROJECT="cw010-candidates-browser"

def scene():
    nodes=[
        {"id":i,"title":title,"description":text,"x":x,"y":y,
         "parent":None,"lineIds":["l1"],"size":"normal"}
        for i,title,text,x,y in [
          ("a","Start","Original start",80,80),
          ("b","Original scene","Old event",450,120),
          ("c","Result","Original result",940,120),
          ("x","Original scene","A new version of B",700,480),
          ("y","Another possibility","Alternative outcome",1000,490),
        ]
    ]
    return {"version":1,"revision":14,"view":None,
      "nextNode":10,"nextEdge":3,"nextField":1,"nextLine":2,
      "nodes":nodes,"edges":[
        {"id":"e1","from":"a","to":"b","type":"precedes"},
        {"id":"e2","from":"b","to":"c","type":"causes"}
      ],"fields":[],"lanes":[{"id":"l1","title":"Test story","color":"#b8a16e","y":180}],
      "replacements":[{"id":"r1","state":"completed","sourceNodeIds":["b"],
                       "suspendedEdgeIds":["e1","e2"],"sourceGraphRevision":13,
                       "edgeResolutions":[{"edgeId":"e1","decision":"drop"},
                                          {"edgeId":"e2","decision":"drop"}]}]
    }

def main():
    base=scene()
    db={"graph":copy.deepcopy(base),"revision":14,"previews":0,"applies":0,
        "generic":0,"last":None,"operations":set()}
    errors=[]
    def preview(command):
        assert command["kind"]=="link_replacement_candidates"
        assert command["replacementId"]=="r1"
        assert not set(command)-{"kind","replacementId","nodeIds"}
        r=db["graph"]["replacements"][0]
        available=[n for n in db["graph"]["nodes"] if n["id"] in ("x","y") and
                   n["id"] not in r.get("candidateNodeIds",[])]
        selected=command["nodeIds"]
        assert all(i in [n["id"] for n in available] for i in selected)
        return {
            "replacementId":"r1","sourceGraphRevision":13,"state":"completed",
            "originalNodes":[copy.deepcopy(n) for n in db["graph"]["nodes"] if n["id"]=="b"],
            "suspendedEdges":copy.deepcopy(db["graph"]["edges"]),
            "alreadyLinkedNodeIds":copy.deepcopy(r.get("candidateNodeIds",[])),
            "availableCandidates":[
                {"node":copy.deepcopy(n),"provenance":"created_after_start"} for n in available
            ],
            "selectedNodeIds":list(selected),
            "possibleExactTitleDuplicates":[i for i in selected if i=="x"]
        }
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
            answer({"projects":[{"id":PROJECT,"name":"Synthetic candidates",
                                 "revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and req.method=="GET":
            answer({"id":PROJECT,"name":"Synthetic candidates",
                    "revision":db["revision"],"graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and req.method=="PUT":
            db["generic"]+=1
            answer({"error":"PROTECTED"},422)
        elif path=="/api/projects/"+PROJECT+"/workflow/preview" and req.method=="POST":
            body=json.loads(req.post_data or "{}")
            assert body["expectedRevision"]==db["revision"]
            plan=preview(body["command"])
            db["previews"]+=1
            db["last"]=copy.deepcopy(plan)
            answer({"projectId":PROJECT,"kind":"link_replacement_candidates",
                    "expectedRevision":db["revision"],"preview":plan})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply" and req.method=="POST":
            body=json.loads(req.post_data or "{}")
            assert body["expectedRevision"]==db["revision"]
            assert body["operationId"] not in db["operations"]
            command=body["command"]
            assert command["expectedPreview"]==db["last"]
            assert command["nodeIds"]==db["last"]["selectedNodeIds"]
            assert command["kind"]=="link_replacement_candidates"
            assert len(command["nodeIds"])==1
            assert command["nodeIds"]==["x"],"only the expressly selected candidate"
            db["graph"]["replacements"][0]["candidateNodeIds"]=command["nodeIds"][:]
            db["revision"]+=1
            db["graph"]["revision"]=db["revision"]
            db["operations"].add(body["operationId"])
            db["applies"]+=1
            answer({"kind":"link_replacement_candidates","projectId":PROJECT,
                    "revision":db["revision"],"operationId":body["operationId"]})
        else:
            answer({"error":"NOT_FOUND"},404)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1460,"height":1020})
        context.route(ORIGIN+"/**",serve)
        page=context.new_page()
        page.on("pageerror",lambda e:errors.append(str(e)))
        def ready():
            page.wait_for_function("()=>window.__graphite&&__graphite.getRemote().connected"
                "&&!__graphite.getRemote().busy&&!__graphite.getRemote().dirty")
        page.goto(ORIGIN+"/")
        ready()
        assert page.locator('[data-node="b"]').count()==0
        page.locator("#tools-more").click()
        page.locator("#cw-replacement-history").click()
        page.locator('[data-cw-history-id="r1"]').click()
        inspector=page.locator("#inspector")
        assert inspector.locator("#cw-associate-candidates").count()==1
        assert "Приостановленные связи" in inspector.inner_text()
        inspector.locator("#cw-associate-candidates").click()
        picker=page.locator("#cw-candidate-choose")
        picker.wait_for()
        assert picker.locator('[data-cw-candidate]').count()==2
        assert picker.locator('[data-cw-candidate="a"]').count()==0
        assert all(not x.is_checked() for x in picker.locator('[data-cw-candidate]').all())
        assert db["previews"]==1 and db["applies"]==0
        page.keyboard.press("Escape")
        assert picker.count()==0 and db["applies"]==0
        inspector.locator("#cw-associate-candidates").click()
        picker.wait_for()
        picker.locator('[data-cw-candidate="x"]').check()
        picker.locator("#cw-candidates-check").click()
        review=page.locator("#cw-candidate-confirm-dialog")
        review.wait_for()
        assert "Original scene" in review.inner_text()
        assert "совпадений названий" in review.inner_text()
        assert "Another possibility" not in review.inner_text()
        page.keyboard.press("Escape")
        assert review.count()==0 and db["applies"]==0
        inspector.locator("#cw-associate-candidates").click()
        picker.wait_for()
        picker.locator('[data-cw-candidate="x"]').check()
        picker.locator("#cw-candidates-check").click()
        review.wait_for()
        review.locator("#cw-candidate-confirm").click()
        page.wait_for_function("()=>__graphite.getState().replacements[0].candidateNodeIds?.length===1"
            "&&!__graphite.getRemote().busy&&!__graphite.getRemote().dirty")
        assert db["applies"]==1 and db["generic"]==0
        assert db["graph"]["nodes"]==base["nodes"]
        assert db["graph"]["edges"]==base["edges"]
        assert db["graph"]["replacements"][0]["candidateNodeIds"]==["x"]
        assert page.locator('[data-node="b"]').count()==0
        assert "Новые события, связанные автором · 1" in inspector.inner_text()
        page.reload();ready()
        page.locator("#tools-more").click()
        page.locator("#cw-replacement-history").click()
        page.locator('[data-cw-history-id="r1"]').click()
        assert "Новые события, связанные автором · 1" in inspector.inner_text()
        assert db["applies"]==1 and db["generic"]==0
        assert not errors,errors
        browser.close()
        print("CW-010 C3b2: explicit candidate selection, cancel/Esc, CAS readback, reload OK")
if __name__=="__main__":
    main()
