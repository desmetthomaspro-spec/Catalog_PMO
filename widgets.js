// =========================================================
// Maquettes interactives — 8 moteurs réutilisables
// Chaque fiche pointe vers un type + une config (voir data.js)
// L'état de chaque maquette est persisté en localStorage,
// scindé par référence de fiche (uniquement dans ce navigateur).
// =========================================================

const Store = {
  key(ref){ return 'pmo-widget-' + ref; },
  load(ref, fallback){
    try{
      const raw = localStorage.getItem(this.key(ref));
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  },
  save(ref, state){
    try{ localStorage.setItem(this.key(ref), JSON.stringify(state)); }catch(e){/* quota / privacy mode */}
  },
  reset(ref){ try{ localStorage.removeItem(this.key(ref)); }catch(e){} }
};

function h(tag, attrs, children){
  const node = document.createElement(tag);
  attrs = attrs || {};
  for(const k in attrs){
    if(k === 'class') node.className = attrs[k];
    else if(k === 'html') node.innerHTML = attrs[k];
    else if(k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
    else if(attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
  }
  (children||[]).forEach(c=>{
    if(c === null || c === undefined) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}
function uid(){ return Math.random().toString(36).slice(2,9); }
function wordCount(s){ return (s.trim().match(/\S+/g)||[]).length; }
function debounce(fn, ms){ let t; return function(...a){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), ms); }; }

function resetButton(ref, onReset){
  return h('button', {class:'timer-controls', style:'border:none;background:none;color:var(--ink-faint);font-size:11px;text-decoration:underline;padding:0;margin-bottom:10px;', onclick:()=>{
    if(confirm('Réinitialiser cette maquette ? Le contenu saisi sera perdu.')){ Store.reset(ref); onReset(); }
  }}, ['↺ Réinitialiser la maquette']);
}

// ---------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------
function renderWidget(container, fiche){
  container.innerHTML = '';
  container.style.setProperty('--fam-color', 'var(--fam-'+fiche.family+')');
  const w = fiche.widget;
  const map = {
    sticky: renderSticky, matrix: renderMatrix, vote: renderVote,
    timer: renderTimer, template: renderTemplate, flow: renderFlow,
    demo: renderDemo, calculator: renderCalculator
  };
  const fn = map[w.type];
  const table = h('div', {class:'workshop-table'}, []);
  container.appendChild(table);
  if(fn) fn(table, fiche); else table.appendChild(h('p',{},['Maquette indisponible.']));
}

// ===========================================================
// 1. STICKY — tableau de post-it en zones
// ===========================================================
function renderSticky(root, fiche){
  const cfg = fiche.widget;
  const defaults = { notes: [], clusters: [] };
  let state = Store.load(fiche.ref, defaults);
  let timerRemaining = cfg.timer || 0;
  let timerRunning = false;
  let timerInterval = null;

  function save(){ Store.save(fiche.ref, state); }
  function rerender(){ draw(); }

  function draw(){
    root.innerHTML = '';
    root.appendChild(resetButton(fiche.ref, ()=>{ state = {notes:[],clusters:[]}; draw(); }));
    if(cfg.info) root.appendChild(h('div',{class:'widget-info'},[cfg.info]));

    if(cfg.timer){
      const badge = h('span',{},[fmtClock(timerRemaining)]);
      const wrap = h('div',{class:'timer-badge'},[
        '⏱ ', badge,
        h('button',{onclick:()=>{ timerRunning=!timerRunning; toggleBtn.textContent = timerRunning?'Pause':'Démarrer'; runTimer(badge); }},['Démarrer']),
      ]);
      const toggleBtn = wrap.querySelectorAll('button')[0];
      root.appendChild(wrap);
    }

    if(cfg.mode === 'timeline'){
      drawTimeline();
      return;
    }

    const zonesWrap = h('div',{class:'sticky-zones'});
    (cfg.zones||[]).forEach(zone=>{
      const notesInZone = state.notes.filter(n=>n.zone===zone.id && !n.clusterId);
      const zoneEl = h('div',{class:'sticky-zone', 'data-zone':zone.id});
      let ratioWarn = null;
      if(cfg.warnRatio && cfg.warnRatio.zone === zone.id){
        const total = state.notes.length || 1;
        const ratio = notesInZone.length/total;
        if(ratio > cfg.warnRatio.max && state.notes.length >= 4){
          ratioWarn = h('div',{style:'color:var(--warn);font-size:11.5px;margin-top:6px;font-weight:600;'},[cfg.warnRatio.message]);
        }
      }
      zoneEl.appendChild(h('h4',{},[zone.label, h('span',{class:'zone-count'},['('+notesInZone.length+')'])]));
      const notesWrap = h('div',{class:'sticky-notes-wrap'});
      notesInZone.forEach(n=> notesWrap.appendChild(noteEl(n)));
      zoneEl.appendChild(notesWrap);
      zoneEl.appendChild(addRow(zone.id));
      if(ratioWarn) zoneEl.appendChild(ratioWarn);

      zoneEl.addEventListener('dragover', e=>{ e.preventDefault(); zoneEl.classList.add('dragover'); });
      zoneEl.addEventListener('dragleave', ()=> zoneEl.classList.remove('dragover'));
      zoneEl.addEventListener('drop', e=>{
        e.preventDefault(); zoneEl.classList.remove('dragover');
        const id = e.dataTransfer.getData('text/plain');
        const note = state.notes.find(n=>n.id===id);
        if(note){ note.zone = zone.id; note.clusterId = null; save(); draw(); }
      });
      zonesWrap.appendChild(zoneEl);
    });
    root.appendChild(zonesWrap);

    if(cfg.mode === 'group'){
      root.appendChild(drawClusters());
    }
  }

  function drawTimeline(){
    const wrap = h('div',{});
    const notesWrap = h('div',{class:'sticky-notes-wrap', style:'flex-direction:row;flex-wrap:wrap;'});
    state.notes.forEach(n=> notesWrap.appendChild(noteEl(n)));
    wrap.appendChild(notesWrap);
    wrap.appendChild(addRow(cfg.zones[0].id, true));
    root.appendChild(wrap);
  }

  function drawClusters(){
    const wrap = h('div',{class:'clusters-wrap'});
    wrap.appendChild(h('h4',{style:'font-family:var(--font-mono);font-size:12px;text-transform:uppercase;color:var(--ink-soft);'},['Groupes (glissez les post-it ici)']));
    (state.clusters||[]).forEach(cl=>{
      const clEl = h('div',{class:'cluster','data-cluster':cl.id});
      const notesInCluster = state.notes.filter(n=>n.clusterId===cl.id);
      const nameSpan = h('span',{contenteditable:'true', style:'outline:none;border-bottom:1px dashed var(--accent);'},[cl.name]);
      nameSpan.addEventListener('blur', ()=>{ cl.name = nameSpan.textContent.trim()||'Groupe'; save(); });
      clEl.appendChild(h('h5',{},[nameSpan, h('span',{class:'zone-count'},['('+notesInCluster.length+')'])]));
      const nw = h('div',{class:'sticky-notes-wrap', style:'flex-direction:row;flex-wrap:wrap;'});
      notesInCluster.forEach(n=> nw.appendChild(noteEl(n)));
      clEl.appendChild(nw);
      clEl.addEventListener('dragover', e=>{ e.preventDefault(); clEl.style.background='rgba(31,111,99,0.12)'; });
      clEl.addEventListener('dragleave', ()=> clEl.style.background='');
      clEl.addEventListener('drop', e=>{
        e.preventDefault(); clEl.style.background='';
        const id = e.dataTransfer.getData('text/plain');
        const note = state.notes.find(n=>n.id===id);
        if(note){ note.clusterId = cl.id; save(); draw(); }
      });
      wrap.appendChild(clEl);
    });
    const addBtn = h('button',{class:'btn-primary', style:'font-size:12.5px;padding:6px 14px;', onclick:()=>{
      state.clusters = state.clusters || [];
      state.clusters.push({id: uid(), name:'Nouveau groupe'});
      save(); draw();
    }},['+ Nouveau groupe']);
    wrap.appendChild(addBtn);
    return wrap;
  }

  function addRow(zoneId, timelineMode){
    const input = h('input',{type:'text', placeholder: timelineMode ? 'Événement…' : 'Ajouter un post-it…'});
    const hint = h('div',{style:'font-size:10.5px;color:var(--warn);margin-top:3px;display:none;'},[]);
    const commit = ()=>{
      const text = input.value.trim();
      if(!text) return;
      if(cfg.maxWords && wordCount(text) > cfg.maxWords){
        hint.style.display='block'; hint.textContent = `⚠️ ${cfg.maxWords} mots maximum — reformulez.`; return;
      }
      const note = { id: uid(), zone: zoneId, text, cut:false, score:null, clusterId:null };
      if(timelineMode) note.mood = 0;
      state.notes.push(note);
      save(); input.value=''; draw();
    };
    input.addEventListener('keydown', e=>{ if(e.key==='Enter') commit(); });
    const row = h('div',{class:'add-note-row'},[input, h('button',{onclick:commit},['Ajouter'])]);
    const box = h('div',{},[row, hint]);
    return box;
  }

  function noteEl(n){
    const del = h('button',{class:'note-del', title:'Supprimer', onclick:()=>{ state.notes = state.notes.filter(x=>x.id!==n.id); save(); draw(); }},['✕']);
    const textSpan = h('span',{contenteditable:'true', style:'outline:none;display:block;'},[n.text]);
    textSpan.addEventListener('blur', ()=>{ n.text = textSpan.textContent.trim()||n.text; save(); });
    const note = h('div',{class:'note'+(n.cut?' cut':''), draggable:'true'}, [del, textSpan]);
    note.addEventListener('dragstart', e=> e.dataTransfer.setData('text/plain', n.id));

    if(cfg.mode === 'toggle'){
      const labels = cfg.toggleLabels || ['Garder','Supprimer'];
      const btn = h('button',{onclick:(e)=>{ e.stopPropagation(); n.cut = !n.cut; save(); draw(); }},[n.cut?('↺ '+labels[0]):('✕ '+labels[1])]);
      note.appendChild(h('div',{class:'note-toggle'},[btn]));
    }
    if(cfg.mode === 'scored'){
      const scoreWrap = h('div',{class:'note-score'});
      for(let i=1;i<=5;i++){
        scoreWrap.appendChild(h('button',{class:n.score===i?'sel':'', onclick:(e)=>{ e.stopPropagation(); n.score = (n.score===i)?null:i; save(); draw(); }},[String(i)]));
      }
      note.appendChild(scoreWrap);
    }
    return note;
  }

  function fmtClock(s){
    const m = Math.floor(Math.max(s,0)/60), sec = Math.max(s,0)%60;
    return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  }
  function runTimer(badge){
    if(timerInterval) clearInterval(timerInterval);
    if(!timerRunning) return;
    timerInterval = setInterval(()=>{
      if(!timerRunning){ clearInterval(timerInterval); return; }
      timerRemaining = Math.max(0, timerRemaining-1);
      badge.textContent = fmtClock(timerRemaining);
      if(timerRemaining===0){ timerRunning=false; clearInterval(timerInterval); badge.parentElement.style.background='var(--warn)'; }
    },1000);
  }

  draw();
}

// ===========================================================
// 2. MATRIX — placement libre à deux axes
// ===========================================================
function renderMatrix(root, fiche){
  const cfg = fiche.widget;
  let state = Store.load(fiche.ref, { points: [] });
  function save(){ Store.save(fiche.ref, state); }

  function draw(){
    root.innerHTML = '';
    root.appendChild(resetButton(fiche.ref, ()=>{ state = {points:[]}; draw(); }));
    if(cfg.note) root.appendChild(h('div',{class:'widget-info'},[cfg.note]));

    const wrap = h('div',{class:'matrix-wrap'});
    if(cfg.quadrants && cfg.quadrants.length===4){
      const positions = [
        {top:'8px',left:'10px'}, {top:'8px',right:'10px'},
        {bottom:'8px',left:'10px'}, {bottom:'8px',right:'10px'}
      ];
      cfg.quadrants.forEach((label,i)=>{
        const styleStr = Object.entries(positions[i]).map(([k,v])=>`${k}:${v}`).join(';');
        wrap.appendChild(h('div',{class:'matrix-quadrant-label', style:styleStr},[label]));
      });
    }
    wrap.appendChild(h('div',{class:'matrix-axis-label matrix-axis-x'},[cfg.xLabel||'']));
    wrap.appendChild(h('div',{class:'matrix-axis-label matrix-axis-y'},[cfg.yLabel||'']));

    state.points.forEach(p=>{
      const del = h('button',{class:'note-del', onclick:(e)=>{ e.stopPropagation(); state.points = state.points.filter(x=>x.id!==p.id); save(); draw(); }},['✕']);
      const label = h('span',{},[p.label]);
      const pt = h('div',{class:'matrix-point', style:`left:${p.x}%;top:${100-p.y}%;`},[label, del]);
      pt.addEventListener('pointerdown', (e)=>{
        e.preventDefault();
        const rect = wrap.getBoundingClientRect();
        function move(ev){
          let x = ((ev.clientX-rect.left)/rect.width)*100;
          let y = 100-((ev.clientY-rect.top)/rect.height)*100;
          x = Math.max(2,Math.min(98,x)); y = Math.max(2,Math.min(98,y));
          pt.style.left = x+'%'; pt.style.top = (100-y)+'%';
          p.x = x; p.y = y;
        }
        function up(){ document.removeEventListener('pointermove',move); document.removeEventListener('pointerup',up); save(); }
        document.addEventListener('pointermove',move);
        document.addEventListener('pointerup',up);
      });
      wrap.appendChild(pt);
    });
    root.appendChild(wrap);

    const input = h('input',{type:'text', placeholder:'Nom de l\u2019élément à placer…'});
    const addBtn = h('button',{onclick:()=>{
      const label = input.value.trim(); if(!label) return;
      state.points.push({id: uid(), label, x:50, y:50});
      save(); input.value=''; draw();
    }},['Ajouter et positionner']);
    input.addEventListener('keydown', e=>{ if(e.key==='Enter') addBtn.click(); });
    root.appendChild(h('div',{class:'matrix-add-row'},[input, addBtn]));
    root.appendChild(h('div',{class:'matrix-hint'},['Glissez chaque étiquette pour la positionner sur les deux axes.']));
  }
  draw();
}

// ===========================================================
// 3. VOTE — dots / scale / cards / budget / score-rounds
// ===========================================================
function renderVote(root, fiche){
  const cfg = fiche.widget;
  const defaults = { options: [], votes:{}, scaleVotes: [], cardLog: [], purchased: {}, budgetLeft: cfg.defaultBudget||100, scoreRounds:{} };
  let state = Store.load(fiche.ref, defaults);
  state.options = state.options || [];
  function save(){ Store.save(fiche.ref, state); }

  function draw(){
    root.innerHTML = '';
    root.appendChild(resetButton(fiche.ref, ()=>{ state = JSON.parse(JSON.stringify(defaults)); draw(); }));

    if(cfg.mode === 'dots') return drawDots();
    if(cfg.mode === 'scale') return drawScale();
    if(cfg.mode === 'cards') return drawCards();
    if(cfg.mode === 'budget') return drawBudget();
    if(cfg.mode === 'score-rounds') return drawScoreRounds();
  }

  function optionAdder(placeholder, extra){
    const input = h('input',{type:'text', placeholder: placeholder||'Ajouter une option…'});
    const btn = h('button',{onclick:()=>{
      const v = input.value.trim(); if(!v) return;
      const opt = {id: uid(), label:v};
      if(extra) Object.assign(opt, extra());
      state.options.push(opt); save(); input.value=''; draw();
    }},['Ajouter']);
    input.addEventListener('keydown', e=>{ if(e.key==='Enter') btn.click(); });
    return h('div',{class:'matrix-add-row', style:'margin-bottom:16px;'},[input, btn]);
  }

  function drawDots(){
    const n = state.options.length || 1;
    const perPerson = cfg.autoVotesPerPerson ? Math.max(1, Math.ceil(n/3)) : (cfg.votesPerPerson||3);
    state.remaining = state.remaining===undefined ? perPerson : state.remaining;
    root.appendChild(h('div',{class:'widget-info'},[`Chaque votant dispose de ${perPerson} gommettes (N/3). Cliquez pour distribuer, puis « Votant suivant » pour simuler une nouvelle personne.`]));
    root.appendChild(h('div',{class:'timer-badge'},[`Gommettes restantes : ${state.remaining}`,
      h('button',{onclick:()=>{ state.remaining = perPerson; save(); draw(); }},['Votant suivant ↻'])]));
    const max = Math.max(1, ...state.options.map(o=>state.votes[o.id]||0));
    state.options.forEach(o=>{
      const count = state.votes[o.id]||0;
      root.appendChild(h('div',{class:'vote-option'},[
        h('span',{class:'label'},[o.label]),
        h('div',{class:'vote-bar-wrap'},[h('div',{class:'vote-bar', style:`width:${(count/max)*100}%`})]),
        h('span',{class:'vote-count'},[String(count)]),
        h('button',{class:'vote-dot-btn', disabled: state.remaining<=0, onclick:()=>{
          state.votes[o.id] = (state.votes[o.id]||0)+1; state.remaining--; save(); draw();
        }},['+']),
      ]));
    });
    root.appendChild(optionAdder('Ajouter une option à voter…'));
  }

  function drawScale(){
    const labels = cfg.scaleLabels || [];
    root.appendChild(h('div',{class:'widget-info'},['Chaque clic simule un votant qui lève la main simultanément.']));
    const row = h('div',{class:'scale-row'});
    for(let i=0;i<=cfg.scaleMax;i++){
      const col = h('div',{style:'flex:1;'});
      col.appendChild(h('button',{class:'scale-btn', style:'width:100%;', onclick:()=>{ state.scaleVotes.push(i); save(); draw(); }},[String(i)]));
      if(labels[i]) col.appendChild(h('div',{class:'scale-caption'},[labels[i]]));
      row.appendChild(col);
    }
    root.appendChild(row);
    const votes = state.scaleVotes||[];
    if(votes.length){
      const avg = (votes.reduce((a,b)=>a+b,0)/votes.length).toFixed(1);
      root.appendChild(h('p',{style:'font-family:var(--font-mono);font-size:13px;'},[`${votes.length} vote(s) — moyenne ${avg}`]));
      const low = votes.filter(v=>v < cfg.scaleMax-2).length;
      if(low>0) root.appendChild(h('div',{class:'widget-info', style:'background:rgba(161,61,61,0.08);border-color:rgba(161,61,61,.3);'},[`${low} vote(s) bas — invitez ces personnes à expliquer leur réserve avant de conclure.`]));
      root.appendChild(h('button',{class:'btn-primary', style:'background:var(--ink-faint);', onclick:()=>{ state.scaleVotes=[]; save(); draw(); }},['Effacer les votes']));
    }
  }

  function drawCards(){
    const values = cfg.cardValues;
    state.picked = state.picked===undefined ? null : state.picked;
    root.appendChild(h('div',{class:'widget-info'},['Choisissez votre carte, puis révélez. Répétez « Votant suivant » pour chaque participant avant de comparer.']));
    const hand = h('div',{class:'card-hand'});
    values.forEach(v=>{
      hand.appendChild(h('button',{class:'poker-card'+(state.picked===v?' sel':''), onclick:()=>{ state.picked=v; draw(); }},[String(v)]));
    });
    root.appendChild(hand);
    root.appendChild(h('button',{class:'btn-primary', onclick:()=>{
      if(state.picked===null) return;
      state.cardLog.push(state.picked); state.picked=null; save(); draw();
    }},['Révéler ce vote']));
    if(state.cardLog.length){
      root.appendChild(h('div',{style:'margin-top:16px;'},[
        h('p',{style:'font-family:var(--font-mono);font-size:13px;'},[`Votes révélés : ${state.cardLog.join(', ')}`]),
        h('button',{style:'font-size:12px;background:none;border:none;color:var(--ink-faint);text-decoration:underline;', onclick:()=>{ state.cardLog=[]; save(); draw(); }},['Effacer et relancer un tour']),
      ]));
    }
  }

  function drawBudget(){
    state.budgetLeft = state.budgetLeft===undefined ? (cfg.defaultBudget||100) : state.budgetLeft;
    root.appendChild(h('div',{class:'widget-info'},['Budget commun du groupe : négociez ensemble ce que vous achetez.']));
    root.appendChild(h('div',{class:'vote-budget-bar'},[`Budget restant : ${state.budgetLeft}`]));
    state.options.forEach(o=>{
      const bought = !!state.purchased[o.id];
      root.appendChild(h('div',{class:'vote-option'},[
        h('span',{class:'label'},[o.label + '  —  '+ (o.price||0)+' pts']),
        h('button',{class:'btn-primary', style: bought?'background:var(--good);':'', onclick:()=>{
          if(bought){ state.purchased[o.id]=false; state.budgetLeft += (o.price||0); }
          else{ if((o.price||0) > state.budgetLeft) return alert('Budget insuffisant — négociez une alliance ou renoncez.'); state.purchased[o.id]=true; state.budgetLeft -= (o.price||0); }
          save(); draw();
        }},[bought?'Achetée ✓':'Acheter']),
      ]));
    });
    root.appendChild(optionAdderWithPrice());
  }
  function optionAdderWithPrice(){
    const nameInput = h('input',{type:'text', placeholder:'Fonctionnalité…', style:'flex:2;'});
    const priceInput = h('input',{type:'number', placeholder:'Prix', style:'flex:1;'});
    const btn = h('button',{onclick:()=>{
      const v = nameInput.value.trim(); if(!v) return;
      state.options.push({id:uid(), label:v, price: Number(priceInput.value)||10});
      save(); nameInput.value=''; priceInput.value=''; draw();
    }},['Ajouter']);
    return h('div',{class:'matrix-add-row'},[nameInput, priceInput, btn]);
  }

  function drawScoreRounds(){
    root.appendChild(h('div',{class:'widget-info'},[`Simulez ${cfg.rounds} tours de circulation : cliquez la note (1–5) reçue à chaque tour. Les cartes à 21–25 points sont retenues.`]));
    state.options.forEach(o=>{
      const total = state.scoreRounds[o.id]||0;
      const row = h('div',{class:'vote-option'},[
        h('span',{class:'label'},[o.label]),
        h('div',{class:'note-score'},[1,2,3,4,5].map(i=>h('button',{onclick:()=>{ state.scoreRounds[o.id]=(state.scoreRounds[o.id]||0)+i; save(); draw(); }},[String(i)]))),
        h('span',{class:'vote-count', style: total>=21?'color:var(--good);font-weight:800;':''},[String(total)]),
      ]);
      root.appendChild(row);
    });
    root.appendChild(optionAdder('Ajouter une carte / idée…'));
    root.appendChild(h('button',{style:'font-size:12px;background:none;border:none;color:var(--ink-faint);text-decoration:underline;margin-top:8px;', onclick:()=>{ state.scoreRounds={}; save(); draw(); }},['Remettre les scores à zéro']));
  }

  draw();
}

// ===========================================================
// 4. TIMER — séquence phasée avec minuteur + capture
// ===========================================================
function renderTimer(root, fiche){
  const cfg = fiche.widget;
  const phases = cfg.phases;
  const defaults = { current:0, remaining: phases[0].seconds||0, running:false, captures:{}, board:{} };
  let state = Store.load(fiche.ref, defaults);
  let interval = null;

  function save(){ Store.save(fiche.ref, state); }
  function fmt(s){ const m=Math.floor(Math.max(s,0)/60), sec=Math.max(s,0)%60; return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0'); }

  function goPhase(i){
    if(i<0||i>=phases.length) return;
    state.current = i; state.running=false;
    state.remaining = phases[i].seconds||0;
    save(); draw();
  }

  function draw(){
    root.innerHTML = '';
    root.appendChild(resetButton(fiche.ref, ()=>{ state = JSON.parse(JSON.stringify(defaults)); draw(); }));
    const pips = h('div',{class:'timer-phases'});
    phases.forEach((p,i)=>{
      pips.appendChild(h('button',{class:'phase-pip'+(i<state.current?' done':i===state.current?' current':''), title:p.title, onclick:()=>goPhase(i)},[String(i+1)]));
    });
    root.appendChild(pips);

    const phase = phases[state.current];
    root.appendChild(h('h4',{style:'font-family:var(--font-display);font-size:16px;margin-bottom:8px;'},[`${state.current+1}. ${phase.title}`]));
    root.appendChild(h('div',{class:'phase-instruction'},[phase.instruction||'']));

    const isManual = cfg.manual || !phase.seconds;
    const display = h('div',{class:'timer-display'});
    const clock = h('div',{class: 'timer-clock'+(isManual?' manual':'')},[isManual ? 'Rythme libre' : fmt(state.remaining)]);
    display.appendChild(clock);
    const controls = h('div',{class:'timer-controls'});
    if(!isManual){
      controls.appendChild(h('button',{class:'primary', onclick:()=>{
        state.running = !state.running; save(); draw(); runInterval(clock);
      }},[state.running?'⏸ Pause':'▶ Démarrer']));
      controls.appendChild(h('button',{onclick:()=>{ state.remaining = phase.seconds; state.running=false; save(); draw(); }},['↺ Remettre']));
    }
    if(phase.repeatable || cfg.repeatable){
      controls.appendChild(h('button',{onclick:()=>{ state.remaining = phase.seconds||0; state.running=false; save(); draw(); }},['⟳ Relancer (sujet/personne suivant·e)']));
    }
    controls.appendChild(h('button',{disabled: state.current===0, onclick:()=>goPhase(state.current-1)},['← Précédent']));
    controls.appendChild(h('button',{disabled: state.current===phases.length-1, onclick:()=>goPhase(state.current+1)},['Suivant →']));
    display.appendChild(controls);
    root.appendChild(display);

    if(phase.capture){
      const ta = h('textarea',{placeholder: phase.capture.label||'Notes…'},[]);
      ta.value = state.captures[state.current]||'';
      ta.addEventListener('input', debounce(()=>{ state.captures[state.current]=ta.value; save(); },300));
      root.appendChild(h('div',{class:'phase-capture'},[h('label',{style:'font-family:var(--font-mono);font-size:11.5px;color:var(--ink-soft);display:block;margin-bottom:5px;'},[phase.capture.label||'Notes']), ta]));
    }

    if(cfg.board){
      root.appendChild(h('h4',{style:'font-family:var(--font-mono);font-size:12px;text-transform:uppercase;color:var(--ink-soft);margin:18px 0 8px;'},['Tableau partagé']));
      const zonesWrap = h('div',{class:'sticky-zones'});
      cfg.board.zones.forEach(zone=>{
        state.board[zone.id] = state.board[zone.id]||[];
        const zEl = h('div',{class:'sticky-zone'});
        zEl.appendChild(h('h4',{},[zone.label]));
        const nw = h('div',{class:'sticky-notes-wrap'});
        state.board[zone.id].forEach(text=>{
          nw.appendChild(h('div',{class:'note'},[text]));
        });
        zEl.appendChild(nw);
        const input = h('input',{type:'text', placeholder:'Ajouter…'});
        const commit = ()=>{ const v=input.value.trim(); if(!v) return; state.board[zone.id].push(v); save(); input.value=''; draw(); };
        input.addEventListener('keydown', e=>{ if(e.key==='Enter') commit(); });
        zEl.appendChild(h('div',{class:'add-note-row'},[input, h('button',{onclick:commit},['+'])]));
        zonesWrap.appendChild(zEl);
      });
      root.appendChild(zonesWrap);
    }
  }

  function runInterval(clock){
    if(interval) clearInterval(interval);
    if(!state.running) return;
    interval = setInterval(()=>{
      if(!state.running){ clearInterval(interval); return; }
      state.remaining = Math.max(0, state.remaining-1);
      clock.textContent = fmt(state.remaining);
      save();
      if(state.remaining===0){ state.running=false; clearInterval(interval); clock.style.background='var(--warn)'; }
    },1000);
  }

  draw();
}

// ===========================================================
// 5. TEMPLATE — gabarit structuré (canvas, formulaire, tableau)
// ===========================================================
function renderTemplate(root, fiche){
  const cfg = fiche.widget;
  const defaults = { values: {}, saved: [] };
  let state = Store.load(fiche.ref, defaults);
  state.values = state.values || {};
  function save(){ Store.save(fiche.ref, state); }

  function draw(){
    root.innerHTML = '';
    root.appendChild(resetButton(fiche.ref, ()=>{ state = {values:{}, saved: state.saved||[]}; draw(); }));

    if(cfg.tableMode){ return drawTable(); }
    if(cfg.cloudMode){ return drawCloud(); }

    const grid = h('div',{class:'template-grid'});
    cfg.fields.forEach(f=>{
      grid.appendChild(fieldEl(f));
    });
    root.appendChild(grid);

    if(cfg.saveToList){
      root.appendChild(h('div',{class:'template-actions'},[
        h('button',{class:'btn-primary', onclick:()=>{
          const titleVal = state.values[cfg.listTitleField] || 'Sans titre';
          state.saved.push({ ...state.values, _title: titleVal, _ts: new Date().toLocaleDateString('fr-FR') });
          state.values = {};
          save(); draw();
        }},['Enregistrer dans le registre']),
      ]));
      if(state.saved.length){
        const list = h('div',{class:'saved-list'});
        state.saved.slice().reverse().forEach((s)=>{
          list.appendChild(h('div',{class:'saved-item'},[
            h('b',{},[s._title]), ' — ', s._ts,
            h('div',{style:'margin-top:4px;color:var(--ink-soft);'},[Object.entries(s).filter(([k])=>!k.startsWith('_')).map(([k,v])=>v).filter(Boolean).slice(0,2).join(' · ')])
          ]));
        });
        root.appendChild(h('h4',{style:'font-family:var(--font-mono);font-size:12px;text-transform:uppercase;color:var(--ink-soft);margin:18px 0 8px;'},['Registre']));
        root.appendChild(list);
      }
    }
  }

  function fieldEl(f){
    const id = 'f_'+f.id;
    const label = h('label',{for:id},[f.label]);
    let input;
    if(f.type==='textarea'){ input = h('textarea',{id, rows:4}); input.value = state.values[f.id]||''; }
    else if(f.type==='select'){
      input = h('select',{id}, (f.options||[]).map(o=>h('option',{value:o},[o])));
      input.value = state.values[f.id]||(f.options||[])[0];
    } else { input = h('input',{type:'text', id}); input.value = state.values[f.id]||''; }
    input.addEventListener('input', debounce(()=>{ state.values[f.id]=input.value; save(); },250));
    return h('div',{class:'template-field'},[label, input]);
  }

  function drawTable(){
    const table = h('table',{class:'kt-table'});
    const headRow = h('tr',{},[h('th',{},[''])].concat(cfg.cols.map(c=>h('th',{},[c]))));
    table.appendChild(headRow);
    cfg.rows.forEach(r=>{
      const tr = h('tr',{},[h('th',{},[r])]);
      cfg.cols.forEach(c=>{
        const key = r+'|'+c;
        const ta = h('textarea',{});
        ta.value = state.values[key]||'';
        ta.addEventListener('input', debounce(()=>{ state.values[key]=ta.value; save(); },250));
        tr.appendChild(h('td',{},[ta]));
      });
      table.appendChild(tr);
    });
    root.appendChild(table);
  }

  function drawCloud(){
    const map = {objectif:'obj', besoinA:'bA', besoinB:'bB', prerequisA:'pA', prerequisB:'pB', hypothese:'hyp'};
    const grid = h('div',{class:'cloud-diagram'});
    cfg.fields.forEach(f=>{
      const cls = map[f.id]||'';
      const fEl = fieldEl(f);
      fEl.classList.add(cls);
      grid.appendChild(fEl);
    });
    root.appendChild(h('p',{style:'font-size:12px;color:var(--ink-faint);margin-bottom:10px;'},['Objectif ← Besoins légitimes ← Prérequis contradictoires. Cherchez l\u2019hypothèse à invalider.']));
    root.appendChild(grid);
  }

  draw();
}

// ===========================================================
// 6. FLOW — arbre de décision / classification
// ===========================================================
function renderFlow(root, fiche){
  const cfg = fiche.widget;
  let node = cfg.tree ? cfg.tree.start : null;
  let step1 = null; // Kano
  const log = [];

  const KANO_TABLE = {
    // [functional][dysfunctional] -> category
    0:{0:'Q',1:'A',2:'A',3:'A',4:'O'},
    1:{0:'R',1:'Q',2:'I',3:'I',4:'M'},
    2:{0:'R',1:'R',2:'Q',3:'Q',4:'M'},
    3:{0:'R',1:'R',2:'Q',3:'Q',4:'M'},
    4:{0:'R',1:'R',2:'R',3:'R',4:'Q'},
  };
  const KANO_LABELS = { A:'Attractive — enchante sans manquer', O:'Proportionnelle — plus il y en a, mieux c\u2019est', M:'Obligatoire — son absence irrite', I:'Indifférente', R:'Inversée — vérifiez l\u2019énoncé', Q:'Réponse douteuse — reposez la question' };

  function draw(){
    root.innerHTML = '';
    if(cfg.tree) return drawTree();
    return drawKano();
  }

  function drawTree(){
    if(node.startsWith('r') && cfg.tree.results[node]){
      const r = cfg.tree.results[node];
      root.appendChild(h('div',{class:'flow-result'},[
        h('h4',{},[r.title]), h('p',{},[r.desc]),
        h('button',{onclick:()=>{ node = cfg.tree.start; draw(); }},['↺ Recommencer'])
      ]));
      return;
    }
    const n = cfg.tree.nodes[node];
    const opts = h('div',{class:'flow-options'});
    n.options.forEach(o=>{
      opts.appendChild(h('button',{onclick:()=>{ node = o.next; draw(); }},[o.label]));
    });
    root.appendChild(h('div',{class:'flow-question'},[h('h4',{},[n.text]), opts]));
  }

  function drawKano(){
    if(step1===null){
      const opts = h('div',{class:'flow-options'});
      (cfg.options||['J\u2019aime ça','Je m\u2019y attends','Neutre','Je tolère','Je n\u2019aime pas']).forEach((label,i)=>{
        opts.appendChild(h('button',{onclick:()=>{ step1=i; draw(); }},[label]));
      });
      root.appendChild(h('div',{class:'flow-question'},[h('h4',{},[cfg.question||'Si la fonctionnalité EST présente…']), opts]));
    } else {
      const opts = h('div',{class:'flow-options'});
      (cfg.options2||cfg.options||['J\u2019aime ça','Je m\u2019y attends','Neutre','Je tolère','Je n\u2019aime pas']).forEach((label,i)=>{
        opts.appendChild(h('button',{onclick:()=>{
          const cat = KANO_TABLE[step1][i];
          log.push(cat);
          root.innerHTML='';
          root.appendChild(h('div',{class:'flow-result'},[
            h('h4',{},['Catégorie : '+KANO_LABELS[cat]]),
            h('button',{onclick:()=>{ step1=null; draw(); }},['Classer une autre fonctionnalité'])
          ]));
          if(log.length){
            const counts = {};
            log.forEach(c=>counts[c]=(counts[c]||0)+1);
            root.appendChild(h('div',{class:'flow-log'}, Object.entries(counts).map(([c,n])=>h('div',{class:'flow-log-item'},[`${KANO_LABELS[c]} : ${n}`]))));
          }
        }},[label]));
      });
      root.appendChild(h('div',{class:'flow-question'},[h('h4',{},[cfg.question2||'Si la fonctionnalité est ABSENTE…']), opts]));
    }
  }

  draw();
}

// ===========================================================
// 7. DEMO — pas-à-pas commenté (script / posture / exemple)
// ===========================================================
function renderDemo(root, fiche){
  const cfg = fiche.widget;
  const steps = cfg.steps;
  let i = 0;

  function draw(){
    root.innerHTML = '';
    if(cfg.info) root.appendChild(h('div',{class:'widget-info'},[cfg.info]));
    const bar = h('div',{class:'demo-progress'}, steps.map((s,idx)=>h('span',{class: idx<=i?'done':''})));
    root.appendChild(bar);
    const s = steps[i];
    const card = h('div',{class:'demo-step'},[
      h('h4',{},[s.title]),
      h('div',{class:'body'},[s.body||'']),
    ]);
    if(s.example) card.appendChild(h('div',{class:'example'},[s.example]));
    root.appendChild(card);
    root.appendChild(h('div',{class:'demo-nav'},[
      h('button',{disabled: i===0, onclick:()=>{ i--; draw(); }},['← Précédent']),
      h('span',{class:'mono', style:'align-self:center;font-size:12.5px;color:var(--ink-faint);'},[`${i+1} / ${steps.length}`]),
      h('button',{disabled: i===steps.length-1, onclick:()=>{ i++; draw(); }},['Suivant →']),
    ]));
  }
  draw();
}

// ===========================================================
// 8. CALCULATOR — tableau chiffré (WSJF, AMDEC, Pugh)
// ===========================================================
function renderCalculator(root, fiche){
  const cfg = fiche.widget;
  if(cfg.matrixMode) return renderPughCalculator(root, fiche);

  const defaults = { rows: [] };
  let state = Store.load(fiche.ref, defaults);
  function save(){ Store.save(fiche.ref, state); }

  function computeScore(vals){
    try{
      const names = cfg.columns.filter(c=>c.type==='number').map(c=>c.id);
      const fn = new Function(...names, 'return ('+cfg.formula+');');
      const args = names.map(n=> Number(vals[n])||0);
      const r = fn(...args);
      return isFinite(r) ? r : 0;
    }catch(e){ return 0; }
  }

  function draw(){
    root.innerHTML = '';
    root.appendChild(resetButton(fiche.ref, ()=>{ state = {rows:[]}; draw(); }));
    const table = h('table',{class:'calc-table'});
    const head = h('tr',{}, cfg.columns.map(c=>h('th',{},[c.label])).concat([h('th',{},[cfg.resultLabel||'Score']), h('th',{},[''])]));
    table.appendChild(head);

    const rowsWithScore = state.rows.map(r=>({...r, _score: computeScore(r.values)}));
    if(cfg.sortDesc) rowsWithScore.sort((a,b)=>b._score-a._score);

    rowsWithScore.forEach((r, idx)=>{
      const orig = state.rows.find(x=>x.id===r.id);
      const isTop = cfg.sortDesc && !cfg.threshold && idx===0 && state.rows.length>1;
      const overThreshold = cfg.threshold && r._score >= cfg.threshold;
      const tr = h('tr',{class: isTop?'top-row':(overThreshold?'threshold-row':'')});
      cfg.columns.forEach(c=>{
        let cell;
        if(c.type==='text'){
          const inp = h('input',{type:'text'}); inp.value = orig.values[c.id]||'';
          inp.addEventListener('input', debounce(()=>{ orig.values[c.id]=inp.value; save(); draw(); },300));
          cell = h('td',{},[inp]);
        } else {
          const inp = h('input',{type:'number'}); inp.value = orig.values[c.id]||'';
          inp.addEventListener('input', debounce(()=>{ orig.values[c.id]=inp.value; save(); draw(); },300));
          cell = h('td',{},[inp]);
        }
        tr.appendChild(cell);
      });
      tr.appendChild(h('td',{class:'result-col'},[String(Math.round(r._score*100)/100)]));
      tr.appendChild(h('td',{},[h('button',{class:'calc-del', onclick:()=>{ state.rows = state.rows.filter(x=>x.id!==r.id); save(); draw(); }},['✕'])]));
      table.appendChild(tr);
    });
    root.appendChild(table);
    root.appendChild(h('button',{class:'calc-add', onclick:()=>{
      const values = {}; cfg.columns.forEach(c=>values[c.id]='');
      state.rows.push({id: uid(), values});
      save(); draw();
    }},['+ Ajouter une ligne']));
    if(cfg.threshold) root.appendChild(h('p',{style:'font-size:11.5px;color:var(--ink-faint);margin-top:8px;'},[`Lignes en rouge : ${cfg.resultLabel} ≥ ${cfg.threshold} — action requise.`]));
  }
  draw();
}

function renderPughCalculator(root, fiche){
  const cfg = fiche.widget;
  const defaults = {
    criteria: (cfg.defaultCriteria||[]).map(name=>({id:uid(), name, weight:3})),
    options: [], scores: {} // scores[optionId][criterionId] = value
  };
  let state = Store.load(fiche.ref, defaults);
  function save(){ Store.save(fiche.ref, state); }

  function draw(){
    root.innerHTML = '';
    root.appendChild(resetButton(fiche.ref, ()=>{ state = JSON.parse(JSON.stringify(defaults)); state.criteria.forEach(c=>c.id=uid()); save(); draw(); }));

    root.appendChild(h('h4',{style:'font-family:var(--font-mono);font-size:12px;text-transform:uppercase;color:var(--ink-soft);margin-bottom:8px;'},['1 · Définir et pondérer les critères (avant de voir les options)']));
    const critWrap = h('div',{style:'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;'});
    state.criteria.forEach(c=>{
      const nameInput = h('input',{type:'text', style:'width:110px;', value:c.name});
      nameInput.value = c.name;
      nameInput.addEventListener('input', debounce(()=>{ c.name=nameInput.value; save(); },300));
      const weightInput = h('input',{type:'number', min:'0', max:'5', style:'width:50px;', value:c.weight});
      weightInput.value = c.weight;
      weightInput.addEventListener('input', debounce(()=>{ c.weight=Number(weightInput.value)||0; save(); draw(); },300));
      critWrap.appendChild(h('div',{style:'border:1px solid var(--line);border-radius:3px;padding:6px 8px;display:flex;gap:6px;align-items:center;background:#fff;'},[nameInput, h('span',{style:'font-size:11px;color:var(--ink-faint);'},['poids']), weightInput]));
    });
    critWrap.appendChild(h('button',{class:'btn-primary', style:'padding:6px 12px;font-size:12.5px;', onclick:()=>{ state.criteria.push({id:uid(),name:'Critère',weight:3}); save(); draw(); }},['+ Critère']));
    root.appendChild(critWrap);

    root.appendChild(h('h4',{style:'font-family:var(--font-mono);font-size:12px;text-transform:uppercase;color:var(--ink-soft);margin-bottom:8px;'},['2 · Noter chaque option (0–'+cfg.scaleMax+')']));
    const table = h('table',{class:'calc-table'});
    table.appendChild(h('tr',{}, [h('th',{},['Option'])].concat(state.criteria.map(c=>h('th',{},[c.name+' ×'+c.weight]))).concat([h('th',{},['Total']), h('th',{},[''])])));

    const scored = state.options.map(o=>{
      let total = 0;
      state.criteria.forEach(c=>{ total += (Number((state.scores[o.id]||{})[c.id])||0) * c.weight; });
      return {...o, total};
    });
    if(cfg.sortDesc) scored.sort((a,b)=>b.total-a.total);

    scored.forEach((o,idx)=>{
      const tr = h('tr',{class: idx===0 && scored.length>1 ? 'top-row':''});
      tr.appendChild(h('td',{},[o.name]));
      state.criteria.forEach(c=>{
        const inp = h('input',{type:'number', min:'0', max:String(cfg.scaleMax)});
        state.scores[o.id] = state.scores[o.id]||{};
        inp.value = state.scores[o.id][c.id]||'';
        inp.addEventListener('input', debounce(()=>{ state.scores[o.id][c.id]=inp.value; save(); draw(); },300));
        tr.appendChild(h('td',{},[inp]));
      });
      tr.appendChild(h('td',{class:'result-col'},[String(Math.round(o.total*100)/100)]));
      tr.appendChild(h('td',{},[h('button',{class:'calc-del', onclick:()=>{ state.options = state.options.filter(x=>x.id!==o.id); save(); draw(); }},['✕'])]));
      table.appendChild(tr);
    });
    root.appendChild(table);
    const optInput = h('input',{type:'text', placeholder:'Nom de l\u2019option…'});
    const addOpt = h('button',{class:'calc-add', onclick:()=>{
      const v = optInput.value.trim(); if(!v) return;
      state.options.push({id: uid(), name:v}); save(); optInput.value=''; draw();
    }},['+ Ajouter une option']);
    optInput.addEventListener('keydown', e=>{ if(e.key==='Enter') addOpt.click(); });
    root.appendChild(h('div',{class:'matrix-add-row', style:'margin-top:10px;'},[optInput, addOpt]));
  }
  draw();
}
