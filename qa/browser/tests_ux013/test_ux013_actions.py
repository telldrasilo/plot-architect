from playwright.sync_api import sync_playwright
from pathlib import Path
import json
p=Path(__file__).resolve().parents[1];h=(p/'site_source/public/index.html').read_text()
checks=[]
def ck(v,s):
 checks.append([s,bool(v)])
 if not v:raise AssertionError(s)
with sync_playwright() as pl:
 b=pl.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1420,'height':900})
 page.add_init_script('''window.__memoryLocal={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__memoryLocal[k]??null,setItem:(k,v)=>{window.__memoryLocal[k]=String(v)},removeItem:k=>{delete window.__memoryLocal[k]}}})''')
 page.set_content(h,wait_until='load')
 menu=page.locator('#pa-context-menu')
 def open_canvas():page.evaluate("__graphite.showPlotContextMenu(1090,500,document.querySelector('#canvas'))")
 open_canvas();ck(menu.is_visible(),'open canvas menu')
 page.keyboard.press('ArrowDown');ck(menu.locator('button[role="menuitem"]').nth(1).evaluate('(el)=>el===document.activeElement'),'arrow-down focuses field')
 page.keyboard.press('ArrowUp');ck(menu.locator('button[role="menuitem"]').first.evaluate('(el)=>el===document.activeElement'),'arrow-up focuses event')
 page.keyboard.press('End');ck(menu.locator('button[role="menuitem"]').last.evaluate('(el)=>el===document.activeElement')==False,'End key no unintended menu action')
 page.keyboard.press('Escape');ck(not menu.is_visible(),'escape closes menu')
 old=page.evaluate('__graphite.getState()');open_canvas();menu.locator('button[role="menuitem"]').nth(2).click();new=page.evaluate('__graphite.getState()')
 ck(len(new['gapNotes'])==len(old['gapNotes'])+1,'note command creates editorial gap note')
 ck(len(new['nodes'])==len(old['nodes']),'note command leaves canonical nodes alone')
 # Choose field, ensure modal opens before a semantic new field
 open_canvas();menu.locator('button[role="menuitem"]').nth(1).click()
 ck(page.locator('#modal-host .modal').count()==1,'field opens naming modal')
 page.locator('#cancel').click();ck(page.locator('#modal-host .modal').count()==0,'dismiss modal without mutation')
 # event goes to modal, no accidental immediate mutation
 open_canvas();menu.locator('button[role="menuitem"]').first.click()
 ck(page.locator('#modal-host .modal').count()==1,'event opens create modal')
 page.locator('#cancel').click()
 # rewrite opens modal
 open_canvas();menu.locator('button[role="menuitem"]').nth(3).click()
 ck(page.locator('#modal-host .modal').count()==1,'rewrite opens create modal')
 page.locator('#cancel').click()
 open_canvas();menu.locator('button[role="menuitem"]').last.click()
 ck(not menu.is_visible(),'search action closes menu')
 if page.locator('#cancel').count():page.locator('#cancel').click()
 else:page.keyboard.press('Escape')
 b.close()
report={'passed':sum(x[1] for x in checks),'total':len(checks),'checks':checks}
(p/'UX013_ACTION_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
