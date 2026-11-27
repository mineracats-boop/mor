// Mor (Rocket Jam): abre el juego en un navegador de verdad, juega un rato y apunta lo que ve
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { chromium } from 'playwright';
const dir=path.resolve(process.argv[2]), seg=+(process.argv[3]||60), out=path.join(dir,'salida');
fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
const tipos={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.fbx':'application/octet-stream','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const srv=http.createServer((q,r)=>{ let p=decodeURIComponent(q.url.split('?')[0]); if(p.endsWith('/')) p+='index.html'; const f=path.join(dir,p);
  if(!f.startsWith(dir)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200,{'Content-Type':tipos[path.extname(f).toLowerCase()]||'application/octet-stream'}); fs.createReadStream(f).pipe(r); }).listen(8765);
const informe={inicio:new Date().toISOString(),errores:[],avisos:[],capturas:[],congelado:0,teclas:0,clics:0};
const nav=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const pg=await nav.newPage({viewport:{width:1280,height:720}});
pg.on('pageerror',e=>informe.errores.push(String(e.message||e).slice(0,300)));
pg.on('console',m=>{ if(m.type()==='error') informe.errores.push(m.text().slice(0,300)); else if(m.type()==='warning'&&informe.avisos.length<20) informe.avisos.push(m.text().slice(0,200)); });
pg.on('requestfailed',q=>informe.errores.push('No carga: '+q.url().replace('http://localhost:8765/','')));
pg.on('response',r=>{ if(r.status()>=400) informe.errores.push('Falta el archivo: '+r.url().replace('http://localhost:8765/','')); });
const t0=Date.now(); let n=0, ultimo='';
const foto=async nombre=>{ const b=await pg.screenshot({path:path.join(out,nombre+'.png')}); const h=crypto.createHash('md5').update(b).digest('hex'); if(h===ultimo) informe.congelado++; ultimo=h; informe.capturas.push({nombre,t:Math.round((Date.now()-t0)/1000)}); };
try{
  await pg.goto('http://localhost:8765/index.html',{waitUntil:'load',timeout:60000}); await pg.waitForTimeout(3000); await foto('00_inicio');
  await pg.mouse.click(640,400); await pg.keyboard.press('Enter'); await pg.keyboard.press('Space'); informe.clics++; await pg.waitForTimeout(1500); await foto('01_empieza');
  const teclas=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','KeyE','KeyF'];
  let siguiente=Date.now()+8000;
  while(Date.now()-t0<seg*1000){ const k=teclas[Math.floor(Math.random()*teclas.length)];
    await pg.keyboard.down(k); await pg.waitForTimeout(150+Math.random()*900); await pg.keyboard.up(k); informe.teclas++;
    if(Math.random()<.15){ await pg.mouse.click(200+Math.random()*880,150+Math.random()*450); informe.clics++; }
    if(Date.now()>siguiente){ n++; await foto(String(n+1).padStart(2,'0')+'_juego'); siguiente=Date.now()+8000; } }
  await foto('99_final');
  informe.estado=await pg.evaluate(()=>{ try{ const j=window.__juego; return j?JSON.parse(JSON.stringify(typeof j.estado==='function'?j.estado():j,(k,v)=>typeof v==='function'?undefined:v)):null; }catch(e){ return null; } }).catch(()=>null);
}catch(e){ informe.errores.push('El juego no ha podido abrirse: '+e.message.slice(0,200)); }
informe.errores=[...new Set(informe.errores)].slice(0,40); informe.fin=new Date().toISOString();
fs.writeFileSync(path.join(out,'informe.json'),JSON.stringify(informe,null,1));
await nav.close(); srv.close(); console.log('Errores:',informe.errores.length,'Capturas iguales seguidas:',informe.congelado);
