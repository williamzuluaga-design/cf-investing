(() => {
  const $ = (id) => document.getElementById(id);
  const isEs = document.documentElement.lang === 'es';
  const copy = isEs ? {
    all:'Todos', shown:'fondeadores mostrados', ticket:'Ticket', tenor:'Plazo', currencies:'Monedas', instruments:'Instrumentos', focus:'Enfoques', target:'Instituciones objetivo', requirements:'Criterios generales', source:'Fuente del mapeo', website:'Sitio oficial', none:'No hay fondeadores que coincidan con estos filtros.', caution:'Información de referencia del mapeo. Verifique condiciones vigentes directamente con el fondeador.', page:'página'
  } : {
    all:'All', shown:'funders shown', ticket:'Ticket', tenor:'Tenor', currencies:'Currencies', instruments:'Instruments', focus:'Focus', target:'Target institutions', requirements:'General criteria', source:'Mapping source', website:'Official website', none:'No funders match these filters.', caution:'Reference information from the mapping. Verify current terms directly with the funder.', page:'page'
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let funders = [];
  const filters = ['instrumentFilter','focusFilter','institutionFilter','ticketFilter'];

  const heroActions=document.querySelector('.hero .actions');
  if(heroActions){
    const fit=document.createElement('a');
    fit.className='button secondary';
    fit.href=isEs?'/es/finanzas-sostenibles/financiamiento-impacto/compatibilidad-capital/':'/sustainable-finance/impact-finance/capital-fit/';
    fit.textContent=isEs?'Explorar compatibilidad de capital':'Explore capital fit';
    heroActions.appendChild(fit);
  }

  function uniqueFlat(key){
    return [...new Set(funders.flatMap(f => f[key] || []).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  }
  function fillSelect(id, values){
    const el=$(id); if(!el) return;
    values.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);});
  }
  function ticketBucket(f){
    const min=f.ticket_min_usd, max=f.ticket_max_usd;
    if(max !== null && max <= 2000000) return 'up-to-2m';
    if((min !== null && min >= 10000000) || (max !== null && max > 15000000)) return '10m-plus';
    return '2m-to-15m';
  }
  function matches(f){
    const inst=$('instrumentFilter')?.value || 'all';
    const focus=$('focusFilter')?.value || 'all';
    const target=$('institutionFilter')?.value || 'all';
    const ticket=$('ticketFilter')?.value || 'all';
    return (inst==='all'||f.instruments.includes(inst)) && (focus==='all'||f.focus.includes(focus)) && (target==='all'||f.target_institutions.includes(target)) && (ticket==='all'||ticketBucket(f)===ticket);
  }
  function render(){
    const list=funders.filter(matches);
    if($('funderCount')) $('funderCount').textContent=`${list.length} ${copy.shown}`;
    if($('emptyFunders')) { $('emptyFunders').style.display=list.length?'none':'block'; $('emptyFunders').textContent=copy.none; }
    if(!$('funderGrid')) return;
    $('funderGrid').innerHTML=list.map(f=>`<article class="funder-card">
      <div class="funder-top"><div><span class="tag">${esc(f.origin)}</span><span class="tag">${esc(f.organization_type)}</span></div><strong class="ticket">${esc(f.ticket_display)}</strong></div>
      <h3>${esc(f.name)}</h3>
      <div class="mini-grid"><div><span>${copy.tenor}</span><strong>${esc(f.tenor)}</strong></div><div><span>${copy.currencies}</span><strong>${esc(f.currencies.join(', '))}</strong></div></div>
      <p><strong>${copy.instruments}:</strong> ${esc(f.instruments.join(' · '))}</p>
      <p><strong>${copy.focus}:</strong> ${esc(f.focus.join(' · '))}</p>
      <p><strong>${copy.target}:</strong> ${esc(f.target_institutions.join(' · '))}</p>
      <details><summary>${copy.requirements}</summary><ul>${f.requirements.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${f.source_note?`<p class="source-note">${esc(f.source_note)}</p>`:''}</details>
      <p class="source-note">${copy.source}: <em>Mapeo de Fondeadores de Impacto para Instituciones Microfinancieras en Colombia</em>, ${copy.page} ${esc(f.source_page)}. ${copy.caution}</p>
      <p><a class="button secondary" href="${esc(f.official_website)}" target="_blank" rel="noopener">${copy.website}</a></p>
    </article>`).join('');
  }
  fetch('/data/impact-funders.json').then(r=>{if(!r.ok)throw new Error('data');return r.json();}).then(data=>{
    funders=data.funders||[];
    fillSelect('instrumentFilter', uniqueFlat('instruments'));
    fillSelect('focusFilter', uniqueFlat('focus'));
    fillSelect('institutionFilter', uniqueFlat('target_institutions'));
    filters.forEach(id=>$(id)?.addEventListener('change',render));
    render();
  }).catch(()=>{
    if($('funderCount')) $('funderCount').textContent='Dataset unavailable';
    if($('emptyFunders')) { $('emptyFunders').style.display='block'; $('emptyFunders').textContent='Impact-funder dataset could not be loaded.'; }
  });
})();