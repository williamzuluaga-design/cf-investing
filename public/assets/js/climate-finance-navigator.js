(() => {
  const $=id=>document.getElementById(id);
  const isEs=document.documentElement.lang==='es';
  const copy=isEs?{
    choose:'Seleccionar…',path:'Ruta potencial de financiación',instruments:'Instrumentos plausibles',financiers:'Tipos de financiador',evidence:'Evidencia a preparar',actions:'Próximos análisis',caution:'Este resultado es una heurística educativa para priorizar investigación. No es una recomendación de producto, fondeador, inversión ni una opinión de elegibilidad.',select:'Seleccione sector, etapa y principal barrera para generar una ruta.',unavailable:'No fue posible cargar el navegador.'
  }:{
    choose:'Choose…',path:'Potential financing pathway',instruments:'Plausible instruments',financiers:'Financier types',evidence:'Evidence to prepare',actions:'Next analysis',caution:'This output is an educational heuristic for research prioritization. It is not a product, funder or investment recommendation and is not an eligibility opinion.',select:'Select sector, stage and primary barrier to generate a pathway.',unavailable:'Navigator data could not be loaded.'
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tr=isEs?{
    'Renewable energy & grids':'Energía renovable y redes','Water, resilient infrastructure & cities':'Agua, infraestructura resiliente y ciudades','Agriculture, nature & rural resilience':'Agricultura, naturaleza y resiliencia rural','SMEs, cleaner production & productivity':'Mipymes, producción más limpia y productividad','Financial inclusion & financial institutions':'Inclusión financiera e instituciones financieras','Social infrastructure & climate resilience':'Infraestructura social y resiliencia climática',
    'Concept / pre-feasibility':'Concepto / prefactibilidad','Feasibility / development':'Factibilidad / desarrollo','Construction / implementation':'Construcción / implementación','Operating / scaling':'Operación / escalamiento',
    'Construction / technology risk':'Riesgo de construcción / tecnología','Demand / offtake / revenue risk':'Riesgo de demanda / offtake / ingresos','FX / interest-rate risk':'Riesgo cambiario / tasa de interés','Regulatory / policy risk':'Riesgo regulatorio / política pública','Adaptation / resilience economics':'Economía de adaptación / resiliencia','Institutional / execution capacity':'Capacidad institucional / ejecución',
    'Senior debt':'Deuda senior','Project finance':'Project finance','Equity':'Equity','Green bonds':'Bonos verdes','Development loans':'Créditos de desarrollo','Green / sustainability bonds':'Bonos verdes / sostenibles','Guarantees':'Garantías','Credit lines':'Líneas de crédito','Concessional debt':'Deuda concesional','Blended finance':'Financiamiento combinado','Technical assistance':'Asistencia técnica','Subordinated debt':'Deuda subordinada','Grants / technical assistance':'Grants / asistencia técnica','Thematic bonds':'Bonos temáticos','Project preparation facilities':'Facilidades de preparación de proyectos','Development capital':'Capital de desarrollo','Early-stage equity':'Equity de etapa temprana','Commercial debt':'Deuda comercial','Refinancing':'Refinanciación','Green / thematic debt':'Deuda verde / temática','Institutional capital':'Capital institucional','Contingent support':'Soporte contingente','Equity / risk capital':'Equity / capital de riesgo','Revenue support':'Soporte de ingresos','Concessional / catalytic layer':'Capa concesional / catalítica','Local-currency debt':'Deuda en moneda local','Hedging':'Coberturas','Longer-tenor development debt':'Deuda de desarrollo de mayor plazo','Political-risk mitigation':'Mitigación de riesgo político','Phased financing':'Financiación por etapas'
  }:{};
  const T=v=>tr[v]||v;
  const uniq=a=>[...new Set(a.filter(Boolean))];
  let data;
  function fill(id,arr){const el=$(id);arr.forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=T(x.label);el.appendChild(o);});}
  function render(){
    if(!data)return;
    const s=data.sectors.find(x=>x.id===$('navSector')?.value), st=data.stages.find(x=>x.id===$('navStage')?.value), b=data.barriers.find(x=>x.id===$('navBarrier')?.value);
    if(!s||!st||!b){$('navResult').innerHTML=`<div class="notice">${copy.select}</div>`;return;}
    const instruments=uniq([...(s.baseline_instruments||[]),...(st.add_instruments||[]),...(b.add_instruments||[])]);
    const financiers=uniq([...(s.financier_types||[]),...(b.financier_types||[])]);
    const evidence=uniq(st.evidence||[]);
    const actions=uniq(b.actions||[]);
    $('navResult').innerHTML=`<article class="navigator-result"><p class="kicker">${copy.path}</p><h2>${esc(T(s.label))} · ${esc(T(st.label))}</h2><div class="navigator-grid"><div><h3>${copy.instruments}</h3><ul>${instruments.map(x=>`<li>${esc(T(x))}</li>`).join('')}</ul></div><div><h3>${copy.financiers}</h3><ul>${financiers.map(x=>`<li>${esc(T(x))}</li>`).join('')}</ul></div><div><h3>${copy.evidence}</h3><ul>${evidence.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><h3>${copy.actions}</h3><ul>${actions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div><div class="notice"><strong>${esc(copy.caution)}</strong></div></article>`;
  }
  fetch('/data/climate-finance-navigator.json').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(d=>{data=d;fill('navSector',d.sectors||[]);fill('navStage',d.stages||[]);fill('navBarrier',d.barriers||[]);['navSector','navStage','navBarrier'].forEach(id=>$(id)?.addEventListener('change',render));render();}).catch(()=>{$('navResult').innerHTML=`<div class="notice">${copy.unavailable}</div>`;});
})();
