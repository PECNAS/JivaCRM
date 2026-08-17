(function() {
  let clientsData = [
    {
      id: 1,
      fullName: 'Иван Петров',
      phone: '+7 (999) 123-45-67',
      agency: 'ООО «Горизонт»',
      rating: 'high',
      email: 'ivan.p@gorizont.ru',
      city: 'Москва',
      requests: 12,
      orders: [
        { id: 101, name: 'Шоу «Космос»', date: '12.08.2026', status: 'Завершён' },
        { id: 102, name: 'Пролог для «Сцены»', date: '25.07.2026', status: 'Завершён' },
        { id: 103, name: 'Корпоратив «Вектор»', date: '05.09.2026', status: 'В работе' }
      ]
    },
    {
      id: 2,
      fullName: 'Елена Смирнова',
      phone: '+7 (888) 234-56-78',
      agency: 'Агентство «Событие»',
      rating: 'medium',
      email: 'elena@sobytie.ru',
      city: 'Санкт-Петербург',
      requests: 8,
      orders: [
        { id: 201, name: 'Шоу «Стихия»', date: '18.08.2026', status: 'В работе' },
        { id: 202, name: 'День города', date: '01.08.2026', status: 'Завершён' }
      ]
    },
    {
      id: 3,
      fullName: 'Алексей Козлов',
      phone: '+7 (777) 345-67-89',
      agency: 'Корпорация «Вектор»',
      rating: 'high',
      email: 'a.kozlov@vector.ru',
      city: 'Казань',
      requests: 15,
      orders: [
        { id: 301, name: 'Открытие Манжерока', date: '15.06.2026', status: 'Завершён' },
        { id: 302, name: 'MICE Excellence', date: '22.09.2026', status: 'В работе' },
        { id: 303, name: 'Новая волна', date: '10.10.2026', status: 'В работе' }
      ]
    },
    {
      id: 4,
      fullName: 'Ольга Новикова',
      phone: '+7 (666) 456-78-90',
      agency: 'ИП Новикова О.А.',
      rating: 'low',
      email: 'o.novikova@mail.ru',
      city: 'Екатеринбург',
      requests: 3,
      orders: [
        { id: 401, name: 'Свадьба Ивановых', date: '20.07.2026', status: 'Завершён' }
      ]
    },
    {
      id: 5,
      fullName: 'Дмитрий Морозов',
      phone: '+7 (555) 567-89-01',
      agency: 'ООО «Форум»',
      rating: 'medium',
      email: 'd.morozov@forum.ru',
      city: 'Новосибирск',
      requests: 6,
      orders: [
        { id: 501, name: 'Песня года', date: '05.12.2026', status: 'В работе' }
      ]
    }
  ];

  let nextId = 6;
  let currentClientId = null;

  const tableBody = document.getElementById('clientsTableBody');
  const searchInput = document.getElementById('searchInput');
  const ratingFilter = document.getElementById('ratingFilter');
  const modal = document.getElementById('clientModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const addClientBtn = document.getElementById('addClientBtn');
  const addModal = document.getElementById('addClientModal');
  const addModalCloseBtn = document.getElementById('addModalCloseBtn');
  const addModalCancelBtn = document.getElementById('addModalCancelBtn');
  const addForm = document.getElementById('addClientForm');

  function renderClients(filteredData) {
    const data = filteredData || clientsData;
    if (data.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 2rem; color: #7a7267;">
            Клиенты не найдены
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = data.map(client => {
      const ratingLabels = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
      const ratingClass = `rating-badge--${client.rating}`;
      return `
        <tr data-client-id="${client.id}">
          <td>${client.fullName}</td>
          <td>${client.phone}</td>
          <td>${client.agency}</td>
          <td><span class="rating-badge ${ratingClass}">${ratingLabels[client.rating]}</span></td>
          <td>${client.requests || 0}</td>
          <td>${client.orders.length}</td>
          <td><button class="view-link" data-id="${client.id}">Подробнее</button></td>
        </tr>
      `;
    }).join('');

    tableBody.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(this.getAttribute('data-id'));
        openModal(id);
      });
    });

    tableBody.querySelectorAll('tr[data-client-id]').forEach(row => {
      row.addEventListener('click', function() {
        const id = parseInt(this.getAttribute('data-client-id'));
        openModal(id);
      });
    });
  }

  function filterClients() {
    const search = searchInput.value.toLowerCase().trim();
    const rating = ratingFilter.value;

    const filtered = clientsData.filter(client => {
      const matchSearch = 
        client.fullName.toLowerCase().includes(search) ||
        client.agency.toLowerCase().includes(search) ||
        client.phone.includes(search);
      
      const matchRating = rating === 'all' || client.rating === rating;
      
      return matchSearch && matchRating;
    });

    renderClients(filtered);
  }

  function openModal(clientId) {
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;

    currentClientId = clientId;
    document.getElementById('modalClientName').textContent = client.fullName;
    document.getElementById('modalFullName').textContent = client.fullName;
    document.getElementById('modalPhone').textContent = client.phone;
    document.getElementById('modalAgency').textContent = client.agency;
    document.getElementById('modalEmail').textContent = client.email || '—';
    document.getElementById('modalCity').textContent = client.city || '—';

    const ratingLabels = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
    document.getElementById('modalRating').textContent = ratingLabels[client.rating] || '—';

    const ordersContainer = document.getElementById('modalOrdersList');
    if (client.orders && client.orders.length > 0) {
      ordersContainer.innerHTML = client.orders.map(order => `
        <div class="order-item">
          <div class="order-info">
            <span class="order-name">${order.name}</span>
            <span class="order-meta">${order.date} · ${order.status}</span>
          </div>
          <a href="#" class="order-link" data-order-id="${order.id}">Перейти к заказу →</a>
        </div>
      `).join('');

      ordersContainer.querySelectorAll('.order-link').forEach(link => {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          const orderId = this.getAttribute('data-order-id');
          showToast(`Переход к заказу #${orderId}`);
        });
      });
    } else {
      ordersContainer.innerHTML = '<p class="orders-empty">Нет заказов</p>';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentClientId = null;
  }

  function openAddModal() {
    addModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    addForm.reset();
    document.getElementById('addRating').value = 'medium';
  }

  function closeAddModal() {
    addModal.classList.remove('active');
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

  function addClient(formData) {
    const ratingLabels = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
    const newClient = {
      id: nextId++,
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim(),
      agency: formData.agency.trim() || '—',
      rating: formData.rating,
      email: formData.email.trim() || '—',
      city: formData.city.trim() || '—',
      requests: 0,
      orders: []
    };

    clientsData.push(newClient);
    renderClients();
    closeAddModal();
    showToast(`Клиент "${newClient.fullName}" успешно добавлен`);
  }

  searchInput.addEventListener('input', filterClients);
  ratingFilter.addEventListener('change', filterClients);

  modalCloseBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', function(e) {
    if (e.target === this) {
      closeModal();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (modal.classList.contains('active')) {
        closeModal();
      }
      if (addModal.classList.contains('active')) {
        closeAddModal();
      }
    }
  });

  addClientBtn.addEventListener('click', openAddModal);

  addModalCloseBtn.addEventListener('click', closeAddModal);
  addModalCancelBtn.addEventListener('click', closeAddModal);

  addModal.addEventListener('click', function(e) {
    if (e.target === this) {
      closeAddModal();
    }
  });

  addForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = {
      fullName: document.getElementById('addFullName').value,
      phone: document.getElementById('addPhone').value,
      agency: document.getElementById('addAgency').value,
      rating: document.getElementById('addRating').value,
      email: document.getElementById('addEmail').value,
      city: document.getElementById('addCity').value
    };

    if (!formData.fullName || !formData.phone) {
      showToast('Пожалуйста, заполните обязательные поля (ФИО и Телефон)');
      return;
    }

    addClient(formData);
  });

  renderClients();
})();