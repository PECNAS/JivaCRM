const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOG = OUT + '\\run-clients.log';
fs.writeFileSync(LOG, '');
function say(s) { fs.appendFileSync(LOG, s + '\n'); try { console.log(s); } catch (e) {} }
function httpGet(p) { return new Promise((res, rej) => { const req = http.get({ host: '127.0.0.1', port: 9222, path: p, timeout: 5000 }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }); req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', rej); }); }
async function connect() {
  const tabs = JSON.parse(await httpGet('/json'));
  const tab = tabs.find(t => t.url.includes('127.0.0.1:8000'));
  if (!tab) throw new Error('no tab');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const logs = []; const net = [];
  ws.addEventListener('message', e => {
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ': ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 250));
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; logs.push('EXCEPTION: ' + ((d.exception && d.exception.description) || d.text || '').slice(0, 300)); }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('NETERR: ' + m.params.entry.text.slice(0, 200) + ' ' + (m.params.entry.url || '').slice(0, 100));
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) net.push(m.params.response.status + ' ' + m.params.response.url.replace('http://127.0.0.1:8000', ''));
    if (m.id && pending.has(m.id)) { const cb = pending.get(m.id); pending.delete(m.id); cb(m); }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); setTimeout(() => rej(new Error('ws timeout')), 8000); });
  const send = (method, params = {}) => { const i = ++id; return new Promise(res => { pending.set(i, res); try { ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { pending.delete(i); res({}); } setTimeout(() => { if (pending.has(i)) { pending.delete(i); res({ __timeout: true }); } }, 20000); }); };
  return { ws, send, logs, net };
}
(async () => {
  const { ws, send, logs, net } = await connect();
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  const shots = OUT + '\\screenshots\\';
  async function shot(n) { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s.result && s.result.data) fs.writeFileSync(shots + n + '.png', Buffer.from(s.result.data, 'base64')); }
  async function scroll(top) { await ev(`window.scrollTo(0,${top})`); await new Promise(r => setTimeout(r, 400)); }
  async function ev(x) { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.__timeout) return '__TIMEOUT__'; if (r.result && r.result.exceptionDetails) { const d = r.result.exceptionDetails; return 'JS-ERROR: ' + ((d.exception && d.exception.description) || d.text || '').slice(0, 300); } return r.result && r.result.result ? r.result.result.value : null; }
  async function nav(u, w = 3500) { logs.length = 0; net.length = 0; await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u }); await new Promise(r => setTimeout(r, w)); }
  const R = []; function p(k, v) { R.push({ k, v }); say(k + ': ' + JSON.stringify(v)); fs.writeFileSync(OUT + '\\results-clients.json', JSON.stringify(R, null, 2)); }

  // login
  await nav('/login/', 2000);
  await ev(`(function(){const u=document.querySelector('input[name=username]'),pw=document.querySelector('input[name=password]');u.value='DHS';pw.value='admin';document.querySelector('form').submit()})()`);
  await new Promise(r => setTimeout(r, 4000));
  p('auth:path', await ev('location.pathname'));

  // ===== 1. LIST LOAD =====
  await nav('/clients/');
  p('list:url', await ev('location.href'));
  p('list:rows', await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`));
  p('list:headers', await ev(`[...document.querySelectorAll('#clientsTable th')].map(t=>t.textContent.trim()).join('|')`));
  p('list:first-row', await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');if(!r)return 'norow';return [...r.querySelectorAll('td')].map(td=>td.textContent.trim().replace(/\\s+/g,' ').slice(0,30)).join(' / ')})()`));
  p('list:loadmore-visible', await ev(`(()=>{const b=document.getElementById('clientsLoadMore');if(!b)return 'missing';return getComputedStyle(b).display+'|class='+b.className})()`));
  p('list:console', logs.slice(0, 5));
  p('list:net', net.slice(0, 5));
  await shot('01-list');

  // ===== 2. SEARCH =====
  await nav('/clients/');
  const names = await ev(`[...document.querySelectorAll('#clientsTableBody tr[data-client-id] td:first-child')].map(td=>td.textContent.trim()).join(' | ')`);
  p('search:all-names', names);
  const firstClient = await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');return r?{id:r.dataset.clientId,name:r.querySelector('td').textContent.trim()}:null})()`);
  p('search:first-client', firstClient);
  if (firstClient) {
    const frag = firstClient.name.slice(0, 3);
    await ev(`(()=>{const i=document.getElementById('searchInput');i.value=${JSON.stringify(frag)};i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await new Promise(r => setTimeout(r, 1800));
    p('search:fragment-' + frag, { rows: await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`), url: await ev('location.href'), names: await ev(`[...document.querySelectorAll('#clientsTableBody tr[data-client-id] td:first-child')].map(td=>td.textContent.trim()).join(' | ')`) });
    await shot('02-search-result');
  }
  // search uppercase
  await ev(`(()=>{const i=document.getElementById('searchInput');i.value='ТЕСТ';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await new Promise(r => setTimeout(r, 1800));
  p('search:uppercase', { rows: await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`), empty: await ev(`(document.querySelector('.load-more__empty')||{}).textContent||'none'`), url: await ev('location.href') });
  // search no result
  await ev(`(()=>{const i=document.getElementById('searchInput');i.value='zzzzzz';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await new Promise(r => setTimeout(r, 1800));
  p('search:none', { rows: await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`), empty: await ev(`(document.querySelector('.load-more__empty')||{}).textContent||'none'`) });
  await shot('03-search-empty');
  // clear
  await ev(`(()=>{const i=document.getElementById('searchInput');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await new Promise(r => setTimeout(r, 1800));
  p('search:cleared', { rows: await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`), url: await ev('location.href') });

  // search by phone
  const phoneVal = await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');if(!r)return null;const tds=r.querySelectorAll('td');return {phone:tds[1].textContent.trim(),name:tds[0].textContent.trim()}})()`);
  p('search:first-phone', phoneVal);
  if (phoneVal && phoneVal.phone && phoneVal.phone !== '—') {
    const digits = phoneVal.phone.replace(/\D/g, '').slice(-7);
    await ev(`(()=>{const i=document.getElementById('searchInput');i.value=${JSON.stringify(digits)};i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await new Promise(r => setTimeout(r, 1800));
    p('search:by-phone-' + digits, { rows: await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`), names: await ev(`[...document.querySelectorAll('#clientsTableBody tr[data-client-id] td:first-child')].map(td=>td.textContent.trim()).join(' | ')`) });
  }

  // ===== 3. FILTERS =====
  await nav('/clients/');
  p('filter:rating-options', await ev(`[...document.querySelectorAll('#ratingFilter option')].map(o=>o.value+'='+o.textContent.trim()).join('|')`));
  p('filter:city-options-count', await ev(`document.querySelectorAll('#cityFilter option').length`));
  for (const rv of ['high', 'medium', 'low']) {
    await ev(`(()=>{const s=document.getElementById('ratingFilter');s.value=${JSON.stringify(rv)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await new Promise(r => setTimeout(r, 1600));
    p('filter:rating-' + rv, { rows: await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`), empty: await ev(`(document.querySelector('.load-more__empty')||{}).textContent||''`), url: await ev('location.href') });
  }
  await shot('04-rating-filter');
  await nav('/clients/');
  const cityOpt = await ev(`(()=>{const s=document.getElementById('cityFilter');if(!s||s.options.length<2)return null;return s.options[1].value})()`);
  if (cityOpt) {
    await ev(`(()=>{const s=document.getElementById('cityFilter');s.value=${JSON.stringify(cityOpt)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await new Promise(r => setTimeout(r, 1600));
    p('filter:city-' + cityOpt, { rows: await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`), url: await ev('location.href') });
    await shot('05-city-filter');
  }
  // combined rating + city
  await nav('/clients/');
  await ev(`(()=>{const r=document.getElementById('ratingFilter');r.value='high';r.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await new Promise(r => setTimeout(r, 1400));
  if (cityOpt) {
    await ev(`(()=>{const s=document.getElementById('cityFilter');s.value=${JSON.stringify(cityOpt)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await new Promise(r => setTimeout(r, 1400));
    p('filter:combined', { rows: await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`), url: await ev('location.href') });
  }
  // URL restore
  await nav('/clients/?rating=high');
  p('filter:url-restore', { ratingValue: await ev(`document.getElementById('ratingFilter').value`), rows: await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`) });
  // search + filter together
  await nav('/clients/');
  await ev(`(()=>{const i=document.getElementById('searchInput');i.value='а';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await new Promise(r => setTimeout(r, 1600));
  await ev(`(()=>{const s=document.getElementById('ratingFilter');s.value='high';s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await new Promise(r => setTimeout(r, 1600));
  p('filter:search+pating', { rows: await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`), url: await ev('location.href') });

  // ===== 4. LOAD MORE =====
  await nav('/clients/');
  const initial = await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`);
  p('loadmore:initial', initial);
  if (initial > 0) {
    const hasBtn = await ev(`(()=>{const b=document.getElementById('clientsLoadMoreBtn');return b?{visible:getComputedStyle(b).display,disabled:b.disabled}:null})()`);
    p('loadmore:btn', hasBtn);
    if (hasBtn) {
      await scroll(3000);
      await shot('06-list-bottom');
    }
  }

  // ===== 5. CLIENT CARD =====
  await nav('/clients/');
  const cid = await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');return r?r.dataset.clientId:null})()`);
  p('card:client-id', cid);
  p('card:open-via-row', await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');if(!r)return 'norow';r.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 2000));
  p('card:modal-open', await ev(`document.getElementById('clientModal').classList.contains('active')`));
  p('card:modal-title', await ev(`(document.querySelector('#clientModal .modal__title')||{}).textContent||''`));
  p('card:fields', await ev(`[...document.querySelectorAll('#clientModal [class*=client-info__label], #clientModal [class*=label]')].map(l=>l.textContent.trim()).filter(Boolean).slice(0,20).join('|')`));
  p('card:text', await ev(`document.getElementById('clientModal').innerText.replace(/\\n+/g,' | ').slice(0,600)`));
  p('card:buttons', await ev(`[...document.querySelectorAll('#clientModal button')].map(b=>b.textContent.trim()+'['+(getComputedStyle(b).display!=='none'?'vis':'hid')+']').join('|')`));
  p('card:orders-section', await ev(`(()=>{const s=[...document.querySelectorAll('#clientModal [class*=orders]')];return s.length?s[0].textContent.replace(/\\s+/g,' ').slice(0,120):'none'})()`));
  p('card:console', logs.slice(0, 6));
  await shot('07-client-card');

  // ===== 6. EDIT MODE =====
  p('edit:open', await ev(`(()=>{const b=document.getElementById('editClientBtn');if(!b||getComputedStyle(b).display==='none')return 'hidden';b.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('edit:form-visible', await ev(`(()=>{const f=document.getElementById('editFullName');return f?(f.getBoundingClientRect().width>0):'missing'})()`));
  p('edit:values', await ev(`(()=>{const g=id=>{const e=document.getElementById(id);return e?e.value:null};return JSON.stringify({name:g('editFullName'),phone:g('editPhone'),telegram:g('editTelegram'),email:g('editEmail'),type:g('editClientType'),rating:g('editRating')})})()`));
  p('edit:city-chips', await ev(`(()=>{const c=document.querySelectorAll('#clientModal [class*=city-chip], #clientModal [class*=chip]');return c.length+' chips: '+[...c].map(x=>x.textContent.trim().slice(0,20)).join(',')})()`));
  await shot('08-edit-mode');

  // phone validation - invalid
  p('edit:phone-invalid-typed', await ev(`(()=>{const i=document.getElementById('editPhone');i.value='123';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('blur',{bubbles:true}));return i.value})()`));
  // submit with empty name
  p('edit:submit-empty-name', await ev(`(()=>{const n=document.getElementById('editFullName');const old=n.value;n.value='';const f=document.getElementById('editForm');f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));n.value=old;return 'submitted'})()`));
  await new Promise(r => setTimeout(r, 1200));
  p('edit:toast-empty-name', await ev(`(()=>{const t=document.querySelector('.toast,[class*=toast]');return t?t.textContent.trim().slice(0,80):'no toast'})()`));
  // submit invalid phone
  p('edit:submit-bad-phone', await ev(`(()=>{const p=document.getElementById('editPhone');const old=p.value;p.value='123';document.getElementById('editForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));p.value=old;return 'submitted'})()`));
  await new Promise(r => setTimeout(r, 1200));
  p('edit:toast-bad-phone', await ev(`(()=>{const t=[...document.querySelectorAll('.toast,[class*=toast]')].map(x=>x.textContent.trim()).join('|');return t||'no toast'})()`));
  await shot('09-validation');
  // cancel edit
  p('edit:cancel', await ev(`(()=>{const b=document.getElementById('editCancelBtn');if(!b||getComputedStyle(b).display==='none')return 'hidden';b.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1200));
  p('edit:after-cancel-form-hidden', await ev(`(()=>{const f=document.getElementById('editFullName');return f?(f.getBoundingClientRect().width===0):'missing'})()`));

  // ===== 7. ADD CLIENT =====
  await nav('/clients/');
  p('add:open', await ev(`(()=>{const b=document.getElementById('addClientBtn');if(!b)return 'missing';b.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1800));
  p('add:modal-open', await ev(`document.getElementById('addClientModal').classList.contains('active')`));
  p('add:fields', await ev(`[...document.querySelectorAll('#addClientModal input,#addClientModal select,#addClientModal textarea')].map(i=>i.id||i.name||i.type).filter(Boolean).join('|')`));
  p('add:type-options', await ev(`[...document.querySelectorAll('#addClientType option')].map(o=>o.value).join(',')`));
  await shot('10-add-modal');
  // fill phone
  p('add:phone-mask', await ev(`(()=>{const i=document.getElementById('addPhone');if(!i)return 'missing';i.value='79171234567';i.dispatchEvent(new Event('input',{bubbles:true}));return i.value})()`));
  // switch client type
  p('add:switch-to-agency', await ev(`(()=>{const s=document.getElementById('addClientType');const opts=[...s.options].map(o=>o.value);const agency=opts.includes('agency')?'agency':opts[1];s.value=agency;s.dispatchEvent(new Event('change',{bubbles:true}));return agency})()`));
  await new Promise(r => setTimeout(r, 800));
  p('add:agency-field-visible', await ev(`(()=>{const f=document.getElementById('addAgencySearch');if(!f)return 'missing';return f.getBoundingClientRect().width>0})()`));
  // submit empty
  p('add:submit-empty', await ev(`(()=>{const f=document.getElementById('addForm');if(!f)return 'noform';f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return 'submitted'})()`));
  await new Promise(r => setTimeout(r, 1300));
  p('add:toast-empty', await ev(`(()=>{const t=[...document.querySelectorAll('.toast,[class*=toast]')].map(x=>x.textContent.trim()).join('|');return t||'no toast'})()`));
  p('add:modal-still-open-after-empty', await ev(`document.getElementById('addClientModal').classList.contains('active')`));
  await shot('11-add-validation');
  // close
  p('add:close', await ev(`(()=>{const b=document.getElementById('addModalCancelBtn');if(b){b.click();return 'closed'}return 'nf'})()`));
  await new Promise(r => setTimeout(r, 1000));
  p('add:modal-closed', await ev(`document.getElementById('addClientModal').classList.contains('active')`));

  // ===== 8. CITY & AGENCY AUTOCOMPLETE =====
  await nav('/clients/');
  await ev(`(()=>{document.getElementById('addClientBtn').click()})()`);
  await new Promise(r => setTimeout(r, 1500));
  const cityInput = await ev(`(()=>{const inputs=[...document.querySelectorAll('#addClientModal input[type=text]')].filter(i=>!/Начните вводить ФИО|Тип|Агент|Email|Telegram/i.test(i.placeholder||''));return inputs.map(i=>i.id+'|'+i.placeholder).join(' ; ')})()`);
  p('auto:city-inputs', cityInput);
  const typed = await ev(`(()=>{const inputs=[...document.querySelectorAll('#addClientModal input[type=text]')];const city=inputs.find(i=>/город/i.test(i.placeholder||''));if(!city)return 'nocity';city.value='Каз';city.dispatchEvent(new Event('input',{bubbles:true}));city.focus();return 'typed'})()`);
  p('auto:city-type', typed);
  await new Promise(r => setTimeout(r, 1600));
  p('auto:city-dropdown', await ev(`(()=>{const d=[...document.querySelectorAll('#addClientModal [class*=dropdown], #addClientModal [class*=suggest]')].filter(x=>x.children.length>0);return d.length?d[0].textContent.trim().replace(/\\s+/g,' ').slice(0,150):'no dropdown'})()`));
  p('auto:city-dropdown-open', await ev(`(()=>{const d=document.querySelector('#addClientModal [class*=dropdown].open, #addClientModal [class*=suggest].open');return d?'open':'closed'})()`));
  await shot('12-city-autocomplete');
  const agencyTyped = await ev(`(()=>{const a=document.getElementById('addAgencySearch');if(!a)return 'noagency';a.value='Арт';a.dispatchEvent(new Event('input',{bubbles:true}));a.focus();return 'typed'})()`);
  p('auto:agency-type', agencyTyped);
  await new Promise(r => setTimeout(r, 1600));
  p('auto:agency-dropdown', await ev(`(()=>{const a=document.getElementById('addAgencySearch');if(!a)return 'noagency';const d=a.parentElement.querySelector('[class*=dropdown],[class*=suggest]');return d?d.textContent.trim().replace(/\\s+/g,' ').slice(0,150):'no dropdown'})()`));
  p('auto:console', logs.slice(0, 8));
  p('auto:net', net.slice(0, 8));
  await shot('13-agency-autocomplete');

  // ===== 9. ESC CLOSE =====
  p('esc:modal-before', await ev(`document.getElementById('addClientModal').classList.contains('active')`));
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true}))`);
  await new Promise(r => setTimeout(r, 1000));
  p('esc:modal-after', await ev(`document.getElementById('addClientModal').classList.contains('active')`));

  // ===== 10. DELETE (open confirm, cancel) =====
  await nav('/clients/');
  await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');if(r)r.click()})()`);
  await new Promise(r => setTimeout(r, 1800));
  p('del:modal-open', await ev(`document.getElementById('clientModal').classList.contains('active')`));
  p('del:delete-btn-visible', await ev(`(()=>{const b=document.getElementById('deleteClientBtn');return b?getComputedStyle(b).display+'|'+(b.getBoundingClientRect().width>0):'missing'})()`));
  p('del:click', await ev(`(()=>{const b=document.getElementById('deleteClientBtn');if(!b)return 'missing';b.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1200));
  p('del:confirm-text', await ev(`(()=>{const m=[...document.querySelectorAll('[class*=confirm],.modal-overlay.active')].filter(x=>x.getBoundingClientRect().width>0);return m.length?m[0].innerText.replace(/\\n+/g,' | ').slice(0,200):'no confirm'})()`));
  await shot('14-delete-confirm');
  p('del:cancel', await ev(`(()=>{const btns=[...document.querySelectorAll('button')].filter(b=>/Отмена|Закрыть/.test(b.textContent)&&b.getBoundingClientRect().width>0);if(!btns.length)return 'nocancel';btns[btns.length-1].click();return 'cancelled'})()`));
  await new Promise(r => setTimeout(r, 1000));
  p('del:after-cancel-still-exists', await ev(`document.querySelectorAll('#clientsTableBody tr[data-client-id]').length`));

  // ===== 11. RATING DISPLAY =====
  await nav('/clients/');
  p('rating:badges', await ev(`[...document.querySelectorAll('#clientsTableBody [class*=rating], #clientsTableBody .badge')].map(b=>b.className+'='+b.textContent.trim()).slice(0,6).join(' | ')`));
  p('rating:counts', await ev(`(()=>{const cells=[...document.querySelectorAll('#clientsTableBody tr[data-client-id]')].map(r=>r.querySelectorAll('td')[4]?r.querySelectorAll('td')[4].textContent.trim():'?');const c={};cells.forEach(x=>c[x]=(c[x]||0)+1);return JSON.stringify(c)})()`));

  // ===== 12. SORT / TABLE STRUCTURE =====
  p('table:sortable-headers', await ev(`[...document.querySelectorAll('#clientsTable th')].map(t=>({text:t.textContent.trim(),sortable:/sort|click|data-sort/.test(t.className+' '+(t.getAttribute('data-sort')||'')),cursor:getComputedStyle(t).cursor})).map(x=>x.text+':'+x.sortable+'/'+x.cursor).join(' | ')`));
  p('table:col-count', await ev(`document.querySelectorAll('#clientsTable thead th').length`));
  p('table:row-col-match', await ev(`(()=>{const h=document.querySelectorAll('#clientsTable thead th').length;const r=document.querySelector('#clientsTableBody tr[data-client-id]');return 'header='+h+' cells='+(r?r.querySelectorAll('td').length:0)})()`));

  say('=== CLIENTS PART1 DONE ===');
  ws.close(); process.exit(0);
})().catch(e => { say('FATAL: ' + e.message + '\n' + (e.stack || '')); process.exit(1); });
