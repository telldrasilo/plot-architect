from pathlib import Path
import json,traceback
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def chk(name,fn):
 try:
  out=fn();checks.append({'name':name,'status':'PASS','detail':str(out)[:180]});print('PASS',name,out)
 except Exception as e:
  checks.append({'name':name,'status':'FAIL','detail':str(e)});print('FAIL',name,repr(e))
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':900})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.evaluate('''() => {window.__store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__store.get(k)||null,setItem:(k,v)=>window.__store.set(k,v),removeItem:k=>window.__store.delete(k)}})}''')
 html=(ROOT/'public/index.html').read_text();page.set_content(html,wait_until='domcontentloaded')
 chk('UI bootstrap without errors',lambda: len(errors)==0 or (_ for _ in ()).throw(AssertionError(errors)))
 chk('project picker opens',lambda:page.locator('#projects-open').click() or page.locator('#pm-list').count()==1)
 def new_project():
  page.once('dialog',lambda d:d.accept('Война за престол'))
  page.locator('#pm-new').click()
  assert page.locator('#project-current').inner_text()=='Война за престол'
  assert len(page.evaluate('window.__graphite.getState().nodes'))==0
  return page.evaluate('window.__graphite.getProjectIndex()')
 chk('new project',new_project)
 def new_node():
  page.evaluate("window.__graphite.addNode('Сбор военного совета')")
  assert len(page.evaluate('window.__graphite.getState().nodes'))==1
  return page.evaluate('window.__graphite.getState().nodes[0].title')
 chk('new node persists in project state',new_node)
 def switch_back():
  pr=page.evaluate('window.__graphite.getProjectIndex()')
  old=pr['projects'][-1]['id']; page.evaluate('async id=>await window.__graphite.openProject(id)',old)
  assert len(page.evaluate('window.__graphite.getState().nodes'))==6
  newid=pr['projects'][0]['id'];page.evaluate('async id=>await window.__graphite.openProject(id)',newid)
  assert page.evaluate('window.__graphite.getState().nodes[0].title')=='Сбор военного совета'
  return len(pr['projects'])
 chk('switching projects does not mix nodes',switch_back)
 def import_legacy():
  base=page.evaluate('window.__graphite.getState()')
  base['nodes'][0]['title']='Импорт'
  normalized=page.evaluate('(g)=>window.__graphite.validateImported(g)',base)
  assert normalized['nodes'][0]['title']=='Импорт'
  return normalized['revision']
 chk('legacy graph import contract',import_legacy)
 def camera():
  before=page.evaluate('window.__graphite.getState().revision')
  page.evaluate('window.__graphite.fit()');assert page.evaluate('window.__graphite.getState().revision')==before
  return before
 chk('camera preserves graph revision',camera)
 page.screenshot(path=str(ROOT/'public/screenshot.png'))
 chk('final no uncaught errors',lambda:len(errors)==0 or (_ for _ in ()).throw(AssertionError(errors)))
 browser.close()
ROOT.joinpath('tests/client_results.json').write_text(json.dumps({'tests':checks,'passed':sum(t['status']=='PASS' for t in checks),'total':len(checks)},indent=2,ensure_ascii=False))
if any(t['status']=='FAIL' for t in checks):raise SystemExit(1)
