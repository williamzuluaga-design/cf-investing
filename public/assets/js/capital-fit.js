(() => {
  const $ = id => document.getElementById(id);
  const isEs = document.documentElement.lang === 'es';
  const copy = isEs ? {
    choose:'Seleccionar…', results:'Resultados de compatibilidad', score:'Compatibilidad informativa', ticket:'Ticket', instruments:'Instrumentos', focus:'Enfoques', targets:'Instituciones objetivo', reasons:'Coincidencias', gaps:'Aspectos por validar', website:'Sitio oficial', none:'Seleccione al menos un criterio para explorar compatibilidad.', noresults:'No se encontraron fondeadores compatibles con los criterios seleccionados.', readiness:'Áreas de preparación completadas', caution:'Este puntaje compara únicamente campos del mapeo. No estima probabilidad de aprobación, elegibilidad definitiva ni condiciones vigentes.', source:'Fuente: Mapeo de Fondeadores de Impacto para Instituciones Microfinancieras en Colombia',
    rInst:'Tipo de institución compatible', rNeed:'Ofrece al menos un instrumento asociado con la necesidad seleccionada', rFocus:'Prioridad de impacto compatible', rTicket:'El monto indicado está dentro del rango publicado', rCurrency:'Moneda publicada compatible',
    gInst:'El tipo de institución no aparece entre los objetivos publicados', gNeed:'No aparece un instrumento asociado con la necesidad seleccionada', gFocus:'El enfoque seleccionado no aparece entre las prioridades publicadas', gTicket:'El monto queda fuera del rango publicado o requiere validación', gCurrency:'La moneda seleccionada no aparece en la ficha publicada'
  } : {
    choose:'Choose…', results:'Compatibility results', score:'Informational compatibility', ticket:'Ticket', instruments:'Instruments', focus:'Focus', targets:'Target institutions', reasons:'Matches', gaps:'Items to validate', website:'Official website', none:'Select at least one criterion to explore compatibility.', noresults:'No funders match the selected criteria.', readiness:'Readiness areas completed', caution:'This score only compares fields in the source mapping. It does not estimate approval probability, definitive eligibility or current terms.', source:'Source: Mapeo de Fondeadores de Impacto para Instituciones Microfinancieras en Colombia',
    rInst:'Institution type appears compatible', rNeed:'Offers at least one instrument associated with the selected need', rFocus:'Impact priority appears compatible', rTicket:'Requested amount falls within the published range', rCurrency:'Published currency appears compatible',
    gInst:'Institution type is not listed among published targets', gNeed:'No instrument associated with the selected need appears in the profile', gFocus:'Selected focus does not appear among published priorities', gTicket:'Amount falls outside the published range or requires validation', gCurrency:'Selected currency does not appear in the published profile'
  };

  const labelsEs = {
    'Microfinance institutions':'Instituciones microfinancieras','Cooperatives':'Cooperativas','Banks':'Bancos','NGOs':'ONG','Development institutions':'Instituciones de desarrollo','Regulated financial institutions':'Instituciones financieras reguladas','Unregulated financial institutions':'Instituciones financieras no reguladas','Microfinance banks':'Bancos especializados en microfinanzas','Fintech':'Fintech','Corporations':'Corporaciones','Funds':'Fondos','Innovation and technology institutions':'Instituciones de innovación y tecnología','SMEs':'Pymes',
    'Financial inclusion':'Inclusión financiera','SMEs':'Mipymes','Agriculture':'Agricultura','Women':'Mujeres','Sustainable finance':'Finanzas sostenibles','Climate change':'Cambio climático','Entrepreneurship':'Emprendimiento','Housing':'Vivienda','Rural development':'Desarrollo rural','Youth':'Juventud','Sustainable agriculture':'Agricultura sostenible','Rural value chains':'Cadenas rurales','Renewable energy':'Energías renovables','Energy efficiency':'Eficiencia energética','Clean mobility':'Movilidad limpia','Efficient housing':'Vivienda eficiente','Precision agriculture':'Agricultura de precisión','Electric vehicles':'Vehículos eléctricos','Agricultural insurance':'Seguros agrícolas','Silver economy':'Economía plateada','Indigenous populations':'Poblaciones indígenas','Migrants in vulnerable situations':'Migrantes en situación de vulnerabilidad'
  };
  const tr = v => isEs ? (labelsEs[v] || v) : v;
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let funders=[];

  const needMap = {
    growth:['Credit lines','Senior debt'],
    capital:['Subordinated debt','Equity'],
    risk:['Guarantees','Technical assistance','Blended finance']
  };

  function uniqueFlat(key){return [...new Set(funders.flatMap(f=>f[key]||[]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
  function fillSelect(id, values){const el=$(id); if(!el)return; values.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=tr(v);el.appendChild(o);});}
  function amountFits(f, amount){
    if(!Number.isFinite(amount)) return null;
    if(f.ticket_min_usd !== null && amount < f.ticket_min_usd) return false;
    if(f.ticket_max_usd !== null && amount > f.ticket_max_usd) return false;
    return true;
  }
  function currencyFits(f,c){
    if(!c) return null;
    const curr=f.currencies||[];
    if(curr.includes(c)) return true;
    if(c==='COP' && curr.some(x=>x==='Local currency')) return true;
    if(c!=='COP' && curr.some(x=>x==='Foreign currency')) return true;
    return false;
  }
  function scoreFunder(f, q){
    let pts=0, max=0; const reasons=[], gaps=[];
    if(q.institution){max+=30; if((f.target_institutions||[]).includes(q.institution)){pts+=30;reasons.push(copy.rInst);}else gaps.push(copy.gInst);}
    if(q.need){max+=30; const wanted=needMap[q.need]||[]; if(wanted.some(x=>(f.instruments||[]).includes(x))){pts+=30;reasons.push(copy.rNeed);}else gaps.push(copy.gNeed);}
    if(q.focus){max+=20; if((f.focus||[]).includes(q.focus)){pts+=20;reasons.push(copy.rFocus);}else gaps.push(copy.gFocus);}
    if(Number.isFinite(q.amount)){max+=15; if(amountFits(f,q.amount)){pts+=15;reasons.push(copy.rTicket);}else gaps.push(copy.gTicket);}
    if(q.currency){max+=5; if(currencyFits(f,q.currency)){pts+=5;reasons.push(copy.rCurrency);}else gaps.push(copy.gCurrency);}
    return {score:max?Math.round(pts/max*100):0,max,reasons,gaps};
  }
  function query(){
    const raw=Number($('amount')?.value);
    return {institution:$('institution')?.value||'', need:$('need')?.value||'', focus:$('focus')?.value||'', amount:$('amount')?.value?raw:NaN, currency:$('currency')?.value||''};
  }
  function readiness(){
    const boxes=[...document.querySelectorAll('[data-readiness]')];
    const done=boxes.filter(x=>x.checked).length;
    if($('readinessResult')) $('readinessResult').textContent=`${done}/${boxes.length} ${copy.readiness}`;
  }
  function render(){
    const q=query(); const selected=[q.institution,q.need,q.focus,Number.isFinite(q.amount)?q.amount:'',q.currency].filter(Boolean).length;
    if(!selected){$('results').innerHTML=`<div class="notice">${copy.none}</div>`;return;}
    const ranked=funders.map(f=>({f,...scoreFunder(f,q)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || a.f.name.localeCompare(b.f.name));
    if(!ranked.length){$('results').innerHTML=`<div class="notice">${copy.noresults}</div>`;return;}
    $('results').innerHTML=`<div class="notice"><strong>${copy.caution}</strong></div>${ranked.slice(0,8).map(x=>`<article class="match-card"><div class="match-head"><div><span class="tag">${esc(x.f.origin)}</span><span class="tag">${esc(x.f.organization_type)}</span><h3>${esc(x.f.name)}</h3></div><div class="fit-score"><strong>${x.score}%</strong><span>${copy.score}</span></div></div><div class="match-grid"><div><span>${copy.ticket}</span><strong>${esc(x.f.ticket_display)}</strong></div><div><span>${copy.instruments}</span><strong>${esc((x.f.instruments||[]).map(tr).join(' · '))}</strong></div></div><p><strong>${copy.focus}:</strong> ${esc((x.f.focus||[]).map(tr).join(' · '))}</p><p><strong>${copy.targets}:</strong> ${esc((x.f.target_institutions||[]).map(tr).join(' · '))}</p><div class="why-grid"><div><strong>${copy.reasons}</strong><ul>${x.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></div><div><strong>${copy.gaps}</strong><ul>${x.gaps.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></div></div>${x.f.source_note?`<p class="source-note">${esc(x.f.source_note)}</p>`:''}<p class="source-note">${copy.source}, ${isEs?'página':'page'} ${esc(x.f.source_page)}.</p><p><a class="button secondary" href="${esc(x.f.official_website)}" target="_blank" rel="noopener">${copy.website}</a></p></article>`).join('')}`;
  }

  fetch('/data/impact-funders.json').then(r=>{if(!r.ok)throw new Error('data');return r.json();}).then(data=>{
    funders=data.funders||[];
    fillSelect('institution',uniqueFlat('target_institutions'));
    fillSelect('focus',uniqueFlat('focus'));
    ['institution','need','focus','amount','currency'].forEach(id=>$(id)?.addEventListener('input',render));
    document.querySelectorAll('[data-readiness]').forEach(x=>x.addEventListener('change',readiness));
    readiness();render();
  }).catch(()=>{$('results').innerHTML='<div class="notice">Dataset unavailable.</div>';});
})();