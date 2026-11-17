// ===================== CONFIGURACIÓN (cámbialo para cada juego) =====================
// Plantilla PLATAFORMAS 2D de Rocket Jam: correr, saltar, enemigos, monedas, pinchos y meta por niveles.
const CONFIG={
  titulo:'Salto Minero', ancho:960, alto:540,
  instrucciones:['← → para correr, ↑ o Espacio para saltar','Pisa a los enemigos y llega a la bandera'],
  vidas:3, casilla:48,
  fisica:{gravedad:2000, salto:820, velocidad:330, aceleracion:16, coyote:.1, recuerdaSalto:.12, rebote:520},
  // NIVELES: # suelo  o moneda  E enemigo  ^ pinchos  P salida del jugador  F meta (bandera)  (cada fila igual de larga)
  niveles:[
`..........................................................
..........................................................
..........................................................
.................ooo......................................
................#####.............ooo.....................
..........................E......#####..........ooo.....F.
.........ooo.........#########.................#####...##.
.......#######...............................E...........#
..P.......................^^^........E..........######....#
##########################################################`,
`..............................................................
....................................ooo.........................
...................ooo.............#####......................
..................#####........E.....................ooo......
..........ooo...............#######..............E...#####...F
........#######......E.......................#########......##
..P.........................^^^^.......................^^....#
##############################################################`],
  imagenes:{ /* fondo:'img/fondo.png', jugador:'img/jugador.png', suelo:'img/suelo.png', moneda:'img/moneda.png', enemigo:'img/enemigo.png', pinchos:'img/pinchos.png', meta:'img/bandera.png' */ },
  sonidos:{},
  colores:{fondo:'#7ec8ff',jugador:'#ff6b3d',suelo:'#7a4b2a',moneda:'#ffd23f',enemigo:'#5b3a8c',pinchos:'#cfd3dc',meta:'#2ecc71',boton:'#ffcc33'},
  tactil:[{k:'ArrowLeft',txt:'◄',estilo:'left:18px;bottom:26px'},{k:'ArrowRight',txt:'►',estilo:'left:108px;bottom:26px'},{k:'Space',txt:'▲',estilo:'right:24px;bottom:26px'}]
};
// ===================== LÓGICA DEL JUEGO =====================
const C=CONFIG.casilla;
function cargarNivel(n){ const filas=CONFIG.niveles[n].split('\n'), L={mapa:filas.map(f=>f.split('')),ancho:filas[0].length*C,alto:filas.length*C,monedas:[],enemigos:[],pinchos:[],meta:null,salida:{x:C,y:C}};
  L.mapa.forEach((f,y)=>f.forEach((ch,x)=>{ const px=x*C, py=y*C;
    if(ch==='o') L.monedas.push({x:px+C*.2,y:py+C*.2,w:C*.6,h:C*.6});
    if(ch==='E') L.enemigos.push({x:px+4,y:py+8,w:C-8,h:C-8,vx:-90,vy:0,vivo:true});
    if(ch==='^') L.pinchos.push({x:px+4,y:py+C*.5,w:C-8,h:C*.5});
    if(ch==='F') L.meta={x:px,y:py-C,w:C,h:C*2};
    if(ch==='P') L.salida={x:px+6,y:py};
    if('oE^FP'.includes(ch)) f[x]='.'; })); return L; }
const solido=(L,px,py)=>{ const x=Math.floor(px/C), y=Math.floor(py/C); if(x<0||x>=L.mapa[0].length) return true; if(y<0) return false; if(y>=L.mapa.length) return false; return L.mapa[y][x]==='#'; };
function nuevaPartida(){ const S={puntos:0,vidas:CONFIG.vidas,nivel:0,inv:0,cam:{x:0,y:0}}; empezarNivel(S); return S; }
function empezarNivel(S){ S.L=cargarNivel(S.nivel); S.jugador={x:S.L.salida.x,y:S.L.salida.y,w:C*.7,h:C*.95,vx:0,vy:0,suelo:false,coyote:0,buffer:0,mira:1}; }
function moverCaja(L,o,dt){ // eje X
  o.x+=o.vx*dt; if(o.vx>0&&(solido(L,o.x+o.w,o.y+2)||solido(L,o.x+o.w,o.y+o.h-2))){ o.x=Math.floor((o.x+o.w)/C)*C-o.w-.01; o.vx=0; o.chocaX=1; }
  else if(o.vx<0&&(solido(L,o.x,o.y+2)||solido(L,o.x,o.y+o.h-2))){ o.x=Math.floor(o.x/C+1)*C+.01; o.vx=0; o.chocaX=-1; } else o.chocaX=0;
  // eje Y
  o.vy+=CONFIG.fisica.gravedad*dt; o.y+=o.vy*dt; o.suelo=false;
  if(o.vy>0&&(solido(L,o.x+2,o.y+o.h)||solido(L,o.x+o.w-2,o.y+o.h))){ o.y=Math.floor((o.y+o.h)/C)*C-o.h-.01; o.vy=0; o.suelo=true; }
  else if(o.vy<0&&(solido(L,o.x+2,o.y)||solido(L,o.x+o.w-2,o.y))){ o.y=Math.floor(o.y/C+1)*C+.01; o.vy=0; } }
function perderVida(){ S.vidas--; temblar(10); sonido('golpe',120,.3,'sawtooth'); chispas(S.jugador.x+S.jugador.w/2,S.jugador.y+S.jugador.h/2,'#ff4d4d',18);
  if(S.vidas<=0) return terminar('¡Sin vidas!'); S.inv=1.2; const {x,y}=S.L.salida; Object.assign(S.jugador,{x,y,vx:0,vy:0}); }
function update(dt){ const j=S.jugador, F=CONFIG.fisica, L=S.L;
  const dir=(der()?1:0)-(izq()?1:0); j.vx+=(dir*F.velocidad-j.vx)*Math.min(1,dt*F.aceleracion); if(dir) j.mira=dir;
  if(recien('Space')||recien('ArrowUp')||recien('KeyW')) j.buffer=F.recuerdaSalto; else j.buffer-=dt;
  j.coyote=j.suelo?F.coyote:j.coyote-dt;
  if(j.buffer>0&&j.coyote>0){ j.vy=-F.salto; j.buffer=0; j.coyote=0; sonido('saltar',520,.12,'square'); }
  if(j.vy<0&&!(tecla('Space')||arr())) j.vy+=F.gravedad*dt*1.2;   // salto más corto si sueltas
  moverCaja(L,j,dt); if(S.inv>0) S.inv-=dt;
  if(j.y>L.alto+200) return perderVida();
  for(let i=L.monedas.length-1;i>=0;i--) if(choque(j,L.monedas[i])){ const m=L.monedas.splice(i,1)[0]; S.puntos+=10; chispas(m.x+m.w/2,m.y+m.h/2,CONFIG.colores.moneda,8); sonido('moneda',990,.07,'triangle'); }
  for(const e of L.enemigos){ if(!e.vivo) continue; e.vx=e.vx||-90; moverCaja(L,e,dt); if(e.chocaX) e.vx=-e.chocaX*90;
    const delante=e.vx>0?e.x+e.w+2:e.x-2; if(e.suelo&&!solido(L,delante,e.y+e.h+4)) e.vx=-e.vx;   // no se cae de las plataformas
    if(choque(j,e)){ if(j.vy>0&&j.y+j.h-e.y<20){ e.vivo=false; j.vy=-F.rebote; S.puntos+=50; chispas(e.x+e.w/2,e.y,'#fff',14); sonido('pisar',300,.15,'square'); } else if(S.inv<=0) return perderVida(); } }
  for(const p of L.pinchos) if(S.inv<=0&&choque(j,p)) return perderVida();
  if(L.meta&&choque(j,L.meta)){ S.puntos+=200; sonido('meta',660,.4,'triangle'); chispas(j.x,j.y,'#2ecc71',30);
    if(S.nivel+1<CONFIG.niveles.length){ S.nivel++; empezarNivel(S); } else return terminar('¡Has ganado!'); }
  // cámara que sigue al jugador
  S.cam.x+=(limitar(j.x-W*.4,0,Math.max(0,L.ancho-W))-S.cam.x)*Math.min(1,dt*8); S.cam.y+=(limitar(j.y-H*.55,0,Math.max(0,L.alto-H))-S.cam.y)*Math.min(1,dt*8); }
function draw(){ const L=S.L, j=S.jugador;
  if(IMG.fondo) g.drawImage(IMG.fondo,0,0,W,H); else { g.fillStyle=CONFIG.colores.fondo; g.fillRect(0,0,W,H); }
  g.save(); g.translate(-Math.round(S.cam.x),-Math.round(S.cam.y));
  const x0=Math.floor(S.cam.x/C), x1=Math.ceil((S.cam.x+W)/C);
  L.mapa.forEach((f,y)=>{ for(let x=Math.max(0,x0);x<Math.min(f.length,x1+1);x++) if(f[x]==='#') dibujar('suelo',x*C,y*C,C,C,{sinNombre:true}); });
  for(const p of L.pinchos) dibujar('pinchos',p.x,p.y,p.w,p.h,{sinNombre:true});
  for(const m of L.monedas) dibujar('moneda',m.x,m.y,m.w,m.h,{sinNombre:true});
  for(const e of L.enemigos) if(e.vivo) dibujar('enemigo',e.x,e.y,e.w,e.h,{espejo:e.vx>0});
  if(L.meta) dibujar('meta',L.meta.x,L.meta.y,L.meta.w,L.meta.h);
  if(!(S.inv>0&&Math.floor(S.inv*10)%2)) dibujar('jugador',j.x,j.y,j.w,j.h,{espejo:j.mira<0});
  g.restore(); }
