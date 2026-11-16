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
  await evaluate(`zoomToSection(0)`);
  assert('Lectura sin texto de otras secciones detrás',await evaluate(`Array.from(document.querySelectorAll('.poster-section-outer:not(.is-focused)')).every(s=>getComputedStyle(s).visibility==='hidden')&&getComputedStyle(document.querySelector('.is-focused')).visibility==='visible'`));
  await screenshot('v2-introduccion-desktop');
  await evaluate(`close16x9Zoom()`);
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate(`zoomToSection(0)`);await wait(150);
  await screenshot('v2-introduccion-mobile');
  await evaluate(`document.querySelector('.is-focused .section-content').scrollTop=100000`);await wait(80);
  await screenshot('v2-introduccion-mobile-texto');
  await evaluate(`close16x9Zoom()`);
  assert('Regreso vuelve a mostrar todos los recuadros',await evaluate(`Array.from(document.querySelectorAll('.poster-section-outer')).every(s=>getComputedStyle(s).visibility==='visible')`));
  console.log(JSON.stringify({passed:checks.length,errors}));
  await cdp('Browser.close');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(shutdown&&socket?.readyState===WebSocket.OPEN)await Promise.race([shutdown().catch(()=>{}),wait(1000)]);
  socket?.close();browser.kill();fs.closeSync(log);
});
