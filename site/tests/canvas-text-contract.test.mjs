import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCanvasTexts} from '../src/canvas_text_contract.mjs';
const basic={nodes:[],canvasTexts:[{id:'ct-example',x:0,y:100,width:490,parent:null,blocks:[
  {type:'heading',runs:[{text:'Проверка 01'}]},
  {type:'paragraph',runs:[{text:'Выберите узел '},{text:'B',italic:true,underline:true}]},
  {type:'quote',runs:[{text:'Прежняя стрелка сохранена'}]}
]}]};
const clone=x=>structuredClone(x);
test('valid independent annotation with inline and paragraph formatting',()=>assert.equal(validateCanvasTexts(basic).length,1));
test('legacy graphs are valid without canvasTexts',()=>assert.deepEqual(validateCanvasTexts({nodes:[]}),[]));
test('annotation can be anywhere, regardless of field bounds',()=>{
 const g=clone(basic);g.fields=[{id:'f1',x:50,y:50,width:300,height:200}];
 assert.equal(validateCanvasTexts(g).length,1);g.canvasTexts[0].x=10000;assert.equal(validateCanvasTexts(g).length,1);
});
test('rejects HTML payload fields and unexpectedly rich formatting',()=>{
 for(const mutation of [i=>i.blocks[0].runs[0].html='<script>x</script>',
  i=>i.blocks[0].runs[0].underline='yes',i=>i.blocks[0].type='javascript',
  i=>i.blocks[0].runs.push({text:'x',onclick:'alert(1)'})]){
  const g=clone(basic);mutation(g.canvasTexts[0]);assert.throws(()=>validateCanvasTexts(g),/CANVAS_TEXT_INVALID/);
 }
});
test('rejects duplicate ids, overlong text, unknown scope and invalid geometry',()=>{
 for(const mutate of [g=>g.canvasTexts.push(clone(g.canvasTexts[0])),
  g=>g.canvasTexts[0].blocks[0].runs[0].text='X'.repeat(20001),
  g=>g.canvasTexts[0].parent='missing',g=>g.canvasTexts[0].width=10,
  g=>g.canvasTexts[0].x=Number.POSITIVE_INFINITY]){
  const g=clone(basic);mutate(g);assert.throws(()=>validateCanvasTexts(g),/CANVAS_TEXT_INVALID/);
 }
});
test('optional height survives validation; older annotations remain heightless',()=>{
 const legacy=clone(basic);
 assert.equal(validateCanvasTexts(legacy)[0].height,undefined);
 const tall=clone(basic);tall.canvasTexts[0].height=320;
 assert.equal(validateCanvasTexts(tall)[0].height,320);
});
test('rejects clipped, unbounded or nonfinite stored height',()=>{
 for(const height of [0,60,75,-10,100001,Infinity,NaN,'240']){
  const graph=clone(basic);graph.canvasTexts[0].height=height;
  assert.throws(()=>validateCanvasTexts(graph),/CANVAS_TEXT_INVALID/);
 }
});
