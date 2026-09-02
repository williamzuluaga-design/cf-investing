(() => {
  const root = document.querySelector('[data-executive-watchlist]');
  if (!root) return;

  const lang = root.getAttribute('data-lang') === 'es' ? 'es' : 'en';
  const selectedKey = 'cf-watchlist-selected-v1';
  const snapshotKey = 'cf-watchlist-snapshot-v1';
  const text = {
    en: {
      choose: 'Choose topics to follow',
      selected: 'selected',
      max: 'Maximum five topics.',
      current: 'Current reviewed signals',
      noneSelected: 'Choose at least one topic to build your local watchlist.',
      noSignal: 'No reviewed CF Pulse signal currently matches this topic.',
      firstVisit: 'Baseline created. Future changes can be highlighted on your next visit.',
      changed: 'New since your last visit',
      unchanged: 'No new reviewed signal since your last visit',
      mark: 'Mark current signals as seen',
      saved: 'Current signals marked as seen.',
      local: 'Preferences and comparison snapshots stay in this browser. No account or personal data is sent to CF Investing.',
      unavailable: 'The watchlist is temporarily unavailable.'
    },
    es: {
      choose: 'Elige los temas que quieres seguir',
      selected: 'seleccionados',
      max: 'Máximo cinco temas.',
      current: 'Señales revisadas actuales',
      noneSelected: 'Elige al menos un tema para construir tu lista local.',
      noSignal: 'Actualmente no hay una señal revisada de CF Pulse que coincida con este tema.',
      firstVisit: 'Se creó la línea base. En tu próxima visita se podrán resaltar cambios.',
      changed: 'Nuevo desde tu última visita',
      unchanged: 'Sin nuevas señales revisadas desde tu última visita',
      mark: 'Marcar señales actuales como vistas',
      saved: 'Las señales actuales quedaron marcadas como vistas.',
      local: 'Las preferencias y comparaciones permanecen en este navegador. No se envía una cuenta ni datos personales a CF Investing.',
      unavailable: 'La lista ejecutiva no está disponible temporalmente.'
    }
  }[lang];

  const loadJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  };

  const normalize = (value) => String(value || '').toLowerCase();
  const signalText = (signal) => normalize([
    signal.type,
    signal.label_en, signal.label_es,
    signal.headline_en, signal.headline_es,
    signal.metric_en, signal.metric_es,
    signal.why_en, signal.why_es,
    ...(signal.sources || []).map((s) => s.name)
  ].join(' '));

  const signature = (signal) => [
    signal.id,
    signal.headline_en,
    signal.headline_es,
    signal.metric_en,
    signal.metric_es
  ].join('|');

  Promise.all([
    fetch('/data/watchlist-topics.json', { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`topics HTTP ${r.status}`);
      return r.json();
    }),
    fetch('/data/executive-pulse.json', { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`pulse HTTP ${r.status}`);
      return r.json();
    })
  ]).then(([config, pulse]) => {
    const maxTopics = Number(config.max_topics) || 5;
    let selected = loadJSON(selectedKey, []).filter((id) => config.topics.some((t) => t.id === id));
    const previous = loadJSON(snapshotKey, {});

    const header = document.createElement('div');
    header.className = 'watchlist-head';
    const h2 = document.createElement('h2');
    h2.textContent = text.choose;
    const counter = document.createElement('p');
    counter.className = 'watchlist-counter';
    header.append(h2, counter);

    const chooser = document.createElement('div');
    chooser.className = 'watchlist-topics';

    const results = document.createElement('div');
    results.className = 'watchlist-results';

    const status = document.createElement('p');
    status.className = 'note';

    const markButton = document.createElement('button');
    markButton.type = 'button';
    markButton.className = 'button secondary';
    markButton.textContent = text.mark;

    const privacy = document.createElement('p');
    privacy.className = 'watchlist-privacy';
    privacy.textContent = text.local;

    const matchSignals = (topic) => {
      const terms = (topic.terms || []).map(normalize).filter(Boolean);
      return (pulse.signals || []).filter((signal) => {
        const haystack = signalText(signal);
        return terms.some((term) => haystack.includes(term));
      });
    };

    const currentSnapshot = () => {
      const snap = {};
      config.topics.forEach((topic) => {
        snap[topic.id] = matchSignals(topic).map(signature);
      });
      return snap;
    };

    const saveCurrent = () => {
      localStorage.setItem(snapshotKey, JSON.stringify(currentSnapshot()));
    };

    const render = () => {
      counter.textContent = `${selected.length}/${maxTopics} ${text.selected} · ${text.max}`;
      chooser.textContent = '';
      results.textContent = '';
      status.textContent = '';

      config.topics.forEach((topic) => {
        const label = document.createElement('label');
        label.className = 'watchlist-topic';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = selected.includes(topic.id);
        input.disabled = !input.checked && selected.length >= maxTopics;
        input.addEventListener('change', () => {
          if (input.checked && !selected.includes(topic.id) && selected.length < maxTopics) selected.push(topic.id);
          if (!input.checked) selected = selected.filter((id) => id !== topic.id);
          localStorage.setItem(selectedKey, JSON.stringify(selected));
          render();
        });
        const copy = document.createElement('span');
        const strong = document.createElement('strong');
        strong.textContent = topic[`label_${lang}`];
        const small = document.createElement('small');
        small.textContent = topic[`description_${lang}`];
        copy.append(strong, small);
        label.append(input, copy);
        chooser.appendChild(label);
      });

      if (!selected.length) {
        status.textContent = text.noneSelected;
        markButton.hidden = true;
        return;
      }

      markButton.hidden = false;
      const heading = document.createElement('h3');
      heading.textContent = text.current;
      results.appendChild(heading);

      selected.forEach((topicId) => {
        const topic = config.topics.find((t) => t.id === topicId);
        if (!topic) return;
        const matches = matchSignals(topic);
        const card = document.createElement('article');
        card.className = 'watchlist-card';
        const title = document.createElement('h4');
        title.textContent = topic[`label_${lang}`];
        card.appendChild(title);

        if (!matches.length) {
          const p = document.createElement('p');
          p.textContent = text.noSignal;
          card.appendChild(p);
          results.appendChild(card);
          return;
        }

        const prior = Array.isArray(previous[topic.id]) ? previous[topic.id] : null;
        const newSignals = prior ? matches.filter((s) => !prior.includes(signature(s))) : [];
        const badge = document.createElement('p');
        badge.className = newSignals.length ? 'watchlist-badge new' : 'watchlist-badge';
        badge.textContent = prior === null ? text.firstVisit : (newSignals.length ? `${text.changed}: ${newSignals.length}` : text.unchanged);
        card.appendChild(badge);

        const list = document.createElement('ul');
        matches.forEach((signal) => {
          const li = document.createElement('li');
          const isNew = prior && !prior.includes(signature(signal));
          const strong = document.createElement('strong');
          strong.textContent = signal[`headline_${lang}`];
          const span = document.createElement('span');
          span.textContent = ` — ${signal[`metric_${lang}`]}`;
          li.append(strong, span);
          if (isNew) li.className = 'watchlist-new-item';
          list.appendChild(li);
        });
        card.appendChild(list);
        results.appendChild(card);
      });
    };

    markButton.addEventListener('click', () => {
      saveCurrent();
      status.textContent = text.saved;
      setTimeout(() => { status.textContent = ''; }, 2500);
    });

    window.addEventListener('pagehide', saveCurrent, { once: true });
    root.append(header, chooser, results, markButton, status, privacy);
    render();
  }).catch(() => {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = text.unavailable;
    root.appendChild(p);
  });
})();
