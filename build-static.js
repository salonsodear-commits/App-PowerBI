const fs=require('fs');
const {JSDOM}=require('jsdom');
const src=fs.readFileSync('./index.html','utf8');

// --- 1. Extract CSS ---
const css = src.match(/<style>([\s\S]*?)<\/style>/)[1];

// --- 2. Extract & eval the FIRST script block (helpers + NODES + content) ---
const scripts = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let block1 = scripts[0];
block1 += '\n;globalThis.__NODES=NODES;';
eval(block1);
const NODES = globalThis.__NODES;
const byId={}; NODES.forEach(n=>byId[n.id]=n);
const childrenOf={}; NODES.forEach(n=>{const p=n.parent||'__root__';(childrenOf[p]=childrenOf[p]||[]).push(n);});

// --- 3. Reimplement small render helpers (from engine) ---
function metaChips(n){
  let h='<div class="meta-bar">';
  if(n.importancia) h+='<span class="chip"><span>Importancia</span><b>'+n.importancia+'</b></span>';
  if(n.dificultad) h+='<span class="chip '+(n.difClass||'')+'"><span>Dificultad</span><b>'+n.dificultad+'</b></span>';
  if(n.uso) h+='<span class="chip"><span>Uso</span><b>'+n.uso+'</b></span>';
  if(n.fnsig) h+='<span class="chip s"><span>Firma</span><b>'+n.fnsig+'</b></span>';
  return h+'</div>';
}
function relBlocks(n){
  const mk=(arr,cls)=>(arr||[]).map(id=>{const t=byId[id]?byId[id].title:id;return '<span class="pill '+(cls||'')+'" data-go="'+id+'">'+t+'</span>';}).join('');
  const hasDeps=(n.deps&&n.deps.length),hasRel=(n.related&&n.related.length),hasFns=(n.fns&&n.fns.length);
  if(!(hasDeps||hasRel||hasFns)) return '';
  let b='<div class="rel-grid">';
  if(hasDeps) b+='<div class="rel-card"><div class="h">🔗 Requisitos previos</div>'+mk(n.deps)+'</div>';
  if(hasRel) b+='<div class="rel-card"><div class="h">🧭 Conceptos relacionados</div>'+mk(n.related)+'</div>';
  if(hasFns) b+='<div class="rel-card"><div class="h">ƒ Funciones relacionadas</div>'+mk(n.fns,'fn')+'</div>';
  return b+'</div>';
}
function childrenIndex(n){
  const kids=childrenOf[n.id]||[]; if(!kids.length) return '';
  let h='<h3>Explorar dentro de este módulo</h3><div class="home-grid">';
  kids.forEach(k=>{h+='<div class="home-card" data-go="'+k.id+'"><div class="ic">'+(k.icon||'•')+'</div><div class="t">'+k.title+'</div><div class="d">'+(k.subtitle||k.uso||'')+'</div></div>';});
  return h+'</div>';
}

// --- 4. Build TOC (grouped by top-level) ---
function tocHtml(){
  let h='<details class="toc"><summary>📑 Índice de navegación — toca para abrir / cerrar</summary><ol>';
  (childrenOf['__root__']||[]).forEach(top=>{
    h+='<li><a href="#'+top.id+'">'+(top.icon||'')+' '+top.title+'</a>';
    const kids=childrenOf[top.id]||[];
    if(kids.length){h+='<ol>';kids.forEach(k=>{h+='<li><a href="#'+k.id+'">'+k.title+'</a></li>';});h+='</ol>';}
    h+='</li>';
  });
  return h+'</ol></details>';
}

// --- 5. Render all sections ---
function section(n){
  const html = typeof n.html==='function'? n.html() : (n.html||'');
  return '<section class="content node-sec" id="'+n.id+'">'
    + '<h2 class="title">'+(n.icon?n.icon+' ':'')+n.title+'</h2>'
    + (n.subtitle?'<p class="lead">'+n.subtitle+'</p>':'')
    + metaChips(n) + relBlocks(n) + html + childrenIndex(n)
    + '<a class="backtop" href="#top">↑ Volver al índice</a>'
    + '</section>';
}
let sections=''; NODES.forEach(n=>{ sections+=section(n); });

// --- 6. Extra CSS for static mode ---
const extra = `
/* ---- Static (no-JS) overrides ---- */
.lvl-b{display:block !important}
.lvl-h{cursor:default}
.lvl-h .arr{display:none}
.lvl{margin:10px 0}
a.pill,a.home-card,a.np{text-decoration:none}
a.home-card{display:block}
section.content{max-width:980px;margin:0 auto;padding:30px 26px 46px;border-top:1px solid var(--border)}
section.content:first-of-type{border-top:none}
[id]{scroll-margin-top:60px}
.toc-wrap{position:sticky;top:0;z-index:40;background:rgba(13,17,23,.97);border-bottom:1px solid var(--border)}
details.toc{max-width:980px;margin:0 auto;padding:8px 22px}
details.toc summary{cursor:pointer;font-weight:600;color:#fff;padding:8px 0;font-size:14px;list-style:none}
details.toc summary::-webkit-details-marker{display:none}
details.toc summary:before{content:"☰ ";color:var(--accent)}
details.toc ol{margin:6px 0;padding-left:20px;font-size:13.5px}
details.toc li{margin:3px 0}
details.toc a{color:var(--accent)}
details.toc ol ol a{color:var(--muted)}
.backtop{display:inline-block;margin-top:26px;font-size:12.5px;color:var(--faint);border:1px solid var(--border2);padding:4px 10px;border-radius:7px}
.appbar{background:linear-gradient(135deg,#16314f,#1a0f24);padding:14px 22px;border-bottom:1px solid var(--border)}
.appbar h1{margin:0;font-size:17px;color:#fff}
.appbar .s{font-size:11.5px;color:var(--muted);margin-top:2px}
:target{animation:flash 1.4s ease}
@keyframes flash{0%{background:rgba(79,156,249,.18)}100%{background:transparent}}
`;

// --- 7. Assemble pre-bake HTML (with a temporary bake script) ---
const bakeScript = `
<script>
// DAX highlighter (copy of runtime)
const DAX_KW=['VAR','RETURN','EVALUATE','DEFINE','MEASURE','ORDER BY','ASC','DESC','START AT','TRUE','FALSE','BLANK','IN','NOT'];
const DAX_FN=['CALCULATE','CALCULATETABLE','FILTER','ALL','ALLEXCEPT','ALLSELECTED','REMOVEFILTERS','KEEPFILTERS','VALUES','DISTINCT','DISTINCTCOUNT','SELECTEDVALUE','RELATED','RELATEDTABLE','LOOKUPVALUE','SUM','SUMX','AVERAGE','AVERAGEX','COUNT','COUNTX','COUNTROWS','MIN','MINX','MAX','MAXX','RANKX','TOPN','IF','SWITCH','DIVIDE','COALESCE','ISBLANK','ISINSCOPE','HASONEVALUE','HASONEFILTER','DATEADD','DATESINPERIOD','DATESYTD','DATESMTD','DATESQTD','TOTALYTD','TOTALMTD','SAMEPERIODLASTYEAR','PARALLELPERIOD','PREVIOUSMONTH','PREVIOUSYEAR','NEXTMONTH','ENDOFMONTH','STARTOFMONTH','EOMONTH','DATE','YEAR','MONTH','DAY','EDATE','CONCATENATEX','GENERATESERIES','SELECTCOLUMNS','ADDCOLUMNS','SUMMARIZE','SUMMARIZECOLUMNS','UNION','EXCEPT','INTERSECT','CROSSJOIN','TREATAS','USERELATIONSHIP','CROSSFILTER','DATEDIFF','ABS','ROUND','ROUNDUP','FORMAT','CONCATENATE','CALENDAR','CALENDARAUTO','FIRSTDATE','LASTDATE','DATATABLE'];
function highlightDax(codeEl){
  let txt=codeEl.textContent;
  const re=/("(?:[^"\\\\]|\\\\.)*")|(\\/\\/[^\\n]*|--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)|([A-Za-z_][A-Za-z0-9_]*)|('[^']*'(?:\\[[^\\]]*\\])?|\\[[^\\]]*\\])|(\\d+\\.?\\d*)|([+\\-*/=<>&|]+)/g;
  let m,last=0,out='';
  function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  while((m=re.exec(txt))){
    out+=esc(txt.slice(last,m.index));
    if(m[1]) out+='<span class="tok-str">'+esc(m[1])+'</span>';
    else if(m[2]) out+='<span class="tok-com">'+esc(m[2])+'</span>';
    else if(m[3]){const up=m[3].toUpperCase();if(DAX_KW.includes(up))out+='<span class="tok-kw">'+esc(m[3])+'</span>';else if(DAX_FN.includes(up))out+='<span class="tok-fn">'+esc(m[3])+'</span>';else out+=esc(m[3]);}
    else if(m[4]) out+='<span class="tok-tbl">'+esc(m[4])+'</span>';
    else if(m[5]) out+='<span class="tok-num">'+esc(m[5])+'</span>';
    else if(m[6]) out+='<span class="tok-op">'+esc(m[6])+'</span>';
    last=re.lastIndex;
  }
  out+=esc(txt.slice(last)); codeEl.innerHTML=out;
}
document.querySelectorAll('code.dax').forEach(highlightDax);
// convert data-go elements to native anchors
document.querySelectorAll('[data-go]').forEach(el=>{
  const id=el.getAttribute('data-go');
  const a=document.createElement('a');
  a.setAttribute('href','#'+id); a.className=el.className; a.innerHTML=el.innerHTML;
  el.replaceWith(a);
});
// force all collapsible levels open
document.querySelectorAll('.lvl').forEach(l=>l.classList.add('open'));
<\/script>`;

const pre = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Atlas DAX — Versión navegable (sin JavaScript)</title>
<style>${css}${extra}</style></head>
<body id="top">
<div class="appbar"><h1>Σ Atlas DAX</h1><div class="s">Artefacto de aprendizaje · Power BI · DAX · Analítica Corporativa · versión navegable sin JavaScript</div></div>
<div class="toc-wrap">${tocHtml()}</div>
${sections}
${bakeScript}
</body></html>`;

// --- 8. Bake with jsdom, then strip scripts ---
const dom=new JSDOM(pre,{runScripts:'dangerously'});
const d=dom.window.document;
d.querySelectorAll('script').forEach(s=>s.remove());
const final='<!DOCTYPE html>\n'+d.documentElement.outerHTML;
fs.writeFileSync('./atlas-dax-movil.html', final);
console.log('Generado atlas-dax-movil.html');
console.log('  tamaño:', (final.length/1024).toFixed(0)+' KB');
console.log('  <script> restantes (debe ser 0):', (final.match(/<script/g)||[]).length);
console.log('  secciones:', (final.match(/class="content node-sec"/g)||[]).length);
console.log('  code.dax resaltados (tok-fn):', (final.match(/tok-fn/g)||[]).length>0);
console.log('  enlaces internos (#):', (final.match(/href="#/g)||[]).length);
