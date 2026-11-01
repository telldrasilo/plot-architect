from playwright.sync_api import sync_playwright
from pathlib import Path
base=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1365,'height':880},device_scale_factor=1)
 page.evaluate('''window.__memoryLocal={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__memoryLocal[k]??null,setItem:(k,v)=>{window.__memoryLocal[k]=String(v)},removeItem:k=>{delete window.__memoryLocal[k]},clear:()=>{window.__memoryLocal={}}}})''')
 page.set_content((base/'site_source/public/index.html').read_text(),wait_until='load')
 page.locator('#fit').click()
 page.evaluate('()=>__graphite.setZoomForTest(.25)')
 page.evaluate('''()=>document.getElementById('toast').classList.remove('on')''')
 page.screenshot(path=str(base/'UX015_MAP_CLEAN.png'))
 page.evaluate('()=>__graphite.setZoomForTest(.48)')
 page.screenshot(path=str(base/'UX015_COMPACT_CLEAN.png'))
 b.close()
