(() => {
  const forms = document.querySelectorAll('[data-newsletter-form]');
  if (!forms.length) return;

  const copy = {
    en: {
      invalid: 'Enter a valid email address.',
      consent: 'Please confirm that you want to receive the CF Investing Brief.',
      sending: 'Submitting…',
      success: 'Check your inbox to confirm your subscription.',
      error: 'We could not start the subscription. Please try again.',
      later: 'Too many attempts. Please try again later.'
    },
    es: {
      invalid: 'Ingresa un correo electrónico válido.',
      consent: 'Confirma que deseas recibir CF Investing Brief.',
      sending: 'Enviando…',
      success: 'Revisa tu correo para confirmar la suscripción.',
      error: 'No fue posible iniciar la suscripción. Intenta nuevamente.',
      later: 'Demasiados intentos. Intenta de nuevo más tarde.'
    }
  };

  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

  forms.forEach((form) => {
    const lang = form.dataset.lang === 'es' ? 'es' : 'en';
    const source = form.dataset.source || 'home';
    const interest = form.dataset.interest || 'general';
    const t = copy[lang];
    const status = form.querySelector('[data-newsletter-status]');
    const submit = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = form.elements.email?.value?.trim() || '';
      const consent = Boolean(form.elements.consent?.checked);
      const companyWebsite = form.elements.company_website?.value || '';

      if (!validEmail(email)) {
        status.textContent = t.invalid;
        return;
      }
      if (!consent) {
        status.textContent = t.consent;
        return;
      }

      submit.disabled = true;
      status.textContent = t.sending;

      try {
        const response = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email,
            language: lang,
            source,
            interest,
            company_website: companyWebsite
          })
        });
        const body = await response.json().catch(() => ({}));

        if (response.ok && body.ok) {
          status.textContent = t.success;
          form.reset();
          return;
        }
        status.textContent = response.status === 429 ? t.later : t.error;
      } catch (_) {
        status.textContent = t.error;
      } finally {
        submit.disabled = false;
      }
    });
  });
})();
