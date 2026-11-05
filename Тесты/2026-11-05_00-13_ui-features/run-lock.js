const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOG = OUT + '\\run-lock.log';
fs.writeFileSync(LOG, '');
function say(s) { fs.appendFileSync(LOG, s + '\n'); try { console.log(s); } catch (e) {} }
function httpGet(p) { return new Promise((res, rej) => { const req = http.get({ host: '127.0.0.1', port: 9222, path: p, timeout: 5000 }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }); req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', rej); }); }
async function connect() {
  const tabs = JSON.parse(await httpGet('/json'));
  const tab = tabs.find(t => t.url.includes('127.0.0.1:8000'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const logs = [];
  ws.addEventListener('message', e => {
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 300));
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; logs.push('EXCEPTION: ' + ((d.exception && d.exception.description) || d.text || '').slice(0, 300)); }
    if (m.id && pending.has(m.id)) { const cb = pending.get(m.id); pending.delete(m.id); cb(m); }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); setTimeout(() => rej(new Error('ws timeout')), 8000); });
  const send = (method, params = {}) => { const i = ++id; return new Promise(res => { pending.set(i, res); try { ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { pending.delete(i); res({}); } setTimeout(() => { if (pending.has(i)) { pending.delete(i); res({ __timeout: true }); } }, 20000); }); };
  return { ws, send, logs };
}
(async () => {
  const { ws, send, logs } = await connect();
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  const shots = OUT + '\\screenshots\\';
  async function shot(n) { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s.result && s.result.data) fs.writeFileSync(shots + n + '.png', Buffer.from(s.result.data, 'base64')); }
  async function ev(x) { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.__timeout) return '__TIMEOUT__'; if (r.result && r.result.exceptionDetails) { const d = r.result.exceptionDetails; return 'JS-ERROR: ' + ((d.exception && d.exception.description) || d.text || '').slice(0, 300); } return r.result && r.result.result ? r.result.result.value : null; }
  const R = []; function p(k, v) { R.push({ k, v }); say(k + ': ' + JSON.stringify(v)); fs.writeFileSync(OUT + '\\results-lock.json', JSON.stringify(R, null, 2)); }

  // clean fresh load
  await send('Page.navigate', { url: 'http://127.0.0.1:8000/schedule/' });
  await new Promise(r => setTimeout(r, 5000));
  p('lock:body-class-on-load', await ev(`document.body.className || '(empty)'`));
  p('lock:active-modals', await ev(`[...document.querySelectorAll('.modal-overlay.active,.modal.active')].map(m=>m.id).join(',')||'(none)'`));
  p('lock:all-modals-display', await ev(`[...document.querySelectorAll('.modal-overlay')].map(m=>m.id+'='+getComputedStyle(m).display).join(' | ')`));
  p('lock:overflow', await ev(`getComputedStyle(document.body).overflow`));
  await shot('lock-initial');

  // which one gets active first? try clicking the row step by step
  p('lock:switch-list', await ev(`(()=>{[...document.querySelectorAll('.view-switch__btn')].find(x=>x.dataset.view==='list').click();return 'ok'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('lock:body-after-switch', await ev(`document.body.className || '(empty)'`));
  p('lock:active-after-switch', await ev(`[...document.querySelectorAll('.modal-overlay.active')].map(m=>m.id).join(',')||'(none)'`));

  p('lock:row-click', await ev(`(()=>{const r=document.querySelector('#dashboardList .order-row');r.click();return 'ok'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('lock:body-after-row-click', await ev(`document.body.className || '(empty)'`));
  p('lock:active-after-row-click', await ev(`[...document.querySelectorAll('.modal-overlay.active')].map(m=>m.id).join(',')||'(none)'`));
  p('lock:modal-count-total', await ev(`document.querySelectorAll('.modal-overlay').length`));
  p('lock:modal-ids', await ev(`[...document.querySelectorAll('.modal-overlay')].map(m=>m.id).join(',')`));
  p('lock:logs', logs.slice(0, 10));
  await shot('lock-after-row-click');

  // check which modal opened
  p('lock:visibility-of-each', await ev(`[...document.querySelectorAll('.modal-overlay')].map(m=>{const s=getComputedStyle(m);return m.id+':class='+m.className.replace('modal-overlay','').trim()+',display='+s.display}).join(' | ')`));

  say('=== LOCK DONE ===');
  ws.close(); process.exit(0);
})().catch(e => { say('FATAL: ' + e.message); process.exit(1); });
