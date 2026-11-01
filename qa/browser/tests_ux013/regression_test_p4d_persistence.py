from pathlib import Path
from playwright.sync_api import sync_playwright
import json
H=(Path(__file__).resolve().parents[1]/'site_source/public/index.html').read_text()
report=[]
def ok(v,name):
 report.append({'name':name,'passed':bool(v)})
 if not v:raise AssertionError(name)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1500,'height':900});errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(H,wait_until='load')
 # synthetic independent graph, not preserved legacy story
 fixture=page.evaluate('__graphite.blankGraph()')
 fixture['nodes']=[{'id':'n1','title':'Событие','description':'Короткое описание','x':400,'y':320,'size':'normal','parent':None,'status':'proposed','lineIds':['l1'],'manualFieldIds':[], 'manualTags':[]}]
 fixture['nextNode']=2
 fixture['fields']=[{'id':'f1','title':'Фракция','comment':'','color':'#8a9d83','x':380,'y':270,'width':390,'height':300,'parent':None,'assignmentMode':'auto'}]
 fixture['nextField']=2
 page.evaluate('(g)=>__graphite.loadFixture(g)',fixture)
 ok(page.evaluate('__graphite.getState().nodes.length')==1,'isolated graph loaded')
 gid=page.evaluate('()=>__graphite.newGapNote({x:680,y:90})')
 ok(page.evaluate('(gid)=>__graphite.getState().gapNotes.some(n=>n.id===gid)',gid),'note created in graph')
 page.locator('#gap-text').fill('Нужен новый конфликт и два конкурирующих последствия');page.locator('#gap-text').press('Tab')
 page.evaluate('(gid)=>{__graphite.beginGapLink("gap_note",gid)}',gid)
 # actual click on event card
 page.locator('[data-node="n1"]').click(position={'x':70,'y':35})
 ok(len(page.evaluate('__graphite.getGapLinks()'))==1,'UI click created note-event link')
 ok(page.evaluate('__graphite.getState().edges.length')==0,'no accidental causal edge')
 page.evaluate('(gid)=>{__graphite.beginGapLink("gap_note",gid)}',gid)
 page.locator('[data-field="f1"] .field-head').click(force=True)
 ok(len(page.evaluate('__graphite.getGapLinks()'))==2,'UI field click created note-field link')
 before=page.evaluate('__graphite.getState()')
 page.evaluate('__graphite.undo()')
 ok(len(page.evaluate('__graphite.getGapLinks()'))==1,'undo editorial link only')
 page.evaluate('__graphite.undo()')
 ok(len(page.evaluate('__graphite.getGapLinks()'))==0,'undo event link')
 ok(len(page.evaluate('__graphite.getGapNotes()'))==1,'note preserved after undo links')
 # loadFixture roundtrip with edited note restores both arrays
 page.evaluate('(g)=>__graphite.loadFixture(g)',before)
 ok(page.evaluate('__graphite.getGapNotes()[0].text').startswith('Нужен новый конфликт'),'note text restored from graph')
 ok(len(page.evaluate('__graphite.getGapLinks()'))==2,'links restored from graph')
 # delete note, with accept dialog
 page.on('dialog',lambda d:d.accept());page.evaluate('(gid)=>{__graphite.selectNode("n1");}',gid)
 page.evaluate('(gid)=>{const n=__graphite.getGapNotes().find(n=>n.id===gid);if(!n)throw Error("missing");}',gid)
 page.locator(f'[data-gap-note="{gid}"]').click()
 ok(page.locator('#gap-delete').is_visible(),'note inspector deletion action')
 page.locator('#gap-delete').click()
 ok(len(page.evaluate('__graphite.getGapNotes()'))==0,'note removed')
 ok(len(page.evaluate('__graphite.getGapLinks()'))==0,'note links removed')
 ok(len(page.evaluate('__graphite.getState().nodes'))==1,'plot event survives note deletion')
 page.evaluate('__graphite.undo()')
 ok(len(page.evaluate('__graphite.getGapLinks()'))==2,'undo restores note and links atomically')
 # lower inline rewrite instruction no input box or menu action
 page.evaluate('()=>__graphite.createEditorialField("Переписать часть",[],{x:10,y:20,width:450,height:300})')
 ui=page.locator('.editorial-inline-note');ok(ui.is_visible(),'inline rewrite instruction visible')
 ui.click(force=True);ui.fill('Не трогать участников, изменить конфликт');ui.press('Tab')
 ok('Не трогать' in page.evaluate('__graphite.getEditorialNotes()[0].text'),'inline instruction persists')
 ok(page.locator('#ef-instruction').count()==0 and page.locator('#ef-note-focus').count()==0,'no redundant inspector note fields')
 ok(len(errs)==0,'no JS errors: '+str(errs[:2]))
 b.close()
(Path(__file__).resolve().parents[1]/'PERSISTENCE_QA.json').write_text(json.dumps({'passed':len(report),'results':report},ensure_ascii=False,indent=2))
print('PASS',len(report),'checks')
