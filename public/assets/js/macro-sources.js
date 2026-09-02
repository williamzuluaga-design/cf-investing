(() => {
  const containers = document.querySelectorAll('[data-macro-sources]');
  if (!containers.length) return;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  fetch('/data/macro-sources.json', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('macro_source_unavailable');
      return response.json();
    })
    .then((data) => {
      const source = Array.isArray(data.sources) ? data.sources[0] : null;
      if (!source) throw new Error('macro_source_missing');

      containers.forEach((container) => {
        const lang = container.dataset.lang === 'es' ? 'es' : 'en';
        const coverage = source.coverage || {};
        const status = lang === 'es' ? 'Fuente externa · solo referencia' : 'External source · reference only';
        const rights = lang === 'es'
          ? 'CF Investing monitorea la versión y el repositorio, pero no replica las series numéricas de GMD mientras no exista autorización escrita para este uso.'
          : 'CF Investing monitors the release and repository, but does not mirror GMD numerical series unless written permission covers this use.';
        const coverageText = lang === 'es'
          ? `${coverage.variables} variables · ${coverage.countries} países · ${coverage.sources} fuentes · ${coverage.historical_start}–${coverage.historical_end} (+ proyecciones a ${coverage.forecast_end})`
          : `${coverage.variables} variables · ${coverage.countries} countries · ${coverage.sources} sources · ${coverage.historical_start}–${coverage.historical_end} (+ forecasts to ${coverage.forecast_end})`;
        const links = lang === 'es'
          ? [['Explorar GMD', source.explore_url], ['Documentación', source.documentation_url], ['Repositorio GitHub', source.github_repository], ['Términos de uso', source.license_url]]
          : [['Explore GMD', source.explore_url], ['Documentation', source.documentation_url], ['GitHub repository', source.github_repository], ['Use terms', source.license_url]];

        container.innerHTML = `
          <article class="card">
            <span class="tag">${esc(status)}</span>
            <h3>${esc(source.name)} · v${esc(source.current_release)}</h3>
            <p>${esc(coverageText)}</p>
            <p>${esc(rights)}</p>
            <p>${links.map(([label, url]) => `<a href="${esc(url)}" rel="noopener">${esc(label)}</a>`).join(' · ')}</p>
            <p class="note">${esc(source.citation)}</p>
          </article>`;
      });
    })
    .catch(() => {
      containers.forEach((container) => {
        const lang = container.dataset.lang === 'es' ? 'es' : 'en';
        container.innerHTML = `<p class="note">${lang === 'es' ? 'La metadata de la fuente macro no está disponible temporalmente.' : 'Macro-source metadata is temporarily unavailable.'}</p>`;
      });
    });
})();
