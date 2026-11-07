"""CW-010 C3b4: synthetic Chromium author review after canonical additions.
No owner projects, published Site, production D1, MCP, or tunnel.
REST responses model the already separately tested transactional contract.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

HTML=(Path(__file__).resolve().parents[3]/"site/public/index.html").read_text(encoding="utf-8")
ORIGIN="http://127.0.0.1:8788"
PROJECT="cw010-postcanon-synthetic"

def fixture():
    nodes=[
      {"id":key,"title":title,"description":description,"x":x,"y":y,
       "parent":None,"lineIds":["l1"],"size":"normal"}
      for key,title,description,x,y in [
       ("a","Начало","Передача",70,110),
       ("b","Исходный поворот","Старый сюжет",410,140),
       ("c","Последствие","Прежний итог",820,145),
       ("x","Новый итог","Авторский X",340,470),
       ("y","Исходный поворот","Авторская Y",780,470),
      ]
    ]
    return {"version":1,"revision":7,"view":None,
      "nextNode":8,"nextEdge":4,"nextField":1,"nextLine":2,
      "nodes":nodes,
      "edges":[{"id":"e1","from":"a","to":"b","type":"precedes"},
               {"id":"e2","from":"b","to":"c","type":"causes"}],
      "fields":[],"lanes":[{"id":"l1","title":"Синтетика","color":"#b8a16e","y":200}],
      "replacements":[{
        "id":"r1","state":"open","sourceNodeIds":["b"],
        "suspendedEdgeIds":["e1","e2"],"sourceGraphRevision":0,
        "candidateNodeIds":["x","y"]
      }]
    }

def reviewed(graph,command):
    r=graph["replacements"][0]
    nodes={n["id"]:n for n in graph["nodes"]}
    edges={e["id"]:e for e in graph["edges"]}
    result={
      "replacementId":"r1","state":r["state"],
      "sourceGraphRevision":0,
      "originalNodes":[copy.deepcopy(nodes["b"])],
      "candidateNodes":[copy.deepcopy(nodes[x]) for x in ["x","y"]],
      "suspendedEdges":[copy.deepcopy(edges[e]) for e in ["e1","e2"]],
      "edgeResolutions":[],
      "earlierReviewCount":len(r.get("postCanonReviews",[])),
      "selectionComplete":False,"originalAction":None,
      "candidateDecisions":[],"edgeDecisions":[],
      "acknowledgedTitleConflicts":[],"possibleTitleConflicts":[],
      "wouldRestoreOriginalNodeIds":[],"wouldRestoreEdgeIds":[],
      "wouldArchiveCandidateNodeIds":[],"wouldKeepCandidateNodeIds":[],
      "blockers":[]
    }
    if "originalAction" not in command:return result
    original=command["originalAction"]
    candidate=command["candidateDecisions"]
    relations=command["edgeDecisions"]
    ack=sorted(command["acknowledgedTitleConflicts"])
    assert original in ("keep_replaced","restore")
    assert [d["nodeId"] for d in candidate]==["x","y"]
    assert [d["edgeId"] for d in relations]==["e1","e2"]
    archive=[d["nodeId"] for d in candidate if d["decision"]=="archive"]
    kept=[d["nodeId"] for d in candidate if d["decision"]=="keep"]
    restore_edges=[d["edgeId"] for d in relations if d["decision"]=="restore"]
    collisions=["b","y"] if original=="restore" and "y" in kept else []
    blockers=["TITLE_CONFLICT_UNACKNOWLEDGED:"+i for i in collisions if i not in ack]
    result.update({
      "selectionComplete":True,"originalAction":original,
      "candidateDecisions":copy.deepcopy(candidate),
      "edgeDecisions":copy.deepcopy(relations),
      "acknowledgedTitleConflicts":ack,
      "possibleTitleConflicts":collisions,
      "wouldRestoreOriginalNodeIds":["b"] if original=="restore" else [],
      "wouldRestoreEdgeIds":restore_edges,
      "wouldArchiveCandidateNodeIds":archive,
      "wouldKeepCandidateNodeIds":kept,
      "blockers":blockers
    })
    return result

def main():
 db={"graph":fixture(),"revision":7,"applies":0,"previews":0,"puts":0,"seen":set()}
 errors=[]
 def route(req):
    path=urlsplit(req.request.url).path
    method=req.request.method
    def respond(body,status=200):
      req.fulfill(status=status,content_type="application/json",
       body=json.dumps(body,ensure_ascii=False))
    if path=="/" and method=="GET":
      req.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
    elif path=="/api/health":
      respond({"ok":True,"authenticated":True,"authMode":"node-loopback","workflowEnabled":True})
    elif path=="/api/projects" and method=="GET":
      respond({"projects":[{"id":PROJECT,"name":"CW-010 reviewed",
         "revision":db["revision"]}]})
    elif path=="/api/projects/"+PROJECT and method=="GET":
      respond({"id":PROJECT,"name":"CW-010 reviewed",
         "revision":db["revision"],"graph":copy.deepcopy(db["graph"])})
    elif path=="/api/projects/"+PROJECT and method=="PUT":
      db["puts"]+=1;respond({"error":"NO_GENERIC_MUTATION"},422)
    elif path=="/api/projects/"+PROJECT+"/workflow/preview" and method=="POST":
      body=json.loads(req.request.post_data or "{}")
      assert body["expectedRevision"]==db["revision"],body
      command=body["command"]
      assert command["kind"]=="review_replacement"
      assert command["replacementId"]=="r1"
      assert not set(command)-{"kind","replacementId","originalAction",
       "candidateDecisions","edgeDecisions","acknowledgedTitleConflicts"}
      db["previews"]+=1
      respond({"projectId":PROJECT,"expectedRevision":db["revision"],
       "kind":"review_replacement","preview":reviewed(db["graph"],command)})
    elif path=="/api/projects/"+PROJECT+"/workflow/apply" and method=="POST":
      body=json.loads(req.request.post_data or "{}")
      assert body["expectedRevision"]==db["revision"],body
      assert body["operationId"] not in db["seen"],body
      cmd=body["command"]
      assert cmd["kind"]=="review_replacement"
      assert cmd["expectedPreview"]==reviewed(db["graph"],cmd)
      assert cmd["expectedPreview"]["selectionComplete"]
      assert cmd["expectedPreview"]["blockers"]==[]
      r=db["graph"]["replacements"][0]
      r.setdefault("postCanonReviews",[]).append({
        "originalAction":cmd["originalAction"],
        "candidateDecisions":copy.deepcopy(cmd["candidateDecisions"]),
        "edgeDecisions":copy.deepcopy(cmd["edgeDecisions"]),
        "acknowledgedTitleConflicts":sorted(cmd["acknowledgedTitleConflicts"])
      })
      if cmd["originalAction"]=="restore":r["state"]="restored"
      db["revision"]+=1
      db["graph"]["revision"]=db["revision"]
      db["seen"].add(body["operationId"])
      db["applies"]+=1
      respond({"projectId":PROJECT,"revision":db["revision"],
        "kind":"review_replacement","operationId":body["operationId"],
        "changes":{"originalAndCandidatesPreserved":True,"autoRewiredEdgeIds":[],
         "restoredNodeIds":["b"] if r["state"]=="restored" else [],
         "restoredEdgeIds":[e["edgeId"] for e in cmd["edgeDecisions"] if e["decision"]=="restore"],
         "archivedCandidateNodeIds":[n["nodeId"] for n in cmd["candidateDecisions"] if n["decision"]=="archive"]}})
    else:respond({"error":"NOT_FOUND"},404)
 with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    context=browser.new_context(viewport={"width":1600,"height":1000})
    context.route(ORIGIN+"/**",route)
    page=context.new_page()
    page.on("pageerror",lambda err:errors.append(str(err)))
    def ready():
      page.wait_for_function("()=>window.__graphite&&__graphite.getRemote().connected"
        "&&!__graphite.getRemote().dirty&&!__graphite.getRemote().busy")
    def inspector():
      page.locator('[data-cw-original="b"]').click()
      page.locator("#cw-review-replacement").wait_for()
    def choose(original,x,y,e1,e2):
      dialog=page.locator("#cw-postcanon-choices")
      dialog.wait_for()
      assert all(not elt.input_value() for elt in dialog.locator("select").all()),"no default author decisions"
      dialog.locator('[data-cw-post-original]').select_option(original)
      dialog.locator('[data-cw-post-candidate="x"]').select_option(x)
      dialog.locator('[data-cw-post-candidate="y"]').select_option(y)
      dialog.locator('[data-cw-post-edge="e1"]').select_option(e1)
      dialog.locator('[data-cw-post-edge="e2"]').select_option(e2)
      dialog.locator("#cw-postcanon-check").click()
      page.locator("#cw-postcanon-review").wait_for()
    page.goto(ORIGIN+"/")
    ready()
    inspector()
    page.locator("#cw-review-replacement").click()
    page.locator("#cw-postcanon-choices").wait_for(state="visible")
    assert page.locator("#cw-postcanon-choices select").count()==5
    page.keyboard.press("Escape")
    assert page.locator("#cw-postcanon-choices").count()==0
    assert db["applies"]==0
    page.locator("#cw-review-replacement").click()
    choose("keep_replaced","keep","archive","keep_suspended","keep_suspended")
    assert "исключить из канона" in page.locator("#cw-postcanon-review").inner_text()
    page.locator("#cw-postcanon-submit").click()
    page.wait_for_function("()=>__graphite.getState().replacements[0].postCanonReviews?.length===1"
      "&&!__graphite.getRemote().dirty")
    assert db["applies"]==1 and db["puts"]==0
    assert page.locator('[data-node="x"]').count()==1
    assert page.locator('[data-node="y"]').count()==0
    assert page.locator('[data-cw-original="b"]').count()==1
    assert db["graph"]["nodes"]==fixture()["nodes"]
    assert db["graph"]["edges"]==fixture()["edges"]
    assert "Исключено из канона" in page.locator("#inspector").inner_text()
    page.reload();ready()
    assert page.locator('[data-node="y"]').count()==0
    inspector()
    page.locator("#cw-review-replacement").click()
    # The dialog requires renewed explicit choices; the previous review isn't
    # silently accepted as the new author decision.
    choose("restore","keep","archive","restore","keep_suspended")
    page.locator("#cw-postcanon-submit").click()
    page.wait_for_function("()=>__graphite.getState().replacements[0].state==='restored'"
      "&&!__graphite.getRemote().dirty")
    assert db["applies"]==2 and db["puts"]==0
    assert page.locator('[data-cw-original="b"]').count()==0
    assert page.locator('[data-node="b"]').count()==1
    assert page.locator('[data-node="y"]').count()==0
    assert page.locator('[data-node="b"] .node-actions').count()==0
    assert page.locator("#cw-review-replacement").count()==0,"already restored cannot be re-reviewed implicitly"
    page.reload();ready()
    page.locator('[data-node="b"]').click()
    assert "Восстановлено в каноне" in page.locator("#inspector").inner_text()
    assert page.locator("#field-title").count()==0,"protected original must be read-only"
    assert db["graph"]["replacements"][0]["postCanonReviews"][1]["edgeDecisions"][0]["decision"]=="restore"
    # A second isolated test scenario exercises the duplicate warning path.
    db.update({"graph":fixture(),"revision":7,"applies":0,"previews":0,"puts":0,"seen":set()})
    page.reload();ready()
    inspector()
    page.locator("#cw-review-replacement").click()
    choose("restore","keep","keep","restore","keep_suspended")
    dialog=page.locator("#cw-postcanon-review")
    assert "Операция заблокирована" in dialog.inner_text()
    assert dialog.locator('[data-cw-post-title]').count()==2
    assert not any(x.is_checked() for x in dialog.locator('[data-cw-post-title]').all())
    assert db["applies"]==0
    for check in dialog.locator('[data-cw-post-title]').all():check.check()
    dialog.locator("#cw-postcanon-submit").click()
    dialog.wait_for()
    assert "Операция заблокирована" not in dialog.inner_text()
    assert dialog.locator("#cw-postcanon-submit").inner_text()=="Подтвердить изменения"
    assert db["applies"]==0
    dialog.locator("#cw-postcanon-submit").click()
    page.wait_for_function("()=>__graphite.getState().replacements[0].state==='restored'"
      "&&!__graphite.getRemote().dirty")
    assert db["applies"]==1
    assert page.locator('[data-node="y"]').count()==1
    assert page.locator('[data-node="b"]').count()==1
    assert not errors,errors
    browser.close()
    print("CW-010 C3b4: explicit decisions, Esc, archive, restore, conflict acknowledgement, CAS/F5 OK")
if __name__=="__main__":
 main()
