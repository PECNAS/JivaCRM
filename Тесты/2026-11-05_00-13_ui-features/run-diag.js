const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOG = OUT + '\\run-diag.log';
fs.writeFileSync(LOG, '');
function say(s) { fs.appendFileSync(LOG, s + '\n'); try { console.log(s); } catch (e) {} }
function httpGet(p) { return new Promise((res, rej) => { const req = http.get({ host: '127.0.0.1', port: 9222, path: p, timeout: 5000 }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }); req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', rej); }); }
async function connect() {
  const tabs = JSON.parse(await httpGet('/json'));
  const tab = tabs.find(t => t.url.includes('127.0.0.1:8000'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const logs = []; const net = [];
  ws.addEventListener('message', e => {
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 400));
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; logs.push('EXCEPTION: ' + ((d.exception && d.exception.description) || d.text || '').slice(0, 500)); }
    if (m.method === 'Network.responseReceived') net.push(m.params.response.status + ' ' + m.params.response.url.replace('http://127.0.0.1:8000', '').slice(0, 80));
    if (m.method === 'Log.entryAdded') logs.push('LOG.' + m.params.entry.level + ': ' + m.params.entry.text.slice(0, 200));
    if (m.id && pending.has(m.id)) { const cb = pending.get(m.id); pending.delete(m.id); cb(m); }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); setTimeout(() => rej(new Error('ws timeout')), 8000); });
  const send = (method, params = {}) => { const i = ++id; return new Promise(res => { pending.set(i, res); try { ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { pending.delete(i); res({}); } setTimeout(() => { if (pending.has(i)) { pending.delete(i); res({ __timeout: true }); } }, 20000); }); };
  return { ws, send, logs, net };
}
(async () => {
  const { ws, send, logs, net } = await connect();
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  async function ev(x) { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.__timeout) return '__TIMEOUT__'; if (r.result && r.result.exceptionDetails) { const d = r.result.exceptionDetails; return 'JS-ERROR: ' + ((d.exception && d.exception.description) || d.text || '').slice(0, 400); } return r.result && r.result.result ? r.result.result.value : null; }
  const R = []; function p(k, v) { R.push({ k, v }); say(k + ': ' + JSON.stringify(v)); fs.writeFileSync(OUT + '\\results-diag.json', JSON.stringify(R, null, 2)); }

  // clear localStorage view then load
  await send('Page.navigate', { url: 'http://127.0.0.1:8000/schedule/' });
  await new Promise(r => setTimeout(r, 1000));
  await ev(`localStorage.setItem('jiva_schedule_view','calendar')`);
  logs.length = 0; net.length = 0;
  await send('Page.navigate', { url: 'http://127.0.0.1:8000/schedule/' });
  await new Promise(r => setTimeout(r, 5000));

  p('cal:title', await ev(`document.getElementById('calendarTitle').textContent`));
  p('cal:grid-children', await ev(`document.getElementById('calendarGrid').children.length`));
  p('cal:grid-html-len', await ev(`document.getElementById('calendarGrid').innerHTML.length`));
  p('cal:grid-first-200', await ev(`document.getElementById('calendarGrid').innerHTML.replace(/\\s+/g,' ').slice(0,200)`));
  p('cal:schedule-js-loaded', await ev(`[...document.scripts].map(s=>s.src).filter(s=>/schedule/.test(s)).join(',')`));
  p('cal:window-refreshSchedule', await ev(`typeof window.refreshSchedule`));
  p('cal:localStorage-view', await ev(`localStorage.getItem('jiva_schedule_view')`));
  p('cal:list-display', await ev(`getComputedStyle(document.getElementById('dashboardList')).display`));
  p('cal:cal-display', await ev(`getComputedStyle(document.getElementById('dashboardCalendar')).display`));
  p('cal:orders-fetch', await ev(`fetch('/orders/list/?status=all',{cache:'no-store'}).then(r=>r.json()).then(d=>JSON.stringify({count:(d.orders||[]).length, first:(d.orders||[])[0]?{id:d.orders[0].id,date:d.orders[0].date,has_date:d.orders[0].has_date,name:d.orders[0].name}:null}))`));
  p('cal:net', net.slice(0, 20));
  p('cal:logs', logs.slice(0, 10));

  // now switch to list and check eventModal wiring
  p('cal:switch-list', await ev(`(()=>{const b=[...document.querySelectorAll('.view-switch__btn')].find(x=>x.dataset.view==='list');if(!b)return 'nobtn';b.click();return 'ok'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('cal:rows', await ev(`document.querySelectorAll('#dashboardList .order-row').length`));
  p('cal:row-classes', await ev(`[...document.querySelectorAll('#dashboardList .order-row')].map(r=>r.className+':'+r.dataset.orderId).join(' | ')`));

  // try clicking row via dispatchEvent
  p('cal:row-dispatch', await ev(`(function(){const r=document.querySelector('#dashboardList .order-row');if(!r)return 'norow';r.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return 'dispatched'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('cal:modal-after-dispatch', await ev(`'active='+document.getElementById('eventModal').classList.contains('active')+' display='+getComputedStyle(document.getElementById('eventModal')).display`));
  p('cal:modal-body-after', await ev(`document.getElementById('eventModalBody').innerText.replace(/\\n+/g,' | ').slice(0,250)`));
  p('cal:logs-after-click', logs.slice(0, 10));

  // check eventModal stacking: is it hidden behind something?
  p('cal:eventModal-z', await ev(`(()=>{const m=document.getElementById('eventModal');const s=getComputedStyle(m);return JSON.stringify({z:s.zIndex,pos:s.position,disp:s.display,op:s.opacity,vis:s.visibility,pe:s.pointerEvents})})()`));
  p('cal:body-classes', await ev(`document.body.className`));

  say('=== DIAG DONE ===');
  ws.close(); process.exit(0);
})().catch(e => { say('FATAL: ' + e.message); process.exit(1); });
