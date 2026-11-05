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
    return r.result.result ? r.result.result.value : null;
  }
  async function nav(u, wait = 3000) {
    await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u });
    await new Promise(r => setTimeout(r, wait));
  }
  const out = {};
  function p(k, v) { out[k] = v; console.log(k + ': ' + JSON.stringify(v)); }

  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await ev(`localStorage.setItem('jiva_schedule_view','calendar'); localStorage.removeItem('jiva_schedule_show_past'); localStorage.setItem('jiva_schedule_my_orders','0')`);
  await nav('/schedule/', 4000);

  // BUG: cell dates with negative day
  p('cell-dates-first-3', await ev(`[...document.querySelectorAll('#calendarGrid .calendar-cell')].slice(0,3).map(c=>c.dataset.date).join(',')`));
  p('cell-dates-last-3', await ev(`[...document.querySelectorAll('#calendarGrid .calendar-cell')].slice(-3).map(c=>c.dataset.date).join(',')`));
  p('empty-cells-day-labels', await ev(`[...document.querySelectorAll('#calendarGrid .calendar-cell--empty')].map(c=>c.dataset.date).join(' | ')`));
  await shot('20-calendar-current');

  // RESET approach: reload page resets calendarDate to today
  await nav('/schedule/', 3500);
  p('events-after-fresh-load', await ev(`document.querySelectorAll('#calendarGrid .calendar-event').length`));
  p('event-texts', await ev(`[...document.querySelectorAll('#calendarGrid .calendar-event')].map(e=>e.innerText.replace(/\\n/g,' / ')).join(' || ')`));

  // Click event -> modal
  const clicked = await ev(`(()=>{const e=document.querySelector('#calendarGrid .calendar-event');if(!e){return 'noevent'}e.click();return 'clicked'})()`);
  await new Promise(r => setTimeout(r, 1200));
  p('event-click', clicked);
  p('event-modal-open', await ev(`document.getElementById('eventModal').classList.contains('active')`));
  p('event-modal-rows', await ev(`[...document.querySelectorAll('#eventModalBody .event-modal__label')].map(x=>x.textContent).join('|')`));
  p('event-modal-body-text', await ev(`document.getElementById('eventModalBody').innerText.replace(/\\n+/g,' | ')`));
  await shot('21-event-modal');

  // Escape key close test (dispatch with keydown on document)
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',keyCode:27,which:27,bubbles:true}))`);
  await new Promise(r => setTimeout(r, 700));
  p('modal-after-escape', await ev(`document.getElementById('eventModal').classList.contains('active')`));
  await shot('22-after-escape');
  // close via btn
  await ev(`document.getElementById('eventModalCloseBtn').click()`);
  await new Promise(r => setTimeout(r, 500));
  p('modal-after-closebtn', await ev(`document.getElementById('eventModal').classList.contains('active')`));
  p('modal-overlay-display', await ev(`getComputedStyle(document.getElementById('eventModal')).display`));

  // Context menu on event
  await nav('/schedule/', 3500);
  const ctxev = await ev(`(()=>{const e=document.querySelector('#calendarGrid .calendar-event');if(!e)return 'noevent';const r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+10,clientY:r.top+10}));return 'ctx'})()`);
  await new Promise(r => setTimeout(r, 800));
  p('ctx-on-event', ctxev);
  p('ctx-visible', await ev(`document.getElementById('scheduleContextMenu').style.display`));
  await shot('23-ctx-on-event');

  // right-click on empty cell -> context menu, pick Создать заказ
  await nav('/schedule/', 3500);
  await ev(`(()=>{const cell=document.querySelectorAll('#calendarGrid .calendar-cell')[20];const r=cell.getBoundingClientRect();cell.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+20,clientY:r.top+30}));return cell.dataset.date})()`);
  await new Promise(r => setTimeout(r, 700));
  p('ctx-empty-visible', await ev(`document.getElementById('scheduleContextMenu').style.display`));
  const itemClick = await ev(`(()=>{const it=[...document.querySelectorAll('#scheduleContextMenu .context-menu-item')].find(x=>x.dataset.action==='create-availability');if(!it)return 'nofound';it.click();return 'clicked'})()`);
  await new Promise(r => setTimeout(r, 2000));
  p('availability-modal-after-item', itemClick);
  p('availability-modal-open', await ev(`document.getElementById('availabilityModal').classList.contains('active')`));
  p('availability-date-value', await ev(`document.getElementById('availabilityDate').value`));
  p('availability-employees', await ev(`document.getElementById('availabilityEmployee').options.length`));
  await shot('24-availability-modal');
  await ev(`document.getElementById('availabilityCancelBtn').click()`);
  await new Promise(r => setTimeout(r, 400));

  // Filters in calendar mode
  await nav('/schedule/', 3500);
  await ev(`document.getElementById('filterToggle').click()`);
  await new Promise(r => setTimeout(r, 600));
  p('filters-display-calendar', await ev(`getComputedStyle(document.getElementById('dashboardFilters')).display`));
  p('filters-class', await ev(`document.getElementById('dashboardFilters').className`));
  await shot('25-calendar-filters-open');

  // search in calendar
  await ev(`(()=>{const i=document.getElementById('dashboardSearch');i.value='Тест';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 900));
  p('calendar-search-events', await ev(`document.querySelectorAll('#calendarGrid .calendar-event').length`));
  await ev(`(()=>{const i=document.getElementById('dashboardSearch');i.value='ZZZZ';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 900));
  p('calendar-search-empty-events', await ev(`document.querySelectorAll('#calendarGrid .calendar-event').length`));
  p('calendar-empty-state-text', await ev(`document.getElementById('dashboardCalendar').innerText.replace(/\\n+/g,' ').slice(0,100)`));
  await shot('26-calendar-no-results');
  await ev(`(()=>{const i=document.getElementById('dashboardSearch');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 700));

  // status filter effect on calendar
  await ev(`(()=>{const s=document.getElementById('dashboardStatus');s.value='completed';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 700));
  p('calendar-status-completed-events', await ev(`document.querySelectorAll('#calendarGrid .calendar-event').length`));
  await ev(`(()=>{const s=document.getElementById('dashboardStatus');s.value='all';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);

  // LIST mode from calendar switch
  await ev(`(()=>{const b=[...document.querySelectorAll('.view-switch__btn')].find(x=>x.dataset.view==='list');b.click()})()`);
  await new Promise(r => setTimeout(r, 1000));
  p('list-rows', await ev(`document.querySelectorAll('#dashboardList .order-row').length`));
  p('list-filters-display', await ev(`getComputedStyle(document.getElementById('dashboardFilters')).display`));
  p('list-filters-class', await ev(`document.getElementById('dashboardFilters').className`));
  await shot('27-list-filters-collapsed');

  // Sort by date with all orders
  p('list-row-names-order', await ev(`[...document.querySelectorAll('#dashboardList .order-row')].map(r=>r.querySelector('.order-row__name').textContent.trim()+'/'+r.querySelector('.order-row__date').textContent.trim()).join(' | ')`));

  // Row click modal
  await ev(`document.querySelector('#dashboardList .order-row').click()`);
  await new Promise(r => setTimeout(r, 1000));
  p('list-modal-open', await ev(`document.getElementById('eventModal').classList.contains('active')`));
  p('list-modal-title', await ev(`document.getElementById('eventModalTitle').textContent`));
  await shot('28-list-modal');
  await ev(`document.getElementById('eventModalCloseBtn').click()`);
  await new Promise(r => setTimeout(r, 400));

  // past completed
  await ev(`(()=>{const c=document.getElementById('pastCompletedToggle');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 900));
  p('past-note', await ev(`(document.querySelector('.order-list-note')||{}).textContent`));
  p('past-rows', await ev(`document.querySelectorAll('#dashboardList .order-row').length`));
  p('past-header-visible', await ev(`!!document.querySelector('#dashboardList .order-list-header')`));
  await shot('29-list-past-completed');
  await ev(`(()=>{const c=document.getElementById('pastCompletedToggle');c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 600));

  // Toggle back to calendar and check date persistence
  await ev(`(()=>{const b=[...document.querySelectorAll('.view-switch__btn')].find(x=>x.dataset.view==='calendar');b.click()})()`);
  await new Promise(r => setTimeout(r, 900));
  p('back-to-calendar-title', await ev(`document.getElementById('calendarTitle').textContent`));

  // check that calendar month state is lost after reload (reset)
  nav('/schedule/', 3000).then(async () => {
    p('after-reload-title', await ev(`document.getElementById('calendarTitle').textContent`));
    fs.writeFileSync(OUT + '\\results2.json', JSON.stringify(out, null, 2));
    ws.close();
  });

})().catch(e => { console.error('ERR', e.message, e.stack); process.exit(1); });
