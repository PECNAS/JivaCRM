(function() {
    let currentOrderId = null;
    let currentOrderData = null;
    let estimateItems = [];
    let employeeItems = [];
    let allEmployees = [];
    let allServices = [];
    let allCities = [];
    let filteredEmployees = [];
    let filteredServices = [];
    let costOverride = false;
    let manualCost = '';
    let servicesTotalOverride = false;

    const editorModal = document.getElementById('orderEditorModal');
    const editorOrderTitle = document.getElementById('editorOrderTitle');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const deleteOrderBtn = document.getElementById('deleteOrderBtn');

    const orderInfoForm = document.getElementById('orderInfoForm');
    const editOrderName = document.getElementById('editOrderName');
    const editOrderDate = document.getElementById('editOrderDate');
    const editOrderClient = document.getElementById('editOrderClient');
    const editOrderCity = document.getElementById('editOrderCity');
    const editOrderStatus = document.getElementById('editOrderStatus');
    const editOrderAddress = document.getElementById('editOrderAddress');
    const editOrderContactPhone = document.getElementById('editOrderContactPhone');
    const editOrderContactTelegram = document.getElementById('editOrderContactTelegram');
    const editOrderSetupTime = document.getElementById('editOrderSetupTime');
    const editOrderDuration = document.getElementById('editOrderDuration');
    const editOrderDressingRoom = document.getElementById('editOrderDressingRoom');
    const editOrderMeal = document.getElementById('editOrderMeal');
    const editOrderConcept = document.getElementById('editOrderConcept');
    const editOrderTechLamps = document.getElementById('editOrderTechLamps');
    const editOrderTechLaser = document.getElementById('editOrderTechLaser');
    const editOrderTechHazer = document.getElementById('editOrderTechHazer');
    const editOrderTechGrid = document.getElementById('editOrderTechGrid');
    const editOrderTechProjection = document.getElementById('editOrderTechProjection');
    const editOrderTechComment = document.getElementById('editOrderTechComment');
    const editOrderVenueComment = document.getElementById('editOrderVenueComment');
    const editOrderPropsComment = document.getElementById('editOrderPropsComment');
    const editOrderManager = document.getElementById('editOrderManager');
    const editOrderStoryManager = document.getElementById('editOrderStoryManager');
    const editOrderCost = document.getElementById('editOrderCost');
    const editOrderPaymentMethod = document.getElementById('editOrderPaymentMethod');
    const overrideCostBtn = document.getElementById('overrideCostBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    const servicesCatalogList = document.getElementById('servicesCatalogList');
    const servicesTableBody = document.getElementById('servicesTableBody');
    const servicesTotal = document.getElementById('servicesTotal');
    const serviceSearchInput = document.getElementById('serviceSearchInput');

    const employeesListPanel = document.getElementById('employeesListPanel');
    const employeesTableBody = document.getElementById('employeesTableBody');
    const employeesTotal = document.getElementById('employeesTotal');
    const employeeSearchInput = document.getElementById('employeeSearchInput');

    function getCSRFToken() {
        const cookieValue = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
        return cookieValue ? cookieValue[2] : '';
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
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
        }, 2000);
    }

    function escapeHtml(text) {
        if (!text && text !== 0) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function formatPrice(value) {
        const num = parseFloat(value) || 0;
        return num.toFixed(2).replace('.', ',') + ' ₽';
    }

    function switchTab(tabName) {
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
        tabContents.forEach(c => c.classList.toggle('active', c.id === `tab-${tabName}`));
    }

    tabButtons.forEach(btn => btn.addEventListener('click', function() {
        switchTab(this.dataset.tab);
    }));

    function getCurrentCityId() {
        if (!editOrderCity) return null;
        const v = editOrderCity.value;
        return v ? parseInt(v) : null;
    }

    function open(orderId) {
        currentOrderId = orderId;
        costOverride = false;
        manualCost = '';
        if (overrideCostBtn) overrideCostBtn.classList.remove('active');
        if (editOrderCost) {
            editOrderCost.readOnly = true;
            editOrderCost.classList.add('form-input--readonly');
        }

        fetch(`/orders/${orderId}/`)
            .then(r => r.json())
            .then(data => {
                if (data.error) { showToast(data.error); return; }
                currentOrderData = data;
                populateForm(data);
                editorOrderTitle.textContent = data.name || `Заказ #${data.id}`;
                editorModal.classList.add('active');
                document.body.style.overflow = 'hidden';
                switchTab('info');
                loadServicesList();
                loadEmployeesList();
            })
            .catch(err => { showToast('Ошибка загрузки заказа'); console.error(err); });
    }

    function close() {
        editorModal.classList.remove('active');
        document.body.style.overflow = '';
        currentOrderId = null;
        currentOrderData = null;
    }

    function resetForm() {
        if (currentOrderData) {
            populateForm(currentOrderData);
        }
    }

    function populateForm(data) {
        editOrderName.value = data.name || '';
        editOrderDate.value = data.date || '';
        editOrderClient.value = data.client_id || '';
        editOrderStatus.value = data.status || 'request';
        editOrderAddress.value = data.address || '';
        editOrderContactPhone.value = data.contact_phone || '';
        editOrderContactTelegram.value = data.contact_telegram || '';
        editOrderSetupTime.value = data.setup_time || '';
        editOrderDuration.value = data.duration || 1;
        editOrderDressingRoom.value = data.dressing_room_comment || '';
        editOrderMeal.value = data.meal_comment || '';
        editOrderConcept.value = data.concept || '';
        editOrderTechLamps.checked = data.tech_lamps || false;
        editOrderTechLaser.checked = data.tech_laser || false;
        editOrderTechHazer.checked = data.tech_hazer || false;
        editOrderTechGrid.checked = data.tech_grid || false;
        editOrderTechProjection.checked = data.tech_projection || false;
        editOrderTechComment.value = data.tech_comment || '';
        editOrderVenueComment.value = data.venue_comment || '';
        editOrderPropsComment.value = data.props_comment || '';
        editOrderManager.value = data.manager_id || '';
        editOrderStoryManager.value = data.story_manager_id || '';
        editOrderPaymentMethod.value = data.payment_method || '';
        editOrderCity.value = data.city_id || '';

        estimateItems = (data.estimate_items || []).map(i => ({...i}));
        employeeItems = (data.employee_items || []).map(i => ({...i}));

        renderServices();
        renderEmployees();
        updateCostField();
    }

    function loadClientsForSelect() {
        fetch('/clients/list/')
            .then(r => r.json())
            .then(data => {
                if (data.clients) {
                    const options = data.clients.map(c =>
                        `<option value="${c.id}">${escapeHtml(c.full_name)}${c.agency ? ' (' + escapeHtml(c.agency) + ')' : ''}</option>`
                    ).join('');
                    editOrderClient.innerHTML = '<option value="">Выберите клиента</option>' + options;
                    if (currentOrderData) editOrderClient.value = currentOrderData.client_id || '';
                }
            })
            .catch(err => console.error('Ошибка загрузки клиентов:', err));
    }

    function loadCities() {
        fetch('/services/cities/')
            .then(r => r.json())
            .then(data => {
                if (data.cities) {
                    allCities = data.cities;
                    const options = data.cities.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
                    editOrderCity.innerHTML = '<option value="">Не выбран (Казань по умолчанию)</option>' + options;
                    if (currentOrderData) editOrderCity.value = currentOrderData.city_id || '';
                }
            })
            .catch(err => console.error('Ошибка загрузки городов:', err));
    }

    function loadEmployeesForSelects() {
        fetch('/employees/list/')
            .then(r => r.json())
            .then(data => {
                if (data.employees) {
                    allEmployees = data.employees;
                    const managerOptions = data.employees.map(e =>
                        `<option value="${e.id}">${escapeHtml(e.full_name)}</option>`
                    ).join('');
                    editOrderManager.innerHTML = '<option value="">Выберите менеджера</option>' + managerOptions;
                    editOrderStoryManager.innerHTML = '<option value="">Не назначен</option>' + managerOptions;
                    if (currentOrderData) {
                        editOrderManager.value = currentOrderData.manager_id || '';
                        editOrderStoryManager.value = currentOrderData.story_manager_id || '';
                    }
                    renderEmployeesListPanel();
                }
            })
            .catch(err => console.error('Ошибка загрузки сотрудников:', err));
    }

    function loadServicesList() {
        fetch('/orders/services/')
            .then(r => r.json())
            .then(data => {
                if (data.services) {
                    allServices = data.services;
                    renderServicesCatalogPanel();
                }
            })
            .catch(err => console.error('Ошибка загрузки услуг:', err));
    }

    function loadEmployeesList() {
        if (allEmployees.length === 0) {
            loadEmployeesForSelects();
        } else {
            renderEmployeesListPanel();
        }
    }

    function renderServicesCatalogPanel() {
        const search = (serviceSearchInput.value || '').toLowerCase().trim();
        filteredServices = allServices.filter(s => {
            if (!search) return true;
            return s.name.toLowerCase().includes(search) || (s.parent_name && s.parent_name.toLowerCase().includes(search));
        });

        if (filteredServices.length === 0) {
            servicesCatalogList.innerHTML = '<div style="padding:1rem;text-align:center;color:#7a7267;font-size:0.85rem;">Услуги не найдены</div>';
            return;
        }

        servicesCatalogList.innerHTML = filteredServices.map(s => {
            const path = s.parent_name ? `${escapeHtml(s.parent_name)} / ${escapeHtml(s.name)}` : escapeHtml(s.name);
            const isAdded = estimateItems.some(it => it.service_id === s.id);
            return `
                <div class="service-catalog-item ${isAdded ? 'added' : ''}" data-service-id="${s.id}">
                    <div class="service-catalog-info">
                        <div class="service-catalog-name">${path}</div>
                        <div class="service-catalog-meta">Арт: ${s.artist_min}-${s.artist_max} × ${formatPrice(s.artist_rate)} · Тех: ${s.technician_min}-${s.technician_max} × ${formatPrice(s.technician_rate)}</div>
                    </div>
                    <button class="add-service-catalog-btn" data-service-id="${s.id}" title="Добавить в заказ">+</button>
                </div>
            `;
        }).join('');

        servicesCatalogList.querySelectorAll('.add-service-catalog-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.dataset.serviceId);
                addServiceToEstimate(id);
            });
        });
    }

    function addServiceToEstimate(serviceId) {
        const existing = estimateItems.find(it => it.service_id === serviceId);
        if (existing) {
            showToast('Услуга уже добавлена в заказ');
            return;
        }
        const service = allServices.find(s => s.id === serviceId);
        if (!service) return;

        const peopleDefault = service.artist_min + service.technician_min + service.driver_min;

        estimateItems.push({
            service_id: serviceId,
            name: service.name,
            people_count: peopleDefault,
            coefficient: 1,
            price: 0,
            comment: '',
            overridden: false,
        });

        renderServices();
        fetchServicePrice(estimateItems.length - 1);
    }

    function fetchServicePrice(index) {
        const item = estimateItems[index];
        if (!item || !item.service_id) return;
        const cityId = getCurrentCityId();
        const params = new URLSearchParams();
        if (cityId) params.append('city_id', cityId);
        if (item.people_count) params.append('people_count', item.people_count);

        fetch(`/orders/services/${item.service_id}/price/?${params.toString()}`)
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    estimateItems[index].price = data.price;
                    renderServices();
                }
            })
            .catch(err => console.error('Ошибка загрузки цены услуги:', err));
    }

    function renderServices() {
        if (estimateItems.length === 0) {
            servicesTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">Добавьте услуги из каталога</td></tr>';
            servicesTotal.textContent = '0 ₽';
            updateCostField();
            renderServicesCatalogPanel();
            return;
        }

        servicesTableBody.innerHTML = estimateItems.map((item, index) => `
            <tr data-index="${index}">
                <td>${escapeHtml(item.name)}</td>
                <td>
                    <input type="number" class="cell-input cell-input--number" min="1"
                           value="${item.people_count}" data-field="people_count" data-index="${index}">
                </td>
                <td>
                    <input type="number" class="cell-input cell-input--price" step="0.01" min="0"
                           value="${item.price}" data-field="price" data-index="${index}">
                </td>
                <td>
                    <input type="text" class="cell-input" value="${escapeHtml(item.comment)}"
                           placeholder="Комментарий" data-field="comment" data-index="${index}">
                </td>
                <td>
                    <button class="remove-btn" data-remove-index="${index}" title="Удалить">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `).join('');

        attachServicesTableEvents();
        updateServicesTotal();
        renderServicesCatalogPanel();
    }

    function attachServicesTableEvents() {
        servicesTableBody.querySelectorAll('.cell-input').forEach(input => {
            input.addEventListener('change', function() {
                const index = parseInt(this.dataset.index);
                const field = this.dataset.field;
                let value = this.value;

                if (field === 'people_count' || field === 'price') {
                    value = parseFloat(value) || 0;
                }

                if (field === 'price') {
                    estimateItems[index].overridden = true;
                }

                estimateItems[index][field] = value;
                if (field === 'people_count') {
                    fetchServicePrice(index);
                } else {
                    updateServicesTotal();
                }
            });
        });

        servicesTableBody.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.removeIndex);
                estimateItems.splice(index, 1);
                renderServices();
            });
        });
    }

    function updateServicesTotal() {
        const total = estimateItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
        servicesTotal.textContent = formatPrice(total);
        updateCostField();
    }

    function getServicesTotal() {
        return estimateItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    }

    function renderEmployeesListPanel() {
        const search = (employeeSearchInput.value || '').toLowerCase().trim();
        filteredEmployees = allEmployees.filter(emp => {
            if (!search) return true;
            return emp.full_name.toLowerCase().includes(search) || (emp.role && emp.role.toLowerCase().includes(search));
        });

        if (filteredEmployees.length === 0) {
            employeesListPanel.innerHTML = '<div style="padding:1rem;text-align:center;color:#7a7267;font-size:0.85rem;">Сотрудники не найдены</div>';
            return;
        }

        const roleLabels = {
            senior_admin: 'Старший администратор',
            admin: 'Администратор',
            manager: 'Менеджер',
            trainer: 'Тренер',
            artist: 'Артист'
        };

        employeesListPanel.innerHTML = filteredEmployees.map(emp => {
            const initials = emp.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const roleLabel = roleLabels[emp.role] || emp.role;
            const isAdded = employeeItems.some(item => item.employee_id === emp.id);
            return `
                <div class="employee-item ${isAdded ? 'added' : ''}" data-employee-id="${emp.id}">
                    <div class="employee-avatar">${initials}</div>
                    <div class="employee-info">
                        <div class="employee-name">${escapeHtml(emp.full_name)}</div>
                        <div class="employee-role">${escapeHtml(roleLabel)}</div>
                    </div>
                    <button class="add-employee-btn" data-employee-id="${emp.id}"
                            data-employee-name="${escapeHtml(emp.full_name)}"
                            data-employee-role="${escapeHtml(roleLabel)}"
                            data-employee-raw-role="${emp.role}"
                            title="Добавить в заказ">+</button>
                </div>
            `;
        }).join('');

        employeesListPanel.querySelectorAll('.add-employee-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.dataset.employeeId);
                const name = this.dataset.employeeName;
                const roleLabel = this.dataset.employeeRole;
                const rawRole = this.dataset.employeeRawRole;
                addEmployeeToOrder(id, name, roleLabel, rawRole);
            });
        });
    }

    function addEmployeeToOrder(id, name, roleLabel, rawRole) {
        const existing = employeeItems.find(it => it.employee_id === id);
        if (existing) {
            showToast('Сотрудник уже добавлен');
            return;
        }

        let payment = 0;
        if (estimateItems.length > 0 && allServices.length > 0) {
            let maxRate = 0;
            estimateItems.forEach(item => {
                if (!item.service_id) return;
                const service = allServices.find(s => s.id === item.service_id);
                if (!service) return;
                if (rawRole === 'artist' && service.artist_rate > maxRate) maxRate = service.artist_rate;
                if (rawRole === 'trainer' && service.technician_rate > maxRate) maxRate = service.technician_rate;
                if (rawRole === 'artist' && service.artist_rate === 0 && service.technician_rate > maxRate) maxRate = service.technician_rate;
            });
            payment = maxRate;
        }

        employeeItems.push({
            employee_id: id,
            name: name,
            role: roleLabel,
            payment: payment,
            comment: ''
        });

        renderEmployees();
        renderEmployeesListPanel();
    }

    function renderEmployees() {
        if (employeeItems.length === 0) {
            employeesTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">Добавьте сотрудников из списка</td></tr>';
            employeesTotal.textContent = '0 ₽';
            updateCostField();
            return;
        }

        employeesTableBody.innerHTML = employeeItems.map((item, index) => `
            <tr data-index="${index}">
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.role)}</td>
                <td>
                    <input type="number" class="cell-input cell-input--price" step="0.01" min="0"
                           value="${item.payment}" data-field="payment" data-index="${index}">
                </td>
                <td>
                    <input type="text" class="cell-input" value="${escapeHtml(item.comment)}"
                           placeholder="Комментарий" data-field="comment" data-index="${index}">
                </td>
                <td>
                    <button class="remove-btn" data-remove-index="${index}" title="Удалить">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `).join('');

        attachEmployeeTableEvents();
        updateEmployeesTotal();
    }

    function attachEmployeeTableEvents() {
        employeesTableBody.querySelectorAll('.cell-input').forEach(input => {
            input.addEventListener('change', function() {
                const index = parseInt(this.dataset.index);
                const field = this.dataset.field;
                let value = this.value;
                if (field === 'payment') value = parseFloat(value) || 0;
                employeeItems[index][field] = value;
                updateEmployeesTotal();
            });
        });

        employeesTableBody.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.removeIndex);
                employeeItems.splice(index, 1);
                renderEmployees();
                renderEmployeesListPanel();
            });
        });
    }

    function updateEmployeesTotal() {
        const total = employeeItems.reduce((sum, it) => sum + (parseFloat(it.payment) || 0), 0);
        employeesTotal.textContent = formatPrice(total);
        updateCostField();
    }

    function getEmployeesTotal() {
        return employeeItems.reduce((sum, it) => sum + (parseFloat(it.payment) || 0), 0);
    }

    function getCalculatedCost() {
        return getServicesTotal() + getEmployeesTotal();
    }

    function updateCostField() {
        if (costOverride) {
            editOrderCost.value = manualCost;
        } else {
            const calc = getCalculatedCost();
            editOrderCost.value = formatPrice(calc);
            manualCost = editOrderCost.value;
        }
    }

    if (overrideCostBtn) {
        overrideCostBtn.addEventListener('click', function() {
            costOverride = !costOverride;
            this.classList.toggle('active', costOverride);
            if (costOverride) {
                editOrderCost.readOnly = false;
                editOrderCost.classList.remove('form-input--readonly');
                editOrderCost.focus();
                editOrderCost.select();
            } else {
                editOrderCost.readOnly = true;
                editOrderCost.classList.add('form-input--readonly');
                manualCost = '';
                updateCostField();
            }
        });
    }

    if (editOrderCost) {
        editOrderCost.addEventListener('input', function() {
            if (costOverride) manualCost = this.value;
        });
        editOrderCost.addEventListener('blur', function() {
            if (costOverride) manualCost = this.value;
        });
    }

    if (editOrderCity) {
        editOrderCity.addEventListener('change', function() {
            estimateItems.forEach((item, index) => {
                if (item.service_id && !item.overridden) {
                    fetchServicePrice(index);
                }
            });
        });
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', function() {
            if (currentOrderData) {
                resetForm();
                showToast('Изменения отменены');
            }
        });
    }

    if (deleteOrderBtn) {
        deleteOrderBtn.addEventListener('click', function() {
            if (!currentOrderId) return;
            if (!confirm('Вы уверены, что хотите удалить этот заказ?')) return;

            fetch(`/orders/${currentOrderId}/delete/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCSRFToken() }
            })
            .then(r => r.json())
            .then(data => {
                if (data.error) { showToast(data.error); return; }
                if (data.success) {
                    showToast('Заказ удалён');
                    close();
                    if (window.renderOrders) window.renderOrders(); else location.reload();
                }
            })
            .catch(err => { showToast('Ошибка удаления'); console.error(err); });
        });
    }

    if (employeeSearchInput) {
        let t;
        employeeSearchInput.addEventListener('input', function() {
            clearTimeout(t);
            t = setTimeout(renderEmployeesListPanel, 200);
        });
    }

    if (serviceSearchInput) {
        let t;
        serviceSearchInput.addEventListener('input', function() {
            clearTimeout(t);
            t = setTimeout(renderServicesCatalogPanel, 200);
        });
    }

    if (orderInfoForm) {
        orderInfoForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const data = {
                name: editOrderName.value.trim(),
                date: editOrderDate.value,
                client_id: editOrderClient.value,
                city_id: editOrderCity.value,
                status: editOrderStatus.value,
                address: editOrderAddress.value.trim(),
                contact_phone: editOrderContactPhone.value.trim(),
                contact_telegram: editOrderContactTelegram.value.trim(),
                setup_time: editOrderSetupTime.value.trim(),
                duration: editOrderDuration.value,
                dressing_room_comment: editOrderDressingRoom.value.trim(),
                meal_comment: editOrderMeal.value.trim(),
                concept: editOrderConcept.value.trim(),
                tech_lamps: editOrderTechLamps.checked ? 'on' : 'off',
                tech_laser: editOrderTechLaser.checked ? 'on' : 'off',
                tech_hazer: editOrderTechHazer.checked ? 'on' : 'off',
                tech_grid: editOrderTechGrid.checked ? 'on' : 'off',
                tech_projection: editOrderTechProjection.checked ? 'on' : 'off',
                tech_comment: editOrderTechComment.value.trim(),
                venue_comment: editOrderVenueComment.value.trim(),
                props_comment: editOrderPropsComment.value.trim(),
                manager_id: editOrderManager.value,
                story_manager_id: editOrderStoryManager.value,
                cost: editOrderCost.value.trim(),
                payment_method: editOrderPaymentMethod.value,
                estimate_items: JSON.stringify(estimateItems),
                employee_items: JSON.stringify(employeeItems)
            };

            if (!data.name) { showToast('Введите название заказа'); return; }

            fetch(`/orders/${currentOrderId}/update/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams(data)
            })
            .then(r => r.json())
            .then(res => {
                if (res.error) { showToast(res.error); return; }
                if (res.success) {
                    showToast('Заказ сохранён');
                    if (window.renderOrders) window.renderOrders(); else location.reload();
                }
            })
            .catch(err => { showToast('Ошибка сохранения'); console.error(err); });
        });
    }

    window.OrderEditor = {
        open: open,
        close: close,
        loadEmployees: loadEmployeesForSelects
    };

    document.addEventListener('DOMContentLoaded', function() {
        loadEmployeesForSelects();
        loadClientsForSelect();
        loadCities();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && editorModal.classList.contains('active')) close();
    });
})();