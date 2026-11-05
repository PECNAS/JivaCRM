const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];

function httpGet(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: 9222, path: p }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(d));
    }).on('error', rej);
  });
}

(async () => {
  const tabs = JSON.parse(await httpGet('/json'));
  const tab = tabs.find(t => t.url.includes('127.0.0.1:8000'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const logs = [];
  const netFail = [];

  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.consoleAPICalled') {
      const t = m.params.type;
      if (t === 'error' || t === 'warning') {
        logs.push(t + ': ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 300));
      }
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION: ' + ((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).slice(0, 300));
    }
    if (m.method === 'Log.entryAdded') {
      const en = m.params.entry;
      if (en.level === 'error') {
        logs.push('NETERR: ' + en.text.slice(0, 200) + ' ' + (en.url || '').slice(0, 150));
      }
    }
    if (m.method === 'Network.responseReceived') {
      const r = m.params.response;
      if (r.status >= 400) netFail.push(r.status + ' ' + r.url.replace('http://127.0.0.1:8000', ''));
    }
    if (m.method === 'Network.loadingFailed') {
      if (!m.params.canceled) netFail.push('FAILED ' + (m.params.errorText || ''));
    }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  const send = (m, p = {}) => {
    const i = ++id;
    return new Promise(r => { pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');

  const shots = OUT + '\\screenshots\\';
  async function shot(name) {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(shots + name + '.png', Buffer.from(s.result.data, 'base64'));
  }
  async function ev(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) return 'EXC: ' + r.result.exceptionDetails.text;
    return r.result.result ? r.result.result.value : null;
  }
  async function nav(u, wait = 3200) {
    logs.length = 0; netFail.length = 0;
    await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u });
    await new Promise(r => setTimeout(r, wait));
  }
  const R = [];
  function p(section, k, v) {
    R.push({ section, k, v });
    console.log(`[${section}] ${k}: ${JSON.stringify(v)}`);
  }
  async function pageCheck(section, path, name, extraExpr) {
    await nav(path);
    const url = await ev('location.pathname + location.search');
    const title = await ev('document.title');
    const info = await ev(`JSON.stringify({h1:(document.querySelector('h1,h2,.page-title,.dashboard-title')||{}).textContent||'', rows:document.querySelectorAll('tr,tbody tr,.order-row,.client-row,.employee-row').length, btns:document.querySelectorAll('button').length, overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, scrollH: document.documentElement.scrollHeight})`);
    p(section, name + '-url', url);
    p(section, name + '-title', title);
    p(section, name + '-dom', info);
    if (extraExpr) p(section, name + '-extra', await ev(extraExpr));
    p(section, name + '-console', logs.slice());
    p(section, name + '-netfail', [...new Set(netFail)].slice(0, 12));
    await shot(name);
  }

  // login
  await nav('/login/', 1500);
  const logged = await ev(`(function(){const u=document.querySelector('input[name=username]'),p=document.querySelector('input[name=password]');if(u&&p){u.value='DHS';p.value='admin';document.querySelector('form').submit();return 'ok'}return 'already'})()`);
  await new Promise(r => setTimeout(r, 3000));
  p('AUTH', 'login-result', logged);
  p('AUTH', 'after-login-url', await ev('location.pathname'));

  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

  // ============ ORDERS ============
  await pageCheck('ORDERS', '/orders/', 'orders-list');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Создать заказ/.test(x.textContent));if(b){b.click();return 'clicked'}return 'nf'})()`);
  await new Promise(r => setTimeout(r, 2500));
  p('ORDERS', 'create-modal-open', await ev(`!!document.querySelector('.modal-overlay.active,.modal.active,[class*=modal][style*="flex"]')`));
  p('ORDERS', 'create-modal-title', await ev(`(document.querySelector('.modal.active .modal__title,.modal-overlay.active h2')||{}).textContent||''`));
  p('ORDERS', 'create-modal-fields', await ev(`[...document.querySelectorAll('.modal.active input,.modal.active select,.modal-overlay.active input,.modal-overlay.active select')].map(x=>x.name||x.id||x.type).join('|')`));
  await shot('orders-create-modal');
  p('ORDERS', 'create-modal-console', logs.slice());
  await ev(`(()=>{const b=document.querySelector('.modal.active .modal__close,.modal-overlay.active .modal__close');if(b){b.click();return 'closed'}return 'nf'})()`);
  await new Promise(r => setTimeout(r, 600));

  // search
  await nav('/orders/');
  await ev(`(()=>{const i=document.querySelector('input[placeholder*="Поиск"]');if(!i)return 'nf';i.value='Тест';i.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()`);
  await new Promise(r => setTimeout(r, 1500));
  p('ORDERS', 'search-rows', await ev(`document.querySelectorAll('tbody tr,[class*=order-row]').length`));
  p('ORDERS', 'search-console', logs.slice());
  await shot('orders-search');
  // status filter
  await nav('/orders/');
  await ev(`(()=>{const s=document.querySelector('select');if(!s)return 'nf';s.value='request';s.dispatchEvent(new Event('change',{bubbles:true}));return 'ok'})()`);
  await new Promise(r => setTimeout(r, 1500));
  p('ORDERS', 'status-request-rows', await ev(`document.querySelectorAll('tbody tr,[class*=order-row]').length`));
  await shot('orders-status-filter');
  // open order
  const orow = await ev(`(()=>{const a=document.querySelector('a[href*="/orders/"][href*="open_order"], a[href="/orders/108/"], button[class*=open]');if(a){a.click();return 'clicked'}const link=[...document.querySelectorAll('a,button')].find(x=>/Открыть/.test(x.textContent));if(link){link.click();return 'opened'};return 'nf'})()`);
  await new Promise(r => setTimeout(r, 3000));
  p('ORDERS', 'open-order-click', orow);
  p('ORDERS', 'open-order-url', await ev('location.pathname + location.search'));
  p('ORDERS', 'open-order-console', logs.slice());
  await shot('orders-open');

  // ============ CLIENTS ============
  await pageCheck('CLIENTS', '/clients/', 'clients-list');
  await nav('/clients/');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Добавить клиента/.test(x.textContent));if(b){b.click();return 'clicked'}return 'nf'})()`);
  await new Promise(r => setTimeout(r, 2500));
  p('CLIENTS', 'add-modal-open', await ev(`!!document.querySelector('.modal-overlay.active,.modal.active')`));
  p('CLIENTS', 'add-modal-fields', await ev(`[...document.querySelectorAll('.modal-overlay.active input,.modal-overlay.active select,.modal-overlay.active textarea')].map(x=>x.name||x.id).join('|')`));
  await shot('clients-add-modal');
  p('CLIENTS', 'add-modal-console', logs.slice());
  // phone mask test
  const phoneTest = await ev(`(()=>{const i=[...document.querySelectorAll('.modal-overlay.active input')].find(x=>/тел|phone/i.test(x.name||x.id||x.placeholder||''));if(!i)return 'nophone';i.value='79171234567';i.dispatchEvent(new Event('input',{bubbles:true}));return i.value})()`);
  p('CLIENTS', 'phone-mask-applied', phoneTest);
  await shot('clients-phone-mask');
  await ev(`(()=>{const b=document.querySelector('.modal-overlay.active .modal__close');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 600));
  // open client detail
  await nav('/clients/');
  const crow = await ev(`(()=>{const a=[...document.querySelectorAll('a,button')].find(x=>/Подробнее/.test(x.textContent));if(a){a.click();return 'clicked'}return 'nf'})()`);
  await new Promise(r => setTimeout(r, 3000));
  p('CLIENTS', 'detail-open', crow);
  p('CLIENTS', 'detail-url', await ev('location.pathname + location.search'));
  p('CLIENTS', 'detail-console', logs.slice());
  await shot('clients-detail');

  // ============ EMPLOYEES ============
  await pageCheck('EMPLOYEES', '/employees/', 'employees-list');
  await nav('/employees/');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Добавить сотрудника/.test(x.textContent));if(b){b.click();return 'clicked'}return 'nf'})()`);
  await new Promise(r => setTimeout(r, 2500));
  p('EMPLOYEES', 'add-modal-open', await ev(`!!document.querySelector('.modal-overlay.active,.modal.active')`));
  p('EMPLOYEES', 'add-modal-fields', await ev(`[...document.querySelectorAll('.modal-overlay.active input,.modal-overlay.active select')].map(x=>x.name||x.id).join('|')`));
  await shot('employees-add-modal');
  p('EMPLOYEES', 'add-modal-console', logs.slice());
  await ev(`(()=>{const b=document.querySelector('.modal-overlay.active .modal__close');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 600));
  await nav('/employees/');
  const erow = await ev(`(()=>{const a=[...document.querySelectorAll('a,button')].find(x=>/Подробнее/.test(x.textContent));if(a){a.click();return 'clicked'}return 'nf'})()`);
  await new Promise(r => setTimeout(r, 3000));
  p('EMPLOYEES', 'detail-open', erow);
  p('EMPLOYEES', 'detail-url', await ev('location.pathname + location.search'));
  p('EMPLOYEES', 'detail-console', logs.slice());
  await shot('employees-detail');

  // ============ SERVICES ============
  await pageCheck('SERVICES', '/services/', 'services');
  await nav('/services/');
  const treeRow = await ev(`(()=>{const rows=[...document.querySelectorAll('[data-id],[data-node],[data-service-id]')];if(rows.length){rows[0].click();return 'clicked-'+rows.length}const it=[...document.querySelectorAll('li,button,div')].find(x=>/ВЕЛКОМ/.test(x.textContent)&&x.children.length<4);if(it){it.click();return 'clicked-text'}return 'nf'})()`);
  await new Promise(r => setTimeout(r, 2500));
  p('SERVICES', 'tree-click', treeRow);
  p('SERVICES', 'tree-panel-content', await ev(`document.body.innerText.slice(0,400).replace(/\\n+/g,' | ')`));
  p('SERVICES', 'tree-console', logs.slice());
  await shot('services-tree-open');
  await nav('/services/');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Добавить каталог/.test(x.textContent));if(b){b.click();return 'clicked'}return 'nf'})()`);
  await new Promise(r => setTimeout(r, 2000));
  p('SERVICES', 'add-catalog-modal', await ev(`!!document.querySelector('.modal-overlay.active,.modal.active')`));
  await shot('services-add-catalog');
  p('SERVICES', 'add-catalog-console', logs.slice());

  // ============ MONEY ============
  await pageCheck('MONEY', '/money/', 'money');
  for (const tabName of ['К выплате', 'Сводка', 'История', 'Расходы']) {
    await nav('/money/');
    await ev(`(()=>{const t=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()===${JSON.stringify(tabName)});if(t){t.click();return 'ok'}return 'nf'})()`);
    await new Promise(r => setTimeout(r, 2000));
    p('MONEY', 'tab-' + tabName, await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,150)`));
    p('MONEY', 'tab-' + tabName + '-console', logs.slice());
    await shot('money-tab-' + tabName.replace(/\s/g, '-'));
  }
  await nav('/money/');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Добавить|Создать/.test(x.textContent));if(b){b.click();return b.textContent.trim()}return 'nf'})()`);
  await new Promise(r => setTimeout(r, 2000));
  p('MONEY', 'add-modal', await ev(`!!document.querySelector('.modal-overlay.active,.modal.active')`));
  await shot('money-add');

  // ============ REPORTS ============
  await pageCheck('REPORTS', '/reports/', 'reports');
  await nav('/reports/');
  await ev(`(()=>{const d=[...document.querySelectorAll('input[type=date]')];if(d.length){d[0].value='2026-01-01';d[0].dispatchEvent(new Event('change',{bubbles:true}));return 'changed'}return 'nodate'})()`);
  await new Promise(r => setTimeout(r, 2500));
  p('REPORTS', 'date-change-result', await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,200)`));
  p('REPORTS', 'date-change-console', logs.slice());
  await shot('reports-date-changed');

  // ============ PROFILE ============
  await pageCheck('PROFILE', '/profile/', 'profile');
  for (const tabName of ['Деньги', 'Доступность', 'Билеты']) {
    await nav('/profile/');
    await ev(`(()=>{const t=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()===${JSON.stringify(tabName)});if(t){t.click();return 'ok'}return 'nf'})()`);
    await new Promise(r => setTimeout(r, 2500));
    p('PROFILE', 'tab-' + tabName, await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,200)`));
    p('PROFILE', 'tab-' + tabName + '-console', logs.slice());
    await shot('profile-tab-' + tabName.replace(/\s/g, '-'));
  }

  // ============ FILL DATA ============
  await pageCheck('FILLDATA', '/fill-data/', 'fill-data');

  fs.writeFileSync(OUT + '\\results-desktop.json', JSON.stringify(R, null, 2));
  ws.close();
})().catch(e => { console.error('ERR', e.message, e.stack); process.exit(1); });
