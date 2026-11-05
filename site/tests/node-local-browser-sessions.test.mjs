import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {openGraphiteLocalStorage} from '../src/node_local_storage.mjs';
import {createGraphiteLoopbackServer} from '../src/node_local_server.mjs';
import {createGraphiteBrowserSessionStore, PERSISTENT_BROWSER_SESSION_MS} from '../src/node_local_browser_sessions.mjs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const secret=()=>randomBytes(32).toString('base64url');

test('browser sessions survive process restart without exposing cookie or MCP secrets on disk',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'graphite-remember-login-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const sessionPath=join(dir,'browser-sessions.json');
  const databasePath=join(dir,'graphite-dev.sqlite');
  async function boot(token) {
    const database=openGraphiteLocalStorage(databasePath);
    const browserSessions=createGraphiteBrowserSessionStore({filePath:sessionPath});
    const server=createGraphiteLoopbackServer({database,editorHtml:html,token,
      browserSessions,workflowEnabled:true});
    const origin=await server.listen(0);
    return {server,database,origin,async close(){await server.close();database.close();}};
  }
  const key1=secret(),first=await boot(key1);
  const login=await fetch(first.origin+'/__local/login',{
    method:'POST',redirect:'manual',headers:{
      Origin:first.origin,'Content-Type':'application/x-www-form-urlencoded'
    },body:'key='+encodeURIComponent(key1)
  });
  assert.equal(login.status,303);
  assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict; Path=\/; Max-Age=2592000/);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(first.origin+'/',{headers:{Cookie:cookie}})).status,200);
  const disk=readFileSync(sessionPath,'utf8');
  assert.match(disk,/"version":1/);
  assert.match(disk,/"hash":"[a-f0-9]{64}"/);
  assert.ok(!disk.includes(cookie.split('=')[1]),'no bearer cookie IDs written to disk');
  assert.ok(!disk.includes(key1),'no MCP Bearer keys written to disk');
  await first.close();
  const key2=secret(),second=await boot(key2);
  assert.notEqual(key1,key2);
  assert.equal((await fetch(second.origin+'/',{headers:{Cookie:cookie}})).status,200,
    'remembered cookie authorizes editor after restart with a rotated MCP token');
  assert.equal((await fetch(second.origin+'/api/health',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await fetch(second.origin+'/api/projects',{
    headers:{Authorization:'Bearer '+key1}
  })).status,401,'old process Bearer cannot authenticate');
  assert.equal((await fetch(second.origin+'/mcp',{method:'POST',headers:{
    Cookie:cookie,'Content-Type':'application/json'
  },body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})})).status,401,
    'remembered browser cookie never authenticates MCP');
  assert.equal((await fetch(second.origin+'/api/projects',{
    method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},
    body:'{}'
  })).status,403,'same-origin CSRF rule remains mandatory');
  assert.equal((await fetch(second.origin+'/__local/logout',{method:'POST',
    redirect:'manual',headers:{Cookie:cookie,Origin:second.origin}
  })).status,303);
  await second.close();
  const third=await boot(secret());
  assert.equal((await fetch(third.origin+'/',{redirect:'manual',headers:{Cookie:cookie}})).status,303,
    'logout persists across subsequent restart');
  await third.close();
});

test('session file is fail-closed on corruption; expiry and caps enforced',()=>{
  const dir=mkdtempSync(join(tmpdir(),'graphite-session-data-'));
  try {
    const path=join(dir,'browser-sessions.json');
    let current=1_700_000_000_000;
    const clock=()=>current;
    const store=createGraphiteBrowserSessionStore({filePath:path,ttlMs:5000,clock});
    const first=store.issue();
    assert.ok(store.isValid(first));
    assert.equal(store.maxAgeSeconds,5);
    assert.equal(createGraphiteBrowserSessionStore({filePath:path,ttlMs:5000,clock}).isValid(first),true);
    current+=5001;
    assert.equal(store.isValid(first),false,'expired cookie cannot authenticate');
    assert.equal(createGraphiteBrowserSessionStore({filePath:path,ttlMs:5000,clock}).isValid(first),false);
    let last;
    for(let i=0;i<11;i++)last=store.issue();
    assert.ok(store.isValid(last));
    assert.equal(JSON.parse(readFileSync(path,'utf8')).sessions.length,10);
    writeFileSync(path,'{"version":1,"sessions":[{"hash":"forged"}]}','utf8');
    assert.throws(()=>createGraphiteBrowserSessionStore({filePath:path}),/invalid/);
    assert.equal(readFileSync(path,'utf8'),'{"version":1,"sessions":[{"hash":"forged"}]}',
      'invalid session file is never silently replaced');
    assert.throws(()=>createGraphiteBrowserSessionStore({filePath:'relative.txt'}),TypeError);
    assert.equal(typeof PERSISTENT_BROWSER_SESSION_MS,'number');
  } finally {
    rmSync(dir,{recursive:true,force:true});
  }
});
