// Animaciones automáticas de Rocket Jam / M.O.R.
// Pasa las animaciones de la biblioteca (Universal Animation Library de Quaternius, CC0)
// a cualquier personaje humanoide con esqueleto, sin depender de los nombres de los huesos:
// reconoce caderas, columna, cabeza, brazos y piernas por la forma del esqueleto.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// nombre en español → clip de la biblioteca
export const CATALOGO={
  quieto:'Idle_Loop', andar:'Walk_Loop', correr:'Jog_Fwd_Loop', esprintar:'Sprint_Loop',
  saltar:'Jump_Loop', saltar_inicio:'Jump_Start', aterrizar:'Jump_Land',
  atacar:'Punch_Jab', atacar2:'Punch_Cross', espada:'Sword_Attack', espada_quieto:'Sword_Idle',
  golpe:'Hit_Chest', golpe_cabeza:'Hit_Head', morir:'Death01', bailar:'Dance_Loop',
  agacharse:'Crouch_Idle_Loop', andar_agachado:'Crouch_Fwd_Loop', rodar:'Roll',
  disparar:'Pistol_Shoot', apuntar:'Pistol_Idle_Loop', recargar:'Pistol_Reload',
  hechizo:'Spell_Simple_Shoot', hechizo_quieto:'Spell_Simple_Idle_Loop',
  nadar:'Swim_Fwd_Loop', flotar:'Swim_Idle_Loop', coger:'PickUp_Table', usar:'Interact',
  empujar:'Push_Loop', sentarse:'Sitting_Enter', sentado:'Sitting_Idle_Loop'
};
export const BASICAS=['quieto','andar','correr','saltar','atacar','golpe','morir','bailar'];
// para no tapar animaciones buenas que ya traiga el modelo
const PROPIAS={quieto:/idle|quieto|stand|breath/i,andar:/walk|andar|caminar/i,correr:/run|jog|correr/i,saltar:/jump|saltar/i,atacar:/attack|punch|atac|slash/i,morir:/death|die|morir/i,bailar:/danc|bail/i};

const V=()=>new THREE.Vector3(), Q=()=>new THREE.Quaternion();
const cargar=buf=>new Promise((ok,ko)=>new GLTFLoader().parse(buf,'',ok,ko));

// ---------- reconocer el esqueleto por su forma ----------
export function mapear(root){
  root.updateMatrixWorld(true);
  const bones=[]; root.traverse(o=>{ if(o.isBone) bones.push(o); });
  if(bones.length<10) return null;
  const P=new Map(bones.map(b=>[b,b.getWorldPosition(V())]));
  const kids=b=>b.children.filter(c=>c.isBone);
  const subM=new Map(), sub=b=>{ if(subM.has(b)) return subM.get(b); const s=[b]; kids(b).forEach(c=>s.push(...sub(c))); subM.set(b,s); return s; };
  const ys=bones.map(b=>P.get(b).y), minY=Math.min(...ys), maxY=Math.max(...ys), H=maxY-minY; if(!(H>0)) return null;
  const ext=b=>{ let lo=1e9,hi=-1e9; sub(b).forEach(x=>{ const y=P.get(x).y; lo=Math.min(lo,y); hi=Math.max(hi,y); }); return {lo,hi}; };
  const orden=[], cola=bones.filter(b=>!b.parent||!b.parent.isBone); while(cola.length){ const b=cola.shift(); orden.push(b); cola.push(...kids(b)); }
  const cadena=b=>{ const c=[b]; let x=b; while(kids(x).length){ x=kids(x).reduce((a,k)=>sub(k).length>sub(a).length?k:a); c.push(x); } return c; };
  // caderas: de ellas (o de la raíz) cuelgan dos piernas y sube la columna
  let base=null, piernas=[], arriba=null;
  for(const b of orden){ const y=P.get(b).y, dn=[], up=[];
    kids(b).forEach(c=>{ const e=ext(c), yc=P.get(c).y; if(e.lo<minY+.15*H&&yc>minY+.3*H) dn.push(c); else if(e.hi>y+.2*H) up.push(c); });
    if(dn.length>=2&&up.length>=1){ base=b; piernas=dn.sort((a,c)=>sub(c).length-sub(a).length).slice(0,2); arriba=up.reduce((a,c)=>sub(c).length>sub(a).length?c:a); break; } }
  if(!base) return null;
  // si las piernas salen de una raíz en el suelo, las caderas son el primer hueso de la columna
  const yT=(P.get(piernas[0]).y+P.get(piernas[1]).y)/2, sep=P.get(base).y<yT-.2*H&&Math.abs(P.get(arriba).y-yT)<.15*H;
  const hips=sep?arriba:base, mover=base;
  const sigue=b=>kids(b).length?kids(b).reduce((a,k)=>sub(k).length>sub(a).length?k:a):null;
  // columna hasta el pecho (de donde salen cuello y brazos)
  const spine=[]; let x=sep?sigue(arriba):arriba;
  while(x){ spine.push(x); const g=kids(x).filter(c=>sub(c).length>=2); if(g.length>=3) break; x=sigue(x); }
  const chest=spine[spine.length-1]; if(!chest) return null; const pc=P.get(chest);
  const salidas=kids(chest).filter(c=>sub(c).length>=2);
  const lado=c=>{ let m=0; sub(c).forEach(z=>m=Math.max(m,Math.hypot(P.get(z).x-pc.x,P.get(z).z-pc.z))); return m; };
  const brazos=salidas.filter(c=>lado(c)>.15*H).sort((a,c)=>lado(c)-lado(a)).slice(0,2);
  const cuelloR=salidas.filter(c=>!brazos.includes(c)).reduce((a,c)=>!a||ext(c).hi>ext(a).hi?c:a,null);
  if(brazos.length<2||!cuelloR) return null;
  // piernas
  const pierna=raiz=>{ const c=cadena(raiz); const fi=c.findIndex(b=>P.get(b).y<minY+.1*H); const fIdx=fi>0?fi:Math.max(1,c.length-2);
    const foot=c[fIdx], yt=P.get(c[0]).y, yf=P.get(foot).y; let shin=c[Math.max(1,Math.min(fIdx-1,1))], best=1e9;
    for(let i=1;i<fIdx;i++){ const d=Math.abs(P.get(c[i]).y-(yt+yf)/2); if(d<best){ best=d; shin=c[i]; } }
    return {thigh:c[0],shin,foot,toe:c[fIdx+1]&&kids(foot).length?c[fIdx+1]:null}; };
  const L1=pierna(piernas[0]), L2=pierna(piernas[1]);
  // hacia dónde mira: de talón a punta del pie
  const fw=V(); [L1,L2].forEach(l=>{ if(l.toe) fw.add(V().subVectors(P.get(l.toe),P.get(l.foot))); }); fw.y=0;
  if(fw.lengthSq()<1e-8) fw.set(0,0,1); fw.normalize();
  const izq=V().crossVectors(new THREE.Vector3(0,1,0),fw); const ph=P.get(hips);
  const esIzq=b=>V().subVectors(P.get(b),ph).dot(izq)>0;
  const brazo=raiz=>{ const c=cadena(raiz); let hi=c.findIndex(b=>kids(b).length>=3); if(hi<2) hi=c.length>=4?3:c.length-1;
    const hand=c[hi], fore=hand.parent&&hand.parent.isBone?hand.parent:c[hi-1], upper=fore.parent&&fore.parent.isBone?fore.parent:c[hi-2];
    return {clav:upper.parent!==chest&&upper.parent&&upper.parent.isBone?upper.parent:null,upper,fore,hand}; };
  const A1=brazo(brazos[0]), A2=brazo(brazos[1]);
  const cu=cadena(cuelloR); const last=cu[cu.length-1]; const head=cu.length>=3&&!kids(last).length?cu[cu.length-2]:last;
  const neck=head!==cu[0]?cu[0]:null;
  const [Li,Ld]=esIzq(L1.thigh)?[L1,L2]:[L2,L1], [Ai,Ad]=esIzq(A1.upper)?[A1,A2]:[A2,A1];
  if(!Li.foot||!Ld.foot||!Ai.hand||!Ad.hand) return null;
  return {hips,mover,spine,neck,head,Li,Ld,Ai,Ad,fw,H,minY};
}

function lista(m,ns){ // ns = nº de huesos de columna de la otra parte (para emparejar)
  const out={}, put=(n,b,nx,pa)=>{ if(b) out[n]={b,nx,pa}; };
  put('hips',m.hips,m.spine[m.spine.length-1],null);
  const sp=m.spine; for(let i=0;i<sp.length;i++) put('spine'+i,sp[i],sp[i+1]||m.neck||m.head,i?'spine'+(i-1):'hips');
  put('neck',m.neck,m.head,'spine'+(sp.length-1)); put('head',m.head,null,m.neck?'neck':'spine'+(sp.length-1));
  for(const [s,L,A] of [['L',m.Li,m.Ai],['R',m.Ld,m.Ad]]){
    put('thigh'+s,L.thigh,L.shin,'hips'); put('shin'+s,L.shin,L.foot,'thigh'+s); put('foot'+s,L.foot,L.toe,'shin'+s); put('toe'+s,L.toe,null,'foot'+s);
    put('clav'+s,A.clav,A.upper,'spine'+(sp.length-1)); put('upper'+s,A.upper,A.fore,A.clav?'clav'+s:'spine'+(sp.length-1)); put('fore'+s,A.fore,A.hand,'upper'+s); put('hand'+s,A.hand,null,'fore'+s); }
  return out; }

// ---------- pasar un clip del esqueleto fuente al destino ----------
function preparar(src,dst){
  const ms=mapear(src.scene), md=mapear(dst.scene); if(!ms||!md) return null;
  const Ls=lista(ms), Ld0=lista(md);
  // columna: emparejar por proporción (primero con primero, pecho con pecho)
  const ns=ms.spine.length, nd=md.spine.length, par={};
  for(const k of Object.keys(Ld0)){ if(k.startsWith('spine')) continue; if(Ls[k]) par[k]=k; }
  for(let i=0;i<nd;i++) par['spine'+i]='spine'+(nd===1?ns-1:Math.round(i*(ns-1)/(nd-1)));
  // giro para que ambos miren al mismo lado (se trabaja en el marco del destino)
  const Rf=Q().setFromUnitVectors(md.fw,ms.fw), Rfi=Rf.clone().invert();
  const wq=b=>b.getWorldQuaternion(Q()), wp=b=>b.getWorldPosition(V());
  const D={};
  for(const [k,sk] of Object.entries(par)){ const d=Ld0[k], s=Ls[sk]; if(!d||!s) continue;
    let R=Q();
    if(d.nx&&s.nx){ const dd=V().subVectors(wp(d.nx),wp(d.b)).applyQuaternion(Rf).normalize(), ds=V().subVectors(wp(s.nx),wp(s.b)).normalize(); if(dd.lengthSq()>.5&&ds.lengthSq()>.5) R.setFromUnitVectors(dd,ds); }
    D[k]={d:d.b,s:s.b,pa:d.pa,R,qs0:wq(s.b),qd0:wq(d.b)}; }
  // los que no tienen dirección (manos, cabeza, pies) heredan la corrección de su padre
  const orden=Object.keys(D).sort((a,b)=>prof(md,D[a].d)-prof(md,D[b].d));
  for(const k of orden){ const x=D[k]; if(!Ld0[k].nx&&x.pa&&D[x.pa]) x.R=D[x.pa].R.clone(); }
  const huesosD=[]; dst.scene.traverse(o=>{ if(o.isBone) huesosD.push(o); });
  const porHueso=new Map(Object.values(D).map(x=>[x.d,x]));
  const restLocal=new Map(huesosD.map(b=>[b,b.quaternion.clone()]));
  const pariente=new Map(huesosD.map(b=>[b,b.parent&&b.parent.isBone?null:(b.parent?wq(b.parent):Q())]));
  const huesosS=[]; src.scene.traverse(o=>{ if(o.isBone) huesosS.push(o); });
  const restS=new Map(huesosS.map(b=>[b,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));
  const altS=wp(ms.hips).y-ms.minY, altD=wp(md.hips).y-md.minY, k=altS>0?altD/altS:1;
  const hs0=wp(ms.mover), hd0=wp(md.mover), hdPadreInv=md.mover.parent?md.mover.parent.matrixWorld.clone().invert():new THREE.Matrix4();
  return {D,porHueso,huesosD,restLocal,pariente,restS,Rf,Rfi,k,hs0,hd0,hdPadreInv,src,md,ms};
}
function prof(m,b){ let n=0; while(b&&b.parent){ n++; b=b.parent; } return n; }

function retarget(ctx,clip,nombre,fps=30){
  const {D,porHueso,huesosD,restLocal,pariente,restS,Rf,Rfi,k,hs0,hd0,hdPadreInv,src,md,ms}=ctx;
  restS.forEach((v,b)=>{ b.position.copy(v.p); b.quaternion.copy(v.q); b.scale.copy(v.s); });
  const mixer=new THREE.AnimationMixer(src.scene), act=mixer.clipAction(clip); act.play();
  const n=Math.max(2,Math.round(clip.duration*fps)+1), times=new Float32Array(n);
  const vals=new Map(huesosD.filter(b=>porHueso.has(b)).map(b=>[b,new Float32Array(n*4)])), posH=new Float32Array(n*3);
  const W=new Map(), q=Q(), tmp=Q();
  for(let i=0;i<n;i++){ const t=Math.min(clip.duration,i/fps); times[i]=t; mixer.setTime(t); src.scene.updateMatrixWorld(true);
    W.clear();
    for(const b of huesosD){ const pw=b.parent&&b.parent.isBone?W.get(b.parent):pariente.get(b); const x=porHueso.get(b);
      if(x){ // mundo = Rf⁻¹ · Δ · R · Rf · resto   (Δ = fuente ahora · fuente en reposo⁻¹)
        const delta=x.s.getWorldQuaternion(Q()).multiply(tmp.copy(x.qs0).invert());
        q.copy(Rfi).multiply(delta).multiply(x.R).multiply(Rf).multiply(x.qd0); W.set(b,q.clone());
        const loc=Q().copy(pw).invert().multiply(q), a=vals.get(b);
        if(i){ const o=(i-1)*4; if(a[o]*loc.x+a[o+1]*loc.y+a[o+2]*loc.z+a[o+3]*loc.w<0){ loc.x*=-1; loc.y*=-1; loc.z*=-1; loc.w*=-1; } }
        a.set([loc.x,loc.y,loc.z,loc.w],i*4); }
      else W.set(b,Q().copy(pw).multiply(restLocal.get(b))); }
    const dp=ms.mover.getWorldPosition(V()).sub(hs0).applyQuaternion(Rfi).multiplyScalar(k), p=hd0.clone().add(dp).applyMatrix4(hdPadreInv); posH.set([p.x,p.y,p.z],i*3); }
  act.stop(); mixer.uncacheRoot(src.scene);
  const tracks=[...vals].map(([b,a])=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,a));
  tracks.push(new THREE.VectorKeyframeTrack(md.mover.name+'.position',times,posH));
  return new THREE.AnimationClip(nombre,clip.duration,tracks);
}

let LIB=null;
async function biblioteca(url){ if(!LIB) LIB=fetch(url).then(r=>{ if(!r.ok) throw new Error('No encuentro la biblioteca de animaciones'); return r.arrayBuffer(); }).then(cargar); return LIB; }

// glb: ArrayBuffer del personaje (o null = maniquí de Rocket Jam). quiero: nombres del CATALOGO.
export async function animar({glb=null,quiero=BASICAS,color=null,lib,forzar=false}={}){
  const src=await biblioteca(lib);
  const pedidas=[...new Set(quiero.filter(n=>CATALOGO[n]))];
  const clipDe=n=>src.animations.find(c=>c.name===CATALOGO[n]);
  let dst, maniqui=false;
  if(!glb){ maniqui=true; const sc=SkeletonUtils.clone(src.scene); dst={scene:sc,animations:[]};
    sc.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); if(color!=null) o.material.color.set(color); } }); }
  else dst=await cargar(glb);
  const propias=dst.animations||[];
  const faltan=pedidas.filter(n=>forzar||!PROPIAS[n]||!propias.some(c=>PROPIAS[n].test(c.name)));
  let nuevas=[];
  if(maniqui) nuevas=faltan.map(n=>{ const c=clipDe(n).clone(); c.name=n; return c; });
  else if(faltan.length){ const ctx=preparar(src,dst); if(!ctx) return {error:'Este personaje no tiene un esqueleto humanoide reconocible (dos piernas, dos brazos y cabeza).'};
    nuevas=faltan.map(n=>retarget(ctx,clipDe(n),n)); }
  if(!nuevas.length) return {glb,clips:propias.map(c=>c.name),nuevas:[],maniqui};
  const todas=propias.concat(nuevas);
  dst.scene.updateMatrixWorld(true);
  const out=await new GLTFExporter().parseAsync(dst.scene,{binary:true,animations:todas,onlyVisible:true});
  return {glb:out,clips:todas.map(c=>c.name),nuevas:nuevas.map(c=>c.name),maniqui};
}

// "Aplicar transformaciones" como en Blender: deja la malla, el esqueleto y las animaciones en metros,
// sin escalas ni giros en los nodos padre (algunos motores, como ULTIMATE3D, los ignoran).
// Se trabaja con el esqueleto "efectivo" (lo que de verdad se ve): L · mundo del hueso,
// con L = mundo de la malla con piel · inversa de su matriz de enlace.
async function construir(glb){
  const g=await cargar(glb), root=g.scene; root.updateMatrixWorld(true);
  const bones=[]; root.traverse(o=>{ if(o.isBone) bones.push(o); });
  const boneSet=new Set(bones);
  const meshes=[]; root.traverse(o=>{ if(o.isMesh) meshes.push(o); });
  const piel=meshes.find(m=>m.isSkinnedMesh);
  const L=piel?piel.matrixWorld.clone().multiply(piel.bindMatrixInverse):new THREE.Matrix4();
  const efectiva=o=>o?L.clone().multiply(o.matrixWorld):L.clone();
  const info=new Map(bones.map(b=>{ const p=V(),q=Q(),s=V(); efectiva(b).decompose(p,q,s);
    const pm=b.parent&&boneSet.has(b.parent)?efectiva(b.parent):efectiva(b.parent); const pp=V(),pq=Q(),ps=V(); pm.decompose(pp,pq,ps);
    return [b,{p,q,s:s.x,pm,pq}]; }));
  const out=new THREE.Group(); out.name=root.name||'Modelo';
  for(const m of meshes){ const geo=m.geometry.clone(); let n;
    if(m.isSkinnedMesh){ n=new THREE.SkinnedMesh(geo,m.material); n.userData._orig=m; }
    else { geo.applyMatrix4(m.matrixWorld); n=new THREE.Mesh(geo,m.material); let h=m.parent; while(h&&!h.isBone) h=h.parent; n.userData._hueso=h||null; }
    n.name=m.name; out.add(n); }
  const nuevos=new Map(bones.map(b=>{ const nb=new THREE.Bone(); nb.name=b.name; return [b,nb]; }));
  for(const b of bones){ const nb=nuevos.get(b), I=info.get(b);
    if(b.parent&&boneSet.has(b.parent)){ nuevos.get(b.parent).add(nb); const P=info.get(b.parent); nb.position.copy(I.p).sub(P.p).applyQuaternion(P.q.clone().invert()); nb.quaternion.copy(P.q.clone().invert().multiply(I.q)); }
    else { out.add(nb); nb.position.copy(I.p); nb.quaternion.copy(I.q); } }
  out.updateMatrixWorld(true);
  for(const n of out.children.filter(c=>c.isSkinnedMesh)){ const o=n.userData._orig; const ob=o.skeleton.bones;
    // se conserva la pose en la que se modeló la malla: Binv' = S · Binv · enlace
    const inv=ob.map((b,i)=>{ const k=(info.get(b)||{s:1}).s; return new THREE.Matrix4().makeScale(k,k,k).multiply(o.skeleton.boneInverses[i]).multiply(o.bindMatrix); });
    n.bind(new THREE.Skeleton(ob.map(b=>nuevos.get(b)),inv),new THREE.Matrix4()); delete n.userData._orig; }
  // animaciones: pasar cada pista al nuevo espacio
  const porNombre=new Map(bones.map(b=>[b.name,b]));
  const clips=(g.animations||[]).map(clip=>{ const tracks=[];
    for(const t of clip.tracks){ const k=t.name.lastIndexOf('.'), nodo=t.name.slice(0,k), prop=t.name.slice(k+1); const b=porNombre.get(nodo); if(!b||prop==='scale') continue;
      const I=info.get(b), raiz=!(b.parent&&boneSet.has(b.parent)), v=t.values.slice();
      if(prop==='position'){ const P=raiz?null:info.get(b.parent), M=raiz?I.pm:efectiva(b.parent), qi=raiz?null:P.q.clone().invert();
        for(let i=0;i<v.length;i+=3){ const p=V(v[i],v[i+1],v[i+2]).applyMatrix4(M); if(!raiz) p.sub(P.p).applyQuaternion(qi); v[i]=p.x; v[i+1]=p.y; v[i+2]=p.z; }
        tracks.push(new THREE.VectorKeyframeTrack(nodo+'.position',t.times,v)); }
      else if(prop==='quaternion'){ if(raiz) for(let i=0;i<v.length;i+=4){ const q=Q().set(v[i],v[i+1],v[i+2],v[i+3]).premultiply(I.pq); v[i]=q.x; v[i+1]=q.y; v[i+2]=q.z; v[i+3]=q.w; }
        tracks.push(new THREE.QuaternionKeyframeTrack(nodo+'.quaternion',t.times,v)); } }
    return new THREE.AnimationClip(clip.name,clip.duration,tracks); });
  return {out,clips,nuevos};
}
export async function normalizar(glb){ const {out,clips}=await construir(glb); out.traverse(o=>{ if(o.userData){ delete o.userData._hueso; } });
  return await new GLTFExporter().parseAsync(out,{binary:true,animations:clips,onlyVisible:false}); }

// Versión para motores sencillos (ULTIMATE3D): UNA sola malla con piel, UN material,
// y el color de cada material y de su textura guardado en cada vértice.
function muestreador(){ const cache=new Map();
  return (mat,u,v)=>{ const c=new THREE.Color(1,1,1); if(mat&&mat.color) c.copy(mat.color);
    const map=mat&&mat.map, img=map&&map.image; if(!img||u==null) return c;
    let d=cache.get(map); if(d===undefined){ try{ const w=img.width,h=img.height, cv=document.createElement('canvas'); cv.width=Math.min(512,w); cv.height=Math.min(512,h); const x=cv.getContext('2d'); x.drawImage(img,0,0,cv.width,cv.height); d={w:cv.width,h:cv.height,px:x.getImageData(0,0,cv.width,cv.height).data}; }catch(e){ d=null; } cache.set(map,d); }
    if(!d) return c; const uv=new THREE.Vector2(u,v); try{ map.transformUv(uv); }catch(e){}
    const X=Math.min(d.w-1,Math.max(0,Math.floor(uv.x*d.w))), Y=Math.min(d.h-1,Math.max(0,Math.floor((map.flipY?1-uv.y:uv.y)*d.h))), k=(Y*d.w+X)*4;
    const t=new THREE.Color(); t.setRGB(d.px[k]/255,d.px[k+1]/255,d.px[k+2]/255,THREE.SRGBColorSpace); return c.multiply(t); }; }
export async function paraUnaMalla(glb){
  const {out,clips}=await construir(glb); out.updateMatrixWorld(true);
  const pieles=out.children.filter(c=>c.isSkinnedMesh); if(!pieles.length) return await normalizar(glb);
  const ref=pieles[0].skeleton, bones=ref.bones, IB=ref.boneInverses, idx=new Map(bones.map((b,i)=>[b,i]));
  const P=[],N=[],U=[],C=[],J=[],W=[],I=[]; const color=muestreador(); const v=V(), n=V();
  for(const m of out.children.filter(c=>c.isMesh)){ const g=m.geometry, pos=g.attributes.position, nor=g.attributes.normal, uv=g.attributes.uv, base=P.length/3;
    const grupos=g.groups&&g.groups.length?g.groups:[{start:0,count:g.index?g.index.count:pos.count,materialIndex:0}];
    for(let i=0;i<pos.count;i++){ v.fromBufferAttribute(pos,i); if(nor) n.fromBufferAttribute(nor,i); else n.set(0,1,0);
      let ji=[0,0,0,0], jw=[1,0,0,0];
      if(m.isSkinnedMesh){ const si=g.attributes.skinIndex, sw=g.attributes.skinWeight; const lb=m.skeleton.bones;
        ji=[si.getX(i),si.getY(i),si.getZ(i),si.getW(i)].map(k=>idx.get(lb[k])??0); jw=[sw.getX(i),sw.getY(i),sw.getZ(i),sw.getW(i)];
        // si su "enlace" no coincide con el de la referencia, se pasa con el hueso principal: v' = IB⁻¹ · mk · v
        const main=ji[jw.indexOf(Math.max(...jw))], mk=m.skeleton.boneInverses[lb.indexOf(bones[main])];
        if(mk&&!mk.equals(IB[main])){ const T=IB[main].clone().invert().multiply(mk); v.applyMatrix4(T); n.transformDirection(T); }
      } else { const h=m.userData._hueso; let bi=0; if(h){ const nb=[...bones].find(b=>b.name===h.name); if(nb) bi=idx.get(nb); }
        ji=[bi,0,0,0]; jw=[1,0,0,0]; const M=bones[bi].matrixWorld.clone().multiply(IB[bi]).invert(); v.applyMatrix4(M); n.transformDirection(M); }
      P.push(v.x,v.y,v.z); N.push(n.x,n.y,n.z); if(uv) U.push(uv.getX(i),uv.getY(i)); else U.push(0,0);
      const mat=Array.isArray(m.material)?(m.material[(grupos.find(q=>{ const t=g.index?null:i; return t!=null&&t>=q.start&&t<q.start+q.count; })||{materialIndex:0}).materialIndex]||m.material[0]):m.material;
      const c=color(mat,uv?uv.getX(i):null,uv?uv.getY(i):null); const sc={}; c.getRGB(sc,THREE.SRGBColorSpace); C.push(sc.r,sc.g,sc.b); /* en sRGB: los motores sencillos no convierten */ J.push(...ji); W.push(...jw); }
    if(g.index){ for(let k=0;k<g.index.count;k++) I.push(base+g.index.getX(k)); }
    else for(let k=0;k<pos.count;k++) I.push(base+k); }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); geo.setAttribute('normal',new THREE.Float32BufferAttribute(N,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(C,3)); geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(J,4)); geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(W,4)); geo.setIndex(I);
  const malla=new THREE.SkinnedMesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8})); malla.name='Personaje';
  const grupo=new THREE.Group(); grupo.name=out.name; out.children.filter(c=>c.isBone).forEach(b=>grupo.add(b)); grupo.add(malla); grupo.updateMatrixWorld(true);
  malla.bind(new THREE.Skeleton(bones,IB),new THREE.Matrix4());
  return await new GLTFExporter().parseAsync(grupo,{binary:true,animations:clips,onlyVisible:false}); }
