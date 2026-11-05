const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOG = OUT + '\\run-features.log';
fs.writeFileSync(LOG, '');
function say(s) { fs.appendFileSync(LOG, s + '\n'); try { console.log(s); } catch (e) {} }
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
  if (!tab) throw new Error('no tab');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const logs = [];
  ws.addEventListener('message', e => {
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      logs.push(m.params.type + ': ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 250));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logs.push('EXCEPTION: ' + ((d.exception && d.exception.description) || d.text || '').slice(0, 250));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('NETERR: ' + m.params.entry.text.slice(0, 200));
    if (m.id && pending.has(m.id)) { const cb = pending.get(m.id); pending.delete(m.id); cb(m); }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); setTimeout(() => rej(new Error('ws timeout')), 8000); });
  const send = (method, params = {}) => {
    const i = ++id;
    return new Promise(res => {
      pending.set(i, res);
      try { ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { pending.delete(i); res({}); }
      setTimeout(() => { if (pending.has(i)) { pending.delete(i); res({ __timeout: true }); } }, 20000);
    });
  };
  return { ws, send, logs };
}

(async () => {
  const { ws, send, logs } = await connect();
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  const shots = OUT + '\\screenshots\\';
  async function shot(n) { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s.result && s.result.data) fs.writeFileSync(shots + n + '.png', Buffer.from(s.result.data, 'base64')); }
  async function ev(x) { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.__timeout) return '__TIMEOUT__'; if (r.result && r.result.exceptionDetails) return 'EXC: ' + (r.result.exceptionDetails.text || '').slice(0, 120); return r.result && r.result.result ? r.result.result.value : null; }
  async function nav(u, w = 3200) { logs.length = 0; await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u }); await new Promise(r => setTimeout(r, w)); }
  const R = [];
  function p(k, v) { R.push({ k, v }); say(k + ': ' + JSON.stringify(v)); fs.writeFileSync(OUT + '\\results-features.json', JSON.stringify(R, null, 2)); }

  await nav('/login/', 2000);
  await ev(`(function(){const u=document.querySelector('input[name=username]'),pw=document.querySelector('input[name=password]');u.value='DHS';pw.value='admin';document.querySelector('form').submit()})()`);
  await new Promise(r => setTimeout(r, 3500));
  p('login', await ev('location.pathname'));

  // ========== SCHEDULE ==========
  await nav('/schedule/');
  p('S:month-nav', await ev(`(()=>{const t0=document.getElementById('calendarTitle').textContent;document.getElementById('calendarNext').click();const t1=document.getElementById('calendarTitle').textContent;return t0+' -> '+t1})()`));
  await new Promise(r => setTimeout(r, 600));
  p('S:view-switch', await ev(`(()=>{const b=[...document.querySelectorAll('.view-switch__btn')].find(x=>x.dataset.view==='list');b.click();return document.querySelector('.view-switch__btn.active').dataset.view+'|list='+getComputedStyle(document.getElementById('dashboardList')).display})()`));
  await new Promise(r => setTimeout(r, 800));
  p('S:list-rows', await ev(`document.querySelectorAll('#dashboardList .order-row').length`));
  p('S:sort-change', await ev(`(()=>{const s=document.getElementById('dashboardSort');s.value='name_desc';s.dispatchEvent(new Event('change',{bubbles:true}));return 'ok'})()`));
  await new Promise(r => setTimeout(r, 600));
  p('S:status-filter', await ev(`(()=>{const s=document.getElementById('dashboardStatus');s.value='request';s.dispatchEvent(new Event('change',{bubbles:true}));return 'ok'})()`));
  await new Promise(r => setTimeout(r, 600));
  p('S:status-rows', await ev(`document.querySelectorAll('#dashboardList .order-row').length`));
  p('S:past-toggle', await ev(`(()=>{const c=document.getElementById('pastCompletedToggle');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));return 'ok'})()`));
  await new Promise(r => setTimeout(r, 600));
  p('S:past-note', await ev(`(document.querySelector('.order-list-note')||{}).textContent||'none'`));
  p('S:past-off', await ev(`(()=>{const c=document.getElementById('pastCompletedToggle');c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));return 'ok'})()`));
  await new Promise(r => setTimeout(r, 500));
  // addOrderBtn
  p('S:addOrderBtn-visible', await ev(`(()=>{const b=document.getElementById('addOrderBtn');if(!b)return 'missing';const r=b.getBoundingClientRect();return 'visible='+(r.width>0)+' text='+b.textContent.trim()})()`));
  await ev(`(()=>{const b=document.getElementById('addOrderBtn');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 2000));
  p('S:createOrderModal-open', await ev(`document.getElementById('createOrderModal').classList.contains('active')`));
  p('S:createOrderModal-fields', await ev(`[...document.querySelectorAll('#createOrderModal input,#createOrderModal select,#createOrderModal textarea')].map(x=>x.id||x.name).join('|')`));
  await shot('feat-create-order-modal');
  await ev(`(()=>{const b=document.getElementById('createModalCancelBtn');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 700));
  // order editor
  await nav('/schedule/');
  await ev(`(()=>{const b=[...document.querySelectorAll('.view-switch__btn')].find(x=>x.dataset.view==='list');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 800));
  p('S:row-click', await ev(`(()=>{const r=document.querySelector('#dashboardList .order-row');if(!r)return 'norow';r.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('S:eventModal-open', await ev(`document.getElementById('eventModal').classList.contains('active')`));
  p('S:eventModal-buttons', await ev(`['eventModalChecklistBtn','eventModalDetailsBtn'].map(id=>id+':'+(getComputedStyle(document.getElementById(id)).display!=='none')).join('|')`));
  await shot('feat-event-modal');
  // checklist from modal
  p('S:checklist-btn-visible', await ev(`getComputedStyle(document.getElementById('eventModalChecklistBtn')).display`));
  await ev(`(()=>{const b=document.getElementById('eventModalChecklistBtn');if(b&&getComputedStyle(b).display!=='none')b.click()})()`);
  await new Promise(r => setTimeout(r, 2000));
  p('S:eventChecklistModal-open', await ev(`document.getElementById('eventChecklistModal').classList.contains('active')`));
  await shot('feat-event-checklist');
  p('S:modal-console', logs.slice(0, 5));
  // order editor
  await nav('/schedule/');
  await ev(`(()=>{const b=[...document.querySelectorAll('.view-switch__btn')].find(x=>x.dataset.view==='list');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 800));
  await ev(`(()=>{const r=document.querySelector('#dashboardList .order-row');if(r)r.click()})()`);
  await new Promise(r => setTimeout(r, 1200));
  p('S:detailsBtn-visible', await ev(`getComputedStyle(document.getElementById('eventModalDetailsBtn')).display`));
  await ev(`(()=>{const b=document.getElementById('eventModalDetailsBtn');if(b&&getComputedStyle(b).display!=='none')b.click()})()`);
  await new Promise(r => setTimeout(r, 4000));
  p('S:editor-url', await ev('location.pathname + location.search'));
  p('S:editorModal-open', await ev(`(()=>{const m=document.getElementById('orderEditorModal');return m?m.classList.contains('active'):'noeditor'})()`));
  p('S:editor-tabs', await ev(`[...document.querySelectorAll('#orderEditorModal [class*=tab]')].map(t=>t.textContent.trim().slice(0,25)+(/active/.test(t.className)?'*':'')).filter(Boolean).join('|')`));
  await shot('feat-order-editor');

  // ========== CLIENTS ==========
  await nav('/clients/');
  p('C:search', await ev(`(()=>{const i=document.getElementById('searchInput');i.value='Айгуль';i.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('C:search-rows', await ev(`document.querySelectorAll('tbody tr').length`));
  p('C:loadmore-visible', await ev(`(()=>{const b=document.getElementById('clientsLoadMoreBtn');return b?(getComputedStyle(b).display!=='none')+'':'missing'})()`));
  await ev(`(()=>{const i=document.getElementById('searchInput');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await new Promise(r => setTimeout(r, 1200));
  // rating filter
  p('C:ratingFilter', await ev(`(()=>{const s=document.getElementById('ratingFilter');if(!s)return 'missing';s.value=s.options[1]?s.options[1].value:'';s.dispatchEvent(new Event('change',{bubbles:true}));return 'set:'+s.value})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('C:rating-rows', await ev(`document.querySelectorAll('tbody tr').length`));
  // view client
  await nav('/clients/');
  p('C:view-click', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Подробнее/.test(x.textContent));if(b){b.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 2000));
  p('C:clientModal-open', await ev(`document.getElementById('clientModal').classList.contains('active')`));
  p('C:clientModal-content', await ev(`(()=>{const m=document.getElementById('clientModal');return m?m.innerText.replace(/\\n+/g,' | ').slice(0,300):'none'})()`));
  await shot('feat-client-view');
  // edit client
  p('C:editBtn', await ev(`(()=>{const b=document.getElementById('editClientBtn');if(b&&getComputedStyle(b).display!=='none'){b.click();return 'clicked'}return 'hidden:'+getComputedStyle(b).display})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('C:edit-form-visible', await ev(`(()=>{const f=document.getElementById('editFullName');return f?(f.getBoundingClientRect().width>0)+'':'missing'})()`));
  // phone mask
  p('C:phone-mask', await ev(`(()=>{const i=document.getElementById('editPhone')||document.getElementById('addPhone');if(!i)return 'nophone';i.value='79171234567';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('blur',{bubbles:true}));return i.value})()`));
  await shot('feat-client-edit');
  p('C:console', logs.slice(0, 5));
  // add client
  await nav('/clients/');
  p('C:addBtn', await ev(`(()=>{const b=document.getElementById('addClientBtn');if(b){b.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 1800));
  p('C:addModal-open', await ev(`document.getElementById('addClientModal').classList.contains('active')`));
  p('C:addPhone-mask', await ev(`(()=>{const i=document.getElementById('addPhone');if(!i)return 'nophone';i.value='79171234567';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('blur',{bubbles:true}));return i.value})()`));
  await shot('feat-client-add');
  p('C:addConsole', logs.slice(0, 5));

  // ========== EMPLOYEES ==========
  await nav('/employees/');
  p('E:search', await ev(`(()=>{const i=document.getElementById('searchInput');i.value='Влад';i.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('E:search-rows', await ev(`document.querySelectorAll('tbody tr').length`));
  await nav('/employees/');
  p('E:roleFilter', await ev(`(()=>{const s=document.getElementById('roleFilter');if(!s)return 'missing';s.value=s.options[1].value;s.dispatchEvent(new Event('change',{bubbles:true}));return 'set:'+s.value})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('E:role-rows', await ev(`document.querySelectorAll('tbody tr').length`));
  p('E:loadmore', await ev(`(()=>{const b=document.getElementById('employeesLoadMoreBtn');return b?getComputedStyle(b).display:'missing'})()`));
  await nav('/employees/');
  p('E:view-click', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Подробнее/.test(x.textContent));if(b){b.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 2000));
  p('E:employeeModal-open', await ev(`document.getElementById('employeeModal').classList.contains('active')`));
  p('E:employeeModal-tabs', await ev(`['Основное','Паспортные данные','artistCardTab'].map(id=>{const b=document.getElementById(id);return b?id+':'+getComputedStyle(b).display:'missing'}).join('|')`));
  await shot('feat-employee-view');
  p('E:passport-tab', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Паспортные данные');if(!b||getComputedStyle(b).display==='none')return 'hidden';b.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1200));
  await shot('feat-employee-passport');
  p('E:phone-mask', await ev(`(()=>{const i=document.getElementById('editPhone');if(!i)return 'nophone-edit';return 'found'})()`));
  p('E:console', logs.slice(0, 6));

  // ========== MONEY ==========
  await nav('/money/');
  p('M:month-nav', await ev(`(()=>{const t0=document.getElementById('moneyDateFrom').value;document.getElementById('moneyPrevMonthBtn').click();return t0+' -> '+document.getElementById('moneyDateFrom').value})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('M:currentMonth', await ev(`(()=>{document.getElementById('moneyCurrentMonthBtn').click();return document.getElementById('moneyDateFrom').value})()`));
  await new Promise(r => setTimeout(r, 1500));
  for (const t of ['Начисления', 'К выплате', 'Сводка', 'История', 'Расходы']) {
    await ev(`(()=>{const el=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(t)});if(el)el.click()})()`);
    await new Promise(r => setTimeout(r, 1500));
    p('M:tab-' + t, await ev(`(()=>{const active=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(t)});const panels=[...document.querySelectorAll('[class*=money-panel]')].filter(x=>x.getBoundingClientRect().height>0);return 'active='+(active&&/active/.test(active.className))+' panels='+panels.length+' text='+(panels[0]?panels[0].innerText.replace(/\\n+/g,' ').slice(0,80):'none')})()`));
  }
  await shot('feat-money-tabs');
  // add accrual
  await nav('/money/');
  p('M:addClick', await ev(`(()=>{const b=document.getElementById('moneyAddManualBtn');if(b){b.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 1800));
  p('M:accrualModal', await ev(`document.getElementById('moneyAccrualModal').classList.contains('active')`));
  p('M:accrualFields', await ev(`['moneyAccrualEmployee','moneyAccrualCategory','moneyAccrualAmount','moneyAccrualDate','moneyAccrualTitleField'].map(id=>{const e=document.getElementById(id);return id+':'+(e?(e.type==='select-one'?e.options.length+'opts':'ok'):'missing')}).join('|')`));
  await shot('feat-money-accrual');
  p('M:console', logs.slice(0, 6));

  // ========== PROFILE ==========
  await nav('/profile/');
  for (const t of ['Мои данные', 'Деньги', 'Доступность', 'Билеты']) {
    await ev(`(()=>{const el=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(t)});if(el)el.click()})()`);
    await new Promise(r => setTimeout(r, 2200));
    p('P:tab-' + t, await ev(`(()=>{const a=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(t)});return 'active='+(a&&/active/.test(a.className))+' len='+document.body.innerText.length+' loading='+/Загрузка/.test(document.body.innerText)})()`));
    await shot('feat-profile-' + t.replace(/\s/g, '-'));
  }
  await nav('/profile/');
  p('P:editBtn', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Редактировать/.test(x.textContent));if(b){b.click();return 'clicked'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 1800));
  p('P:editModal', await ev(`document.getElementById('profileEditModal').classList.contains('active')`));
  p('P:editFields', await ev(`['profileFullName','profilePhone','profilePassportSeries','profileUsername','profileCurrentPassword'].map(id=>{const e=document.getElementById(id);return id+':'+(e?'ok':'missing')}).join('|')`));
  await shot('feat-profile-edit');
  p('P:console', logs.slice(0, 6));

  // ========== SERVICES ==========
  await nav('/services/');
  p('SV:tree-nodes', await ev(`document.querySelectorAll('[data-id],[data-service-id]').length`));
  p('SV:expand', await ev(`(()=>{const n=[...document.querySelectorAll('[data-id],[data-service-id]')][0];if(!n)return 'none';n.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1800));
  p('SV:after-expand', await ev(`document.querySelectorAll('[data-id],[data-service-id]').length`));
  p('SV:saveBtn', await ev(`(()=>{const b=document.getElementById('saveServiceBtn');return b?(getComputedStyle(b).display!=='none'):'missing'})()`));
  p('SV:deleteBtn', await ev(`(()=>{const b=document.getElementById('deleteServiceBtn');return b?(getComputedStyle(b).display!=='none'):'missing'})()`));
  await shot('feat-services-tree');

  // ========== REPORTS ==========
  await nav('/reports/');
  p('R:content', await ev(`document.querySelector('main,.content,body').innerText.replace(/\\n+/g,' | ').slice(0,250)`));
  p('R:buttons', await ev(`[...document.querySelectorAll('button')].map(b=>b.textContent.trim()||b.id).join('|')`));
  p('R:inputs', await ev(`[...document.querySelectorAll('input,select')].map(i=>i.id||i.type).join('|')`));
  p('R:html-length', await ev(`document.querySelector('main,.content,body > div:nth-child(2)')?(document.querySelector('main,.content')||{}).innerHTML?.length:'na'`));
  await shot('feat-reports');

  // ========== FILL DATA ==========
  await nav('/fill-data/');
  p('F:buttons', await ev(`[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).join('|')`));
  p('F:imports-hrefs', await ev(`[...document.querySelectorAll('a[href]')].map(a=>a.textContent.trim()+'->'+a.getAttribute('href')).slice(0,10).join(' | ')`));

  // ========== GLOBAL ==========
  await nav('/profile/');
  p('G:logout-link', await ev(`(()=>{const a=[...document.querySelectorAll('a')].find(x=>/Выйти/.test(x.textContent));return a?a.getAttribute('href'):'none'})()`));
  p('G:menu-toggle', await ev(`(()=>{const b=document.getElementById('menuToggle');return b?('display='+getComputedStyle(b).display+' visible='+(b.getBoundingClientRect().width>0)):'missing'})()`));

  say('=== FEATURES DONE ===');
  ws.close(); process.exit(0);
})().catch(e => { say('FATAL: ' + e.message + '\n' + (e.stack || '')); process.exit(1); });
