(()=>{'use strict';
const LEGACY_KEY='plot-architect-edge-clarity-v09-20261101';
const REGISTRY_KEY='pa-site01-project-registry';
const SITE_REGISTRY_KEY='pa-site01-site-project-registry';
let activeRegistryStorage=REGISTRY_KEY;
const KEY_PREFIX='pa-site01-graph-';
const PENDING_PREFIX='pa-site01-pending-';
const newLocalId=()=>('local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9));
const STARTER_LOCAL_ID='local-xianxia-rev6-20261101';
const STARTER_NAME='Кризис наследования · Сянься (локально)';
const STARTER_ORIGIN={siteProjectId:'da31da40-9977-4fa7-9042-462a741fc13a',siteRevision:6};
const STARTER_GRAPH={"version":0.8,"revision":4,"nextNode":22,"nextEdge":26,"nextLine":3,"nextField":8,"view":null,"fields":[{"id":"f1","title":"Двор","color":"#b8a16e","x":79,"y":-153,"width":1100,"height":260,"assignmentMode":"auto","parent":null,"comment":""},{"id":"f2","title":"Торговый дом","color":"#8a9d83","x":245,"y":465,"width":820,"height":250,"assignmentMode":"auto","parent":null,"comment":""},{"id":"f3","title":"Порядок духовных жил","comment":"Политико-хозяйственные правила доступа к духовному сырью; это не магический закон и не пророчество.","x":-1100,"y":-720,"width":1150,"height":330,"color":"#b8a16e","assignmentMode":"auto","parent":null},{"id":"f4","title":"Снабжение и серебро","comment":"Поставки и расчёты создают самостоятельную линию конфликта. Причины недопоставок пока не установлены.","x":-1100,"y":390,"width":1140,"height":350,"color":"#b8a16e","assignmentMode":"auto","parent":null},{"id":"f5","title":"Независимая секта","comment":"Секта, к которой направлено посольство, не является вассалом двора. Её внутренние интересы и разногласия существуют независимо от престольного спора.","x":1190,"y":-720,"width":1550,"height":420,"color":"#b8a16e","assignmentMode":"auto","parent":null},{"id":"f6","title":"Пограничные округа","comment":"У наместников и местных родов есть собственные ресурсы, обязательства и власть. Их решения не тождественны воле центра.","x":390,"y":840,"width":1770,"height":410,"color":"#b8a16e","assignmentMode":"auto","parent":null},{"id":"f7","title":"Низшие ступени практики","comment":"Показывает влияние верхнего конфликта на обычных практиков и смертных. Возможная точка входа героя без избранности или исключений.","x":2270,"y":890,"width":1360,"height":490,"color":"#b8a16e","assignmentMode":"auto","parent":null}],"lanes":[{"id":"l1","title":"Двор","color":"#b8a16e","y":192},{"id":"l2","title":"Торговый дом","color":"#8a9d83","y":525}],"nodes":[{"id":"n1","title":"Смерть правителя","description":"Внезапная смерть правителя оставляет вопрос наследования нерешённым.","x":124,"y":-66,"lineIds":["l1"],"size":"normal","parent":null,"status":"approved","manualFieldIds":[],"manualTags":[],"autoFieldIds":["f1"]},{"id":"n2","title":"Совет разделяется","description":"Стороны не соглашаются с порядком передачи власти. Начинается борьба за поддержку влиятельных родов.","x":470,"y":-105,"lineIds":["l1"],"size":"normal","parent":null,"status":"approved","manualFieldIds":[],"manualTags":[],"autoFieldIds":["f1"]},{"id":"n3","title":"Посольство к секте","description":"Одна из сторон обращается к независимой силе за поддержкой.","x":826,"y":-70,"lineIds":["l1"],"size":"normal","parent":null,"status":"approved","manualFieldIds":[],"manualTags":[],"autoFieldIds":["f1"]},{"id":"n4","title":"Недостаток серебра","description":"Торговый дом сталкивается с нехваткой средств для выполнения обязательств.","x":294,"y":538,"lineIds":["l2"],"size":"normal","parent":null,"status":"approved","manualFieldIds":[],"manualTags":[],"autoFieldIds":["f2"]},{"id":"n5","title":"Переговоры о кредите","description":"Управляющий пытается получить финансирование у представителей столицы.","x":679,"y":544,"lineIds":["l2"],"size":"normal","parent":null,"status":"approved","manualFieldIds":[],"manualTags":[],"autoFieldIds":["f2"]},{"id":"n6","title":"Союз интересов","description":"Политический кризис и хозяйственные интересы пересекаются. Дальнейшие последствия остаются открытыми.","x":1228,"y":385,"lineIds":["l1","l2"],"size":"expanded","parent":null,"status":"approved","manualFieldIds":[],"manualTags":[],"autoFieldIds":[]},{"id":"n7","title":"Порядок доступа к духовным жилам","description":"Двор подтверждает права на добычу и взимает пошлины; независимые секты получают доли сырья по соглашениям; торговые дома обеспечивают доставку. Условия различаются по владениям. Это действующий уклад, а не физический закон Небес.","x":-1040,"y":-630,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f3"]},{"id":"n8","title":"Подтверждение квот стало спорным","description":"Срок очередного подтверждения прав и долей совпал с отсутствием общепризнанного наследника. Старые договоры автоматически не исчезли, но право подписывать новые гарантии оспаривается.","x":-520,"y":-630,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f3"]},{"id":"n9","title":"Сокращаются поставки духовного сырья","description":"Несколько важных поставок принесли меньше материала, чем было обещано. Причина недопоставок неизвестна; истощение жил, саботаж и вмешательство Небес пока не установлены.","x":-917,"y":432,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f4"]},{"id":"n10","title":"Поставщики требуют предоплату серебром","description":"Недостаток сырья меняет условия новых контрактов: поставщики требуют оплату до отправки. Торговые дома, уже связанные обязательствами, становятся уязвимыми.","x":-495,"y":549,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f4"]},{"id":"n11","title":"Секта сохраняет нейтралитет","description":"Секта, к которой прибыло посольство, не обещает поддержки ни одной стороне престольного спора до проверки условий. Это заявленная позиция руководства.","x":1260,"y":-630,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f5"]},{"id":"n12","title":"Секта требует гарантий самостоятельности","description":"Представители секты требуют письменно закрепить право распоряжаться учебными землями и долей духовного сырья. Соглашение пока не подписано.","x":1780,"y":-630,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f5"]},{"id":"n13","title":"Наставники спорят о цене вмешательства","description":"Часть старших наставников видит в договоре защиту учеников и запасов; другая опасается долговой и политической зависимости. Единого решения нет.","x":2280,"y":-530,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f5"]},{"id":"n14","title":"Гарнизоны зависят от духовных материалов","description":"Охрана путей и поселений нуждается в пилюлях, талисманах и редких материалах помимо обычного снабжения. Полного прекращения поставок ещё не произошло.","x":450,"y":930,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f6"]},{"id":"n15","title":"Наместники задерживают отчисления","description":"Некоторые правители окраин удерживают часть серебра для центра до подтверждения прежних квот. Это осознанное решение с публичным объяснением; дальнейшие намерения неизвестны.","x":1010,"y":930,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f6"]},{"id":"n16","title":"Местные роды усиливают охрану перевозок","description":"Несколько родов выставляют собственных людей на участках торговых путей. Перевозки пока не запрещены, но контроль маршрутов становится предметом торга.","x":1590,"y":930,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f6"]},{"id":"n17","title":"Дорожают пилюли начальной ступени","description":"Недопоставки сырья и новые требования предоплаты повышают стоимость простых пилюль начинающих практиков. Точная величина роста не определена.","x":2330,"y":975,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f7"]},{"id":"n18","title":"Бедным ученикам труднее продолжать практику","description":"Семьи без накоплений или покровителей выбирают между долгами и продолжением обучения. Их способности не изменились; уменьшился доступ к ресурсам.","x":2880,"y":975,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f7"]},{"id":"n19","title":"Ученики просят отсрочки при наборе","description":"Из-за дороговизны подготовки семьи с ограниченными средствами обращаются к сектам с просьбой об отсрочке платежей и доступе к общим учебным материалам. Формальный порог приёма в устойчивые секты не изменён, подтверждённых исключений нет.","x":2860,"y":1170,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":["f7"]},{"id":"n20","title":"Обсуждается временное соглашение","description":"После пересечения дворцовых и торговых интересов стороны изучают временную сделку о кредитах, квотах и гарантиях. Обсуждение не означает заключённого договора.","x":1830,"y":270,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":[]},{"id":"n21","title":"Условия сторон остаются несовместимыми","description":"Двору нужно признание временного распорядителя, секте — гарантии самостоятельности, торговым домам — обеспечение долгов. Никто пока не согласен принять все условия других. Исход открыт.","x":2560,"y":260,"parent":null,"size":"normal","status":"proposed","lineIds":["l1"],"manualFieldIds":[],"manualTags":[],"autoFieldIds":[]}],"edges":[{"id":"e1","to":"n2","type":"precedes","from":"n1"},{"id":"e2","to":"n3","type":"precedes","from":"n2"},{"id":"e3","to":"n5","type":"precedes","from":"n4"},{"id":"e4","to":"n6","type":"enables","from":"n3"},{"id":"e5","to":"n6","type":"precedes","from":"n5"},{"id":"e6","to":"n8","type":"enables","from":"n7"},{"id":"e7","to":"n8","type":"causes","from":"n1"},{"id":"e8","to":"n3","type":"enables","from":"n8"},{"id":"e9","to":"n10","type":"causes","from":"n9"},{"id":"e10","to":"n4","type":"causes","from":"n10"},{"id":"e11","to":"n11","type":"precedes","from":"n3"},{"id":"e12","to":"n12","type":"enables","from":"n11"},{"id":"e13","to":"n13","type":"causes","from":"n12"},{"id":"e14","to":"n15","type":"enables","from":"n14"},{"id":"e15","to":"n15","type":"causes","from":"n1"},{"id":"e16","to":"n16","type":"enables","from":"n15"},{"id":"e17","to":"n17","type":"causes","from":"n9"},{"id":"e18","to":"n17","type":"causes","from":"n10"},{"id":"e19","to":"n18","type":"causes","from":"n17"},{"id":"e20","to":"n19","type":"causes","from":"n18"},{"id":"e21","to":"n20","type":"enables","from":"n6"},{"id":"e22","to":"n20","type":"enables","from":"n5"},{"id":"e23","to":"n20","type":"enables","from":"n12"},{"id":"e24","to":"n21","type":"precedes","from":"n20"},{"id":"e25","to":"n21","type":"enables","from":"n13"}]};
// One-time, non-destructive local bootstrap: the full 21-node story, not the six-node demo.
// Existing browser projects and their saved edits are retained; no Site API is called.
let registry;
try{registry=JSON.parse(localStorage.getItem(REGISTRY_KEY));if(!Array.isArray(registry.projects)||!registry.activeId)throw Error('bad registry')}
catch{
 // Preserve a pre-registry legacy canvas if one exists.
 let old=null;try{const candidate=JSON.parse(localStorage.getItem(LEGACY_KEY)||'null');if(Array.isArray(candidate?.nodes)&&Array.isArray(candidate?.edges))old=candidate}catch{}
 if(old){const id=newLocalId();registry={activeId:id,projects:[{id,name:'Предыдущая локальная история',revision:old.revision||0}]};try{localStorage.setItem(KEY_PREFIX+id,JSON.stringify(old))}catch{}}
 else registry={activeId:STARTER_LOCAL_ID,projects:[]};
}
const starterRegistered=registry.projects.some(p=>p.id===STARTER_LOCAL_ID);
if(!starterRegistered){
 // The marker is the project ID: importing this build again never resets the user's work.
 try{const existing=JSON.parse(localStorage.getItem(KEY_PREFIX+STARTER_LOCAL_ID)||'null');
  if(!Array.isArray(existing?.nodes)||!Array.isArray(existing?.edges))localStorage.setItem(KEY_PREFIX+STARTER_LOCAL_ID,JSON.stringify(STARTER_GRAPH));
 }catch{try{localStorage.setItem(KEY_PREFIX+STARTER_LOCAL_ID,JSON.stringify(STARTER_GRAPH))}catch{}}
 registry.projects.unshift({id:STARTER_LOCAL_ID,name:STARTER_NAME,revision:STARTER_GRAPH.revision,origin:STARTER_ORIGIN});
 registry.activeId=STARTER_LOCAL_ID; // first launch of this version opens the actual story.
}
let activeProjectId=registry.activeId;
let KEY=KEY_PREFIX+activeProjectId;
const registryEntry=id=>registry.projects.find(x=>x.id===id);
const writeRegistry=()=>{try{localStorage.setItem(activeRegistryStorage,JSON.stringify(registry))}catch{}};
writeRegistry();

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const COLORS=['#b8a16e','#8a9d83','#b17f72','#998ba7','#84a6a4'];
function seed(){return {version:0.8,revision:0,nextNode:7,nextEdge:6,nextLine:3,nextField:3,view:null,fields:[{id:'f1',title:'Двор',color:COLORS[0],x:105,y:135,width:1100,height:260,assignmentMode:'auto',parent:null},{id:'f2',title:'Торговый дом',color:COLORS[1],x:245,y:465,width:820,height:250,assignmentMode:'auto',parent:null}],lanes:[{id:'l1',title:'Двор',color:COLORS[0],y:192},{id:'l2',title:'Торговый дом',color:COLORS[1],y:525}],nodes:[
{id:'n1',title:'Смерть правителя',description:'Внезапная смерть правителя оставляет вопрос наследования нерешённым.',x:150,y:222,lineIds:['l1'],size:'normal',parent:null,status:'approved'},
{id:'n2',title:'Совет разделяется',description:'Стороны не соглашаются с порядком передачи власти. Начинается борьба за поддержку влиятельных родов.',x:496,y:183,lineIds:['l1'],size:'normal',parent:null,status:'approved'},
{id:'n3',title:'Посольство к секте',description:'Одна из сторон обращается к независимой силе за поддержкой.',x:852,y:218,lineIds:['l1'],size:'normal',parent:null,status:'approved'},
{id:'n4',title:'Недостаток серебра',description:'Торговый дом сталкивается с нехваткой средств для выполнения обязательств.',x:294,y:538,lineIds:['l2'],size:'normal',parent:null,status:'approved'},
{id:'n5',title:'Переговоры о кредите',description:'Управляющий пытается получить финансирование у представителей столицы.',x:679,y:544,lineIds:['l2'],size:'normal',parent:null,status:'approved'},
{id:'n6',title:'Союз интересов',description:'Политический кризис и хозяйственные интересы пересекаются. Дальнейшие последствия остаются открытыми.',x:1228,y:385,lineIds:['l1','l2'],size:'expanded',parent:null,status:'approved'}],edges:[
{id:'e1',from:'n1',to:'n2',type:'precedes'}, {id:'e2',from:'n2',to:'n3',type:'precedes'}, {id:'e3',from:'n4',to:'n5',type:'precedes'}, {id:'e4',from:'n3',to:'n6',type:'enables'}, {id:'e5',from:'n5',to:'n6',type:'precedes'}]};}
let state;try{state=JSON.parse(localStorage.getItem(KEY)||(!starterRegistered&&activeProjectId!==STARTER_LOCAL_ID?localStorage.getItem(LEGACY_KEY):null));if(!state?.nodes||!state?.edges)state=activeProjectId===STARTER_LOCAL_ID?structuredClone(STARTER_GRAPH):seed()}catch{state=activeProjectId===STARTER_LOCAL_ID?structuredClone(STARTER_GRAPH):seed()}
// Compatible with previously saved 0.8.x canvases, including incomplete counters.
if(!Array.isArray(state.fields))state.fields=[];
// P4 editorial tasks never participate in ordinary field geometry/tag recomputation.
function ensureEditorialState(s){
 if(!Array.isArray(s.editorialFields))s.editorialFields=[];
 if(!Array.isArray(s.editorialNotes))s.editorialNotes=[];
 const max=Math.max(0,...s.editorialFields.map(f=>Number(/^ef(\d+)$/.exec(f.id||'')?.[1]||0)));
 if(!Number.isSafeInteger(s.nextEditorialField)||s.nextEditorialField<=max)s.nextEditorialField=max+1;
 const noteMax=Math.max(0,...s.editorialNotes.map(n=>Number(/^en(\d+)$/.exec(n.id||'')?.[1]||0)));
 if(!Number.isSafeInteger(s.nextEditorialNote)||s.nextEditorialNote<=noteMax)s.nextEditorialNote=noteMax+1;
 if(!Array.isArray(s.gapNotes))s.gapNotes=[];
 if(!Array.isArray(s.gapLinks))s.gapLinks=[];
 const gapMax=Math.max(0,...s.gapNotes.map(n=>Number(/^gn(\d+)$/.exec(n.id||'')?.[1]||0)));
 if(!Number.isSafeInteger(s.nextGapNote)||s.nextGapNote<=gapMax)s.nextGapNote=gapMax+1;
 const linkMax=Math.max(0,...s.gapLinks.map(n=>Number(/^gl(\d+)$/.exec(n.id||'')?.[1]||0)));
 if(!Number.isSafeInteger(s.nextGapLink)||s.nextGapLink<=linkMax)s.nextGapLink=linkMax+1;
 for(const n of s.gapNotes){n.text=String(n.text||'');if(typeof n.offerVariants!=='boolean')n.offerVariants=true;n.status=n.status||'pending';n.parent=n.parent??null;}
 // UX-014: single-event rewrite drafts are editorial overlays keyed by immutable node IDs.
 if(!Array.isArray(s.eventRewrites))s.eventRewrites=[];
 const validNodes=new Set(s.nodes.map(n=>n.id)),seenRewrites=new Set();
 s.eventRewrites=s.eventRewrites.filter(d=>{if(!d||typeof d.nodeId!=='string'||!validNodes.has(d.nodeId)||seenRewrites.has(d.nodeId))return false;seenRewrites.add(d.nodeId);return true});
 for(const d of s.eventRewrites){d.taskText=String(d.taskText||'');if(typeof d.offerVariants!=='boolean')d.offerVariants=true;d.status='pending';if(!Number.isSafeInteger(d.baseRevision))d.baseRevision=s.revision||0;}
 for(const f of s.editorialFields){if(!Array.isArray(f.memberIds))f.memberIds=[];if(!f.status)f.status='open';if(typeof f.offerVariants!=='boolean')f.offerVariants=true;}
}
ensureEditorialState(state);
function cleanEditorialReferences(){const ids=new Set(state.nodes.map(n=>n.id));const fields=new Set(state.editorialFields.map(f=>f.id));
 for(const f of state.editorialFields)f.memberIds=[...new Set(f.memberIds)].filter(id=>ids.has(id));
 state.editorialNotes=state.editorialNotes.filter(n=>fields.has(n.fieldId));
 state.eventRewrites=state.eventRewrites.filter(d=>ids.has(d.nodeId));
 const gaps=new Set(state.gapNotes.map(n=>n.id)),sem=new Set(state.fields.map(f=>f.id));
 const hasEndpoint=e=>e?.kind==='gap_note'?gaps.has(e.id):e?.kind==='plot_node'?ids.has(e.id):e?.kind==='semantic_field'?sem.has(e.id):false;
 state.gapLinks=state.gapLinks.filter(l=>hasEndpoint(l.from)&&hasEndpoint(l.to)&&(l.from.kind==='gap_note'||l.to.kind==='gap_note'));
}

for(const f of state.fields){if(typeof f.comment!=='string')f.comment='';}
const maxFieldNumber=state.fields.reduce((n,f)=>Math.max(n,Number(/^f(\d+)$/.exec(f.id||'')?.[1]||0)),0);
if(!Number.isSafeInteger(state.nextField)||state.nextField<=maxFieldNumber)state.nextField=maxFieldNumber+1;
let selected=null,linkFrom=null,history=[],guide=true,focusMode=false,overviewOn=false,modalOpen=false,pan={x:105,y:45,scale:.82},interaction=null;
// P3: multi-selection is editor UI state, not part of the plot or serialized revisions.
const selectedNodeIds=new Set();let spacePan=false,dragCompletedFor=null;
function setNodeSelection(ids,primary=null){
 selectedNodeIds.clear();const available=new Set(visible().map(n=>n.id));
 for(const id of ids)if(available.has(id))selectedNodeIds.add(id);
 const id=(primary&&selectedNodeIds.has(primary)?primary:[...selectedNodeIds][0]);
 selected=id?{type:'node',id}:null;render();
}
function toggleNodeSelection(id){const ids=new Set(selected?.type==='node'?selectedNodeIds:[]);if(!ids.size&&selected?.type==='node')ids.add(selected.id);if(ids.has(id))ids.delete(id);else ids.add(id);setNodeSelection(ids,ids.has(id)?id:null)}
function groupIds(){if(selected?.type!=='node')return [];return selectedNodeIds.size?[...selectedNodeIds]:[selected.id]}

const perfStats={lastRenderMs:0,lastNodes:0,lastEdges:0,lastFields:0};
const nby=id=>state.nodes.find(n=>n.id===id),eby=id=>state.edges.find(e=>e.id===id),lby=id=>state.lanes.find(l=>l.id===id),fby=id=>state.fields.find(f=>f.id===id);
const efby=id=>state.editorialFields.find(f=>f.id===id);
const gnby=id=>state.gapNotes.find(n=>n.id===id);
const rewriteBy=id=>(state.eventRewrites||[]).find(d=>d.nodeId===id);
function beginEventRewrite(id){
 if(!nby(id)||rewriteBy(id))return;
 commit(()=>{state.eventRewrites.push({nodeId:id,baseRevision:state.revision,taskText:'',offerVariants:true,status:'pending'})},'Режим переработки включён · исходное событие сохранено');
 selected={type:'node',id};render();
}
function cancelEventRewrite(id){if(!rewriteBy(id))return;commit(()=>{state.eventRewrites=state.eventRewrites.filter(d=>d.nodeId!==id)},'Переработка отменена · событие не изменено');selected={type:'node',id};render()}

const gapInView=()=>state.gapNotes.filter(n=>n.parent===state.view);
let gapLinkFrom=null;
const editorialInView=()=>state.editorialFields.filter(f=>f.parent===state.view);
// Never conflate editorial node.status='proposed' with draft ownership.
const cwRetiredNodeIds=()=>new Set((state.replacements||[]).flatMap(r=>r.sourceNodeIds||[]));
const cwSuspendedEdgeIds=()=>new Set((state.replacements||[]).flatMap(r=>r.suspendedEdgeIds||[]));
const cwActiveNodes=()=>{const retired=cwRetiredNodeIds();return state.nodes.filter(n=>!n.workspaceId&&!retired.has(n.id))};
const visible=()=>cwActiveNodes().filter(n=>n.parent===state.view);
const currentEdges=()=>{const ids=new Set(visible().map(n=>n.id)),suspended=cwSuspendedEdgeIds();return state.edges.filter(e=>!e.workspaceId&&!suspended.has(e.id)&&ids.has(e.from)&&ids.has(e.to))};

// CW-011: ephemeral visual proof on the SAME canvas. This is strictly a
// synthetic preview, never saved into state, graph_json or ordinary MCP context.
// The real editor must not hydrate persisted workspaces before server-side
// canonical isolation and verified transition endpoints are connected.
let creativeWorkspacePreview=null;
let cwWorkflowTestMode=false;
let cwAcceptanceReview=null;
let cwStageReview=null;
let cwAcceptanceBusy=false;
// QA-only prepared proposals. Never copied to persistentGraph(), Site or MCP
// before the user explicitly reviews and applies a stage_note command.
const cwPreparedNoteAlternatives=new Map();
function setCWPreparedNoteAlternativesForTest(noteId,spec){
 if(!cwWorkflowTestMode||!gnby(noteId)||state.view!==null)
  throw Error('Тестовая подготовка доступна только для открытой заметки');
 if(!spec||typeof spec!=='object'||!Array.isArray(spec.branches)||!spec.branches.length
    ||!spec.workspace||!spec.workspaceId)throw Error('Нет подготовленных вариантов');
 cwPreparedNoteAlternatives.set(noteId,{
  ...structuredClone(spec),noteText:gnby(noteId).text,sourceRevision:remote.revision
 });
 cwStageReview=null;
 render();
}
function cwNoteHasWorkspace(noteId){
 return (state.workspaces||[]).some(a=>a.taskId===noteId);
}
// QA-only activation. This client switch never changes server access controls
// or enables CW_WORKFLOW_ENABLED; disabled by default in every ordinary editor.
function setCWWorkflowTestMode(enabled){
 cwWorkflowTestMode=enabled===true;
 cwAcceptanceReview=null;
 cwStageReview=null;
 if(!cwWorkflowTestMode)cwPreparedNoteAlternatives.clear();
 renderCreativeWorkspacePreview();
 if(selected?.type==='gapNote')renderInspector();
}
function cwCleanForOperation(){
 return cwWorkflowTestMode&&remote.connected&&!remote.blocked&&!remote.busy&&!remote.dirty&&!cwAcceptanceBusy
  &&state.view===null;
}
async function cwWorkflowRequest(id,mode,payload){
 const response=await fetch('/api/projects/'+encodeURIComponent(id)+'/workflow/'+mode,{
  method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(payload)
 });
 let body;try{body=await response.json()}catch{throw Error('Workflow API не вернул JSON')}
 if(!response.ok){
  const err=new Error(body.message||body.error||'Ошибка сохранения');
  err.code=body.error;err.status=response.status;throw err;
 }
 return body;
}
async function cwPrepareNoteStage(noteId){
 if(!cwCleanForOperation())return note('Сначала завершите сохранение в Site');
 const prepared=cwPreparedNoteAlternatives.get(noteId),n=gnby(noteId);
 if(!prepared||!n||!n.text.trim()||cwNoteHasWorkspace(noteId)
   ||prepared.noteText!==n.text||prepared.sourceRevision!==remote.revision)
  return note('Подготовленные варианты устарели. Повторите подготовку');
 const projectId=activeProjectId,revision=remote.revision;
 const command={kind:'stage_note',noteId,workspaceId:prepared.workspaceId,
  workspace:structuredClone(prepared.workspace),branches:structuredClone(prepared.branches)};
 cwAcceptanceBusy=true;
 try{
  const response=await cwWorkflowRequest(projectId,'preview',{expectedRevision:revision,command});
  if(activeProjectId!==projectId||remote.revision!==revision||remote.dirty||remote.blocked)
   throw Error('Проект изменился во время проверки');
  const plan=response.preview;
  if(plan?.noteId!==noteId||plan.workspaceId!==command.workspaceId
    ||!Array.isArray(plan.branchSummaries)
    ||plan.branchSummaries.length!==command.branches.length
    ||!Array.isArray(plan.proposedNodes)||!Array.isArray(plan.proposedEdges)
    ||plan.autoRewiredEdgeIds?.length)
   throw Error('Неожиданное содержимое серверного предпросмотра');
  cwStageReview={projectId,revision,noteId,command,plan,operationId:crypto.randomUUID()};
 }catch(err){cwStageReview=null;note('Предпросмотр не получен: '+err.message)}
 finally{cwAcceptanceBusy=false;renderInspector()}
}
async function cwConfirmNoteStage(){
 const r=cwStageReview;
 if(!r||!cwCleanForOperation())return note('Проект изменился. Повторите проверку');
 if(activeProjectId!==r.projectId||remote.revision!==r.revision
    ||gnby(r.noteId)?.text!==r.plan.sourceNote?.text)
  return note('Заметка или ревизия изменилась');
 cwAcceptanceBusy=true;
 try{
  const confirmed=await cwWorkflowRequest(r.projectId,'apply',{
   expectedRevision:r.revision,operationId:r.operationId,
   command:{...r.command,expectedPreview:r.plan}
  });
  if(!Number.isSafeInteger(confirmed?.revision))
   throw Error('Сервер не подтвердил запись');
  const latest=await apiRequest('/api/projects/'+encodeURIComponent(r.projectId));
  if(activeProjectId!==r.projectId||remote.dirty||remote.blocked)
   throw Error('Локальная копия изменилась во время сохранения');
  if(!Number.isSafeInteger(latest.revision)||latest.revision<confirmed.revision)
   throw Error('Сервер вернул устаревшую ревизию');
  const next=validateImported(latest.graph);
  if(!next.workspaces?.some(a=>a.id===r.command.workspaceId&&a.taskId===r.noteId))
   throw Error('Рабочая область не найдена в сохранённой версии');
  state=next;remote.revision=latest.revision;remote.dirty=false;
  selected={type:'gapNote',id:r.noteId};selectedNodeIds.clear();linkFrom=null;history=[];
  cwPreparedNoteAlternatives.delete(r.noteId);cwStageReview=null;
  recomputeFieldTags();save(false);render();fit();
  $('saved').textContent='✓ Сохранено в Site · '+remote.revision;
  note('Варианты сохранены в рабочей области — не в сюжете');
 }catch(err){
  // Do not rotate operationId following an ambiguous reply or lost GET.
  if(['REVISION_CONFLICT','PREVIEW_STALE','OPERATION_ID_REUSED'].includes(err.code)){
   cwStageReview=null;note('Изменилась ревизия. Проверьте проект и повторите подготовку');
  }else note('Сохранение не подтверждено: '+err.message);
 }finally{cwAcceptanceBusy=false;renderInspector()}
}

async function cwPrepareAccept(nodeId,workspaceId){
 if(!cwCleanForOperation()){note('Сначала завершите сохранение проекта в Site');return}
 if(!state.nodes.some(n=>n.id===nodeId&&n.workspaceId===workspaceId))return;
 const id=activeProjectId,revision=remote.revision;
 cwAcceptanceBusy=true;
 try{
  const command={kind:'accept_draft',workspaceId,nodeIds:[nodeId]};
  const reviewed=await cwWorkflowRequest(id,'preview',{expectedRevision:revision,command});
  if(activeProjectId!==id||remote.revision!==revision||remote.dirty||remote.blocked)
   throw Error('Проект изменился во время проверки. Повторите действие');
  const plan=reviewed.preview;
  if(!plan||JSON.stringify(plan.acceptNodeIds)!==JSON.stringify([nodeId])||plan.workspaceId!==workspaceId)
   throw Error('Проверка вернула неожиданный состав изменений');
  cwAcceptanceReview={projectId:id,revision,nodeId,workspaceId,plan,operationId:crypto.randomUUID()};
 }catch(err){cwAcceptanceReview=null;note('Не удалось проверить принятие: '+err.message)}
 finally{cwAcceptanceBusy=false;renderCreativeWorkspacePreview()}
}
async function cwConfirmAccept(){
 const review=cwAcceptanceReview;
 if(!review||!cwCleanForOperation())return note('Проект изменился. Повторите проверку');
 if(review.projectId!==activeProjectId||review.revision!==remote.revision)return note('Ревизия проекта изменилась');
 cwAcceptanceBusy=true;
 try{
  const command={kind:'accept_draft',workspaceId:review.workspaceId,nodeIds:[review.nodeId],expectedPreview:review.plan};
  const committed=await cwWorkflowRequest(review.projectId,'apply',{
   expectedRevision:review.revision,operationId:review.operationId,command
  });
  if(!committed||!Number.isSafeInteger(committed.revision))
   throw Error('Сервер не подтвердил ревизию');
  const latest=await apiRequest('/api/projects/'+encodeURIComponent(review.projectId));
  if(activeProjectId!==review.projectId||remote.dirty||remote.blocked)
   throw Error('Локальная версия изменилась — выполните проверку синхронизации');
  if(!Number.isSafeInteger(latest.revision)||latest.revision<committed.revision)
   throw Error('Сервер вернул устаревшее состояние после принятия');
  state=validateImported(latest.graph);
  remote.revision=latest.revision;
  remote.dirty=false;
  selected=null;selectedNodeIds.clear();linkFrom=null;history=[];
  cwAcceptanceReview=null;
  recomputeFieldTags();
  save(false);render();
  $('saved').textContent='✓ Сохранено в Site · '+remote.revision;
  note('Событие принято в сюжет. Остальные черновики сохранены');
 }catch(err){
  // Keep the same operationId for retry after an ambiguous network failure.
  // Never silently mint a second write after a possibly committed request.
  if(err.code==='REVISION_CONFLICT'||err.code==='PREVIEW_STALE'){
   cwAcceptanceReview=null;
   note('Конфликт ревизий. Обновите проект и повторите проверку');
  }else note('Принятие не подтверждено: '+err.message);
 }finally{cwAcceptanceBusy=false;renderCreativeWorkspacePreview()}
}

const cwPreviewId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(s);
const cwPreviewNumber=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1000000;
function setCreativeWorkspacePreview(proposal){
 if(proposal===null){creativeWorkspacePreview=null;render();return}
 if(!proposal||!Array.isArray(proposal.workspaces)||!Array.isArray(proposal.nodes)||!Array.isArray(proposal.edges)
    ||proposal.workspaces.length>12||proposal.nodes.length>128||proposal.edges.length>256)throw Error('Некорректный синтетический предпросмотр');
 const scene=structuredClone(proposal),areaIds=new Set(),nodeIds=new Set(),nodeById=new Map();
 for(const a of scene.workspaces){
  if(!cwPreviewId(a.id)||areaIds.has(a.id)||![a.x,a.y,a.width,a.height].every(cwPreviewNumber)
     ||a.width<250||a.height<140)throw Error('Некорректная рабочая область');
  areaIds.add(a.id);
 }
 for(const n of scene.nodes){
  if(!cwPreviewId(n.id)||nodeIds.has(n.id)||!areaIds.has(n.workspaceId)
     ||typeof n.title!=='string'||n.title.length>300
     ||typeof (n.description??'')!=='string'||(n.description??'').length>5000
     ||![n.x,n.y].every(cwPreviewNumber))throw Error('Некорректная черновая карточка');
  nodeIds.add(n.id);nodeById.set(n.id,n);
 }
 const edgeIds=new Set();
 for(const e of scene.edges){
  const from=nodeById.get(e.from),to=nodeById.get(e.to);
  if(!cwPreviewId(e.id)||edgeIds.has(e.id)||!from||!to||from.id===to.id
     ||from.workspaceId!==e.workspaceId||to.workspaceId!==e.workspaceId
     ||e.draftRelation!=='internal')throw Error('Некорректная внутренняя связь черновика');
  edgeIds.add(e.id);
 }
 creativeWorkspacePreview=scene;
 render();
}
function cwPersistedWorkspaceScene(){
 if(state.view!==null||!Array.isArray(state.workspaces)||!state.workspaces.length)return null;
 const workspaces=state.workspaces.filter(a=>a&&typeof a.id==='string');
 const ownerIds=new Set(workspaces.map(a=>a.id));
 const nodes=state.nodes.filter(n=>n.workspaceId&&ownerIds.has(n.workspaceId));
 const ids=new Map(nodes.map(n=>[n.id,n]));
 const edges=state.edges.filter(e=>e.workspaceId&&e.draftRelation==='internal'
  &&ids.has(e.from)&&ids.has(e.to)&&ids.get(e.from).workspaceId===e.workspaceId&&ids.get(e.to).workspaceId===e.workspaceId);
 return {workspaces,nodes,edges};
}
function renderCreativeWorkspacePreview(){
 const host=$('cw-workspace-preview');if(!host)return;
 host.replaceChildren();
 const persisted=creativeWorkspacePreview===null;
 const data=creativeWorkspacePreview||cwPersistedWorkspaceScene();if(!data)return;
 const namespace='http://www.w3.org/2000/svg';
 const nodeById=new Map(data.nodes.map(n=>[n.id,n]));
 for(const area of data.workspaces){
  const box=document.createElement('section');box.className='cw-preview-area';
  box.dataset.cwWorkspace=area.id;
  box.style.cssText='left:'+area.x+'px;top:'+area.y+'px;width:'+area.width+'px;height:'+area.height+'px';
  box.setAttribute('aria-label','Рабочая область. Черновики, не события сюжета');
  const head=document.createElement('div');head.className='cw-preview-area-head';
  head.textContent=persisted?'Рабочая область · сохранённые черновики':'Рабочая область · черновики';
  const hint=document.createElement('span');hint.className='cw-preview-area-hint';
  hint.textContent=persisted?'Вне сюжета':'Предпросмотр · не в сюжете';head.append(hint);box.append(head);
  const internals=data.edges.filter(e=>e.workspaceId===area.id);
  const svg=document.createElementNS(namespace,'svg');svg.setAttribute('class','cw-preview-arrows');
  svg.setAttribute('width',String(area.width));svg.setAttribute('height',String(area.height));
  svg.setAttribute('aria-hidden','true');
  for(const edge of internals){
   const from=nodeById.get(edge.from),to=nodeById.get(edge.to);
   if(!from||!to)continue;
   const path=document.createElementNS(namespace,'path');
   const ax=from.x-area.x+208,ay=from.y-area.y+56,bx=to.x-area.x,by=to.y-area.y+56;
   path.setAttribute('d','M '+ax+' '+ay+' L '+bx+' '+by);
   path.setAttribute('class','cw-preview-link');svg.append(path);
  }
  box.append(svg);
  const nodes=data.nodes.filter(n=>n.workspaceId===area.id);
  const names=[...new Set(nodes.map(n=>n.draftBranchId||'single'))];
  for(const n of nodes){
   const card=document.createElement('article');card.className='cw-preview-card';
   card.dataset.cwNode=n.id;card.style.left=(n.x-area.x)+'px';card.style.top=(n.y-area.y)+'px';
   card.tabIndex=0;card.setAttribute('aria-label','Черновик: '+n.title);
   const kind=document.createElement('div');kind.className='cw-preview-kind';
   kind.textContent='Вариант '+(names.indexOf(n.draftBranchId||'single')+1)+' · черновик';
   const title=document.createElement('strong');title.textContent=n.title;
   card.append(kind,title);
   if(n.description){const d=document.createElement('p');d.textContent=n.description;card.append(d)}
   if(persisted){
    card.classList.add('cw-persisted-card');
    // Canvas pointerdown normally starts a drag and may rerender the world,
    // destroying a button before its click can be dispatched.
    card.addEventListener('pointerdown',e=>e.stopPropagation());
    card.addEventListener('click',e=>e.stopPropagation());
    if(cwWorkflowTestMode){
     const accept=document.createElement('button');
     accept.type='button';accept.className='cw-accept-trigger';accept.textContent='В сюжет';
     accept.disabled=cwAcceptanceBusy;
     accept.setAttribute('aria-label','Проверить принятие события: '+n.title);
     accept.addEventListener('click',e=>{e.stopPropagation();void cwPrepareAccept(n.id,area.id)});
     card.append(accept);
    }
   }
   if(!persisted)card.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    e.stopPropagation();e.preventDefault();const x=e.clientX,y=e.clientY,ox=n.x,oy=n.y;
    let moved=false;card.setPointerCapture(e.pointerId);
    const move=ev=>{
     ev.stopPropagation();
     const dx=(ev.clientX-x)/pan.scale,dy=(ev.clientY-y)/pan.scale;
     if(!moved&&Math.abs(dx)+Math.abs(dy)<4)return;
     moved=true;
     card.style.left=(ox+dx-area.x)+'px';card.style.top=(oy+dy-area.y)+'px';
    };
    const end=ev=>{
     ev.stopPropagation();card.removeEventListener('pointermove',move);
     card.removeEventListener('pointerup',end);card.removeEventListener('pointercancel',cancel);
     if(moved){
      n.x=Math.round(ox+(ev.clientX-x)/pan.scale);
      n.y=Math.round(oy+(ev.clientY-y)/pan.scale);
     }
     renderCreativeWorkspacePreview(); // Transient geometry ONLY. No commit/save.
    };
    const cancel=ev=>{
     ev.stopPropagation();card.removeEventListener('pointermove',move);
     card.removeEventListener('pointerup',end);card.removeEventListener('pointercancel',cancel);
     renderCreativeWorkspacePreview();
    };
    card.addEventListener('pointermove',move);card.addEventListener('pointerup',end);card.addEventListener('pointercancel',cancel);
   });
   box.append(card);
  }
  if(persisted&&cwWorkflowTestMode&&cwAcceptanceReview?.workspaceId===area.id){
   const p=cwAcceptanceReview,review=document.createElement('section');
   review.className='cw-accept-review';review.setAttribute('role','group');
   review.addEventListener('pointerdown',e=>e.stopPropagation());
   review.setAttribute('aria-label','Проверка принятия черновика');
   const desc=document.createElement('p');
   desc.textContent='В сюжет: 1 событие · внутренних связей: '+p.plan.promoteEdgeIds.length
    +' · внешние связи не подключаются автоматически';
   const approve=document.createElement('button');approve.type='button';approve.textContent='Принять в сюжет';
   approve.disabled=cwAcceptanceBusy;approve.addEventListener('click',e=>{e.stopPropagation();void cwConfirmAccept()});
   const back=document.createElement('button');back.type='button';back.textContent='Отмена';
   back.disabled=cwAcceptanceBusy;back.addEventListener('click',e=>{e.stopPropagation();cwAcceptanceReview=null;renderCreativeWorkspacePreview()});
   review.append(desc,approve,back);box.append(review);
  }
  host.append(box);
 }
}

function note(s){$('toast').textContent=s;$('toast').classList.add('on');clearTimeout(note.t);note.t=setTimeout(()=>$('toast').classList.remove('on'),2700)}
const remote={connected:false,token:null,revision:0,dirty:false,busy:false,blocked:false,timer:null};
// Only confirmed pins are persistent. Automatic memberships are recalculated from geometry on every load.
function persistentGraph(){const graph=structuredClone(state);for(const node of graph.nodes||[])delete node.autoFieldIds;return graph}
function save(sync=true){let localOk=true;try{localStorage.setItem(KEY,JSON.stringify(persistentGraph()));const entry=registryEntry(activeProjectId);if(entry){entry.revision=state.revision;entry.updatedAt=Date.now();writeRegistry()}}catch{localOk=false};$('saved').textContent=localOk?'● '+(remote.connected?'Локальная копия сохранена':'Сохранено локально')+' · '+state.revision:'! Локальное хранилище недоступно';if(remote.connected&&sync)queueRemote();return localOk}
function commit(f,message){if(cwAcceptanceBusy)return note('Дождитесь завершения проверки принятия');cwStageReview=null;history.push(JSON.stringify(persistentGraph()));if(history.length>60)history.shift();f();cleanEditorialReferences();memoRender=null;recomputeFieldTags();state.revision++;const stored=save();render();if(!stored)note('Изменения в памяти, но браузер не сохранил их. Экспортируйте JSON.');else if(message)note(message)}
function undo(){if(!history.length)return note('Нет действий для отмены');state=JSON.parse(history.pop());recomputeFieldTags();selected=null;selectedNodeIds.clear();linkFrom=null;save();render();note('Действие отменено')}
function notifyModal(title,detail,placeholder,callback,init=''){modalOpen=true;let host=$('modal-host');host.innerHTML=`<div class="backdrop"><form class="modal" id="dialog"><h2>${esc(title)}</h2><p>${esc(detail)}</p><input id="entry" placeholder="${esc(placeholder)}" value="${esc(init)}" required maxlength="160"><p id="dialog-error" class="dialog-error" role="alert" hidden></p><div class="buttons"><button type="button" id="cancel">Отмена</button><button class="primary" type="submit">Сохранить</button></div></form></div>`;const close=()=>{modalOpen=false;host.innerHTML=''};$('cancel').onclick=close;$('dialog').onsubmit=e=>{e.preventDefault();const val=$('entry').value.trim();if(!val){$('entry').setCustomValidity('Введите название');$('entry').reportValidity();return}try{callback(val);close()}catch(err){console.error('Ошибка при сохранении',err);const warning=$('dialog-error');if(warning){warning.textContent='Не удалось сохранить. Попробуйте снова.';warning.hidden=false;}note('Не удалось сохранить поле или событие')}};$('entry').addEventListener('input',()=>{$('entry').setCustomValidity('')});$('entry').focus();$('entry').select()}
function colorOf(n){return COLORS.includes(n.color)?n.color:(lby(n.lineIds[0])?.color||'#9b9488')}
function defaultNodeWidth(n){return ({mini:208,normal:258,expanded:316}[n.size]||258)}
function widthOf(n){return Number.isFinite(n.width)?Math.max(180,Math.min(780,n.width)):defaultNodeWidth(n)}
function heightOf(n){return Number.isFinite(n.height)?Math.max(95,Math.min(640,n.height)):null}
let inspectorPinned=false;
function positionInspector(){
 const el=$('inspector'); if(!el||el.hidden)return;
 const n=selected?.type==='node'?nby(selected.id):null;
 if(!n||inspectorPinned||groupIds().length>1||!visible().some(v=>v.id===n.id)){
  el.classList.remove('near-node');el.style.left='';el.style.top='';el.style.right='';return;
 }
 const bounds=canvasRect(),w=el.offsetWidth||360,h=el.offsetHeight||420;
 const nodeX=n.x*pan.scale+pan.x,nodeY=n.y*pan.scale+pan.y;
 const nodeW=widthOf(n)*pan.scale;
 const rightX=nodeX+nodeW+18;
 let left=rightX+w+14<=bounds.width?rightX:nodeX-w-18;
 if(left<12)left=Math.max(12,Math.min(bounds.width-w-12,rightX));
 if(left>bounds.width-w-12)left=Math.max(12,bounds.width-w-12);
 const top=Math.max(12,Math.min(nodeY,Math.max(12,bounds.height-h-16)));
 el.classList.add('near-node');el.style.right='auto';el.style.left=Math.round(left)+'px';el.style.top=Math.round(top)+'px';
}

function itemDims(n){if(memoRender?.dims.has(n.id))return memoRender.dims.get(n.id);let el=document.querySelector(`[data-node="${n.id}"]`);const d={w:widthOf(n),h:Math.max(heightOf(n)||0,el?.offsetHeight||105)};if(memoRender)memoRender.dims.set(n.id,d);return d}
function connector(e){const a=nby(e.from),b=nby(e.to);if(!a||!b)return '';const ad=itemDims(a),bd=itemDims(b);
 // UX-015: overview edges attach to the fixed semantic anchor at the REAL card's
 // center, regardless of how a collision-avoiding screen label is displaced.
 const compact=semanticZoomLevel()!=='full';
 const x1=compact?a.x+ad.w/2:a.x+ad.w,y1=a.y+ad.h/2;
 const x2=compact?b.x+bd.w/2:b.x,y2=b.y+bd.h/2;
 const dx=Math.max(compact?22:65,Math.abs(x2-x1)*.42),warn=x2<x1+25;
 const d=`M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}`;
 return {d,warn,x1,x2}}

function directionIssues(){const keep=focusIds();return currentEdges().filter(e=>e.type==='precedes'&&(!keep||(keep.has(e.from)&&keep.has(e.to)))&&connector(e)?.warn).length}
function focusIds(){
 if(!focusMode||!selected)return null;
 if(selected.type==='node'){
   const ids=new Set(groupIds());for(const e of currentEdges())if(ids.has(e.from)||ids.has(e.to)){ids.add(e.from);ids.add(e.to)}return ids;
 }
 if(selected.type==='edge'){const e=eby(selected.id);return e?new Set([e.from,e.to]):null}
 if(selected.type==='field'){const f=fby(selected.id);return f?new Set(visible().filter(n=>fieldMembership(n).includes(f.id)).map(n=>n.id)):null}
 return null;
}
function focusToggle(){
 if(!focusMode&&!selected){note('Сначала выберите событие или поле');return}
 focusMode=!focusMode;render();note(focusMode?'Фокус включён · лишние связи приглушены':'Полный граф снова виден');
}

/* Edge Clarity: all grouping and routes are derived view objects, never canonical edges. */
let forceAllEdges=false,routeMode='direct',lodOverview=false,memoRender=null;
/* UX-015: non-persistent display state, with hysteresis around both zoom bands.
   Changes neither graph geometry nor automatically assigned semantic fields. */
let semanticMode='full';
function semanticZoomLevel(){
 const z=pan.scale;
 if(semanticMode==='full'){
  if(z<.34)semanticMode='map';else if(z<.62)semanticMode='compact';
 }else if(semanticMode==='compact'){
  if(z<.32)semanticMode='map';else if(z>.68)semanticMode='full';
 }else if(semanticMode==='map'&&z>.40){
  semanticMode=z>.68?'full':'compact';
 }
 return semanticMode;
}

const edgeLabels={precedes:'Следом',causes:'Причина',enables:'Делает возможным',hinders:'Препятствует',requires:'Требует',reveals:'Раскрывает'};
function useOverview(){return guide&&!forceAllEdges&&fieldInView().length>0&&visible().length>=18&&pan.scale<=.48}
function visualHome(node){
  if(memoRender&&memoRender.homes.has(node.id))return memoRender.homes.get(node.id);
  const found=fieldInView().filter(f=>f.assignmentMode!=='manual'&&insideField(node,f));
  found.sort((a,b)=>(a.width*a.height-b.width*b.height)||a.id.localeCompare(b.id));
  const id=found[0]?.id||null;if(memoRender)memoRender.homes.set(node.id,id);return id;
}
function getBridgeGroups(){
  const nodes=new Map(visible().map(n=>[n.id,n]));const groups=new Map();
  for(const e of currentEdges()){
    const a=nodes.get(e.from),b=nodes.get(e.to);if(!a||!b)continue;
    const f1=visualHome(a),f2=visualHome(b);
    if(!f1||!f2||f1===f2)continue;
    const key=f1+'>'+f2;
    if(!groups.has(key))groups.set(key,{key,from:f1,to:f2,edges:[]});
    groups.get(key).edges.push(e);
  }
  return [...groups.values()].sort((a,b)=>a.key.localeCompare(b.key));
}
function bridgeCoordinates(bridge){
 const a=fby(bridge.from),b=fby(bridge.to);if(!a||!b)return null;
 const forward=b.x+b.width/2>=a.x+a.width/2;
 const start={x:forward?a.x+a.width:a.x,y:a.y+a.height/2};
 const end={x:forward?b.x:b.x+b.width,y:b.y+b.height/2};
 const dx=Math.max(55,Math.abs(end.x-start.x)*.35);
 const dir=forward?1:-1;
 return {start,end, d:`M${start.x},${start.y} C${start.x+dir*dx},${start.y} ${end.x-dir*dx},${end.y} ${end.x},${end.y}`,
    mx:(start.x+end.x)/2,my:(start.y+end.y)/2};
}
function rectHit(seg,r){
  const [x1,y1,x2,y2]=seg;
  if(Math.abs(y2-y1)<.01)return y1>=r.y&&y1<=r.y+r.h&&Math.max(x1,x2)>=r.x&&Math.min(x1,x2)<=r.x+r.w;
  if(Math.abs(x2-x1)<.01)return x1>=r.x&&x1<=r.x+r.w&&Math.max(y1,y2)>=r.y&&Math.min(y1,y2)<=r.y+r.h;
  return false;
}
function smartConnector(edge){
  if(semanticZoomLevel()!=='full')return connector(edge);
  const a=nby(edge.from),b=nby(edge.to);if(!a||!b)return connector(edge);
  const f1=visualHome(a),f2=visualHome(b);
  const ad=itemDims(a),bd=itemDims(b),x1=a.x+ad.w,y1=a.y+ad.h/2,x2=b.x,y2=b.y+bd.h/2;
  if(f1===f2||Math.abs(x2-x1)<650)return connector(edge);
  const objects=visible().filter(n=>n.id!==a.id&&n.id!==b.id).map(n=>{const d=itemDims(n);return {x:n.x-18,y:n.y-18,w:d.w+36,h:d.h+36}});
  const headingRects=fieldInView().map(f=>({x:f.x+8,y:f.y-43,w:Math.min(240,f.width*.5),h:42}));
  const rects=[...objects,...headingRects];
  const minY=Math.min(y1,y2),maxY=Math.max(y1,y2);
  const candidates=[minY-100,minY-210,minY-350,maxY+100,maxY+210,maxY+350];
  let best=null;
  for(const ry of candidates){
    const sx=x1+48,ex=x2-48;
    const segments=[[x1,y1,sx,y1],[sx,y1,sx,ry],[sx,ry,ex,ry],[ex,ry,ex,y2],[ex,y2,x2,y2]];
    let collisions=0;for(const rect of rects)for(const seg of segments)if(rectHit(seg,rect))collisions++;
    const length=segments.reduce((sum,[ax,ay,bx,by])=>sum+Math.abs(bx-ax)+Math.abs(by-ay),0);
    const score=collisions*15000+length;
    if(!best||score<best.score)best={score,segments};
  }
  if(!best)return connector(edge);
  const pieces=best.segments.map(s=>[s[2],s[3]]);
  const path=`M${x1},${y1} `+pieces.map(p=>`L${p[0]},${p[1]}`).join(' ');
  return {d:path,warn:x2<x1+25,x1,x2,routed:true};
}
function connectionPlan(){
 const edges=currentEdges(),overview=useOverview();
 const reveal=new Set();
 if(selected?.type==='node')for(const e of edges)if(e.from===selected.id||e.to===selected.id)reveal.add(e.id);
 if(selected?.type==='edge')reveal.add(selected.id);
 if(selected?.type==='field')for(const e of edges)if(visualHome(nby(e.from))===selected.id||visualHome(nby(e.to))===selected.id)reveal.add(e.id);
 // A selected bridge stays aggregated until its reader chooses a precise edge.
 const groups=getBridgeGroups(),aggregated=new Set(),bridges=[];
 for(const group of groups){
   const remaining=group.edges.filter(e=>!reveal.has(e.id));
   const a=nby(remaining[0]?.from),b=nby(remaining[0]?.to);
   const dist=a&&b?Math.abs(a.x-b.x):0;
   if(remaining.length>=(overview?2:3) && (overview||dist>600)){
      bridges.push({...group,edges:remaining});for(const e of remaining)aggregated.add(e.id);
   }
 }
 const internal=edges.filter(e=>{const a=visualHome(nby(e.from)),b=visualHome(nby(e.to));return a&&a===b});
 const localSuppressed=new Map();
 if(overview){for(const e of internal)if(!reveal.has(e.id)){const f=visualHome(nby(e.from));localSuppressed.set(f,(localSuppressed.get(f)||0)+1)}}
 return {overview,bridges,aggregated,reveal,localSuppressed,visibleEdges:edges.filter(e=>reveal.has(e.id)||!aggregated.has(e.id)&&(!overview||!internal.includes(e)))};
}
function pickBridge(key){selected={type:'bridge',key};render()}
function renderBridgeInspector(el){
 const bridge=getBridgeGroups().find(g=>g.key===selected.key);
 if(!bridge){selected=null;el.hidden=true;return}
 el.hidden=false;
 const f1=fby(bridge.from),f2=fby(bridge.to);
 el.innerHTML=`<div class="inspect-head"><b>Связи между полями</b><button id="close-inspect" aria-label="Закрыть">×</button></div>`+
 `<div class="edge-detail-head">${esc(f1?.title||'Поле')} → ${esc(f2?.title||'Поле')}<br>${bridge.edges.length} исходных связей. Этот мост — только способ отображения, не новое сюжетное событие.</div>`+
 `<div class="edge-list">${bridge.edges.map(e=>`<button data-drill-edge="${esc(e.id)}">${esc(nby(e.from)?.title)} → ${esc(nby(e.to)?.title)}<small>${esc(edgeLabels[e.type]||e.type)}</small></button>`).join('')}</div>`+
 `<p class="edge-summary">Выберите конкретную связь, чтобы увидеть её на полотне. Исходный граф при этом не меняется.</p>`;
 $('close-inspect').onclick=()=>{selected=null;render()};
 el.querySelectorAll('[data-drill-edge]').forEach(b=>b.onclick=()=>{selected={type:'edge',id:b.dataset.drillEdge};focusMode=true;render();const e=eby(b.dataset.drillEdge),a=nby(e.from),z=nby(e.to);if(a&&z)centerAt((a.x+z.x)/2,(a.y+z.y)/2,Math.max(.65,pan.scale))});
}
function setAllEdges(on){forceAllEdges=!!on;render();note(forceAllEdges?'Показаны все исходные связи':'Адаптивный обзор включён')}
function setRouteMode(m){routeMode=m==='direct'?'direct':'smart';render();note(routeMode==='smart'?'Обходные маршруты включены':'Показаны прямые маршруты')}


function newGapNote(at=null){const r=canvasRect();const start={x:Math.round((r.width*.5-pan.x)/pan.scale),y:Math.round((r.height*.5-pan.y)/pan.scale)};
 const obstacles=[...visible().map(n=>{const d=itemDims(n);return {x:n.x,y:n.y,w:d.w,h:d.h}}),...gapInView().map(n=>({x:n.x,y:n.y,w:252,h:145}))];
 const candidates=[[0,0],[0,210],[0,-210],[0,430],[0,-430],[0,650],[0,-650],[320,0],[-320,0],[320,280],[-320,280]];
 const free=(p)=>obstacles.every(o=>p.x+272<o.x||p.x>o.x+o.w+20||p.y+155<o.y||p.y>o.y+o.h+20);
 const p=at||candidates.map(([dx,dy])=>({x:start.x-126+dx,y:start.y-80+dy})).find(free)||{x:start.x+350,y:start.y};
 const id='gn'+state.nextGapNote;
 commit(()=>{state.nextGapNote++;state.gapNotes.push({id,title:'Заметка',text:'',parent:state.view,x:Math.round(p.x),y:Math.round(p.y),offerVariants:true,status:'pending'})},'Заметка создана');
 selected={type:'gapNote',id};render();return id;
}
function setGapNoteText(id,text){const n=gnby(id),v=String(text).slice(0,8000);if(!n||n.text===v)return;
 cwPreparedNoteAlternatives.delete(id);cwStageReview=null;
 commit(()=>{const rec=gnby(id);rec.text=v;rec.status='pending'},'Заметка сохранена');selected={type:'gapNote',id};render();
}
function beginGapLink(kind,id){gapLinkFrom={kind,id};linkFrom=null;note('Выберите событие, поле или заметку для контекстной связи')}
function completeGapLink(kind,id){if(!gapLinkFrom)return false;const source=gapLinkFrom,target={kind,id};gapLinkFrom=null;
 if(source.kind===target.kind&&source.id===target.id){note('Нельзя связать объект с самим собой');return true;}
 if(source.kind!=='gap_note'&&target.kind!=='gap_note'){note('Редакторская связь должна включать заметку');return true;}
 if(state.gapLinks.some(l=>l.from.kind===source.kind&&l.from.id===source.id&&l.to.kind===kind&&l.to.id===id)){note('Такая связь уже существует');return true;}
 commit(()=>{state.gapLinks.push({id:'gl'+state.nextGapLink++,from:source,to:target})},'Контекстная связь создана');return true;
}
function deleteGapNote(id){if(!gnby(id))return; if(!confirm('Удалить заметку и её контекстные связи? Сюжетные события останутся.'))return;
 commit(()=>{state.gapNotes=state.gapNotes.filter(n=>n.id!==id);state.gapLinks=state.gapLinks.filter(l=>!(l.from.kind==='gap_note'&&l.from.id===id)&&!(l.to.kind==='gap_note'&&l.to.id===id))},'Заметка удалена');selected=null;render();
}
function renderGapNotes(){const host=$('gap-notes');host.innerHTML='';
 for(const n of gapInView()){
  const el=document.createElement('article');el.className='gap-note'+(selected?.type==='gapNote'&&selected.id===n.id?' selected':'');
  el.dataset.gapNote=n.id;el.style.left=n.x+'px';el.style.top=n.y+'px';el.tabIndex=0;
  el.innerHTML=`<div class="gap-note-head">▤ ${esc(n.title||'Заметка')}</div><div class="gap-note-body ${!n.text?'gap-note-empty':''}">${esc(n.text||'Напишите, что нужно придумать здесь…')}</div><div class="gap-note-foot">${cwWorkflowTestMode?(cwNoteHasWorkspace(n.id)?'Варианты в рабочей области':cwPreparedNoteAlternatives.has(n.id)?'Подготовлено '+cwPreparedNoteAlternatives.get(n.id).branches.length+' ветвей':'Редакторское задание'):(n.offerVariants?'3 варианта':'1 вариант')} · не сюжетное событие</div>`;
  host.append(el);
  el.onclick=e=>{e.stopPropagation();if(completeGapLink('gap_note',n.id))return;selected={type:'gapNote',id:n.id};render()};
  el.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('input,textarea')||e.ctrlKey)return;interaction={type:'gap-note-move',id:n.id,px:e.clientX,py:e.clientY,x:n.x,y:n.y,moved:false};el.setPointerCapture(e.pointerId)});
  el.addEventListener('pointermove',e=>{const i=interaction;if(i?.type!=='gap-note-move'||i.id!==n.id)return;const dx=(e.clientX-i.px)/pan.scale,dy=(e.clientY-i.py)/pan.scale;if(Math.abs(dx)+Math.abs(dy)>5)i.moved=true;if(i.moved){el.style.left=Math.round(i.x+dx)+'px';el.style.top=Math.round(i.y+dy)+'px'}});
  el.addEventListener('pointerup',e=>{const i=interaction;if(i?.type!=='gap-note-move'||i.id!==n.id)return;interaction=null;if(!i.moved)return;e.stopPropagation();const x=Math.round(i.x+(e.clientX-i.px)/pan.scale),y=Math.round(i.y+(e.clientY-i.py)/pan.scale);commit(()=>{const a=gnby(n.id);a.x=x;a.y=y},'Заметка перемещена');selected={type:'gapNote',id:n.id};render()});
  el.addEventListener('pointercancel',()=>{if(interaction?.type==='gap-note-move'){interaction=null;render()}});
 }
}
function renderGapInspector(el,n){
 const prepared=cwWorkflowTestMode&&cwPreparedNoteAlternatives.has(n.id)&&!cwNoteHasWorkspace(n.id);
 const review=cwStageReview?.noteId===n.id?cwStageReview:null;
 const ready=review?.plan;
 const summary=ready?'Подготовлено '+ready.branchSummaries.length+' ветвей · '+ready.proposedNodes.length
  +' событий · '+ready.proposedEdges.length+' внутренних связей. Сюжет останется без изменений.':'';
 const stageButton=prepared?'<button id="cw-stage-note" type="button">Разместить варианты</button>':'';
 const stageReview=review?'<section class="cw-note-stage-review" role="group" aria-label="Проверка вариантов">'+
  '<p>'+esc(summary)+'</p><button id="cw-stage-confirm" type="button">Сохранить черновики</button>'+
  '<button id="cw-stage-cancel" type="button">Отмена</button></section>':'';
 const existing=cwWorkflowTestMode&&cwNoteHasWorkspace(n.id)
  ?'<p class="muted">Рабочая область этой заметки уже создана. Варианты остаются вне сюжета.</p>':'';
 const legacy=cwWorkflowTestMode?'':'<div class="field"><label class="check-row"><input type="checkbox" id="gap-offer" '+
  (n.offerVariants?'checked':'')+'>Предлагать три варианта</label></div>';
 el.hidden=false;
 el.innerHTML=`<div class="inspect-head"><b>▤ Заметка · придумать новое</b><button id="close-inspect">×</button></div>
 <div class="field"><label>Задание ChatGPT</label><textarea id="gap-text" class="gap-note-editor" placeholder="Что нужно придумать?">${esc(n.text)}</textarea></div>
 ${legacy}<div class="muted">Отдельная временная нода. Не событие и не канонический факт. Стрелки к ней задают редакторский контекст.</div>
 ${existing}<hr><div class="inspect-actions">${stageButton}<button id="gap-link">Связать</button><button id="gap-delete">Удалить заметку…</button></div>${stageReview}`;
 $('close-inspect').onclick=()=>{selected=null;render()};
 $('gap-text').onchange=e=>setGapNoteText(n.id,e.target.value);
 if($('gap-offer'))$('gap-offer').onchange=e=>{commit(()=>{const a=gnby(n.id);a.offerVariants=e.target.checked},'Режим предложений изменён');selected={type:'gapNote',id:n.id};render()};
 $('gap-link').onclick=()=>beginGapLink('gap_note',n.id);
 $('gap-delete').onclick=()=>deleteGapNote(n.id);
 if($('cw-stage-note'))$('cw-stage-note').onclick=()=>{void cwPrepareNoteStage(n.id)};
 if($('cw-stage-confirm'))$('cw-stage-confirm').onclick=()=>{void cwConfirmNoteStage()};
 if($('cw-stage-cancel'))$('cw-stage-cancel').onclick=()=>{cwStageReview=null;renderInspector()};
}

function gapAnchor(end){if(end.kind==='gap_note'){const n=gnby(end.id);if(!n||n.parent!==state.view)return null;const h=document.querySelector(`[data-gap-note="${n.id}"]`)?.offsetHeight||115;return {x:n.x+126,y:n.y+h/2}};
 if(end.kind==='semantic_field'){const f=fby(end.id);return f&&f.parent===state.view?{x:f.x+f.width/2,y:f.y+f.height/2}:null;}
 if(end.kind==='plot_node'){const n=nby(end.id);return n&&n.parent===state.view?nodeCenter(n):null;}return null;}

function renderEdges(){
 memoRender={dims:new Map(),homes:new Map()};
 const keep=focusIds(),selectedId=selected?.type==='node'?selected.id:null,selectedEdge=selected?.type==='edge'?selected.id:null;
 const plan=connectionPlan();
 const marker='<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="#93908b" stroke-width="1.8"/></marker><marker id="arrOn" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="#e4c78c" stroke-width="1.8"/></marker></defs>';
 let c=marker;
 for(const e of plan.visibleEdges){
   const q=routeMode==='smart'?smartConnector(e):connector(e);if(!q)continue;
   const active=e.id===selectedEdge||e.from===selectedId||e.to===selectedId||plan.reveal.has(e.id);
   const faded=(selectedId||selectedEdge)&&!active;
   const kind=e.type==='causes'?'causal':e.type==='enables'?'enable':'';
   c+=`<g data-edge="${esc(e.id)}" data-routed="${q.routed?'yes':'no'}"><path class="edge ${kind} ${active?'selected':''} ${faded?'faded':''} ${keep&&!(keep.has(e.from)&&keep.has(e.to))?'focus-muted':''}" marker-end="url(#${active?'arrOn':'arr'})" d="${q.d}"/><path class="edge-hit" d="${q.d}" data-edge-target="${esc(e.id)}"/></g>`;
 }
 for(const g of plan.bridges){
   const c0=bridgeCoordinates(g);if(!c0)continue;
   const active=selected?.type==='bridge'&&selected.key===g.key;
   const w=Math.max(40,22+String(g.edges.length).length*11);
   c+=`<g data-bridge="${esc(g.key)}"><path class="bridge-path ${active?'bridge-active':''}" d="${c0.d}"/><path class="bridge-hit" d="${c0.d}" data-bridge-target="${esc(g.key)}"/><g class="bridge-count" data-bridge-target="${esc(g.key)}" tabindex="0" role="button" aria-label="${g.edges.length} связей между полями ${esc(fby(g.from)?.title)} и ${esc(fby(g.to)?.title)}"><rect x="${c0.mx-w/2}" y="${c0.my-15}" width="${w}" height="30" rx="10"/><text x="${c0.mx}" y="${c0.my+1}">${g.edges.length} ↗</text></g></g>`;
 }
 if(plan.overview){for(const [id,count] of plan.localSuppressed){const f=fby(id);if(!f)continue;c+=`<g class="field-links-label"><text x="${f.x+f.width/2}" y="${f.y+f.height-12}">${count} внутренних связей · приблизьте для деталей</text></g>`}}
  for(const l of state.gapLinks){const a=gapAnchor(l.from),b=gapAnchor(l.to);if(!a||!b)continue;
   const active=selected?.type==='gapLink'&&selected.id===l.id;const d=`M ${a.x} ${a.y} L ${b.x} ${b.y}`;
   c+=`<g data-gap-link="${esc(l.id)}"><path class="edge-gap ${active?'selected':''}" marker-end="url(#${active?'arrOn':'arr'})" d="${d}"/><path class="edge-gap-hit" data-gap-link-target="${esc(l.id)}" d="${d}"/></g>`;
  }
  $('edges').innerHTML=c;
  $('edges').querySelectorAll('[data-gap-link-target]').forEach(p=>p.onclick=e=>{e.stopPropagation();selected={type:'gapLink',id:p.dataset.gapLinkTarget};render()});
 $('edges').querySelectorAll('[data-edge-target]').forEach(p=>p.onclick=e=>{e.stopPropagation();selected={type:'edge',id:p.dataset.edgeTarget};render()});
 $('edges').querySelectorAll('[data-bridge-target]').forEach(p=>{p.onclick=e=>{e.stopPropagation();pickBridge(p.dataset.bridgeTarget)};p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pickBridge(p.dataset.bridgeTarget)}}});
 $('world').classList.toggle('semantic-overview',plan.overview);
 lodOverview=plan.overview;
 if($('edge-display'))$('edge-display').textContent=forceAllEdges?'Все связи':plan.overview?'Обзор · связи сгруппированы':'События · точные связи';
 perfStats.displayedEdges=plan.visibleEdges.length;perfStats.bridges=plan.bridges.length;perfStats.suppressedInternal=[...plan.localSuppressed.values()].reduce((a,b)=>a+b,0);
}

const fieldMinimum={width:290,height:185};
const fieldColors=[...COLORS];
const fieldInView=()=>state.fields.filter(f=>f.parent===state.view);
const normalizeField=(f)=>{f.x=Math.round(Number(f.x)||0);f.y=Math.round(Number(f.y)||0);f.width=Math.max(fieldMinimum.width,Math.round(Number(f.width)||fieldMinimum.width));f.height=Math.max(fieldMinimum.height,Math.round(Number(f.height)||fieldMinimum.height))};
function nodeCenter(n){const dimensions=itemDims(n);return {x:n.x+dimensions.w/2,y:n.y+dimensions.h/2}}
function insideField(n,f){if(n.parent!==f.parent)return false;const p=nodeCenter(n);return p.x>=f.x&&p.x<f.x+f.width&&p.y>=f.y&&p.y<f.y+f.height}
// Geometry, not a manual tag, selects objects to carry. Capture once at gesture start.
// Keep field and contained nodes in a single undoable transaction. Do not touch edges.
function membersAtFieldStart(field){return cwActiveNodes().filter(n=>n.parent===field.parent&&insideField(n,field)).map(n=>({id:n.id,x:n.x,y:n.y}))}
function translateFieldAndMembers(fieldId,dx,dy,carry=true,members=null){
 const field=fby(fieldId);if(!field)return;
 const moving=carry?(members||membersAtFieldStart(field)):[];
 field.x=Math.round(field.x+dx);field.y=Math.round(field.y+dy);
 for(const member of moving){const node=nby(member.id);if(node){node.x=Math.round(member.x+dx);node.y=Math.round(member.y+dy)}}
}
function moveField(fieldId,dx,dy,carry=true){
 if(!fby(fieldId)||(!dx&&!dy))return;
 const moving=carry?membersAtFieldStart(fby(fieldId)):[];
 commit(()=>translateFieldAndMembers(fieldId,dx,dy,carry,moving),carry?'Поле и события перемещены':'Перемещено только поле');
}
function recomputeFieldTags(){const fieldIds=new Set(state.fields.map(f=>f.id));const autoFields=state.fields.filter(f=>f.assignmentMode!=='manual');for(const n of state.nodes){n.manualFieldIds=(n.manualFieldIds||[]).filter(id=>fieldIds.has(id));n.manualTags=n.manualTags||[];const center=nodeCenter(n);n.autoFieldIds=autoFields.filter(f=>f.parent===n.parent&&center.x>=f.x&&center.x<f.x+f.width&&center.y>=f.y&&center.y<f.y+f.height).map(f=>f.id)}}
function fieldMembership(n){return [...new Set([...(n.autoFieldIds||[]),...(n.manualFieldIds||[])])].filter(id=>!!fby(id))}
function tagNames(n){return [...fieldMembership(n).map(id=>({id,name:fby(id).title,manual:(n.manualFieldIds||[]).includes(id)})),...(n.manualTags||[]).map(name=>({id:'legacy:'+name,name,manual:true}))]}
function tagPreview(changes){const snapshot=state.nodes.map(n=>({id:n.id,auto:[...(n.autoFieldIds||[])]}));changes();recomputeFieldTags();const changed=state.nodes.filter(n=>JSON.stringify(snapshot.find(s=>s.id===n.id)?.auto||[])!==JSON.stringify(n.autoFieldIds||[])).length;return changed}
// Predict exactly which automatic semantic-field memberships would be lost.
// Spatial membership is computed from node centers at destination; no graph mutation.
function previewNodeMove(startMembers,dx,dy){
 const changes=[],lost=[];const fields=state.fields.filter(f=>f.assignmentMode!=='manual');
 for(const m of startMembers){const n=nby(m.id);if(!n)continue;
  const point={x:m.x+dx+itemDims(n).w/2,y:m.y+dy+itemDims(n).h/2};
  const nextAuto=new Set(fields.filter(f=>f.parent===n.parent&&point.x>=f.x&&point.x<f.x+f.width&&point.y>=f.y&&point.y<f.y+f.height).map(f=>f.id));
  const pinned=new Set(n.manualFieldIds||[]);
  const losing=(n.autoFieldIds||[]).filter(id=>!nextAuto.has(id)&&!pinned.has(id));
  if(losing.length)lost.push({id:n.id,fieldIds:losing});
  changes.push({id:n.id,x:Math.round(m.x+dx),y:Math.round(m.y+dy)});
 }
 const addByField=[];for(const ef of editorialInView()){const added=changes.filter(c=>{const n=nby(c.id);if(!n||n.parent!==ef.parent||ef.memberIds.includes(c.id))return false;const cx=c.x+itemDims(n).w/2,cy=c.y+itemDims(n).h/2;return cx>=ef.x&&cx<ef.x+ef.width&&cy>=ef.y&&cy<ef.y+ef.height}).map(c=>c.id);if(added.length)addByField.push({fieldId:ef.id,nodeIds:added})}
 return {changes,lost,addByField};
}
function applyNodeMove(preview,saveTags){
 if(!preview.changes.length)return;
 commit(()=>{
  for(const update of preview.changes){const node=nby(update.id);if(node){node.x=update.x;node.y=update.y}}
  for(const add of preview.addByField||[]){const field=efby(add.fieldId);if(field)field.memberIds=[...new Set([...field.memberIds,...add.nodeIds])];}
  if(saveTags)for(const loss of preview.lost){const node=nby(loss.id);if(node)node.manualFieldIds=[...new Set([...(node.manualFieldIds||[]),...loss.fieldIds])]}
 },preview.lost.length?(saveTags?'События перемещены · прежние теги закреплены':'События перемещены · автоматические теги сняты'):(preview.addByField?.length?'События добавлены в редакторское задание':'События перемещены'));
}
function askPreserveFieldTags(preview){
 if(!preview.lost.length)return applyNodeMove(preview,false);
 const fieldIds=[...new Set(preview.lost.flatMap(x=>x.fieldIds))];
 const names=fieldIds.map(id=>fby(id)?.title||id);
 modalOpen=true;const host=$('modal-host');
 host.innerHTML=`<div class="backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Сохранить прежние теги"><h2>Сохранить принадлежность?</h2><p>После переноса ${preview.lost.length} ${preview.lost.length===1?'событие потеряет':'событий потеряют'} автоматические метки ${fieldIds.length} ${fieldIds.length===1?'поля':'полей'}: ${esc(names.slice(0,3).join(', '))}${names.length>3?'…':''}.</p><p>Закреплённые теги продолжают обновляться при переименовании исходных смысловых полей.</p><div class="buttons"><button type="button" id="tag-transfer-cancel">Отмена</button><button type="button" id="tag-transfer-drop">Не сохранять</button><button type="button" id="tag-transfer-keep" class="primary">Сохранить теги</button></div></div></div>`;
 const close=()=>{modalOpen=false;host.innerHTML=''};
 $('tag-transfer-cancel').onclick=close;
 $('tag-transfer-drop').onclick=()=>{close();applyNodeMove(preview,false)};
 $('tag-transfer-keep').onclick=()=>{close();applyNodeMove(preview,true)};
 host.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}};
 $('tag-transfer-keep').focus();
}
function moveSelectedBy(dx,dy){const ids=groupIds();if(!ids.length||(!dx&&!dy))return;const members=ids.map(id=>{const n=nby(id);return n?{id,x:n.x,y:n.y}:null}).filter(Boolean);askPreserveFieldTags(previewNodeMove(members,dx,dy))}
function deleteSelectedGroup(){const ids=groupIds();if(ids.length<2)return deleteSelected();
 const chosen=new Set(ids);const children=state.nodes.filter(n=>n.parent&&chosen.has(n.parent));
 if(children.length){note('Группа содержит родительские ноды с деталями — удаление заблокировано');return}
 const links=state.edges.filter(e=>chosen.has(e.from)||chosen.has(e.to)).length;
 if(!confirm(`Удалить ${ids.length} событий и ${links} связанных стрелок? Это одно действие Undo.`))return;
 commit(()=>{state.nodes=state.nodes.filter(n=>!chosen.has(n.id));state.edges=state.edges.filter(e=>!chosen.has(e.from)&&!chosen.has(e.to))},'Группа удалена · Ctrl+Z для отмены');selected=null;selectedNodeIds.clear();render();
}

function renderGuides(){if($('lanes'))$('lanes').innerHTML=''}
// P4c: semantic field tags are derived, persist only confirmed manual pins.
// P4: a rewrite field is an explicit editorial task, not a semantic-tag-producing Field.
// Membership is stored by node ID, not inferred during renders or field movement.
function newEditorialField(title,ids=[],at=null){
 const nodes=[...new Set(ids)].map(nby).filter(n=>n&&n.parent===state.view);
 let bounds;
 if(nodes.length){const left=Math.min(...nodes.map(n=>n.x)),top=Math.min(...nodes.map(n=>n.y));
  const right=Math.max(...nodes.map(n=>n.x+itemDims(n).w)),bottom=Math.max(...nodes.map(n=>n.y+itemDims(n).h));
  bounds={x:Math.round(left-58),y:Math.round(top-82),width:Math.max(330,Math.ceil(right-left+116)),height:Math.max(210,Math.ceil(bottom-top+154))};
 }else if(at){bounds={x:Math.round(at.x),y:Math.round(at.y),width:640,height:330}}
 else{const r=canvasRect();bounds={x:Math.round((r.width*.48-pan.x)/pan.scale-320),y:Math.round((r.height*.47-pan.y)/pan.scale-165),width:640,height:330};}
 const id='ef'+state.nextEditorialField;
 commit(()=>{state.nextEditorialField++;state.editorialFields.push({id,title:title.slice(0,160),...bounds,color:'#998ba7',parent:state.view,status:'open',offerVariants:true,memberIds:nodes.map(n=>n.id)});state.editorialNotes.push({id:'en'+state.nextEditorialNote++,fieldId:id,role:'instruction',text:''})},'Редакторское поле создано · события на прежних местах');
 selected={type:'editorialField',id};render();return id;
}
function createEditorialFieldFromSelection(){const ids=groupIds();if(!ids.length)return note('Выберите события рамкой или Ctrl+кликом');
 notifyModal('Поле переработки','События останутся на месте. Поле обозначит их как редакторское задание.','Название задания',title=>newEditorialField(title,ids),'Переработать этот фрагмент');
}
function createEditorialField(at=null){notifyModal('Новое поле переработки','Штрихованная область для переработки событий. Можно перетащить в неё карточки.','Название задания',title=>newEditorialField(title,[],at),'Переработать фрагмент')}
function updateEditorialInstruction(id,text){const f=efby(id);if(!f)return;const value=String(text).slice(0,8000);const old=state.editorialNotes.find(n=>n.fieldId===id);if(old?.text===value)return;
 commit(()=>{const rec=state.editorialNotes.find(n=>n.fieldId===id);if(rec)rec.text=value;else state.editorialNotes.push({id:'en'+state.nextEditorialNote++,fieldId:id,role:'instruction',text:value})},'Редакторская заметка сохранена');
 selected={type:'editorialField',id};render();
}
function focusEditorialNote(id){
 const field=efby(id);if(!field)return;
 selected={type:'editorialField',id};render();
 const input=[...document.querySelectorAll('.editorial-field[data-editorial-field] .editorial-inline-note')].find(el=>el.closest('[data-editorial-field]')?.dataset.editorialField===id);
 if(!input)return note('Заметка недоступна на текущем уровне полотна');
 input.focus({preventScroll:true});
 const end=input.value.length;input.setSelectionRange(end,end);
}
function addEditorialMembers(id,nodeIds){const field=efby(id);if(!field)return false;
 const existing=new Set(field.memberIds);const valid=[...new Set(nodeIds)].filter(n=>nby(n)?.parent===field.parent&&!existing.has(n));
 if(!valid.length)return false;commit(()=>{efby(id).memberIds.push(...valid)},'События добавлены в задание на переработку');selected={type:'editorialField',id};render();return true;
}
function addSelectedToEditorialField(){
 const ids=groupIds(),fields=editorialInView();if(!ids.length||!fields.length)return note('Выделите события и создайте хотя бы одно редакторское поле');
 modalOpen=true;const host=$('modal-host');host.innerHTML=`<div class="backdrop"><form class="modal" id="ef-target-form" aria-label="Добавить в редакторское задание"><h2>Добавить события в задание</h2><p>Выбрано ${ids.length} событий. Смысловые теги и позиции не изменятся.</p><select id="ef-target" style="width:100%">${fields.map(f=>`<option value="${esc(f.id)}">${esc(f.title)} (${f.memberIds.length})</option>`).join('')}</select><div class="buttons"><button id="ef-target-cancel" type="button">Отмена</button><button type="submit" class="primary">Добавить</button></div></form></div>`;
 const close=()=>{modalOpen=false;host.innerHTML=''};
 $('ef-target-cancel').onclick=close;
 $('ef-target-form').onsubmit=e=>{e.preventDefault();const id=$('ef-target').value;close();addEditorialMembers(id,ids)};
 $('ef-target').focus();
}
function removeEditorialMembers(id,nodeIds){const field=efby(id);if(!field)return;const removing=new Set(nodeIds);commit(()=>{efby(id).memberIds=efby(id).memberIds.filter(n=>!removing.has(n))},'События исключены из задания');selected={type:'editorialField',id};render()}
function deleteEditorialField(id){const f=efby(id);if(!f)return;if(!confirm(`Удалить задание «${f.title}»? События, стрелки и смысловые теги останутся. Действие можно отменить.`))return;
 commit(()=>{state.editorialFields=state.editorialFields.filter(x=>x.id!==id);state.editorialNotes=state.editorialNotes.filter(x=>x.fieldId!==id)},'Задание удалено · исходные события не затронуты');selected=null;render();
}
function renderEditorialInspector(el,f){el.hidden=false;const taskNote=state.editorialNotes.find(n=>n.fieldId===f.id);
 const ns=f.memberIds.map(nby).filter(Boolean);const nodeIds=ns.map(n=>n.id);
 const inside=visible().filter(n=>!nodeIds.includes(n.id));
 el.innerHTML=`<div class="inspect-head"><b>▨ На переработку</b><button id="close-inspect" title="Закрыть">×</button></div>
  <div class="field"><label>Название задания</label><input id="ef-title" maxlength="160" value="${esc(f.title)}"></div>
  <div class="field"><label class="check-row"><input type="checkbox" id="ef-offer-variants" ${f.offerVariants?'checked':''}>Предлагать три варианта</label></div>
  <div class="field"><label>События для переработки (${ns.length})</label>${ns.map(n=>`<div class="field-tag-row"><span title="${esc(n.title)}">${esc(n.title)}</span><button data-ef-remove="${esc(n.id)}" title="Исключить из задания, не удаляя событие">×</button></div>`).join('')||'<p class="muted">Перетащите события внутрь поля или добавьте выбранные.</p>'}</div>
  <div class="inspect-actions"><button id="ef-delete">Удалить задание…</button></div><p class="muted">Варианты будет создавать ChatGPT после подключения P5. Исходные события не меняются.</p>`;
 $('close-inspect').onclick=()=>{selected=null;render()};
 $('ef-title').onchange=e=>{const title=e.target.value.trim();if(title&&title!==f.title){commit(()=>{efby(f.id).title=title},'Задание переименовано');selected={type:'editorialField',id:f.id};render()}};
 $('ef-offer-variants').onchange=e=>{commit(()=>{efby(f.id).offerVariants=e.target.checked},'Режим вариантов изменён');selected={type:'editorialField',id:f.id};render()};
 el.querySelectorAll('[data-ef-remove]').forEach(b=>b.onclick=()=>removeEditorialMembers(f.id,[b.dataset.efRemove]));
 $('ef-delete').onclick=()=>deleteEditorialField(f.id);
}
function renderEditorialFields(){const host=$('editorial-fields');host.innerHTML='';
 for(const f of editorialInView()){
  const el=document.createElement('section');el.className='editorial-field'+(selected?.type==='editorialField'&&selected.id===f.id?' selected':'');
  el.dataset.editorialField=f.id;el.style.cssText=`left:${f.x}px;top:${f.y}px;width:${f.width}px;height:${f.height}px;--editorial-color:${f.color||'#998ba7'}`;
  const text=state.editorialNotes.find(n=>n.fieldId===f.id)?.text||'';
  el.innerHTML=`<div class="editorial-head" role="button" tabindex="0" aria-label="Редакторское поле ${esc(f.title)}"><span>▨ На переработку · ${esc(f.title)}</span><small>${f.memberIds.length}</small></div><textarea class="editorial-inline-note" rows="2" maxlength="8000" placeholder="Что изменить?">${esc(text)}</textarea><div class="editorial-grip" title="Изменить размер редакторского поля">⌟</div>`;
  host.append(el);
  const head=el.querySelector('.editorial-head'),grip=el.querySelector('.editorial-grip'),noteInput=el.querySelector('.editorial-inline-note');
  const select=()=>{selected={type:'editorialField',id:f.id};render()};
  const autosize=()=>{noteInput.style.height='auto';noteInput.style.height=Math.min(98,Math.max(34,noteInput.scrollHeight))+'px'};autosize();
  ;['pointerdown','click','dblclick','mousedown'].forEach(type=>noteInput.addEventListener(type,e=>e.stopPropagation()));
  noteInput.addEventListener('focus',()=>{selected={type:'editorialField',id:f.id};renderInspector();positionInspector()});
  noteInput.addEventListener('input',autosize);noteInput.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  noteInput.addEventListener('change',e=>updateEditorialInstruction(f.id,e.target.value));
  noteInput.addEventListener('blur',e=>updateEditorialInstruction(f.id,e.target.value));
  head.onclick=e=>{e.stopPropagation();if(!interaction)select()};
  head.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}};
  const begin=(ev,kind)=>{if(ev.button!==0)return;ev.preventDefault();ev.stopPropagation();interaction={type:kind,id:f.id,px:ev.clientX,py:ev.clientY,start:{x:f.x,y:f.y,width:f.width,height:f.height},moved:false};ev.currentTarget.setPointerCapture(ev.pointerId)};
  head.addEventListener('pointerdown',e=>begin(e,'editorial-move'));grip.addEventListener('pointerdown',e=>begin(e,'editorial-resize'));
  const preview=(ev,kind)=>{const i=interaction;if(!i||i.type!==kind||i.id!==f.id)return;const dx=(ev.clientX-i.px)/pan.scale,dy=(ev.clientY-i.py)/pan.scale;if(Math.abs(dx)+Math.abs(dy)>5)i.moved=true;if(!i.moved)return;if(kind==='editorial-move'){el.style.left=Math.round(i.start.x+dx)+'px';el.style.top=Math.round(i.start.y+dy)+'px'}else{el.style.width=Math.max(330,Math.round(i.start.width+dx))+'px';el.style.height=Math.max(210,Math.round(i.start.height+dy))+'px';requestAnimationFrame(autosize)}};
  head.addEventListener('pointermove',e=>preview(e,'editorial-move'));grip.addEventListener('pointermove',e=>preview(e,'editorial-resize'));
  const finish=(ev,kind)=>{const i=interaction;if(!i||i.type!==kind||i.id!==f.id)return;interaction=null;ev.stopPropagation();if(!i.moved){select();return}const dx=(ev.clientX-i.px)/pan.scale,dy=(ev.clientY-i.py)/pan.scale;commit(()=>{const ef=efby(f.id);if(kind==='editorial-move'){ef.x=Math.round(i.start.x+dx);ef.y=Math.round(i.start.y+dy)}else{ef.width=Math.max(330,Math.round(i.start.width+dx));ef.height=Math.max(210,Math.round(i.start.height+dy))}},'Редакторское поле перемещено · события не менялись');selected={type:'editorialField',id:f.id};render()};
  head.addEventListener('pointerup',e=>finish(e,'editorial-move'));grip.addEventListener('pointerup',e=>finish(e,'editorial-resize'));
  const cancel=(ev,kind)=>{const i=interaction;if(i?.type===kind&&i.id===f.id){interaction=null;render()}};
  head.addEventListener('pointercancel',e=>cancel(e,'editorial-move'));grip.addEventListener('pointercancel',e=>cancel(e,'editorial-resize'));
 }
}
function renderFields(){const host=$('fields');host.innerHTML='';if(!guide)return;const keep=focusIds();const counts=new Map();for(const n of visible())for(const id of fieldMembership(n))counts.set(id,(counts.get(id)||0)+1);for(const f of fieldInView()){
 const el=document.createElement('section');el.className='story-field'+(selected?.type==='field'&&selected.id===f.id?' selected':'')+(keep&&selected?.type!=='field'&&!state.nodes.some(n=>keep.has(n.id)&&fieldMembership(n).includes(f.id))?' focus-muted':'');el.dataset.field=f.id;el.style.cssText=`left:${f.x}px;top:${f.y}px;width:${f.width}px;height:${f.height}px;--field-color:${f.color}`;
 const count=counts.get(f.id)||0;
 el.innerHTML=`<div class="field-head" data-tip="Перетащите поле вместе с событиями. Alt + перетаскивание — только поле. Двойной клик — показать поле." role="button" tabindex="0" aria-label="Поле ${esc(f.title)}. Перетащите, чтобы переместить вместе с событиями, или удерживайте Alt, чтобы переместить только поле"><span class="field-head-dot"></span><span>${esc(f.title)}</span><span class="field-head-count">${count}</span></div><div class="field-grip" data-tip="Перетащите угол, чтобы изменить размер поля" role="button" tabindex="0" title="Растянуть поле" aria-label="Изменить размер поля ${esc(f.title)}">⌟</div>`;
 host.append(el);
 const head=el.querySelector('.field-head');const grip=el.querySelector('.field-grip');
 
 const begin=(ev,kind)=>{if(ev.button!==0)return;ev.stopPropagation();selected={type:'field',id:f.id};const payload={type:kind,id:f.id,px:ev.clientX,py:ev.clientY,start:{x:f.x,y:f.y,width:f.width,height:f.height},moved:false};if(kind==='field-move'){payload.carryNodes=!ev.altKey;payload.members=payload.carryNodes?membersAtFieldStart(f):[]}interaction=payload;ev.currentTarget.setPointerCapture(ev.pointerId)};
 head.addEventListener('pointerdown',e=>begin(e,'field-move'));grip.addEventListener('pointerdown',e=>begin(e,'field-resize'));
 const preview=(ev,kind)=>{const i=interaction;if(!i||i.type!==kind||i.id!==f.id)return;const dx=(ev.clientX-i.px)/pan.scale,dy=(ev.clientY-i.py)/pan.scale;if(Math.abs(dx)+Math.abs(dy)>4)i.moved=true;if(!i.moved)return;if(kind==='field-move'){el.style.left=Math.round(i.start.x+dx)+'px';el.style.top=Math.round(i.start.y+dy)+'px';if(i.carryNodes){for(const member of i.members){const nodeEl=document.querySelector(`[data-node="${member.id}"]`);if(nodeEl){nodeEl.style.left=Math.round(member.x+dx)+'px';nodeEl.style.top=Math.round(member.y+dy)+'px'}const node=nby(member.id);if(node){node.x=member.x+dx;node.y=member.y+dy}}renderEdges()}}else{el.style.width=Math.max(fieldMinimum.width,Math.round(i.start.width+dx))+'px';el.style.height=Math.max(fieldMinimum.height,Math.round(i.start.height+dy))+'px'}};
 head.addEventListener('pointermove',e=>preview(e,'field-move'));grip.addEventListener('pointermove',e=>preview(e,'field-resize'));
 const finish=(ev,kind)=>{const i=interaction;if(!i||i.type!==kind||i.id!==f.id)return;interaction=null;ev.stopPropagation();if(!i.moved){if(completeGapLink('semantic_field',f.id))return;selected={type:'field',id:f.id};render();return}const dx=(ev.clientX-i.px)/pan.scale,dy=(ev.clientY-i.py)/pan.scale;if(kind==='field-move'&&i.carryNodes){for(const member of i.members){const node=nby(member.id);if(node){node.x=member.x;node.y=member.y}}}commit(()=>{const sf=fby(f.id);if(kind==='field-move'){translateFieldAndMembers(f.id,Math.round(i.start.x+dx)-i.start.x,Math.round(i.start.y+dy)-i.start.y,i.carryNodes,i.members)}else{sf.width=Math.max(fieldMinimum.width,Math.round(i.start.width+dx));sf.height=Math.max(fieldMinimum.height,Math.round(i.start.height+dy))}},kind==='field-move'?(i.carryNodes?'Поле и события перемещены · метки обновлены':'Перемещено только поле · метки обновлены'):'Размер поля изменён · метки обновлены')};
 head.addEventListener('pointerup',e=>finish(e,'field-move'));grip.addEventListener('pointerup',e=>finish(e,'field-resize'));
 // A cancelled drag must not leave an uncommitted movement in the graph or layout.
 const cancel=(ev,kind)=>{const i=interaction;if(!i||i.type!==kind||i.id!==f.id)return;interaction=null;if(kind==='field-move'&&i.carryNodes){for(const member of i.members){const node=nby(member.id);if(node){node.x=member.x;node.y=member.y}}}render();};
 head.addEventListener('pointercancel',e=>cancel(e,'field-move'));grip.addEventListener('pointercancel',e=>cancel(e,'field-resize'));
 head.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(e.shiftKey)jumpToField(f.id);else{selected={type:'field',id:f.id};render()}}});head.addEventListener('dblclick',e=>{e.stopPropagation();jumpToField(f.id)});
 grip.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selected={type:'field',id:f.id};render()}});
 }}
function placeNewField(){
 const r=$('canvas').getBoundingClientRect();
 const cx=(r.width*.5-pan.x)/pan.scale,cy=(r.height*.5-pan.y)/pan.scale;
 const w=680,h=285;
 const rectangles=[...visible().map(n=>{const s=itemDims(n);return{x:n.x,y:n.y,w:s.w,h:s.h,weight:3}}),...fieldInView().map(f=>({x:f.x,y:f.y,w:f.width,h:f.height,weight:1}))];
 const proposals=[[-w/2,-h/2],[.35*w,-h/2],[-w/2,h*.9],[-w/2,-h*1.65],[w*1.2,-h/2],[w*1.2,h*.9],[-w*1.75,h*.9],[-w*1.75,-h/2]];
 const bounds=contentBounds();proposals.push([bounds.x+bounds.w+50-cx,-h/2]);
 let best=null,bestScore=Infinity;
 for(let i=0;i<proposals.length;i++){
  const [ox,oy]=proposals[i];const x=Math.round(cx+ox),y=Math.round(cy+oy);
  let score=i*.15;
  for(const z of rectangles){const dx=Math.max(0,Math.min(x+w,z.x+z.w)-Math.max(x,z.x));const dy=Math.max(0,Math.min(y+h,z.y+z.h)-Math.max(y,z.y));score+=z.weight*dx*dy/(w*h)*100}
  if(score<bestScore){bestScore=score;best={x,y,width:w,height:h}}
 }
 return best;
}
function createField(at=null){notifyModal('Новое поле','Назовите смысловую область. Перемещать и изменять размер можно прямо на полотне.','Название поля',title=>{
 const location=at?{x:Math.round(at.x),y:Math.round(at.y),width:680,height:285}:placeNewField();let number=state.nextField;const used=new Set(state.fields.map(f=>f.id));while(used.has('f'+number))number++;
 const created='f'+number;
 commit(()=>{state.nextField=number+1;state.fields.push({id:created,title,comment:'',...location,color:fieldColors[state.fields.length%fieldColors.length],assignmentMode:'auto',parent:state.view});guide=true},'Поле создано');
 selected={type:'field',id:created};render();
 const r=canvasRect();const scale=Math.min(1.05,Math.max(.5,Math.min((r.width-120)/location.width,(r.height-145)/location.height)));
 if(!at)centerAt(location.x+location.width/2,location.y+location.height/2,scale);
 })}
function deleteField(id){const f=fby(id);if(!f)return;const affected=state.nodes.filter(n=>fieldMembership(n).includes(id));modalOpen=true;
 $('modal-host').innerHTML=`<div class="backdrop"><form class="modal" id="delete-field-dialog"><h2>Удалить поле «${esc(f.title)}»?</h2><p>Карточки и стрелки останутся на месте. У ${affected.length} событий могут измениться метки.</p><label class="check-row"><input type="checkbox" id="keep-field-tags" checked>Сохранить текущие метки как обычные теги</label><div class="buttons"><button type="button" id="field-delete-cancel">Отмена</button><button type="submit" class="primary">Удалить поле</button></div></form></div>`;
 const close=()=>{modalOpen=false;$('modal-host').innerHTML=''};
 $('field-delete-cancel').onclick=close;
 $('delete-field-dialog').onsubmit=e=>{e.preventDefault();const keep=$('keep-field-tags').checked;close();commit(()=>{for(const n of state.nodes){if(keep&&fieldMembership(n).includes(id)){n.manualTags=n.manualTags||[];if(!n.manualTags.includes(f.title))n.manualTags.push(f.title)}n.manualFieldIds=(n.manualFieldIds||[]).filter(i=>i!==id);n.autoFieldIds=(n.autoFieldIds||[]).filter(i=>i!==id)}state.fields=state.fields.filter(x=>x.id!==id)},keep?'Поле удалено, текстовые теги сохранены':'Поле и его теги удалены');selected=null;render()}
}
function renderFieldInspector(el,f){el.hidden=false;
 el.innerHTML=`<div class="inspect-head"><b>Поле · ${esc(f.title)}</b><button id="close-inspect" title="Закрыть">×</button></div>
 <div class="field"><label>Название и тег</label><input id="f-title" maxlength="160" value="${esc(f.title)}"></div>
 <div class="field"><label>Цвет поля</label><div>${fieldColors.map(c=>`<label class="palette-choice" title="Выбрать цвет поля"><input type="radio" name="f-color" value="${c}" ${f.color===c?'checked':''}><span style="background:${c};width:12px;height:12px;display:inline-block;border-radius:50%"></span></label>`).join('')}</div></div>
 <div class="field"><label for="f-comment">Комментарий к полю <span class="label-help" tabindex="0" data-tip="Заметка автора. Не изменяет события, стрелки или теги.">ⓘ</span></label><textarea id="f-comment" maxlength="4000" placeholder="Что объединяет события в этом поле?">${esc(f.comment||'')}</textarea></div>
 <div class="field"><label for="f-mode">Назначение тегов <span class="label-help" tabindex="0" data-tip="Автоматически: по расположению карточек. Вручную: только закреплённые вами метки.">ⓘ</span></label><select id="f-mode"><option value="auto" ${f.assignmentMode==='auto'?'selected':''}>Автоматически по положению</option><option value="mixed" ${f.assignmentMode==='mixed'?'selected':''}>Автоматически + ручные закрепления</option><option value="manual" ${f.assignmentMode==='manual'?'selected':''}>Только вручную</option></select></div>
 <hr><div class="inspect-actions"><button id="f-zoom" data-tip="Показать всё поле целиком на экране">Показать поле</button><button id="f-delete" data-tip="Удалить только область. События останутся на полотне.">Удалить поле</button></div>`;
 $('f-title').onchange=e=>{const title=e.target.value.trim();if(title)commit(()=>fby(f.id).title=title,'Поле переименовано')};
 el.querySelectorAll('input[name="f-color"]').forEach(e=>e.onchange=()=>commit(()=>fby(f.id).color=e.value,'Цвет поля изменён'));
 $('f-comment').onchange=e=>{const value=e.target.value.slice(0,4000);if(value!==(fby(f.id)?.comment||''))commit(()=>{fby(f.id).comment=value},'Комментарий сохранён')};
 $('f-mode').onchange=e=>commit(()=>{fby(f.id).assignmentMode=e.target.value},'Режим назначения тегов обновлён');
 $('f-zoom').onclick=()=>jumpToField(f.id);$('f-delete').onclick=()=>deleteField(f.id);$('close-inspect').onclick=()=>{selected=null;render()};
}

function renderNodes(){const host=$('nodes');host.innerHTML='';const keep=focusIds(),chosen=new Set(groupIds()),parentsWithChildren=new Set(state.nodes.filter(k=>k.parent).map(k=>k.parent));for(const n of visible()){const rewrite=rewriteBy(n.id);const el=document.createElement('article');el.className='node '+(n.size||'normal')+(rewrite?' rewrite-draft':'')+(chosen.has(n.id)?' selected':'')+(n.status==='proposed'?' node-proposed':'')+(keep&&!keep.has(n.id)?' focus-muted':'');el.dataset.node=n.id;el.style.left=n.x+'px';el.style.top=n.y+'px';if(Number.isFinite(n.width)||Number.isFinite(n.height))el.classList.add('node-custom-size');if(Number.isFinite(n.width))el.style.width=widthOf(n)+'px';if(Number.isFinite(n.height))el.style.minHeight=heightOf(n)+'px';el.style.setProperty('--color',colorOf(n));el.tabIndex=0;el.setAttribute('aria-label',(rewrite?'Заметка переработки: ':'Событие: ')+n.title);el.innerHTML=`${chosen.size===1&&chosen.has(n.id)?`<div class="node-actions">${!rewrite?'<button data-command="inside" title="Открыть детали">↗ Внутрь</button><button data-command="link" title="Соединить с другим событием">↗ Связать</button>':''}<button data-command="edit" title="Редактировать">⋯</button></div>`:''}${rewrite?'<div class="ux014-node-kind">▤ Заметка · переработка</div>':''}<div class="node-header"><div class="node-marker"></div><div class="node-title">${esc(n.title)}</div></div><div class="node-note">${esc(rewrite?(rewrite.taskText||'Что изменить?'):(n.description||'Добавьте короткое описание события'))}</div><div class="node-foot">${rewrite?`<span class="ux014-rewrite-status">Исходник сохранён · ${rewrite.offerVariants?'3 варианта':'1 вариант'}</span>`:tagNames(n).map(tag=>`<span class="field-chip ${tag.manual?'manual-chip':''}" title="${tag.manual?'Закреплённый тег':'Назначен полем'}">${esc(tag.name)}</span>`).join('')}${!rewrite&&!tagNames(n).length?'<span>Без поля</span>':''}${!rewrite?editorialInView().filter(ef=>ef.memberIds.includes(n.id)).map(ef=>`<span class="editorial-chip" title="Редакторское задание, не смысловой тег">▨ ${esc(ef.title)}</span>`).join(''):''}${!rewrite&&parentsWithChildren.has(n.id)?'<span class="tag">Есть детали</span>':''}</div>${rewrite?'':'<button class="node-add" title="Продолжить сюжет" data-command="after">+</button>'}${chosen.size===1&&chosen.has(n.id)?'<button class="node-resize-grip" title="Изменить ширину и высоту карточки" aria-label="Изменить размер ноды">⤡</button>':''}`;host.append(el);
 el.onclick=e=>{if(e.target.closest('button'))return;e.stopPropagation();if(dragCompletedFor===n.id){dragCompletedFor=null;return}if(completeGapLink('plot_node',n.id))return;if(linkFrom){finishLink(n.id);return}if(e.ctrlKey||e.metaKey){toggleNodeSelection(n.id);return}setNodeSelection([n.id],n.id)};el.ondblclick=e=>{if(e.target.closest('button'))return;e.stopPropagation();notifyModal('Переименовать','Изменение не затронет связи.', 'Название',v=>commit(()=>{nby(n.id).title=v},'Название изменено'),n.title)};
 el.querySelectorAll('[data-command]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=n.id;const c=b.dataset.command;if(c==='after')addAfter(id);if(c==='link'){linkFrom=id;selected={type:'node',id};render();note('Нажмите на другую карточку — создадим последовательность')}if(c==='edit'){selected={type:'node',id};renderInspector()}if(c==='inside'){state.view=id;selected=null;pan={x:110,y:95,scale:1};render();note('Внутренний уровень — отдельное полотно')}});
 const grip=el.querySelector('.node-resize-grip');
 if(grip){
  grip.addEventListener('pointerdown',ev=>{if(ev.button!==0)return;ev.preventDefault();ev.stopPropagation();interaction={type:'node-resize',id:n.id,px:ev.clientX,py:ev.clientY,w:widthOf(n),h:heightOf(n)||el.offsetHeight,moved:false};grip.setPointerCapture(ev.pointerId)});
  grip.addEventListener('pointermove',ev=>{const i=interaction;if(!i||i.type!=='node-resize'||i.id!==n.id)return;const dx=(ev.clientX-i.px)/pan.scale,dy=(ev.clientY-i.py)/pan.scale;if(Math.abs(dx)+Math.abs(dy)>4)i.moved=true;if(!i.moved)return;el.style.width=Math.round(Math.max(180,Math.min(780,i.w+dx)))+'px';el.style.minHeight=Math.round(Math.max(95,Math.min(640,i.h+dy)))+'px';if(memoRender)memoRender.dims.delete(n.id);renderEdges()});
  grip.addEventListener('pointerup',ev=>{const i=interaction;if(!i||i.type!=='node-resize'||i.id!==n.id)return;interaction=null;ev.stopPropagation();if(!i.moved)return;const width=Math.round(Math.max(180,Math.min(780,i.w+(ev.clientX-i.px)/pan.scale))),height=Math.round(Math.max(95,Math.min(640,i.h+(ev.clientY-i.py)/pan.scale)));commit(()=>{n.width=width;n.height=height},'Размер карточки изменён · метки пересчитаны')});
  grip.addEventListener('pointercancel',()=>{if(interaction?.type==='node-resize'&&interaction.id===n.id){interaction=null;render()}});
 }
 el.addEventListener('pointerdown',ev=>{
  if(ev.button!==0||ev.target.closest('button')||ev.ctrlKey||ev.metaKey)return;
  const ids=selected?.type==='node'&&groupIds().includes(n.id)?groupIds():[n.id];
  const members=ids.map(id=>{const nd=nby(id);return nd?{id,x:nd.x,y:nd.y}:null}).filter(Boolean);
  interaction={type:'node',id:n.id,startX:ev.clientX,startY:ev.clientY,members,moved:false};
  el.setPointerCapture(ev.pointerId);
 });
 el.addEventListener('pointermove',ev=>{const i=interaction;if(!i||i.type!=='node'||i.id!==n.id)return;
  const dx=(ev.clientX-i.startX)/pan.scale,dy=(ev.clientY-i.startY)/pan.scale;
  if(Math.abs(ev.clientX-i.startX)+Math.abs(ev.clientY-i.startY)>5)i.moved=true;
  if(!i.moved)return;
  for(const m of i.members){const node=nby(m.id);if(!node)continue;node.x=m.x+dx;node.y=m.y+dy;
   const dom=document.querySelector(`[data-node="${m.id}"]`);if(dom){dom.style.left=node.x+'px';dom.style.top=node.y+'px'}
  }
  renderEdges();
 });
 const restoreMove=i=>{for(const m of i.members){const nd=nby(m.id);if(nd){nd.x=m.x;nd.y=m.y}}};
 el.addEventListener('pointerup',ev=>{const i=interaction;if(!i||i.type!=='node'||i.id!==n.id)return;interaction=null;
  if(!i.moved)return;
  const dx=(ev.clientX-i.startX)/pan.scale,dy=(ev.clientY-i.startY)/pan.scale;
  restoreMove(i);ev.stopPropagation();dragCompletedFor=n.id;setTimeout(()=>{if(dragCompletedFor===n.id)dragCompletedFor=null},0);
  setNodeSelection(i.members.map(m=>m.id),n.id);
  askPreserveFieldTags(previewNodeMove(i.members,dx,dy));
 });
 el.addEventListener('pointercancel',()=>{const i=interaction;if(i?.type==='node'&&i.id===n.id){interaction=null;restoreMove(i);render()}});
 el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(e.ctrlKey||e.metaKey)toggleNodeSelection(n.id);else setNodeSelection([n.id],n.id)}if(e.key==='Delete'){e.preventDefault();if(groupIds().length>1&&groupIds().includes(n.id))deleteSelectedGroup();else{selected={type:'node',id:n.id};selectedNodeIds.clear();deleteSelected()}}};
 }
 renderEdges()}
function renderSingleEventRewriteInspector(el,n,d){
 el.hidden=false;
 const tip='Исходное событие\nТо же место на графе · исходные связи сохранены';
 el.innerHTML=`<div class="inspect-head"><button type="button" class="ux014-header-title rewrite-heading-tip" id="rewrite-heading" data-tip="${esc(tip)}" aria-label="Переработка события. Исходное событие; то же место на графе, исходные связи сохранены" aria-describedby="hover-help">Переработка события <span aria-hidden="true" class="ux014-info">ⓘ</span></button><span class="inspect-top-tools"><button id="pin-inspect" title="${inspectorPinned?'Вернуть окно к событию':'Закрепить окно справа'}">${inspectorPinned?'↗ Рядом':'▣ Справа'}</button><button id="close-inspect" title="Закрыть">×</button></span></div>
 <div class="ux014-original"><strong class="ux014-original-title">${esc(n.title)}</strong><p class="ux014-original-description">${esc(n.description||'Описание отсутствует')}</p></div>
 <div class="field"><label for="ux014-task">Что изменить?</label><textarea id="ux014-task" class="ux014-task" maxlength="20000" placeholder="Опишите задачу для ChatGPT">${esc(d.taskText)}</textarea></div>
 <div class="field"><label class="check-row"><input id="ux014-offer" type="checkbox" ${d.offerVariants?'checked':''}>Предлагать три варианта</label></div>
 <p class="ux014-quiet-note">Исходное содержание не изменяется. Подготовка и применение вариантов появятся после P5/P6.</p>
 <button class="ux014-generate" type="button" disabled title="Генерация вариантов пока не подключена">Подготовить ${d.offerVariants?'3 варианта':'1 вариант'}</button>
 <div class="ux014-rewrite-actions"><button id="ux014-cancel" type="button">← Отменить переработку</button></div>`;
 $('pin-inspect').onclick=()=>{inspectorPinned=!inspectorPinned;renderInspector();positionInspector()};
 $('close-inspect').onclick=()=>{selected=null;render()};
 $('ux014-cancel').onclick=()=>cancelEventRewrite(n.id);
 $('ux014-offer').onchange=e=>{commit(()=>{const draft=rewriteBy(n.id);if(draft)draft.offerVariants=e.target.checked},'Режим вариантов обновлён');selected={type:'node',id:n.id};render()};
 const editor=$('ux014-task');let editing=false;
 editor.onfocus=()=>{editing=false};
 editor.oninput=e=>{
  const draft=rewriteBy(n.id);if(!draft)return;
  if(!editing){history.push(JSON.stringify(persistentGraph()));if(history.length>60)history.shift();state.revision++;editing=true}
  draft.taskText=e.target.value;save();
  const card=document.querySelector(`[data-node="${n.id}"] .node-note`);
  if(card)card.textContent=draft.taskText||'Что изменить?';
  memoRender=null;renderEdges();
 };
}
function renderInspector(){const el=$('inspector');if(!selected){el.hidden=true;return}
 if(selected.type==='node'&&groupIds().length>1){el.hidden=false;el.innerHTML=`<div class="inspect-head"><b>Выделено ${groupIds().length} событий</b><button id="close-inspect">×</button></div><p class="muted">Перетаскивайте любую выбранную карточку, чтобы переместить группу. Ctrl/⌘+клик — добавить или исключить. Shift+рамка — расширить выбор.</p><p class="muted">При выходе из смыслового поля предлагается сохранить его тег.</p><div class="inspect-actions"><button id="group-editorial">▨ Поле переработки</button>${editorialInView().length?'<button id="group-add-existing">Добавить в задание…</button>':''}<button id="group-clear">Снять выделение</button><button id="group-delete">Удалить выбранные…</button></div>`;$('close-inspect').onclick=$('group-clear').onclick=()=>setNodeSelection([]);$('group-delete').onclick=deleteSelectedGroup;$('group-editorial').onclick=createEditorialFieldFromSelection;if($('group-add-existing'))$('group-add-existing').onclick=addSelectedToEditorialField;return}
if(selected.type==='gapNote'){const n=gnby(selected.id);if(!n){el.hidden=true;return}return renderGapInspector(el,n)}
 if(selected.type==='gapLink'){const l=state.gapLinks.find(x=>x.id===selected.id);if(!l){el.hidden=true;return}el.hidden=false;el.innerHTML=`<div class="inspect-head"><b>Связь заметки</b><button id="close-inspect">×</button></div><p class="muted">Редакторский контекст, не причинная связь истории.</p><button id="gap-link-delete">Удалить связь</button>`;$('close-inspect').onclick=()=>{selected=null;render()};$('gap-link-delete').onclick=()=>{commit(()=>{state.gapLinks=state.gapLinks.filter(x=>x.id!==l.id)},'Связь удалена');selected=null;render()};return}
 if(selected.type==='editorialField'){const ef=efby(selected.id);if(!ef){el.hidden=true;return}return renderEditorialInspector(el,ef)}
if(selected.type==='bridge')return renderBridgeInspector(el);if(selected.type==='field'){const f=fby(selected.id);if(!f){el.hidden=true;return}return renderFieldInspector(el,f)}if(selected.type==='node'){const n=nby(selected.id);if(!n){el.hidden=true;return}const existingDraft=rewriteBy(n.id);if(existingDraft)return renderSingleEventRewriteInspector(el,n,existingDraft);el.hidden=false;el.innerHTML=`<div class="inspect-head"><b>Событие</b><span class="inspect-top-tools"><button id="pin-inspect" title="${inspectorPinned?'Вернуть окно к событию':'Закрепить окно справа'}">${inspectorPinned?'↗ Рядом':'▣ Справа'}</button><button id="close-inspect" title="Закрыть">×</button></span></div><div class="field"><label>Название</label><input id="field-title" value="${esc(n.title)}"></div><div class="field"><label>Описание</label><textarea id="field-desc">${esc(n.description||'')}</textarea></div><div class="field"><label>Сюжетные линии</label>${state.lanes.map(l=>`<label class="check-row"><input type="checkbox" data-line-check="${l.id}" ${n.lineIds.includes(l.id)?'checked':''}><span style="color:${l.color}">●</span>${esc(l.title)}</label>`).join('')}</div><div class="field"><label>Смысловые поля</label><div class="field-list">${tagNames(n).map(t=>`<span class="field-badge" data-actual-tag="${esc(t.id)}">${esc(t.name)} ${t.manual?'<span class="tiny">закреплено</span>':'<span class="tiny">по расположению</span>'}</span>`).join('')||'<span class="muted">Вне смысловых полей</span>'}</div>${(n.manualFieldIds||[]).filter(id=>!!fby(id)).map(id=>`<div class="field-tag-row"><span>Закреплено: ${esc(fby(id).title)}</span><button data-unpin-field="${esc(id)}" title="Снять ручное закрепление. Принадлежность по расположению сохранится">Открепить</button></div>`).join('')}</div><div class="field"><label>Цвет карточки</label><div class="node-palette"><button type="button" class="node-palette-auto ${!n.color?'active':''}" data-node-color="auto" title="Цвет по сюжетной линии">Авто</button>${COLORS.map(c=>`<button type="button" class="node-palette-swatch ${n.color===c?'active':''}" data-node-color="${c}" title="Выбрать цвет" style="--swatch:${c}"><span></span></button>`).join('')}</div></div><hr><div class="ux014-main-action"><button id="i-rewrite" type="button">✎ Переработать событие</button></div><div class="ux014-delete-line"><button id="i-delete" type="button">Удалить…</button></div>`; $('pin-inspect').onclick=()=>{inspectorPinned=!inspectorPinned;renderInspector();positionInspector()};el.querySelectorAll('[data-node-color]').forEach(b=>b.onclick=()=>{const value=b.dataset.nodeColor;commit(()=>{const node=nby(n.id);if(value==='auto')delete node.color;else node.color=value},'Цвет карточки изменён')});$('field-title').onchange=e=>{let v=e.target.value.trim();if(v)commit(()=>nby(n.id).title=v,'Название обновлено')};$('field-desc').onchange=e=>commit(()=>nby(n.id).description=e.target.value,'Описание обновлено');el.querySelectorAll('[data-line-check]').forEach(cb=>cb.onchange=e=>{let line=cb.dataset.lineCheck;let nn=nby(n.id);let s=new Set(nn.lineIds);if(cb.checked)s.add(line);else s.delete(line);if(!s.size){cb.checked=true;note('У события должна остаться хотя бы одна линия');return}commit(()=>nn.lineIds=[...s],'Принадлежность линии обновлена')});el.querySelectorAll('[data-unpin-field]').forEach(b=>b.onclick=()=>{const id=b.dataset.unpinField;commit(()=>{const t=nby(n.id);t.manualFieldIds=(t.manualFieldIds||[]).filter(x=>x!==id)},'Закрепление метки снято')});$('i-rewrite').onclick=()=>beginEventRewrite(n.id);$('i-delete').onclick=()=>deletePlotNode(n.id);$('close-inspect').onclick=()=>{selected=null;render()}}
 else{const edge=eby(selected.id);if(!edge){el.hidden=true;return}el.hidden=false;const edgeNames={precedes:'Следом (порядок)',causes:'Из-за этого (причина)',enables:'Делает возможным',hinders:'Препятствует'};el.innerHTML=`<div class="inspect-head"><b>Связь событий</b><button id="close-inspect">×</button></div><div class="muted"><b>${esc(nby(edge.from)?.title)}</b><div style="margin:10px 0;color:#c4a77a">→</div><b>${esc(nby(edge.to)?.title)}</b></div><div class="field"><label>Смысл связи</label><select id="edge-type">${Object.entries(edgeNames).map(([id,t])=>`<option value="${id}" ${edge.type===id?'selected':''}>${t}</option>`).join('')}</select></div><div class="muted">«Следом» означает последовательность, но не доказывает причину.</div><hr><div class="inspect-actions"><button id="reconnect">Переподключить</button><button id="i-delete">Удалить связь</button></div>`;$('edge-type').onchange=e=>commit(()=>eby(edge.id).type=e.target.value,'Тип связи изменён');$('reconnect').onclick=()=>{linkFrom=edge.from;const id=edge.id;commit(()=>state.edges=state.edges.filter(k=>k.id!==id),'Выберите новую конечную карточку');selected=null;render()};$('i-delete').onclick=deleteSelected;$('close-inspect').onclick=()=>{selected=null;render()}}
}
function deletePlotNode(id){
 const node=nby(id);if(!node)return;
 const children=state.nodes.filter(n=>n.parent===id);
 if(children.length){note('У события есть дочерняя детализация. Удаление заблокировано; сначала разберите дочерние события.');return}
 const arrows=state.edges.filter(e=>e.from===id||e.to===id).length;
 const editorialLinks=state.gapLinks.filter(l=>l.from?.kind==='plot_node'&&l.from.id===id||l.to?.kind==='plot_node'&&l.to.id===id).length;
 const draft=rewriteBy(id)?1:0;
 const memberFields=state.editorialFields.filter(f=>f.memberIds.includes(id)).length;
 modalOpen=true;
 $('modal-host').innerHTML=`<div class="backdrop"><form class="modal" id="ux014-delete-dialog"><h2>Удалить событие «${esc(node.title)}»?</h2><p>Будут удалены событие и связанные материалы. Сюжетные связи: ${arrows}; контекстные связи заметок: ${editorialLinks}${draft?', черновик переработки':''}${memberFields?`, участие в ${memberFields} заданиях переработки`:''}. Остальные события сохранятся. Действие можно отменить (Ctrl+Z).</p><div class="buttons"><button type="button" id="ux014-delete-cancel">Отмена</button><button type="submit" class="primary" id="ux014-delete-confirm">Удалить событие</button></div></form></div>`;
 const close=()=>{modalOpen=false;$('modal-host').innerHTML=''};
 $('ux014-delete-cancel').onclick=close;
 $('ux014-delete-dialog').onsubmit=e=>{e.preventDefault();close();commit(()=>{state.nodes=state.nodes.filter(n=>n.id!==id);state.edges=state.edges.filter(e=>e.from!==id&&e.to!==id)},'Событие удалено · Ctrl+Z для отмены');selected=null;selectedNodeIds.clear();render()};
}
function deleteSelected(){if(!selected)return;let s=selected;if(s.type==='gapNote')return deleteGapNote(s.id);if(s.type==='gapLink'){commit(()=>{state.gapLinks=state.gapLinks.filter(l=>l.id!==s.id)},'Связь заметки удалена');selected=null;render();return}if(s.type==='field')return deleteField(s.id);if(s.type==='editorialField')return deleteEditorialField(s.id);if(s.type==='node')return deletePlotNode(s.id);commit(()=>{if(s.type==='edge')state.edges=state.edges.filter(e=>e.id!==s.id);else{state.nodes=state.nodes.filter(n=>n.id!==s.id&&n.parent!==s.id);state.edges=state.edges.filter(e=>e.from!==s.id&&e.to!==s.id)}},'Удалено · Ctrl+Z для отмены');selected=null;render()}
function addNode(title,after=null,lids=null,at=null){let a=after?nby(after):null;const id='n'+state.nextNode++;const ys=visible().map(n=>n.y),mx=Math.max(170,...visible().map(n=>n.x));let base= at?{x:Math.round(at.x),y:Math.round(at.y)}:a?{x:a.x+350,y:a.y}: {x:mx+45,y:ys.length?Math.min(...ys)+90:230};let next={id,title,description:'',x:base.x,y:base.y,lineIds:lids||a?.lineIds?.slice(0,1)||[state.lanes[0].id],size:'normal',status:'approved',parent:state.view};commit(()=>{state.nodes.push(next);if(a)state.edges.push({id:'e'+state.nextEdge++,from:a.id,to:id,type:'precedes'})},'Событие добавлено');selected={type:'node',id};render()}
function addAfter(id){notifyModal('Продолжить сюжет','Новое событие появится справа; связь означает порядок, не причину.','Что происходит дальше?',v=>addNode(v,id))}
function createNode(at=null){notifyModal('Новое событие','Добавьте мысль на полотно. Положение можно изменить в любой момент.','Название события',v=>addNode(v,null,null,at))}
function finishLink(to){const from=linkFrom;linkFrom=null;if(!from||from===to){note('Связь отменена');render();return}if(state.edges.some(e=>e.from===from&&e.to===to)){note('Такая связь уже существует');render();return}commit(()=>state.edges.push({id:'e'+state.nextEdge++,from,to,type:'precedes'}),'Создана последовательность: слева → направо')}
function addLine(){notifyModal('Новая сюжетная линия','Линия — смысловая принадлежность, а не ограничение движения.', 'Название линии',v=>commit(()=>{state.lanes.push({id:'l'+state.nextLine++,title:v,color:COLORS[(state.lanes.length)%COLORS.length],y:Math.max(...state.lanes.map(x=>x.y))+260})},'Линия добавлена'))}
function arrange(){const vis=visible();let levels=new Map(vis.map(n=>[n.id,0]));const seq=currentEdges().filter(e=>e.type==='precedes');let max=0,changed=true;for(let it=0;it<vis.length&&changed;it++){changed=false;for(const e of seq){let v=(levels.get(e.from)||0)+1;if(v>(levels.get(e.to)||0)&&v<=vis.length){levels.set(e.to,v);changed=true;max=Math.max(max,v)}}}if(changed){note('В последовательности есть цикл — невозможно упорядочить');return}const grouped=new Map();for(const n of vis){let k=levels.get(n.id)||0;if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(n)}const future=new Map();for(const [level,ns] of grouped){ns.sort((a,b)=>(a.y||0)-(b.y||0));ns.forEach((n,i)=>future.set(n.id,{x:140+level*355,y:175+i*238}))}
let affected=0;for(const n of vis){const p=future.get(n.id);if(!p)continue;const moved={...n,...p};const current=state.fields.filter(f=>f.parent===n.parent&&f.assignmentMode!=='manual'&&insideField(n,f)).map(f=>f.id).sort();const next=state.fields.filter(f=>f.parent===n.parent&&f.assignmentMode!=='manual'&&insideField(moved,f)).map(f=>f.id).sort();if(JSON.stringify(current)!==JSON.stringify(next))affected++}
const displaced=vis.some(n=>{const p=future.get(n.id);return p&&(Math.abs(p.x-n.x)>1||Math.abs(p.y-n.y)>1)});
if(!displaced){note('События уже упорядочены по стрелкам «Следом» — перемещать нечего');return}
if(affected&&!confirm('Автораскладка изменит теги '+affected+' событий, потому что переместит их между полями. Продолжить?'))return;
commit(()=>{for(const n of vis){const p=future.get(n.id);if(p){n.x=p.x;n.y=p.y}}},affected?'Расположение обновлено · теги пересчитаны':'Карточки размещены по '+seq.length+' стрелкам «Следом»');fit()}
function showNotice(){if(useOverview()&&!forceAllEdges&&!linkFrom){$('notice').classList.add('hide');return;}const issues=directionIssues(),el=$('notice');if(linkFrom){el.classList.remove('hide');el.textContent='Выберите карточку назначения · Esc — отмена';return}if(issues){el.classList.remove('hide');el.innerHTML=`↶ ${issues} ${issues===1?'связь направлена':'связи направлены'} визуально справа налево · <button id="fix-visual" style="background:transparent;border:0;color:#f1cf9e;text-decoration:underline;padding:0">Упорядочить</button>`;$('fix-visual').onclick=arrange}else el.classList.add('hide')}
function canvasRect(){return $('canvas').getBoundingClientRect()}
function contentBounds(){
 const nodes=visible(),fields=[...fieldInView(),...editorialInView()],items=[];
 for(const n of gapInView())items.push({x:n.x,y:n.y,w:252,h:Math.max(115,document.querySelector(`[data-gap-note="${n.id}"]`)?.offsetHeight||115)});
 for(const n of nodes)items.push({x:n.x,y:n.y,w:widthOf(n),h:heightOf(n)|| (n.size==='mini'?75:n.size==='expanded'?220:170)});
 for(const f of fields)items.push({x:f.x,y:f.y-25,w:f.width,h:f.height+25});
 for(const a of (creativeWorkspacePreview||cwPersistedWorkspaceScene())?.workspaces||[])items.push({x:a.x,y:a.y,w:a.width,h:a.height});
 if(!items.length)return {x:0,y:0,w:1000,h:600};
 const minX=Math.min(...items.map(i=>i.x)),minY=Math.min(...items.map(i=>i.y));
 const maxX=Math.max(...items.map(i=>i.x+i.w)),maxY=Math.max(...items.map(i=>i.y+i.h));
 return {x:minX-90,y:minY-90,w:maxX-minX+180,h:maxY-minY+180};
}
function renderOverviewTitles(){
 const host=$('overview-titles');if(!host)return;
 const mode=semanticZoomLevel(),world=$('world');
 world.classList.toggle('pa-lod-compact',mode==='compact');
 world.classList.toggle('pa-lod-map',mode==='map');
 if(mode==='full'){
  host.hidden=true;host.innerHTML='';host.dataset.mode='full';return;
 }
 host.hidden=false;host.dataset.mode=mode;host.innerHTML='';
 const viewport=canvasRect(),selectedId=selected?.type==='node'?selected.id:null;
 const keep=focusIds();
 // From real node centers, NOT from a transformed compact DOM box.
 // Item bounds remain in the original world layout throughout semantic zoom.
 const candidates=visible().map(n=>{
  const dim=itemDims(n);
  return {n,x:pan.x+(n.x+dim.w/2)*pan.scale,y:pan.y+(n.y+dim.h/2)*pan.scale};
 }).filter(p=>p.x>=-10&&p.x<=viewport.width+10&&p.y>=-10&&p.y<=viewport.height+10)
   .sort((a,b)=>(a.n.id===selectedId?-1:b.n.id===selectedId?1:0)||a.y-b.y||a.x-b.x||a.n.id.localeCompare(b.n.id));
 const occupied=[];
 // Measured once per visual update; no mutation to the story or global DOM geometry.
 for(const {n,x,y} of candidates){
  const active=n.id===selectedId;
  const item=document.createElement('div');
  item.className='pa-semantic-item'+(active?' selected':'')+(keep&&!keep.has(n.id)?' focus-muted':'');
  item.dataset.zoomNode=n.id;
  item.style.left=x+'px';item.style.top=y+'px';item.style.setProperty('--color',colorOf(n));
  item.tabIndex=0;item.setAttribute('role','button');item.setAttribute('aria-label',(rewriteBy(n.id)?'Заметка переработки: ':'Событие: ')+n.title);
  item.title=n.title+' · '+(mode==='map'?'нажмите для приближения':'нажмите для выбора, повторно — приблизить');
  item.innerHTML='<span class="pa-semantic-dot" aria-hidden="true"></span><span class="pa-semantic-label"></span>';
  item.querySelector('.pa-semantic-label').textContent=n.title;
  host.append(item);
  // The dot is ALWAYS anchored and visible, even if this label has no free room.
  // Use real, rendered text size to avoid estimating line breaks from character count.
  const label=item.querySelector('.pa-semantic-label');
  const w=label.offsetWidth,h=label.offsetHeight,gap=mode==='compact'?10:11;
  const positions=[{x:x+gap,y:y-h/2},{x:x-w-gap,y:y-h/2},
    {x:x+gap,y:y-h-12},{x:x-w-gap,y:y-h-12},
    {x:x-w/2,y:y+h/2+10},{x:x-w/2,y:y-h-12}];
  let rect=null;
  for(const p of positions){
   const test={x:p.x,y:p.y,w,h};
   if(test.x<6||test.y<6||test.x+w>viewport.width-6||test.y+h>viewport.height-6)continue;
   if(occupied.every(q=>test.x+test.w+5<q.x||q.x+q.w+5<test.x||test.y+test.h+5<q.y||q.y+q.h+5<test.y)){
    rect=test;break;
   }
  }
  if(rect){label.style.left=(rect.x-x)+'px';label.style.top=(rect.y-y)+'px';occupied.push(rect)}
  else{label.hidden=true;item.classList.add('label-collided')}
  // UX-016: semantic zoom items are real drag handles, not just navigation buttons.
  // Preview updates node coordinates only transiently; one existing safe-transfer
  // transaction (including Undo and tag-preservation) commits on pointerup.
  item.addEventListener('pointerdown',ev=>{
   if(ev.button!==0||ev.ctrlKey||ev.metaKey||spacePan||modalOpen||linkFrom||gapLinkFrom)return;
   const ids=selected?.type==='node'&&groupIds().includes(n.id)?groupIds():[n.id];
   const members=ids.map(id=>{const nd=nby(id);return nd?{id,x:nd.x,y:nd.y}:null}).filter(Boolean);
   if(!members.length)return;
   ev.stopPropagation();
   interaction={type:'semantic-node',id:n.id,startX:ev.clientX,startY:ev.clientY,members,moved:false};
   item.setPointerCapture(ev.pointerId);
  });
  item.addEventListener('pointermove',ev=>{
   const i=interaction;
   if(!i||i.type!=='semantic-node'||i.id!==n.id)return;
   const sx=ev.clientX-i.startX,sy=ev.clientY-i.startY;
   if(Math.abs(sx)+Math.abs(sy)>5)i.moved=true;
   if(!i.moved)return;
   const dx=sx/pan.scale,dy=sy/pan.scale;
   for(const m of i.members){
    const nd=nby(m.id);if(!nd)continue;
    nd.x=m.x+dx;nd.y=m.y+dy;
    const surface=host.querySelector('[data-zoom-node="'+m.id+'"]');
    if(surface)surface.style.transform='translate('+sx+'px,'+sy+'px)';
   }
   renderEdges();
  });
  const restoreSemantic=i=>{
   for(const m of i.members){const nd=nby(m.id);if(nd){nd.x=m.x;nd.y=m.y}}
  };
  item.addEventListener('pointerup',ev=>{
   const i=interaction;if(!i||i.type!=='semantic-node'||i.id!==n.id)return;
   interaction=null;
   if(!i.moved)return;
   const dx=(ev.clientX-i.startX)/pan.scale,dy=(ev.clientY-i.startY)/pan.scale;
   restoreSemantic(i);ev.stopPropagation();
   dragCompletedFor=n.id;
   setTimeout(()=>{if(dragCompletedFor===n.id)dragCompletedFor=null},0);
   // The common P3 transfer path handles selected groups, semantic tags and Undo.
   setNodeSelection(i.members.map(m=>m.id),n.id);
   askPreserveFieldTags(previewNodeMove(i.members,dx,dy));
  });
  item.addEventListener('pointercancel',()=>{
   const i=interaction;if(i?.type!=='semantic-node'||i.id!==n.id)return;
   interaction=null;restoreSemantic(i);render();
  });
  item.onclick=e=>{
   e.stopPropagation();
   if(dragCompletedFor===n.id){dragCompletedFor=null;return;}
   if(completeGapLink('plot_node',n.id))return;
   if(linkFrom){finishLink(n.id);return;}
   if(e.ctrlKey||e.metaKey){toggleNodeSelection(n.id);return;}
   if(mode==='map'||selectedId===n.id){jumpToNode(n.id);return;}
   setNodeSelection([n.id],n.id);
  };
  item.onkeydown=e=>{
   if(e.key==='Enter'||e.key===' '){e.preventDefault();item.click()}
  };
 }
}

function updateCamera(){
 const prior=semanticMode,mode=semanticZoomLevel();
 $('world').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${pan.scale})`;
 $('zoom-label').textContent=Math.round(pan.scale*100)+'%';positionInspector();renderOverviewTitles();
 if(prior!==mode||lodOverview!==useOverview()){renderEdges();showNotice();}
 renderOverview();
}
function centerAt(wx,wy,scale=null){
 if(scale!==null)pan.scale=Math.max(.10,Math.min(1.75,scale));
 const rect=canvasRect();pan.x=rect.width*.46-wx*pan.scale;pan.y=rect.height*.49-wy*pan.scale;
 updateCamera();
}
function jumpToNode(id){
 const n=nby(id);if(!n)return;
 state.view=n.parent;selected={type:'node',id};
 render();const d=itemDims(n);centerAt(n.x+d.w/2,n.y+d.h/2,Math.max(.85,pan.scale));
 note('Найдено: '+n.title);
}
function jumpToField(id){
 const f=fby(id);if(!f)return;
 state.view=f.parent;selected={type:'field',id};focusMode=true;render();
 const r=canvasRect(),sc=Math.min(1.1,Math.max(.10,Math.min((r.width-140)/f.width,(r.height-160)/f.height)));
 centerAt(f.x+f.width/2,f.y+f.height/2,sc);
 note('Поле: '+f.title);
}
function renderOverview(){
 const panel=$('overview');panel.hidden=!overviewOn;if(!overviewOn)return;
 const area=contentBounds();const vis=visible();let marks='';
 for(const f of editorialInView())marks+=`<rect x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" rx="15" fill="#998ba7" fill-opacity=".10" stroke="#998ba7" stroke-dasharray="12 8" stroke-width="7"/>`;
 for(const f of fieldInView())marks+=`<rect x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" rx="15" fill="${f.color}" fill-opacity=".12" stroke="${f.color}" stroke-opacity=".45" stroke-width="8"/>`;
 for(const n of vis)marks+=`<rect x="${n.x}" y="${n.y}" width="${widthOf(n)}" height="${heightOf(n)|| (n.size==='mini'?75:120)}" rx="12" fill="${selected?.type==='node'&&selected.id===n.id?'#dfc08a':'#92908a'}" opacity="${selected?.type==='node'&&selected.id===n.id?'1':'.7'}"/>`;
 const box=canvasRect();const wx=-pan.x/pan.scale,wy=-pan.y/pan.scale;
 marks+=`<rect x="${wx}" y="${wy}" width="${box.width/pan.scale}" height="${box.height/pan.scale}" fill="none" stroke="#f0d7a1" stroke-width="${Math.max(8,area.w/260)}" rx="8"/>`;
 const svg=$('overview-map');svg.setAttribute('viewBox',`${area.x} ${area.y} ${Math.max(1,area.w)} ${Math.max(1,area.h)}`);svg.innerHTML=marks;
 $('overview-count').textContent=`${vis.length} событий · ${fieldInView().length} полей`;
}
function render(){
 ensureEditorialState(state);
 const start=performance.now();
 if(selected?.type!=='node')selectedNodeIds.clear();
 else{const active=new Set(visible().map(n=>n.id));for(const id of [...selectedNodeIds])if(!active.has(id))selectedNodeIds.delete(id);if(!selectedNodeIds.has(selected.id)){selectedNodeIds.clear();if(active.has(selected.id))selectedNodeIds.add(selected.id)}}
 const summary=$('selection-summary');if(summary){summary.hidden=groupIds().length<2;summary.textContent=`Выбрано ${groupIds().length} событий · перетащите группу · Ctrl+клик — состав`}

 $('guides').textContent='▧ Поля: '+(guide?'вкл.':'выкл.');
 $('focus').textContent=focusMode?'◎ Фокус: вкл.':'◎ Фокус';$('focus').setAttribute('aria-pressed',String(focusMode));
 $('overview-toggle').setAttribute('aria-pressed',String(overviewOn));
 renderGuides();renderFields();renderEditorialFields();renderNodes();renderGapNotes();renderEdges();renderCreativeWorkspacePreview();renderInspector();positionInspector();renderOverviewTitles();showNotice();
 $('breadcrumbs').innerHTML=state.view?`<button id="back">← Вся история</button><span style="align-self:center;color:#aaa">/ ${esc(nby(state.view)?.title||'Детали')}</span>`:'';
 if(state.view)$('back').onclick=()=>{state.view=null;selected=null;pan={x:105,y:45,scale:.82};render()};
 perfStats.lastNodes=visible().length;perfStats.lastEdges=currentEdges().length;perfStats.lastFields=fieldInView().length;
 updateCamera();perfStats.lastRenderMs=performance.now()-start;
}
function setZoom(scale,cx,cy){let old=pan.scale,next=Math.min(1.75,Math.max(.10,scale));const rect=canvasRect();const px=cx??rect.width/2,py=cy??rect.height/2;const wx=(px-pan.x)/old,wy=(py-pan.y)/old;pan.scale=next;pan.x=px-wx*next;pan.y=py-wy*next;updateCamera()}
function fit(){const bounds=contentBounds(),rect=canvasRect();let scale=Math.min(1.06,Math.max(.10,Math.min((rect.width-130)/bounds.w,(rect.height-150)/bounds.h)));pan={scale,x:(rect.width-bounds.w*scale)/2-bounds.x*scale,y:(rect.height-bounds.h*scale)/2-bounds.y*scale};updateCamera()}

// UX-011: contextual actions. UI-only; plot graph remains unchanged until a menu item is activated.
const plotContextMenu=$('pa-context-menu');
let plotMenuReturnFocus=null;
function closePlotContextMenu(restoreFocus=false){
 if(plotContextMenu.hidden)return;
 hideTip();
 plotContextMenu.hidden=true;plotContextMenu.innerHTML='';
 if(restoreFocus&&plotMenuReturnFocus?.isConnected&&typeof plotMenuReturnFocus.focus==='function')plotMenuReturnFocus.focus({preventScroll:true});
 plotMenuReturnFocus=null;
}
function pointerToWorld(clientX,clientY){const r=canvasRect();return {x:(clientX-r.left-pan.x)/pan.scale,y:(clientY-r.top-pan.y)/pan.scale}}
function duplicateNodeForMenu(id){const source=nby(id);if(!source)return;const number=state.nextNode;const copy={...structuredClone(source),id:'n'+number,x:source.x+40,y:source.y+55,autoFieldIds:[]};commit(()=>{state.nextNode=number+1;state.nodes.push(copy)},'Событие скопировано · связи не копируются');selected={type:'node',id:copy.id};render()}
function selectAndShow(type,id){selected={type,id};render()}
function plotContextActions(kind,id,at){
 if(kind==='node'&&selected?.type==='node'&&groupIds().length>1&&groupIds().includes(id))return [
 {label:`Группа · ${groupIds().length} событий`,icon:'▣',run:()=>renderInspector()},
 {label:'Переработка выделенного',icon:'▨',run:createEditorialFieldFromSelection},
 ...(editorialInView().length?[{label:'Включить в переработку…',icon:'＋',run:addSelectedToEditorialField}]:[]),
 {label:'Снять выделение',icon:'○',run:()=>setNodeSelection([])},
 {divider:true},
 {label:'Удалить выделенные…',icon:'×',danger:true,run:deleteSelectedGroup}
 ];
 const commonAddNode={label:'Событие',icon:'□',tip:'Новый элемент сюжетного каркаса.',run:()=>createNode(at)};
 const commonAddGap={label:'Заметка',icon:'▤',tip:'Задание ChatGPT: придумать новый сюжетный фрагмент.',run:()=>newGapNote(at)};
 if(kind==='node')return [
 {label:'Редактировать',icon:'✎',run:()=>selectAndShow('node',id)},
 {label:rewriteBy(id)?'Отменить переработку':'Переработать событие',icon:'▤',run:()=>rewriteBy(id)?cancelEventRewrite(id):beginEventRewrite(id)},
 {label:'Продолжить',icon:'↗',run:()=>addAfter(id)},
 {label:'Связать с заметкой',icon:'▤',run:()=>beginGapLink('plot_node',id)},
  {label:'Связать событие',icon:'⇢',run:()=>{linkFrom=id;selected={type:'node',id};render();note('Выберите карточку назначения · Esc — отменить')}},
 {label:'Дублировать',icon:'▣',run:()=>duplicateNodeForMenu(id)},
 {divider:true},
 {label:'Удалить событие…',icon:'×',danger:true,run:()=>deletePlotNode(id)}
 ];
 if(kind==='field')return [
 {label:'Настроить',icon:'✎',run:()=>selectAndShow('field',id)},
 commonAddNode,
 {label:'Вместить поле',icon:'⊞',run:()=>jumpToField(id)},
 {divider:true},
 {label:'Удалить поле…',icon:'×',danger:true,run:()=>deleteField(id)}
 ];
 if(kind==='gapLink')return [{label:'Удалить связь заметки',icon:'×',danger:true,run:()=>{commit(()=>{state.gapLinks=state.gapLinks.filter(l=>l.id!==id)},'Связь заметки удалена');selected=null;render()}}];
 if(kind==='edge')return [
 {label:'Настроить связь',icon:'✎',run:()=>selectAndShow('edge',id)},
 {divider:true},
 {label:'Удалить связь…',icon:'×',danger:true,run:()=>{if(confirm('Удалить эту связь? Действие можно отменить (Ctrl+Z).')){selected={type:'edge',id};deleteSelected()}}}
 ];
 if(kind==='bridge')return [
 {label:'Раскрыть связи',icon:'↗',run:()=>pickBridge(id)},
 {label:'Показать все стрелки',icon:'◎',run:()=>{setAllEdges(true);render()}}
 ];
 if(kind==='editorialField')return [{label:'Редактировать',icon:'▣',run:()=>selectAndShow('editorialField',id)},{label:'Добавить выделенные',icon:'＋',run:()=>addEditorialMembers(id,groupIds())},{divider:true},{label:'Удалить задание…',icon:'×',danger:true,run:()=>deleteEditorialField(id)}];
 return [commonAddNode,
 {label:'Поле',icon:'▧',tip:'Смысловая область для группировки событий и назначения тегов.',run:()=>createField(at)},
 {divider:true},
 commonAddGap,
 {label:'Переработка',icon:'▨',tip:'Задание ChatGPT: переработать существующие события.',run:()=>createEditorialField(at)},
 {divider:true},
 {label:'Вместить всё',icon:'⊞',tip:'Показать весь граф в пределах экрана.',run:()=>fit()},
 {label:'Поиск',icon:'⌕',tip:'Найти событие или поле по названию.',run:()=>$('search').click()}];
}
function showPlotContextMenu(clientX,clientY,sourceTarget=null){
 if(modalOpen)return false;
 const r=canvasRect();const point=pointerToWorld(clientX,clientY);
 let kind='canvas',id=null;
 if(sourceTarget?.closest){
  const gapEl=sourceTarget.closest('[data-gap-note]');const nodeEl=sourceTarget.closest('[data-node],[data-zoom-node]');const fieldEl=sourceTarget.closest('[data-field]');const editorialEl=sourceTarget.closest('[data-editorial-field]');
  const gapLinkEl=sourceTarget.closest('[data-gap-link-target]');const edgeEl=sourceTarget.closest('[data-edge-target]');const bridgeEl=sourceTarget.closest('[data-bridge-target]');
  if(gapEl){id=gapEl.dataset.gapNote;kind='gapNote'}
  else if(nodeEl){id=nodeEl.dataset.node||nodeEl.dataset.zoomNode;kind='node'}
  else if(gapLinkEl){id=gapLinkEl.dataset.gapLinkTarget;kind='gapLink'}
  else if(edgeEl){id=edgeEl.dataset.edgeTarget;kind='edge'}
  else if(bridgeEl){id=bridgeEl.dataset.bridgeTarget;kind='bridge'}
  else if(editorialEl){id=editorialEl.dataset.editorialField;kind='editorialField'}
  else if(fieldEl){id=fieldEl.dataset.field;kind='field'}
 }
 // Editorial field hit-test takes precedence over ordinary semantic field.
 if(kind==='canvas'){const matching=editorialInView().filter(f=>point.x>=f.x&&point.x<=f.x+f.width&&point.y>=f.y&&point.y<=f.y+f.height);if(matching.length){kind='editorialField';id=matching.at(-1).id}}
 // Fields do not intercept ordinary pointer events. Hit-test their real geometry for right-click.
 if(kind==='canvas'&&guide){const inside=fieldInView().filter(f=>point.x>=f.x&&point.x<=f.x+f.width&&point.y>=f.y&&point.y<=f.y+f.height);if(inside.length){const f=inside[inside.length-1];kind='field';id=f.id}}
 closePlotContextMenu();hideTip();
 const items=plotContextActions(kind,id,point);
 plotContextMenu.dataset.contextKind=kind;
 plotContextMenu.setAttribute('aria-label',kind==='canvas'?'Действия с полотном':'Действия с выбранным объектом');
 plotContextMenu.innerHTML=items.map((item,i)=>item.divider?'<div class="pa-context-divider" role="separator"></div>':'<button type="button" role="menuitem" data-context-index="'+i+'"'+(item.danger?' data-danger="true"':'')+(item.tip?' data-tip="'+esc(item.tip)+'"':'')+'><span class="pa-context-icon" aria-hidden="true">'+item.icon+'</span><span>'+esc(item.label)+'</span></button>').join('');
 plotContextMenu.hidden=false;
 const w=plotContextMenu.offsetWidth,h=plotContextMenu.offsetHeight;
 const left=Math.max(8,Math.min(r.width-w-8,clientX-r.left));
 const top=Math.max(8,Math.min(r.height-h-8,clientY-r.top));
 plotContextMenu.style.left=left+'px';plotContextMenu.style.top=top+'px';
 plotMenuReturnFocus=sourceTarget?.closest?.('.node,.field-head,[data-edge-target],[data-bridge-target]')||document.activeElement;
 for(const btn of plotContextMenu.querySelectorAll('[data-context-index]'))btn.onclick=e=>{e.preventDefault();e.stopPropagation();const action=items[Number(btn.dataset.contextIndex)];closePlotContextMenu();action.run()};
 plotContextMenu.querySelector('[role="menuitem"]')?.focus({preventScroll:true});
 return true;
}
plotContextMenu.addEventListener('contextmenu',e=>e.preventDefault());
$('canvas').addEventListener('contextmenu',e=>{
 // Text-editing, toolbars, modals and navigation retain their native browser context menus.
 if(e.target.closest('.inspector,.nav-mini,.float-toolbar,.toolbar-restore,.overview-panel,.breadcrumbs,.notice,.pa-context-menu,.direction,textarea,input,select'))return;
 e.preventDefault();e.stopPropagation();showPlotContextMenu(e.clientX,e.clientY,e.target);
});
document.addEventListener('pointerdown',e=>{if(!plotContextMenu.hidden&&!e.target.closest('#pa-context-menu'))closePlotContextMenu()},true);
document.addEventListener('keydown',e=>{if(plotContextMenu.hidden)return;
 if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closePlotContextMenu(true)}
 else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const list=[...plotContextMenu.querySelectorAll('[role="menuitem"]')];const idx=list.indexOf(document.activeElement);list[(idx+(e.key==='ArrowDown'?1:-1)+list.length)%list.length]?.focus()}
},true);
$('canvas').addEventListener('keydown',e=>{if(e.key!=='ContextMenu'&&!(e.shiftKey&&e.key==='F10'))return;
 if(e.target.closest('input,textarea,select,.inspector'))return;
 e.preventDefault();const r=e.target.getBoundingClientRect();showPlotContextMenu(r.left+Math.min(28,r.width/2),r.top+Math.min(28,r.height/2),e.target);
});
$('canvas').addEventListener('wheel',()=>closePlotContextMenu(),{passive:true});

// P3: primary empty-canvas drag selects by marquee; Space/middle/touch pans.
const marquee=document.createElement('div');marquee.className='pa-marquee';marquee.hidden=true;$('canvas').append(marquee);
function hideMarquee(){marquee.hidden=true;document.querySelectorAll('.node.marquee-candidate').forEach(x=>x.classList.remove('marquee-candidate'))}
function marqueeIds(start,end){const a=pointerToWorld(start.x,start.y),b=pointerToWorld(end.x,end.y);
 const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
 return visible().filter(n=>{const center=nodeCenter(n);return center.x>=left&&center.x<=right&&center.y>=top&&center.y<=bottom}).map(n=>n.id)
}
function cancelGesture(){const i=interaction;if(!i)return false;interaction=null;
 if(i.type==='node'||i.type==='semantic-node')for(const m of i.members){const n=nby(m.id);if(n){n.x=m.x;n.y=m.y}}
 hideMarquee();render();return true;
}
$('canvas').addEventListener('pointerdown',e=>{
 const semanticTarget=e.target.closest('.pa-semantic-item');
 const panMode=e.button===1||spacePan||e.pointerType==='touch';
 const blocked=e.target.closest('.node,.gap-note,.editorial-inline-note,.field-head,.field-grip,.float-toolbar,.nav-mini,.overview-panel,.inspector,.notice,.breadcrumbs,.toolbar-restore,.pa-context-menu,[data-edge-target],[data-bridge-target]');
 // Space+drag or middle drag pans even when the pointer starts on an overview label.
 if(![0,1].includes(e.button)||blocked||(semanticTarget&&!panMode))return;
 if(e.button===1)e.preventDefault();
 interaction=panMode?{type:'pan',x:e.clientX,y:e.clientY,px:pan.x,py:pan.y}:
  {type:'marquee',start:{x:e.clientX,y:e.clientY},base:e.shiftKey?groupIds():[],shift:e.shiftKey,moved:false};
 $('canvas').setPointerCapture(e.pointerId);
});
$('canvas').addEventListener('pointermove',e=>{
 const i=interaction;if(!i)return;
 if(i.type==='pan'){pan.x=i.px+e.clientX-i.x;pan.y=i.py+e.clientY-i.y;updateCamera();return}
 if(i.type!=='marquee')return;
 if(Math.abs(e.clientX-i.start.x)+Math.abs(e.clientY-i.start.y)>5)i.moved=true;
 if(!i.moved)return;
 const r=canvasRect();const x1=i.start.x-r.left,y1=i.start.y-r.top,x2=e.clientX-r.left,y2=e.clientY-r.top;
 Object.assign(marquee.style,{left:Math.min(x1,x2)+'px',top:Math.min(y1,y2)+'px',width:Math.abs(x2-x1)+'px',height:Math.abs(y2-y1)+'px'});marquee.hidden=false;
 const ids=new Set(marqueeIds(i.start,{x:e.clientX,y:e.clientY}));
 document.querySelectorAll('[data-node]').forEach(el=>el.classList.toggle('marquee-candidate',ids.has(el.dataset.node)));
});
$('canvas').addEventListener('pointerup',e=>{const i=interaction;if(!i||!['pan','marquee'].includes(i.type))return;interaction=null;
 if(i.type==='pan')return;
 hideMarquee();
 if(!i.moved){if(!i.shift)setNodeSelection([]);return}
 const ids=marqueeIds(i.start,{x:e.clientX,y:e.clientY});setNodeSelection(i.shift?[...new Set([...i.base,...ids])]:ids);
});
$('canvas').addEventListener('pointercancel',()=>{if(interaction?.type==='marquee'||interaction?.type==='pan')cancelGesture()});
$('canvas').addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault()});
$('inspector').addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
$('canvas').addEventListener('wheel',e=>{if(e.target.closest('.inspector,.editorial-inline-note'))return;e.preventDefault();let rect=$('canvas').getBoundingClientRect();if(e.ctrlKey||e.metaKey){setZoom(pan.scale*Math.exp(-e.deltaY*.002),e.clientX-rect.left,e.clientY-rect.top)}else{pan.x-=e.deltaX;pan.y-=e.deltaY;updateCamera()}},{passive:false});
$('create').onclick=()=>createNode();$('add-field').onclick=()=>createField();$('add-gap-note').onclick=()=>newGapNote();$('add-editorial-field').onclick=()=>groupIds().length?createEditorialFieldFromSelection():createEditorialField();$('arrange').onclick=arrange;$('undo').onclick=undo;$('zoom-in').onclick=()=>setZoom(pan.scale*1.18);$('zoom-out').onclick=()=>setZoom(pan.scale/1.18);$('zoom-home').onclick=()=>setZoom(1);$('fit').onclick=fit;$('guides').onclick=()=>{guide=!guide;render()};$('more').onclick=()=>{if(confirm('Вернуть демонстрационный граф? Ваши текущие локальные правки будут сброшены.')){state=seed();recomputeFieldTags();selected=null;history=[];save();fit()}};
$('search').onclick=()=>{modalOpen=true;
 $('modal-host').innerHTML=`<div class="backdrop"><div class="modal" role="dialog" aria-label="Поиск"><h2>Найти на полотне</h2><p>События и поля. Выбор откроет нужный уровень и перенесёт камеру.</p><input id="search-entry" placeholder="Название события или поля"><div class="results" id="search-results"></div><div class="buttons"><button id="search-close">Закрыть</button></div></div></div>`;
 const close=()=>{$('modal-host').innerHTML='';modalOpen=false};$('search-close').onclick=close;
 $('search-entry').oninput=e=>{const query=e.target.value.trim().toLocaleLowerCase('ru');
 const nodes=query?state.nodes.filter(n=>(n.title+' '+(n.description||'')).toLocaleLowerCase('ru').includes(query)).slice(0,15):[];
 const fields=query?state.fields.filter(f=>f.title.toLocaleLowerCase('ru').includes(query)).slice(0,8):[];
 $('search-results').innerHTML=[...nodes.map(n=>`<button data-focus-node="${esc(n.id)}">◻ ${esc(n.title)} <small>Событие</small></button>`),...fields.map(f=>`<button data-focus-field="${esc(f.id)}">▧ ${esc(f.title)} <small>Поле</small></button>`)].join('')||(query?'<div class="search-empty">Ничего не найдено</div>':'');
 $('search-results').querySelectorAll('[data-focus-node]').forEach(el=>el.onclick=()=>{const id=el.dataset.focusNode;close();jumpToNode(id)});
 $('search-results').querySelectorAll('[data-focus-field]').forEach(el=>el.onclick=()=>{const id=el.dataset.focusField;close();jumpToField(id)});
 };$('search-entry').focus()};
$('focus').onclick=focusToggle;
let toolsVisible=true;
const setToolsVisible=show=>{toolsVisible=show;$('action-toolbar').hidden=!show;$('toolbar-restore').hidden=show;if(!show){$('tools-menu').hidden=true;$('tools-more').setAttribute('aria-expanded','false')}};
$('tools-collapse').onclick=e=>{e.stopPropagation();setToolsVisible(false)};
$('toolbar-restore').onclick=e=>{e.stopPropagation();setToolsVisible(true)};
$('tools-more').onclick=e=>{e.stopPropagation();const menu=$('tools-menu');menu.hidden=!menu.hidden;$('tools-more').setAttribute('aria-expanded',String(!menu.hidden))};
$('arrange').addEventListener('click',()=>{$('tools-menu').hidden=true;$('tools-more').setAttribute('aria-expanded','false')});
 $('toggle-all-edges').onclick=()=>{setAllEdges(!forceAllEdges);$('toggle-all-edges').firstChild.textContent=forceAllEdges?'◉ Вернуть адаптивный обзор':'◎ Показать все связи';$('tools-menu').hidden=true};
 $('toggle-routing').onclick=()=>{setRouteMode(routeMode==='smart'?'direct':'smart');$('toggle-routing').firstChild.textContent=routeMode==='smart'?'↝ Маршруты: обход (тест)':'↝ Маршруты: прямые';$('tools-menu').hidden=true};
document.addEventListener('click',e=>{if(!e.target.closest('#tools-more,#tools-menu')){$('tools-menu').hidden=true;$('tools-more').setAttribute('aria-expanded','false')}});
$('overview-toggle').onclick=()=>{overviewOn=!overviewOn;render();};
$('overview-close').onclick=e=>{e.preventDefault();e.stopPropagation();overviewOn=false;renderOverview();render()};
$('overview-map').addEventListener('click',e=>{
 const svg=$('overview-map');const a=contentBounds(),r=svg.getBoundingClientRect();
 const x=a.x+((e.clientX-r.left)/r.width)*a.w;
 const y=a.y+((e.clientY-r.top)/r.height)*a.h;centerAt(x,y);
});
$('export').onclick=()=>exportProject();
document.addEventListener('keydown',e=>{
 if(e.code==='Space'&&!modalOpen&&!e.target.closest('input,textarea,select,button')){spacePan=true;e.preventDefault()}
 if(e.key==='Escape'){
  if(interaction){e.preventDefault();cancelGesture();return}
  if(!$('tools-menu').hidden){$('tools-menu').hidden=true;$('tools-more').setAttribute('aria-expanded','false')}
  if(gapLinkFrom){gapLinkFrom=null;note('Редакторская связь отменена');return}if(linkFrom){linkFrom=null;render();return}
  if(!modalOpen&&selected?.type==='node'){setNodeSelection([]);return}
  return;
 }
 if(!plotContextMenu.hidden||modalOpen||e.target.closest('input,textarea,select'))return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo()}
 else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();setNodeSelection(visible().map(n=>n.id))}
 else if(e.key.toLowerCase()==='f'&&!e.ctrlKey&&!e.metaKey){focusToggle()}
 else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').click()}
 else if(e.key.toLowerCase()==='n'&&!e.ctrlKey){createNode()}
 else if(e.key.toLowerCase()==='m'&&!e.ctrlKey&&!e.metaKey){newGapNote()}
 else if(e.key==='Delete'&&selected){e.preventDefault();if(groupIds().length>1)deleteSelectedGroup();else deleteSelected()}
});
document.addEventListener('keyup',e=>{if(e.code==='Space')spacePan=false;if(!e.ctrlKey&&!e.metaKey)document.body.classList.remove('pa-multi-modifier')});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!modalOpen)document.body.classList.add('pa-multi-modifier')},true);
window.addEventListener('blur',()=>{spacePan=false;document.body.classList.remove('pa-multi-modifier');if(interaction)cancelGesture()});

// Context help: only appears on hover/focus and never captures pointer events.
let tipTimer=null,tipTarget=null;
const tooltipHost=document.createElement('div');tooltipHost.id='hover-help';tooltipHost.setAttribute('role','tooltip');tooltipHost.hidden=true;document.body.append(tooltipHost);
function hideTip(){clearTimeout(tipTimer);tipTimer=null;tipTarget=null;tooltipHost.hidden=true}
function tipCssToken(name,fallback){const value=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));return Number.isFinite(value)?value:fallback}
function displayTip(el){
 if(!el||!el.isConnected||modalOpen)return;
 const msg=el.dataset.tip||el.getAttribute('title');if(!msg)return;
 const withinMenu=!!el.closest('#pa-context-menu');
 tooltipHost.textContent=msg;
 tooltipHost.classList.toggle('context-tip',withinMenu);
 tooltipHost.classList.toggle('ux014-heading-tip',el.classList.contains('rewrite-heading-tip'));
 tooltipHost.hidden=false;
 const r=el.getBoundingClientRect(),t=tooltipHost.getBoundingClientRect();
 const safe=tipCssToken('--pa-tooltip-screen-gap',8),gap=tipCssToken('--pa-tooltip-gap',9);
 let x,y;
 if(withinMenu){
  const m=plotContextMenu.getBoundingClientRect();
  x=m.left+tipCssToken('--pa-tooltip-left-inset',10);
  y=r.top-t.height-gap;
  if(y<safe){
   // Keep the tooltip off the menu when there is no space above the hovered item.
   if(m.bottom+gap+t.height<=innerHeight-safe)y=m.bottom+gap;
   else if(m.right+gap+t.width<=innerWidth-safe){x=m.right+gap;y=Math.min(Math.max(safe,r.top),innerHeight-safe-t.height)}
   else if(m.left-gap-t.width>=safe){x=m.left-gap-t.width;y=Math.min(Math.max(safe,r.top),innerHeight-safe-t.height)}
   else y=safe;
  }
 }else{
  x=r.left+r.width/2-t.width/2;
  y=r.top-t.height-gap;
  if(y<safe)y=r.bottom+gap;
 }
 x=Math.max(safe,Math.min(innerWidth-t.width-safe,x));
 y=Math.max(safe,Math.min(innerHeight-t.height-safe,y));
 tooltipHost.style.left=Math.round(x)+'px';tooltipHost.style.top=Math.round(y)+'px';
}
document.addEventListener('mouseover',e=>{const el=e.target.closest('[data-tip]');if(el===tipTarget)return;hideTip();if(el){tipTarget=el;tipTimer=setTimeout(()=>displayTip(el),350)}});
document.addEventListener('mouseout',e=>{if(tipTarget&&!tipTarget.contains(e.relatedTarget))hideTip()});
document.addEventListener('focusin',e=>{const el=e.target.closest('[data-tip]');if(el){hideTip();tipTarget=el;tipTimer=setTimeout(()=>displayTip(el),350)}});
document.addEventListener('focusout',()=>hideTip());
document.addEventListener('pointerdown',()=>hideTip(),true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip()});
window.addEventListener('resize',()=>{if(tipTarget&&!tooltipHost.hidden)displayTip(tipTarget)});

/* PA-SITE-01 project manager; never changes semantic edges on switching projects. */
function projectName(){return registryEntry(activeProjectId)?.name||'Без названия'}
function updateProjectLabel(){const t=$('project-current');if(t)t.textContent=projectName();const m=$('project-mode');if(m)m.textContent=remote.connected?'Site · D1':'Локально'}
function showProjectManager(){
 modalOpen=true;const h=$('modal-host');h.innerHTML=`<div class="backdrop" id="projects-backdrop"><section class="modal project-manager" role="dialog" aria-label="Проекты" aria-modal="true"><div class="project-modal-head"><h2>Мои истории</h2><button id="pm-close" aria-label="Закрыть">×</button></div><p id="pm-status">${remote.connected?'Хранятся на Site, с локальными копиями':'Локальные проекты этого браузера'}</p><div class="project-list" id="pm-list"></div><div class="project-controls"><button id="pm-new" class="primary">＋ Новая история</button><button id="pm-import">↑ Импорт JSON</button><button id="pm-connect">${remote.connected?'↩ Локальные проекты':'☁ Подключить Site'}</button></div><div id="pm-error" role="alert" class="pm-error"></div><div class="project-controls secondary"><button id="pm-rename">Переименовать</button><button id="pm-copy">Дублировать</button><button id="pm-delete">Удалить</button><button id="pm-export">Экспорт</button><button id="pm-retry" ${remote.connected&&remote.dirty?'':'hidden'}>Повторить синхронизацию</button></div><input id="pm-file" type="file" accept=".json,application/json" hidden></section></div>`;
 const close=()=>{modalOpen=false;h.innerHTML=''};
 $('pm-close').onclick=close;$('projects-backdrop').onclick=e=>{if(e.target.id==='projects-backdrop')close()};
 const fail=err=>{const p=$('pm-error');if(p)p.textContent=String(err?.message||err)};
 const paint=()=>{const list=$('pm-list');if(!list)return;list.innerHTML=registry.projects.map(p=>`<button class="project-entry ${p.id===activeProjectId?'active':''}" data-project="${esc(p.id)}"><b>${esc(p.name)}</b><small>${p.id===activeProjectId?'Открыт · ':''}ревизия ${p.revision??0}</small></button>`).join('')||'<p class="muted">Нет проектов</p>';list.querySelectorAll('[data-project]').forEach(b=>b.onclick=async()=>{if(b.dataset.project===activeProjectId)return close();try{await openProject(b.dataset.project);close()}catch(err){fail(err)}})};
 paint();
 $('pm-new').onclick=async()=>{const name=prompt('Название новой истории','Новая история')?.trim();if(!name)return;try{await createProject(name,blankGraph());paint();close()}catch(err){fail(err)}};
 $('pm-rename').onclick=async()=>{const name=prompt('Новое название',projectName())?.trim();if(!name)return;const e=registryEntry(activeProjectId);e.name=name;writeRegistry();updateProjectLabel();if(remote.connected){remote.dirty=true;queueRemote()}paint()};
 $('pm-copy').onclick=async()=>{try{await createProject(projectName()+' — копия',persistentGraph());paint();close()}catch(err){fail(err)}};
 $('pm-delete').onclick=async()=>{if(!confirm('Удалить проект «'+projectName()+'»? Сохраните JSON, если хотите оставить резервную копию.'))return;try{await deleteProject();paint();close()}catch(err){fail(err)}};
 $('pm-export').onclick=exportProject;$('pm-retry').onclick=async()=>{if(!remote.connected)return fail('Подключите Site');if(remote.blocked)return fail('Конфликт или незавершённое локальное сохранение. Экспортируйте JSON, затем согласуйте изменения вручную.');try{remote.dirty=true;await flushRemote();close()}catch(e){fail(e)}};
 $('pm-file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const src=JSON.parse(await f.text());let g,name;if(src.format==='plot-architect/project-1'){g=src.project.graph;name=src.project.name}else if(src.graph){g=src.graph;name=src.name||'Импортированный сюжет'}else{g=src;name='Импортированный сюжет'};g=validateImported(g);await createProject(name,g);close()}catch(err){fail(err)}};
 $('pm-import').onclick=()=>$('pm-file').click();
 $('pm-connect').onclick=async()=>{try{if(remote.connected){await flushRemote();remote.connected=false;remote.token=null;remote.blocked=false;activeRegistryStorage=REGISTRY_KEY;registry=readLocalRegistry();const id=registry.activeId;activeProjectId=id;KEY=KEY_PREFIX+id;state=JSON.parse(localStorage.getItem(KEY)||'null')||(id===STARTER_LOCAL_ID?structuredClone(STARTER_GRAPH):seed());history=[];selected=null;save();render();fit();close();note('Локальный режим')}else{await connectSite();close()}}catch(err){fail(err)}};
}
function readLocalRegistry(){try{const v=JSON.parse(localStorage.getItem(REGISTRY_KEY));if(Array.isArray(v.projects)&&v.activeId)return v}catch{}return {activeId:STARTER_LOCAL_ID,projects:[{id:STARTER_LOCAL_ID,name:STARTER_NAME,revision:STARTER_GRAPH.revision,origin:STARTER_ORIGIN}]}}
function blankGraph(){return {version:1,revision:0,nextNode:1,nextEdge:1,nextField:1,nextLine:2,view:null,nodes:[],edges:[],fields:[],lanes:[{id:'l1',title:'Основная линия',color:COLORS[0],y:200}]}}
function validateImported(g){if(!g||!Array.isArray(g.nodes)||!Array.isArray(g.edges)||!Array.isArray(g.fields)||!Array.isArray(g.lanes))throw Error('В JSON должны быть nodes, edges, fields и lanes');
 const out=structuredClone(g),ids=new Set(),fids=new Set(out.fields.map(f=>f.id)),lids=new Set(out.lanes.map(l=>l.id));if(out.nodes.length>5000||out.edges.length>15000)throw Error('Слишком много элементов');
 for(const n of out.nodes){if(!n.id||ids.has(n.id)||!Number.isFinite(n.x)||!Number.isFinite(n.y))throw Error('Ошибка ID/координат ноды');ids.add(n.id);n.lineIds=n.lineIds||[];n.manualFieldIds=n.manualFieldIds||[];n.manualTags=n.manualTags||[];n.parent=n.parent??null;n.size=n.size||'normal';n.description=n.description||'';if(n.width!==undefined&&(!Number.isFinite(n.width)||n.width<180||n.width>780))throw Error('Некорректная ширина карточки');if(n.height!==undefined&&(!Number.isFinite(n.height)||n.height<95||n.height>640))throw Error('Некорректная высота карточки');if(n.color!==undefined&&!COLORS.includes(n.color))throw Error('Некорректный цвет карточки');if(n.lineIds.some(id=>!lids.has(id))||n.manualFieldIds.some(id=>!fids.has(id)))throw Error('Неизвестное поле или линия')}
 const eids=new Set();for(const e of out.edges){if(!ids.has(e.from)||!ids.has(e.to)||eids.has(e.id))throw Error('Невалидная связь');eids.add(e.id)}
 for(const f of out.fields){if(!f.id||!Number.isFinite(f.x)||!Number.isFinite(f.y)||!Number.isFinite(f.width)||!Number.isFinite(f.height))throw Error('Неверные границы поля');f.comment=f.comment||'';f.parent=f.parent??null}
 for(const [prefix,property,list] of [['n','nextNode',out.nodes],['e','nextEdge',out.edges],['f','nextField',out.fields],['l','nextLine',out.lanes]]){let max=0;for(const x of list){const match=new RegExp('^'+prefix+'(\\d+)$').exec(x.id);if(match)max=Math.max(max,Number(match[1]))}out[property]=Math.max(out[property]||1,max+1)}out.view=null;out.revision=Number.isSafeInteger(out.revision)?out.revision:0;return out}
function downloadJson(data,filename){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),2500)}
function exportProject(){downloadJson({format:'plot-architect/project-1',exportedAt:new Date().toISOString(),project:{id:activeProjectId,name:projectName(),graph:persistentGraph()}},'plot-architect-'+projectName().replace(/[^a-zA-Zа-яА-Я0-9-]+/g,'-').slice(0,50)+'.json');note('Проект экспортирован')}
async function openProject(id){creativeWorkspacePreview=null;cwAcceptanceReview=null;cwStageReview=null;cwPreparedNoteAlternatives.clear();
 if(remote.connected){if(remote.dirty||remote.busy)await flushRemote();if(remote.blocked)throw Error('Сохраните резервную копию: конфликт ревизий');const rec=await apiRequest('/api/projects/'+encodeURIComponent(id));remote.revision=rec.revision;
 let pending=false;try{pending=localStorage.getItem(PENDING_PREFIX+id)==='1'}catch{}
 const backup=pending?localStorage.getItem(KEY_PREFIX+id):null;
 if(pending&&backup){state=validateImported(JSON.parse(backup));remote.blocked=true;remote.dirty=true;note('Найдены несинхронизированные изменения. Они сохранены локально; экспортируйте JSON для согласования.');}
 else state=validateImported(rec.graph)}
 else{state=JSON.parse(localStorage.getItem(KEY_PREFIX+id)||'null')||blankGraph()}
 activeProjectId=id;KEY=KEY_PREFIX+id;registry.activeId=id;selected=null;linkFrom=null;history=[];focusMode=false;forceAllEdges=false;state.view=null;recomputeFieldTags();save(false);updateProjectLabel();render();fit();if(remote.blocked)$('saved').textContent='! Есть несинхронизированная копия · экспортируйте JSON';
}
async function createProject(name,graph){creativeWorkspacePreview=null;cwAcceptanceReview=null;cwStageReview=null;cwPreparedNoteAlternatives.clear();graph=validateImported(graph);for(const node of graph.nodes||[])delete node.autoFieldIds;graph.revision=0;
 let id;if(remote.connected){await flushRemote();const res=await apiRequest('/api/projects',{method:'POST',body:{name,graph}});id=res.id;remote.revision=res.revision}
 else id=newLocalId();
 if(remote.connected){clearTimeout(remote.timer);remote.timer=null;remote.blocked=false;remote.dirty=false;}
 registry.projects.unshift({id,name,revision:0});registry.activeId=id;activeProjectId=id;KEY=KEY_PREFIX+id;state=graph;selected=null;linkFrom=null;history=[];state.view=null;recomputeFieldTags();save(false);updateProjectLabel();render();fit();
}
async function deleteProject(){
 if(remote.connected){await flushRemote();const r=await apiRequest('/api/projects/'+encodeURIComponent(activeProjectId),{method:'DELETE',body:{expectedRevision:remote.revision}});if(!r.deleted)throw Error('Удаление не подтверждено')}
 else try{localStorage.removeItem(KEY)}catch{}
 registry.projects=registry.projects.filter(p=>p.id!==activeProjectId);
 if(!registry.projects.length){if(remote.connected){const res=await apiRequest('/api/projects',{method:'POST',body:{name:'Новая история',graph:blankGraph()}});registry.projects=[{id:res.id,name:'Новая история',revision:0}]}else{const id=newLocalId();registry.projects=[{id,name:'Новая история',revision:0}]}}
 registry.activeId=registry.projects[0].id;await openProject(registry.activeId)
}
async function apiRequest(path,opts={}){
 const headers={};if(opts.body!==undefined)headers['Content-Type']='application/json';
 const res=await fetch(path,{method:opts.method||'GET',headers,body:opts.body!==undefined?JSON.stringify(opts.body):undefined,cache:'no-store'});
 let body;try{body=await res.json()}catch{throw Error('Site API вернул не-JSON ответ')}
 if(!res.ok){if(res.status===409){remote.blocked=true;throw Error('Конфликт ревизий. Экспортируйте данные; автоматическая запись остановлена.')}throw Error(body.message||body.error||'HTTP '+res.status)}return body
}
function queueRemote(){if(!remote.connected||remote.blocked)return;remote.dirty=true;try{localStorage.setItem(PENDING_PREFIX+activeProjectId,'1')}catch{};clearTimeout(remote.timer);remote.timer=setTimeout(()=>flushRemote().catch(e=>{note('Не удалось синхронизировать: '+e.message);$('saved').textContent='! Сохранено локально · ошибка Site'}),750)}
async function flushRemote(){
 clearTimeout(remote.timer);
 if(!remote.connected||remote.blocked)return;
 while(remote.busy)await new Promise(r=>setTimeout(r,35));
 if(!remote.dirty)return;
 remote.busy=true;const currentId=activeProjectId,graph=persistentGraph(),name=projectName(),revision=state.revision;
 remote.dirty=false;
 try{const r=await apiRequest('/api/projects/'+encodeURIComponent(currentId),{method:'PUT',body:{expectedRevision:remote.revision,name,graph,message:'Редактирование в Plot Architect'}});remote.revision=r.revision;if(!remote.dirty&&activeProjectId===currentId&&state.revision===revision){try{localStorage.removeItem(PENDING_PREFIX+currentId)}catch{};$('saved').textContent='✓ Сохранено в Site · '+r.revision}}
 catch(err){remote.blocked=err.message.includes('Конфликт');remote.dirty=true;$('saved').textContent='! Не удалось сохранить в Site';throw err}
 finally{remote.busy=false}
 if(remote.dirty)await flushRemote();
}
async function connectSite(silent=false){
 const health=await fetch('/api/health').then(r=>r.json()).catch(()=>null);
 if(!health?.ok)throw Error('Site API недоступен. В этом HTML работают только локальные проекты.');
 const data=await apiRequest('/api/projects');remote.connected=true;remote.blocked=false;remote.dirty=false;activeRegistryStorage=SITE_REGISTRY_KEY;
 if(!data.projects.length){const created=await apiRequest('/api/projects',{method:'POST',body:{name:'Новая история',graph:blankGraph()}});registry={activeId:created.id,projects:[{id:created.id,name:created.name,revision:created.revision}]};remote.revision=created.revision;activeProjectId=created.id;KEY=KEY_PREFIX+created.id;state=validateImported(created.graph);selected=null;selectedNodeIds.clear();linkFrom=null;history=[];state.view=null;recomputeFieldTags();try{localStorage.removeItem(PENDING_PREFIX+created.id)}catch{};save(false);updateProjectLabel();render();note('Первый проект создан на Site')}
 else{let last;try{last=JSON.parse(localStorage.getItem(SITE_REGISTRY_KEY)||'null')?.activeId}catch{};registry={activeId:data.projects.some(p=>p.id===last)?last:data.projects[0].id,projects:data.projects.map(p=>({id:p.id,name:p.name,revision:p.revision}))};remote.revision=0;await openProject(registry.activeId);note('Подключено к Site')}
}
$('projects-open').onclick=showProjectManager;
updateProjectLabel();
if(location.protocol==='http:'||location.protocol==='https:')setTimeout(()=>connectSite(true).catch(e=>{note('Site пока недоступен: '+e.message);$('saved').textContent='! Работа локально · Site недоступен'}),150);
window.__graphite={setCWWorkflowTestMode,getCWWorkflowTestMode:()=>cwWorkflowTestMode,setCWPreparedNoteAlternativesForTest,setCreativeWorkspacePreview,getCreativeWorkspacePreview:()=>structuredClone(creativeWorkspacePreview),showPlotContextMenu,newGapNote,setGapNoteText,getGapNotes:()=>structuredClone(state.gapNotes),getGapLinks:()=>structuredClone(state.gapLinks),getEventRewrites:()=>structuredClone(state.eventRewrites||[]),beginEventRewrite,cancelEventRewrite,deletePlotNode,beginGapLink,completeGapLink,createEditorialField:newEditorialField,createEditorialFieldFromSelection,deleteEditorialField,addEditorialMembers,removeEditorialMembers,updateEditorialInstruction,getEditorialFields:()=>structuredClone(state.editorialFields),getEditorialNotes:()=>structuredClone(state.editorialNotes),getSelection:()=>groupIds(),selectNodes:ids=>setNodeSelection(ids),moveSelectedBy,previewNodeMove:(ids,dx,dy)=>previewNodeMove(ids.map(id=>{const n=nby(id);return n?{id,x:n.x,y:n.y}:null}).filter(Boolean),dx,dy),getContextMenuState:()=>({open:!plotContextMenu.hidden,items:[...plotContextMenu.querySelectorAll("[role=menuitem]")].map(b=>b.textContent.trim())}),showProjectManager,createProject,openProject,exportProject,validateImported,blankGraph,getProjectIndex:()=>structuredClone(registry),getStarterOrigin:()=>({...STARTER_ORIGIN,localProjectId:STARTER_LOCAL_ID}),getRemote:()=>({...remote,token:remote.token?'***':null,timer:null}),createField,deleteField,setFieldGeometry:(id,patch)=>commit(()=>{Object.assign(fby(id),patch);normalizeField(fby(id))}),moveField,selectField:id=>{selected={type:'field',id};render()},getFieldMembership:id=>fieldMembership(nby(id)),getState:()=>structuredClone(state),getPan:()=>({...pan}),getIssues:directionIssues,arrange,fit,addNode,undo,selectNode:id=>{selected={type:'node',id};render()},setPosition:(id,x,y)=>commit(()=>{let n=nby(id);n.x=x;n.y=y}),setNodeAppearance:(id,patch)=>commit(()=>{const n=nby(id);if(!n)throw Error("Unknown node");if(patch.width!==undefined)n.width=Math.max(180,Math.min(780,patch.width));if(patch.height!==undefined)n.height=Math.max(95,Math.min(640,patch.height));if(patch.color!==undefined){if(patch.color===null)delete n.color;else if(COLORS.includes(patch.color))n.color=patch.color;else throw Error("Invalid color")}}),setInspectorPinned:v=>{inspectorPinned=!!v;renderInspector();positionInspector()},getSelected:()=>selected,getNavigation:()=>({focusMode,overviewOn,forceAllEdges,routeMode,lodOverview,semanticMode:semanticZoomLevel()}),getSemanticZoom:()=>semanticZoomLevel(),setZoomForTest:(scale)=>setZoom(scale),getEdgePlan:()=>{const p=connectionPlan();return {overview:p.overview,bridges:p.bridges.map(g=>({key:g.key,edgeIds:g.edges.map(e=>e.id)})),displayed:p.visibleEdges.map(e=>e.id),suppressed:[...p.localSuppressed.entries()]};},setAllEdges,setRouteMode,getPerf:()=>({...perfStats}),jumpToNode,jumpToField,toggleFocus:focusToggle,toggleOverview:()=>{overviewOn=!overviewOn;render()},loadFixture:fixture=>{state=structuredClone(fixture);selected=null;history=[];recomputeFieldTags();save();render()},reset:()=>{state=seed();recomputeFieldTags();history=[];selected=null;save();render();fit()}};
recomputeFieldTags();save();render();
})();
