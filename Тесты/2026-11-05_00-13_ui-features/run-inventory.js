const fs = require('fs');
const http = require('http');
const OUT = process.argv[2];
const LOG = OUT + '\\inventory.log';
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
  async function ev(x) { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.__timeout) return '__TIMEOUT__'; if (r.result && r.result.exceptionDetails) return 'EXC: ' + (r.result.exceptionDetails.text || '').slice(0, 100); return r.result && r.result.result ? r.result.result.value : null; }
  async function nav(u, w = 3200) { logs.length = 0; await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u }); await new Promise(r => setTimeout(r, w)); }

  // login
  await nav('/login/', 2000);
  const filled = await ev(`(function(){const u=document.querySelector('input[name=username]'),p=document.querySelector('input[name=password]');if(u&&p){u.value='DHS';p.value='admin';u.dispatchEvent(new Event('input',{bubbles:true}));p.dispatchEvent(new Event('input',{bubbles:true}));return 'filled'}return 'nofields'})()`);
  say('FILL: ' + filled);
  await ev(`(function(){const f=document.querySelector('form');if(f){f.submit();return 'submitted'}return 'noform'})()`);
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 800));
    const p = await ev('location.pathname');
    if (p && p !== '/login/') { say('LOGIN OK: ' + p); break; }
  }
  await new Promise(r => setTimeout(r, 2000));
  const finalPath = await ev('location.pathname');
  say('LOGIN URL: ' + finalPath);
  if (finalPath === '/login/') {
    say('ERROR TEXT: ' + await ev(`(document.body.innerText||'').replace(/\\n+/g,' ').slice(0,300)`));
    ws.close(); process.exit(1);
  }

  const pages = [
    ['/schedule/', 'schedule'],
    ['/clients/', 'clients'],
    ['/employees/', 'employees'],
    ['/services/', 'services'],
    ['/money/', 'money'],
    ['/reports/', 'reports'],
    ['/profile/', 'profile'],
    ['/fill-data/', 'fill-data'],
    ['/checklists/', 'checklists-json'],
  ];

  const INV = {};

  for (const [path, name] of pages) {
    await nav(path);
    const url = await ev('location.pathname');
    const inv = await ev(`(function(){
      const buttons = [...document.querySelectorAll('button')].map(b => ({
        text: (b.innerText || b.value || '').trim().replace(/\\s+/g, ' ').slice(0, 40),
        id: b.id || '',
        cls: (b.className || '').toString().split(' ').slice(0, 2).join(' '),
        type: b.type,
        disabled: b.disabled,
        visible: b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().height > 0
      })).filter(b => b.text || b.id);
      const inputs = [...document.querySelectorAll('input,select,textarea')].map(i => ({
        tag: i.tagName.toLowerCase(),
        type: i.type || '',
        id: i.id || '',
        name: i.name || '',
        placeholder: i.placeholder || '',
        visible: i.getBoundingClientRect().width > 0
      }));
      const forms = [...document.querySelectorAll('form')].map(f => ({ id: f.id || '', action: f.getAttribute('action') || '', method: f.method || 'get' }));
      const tabs = [...document.querySelectorAll('[role=tab],[class*=tab]')].map(t => ({ text: (t.innerText || '').trim().slice(0, 30), active: /active|selected/.test((t.className || '') + ' ' + (t.getAttribute('aria-selected') || '')) })).filter(t => t.text);
      const links = [...document.querySelectorAll('a')].map(a => ({ text: (a.innerText || '').trim().slice(0, 30), href: a.getAttribute('href') || '' })).filter(a => a.href);
      const modals = [...document.querySelectorAll('.modal-overlay,.modal,[role=dialog]')].map(m => ({ id: m.id || '', cls: (m.className || '').toString().split(' ')[0], active: /active|open/.test(m.className || '') }));
      const listeners = document.body.dataset.role || '';
      return JSON.stringify({ buttons, inputs, forms, tabs, links, modals, role: listeners, title: document.title });
    })()`);
    try { INV[name] = JSON.parse(inv); } catch (e) { INV[name] = { raw: inv }; }
    say(`===== ${name} (${url}) =====`);
    say('roles: ' + (INV[name].role || ''));
    say('buttons: ' + (INV[name].buttons || []).map(b => b.text + (b.id ? '#' + b.id : '') + (b.visible ? '' : '[hidden]') + (b.disabled ? '[disabled]' : '')).join(' | '));
    say('inputs: ' + (INV[name].inputs || []).map(i => i.tag + (i.type ? ':' + i.type : '') + (i.id ? '#' + i.id : i.name ? '[' + i.name + ']' : '')).join(' | '));
    say('tabs: ' + (INV[name].tabs || []).map(t => t.text + (t.active ? '*' : '')).join(' | '));
    say('modals: ' + (INV[name].modals || []).map(m => m.id + (m.active ? '*' : '')).join(' | '));
    await shot('inv-' + name);
  }

  fs.writeFileSync(OUT + '\\inventory.json', JSON.stringify(INV, null, 2));
  say('=== INVENTORY DONE ===');
  ws.close(); process.exit(0);
})().catch(e => { say('FATAL: ' + e.message + '\n' + (e.stack || '')); process.exit(1); });
