(() => {
  const $ = id => document.getElementById(id);
  const isEs = document.documentElement.lang === 'es';
  const copy = isEs ? {
    source:'Fuente', period:'Periodo', note:'Nota metodológica', qualitative:'Los anchos del Sankey son pesos visuales cualitativos para explicar el sistema; no representan montos de capital.', unavailable:'No fue posible cargar el panorama de capital.'
  } : {
    source:'Source', period:'Period', note:'Method note', qualitative:'Sankey widths are qualitative visual weights used to explain the system; they do not represent measured capital amounts.', unavailable:'Capital landscape data could not be loaded.'
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tr = isEs ? {
    'Sources of capital':'Fuentes de capital','Intermediaries & enablers':'Intermediarios y habilitadores','Financial instruments':'Instrumentos financieros','Institutions & projects':'Instituciones y proyectos',
    'Institutional & private investors':'Inversionistas institucionales y privados','Development finance':'Financiación de desarrollo','Public & climate funds':'Recursos públicos y fondos climáticos','Concessional & philanthropic capital':'Capital concesional y filantrópico',
    'Banks & development banks':'Bancos y banca de desarrollo','Funds & asset managers':'Fondos y gestores de activos','Guarantee & risk providers':'Proveedores de garantías y mitigación de riesgo','Capital-market infrastructure':'Infraestructura de mercado de capitales',
    'Loans & senior debt':'Crédito y deuda senior','Subordinated debt & equity':'Deuda subordinada y equity','Green / thematic instruments':'Instrumentos verdes / temáticos','Guarantees & catalytic structures':'Garantías y estructuras catalíticas','Technical assistance & grants':'Asistencia técnica y grants',
    'Energy & infrastructure':'Energía e infraestructura','Financial institutions':'Instituciones financieras','SMEs & productive transition':'Mipymes y transición productiva','Agriculture, nature & rural economy':'Agricultura, naturaleza y economía rural','Social & climate resilience':'Resiliencia social y climática'
  } : {};
  const T=v=>tr[v]||v;

  function kpis(data){
    const box=$('landscapeKpis'); if(!box)return;
    box.innerHTML=(data.global_snapshot||[]).map(k=>`<article class="kpi-card"><span>${esc(T(k.label))}</span><strong>${esc(k.value)}</strong><small>${esc(k.period)}</small><p>${esc(isEs?translateNote(k.note):k.note)}</p></article>`).join('');
  }
  function translateNote(v){
    const m={
      'Climate finance surpassed US$2 trillion for the first time in 2024.':'El financiamiento climático superó US$2 billones por primera vez en 2024.',
      'CPI estimates global climate finance reached approximately US$2.1 trillion in 2025.':'CPI estima que el financiamiento climático global alcanzó aproximadamente US$2,1 billones en 2025.',
      'Mitigation remained the dominant climate-finance use in 2024.':'La mitigación siguió siendo el principal uso del financiamiento climático en 2024.',
      'Tracked adaptation investment plateaued at approximately US$64 billion in 2024.':'La inversión rastreada en adaptación se estabilizó alrededor de US$64 mil millones en 2024.'
    }; return m[v]||v;
  }

  function renderSankey(data){
    const wrap=$('sankeyWrap'); if(!wrap)return;
    const columns=data.columns||[], nodes=data.nodes||[], links=data.links||[];
    const W=1240,H=650, nodeW=180, nodeH=58, left=25, right=25;
    const xStep=(W-left-right-nodeW)/(Math.max(columns.length-1,1));
    const positions={};
    columns.forEach((c,ci)=>{
      const list=nodes.filter(n=>n.column===c.id);
      const gap=(H-100-list.length*nodeH)/(list.length+1);
      list.forEach((n,ni)=>{positions[n.id]={x:left+ci*xStep,y:70+gap*(ni+1)+nodeH*ni,w:nodeW,h:nodeH,node:n};});
    });
    const colors=['#1b365d','#466f8a','#739a8b','#a88b5b'];
    const svg=[];
    svg.push(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sankey-style sustainable finance capital system map">`);
    columns.forEach((c,ci)=>svg.push(`<text x="${left+ci*xStep}" y="32" class="sankey-col-title">${esc(T(c.label))}</text>`));
    links.forEach(l=>{
      const a=positions[l.source], b=positions[l.target]; if(!a||!b)return;
      const x1=a.x+a.w, y1=a.y+a.h/2, x2=b.x, y2=b.y+b.h/2, mid=(x1+x2)/2;
      const width=Math.max(2,Number(l.weight||1)*2.6);
      svg.push(`<path d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" fill="none" stroke="#9fb0c4" stroke-opacity="0.36" stroke-width="${width}" stroke-linecap="round"><title>${esc(T(a.node.label))} → ${esc(T(b.node.label))}</title></path>`);
    });
    nodes.forEach(n=>{
      const p=positions[n.id], ci=columns.findIndex(c=>c.id===n.column), fill=colors[Math.max(ci,0)%colors.length];
      svg.push(`<g tabindex="0" class="sankey-node"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="12" fill="${fill}"/><text x="${p.x+12}" y="${p.y+24}" class="sankey-node-label">${esc(T(n.label))}</text><title>${esc(isEs?translateDesc(n.description):n.description)}</title></g>`);
    });
    svg.push('</svg>');
    wrap.innerHTML=svg.join('')+`<p class="sankey-note">${esc(copy.qualitative)}</p>`;
  }
  function translateDesc(v){
    const m={
      'Asset owners, funds and private capital seeking risk-adjusted opportunities.':'Propietarios de activos, fondos y capital privado buscando oportunidades ajustadas por riesgo.',
      'Multilateral, bilateral and national development capital.':'Capital de desarrollo multilateral, bilateral y nacional.',
      'Public budgets, climate funds and policy-linked resources.':'Presupuestos públicos, fondos climáticos y recursos vinculados a política pública.',
      'Grants, catalytic resources and below-market capital used selectively.':'Grants, recursos catalíticos y capital concesional usados selectivamente.'
    }; return m[v]||v;
  }
  function sources(data){
    const box=$('landscapeSources'); if(!box)return;
    box.innerHTML=(data.sources||[]).map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a> <small>(${esc(s.as_of||'')})</small></li>`).join('');
  }
  fetch('/data/sustainable-finance-landscape.json').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{kpis(data);renderSankey(data);sources(data);if($('methodNote'))$('methodNote').textContent=`${copy.note}: ${isEs?'Los KPI globales provienen de las fuentes citadas. '+copy.qualitative:data.method_note}`;}).catch(()=>{if($('sankeyWrap'))$('sankeyWrap').innerHTML=`<div class="notice">${copy.unavailable}</div>`;});
})();
