const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const project = path.resolve(__dirname, '..');
const html = fs.readdirSync(project).find(name => name.includes('p_lsares') && name.endsWith('.html'));
const log = fs.openSync(path.join(__dirname, 'edge.log'), 'w');
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-gpu-sandbox', '--in-process-gpu',
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--remote-debugging-port=9224', `--user-data-dir=${path.join(__dirname, 'edge-cdp')}`, 'about:blank'
], { windowsHide: true, stdio: ['ignore', log, log] });

let socket;
let shutdown;
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
  shutdown=()=>cdp('Browser.close');
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
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await cdp('Page.navigate', { url: pathToFileURL(path.join(project, html)).href });
  for (let i = 0; i < 40; i++) {
    if (await evaluate(`Boolean(document.querySelector('#cell-0 .section-details') && document.querySelector('.scene-photo').naturalWidth)`)) break;
    await wait(250);
  }
  await wait(700);
  const settle = async () => {
    for (let i=0; i<60; i++) {
      if (await evaluate(`!document.getElementById('focus-next').disabled`)) {
        await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`);
        return;
      }
      await wait(100);
    }
    throw new Error('La cámara no terminó su transición');
  };
  const inspect = () => evaluate(`(() => {
    const s=document.querySelector('.is-focused'); if(!s) return null;
    const r=s.getBoundingClientRect(), t=document.querySelector('.focus-toolbar').getBoundingClientRect();
    const figure=s.querySelector('.independent-figure-card'), f=figure.getBoundingClientRect();
    const p=s.querySelector('.section-detail-paragraph');
    const m=new DOMMatrixReadOnly(getComputedStyle(document.getElementById('poster-sheet')).transform);
    return { id:s.id, inSheet:s.closest('#poster-sheet')!==null,
      sameParent:s.parentElement===window.originalParents[Number(s.id.slice(5))],
      sameFigure:figure===window.originalFigures[Number(s.id.slice(5))],
      sameNote:figure.querySelector('.apa-figure-top-header').innerHTML===window.originalNotes[Number(s.id.slice(5))],
      box:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},
      toolbarTop:t.top, width:innerWidth,height:innerHeight,
      uniform:Math.abs(m.a-m.d)<.0001,scale:m.a,
      paragraphPixels:parseFloat(getComputedStyle(p).fontSize)*m.a,
      figurePixels:parseFloat(getComputedStyle(s.querySelector('.apa-fig-note-top')).fontSize)*m.a,
      figureInside:f.left>=r.left-1&&f.right<=r.right+1,
      pictures:document.querySelectorAll('.scene-photo').length,
      backgroundParent:document.querySelector('.scene-photo').closest('#poster-sheet')!==null,
      opaque:getComputedStyle(figure).backgroundColor,
      readingScroll:s.querySelector('.section-details').scrollHeight>s.querySelector('.section-details').clientHeight
      , layout:{height:getComputedStyle(s).height,requested:s.style.getPropertyValue('--focus-local-height'),scale:s.style.getPropertyValue('--camera-scale'),font:getComputedStyle(p).fontSize,stageScroll:document.querySelector('.poster-stage-wrapper').scrollTop,sectionScroll:s.scrollTop}
    };
  })()`);
  const assertPanel = (label, item) => assert(label, item && item.inSheet && item.sameParent && item.sameFigure && item.sameNote &&
    item.uniform && item.pictures===1 && item.backgroundParent && item.box.left>=-1 && item.box.top>=-1 &&
    item.box.right<=item.width+1 && item.box.bottom<=item.toolbarTop-5 && item.paragraphPixels>=15.5 && item.figurePixels>=12 &&
    item.figureInside && item.opaque==='rgb(252, 250, 246)', item);
  await evaluate(`window.originalSections=Array.from({length:6},(_,i)=>document.getElementById('cell-'+i));
    window.originalParents=originalSections.map(s=>s.parentElement);
    window.originalFigures=originalSections.map(s=>s.querySelector('.independent-figure-card'));
    window.originalNotes=originalFigures.map(f=>f.querySelector('.apa-figure-top-header').innerHTML); true`);
  const initial=await evaluate(`({previews:document.querySelectorAll('.section-preview').length, paragraphs:document.querySelectorAll('.section-detail-paragraph').length,
    portrait:document.querySelector('.scene-photo').naturalHeight>document.querySelector('.scene-photo').naturalWidth,
    logos:Array.from(document.querySelectorAll('.logo-wrap img'),i=>({src:i.getAttribute('src'),loaded:i.naturalWidth>0})),
    painting:{width:document.querySelector('.scene-photo').naturalWidth,height:document.querySelector('.scene-photo').naturalHeight}})`);
  assert('Fondo vertical, resúmenes y logos recortados cargados',initial.previews===6&&initial.paragraphs===18&&initial.portrait&&initial.logos.every(i=>i.loaded&&i.src.endsWith('_recortado.svg')),initial);
  await screenshot('v2-poster-desktop');
  await evaluate(`document.getElementById('cell-0').click(); true`);
  await wait(280);
  const firstStage=await evaluate(`({reframed:document.querySelector('.is-focused')!==null, scale:new DOMMatrixReadOnly(getComputedStyle(document.getElementById('poster-sheet')).transform).a,
    originals:originalSections.every((s,i)=>s.parentElement===originalParents[i]), pictures:document.querySelectorAll('.scene-photo').length})`);
  assert('Primero la cámara amplía el recuadro original sin reorganizarlo',!firstStage.reframed&&firstStage.scale>1.05&&firstStage.originals&&firstStage.pictures===1,firstStage);
  await screenshot('v2-camera-step-1');
  await settle();
  assertPanel('Introducción completa dentro del borde y en la misma hoja',await inspect());
  await screenshot('v2-introduccion-desktop');
  const background0=await evaluate(`({x:document.getElementById('custom-background-slot').getBoundingClientRect().left,y:document.getElementById('custom-background-slot').getBoundingClientRect().top})`);
  await evaluate(`document.getElementById('focus-motion').click()`);
  assert('Pausa de animación en el fondo único',await evaluate(`getComputedStyle(document.querySelector('.scene-stars-near')).animationPlayState==='paused'`));
  await evaluate(`document.querySelector('.is-focused .cite-ref-trigger').click()`);
  assert('Referencia accesible desde el texto',await evaluate(`!document.getElementById('references-modal').hidden && document.getElementById('ref-baade').classList.contains('highlight-blink')`));
  await evaluate(`document.getElementById('btn-close-refs').click()`);
  for(let i=1;i<6;i++) {
    await evaluate(`document.getElementById('focus-next').click()`);
    await settle();
    assertPanel('Recuadro completo e íntegro de sección '+(i+1),await inspect());
    if(i===2) await screenshot('v2-vela-desktop');
  }
  const background5=await evaluate(`({x:document.getElementById('custom-background-slot').getBoundingClientRect().left,y:document.getElementById('custom-background-slot').getBoundingClientRect().top})`);
  assert('Cada sección conserva un recorte diferente del bosque',Math.abs(background5.y-background0.y)>100,{introduction:background0,conclusions:background5});
  await evaluate(`close16x9Zoom()`);
  assert('Regreso sin reemplazar, clonar ni mover secciones',await evaluate(`!document.querySelector('.camera-active') && !document.querySelector('.is-focused') && originalSections.every((s,i)=>s.parentElement===originalParents[i]) && document.querySelectorAll('.scene-photo').length===1 && !document.querySelector('.focus-source-placeholder')`));
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate(`document.getElementById('cell-0').focus();document.getElementById('cell-0').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));true`);
  await settle();
  await screenshot('v2-introduccion-mobile');
  const mobileInfo=await inspect();
  assertPanel('Móvil: recuadro entero y letras legibles',mobileInfo);
  await evaluate(`document.querySelector('.is-focused .section-content').scrollTop=100000`);
  await screenshot('v2-introduccion-mobile-texto');
  await evaluate(`document.getElementById('focus-next').click()`);await settle();
  await evaluate(`document.getElementById('focus-next').click()`);await settle();
  await evaluate(`document.getElementById('focus-next').click()`);await settle();
  await evaluate(`document.getElementById('focus-next').click()`);await settle();
  await evaluate(`document.getElementById('focus-next').click()`);await settle();
  assertPanel('Móvil: último recuadro completo',await inspect());
  await evaluate(`close16x9Zoom()`);
  await evaluate(`openReferencesModal()`);
  assert('Referencias desde la vista general',await evaluate(`!document.getElementById('references-modal').hidden&&document.querySelector('.poster-stage-wrapper').inert`));
  await evaluate(`document.getElementById('btn-close-refs').click()`);
  await evaluate(`zoomToSection(0)`);
  await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await wait(400);await settle();
  assertPanel('Cámara ajustada después de cambiar el tamaño de ventana',await inspect());
  await evaluate(`dispatchEvent(new Event('beforeprint'));true`);
  assert('Impresión restaura la hoja y sus seis secciones',await evaluate(`!document.querySelector('.camera-active')&&originalSections.every((s,i)=>s.parentElement===originalParents[i])`));
  assert('Sin errores JavaScript',errors.length===0,errors);
  fs.writeFileSync(path.join(__dirname,'verification-v2.json'),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
  await cdp('Browser.close');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(shutdown&&socket?.readyState===WebSocket.OPEN)await Promise.race([shutdown().catch(()=>{}),wait(1000)]);
  socket?.close();browser.kill();fs.closeSync(log);
});
