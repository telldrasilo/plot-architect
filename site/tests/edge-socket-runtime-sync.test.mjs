import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('browser inline geometry is generated exactly from the one pure-source module',()=>{
 const geometry=readFileSync(new URL('../src/edge_socket_geometry.mjs',import.meta.url),'utf8');
 const editor=readFileSync(new URL('../src/editor.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const start='/* CW-004 generated geometry start: site/src/edge_socket_geometry.mjs */\n';
 const end='\n/* CW-004 generated geometry end */';
 const normalized=geometry.replace(/^export /gm,'');
 assert.ok(editor.includes(start+normalized+end),
  'inline runtime geometry must match the tested source exactly');
 assert.ok(html.includes(editor),'hosted HTML must contain the exact editor runtime');
});
