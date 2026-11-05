const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOG = OUT + '\\run-deep2.log';
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
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ': ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 250));
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; logs.push('EXCEPTION: ' + ((d.exception && d.exception.description) || d.text || '').slice(0, 250)); }
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
  async function nav(u, w = 3200) { logs.length = 0; await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u }); await new Promise(r => setTimeout(r, w)); }
  const R = []; function p(k, v) { R.push({ k, v }); say(k + ': ' + JSON.stringify(v)); fs.writeFileSync(OUT + '\\results-deep2.json', JSON.stringify(R, null, 2)); }

  await nav('/schedule/');
  // 1) event modal via calendar click
  p('d:event-click', await ev(`(()=>{const e=document.querySelector('#calendarGrid .calendar-event');if(!e)return 'noevent';e.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('d:eventModal-class', await ev(`(()=>{const m=document.getElementById('eventModal');return 'class='+m.className+'+display='+getComputedStyle(m).display+' opacity='+getComputedStyle(m).opacity+' vis='+getComputedStyle(m).visibility})()`));
  p('d:eventModal-active', await ev(`document.getElementById('eventModal').classList.contains('active')`));
  p('d:eventModal-title', await ev(`document.getElementById('eventModalTitle').textContent`));
  p('d:eventModal-body-len', await ev(`document.getElementById('eventModalBody').innerText.length`));
  await shot('d-event-modal');
  // checklist from event modal
  p('d:checklistBtn-display', await ev(`getComputedStyle(document.getElementById('eventModalChecklistBtn')).display`));
  p('d:checklistBtn-click', await ev(`(()=>{const b=document.getElementById('eventModalChecklistBtn');if(!b)return 'missing';b.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1800));
  p('d:checklistModal-class', await ev(`(()=>{const m=document.getElementById('eventChecklistModal');return m?'class='+m.className+' display='+getComputedStyle(m).display:'missing'})()`));
  p('d:checklistModal-text', await ev(`(()=>{const m=document.getElementById('eventChecklistModal');return m?m.innerText.replace(/\\n+/g,' | ').slice(0,250):'none'})()`));
  await shot('d-event-checklist');
  p('d:checklist-console', logs.slice(0, 6));

  // 2) services: click a node by text
  await nav('/services/');
  const nodeInfo = await ev(`(()=>{const nodes=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && e.textContent.trim()==='ВЕЛКОМ');if(!nodes.length)return 'notfound';const el=nodes[0];return el.tagName+'.'+el.className})()`);
  p('d:velkom-node', nodeInfo);
  p('d:velkom-click', await ev(`(()=>{const nodes=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && e.textContent.trim()==='ВЕЛКОМ');if(!nodes.length)return 'nf';nodes[0].click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 2200));
  p('d:services-after', await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,400)`));
  p('d:saveBtn-after', await ev(`(()=>{const b=document.getElementById('saveServiceBtn');return b?getComputedStyle(b).display+'|'+(b.getBoundingClientRect().width>0):'missing'})()`));
  p('d:deleteBtn-after', await ev(`(()=>{const b=document.getElementById('deleteServiceBtn');return b?getComputedStyle(b).display+'|'+(b.getBoundingClientRect().width>0):'missing'})()`));
  p('d:services-inputs', await ev(`[...document.querySelectorAll('input,select,textarea')].map(i=>i.id||i.name||i.type).join('|')`));
  await shot('d-services-velkom');
  p('d:services-console', logs.slice(0, 6));
  // expand via arrow
  p('d:arrow-click', await ev(`(()=>{const arrows=[...document.querySelectorAll('[class*=arrow],[class*=toggle],[class*=expand],[class*=caret]')];if(!arrows.length)return 'noarrows';arrows[0].click();return 'clicked:'+arrows.length})()`));
  await new Promise(r => setTimeout(r, 1800));
  p('d:after-arrow-text', await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,300)`));
  await shot('d-services-expanded');

  // 3) profile edit credentials
  await nav('/profile/');
  p('d:profile-edit', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Редактировать/.test(x.textContent));if(b){b.click();return 'ok'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 1800));
  p('d:profile-edit-modal', await ev(`document.getElementById('profileEditModal').classList.contains('active')`));
  p('d:profile-edit-fields-visible', await ev(`['profileFullName','profileNickname','profilePhone','profileTelegram','profilePassportSeries','profileUsername','profileCurrentPassword'].map(id=>{const e=document.getElementById(id);return id+':'+(e&&e.getBoundingClientRect().width>0?'visible':'hidden')}).join('|')`));
  p('d:profile-phone-mask', await ev(`(()=>{const i=document.getElementById('profilePhone');if(!i)return 'nf';i.value='79171234567';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('blur',{bubbles:true}));return i.value})()`));
  await shot('d-profile-edit');

  // 4) employees passport tab
  await nav('/employees/');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Подробнее/.test(x.textContent));if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 2000));
  p('d:emp-tabs', await ev(`[...document.querySelectorAll('#employeeModal button')].map(b=>b.textContent.trim().slice(0,25)+':'+(getComputedStyle(b).display!=='none'?'vis':'hid')).join('|')`));
  p('d:emp-passport-click', await ev(`(()=>{const b=[...document.querySelectorAll('#employeeModal button')].find(x=>/Паспорт/.test(x.textContent));if(!b)return 'nf';b.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('d:emp-after-passport', await ev(`document.getElementById('employeeModal').innerText.replace(/\\n+/g,' | ').slice(0,400)`));
  await shot('d-employee-passport');

  // 5) clients: edit form fields and delete btn visibility
  await nav('/clients/');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Подробнее/.test(x.textContent));if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 2000));
  p('d:client-view-btn', await ev(`(()=>{const b=document.getElementById('editClientBtn');return b?getComputedStyle(b).display:'missing'})()`));
  p('d:client-view-fields', await ev(`[...document.querySelectorAll('#clientModal input,#clientModal select,#clientModal textarea')].map(i=>i.id||i.name).join('|')`));

  // 6) money tab persisted state / date input interplay
  await nav('/money/');
  p('d:money-dateFrom-set', await ev(`(()=>{const i=document.getElementById('moneyDateFrom');i.value='2026-10-01';i.dispatchEvent(new Event('change',{bubbles:true}));return 'ok'})()`));
  await new Promise(r => setTimeout(r, 2000));
  p('d:money-dateTo-read', await ev(`document.getElementById('moneyDateTo').value`));
  p('d:money-after-date', await ev(`document.body.innerText.replace(/\\n+/g,' ').slice(0,200)`));
  await shot('d-money-date');

  // 7) reports html dump
  await nav('/reports/');
  p('d:reports-main-html', await ev(`(()=>{const m=document.querySelector('main,.dashboard,.container');if(!m)return 'nomain';return m.outerHTML.length+' chars: '+m.innerHTML.replace(/\\s+/g,' ').slice(0,300)})()`));
  p('d:reports-body-html', await ev(`document.body.innerHTML.replace(/\\s+/g,' ').slice(0,600)`));

  // 8) fill-data import buttons behaviour (NO click - just attributes)
  await nav('/fill-data/');
  p('d:filldata-btns', await ev(`[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()).map(b=>{const form=b.closest('form');return b.textContent.trim().slice(0,25)+'|form='+(form?form.action:'none')+'|type='+b.type}).join(' || ')`));
  p('d:filldata-forms', await ev(`[...document.querySelectorAll('form')].map(f=>f.getAttribute('action')+' method='+f.method).join(' | ')`));

  say('=== DEEP2 DONE ===');
  ws.close(); process.exit(0);
})().catch(e => { say('FATAL: ' + e.message); process.exit(1); });
