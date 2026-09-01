(() => {
  const body = document.body;
  const id = body.dataset.projectId;
  const isEs = document.documentElement.lang === 'es';
  const $ = (x) => document.getElementById(x);
  const txt = isEs ? {
    missing:'No divulgado en la fuente actualmente revisada',
    source:'Abrir fuente primaria',
    reviewed:'Última revisión CF Investing',
    evidence:'Estado de evidencia',
    gapsTitle:'Vacíos de evidencia para análisis más profundo',
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
    reviewed:'Last CF Investing review',
    evidence:'Evidence status',
    gapsTitle:'Evidence gaps for deeper analysis',
    gaps:[
      'Detailed CAPEX and investment schedule, where applicable.',
      'Full revenue, cost and cash-flow model.',
      'Detailed debt/equity structure and financing terms.',
      'Material contracts, risk allocation and mitigants.',
      'Independent financial, technical, legal and ESG due diligence.'
    ]
  };

  function set(id, value){ const el=$(id); if(el) el.textContent = value || txt.missing; }
  function esc(s){return String(s ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}

  fetch('/data/projects.json')
    .then(r => { if(!r.ok) throw new Error('data'); return r.json(); })
    .then(data => {
      const p = data.projects.find(x => x.id === id);
      if(!p) throw new Error('project');
      document.title = `${p.name} | CF Investing`;
      set('projectName', p.name);
      set('projectDescription', p.description);
      set('sector', p.sector);
      set('location', p.location);
      set('stage', p.stage);
      set('instrument', p.instrument);
      set('type', p.type);
      set('sponsor', p.sponsor_or_borrower);
      set('amount', p.amount_display);
      set('sourceDate', p.source_date);
      set('lastReviewed', p.last_reviewed);
      set('headlineMetric', p.headline_metric);
      set('headlineMetricLabel', p.headline_metric_label);
      set('secondaryMetric', p.secondary_metric);
      set('secondaryMetricLabel', p.secondary_metric_label);
      const source = $('sourceLink');
      if(source){ source.href=p.source_url; source.textContent=`${txt.source} — ${p.source_name}`; }
      const badges=$('evidenceBadges');
      if(badges) badges.innerHTML=p.evidence_status.map(x=>`<span class="tag">${esc(x)}</span>`).join(' ');
      const gaps=$('evidenceGaps');
      if(gaps) gaps.innerHTML=txt.gaps.map(x=>`<li>${esc(x)}</li>`).join('');
    })
    .catch(() => {
      const error=$('profileError');
      if(error) error.hidden=false;
    });
})();
