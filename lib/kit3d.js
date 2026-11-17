// Kit de modelado de Rocket Jam / M.O.R.: herramientas de artista 3D para construir(THREE, K).
// Materiales con textura procedural, formas redondeadas y orgánicas, perfiles, tubos que se estrechan,
// extrusiones con bisel, ojos, simetría y repetición.
export function crearKit(THREE){
  const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  // ---------- texturas procedurales (canvas) ----------
  const cacheTex={};
  function lienzo(n,dib){ if(cacheTex[n]) return cacheTex[n]; const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d'); dib(g,256);
    const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return cacheTex[n]=t; }
  const rnd=(s=>()=>(s=(s*16807)%2147483647)/2147483647)(12345);
  function ruido(g,S,a=.18,n=2600,r=2){ for(let i=0;i<n;i++){ const c=rnd()<.5?0:255; g.fillStyle=`rgba(${c},${c},${c},${a*rnd()})`; g.fillRect(rnd()*S,rnd()*S,r*rnd()+1,r*rnd()+1); } }
  const PATRON={
    madera:(g,S)=>{ g.fillStyle='#fff'; g.fillRect(0,0,S,S); for(let i=0;i<46;i++){ g.strokeStyle=`rgba(0,0,0,${.05+.12*rnd()})`; g.lineWidth=1+rnd()*3; g.beginPath(); const y=rnd()*S; g.moveTo(0,y); for(let x=0;x<=S;x+=16) g.lineTo(x,y+Math.sin(x*.03+i)*4); g.stroke(); } },
    piedra:(g,S)=>{ g.fillStyle='#fff'; g.fillRect(0,0,S,S); ruido(g,S,.25,5000,4); for(let i=0;i<14;i++){ g.strokeStyle='rgba(0,0,0,.18)'; g.beginPath(); let x=rnd()*S,y=rnd()*S; g.moveTo(x,y); for(let k=0;k<6;k++){ x+=(rnd()-.5)*50; y+=(rnd()-.5)*50; g.lineTo(x,y); } g.stroke(); } },
    tela:(g,S)=>{ g.fillStyle='#fff'; g.fillRect(0,0,S,S); for(let i=0;i<S;i+=4){ g.fillStyle='rgba(0,0,0,.07)'; g.fillRect(i,0,2,S); g.fillRect(0,i,S,2); } ruido(g,S,.06); },
    metal:(g,S)=>{ g.fillStyle='#fff'; g.fillRect(0,0,S,S); for(let i=0;i<300;i++){ g.fillStyle=`rgba(0,0,0,${.03*rnd()})`; g.fillRect(0,rnd()*S,S,1); } },
    piel:(g,S)=>{ g.fillStyle='#fff'; g.fillRect(0,0,S,S); ruido(g,S,.05,3000,2); },
    hierba:(g,S)=>{ g.fillStyle='#fff'; g.fillRect(0,0,S,S); for(let i=0;i<1600;i++){ g.strokeStyle=`rgba(0,0,0,${.15*rnd()})`; const x=rnd()*S,y=rnd()*S; g.beginPath(); g.moveTo(x,y); g.lineTo(x+(rnd()-.5)*4,y-6-rnd()*6); g.stroke(); } },
    ladrillo:(g,S)=>{ g.fillStyle='#fff'; g.fillRect(0,0,S,S); g.fillStyle='rgba(0,0,0,.35)'; for(let y=0;y<S;y+=32){ g.fillRect(0,y,S,3); for(let x=(y/32)%2?0:32;x<S;x+=64) g.fillRect(x,y,3,32); } ruido(g,S,.12); },
    escamas:(g,S)=>{ g.fillStyle='#fff'; g.fillRect(0,0,S,S); g.strokeStyle='rgba(0,0,0,.22)'; g.lineWidth=2; for(let y=0;y<S+16;y+=16) for(let x=(y/16)%2?0:16;x<S+32;x+=32){ g.beginPath(); g.arc(x,y,16,0,Math.PI); g.stroke(); } }
  };
  const PRESET={ // tipo: [roughness, metalness, patrón, repetición]
    piel:[.75,0,'piel',2], madera:[.8,0,'madera',2], metal:[.35,.9,'metal',1], oro:[.25,1,'metal',1], plastico:[.45,0,null,1], tela:[.95,0,'tela',4],
    piedra:[.95,0,'piedra',2], cristal:[.05,0,null,1], goma:[.9,0,null,1], pelo:[.85,0,'tela',6], hoja:[.7,0,'hierba',2], hierba:[.95,0,'hierba',4],
    ladrillo:[.9,0,'ladrillo',2], escamas:[.6,.1,'escamas',3], brillo:[.2,0,null,1], mate:[1,0,null,1], emisivo:[.5,0,null,1] };
  const cacheMat={};
  function mat(tipo='plastico',color=0xcccccc,extra={}){ const k=tipo+'|'+color+'|'+JSON.stringify(extra); if(cacheMat[k]) return cacheMat[k];
    const [r,m,pat,rep]=PRESET[tipo]||PRESET.plastico; const o={color,roughness:r,metalness:m,...extra};
    if(pat){ const t=lienzo(pat,PATRON[pat]).clone(); t.needsUpdate=true; t.repeat.set(rep,rep); o.map=t; }
    if(tipo==='cristal'){ o.transparent=true; o.opacity=.45; }
    if(tipo==='emisivo'){ o.emissive=new THREE.Color(color); o.emissiveIntensity=1.5; }
    const M=new THREE.MeshStandardMaterial(o); M.name=tipo; return cacheMat[k]=M; }
  // ---------- piezas ----------
  function pieza(geo,material,pos=[0,0,0],rot=[0,0,0],nombre=''){ const m=new THREE.Mesh(geo,material||mat()); m.position.set(...pos); m.rotation.set(...rot); m.name=nombre; m.castShadow=m.receiveShadow=true; return m; }
  // caja con esquinas redondeadas (w,h,d, radio)
  function redondo(w,h,d,r=Math.min(w,h,d)*.15,seg=4){ r=Math.min(r,w/2-1e-4,h/2-1e-4); const s=new THREE.Shape(), x=-w/2+r, y=-h/2+r;
    s.moveTo(x,-h/2); s.lineTo(w/2-r,-h/2); s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r); s.lineTo(w/2,h/2-r); s.quadraticCurveTo(w/2,h/2,w/2-r,h/2); s.lineTo(-w/2+r,h/2); s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r); s.lineTo(-w/2,-h/2+r); s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    const b=Math.min(r,d/2-1e-4); const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(1e-4,d-2*b),bevelEnabled:true,bevelSize:b*.9,bevelThickness:b,bevelSegments:seg,curveSegments:seg*2}); g.center(); g.computeVertexNormals(); return g; }
  // pieza de revolución con perfil suave: puntos [[radio,altura],…] de abajo arriba
  function perfil(pts,seg=40){ const c=new THREE.SplineCurve(pts.map(([r,y])=>new THREE.Vector2(Math.max(0,r),y))); const L=c.getPoints(Math.max(24,pts.length*8)).map(p=>new THREE.Vector2(Math.max(0,p.x),p.y)); return new THREE.LatheGeometry(L,seg); }
  // tubo a lo largo de puntos, con grosor que cambia (radios: número o [inicio, fin] o función t→r)
  function tubo(pts,radios=.05,seg=64,lados=16,cerrar=true){ const cur=new THREE.CatmullRomCurve3(pts.map(p=>Array.isArray(p)?V(...p):p)); const fr=typeof radios==='function'?radios:Array.isArray(radios)?(t=>radios[0]+(radios[1]-radios[0])*t):(()=>radios);
    const g=new THREE.TubeGeometry(cur,seg,1,lados,false), P=g.attributes.position, F=cur.computeFrenetFrames(seg,false), v=V();
    for(let i=0;i<=seg;i++){ const c=cur.getPointAt(i/seg), r=fr(i/seg); for(let j=0;j<=lados;j++){ const k=i*(lados+1)+j; v.fromBufferAttribute(P,k).sub(c).multiplyScalar(r).add(c); P.setXYZ(k,v.x,v.y,v.z); } }
    g.computeVertexNormals();
    if(cerrar){ const grupo=new THREE.Group(); const ini=new THREE.SphereGeometry(fr(0),lados,8); ini.translate(...cur.getPointAt(0).toArray()); const fin=new THREE.SphereGeometry(fr(1),lados,8); fin.translate(...cur.getPointAt(1).toArray()); return unirGeo([g,ini,fin]); }
    return g; }
  // forma orgánica: superelipsoide (e=1 esfera; e<1 más cuadrada; e>1 más afilada) con algo de ruido
  function organico(rx,ry,rz,e1=1,e2=1,irregular=0,seg=40){ const g=new THREE.SphereGeometry(1,seg,Math.round(seg*.75)), P=g.attributes.position, v=V();
    const sp=(x,e)=>Math.sign(x)*Math.pow(Math.abs(x),e);
    for(let i=0;i<P.count;i++){ v.fromBufferAttribute(P,i); const th=Math.atan2(v.z,v.x), ph=Math.asin(Math.max(-1,Math.min(1,v.y)));
      let x=sp(Math.cos(ph),e1)*sp(Math.cos(th),e2), y=sp(Math.sin(ph),e1), z=sp(Math.cos(ph),e1)*sp(Math.sin(th),e2);
      const n=1+irregular*(Math.sin(v.x*7.1+v.y*3.3)*Math.cos(v.z*5.7-v.y*2.1)); P.setXYZ(i,x*rx*n,y*ry*n,z*rz*n); }
    g.computeVertexNormals(); return g; }
  // perfil 2D extruido con bisel: puntos [[x,y],…]
  function extruir(pts,fondo=.1,bisel=.01){ const s=new THREE.Shape(pts.map(([x,y])=>new THREE.Vector2(x,y))); const g=new THREE.ExtrudeGeometry(s,{depth:fondo,bevelEnabled:bisel>0,bevelSize:bisel,bevelThickness:bisel,bevelSegments:3,curveSegments:24}); g.translate(0,0,-fondo/2); g.computeVertexNormals(); return g; }
  // ojo completo (blanco, iris, pupila, brillo) mirando a +Z
  function ojo(r=.05,iris=0x3a7bd5){ const o=new THREE.Group(); o.name='ojo';
    o.add(pieza(new THREE.SphereGeometry(r,24,18),mat('brillo',0xffffff),[0,0,0],[0,0,0],'blanco'));
    o.add(pieza(new THREE.CircleGeometry(r*.55,24),mat('brillo',iris),[0,0,r*1.001],[0,0,0],'iris'));
    o.add(pieza(new THREE.CircleGeometry(r*.28,20),mat('brillo',0x050505),[0,0,r*1.003],[0,0,0],'pupila'));
    o.add(pieza(new THREE.CircleGeometry(r*.12,12),mat('emisivo',0xffffff),[r*.2,r*.22,r*1.005],[0,0,0],'brillo')); return o; }
  function unirGeo(L){ const gs=L.map(g=>g.index?g.toNonIndexed():g); const n=gs.reduce((s,g)=>s+g.attributes.position.count,0); const pos=new Float32Array(n*3), nor=new Float32Array(n*3), uv=new Float32Array(n*2); let o=0;
    for(const g of gs){ if(!g.attributes.normal) g.computeVertexNormals(); pos.set(g.attributes.position.array,o*3); nor.set(g.attributes.normal.array,o*3); if(g.attributes.uv) uv.set(g.attributes.uv.array,o*2); o+=g.attributes.position.count; }
    const r=new THREE.BufferGeometry(); r.setAttribute('position',new THREE.BufferAttribute(pos,3)); r.setAttribute('normal',new THREE.BufferAttribute(nor,3)); r.setAttribute('uv',new THREE.BufferAttribute(uv,2)); return r; }
  // simetría: fn(s) con s=1 (izquierda del personaje, +X) y s=-1 (derecha)
  function simetrico(fn,nombre='par'){ const g=new THREE.Group(); g.name=nombre; [1,-1].forEach(s=>{ const p=fn(s); if(p){ p.name=p.name||(s>0?'izq':'der'); g.add(p); } }); return g; }
  function repetir(n,fn,nombre='serie'){ const g=new THREE.Group(); g.name=nombre; for(let i=0;i<n;i++){ const p=fn(i,n); if(p) g.add(p); } return g; }
  function grupo(nombre,pos=[0,0,0],...hijos){ const g=new THREE.Group(); g.name=nombre; g.position.set(...pos); hijos.forEach(h=>h&&g.add(h)); return g; }
  return {mat,pieza,redondo,perfil,tubo,organico,extruir,ojo,simetrico,repetir,grupo,unirGeo,V,azar:rnd};
}
