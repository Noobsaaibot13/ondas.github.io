/** Cámara sobre la hoja original. Ninguna sección ni fondo se traslada a un modal. */
(() => {
  'use strict';
  const sheet = document.getElementById('poster-sheet');
  const stage = document.querySelector('.poster-stage-wrapper');
  const controls = document.getElementById('immersive-focus');
  const background = document.getElementById('custom-background-slot');
  const references = document.getElementById('references-modal');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const records = SECTIONS_DATA.map((data, index) => ({ section: document.getElementById(`cell-${index}`), data, index }));
  const summaries = window.POSTER_SETTINGS?.summaries || [
    'De los núcleos ultradensos al modelo del faro: el origen de las estrellas de neutrones.',
    'Una señal de radio extraordinariamente regular reveló una nueva clase de estrella.',
    'Campos magnéticos, pérdida de energía y chorros relativistas en una estrella de neutrones.',
    'El viento de un púlsar esculpe una nebulosa; la acreción puede acelerar su rotación.',
    'Los pulsos permiten descubrir planetas y medir los efectos de la gravitación.',
    'De la astrofísica extrema al cronometraje y la navegación espacial autónoma.'
  ];
  const subheadings = window.POSTER_SETTINGS?.subheadings || [
    ['El origen de las estrellas de neutrones', 'La predicción de Pacini', 'El modelo del faro'],
    ['El radiotelescopio de Cambridge', 'Una señal entre los registros', 'CP 1919 y su origen natural'],
    ['La magnetosfera y el cilindro de luz', 'La energía de rotación', 'Vela: chorros y glitches'],
    ['PSR B1509-58', 'La nebulosa de viento de púlsar', 'Púlsares reciclados'],
    ['Los primeros exoplanetas', 'El púlsar binario de Hulse y Taylor', 'Una antena de escala galáctica'],
    ['Un laboratorio de física extrema', 'Relojes naturales del cosmos', 'Navegación con NICER/SEXTANT']
  ];
  let active = null, busy = false, saved = null, closeRequested = false, resizeRequested = false;
  let paused = reduced.matches, referenceOpener = null, epoch = 0;
  const inertState = new Map();
  let fullImagePromise;
  function upgradePainting() {
    const photo = background.querySelector('.scene-photo');
    const source = photo.dataset.zoomSrc;
    if (!source || new URL(source, document.baseURI).href === photo.src || fullImagePromise) return;
    fullImagePromise = new Promise(resolve => {
      const original = new Image();
      original.onload = () => {
        const ratio = photo.naturalWidth / photo.naturalHeight;
        if (Math.abs(original.naturalWidth / original.naturalHeight - ratio) < .002) photo.src = source;
        resolve();
      };
      original.onerror = resolve;
      original.src = source;
    });
  }
  const mathText = text => text.replace(/\\\\/g, '\\');
  function typeset(element) {
    if (window.renderMathInElement) window.renderMathInElement(element, {
      delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false
    });
  }
  function animate(element, frames, options = {}) {
    if (reduced.matches) return Promise.resolve();
    return element.animate(frames, { duration: 650, easing: 'cubic-bezier(.22, 1, .36, 1)', ...options }).finished.catch(() => {});
  }
  function setBusy(value) {
    busy = value;
    document.getElementById('focus-next').disabled = value;
    document.getElementById('focus-previous').disabled = value;
    stage.setAttribute('aria-busy', String(value));
  }
  function setInert(element, value) {
    if (!inertState.has(element)) inertState.set(element, element.inert);
    element.inert = value;
  }
  function restoreInert() {
    inertState.forEach((value, element) => { element.inert = value; });
    inertState.clear();
  }
  function select(record) {
    records.forEach(other => setInert(other.section, other !== record));
    document.querySelectorAll('.poster-header, .title-banner, .author-bar, .poster-footer-bar')
      .forEach(element => setInert(element, true));
    record.section.classList.add('camera-selected');
    record.section.setAttribute('role', 'region');
    record.section.setAttribute('aria-labelledby', `section-title-${record.index}`);
    record.section.removeAttribute('tabindex');
    active = record;
    document.getElementById('focus-counter').textContent = `${String(record.index + 1).padStart(2, '0')} / 06`;
  }
  function deselect(record) {
    record.section.classList.remove('camera-selected', 'is-focused', 'camera-narrow');
    record.section.style.removeProperty('--camera-scale');
    record.section.style.removeProperty('--focus-local-height');
    record.section.style.removeProperty('--focus-note-size');
    record.section.style.width = record.originalWidth;
    record.section.setAttribute('role', 'button');
    record.section.setAttribute('tabindex', '0');
    record.reading.scrollTop = 0;
    record.content.scrollTop = 0;
  }
  function currentScale() { return new DOMMatrixReadOnly(getComputedStyle(sheet).transform).a || 1; }
  function worldRect(element) {
    const record = records.find(item => item.section === element);
    if (record?.worldPosition) {
      const style = getComputedStyle(element);
      return { ...record.worldPosition, width: parseFloat(style.width), height: parseFloat(style.height) };
    }
    // Medidas de composición, independientes de la matriz que se esté animando.
    // Dividir rectángulos ya transformados producía lecturas incoherentes al rotar un móvil.
    let left = 0, top = 0, node = element;
    while (node && node !== sheet) {
      left += node.offsetLeft;
      top += node.offsetTop;
      const parent = node.offsetParent;
      if (parent) { left += parent.clientLeft; top += parent.clientTop; }
      node = parent;
    }
    const style = getComputedStyle(element);
    return { left, top, width: parseFloat(style.width), height: parseFloat(style.height) };
  }
  function available() {
    const narrow = innerWidth <= 760, padding = narrow ? 12 : 30;
    const toolbar = document.querySelector('.focus-toolbar').getBoundingClientRect();
    return { left: padding, top: padding, width: innerWidth - padding * 2,
      height: Math.max(180, innerHeight - toolbar.height - padding * 2 - 24), narrow };
  }
  function transformFor(rectangle) {
    const area = available();
    const scale = Math.min(area.width / rectangle.width, area.height / rectangle.height);
    const left = area.left + (area.width - rectangle.width * scale) / 2;
    const top = area.top + (area.height - rectangle.height * scale) / 2;
    return { transform: `translate(${left - saved.paper.left - rectangle.left * scale}px, ${top - saved.paper.top - rectangle.top * scale}px) scale(${scale})`, scale };
  }
  async function moveCamera(target, duration = 700) {
    const from = getComputedStyle(sheet).transform;
    sheet.style.transform = target.transform;
    await animate(sheet, [{ transform: from }, { transform: target.transform }], { duration });
  }
  function freezePaper() {
    const paper = sheet.getBoundingClientRect(), painting = background.getBoundingClientRect();
    const layer = document.querySelector('.poster-layer').getBoundingClientRect();
    const gridHeight = document.querySelector('.poster-main-grid').getBoundingClientRect().height;
    // Congela también los recuadros vecinos: revelar texto no debe desplazar el mapa del póster.
    records.forEach(record => {
      const bounds = record.section.getBoundingClientRect();
      record.sourceStyle = record.section.getAttribute('style');
      record.worldPosition = { left: bounds.left - paper.left, top: bounds.top - paper.top };
      record.section.style.setProperty('--source-left', `${bounds.left - layer.left}px`);
      record.section.style.setProperty('--source-top', `${bounds.top - layer.top}px`);
      record.section.style.setProperty('--source-width', `${bounds.width}px`);
      record.section.style.setProperty('--source-height', `${bounds.height}px`);
    });
    saved = { paper, scrollX, scrollY, sheetStyle: sheet.getAttribute('style'), stageStyle: stage.getAttribute('style'),
      backgroundStyle: background.getAttribute('style') };
    const columns = getComputedStyle(document.querySelector('.poster-main-grid')).gridTemplateColumns;
    stage.classList.add('camera-active');
    sheet.classList.add('camera-world');
    Object.assign(sheet.style, { left: `${paper.left}px`, top: `${paper.top}px`, width: `${paper.width}px`,
      height: `${paper.height}px`, transform: 'none' });
    sheet.style.setProperty('--camera-columns', columns);
    sheet.style.setProperty('--camera-grid-height', `${gridHeight}px`);
    // Coordenadas fijas de la pintura: al ampliar no se reinicia ni se repite el bosque.
    Object.assign(background.style, { width: `${painting.width}px`, height: `${painting.height}px`, right: 'auto', bottom: 'auto' });
    document.body.classList.add('focus-open');
    controls.hidden = false;
  }
  function restoreStyle(element, value) {
    if (value === null) element.removeAttribute('style'); else element.setAttribute('style', value);
  }
  function unfreezePaper() {
    const previous = saved;
    restoreStyle(sheet, previous.sheetStyle);
    restoreStyle(stage, previous.stageStyle);
    restoreStyle(background, previous.backgroundStyle);
    sheet.classList.remove('camera-world');
    records.forEach(record => { restoreStyle(record.section, record.sourceStyle); record.worldPosition = null; });
    stage.classList.remove('camera-active');
    controls.hidden = true;
    controls.classList.remove('is-entering', 'is-leaving');
    document.body.classList.remove('focus-open');
    restoreInert();
    active = null;
    saved = null;
    setBusy(false);
    stage.removeAttribute('aria-busy');
    closeRequested = false;
    window.scrollTo({ left: previous.scrollX, top: previous.scrollY, behavior: 'instant' });
  }
  function focusLayout(record) {
    const area = available(), rectangle = worldRect(record.section), localWidth = rectangle.width;
    const scale = area.width / localWidth;
    record.section.style.width = `${localWidth}px`;
    record.section.style.setProperty('--camera-scale', scale);
    record.section.style.setProperty('--focus-note-size', `${12.5 / scale}px`);
    record.section.style.setProperty('--focus-local-height', `${area.height / scale}px`);
    record.section.classList.toggle('camera-narrow', area.narrow);
    record.section.classList.add('is-focused');
    // La composición tiene medidas explícitas; no se vuelve a medir su ancho intrínseco
    // mientras el navegador está distribuyendo fórmulas y fuentes en un móvil.
    return { scale, transform: `translate(${area.left - saved.paper.left - rectangle.left * scale}px, ${area.top - saved.paper.top - rectangle.top * scale}px) scale(${scale})` };
  }
  function compensateChild(before, after, scale) {
    return `translate(${(before.left - after.left) / scale}px, ${(before.top - after.top) / scale}px) scale(${before.width / after.width}, ${before.height / after.height})`;
  }
  async function unfold(record) {
    const figureBefore = record.figure.getBoundingClientRect(), oldHeight = worldRect(record.section).height, scale = currentScale();
    const target = focusLayout(record), figureAfter = record.figure.getBoundingClientRect();
    const finalHeight = parseFloat(record.section.style.getPropertyValue('--focus-local-height'));
    const effects = [
      moveCamera(target, 650),
      animate(record.section, [{ height: `${oldHeight}px` }, { height: `${finalHeight}px` }], { duration: 650 }),
      animate(record.figure, [{ transform: compensateChild(figureBefore, figureAfter, scale) }, { transform: 'none' }], { duration: 750 })
    ];
    record.reading.querySelectorAll('.section-detail-group, .section-equation').forEach((element, index) => {
      effects.push(animate(element, [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }],
        { duration: 420, delay: 240 + index * 100, fill: 'backwards' }));
    });
    await Promise.all(effects);
  }
  async function finishInteraction(ticket) {
    if (ticket !== epoch || !active) return;
    controls.classList.remove('is-entering');
    setBusy(false);
    if (resizeRequested) { resizeRequested = false; await resizeCamera(); }
    if (closeRequested) await closeZoom();
  }
  async function openSection(index) {
    if (busy || !references.hidden) return;
    if (active) { if (active.index !== index) await navigate(index - active.index); return; }
    const record = records[index];
    if (!record) return;
    const ticket = ++epoch;
    freezePaper();
    upgradePainting();
    setBusy(true);
    select(record);
    controls.classList.add('is-entering');
    document.getElementById('focus-back').focus({ preventScroll: true });
    // Paso 1: se amplía el recuadro completo con su composición original intacta.
    await moveCamera(transformFor(worldRect(record.section)), 850);
    if (ticket !== epoch) return;
    // Paso 2: figura y texto se acomodan dentro de ese mismo borde.
    await unfold(record);
    await finishInteraction(ticket);
  }
  async function closeZoom({ instant = false } = {}) {
    if (!active) return;
    if (busy && !instant) { closeRequested = true; return; }
    if (!references.hidden) closeReferences();
    const ticket = ++epoch, record = active;
    setBusy(true);
    controls.classList.add('is-leaving');
    if (instant) {
      sheet.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
      deselect(record);
      unfreezePaper();
      return;
    }
    const figureBefore = record.figure.getBoundingClientRect(), scale = currentScale();
    deselect(record);
    record.section.classList.add('camera-selected');
    const figureAfter = record.figure.getBoundingClientRect();
    await Promise.all([
      moveCamera({ transform: 'none' }, 850),
      animate(record.figure, [{ transform: compensateChild(figureBefore, figureAfter, scale) }, { transform: 'none' }], { duration: 850 })
    ]);
    if (ticket !== epoch) return;
    record.section.classList.remove('camera-selected');
    unfreezePaper();
    record.section.focus({ preventScroll: true });
  }
  async function navigate(direction) {
    if (!active || busy || !references.hidden) return;
    const ticket = ++epoch;
    setBusy(true);
    const previous = active, next = records[(previous.index + direction + records.length) % records.length];
    deselect(previous);
    select(next);
    await moveCamera(transformFor(worldRect(next.section)), 800);
    if (ticket !== epoch) return;
    await unfold(next);
    await finishInteraction(ticket);
  }
  async function resizeCamera() {
    if (!active) return;
    if (busy) { resizeRequested = true; return; }
    const ticket = epoch;
    setBusy(true);
    await moveCamera(focusLayout(active), 200);
    if (ticket === epoch) setBusy(false);
  }
  function updateMotion() {
    document.body.classList.toggle('motion-paused', paused);
    const button = document.getElementById('focus-motion');
    button.textContent = paused ? 'Activar animación' : 'Pausar animación';
    button.setAttribute('aria-pressed', String(paused));
  }
  function openReferences(highlightId) {
    if (!references.hidden) return;
    referenceOpener = document.activeElement;
    references.hidden = false;
    references.classList.add('open');
    if (active) active.section.inert = true; else stage.inert = true;
    controls.inert = true;
    document.body.classList.add('focus-open');
    references.querySelectorAll('.apa-ref-entry').forEach(element => element.classList.remove('highlight-blink'));
    document.getElementById('btn-close-refs').focus({ preventScroll: true });
    if (highlightId) {
      const target = document.getElementById(highlightId);
      if (target) { target.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'center' }); target.classList.add('highlight-blink'); }
    }
  }
  function closeReferences() {
    references.hidden = true;
    references.classList.remove('open');
    controls.inert = false;
    if (active) active.section.inert = false;
    else { stage.inert = false; document.body.classList.remove('focus-open'); }
    if (referenceOpener?.isConnected) referenceOpener.focus({ preventScroll: true });
  }
  function initialize() {
    records.forEach(record => {
      const { section, data, index } = record;
      record.originalWidth = section.style.width;
      section.querySelector('.zoom-pill').textContent = 'Acercar ↗';
      section.querySelector('.section-magazine-title').id = `section-title-${index}`;
      const preview = document.createElement('p');
      preview.className = 'section-preview';
      preview.textContent = summaries[index];
      section.append(preview);
      const content = document.createElement('div');
      content.className = 'section-content';
      record.figure = section.querySelector('.independent-figure-card');
      content.append(record.figure);
      const reading = document.createElement('div');
      reading.className = 'section-details';
      reading.setAttribute('role', 'region');
      reading.setAttribute('aria-label', `Texto completo: ${data.title}`);
      reading.tabIndex = 0;
      data.cards.forEach((text, paragraphIndex) => {
        const group = document.createElement('div');
        group.className = 'section-detail-group';
        const subtitle = document.createElement('h4');
        subtitle.textContent = `${String(paragraphIndex + 1).padStart(2, '0')}  ${subheadings[index][paragraphIndex]}`;
        const paragraph = document.createElement('p');
        paragraph.className = 'section-detail-paragraph';
        paragraph.innerHTML = mathText(text);
        group.append(subtitle, paragraph);
        reading.append(group);
      });
      if (data.hasMathModel && data.latexFormula) {
        const equation = document.createElement('div');
        equation.className = 'section-equation';
        const subtitle = document.createElement('h4');
        subtitle.textContent = data.latexTitle.replace(' en LaTeX', '');
        const formula = document.createElement('div');
        formula.textContent = mathText(data.latexFormula);
        equation.append(subtitle, formula);
        reading.append(equation);
      }
      if (data.secondaryGifUrl && data.secondaryGifNote) {
        const extra = document.createElement('details');
        extra.className = 'section-extra-media';
        const label = document.createElement('summary');
        label.textContent = 'Material visual complementario';
        const note = document.createElement('div');
        note.className = 'extra-media-note';
        note.innerHTML = data.secondaryGifNote;
        const image = document.createElement('img');
        image.src = data.secondaryGifUrl;
        image.alt = `Material visual complementario de ${data.title}`;
        image.loading = 'lazy';
        extra.append(label, note, image);
        reading.append(extra);
      }
      reading.querySelectorAll('.cite-ref-trigger').forEach(citation => {
        citation.tabIndex = 0;
        citation.setAttribute('role', 'button');
        citation.setAttribute('aria-label', `Ver referencia ${citation.textContent}`);
      });
      content.append(reading);
      section.append(content);
      record.content = content;
      record.reading = reading;
      section.addEventListener('keydown', event => {
        if (event.target === section && !active && ['Enter', ' '].includes(event.key)) { event.preventDefault(); openSection(index); }
      });
    });
    updateMotion();
    document.getElementById('focus-back').addEventListener('click', () => closeZoom());
    document.getElementById('focus-next').addEventListener('click', () => navigate(1));
    document.getElementById('focus-previous').addEventListener('click', () => navigate(-1));
    document.getElementById('focus-motion').addEventListener('click', () => { paused = !paused; updateMotion(); });
    document.getElementById('focus-references').addEventListener('click', () => openReferences());
    document.getElementById('btn-close-refs').addEventListener('click', closeReferences);
    references.addEventListener('click', event => { if (event.target === references) closeReferences(); });
    document.querySelector('.ref-inline-columns').addEventListener('keydown', event => {
      if (['Enter', ' '].includes(event.key)) { event.preventDefault(); openReferences(); }
    });
    typeset(document.body);
    window.addEventListener('load', () => typeset(document.body), { once: true });
  }
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') { if (!references.hidden) closeReferences(); else if (active) closeZoom(); return; }
    const citation = event.target.closest?.('.cite-ref-trigger');
    if (citation && ['Enter', ' '].includes(event.key)) { event.preventDefault(); citation.click(); return; }
    const scope = !references.hidden ? [references] : active ? [active.section, controls] : null;
    if (!scope) return;
    if (event.key === 'Tab') {
      const focusable = scope.flatMap(element => Array.from(element.querySelectorAll('button, a[href], [tabindex="0"]')))
        .filter(element => !element.disabled && element.getClientRects().length && !element.closest('[inert]'));
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (active && references.hidden && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault(); navigate(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  let resizeFrame;
  addEventListener('resize', () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(resizeCamera); });
  reduced.addEventListener('change', () => { paused = reduced.matches; updateMotion(); });
  addEventListener('beforeprint', () => { if (!references.hidden) closeReferences(); if (active) closeZoom({ instant: true }); });
  window.zoomToSection = openSection;
  window.close16x9Zoom = () => closeZoom();
  window.openReferencesModal = openReferences;
  window.jumpToReference = openReferences;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true }); else initialize();
})();
