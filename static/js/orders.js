(function() {
  const employees = [
    { id: 1, name: 'Арина Аршинова' },
    { id: 2, name: 'Игорь Петров' },
    { id: 3, name: 'Елена Васильева' },
    { id: 4, name: 'Мария Ковалёва' }
  ];

  const clients = [
    { id: 1, name: 'Иван Петров (ООО «Горизонт»)' },
    { id: 2, name: 'Елена Смирнова (Агентство «Событие»)' },
    { id: 3, name: 'Алексей Козлов (Корпорация «Вектор»)' },
    { id: 4, name: 'Ольга Новикова (ИП Новикова О.А.)' },
    { id: 5, name: 'Дмитрий Морозов (ООО «Форум»)' }
  ];

  let ordersData = [
    {
      id: 1,
      address: 'г. Москва, ул. Тверская, д. 12',
      date: '2026-08-25',
      clientId: 1,
      cost: '150 000 ₽',
      status: 'confirmed',
      setupTime: '18:00',
      dressingRoom: 'Комната 5',
      meal: 'yes',
      concept: 'Космическое шоу с элементами театра',
      task: 'Открытие мероприятия',
      tech: { lamps: true, lasers: true, hazer: false, grid: true },
      projection: 'yes',
      venueFeatures: 'Сцена с поворотным кругом',
      propsFeatures: 'Космический реквизит',
      adaptation: 'Костюмы адаптированы под рост артистов',
      paymentMethod: 'ip',
      managerId: 1,
      storyManagerId: 2
    },
    {
      id: 2,
      address: 'г. Санкт-Петербург, Невский пр., д. 45',
      date: '2026-08-18',
      clientId: 2,
      cost: '85 000 ₽',
      status: 'in_progress',
      setupTime: '14:30',
      dressingRoom: 'Комната 2',
      meal: 'no',
      concept: 'Стихия огня и воды',
      task: 'Гала-ужин',
      tech: { lamps: false, lasers: true, hazer: true, grid: false },
      projection: 'no',
      venueFeatures: 'Открытая площадка',
      propsFeatures: 'Водные эффекты',
      adaptation: 'Грим под стихии',
      paymentMethod: 'self',
      managerId: 3,
      storyManagerId: 1
    },
    {
      id: 3,
      address: 'г. Казань, ул. Баумана, д. 8',
      date: '2026-09-22',
      clientId: 3,
      cost: '220 000 ₽',
      status: 'request',
      setupTime: '16:00',
      dressingRoom: 'Комната 7',
      meal: 'yes',
      concept: 'Интерактивное шоу для деловой аудитории',
      task: 'MICE Excellence',
      tech: { lamps: true, lasers: true, hazer: true, grid: true },
      projection: 'yes',
      venueFeatures: 'Конференц-зал',
      propsFeatures: 'Брендированный реквизит',
      adaptation: 'Адаптация под корпоративный стиль',
      paymentMethod: 'cash',
      managerId: 2,
      storyManagerId: 4
    },
    {
      id: 4,
      address: 'г. Екатеринбург, ул. Ленина, д. 56',
      date: '2026-07-20',
      clientId: 4,
      cost: '45 000 ₽',
      status: 'completed',
      setupTime: '17:30',
      dressingRoom: 'Комната 3',
      meal: 'no',
      concept: 'Романтическая атмосфера',
      task: 'Свадебное торжество',
      tech: { lamps: true, lasers: false, hazer: false, grid: false },
      projection: 'no',
      venueFeatures: 'Ресторан',
      propsFeatures: 'Цветочный реквизит',
      adaptation: 'Свадебный образ',
      paymentMethod: 'cash',
      managerId: 4,
      storyManagerId: null
    },
    {
      id: 5,
      address: 'г. Новосибирск, пр. Красный, д. 23',
      date: '2026-12-05',
      clientId: 5,
      cost: '310 000 ₽',
      status: 'confirmed',
      setupTime: '19:00',
      dressingRoom: 'Комната 1',
      meal: 'yes',
      concept: 'Музыкальное телевизионное шоу',
      task: 'Песня года',
      tech: { lamps: true, lasers: true, hazer: true, grid: true },
      projection: 'yes',
      venueFeatures: 'Телевизионная студия',
      propsFeatures: 'Музыкальные инструменты',
      adaptation: 'Сценические костюмы',
      paymentMethod: 'ip',
      managerId: 1,
      storyManagerId: 3
    }
  ];

  let nextId = 6;
  let currentOrderId = null;
  let isEditMode = false;

  const tableBody = document.getElementById('ordersTableBody');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const modal = document.getElementById('orderModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const addOrderBtn = document.getElementById('addOrderBtn');
  const addModal = document.getElementById('addOrderModal');
  const addModalCloseBtn = document.getElementById('addModalCloseBtn');
  const addModalCancelBtn = document.getElementById('addModalCancelBtn');
  const addForm = document.getElementById('addOrderForm');
  const editForm = document.getElementById('editOrderForm');
  const editCancelBtn = document.getElementById('editCancelBtn');
  const editOrderBtn = document.getElementById('editOrderBtn');
  const viewInScheduleBtn = document.getElementById('viewInScheduleBtn');

  function getClientName(clientId) {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : '—';
  }

  function getEmployeeName(empId) {
    const emp = employees.find(e => e.id === empId);
    return emp ? emp.name : '—';
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

  function renderOrders(filteredData) {
    const data = filteredData || ordersData;
    if (data.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 2rem; color: #7a7267;">
            Заказы не найдены
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = data.map(order => {
      const statusClass = `status-badge--${order.status}`;
      return `
        <tr data-order-id="${order.id}">
          <td>${order.address}</td>
          <td>${order.date}</td>
          <td>${getClientName(order.clientId)}</td>
          <td><span class="status-badge ${statusClass}">${getStatusLabel(order.status)}</span></td>
          <td>${order.cost || '—'}</td>
          <td><button class="view-link" data-id="${order.id}">Подробнее</button></td>
        </tr>
      `;
    }).join('');

    tableBody.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.getAttribute('data-id'));
        openOrderModal(id);
      });
    });

    tableBody.querySelectorAll('tr[data-order-id]').forEach(row => {
      row.addEventListener('click', function() {
        const id = parseInt(this.getAttribute('data-order-id'));
        openOrderModal(id);
      });
    });
  }

  function filterOrders() {
    const search = searchInput.value.toLowerCase().trim();
    const status = statusFilter.value;

    const filtered = ordersData.filter(order => {
      const matchSearch = 
        order.address.toLowerCase().includes(search) ||
        getClientName(order.clientId).toLowerCase().includes(search) ||
        getEmployeeName(order.managerId).toLowerCase().includes(search);
      
      const matchStatus = status === 'all' || order.status === status;
      
      return matchSearch && matchStatus;
    });

    renderOrders(filtered);
  }

  function populateSelects() {
    const selectors = ['editClient', 'addClient', 'editManager', 'addManager', 'editStoryManager', 'addStoryManager'];
    selectors.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      
      if (id.includes('Client')) {
        select.innerHTML = clients.map(c => 
          `<option value="${c.id}">${c.name}</option>`
        ).join('');
      } else if (id.includes('Manager') || id.includes('StoryManager')) {
        const options = id.includes('StoryManager') 
          ? [['', 'Не назначен'], ...employees.map(e => [e.id, e.name])]
          : employees.map(e => [e.id, e.name]);
        select.innerHTML = options.map(([val, label]) => 
          `<option value="${val}">${label}</option>`
        ).join('');
      }
    });
  }

  function openOrderModal(orderId) {
    const order = ordersData.find(o => o.id === orderId);
    if (!order) return;

    currentOrderId = orderId;
    isEditMode = false;
    document.getElementById('modalOrderTitle').textContent = `Заказ #${order.id}`;
    
    document.getElementById('viewAddress').textContent = order.address || '—';
    document.getElementById('viewDate').textContent = order.date || '—';
    document.getElementById('viewClient').innerHTML = `<a href="#" data-client-id="${order.clientId}">${getClientName(order.clientId)}</a>`;
    document.getElementById('viewCost').textContent = order.cost || '—';
    document.getElementById('viewStatus').textContent = getStatusLabel(order.status);
    document.getElementById('viewSetupTime').textContent = order.setupTime || '—';
    document.getElementById('viewDressingRoom').textContent = order.dressingRoom || '—';
    document.getElementById('viewMeal').textContent = order.meal === 'yes' ? 'Есть' : order.meal === 'no' ? 'Нет' : '—';
    document.getElementById('viewConcept').textContent = order.concept || '—';
    document.getElementById('viewTask').textContent = order.task || '—';
    
    const techItems = [];
    if (order.tech?.lamps) techItems.push('Лампы');
    if (order.tech?.lasers) techItems.push('Лазеры');
    if (order.tech?.hazer) techItems.push('Хейзер');
    if (order.tech?.grid) techItems.push('Сетка');
    document.getElementById('viewTech').textContent = techItems.length ? techItems.join(', ') : '—';
    
    document.getElementById('viewProjection').textContent = order.projection === 'yes' ? 'Есть' : order.projection === 'no' ? 'Нет' : '—';
    document.getElementById('viewVenueFeatures').textContent = order.venueFeatures || '—';
    document.getElementById('viewPropsFeatures').textContent = order.propsFeatures || '—';
    document.getElementById('viewAdaptation').textContent = order.adaptation || '—';
    
    const paymentLabels = { self: 'Самозанятость', ip: 'ИП', cash: 'Наличные' };
    document.getElementById('viewPaymentMethod').textContent = paymentLabels[order.paymentMethod] || '—';
    document.getElementById('viewManager').innerHTML = `<a href="#" data-manager-id="${order.managerId}">${getEmployeeName(order.managerId)}</a>`;
    document.getElementById('viewStoryManager').textContent = order.storyManagerId ? getEmployeeName(order.storyManagerId) : '—';

    document.getElementById('orderDetailsView').style.display = 'flex';
    document.getElementById('orderDetailsEdit').style.display = 'none';
    editOrderBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Редактировать`;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeOrderModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentOrderId = null;
    isEditMode = false;
  }

  function openEditMode() {
    const order = ordersData.find(o => o.id === currentOrderId);
    if (!order) return;

    isEditMode = true;
    document.getElementById('orderDetailsView').style.display = 'none';
    document.getElementById('orderDetailsEdit').style.display = 'flex';
    editOrderBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Редактирование...`;

    document.getElementById('editAddress').value = order.address || '';
    document.getElementById('editDate').value = order.date || '';
    document.getElementById('editClient').value = order.clientId || '';
    document.getElementById('editCost').value = order.cost || '';
    document.getElementById('editStatus').value = order.status || 'request';
    document.getElementById('editSetupTime').value = order.setupTime || '';
    document.getElementById('editDressingRoom').value = order.dressingRoom || '';
    document.getElementById('editMeal').value = order.meal || '';
    document.getElementById('editConcept').value = order.concept || '';
    document.getElementById('editTask').value = order.task || '';
    document.getElementById('editTechLamps').checked = order.tech?.lamps || false;
    document.getElementById('editTechLasers').checked = order.tech?.lasers || false;
    document.getElementById('editTechHazer').checked = order.tech?.hazer || false;
    document.getElementById('editTechGrid').checked = order.tech?.grid || false;
    document.getElementById('editProjection').value = order.projection || '';
    document.getElementById('editVenueFeatures').value = order.venueFeatures || '';
    document.getElementById('editPropsFeatures').value = order.propsFeatures || '';
    document.getElementById('editAdaptation').value = order.adaptation || '';
    document.getElementById('editPaymentMethod').value = order.paymentMethod || '';
    document.getElementById('editManager').value = order.managerId || '';
    document.getElementById('editStoryManager').value = order.storyManagerId || '';
  }

  function saveOrder(formData) {
    const order = ordersData.find(o => o.id === currentOrderId);
    if (!order) return;

    order.address = formData.address;
    order.date = formData.date;
    order.clientId = parseInt(formData.clientId);
    order.cost = formData.cost || '—';
    order.status = formData.status;
    order.setupTime = formData.setupTime || '';
    order.dressingRoom = formData.dressingRoom || '';
    order.meal = formData.meal || '';
    order.concept = formData.concept || '';
    order.task = formData.task || '';
    order.tech = {
      lamps: formData.techLamps || false,
      lasers: formData.techLasers || false,
      hazer: formData.techHazer || false,
      grid: formData.techGrid || false
    };
    order.projection = formData.projection || '';
    order.venueFeatures = formData.venueFeatures || '';
    order.propsFeatures = formData.propsFeatures || '';
    order.adaptation = formData.adaptation || '';
    order.paymentMethod = formData.paymentMethod || '';
    order.managerId = parseInt(formData.managerId);
    order.storyManagerId = formData.storyManagerId ? parseInt(formData.storyManagerId) : null;

    renderOrders();
    closeOrderModal();
    showToast(`Заказ #${order.id} успешно обновлён`);
  }

  function createOrder(formData) {
    const newOrder = {
      id: nextId++,
      address: formData.address,
      date: formData.date,
      clientId: parseInt(formData.clientId),
      cost: formData.cost || '—',
      status: formData.status,
      setupTime: formData.setupTime || '',
      dressingRoom: formData.dressingRoom || '',
      meal: formData.meal || '',
      concept: formData.concept || '',
      task: formData.task || '',
      tech: {
        lamps: formData.techLamps || false,
        lasers: formData.techLasers || false,
        hazer: formData.techHazer || false,
        grid: formData.techGrid || false
      },
      projection: formData.projection || '',
      venueFeatures: formData.venueFeatures || '',
      propsFeatures: formData.propsFeatures || '',
      adaptation: formData.adaptation || '',
      paymentMethod: formData.paymentMethod || '',
      managerId: parseInt(formData.managerId),
      storyManagerId: formData.storyManagerId ? parseInt(formData.storyManagerId) : null
    };

    ordersData.push(newOrder);
    renderOrders();
    closeAddModal();
    showToast(`Заказ #${newOrder.id} успешно создан`);
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

  function openAddModal() {
    addModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    addForm.reset();
    document.getElementById('addStatus').value = 'request';
    document.getElementById('addMeal').value = '';
    document.getElementById('addProjection').value = '';
    document.getElementById('addPaymentMethod').value = '';
    document.getElementById('addTechLamps').checked = false;
    document.getElementById('addTechLasers').checked = false;
    document.getElementById('addTechHazer').checked = false;
    document.getElementById('addTechGrid').checked = false;
    document.getElementById('addStoryManager').value = '';
  }

  function closeAddModal() {
    addModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function getFormData(formId) {
    const prefix = formId === 'addOrderForm' ? 'add' : 'edit';
    return {
      address: document.getElementById(`${prefix}Address`).value,
      date: document.getElementById(`${prefix}Date`).value,
      clientId: document.getElementById(`${prefix}Client`).value,
      cost: document.getElementById(`${prefix}Cost`).value,
      status: document.getElementById(`${prefix}Status`).value,
      setupTime: document.getElementById(`${prefix}SetupTime`).value,
      dressingRoom: document.getElementById(`${prefix}DressingRoom`).value,
      meal: document.getElementById(`${prefix}Meal`).value,
      concept: document.getElementById(`${prefix}Concept`).value,
      task: document.getElementById(`${prefix}Task`).value,
      techLamps: document.getElementById(`${prefix}TechLamps`).checked,
      techLasers: document.getElementById(`${prefix}TechLasers`).checked,
      techHazer: document.getElementById(`${prefix}TechHazer`).checked,
      techGrid: document.getElementById(`${prefix}TechGrid`).checked,
      projection: document.getElementById(`${prefix}Projection`).value,
      venueFeatures: document.getElementById(`${prefix}VenueFeatures`).value,
      propsFeatures: document.getElementById(`${prefix}PropsFeatures`).value,
      adaptation: document.getElementById(`${prefix}Adaptation`).value,
      paymentMethod: document.getElementById(`${prefix}PaymentMethod`).value,
      managerId: document.getElementById(`${prefix}Manager`).value,
      storyManagerId: document.getElementById(`${prefix}StoryManager`).value
    };
  }

  searchInput.addEventListener('input', filterOrders);
  statusFilter.addEventListener('change', filterOrders);

  modalCloseBtn.addEventListener('click', closeOrderModal);

  modal.addEventListener('click', function(e) {
    if (e.target === this) {
      closeOrderModal();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (modal.classList.contains('active')) {
        closeOrderModal();
      }
      if (addModal.classList.contains('active')) {
        closeAddModal();
      }
    }
  });

  addOrderBtn.addEventListener('click', openAddModal);

  addModalCloseBtn.addEventListener('click', closeAddModal);
  addModalCancelBtn.addEventListener('click', closeAddModal);

  addModal.addEventListener('click', function(e) {
    if (e.target === this) {
      closeAddModal();
    }
  });

  addForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = getFormData('addOrderForm');
    if (!formData.address || !formData.date || !formData.clientId || !formData.managerId) {
      showToast('Пожалуйста, заполните обязательные поля (Адрес, Дата, Клиент, Менеджер)');
      return;
    }
    createOrder(formData);
  });

  editOrderBtn.addEventListener('click', function() {
    if (!isEditMode) {
      openEditMode();
    }
  });

  editCancelBtn.addEventListener('click', function() {
    isEditMode = false;
    document.getElementById('orderDetailsView').style.display = 'flex';
    document.getElementById('orderDetailsEdit').style.display = 'none';
    editOrderBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Редактировать`;
  });

  editForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = getFormData('editOrderForm');
    if (!formData.address || !formData.date || !formData.clientId || !formData.managerId) {
      showToast('Пожалуйста, заполните обязательные поля (Адрес, Дата, Клиент, Менеджер)');
      return;
    }
    saveOrder(formData);
  });

  viewInScheduleBtn.addEventListener('click', function() {
    showToast('Открывается расписание для заказа #' + currentOrderId);
  });

  document.addEventListener('click', function(e) {
    if (e.target.closest('[data-client-id]')) {
      e.preventDefault();
      const id = e.target.closest('[data-client-id]').getAttribute('data-client-id');
      showToast(`Переход к клиенту #${id}`);
    }
    if (e.target.closest('[data-manager-id]')) {
      e.preventDefault();
      const id = e.target.closest('[data-manager-id]').getAttribute('data-manager-id');
      showToast(`Переход к сотруднику #${id}`);
    }
  });

  populateSelects();
  renderOrders();
})();