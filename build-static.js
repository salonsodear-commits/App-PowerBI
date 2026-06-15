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

// --- 4. Build the PERSISTENT LEFT SIDEBAR (categories + subtopics, no JS) ---
// Flattened indented descendant links inside each top-level category.
function navFlat(id, depth, out){
  (childrenOf[id]||[]).forEach(k=>{
    const d = Math.min(depth,4);
    out.push('<a class="navlink d'+d+'" data-nav="'+k.id+'" href="#'+k.id+'">'+(k.icon?k.icon+' ':'')+k.title+'</a>');
    navFlat(k.id, depth+1, out);
  });
}
function navHtml(){
  let h='<nav class="nav">';
  (childrenOf['__root__']||[]).forEach(top=>{
    const kids=childrenOf[top.id]||[];
    if(!kids.length){
      h+='<a class="navlink cat-leaf" data-nav="'+top.id+'" href="#'+top.id+'">'+(top.icon?top.icon+' ':'')+top.title+'</a>';
    } else {
      h+='<details class="cat"><summary class="cat-sum">'+(top.icon?top.icon+' ':'')+top.title+'</summary>';
      h+='<div class="cat-body">';
      h+='<a class="navlink cat-self d0" data-nav="'+top.id+'" href="#'+top.id+'">▸ Abrir «'+top.title+'»</a>';
      const out=[]; navFlat(top.id,1,out); h+=out.join('');
      h+='</div></details>';
    }
  });
  return h+'</nav>';
}
// Active-node highlight: when a section is :target, highlight its nav link (CSS :has).
const activeRule = NODES.map(n=>'body:has(#'+n.id+':target) a[data-nav="'+n.id+'"]').join(',\n')
  + '{background:#1d3a5f;color:#fff !important;border-left-color:var(--accent) !important;font-weight:600}';

// --- 5. Render all sections ---
function section(n){
  const html = typeof n.html==='function'? n.html() : (n.html||'');
  return '<section class="content node-sec" id="'+n.id+'">'
    + '<h2 class="title">'+(n.icon?n.icon+' ':'')+n.title+'</h2>'
    + (n.subtitle?'<p class="lead">'+n.subtitle+'</p>':'')
    + metaChips(n) + relBlocks(n) + html + childrenIndex(n)
    + '<a class="backtop" href="#top">↑ Inicio</a>'
    + '</section>';
}
let sections=''; NODES.forEach(n=>{ sections+=section(n); });

// --- 6. Extra CSS for static mode (layout + left drawer) ---
const extra = `
/* ---- Static (no-JS) overrides ---- */
.lvl-b{display:block !important}
.lvl-h{cursor:default}
.lvl-h .arr{display:none}
.lvl{margin:10px 0}
a.pill,a.home-card,a.np{text-decoration:none}
a.home-card{display:block}

/* App bar */
.appbar{background:linear-gradient(135deg,#16314f,#1a0f24);padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px}
.appbar h1{margin:0;font-size:16px;color:#fff}
.appbar .s{font-size:11px;color:var(--muted);margin-top:2px}
.hamburger{display:none}

/* Two-column layout: persistent LEFT sidebar + content */
.layout{display:flex;align-items:flex-start}
.side{width:320px;min-width:320px;position:sticky;top:0;height:100vh;overflow-y:auto;background:var(--bg2);border-right:1px solid var(--border);padding:12px 8px 60px}
.side::-webkit-scrollbar{width:9px}.side::-webkit-scrollbar-thumb{background:#222c3a;border-radius:8px}
.side-close{display:none}
.side-head{font-size:10.5px;text-transform:uppercase;letter-spacing:.8px;color:var(--faint);padding:4px 10px 10px}
.nav-overlay{display:none}
.docs{flex:1;min-width:0}
section.content{max-width:900px;margin:0 auto;padding:24px 30px 44px;border-top:1px solid var(--border)}
section.content:first-of-type{border-top:none}
[id]{scroll-margin-top:14px}

/* Sidebar nav */
.nav{font-size:12.5px}
details.cat{margin:1px 0;border-radius:8px}
summary.cat-sum{list-style:none;cursor:pointer;padding:11px 10px;font-weight:700;color:#fff;font-size:13.5px;display:flex;align-items:center;gap:8px;border-radius:8px}
summary.cat-sum::-webkit-details-marker{display:none}
summary.cat-sum::before{content:"▸";color:var(--accent);font-size:12px;display:inline-block;width:12px;transition:transform .15s}
details.cat[open]>summary.cat-sum::before{transform:rotate(90deg)}
summary.cat-sum:hover{background:var(--panel)}
.cat-body{margin:0 0 10px 14px;border-left:1px solid var(--border);padding-left:2px}
a.navlink{display:block;color:var(--muted);text-decoration:none;padding:6px 8px;border-left:2px solid transparent;border-radius:0 6px 6px 0;line-height:1.3}
a.navlink:hover{background:var(--panel);color:var(--text)}
a.navlink.cat-leaf{font-weight:700;color:#fff;font-size:13.5px;padding:11px 10px}
a.cat-self.d0{color:var(--accent);font-size:11px;opacity:.85;padding:4px 8px 8px 12px}
/* nivel 1 = módulos: sub-encabezados dentro de la categoría */
a.navlink.d1{color:var(--accent2);font-weight:700;font-size:12.5px;padding:8px 8px 7px 14px;margin-top:4px;border-top:1px solid var(--border)}
a.navlink.d1:hover{background:var(--panel);color:#fff}
/* nivel 2 = subtemas (claramente subordinados) */
a.navlink.d2{padding:5px 8px 5px 30px;color:var(--muted);font-size:12px}
a.navlink.d2::before{content:"·";color:var(--faint);margin-right:6px}
/* niveles 3-4 = sub-subtemas */
a.navlink.d3{padding:4px 8px 4px 44px;color:var(--faint);font-size:11.5px}
a.navlink.d4{padding:4px 8px 4px 56px;color:var(--faint);font-size:11.5px}

/* Active node highlight (CSS :has — degrades gracefully if unsupported) */
${activeRule}

/* Content target flash */
.node-sec:target>.title{color:#fff}
.node-sec:target{animation:flash 1.6s ease}
@keyframes flash{0%{background:rgba(79,156,249,.16)}100%{background:transparent}}
.backtop{display:inline-block;margin-top:26px;font-size:12.5px;color:var(--faint);border:1px solid var(--border2);padding:4px 10px;border-radius:7px;text-decoration:none}

/* ===== MOBILE: left drawer (off-canvas, pure CSS via :target) ===== */
@media(max-width:880px){
  .appbar{position:sticky;top:0;z-index:90}
  .hamburger{display:inline-flex;align-items:center;gap:6px;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.20);padding:8px 12px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;flex:0 0 auto}
  .layout{display:block}
  .docs{width:100%}
  .side{position:fixed;top:0;left:0;height:100vh;width:86%;max-width:330px;min-width:0;border-right:1px solid var(--border2);transform:translateX(-100%);transition:transform .25s ease;z-index:100;padding-top:46px}
  #menu:target{transform:translateX(0);box-shadow:0 0 50px rgba(0,0,0,.7)}
  .side-close{display:flex;align-items:center;justify-content:center;position:absolute;top:8px;right:10px;width:34px;height:34px;border-radius:8px;background:var(--panel2);border:1px solid var(--border2);color:#fff;font-size:16px;text-decoration:none}
  .nav-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99}
  #menu:target ~ .nav-overlay{display:block}
  section.content{padding:18px 16px 34px}
  [id]{scroll-margin-top:62px}
}
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
<div class="appbar">
  <a href="#menu" class="hamburger">☰ Categorías</a>
  <div><h1>Σ Atlas DAX</h1><div class="s">Power BI · DAX · Power Query · Dashboards · Agentes</div></div>
</div>
<div class="layout">
  <aside id="menu" class="side">
    <a href="#contenido" class="side-close" title="Cerrar">✕</a>
    <div class="side-head">Categorías · toca una para desplegar sus subtemas</div>
    ${navHtml()}
  </aside>
  <a href="#contenido" class="nav-overlay" aria-hidden="true"></a>
  <main id="contenido" class="docs">
    ${sections}
  </main>
</div>
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
console.log('  enlaces de nav (data-nav):', (final.match(/data-nav=/g)||[]).length);
console.log('  code.dax resaltados (tok-fn):', (final.match(/tok-fn/g)||[]).length>0);
