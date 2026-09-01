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
    ]
  } : {
    missing:'Not disclosed in the source currently reviewed',
    source:'Open primary source',
    gaps:[
      'Detailed CAPEX and investment schedule, where applicable.',
      'Full revenue, cost and cash-flow model.',
      'Detailed debt/equity structure and financing terms.',
      'Material contracts, risk allocation and mitigants.',
      'Independent financial, technical, legal and ESG due diligence.'
    ]
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
    })
    .catch(() => {
      const error=$('profileError');
      if(error) error.hidden=false;
    });
})();
