(() => {
  const $ = id => document.getElementById(id);
  const isEs = document.documentElement.lang === 'es';
  const copy = isEs ? {
    awaiting:'Pendiente de primera ejecución', candidates:'candidatos', sources:'fuentes registradas', enabled:'activas', pending:'Pendiente de revisión', stale:'No visto en última ejecución', open:'Abrir fuente', none:'Aún no hay candidatos. La primera ejecución del workflow creará la línea base.', last:'Última ejecución', failed:'Error', inactive:'Registrada · no activa', ok:'Activa', connector:'Conector', structured:'Estructurado', fallback:'Fallback HTML', scanned:'registros analizados', projectNumber:'Proyecto', country:'País', publication:'Publicación', sector:'Sector', status:'Estado', amount:'Monto', sponsor:'Cliente / sponsor'
  } : {
    awaiting:'Awaiting first run', candidates:'candidates', sources:'registered sources', enabled:'active', pending:'Pending review', stale:'Not seen in latest run', open:'Open source', none:'No candidates yet. The first workflow run will create the baseline.', last:'Last run', failed:'Error', inactive:'Registered · not active', ok:'Active', connector:'Connector', structured:'Structured', fallback:'HTML fallback', scanned:'records scanned', projectNumber:'Project', country:'Country', publication:'Publication', sector:'Sector', status:'Status', amount:'Amount', sponsor:'Client / sponsor'
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const connectorLabel = c => ({idbinvest_xml:'BID Invest XML',html_catalog:'HTML catalogue',source_specific_pending:'Source-specific pending'})[c] || c || '—';
  const metadataHtml = m => {
    if(!m) return '';
    const rows=[
      [copy.projectNumber,m.project_number],[copy.country,m.country],[copy.publication,m.publication_date],[copy.sector,m.sector],[copy.status,m.status],[copy.amount,m.amount],[copy.sponsor,m.client_or_sponsor]
    ].filter(([,v])=>v);
    if(!rows.length) return '';
    return `<div class="metrics">${rows.map(([k,v])=>`<div class="metric"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`;
  };
  Promise.all([fetch('/data/discovery-sources.json').then(r=>r.json()),fetch('/data/discovery-queue.json').then(r=>r.json())]).then(([registry,queue])=>{
    const sources=registry.sources||[], candidates=queue.candidates||[], runs=queue.source_runs||[];
    $('discoverySummary').textContent=`${candidates.length} ${copy.candidates} · ${sources.length} ${copy.sources} · ${sources.filter(s=>s.enabled).length} ${copy.enabled}`;
    $('discoveryUpdated').textContent=`${copy.last}: ${queue.updated_at||copy.awaiting}`;
    $('sourceRuns').innerHTML=sources.map(s=>{
      const r=runs.find(x=>x.source_id===s.id);
      const cls=!s.enabled?'pending':r?.status==='error'?'attention':'ok';
      const label=!s.enabled?copy.inactive:r?.status==='error'?copy.failed:copy.ok;
      const details=[];
      details.push(`${copy.connector}: ${connectorLabel(s.connector)}`);
      if(r?.structured) details.push(copy.structured);
      if(r?.fallback_used) details.push(copy.fallback);
      if(r?.records_scanned!=null) details.push(`${r.records_scanned} ${copy.scanned}`);
      return `<article class="monitor-card"><div class="monitor-head"><div><h3>${esc(s.name)}</h3><p>${esc(s.candidate_kind)}</p></div><span class="status ${cls}">${esc(label)}</span></div><p><strong>${esc(s.organization)}</strong></p><p>${esc(s.notes||'')}</p><p class="source-note">${esc(details.join(' · '))}</p>${r?.error?`<p class="monitor-error">${esc(r.error)}</p>`:''}<p class="source-note">${copy.last}: ${esc(r?.checked_at||'—')} · ${esc(r?.candidate_count??0)} ${copy.candidates}</p><p><a href="${esc(s.structured_url||s.url)}" target="_blank" rel="noopener">${copy.open} →</a></p></article>`
    }).join('');
    if(!candidates.length){$('candidateGrid').innerHTML=`<div class="notice">${copy.none}</div>`;return;}
    $('candidateGrid').innerHTML=candidates.map(c=>`<article class="monitor-card"><div class="monitor-head"><div><span class="tag">${esc(c.source_name)}</span><span class="tag">${esc(c.candidate_kind)}</span><span class="tag">${esc(connectorLabel(c.connector))}</span><h3>${esc(c.title)}</h3></div><span class="status ${c.currently_listed?'attention':'pending'}">${esc(c.currently_listed?copy.pending:copy.stale)}</span></div>${metadataHtml(c.metadata)}<p class="source-note">First seen: ${esc(c.first_seen)} · Last seen: ${esc(c.last_seen)}</p><p><a class="button secondary" href="${esc(c.url)}" target="_blank" rel="noopener">${copy.open}</a></p></article>`).join('');
  }).catch(()=>{$('candidateGrid').innerHTML='<div class="notice">Discovery data unavailable.</div>';});
})();
