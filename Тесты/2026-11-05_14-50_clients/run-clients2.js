const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOG = OUT + '\\run-clients2.log';
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  const shots = OUT + '\\screenshots\\';
  async function shot(n) { const s = await send('Page.captureScreenshot', { format: 'png' }); if (s.result && s.result.data) fs.writeFileSync(shots + n + '.png', Buffer.from(s.result.data, 'base64')); }
  async function ev(x) { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.__timeout) return '__TIMEOUT__'; if (r.result && r.result.exceptionDetails) { const d = r.result.exceptionDetails; return 'JS-ERROR: ' + ((d.exception && d.exception.description) || d.text || '').slice(0, 300); } return r.result && r.result.result ? r.result.result.value : null; }
  async function nav(u, w = 3500) { logs.length = 0; net.length = 0; await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u }); await new Promise(r => setTimeout(r, w)); }
  const R = []; function p(k, v) { R.push({ k, v }); say(k + ': ' + JSON.stringify(v)); fs.writeFileSync(OUT + '\\results-clients2.json', JSON.stringify(R, null, 2)); }

  await nav('/login/', 2000);
  await ev(`(function(){const u=document.querySelector('input[name=username]'),pw=document.querySelector('input[name=password]');u.value='DHS';pw.value='admin';document.querySelector('form').submit()})()`);
  await new Promise(r => setTimeout(r, 4000));

  // 1. TABLE HEADERS investigation
  await nav('/clients/');
  p('t:table-id', await ev(`(()=>{const t=document.querySelector('table');return t?t.id||t.className:'notable'})()`));
  p('t:all-tables', await ev(`[...document.querySelectorAll('table')].map(t=>t.id||t.className+'|th='+t.querySelectorAll('th').length+'|tr='+t.querySelectorAll('tbody tr').length).join(' || ')`));
  p('t:thead-html', await ev(`(()=>{const t=document.querySelector('#clientsTable')||document.querySelector('table');if(!t)return 'notable';const th=t.querySelector('thead');return th?th.outerHTML.replace(/\\s+/g,' ').slice(0,500):'no thead'})()`));
  p('t:thead-th-count', await ev(`(()=>{const t=document.querySelector('#clientsTable')||document.querySelector('table');return t?t.querySelectorAll('thead th').length:0})()`));
  p('t:thead-display', await ev(`(()=>{const t=document.querySelector('#clientsTable')||document.querySelector('table');const th=t?t.querySelector('thead'):null;if(!th)return 'none';const s=getComputedStyle(th);return 'display='+s.display+' vis='+s.visibility+' h='+th.getBoundingClientRect().height})()`));
  p('t:first-row-cells', await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');if(!r)return 'norow';return [...r.children].map(td=>td.tagName+':'+td.textContent.trim().slice(0,22)).join(' | ')})()`));
  await shot('20-table-headers');

  // 2. CLIENT CARD - telegram field display
  await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');if(r)r.click()})()`);
  await new Promise(r => setTimeout(r, 2000));
  p('c:telegram-row', await ev(`(()=>{const rows=[...document.querySelectorAll('#clientModal [class*=row],[class*=info]')];const tg=rows.find(x=>/ТЕЛЕГРАМ|Телеграм/i.test(x.textContent));return tg?tg.textContent.trim().replace(/\\s+/g,' ').slice(0,120):'not found'})()`));
  p('c:phone-row', await ev(`(()=>{const rows=[...document.querySelectorAll('#clientModal [class*=row],[class*=info]')];const ph=rows.find(x=>/ТЕЛЕФОН|Телефон/i.test(x.textContent));return ph?ph.textContent.trim().replace(/\\s+/g,' ').slice(0,120):'not found'})()`));
  p('c:telegram-value-attr', await ev(`(()=>{const el=[...document.querySelectorAll('#clientModal a')].filter(a=>/t\\.me/.test(a.href));return el.map(a=>a.textContent.trim()+'->'+a.href).join(' | ')||'no tg link'})()`));
  await shot('21-card-telegram');
  await ev(`(()=>{const b=document.getElementById('clientViewCloseBtn')||document.getElementById('modalCloseBtn');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 1000));

  // 3. EDIT FORM - check form element and validation
  await nav('/clients/');
  await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');if(r)r.click()})()`);
  await new Promise(r => setTimeout(r, 2000));
  await ev(`(()=>{const b=document.getElementById('editClientBtn');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 1500));
  p('e:forms-in-modal', await ev(`[...document.querySelectorAll('#clientModal form')].map(f=>f.id||f.className||'(no-id)').join(' | ')||'no forms'`));
  p('e:edit-btn-type', await ev(`(()=>{const b=[...document.querySelectorAll('#clientModal button')].find(x=>/Сохранить/.test(x.textContent));return b?b.type+'|'+(b.form?b.form.id:'noform'):'missing'})()`));
  // click save with empty name
  p('e:clear-name', await ev(`(()=>{const n=document.getElementById('editFullName');n.value='';return n.value})()`));
  p('e:click-save', await ev(`(()=>{const b=[...document.querySelectorAll('#clientModal button')].find(x=>/Сохранить/.test(x.textContent));if(!b)return 'missing';b.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('e:toast-after-empty-save', await ev(`(()=>{const t=[...document.querySelectorAll('.toast,[class*=toast],.ui-toast')].map(x=>x.textContent.trim());return t.join('|')||'no toast'})()`));
  p('e:modal-still-open', await ev(`document.getElementById('clientModal').classList.contains('active')`));
  p('e:logs', logs.slice(0, 6));
  await shot('22-save-empty-name');
  // restore & test phone validation via blur
  await ev(`(()=>{const n=document.getElementById('editFullName');n.value='Ирина Дымченко'})()`);
  p('e:phone-typed-5digits', await ev(`(()=>{const i=document.getElementById('editPhone');i.value='79171';i.dispatchEvent(new Event('input',{bubbles:true}));return i.value})()`));
  p('e:phone-typed-full', await ev(`(()=>{const i=document.getElementById('editPhone');i.value='79171234567';i.dispatchEvent(new Event('input',{bubbles:true}));return i.value})()`));
  await shot('23-phone-mask');

  // 4. ESC close on add modal
  await nav('/clients/');
  await ev(`(()=>{document.getElementById('addClientBtn').click()})()`);
  await new Promise(r => setTimeout(r, 1500));
  p('k:add-open', await ev(`document.getElementById('addClientModal').classList.contains('active')`));
  p('k:esc-dispatch', await ev(`(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',keyCode:27,which:27,bubbles:true}));return 'sent'})()`));
  await new Promise(r => setTimeout(r, 1200));
  p('k:after-esc', await ev(`document.getElementById('addClientModal').classList.contains('active')`));
  p('k:body-class', await ev(`document.body.className`));
  // overlay click close
  p('k:overlay-click', await ev(`(()=>{const m=document.getElementById('addClientModal');if(!m)return 'missing';m.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1200));
  p('k:after-overlay', await ev(`document.getElementById('addClientModal').classList.contains('active')`));
  // cross button
  await nav('/clients/');
  await ev(`(()=>{document.getElementById('addClientBtn').click()})()`);
  await new Promise(r => setTimeout(r, 1500));
  p('k:cross-click', await ev(`(()=>{const b=document.getElementById('addModalCloseBtn');if(!b)return 'missing';b.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1200));
  p('k:after-cross', await ev(`document.getElementById('addClientModal').classList.contains('active')`));

  // 5. DELETE CONFIRM dialog
  await nav('/clients/');
  await ev(`(()=>{const r=document.querySelector('#clientsTableBody tr[data-client-id]');if(r)r.click()})()`);
  await new Promise(r => setTimeout(r, 2000));
  await ev(`(()=>{const b=document.getElementById('deleteClientBtn');if(b)b.click()})()`);
  await new Promise(r => setTimeout(r, 1500));
  p('d:confirm-dialog-exists', await ev(`(()=>{const d=[...document.querySelectorAll('[class*=confirm],[role=dialog],.modal-overlay')].filter(x=>getComputedStyle(x).display!=='none'&&x.getBoundingClientRect().width>0);return d.map(x=>x.id||x.className.split(' ')[0]+':'+x.innerText.replace(/\\n+/g,' ').slice(0,80)).join(' || ')||'none'})()`));
  p('d:ui-confirm-defined', await ev(`typeof (window.UI&&window.UI.confirm)`));
  p('d:all-visible-dialogs', await ev(`[...document.querySelectorAll('.modal-overlay,.modal,[class*=confirm]')].filter(x=>{const s=getComputedStyle(x);return s.display!=='none'&&s.visibility!=='hidden'&&x.getBoundingClientRect().height>0}).map(x=>(x.id||x.className.split(' ')[0])+'|h='+Math.round(x.getBoundingClientRect().height)).join(' || ')||'none'`));
  await shot('24-delete-confirm');
  p('d:logs', logs.slice(0, 8));

  // 6. ADD CLIENT - form structure
  await nav('/clients/');
  await ev(`(()=>{document.getElementById('addClientBtn').click()})()`);
  await new Promise(r => setTimeout(r, 1500));
  p('a:forms', await ev(`[...document.querySelectorAll('#addClientModal form')].map(f=>f.id||f.className+'|action='+f.getAttribute('action')).join(' | ')||'no forms'`));
  p('a:submit-btn', await ev(`(()=>{const b=document.getElementById('addModalSubmitBtn');return b?b.type+'|form='+(b.form?b.form.id:'noform')+'|onclick='+(b.getAttribute('onclick')||'none'):'missing'})()`));
  p('a:required-attrs', await ev(`[...document.querySelectorAll('#addClientModal [required]')].map(i=>i.id||i.name).join(',')||'none'`));
  // click add with empty
  p('a:click-add-empty', await ev(`(()=>{const b=document.getElementById('addModalSubmitBtn');if(!b)return 'missing';b.click();return 'clicked'})()`));
  await new Promise(r => setTimeout(r, 1500));
  p('a:toast-after-empty', await ev(`(()=>{const t=[...document.querySelectorAll('.toast,[class*=toast]')].map(x=>x.textContent.trim());return t.join('|')||'no toast'})()`));
  p('a:modal-after-empty', await ev(`document.getElementById('addClientModal').classList.contains('active')`));
  await shot('25-add-empty-submit');
  // fill valid name and submit
  p('a:fill-name', await ev(`(()=>{const n=document.getElementById('addFullName');n.value='ТЕСТ КЛИЕНТ DSH';n.dispatchEvent(new Event('input',{bubbles:true}));return n.value})()`));
  await shot('26-add-filled');
  p('a:logs', logs.slice(0, 6));

  say('=== CLIENTS PART2 DONE ===');
  ws.close(); process.exit(0);
})().catch(e => { say('FATAL: ' + e.message + '\n' + (e.stack || '')); process.exit(1); });
