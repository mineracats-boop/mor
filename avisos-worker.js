// M.O.R. · servidor de avisos (Cloudflare Workers, plan gratis)
// Necesita: un KV con nombre de variable AVISOS y un disparador cron "* * * * *" (cada minuto).
// Solo guarda CUÁNDO avisar (las horas), nunca QUÉ: el texto de cada aviso está en tu móvil.
// Gasto: ~1.440 ejecuciones al día de las 100.000 gratis; no afecta a tus otros Workers.
const b64u={enc:u8=>btoa(String.fromCharCode(...u8)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const json=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...CORS,'content-type':'application/json'}});
async function claves(env){ let k=await env.AVISOS.get('vapid','json'); if(k) return k;
  const p=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  k={pub:b64u.enc(new Uint8Array(await crypto.subtle.exportKey('raw',p.publicKey))),priv:await crypto.subtle.exportKey('jwk',p.privateKey)};
  await env.AVISOS.put('vapid',JSON.stringify(k)); return k; }
async function firma(aud,k){ const enc=o=>b64u.enc(new TextEncoder().encode(JSON.stringify(o)));
  const h=enc({typ:'JWT',alg:'ES256'}), p=enc({aud,exp:Math.floor(Date.now()/1000)+43200,sub:'mailto:mor@rocketjam.local'});
  const key=await crypto.subtle.importKey('jwk',k.priv,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  return h+'.'+p+'.'+b64u.enc(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(h+'.'+p)))); }
async function avisar(sub,k){ const t=await firma(new URL(sub.endpoint).origin,k);
  return fetch(sub.endpoint,{method:'POST',headers:{TTL:'900',Urgency:'high',Authorization:`vapid t=${t}, k=${k.pub}`,'Content-Length':'0'}}); }
export default {
  async fetch(req,env){ if(req.method==='OPTIONS') return new Response(null,{headers:CORS}); const u=new URL(req.url);
    if(!env.AVISOS) return json({error:'Falta el KV: en Settings › Bindings añade un KV con nombre de variable AVISOS'},500);
    if(u.pathname==='/vapid') return json({pub:(await claves(env)).pub});
    if(u.pathname==='/sub'&&req.method==='POST'){ const b=await req.json().catch(()=>null); if(!b||!b.id||!b.sub||!b.sub.endpoint) return json({error:'datos'},400);
      const todos=(await env.AVISOS.get('todos','json'))||{}; todos[b.id]={sub:b.sub,times:(b.times||[]).filter(t=>t>Date.now()-60000).sort((a,c)=>a-c).slice(0,300),at:Date.now()};
      for(const [id,x] of Object.entries(todos)) if(Date.now()-x.at>30*864e5) delete todos[id];
      await env.AVISOS.put('todos',JSON.stringify(todos)); return json({ok:true,avisos:todos[b.id].times.length}); }
    if(u.pathname==='/prueba'&&req.method==='POST'){ const b=await req.json().catch(()=>({})); const x=((await env.AVISOS.get('todos','json'))||{})[b.id]; if(!x) return json({error:'no suscrito'},404);
      const r=await avisar(x.sub,await claves(env)); return json({estado:r.status}); }
    return new Response('M.O.R. avisos ✓',{headers:CORS}); },
  async scheduled(ev,env,ctx){ const todos=await env.AVISOS.get('todos','json'); if(!todos) return; const now=Date.now(), k=await claves(env);
    for(const x of Object.values(todos)) if(x.times.some(t=>t<=now&&t>now-60000)) ctx.waitUntil(avisar(x.sub,k)); }
};
