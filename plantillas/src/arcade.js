// ===================== CONFIGURACIÓN (cámbialo para cada juego) =====================
// Plantilla ARCADE de Rocket Jam: el jugador se mueve abajo, caen cosas buenas (puntos) y malas (quitan vida).
const CONFIG={
  titulo:'Lluvia de oro', ancho:540, alto:960,            // tamaño lógico (vertical, ideal para móvil)
  instrucciones:['Muévete con ← → , A D o los botones','Recoge lo bueno y esquiva lo malo'],
  vidas:3, velocidadJugador:560, tamJugador:{w:84,h:84},
  // lo que cae: tipo 'bueno' suma puntos, 'malo' quita una vida. Añade más tipos si quieres.
  objetos:[ {nombre:'bueno',tipo:'bueno',puntos:10,w:46,h:46,prob:.65}, {nombre:'malo',tipo:'malo',w:60,h:60,prob:.35} ],
  dificultad:{cadaInicial:.85, cadaMinimo:.22, caidaMin:240, caidaMax:560, subeCada:10},   // segundos entre objetos, velocidad de caída, cada cuántos segundos sube
  // IMÁGENES del juego (las hace el equipo). Si falta alguna, se ve un recuadro con su nombre.
  imagenes:{ /* fondo:'img/fondo.png', jugador:'img/jugador.png', bueno:'img/oro.png', malo:'img/roca.png' */ },
  sonidos:{ /* coger:'snd/coger.mp3', golpe:'snd/golpe.mp3' */ },
  colores:{fondo:'#1b1530',jugador:'#ff8a3d',bueno:'#ffd23f',malo:'#8a8aa0',boton:'#ffcc33'},
  tactil:[{k:'ArrowLeft',txt:'◄',estilo:'left:18px;bottom:26px'},{k:'ArrowRight',txt:'►',estilo:'left:108px;bottom:26px'}]
};
// ===================== LÓGICA DEL JUEGO =====================
function nuevaPartida(){ const tj=CONFIG.tamJugador; return {puntos:0,vidas:CONFIG.vidas,t:0,cada:CONFIG.dificultad.cadaInicial,proximo:.6,inv:0,
  jugador:{x:W/2-tj.w/2,y:H-tj.h-60,w:tj.w,h:tj.h,vx:0,mira:1}, cosas:[]}; }
function soltar(){ const r=Math.random(); let acc=0, o=CONFIG.objetos[0]; for(const x of CONFIG.objetos){ acc+=x.prob; if(r<=acc){ o=x; break; } }
  const d=CONFIG.dificultad, nivel=Math.min(1,S.t/(d.subeCada*8));
  S.cosas.push({...o,x:azar(10,W-o.w-10),y:-o.h,vy:azar(d.caidaMin,d.caidaMin+(d.caidaMax-d.caidaMin)*nivel+60),giro:0,vg:azar(-3,3)}); }
function update(dt){ const j=S.jugador, d=CONFIG.dificultad; S.t+=dt;
  // mover (con aceleración suave para que se sienta bien)
  const dir=(der()?1:0)-(izq()?1:0); j.vx+=(dir*CONFIG.velocidadJugador-j.vx)*Math.min(1,dt*14); j.x=limitar(j.x+j.vx*dt,0,W-j.w); if(dir) j.mira=dir;
  // dificultad: cada vez caen más y más rápido
  S.cada=Math.max(d.cadaMinimo,d.cadaInicial-Math.floor(S.t/d.subeCada)*.08);
  S.proximo-=dt; if(S.proximo<=0){ soltar(); S.proximo=S.cada*azar(.7,1.3); }
  if(S.inv>0) S.inv-=dt;
  for(let i=S.cosas.length-1;i>=0;i--){ const c=S.cosas[i]; c.y+=c.vy*dt; c.giro+=c.vg*dt;
    if(choque({x:j.x+10,y:j.y+10,w:j.w-20,h:j.h-14},c)){ S.cosas.splice(i,1);
      if(c.tipo==='bueno'){ S.puntos+=c.puntos||10; chispas(c.x+c.w/2,c.y+c.h/2,CONFIG.colores.bueno); sonido('coger',880,.08,'triangle'); }
      else if(S.inv<=0){ S.vidas--; S.inv=1.2; temblar(12); chispas(j.x+j.w/2,j.y+j.h/2,'#ff4d4d',18); sonido('golpe',120,.3,'sawtooth'); if(S.vidas<=0) return terminar('¡Te han dado!'); }
      continue; }
    if(c.y>H+20) S.cosas.splice(i,1); } }
function draw(){ const j=S.jugador;
  if(IMG.fondo) g.drawImage(IMG.fondo,0,0,W,H); else { g.fillStyle=CONFIG.colores.fondo; g.fillRect(0,0,W,H); }
  for(const c of S.cosas) dibujar(c.nombre,c.x,c.y,c.w,c.h,{giro:c.giro});
  if(!(S.inv>0&&Math.floor(S.inv*10)%2)) dibujar('jugador',j.x,j.y,j.w,j.h,{espejo:j.mira<0}); }
