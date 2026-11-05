const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOGFILE = OUT + '\\run.log';
fs.writeFileSync(LOGFILE, '');

function say(s) {
  fs.appendFileSync(LOGFILE, s + '\n');
  try { console.log(s); } catch (e) {}
}

function httpGet(p) {
  return new Promise((res, rej) => {
    const req = http.get({ host: '127.0.0.1', port: 9222, path: p, timeout: 5000 }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(d));
    });
    req.on('timeout', () => { req.destroy(new Error('http timeout')); });
    req.on('error', rej);
  });
}

async function connect() {
  const tabs = JSON.parse(await httpGet('/json'));
  const tab = tabs.find(t => t.url.includes('127.0.0.1:8000'));
  if (!tab) throw new Error('no tab');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const logs = [];
  const netFail = [];
  ws.addEventListener('message', e => {
    let m;
    try { m = JSON.parse(e.data); } catch (err) { return; }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      logs.push(m.params.type + ': ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 200));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION: ' + ((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).slice(0, 200));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      logs.push('NETERR: ' + m.params.entry.text.slice(0, 160));
    }
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) {
      netFail.push(m.params.response.status + ' ' + m.params.response.url.replace('http://127.0.0.1:8000', ''));
    }
    if (m.id && pending.has(m.id)) { const cb = pending.get(m.id); pending.delete(m.id); cb(m); }
  });
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
    setTimeout(() => rej(new Error('ws open timeout')), 8000);
  });
  const send = (method, params = {}) => {
    const i = ++id;
    return new Promise(res => {
      pending.set(i, res);
      try { ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { pending.delete(i); res({}); }
      setTimeout(() => { if (pending.has(i)) { pending.delete(i); res({ __timeout: true }); } }, 15000);
    });
  };
  return { ws, send, logs, netFail };
}

(async () => {
  const { ws, send, logs, netFail } = await connect();
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  const shots = OUT + '\\screenshots\\';
  async function shot(name) {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    if (s.result && s.result.data) fs.writeFileSync(shots + name + '.png', Buffer.from(s.result.data, 'base64'));
  }
  async function ev(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false });
    if (r.__timeout) return '__TIMEOUT__';
    if (r.result && r.result.exceptionDetails) return 'EXC: ' + (r.result.exceptionDetails.text || '').slice(0, 120);
    return r.result && r.result.result ? r.result.result.value : null;
  }
  async function nav(u, wait = 3000) {
    logs.length = 0; netFail.length = 0;
    await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u });
    await new Promise(r => setTimeout(r, wait));
  }
  const R = [];
  function p(section, k, v) {
    R.push({ section, k, v });
    say(`[${section}] ${k}: ${JSON.stringify(v)}`);
    fs.writeFileSync(OUT + '\\results-desktop.json', JSON.stringify(R, null, 2));
  }
  async function pageCheck(section, path, name) {
    await nav(path);
    p(section, name + '-url', await ev('location.pathname + location.search'));
    p(section, name + '-title', await ev('document.title'));
    p(section, name + '-dom', await ev(`JSON.stringify({rows:document.querySelectorAll('tbody tr,.order-row,.client-row,.employee-row').length,btns:document.querySelectorAll('button').length,inputs:document.querySelectorAll('input,select,textarea').length,overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,scrollH:document.documentElement.scrollHeight})`));
    p(section, name + '-console', logs.slice(0, 5));
    p(section, name + '-netfail', [...new Set(netFail)].slice(0, 8));
    await shot(name);
  }
  say('=== START ===');
  await nav('/login/', 1500);
  await ev(`(function(){const u=document.querySelector('input[name=username]'),pw=document.querySelector('input[name=password]');if(u&&pw){u.value='DHS';pw.value='admin';document.querySelector('form').submit();return 'submitted'}return 'already'})()`);
  await new Promise(r => setTimeout(r, 3000));
  p('AUTH', 'after-login', await ev('location.pathname'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

  await pageCheck('ORDERS', '/orders/', 'orders-list');
  p('ORDERS', 'create-btn-click', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Создать заказ/.test(x.textContent));if(b){b.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 2200));
  p('ORDERS', 'create-modal-open', await ev(`!!document.querySelector('.modal-overlay.active,.modal.active')`));
  p('ORDERS', 'create-modal-title', await ev(`(document.querySelector('.modal-overlay.active h2,.modal.active h2')||{}).textContent||''`));
  p('ORDERS', 'create-modal-fields', await ev(`[...document.querySelectorAll('.modal-overlay.active input,.modal-overlay.active select,.modal-overlay.active textarea')].map(x=>x.name||x.id||x.type).join('|')`));
  await shot('orders-create-modal');
  p('ORDERS', 'create-modal-console', logs.slice(0, 5));

  await nav('/orders/');
  await ev(`(()=>{const i=document.querySelector('input[placeholder*="Поиск"],input[placeholder*="поиск"]');if(!i)return 'nf';i.value='Тест';i.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()`);
  await new Promise(r => setTimeout(r, 1600));
  p('ORDERS', 'search-rows', await ev(`document.querySelectorAll('tbody tr,.order-row').length`));
  p('ORDERS', 'search-console', logs.slice(0, 5));
  await shot('orders-search');

  await nav('/orders/');
  const olink = await ev(`(()=>{const a=[...document.querySelectorAll('a,button')].find(x=>/Открыть/.test(x.textContent));if(a){a.click();return 'clicked'}return 'nf'})()`);
  await new Promise(r => setTimeout(r, 3000));
  p('ORDERS', 'open-click', olink);
  p('ORDERS', 'open-url', await ev('location.pathname + location.search'));
  p('ORDERS', 'open-console', logs.slice(0, 5));
  await shot('orders-open');

  await pageCheck('CLIENTS', '/clients/', 'clients-list');
  p('CLIENTS', 'add-btn', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Добавить клиента/.test(x.textContent));if(b){b.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 2200));
  p('CLIENTS', 'add-modal-open', await ev(`!!document.querySelector('.modal-overlay.active,.modal.active')`));
  p('CLIENTS', 'add-modal-fields', await ev(`[...document.querySelectorAll('.modal-overlay.active input,.modal-overlay.active select,.modal-overlay.active textarea')].map(x=>x.name||x.id).join('|')`));
  p('CLIENTS', 'phone-input-found', await ev(`[...document.querySelectorAll('.modal-overlay.active input')].map(x=>x.name||x.id||x.placeholder).join('|')`));
  p('CLIENTS', 'phone-mask', await ev(`(()=>{const i=[...document.querySelectorAll('.modal-overlay.active input')].find(x=>/тел|phone/i.test(x.name||x.id||x.placeholder||''));if(!i)return 'nophone';i.value='79171234567';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('blur',{bubbles:true}));return i.value})()`));
  await shot('clients-add-modal');
  p('CLIENTS', 'add-modal-console', logs.slice(0, 5));

  await nav('/clients/');
  p('CLIENTS', 'detail-click', await ev(`(()=>{const a=[...document.querySelectorAll('a,button')].find(x=>/Подробнее/.test(x.textContent));if(a){a.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 3000));
  p('CLIENTS', 'detail-url', await ev('location.pathname + location.search'));
  p('CLIENTS', 'detail-console', logs.slice(0, 5));
  await shot('clients-detail');

  await pageCheck('EMPLOYEES', '/employees/', 'employees-list');
  p('EMPLOYEES', 'add-btn', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Добавить сотрудника/.test(x.textContent));if(b){b.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 2200));
  p('EMPLOYEES', 'add-modal-open', await ev(`!!document.querySelector('.modal-overlay.active,.modal.active')`));
  p('EMPLOYEES', 'add-modal-fields', await ev(`[...document.querySelectorAll('.modal-overlay.active input,.modal-overlay.active select')].map(x=>x.name||x.id).join('|')`));
  await shot('employees-add-modal');
  p('EMPLOYEES', 'add-modal-console', logs.slice(0, 5));

  await nav('/employees/');
  p('EMPLOYEES', 'detail-click', await ev(`(()=>{const a=[...document.querySelectorAll('a,button')].find(x=>/Подробнее/.test(x.textContent));if(a){a.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 3000));
  p('EMPLOYEES', 'detail-url', await ev('location.pathname + location.search'));
  p('EMPLOYEES', 'detail-console', logs.slice(0, 5));
  await shot('employees-detail');

  await pageCheck('SERVICES', '/services/', 'services');
  p('SERVICES', 'catalog-click', await ev(`(()=>{const it=[...document.querySelectorAll('li,button,span,div')].find(x=>x.textContent.trim().indexOf('ВЕЛКОМ')===0&&x.children.length<4);if(it){it.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 2200));
  p('SERVICES', 'panel-text', await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,350)`));
  p('SERVICES', 'panel-console', logs.slice(0, 5));
  await shot('services-tree-open');
  p('SERVICES', 'add-catalog-btn', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Добавить каталог/.test(x.textContent));if(b){b.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 2000));
  p('SERVICES', 'add-catalog-modal', await ev(`!!document.querySelector('.modal-overlay.active,.modal.active')`));
  await shot('services-add-catalog');

  await pageCheck('MONEY', '/money/', 'money');
  for (const t of ['К выплате', 'Сводка', 'История', 'Расходы']) {
    await nav('/money/');
    p('MONEY', 'tab-click-' + t, await ev(`(()=>{const el=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()===${JSON.stringify(t)});if(el){el.click();return 'ok'}return 'nf'})()`));
    await new Promise(r => setTimeout(r, 2000));
    p('MONEY', 'tab-' + t + '-text', await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,140)`));
    p('MONEY', 'tab-' + t + '-console', logs.slice(0, 5));
    await shot('money-' + t.replace(/\s/g, '-'));
  }

  await pageCheck('REPORTS', '/reports/', 'reports');
  p('REPORTS', 'change-date', await ev(`(()=>{const d=[...document.querySelectorAll('input[type=date]')];if(!d.length)return 'nodate';d[0].value='2026-01-01';d[0].dispatchEvent(new Event('change',{bubbles:true}));return 'ok'})()`));
  await new Promise(r => setTimeout(r, 2500));
  p('REPORTS', 'after-change-text', await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,180)`));
  p('REPORTS', 'after-change-console', logs.slice(0, 5));
  await shot('reports-date-changed');

  await pageCheck('PROFILE', '/profile/', 'profile');
  for (const t of ['Деньги', 'Доступность', 'Билеты']) {
    await nav('/profile/');
    p('PROFILE', 'tab-click-' + t, await ev(`(()=>{const el=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()===${JSON.stringify(t)});if(el){el.click();return 'ok'}return 'nf'})()`));
    await new Promise(r => setTimeout(r, 2500));
    p('PROFILE', 'tab-' + t + '-text', await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,200)`));
    p('PROFILE', 'tab-' + t + '-console', logs.slice(0, 5));
    await shot('profile-' + t.replace(/\s/g, '-'));
  }

  await pageCheck('FILLDATA', '/fill-data/', 'fill-data');

  say('=== DONE ===');
  ws.close();
  process.exit(0);
})().catch(e => {
  say('FATAL: ' + e.message + '\n' + (e.stack || ''));
  process.exit(1);
});
