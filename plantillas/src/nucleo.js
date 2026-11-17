// ===================== NÚCLEO ROCKET JAM (no hace falta tocarlo) =====================
// Bucle de paso fijo, teclado + táctil + mando, estados (inicio/jugando/pausa/fin), récord,
// imágenes con hueco (si falta la imagen se ve un recuadro con su nombre), sonidos sin archivos,
// partículas, temblor de pantalla y el gancho de prueba window.__juego.
const W=CONFIG.ancho, H=CONFIG.alto;
const cv=document.getElementById('lienzo'), g=cv.getContext('2d');
let ESC=1, OX=0, OY=0;
function ajustar(){ const dpr=Math.min(devicePixelRatio||1,2); cv.width=innerWidth*dpr; cv.height=innerHeight*dpr; cv.style.width=innerWidth+'px'; cv.style.height=innerHeight+'px';
  ESC=Math.min(cv.width/W,cv.height/H); OX=(cv.width-W*ESC)/2; OY=(cv.height-H*ESC)/2; }
addEventListener('resize',ajustar); ajustar();
// ---- imágenes: CONFIG.imagenes = { nombre: 'img/archivo.png' }
const IMG={};
for(const [n,r] of Object.entries(CONFIG.imagenes||{})){ const im=new Image(); im.onload=()=>IMG[n]=im; im.src=r; }
function dibujar(nombre,x,y,w,h,opts={}){ const im=IMG[nombre]; g.save(); g.translate(x+w/2,y+h/2); if(opts.giro) g.rotate(opts.giro); if(opts.espejo) g.scale(-1,1); if(opts.alfa!=null) g.globalAlpha=opts.alfa;
  if(im) g.drawImage(im,-w/2,-h/2,w,h);
  else { g.fillStyle=opts.color||CONFIG.colores[nombre]||'#888'; g.fillRect(-w/2,-h/2,w,h); }
  g.restore();
  if(!im&&w>=28&&h>=14&&!opts.sinNombre){ g.fillStyle='rgba(0,0,0,.55)'; g.font='bold '+Math.max(9,Math.min(14,w/6))+'px system-ui'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(nombre,x+w/2,y+h/2); } }   // el nombre siempre derecho
// ---- entrada: K['ArrowLeft'] etc. (teclado, botones táctiles con data-k, mando y toque en pantalla = K.Tap)
const K={}, KP={};   // K: pulsada ahora · KP: recién pulsada en este frame
addEventListener('keydown',e=>{ if(!K[e.code]) KP[e.code]=true; K[e.code]=true; if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup',e=>{ K[e.code]=false; });
addEventListener('blur',()=>{ for(const k in K) K[k]=false; });
function botonesTactiles(){ const caja=document.getElementById('tactil'); if(!caja) return;
  caja.innerHTML=(CONFIG.tactil||[]).map(b=>`<div class="tb" data-k="${b.k}" style="${b.estilo||''}">${b.txt||''}</div>`).join('');
  caja.querySelectorAll('[data-k]').forEach(b=>{ const k=b.dataset.k; const on=e=>{ e.preventDefault(); if(!K[k]) KP[k]=true; K[k]=true; b.classList.add('on'); }, off=()=>{ K[k]=false; b.classList.remove('on'); };
    b.addEventListener('pointerdown',on); ['pointerup','pointerleave','pointercancel'].forEach(t=>b.addEventListener(t,off)); }); }
botonesTactiles();
cv.addEventListener('pointerdown',e=>{ KP.Tap=true; K.Tap=true; TOQUE.x=(e.clientX*(cv.width/innerWidth)-OX)/ESC; TOQUE.y=(e.clientY*(cv.height/innerHeight)-OY)/ESC; });
addEventListener('pointerup',()=>K.Tap=false);
const TOQUE={x:0,y:0};
function mando(){ const gp=(navigator.getGamepads?[...navigator.getGamepads()]:[]).find(Boolean); if(!gp) return; const ax=gp.axes||[], bt=i=>gp.buttons[i]&&gp.buttons[i].pressed;
  const set=(k,v)=>{ if(v&&!K['gp'+k]) KP[k]=true; K['gp'+k]=v; }; set('ArrowLeft',ax[0]<-.4||bt(14)); set('ArrowRight',ax[0]>.4||bt(15)); set('ArrowUp',ax[1]<-.4||bt(12)); set('ArrowDown',ax[1]>.4||bt(13)); set('Space',bt(0)); set('KeyX',bt(2)); set('Enter',bt(9)); }
const tecla=k=>!!(K[k]||K['gp'+k]), recien=k=>!!KP[k];
const izq=()=>tecla('ArrowLeft')||tecla('KeyA'), der=()=>tecla('ArrowRight')||tecla('KeyD'), arr=()=>tecla('ArrowUp')||tecla('KeyW'), abj=()=>tecla('ArrowDown')||tecla('KeyS');
// ---- sonidos sin archivos (y CONFIG.sonidos = { nombre: 'snd/archivo.mp3' } si los hay)
let AC=null; const SND={}; for(const [n,r] of Object.entries(CONFIG.sonidos||{})){ const a=new Audio(r); a.preload='auto'; SND[n]=a; }
function sonido(n,f=440,dur=.1,tipo='square',vol=.08){ if(SND[n]){ try{ const a=SND[n].cloneNode(); a.volume=.6; a.play(); }catch(e){} return; }
  try{ AC=AC||new (window.AudioContext||window.webkitAudioContext)(); const o=AC.createOscillator(), v=AC.createGain(); o.type=tipo; o.frequency.setValueAtTime(f,AC.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(40,f*.6),AC.currentTime+dur);
    v.gain.setValueAtTime(vol,AC.currentTime); v.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+dur); o.connect(v); v.connect(AC.destination); o.start(); o.stop(AC.currentTime+dur); }catch(e){} }
// ---- partículas y temblor
const PART=[]; let TEMBLOR=0;
function chispas(x,y,color='#ffd23f',n=12,vel=180){ for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, v=vel*(.4+Math.random()*.8); PART.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:.5+Math.random()*.4,color}); } }
function temblar(f=8){ TEMBLOR=Math.max(TEMBLOR,f); }
function actualizarParticulas(dt){ for(let i=PART.length-1;i>=0;i--){ const p=PART[i]; p.t-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=400*dt; if(p.t<=0) PART.splice(i,1); } TEMBLOR=Math.max(0,TEMBLOR-dt*30); }
function dibujarParticulas(){ for(const p of PART){ g.globalAlpha=Math.max(0,Math.min(1,p.t*2)); g.fillStyle=p.color; g.fillRect(p.x-3,p.y-3,6,6); } g.globalAlpha=1; }
// ---- utilidades
const choque=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const azar=(a,b)=>a+Math.random()*(b-a), limitar=(v,a,b)=>Math.max(a,Math.min(b,v));
// ---- estados, récord y pantallas
let estado='inicio', S=null;   // S = datos de la partida (los crea nuevaPartida)
let RECORD=+(localStorage.getItem('record_'+CONFIG.titulo)||0);
function empezar(){ S=nuevaPartida(); estado='jugando'; sonido('empezar',660,.15); }
function terminar(texto){ estado='fin'; S.textoFin=texto||'Fin de la partida'; if(S.puntos>RECORD){ RECORD=S.puntos; localStorage.setItem('record_'+CONFIG.titulo,RECORD); } sonido('fin',160,.5,'sawtooth'); temblar(10); }
document.addEventListener('visibilitychange',()=>{ if(document.hidden&&estado==='jugando') estado='pausa'; });
function pantalla(titulo,lineas,boton){ g.fillStyle='rgba(0,0,0,.6)'; g.fillRect(0,0,W,H); g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle';
  g.font='bold '+Math.round(W/14)+'px system-ui'; g.fillText(titulo,W/2,H*.32); g.font=Math.round(W/34)+'px system-ui'; lineas.forEach((l,i)=>g.fillText(l,W/2,H*.45+i*W/26));
  if(boton){ const bw=W*.34, bh=W/12; g.fillStyle=CONFIG.colores.boton||'#ffcc33'; g.fillRect(W/2-bw/2,H*.7-bh/2,bw,bh); g.fillStyle='#222'; g.font='bold '+Math.round(W/28)+'px system-ui'; g.fillText(boton,W/2,H*.7); } }
function hud(){ g.fillStyle='rgba(0,0,0,.35)'; g.fillRect(0,0,W,40); g.fillStyle='#fff'; g.font='bold 20px system-ui'; g.textAlign='left'; g.textBaseline='middle';
  g.fillText('Puntos: '+Math.floor(S.puntos),14,20); if(S.vidas!=null) g.fillText('Vidas: '+S.vidas,W*.42,20); g.textAlign='right'; g.fillText('Récord: '+Math.floor(Math.max(RECORD,S.puntos)),W-14,20); }
// ---- bucle de paso fijo
let ult=performance.now(), acum=0; const PASO=1/60;
function bucle(t){ const dt=Math.min(.1,(t-ult)/1000); ult=t; mando();
  if(estado==='inicio'||estado==='fin'){ if(recien('Enter')||recien('Space')||recien('Tap')) empezar(); }
  else if(estado==='pausa'){ if(recien('Enter')||recien('Space')||recien('Tap')||recien('KeyP')||recien('Escape')) estado='jugando'; }
  else if(recien('KeyP')||recien('Escape')) estado='pausa';
  if(estado==='jugando'){ acum+=dt; while(acum>=PASO&&estado==='jugando'){ update(PASO); actualizarParticulas(PASO); acum-=PASO; } } else acum=0;
  for(const k in KP) KP[k]=false;
  g.setTransform(1,0,0,1,0,0); g.fillStyle='#000'; g.fillRect(0,0,cv.width,cv.height);
  const tx=TEMBLOR?azar(-TEMBLOR,TEMBLOR):0, ty=TEMBLOR?azar(-TEMBLOR,TEMBLOR):0;
  g.setTransform(ESC,0,0,ESC,OX+tx*ESC,OY+ty*ESC); g.save(); g.beginPath(); g.rect(0,0,W,H); g.clip();
  if(S) draw(); else { g.fillStyle=CONFIG.colores.fondo||'#123'; g.fillRect(0,0,W,H); }
  dibujarParticulas(); if(S&&estado!=='inicio') hud();
  if(estado==='inicio') pantalla(CONFIG.titulo,CONFIG.instrucciones||[],'JUGAR');
  else if(estado==='pausa') pantalla('Pausa',['Pulsa para seguir'],'SEGUIR');
  else if(estado==='fin') pantalla(S.textoFin||'Fin',['Puntos: '+Math.floor(S.puntos),'Récord: '+Math.floor(RECORD)],'OTRA VEZ');
  g.restore();
  window.__juego={estado,puntos:S?Math.floor(S.puntos):0,vidas:S&&S.vidas!=null?S.vidas:null,jugador:S&&S.jugador?{x:S.jugador.x,y:S.jugador.y}:{x:0,y:0},mundo:{ancho:W,alto:H}};
  requestAnimationFrame(bucle); }
S=nuevaPartida(); requestAnimationFrame(bucle);
