// LOCAL QA ONLY. Never included in dist. Simulates dispatch identity, not ChatGPT login.
import worker from '../dist/server/index.js';
export default {async fetch(request,env,ctx){
 const u=new URL(request.url);
 if(u.pathname==='/__qa/signin')return new Response(null,{status:302,headers:{Location:'/', 'Set-Cookie':'plot_qa_owner=1; Path=/; SameSite=Strict; HttpOnly'}});
 if(u.pathname==='/__qa/signout')return new Response(null,{status:302,headers:{Location:'/', 'Set-Cookie':'plot_qa_owner=; Max-Age=0; Path=/; SameSite=Strict; HttpOnly'}});
 if(u.pathname==='/'&&!/(?:^|;\s*)plot_qa_owner=1(?:;|$)/.test(request.headers.get('Cookie')||''))return new Response('<h1>Plot Architect · Local QA preview</h1><p>This is a local test identity, not hosted ChatGPT authentication.</p><a href="/__qa/signin">Open QA editor</a>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
 const headers=new Headers(request.headers);headers.delete('oai-authenticated-user-id');
 if(/(?:^|;\s*)plot_qa_owner=1(?:;|$)/.test(headers.get('Cookie')||''))headers.set('oai-authenticated-user-id','local-qa-owner');
 return worker.fetch(new Request(request,{headers}),env,ctx);
}};
