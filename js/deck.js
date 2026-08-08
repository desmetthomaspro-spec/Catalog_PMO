// =========================================================
// Composer une réunion — sélection de fiches + génération
// d'un support de réunion HTML autonome (slides projetables),
// dans l'esprit d'un deck frontend-slides mais avec le design
// system du site (papier, encre, couleurs de familles).
// =========================================================

const MEETING_KEY = 'pmo-meeting-builder';

function loadMeeting(){
  try{
    const raw = localStorage.getItem(MEETING_KEY);
    if(raw) return Object.assign({refs:[], info:{}}, JSON.parse(raw));
  }catch(e){ /* localStorage indisponible */ }
  return { refs: [], info: {} };
}
let meetingState = loadMeeting();
function saveMeeting(){ try{ localStorage.setItem(MEETING_KEY, JSON.stringify(meetingState)); }catch(e){} }

function isInMeeting(ref){ return meetingState.refs.includes(ref); }
function toggleMeeting(ref){
  const i = meetingState.refs.indexOf(ref);
  if(i>=0) meetingState.refs.splice(i,1); else meetingState.refs.push(ref);
  saveMeeting();
  updateNavReunionBadge();
}
function removeFromMeeting(ref){
  meetingState.refs = meetingState.refs.filter(r=>r!==ref);
  saveMeeting(); updateNavReunionBadge();
}
function moveMeetingItem(ref, dir){
  const i = meetingState.refs.indexOf(ref);
  const j = i+dir;
  if(i<0||j<0||j>=meetingState.refs.length) return;
  const tmp = meetingState.refs[i]; meetingState.refs[i] = meetingState.refs[j]; meetingState.refs[j] = tmp;
  saveMeeting();
}
function updateNavReunionBadge(){
  const el = document.getElementById('nav-reunion');
  if(!el) return;
  const n = meetingState.refs.length;
  el.textContent = '🗂 Ma réunion';
  if(n>0) el.appendChild(h('span',{class:'nav-badge'},[String(n)]));
}

// ---------------------------------------------------------
// Estimation de durée — parsing best-effort des durées en texte libre
// ---------------------------------------------------------
const DAY_MINUTES = 420; // 1 journée ≈ 7h de travail effectif

function parseDurationMinutes(str){
  if(!str) return null;
  const s = str.toLowerCase();
  let m;
  m = s.match(/(\d+)\s*[×x]\s*(\d+)\s*(h|heure|min)/);
  if(m) return parseInt(m[1],10) * (m[3][0]==='h' ? parseInt(m[2],10)*60 : parseInt(m[2],10));
  m = s.match(/(\d+)\s*(?:à|-|–)\s*(\d+)\s*sessions?\s*de\s*(\d+)\s*min/);
  if(m) return Math.round((parseInt(m[1],10)+parseInt(m[2],10))/2) * parseInt(m[3],10);
  m = s.match(/(½|\d+(?:[.,]\d+)?)\s*(?:à|-|–)\s*(½|\d+(?:[.,]\d+)?)\s*(journée|jour)/);
  if(m){
    const toNum = t => t==='½' ? 0.5 : parseFloat(t.replace(',','.'));
    return Math.round(((toNum(m[1])+toNum(m[2]))/2) * DAY_MINUTES);
  }
  m = s.match(/(\d+(?:[.,]\d+)?)\s*(journée|jour)/);
  if(m) return Math.round(parseFloat(m[1].replace(',','.')) * DAY_MINUTES);
  m = s.match(/(\d+)\s*(?:–|-|à)\s*(\d+)\s*(h|heure|min)/);
  if(m){
    const mid = (parseInt(m[1],10)+parseInt(m[2],10))/2;
    return Math.round(m[3][0]==='h' ? mid*60 : mid);
  }
  m = s.match(/(\d+)\s*h\s*(\d+)/);
  if(m) return parseInt(m[1],10)*60 + parseInt(m[2],10);
  m = s.match(/(\d+)\s*(h|heure|min)/);
  if(m) return parseInt(m[1],10) * (m[2][0]==='h' ? 60 : 1);
  return null;
}
function fmtMinutes(mins){
  if(mins==null) return null;
  const hh = Math.floor(mins/60), mm = Math.round(mins%60);
  if(hh && mm) return `${hh} h ${mm}`;
  if(hh) return `${hh} h`;
  return `${mm} min`;
}

// ---------------------------------------------------------
// Page #/reunion
// ---------------------------------------------------------
function renderReunionPage(){
  const root = h('div',{});
  root.appendChild(h('h1',{class:'page-title'},['Composer une réunion']));
  root.appendChild(h('p',{class:'page-lead'},['Sélectionnez des fiches depuis le catalogue (bouton « + » sur chaque carte ou fiche), organisez-les, renseignez le contexte, puis générez un support de réunion HTML autonome — prêt à projeter en séance.']));

  if(meetingState.refs.length === 0){
    root.appendChild(h('div',{class:'empty-state'},[
      h('p',{},['Aucune fiche sélectionnée pour l’instant.']),
      h('a',{class:'btn-primary', href:'#/', style:'text-decoration:none;display:inline-block;'},['Parcourir le catalogue']),
    ]));
  } else {
    root.appendChild(buildMeetingForm());
    root.appendChild(buildMeetingList());
    root.appendChild(buildMeetingActions());
  }

  view().innerHTML = '';
  view().appendChild(root);
}

function meetingField(id, label, type){
  const input = type==='textarea' ? h('textarea',{id, rows:3}) : h('input',{type: type||'text', id});
  input.value = meetingState.info[id] || '';
  input.addEventListener('input', debounce(()=>{ meetingState.info[id]=input.value; saveMeeting(); updateMeetingGauge(); },250));
  const dot = h('span',{class:'template-field-dot'+(input.value?' filled':'')},[]);
  input.addEventListener('input', ()=> dot.classList.toggle('filled', !!input.value));
  return h('div',{class:'template-field'},[h('label',{for:id, class:'template-field-tab'},[dot, label]), input]);
}

function buildMeetingForm(){
  const grid = h('div',{class:'template-grid'},[
    meetingField('title','Titre de la réunion','text'),
    meetingField('date','Date','date'),
    meetingField('room','Salle / lieu','text'),
    meetingField('participants','Participants','number'),
    meetingField('duration','Durée disponible (minutes)','number'),
    meetingField('facilitator','Animateur·rice','text'),
  ]);
  return h('div',{class:'content-block'},[
    h('h3',{},['Informations de la réunion']),
    grid,
    h('div',{style:'margin-top:12px;'},[meetingField('objective','Objectif / contexte','textarea')]),
  ]);
}

function buildMeetingList(){
  const wrap = h('div',{class:'content-block'});
  wrap.appendChild(h('h3',{},[`Fiches sélectionnées (${meetingState.refs.length})`]));

  const list = h('div',{class:'fiche-row'});
  meetingState.refs.forEach((ref,idx)=>{
    const f = FICHE_BY_REF[ref];
    if(!f) return;
    const fam = FAM_BY_ID[f.family];
    const mins = parseDurationMinutes(f.duration);
    list.appendChild(h('div',{class:'fiche-card meeting-item', style:`--fam-color:${fam.color}`},[
      h('div',{class:'card-top'},[
        h('span',{class:'ref-badge'},[f.ref]),
        h('div',{class:'meeting-item-controls'},[
          h('button',{disabled: idx===0, title:'Monter', onclick:()=>{ moveMeetingItem(ref,-1); renderReunionPage(); }},['↑']),
          h('button',{disabled: idx===meetingState.refs.length-1, title:'Descendre', onclick:()=>{ moveMeetingItem(ref,1); renderReunionPage(); }},['↓']),
          h('button',{title:'Retirer', onclick:()=>{ removeFromMeeting(ref); renderReunionPage(); }},['✕']),
        ]),
      ]),
      h('h3',{},[f.title]),
      h('p',{class:'produces'},[f.produces]),
      h('div',{class:'card-foot'},[
        h('span',{},['⏱ '+f.duration + (mins!=null?' (~'+fmtMinutes(mins)+')':'')]),
        h('span',{},['👥 '+f.group]),
      ]),
    ]));
  });
  wrap.appendChild(list);
  wrap.appendChild(h('div',{id:'meeting-gauge-wrap', style:'margin-top:16px;'},[buildMeetingGauge()]));
  return wrap;
}

function buildMeetingGauge(){
  const totalAvailable = Number(meetingState.info.duration)||0;
  const estimated = meetingState.refs.reduce((sum,ref)=>{
    const f = FICHE_BY_REF[ref]; if(!f) return sum;
    return sum + (parseDurationMinutes(f.duration)||0);
  },0);
  const unknown = meetingState.refs.filter(ref=>{
    const f = FICHE_BY_REF[ref]; return f && parseDurationMinutes(f.duration)==null;
  }).length;

  const wrap = h('div',{});
  if(totalAvailable>0){
    const over = estimated > totalAvailable;
    const pct = Math.min(100, (estimated/Math.max(1,totalAvailable))*100);
    wrap.appendChild(h('div',{class:'budget-gauge'},[h('div',{class:'budget-gauge-fill', style:`width:${pct}%;`+(over?'background:var(--warn);':'')})]));
    wrap.appendChild(h('div',{class:'budget-gauge-label'},[
      `${fmtMinutes(estimated)} estimées sur ${fmtMinutes(totalAvailable)} disponibles`+(over?' — dépassement : retirez une méthode ou revoyez la durée.':'')
    ]));
  } else {
    wrap.appendChild(h('div',{class:'budget-gauge-label'},[`Durée totale estimée : ${estimated?fmtMinutes(estimated):'—'}`]));
  }
  if(unknown>0) wrap.appendChild(h('div',{class:'budget-gauge-label', style:'color:var(--ink-faint);'},[
    `${unknown} fiche${unknown>1?'s':''} à durée non estimable automatiquement (non comptabilisée${unknown>1?'s':''} ci-dessus).`
  ]));
  return wrap;
}
function updateMeetingGauge(){
  const wrap = document.getElementById('meeting-gauge-wrap');
  if(!wrap) return;
  wrap.innerHTML = '';
  wrap.appendChild(buildMeetingGauge());
}

function buildMeetingActions(){
  const wrap = h('div',{class:'template-actions'});
  wrap.appendChild(h('button',{class:'btn-primary', onclick:downloadMeetingDeck},['📥 Générer le support de réunion (HTML)']));
  wrap.appendChild(h('button',{
    style:'background:none;border:none;color:var(--ink-faint);text-decoration:underline;font-size:13px;',
    onclick:()=>{
      if(confirm('Vider la sélection et les informations saisies ?')){
        meetingState = { refs: [], info: {} }; saveMeeting(); updateNavReunionBadge(); renderReunionPage();
      }
    }
  },['Vider la sélection']));
  return wrap;
}

// ---------------------------------------------------------
// Génération du support de réunion (HTML autonome, slides)
// ---------------------------------------------------------
function escHtml(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function slugify(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-+|-+$)/g,'') || 'reunion';
}

function downloadMeetingDeck(){
  const html = buildMeetingDeckHTML();
  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = slugify(meetingState.info.title) + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

function buildMeetingDeckHTML(){
  const info = meetingState.info || {};
  const fiches = meetingState.refs.map(ref=>FICHE_BY_REF[ref]).filter(Boolean);
  const title = info.title || 'Réunion';

  const metaBits = [];
  if(info.date) metaBits.push(new Date(info.date+'T00:00:00').toLocaleDateString('fr-FR', {weekday:'long', year:'numeric', month:'long', day:'numeric'}));
  if(info.room) metaBits.push(info.room);
  if(info.participants) metaBits.push(info.participants+' participant'+(Number(info.participants)>1?'s':''));
  if(info.duration) metaBits.push(fmtMinutes(Number(info.duration)));

  const totalEstimated = fiches.reduce((sum,f)=>sum+(parseDurationMinutes(f.duration)||0),0);

  const coverSlide = `
    <section class="slide cover-slide active visible">
      <div class="cover-decoration"></div>
      <div class="slide-content" style="display:flex;flex-direction:column;justify-content:center;">
        <span class="eyebrow reveal">Support de réunion</span>
        <h1 class="reveal" style="margin:22px 0 14px;">${escHtml(title)}</h1>
        ${metaBits.length ? `<p class="meta-line reveal">${metaBits.map(escHtml).join(' &middot; ')}</p>` : ''}
        ${info.objective ? `<p class="lede reveal">${escHtml(info.objective)}</p>` : ''}
        ${info.facilitator ? `<p class="meta-line reveal" style="margin-top:18px;">Animation : ${escHtml(info.facilitator)}</p>` : ''}
      </div>
    </section>`;

  const agendaRows = fiches.map((f,i)=>{
    const fam = FAM_BY_ID[f.family];
    const mins = parseDurationMinutes(f.duration);
    return `<div class="agenda-row">
      <span class="agenda-num" style="background:${fam.color}">${i+1}</span>
      <span class="agenda-title"><b>${escHtml(f.ref)}</b> ${escHtml(f.title)}</span>
      <span class="agenda-dur">${mins!=null?escHtml(fmtMinutes(mins)):escHtml(f.duration)}</span>
    </div>`;
  }).join('');
  const overBudget = info.duration && totalEstimated > Number(info.duration);
  const agendaSlide = `
    <section class="slide">
      <div class="slide-content">
        <div class="slide-header reveal"><span class="eyebrow">Ordre du jour</span><span class="tag-pill">${fiches.length} méthode${fiches.length>1?'s':''}</span></div>
        <h2 class="title reveal">Déroulé de la séance</h2>
        <div class="agenda-list reveal">${agendaRows}</div>
        <p class="meta-line reveal" style="margin-top:18px;${overBudget?'color:var(--warn);font-weight:600;':''}">
          Durée totale estimée : ${escHtml(fmtMinutes(totalEstimated)||'—')}${info.duration ? ' / '+escHtml(fmtMinutes(Number(info.duration)))+' disponibles'+(overBudget?' — dépassement estimé':'') : ''}
        </p>
      </div>
    </section>`;

  const ficheSlides = fiches.map((f,i)=>{
    const fam = FAM_BY_ID[f.family];
    const steps = String(f.steps||'').split(/(?<=\.)\s+/).map(s=>s.trim()).filter(Boolean);
    const stepsHtml = steps.length
      ? `<ol class="step-list">${steps.map(s=>`<li>${escHtml(s)}</li>`).join('')}</ol>`
      : '';
    return `
    <section class="slide">
      <div class="slide-content">
        <div class="slide-header reveal">
          <span class="eyebrow">Fiche ${escHtml(f.ref)} &middot; ${escHtml(fam.name)}</span>
          <span class="tag-pill">${escHtml(f.duration)} &middot; ${escHtml(f.group)}</span>
        </div>
        <h2 class="title reveal" style="color:${fam.color};">${escHtml(f.title)}</h2>
        <p class="lede reveal">${escHtml(f.produces)}</p>
        ${stepsHtml ? `<div class="reveal">${stepsHtml}</div>` : ''}
      </div>
    </section>`;
  }).join('');

  const closingSlide = `
    <section class="slide closing-slide">
      <div class="slide-content" style="display:flex;flex-direction:column;justify-content:center;">
        <h2 class="title reveal">Décisions &amp; prochaines étapes</h2>
        <p class="lede reveal">À compléter en séance.</p>
        <div class="notes-lines reveal">${'<div class="notes-line"></div>'.repeat(6)}</div>
        <p class="meta-line reveal" style="margin-top:22px;">${escHtml(title)}${metaBits.length?' &middot; '+metaBits.map(escHtml).join(' &middot; '):''} &middot; Généré depuis le Catalogue d’animation PMO</p>
      </div>
    </section>`;

  const allSlides = [coverSlide, agendaSlide, ficheSlides, closingSlide].join('\n');
  const totalSlides = 2 + fiches.length + 1;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)} — Support de réunion</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --paper:#F3F3EE; --paper-raised:#FBFBF8; --ink:#1C1B18; --ink-soft:#55534C; --ink-faint:#8B897F;
  --line:#D8D6CA; --accent:#1F6F63; --accent-ink:#0E3F38; --warn:#A13D3D;
  --font-display:'Space Grotesk','IBM Plex Sans',sans-serif; --font-body:'IBM Plex Sans',sans-serif; --font-mono:'IBM Plex Mono',monospace;
  --stage-bg:#1C1B18; --slide-bg:#F3F3EE; --ease:cubic-bezier(.16,1,.3,1);
}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;overflow:hidden;background:var(--stage-bg);}
body{font-family:var(--font-body);color:var(--ink);}
h1,h2{font-family:var(--font-display);font-weight:600;letter-spacing:-.01em;}
.deck-viewport{position:fixed;inset:0;overflow:hidden;background:var(--stage-bg);}
.deck-stage{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;transform-origin:0 0;background:var(--slide-bg);}
.slide{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden;visibility:hidden;opacity:0;pointer-events:none;
  background-image:radial-gradient(rgba(28,27,24,.07) 1.5px, transparent 1.5px); background-size:24px 24px; background-color:var(--slide-bg);}
.slide.active,.slide.visible{visibility:visible;opacity:1;pointer-events:auto;z-index:1;}
@media print{ html,body{width:1920px;height:auto;overflow:visible;background:#fff;} .deck-viewport{position:static;overflow:visible;} .deck-stage{position:static;width:auto;height:auto;transform:none!important;} .slide{position:relative;visibility:visible!important;opacity:1!important;width:1920px;height:1080px;break-after:page;} .chrome{display:none!important;} }
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;}}

.slide-content{position:relative;width:100%;height:100%;padding:86px 100px 110px;}
.slide-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:36px;}
.eyebrow{font-family:var(--font-mono);font-size:16px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent-ink);}
.tag-pill{font-family:var(--font-mono);font-size:14px;background:var(--paper-raised);border:1.5px solid var(--line);padding:7px 16px;border-radius:20px;color:var(--ink-soft);}
h1{font-size:76px;line-height:1.05;max-width:1500px;}
.title{font-size:50px;line-height:1.1;margin-bottom:6px;max-width:1600px;}
.lede{font-size:23px;color:var(--ink-soft);max-width:1400px;line-height:1.55;margin-top:8px;}
.meta-line{font-family:var(--font-mono);font-size:16px;color:var(--ink-soft);}

.cover-decoration{position:absolute;top:0;right:0;width:34%;height:100%;background:rgba(31,111,99,.08);clip-path:polygon(28% 0,100% 0,100% 100%,0 100%);pointer-events:none;}

.step-list{list-style:none;counter-reset:step;margin-top:22px;display:flex;flex-direction:column;gap:14px;max-width:1500px;}
.step-list li{position:relative;padding-left:44px;font-size:20px;line-height:1.5;}
.step-list li::before{counter-increment:step;content:counter(step);position:absolute;left:0;top:0;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;font-family:var(--font-mono);font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;}

.agenda-list{display:flex;flex-direction:column;gap:2px;margin-top:8px;}
.agenda-row{display:grid;grid-template-columns:56px 1fr auto;align-items:center;gap:20px;padding:14px 4px;border-bottom:1px solid var(--line);}
.agenda-num{width:36px;height:36px;border-radius:50%;color:#fff;font-family:var(--font-mono);font-weight:700;display:flex;align-items:center;justify-content:center;font-size:15px;}
.agenda-title{font-size:20px;} .agenda-title b{font-family:var(--font-mono);color:var(--accent-ink);margin-right:10px;}
.agenda-dur{font-family:var(--font-mono);font-size:15px;color:var(--ink-soft);}

.notes-lines{margin-top:28px;max-width:1600px;}
.notes-line{height:44px;border-bottom:1.5px dashed var(--line);}

.chrome{position:fixed;z-index:1000;font-family:var(--font-mono);color:var(--ink-soft);}
.slide-counter{left:40px;bottom:26px;font-size:13px;}
.nav-controls{right:40px;bottom:22px;display:flex;gap:10px;}
.nav-btn{width:40px;height:40px;border-radius:50%;border:1.5px solid var(--line);background:var(--paper-raised);color:var(--ink);font-family:var(--font-mono);cursor:pointer;}
.nav-btn:hover:not(:disabled){background:var(--ink);color:#fff;}
.nav-btn:disabled{opacity:.3;cursor:default;}
.progress-bar{position:fixed;bottom:0;left:0;height:4px;background:var(--accent);z-index:1000;transition:width .3s ease;}
.keyboard-hint{left:50%;bottom:26px;transform:translateX(-50%);font-size:11.5px;color:var(--ink-faint);white-space:nowrap;}

.reveal{opacity:0;transform:translateY(18px);transition:opacity .5s var(--ease),transform .5s var(--ease);}
.slide.active .reveal{opacity:1;transform:translateY(0);}
.slide.active .reveal:nth-child(1){transition-delay:.04s;}
.slide.active .reveal:nth-child(2){transition-delay:.1s;}
.slide.active .reveal:nth-child(3){transition-delay:.16s;}
.slide.active .reveal:nth-child(4){transition-delay:.22s;}

[contenteditable="true"]{outline:1.5px dashed var(--accent);outline-offset:4px;border-radius:3px;}
.edit-hotzone{position:fixed;top:0;left:0;width:70px;height:70px;z-index:10000;cursor:pointer;}
.edit-toggle{position:fixed;top:16px;left:16px;width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;border:none;font-size:16px;opacity:0;pointer-events:none;transition:opacity .25s ease;z-index:10001;cursor:pointer;}
.edit-toggle.show,.edit-toggle.active{opacity:1;pointer-events:auto;}
.edit-toggle.active{background:var(--warn);}
</style>
</head>
<body>
<div class="deck-viewport">
  <main class="deck-stage" id="deckStage">
    ${allSlides}
  </main>
  <div class="chrome slide-counter" id="slideCounter">01 / ${String(totalSlides).padStart(2,'0')}</div>
  <div class="chrome keyboard-hint">Flèches du clavier pour naviguer &middot; E pour éditer</div>
  <div class="chrome nav-controls">
    <button class="nav-btn" id="prevBtn">←</button>
    <button class="nav-btn" id="nextBtn">→</button>
  </div>
  <div class="progress-bar" id="progressBar"></div>
  <div class="edit-hotzone" id="editHotzone"></div>
  <button class="edit-toggle" id="editToggle" title="Mode édition (touche E)">✏️</button>
</div>
<script>
class SlidePresentation{
  constructor(){
    this.slides=Array.from(document.querySelectorAll('.slide'));
    this.total=this.slides.length; this.current=0;
    this.stage=document.getElementById('deckStage');
    this.counter=document.getElementById('slideCounter');
    this.progress=document.getElementById('progressBar');
    this.prevBtn=document.getElementById('prevBtn');
    this.nextBtn=document.getElementById('nextBtn');
    this.setupStageScale(); this.setupKeyboard(); this.setupTouch(); this.setupButtons();
    this.show(0);
  }
  setupStageScale(){
    const scale=()=>{
      const f=Math.min(window.innerWidth/1920, window.innerHeight/1080);
      const x=(window.innerWidth-1920*f)/2, y=(window.innerHeight-1080*f)/2;
      this.stage.style.transform='translate('+x+'px,'+y+'px) scale('+f+')';
    };
    scale(); window.addEventListener('resize',scale);
  }
  setupKeyboard(){
    document.addEventListener('keydown',(e)=>{
      if(e.target.getAttribute && e.target.getAttribute('contenteditable')==='true') return;
      if(e.key==='ArrowRight'||e.key===' '){ e.preventDefault(); this.next(); }
      else if(e.key==='ArrowLeft'){ e.preventDefault(); this.prev(); }
      else if(e.key==='Home'){ e.preventDefault(); this.show(0); }
      else if(e.key==='End'){ e.preventDefault(); this.show(this.total-1); }
    });
  }
  setupTouch(){
    let startX=0;
    this.stage.addEventListener('touchstart',e=>{ startX=e.touches[0].clientX; },{passive:true});
    this.stage.addEventListener('touchend',e=>{
      const dx=e.changedTouches[0].clientX-startX;
      if(Math.abs(dx)>50) dx<0?this.next():this.prev();
    },{passive:true});
  }
  setupButtons(){ this.prevBtn.addEventListener('click',()=>this.prev()); this.nextBtn.addEventListener('click',()=>this.next()); }
  next(){ this.show(Math.min(this.current+1,this.total-1)); }
  prev(){ this.show(Math.max(this.current-1,0)); }
  show(i){
    this.current=Math.max(0,Math.min(i,this.total-1));
    this.slides.forEach((s,idx)=>{ s.classList.toggle('active',idx===this.current); s.classList.toggle('visible',idx===this.current); });
    this.counter.textContent=String(this.current+1).padStart(2,'0')+' / '+this.total;
    this.progress.style.width=((this.current+1)/this.total*100)+'%';
    this.prevBtn.disabled=this.current===0; this.nextBtn.disabled=this.current===this.total-1;
  }
}
class InlineEditor{
  constructor(){
    this.active=false;
    this.toggle=document.getElementById('editToggle');
    this.hotzone=document.getElementById('editHotzone');
    this.timeout=null;
    this.hotzone.addEventListener('mouseenter',()=>{ clearTimeout(this.timeout); this.toggle.classList.add('show'); });
    this.hotzone.addEventListener('mouseleave',()=>{ this.timeout=setTimeout(()=>{ if(!this.active) this.toggle.classList.remove('show'); },400); });
    this.toggle.addEventListener('mouseenter',()=>clearTimeout(this.timeout));
    this.toggle.addEventListener('mouseleave',()=>{ this.timeout=setTimeout(()=>{ if(!this.active) this.toggle.classList.remove('show'); },400); });
    this.hotzone.addEventListener('click',()=>this.flip());
    this.toggle.addEventListener('click',()=>this.flip());
    document.addEventListener('keydown',(e)=>{
      if((e.key==='e'||e.key==='E') && !(e.target.getAttribute && e.target.getAttribute('contenteditable'))) this.flip();
    });
  }
  flip(){
    this.active=!this.active;
    this.toggle.classList.toggle('active',this.active);
    this.toggle.classList.toggle('show',this.active);
    document.querySelectorAll('.slide h1, .slide h2, .slide p, .slide li').forEach(el=>{
      el.setAttribute('contenteditable', this.active ? 'true' : 'false');
    });
  }
}
new SlidePresentation();
new InlineEditor();
</script>
</body>
</html>`;
}
