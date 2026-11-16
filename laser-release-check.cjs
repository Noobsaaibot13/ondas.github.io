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
  const deadline=Date.parse('2026-11-18T00:00:00-05:00');
  const before=Date.parse('2026-11-16T12:00:00-05:00');
  const clock=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const RealDate=Date;window.__testNow=${before};window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[window.__testNow]));}static now(){return window.__testNow;}};})();`});
  const laser=fs.readdirSync(project).find(name=>name.includes('l_ser')&&name.endsWith('.html'));
  const pulsar=fs.readdirSync(project).find(name=>name.includes('p_lsares')&&name.endsWith('.html'));
  const navigate=async file=>{
    await cdp('Page.navigate',{url:pathToFileURL(path.join(project,file)).href});
    for(let i=0;i<70;i++){
      if(await evaluate(`document.readyState==='complete'&&location.pathname.endsWith(${JSON.stringify(file)})`))break;
      await wait(100);
    }
    await wait(150);
  };
  const setTime=timestamp=>evaluate(`window.__testNow=${timestamp};dispatchEvent(new Event('pageshow'));true`);
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate('index.html');
  const state=await evaluate(`({timers:document.querySelectorAll('[data-countdown]').length,owner:document.querySelector('[data-countdown]').closest('.project-card').id,blocked:document.getElementById('release-button').disabled,thirdTimers:document.querySelectorAll('#upcoming-card [data-countdown]').length,days:document.querySelector('[data-days]').textContent,hours:document.querySelector('[data-hours]').textContent,pulsar:!!document.querySelector('a.project-card[href*="p_lsares"]')})`);
  assert('Solo El láser tiene contador y bloqueo',state.timers===1&&state.owner==='laser-card'&&state.blocked&&state.thirdTimers===0&&state.pulsar,state);
  assert('Cuenta hasta el miércoles 18 a las 00:00 de Panamá',state.days==='01'&&state.hours==='12',state);
  await evaluate(`document.getElementById('release-button').click()`);
  assert('La tarjeta del láser no navega antes de tiempo',await evaluate(`location.pathname.endsWith('index.html')`));
  await screenshot('laser-fecha-index');
  await navigate(laser);
  assert('La URL directa del láser muestra el bloqueo y oculta el póster',await evaluate(`!document.getElementById('release-locked').hidden&&document.getElementById('release-content').hidden&&document.getElementById('poster-sheet').getClientRects().length===0`));
  await screenshot('laser-fecha-bloqueado');
  await setTime(deadline-1000);
  assert('Un segundo antes el láser sigue bloqueado',await evaluate(`document.getElementById('release-content').hidden&&document.querySelector('[data-seconds]').textContent==='01'`));
  await setTime(deadline);
  assert('A las 00:00 se muestra el póster en la misma página',await evaluate(`document.getElementById('release-locked').hidden&&!document.getElementById('release-content').hidden&&document.getElementById('poster-sheet').getBoundingClientRect().width>700`));
  await evaluate(`zoomToSection(2)`);
  await cdp('Network.enable');
  await cdp('Network.setBlockedURLs',{urls:['https://*','http://*']});
  const image=await evaluate(`(async()=>{const panel=document.querySelector('#cell-2 .section-extra-media');panel.open=true;const img=panel.querySelector('img');img.loading='eager';await img.decode();document.querySelector('#cell-2 .section-details').scrollTop=100000;return {source:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight,note:panel.querySelector('.extra-media-note').textContent};})()`);
  assert('La figura complementaria 3 carga como SVG local sin red',image.source==='images/laser_cavidad_resonante.svg'&&image.width===960&&image.height===540,image);
  assert('La nueva nota identifica correctamente el esquema elaborado',image.note.includes('Esquema elaborado para este póster')&&image.note.includes('Siegman (1986)'),image);
  await screenshot('laser-complementaria-3-reparada');
  await evaluate(`close16x9Zoom()`);
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await wait(200);
  await evaluate(`zoomToSection(2)`);
  const mobile=await evaluate(`(()=>{const s=document.querySelector('.is-focused'),r=s.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,toolbar:document.querySelector('.focus-toolbar').getBoundingClientRect().top,image:s.querySelector('.section-extra-media img').naturalWidth};})()`);
  assert('El recuadro de la figura reparada sigue completo en móvil',mobile.left>=0&&mobile.right<=391&&mobile.top>=0&&mobile.bottom<mobile.toolbar&&mobile.image===960,mobile);
  await evaluate(`close16x9Zoom()`);
  await setTime(deadline-1);
  assert('La fecha se vuelve a comprobar al recuperar la página',await evaluate(`document.getElementById('release-content').hidden&&!document.getElementById('release-locked').hidden`));
  await navigate(pulsar);
  assert('Púlsares continúa disponible antes del miércoles',await evaluate(`document.getElementById('poster-sheet').getBoundingClientRect().width>300&&!document.getElementById('release-locked')`));
  await navigate('index.html');
  await setTime(deadline);
  assert('La tarjeta del láser se habilita al alcanzar la fecha',await evaluate(`!document.getElementById('release-button').disabled&&document.getElementById('laser-card').classList.contains('is-released')&&!document.getElementById('upcoming-card').classList.contains('is-released')`));
  const released=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`window.__testNow=${deadline};`});
  await evaluate(`document.getElementById('release-button').click()`);await wait(900);
  assert('El botón habilitado abre el archivo real del láser',await evaluate(`location.pathname.endsWith(${JSON.stringify(laser)})&&!document.getElementById('release-content').hidden`));
  await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:released.identifier});
  await navigate('proxima_entrega.html');
  assert('El espacio por anunciar ya no tiene temporizador',await evaluate(`document.querySelectorAll('[data-countdown]').length===0&&!document.querySelector('script[src="entregas.js"]')`));
  const vm=require('node:vm');
  const baseline=fs.readFileSync(path.join(__dirname,'before-laser/laser_script.js'),'utf8').split('let activeSecIndex = 0;')[0];
  const current=fs.readFileSync(path.join(project,'laser_script.js'),'utf8');
  const originalData=vm.runInNewContext(baseline+'\nSECTIONS_DATA',{window:{}});
  const currentData=vm.runInNewContext(current+'\nSECTIONS_DATA',{window:{}});
  assert('Se conservan los 18 párrafos y las otras cinco figuras complementarias',originalData.every((s,i)=>JSON.stringify(s.cards)===JSON.stringify(currentData[i].cards))&&originalData.every((s,i)=>i===2||s.secondaryGifUrl===currentData[i].secondaryGifUrl));
  assert('Sin errores JavaScript',errors.length===0,errors);
  fs.writeFileSync(path.join(__dirname,'verification-laser-release.json'),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
  await cdp('Browser.close');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(shutdown&&socket?.readyState===WebSocket.OPEN)await Promise.race([shutdown().catch(()=>{}),wait(1000)]);
  socket?.close();browser.kill();fs.closeSync(log);
});
