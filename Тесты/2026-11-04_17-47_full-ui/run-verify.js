const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOGFILE = OUT + '\\run-verify.log';
fs.writeFileSync(LOGFILE, '');
function say(s) { fs.appendFileSync(LOGFILE, s + '\n'); try { console.log(s); } catch (e) {} }
function httpGet(p) {
  return new Promise((res, rej) => {
    const req = http.get({ host: '127.0.0.1', port: 9222, path: p, timeout: 5000 }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', rej);
  });
}
async function connect() {
  const tabs = JSON.parse(await httpGet('/json'));
  const tab = tabs.find(t => t.url.includes('127.0.0.1:8000'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const logs = [];
  ws.addEventListener('message', e => {
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ': ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 200));
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + ((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).slice(0, 200));
    if (m.id && pending.has(m.id)) { const cb = pending.get(m.id); pending.delete(m.id); cb(m); }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); setTimeout(() => rej(new Error('ws')), 8000); });
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
  const shots = OUT + '\\screenshots\\';
  async function shot(n) { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s.result && s.result.data) fs.writeFileSync(shots + n + '.png', Buffer.from(s.result.data, 'base64')); }
  async function ev(x) { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.__timeout) return '__TIMEOUT__'; if (r.result && r.result.exceptionDetails) return 'EXC'; return r.result && r.result.result ? r.result.result.value : null; }
  async function nav(u, w = 3200) { logs.length = 0; await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u }); await new Promise(r => setTimeout(r, w)); }
  const R = []; function p(k, v) { R.push({ k, v }); say(k + ': ' + JSON.stringify(v)); fs.writeFileSync(OUT + '\\results-verify.json', JSON.stringify(R, null, 2)); }

  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await nav('/login/', 1500);
  await ev(`(function(){const u=document.querySelector('input[name=username]'),pw=document.querySelector('input[name=password]');if(u&&pw){u.value='DHS';pw.value='admin';document.querySelector('form').submit();}})()`);
  await new Promise(r => setTimeout(r, 3000));

  // 1. Orders page loaded correctly?
  await nav('/orders/');
  p('orders-final-url', await ev('location.pathname + location.search'));
  p('orders-title', await ev('document.title'));
  p('orders-table-rows', await ev(`document.querySelectorAll('tbody tr, .order-row').length`));
  p('orders-open-links', await ev(`[...document.querySelectorAll('a')].filter(a=>/Открыть/.test(a.textContent)).map(a=>a.getAttribute('href')).join(',')`));

  // 2. Money tabs real content check
  for (const t of ['Начисления', 'К выплате', 'Сводка', 'История', 'Расходы']) {
    await nav('/money/');
    await ev(`(()=>{const el=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()===${JSON.stringify(t)});if(el)el.click()})()`);
    await new Promise(r => setTimeout(r, 2200));
    const tabs = await ev(`[...document.querySelectorAll('button,a')].filter(x=>['Начисления','К выплате','Сводка','История','Расходы'].includes(x.textContent.trim())).map(x=>x.textContent.trim()+(x.classList.contains('active')||x.getAttribute('aria-selected')==='true'?'*':'')).join(',')`);
    const content = await ev(`(()=>{const p=[...document.querySelectorAll('.money-section,.tab-panel,[data-tab-panel],[class*=panel]')].filter(x=>getComputedStyle(x).display!=='none');return p.map(x=>x.className.split(' ')[0]+'='+x.innerText.replace(/\\n+/g,' ').slice(0,80)).join(' || ')})()`);
    p('money-tab-' + t, { tabs, content: (content || '').slice(0, 400) });
    await shot('verify-money-' + t.replace(/\s/g, '-'));
  }

  // 3. Services catalog expand
  await nav('/services/');
  const sc = await ev(`(()=>{const nodes=[...document.querySelectorAll('[data-id],[data-node-id],[data-service-id],[role=treeitem]')];if(!nodes.length)return 'nonodes';nodes[0].click();return 'clicked:'+nodes.length})()`);
  await new Promise(r => setTimeout(r, 2000));
  p('services-click', sc);
  p('services-after-click', await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,500)`));
  p('services-add-catalog-btn-exists', await ev(`!!([...document.querySelectorAll('button')].find(x=>/Добавить каталог/.test(x.textContent)))`));
  p('services-add-catalog-click', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Добавить каталог/.test(x.textContent));if(!b)return 'nobtn';b.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 2000));
  p('services-modal-or-dialog', await ev(`(()=>{const m=document.querySelector('.modal-overlay.active,.modal.active,[role=dialog]');if(m)return 'modal:'+m.innerText.replace(/\\n+/g,' ').slice(0,100);const i=document.querySelector('input:focus');if(i)return 'inline-input:'+i.placeholder;return 'nothing'})()`));
  p('services-console', logs.slice(0, 5));
  await shot('verify-services');

  // 4. Reports inputs
  await nav('/reports/');
  p('reports-inputs', await ev(`[...document.querySelectorAll('input,select,button')].map(x=>x.tagName+':'+(x.type||x.id||x.className.split(' ')[0])).join(',')`));
  p('reports-text', await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,300)`));
  await shot('verify-reports');

  // 5. Clients search live behavior
  await nav('/clients/');
  const before = await ev(`document.querySelectorAll('tbody tr').length`);
  await ev(`(()=>{const i=document.querySelector('input[placeholder*="Поиск"]');i.value='Айгуль';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await new Promise(r => setTimeout(r, 1800));
  const after = await ev(`document.querySelectorAll('tbody tr').length`);
  p('clients-search', { before, after });

  // 6. Employees search
  await nav('/employees/');
  const eb = await ev(`document.querySelectorAll('tbody tr').length`);
  await ev(`(()=>{const i=document.querySelector('input[placeholder*="Поиск"]');i.value='Влад';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await new Promise(r => setTimeout(r, 1800));
  p('employees-search', { before: eb, after: await ev(`document.querySelectorAll('tbody tr').length`) });

  // 7. Check profile edit actually opens
  await nav('/profile/');
  p('profile-edit-click', await ev(`(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>/Редактировать/.test(x.textContent));if(!b)return 'nobtn';b.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 2000));
  p('profile-after-edit', await ev(`(()=>{const m=document.querySelector('.modal-overlay.active,.modal.active');if(m)return 'modal:'+m.innerText.replace(/\\n+/g,' ').slice(0,80);const i=document.querySelectorAll('input:not([disabled])');return 'inputs:'+i.length})()`));
  p('profile-edit-console', logs.slice(0, 5));
  await shot('verify-profile-edit');

  // 8. Global header nav works
  await nav('/orders/');
  const navLinks = await ev(`[...document.querySelectorAll('header a, .site-header a, nav a')].map(a=>a.textContent.trim()+'->'+a.getAttribute('href')).join(' | ')`);
  p('global-nav-links', navLinks);
  p('active-nav-item', await ev(`[...document.querySelectorAll('header a, .site-header a, nav a')].filter(a=>a.classList.contains('active')||a.getAttribute('aria-current')).map(a=>a.textContent.trim()).join(',')`));

  say('=== VERIFY DONE ===');
  ws.close(); process.exit(0);
})().catch(e => { say('FATAL: ' + e.message); process.exit(1); });
