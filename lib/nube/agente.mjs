// M.O.R. en la nube (Rocket Jam): el modo agente trabajando en un ordenador de GitHub Actions,
// aunque el móvil esté apagado. Lee trabajos/ID/tarea.json, trabaja paso a paso y guarda el
// avance en trabajos/ID/estado.json (y los archivos en trabajos/ID/archivos/) con un commit en cada paso.
import fs from 'fs'; import path from 'path'; import {spawnSync, execSync} from 'child_process';

const ID=String(process.argv[2]||''); if(!/^[a-z0-9]{4,40}$/.test(ID)){ console.error('ID no válido'); process.exit(1); }
const KEY=process.env.GEMINI_API_KEY, BASE=process.env.GEMINI_URL||'https://generativelanguage.googleapis.com', SIN_GIT=!!process.env.SIN_GIT;
if(!KEY){ console.error('Falta el secreto GEMINI_API_KEY'); }
const DIR=path.join('trabajos',ID), EST=path.join(DIR,'estado.json'), ARCH=path.resolve(DIR,'archivos');
const T=JSON.parse(fs.readFileSync(path.join(DIR,'tarea.json'),'utf8')); fs.mkdirSync(ARCH,{recursive:true});
const MODELOS=T.modelos&&T.modelos.length?T.modelos:['gemini-3.5-flash','gemini-3-flash-preview','gemini-3.7-flash','gemini-flash-latest','gemini-3.5-flash-lite'];
const t0=Date.now(), LIMITE=(+process.env.LIMITE_MIN||100)*60000, MAX=+T.maxPasos||60;
let S=fs.existsSync(EST)?JSON.parse(fs.readFileSync(EST,'utf8')):{estado:'trabajando',H:[],T:[],paso:0,revisado:0,fuentes:[],acciones:[],memoria:[],log:[],inicio:Date.now()};
if(S.estado==='pregunta'&&T.respuesta&&T.respuestaN!==S.respuestaN){ S.H.push({a:'preguntar',o:'El humano responde: '+T.respuesta}); S.respuestaN=T.respuestaN; delete S.pregunta; }
S.estado='trabajando'; S.vivo=Date.now();

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=t=>{ console.log(t); S.log.push({t:String(t).slice(0,300),at:Date.now()}); S.log=S.log.slice(-80); };
function guardar(msg){ S.vivo=Date.now(); fs.writeFileSync(EST,JSON.stringify(S));
  if(SIN_GIT) return; for(let k=0;k<4;k++){ try{ execSync(`git add -A "${DIR}" && (git diff --cached --quiet || git commit -q -m ${JSON.stringify(('Mor: '+msg).slice(0,70))}) && git pull -q --rebase && git push -q`,{stdio:'pipe'}); return; }catch(e){ execSync('sleep 2'); } } }

async function gemini(body,ms=150000){ let ult='';
  for(const m of MODELOS) for(let intento=0;intento<3;intento++){
    try{ const ctl=new AbortController(), to=setTimeout(()=>ctl.abort(),ms);
      const r=await fetch(`${BASE}/v1beta/models/${m}:generateContent?key=${KEY}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:ctl.signal}); clearTimeout(to);
      if(r.status===429||r.status>=500){ ult=m+' '+r.status; await sleep(4000*(intento+1)); continue; }
      if(!r.ok){ ult=m+' '+r.status; break; }
      const j=await r.json(); const t=(j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join(''); if(t) return t; ult=m+' vacío'; break;
    }catch(e){ ult=m+' '+e.message; await sleep(2000); } }
  throw new Error('Ningún cerebro responde ('+ult+')'); }
const json=t=>JSON.parse(String(t).replace(/^```(json)?|```$/g,'').trim());

const seguro=r=>{ const p=path.resolve(ARCH,String(r||'').replace(/^\/+/,'')); if(!p.startsWith(ARCH)) throw new Error('ruta no permitida'); return p; };
const listar=(d=ARCH,b='')=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?listar(path.join(d,e.name),b+e.name+'/'):[b+e.name]);
async function leerWeb(u,max=14000){ const r=await fetch('https://r.jina.ai/'+u,{headers:{'X-Return-Format':'markdown'}}); if(!r.ok) throw new Error('lector '+r.status); return (await r.text()).replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\n{3,}/g,'\n\n').slice(0,max); }
async function buscar(q){ const t=await leerWeb('https://html.duckduckgo.com/html/?q='+encodeURIComponent(String(q).replace(/[¿?¡!]/g,'').trim()),9000);
  const out=[], vistos=new Set(), re=/\[([^\]]{3,200})\]\((https?:\/\/[^)\s]+)\)/g; let m;
  while((m=re.exec(t))&&out.length<10){ let u=m[2]; try{ const x=new URL(u); if(x.hostname.includes('duckduckgo')) u=decodeURIComponent(x.searchParams.get('uddg')||''); }catch(e){ continue; }
    if(!/^https?:/.test(u)||vistos.has(u)||/duckduckgo\.com/.test(u)) continue; vistos.add(u); const pos=m.index+m[0].length;
    out.push(`${out.length+1}. ${m[1].replace(/\*\*/g,'')}\n   ${u}\n   ${t.slice(pos,pos+260).replace(/\s+/g,' ').replace(/\[[^\]]*\]\([^)]*\)/g,'').trim()}`); }
  return out.length?out.join('\n'):'Sin resultados (prueba con otras palabras).'; }
function ejecutar(cmd,args,ms){ const r=spawnSync(cmd,args,{cwd:ARCH,timeout:ms,encoding:'utf8',maxBuffer:8e6}); return ((r.stdout||'')+(r.stderr?'\nERROR: '+r.stderr.split('\n').slice(-12).join('\n'):'')+(r.error?'\nERROR: '+(r.error.code==='ETIMEDOUT'?'tardó demasiado':r.error.message):'')).trim().slice(0,12000)||'(sin salida: usa console.log/print)'; }

async function herramienta(x,ctx){ switch(x.accion){
  case 'buscar_web': return await buscar(x.consulta||'');
  case 'leer_web':{ const t=await leerWeb(x.url||''); if(!S.fuentes.includes(x.url)) S.fuentes.push(x.url); return t; }
  case 'ejecutar_js':{ const f=path.join(ARCH,'.mor_tmp.mjs'); fs.writeFileSync(f,`const __r=await (async()=>{\n${x.codigo||''}\n})(); if(__r!==undefined) console.log('=> '+(typeof __r==='string'?__r:JSON.stringify(__r,null,1)));`); const o=ejecutar('node',[f],30000); fs.rmSync(f,{force:true}); return o; }
  case 'ejecutar_python':{ const f=path.join(ARCH,'.mor_tmp.py'); fs.writeFileSync(f,x.codigo||''); const o=ejecutar('python3',[f],300000); fs.rmSync(f,{force:true}); return o; }
  case 'listar_archivos':{ const L=listar().filter(n=>!n.startsWith('.mor_tmp')); return L.length?L.map(n=>`${n} (${fs.statSync(seguro(n)).size} bytes)`).join('\n'):'(no hay archivos todavía)'; }
  case 'leer_archivo':{ const p=seguro(x.ruta); return fs.existsSync(p)?fs.readFileSync(p,'utf8').slice(0,16000):'ERROR: no existe '+x.ruta; }
  case 'escribir_archivo':{ if(!x.ruta||x.contenido==null) return 'ERROR: faltan ruta o contenido'; const p=seguro(x.ruta); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,String(x.contenido)); return `Guardado ${x.ruta} (${String(x.contenido).length} caracteres).`; }
  case 'editar_archivo':{ const p=seguro(x.ruta); if(!fs.existsSync(p)) return 'ERROR: no existe '+x.ruta; const c=fs.readFileSync(p,'utf8'); const n=c.split(x.buscar||'\u0000').length-1; if(n!==1) return `ERROR: el texto a buscar aparece ${n} veces; tiene que aparecer exactamente 1.`; fs.writeFileSync(p,c.replace(x.buscar,()=>x.reemplazar||'')); return 'Hecho.'; }
  case 'memoria_leer':{ const k=Object.keys(T.memoria||{}).find(r=>r===x.ruta||r.endsWith(String(x.ruta||'').replace(/^\//,''))); return k?T.memoria[k]:'No existe. Archivos: '+Object.keys(T.memoria||{}).join(', '); }
  case 'memoria_guardar': if(!/recuerda|apunta|guarda|memoriza|no olvides|acuérdate/i.test(T.tarea)) return 'No: solo se guarda en la memoria cuando el humano lo pide expresamente.'; S.memoria.push({ruta:x.ruta,contenido:x.contenido}); return 'Se guardará en la memoria de Mor cuando abras la app.';
  case 'skill':{ const s=(T.skills||[]).find(s=>s.n.toLowerCase()===String(x.nombre||'').toLowerCase())||(T.skills||[]).find(s=>s.n.toLowerCase().includes(String(x.nombre||'').toLowerCase())); return s?`SKILL «${s.n}» (síguela):\n${s.instr}`:'No existe esa skill. Hay: '+(T.skills||[]).map(s=>s.n).join(', '); }
  case 'subagentes': return await subagentes(x.trabajos||[]);
  case 'funcion_mor':{ const e=String(x.etiqueta||'').replace(/^\{\{|\}\}$/g,'').trim(); if(!e) return 'ERROR: falta la etiqueta'; S.acciones.push(e); return 'Apuntado: Mor lo hará en el móvil la próxima vez que se abra («'+e.slice(0,80)+'»). Sigue con lo demás.'; }
  } return 'ERROR: acción desconocida'; }

async function subagentes(L){ L=L.slice(0,4);
  const uno=async t=>{ const H=[]; log('Subagente: '+t.titulo);
    for(let i=0;i<8;i++){ let x; try{ x=json(await gemini({systemInstruction:{parts:[{text:'Eres un subagente de M.O.R. Haces UN trabajo concreto y devuelves el resultado completo y con datos (y sus fuentes). Acciones: buscar_web {consulta}, leer_web {url}, ejecutar_js {codigo}, terminar {respuesta}. Nunca inventes datos.'}]},contents:[{role:'user',parts:[{text:`TU TRABAJO: ${t.titulo}\n${t.instrucciones}\n\nHECHO HASTA AHORA:\n${H.map((h,j)=>`[${j+1}] ${h.a}\n${h.o}`).join('\n\n')||'(nada)'}\n\n${i>=6?'Último paso: termina YA.':''}Siguiente acción (JSON):`}]}],generationConfig:{temperature:.2,responseMimeType:'application/json',responseSchema:T.schema}},90000)); }
      catch(e){ H.push({a:'(fallo)',o:'Responde solo con JSON válido.'}); continue; }
      if(x.accion==='terminar') return `### ${t.titulo}\n${x.respuesta||''}`;
      if(!['buscar_web','leer_web','ejecutar_js'].includes(x.accion)){ H.push({a:x.accion,o:'No disponible para subagentes.'}); continue; }
      let o; try{ o=await herramienta(x); }catch(e){ o='ERROR: '+e.message; } H.push({a:resumen(x),o:String(o).slice(0,5000)}); }
    return `### ${t.titulo}\n(no terminó; lo que encontró:)\n${H.map(h=>h.o.slice(0,800)).join('\n')}`; };
  const R=await Promise.all(L.map(uno)); return R.join('\n\n'); }

const resumen=x=>{ const a=x.accion; return a==='buscar_web'?'Buscando: '+x.consulta:a==='leer_web'?'Leyendo '+x.url:a==='ejecutar_js'?'Ejecutando JavaScript':a==='ejecutar_python'?'Ejecutando Python':a==='escribir_archivo'?'Escribiendo '+x.ruta:a==='editar_archivo'?'Editando '+x.ruta:a==='leer_archivo'?'Leyendo '+x.ruta:a==='subagentes'?'Repartiendo '+(x.trabajos||[]).length+' trabajos entre subagentes':a==='skill'?'Usando la skill '+x.nombre:a==='funcion_mor'?'Para hacer en el móvil: '+String(x.etiqueta||'').slice(0,60):a==='memoria_leer'?'Mirando la memoria: '+x.ruta:a; };

async function revisar(resp){ const arch=listar().filter(n=>!n.startsWith('.mor_tmp')).map(n=>`--- ${n} ---\n${fs.readFileSync(seguro(n),'utf8').slice(0,6000)}`).join('\n\n');
  try{ return json(await gemini({contents:[{role:'user',parts:[{text:`Eres un REVISOR independiente: no has hecho este trabajo. Compruébalo con ojo crítico antes de que se entregue.
PETICIÓN DEL HUMANO: ${T.tarea}
RESPUESTA QUE SE VA A ENTREGAR: ${resp}
ARCHIVOS: ${arch||'(ninguno)'}
FUENTES CONSULTADAS: ${S.fuentes.slice(0,15).join(', ')||'(ninguna)'}
Mira: ¿responde a TODO lo que pidió? ¿datos que parecen inventados o sin fuente? ¿cuentas que no cuadran? ¿archivos incompletos o con huecos? Si está bien, bien=true y problemas vacío; si no, problemas concretos (máximo 5).`}]}],generationConfig:{temperature:.2,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{bien:{type:'BOOLEAN'},problemas:{type:'ARRAY',items:{type:'STRING'}}},required:['bien','problemas']}}})); }catch(e){ return {bien:true,problemas:[]}; } }

async function seguirEnOtroOrdenador(){ // GitHub corta a las 2 h: se guarda y se lanza otra vez sola
  if(SIN_GIT||!process.env.GITHUB_TOKEN) return false;
  const r=await fetch(`https://api.github.com/repos/${process.env.REPO}/actions/workflows/trabajo.yml/dispatches`,{method:'POST',headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json'},body:JSON.stringify({ref:'main',inputs:{id:ID}})}); return r.ok; }

(async()=>{
  const sys=T.reglas+`\n\nTRABAJAS EN LA NUBE (un ordenador de Rocket Jam en GitHub), con el móvil del humano apagado: no puede contestarte al momento. Pregunta SOLO si es imprescindible (la tarea se queda esperando su respuesta). Las funciones de Mor del móvil (crear juegos, recordatorios, Vértice, ULTIMATE3D) se apuntan con funcion_mor y se harán cuando abra la app. Los archivos que escribas los verá en Mor.\n\n${T.contexto||''}`;
  guardar('empieza o sigue');
  try{ for(;S.paso<MAX;){
      if(Date.now()-t0>LIMITE){ S.estado='trabajando'; log('Cambio de ordenador (límite de tiempo de GitHub)…'); guardar('pausa por tiempo'); if(await seguirEnOtroOrdenador()) process.exit(0); S.estado='pausado'; guardar('pausado'); process.exit(0); }
      const i=S.paso; const hist=S.H.map((h,j)=>{ const viejo=j<S.H.length-10; return `[${j+1}] ${h.a}\n${viejo?String(h.o).slice(0,300):h.o}`; }).join('\n\n');
      const prompt=`TAREA DEL HUMANO:\n${T.tarea}\n\nTUS TAREAS:\n${S.T.map(t=>`[${t.estado}] ${t.t}`).join('\n')||'(aún no hay: créalas en este paso)'}\n\nARCHIVOS DE LA TAREA: ${listar().filter(n=>!n.startsWith('.mor_tmp')).join(', ')||'(ninguno)'}\n\nLO HECHO:\n${hist||'(nada todavía)'}\n\n${i>=MAX-5?'Te quedan muy pocos pasos: termina ya con lo que tengas y di qué falta.\n':''}Siguiente acción (JSON):`;
      let x; try{ x=json(await gemini({systemInstruction:{parts:[{text:sys}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:.2,maxOutputTokens:32768,responseMimeType:'application/json',responseSchema:T.schema}})); }
      catch(e){ log('No he podido pensar este paso: '+e.message); S.H.push({a:'(fallo del cerebro)',o:'Responde solo con el JSON de UNA acción.'}); S.paso++; S.fallos=(S.fallos||0)+1; if(S.fallos>6){ S.estado='error'; S.respuesta='Los cerebros gratuitos no responden ahora mismo ('+e.message+'). Vuelve a lanzarlo más tarde: seguirá donde se quedó.'; guardar('error'); return; } await sleep(5000); continue; }
      if(x.tareas&&x.tareas.length) S.T=x.tareas.slice(0,10);
      if(x.accion==='terminar'){ const resp=x.respuesta||'';
        if(S.revisado<2&&(listar().length||S.fuentes.length||resp.length>400)){ S.revisado++; log('Un revisor independiente comprueba el trabajo…'); const rv=await revisar(resp);
          if(!rv.bien&&rv.problemas?.length&&S.revisado<2){ log('El revisor encuentra '+rv.problemas.length+(rv.problemas.length===1?' cosa':' cosas')+' que arreglar'); S.H.push({a:'terminar (rechazado por el revisor)',o:'El REVISOR dice que antes de entregar arregles:\n'+rv.problemas.map(p=>'- '+p).join('\n')}); S.paso++; guardar('revisión'); continue; }
          log('Revisado'); }
        S.T=S.T.map(t=>Object.assign(t,{estado:'hecha'})); S.estado='listo'; S.respuesta=resp; S.fin=Date.now(); guardar('terminado'); return; }
      if(x.accion==='preguntar'){ S.estado='pregunta'; S.pregunta={texto:x.pregunta||'¿Cómo sigo?',opciones:(x.opciones||[]).slice(0,4)}; S.paso++; log('Pregunta: '+S.pregunta.texto); guardar('pregunta'); return; }
      log(resumen(x)); let o; try{ o=await herramienta(x); }catch(e){ o='ERROR: '+e.message; }
      S.H.push({a:resumen(x)+(x.pensamiento?' — '+String(x.pensamiento).slice(0,160):''),o:String(o).slice(0,7000)}); S.H=S.H.slice(-60); S.paso++; guardar(resumen(x)); }
    S.estado='listo'; S.respuesta=S.respuesta||'Se me han acabado los pasos sin terminar del todo. Lo hecho está en los archivos.'; guardar('fin de pasos');
  }catch(e){ S.estado='error'; S.respuesta='Error: '+e.message; guardar('error'); process.exit(1); }
})();
