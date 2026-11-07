"""UX-126: synthetic browser regression for independent inline canvas text.
Mocked HTTP, disposable graph only. Never touches owner SQLite or tunnel.
"""
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

HTML=(Path(__file__).resolve().parents[3]/"site/public/index.html").read_text(encoding="utf-8")
BASE="http://127.0.0.1:8788"
PROJECT="ux126-browser-synthetic"
GRAPH={
  "version":1,"revision":0,"view":None,"nextNode":3,"nextEdge":2,
  "nextField":2,"nextLine":2,
  "nodes":[
    {"id":"n1","title":"01 · Событие B","description":"Синтетический оригинал","x":170,"y":190,
     "parent":None,"lineIds":["l1"],"size":"normal"},
    {"id":"n2","title":"01 · Следствие C","description":"Синтетический результат","x":850,"y":210,
     "parent":None,"lineIds":["l1"],"size":"normal"}
  ],
  "edges":[{"id":"e1","from":"n1","to":"n2","type":"precedes"}],
  "fields":[{"id":"f1","title":"QA поле","comment":"Не владеет аннотациями",
   "color":"#b8a16e","x":110,"y":120,"width":930,"height":350,"assignmentMode":"auto","parent":None}],
  "lanes":[{"id":"l1","title":"Test","color":"#b8a16e","y":180}]
}
def main():
 db={"graph":copy.deepcopy(GRAPH),"revision":0,"writes":0}
 errors=[]
 def respond(route):
  path=urlsplit(route.request.url).path
  method=route.request.method
  def send(data,status=200):
   route.fulfill(status=status,content_type="application/json",body=json.dumps(data,ensure_ascii=False))
  if path=="/" and method=="GET":
   route.fulfill(status=200,content_type="text/html; charset=utf-8",body=HTML)
  elif path=="/api/health":
   send({"ok":True,"authenticated":True,"authMode":"node-loopback","workflowEnabled":True})
  elif path=="/api/projects" and method=="GET":
   send({"projects":[{"id":PROJECT,"name":"UX126 synthetic","revision":db["revision"]}]})
  elif path=="/api/projects/"+PROJECT and method=="GET":
   send({"id":PROJECT,"name":"UX126 synthetic","revision":db["revision"],"graph":copy.deepcopy(db["graph"])})
  elif path=="/api/projects/"+PROJECT and method=="PUT":
   body=json.loads(route.request.post_data or "{}")
   assert body["expectedRevision"]==db["revision"],"revision/CAS must match"
   def nodes(g): return [(n["id"],n["title"],n["description"],n["x"],n["y"]) for n in g["nodes"]]
   assert nodes(body["graph"])==nodes(GRAPH),"text must not mutate canon nodes"
   assert body["graph"]["edges"]==GRAPH["edges"],"text must not mutate story arrows"
   db["graph"]=copy.deepcopy(body["graph"])
   db["revision"]+=1
   db["graph"]["revision"]=db["revision"]
   db["writes"]+=1
   send({"revision":db["revision"],"id":PROJECT,"name":"UX126 synthetic"})
  else: send({"error":"NOT_FOUND"},404)
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
  ctx=browser.new_context(viewport={"width":1500,"height":980})
  ctx.route(BASE+"/**",respond)
  page=ctx.new_page()
  page.on("pageerror",lambda e:errors.append(str(e)))
  def ready():
   page.wait_for_function("()=>window.__graphite&&__graphite.getRemote().connected"
      "&&!__graphite.getRemote().busy&&!__graphite.getRemote().dirty")
  page.goto(BASE+"/")
  ready()
  page.locator("#add-canvas-text").click()
  editor=page.locator("[data-canvas-text-editor]").first
  editor.wait_for()
  assert editor.evaluate("(e)=>document.activeElement===e"),"single click creates active inline editor"
  assert not page.locator("#modal-host .modal").count(),"no modal or settings window"
  editor.type("Тест 03 — завершение замены",delay=1)
  editor.press("Enter")
  editor.type("Проверить все связи",delay=1)
  # Text remains on canvas when another object is selected.
  page.locator('[data-node="n1"]').click()
  assert page.locator('[data-canvas-text]').count()==1
  assert "Тест 03" in page.locator('[data-canvas-text]').inner_text()
  editor=page.locator("[data-canvas-text-editor]").first
  editor.click()
  # User selection alone brings exactly four contextual commands.
  page.evaluate("""()=>{
    const e=document.querySelector('[data-canvas-text-editor]');
    const node=[...e.querySelectorAll('p')].at(-1).firstChild;
    const r=document.createRange();r.selectNodeContents(node);
    const s=getSelection();s.removeAllRanges();s.addRange(r);
  }""")
  menu=page.locator(".canvas-text-format")
  menu.wait_for(state="visible")
  assert menu.locator("button").all_text_contents()==[
   "Сделать заголовком","Курсив","Подчеркнуть","Цитата"]
  menu.locator('[data-ct-format="italic"]').click()
  page.wait_for_function("()=>__graphite.getState().canvasTexts[0].blocks.some(b=>b.runs.some(r=>r.italic))")
  assert not page.locator("#modal-host .modal").count()
  # Selection collapsed -> menu gone.
  editor.click()
  page.wait_for_function("()=>document.querySelector('.canvas-text-format').hidden")
  # Move the annotation across the semantic field; it never inherits field tags.
  grab=page.locator(".canvas-text-grab").first
  before=page.evaluate("()=>structuredClone(__graphite.getState().canvasTexts[0])")
  # The ordinary node inspector may overlap the annotation drag handle.
  # The annotation itself remains visible; dismiss the inspector before moving it.
  page.locator("#close-inspect").click()
  box=grab.bounding_box()
  print("UX126 GRAB",page.evaluate("""()=>{
   const g=document.querySelector('.canvas-text-grab'),r=g.getBoundingClientRect();
   const target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},target:target?.outerHTML?.slice(0,180),
    opacity:getComputedStyle(g).opacity};
  }"""),flush=True)
  page.mouse.move(box["x"]+box["width"]/2,box["y"]+box["height"]/2)
  page.mouse.down()
  page.mouse.move(box["x"]+box["width"]/2+480,box["y"]+box["height"]/2+380,steps=8)
  page.mouse.up()
  moved=page.evaluate("()=>structuredClone(__graphite.getState().canvasTexts[0])")
  assert (before["x"],before["y"])!=(moved["x"],moved["y"])
  assert moved["parent"] is None
  assert "fieldId" not in moved and "workspaceId" not in moved
  page.wait_for_timeout(1600)
  ready()
  assert db["writes"]>0
  assert len(db["graph"]["canvasTexts"])==1
  # Save and reopen — all editor-only data and formatting must survive.
  page.reload();ready()
  new=page.evaluate("()=>structuredClone(__graphite.getState().canvasTexts[0])")
  assert new["blocks"]==db["graph"]["canvasTexts"][0]["blocks"]
  assert (new["x"],new["y"])==(moved["x"],moved["y"])
  assert page.locator('[data-node="n1"]').count()==1
  assert db["graph"]["edges"]==GRAPH["edges"]
  assert not errors,errors
  browser.close()
  print("UX-126: inline create/edit, four-action selection, independent move, autosave, F5 OK")
if __name__=="__main__":
 main()
