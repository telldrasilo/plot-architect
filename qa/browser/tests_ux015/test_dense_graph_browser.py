from playwright.sync_api import sync_playwright
from pathlib import Path
import json
BASE=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1280,'height':840});errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.evaluate('''window.__memoryLocal={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__memoryLocal[k]??null,setItem:(k,v)=>{window.__memoryLocal[k]=String(v)},removeItem:k=>{delete window.__memoryLocal[k]},clear:()=>{window.__memoryLocal={}}}})''')
 page.set_content((BASE/'site_source/public/index.html').read_text(),wait_until='load')
 fixture={'version':1,'revision':0,'nextNode':181,'nextEdge':1,'nextField':2,'nextLine':2,'view':None,'nodes':[{'id':'n'+str(i),'title':'Событие '+str(i)+' — неоднозначные последствия','description':'Некоторое подробное описание событие, обстоятельства и обстоятельства','x':100+(i%15)*265,'y':140+(i//15)*125,'lineIds':['l1'],'parent':None} for i in range(1,181)],'edges':[], 'fields':[{'id':'f1','title':'Большое поле','color':'#ab9875','x':50,'y':90,'width':4050,'height':1700,'assignmentMode':'auto','parent':None}], 'lanes':[{'id':'l1','title':'Главная','color':'#ab9875','y':180}]}
 page.evaluate('(f)=>__graphite.loadFixture(f)',fixture)
 page.evaluate('()=>__graphite.setZoomForTest(.26)')
 info=page.evaluate('''()=>({mode:__graphite.getSemanticZoom(),dots:document.querySelectorAll('.pa-semantic-dot').length,labels:document.querySelectorAll('.pa-semantic-label:not([hidden])').length,renderTime:__graphite.getPerf().lastRenderMs,rev:__graphite.getState().revision,geometry:getComputedStyle(document.querySelector('.node')).visibility})''')
 assert info['mode']=='map' and info['dots']>50 and info['labels']>0 and info['geometry']=='hidden' and info['rev']==0,info
 assert not errs,errs
 print(json.dumps(info))
 b.close()
