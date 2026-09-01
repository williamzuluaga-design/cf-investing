(() => {
  const body = document.body;
  const id = body.dataset.projectId;
  const isEs = document.documentElement.lang === 'es';
  const $ = (x) => document.getElementById(x);
  const txt = isEs ? {
    missing:'No divulgado en la fuente actualmente revisada',
    source:'Abrir fuente primaria',
    gaps:[
      'CAPEX detallado y calendario de inversión, cuando aplique.',
      'Modelo completo de ingresos, costos y flujo de caja.',
      'Estructura detallada de deuda/equity y condiciones financieras.',
      'Contratos materiales, asignación de riesgos y mitigantes.',
      'Due diligence financiera, técnica, legal y ESG independiente.'
    ],
    capitalKicker:'RUTA DE CAPITAL',
    capitalTitle:'Conectar el perfil con posibles vías de financiación.',
    observed:'Ruta observada',
    analytical:'Lectura analítica',
    scope:'Alcance del matching',
    explore:'Explorar compatibilidad de capital',
    methodology:'La clasificación es una heurística de CF Investing basada en el instrumento, tipo de registro y sector documentados. No implica elegibilidad ni recomendación de un fondeador.',
    limited:'El directorio actual de fondeadores tiene un enfoque principal en instituciones microfinancieras y otras organizaciones financieras. Para este tipo de proyecto no se infiere un ranking directo de fondeadores.',
    institutional:'Este registro puede conectarse con el explorador de compatibilidad institucional usando únicamente criterios publicados en el mapeo de fondeadores. Ajuste los supuestos antes de interpretar resultados.'
  } : {
    missing:'Not disclosed in the source currently reviewed',
    source:'Open primary source',
    gaps:[
      'Detailed CAPEX and investment schedule, where applicable.',
      'Full revenue, cost and cash-flow model.',
      'Detailed debt/equity structure and financing terms.',
      'Material contracts, risk allocation and mitigants.',
      'Independent financial, technical, legal and ESG due diligence.'
    ],
    capitalKicker:'CAPITAL PATHWAY',
    capitalTitle:'Connect the profile with plausible financing pathways.',
    observed:'Observed pathway',
    analytical:'Analytical reading',
    scope:'Matching scope',
    explore:'Explore capital compatibility',
    methodology:'The classification is a CF Investing heuristic based on the documented instrument, record type and sector. It does not imply eligibility or a funder recommendation.',
    limited:'The current impact-funder directory has a primary lens on microfinance institutions and other financial organizations. No direct funder ranking is inferred for this project type.',
    institutional:'This record can be connected to the institutional compatibility explorer using only criteria published in the funder mapping. Review the assumptions before interpreting results.'
  };
  const tr = {
    sector:{'Renewable Energy':'Energía renovable','Urban Infrastructure':'Infraestructura urbana','Resilience & Reconstruction':'Resiliencia y reconstrucción','Sustainable Mining':'Minería sostenible'},
    stage:{'Proposed':'Propuesto','Financing Signed':'Financiación firmada','Capital Markets':'Mercado de capitales','Open Facility':'Línea abierta'},
    instrument:{'Loan':'Préstamo','Credit Line':'Línea de crédito','Green Bond':'Bono verde','Development Credit':'Crédito de desarrollo'},
    type:{'Project':'Proyecto','Corporate Investment Plan':'Plan de inversión corporativo','Public Finance Program':'Programa de financiación pública','SME Facility':'Línea para mipymes'},
    evidence:{'Public Source':'Fuente pública','Source Reviewed':'Fuente revisada','Financial Review':'Revisión financiera'}
  };
  function translate(group,value){ return isEs && tr[group] && tr[group][value] ? tr[group][value] : value; }
  function set(id, value){ const el=$(id); if(el) el.textContent = value || txt.missing; }
  function esc(s){return String(s ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}

  function capitalFamily(p){
    const en = {
      'Loan':'Development / project debt',
      'Credit Line':'Credit line / intermediated lending',
      'Green Bond':'Thematic capital markets debt',
      'Development Credit':'Development banking / intermediated credit'
    }[p.instrument] || 'Financing pathway requires further classification';
    const es = {
      'Loan':'Deuda de desarrollo / project finance',
      'Credit Line':'Línea de crédito / financiación intermediada',
      'Green Bond':'Deuda temática en mercado de capitales',
      'Development Credit':'Banca de desarrollo / crédito intermediado'
    }[p.instrument] || 'La vía de financiación requiere clasificación adicional';
    return isEs ? es : en;
  }
  function focusFor(p){
    return {
      'Renewable Energy':'Renewable energy',
      'Urban Infrastructure':'Sustainable finance',
      'Resilience & Reconstruction':'Climate change',
      'Sustainable Mining':'Sustainable finance'
    }[p.sector] || '';
  }
  function needFor(p){
    if(['Loan','Credit Line','Development Credit'].includes(p.instrument)) return 'growth';
    return '';
  }
  function institutionFor(p){
    const sponsor=(p.sponsor_or_borrower||'').toLowerCase();
    if(sponsor.includes('bbva') || sponsor.includes('bank') || sponsor.includes('banco')) return 'Banks';
    if(p.type==='Corporate Investment Plan') return 'Corporations';
    return '';
  }
  function insertCapitalPathway(p){
    const sourceSection=document.querySelector('.source-card')?.closest('section');
    if(!sourceSection) return;
    const institution=institutionFor(p);
    const focus=focusFor(p);
    const need=needFor(p);
    const base=isEs?'/es/finanzas-sostenibles/financiamiento-impacto/compatibilidad-capital/':'/sustainable-finance/impact-finance/capital-fit/';
    const params=new URLSearchParams();
    params.set('project',p.name);
    if(institution) params.set('institution',institution);
    if(focus) params.set('focus',focus);
    if(need) params.set('need',need);
    const scopeText=institution ? txt.institutional : txt.limited;
    const section=document.createElement('section');
    section.className='section alt';
    section.innerHTML=`<p class="kicker">${esc(txt.capitalKicker)}</p><h2>${esc(txt.capitalTitle)}</h2><div class="card-grid"><article class="card"><h3>${esc(txt.observed)}</h3><p><strong>${esc(translate('instrument',p.instrument))}</strong></p><p>${esc(capitalFamily(p))}</p></article><article class="card"><h3>${esc(txt.analytical)}</h3><p>${esc(isEs?'Sector: ':'Sector: ')}<strong>${esc(translate('sector',p.sector))}</strong></p><p>${esc(isEs?'Etapa: ':'Stage: ')}<strong>${esc(translate('stage',p.stage))}</strong></p></article><article class="card"><h3>${esc(txt.scope)}</h3><p>${esc(scopeText)}</p></article></div><p>${esc(txt.methodology)}</p><div class="actions"><a class="button primary" href="${esc(base+'?'+params.toString())}">${esc(txt.explore)}</a></div>`;
    sourceSection.insertAdjacentElement('beforebegin',section);
  }

  fetch('/data/projects.json')
    .then(r => { if(!r.ok) throw new Error('data'); return r.json(); })
    .then(data => {
      const p = data.projects.find(x => x.id === id);
      if(!p) throw new Error('project');
      document.title = `${p.name} | CF Investing`;
      set('projectName', p.name);
      if(!isEs) set('projectDescription', p.description);
      set('sector', translate('sector',p.sector));
      set('location', p.location);
      set('stage', translate('stage',p.stage));
      set('instrument', translate('instrument',p.instrument));
      set('type', translate('type',p.type));
      set('sponsor', p.sponsor_or_borrower);
      set('amount', p.amount_display);
      set('sourceDate', p.source_date);
      set('lastReviewed', p.last_reviewed);
      set('headlineMetric', p.headline_metric);
      if(!isEs) set('headlineMetricLabel', p.headline_metric_label);
      set('secondaryMetric', p.secondary_metric);
      if(!isEs) set('secondaryMetricLabel', p.secondary_metric_label);
      const source = $('sourceLink');
      if(source){ source.href=p.source_url; source.textContent=`${txt.source} — ${p.source_name}`; }
      const badges=$('evidenceBadges');
      if(badges) badges.innerHTML=p.evidence_status.map(x=>`<span class="tag">${esc(translate('evidence',x))}</span>`).join(' ');
      const gaps=$('evidenceGaps');
      if(gaps) gaps.innerHTML=txt.gaps.map(x=>`<li>${esc(x)}</li>`).join('');
      insertCapitalPathway(p);
    })
    .catch(() => {
      const error=$('profileError');
      if(error) error.hidden=false;
    });
})();
