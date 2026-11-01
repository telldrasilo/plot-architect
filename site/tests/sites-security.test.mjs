import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
const fakeDB={prepare(){throw Error('Database must not be touched')}};
test('legacy bearer never replaces native Site identity',async()=>{
 const r=await worker.fetch(new Request('https://plot.local/api/projects',{headers:{Authorization:'Bearer legacy-test-value-which-is-not-a-secret'}}),{DB:fakeDB,PLOT_PRIVATE_TOKEN:'legacy-test-value-which-is-not-a-secret'});
 assert.equal(r.status,401);
});
test('cross-origin mutation is forbidden before touching D1',async()=>{
 const r=await worker.fetch(new Request('https://plot.local/api/projects',{method:'POST',headers:{'oai-authenticated-user-id':'test-owner',Origin:'https://other.example'},body:'{}'}),{DB:fakeDB});
 assert.equal(r.status,403);
});
test('root UI and every project route require identity',async()=>{
 for(const path of ['/','/api/projects','/api/projects/id','/api/projects/id/revisions','/api/projects/id/restore']){
 const r=await worker.fetch(new Request('https://plot.local'+path),{DB:fakeDB});assert.equal(r.status,401,path);
 }
});
