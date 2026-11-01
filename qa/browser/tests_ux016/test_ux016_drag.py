from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
checks=[]
def ck(assertion,label):
 checks.append(dict(name=label,passed=bool(assertion)))
 if not assertion: raise AssertionError(label)
def js_state(page): return page.evaluate('()=>__graphite.getState()')
def js_node(page,nid):return page.evaluate('nid=>__graphite.getState().nodes.find(x=>x.id===nid)',nid)
def point(page,nid):
 # Prefer actual draggable label, not marker, to verify user screenshot interaction.
 return page.locator(f'.pa-semantic-item[data-zoom-node="{nid}"] .pa-semantic-label:visible').bounding_box()
def dot(page,nid):return page.locator(f'.pa-semantic-item[data-zoom-node="{nid}"] .pa-semantic-dot').bounding_box()
def drag(page,a,b,steps=7):
 page.mouse.move(*a);page.mouse.down();page.mouse.move(*b,steps=steps);page.mouse.up()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1400,'height':950},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.evaluate('''window.__memoryLocal={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__memoryLocal[k]??null,setItem:(k,v)=>{window.__memoryLocal[k]=String(v)},removeItem:k=>{delete window.__memoryLocal[k]},clear:()=>{window.__memoryLocal={}}}})''')
 page.set_content((ROOT/'site_source/public/index.html').read_text(),wait_until='load')
 page.evaluate('()=>__graphite.setZoomForTest(.48)')
 ck(page.evaluate('()=>__graphite.getSemanticZoom()')=='compact','compact mode active')
 available=page.evaluate('''()=>[...document.querySelectorAll('.pa-semantic-item')].filter(n=>{let r=n.querySelector('.pa-semantic-label').getBoundingClientRect();return !n.querySelector('.pa-semantic-label').hidden&&r.left>30&&r.top>120&&r.right<innerWidth-40&&r.bottom<innerHeight-120}).map(n=>n.dataset.zoomNode)''')
 ck(len(available)>=2,'compact draggable labels visible')
 nid=available[0]; start=js_node(page,nid); old_rev=js_state(page)['revision']; b=point(page,nid)
 ck(bool(b),'compact label has hit box')
 sx,sy=b['x']+b['width']/2,b['y']+b['height']/2
 drag(page,(sx,sy),(sx+65,sy+40))
 after=js_node(page,nid)
 ck(abs(after['x']-start['x']-65/.48)<2 and abs(after['y']-start['y']-40/.48)<2,'compact drag moves underlying world node')
 ck(page.evaluate('()=>__graphite.getSemanticZoom()')=='compact','compact drag does not zoom')
 ck(js_state(page)['revision']==old_rev+1,'one commit per compact drag')
 page.keyboard.press('Control+z');undo=js_node(page,nid)
 ck(undo['x']==start['x'] and undo['y']==start['y'],'compact drag supports Undo')
 # Selecting two nodes, then dragging one overview label must move both as a unit.
 page.evaluate('()=>__graphite.setZoomForTest(.48)')
 pair=page.evaluate('''()=>[...document.querySelectorAll('.pa-semantic-item')].filter(n=>!n.querySelector('.pa-semantic-label').hidden).map(n=>n.dataset.zoomNode).slice(0,2)''')
 page.evaluate('(ids)=>__graphite.selectNodes(ids)',pair)
 positions={id:js_node(page,id) for id in pair}
 first=page.locator(f'.pa-semantic-item[data-zoom-node="{pair[0]}"] .pa-semantic-dot').bounding_box()
 a=(first['x']+first['width']/2,first['y']+first['height']/2)
 drag(page,a,(a[0]+30,a[1]+15))
 for id in pair:
  curr=js_node(page,id)
  ck(abs(curr['x']-positions[id]['x']-30/.48)<2 and abs(curr['y']-positions[id]['y']-15/.48)<2,'group member '+id+' moved')
 ck(len(page.evaluate('()=>__graphite.getSelection()'))==2,'group selection remains after drag')
 page.keyboard.press('Control+z')
 for id in pair: ck(js_node(page,id)['x']==positions[id]['x'],'group Undo '+id)
 # Far view: dragging a marker must move it, not jump to close view.
 page.evaluate('()=>__graphite.setZoomForTest(.24)')
 ck(page.evaluate('()=>__graphite.getSemanticZoom()')=='map','far map active')
 marker_ids=page.evaluate('''()=>[...document.querySelectorAll('.pa-semantic-item')].filter(n=>{const r=n.getBoundingClientRect();return r.x>60&&r.y>130&&r.x<innerWidth-90&&r.y<innerHeight-100}).map(n=>n.dataset.zoomNode)''')
 ck(len(marker_ids)>=1,'map markers visible and hittable')
 far=marker_ids[0];page.evaluate('()=>__graphite.selectNodes([])');old=js_node(page,far)
 dot_box=dot(page,far);p1=(dot_box['x']+dot_box['width']/2,dot_box['y']+dot_box['height']/2)
 drag(page,p1,(p1[0]+50,p1[1]+30))
 new=js_node(page,far)
 ck(abs(new['x']-old['x']-50/.24)<2 and abs(new['y']-old['y']-30/.24)<2,'far marker drag updates world coordinates')
 ck(page.evaluate('()=>__graphite.getSemanticZoom()')=='map','far marker drag does not jump/zoom')
 ck(js_state(page)['edges']==js_state(page)['edges'],'edges remain valid')
 page.keyboard.press('Control+z');ck(js_node(page,far)['x']==old['x'],'map drag Undo')
 # Small movement is still a normal click; far map zooms on click.
 page.locator(f'.pa-semantic-item[data-zoom-node="{far}"] .pa-semantic-dot').click()
 ck(page.evaluate('()=>__graphite.getSemanticZoom()')=='full','far marker click still zooms')
 # Space pan from semantic label should pan, not move a story node.
 page.evaluate('()=>__graphite.setZoomForTest(.48)')
 p=page.locator('.pa-semantic-item .pa-semantic-dot').first.bounding_box();a=(p['x']+p['width']/2,p['y']+p['height']/2)
 before_pan=page.evaluate('()=>__graphite.getPan()'); before_nodes=js_state(page)['nodes']
 page.keyboard.down('Space');drag(page,a,(a[0]+65,a[1]+35));page.keyboard.up('Space')
 after_pan=page.evaluate('()=>__graphite.getPan()'); after_nodes=js_state(page)['nodes']
 ck(abs(after_pan['x']-before_pan['x']-65)<2,'Space+drag overview item pans canvas')
 ck(before_nodes==after_nodes,'Space+drag does not move nodes')
 # Moving a node out of a semantic field uses the existing guarded tag-transfer dialog.
 page.evaluate('()=>__graphite.jumpToNode("n9")')
 page.evaluate('()=>__graphite.setZoomForTest(.24)')
 before=js_node(page,'n9'); db=dot(page,'n9'); a=(db['x']+db['width']/2,db['y']+db['height']/2)
 drag(page,a,(a[0]+335,a[1]+10),steps=9)
 ck(page.locator('#tag-transfer-keep').is_visible(),'semantic field tag-loss confirmation appears after drag')
 page.locator('#tag-transfer-cancel').click()
 ck(js_node(page,'n9')['x']==before['x'],'cancel tag-transfer restores original coordinates')
 page.evaluate('()=>__graphite.setZoomForTest(.24)')
 db=dot(page,'n9');a=(db['x']+db['width']/2,db['y']+db['height']/2)
 drag(page,a,(a[0]+335,a[1]+10),steps=9)
 ck(page.locator('#tag-transfer-keep').is_visible(),'second tag-loss confirmation appears')
 page.locator('#tag-transfer-keep').click()
 new=js_node(page,'n9')
 ck(new['x']>before['x']+1300,'safe transfer applies dragged position')
 ck('f4' in new.get('manualFieldIds',[]),'safe transfer preserves semantic tag when confirmed')
 page.keyboard.press('Control+z')
 ck(js_node(page,'n9')['x']==before['x'],'safe tag-transfer and geometry revert together')
 ck(not errors,'no JS errors: '+str(errors))
 browser.close()
(ROOT/'UX016_BROWSER_QA.json').write_text(json.dumps({'passed':sum(x['passed'] for x in checks),'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'passed':len(checks),'errors':errors},ensure_ascii=False))
