(() => {
  const $ = id => document.getElementById(id);
  const isEs = document.documentElement.lang === 'es';
  const copy = isEs ? {
    never:'Aún no ejecutado', checked:'Última comprobación', change:'Último cambio detectado', source:'Fuente', record:'Registro', open:'Abrir fuente', healthy:'Sin cambio detectado', baseline:'Línea base inicializada', changed:'Revisión humana requerida', error:'Error de comprobación', pending:'Pendiente de línea base', unknown:'Estado desconocido', updated:'Estado del monitor actualizado', summary:'fuentes monitoreadas', changes:'cambios en la última ejecución', errors:'errores'
  } : {
    never:'Not run yet', checked:'Last checked', change:'Last change detected', source:'Source', record:'Record', open:'Open source', healthy:'No change detected', baseline:'Baseline initialized', changed:'Human review required', error:'Check error', pending:'Pending baseline', unknown:'Unknown status', updated:'Monitor state updated', summary:'sources monitored', changes:'changes in last run', errors:'errors'
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label = status => ({unchanged:copy.healthy,baseline_initialized:copy.baseline,changed:copy.changed,error:copy.error,pending_baseline:copy.pending})[status] || copy.unknown;
  const cls = status => status === 'changed' || status === 'error' ? 'attention' : status === 'pending_baseline' ? 'pending' : 'ok';
  const fmt = value => value ? new Date(value).toLocaleString(isEs ? 'es-CO' : 'en-US') : copy.never;

  fetch('/data/source-monitor.json')
    .then(r => { if(!r.ok) throw new Error('data'); return r.json(); })
    .then(data => {
      const s=data.summary||{};
      if($('monitorSummary')) $('monitorSummary').textContent=`${s.sources||0} ${copy.summary} · ${s.changed_last_run||0} ${copy.changes} · ${s.errors||0} ${copy.errors}`;
      if($('monitorUpdated')) $('monitorUpdated').textContent=`${copy.updated}: ${fmt(data.updated_at)}`;
      const grid=$('sourceGrid');
      if(grid) grid.innerHTML=(data.sources||[]).map(x=>`<article class="monitor-card"><div class="monitor-head"><div><span class="status ${cls(x.status)}">${esc(label(x.status))}</span><h3>${esc(x.name)}</h3></div><span class="tag">${esc(x.source_name)}</span></div><p><strong>${copy.record}:</strong> ${esc(x.record_id)}</p><p><strong>${copy.checked}:</strong> ${esc(fmt(x.last_checked_at))}</p><p><strong>${copy.change}:</strong> ${esc(fmt(x.last_change_detected_at))}</p>${x.error?`<p class="monitor-error">${esc(x.error)}</p>`:''}<p><a class="button secondary" href="${esc(x.url)}" target="_blank" rel="noopener">${copy.open}</a></p></article>`).join('');
    })
    .catch(()=>{
      if($('monitorSummary')) $('monitorSummary').textContent=isEs?'No fue posible cargar el estado del monitor.':'Monitoring state could not be loaded.';
    });
})();
