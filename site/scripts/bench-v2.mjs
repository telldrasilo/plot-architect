/** P2 SQLite in-memory benchmark: synthetic projects only, no existing history accessed. */
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {getNodes,getViewport} from '../src/v2_store.mjs';
const ddl=fs.readFileSync(new URL('../db/0002_v2_isolated.sql',import.meta.url),'utf8');
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
async function run(count){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;'+ddl);
 db.prepare("INSERT INTO projects_v2(project_id,owner_id,name,schema_version,created_at,updated_at) VALUES('scale','bench','Синтетическая история','plot-architect/v2','t','t')").run();
 const stmt=db.prepare('INSERT INTO plot_nodes_v2(project_id,node_id,parent_id,title,description,kind,status,x,y,width,height) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
 const start=performance.now();db.exec('BEGIN IMMEDIATE');try{for(let i=0;i<count;i++){
  stmt.run('scale','n'+String(i).padStart(7,'0'),null,'Событие '+i,'Длинное русскоязычное описание '+i+' / '.repeat(8),'event','draft',i%250*100,Math.floor(i/250)*140,210,115);
 }db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
 const insert_ms=performance.now()-start;
 const wrap=sql=>({sql,params:[],bind(...a){this.params=a;return this},async first(){return db.prepare(sql).get(...this.params)},async all(){return {results:db.prepare(sql).all(...this.params)}}});
 const api={prepare:wrap};const times=[];const bounds={x:2200,y:Math.round(count/500)*60,width:900,height:650};
 let example=null;
 for(let i=0;i<30;i++){const t=performance.now();example=await getViewport(api,{project_id:'scale',owner_id:'bench',bounds,limit:100});times.push(performance.now()-t)}
 const nodeTimes=[];for(let i=0;i<30;i++){const t=performance.now();await getNodes(api,{project_id:'scale',owner_id:'bench',limit:100});nodeTimes.push(performance.now()-t)}
 const plan=db.prepare("EXPLAIN QUERY PLAN SELECT node_id FROM plot_nodes_v2 INDEXED BY idx_v2_nodes_xy WHERE project_id='scale' AND parent_id IS NULL AND x<9000 AND x+width>1000 AND y<9500 AND y+height>8000 AND (x>-1000 OR (x=-1000 AND node_id>'')) ORDER BY x,node_id LIMIT 101").all().map(x=>x.detail);
 const report={rows:count,insert_ms:+insert_ms.toFixed(2),viewport_p95_ms:+p95(times).toFixed(3),viewport_max_ms:+Math.max(...times).toFixed(3),nodes_p95_ms:+p95(nodeTimes).toFixed(3),viewport_result_count:example.nodes.length,db_page_count:db.prepare('PRAGMA page_count').get().page_count,db_page_size:db.prepare('PRAGMA page_size').get().page_size,query_plan:plan,environment:'node:sqlite in-memory; not actual D1'};
 db.close();return report;
}
const result={benchmarks:[]};for(const count of [10000,50000])result.benchmarks.push(await run(count));
const outfile=new URL('../../BENCH_V2_SQLITE.json',import.meta.url);fs.writeFileSync(outfile,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
