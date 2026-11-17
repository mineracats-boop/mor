// ===================== CONFIGURACIÓN (cámbialo para cada juego) =====================
// Plantilla VISTA DESDE ARRIBA de Rocket Jam: moverse en 8 direcciones, disparar, enemigos que persiguen,
// gemas que recoger y una salida que se abre al cogerlas todas.
const CONFIG={
  titulo:'Mina Prohibida', ancho:960, alto:540,
  instrucciones:['Flechas o WASD para moverte, Espacio para disparar','Coge todas las gemas y sal por la puerta'],
  vidas:3, casilla:48,
  jugador:{velocidad:300, tam:38, cadencia:.22, velBala:620},
  enemigos:{velocidad:115, vision:280, tam:38, vida:2, espera:2.5},   // espera: segundos de calma al empezar cada nivel
  // MAPAS: # muro  o gema  E enemigo  P salida del jugador  X puerta (se abre al coger todas las gemas)
  niveles:[
`####################
#P.......#........o#
#..o.....#.........#
#........#.....E...#
#....######...o....#
#..................#
#.......o..E..###..#
#.........E...#X#..#
#..o..........#.#..#
####################`,
`########################
#P....#.........o.....X#
#.....#..E.............#
#..o..#.......######...#
#.....#.......#....E...#
#.....######..#..o.....#
#..E..........#........#
#........o.......E..o..#
#...........E..........#
########################`],
  imagenes:{ /* suelo:'img/suelo.png', muro:'img/muro.png', jugador:'img/jugador.png', enemigo:'img/enemigo.png', gema:'img/gema.png', bala:'img/bala.png', puerta:'img/puerta.png' */ },
  sonidos:{},
  colores:{fondo:'#2a2f3a',suelo:'#3b4252',muro:'#1e222b',jugador:'#4fc3f7',enemigo:'#e5534b',gema:'#b388ff',bala:'#ffee58',puerta:'#66bb6a',boton:'#ffcc33'},
  tactil:[{k:'ArrowUp',txt:'▲',estilo:'left:90px;bottom:118px'},{k:'ArrowLeft',txt:'◄',estilo:'left:10px;bottom:46px'},{k:'ArrowRight',txt:'►',estilo:'left:170px;bottom:46px'},{k:'ArrowDown',txt:'▼',estilo:'left:90px;bottom:0px'},{k:'Space',txt:'●',estilo:'right:24px;bottom:40px'}]
};
// ===================== LÓGICA DEL JUEGO =====================
const C=CONFIG.casilla;
function cargarNivel(n){ const filas=CONFIG.niveles[n].split('\n'), L={mapa:filas.map(f=>f.split('')),ancho:filas[0].length*C,alto:filas.length*C,gemas:[],enemigos:[],puerta:null,salida:{x:C,y:C}};
  L.mapa.forEach((f,y)=>f.forEach((ch,x)=>{ const px=x*C, py=y*C, E=CONFIG.enemigos;
    if(ch==='o') L.gemas.push({x:px+C*.25,y:py+C*.25,w:C*.5,h:C*.5});
    if(ch==='E') L.enemigos.push({x:px+(C-E.tam)/2,y:py+(C-E.tam)/2,w:E.tam,h:E.tam,vida:E.vida,golpe:0,deambula:azar(0,6.28)});
    if(ch==='X') L.puerta={x:px,y:py,w:C,h:C};
    if(ch==='P') L.salida={x:px+(C-CONFIG.jugador.tam)/2,y:py+(C-CONFIG.jugador.tam)/2};
    if('oEPX'.includes(ch)) f[x]='.'; })); return L; }
const muro=(L,px,py)=>{ const x=Math.floor(px/C), y=Math.floor(py/C); return y<0||y>=L.mapa.length||x<0||x>=L.mapa[0].length||L.mapa[y][x]==='#'; };
const tocaMuro=(L,o)=>muro(L,o.x,o.y)||muro(L,o.x+o.w,o.y)||muro(L,o.x,o.y+o.h)||muro(L,o.x+o.w,o.y+o.h);
function mover(L,o,dx,dy){ o.x+=dx; if(tocaMuro(L,o)) o.x-=dx; o.y+=dy; if(tocaMuro(L,o)) o.y-=dy; }
function nuevaPartida(){ const S={puntos:0,vidas:CONFIG.vidas,nivel:0,inv:0,cam:{x:0,y:0},balas:[],recarga:0}; empezarNivel(S); return S; }
function empezarNivel(S){ S.L=cargarNivel(S.nivel); S.calma=CONFIG.enemigos.espera; S.inv=Math.max(S.inv||0,1.5); const t=CONFIG.jugador.tam; S.jugador={x:S.L.salida.x,y:S.L.salida.y,w:t,h:t,dx:1,dy:0}; S.balas=[]; }
function update(dt){ const j=S.jugador, L=S.L, J=CONFIG.jugador, E=CONFIG.enemigos;
  let dx=(der()?1:0)-(izq()?1:0), dy=(abj()?1:0)-(arr()?1:0); const l=Math.hypot(dx,dy);
  if(l){ dx/=l; dy/=l; j.dx=dx; j.dy=dy; mover(L,j,dx*J.velocidad*dt,dy*J.velocidad*dt); }
  S.recarga-=dt; if((tecla('Space')||tecla('KeyX'))&&S.recarga<=0){ S.recarga=J.cadencia; S.balas.push({x:j.x+j.w/2-6,y:j.y+j.h/2-6,w:12,h:12,vx:j.dx*J.velBala,vy:j.dy*J.velBala,t:1.2}); sonido('disparo',760,.06,'square',.05); }
  for(let i=S.balas.length-1;i>=0;i--){ const b=S.balas[i]; b.x+=b.vx*dt; b.y+=b.vy*dt; b.t-=dt; let fuera=b.t<=0||muro(L,b.x+6,b.y+6);
    for(const e of L.enemigos) if(!fuera&&e.vida>0&&choque(b,e)){ e.vida--; e.golpe=.15; fuera=true; chispas(b.x,b.y,'#fff',6,140); if(e.vida<=0){ S.puntos+=50; chispas(e.x+e.w/2,e.y+e.h/2,CONFIG.colores.enemigo,16); sonido('muere',200,.2,'sawtooth'); } }
    if(fuera) S.balas.splice(i,1); }
  if(S.calma>0) S.calma-=dt;
  for(const e of L.enemigos){ if(e.vida<=0||S.calma>0) continue; if(e.golpe>0) e.golpe-=dt;
    const ex=j.x-e.x, ey=j.y-e.y, d=Math.hypot(ex,ey)||1; let vx, vy;
    if(d<E.vision){ vx=ex/d; vy=ey/d; } else { e.deambula+=azar(-1,1)*dt*2; vx=Math.cos(e.deambula)*.5; vy=Math.sin(e.deambula)*.5; }
    mover(L,e,vx*E.velocidad*dt,vy*E.velocidad*dt);
    if(S.inv<=0&&choque(j,e)){ S.vidas--; S.inv=1.3; temblar(10); sonido('golpe',120,.3,'sawtooth'); if(S.vidas<=0) return terminar('¡Te han atrapado!'); } }
  if(S.inv>0) S.inv-=dt;
  for(let i=L.gemas.length-1;i>=0;i--) if(choque(j,L.gemas[i])){ const m=L.gemas.splice(i,1)[0]; S.puntos+=20; chispas(m.x+m.w/2,m.y+m.h/2,CONFIG.colores.gema,10); sonido('gema',1040,.08,'triangle'); }
  if(L.puerta&&!L.gemas.length&&choque(j,L.puerta)){ S.puntos+=200; sonido('meta',660,.4,'triangle');
    if(S.nivel+1<CONFIG.niveles.length){ S.nivel++; empezarNivel(S); } else return terminar('¡Has escapado!'); }
  S.cam.x+=(limitar(j.x-W/2,0,Math.max(0,L.ancho-W))-S.cam.x)*Math.min(1,dt*8); S.cam.y+=(limitar(j.y-H/2,0,Math.max(0,L.alto-H))-S.cam.y)*Math.min(1,dt*8); }
function draw(){ const L=S.L, j=S.jugador; g.fillStyle=CONFIG.colores.fondo; g.fillRect(0,0,W,H);
  g.save(); g.translate(-Math.round(S.cam.x),-Math.round(S.cam.y));
  L.mapa.forEach((f,y)=>f.forEach((ch,x)=>dibujar(ch==='#'?'muro':'suelo',x*C,y*C,C,C,{sinNombre:true})));
  if(L.puerta) dibujar('puerta',L.puerta.x,L.puerta.y,L.puerta.w,L.puerta.h,{alfa:L.gemas.length?.35:1});
  for(const m of L.gemas) dibujar('gema',m.x,m.y,m.w,m.h,{sinNombre:true});
  for(const e of L.enemigos) if(e.vida>0) dibujar('enemigo',e.x,e.y,e.w,e.h,{alfa:e.golpe>0?.5:1});
  for(const b of S.balas) dibujar('bala',b.x,b.y,b.w,b.h,{sinNombre:true});
  if(!(S.inv>0&&Math.floor(S.inv*10)%2)) dibujar('jugador',j.x,j.y,j.w,j.h,{giro:Math.atan2(j.dy,j.dx)});
  g.restore(); }
