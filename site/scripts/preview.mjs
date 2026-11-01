import {spawnSync,spawn} from 'node:child_process';
process.env.WRANGLER_SEND_METRICS='false';process.env.CLOUDFLARE_CF_FETCH_ENABLED='false';
const cli='node_modules/wrangler/bin/wrangler.js';
const portIndex=process.argv.indexOf('--port');
const previewPort=portIndex>=0?process.argv[portIndex+1]:process.env.PORT||'5173';
const m=spawnSync(process.execPath,[cli,'d1','migrations','apply','DB','--local','--config','wrangler.preview.jsonc','--persist-to','.wrangler/state'],{stdio:'inherit',env:process.env});
if(m.status!==0)process.exit(m.status||1);
const child=spawn(process.execPath,[cli,'dev','--local','--config','wrangler.preview.jsonc','--persist-to','.wrangler/state','--ip','0.0.0.0','--port',previewPort,'--inspector-port','0'],{stdio:'inherit',env:process.env});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>child.kill(sig));child.on('exit',c=>process.exit(c||0));
