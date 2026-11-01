from pathlib import Path
from playwright.sync_api import sync_playwright
import json, traceback
path=(Path(__file__).resolve().parents[1]/'site_source/public/index.html')
results=[]
def check(ok,name):
 results.append({'test':name,'pass':bool(ok)})
 if not ok:raise AssertionError(name)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1500,'height':950})
 errors=[];page.on('pageerror',lambda x:errors.append(str(x)))
 page.add_init_script('''window.__memoryLocal={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__memoryLocal[k]??null,setItem:(k,v)=>{window.__memoryLocal[k]=String(v)},removeItem:k=>{delete window.__memoryLocal[k]}}})''')
 page.set_content(path.read_text(),wait_until='load')
 check(page.locator('#add-gap-note').is_visible(),'gap note visible in toolbar')
 check(page.locator('#add-gap-note').inner_text().strip().endswith('Заметка'),'gap note toolbar name')
 check('Переработка' in page.locator('#add-editorial-field').inner_text(),'rewrite field distinct')
 check('Поле' in page.locator('#add-field').inner_text(),'semantic field distinct')
 check(page.locator('[data-gap-note]').count()==0,'no fabricated gap note in starter')
 state0=page.evaluate('__graphite.getState()')
 page.locator('#add-gap-note').click()
 s1=page.evaluate('__graphite.getState()')
 check(len(s1['gapNotes'])==1,'creates standalone gap note')
 check(len(s1['nodes'])==len(state0['nodes']),'gap note not part of plot nodes')
 gid=s1['gapNotes'][0]['id']
 check(page.locator(f'[data-gap-note="{gid}"]').count()==1,'gap note visual render')
 check(page.locator('#gap-text').is_visible(),'inspector note input')
 check(page.locator('#gap-offer').is_checked(),'three options default')
 page.locator('#gap-text').fill('Придумать неожиданный поворот, не меняя уже утверждённые события')
 page.locator('#gap-text').press('Tab')
 check('неожиданный' in page.evaluate('__graphite.getState()')['gapNotes'][0]['text'],'note text persisted')
 page.locator('#gap-offer').uncheck()
 check(page.evaluate('__graphite.getState()')['gapNotes'][0]['offerVariants'] is False,'single option toggle')
 page.locator('#gap-offer').check()
 check(page.evaluate('__graphite.getState()')['gapNotes'][0]['offerVariants'] is True,'three option toggle restored')
 # semantic field context connection (editorial, not causal)
 page.evaluate(f"__graphite.beginGapLink('gap_note','{gid}')")
 page.evaluate("__graphite.completeGapLink('plot_node','n1')")
 links=page.evaluate('__graphite.getGapLinks()')
 check(len(links)==1 and links[0]['from']['kind']=='gap_note' and links[0]['to']['kind']=='plot_node','editorial link note to plot node')
 check(len(page.evaluate('__graphite.getState()')['edges'])==len(state0['edges']),'editorial link did not change plot edges')
 page.evaluate(f"__graphite.beginGapLink('semantic_field','f1')")
 page.evaluate(f"__graphite.completeGapLink('gap_note','{gid}')")
 check(any(z['from']['kind']=='semantic_field' for z in page.evaluate('__graphite.getGapLinks()')),'field context link')
 check(page.locator('[data-gap-link]').count()==2,'two rendered arrows')
 # text expands even when old card size says compact
 desc='Текст разной длины. '*110
 page.evaluate("(v)=>{const g=__graphite.getState();const n=g.nodes.find(x=>x.id==='n1');n.description=v;n.size='mini';n.height=95;__graphite.loadFixture(g)}",desc)
 card=page.locator('[data-node="n1"]')
 check(card.locator('.node-note').is_visible(),'mini legacy card still shows description')
 dims=card.evaluate('(el)=>({height:el.offsetHeight,sh:el.scrollHeight,nt:el.querySelector(".node-note").scrollHeight,clamped:getComputedStyle(el.querySelector(".node-note")).webkitLineClamp})')
 check(dims['height']>95 and dims['sh']<=dims['height']+2,'adaptive card height no truncation')
 check(dims['clamped']=='none','line clamp removed')
 page.evaluate("__graphite.selectNode('n1')")
 check(page.locator('.node-size-presets').count()==0,'no size presets in inspector')
 check(page.locator('#i-edit-size').count()==0,'no view button')
 # field stripes measured
 page.evaluate("__graphite.createEditorialField('Тест поля',[],{x:100,y:120,width:620,height:360})")
 ed=page.locator('[data-editorial-field]')
 css=ed.evaluate('(el)=>getComputedStyle(el).backgroundImage')
 check('38px' in css and '94px' in css,'wide stripes present')
 check('5%' in css or 'color(srgb' in css or 'color-mix' in css,'low opacity stripe token')
 check(page.locator('.editorial-inline-note').get_attribute('placeholder')=='Что изменить?','inline prompt renamed')
 check('border-top: 0px' in page.locator('.editorial-inline-note').evaluate('(el)=>"border-top: "+getComputedStyle(el).borderTopWidth') or page.locator('.editorial-inline-note').evaluate('(el)=>getComputedStyle(el).borderTopWidth')=='0px','note input frameless')
 # new canvas context menu action, not editorial field context menu action
 page.evaluate('''()=>{const r=document.getElementById('canvas').getBoundingClientRect();window.__graphite.showPlotContextMenu(r.left+50,r.top+40,document.getElementById('canvas'))}''')
 menu=page.evaluate('__graphite.getContextMenuState()')['items']
 check(any('Заметка' in x for x in menu),'canvas right-click offers gap note')
 # remove obsolete editorial instruction action
 page.evaluate("__graphite.showPlotContextMenu(700,370,document.querySelector('[data-editorial-field] .editorial-head'))")
 menu=page.evaluate('__graphite.getContextMenuState()')['items']
 check(not any(x=='Редакторская заметка' for x in menu),'rewrite context menu has no redundant instruction action')
 check(errors==[], 'no JS page exceptions: '+str(errors[:2]))
 # preview
 page.evaluate('''()=>{document.getElementById('pa-context-menu').hidden=true;const el=document.querySelector('[data-editorial-field]');if(el)el.scrollIntoView({block:'center'})}''')
 page.screenshot(path=str(Path(__file__).resolve().parents[1]/'P4D_SCREENSHOT.png'))
 browser.close()
print(json.dumps({'passed':sum(x['pass'] for x in results),'total':len(results),'results':results,'errors':errors},ensure_ascii=False,indent=2))
(Path(__file__).resolve().parents[1]/'BROWSER_QA_P4D.json').write_text(json.dumps({'passed':len(results),'results':results},ensure_ascii=False,indent=2))
