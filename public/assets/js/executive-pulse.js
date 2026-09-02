(() => {
  const root = document.querySelector('[data-cf-pulse]');
  if (!root) return;

  const lang = root.getAttribute('data-lang') === 'es' ? 'es' : 'en';
  const text = {
    en: {
      updated: 'Updated',
      review: 'Review by',
      sources: 'Sources',
      sourceStatus: 'Evidence',
      unavailable: 'CF Pulse is temporarily unavailable.'
    },
    es: {
      updated: 'Actualizado',
      review: 'Revisar antes de',
      sources: 'Fuentes',
      sourceStatus: 'Evidencia',
      unavailable: 'CF Pulse no está disponible temporalmente.'
    }
  }[lang];

  const fmt = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-CO' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(d);
  };

  const getUrl = (src) => src[`url_${lang}`] || src.url || src.url_en || src.url_es || '#';

  fetch('/data/executive-pulse.json', { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      const stale = new Date() > new Date(`${data.review_by}T23:59:59`);
      const status = document.createElement('p');
      status.className = 'pulse-meta';
      status.textContent = `${text.updated}: ${fmt(data.updated_at)} · ${text.review}: ${fmt(data.review_by)}${stale ? ' · Review due' : ''}`;
      root.appendChild(status);

      const grid = document.createElement('div');
      grid.className = 'pulse-grid';

      data.signals.slice(0, 3).forEach((signal) => {
        const card = document.createElement('article');
        card.className = 'pulse-card';

        const label = document.createElement('p');
        label.className = 'pulse-label';
        label.textContent = signal[`label_${lang}`];

        const h3 = document.createElement('h3');
        h3.textContent = signal[`headline_${lang}`];

        const metric = document.createElement('p');
        metric.className = 'pulse-metric';
        metric.textContent = signal[`metric_${lang}`];

        const why = document.createElement('p');
        why.textContent = signal[`why_${lang}`];

        const details = document.createElement('details');
        details.className = 'pulse-sources';
        const summary = document.createElement('summary');
        summary.textContent = text.sources;
        details.appendChild(summary);

        const evidence = document.createElement('p');
        evidence.className = 'pulse-evidence';
        evidence.textContent = `${text.sourceStatus}: ${signal.source_status}`;
        details.appendChild(evidence);

        const list = document.createElement('ul');
        signal.sources.forEach((src) => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = getUrl(src);
          a.textContent = src.name;
          if (/^https?:\/\//.test(a.href)) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          }
          li.appendChild(a);
          list.appendChild(li);
        });
        details.appendChild(list);

        card.append(label, h3, metric, why, details);
        grid.appendChild(card);
      });

      root.appendChild(grid);
    })
    .catch(() => {
      const p = document.createElement('p');
      p.className = 'note';
      p.textContent = text.unavailable;
      root.appendChild(p);
    });
})();
