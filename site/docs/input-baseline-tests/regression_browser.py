import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'public/index.html').read_text();out=[]
def test(n,fn):
 try:detail=fn();print('PASS',n);out.append({'test':n,'status':'PASS','detail':str(detail)[:160]})
 except Exception as e:print('FAIL',n,e);out.append({'test':n,'status':'FAIL','detail':repr(e)})
def assert_no_errors(err):
 if err:raise AssertionError(err)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':900})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.evaluate('''() => {window.__store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__store.get(k)||null,setItem:(k,v)=>window.__store.set(k,v),removeItem:k=>window.__store.delete(k)}})}''')
 page.set_content(html)
 def graph():return page.evaluate('window.__graphite.getState()')
 def selected_node():
  start=graph()['revision'];page.evaluate('window.__graphite.selectNode("n1")');plan=page.evaluate('window.__graphite.getEdgePlan()');assert 'e1' in plan['displayed'] and graph()['revision']==start;return plan['displayed']
 test('selected node reveals true edge without mutation',selected_node)
 def field_drag():
  st=graph();page.evaluate('window.__graphite.moveField("f1",175,90,true)');now=graph();assert now['fields'][0]['x']-st['fields'][0]['x']==175;assert now['nodes'][0]['x']-st['nodes'][0]['x']==175;page.evaluate('window.__graphite.undo()');assert graph()['nodes'][0]['x']==st['nodes'][0]['x'];return now['revision']
 test('field drag carries child nodes; undo atomic',field_drag)
 def edge_view():
  st=graph();page.evaluate('window.__graphite.setAllEdges(true)');a=page.evaluate('window.__graphite.getEdgePlan()');assert len(a['displayed'])==len(st['edges']);page.evaluate('window.__graphite.setAllEdges(false)');assert graph()['edges']==st['edges'];return len(a['displayed'])
 test('all edges mode preserves graph',edge_view)
 def field_create():
  page.evaluate('window.__graphite.createField()');page.locator('#entry').fill('Культивация');page.locator('#dialog').locator('button[type=submit]').click();page.wait_for_timeout(150);assert any(f['title']=='Культивация' for f in graph()['fields']);return len(graph()['fields'])
 test('new field modal saves and shows field',field_create)
 def persist_reload():
  old=graph();prior=page.evaluate('window.__graphite.getProjectIndex()');page.set_content(html,wait_until='domcontentloaded');after=graph();assert len(after['fields'])==len(old['fields']);assert page.evaluate('window.__graphite.getProjectIndex()')['activeId']==prior['activeId'];return len(after['fields'])
 test('same-browser persistence survives app initialization',persist_reload)
 def project_copy():
  before=page.evaluate('window.__graphite.getProjectIndex()');page.evaluate('async ()=>await window.__graphite.createProject("Новая история 2",window.__graphite.blankGraph())');new=graph();assert len(new['nodes'])==0;assert len(page.evaluate('window.__graphite.getProjectIndex().projects'))==len(before['projects'])+1;return new['revision']
 test('second project is empty and independent',project_copy)
 def restore_old():
  ids=page.evaluate('window.__graphite.getProjectIndex().projects.map(x=>x.id)');page.evaluate('async id=>await window.__graphite.openProject(id)',ids[-1]);assert len(graph()['nodes'])==6;return len(graph()['nodes'])
 test('previous project retains graph after switch',restore_old)
 test('no uncaught script errors',lambda:assert_no_errors(errors))
 page.screenshot(path=str(ROOT/'public/screenshot.png'))
 page.locator('#projects-open').click();page.screenshot(path=str(ROOT/'public/projects_screenshot.png'))
 browser.close()
(ROOT/'tests/regression_results.json').write_text(json.dumps({'passed':sum(x['status']=='PASS' for x in out),'total':len(out),'tests':out},ensure_ascii=False,indent=2))
if any(x['status']=='FAIL' for x in out):raise SystemExit(1)
