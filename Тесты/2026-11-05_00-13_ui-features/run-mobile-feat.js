const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOG = OUT + '\\run-mobile-feat.log';
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
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ': ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 200));
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; logs.push('EXCEPTION: ' + ((d.exception && d.exception.description) || d.text || '').slice(0, 200)); }
    if (m.id && pending.has(m.id)) { const cb = pending.get(m.id); pending.delete(m.id); cb(m); }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); setTimeout(() => rej(new Error('ws timeout')), 8000); });
  const send = (method, params = {}) => { const i = ++id; return new Promise(res => { pending.set(i, res); try { ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { pending.delete(i); res({}); } setTimeout(() => { if (pending.has(i)) { pending.delete(i); res({ __timeout: true }); } }, 20000); }); };
  return { ws, send, logs };
}
(async () => {
  const { ws, send, logs } = await connect();
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const shots = OUT + '\\screenshots\\';
  async function shot(n) { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s.result && s.result.data) fs.writeFileSync(shots + n + '.png', Buffer.from(s.result.data, 'base64')); }
  async function ev(x) { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.__timeout) return '__TIMEOUT__'; if (r.result && r.result.exceptionDetails) return 'JS-ERROR'; return r.result && r.result.result ? r.result.result.value : null; }
  async function nav(u, w = 3500) { logs.length = 0; await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u }); await new Promise(r => setTimeout(r, w)); }
  const R = []; function p(k, v) { R.push({ k, v }); say(k + ': ' + JSON.stringify(v)); fs.writeFileSync(OUT + '\\results-mobile-feat.json', JSON.stringify(R, null, 2)); }

  await ev(`localStorage.setItem('jiva_schedule_view','calendar')`);

  // calendar on mobile
  await nav('/schedule/');
  p('mm:grid-width', await ev(`(()=>{const g=document.getElementById('calendarGrid');const r=g.getBoundingClientRect();return JSON.stringify({gridW:Math.round(r.width),viewport:document.documentElement.clientWidth,overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1})})()`));
  p('mm:cal-title', await ev(`document.getElementById('calendarTitle').textContent`));
  p('mm:events', await ev(`document.querySelectorAll('#calendarGrid .calendar-event').length`));
  p('mm:visible-columns', await ev(`(()=>{const heads=[...document.querySelectorAll('.calendar-header')];const vw=document.documentElement.clientWidth;return heads.filter(h=>{const r=h.getBoundingClientRect();return r.left>=0 && r.right<=vw}).map(h=>h.textContent).join(',')})()`));
  await shot('mm-calendar');

  // menu toggle
  p('mm:menu-toggle', await ev(`(()=>{const b=document.getElementById('menuToggle');if(!b)return 'missing';return 'display='+getComputedStyle(b).display})()`));
  await ev(`(()=>{const b=document.getElementById('menuToggle');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 800));
  p('mm:menu-open', await ev(`(()=>{const n=document.getElementById('mainMenu');return n?getComputedStyle(n).display+'|'+n.className:'missing'})()`));
  p('mm:menu-links', await ev(`[...document.querySelectorAll('#mainMenu a')].map(a=>a.textContent.trim()+':'+(a.getBoundingClientRect().width>0?'vis':'hidden')).join(',')`));
  await shot('mm-menu');

  // board: order editor on mobile
  await nav('/schedule/');
  await ev(`(()=>{const b=[...document.querySelectorAll('.view-switch__btn')].find(x=>x.dataset.view==='list');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 1200));
  p('mm:list-rows', await ev(`document.querySelectorAll('#dashboardList .order-row').length`));
  await shot('mm-list');
  if (await ev(`document.querySelectorAll('#dashboardList .order-row').length`) > 0) {
    await ev(`(()=>{document.querySelector('#dashboardList .order-row').click()})()`);
    await new Promise(r => setTimeout(r, 2500));
    p('mm:editor-open', await ev(`document.getElementById('orderEditorModal').classList.contains('active')`));
    p('mm:editor-fit', await ev(`(()=>{const m=document.querySelector('#orderEditorModal .modal, #orderEditorModal > *');if(!m)return 'nomodal';const r=m.getBoundingClientRect();return JSON.stringify({w:Math.round(r.width),h:Math.round(r.height),fitsW:r.width<=390})})()`));
    await shot('mm-order-editor');
    p('mm:editor-console', logs.slice(0, 5));
  }

  // money tabs mobile
  await nav('/money/');
  p('mm:money-tabs-visible', await ev(`(()=>{const tabs=[...document.querySelectorAll('button')].filter(b=>['Начисления','К выплате','Сводка','История','Расходы'].includes(b.textContent.trim()));const vw=document.documentElement.clientWidth;return tabs.map(t=>{const r=t.getBoundingClientRect();return t.textContent.trim()+':'+(r.right<=vw?'vis':'CUT')}).join(',')})()`));
  await shot('mm-money');

  // services mobile
  await nav('/services/');
  p('mm:services-layout', await ev(`(()=>{const tree=document.querySelector('[class*=tree],[class*=list]');const panel=document.querySelector('[class*=panel],[class*=detail]');return JSON.stringify({treeFound:!!tree,panelFound:!!panel,treeH:tree?Math.round(tree.getBoundingClientRect().height):0,panelH:panel?Math.round(panel.getBoundingClientRect().height):0})})()`));
  await shot('mm-services');

  // reports mobile
  await nav('/reports/');
  p('mm:reports-content-len', await ev(`document.body.innerText.replace(/\\n+/g,' ').trim().length`));
  p('mm:reports-text', await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,150)`));
  await shot('mm-reports');

  // clients mobile modal
  await nav('/clients/');
  await ev(`(()=>{const b=document.getElementById('addClientBtn');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 2000));
  p('mm:client-modal', await ev(`(()=>{const m=document.getElementById('addClientModal');if(!m)return 'missing';const inner=m.querySelector('.modal');const r=(inner||m).getBoundingClientRect();return JSON.stringify({active:m.classList.contains('active'),w:Math.round(r.width),h:Math.round(r.height),fitsH:r.height<=844})})()`));
  await shot('mm-client-modal');

  // employees mobile modal
  await nav('/employees/');
  await ev(`(()=>{const b=document.getElementById('addEmployeeBtn');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 2000));
  p('mm:employee-modal', await ev(`(()=>{const m=document.getElementById('addEmployeeModal');if(!m)return 'missing';const inner=m.querySelector('.modal');const r=(inner||m).getBoundingClientRect();return JSON.stringify({active:m.classList.contains('active'),w:Math.round(r.width),h:Math.round(r.height),fitsH:r.height<=844})})()`));
  await shot('mm-employee-modal');

  // touch targets audit across pages
  for (const [path, name] of [['/schedule/', 'schedule'], ['/clients/', 'clients'], ['/employees/', 'employees'], ['/money/', 'money'], ['/profile/', 'profile']]) {
    await nav(path);
    p('mm:touch-' + name, await ev(`(()=>{const els=[...document.querySelectorAll('button,a,input,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});const small=els.filter(e=>{const r=e.getBoundingClientRect();return r.height<32||r.width<32});return JSON.stringify({total:els.length,tooSmall:small.length,samples:small.slice(0,4).map(e=>((e.textContent||e.id||e.tagName).trim().slice(0,18))+':'+Math.round(e.getBoundingClientRect().height))})})()`));
  }

  say('=== MOBILE FEAT DONE ===');
  ws.close(); process.exit(0);
})().catch(e => { say('FATAL: ' + e.message); process.exit(1); });
