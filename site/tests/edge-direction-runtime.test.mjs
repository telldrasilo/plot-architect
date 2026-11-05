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

test('draft links retain the complete path and reorient their arrow on drag',()=>{
 const start=editor.indexOf('function cwDrawDraftConnections(');
 const end=editor.indexOf('function cwDraftTargetAt(',start);
 assert.ok(start>=0&&end>start);
 const draw=editor.slice(start,end);
 assert.ok(draw.includes("const from=sockets.ports.get(socketKey(edge.id,'source'))"));
 assert.ok(draw.includes("const to=sockets.ports.get(socketKey(edge.id,'target'))"));
 assert.ok(draw.includes("const d='M '+ax+' '+ay+' L '+bx+' '+by"));
 assert.ok(draw.includes("path.setAttribute('d',d)"));
 assert.ok(draw.includes("cwPositionPathDirection(path,directions.get(edge.id))"),
  'direction must move along with the line during draft drag');
 assert.ok(draw.includes("hitPaths.get(edge.id)?.setAttribute('d',d)"),
  'the whole link remains an interactive hit target');
 const render=editor.slice(editor.indexOf('function renderCreativeWorkspacePreview('),
  editor.indexOf('function note(s){'));
 assert.ok(render.includes("cwDrawDraftConnections(svg,area,internals,drawnSockets)"));
 assert.ok(!render.includes("path.setAttribute('marker-end'"),
  'draft SVG path must not be prematurely terminated by an end marker');
 assert.ok(!render.includes("cw-draft-arrow-"),
  'legacy draft marker definitions are retired');
});
