(() => {
  const $ = id => document.getElementById(id);
  const isEs = document.documentElement.lang === 'es';
  const copy = isEs ? {
    awaiting:'Pendiente de primera ejecución', candidates:'candidatos', sources:'fuentes registradas', enabled:'activas', pending:'Pendiente de revisión', stale:'No visto en última ejecución', open:'Abrir fuente', none:'Aún no hay candidatos. La primera ejecución del workflow creará la línea base.', last:'Última ejecución', failed:'Error', inactive:'Registrada · no activa', ok:'Activa', connector:'Conector', structured:'Estructurado', fallback:'Fallback HTML', scanned:'registros analizados', projectNumber:'Proyecto / operación', country:'País', publication:'Fecha', sector:'Sector', status:'Estado', amount:'Monto / cupo', sponsor:'Cliente / sponsor', instrument:'Instrumento', risk:'Riesgo', company:'Tamaño empresa', uses:'Destino', geography:'Cobertura'
  } : {
    awaiting:'Awaiting first run', candidates:'candidates', sources:'registered sources', enabled:'active', pending:'Pending review', stale:'Not seen in latest run', open:'Open source', none:'No candidates yet. The first workflow run will create the baseline.', last:'Last run', failed:'Error', inactive:'Registered · not active', ok:'Active', connector:'Connector', structured:'Structured', fallback:'HTML fallback', scanned:'records scanned', projectNumber:'Project / operation', country:'Country', publication:'Date', sector:'Sector', status:'Status', amount:'Amount / facility', sponsor:'Client / sponsor', instrument:'Instrument', risk:'Risk', company:'Company size', uses:'Use of proceeds', geography:'Geographic scope'
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const connectorLabel = c => ({idbinvest_xml:'BID Invest XML',caf_catalog:'CAF field extractor',bancoldex_catalog:'Bancóldex field extractor',html_catalog:'HTML catalogue',source_specific_pending:'Source-specific pending'})[c] || c || '—';
  const fmt=v=>Array.isArray(v)?v.join(' · '):v;
  const metadataHtml = m => {
    if(!m) return '';
    const rows=[
      [copy.projectNumber,m.project_number||m.operation_number],
      [copy.country,m.country],
      [copy.publication,m.publication_date||m.approval_date||m.updated_date],
      [copy.sector,fmt(m.sector)],
      [copy.instrument,m.instrument],
      [copy.risk,m.risk_type],
      [copy.status,m.status],
      [copy.amount,m.amount||m.available_facility],
      [copy.sponsor,m.client_or_sponsor],
      [copy.company,fmt(m.company_size)],
      [copy.uses,fmt(m.use_of_proceeds)],
      [copy.geography,fmt(m.geographic_scope)]
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
      if(r?.pages_checked!=null) details.push(`${r.pages_checked} pages`);
      return `<article class="monitor-card"><div class="monitor-head"><div><h3>${esc(s.name)}</h3><p>${esc(s.candidate_kind)}</p></div><span class="status ${cls}">${esc(label)}</span></div><p><strong>${esc(s.organization)}</strong></p><p>${esc(s.notes||'')}</p><p class="source-note">${esc(details.join(' · '))}</p>${r?.error?`<p class="monitor-error">${esc(r.error)}</p>`:''}<p class="source-note">${copy.last}: ${esc(r?.checked_at||'—')} · ${esc(r?.candidate_count??0)} ${copy.candidates}</p><p><a href="${esc(s.structured_url||s.url)}" target="_blank" rel="noopener">${copy.open} →</a></p></article>`
    }).join('');
    if(!candidates.length){$('candidateGrid').innerHTML=`<div class="notice">${copy.none}</div>`;return;}
    $('candidateGrid').innerHTML=candidates.map(c=>`<article class="monitor-card"><div class="monitor-head"><div><span class="tag">${esc(c.source_name)}</span><span class="tag">${esc(c.candidate_kind)}</span><span class="tag">${esc(connectorLabel(c.connector))}</span><h3>${esc(c.title)}</h3></div><span class="status ${c.currently_listed?'attention':'pending'}">${esc(c.currently_listed?copy.pending:copy.stale)}</span></div>${metadataHtml(c.metadata)}<p class="source-note">First seen: ${esc(c.first_seen)} · Last seen: ${esc(c.last_seen)}</p><p><a class="button secondary" href="${esc(c.url)}" target="_blank" rel="noopener">${copy.open}</a></p></article>`).join('');
  }).catch(()=>{$('candidateGrid').innerHTML='<div class="notice">Discovery data unavailable.</div>';});
})();
