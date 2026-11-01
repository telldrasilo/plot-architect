from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'public/index.html').read_text()
store={};record={};writes=[];private='remote-very-long-owner-token-987654321';errors=[];tests=[]
def chk(name,fn):
 try:
  detail=fn();tests.append({'name':name,'status':'PASS','detail':str(detail)[:120]});print('PASS',name,detail)
 except Exception as e:
  tests.append({'name':name,'status':'FAIL','detail':repr(e)});print('FAIL',name,repr(e))
def handler(route):
 req=route.request;url=req.url;method=req.method
 if url=='https://pa.local/':return route.fulfill(status=200,body=html,content_type='text/html')
 if url.endswith('/api/health'):return route.fulfill(status=200,json={'ok':True,'requiresAuthorization':True})
 if '/api/' not in url:return route.fulfill(status=404,body='no')
 if req.headers.get('authorization')!='Bearer '+private:return route.fulfill(status=401,json={'error':'AUTH_REQUIRED','message':'Требуется ключ'})
 path=url.split('https://pa.local')[1]
 if path=='/api/projects' and method=='GET':return route.fulfill(status=200,json={'projects':[{k:v for k,v in rec.items() if k in ('id','name','revision')} for rec in store.values()]})
 if path=='/api/projects' and method=='POST':
  b=req.post_data_json;id='faux-'+str(len(store)+1);o={'id':id,'name':b['name'],'graph':b['graph'],'revision':0};store[id]=o;return route.fulfill(status=201,json=o)
 if path.startswith('/api/projects/'):
  id=path.split('/')[3];o=store.get(id)
  if not o:return route.fulfill(status=404,json={'error':'NOT_FOUND'})
  if method=='GET':return route.fulfill(status=200,json=o)
  b=req.post_data_json
  if method=='PUT':
   if b['expectedRevision']!=o['revision']:return route.fulfill(status=409,json={'error':'REVISION_CONFLICT','currentRevision':o['revision']})
   o['revision']+=1;o['graph']=b['graph'];o['name']=b['name'];writes.append({'id':id,'revision':o['revision'],'nodes':len(o['graph']['nodes'])});return route.fulfill(status=200,json={'id':id,'name':o['name'],'revision':o['revision']})
 return route.fulfill(status=404,json={'error':'NOT_FOUND'})
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1366,'height':768})
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.evaluate("""() => {
 window.__remoteMock={projects:{},writes:[],token:'remote-very-long-owner-token-987654321'};
 window.__store=new Map();
 Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__store.get(k)||null,setItem:(k,v)=>window.__store.set(k,v),removeItem:k=>window.__store.delete(k)}});
 Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem:k=>window.__store.get('session:'+k)||null,setItem:(k,v)=>window.__store.set('session:'+k,v),removeItem:k=>window.__store.delete('session:'+k)}});
 window.fetch=async (path,opts={})=>{
   let m=window.__remoteMock;let route=String(path);let method=opts.method||'GET';let payload=opts.body?JSON.parse(opts.body):null;
   const out=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
   if(route==='/api/health')return out({ok:true});
   if((opts.headers?.Authorization||'')!=='Bearer '+m.token)return out({error:'AUTH_REQUIRED',message:'Требуется ключ'},401);
   if(route==='/api/projects'){
     if(method==='GET')return out({projects:Object.values(m.projects).map(({id,name,revision})=>({id,name,revision}))});
     if(method==='POST'){const id='faux-'+(Object.keys(m.projects).length+1);const r={id,name:payload.name,revision:0,graph:payload.graph};m.projects[id]=r;return out(r,201)}
   }
   const id=route.split('/')[3],item=m.projects[id];if(!item)return out({error:'NOT_FOUND'},404);
   if(method==='GET')return out(item);
   if(method==='PUT'){
     if(payload.expectedRevision!==item.revision)return out({error:'REVISION_CONFLICT',currentRevision:item.revision},409);
     item.revision++;item.graph=payload.graph;item.name=payload.name;m.writes.push({id,revision:item.revision,nodes:item.graph.nodes.length});return out({id,name:item.name,revision:item.revision})
   }
   return out({error:'NOT_FOUND'},404)
 }
}""")
 page.set_content(html,wait_until='domcontentloaded')
 def connect():
  page.locator('#projects-open').click()
  page.once('dialog',lambda d:d.accept(private))
  page.locator('#pm-connect').click()
  page.wait_for_function("() => document.querySelector('#project-mode')?.textContent.includes('Site')",timeout=6500)
  assert page.evaluate('Object.keys(window.__remoteMock.projects).length')==1 and page.evaluate('window.__graphite.getRemote().connected')
  return page.evaluate('Object.keys(window.__remoteMock.projects)')
 chk('first Site connection creates project',connect)
 def autosave():
  page.evaluate("window.__graphite.addNode('Изменение в Site')")
  page.wait_for_function("() => document.querySelector('#saved')?.textContent.includes('Сохранено в Site')",timeout=10000)
  assert page.evaluate('window.__remoteMock.writes.length')>=1 and page.evaluate('Object.values(window.__remoteMock.projects)[0].graph.nodes.length')==7
  return page.evaluate('window.__remoteMock.writes.at(-1)')
 chk('graph edit autosaves to D1 API',autosave)
 def conflict():
  page.evaluate('Object.values(window.__remoteMock.projects)[0].revision++')
  page.evaluate("window.__graphite.addNode('Сохранить локальную копию')")
  page.wait_for_function("() => window.__graphite.getRemote().blocked",timeout=10000)
  assert page.evaluate("window.__graphite.getState().nodes.at(-1).title")=='Сохранить локальную копию'
  return page.locator('#saved').inner_text()
 chk('conflict halts remote overwrite but preserves local copy',conflict)
 chk('final no page errors',lambda:len(errors)==0 or (_ for _ in ()).throw(AssertionError(errors)))
 page.screenshot(path=str(ROOT/'public/site_connected_screenshot.png'))
 remote_writes=page.evaluate('window.__remoteMock.writes')
 browser.close()
ROOT.joinpath('tests/remote_client_results.json').write_text(json.dumps({'tests':tests,'passed':sum(x['status']=='PASS' for x in tests),'total':len(tests),'writes':remote_writes},indent=2,ensure_ascii=False))
if any(x['status']=='FAIL' for x in tests):raise SystemExit(1)
