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
  # All four actions must perform their advertised formatting, not just render labels.
  def select_block(index):
   page.evaluate("""(index)=>{
    const e=document.querySelector('[data-canvas-text-editor]');
    const block=e.querySelectorAll('p,h3,blockquote')[index];
    const r=document.createRange();r.selectNodeContents(block);
    const s=getSelection();s.removeAllRanges();s.addRange(r);
   }""",index)
   menu.wait_for(state="visible")
  select_block(0)
  menu.locator('[data-ct-format="heading"]').click()
  page.wait_for_function("()=>__graphite.getState().canvasTexts[0].blocks[0].type==='heading'")
  select_block(1)
  menu.locator('[data-ct-format="underline"]').click()
  page.wait_for_function("()=>__graphite.getState().canvasTexts[0].blocks[1].runs.some(r=>r.underline)")
  select_block(1)
  menu.locator('[data-ct-format="quote"]').click()
  page.wait_for_function("()=>__graphite.getState().canvasTexts[0].blocks[1].type==='quote'")
  # Selection collapsed -> menu gone.
  editor.click()
  page.wait_for_function("()=>document.querySelector('.canvas-text-format').hidden")
  # No permanent gray grab strip or single corner grip survives UX-126.
  assert page.locator(".canvas-text-grab,.canvas-text-resize").count()==0
  assert page.locator(".canvas-text-edge").count()==6
  page.locator("#close-inspect").click()
  top=page.locator(".canvas-text-edge-move")
  top.hover()
  assert top.evaluate("(e)=>getComputedStyle(e).cursor")=="grab"
  assert float(top.evaluate("(e)=>getComputedStyle(e,'::after').opacity"))>0
  assert page.locator(".canvas-text-editor").evaluate("(e)=>getComputedStyle(e).cursor")=="text"
  def box():return page.evaluate("()=>structuredClone(__graphite.getState().canvasTexts[0])")
  def drag(name,dx,dy):
   edge=page.locator(".canvas-text-edge-"+name)
   rect=edge.bounding_box()
   assert rect is not None,name
   cx=rect["x"]+rect["width"]/2
   cy=rect["y"]+rect["height"]/2
   page.mouse.move(cx,cy)
   page.mouse.down()
   page.mouse.move(cx+dx,cy+dy,steps=8)
   page.mouse.up()
   return box()
  # Every side and both bottom corners provide visible resize feedback.
  initial=box()
  right=drag("right",90,0)
  assert right["width"]>initial["width"] and right["x"]==initial["x"]
  left=drag("left",55,0)
  assert left["x"]>right["x"] and left["width"]<right["width"]
  assert left["x"]+left["width"]==right["x"]+right["width"]
  down=drag("bottom",0,75)
  assert down["height"]>left.get("height",0)
  shorter=drag("bottom",0,-30)
  assert shorter["height"]<down["height"]
  corner_right=drag("bottom-right",50,40)
  assert corner_right["width"]>shorter["width"] and corner_right["height"]>shorter["height"]
  corner_left=drag("bottom-left",-40,30)
  assert corner_left["width"]>corner_right["width"] and corner_left["x"]<corner_right["x"]
  assert corner_left["height"]>corner_right["height"]
  # The top edge moves, without changing dimensions or inheriting field tags.
  before=box()
  moved=drag("move",80,40)
  assert (before["x"],before["y"])!=(moved["x"],moved["y"])
  assert (before["width"],before["height"])==(moved["width"],moved["height"])
  assert moved["parent"] is None
  assert "fieldId" not in moved and "workspaceId" not in moved
  page.wait_for_timeout(1600)
  ready()
  assert db["writes"]>0
  assert len(db["graph"]["canvasTexts"])==1
  # A second text block may be placed inside the field without inheriting its tags.
  page.locator("#add-canvas-text").click()
  second=page.locator("[data-canvas-text-editor]").last
  second.type("Свободное пояснение внутри поля")
  second.press("Tab")
  page.wait_for_timeout(1400)
  ready()
  assert len(db["graph"]["canvasTexts"])==2
  # Save and reopen — all editor-only data and formatting must survive.
  page.reload();ready()
  page.wait_for_function("()=>Array.isArray(__graphite.getState().canvasTexts)&&__graphite.getState().canvasTexts.length===2")
  new=page.evaluate("()=>structuredClone(__graphite.getState().canvasTexts[0])")
  assert new["blocks"]==db["graph"]["canvasTexts"][0]["blocks"]
  assert new["width"]>420
  assert len(db["graph"]["canvasTexts"])==2
  assert db["graph"]["canvasTexts"][1]["blocks"][0]["runs"][0]["text"]=="Свободное пояснение внутри поля"
  assert (new["x"],new["y"])==(moved["x"],moved["y"])
  assert page.locator('[data-node="n1"]').count()==1
  assert db["graph"]["edges"]==GRAPH["edges"]
  assert not errors,errors
  browser.close()
  print("UX-126: inline create/edit, four-action selection, independent move, autosave, F5 OK")
if __name__=="__main__":
 main()
