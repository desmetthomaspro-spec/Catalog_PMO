// =========================================================
// App shell — routage par hash, rendu du catalogue et des fiches
// =========================================================

const FAM_BY_ID = Object.fromEntries(CATALOG.families.map(f=>[f.id,f]));
const FICHE_BY_REF = Object.fromEntries(CATALOG.fiches.map(f=>[f.ref,f]));

const state = {
  query: '', families: new Set(CATALOG.families.map(f=>f.id)),
  coreOnly: false, remote: 'all', fame: 'all'
};

function dots(n, total){
  total = total||3;
  let s = '';
  for(let i=0;i<total;i++) s += (i<n ? '●' : '○');
  return s;
}
function remoteIcon(r){ return r==='yes' ? '✅' : r==='degraded' ? '⚠️' : '❌'; }
function remoteLabel(r){ return r==='yes' ? 'Distanciel natif' : r==='degraded' ? 'Distanciel dégradé' : 'À éviter en distanciel'; }

// ---------------------------------------------------------
// Router
// ---------------------------------------------------------
function router(){
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  window.scrollTo(0,0);
  setActiveNav(parts[0]||'');
  if(parts[0] === 'fiche' && parts[1]){
    renderFicheDetail(parts[1]);
  } else if(parts[0] === 'aide'){
    renderAidePage();
  } else if(parts[0] === 'anti-patterns'){
    renderAntiPatternsPage();
  } else if(parts[0] === 'annexe'){
    renderAnnexePage();
  } else {
    renderCatalogue();
  }
}
window.addEventListener('hashchange', router);

function setActiveNav(section){
  document.querySelectorAll('.masthead nav a').forEach(a=>{
    a.classList.toggle('active', a.dataset.section === section || (section==='' && a.dataset.section==='catalogue'));
  });
}

// ---------------------------------------------------------
// Masthead — accès direct aux 8 familles depuis n'importe quelle page
// ---------------------------------------------------------
function buildMastheadFamilies(){
  const wrap = document.getElementById('masthead-families');
  if(!wrap) return;
  wrap.innerHTML = '';
  CATALOG.families.forEach(fam=>{
    const btn = h('button',{
      class:'fam-jump', style:`--fam-color:${fam.color}`, title:fam.name+' — '+fam.question,
      onclick:()=>jumpToFamily(fam.id)
    },[fam.id]);
    wrap.appendChild(btn);
  });
  updateMastheadFamiliesActive();
}
function updateMastheadFamiliesActive(){
  const wrap = document.getElementById('masthead-families');
  if(!wrap) return;
  const onlyOne = state.families.size===1 ? [...state.families][0] : null;
  wrap.querySelectorAll('.fam-jump').forEach((btn,i)=>{
    btn.classList.toggle('active', onlyOne===CATALOG.families[i].id);
  });
}
function jumpToFamily(famId){
  state.families = new Set([famId]);
  if(location.hash.replace(/^#\/?/,'') !== ''){
    location.hash = '#/';
  } else {
    renderCatalogue();
  }
  window.scrollTo(0,0);
}

function view(){ return document.getElementById('view'); }

// ---------------------------------------------------------
// Catalogue
// ---------------------------------------------------------
function matchesFilters(f){
  if(!state.families.has(f.family)) return false;
  if(state.coreOnly && !f.core) return false;
  if(state.remote!=='all' && f.remote!==state.remote) return false;
  if(state.fame!=='all' && String(f.fame)!==state.fame) return false;
  if(state.query){
    const q = state.query.toLowerCase();
    const hay = (f.ref+' '+f.title+' '+f.produces+' '+f.origin).toLowerCase();
    if(!hay.includes(q)) return false;
  }
  return true;
}

function renderCatalogue(){
  const filtered = CATALOG.fiches.filter(matchesFilters);

  const root = h('div',{});

  root.appendChild(h('section',{class:'hero'},[
    h('div',{class:'hero-eyebrow'},['Boîte à outils du PMO']),
    h('h1',{},['Catalogue d\u2019animation de réunion & de décision']),
    h('p',{class:'lead'},['72 méthodes de facilitation classées par intention — pas par popularité — avec pour chacune une maquette utilisable en séance. Choisissez d\u2019abord la question à laquelle votre réunion doit répondre.']),
    h('div',{class:'hero-stats'},[
      statEl(CATALOG.fiches.length,'Fiches'),
      statEl(CATALOG.families.length,'Familles'),
      statEl(10,'Méthodes socle'),
    ]),
  ]));

  root.appendChild(buildToolbar(filtered.length));
  root.appendChild(buildSocleBand());

  if(filtered.length===0){
    root.appendChild(h('div',{class:'empty-state'},[
      h('p',{},['Aucune fiche ne correspond à ces filtres.']),
      h('button',{class:'btn-primary', onclick:()=>{ resetFilters(); renderCatalogue(); }},['Réinitialiser les filtres']),
    ]));
  } else {
    CATALOG.families.forEach(fam=>{
      const items = filtered.filter(f=>f.family===fam.id);
      if(items.length===0) return;
      root.appendChild(buildFamilySection(fam, items));
    });
  }

  view().innerHTML = '';
  view().appendChild(root);
  updateMastheadFamiliesActive();
}

function statEl(n,label){ return h('div',{class:'hero-stat'},[h('b',{},[String(n)]), h('span',{},[label])]); }

function resetFilters(){
  state.query=''; state.families = new Set(CATALOG.families.map(f=>f.id));
  state.coreOnly=false; state.remote='all'; state.fame='all';
}

function buildToolbar(count){
  const wrap = h('div',{class:'toolbar'});

  const search = h('input',{type:'text', placeholder:'Rechercher une méthode, un mot-clé…'});
  search.value = state.query;
  search.addEventListener('input', debounce(()=>{ state.query = search.value; renderCatalogue(); focusSearch(); },200));
  const searchStrip = h('div',{class:'search-strip'},[
    h('svg',{width:'16',height:'16',viewBox:'0 0 24 24',fill:'none'},[]), search
  ]);
  searchStrip.querySelector('svg').innerHTML = '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  wrap.appendChild(searchStrip);

  const chips = h('div',{class:'family-chips'});
  const allChip = h('button',{class:'chip'+(state.families.size===CATALOG.families.length?' active':''), onclick:()=>{ state.families = new Set(CATALOG.families.map(f=>f.id)); renderCatalogue(); }},['Toutes les familles']);
  chips.appendChild(allChip);
  CATALOG.families.forEach(fam=>{
    const active = state.families.has(fam.id) && state.families.size < CATALOG.families.length;
    const chip = h('button',{class:'chip'+(active?' active':'')},[
      h('span',{class:'dot', style:`background:${fam.color}`}), fam.id+' · '+fam.name
    ]);
    chip.addEventListener('click', ()=>{
      if(state.families.size===CATALOG.families.length){ state.families = new Set([fam.id]); }
      else if(state.families.has(fam.id) && state.families.size===1){ state.families = new Set(CATALOG.families.map(f=>f.id)); }
      else if(state.families.has(fam.id)){ state.families.delete(fam.id); }
      else { state.families.add(fam.id); }
      renderCatalogue();
    });
    chips.appendChild(chip);
  });
  wrap.appendChild(chips);

  const filtersRow = h('div',{class:'filters-row'});
  const coreLabel = h('label',{class:'core-toggle'},[]);
  const coreCb = h('input',{type:'checkbox'});
  coreCb.checked = state.coreOnly;
  coreCb.addEventListener('change', ()=>{ state.coreOnly = coreCb.checked; renderCatalogue(); });
  coreLabel.appendChild(coreCb); coreLabel.appendChild(document.createTextNode(' Socle recommandé uniquement'));
  filtersRow.appendChild(coreLabel);

  filtersRow.appendChild(chipFilterGroup('Distanciel', state.remote, {all:'Tous', yes:'✅ Natif', degraded:'⚠️ Dégradé', no:'❌ À éviter'}, v=>{ state.remote=v; renderCatalogue(); }));
  filtersRow.appendChild(chipFilterGroup('Notoriété', state.fame, {all:'Toutes', '3':'●●● Grand public', '2':'●●○ Praticiens', '1':'●○○ Confidentiel'}, v=>{ state.fame=v; renderCatalogue(); }));

  filtersRow.appendChild(h('span',{class:'result-count'},[`${count} fiche${count>1?'s':''}`]));
  wrap.appendChild(filtersRow);

  return wrap;
}
function chipFilterGroup(label, val, options, onChange){
  const chipsWrap = h('div',{class:'chip-filter-chips'});
  Object.entries(options).forEach(([v,l])=>{
    chipsWrap.appendChild(h('button',{class:'chip small'+(val===v?' active':''), onclick:()=>onChange(v)},[l]));
  });
  return h('div',{class:'chip-filter-group'},[h('span',{class:'chip-filter-label'},[label]), chipsWrap]);
}
function focusSearch(){ const el = document.querySelector('.search-strip input'); if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }

function buildSocleBand(){
  const core = CATALOG.fiches.filter(f=>f.core);
  const band = h('div',{class:'socle-band'},[
    h('h2',{},['Le socle recommandé']),
    h('p',{},['10 méthodes à faible coût de préparation, animables sans formation spécialisée, qui fonctionnent en distanciel et couvrent l\u2019essentiel des besoins d\u2019un PMO.']),
  ]);
  const list = h('div',{class:'socle-list'});
  core.forEach(f=>{
    const fam = FAM_BY_ID[f.family];
    list.appendChild(h('a',{class:'socle-pill', href:'#/fiche/'+f.ref, style:`background:${fam.color}`},[f.ref, ' '+f.title]));
  });
  band.appendChild(list);
  return band;
}

function buildFamilySection(fam, items){
  const section = h('section',{class:'family-section'});
  const heading = h('div',{class:'family-heading', style:`--fam-color:${fam.color}`},[
    h('span',{class:'fam-letter'},[fam.id]),
    h('h2',{},[fam.name]),
    h('div',{class:'fam-meta'},[fam.question]),
  ]);
  section.appendChild(heading);
  const grid = h('div',{class:'card-grid'});
  items.forEach(f=> grid.appendChild(ficheCard(f, fam)));
  section.appendChild(grid);
  return section;
}

function ficheCard(f, fam){
  const card = h('a',{class:'fiche-card', href:'#/fiche/'+f.ref, style:`--fam-color:${fam.color}`},[
    h('div',{class:'card-top'},[
      h('span',{class:'ref-badge'},[f.ref]),
      h('span',{class:'fame'}, [0,1,2].map(i=>h('i',{class: i<f.fame?'on':''}))),
    ]),
    h('h3',{},[f.title]),
    h('p',{class:'produces'},[f.produces]),
    h('div',{class:'card-foot'},[
      h('span',{},['⏱ '+f.duration]),
      h('span',{},['👥 '+f.group]),
      h('span',{},[remoteIcon(f.remote)]),
    ]),
  ]);
  if(f.core) card.appendChild(h('span',{class:'core-star'},['SOCLE']));
  return card;
}

// ---------------------------------------------------------
// Fiche detail
// ---------------------------------------------------------
let activeTab = 'fiche';

function renderFicheDetail(ref){
  const f = FICHE_BY_REF[ref];
  if(!f){ view().innerHTML = '<div class="empty-state"><p>Fiche introuvable.</p><a href="#/">Retour au catalogue</a></div>'; return; }
  const fam = FAM_BY_ID[f.family];
  activeTab = 'fiche';

  const root = h('div',{});

  const header = h('div',{class:'detail-header', style:`--fam-color:${fam.color}`},[
    h('div',{class:'detail-breadcrumb'},[
      h('a',{href:'#/'},['Catalogue']), ' / ',
      h('a',{href:'#/', onclick:(e)=>{ e.preventDefault(); state.families=new Set([fam.id]); location.hash='#/'; }},[fam.id+' · '+fam.name])
    ]),
    h('div',{class:'detail-titlerow'},[
      h('span',{class:'ref-badge-lg'},[f.ref]),
      h('div',{style:'flex:1;'},[
        h('h1',{},[f.title]),
        h('div',{class:'detail-origin'},[f.origin, '  ·  Notoriété ', dots(f.fame), '  ·  Famille : ', fam.name]),
      ]),
    ]),
    specRow(f),
    f.core ? h('div',{class:'core-flag'},['★ Fait partie du socle recommandé — 10 méthodes à maîtriser en priorité']) : null,
  ]);
  root.appendChild(header);

  const tabbar = h('div',{class:'tabbar'},[
    h('button',{class:'tabbtn active', id:'tab-fiche', style:`--fam-color:${fam.color}`, onclick:()=>switchTab('fiche',f)},['📄 Fiche']),
    h('button',{class:'tabbtn', id:'tab-maquette', style:`--fam-color:${fam.color}`, onclick:()=>switchTab('maquette',f)},['🧩 Maquette interactive']),
  ]);
  root.appendChild(tabbar);
  root.appendChild(fichePager(f, fam));

  const panelFiche = h('div',{class:'tabpanel active', id:'panel-fiche'},[ficheContentEl(f, fam)]);
  const panelMaquette = h('div',{class:'tabpanel', id:'panel-maquette', style:`--fam-color:${fam.color}`},[]);
  root.appendChild(panelFiche);
  root.appendChild(panelMaquette);

  view().innerHTML = '';
  view().appendChild(root);
}

function switchTab(tab, f){
  activeTab = tab;
  document.getElementById('tab-fiche').classList.toggle('active', tab==='fiche');
  document.getElementById('tab-maquette').classList.toggle('active', tab==='maquette');
  document.getElementById('panel-fiche').classList.toggle('active', tab==='fiche');
  document.getElementById('panel-maquette').classList.toggle('active', tab==='maquette');
  if(tab==='maquette'){
    const panel = document.getElementById('panel-maquette');
    if(!panel.dataset.built){
      renderWidget(panel, f);
      panel.dataset.built = '1';
    }
  }
}

function fichePager(f, fam){
  const siblings = CATALOG.fiches
    .filter(x=>x.family===f.family)
    .sort((a,b)=> parseInt(a.ref.slice(1),10) - parseInt(b.ref.slice(1),10));
  const idx = siblings.findIndex(x=>x.ref===f.ref);
  const prev = idx>0 ? siblings[idx-1] : null;
  const next = idx<siblings.length-1 ? siblings[idx+1] : null;

  return h('div',{class:'fiche-pager', style:`--fam-color:${fam.color}`},[
    prev
      ? h('a',{class:'pager-link prev', href:'#/fiche/'+prev.ref},[h('span',{class:'pager-dir'},['← Précédente']), h('span',{class:'pager-title'},[prev.ref+' · '+prev.title])])
      : h('span',{class:'pager-link disabled'},['← Première de la famille']),
    h('span',{class:'pager-progress'},[`${fam.id} · ${idx+1}/${siblings.length}`]),
    next
      ? h('a',{class:'pager-link next', href:'#/fiche/'+next.ref},[h('span',{class:'pager-dir'},['Suivante →']), h('span',{class:'pager-title'},[next.ref+' · '+next.title])])
      : h('span',{class:'pager-link disabled'},['Dernière de la famille →']),
  ]);
}

function specRow(f){
  return h('div',{class:'spec-row'},[
    specCell('Durée', f.duration),
    specCell('Groupe', f.group),
    specCell('Préparation', dots(f.prep)),
    specCell('Animation requise', dots(f.facil)),
    specCell('Distanciel', remoteIcon(f.remote)+' '+remoteLabelShort(f.remote)),
  ]);
}
function remoteLabelShort(r){ return r==='yes'?'Natif':r==='degraded'?'Dégradé':'À éviter'; }
function specCell(k,v){ return h('div',{class:'spec-cell'},[h('span',{class:'k'},[k]), h('span',{class:'v'},[v])]); }

function ficheContentEl(f, fam){
  const wrap = h('div',{class:'fiche-content'});

  const left = h('div',{});
  left.appendChild(block('Ce que ça produit', [h('p',{class:'produces-text'},[f.produces])]));
  left.appendChild(block('Déroulé', [h('p',{class:'deroule-text'},[f.steps])]));
  left.appendChild(block('Bénéfices', [ul(f.benefits, true)]));
  left.appendChild(block('Contraintes & pièges', [ul(f.constraints, false)]));

  const right = h('div',{});
  const useBlock = h('div',{class:'use-grid'});
  if(f.useIf) useBlock.appendChild(h('div',{class:'use-box yes'},[h('b',{},['À utiliser si']), f.useIf]));
  if(f.avoidIf) useBlock.appendChild(h('div',{class:'use-box no'},[h('b',{},['À éviter si']), f.avoidIf]));
  right.appendChild(block('Quand s\u2019en servir', [useBlock]));

  const relatedInFamily = CATALOG.fiches.filter(x=>x.family===f.family && x.ref!==f.ref).slice(0,6);
  if(relatedInFamily.length){
    right.appendChild(block('Autres méthodes — '+FAM_BY_ID[f.family].name, [
      h('ul',{class:'related-list'}, relatedInFamily.map(r=>h('li',{},[
        h('a',{href:'#/fiche/'+r.ref},[h('span',{class:'ref-badge'},[r.ref]), r.title])
      ])))
    ]));
  }

  wrap.appendChild(left);
  wrap.appendChild(right);
  return wrap;
}
function block(title, children){ return h('div',{class:'content-block'},[h('h3',{},[title]), ...children]); }
function ul(items, positive){ return h('ul',{}, (items||[]).filter(Boolean).map(i=>h('li',{},[i]))); }

// ---------------------------------------------------------
// Aide au choix
// ---------------------------------------------------------
function renderAidePage(){
  const root = h('div',{});
  root.appendChild(h('h1',{class:'page-title'},['Aide au choix']));
  root.appendChild(h('p',{class:'page-lead'},['Avant tout : demandez-vous si vous avez vraiment besoin d\u2019une réunion, et qui décide (voir E7 — Vroom-Yetton). Ensuite, partez du besoin, pas de la méthode.']));

  root.appendChild(h('h2',{style:'font-size:17px;margin-bottom:12px;'},['Si votre besoin est…']));
  const table = h('table',{class:'decision-table'});
  table.appendChild(h('tr',{},[h('th',{},['Situation']), h('th',{},['Méthode(s) recommandée(s)'])]));
  CATALOG.decisionTable.forEach(row=>{
    table.appendChild(h('tr',{},[h('td',{},[row.need]), h('td',{class:'route'},[refLinks(row.route)])]));
  });
  root.appendChild(table);

  root.appendChild(h('h2',{style:'font-size:17px;margin-bottom:12px;'},['Séquences prêtes à l\u2019emploi']));
  CATALOG.sequences.forEach(seq=>{
    root.appendChild(h('div',{class:'sequence-card'},[
      h('div',{class:'head'},[h('h3',{},[seq.title]), h('span',{class:'duration'},[seq.duration])]),
      h('div',{class:'steps'},[refLinks(seq.steps)]),
    ]));
  });

  view().innerHTML=''; view().appendChild(root);
}
function refLinks(text){
  // convertit les codes de fiche (A1, B12, H7...) trouvés dans le texte en liens
  const container = h('span',{});
  const re = /\b([A-H]\d{1,2})\b/g;
  let last = 0, m;
  while((m = re.exec(text))){
    if(m.index>last) container.appendChild(document.createTextNode(text.slice(last,m.index)));
    const ref = m[1];
    if(FICHE_BY_REF[ref]) container.appendChild(h('a',{href:'#/fiche/'+ref, style:'font-weight:700;'},[ref]));
    else container.appendChild(document.createTextNode(ref));
    last = m.index+ref.length;
  }
  if(last<text.length) container.appendChild(document.createTextNode(text.slice(last)));
  return container;
}

// ---------------------------------------------------------
// Anti-patterns
// ---------------------------------------------------------
function renderAntiPatternsPage(){
  const root = h('div',{});
  root.appendChild(h('h1',{class:'page-title'},['Les anti-patterns']));
  root.appendChild(h('p',{class:'page-lead'},['Un guide d\u2019animation gagne autant à décrire les erreurs qu\u2019à lister les méthodes. Les huit plus coûteuses.']));
  const grid = h('div',{class:'antipattern-grid'});
  CATALOG.antipatterns.forEach((ap,i)=>{
    grid.appendChild(h('div',{class:'antipattern-card'},[
      h('div',{class:'num'},[String(i+1).padStart(2,'0')]),
      h('h3',{},[ap.title]),
      h('p',{},[ap.body]),
    ]));
  });
  root.appendChild(grid);
  view().innerHTML=''; view().appendChild(root);
}

// ---------------------------------------------------------
// Annexe
// ---------------------------------------------------------
function renderAnnexePage(){
  const root = h('div',{});
  root.appendChild(h('h1',{class:'page-title'},['Annexe — autres approches à connaître']));
  root.appendChild(h('p',{class:'page-lead'},['Non détaillées dans le catalogue interactif, mais utiles à citer en veille ou à explorer selon les contextes.']));
  const grid = h('div',{class:'annexe-grid'});
  CATALOG.annexe.forEach(a=>{
    grid.appendChild(h('div',{class:'annexe-item'},[h('b',{},[a.name]), h('p',{},[a.note])]));
  });
  root.appendChild(grid);
  view().innerHTML=''; view().appendChild(root);
}

// ---------------------------------------------------------
// Boot
// ---------------------------------------------------------
buildMastheadFamilies();
router();
