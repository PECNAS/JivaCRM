(function() {
  const employees = [
    { id: 1, name: 'Арина Аршинова' },
    { id: 2, name: 'Игорь Петров' },
    { id: 3, name: 'Елена Васильева' },
    { id: 4, name: 'Мария Ковалёва' }
  ];

  const clients = [
    { id: 1, name: 'Иван Петров' },
    { id: 2, name: 'Елена Смирнова' },
    { id: 3, name: 'Алексей Козлов' },
    { id: 4, name: 'Ольга Новикова' },
    { id: 5, name: 'Дмитрий Морозов' }
  ];

  let ordersData = [
    {
      id: 1,
      address: 'г. Москва, ул. Тверская, д. 12',
      date: '2026-08-25',
      clientId: 1,
      cost: '150 000 ₽',
      status: 'confirmed',
      managerId: 1,
      duration: 1
    },
    {
      id: 2,
      address: 'г. Санкт-Петербург, Невский пр., д. 45',
      date: '2026-08-18',
      clientId: 2,
      cost: '85 000 ₽',
      status: 'in_progress',
      managerId: 3,
      duration: 2
    },
    {
      id: 3,
      address: 'г. Казань, ул. Баумана, д. 8',
      date: '2026-09-22',
      clientId: 3,
      cost: '220 000 ₽',
      status: 'request',
      managerId: 2,
      duration: 3
    },
    {
      id: 4,
      address: 'г. Екатеринбург, ул. Ленина, д. 56',
      date: '2026-07-20',
      clientId: 4,
      cost: '45 000 ₽',
      status: 'completed',
      managerId: 4,
      duration: 1
    },
    {
      id: 5,
      address: 'г. Новосибирск, пр. Красный, д. 23',
      date: '2026-12-05',
      clientId: 5,
      cost: '310 000 ₽',
      status: 'confirmed',
      managerId: 1,
      duration: 2
    },
    {
      id: 6,
      address: 'г. Сочи, ул. Курортная, д. 10',
      date: '2026-08-15',
      clientId: 2,
      cost: '120 000 ₽',
      status: 'in_progress',
      managerId: 2,
      duration: 4
    },
    {
      id: 7,
      address: 'г. Краснодар, ул. Красная, д. 5',
      date: '2026-08-20',
      clientId: 1,
      cost: '95 000 ₽',
      status: 'request',
      managerId: 3,
      duration: 1
    }
  ];

  let currentDate = new Date(2026, 7, 1);
  let currentView = 'month';
  let activeStatuses = ['all'];
  let searchQuery = '';

  const scheduleGrid = document.getElementById('scheduleGrid');
  const scheduleTitle = document.getElementById('scheduleTitle');
  const prevBtn = document.getElementById('prevPeriod');
  const nextBtn = document.getElementById('nextPeriod');
  const searchInput = document.getElementById('scheduleSearch');
  const modal = document.getElementById('orderModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const viewOrderBtn = document.getElementById('viewOrderBtn');

  function getClientName(id) {
    const c = clients.find(c => c.id === id);
    return c ? c.name : '—';
  }

  function getEmployeeName(id) {
    const e = employees.find(e => e.id === id);
    return e ? e.name : '—';
  }

  function getStatusLabel(status) {
    const labels = {
      request: 'Запрос',
      confirmed: 'Подтверждено',
      in_progress: 'В работе',
      completed: 'Выполнено',
      paid: 'Оплачено'
    };
    return labels[status] || status;
  }

  function getStatusColor(status) {
    const colors = {
      request: '#e65100',
      confirmed: '#1565c0',
      in_progress: '#2e7d32',
      completed: '#4a148c',
      paid: '#bf360c'
    };
    return colors[status] || '#7a7267';
  }

  function getOrdersForDate(date, statuses, search) {
    const dateStr = date.toISOString().split('T')[0];
    return ordersData.filter(order => {
      const orderDate = new Date(order.date);
      const orderDateStr = order.date;
      const matchDate = orderDateStr === dateStr;
      const matchStatus = statuses.includes('all') || statuses.includes(order.status);
      const matchSearch = 
        search === '' || 
        getClientName(order.clientId).toLowerCase().includes(search.toLowerCase()) ||
        order.address.toLowerCase().includes(search.toLowerCase());
      return matchDate && matchStatus && matchSearch;
    });
  }

  function getOrdersSpanningDate(date, statuses, search) {
    const dateStr = date.toISOString().split('T')[0];
    return ordersData.filter(order => {
      const start = new Date(order.date);
      const end = new Date(order.date);
      end.setDate(end.getDate() + (order.duration || 1) - 1);
      const current = new Date(dateStr);
      const matchSpan = current >= start && current <= end;
      const matchStatus = statuses.includes('all') || statuses.includes(order.status);
      const matchSearch = 
        search === '' || 
        getClientName(order.clientId).toLowerCase().includes(search.toLowerCase()) ||
        order.address.toLowerCase().includes(search.toLowerCase());
      return matchSpan && matchStatus && matchSearch;
    });
  }

  function renderMonth(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const today = new Date();

    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    scheduleTitle.textContent = `${monthNames[month]} ${year}`;

    let gridHTML = '';
    const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    weekdays.forEach(day => {
      gridHTML += `<div class="schedule-grid__header">${day}</div>`;
    });

    const startOffset = startDay === 0 ? 6 : startDay - 1;
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const dayNumber = i - startOffset + 1;
      const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
      const dateObj = new Date(year, month, dayNumber);
      const dateStr = dateObj.toISOString().split('T')[0];
      const isToday = dateStr === today.toISOString().split('T')[0];

      let cellClass = 'schedule-grid__cell';
      if (!isCurrentMonth) cellClass += ' schedule-grid__cell--empty';
      if (isToday) cellClass += ' schedule-grid__cell--today';

      let ordersHTML = '';
      if (isCurrentMonth) {
        const orders = getOrdersSpanningDate(dateObj, activeStatuses, searchQuery);
        orders.forEach(order => {
          const startDate = new Date(order.date);
          const isStart = startDate.toISOString().split('T')[0] === dateStr;
          const statusClass = `order-block--${order.status}`;
          ordersHTML += `
            <div class="order-block ${statusClass}" data-order-id="${order.id}" style="${!isStart ? 'border-left-color: transparent;' : ''}">
              <div class="order-block__id">#${order.id}</div>
              <div class="order-block__client">${getClientName(order.clientId)}</div>
              <div class="order-block__address">${order.address}</div>
              <div class="order-block__bottom">
                <span class="order-block__cost">${order.cost}</span>
                <span class="order-block__status">${getStatusLabel(order.status)}</span>
              </div>
              <div class="order-block__manager">${getEmployeeName(order.managerId)}</div>
            </div>
          `;
        });
      }

      const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      const weekday = (i % 7);
      
      gridHTML += `
        <div class="${cellClass}">
          <div class="cell-date">
            <span class="cell-date__day">${isCurrentMonth ? dayNumber : ''}</span>
            <span class="cell-date__weekday">${isCurrentMonth ? weekdayNames[weekday] : ''}</span>
          </div>
          ${ordersHTML}
        </div>
      `;
    }

    scheduleGrid.innerHTML = gridHTML;

    document.querySelectorAll('.order-block').forEach(block => {
      block.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.getAttribute('data-order-id'));
        openOrderModal(id);
      });
    });
  }

  function renderWeek(year, month, day) {
    const start = new Date(year, month, day);
    start.setDate(start.getDate() - start.getDay() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    scheduleTitle.textContent = `${start.getDate()} – ${end.getDate()} ${monthNames[month]} ${year}`;

    let gridHTML = '';
    const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    weekdays.forEach(dayName => {
      gridHTML += `<div class="schedule-grid__header">${dayName}</div>`;
    });

    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const dateObj = new Date(start);
      dateObj.setDate(dateObj.getDate() + i);
      const dateStr = dateObj.toISOString().split('T')[0];
      const isToday = dateStr === today.toISOString().split('T')[0];

      let cellClass = 'schedule-grid__cell';
      if (isToday) cellClass += ' schedule-grid__cell--today';

      const orders = getOrdersSpanningDate(dateObj, activeStatuses, searchQuery);
      let ordersHTML = '';
      orders.forEach(order => {
        const startDate = new Date(order.date);
        const isStart = startDate.toISOString().split('T')[0] === dateStr;
        const statusClass = `order-block--${order.status}`;
        ordersHTML += `
          <div class="order-block ${statusClass}" data-order-id="${order.id}" style="${!isStart ? 'border-left-color: transparent;' : ''}">
            <div class="order-block__id">#${order.id}</div>
            <div class="order-block__client">${getClientName(order.clientId)}</div>
            <div class="order-block__address">${order.address}</div>
            <div class="order-block__bottom">
              <span class="order-block__cost">${order.cost}</span>
              <span class="order-block__status">${getStatusLabel(order.status)}</span>
            </div>
            <div class="order-block__manager">${getEmployeeName(order.managerId)}</div>
          </div>
        `;
      });

      const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      gridHTML += `
        <div class="${cellClass}">
          <div class="cell-date">
            <span class="cell-date__day">${dateObj.getDate()}</span>
            <span class="cell-date__weekday">${weekdayNames[i]}</span>
          </div>
          ${ordersHTML}
        </div>
      `;
    }

    scheduleGrid.innerHTML = gridHTML;

    document.querySelectorAll('.order-block').forEach(block => {
      block.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.getAttribute('data-order-id'));
        openOrderModal(id);
      });
    });
  }

  function renderDay(year, month, day) {
    const dateObj = new Date(year, month, day);
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const weekdayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    scheduleTitle.textContent = `${dateObj.getDate()} ${monthNames[month]} ${year}, ${weekdayNames[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1]}`;

    let gridHTML = '';
    const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    weekdays.forEach(dayName => {
      gridHTML += `<div class="schedule-grid__header">${dayName}</div>`;
    });

    const today = new Date();
    const isToday = dateObj.toISOString().split('T')[0] === today.toISOString().split('T')[0];

    let cellClass = 'schedule-grid__cell';
    if (isToday) cellClass += ' schedule-grid__cell--today';

    const orders = getOrdersSpanningDate(dateObj, activeStatuses, searchQuery);
    let ordersHTML = '';
    orders.forEach(order => {
      const startDate = new Date(order.date);
      const isStart = startDate.toISOString().split('T')[0] === dateObj.toISOString().split('T')[0];
      const statusClass = `order-block--${order.status}`;
      ordersHTML += `
        <div class="order-block ${statusClass}" data-order-id="${order.id}" style="${!isStart ? 'border-left-color: transparent;' : ''}">
          <div class="order-block__id">#${order.id}</div>
          <div class="order-block__client">${getClientName(order.clientId)}</div>
          <div class="order-block__address">${order.address}</div>
          <div class="order-block__bottom">
            <span class="order-block__cost">${order.cost}</span>
            <span class="order-block__status">${getStatusLabel(order.status)}</span>
          </div>
          <div class="order-block__manager">${getEmployeeName(order.managerId)}</div>
        </div>
      `;
    });

    const weekdayIndex = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;
    for (let i = 0; i < 7; i++) {
      const isActive = i === weekdayIndex;
      gridHTML += `
        <div class="${cellClass}" style="${!isActive ? 'opacity: 0.3;' : ''}">
          <div class="cell-date">
            <span class="cell-date__day">${isActive ? dateObj.getDate() : ''}</span>
            <span class="cell-date__weekday">${isActive ? weekdays[i] : ''}</span>
          </div>
          ${isActive ? ordersHTML : ''}
        </div>
      `;
    }

    scheduleGrid.innerHTML = gridHTML;

    document.querySelectorAll('.order-block').forEach(block => {
      block.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.getAttribute('data-order-id'));
        openOrderModal(id);
      });
    });
  }

  function renderSchedule() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const day = currentDate.getDate();

    if (currentView === 'month') {
      renderMonth(year, month);
    } else if (currentView === 'week') {
      renderWeek(year, month, day);
    } else if (currentView === 'day') {
      renderDay(year, month, day);
    }
  }

  function navigate(direction) {
    if (currentView === 'month') {
      currentDate.setMonth(currentDate.getMonth() + direction);
    } else if (currentView === 'week') {
      currentDate.setDate(currentDate.getDate() + direction * 7);
    } else if (currentView === 'day') {
      currentDate.setDate(currentDate.getDate() + direction);
    }
    renderSchedule();
  }

  function goToToday() {
    currentDate = new Date();
    currentView = 'month';
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === 'month');
    });
    renderSchedule();
  }

  function openOrderModal(orderId) {
    const order = ordersData.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('modalOrderTitle').textContent = `Заказ #${order.id}`;
    document.getElementById('viewAddress').textContent = order.address || '—';
    document.getElementById('viewDate').textContent = order.date || '—';
    document.getElementById('viewClient').textContent = getClientName(order.clientId);
    document.getElementById('viewCost').textContent = order.cost || '—';
    document.getElementById('viewStatus').textContent = getStatusLabel(order.status);
    document.getElementById('viewManager').textContent = getEmployeeName(order.managerId);

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    viewOrderBtn.onclick = function() {
      showToast('Переход к заказу #' + order.id);
    };
  }

  function closeOrderModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, 2000);
  }

  prevBtn.addEventListener('click', () => navigate(-1));
  nextBtn.addEventListener('click', () => navigate(1));

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentView = this.dataset.view;
      if (currentView === 'today') {
        goToToday();
      } else {
        renderSchedule();
      }
    });
  });

  document.querySelectorAll('.status-filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const status = this.dataset.status;
      if (status === 'all') {
        activeStatuses = ['all'];
        document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
      } else {
        if (activeStatuses.includes('all')) {
          activeStatuses = [];
        }
        const index = activeStatuses.indexOf(status);
        if (index > -1) {
          activeStatuses.splice(index, 1);
          this.classList.remove('active');
        } else {
          activeStatuses.push(status);
          this.classList.add('active');
        }
        if (activeStatuses.length === 0) {
          activeStatuses = ['all'];
          document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
          document.querySelector('[data-status="all"]').classList.add('active');
        }
      }
      renderSchedule();
    });
  });

  searchInput.addEventListener('input', function() {
    searchQuery = this.value;
    renderSchedule();
  });

  modalCloseBtn.addEventListener('click', closeOrderModal);
  closeModalBtn.addEventListener('click', closeOrderModal);

  modal.addEventListener('click', function(e) {
    if (e.target === this) {
      closeOrderModal();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeOrderModal();
    }
  });

  renderSchedule();
})();