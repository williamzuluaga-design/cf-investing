(() => {
  const $ = id => document.getElementById(id);
  const isEs = document.documentElement.lang === 'es';
  const copy = isEs ? {
    awaiting:'Pendiente de primera ejecución', active:'Activo', candidates:'candidatos', sources:'fuentes registradas', enabled:'activas', pending:'Pendiente de revisión', stale:'No visto en última ejecución', open:'Abrir fuente', none:'Aún no hay candidatos. La primera ejecución del workflow creará la línea base.', sourceStatus:'Estado de fuentes', queue:'Cola de revisión', last:'Última ejecución', failed:'Error', inactive:'Registrada · no activa', ok:'Activa'
  } : {
    awaiting:'Awaiting first run', active:'Active', candidates:'candidates', sources:'registered sources', enabled:'active', pending:'Pending review', stale:'Not seen in latest run', open:'Open source', none:'No candidates yet. The first workflow run will create the baseline.', sourceStatus:'Source status', queue:'Review queue', last:'Last run', failed:'Error', inactive:'Registered · not active', ok:'Active'
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  Promise.all([fetch('/data/discovery-sources.json').then(r=>r.json()),fetch('/data/discovery-queue.json').then(r=>r.json())]).then(([registry,queue])=>{
    const sources=registry.sources||[], candidates=queue.candidates||[], runs=queue.source_runs||[];
    $('discoverySummary').textContent=`${candidates.length} ${copy.candidates} · ${sources.length} ${copy.sources} · ${sources.filter(s=>s.enabled).length} ${copy.enabled}`;
    $('discoveryUpdated').textContent=`${copy.last}: ${queue.updated_at||copy.awaiting}`;
    $('sourceRuns').innerHTML=sources.map(s=>{const r=runs.find(x=>x.source_id===s.id);const cls=!s.enabled?'pending':r?.status==='error'?'attention':'ok';const label=!s.enabled?copy.inactive:r?.status==='error'?copy.failed:copy.ok;return `<article class="monitor-card"><div class="monitor-head"><div><h3>${esc(s.name)}</h3><p>${esc(s.candidate_kind)}</p></div><span class="status ${cls}">${esc(label)}</span></div><p><strong>${esc(s.organization)}</strong></p><p>${esc(s.notes||'')}</p>${r?.error?`<p class="monitor-error">${esc(r.error)}</p>`:''}<p class="source-note">${copy.last}: ${esc(r?.checked_at||'—')} · ${esc(r?.candidate_count??0)} ${copy.candidates}</p><p><a href="${esc(s.url)}" target="_blank" rel="noopener">${copy.open} →</a></p></article>`}).join('');
    if(!candidates.length){$('candidateGrid').innerHTML=`<div class="notice">${copy.none}</div>`;return;}
    $('candidateGrid').innerHTML=candidates.map(c=>`<article class="monitor-card"><div class="monitor-head"><div><span class="tag">${esc(c.source_name)}</span><span class="tag">${esc(c.candidate_kind)}</span><h3>${esc(c.title)}</h3></div><span class="status ${c.currently_listed?'attention':'pending'}">${esc(c.currently_listed?copy.pending:copy.stale)}</span></div><p class="source-note">First seen: ${esc(c.first_seen)} · Last seen: ${esc(c.last_seen)}</p><p><a class="button secondary" href="${esc(c.url)}" target="_blank" rel="noopener">${copy.open}</a></p></article>`).join('');
  }).catch(()=>{$('candidateGrid').innerHTML='<div class="notice">Discovery data unavailable.</div>';});
})();
