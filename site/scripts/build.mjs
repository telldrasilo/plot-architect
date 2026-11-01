import {readFileSync,writeFileSync,mkdirSync,rmSync,cpSync} from 'node:fs';
const graph=readFileSync('src/graph_contract.mjs','utf8').replace(/export /g,'');
const mcp=readFileSync('src/mcp_server.mjs','utf8').replace(/^import .*?;\n/gm,'').replace(/export /g,'');
const api=readFileSync('src/worker.mjs','utf8').replace(/^import .*?;\n/gm,'').replace('export default {','const runtimeWorker={');
const html=readFileSync('public/index.html','utf8');
rmSync('dist',{recursive:true,force:true});mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
writeFileSync('dist/server/index.js',graph+'\n'+mcp+'\n'+api+'\nconst HTML='+JSON.stringify(html)+';\nexport default {fetch(request,env,ctx){return runtimeWorker.fetch(request,{...env,PLOT_HTML:HTML},ctx)}};\n');
cpSync('.openai/hosting.json','dist/.openai/hosting.json');cpSync('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built single ESM Worker, inline Graphite UI and D1 migrations');
