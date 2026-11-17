// Esqueleto automático de Rocket Jam / M.O.R.
// Pone huesos a un personaje humanoide SIN esqueleto (de pie, mirando hacia delante, en pose T o A)
// y reparte el peso de cada vértice entre los huesos cercanos. Después se le pueden poner
// las animaciones automáticas (anim-auto.js) como a cualquier personaje con esqueleto.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const cargar=buf=>new Promise((ok,ko)=>new GLTFLoader().parse(buf,'',ok,ko));

function puntos(root){ const P=[]; root.updateMatrixWorld(true);
  root.traverse(o=>{ if(!o.isMesh||o.isSkinnedMesh) return; const a=o.geometry.attributes.position; const v=V(); const paso=Math.max(1,Math.floor(a.count/40000));
    for(let i=0;i<a.count;i+=paso){ v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld); P.push(v.clone()); } });
  return P; }

// distancia de un punto a un segmento
function dSeg(p,a,b){ const ab=V().subVectors(b,a), t=Math.max(0,Math.min(1,V().subVectors(p,a).dot(ab)/Math.max(1e-9,ab.lengthSq()))); return p.distanceTo(V().copy(a).addScaledVector(ab,t)); }

// colocar las articulaciones a partir de la forma de la malla
export function articulaciones(P){
  const bb=new THREE.Box3().setFromPoints(P), H=bb.max.y-bb.min.y, y0=bb.min.y; if(!(H>0)) throw new Error('El modelo no tiene altura');
  const cx=(bb.max.x+bb.min.x)/2;
  const banda=(a,b)=>P.filter(p=>p.y>=y0+a*H&&p.y<=y0+b*H);
  const media=(L,f)=>L.length?L.reduce((s,p)=>s+f(p),0)/L.length:0;
  // hacia dónde mira: los pies sobresalen hacia delante
  const pies=banda(0,.04), rod=banda(.25,.32), czT=media(banda(.3,.7),p=>p.z);
  const sentido=(pies.length&&rod.length&&media(pies,p=>p.z)<media(rod,p=>p.z)-.002*H)?-1:1;
  const cz=media(banda(.4,.6),p=>p.z)||czT;
  // piernas: separación en la banda de las rodillas
  const izqR=rod.filter(p=>p.x>cx), derR=rod.filter(p=>p.x<cx);
  const xi=izqR.length?media(izqR,p=>p.x):cx+.08*H, xd=derR.length?media(derR,p=>p.x):cx-.08*H;
  const pieI=pies.filter(p=>p.x>cx), pieD=pies.filter(p=>p.x<cx);
  const tob=(L,x)=>V(L.length?media(L,p=>p.x):x,y0+.045*H,cz);
  const punta=(L,x)=>{ const z=L.length?(sentido>0?Math.max(...L.map(p=>p.z)):Math.min(...L.map(p=>p.z))):cz+sentido*.08*H; return V(L.length?media(L,p=>p.x):x,y0+.01*H,cz+(z-cz)*.7); };
  // brazos: la mano es el punto más alejado del centro por encima de las caderas
  const alto=P.filter(p=>p.y>y0+.4*H);
  const lejos=s=>{ let m=null; for(const p of alto){ const d=(p.x-cx)*s; if(d>0&&(!m||d>m.d)) m={d,p}; } return m?m.p:V(cx+s*.4*H,y0+.55*H,cz); };
  const tipI=lejos(1), tipD=lejos(-1);
  // pose T: los brazos marcan la altura de los hombros (así un sombrero o el pelo no engañan)
  const tPose=Math.min(tipI.y,tipD.y)>y0+.6*H&&Math.abs(tipI.y-tipD.y)<.05*H;
  const hombroY=tPose?(tipI.y+tipD.y)/2:y0+.81*H, Hc=tPose?(hombroY-y0)/.82:H;   // Hc = altura del cuerpo sin sombrero
  const pecho=P.filter(p=>p.y>hombroY-.13*Hc&&p.y<hombroY-.06*Hc), ancho=pecho.length?Math.max(...pecho.map(p=>Math.abs(p.x-cx))):.12*Hc;
  const hombroX=tPose?Math.min(.14*Hc,Math.max(.06*Hc,ancho*.85)):.1*Hc;
  const J={hips:V(cx,y0+.53*Hc,cz), spine:V(cx,y0+.6*Hc,cz), spine1:V(cx,y0+.67*Hc,cz), spine2:V(cx,hombroY-.06*Hc,cz), neck:V(cx,hombroY+.03*Hc,cz), head:V(cx,hombroY+.08*Hc,cz), headTop:V(cx,Math.max(y0+H,hombroY+.2*Hc),cz)};
  for(const [s,tip,x] of [['L',tipI,xi],['R',tipD,xd]]){ const sg=s==='L'?1:-1;
    const sh=V(cx+sg*hombroX,hombroY,cz), cl=V(cx+sg*.035*Hc,hombroY-.01*Hc,cz), d=V().subVectors(tip,sh);
    J['clav'+s]=cl; J['arm'+s]=sh; J['fore'+s]=V().copy(sh).addScaledVector(d,.46); J['hand'+s]=V().copy(sh).addScaledVector(d,.82); J['handEnd'+s]=tip.clone();
    const pie=s==='L'?pieI:pieD, t=tob(pie,x);
    J['upLeg'+s]=V(cx+sg*Math.max(.05*Hc,Math.abs(x-cx)*.9),y0+.5*Hc,cz); J['foot'+s]=t; J['leg'+s]=V().lerpVectors(J['upLeg'+s],t,.5).setZ(cz+sentido*.01*H);
    J['toe'+s]=punta(pie,x); J['toeEnd'+s]=V(J['toe'+s].x,y0+.01*H,J['toe'+s].z+sentido*.04*H); }
  return {J,H:Hc,cx,cz,y0,sentido,tPose};
}

// jerarquía (nombres tipo Mixamo, así cualquier herramienta lo entiende)
const JER=[['Hips','hips',null],['Spine','spine','Hips'],['Spine1','spine1','Spine'],['Spine2','spine2','Spine1'],['Neck','neck','Spine2'],['Head','head','Neck'],['HeadTop_End','headTop','Head'],
  ...['L','R'].flatMap(s=>{ const n=s==='L'?'Left':'Right'; return [[n+'Shoulder','clav'+s,'Spine2'],[n+'Arm','arm'+s,n+'Shoulder'],[n+'ForeArm','fore'+s,n+'Arm'],[n+'Hand','hand'+s,n+'ForeArm'],[n+'HandEnd','handEnd'+s,n+'Hand'],
    [n+'UpLeg','upLeg'+s,'Hips'],[n+'Leg','leg'+s,n+'UpLeg'],[n+'Foot','foot'+s,n+'Leg'],[n+'ToeBase','toe'+s,n+'Foot'],[n+'Toe_End','toeEnd'+s,n+'ToeBase']]; })];

export async function riggear(glb){
  const g=await cargar(glb), root=g.scene; root.updateMatrixWorld(true);
  let ya=false; root.traverse(o=>{ if(o.isSkinnedMesh) ya=true; }); if(ya) throw new Error('Este modelo ya tiene esqueleto');
  const P=puntos(root); if(P.length<50) throw new Error('El modelo no tiene malla');
  const A=articulaciones(P), {J,H,cx}=A;
  // huesos
  const B={}, bones=[];
  for(const [n,k,pa] of JER){ const b=new THREE.Bone(); b.name=n; const w=J[k]; B[n]={b,w}; if(pa){ B[pa].b.add(b); b.position.subVectors(w,B[pa].w); } else b.position.copy(w); bones.push(b); }
  // segmentos que reciben peso (cada hueso hasta su hijo principal)
  const hijo={Hips:'Spine',Spine:'Spine1',Spine1:'Spine2',Spine2:'Neck',Neck:'Head',Head:'HeadTop_End'};
  for(const n of ['Left','Right']) Object.assign(hijo,{[n+'Shoulder']:n+'Arm',[n+'Arm']:n+'ForeArm',[n+'ForeArm']:n+'Hand',[n+'Hand']:n+'HandEnd',[n+'UpLeg']:n+'Leg',[n+'Leg']:n+'Foot',[n+'Foot']:n+'ToeBase',[n+'ToeBase']:n+'Toe_End'});
  const seg=Object.entries(hijo).map(([n,c])=>({i:bones.indexOf(B[n].b),a:B[n].w,b:B[c].w,lado:/^Left/.test(n)?1:/^Right/.test(n)?-1:0,pierna:/Leg|Foot|Toe/.test(n),brazo:/Arm|Hand|Shoulder/.test(n)}));
  // pesos: los 4 huesos más cercanos, con caída rápida; un lado no coge huesos del otro
  const out=new THREE.Group(); out.name='Personaje'; const arm=new THREE.Object3D(); arm.name='Armature'; out.add(arm); arm.add(B.Hips.b);
  const skel=new THREE.Skeleton(bones); const mallas=[]; root.traverse(o=>{ if(o.isMesh) mallas.push(o); });
  const yCad=J.hips.y, marg=.015*H;
  for(const m of mallas){ const geo=m.geometry.clone(); geo.applyMatrix4(m.matrixWorld); const pos=geo.attributes.position, n=pos.count;
    const si=new Uint16Array(n*4), sw=new Float32Array(n*4), p=V();
    for(let i=0;i<n;i++){ p.fromBufferAttribute(pos,i); const lado=p.x>cx+marg?1:p.x<cx-marg?-1:0; const L=[];
      for(const s of seg){ if(s.lado&&lado&&s.lado!==lado) continue; if(s.pierna&&p.y>yCad+.04*H) continue; if(s.brazo&&!s.lado) continue;
        const d=dSeg(p,s.a,s.b)/H+.002; L.push([s.i,1/Math.pow(d,4)]); }
      L.sort((a,b)=>b[1]-a[1]); const t=L.slice(0,4), sum=t.reduce((s,x)=>s+x[1],0)||1;
      t.forEach((x,k)=>{ si[i*4+k]=x[0]; sw[i*4+k]=x[1]/sum; }); }
    geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4)); geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
    const sm=new THREE.SkinnedMesh(geo,m.material); sm.name=m.name||'Malla'; sm.castShadow=true; arm.add(sm); }
  out.updateMatrixWorld(true); skel.calculateInverses(); out.traverse(o=>{ if(o.isSkinnedMesh) o.bind(skel,o.matrixWorld.clone()); });
  const res=await new GLTFExporter().parseAsync(out,{binary:true,onlyVisible:true});
  return {glb:res,huesos:bones.length,altura:+H.toFixed(2),pose:A.tPose?'T':'A',mira:A.sentido>0?'+Z':'-Z'};
}
