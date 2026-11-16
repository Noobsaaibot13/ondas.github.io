/* Apertura del póster de láser. Panamá usa UTC−05:00. */
(() => {
  'use strict';
  const RELEASE_AT = Date.parse('2026-11-18T00:00:00-05:00');
  const RELEASE_DESTINATION = 'p_ster_cient_fico_vertical_el_l_ser_rub_n_concepci_n_universidad_de_panam.html';
  const timers = document.querySelectorAll('[data-countdown]');
  const button = document.getElementById('release-button');
  const card = document.getElementById('laser-card');
  const locked = document.getElementById('release-locked');
  const content = document.getElementById('release-content');
  let previousState;
  let tick;
  function update() {
    const remaining = Math.max(0, RELEASE_AT - Date.now());
    const released = Number.isFinite(remaining) && remaining === 0;
    const seconds = Math.ceil(remaining / 1000);
    const parts = { days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24,
      minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
    for (const timer of timers) {
      for (const [name, value] of Object.entries(parts)) {
        const text = String(Number.isFinite(value) ? value : '--').padStart(2, '0');
        const field = timer.querySelector(`[data-${name}]`);
        if (field && field.textContent !== text) field.textContent = text;
      }
      timer.setAttribute('aria-label', released ? 'La fecha de apertura ya llegó' :
        `${parts.days} días, ${parts.hours} horas, ${parts.minutes} minutos y ${parts.seconds} segundos hasta la apertura`);
    }
    if (button) {
      button.disabled = !released;
      button.setAttribute('aria-disabled', String(!released));
    }
    if (card) card.classList.toggle('is-released', released);
    if (locked) locked.hidden = released;
    if (content) content.hidden = !released;
    if (document.body.dataset.releasePage === 'laser') document.body.classList.toggle('laser-locked', !released);
    if (released !== previousState) {
      const status = document.getElementById('release-status');
      const badge = document.getElementById('release-badge');
      if (status) status.textContent = released ? 'Emisión estimulada, luz coherente y una revolución en la física.' : 'Este póster se habilita a las 00:00, hora de Panamá.';
      if (badge) badge.textContent = released ? 'Disponible' : 'Acceso bloqueado';
      if (button) button.innerHTML = released ? 'Explorar póster <span aria-hidden="true">↗</span>' : 'Disponible el 18 de noviembre <span aria-hidden="true">↗</span>';
      previousState = released;
    }
    return released;
  }
  button?.addEventListener('click', () => { if (update()) window.location.assign(RELEASE_DESTINATION); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
  window.addEventListener('pageshow', update);
  update();
  tick = window.setInterval(update, 1000);
  window.addEventListener('pagehide', event => { if (!event.persisted) clearInterval(tick); });
})();
