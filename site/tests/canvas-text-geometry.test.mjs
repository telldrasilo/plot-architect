import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasTextEdgeGeometry as layout,CANVAS_TEXT_EDGE_MODES}
 from '../src/canvas_text_geometry.mjs';
const base={x:100,y:250,width:420,height:140};
test('top edge moves without changing size',()=>{
 assert.deepEqual(layout(base,'move',70,-30),{x:170,y:220,width:420,height:140});
});
test('left and right edges keep the opposite border fixed',()=>{
 assert.deepEqual(layout(base,'left',80,0),{x:180,y:250,width:340,height:140});
 assert.deepEqual(layout(base,'right',80,0),{x:100,y:250,width:500,height:140});
 assert.deepEqual(layout(base,'left',500,0),{x:320,y:250,width:200,height:140});
 assert.deepEqual(layout(base,'right',-500,0),{x:100,y:250,width:200,height:140});
});
test('bottom edge and both bottom corners resize freely in two axes',()=>{
 assert.deepEqual(layout(base,'bottom',100,90),{x:100,y:250,width:420,height:230});
 assert.deepEqual(layout(base,'bottom-left',80,90),{x:180,y:250,width:340,height:230});
 assert.deepEqual(layout(base,'bottom-right',80,90),{x:100,y:250,width:500,height:230});
});
test('cannot shrink below actual text content, or shift the top edge when resizing',()=>{
 assert.deepEqual(layout(base,'bottom',0,-400,180),{x:100,y:250,width:420,height:180});
 assert.deepEqual(layout(base,'right',100,0,230),{x:100,y:250,width:520,height:230});
 assert.deepEqual(layout(base,'bottom-left',400,-300,240),{x:320,y:250,width:200,height:240});
});
test('invalid modes or unsafe geometry fail closed',()=>{
 assert.deepEqual(CANVAS_TEXT_EDGE_MODES,['move','left','right','bottom','bottom-left','bottom-right']);
 for(const mode of ['top','top-left','top-right','unknown'])
  assert.throws(()=>layout(base,mode,1,1),/CANVAS_TEXT_GEOMETRY_INVALID/);
 assert.throws(()=>layout(base,'move',Infinity,0),/CANVAS_TEXT_GEOMETRY_INVALID/);
 assert.throws(()=>layout({...base,height:50},'bottom',1,1),/CANVAS_TEXT_GEOMETRY_INVALID/);
});
