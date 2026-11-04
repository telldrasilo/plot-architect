/**
 * Local-only legacy Wrangler preview bundle. Unlike the early three-file
 * concatenation, this must follow the complete Worker import graph when MCP
 * or editorial modules are added. Uses the already pinned Vite dependency,
 * not a second bundler or the hosted Sites deployment mechanism.
 */
import {readFileSync,mkdirSync,rmSync,cpSync} from 'node:fs';
import {build} from 'vite';

const html=readFileSync('public/index.html','utf8');
const virtualId='\0virtual:graphite-html';
const rawHtml={
 name:'plot-architect-legacy-preview-html',
 resolveId(id){if(id==='virtual:graphite-html')return virtualId},
 load(id){if(id===virtualId)return 'export default '+JSON.stringify(html)+';'}
};

rmSync('dist',{recursive:true,force:true});
mkdirSync('dist/server',{recursive:true});
mkdirSync('dist/.openai',{recursive:true});

await build({
 configFile:false,
 logLevel:'warn',
 plugins:[rawHtml],
 build:{
  outDir:'dist/server',
  emptyOutDir:false,
  target:'es2022',
  minify:false,
  sourcemap:false,
  lib:{entry:'src/sites-vite-entry.mjs',formats:['es'],fileName:'index'}
 }
});
cpSync('.openai/hosting.json','dist/.openai/hosting.json');
cpSync('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Bundled local ESM Worker with full MCP/workflow imports, Graphite UI and D1 migrations');
