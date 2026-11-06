"""CW-055-B: reviewed draft and branch deletion in real synthetic Chromium.
No production Site, D1, MCP provider or owner stories are accessed.
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
PROJECT="cw055-discard-qa"

def main():
    base=story()
    db={"graph":copy.deepcopy(base),"revision":1,"previews":0,"applies":0,
        "puts":0,"conflict":False,"receipts":{}}
    errors=[]
    def plan(command):
        assert set(command)=={"kind","workspaceId","nodeIds"}
        assert command["kind"]=="discard_drafts"
        w=command["workspaceId"]
        area=next(a for a in db["graph"]["workspaces"] if a["id"]==w)
        ids=command["nodeIds"]
        assert 1<=len(ids)<=128 and len(ids)==len(set(ids))
        by_id={n["id"]:n for n in db["graph"]["nodes"]}
        assert all(by_id[n]["workspaceId"]==w for n in ids)
        selected=set(ids)
        incident=[e for e in db["graph"]["edges"]
                  if e["from"] in selected or e["to"] in selected]
        assert all(e["workspaceId"]==w for e in incident)
        remaining=[n["id"] for n in db["graph"]["nodes"]
                   if n.get("workspaceId")==w and n["id"] not in selected]
        clear_area=not remaining
        remaining_edges=[e for e in db["graph"]["edges"]
                         if e.get("workspaceId")==w and e not in incident]
        assert not (clear_area and remaining_edges)
        note_id=area.get("taskId") if clear_area else None
        drop_note=note_id if any(n["id"]==note_id
                                 for n in db["graph"].get("gapNotes",[])) else None
        gap_links=[l for l in db["graph"].get("gapLinks",[])
                   if any(l.get(k,{}).get("kind")=="plot_node" and
                          l[k].get("id") in selected for k in ("from","to"))
                   or (drop_note and any(l.get(k,{}).get("kind")=="gap_note"
                           and l[k].get("id")==drop_note for k in ("from","to")))]
        return {"workspaceId":w,"nodeIds":ids,
                "removedDrafts":[{"id":n,"title":by_id[n]["title"],
                                  "draftBranchId":by_id[n].get("draftBranchId")}
                                 for n in ids],
                "affectedRelations":[{"id":e["id"],"from":e["from"],"to":e["to"],
                    "type":e["type"],"draftRelation":e["draftRelation"],
                    "fromTitle":by_id[e["from"]]["title"],
                    "toTitle":by_id[e["to"]]["title"]} for e in incident],
                "removedGapLinks":[{"id":l["id"],"from":l["from"],"to":l["to"]}
                                   for l in gap_links],
                "remainingNodeIds":remaining,"removeWorkspace":clear_area,
                "removeNoteId":drop_note,"autoRewiredEdgeIds":[]}

    def route(intercept):
        req=intercept.request
        path=urlsplit(req.url).path
        def reply(value,status=200):
            intercept.fulfill(status=status,content_type="application/json",
                              body=json.dumps(value,ensure_ascii=False))
        if path=="/" and req.method=="GET":
            intercept.fulfill(status=200,content_type="text/html; charset=utf-8",
                              body=HTML)
        elif path=="/api/health":
            reply({"ok":True,"authenticated":True,"authMode":"node-loopback",
                   "workflowEnabled":True})
        elif path=="/api/projects" and req.method=="GET":
            reply({"projects":[{"id":PROJECT,"name":"Discard QA",
                                "revision":db["revision"]}]})
        elif path=="/api/projects/"+PROJECT and req.method=="GET":
            reply({"id":PROJECT,"name":"Discard QA","revision":db["revision"],
                   "graph":copy.deepcopy(db["graph"])})
        elif path=="/api/projects/"+PROJECT and req.method=="PUT":
            db["puts"]+=1
            reply({"error":"PROTECTED_NODE_CHANGED"},422)
        elif path=="/api/projects/"+PROJECT+"/workflow/preview":
            payload=json.loads(req.post_data or "{}")
            if payload["expectedRevision"]!=db["revision"]:
                reply({"error":"REVISION_CONFLICT","message":"stale"},409);return
            try: result=plan(payload["command"])
            except (AssertionError,KeyError,StopIteration,TypeError):
                reply({"error":"DISCARD_SELECTION_INVALID"},422);return
            db["previews"]+=1
            reply({"projectId":PROJECT,"expectedRevision":db["revision"],
                   "kind":"discard_drafts","preview":result})
        elif path=="/api/projects/"+PROJECT+"/workflow/apply":
            payload=json.loads(req.post_data or "{}")
            operation=payload["operationId"]
            if operation in db["receipts"]:
                reply({**db["receipts"][operation],"replayed":True});return
            if db["conflict"] or payload["expectedRevision"]!=db["revision"]:
                db["conflict"]=False
                db["revision"]+=1;db["graph"]["revision"]=db["revision"]
                reply({"error":"REVISION_CONFLICT","message":"stale"},409);return
            command=payload["command"]
            expected=command["expectedPreview"]
            bare={k:v for k,v in command.items() if k!="expectedPreview"}
            assert plan(bare)==expected
            selected=set(command["nodeIds"])
            edge_ids={e["id"] for e in expected["affectedRelations"]}
            link_ids={l["id"] for l in expected["removedGapLinks"]}
            db["graph"]["nodes"]=[n for n in db["graph"]["nodes"]
                                  if n["id"] not in selected]
            db["graph"]["edges"]=[e for e in db["graph"]["edges"]
                                  if e["id"] not in edge_ids]
            if expected["removeWorkspace"]:
                db["graph"]["workspaces"]=[a for a in db["graph"]["workspaces"]
                                           if a["id"]!=command["workspaceId"]]
            if expected["removeNoteId"]:
                db["graph"]["gapNotes"]=[n for n in db["graph"].get("gapNotes",[])
                                          if n["id"]!=expected["removeNoteId"]]
            db["graph"]["gapLinks"]=[l for l in db["graph"].get("gapLinks",[])
                                      if l["id"] not in link_ids]
            db["revision"]+=1;db["graph"]["revision"]=db["revision"]
            db["applies"]+=1
            receipt={"projectId":PROJECT,"revision":db["revision"],
                     "operationId":operation,"kind":"discard_drafts","replayed":False}
            db["receipts"][operation]=receipt
            reply(receipt)
        else:
            reply({"error":"NOT_FOUND"},404)

    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,args=["--no-sandbox",
                                                               "--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1440,"height":940})
        context.route(ORIGIN+"/**",route)
        page=context.new_page()
        page.on("pageerror",lambda err:errors.append(str(err)))
        def loaded(revision,expected=3):
            page.wait_for_function(
                """([rev,count]) => window.__graphite &&
                   __graphite.getRemote().connected &&
                   __graphite.getRemote().revision===rev &&
                   document.querySelectorAll('.cw-preview-card').length===count""",
                arg=[revision,expected])
        page.goto(ORIGIN+"/")
        loaded(1)
        page.evaluate("()=>__graphite.fit()")
        original_canon=[n for n in base["nodes"] if not n.get("workspaceId")]
        assert page.locator('[data-cw-node="a"]').count()==1
        assert db["puts"]==0

        # Cancellation previews impacted arrows, but writes nothing.
        page.locator('[data-cw-node="a"]').click()
        page.locator('[data-cw-discard-selected="w1"]').click()
        panel=page.locator('[data-cw-discard-review="w1"]')
        panel.wait_for()
        assert "Развилка" in panel.inner_text() and "Новая завязка" in panel.inner_text()
        assert "1 редакторских" in panel.inner_text()
        assert db["applies"]==0
        panel.locator('[data-cw-discard-cancel]').click()
        assert panel.count()==0 and db["graph"]==base

        # Conflict rejects before any deletion; reload restores clean state.
        page.locator('[data-cw-discard-selected="w1"]').click()
        panel.wait_for()
        db["conflict"]=True
        panel.locator('[data-cw-discard-confirm]').click()
        page.wait_for_function("()=>__graphite.getRemote().blocked",timeout=6000)
        assert db["applies"]==0
        assert db["graph"]["nodes"]==base["nodes"]
        page.reload()
        loaded(2)
        page.evaluate("()=>__graphite.fit()")

        # Select an alpha event and delete the whole alpha branch in one CAS.
        page.locator('[data-cw-node="a"]').click()
        page.locator('[data-cw-discard-branch="alpha"]').click()
        panel=page.locator('[data-cw-discard-review="w1"]')
        panel.wait_for()
        assert "Удалить 2 черновиков?" in panel.inner_text()
        assert db["applies"]==0
        panel.locator('[data-cw-discard-confirm]').click()
        loaded(3,1)
        assert db["applies"]==1 and db["puts"]==0
        assert page.locator('[data-cw-node="c"]').count()==1
        assert page.locator('[data-cw-node="a"]').count()==0
        assert page.locator('[data-cw-node="b"]').count()==0
        assert db["graph"]["edges"]==[e for e in base["edges"] if e["id"]!="ea"]
        assert db["graph"]["workspaces"]==base["workspaces"]
        assert db["graph"]["gapNotes"]==base["gapNotes"]

        # Keyboard selection supports deleting the final draft; no orphan area.
        page.locator('[data-cw-node="c"]').focus()
        page.keyboard.press("Enter")
        page.locator('[data-cw-discard-selected="w1"]').click()
        panel=page.locator('[data-cw-discard-review="w1"]')
        panel.wait_for()
        assert "пустая рабочая область исчезнет" in panel.inner_text()
        assert "исходной заметкой" in panel.inner_text()
        panel.locator('[data-cw-discard-confirm]').click()
        loaded(4,0)
        assert db["applies"]==2 and db["puts"]==0
        assert db["graph"]["workspaces"]==[]
        assert db["graph"]["gapNotes"]==[]
        assert db["graph"]["nodes"]==original_canon
        assert page.locator('[data-cw-workspace="w1"]').count()==0
        page.reload()
        loaded(4,0)
        assert not errors,errors
        context.close();browser.close()
    print(json.dumps({"result":"PASS","writes":db["applies"],"genericPUT":db["puts"],
      "cases":["cancel","boundary relation review","stale CAS","whole branch",
               "keyboard selection","empty-area cleanup","legacy note cleanup",
               "reload","protected canon"]},ensure_ascii=False))

if __name__=="__main__":
    main()
