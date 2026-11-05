const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOG = OUT + '\\run-clients3.log';
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
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) net.push(m.params.response.status + ' ' + m.params.response.url.replace('http://127.0.0.1:8000', ''));
    if (m.id && pending.has(m.id)) { const cb = pending.get(m.id); pending.delete(m.id); cb(m); }
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); setTimeout(() => rej(new Error('ws timeout')), 8000); });
  const send = (method, params = {}) => { const i = ++id; return new Promise(res => { pending.set(i, res); try { ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { pending.delete(i); res({}); } setTimeout(() => { if (pending.has(i)) { pending.delete(i); res({ __timeout: true }); } }, 20000); }); };
  return { ws, send, logs, net };
}
(async () => {
  const { ws, send, logs, net } = await connect();
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  const shots = OUT + '\\screenshots\\';
  async function shot(n) { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s.result && s.result.data) fs.writeFileSync(shots + n + '.png', Buffer.from(s.result.data, 'base64')); }
  async function ev(x) { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.__timeout) return '__TIMEOUT__'; if (r.result && r.result.exceptionDetails) { const d = r.result.exceptionDetails; return 'JS-ERROR: ' + ((d.exception && d.exception.description) || d.text || '').slice(0, 300); } return r.result && r.result.result ? r.result.result.value : null; }
  async function nav(u, w = 3500) { logs.length = 0; net.length = 0; await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u }); await new Promise(r => setTimeout(r, w)); }
  const R = []; function p(k, v) { R.push({ k, v }); say(k + ': ' + JSON.stringify(v)); fs.writeFileSync(OUT + '\\results-clients3.json', JSON.stringify(R, null, 2)); }

  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await nav('/login/', 2000);
  await ev(`(function(){const u=document.querySelector('input[name=username]'),pw=document.querySelector('input[name=password]');u.value='DHS';pw.value='admin';document.querySelector('form').submit()})()`);
  await new Promise(r => setTimeout(r, 4000));

  // 1. Modal visibility after opening (z-index/stacking)
  await nav('/clients/');
  await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');if(r)r.click()})()`);
  await new Promise(r => setTimeout(r, 2500));
  p('v:clientModal-active', await ev(`document.getElementById('clientModal').classList.contains('active')`));
  p('v:clientModal-css', await ev(`(()=>{const m=document.getElementById('clientModal');const s=getComputedStyle(m);return JSON.stringify({display:s.display,visibility:s.visibility,opacity:s.opacity,zIndex:s.zIndex,position:s.position})})()`));
  p('v:clientModal-rect', await ev(`(()=>{const m=document.querySelector('#clientModal .modal');if(!m)return 'nomodal';const r=m.getBoundingClientRect();return JSON.stringify({w:Math.round(r.width),h:Math.round(r.height),top:Math.round(r.top)})})()`));
  p('v:uiConfirm-active', await ev(`(()=>{const m=document.getElementById('uiConfirmModal');return m?m.className:'missing'})()`));
  p('v:visible-modal-text', await ev(`(()=>{const m=document.querySelector('#clientModal .modal');return m?m.innerText.replace(/\\n+/g,' | ').slice(0,300):'none'})()`));
  await shot('30-modal-visible');

  // EDIT: the "Сохранить" button inside edit form - check it works with values
  await ev(`(()=>{const b=document.getElementById('editClientBtn');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 1500));
  p('v:edit-form-submit-btn', await ev(`(()=>{const f=document.getElementById('editClientForm');if(!f)return 'noform';const b=f.querySelector('button[type=submit]');return b?b.textContent.trim()+'|visible='+(b.getBoundingClientRect().width>0):'nosubmit'})()`));
  // Empty name submit -> should show toast (client-side validation)
  p('v:clear-and-submit', await ev(`(()=>{const n=document.getElementById('editFullName');n.value='';const f=document.getElementById('editClientForm');f.requestSubmit();return 'submitted'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('v:toast', await ev(`(()=>{const t=[...document.querySelectorAll('.toast,[class*=toast],.ui-toast')];return t.map(x=>x.textContent.trim()+'['+getComputedStyle(x).display+']').join('|')||'no toast'})()`));
  p('v:required-validation', await ev(`(()=>{const n=document.getElementById('editFullName');return 'valid='+n.checkValidity()+'|validationMessage='+(n.validationMessage||'(empty)')})()`));
  await shot('31-edit-validation');
  // restore name and test phone validation
  await ev(`(()=>{const n=document.getElementById('editFullName');n.value='Ирина Дымченко'})()`);
  p('v:phone-5digits-submit', await ev(`(()=>{const ph=document.getElementById('editPhone');ph.value='+7 (917) 1';document.getElementById('editClientForm').requestSubmit();return 'submitted'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('v:toast-phone', await ev(`(()=>{const t=[...document.querySelectorAll('.toast,[class*=toast]')];return t.map(x=>x.textContent.trim()).join('|')||'no toast'})()`));
  p('v:logs-after', logs.slice(0, 6));

  // 2. ESC / overlay close on clientModal
  await nav('/clients/');
  await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');if(r)r.click()})()`);
  await new Promise(r => setTimeout(r, 2000));
  p('x:open', await ev(`document.getElementById('clientModal').classList.contains('active')`));
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true}))`);
  await new Promise(r => setTimeout(r, 1200));
  p('x:after-esc', await ev(`document.getElementById('clientModal').classList.contains('active')`));
  // close button
  await ev(`(()=>{const b=document.getElementById('clientViewCloseBtn')||document.getElementById('modalCloseBtn');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 1200));
  p('x:after-close-btn', await ev(`document.getElementById('clientModal').classList.contains('active')`));
  p('x:body-class-after', await ev(`document.body.className`));

  // 3. ADD CLIENT: validation via requestSubmit
  await nav('/clients/');
  await ev(`(()=>{document.getElementById('addClientBtn').click()})()`);
  await new Promise(r => setTimeout(r, 1800));
  p('y:add-form', await ev(`(()=>{const f=document.getElementById('addClientForm');return f?('fields='+f.querySelectorAll('input,select,textarea').length):'noform'})()`));
  p('y:add-requestSubmit-empty', await ev(`(()=>{const f=document.getElementById('addClientForm');if(!f)return 'noform';f.requestSubmit();return 'submitted'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('y:add-toast', await ev(`(()=>{const t=[...document.querySelectorAll('.toast,[class*=toast]')];return t.map(x=>x.textContent.trim()).join('|')||'no toast'})()`));
  p('y:add-required', await ev(`(()=>{const f=document.getElementById('addClientForm');if(!f)return 'noform';const req=[...f.querySelectorAll('[required]')];return req.map(i=>i.id+':valid='+i.checkValidity()).join(' | ')})()`));
  p('y:add-modal-still', await ev(`document.getElementById('addClientModal').classList.contains('active')`));
  await shot('32-add-validation');
  p('y:logs', logs.slice(0, 6));

  // 4. Rating filter + city filter counts on dataset
  await nav('/clients/');
  p('z:rating-counts', await ev(`fetch('/clients/list/?limit=100').then(r=>r.json()).then(d=>{const c={};(d.clients||[]).forEach(x=>c[x.rating]=(c[x.rating]||0)+1);return JSON.stringify({total:(d.clients||[]).length,byRating:c})})`));
  p('z:city-filter-opts', await ev(`[...document.querySelectorAll('#cityFilter option')].slice(0,5).map(o=>o.value+':'+o.textContent.trim()).join(' | ')`));

  // ===== MOBILE =====
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav('/clients/');
  p('m:url', await ev('location.pathname'));
  p('m:overflow', await ev(`JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1})`));
  p('m:table-visible', await ev(`(()=>{const t=document.querySelector('.clients-table,#clientsTable');return t?getComputedStyle(t).display+'|w='+Math.round(t.getBoundingClientRect().width):'ntable'})()`));
  p('m:thead-display', await ev(`(()=>{const h=document.querySelector('#clientsTable thead');return h?getComputedStyle(h).display:'none'})()`));
  p('m:card-layout', await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');if(!r)return 'norow';const s=getComputedStyle(r);const tds=r.querySelectorAll('td');return JSON.stringify({display:s.display,height:Math.round(r.getBoundingClientRect().height),cells:tds.length})})()`));
  p('m:row-text', await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');return r?r.innerText.replace(/\\n+/g,' | ').slice(0,150):'norow'})()`));
  p('m:touch-targets', await ev(`(()=>{const els=[...document.querySelectorAll('button,a,input,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});const small=els.filter(e=>{const r=e.getBoundingClientRect();return r.height<32||r.width<32});return JSON.stringify({total:els.length,tooSmall:small.length,samples:small.slice(0,5).map(e=>((e.textContent||e.id||e.tagName).trim().slice(0,15))+':'+Math.round(e.getBoundingClientRect().height))})})()`));
  await shot('33-mobile-list');
  // mobile card open
  await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');if(r)r.click()})()`);
  await new Promise(r => setTimeout(r, 2200));
  p('m:card-open', await ev(`document.getElementById('clientModal').classList.contains('active')`));
  p('m:card-fit', await ev(`(()=>{const m=document.querySelector('#clientModal .modal');if(!m)return 'nomodal';const r=m.getBoundingClientRect();return JSON.stringify({w:Math.round(r.width),h:Math.round(r.height),fitsH:r.height<=844})})()`));
  await shot('34-mobile-card');
  // mobile add
  await nav('/clients/');
  await ev(`(()=>{document.getElementById('addClientBtn').click()})()`);
  await new Promise(r => setTimeout(r, 2200));
  p('m:add-fit', await ev(`(()=>{const m=document.querySelector('#addClientModal .modal');if(!m)return 'nomodal';const r=m.getBoundingClientRect();return JSON.stringify({w:Math.round(r.width),h:Math.round(r.height),fitsH:r.height<=844})})()`));
  await shot('35-mobile-add');
  // mobile filters
  await nav('/clients/');
  p('m:filters-position', await ev(`(()=>{const s=document.getElementById('searchInput');const r=document.getElementById('ratingFilter');const c=document.getElementById('cityFilter');return JSON.stringify({search:Math.round(s.getBoundingClientRect().top),rating:Math.round(r.getBoundingClientRect().top),city:Math.round(c.getBoundingClientRect().top)})})()`));
  await shot('36-mobile-filters');

  say('=== CLIENTS PART3 DONE ===');
  ws.close(); process.exit(0);
})().catch(e => { say('FATAL: ' + e.message + '\n' + (e.stack || '')); process.exit(1); });
