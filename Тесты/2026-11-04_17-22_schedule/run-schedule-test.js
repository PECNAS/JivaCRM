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

const results = [];
function log(section, name, value) {
  results.push({ section, name, value });
  console.log(`[${section}] ${name}: ${JSON.stringify(value)}`);
}

(async () => {
  const tabs = JSON.parse(await httpGet('/json'));
  const tab = tabs.find(t => t.url.includes('127.0.0.1:8000'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push('console.' + m.params.type + ': ' + m.params.args.map(a => a.value || a.description || '').join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION: ' + ((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text));
    }
    if (m.method === 'Log.entryAdded') {
      const en = m.params.entry;
      if (en.level === 'error') logs.push('NET: ' + en.text + ' ' + (en.url || ''));
    }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  const send = (m, p = {}) => {
    const i = ++id;
    return new Promise(r => { pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');

  const shots = OUT + '\\screenshots\\';
  async function shot(name) {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(shots + name + '.png', Buffer.from(s.result.data, 'base64'));
  }
  async function ev(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) return { __err: r.result.exceptionDetails.text };
    return r.result.result.value;
  }
  async function nav(u, wait = 3000) {
    logs.length = 0;
    await send('Page.navigate', { url: 'http://127.0.0.1:8000' + u });
    await new Promise(r => setTimeout(r, wait));
  }
  async function login() {
    await nav('/login/', 1500);
    await ev(`(function(){const u=document.querySelector('input[name=username]'),p=document.querySelector('input[name=password]');if(u&&p){u.value='DHS';p.value='admin';document.querySelector('form').submit();return 'ok'}return 'nf'})()`);
    await new Promise(r => setTimeout(r, 3000));
    return await ev('location.pathname');
  }
  async function scrollSel(sel) {
    await ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)}); if(el) el.scrollIntoView({block:'center'}); return !!el})()`);
    await new Promise(r => setTimeout(r, 400));
  }

  // ---------- setup ----------
  let path = await ev('location.pathname');
  if (path !== '/schedule/') { path = await login(); log('SETUP', 'login', path); }

  // ---------- CALENDAR ----------
  await nav('/schedule/', 3500);
  await ev(`localStorage.setItem('jiva_schedule_view','calendar')`);
  await nav('/schedule/', 3500);

  log('CALENDAR', 'initial-view-active', await ev(`document.querySelector('.view-switch__btn.active').dataset.view`));
  log('CALENDAR', 'calendar-visible', await ev(`getComputedStyle(document.getElementById('dashboardCalendar')).display`));
  log('CALENDAR', 'list-visible', await ev(`getComputedStyle(document.getElementById('dashboardList')).display`));
  log('CALENDAR', 'title', await ev(`document.getElementById('calendarTitle').textContent`));
  log('CALENDAR', 'cells-count', await ev(`document.querySelectorAll('#calendarGrid .calendar-cell').length`));
  log('CALENDAR', 'days-current-month', await ev(`document.querySelectorAll('#calendarGrid .calendar-cell:not(.calendar-cell--empty)').length`));
  log('CALENDAR', 'today-highlighted', await ev(`document.querySelectorAll('#calendarGrid .calendar-cell--today').length`));
  log('CALENDAR', 'events-rendered', await ev(`document.querySelectorAll('#calendarGrid .calendar-event').length`));
  log('CALENDAR', 'weekday-headers', await ev(`[...document.querySelectorAll('#calendarGrid .calendar-header')].map(x=>x.textContent).join(',')`));
  log('CALENDAR', 'first-cell-date', await ev(`document.querySelector('#calendarGrid .calendar-cell').dataset.date`));
  await shot('01-calendar-nov');

  // month navigation
  await ev(`document.getElementById('calendarPrev').click()`);
  await new Promise(r => setTimeout(r, 600));
  log('CALENDAR', 'after-prev-title', await ev(`document.getElementById('calendarTitle').textContent`));
  log('CALENDAR', 'after-prev-events', await ev(`document.querySelectorAll('#calendarGrid .calendar-event').length`));
  await shot('02-calendar-oct');
  await ev(`document.getElementById('calendarNext').click()`);
  await new Promise(r => setTimeout(r, 400));
  await ev(`document.getElementById('calendarNext').click()`);
  await new Promise(r => setTimeout(r, 600));
  log('CALENDAR', 'after-next2-title', await ev(`document.getElementById('calendarTitle').textContent`));
  log('CALENDAR', 'after-next2-events', await ev(`document.querySelectorAll('#calendarGrid .calendar-event').length`));
  await shot('03-calendar-dec');
  // year boundary
  await ev(`(()=>{for(let i=0;i<13;i++)document.getElementById('calendarNext').click();return 1})()`);
  await new Promise(r => setTimeout(r, 800));
  log('CALENDAR', 'after-13-next-title', await ev(`document.getElementById('calendarTitle').textContent`));
  log('CALENDAR', 'after-13-next-errors', logs.slice());
  // back to current
  await ev(`(()=>{for(let i=0;i<15;i++)document.getElementById('calendarPrev').click();return 1})()`);
  await new Promise(r => setTimeout(r, 800));
  log('CALENDAR', 'back-to-current', await ev(`document.getElementById('calendarTitle').textContent`));

  // event click -> modal
  const clicked = await ev(`(()=>{const e=document.querySelector('#calendarGrid .calendar-event');if(!e)return 'noevent';e.click();return 'clicked'})()`);
  await new Promise(r => setTimeout(r, 1200));
  log('CALENDAR', 'event-clicked', clicked);
  log('CALENDAR', 'modal-open', await ev(`document.getElementById('eventModal').classList.contains('active')`));
  log('CALENDAR', 'modal-title', await ev(`document.getElementById('eventModalTitle').textContent`));
  log('CALENDAR', 'modal-rows', await ev(`[...document.querySelectorAll('#eventModalBody .event-modal__label')].map(x=>x.textContent).join('|')`));
  log('CALENDAR', 'details-btn-visible', await ev(`getComputedStyle(document.getElementById('eventModalDetailsBtn')).display`));
  await shot('04-event-modal');
  await ev(`document.getElementById('eventModalCloseBtn').click()`);
  await new Promise(r => setTimeout(r, 500));
  log('CALENDAR', 'modal-closed', await ev(`document.getElementById('eventModal').classList.contains('active')`));

  // context menu on empty cell
  const ctx = await ev(`(()=>{const cell=document.querySelector('#calendarGrid .calendar-cell:not(.calendar-cell--empty)');if(!cell)return 'nocell';const r=cell.getBoundingClientRect();cell.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+20,clientY:r.top+20}));return 'ctx'})()`);
  await new Promise(r => setTimeout(r, 600));
  log('CALENDAR', 'contextmenu', ctx);
  log('CALENDAR', 'contextmenu-visible', await ev(`document.getElementById('scheduleContextMenu').style.display`));
  log('CALENDAR', 'contextmenu-items', await ev(`[...document.querySelectorAll('#scheduleContextMenu .context-menu-item')].map(x=>x.textContent.trim()).join('|')`));
  await shot('05-contextmenu');
  await ev(`document.body.click()`);
  await new Promise(r => setTimeout(r, 400));
  log('CALENDAR', 'contextmenu-closed', await ev(`document.getElementById('scheduleContextMenu').style.display`));

  // context menu on event (order)
  const ctx2 = await ev(`(()=>{const e=document.querySelector('#calendarGrid .calendar-event');if(!e)return 'noevent';const r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+10,clientY:r.top+10}));return 'ctx2'})()`);
  await new Promise(r => setTimeout(r, 600));
  log('CALENDAR', 'contextmenu-on-event', ctx2);
  log('CALENDAR', 'contextmenu-on-event-visible', await ev(`document.getElementById('scheduleContextMenu').style.display`));
  await shot('06-contextmenu-event');
  await ev(`document.body.click()`);

  // filters inside calendar
  await ev(`document.getElementById('filterToggle').click()`);
  await new Promise(r => setTimeout(r, 500));
  log('CALENDAR', 'filters-panel-display-in-calendar', await ev(`getComputedStyle(document.getElementById('dashboardFilters')).display`));
  await shot('07-calendar-filters');
  // search in calendar
  await ev(`document.getElementById('filterToggle').click()`);
  await new Promise(r => setTimeout(r, 300));
  await ev(`(()=>{const i=document.getElementById('dashboardSearch');i.value='Тест';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 800));
  log('CALENDAR', 'search-events-result', await ev(`document.querySelectorAll('#calendarGrid .calendar-event').length`));
  log('CALENDAR', 'filter-count-badge', await ev(`document.getElementById('filterCount').textContent`));

  // ---------- LIST ----------
  await ev(`(()=>{const b=[...document.querySelectorAll('.view-switch__btn')].find(x=>x.dataset.view==='list');b.click()})()`);
  await new Promise(r => setTimeout(r, 900));
  log('LIST', 'list-visible', await ev(`getComputedStyle(document.getElementById('dashboardList')).display`));
  log('LIST', 'calendar-visible', await ev(`getComputedStyle(document.getElementById('dashboardCalendar')).display`));
  log('LIST', 'rows', await ev(`document.querySelectorAll('#dashboardList .order-row').length`));
  log('LIST', 'headers', await ev(`[...document.querySelectorAll('#dashboardList .order-list-header span')].map(x=>x.textContent).join('|')`));
  log('LIST', 'localStorage-view', await ev(`localStorage.getItem('jiva_schedule_view')`));
  log('LIST', 'filters-panel-display', await ev(`getComputedStyle(document.getElementById('dashboardFilters')).display`));
  await shot('08-list-search-active');

  // clear search
  await ev(`(()=>{const i=document.getElementById('dashboardSearch');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 800));
  log('LIST', 'rows-after-clear', await ev(`document.querySelectorAll('#dashboardList .order-row').length`));
  log('LIST', 'rows-order', await ev(`[...document.querySelectorAll('#dashboardList .order-row .order-row__name')].map(x=>x.textContent.trim()).join(' | ')`));
  await shot('09-list');

  // sort
  for (const v of ['date_asc', 'date_desc', 'name_asc', 'name_desc', 'client_asc']) {
    await ev(`(()=>{const s=document.getElementById('dashboardSort');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 600));
    log('LIST', 'sort-' + v, await ev(`[...document.querySelectorAll('#dashboardList .order-row')].map(r=>r.querySelector('.order-row__name').textContent.trim()).join(' | ')`));
  }
  await shot('10-list-sorted-name');
  // reset sort
  await ev(`(()=>{const s=document.getElementById('dashboardSort');s.value='date_asc';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 400));

  // status filter
  for (const v of ['all', 'request', 'confirmed', 'completed']) {
    await ev(`(()=>{const s=document.getElementById('dashboardStatus');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 500));
    log('LIST', 'status-' + v, await ev(`document.querySelectorAll('#dashboardList .order-row').length`));
  }
  await ev(`(()=>{const s=document.getElementById('dashboardStatus');s.value='all';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 400));

  // search case-insensitivity
  await ev(`(()=>{const i=document.getElementById('dashboardSearch');i.value='ТЕСТ';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 800));
  log('LIST', 'search-upper', await ev(`document.querySelectorAll('#dashboardList .order-row').length`));
  await ev(`(()=>{const i=document.getElementById('dashboardSearch');i.value='алексеевка';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 800));
  log('LIST', 'search-noresult', await ev(`document.getElementById('dashboardList').innerText.slice(0,120)`));
  await shot('11-list-empty');
  await ev(`(()=>{const i=document.getElementById('dashboardSearch');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 600));

  // past completed toggle
  await ev(`(()=>{const c=document.getElementById('pastCompletedToggle');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 700));
  log('LIST', 'past-completed-on', await ev(`document.getElementById('dashboardList').innerText.slice(0,160)`));
  log('LIST', 'past-localStorage', await ev(`localStorage.getItem('jiva_schedule_show_past')`));
  await shot('12-list-past-completed');
  await ev(`(()=>{const c=document.getElementById('pastCompletedToggle');c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await new Promise(r => setTimeout(r, 500));

  // row click -> modal
  const rc = await ev(`(()=>{const r=document.querySelector('#dashboardList .order-row');if(!r)return 'norow';r.click();return 'clicked'})()`);
  await new Promise(r => setTimeout(r, 1000));
  log('LIST', 'row-click', rc);
  log('LIST', 'modal-open', await ev(`document.getElementById('eventModal').classList.contains('active')`));
  await shot('13-list-modal');
  // Escape close
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await new Promise(r => setTimeout(r, 400));
  log('LIST', 'escape-closes-modal', await ev(`document.getElementById('eventModal').classList.contains('active')`));

  // view persistence across reload
  await nav('/schedule/', 3000);
  log('LIST', 'persisted-view-after-reload', await ev(`document.querySelector('.view-switch__btn.active').dataset.view`));
  log('LIST', 'list-visible-after-reload', await ev(`getComputedStyle(document.getElementById('dashboardList')).display`));
  await shot('14-list-after-reload');

  // console errors summary
  log('ERRORS', 'list-mode-console', logs.slice());

  // ---------- API data sanity ----------
  await nav('/schedule/', 3000);
  const api = await ev(`fetch('/orders/list/?status=all',{cache:'no-store'}).then(r=>r.json()).then(d=>JSON.stringify({count:(d.orders||[]).length, first:(d.orders||[])[0], colors:Object.keys(d.colors||{})}))`);
  log('DATA', 'orders-api', api);

  fs.writeFileSync(OUT + '\\results.json', JSON.stringify(results, null, 2));
  ws.close();
})().catch(e => { console.error('ERR', e.message, e.stack); process.exit(1); });
