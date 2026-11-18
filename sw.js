// M.O.R. — guarda la app para que abra al instante (las IA siguen necesitando internet)
const C='mor-v46';
self.addEventListener('install',e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','marca/icon_color.png','marca/horizontal_white.png']))); self.skipWaiting(); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&x!=='mor-avisos').map(x=>caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch',e=>{ const u=new URL(e.request.url); if(u.origin!==location.origin||e.request.method!=='GET'||u.pathname.endsWith('avisos.json')) return;
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{ const cp=r.clone(); caches.open(C).then(c=>c.put(e.request,cp)); return r; }).catch(()=>caches.match(e.request))); });
// avisos con Mor cerrado: el servidor solo dice «ahora»; el texto está guardado aquí, en el móvil
self.addEventListener('push',e=>{ e.waitUntil((async()=>{ let L=[]; try{ const c=await caches.open('mor-avisos'); const r=await c.match('avisos.json'); if(r) L=await r.json(); }catch(x){}
  const now=Date.now(), due=L.filter(a=>a.t<=now+60000&&a.t>now-15*60000), lista=due.length?due:[{t:now,txt:'Tienes un aviso de Mor'}];
  for(const a of lista.slice(0,3)) await self.registration.showNotification('MOR · Rocket Jam',{body:a.txt,icon:'icon-192.png',badge:'icon-192.png',tag:'mor-'+a.t,vibrate:[200,100,200],requireInteraction:true}); })()); });
self.addEventListener('notificationclick',e=>{ e.notification.close(); e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(L=>{ const c=L.find(x=>'focus' in x); return c?c.focus():clients.openWindow('./'); })); });
