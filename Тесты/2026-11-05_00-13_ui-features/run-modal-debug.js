const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOG = OUT + '\\run-modal-debug.log';
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
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 200));
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
  async function ev(x) { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.__timeout) return '__TIMEOUT__'; if (r.result && r.result.exceptionDetails) return 'EXC'; return r.result && r.result.result ? r.result.result.value : null; }
  async function nav(u, w = 3500) { logs.length = 0; await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u }); await new Promise(r => setTimeout(r, w)); }
  const R = []; function p(k, v) { R.push({ k, v }); say(k + ': ' + JSON.stringify(v)); fs.writeFileSync(OUT + '\\results-modal.json', JSON.stringify(R, null, 2)); }

  await nav('/schedule/');
  p('m:calendar-title', await ev(`document.getElementById('calendarTitle').textContent`));
  p('m:event-count', await ev(`document.querySelectorAll('#calendarGrid .calendar-event').length`));
  p('m:cell-with-event', await ev(`(()=>{const e=document.querySelector('#calendarGrid .calendar-event');if(!e)return 'none';const cell=e.closest('.calendar-cell');return cell?cell.dataset.date:'nocell'})()`));
  p('m:list-mode', await ev(`(()=>{const b=[...document.querySelectorAll('.view-switch__btn')].find(x=>x.dataset.view==='list');b.click();return 'switched'})()`));
  await new Promise(r => setTimeout(r, 1200));
  p('m:list-rows', await ev(`document.querySelectorAll('#dashboardList .order-row').length`));
  p('m:row-ids', await ev(`[...document.querySelectorAll('#dashboardList .order-row')].map(r=>r.dataset.orderId).join(',')`));
  // click via real CDP mouse event
  const rect = await ev(`(()=>{const r=document.querySelector('#dashboardList .order-row');if(!r)return 'norow';const b=r.getBoundingClientRect();return JSON.stringify({x:Math.round(b.left+b.width/2),y:Math.round(b.top+b.height/2)})})()`);
  p('m:row-rect', rect);
  if (rect && rect !== 'norow') {
    const { x, y } = JSON.parse(rect);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 1500));
  }
  p('m:after-real-click-active', await ev(`document.getElementById('eventModal').classList.contains('active')`));
  p('m:after-real-click-class', await ev(`document.getElementById('eventModal').className`));
  p('m:after-real-click-display', await ev(`getComputedStyle(document.getElementById('eventModal')).display`));
  p('m:modal-body-len', await ev(`document.getElementById('eventModalBody').innerText.length`));
  p('m:modal-body-text', await ev(`document.getElementById('eventModalBody').innerText.replace(/\\n+/g,' | ').slice(0,300)`));
  await shot('m-real-click-modal');
  p('m:logs', logs.slice(0, 8));

  // try availability modal
  await nav('/schedule/');
  p('m:ctx-open', await ev(`(()=>{const cell=document.querySelector('#calendarGrid .calendar-cell[data-date="2026-11-15"]')||document.querySelectorAll('#calendarGrid .calendar-cell')[20];const r=cell.getBoundingClientRect();cell.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+20,clientY:r.top+20}));return 'ctx'})()`));
  await new Promise(r => setTimeout(r, 700));
  p('m:ctx-visible', await ev(`document.getElementById('scheduleContextMenu').style.display`));
  p('m:avail-click', await ev(`(()=>{const it=[...document.querySelectorAll('#scheduleContextMenu .context-menu-item')].find(x=>x.dataset.action==='create-availability');if(!it)return 'nf';it.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 2000));
  p('m:avail-active', await ev(`document.getElementById('availabilityModal').classList.contains('active')`));
  p('m:avail-emps', await ev(`document.getElementById('availabilityEmployee').options.length`));
  await shot('m-availability');
  p('m:avail-logs', logs.slice(0, 8));

  say('=== MODAL DEBUG DONE ===');
  ws.close(); process.exit(0);
})().catch(e => { say('FATAL: ' + e.message); process.exit(1); });
