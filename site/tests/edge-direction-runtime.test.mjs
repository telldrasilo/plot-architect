import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/edge_direction_geometry.mjs',import.meta.url),'utf8');
const editor=readFileSync(new URL('../src/editor.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('V2 midpoint helper is mirrored exactly into the browser editor',()=>{
 const start='/* Graphite edge direction V2 generated start: site/src/edge_direction_geometry.mjs */\n';
 const end='\n/* Graphite edge direction V2 generated end */';
 const embedded=start+source.replace(/^export /gm,'')+end;
 assert.ok(editor.includes(embedded),'the browser must execute the tested geometry');
 assert.ok(html.includes(editor),'inline HTML must mirror complete editor runtime');
});

test('canonical lines have complete socket endpoints and no terminal arrow',()=>{
 const from=editor.indexOf('for(const e of plan.visibleEdges){');
 const to=editor.indexOf('for(const g of plan.bridges){',from);
 assert.ok(from>=0&&to>from,'find canonical edge renderer');
 const block=editor.slice(from,to);
 assert.ok(block.includes('const start=sockets.ports.get(socketKey(e.id,\'source\'))'));
 assert.ok(block.includes('const finish=sockets.ports.get(socketKey(e.id,\'target\'))'));
 assert.ok(block.includes('data-edge="'));
 assert.ok(!block.includes('marker-end='),'no terminal marker on the full route');
 assert.ok(editor.includes('cwPositionPathDirection(line)'));
 assert.ok(editor.includes('arrow.dataset.edgeDirection=group.dataset.edge'));
 assert.ok(editor.includes('path.after(arrow)'));
 assert.ok(editor.includes("arrow.setAttribute('pointer-events','none')"));
});
