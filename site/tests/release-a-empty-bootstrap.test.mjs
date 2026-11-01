import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const editor=readFileSync(new URL('../src/editor.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('Release A: embedded HTML uses the identical editor script',()=>{
  assert.ok(html.includes(editor));
});

test('Release A: no inherited local plot is posted to an empty Site',()=>{
  const first=editor.indexOf('async function connectSite(silent=false)');
  assert.ok(first>0);
  const boot=editor.slice(first,first+1600);
  assert.match(boot,/if\(!data\.projects\.length\)\{const created=await apiRequest\('\/api\/projects',\{method:'POST',body:\{name:'Новая история',graph:blankGraph\(\)\}\}\)/);
  assert.match(boot,/state=validateImported\(created\.graph\)/);
  assert.doesNotMatch(boot,/graph:persistentGraph\(\)/);
});

test('Release A: connected Site cannot enter local-only event rewrite mode',()=>{
  const start=editor.indexOf('function beginEventRewrite(id){');
  assert.ok(start>0);
  assert.match(editor.slice(start,start+350),/if\(remote\.connected\)return/);
});
