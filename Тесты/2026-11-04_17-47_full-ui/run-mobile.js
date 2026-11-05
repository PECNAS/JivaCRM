const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOGFILE = OUT + '\\run-mobile.log';
fs.writeFileSync(LOGFILE, '');
function say(s) { fs.appendFileSync(LOGFILE, s + '\n'); try { console.log(s); } catch (e) {} }
function httpGet(p) {
  return new Promise((res, rej) => {
    const req = http.get({ host: '127.0.0.1', port: 9222, path: p, timeout: 5000 }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    });
    req.on('timeout', () => req.destroy(new Error('http timeout')));
    req.on('error', rej);
  });
}
async function connect() {
  const tabs = JSON.parse(await httpGet('/json'));
  const tab = tabs.find(t => t.url.includes('127.0.0.1:8000'));
  if (!tab) throw new Error('no tab');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const logs = [];
  ws.addEventListener('message', e => {
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ': ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 200));
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + ((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).slice(0, 200));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('NETERR: ' + m.params.entry.text.slice(0, 160));
    if (m.id && pending.has(m.id)) { const cb = pending.get(m.id); pending.delete(m.id); cb(m); }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); setTimeout(() => rej(new Error('ws timeout')), 8000); });
  const send = (method, params = {}) => {
    const i = ++id;
    return new Promise(res => {
      pending.set(i, res);
      try { ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { pending.delete(i); res({}); }
      setTimeout(() => { if (pending.has(i)) { pending.delete(i); res({ __timeout: true }); } }, 15000);
    });
  };
  return { ws, send, logs };
}
(async () => {
  const { ws, send, logs } = await connect();
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const shots = OUT + '\\screenshots\\';
  async function shot(name) { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s.result && s.result.data) fs.writeFileSync(shots + name + '.png', Buffer.from(s.result.data, 'base64')); }
  async function ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.__timeout) return '__TIMEOUT__'; if (r.result && r.result.exceptionDetails) return 'EXC'; return r.result && r.result.result ? r.result.result.value : null; }
  async function nav(u, wait = 3000) { logs.length = 0; await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u }); await new Promise(r => setTimeout(r, wait)); }
  const R = [];
  function p(k, v) { R.push({ k, v }); say(k + ': ' + JSON.stringify(v)); fs.writeFileSync(OUT + '\\results-mobile.json', JSON.stringify(R, null, 2)); }

  say('=== MOBILE START ===');
  await nav('/login/', 1500);
  await ev(`(function(){const u=document.querySelector('input[name=username]'),pw=document.querySelector('input[name=password]');if(u&&pw){u.value='DHS';pw.value='admin';document.querySelector('form').submit();return 'ok'}return 'already'})()`);
  await new Promise(r => setTimeout(r, 3000));

  const pages = [
    ['/', 'm-schedule'],
    ['/orders/', 'm-orders'],
    ['/clients/', 'm-clients'],
    ['/employees/', 'm-employees'],
    ['/services/', 'm-services'],
    ['/money/', 'm-money'],
    ['/reports/', 'm-reports'],
    ['/profile/', 'm-profile'],
    ['/fill-data/', 'm-fill-data'],
  ];
  for (const [path, name] of pages) {
    await nav(path);
    p(name + '-url', await ev('location.pathname'));
    p(name + '-metrics', await ev(`JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,burger:!!document.querySelector('[class*=burger],[class*=menu-toggle],[class*=nav-toggle]'),scrollH:document.documentElement.scrollHeight})`));
    p(name + '-console', logs.slice(0, 4));
    await shot(name);
  }

  // mobile burger menu
  await nav('/');
  p('m-burger-click', await ev(`(()=>{const b=document.querySelector('[class*=burger],[class*=menu-toggle],[class*=nav-toggle]');if(b){b.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 900));
  p('m-menu-open', await ev(`(()=>{const n=[...document.querySelectorAll('nav,.mobile-nav,[class*=menu]')].find(x=>getComputedStyle(x).display!=='none'&&/Расписание/.test(x.textContent));return n?'visible':'notfound'})()`));
  p('m-menu-links', await ev(`[...document.querySelectorAll('a')].filter(a=>/Расписание|Заказы|Клиенты|Сотрудники|Услуги|Деньги|Отчёты/.test(a.textContent)).map(a=>a.textContent.trim()+':'+(getComputedStyle(a).display!=='none'?'visible':'hidden')).join(',')`));
  await shot('m-menu-open');

  // mobile modals
  await nav('/orders/');
  p('m-create-order-click', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Создать заказ/.test(x.textContent));if(b){b.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 2200));
  p('m-create-modal-open', await ev(`!!document.querySelector('.modal-overlay.active,.modal.active')`));
  p('m-create-modal-fit', await ev(`(()=>{const m=document.querySelector('.modal-overlay.active > *, .modal.active');if(!m)return 'nomodal';const r=m.getBoundingClientRect();return JSON.stringify({w:Math.round(r.width),h:Math.round(r.height),fitsW:r.width<=390,fitsH:r.height<=844})})()`));
  await shot('m-orders-create-modal');

  // mobile clients modal
  await nav('/clients/');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Добавить клиента/.test(x.textContent));if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 2200));
  p('m-client-modal-fit', await ev(`(()=>{const m=document.querySelector('.modal-overlay.active > *, .modal.active');if(!m)return 'nomodal';const r=m.getBoundingClientRect();return JSON.stringify({w:Math.round(r.width),h:Math.round(r.height),fitsW:r.width<=390})})()`));
  await shot('m-clients-add-modal');

  // mobile employees modal
  await nav('/employees/');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Добавить сотрудника/.test(x.textContent));if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 2200));
  p('m-employee-modal-fit', await ev(`(()=>{const m=document.querySelector('.modal-overlay.active > *, .modal.active');if(!m)return 'nomodal';const r=m.getBoundingClientRect();return JSON.stringify({w:Math.round(r.width),h:Math.round(r.height),fitsW:r.width<=390})})()`));
  await shot('m-employees-add-modal');

  // mobile touch target audit on key pages
  for (const [path, name] of [['/orders/', 'orders'], ['/schedule/', 'schedule'], ['/money/', 'money']]) {
    await nav(path);
    p('m-touch-' + name, await ev(`(()=>{const els=[...document.querySelectorAll('button,a,input,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});const small=els.filter(e=>{const r=e.getBoundingClientRect();return r.height<32||r.width<32});return JSON.stringify({total:els.length,tooSmall:small.length,samples:small.slice(0,5).map(e=>(e.textContent||e.placeholder||e.tagName).trim().slice(0,20)+':'+Math.round(e.getBoundingClientRect().height))})})()`));
  }

  say('=== MOBILE DONE ===');
  ws.close();
  process.exit(0);
})().catch(e => { say('FATAL: ' + e.message); process.exit(1); });
