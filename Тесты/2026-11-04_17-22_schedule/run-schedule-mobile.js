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
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  const send = (m, p = {}) => {
    const i = ++id;
    return new Promise(r => { pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  };
  await send('Page.enable');
  await send('Runtime.enable');
  const shots = OUT + '\\screenshots\\';
  async function shot(name) {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(shots + name + '.png', Buffer.from(s.result.data, 'base64'));
  }
  async function ev(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) return 'EXC:' + r.result.exceptionDetails.text;
    return r.result.result ? r.result.result.value : null;
  }
  async function nav(u, wait = 3000) {
    await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u });
    await new Promise(r => setTimeout(r, wait));
  }
  const out = {};
  function p(k, v) { out[k] = v; console.log(k + ': ' + JSON.stringify(v)); }

  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await nav('/schedule/', 3500);

  // --- Inline edit on date (double click) - read-only test, cancel with Escape
  await ev(`document.querySelector('#calendarGrid .calendar-event').click()`);
  await new Promise(r => setTimeout(r, 1000));
  const dbl = await ev(`(()=>{const n=document.querySelector('.event-modal__editable[data-edit-field=date]');if(!n)return 'nonode';n.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));return 'dbl'})()`);
  await new Promise(r => setTimeout(r, 700));
  p('dblclick-date-field', dbl);
  p('inline-input-exists', await ev(`!!document.querySelector('.event-modal__inline-input')`));
  p('inline-input-type', await ev(`(document.querySelector('.event-modal__inline-input')||{}).type`));
  p('inline-input-value', await ev(`(document.querySelector('.event-modal__inline-input')||{}).value`));
  await shot('30-inline-edit-date');
  await ev(`(()=>{const i=document.querySelector('.event-modal__inline-input');if(i)i.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))})()`);
  await new Promise(r => setTimeout(r, 700));
  p('inline-after-escape-modal-open', await ev(`document.getElementById('eventModal').classList.contains('active')`));
  await shot('31-after-inline-escape');
  // close whatever is open
  await ev(`document.getElementById('eventModalCloseBtn').click()`);
  await new Promise(r => setTimeout(r, 400));
  p('modal-close-after-inline', await ev(`document.getElementById('eventModal').classList.contains('active')`));

  // --- Check that modal close restores body overflow
  p('body-overflow-after-close', await ev(`document.body.style.overflow`));

  // --- Autorefresh test: check interval registered (30s). Verify silentRefresh exists
  p('refreshSchedule-exposed', await ev(`typeof window.refreshSchedule`));

  // --- Empty state: filter by nonexistent
  await ev(`document.getElementById('filterToggle').click()`);
  await new Promise(r => setTimeout(r, 500));
  await ev(`(()=>{const i=document.getElementById('dashboardSearch');i.value='абвгд';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 900));
  p('calendar-empty-search-visible-text', await ev(`document.getElementById('dashboardCalendar').innerText.includes('Не найдено')||document.getElementById('dashboardCalendar').innerText.includes('ничего')`));
  await shot('32-calendar-search-none');
  await ev(`(()=>{const i=document.getElementById('dashboardSearch');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 700));

  // --- MOBILE CALENDAR ---
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav('/schedule/', 4000);
  p('m-calendar-title', await ev(`document.getElementById('calendarTitle').textContent`));
  p('m-grid-width', await ev(`JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,grid:document.getElementById('calendarGrid').getBoundingClientRect().width, cell:document.querySelector('.calendar-cell').getBoundingClientRect().width})`));
  p('m-cell-font', await ev(`getComputedStyle(document.querySelector('.calendar-cell__date')).fontSize`));
  p('m-event-count', await ev(`document.querySelectorAll('.calendar-event').length`));
  p('m-event-height', await ev(`(document.querySelector('.calendar-event')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height`));
  await shot('33-mobile-calendar');

  // mobile: tap event
  await ev(`(()=>{const e=document.querySelector('.calendar-event');if(e)e.click()})()`);
  await new Promise(r => setTimeout(r, 1000));
  p('m-event-modal-open', await ev(`document.getElementById('eventModal').classList.contains('active')`));
  await shot('34-mobile-event-modal');
  await ev(`document.getElementById('eventModalCloseBtn').click()`);
  await new Promise(r => setTimeout(r, 400));

  // mobile: context menu via touch (long press simulated via contextmenu)
  await ev(`(()=>{const cell=document.querySelectorAll('.calendar-cell')[20];const r=cell.getBoundingClientRect();cell.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+20,clientY:r.top+20}));})()`);
  await new Promise(r => setTimeout(r, 700));
  p('m-ctx-visible', await ev(`document.getElementById('scheduleContextMenu').style.display`));
  await shot('35-mobile-ctx');
  await ev(`document.body.click()`);

  // mobile: switch to list
  await ev(`(()=>{const b=[...document.querySelectorAll('.view-switch__btn')].find(x=>x.dataset.view==='list');b.click()})()`);
  await new Promise(r => setTimeout(r, 1200));
  p('m-list-rows', await ev(`document.querySelectorAll('#dashboardList .order-row').length`));
  p('m-list-header-visible', await ev(`(()=>{const h=document.querySelector('#dashboardList .order-list-header');return h?getComputedStyle(h).display:'none'})()`));
  p('m-list-row-text', await ev(`(document.querySelector('#dashboardList .order-row')||{innerText:''}).innerText.replace(/\\n+/g,' / ')`));
  await shot('36-mobile-list');

  await ev(`localStorage.setItem('jiva_schedule_view','calendar')`);
  fs.writeFileSync(OUT + '\\results3.json', JSON.stringify(out, null, 2));
  ws.close();
})().catch(e => { console.error('ERR', e.message, e.stack); process.exit(1); });
