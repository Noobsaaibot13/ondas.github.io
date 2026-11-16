const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const project = path.resolve(__dirname, '..');
const html = fs.readdirSync(project).find(name => name.endsWith('.html'));
const log = fs.openSync(path.join(__dirname, 'edge.log'), 'w');
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-gpu-sandbox', '--in-process-gpu',
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--remote-debugging-port=9224', `--user-data-dir=${path.join(__dirname, 'edge-cdp')}`, 'about:blank'
], { windowsHide: true, stdio: ['ignore', log, log] });

let socket;
const checks = [];
const errors = [];
function assert(name, condition, evidence) {
  checks.push({ name, pass: Boolean(condition), ...(evidence === undefined ? {} : { evidence }) });
  if (!condition) throw new Error(name + ': ' + JSON.stringify(evidence));
}
async function main() {
  let targets;
  for (let i = 0; i < 45; i++) {
    try { targets = await (await fetch('http://127.0.0.1:9224/json/list')).json(); break; }
    catch { await wait(500); }
  }
  if (!targets) throw new Error('Edge no abrió el puerto CDP. ' + fs.readFileSync(path.join(__dirname, 'edge.log'), 'utf8').slice(-2400));
  const target = targets.find(item => item.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const response = JSON.parse(event.data);
    if (response.method === 'Runtime.exceptionThrown') errors.push(response.params.exceptionDetails);
    if (response.id && pending.has(response.id)) {
      const { resolve, reject } = pending.get(response.id);
      pending.delete(response.id);
      response.error ? reject(new Error(JSON.stringify(response.error))) : resolve(response.result);
    }
  };
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const response = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const screenshot = async name => {
    const result = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(__dirname, name + '.png'), Buffer.from(result.data, 'base64'));
  };
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: pathToFileURL(path.join(project, html)).href });
  for (let i = 0; i < 40; i++) {
    if (await evaluate(`Boolean(document.querySelector('#cell-0 .section-details') && document.querySelector('.scene-photo').naturalWidth)`)) break;
    await wait(250);
  }
  await wait(700);
  const initial = await evaluate(`(() => {
    window.originalSections = Array.from({length:6}, (_,i) => document.getElementById('cell-'+i));
    window.originalFigures = originalSections.map(s => s.querySelector('.independent-figure-card'));
    window.originalNotes = originalFigures.map(f => f.querySelector('.apa-figure-top-header').innerHTML);
    return { sections: originalSections.length, paragraphs: document.querySelectorAll('.section-detail-paragraph').length,
      photo: document.querySelector('.scene-photo').naturalWidth, horizontal: document.documentElement.scrollWidth > innerWidth };
  })()`);
  assert('Carga de fondo y seis secciones con todos los párrafos', initial.sections === 6 && initial.paragraphs === 18 && initial.photo > 1000 && !initial.horizontal, initial);
  await screenshot('poster-desktop');
  await evaluate(`document.getElementById('cell-0').click(); true`);
  await wait(220);
  const camera = await evaluate(`(() => { const s=document.querySelector('.is-focused'); return { width:s.getBoundingClientRect().width, viewport:innerWidth, transform:getComputedStyle(s).transform }; })()`);
  assert('Acercamiento real con escala intermedia desde el cuadro pulsado', camera.width>400 && camera.width<camera.viewport && camera.transform!=='none', camera);
  await screenshot('acercamiento-en-curso');
  for (let attempt=0; attempt<30; attempt++) {
    if (await evaluate(`!document.getElementById('focus-next').disabled`)) break;
    await wait(150);
  }
  const zoom = await evaluate(`(() => {
    const s = document.querySelector('.is-focused'), f = s.querySelector('.independent-figure-card');
    const bounds = s.getBoundingClientRect();
    return { sameSection:s===originalSections[0], sameFigure:f===originalFigures[0], sameNote:f.querySelector('.apa-figure-top-header').innerHTML===originalNotes[0],
      width:bounds.width, height:bounds.height, background:getComputedStyle(f).backgroundColor,
      paragraphs:s.querySelectorAll('.section-detail-paragraph').length, layers:s.querySelectorAll('.scene-layer').length,
      focus:document.activeElement.id, inert:document.querySelector('.poster-stage-wrapper').inert,
      overflow:s.scrollHeight>s.clientHeight, mathErrors:document.querySelectorAll('.section-details .katex-error').length };
  })()`);
  assert('Zoom de la misma sección y figura, nota intacta y superficie opaca', zoom.sameSection && zoom.sameFigure && zoom.sameNote && zoom.width >= 1400 && zoom.height === 1000 && zoom.background === 'rgb(252, 250, 246)' && zoom.paragraphs === 3 && zoom.layers >= 4 && zoom.inert, zoom);
  await screenshot('introduccion-desktop');
  await evaluate(`document.getElementById('focus-motion').click()`);
  assert('Pausa de animaciones SVG', await evaluate(`document.getElementById('focus-motion').getAttribute('aria-pressed')==='true' && getComputedStyle(document.querySelector('.is-focused .scene-stars-near')).animationPlayState==='paused'`));
  await evaluate(`document.querySelector('.is-focused .cite-ref-trigger').click()`);
  assert('Referencias sobre la sección y cita resaltada', await evaluate(`!document.getElementById('references-modal').hidden && document.getElementById('ref-baade').classList.contains('highlight-blink') && document.activeElement.id==='btn-close-refs'`));
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  assert('Escape cierra referencias y mantiene el acercamiento', await evaluate(`document.getElementById('references-modal').hidden && !document.getElementById('immersive-focus').hidden && !document.getElementById('immersive-focus').inert`));
  for (let i=1; i<6; i++) {
    await evaluate(`document.getElementById('focus-next').click()`);
    for (let attempt=0; attempt<30; attempt++) {
      if (await evaluate(`document.querySelector('.is-focused')?.id==='cell-${i}' && !document.getElementById('focus-next').disabled`)) break;
      await wait(150);
    }
    const item = await evaluate(`(() => { const s=document.querySelector('.is-focused'); return {
      id:s.id, same:s===originalSections[${i}], figure:s.querySelector('.independent-figure-card')===originalFigures[${i}],
      note:s.querySelector('.apa-figure-top-header').innerHTML===originalNotes[${i}], paragraphs:s.querySelectorAll('.section-detail-paragraph').length,
      horizontal:s.scrollWidth>s.clientWidth, count:document.getElementById('focus-counter').textContent
    }; })()`);
    assert('Navegación íntegra a sección '+(i+1), item.id==='cell-'+i && item.same && item.figure && item.note && item.paragraphs===3 && !item.horizontal, item);
  }
  await evaluate(`close16x9Zoom()`);
  assert('Regreso restaura la cuadrícula y el foco', await evaluate(`document.getElementById('immersive-focus').hidden && !document.querySelector('.focus-source-placeholder') && originalSections.every(s=>s.closest('.poster-sheet')) && !document.querySelector('.poster-stage-wrapper').inert && document.activeElement.id==='cell-5'`));
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await evaluate(`document.getElementById('cell-0').focus(); document.getElementById('cell-0').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true}));`);
  await wait(300);
  const mobile = await evaluate(`(() => { const s=document.querySelector('.is-focused'), t=document.querySelector('.focus-toolbar').getBoundingClientRect(); return {
    id:s?.id, width:s?.clientWidth, scrollWidth:s?.scrollWidth, scrollHeight:s?.scrollHeight, clientHeight:s?.clientHeight,
    toolbar:{left:t.left,right:t.right,bottom:t.bottom}, animation:getComputedStyle(s.querySelector('.scene-stars-near')).animationName,
    mathErrors:s.querySelectorAll('.katex-error').length
  }; })()`);
  assert('Vista móvil accesible, sin desborde y con movimiento reducido', mobile.id==='cell-0' && mobile.scrollWidth===mobile.width && mobile.scrollHeight>mobile.clientHeight && mobile.toolbar.left>=0 && mobile.toolbar.right<=390 && mobile.toolbar.bottom<=844 && mobile.animation==='none', mobile);
  await screenshot('introduccion-mobile');
  await evaluate(`document.querySelector('.is-focused').scrollTop=100000`);
  await screenshot('introduccion-mobile-texto');
  await evaluate(`close16x9Zoom()`);
  await evaluate(`openReferencesModal()`);
  assert('Referencias desde la hoja sin zoom', await evaluate(`!document.getElementById('references-modal').hidden && document.querySelector('.poster-stage-wrapper').inert`));
  await evaluate(`document.getElementById('btn-close-refs').click()`);
  assert('Restauración desde referencias', await evaluate(`!document.querySelector('.poster-stage-wrapper').inert && !document.body.classList.contains('focus-open')`));
  await evaluate(`zoomToSection(2, document.getElementById('cell-2'))`);
  await evaluate(`dispatchEvent(new Event('beforeprint'))`);
  assert('Impresión restaura todas las figuras en la hoja', await evaluate(`document.getElementById('immersive-focus').hidden && originalSections.every(s=>s.closest('.poster-sheet'))`));
  assert('Sin errores JavaScript', errors.length===0, errors);
  fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ passed:checks.length, checks }, null, 2));
  await cdp('Browser.close');
}
main().catch(error => { console.error(error); process.exitCode=1; }).finally(() => {
  socket?.close();
  browser.kill();
  fs.closeSync(log);
});
