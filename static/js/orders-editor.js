(function() {
    let currentOrderId = null;
    let currentOrderData = null;
    let estimateItems = [];
    let employeeItems = [];
    let allEmployees = [];
    let allServices = [];
    let allCities = [];
    let allCityGroups = [];
    let cityGroupsByCity = {};
    let filteredEmployees = [];
    let expandedCats = new Set();
    let costOverride = false;
    let manualCost = '';
    let pricePeriodPercent = 0;
    let pricePeriodInfo = null;
    let formSnapshot = null;
    let itemsSnapshot = '[]';

    function getCityGroupCoefficient() {
        const groupId = editOrderCityGroup && editOrderCityGroup.value ? parseInt(editOrderCityGroup.value, 10) : null;

        if (groupId) {
            const group = allCityGroups.find(item => item.id === groupId);
            if (group) return parseFloat(group.coefficient) || 1;
        }

        const cityId = editOrderCity && editOrderCity.value ? parseInt(editOrderCity.value, 10) : null;

        if (cityId) {
            const groupIdByCity = cityGroupsByCity[cityId];
            const group = allCityGroups.find(item => item.id === groupIdByCity);
            if (group) return parseFloat(group.coefficient) || 1;
        }

        return 1;
    }

    function getPriceMultiplier() {
        return (1 + (parseFloat(pricePeriodPercent) || 0) / 100) * getCityGroupCoefficient();
    }

    function applyPricePeriod(value) {
        const base = parseFloat(value) || 0;
        const coefficient = getCityGroupCoefficient();
        const result = base * getPriceMultiplier();

        if (coefficient === 1) {
            return Math.round(result * 100) / 100;
        }

        return Math.round(result / 1000) * 1000;
    }

    function recalcEstimatePrices() {
        estimateItems.forEach((item, index) => {
            if (item.overridden || !item.service_id) return;

            const service = allServices.find(s => s.id === item.service_id);
            const row = service ? pickRow(service, item.people_count) : null;

            item.price = row ? applyPricePeriod(row.cost) : 0;
        });

        if (estimateItems.length) {
            renderServices();
            renderEmployees();
            updateCostField();
        }

        renderServicesCatalogPanel();
    }

    function renderCityGroupHint() {
        const hint = document.getElementById('cityGroupHint');

        if (!hint) return;

        const coefficient = getCityGroupCoefficient();
        hint.textContent = coefficient !== 1 ? 'Коэффициент цены: ×' + coefficient : '';
    }

    function loadPricePeriod() {
        const dateValue = editOrderDate && editOrderDate.value ? editOrderDate.value : '';

        fetch('/orders/price-period/?date=' + encodeURIComponent(dateValue))
            .then(r => r.json())
            .then(data => {
                pricePeriodPercent = parseFloat(data.percent) || 0;
                pricePeriodInfo = data.period || null;
                renderPricePeriodNotice();
                renderServicesCatalogPanel();

                if (estimateItems.length) {
                    renderServices();
                }
            })
            .catch(err => console.error('Ошибка загрузки периода цен:', err));
    }

    function renderPricePeriodNotice() {
        const container = document.getElementById('pricePeriodNotice');

        if (!container) return;

        if (!pricePeriodPercent) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        const period = pricePeriodInfo || {};
        const from = period.start_date ? period.start_date.split('-').reverse().join('.') : '';
        const to = period.end_date ? period.end_date.split('-').reverse().join('.') : '';

        container.style.display = 'block';
        container.innerHTML = `Действует сезонное повышение цен: +${pricePeriodPercent}% (${escapeHtml(from)} — ${escapeHtml(to)}). Стоимость услуг пересчитана.`;
    }

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
    const editOrderCityGroup = document.getElementById('editOrderCityGroup');
    const editOrderStatus = document.getElementById('editOrderStatus');
    const editOrderAddress = document.getElementById('editOrderAddress');
    const editOrderContactName = document.getElementById('editOrderContactName');
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

    const roleLabels = {
        artist: 'Артист',
        technician: 'Техник',
        choreographer: 'Хореограф',
        manager: 'Управляющий',
        sales_manager: 'Менеджер',
        production: 'Выпускающий',
        senior_admin: 'Старший администратор'
    };

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
        return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
    }

    function switchTab(tabName) {
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
        tabContents.forEach(c => c.classList.toggle('active', c.id === `tab-${tabName}`));
    }

    tabButtons.forEach(btn => btn.addEventListener('click', function() {
        switchTab(this.dataset.tab);
    }));

    function getSortedRows(service) {
        return (service && service.staff_rows ? service.staff_rows.slice() : [])
            .sort((a, b) => a.artist_count - b.artist_count);
    }

    function pickRow(service, count) {
        const rows = getSortedRows(service);
        if (rows.length === 0) return null;
        const n = parseInt(count) || 0;
        let chosen = null;
        rows.forEach(r => {
            if (r.artist_count <= n) chosen = r;
        });
        return chosen || rows[0];
    }

    function getPriceRangeLabel(service) {
        const rows = getSortedRows(service);
        if (rows.length === 0) return 'Цена не задана';
        const first = rows[0];
        const last = rows[rows.length - 1];
        if (first.artist_count === last.artist_count) {
            return `${formatPrice(applyPricePeriod(first.cost))} (${first.artist_count})`;
        }
        return `${formatPrice(applyPricePeriod(first.cost))} (${first.artist_count}) - ${formatPrice(applyPricePeriod(last.cost))} (${last.artist_count})`;
    }

    function getDefaultPaymentByRole(rawRole) {
        if (rawRole !== 'artist') return null;
        let maxRate = 0;
        estimateItems.forEach(item => {
            if (!item.service_id) return;
            const service = allServices.find(s => s.id === item.service_id);
            if (service && (service.artist_rate || 0) > maxRate) maxRate = service.artist_rate;
        });
        return maxRate;
    }

    function getDefaultPaymentForItem(item) {
        const emp = allEmployees.find(e => e.id === item.employee_id);
        if (!emp) return null;
        return getDefaultPaymentByRole(emp.role);
    }

    function refreshEmployeeDefaults() {
        employeeItems.forEach(item => {
            if (item.overridden) return;
            const def = getDefaultPaymentForItem(item);
            if (def !== null) item.payment = def;
        });
    }

    function getCurrentCityId() {
        if (!editOrderCity) return null;
        const v = editOrderCity.value;
        return v ? parseInt(v) : null;
    }

    function open(orderId) {
        currentOrderId = orderId;
        costOverride = false;
        manualCost = '';
        pricePeriodPercent = 0;
        pricePeriodInfo = null;
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
                loadPricePeriod();
                loadServicesList();
                loadEmployeesList();
                formSnapshot = window.UI.snapshot(orderInfoForm);
                itemsSnapshot = JSON.stringify(estimateItems);
            })
            .catch(err => { showToast('Ошибка загрузки заказа'); console.error(err); });
    }

    function close() {
        editorModal.classList.remove('active');
        document.body.style.overflow = '';
        currentOrderId = null;
        currentOrderData = null;
        formSnapshot = null;
    }

    function hasUnsavedChanges() {
        if (!currentOrderData) return false;

        const formChanged = window.UI.isDirtyFromSnapshot(orderInfoForm, formSnapshot);
        const itemsChanged = JSON.stringify(estimateItems) !== itemsSnapshot;

        return formChanged || itemsChanged;
    }

    function requestClose() {
        if (!hasUnsavedChanges()) {
            close();
            return;
        }

        window.UI.confirm({
            title: 'Завершить редактирование?',
            text: 'Вы действительно хотите завершить редактирование? Изменения не сохранятся.',
            okText: 'Завершить',
            cancelText: 'Остаться',
            danger: true
        }).then(confirmed => {
            if (confirmed) close();
        });
    }

    const copyOrderBtn = document.getElementById('copyOrderBtn');
    const copyOrderModal = document.getElementById('copyOrderModal');
    const copyOrderModalCloseBtn = document.getElementById('copyOrderModalCloseBtn');
    const copyOrderCancelBtn = document.getElementById('copyOrderCancelBtn');
    const copyOrderConfirmBtn = document.getElementById('copyOrderConfirmBtn');
    const copyOrderDate = document.getElementById('copyOrderDate');
    const copyOrderKeepDate = document.getElementById('copyOrderKeepDate');
    const copyOrderHint = document.getElementById('copyOrderHint');

    function openCopyModal() {
        if (!currentOrderId || !copyOrderModal) return;

        copyOrderModal.classList.add('active');
        copyOrderDate.value = '';
        copyOrderKeepDate.checked = false;
        copyOrderDate.disabled = false;

        if (copyOrderHint) {
            const sourceDate = currentOrderData && currentOrderData.date
                ? 'Текущая дата заказа: ' + currentOrderData.date.split('-').reverse().join('.') + '.'
                : 'У заказа дата не указана.';
            copyOrderHint.textContent = sourceDate + ' Все данные будут скопированы, кроме даты.';
        }

        const base = currentOrderData && currentOrderData.date ? new Date(currentOrderData.date) : new Date();

        if (isNaN(base.getTime())) {
            copyOrderDate.value = '';
        } else {
            base.setDate(base.getDate() + 1);
            copyOrderDate.value = base.toISOString().split('T')[0];
        }

        setTimeout(() => copyOrderDate.focus(), 100);
    }

    function closeCopyModal() {
        if (copyOrderModal) copyOrderModal.classList.remove('active');
    }

    if (copyOrderBtn) {
        copyOrderBtn.addEventListener('click', openCopyModal);
    }

    if (copyOrderModalCloseBtn) {
        copyOrderModalCloseBtn.addEventListener('click', closeCopyModal);
    }

    if (copyOrderCancelBtn) {
        copyOrderCancelBtn.addEventListener('click', closeCopyModal);
    }

    if (copyOrderModal) {
        copyOrderModal.addEventListener('click', function(e) {
            if (e.target === this) closeCopyModal();
        });
    }

    if (copyOrderKeepDate) {
        copyOrderKeepDate.addEventListener('change', function() {
            copyOrderDate.disabled = this.checked;
        });
    }

    if (editOrderDate) {
        editOrderDate.addEventListener('change', function() {
            loadPricePeriod();
        });
    }

    if (copyOrderConfirmBtn) {
        copyOrderConfirmBtn.addEventListener('click', function() {
            if (!currentOrderId) return;

            const keepDate = copyOrderKeepDate && copyOrderKeepDate.checked;
            const dateValue = keepDate ? (currentOrderData && currentOrderData.date ? currentOrderData.date : '') : copyOrderDate.value;

            if (!keepDate && !dateValue) {
                showToast('Выберите дату копии или включите сохранение текущей даты');
                return;
            }

            fetch(`/orders/${currentOrderId}/copy/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams({
                    date: dateValue,
                    date_mode: keepDate ? 'keep' : 'set'
                })
            })
            .then(r => r.json())
            .then(data => {
                if (data.error) { showToast(data.error); return; }

                if (data.success) {
                    showToast('Заказ скопирован');
                    closeCopyModal();
                    if (window.renderOrders) window.renderOrders(); else location.reload();
                }
            })
            .catch(err => { showToast('Ошибка копирования'); console.error(err); });
        });
    }

    function resetForm() {
        if (currentOrderData) {
            populateForm(currentOrderData);
        }
    }

    function populateForm(data) {
        editOrderName.value = data.name || '';
        editOrderDate.value = data.date || '';

        if (data.client_id) {
            let option = editOrderClient.querySelector(`option[value="${data.client_id}"]`);

            if (!option) {
                option = document.createElement('option');
                option.value = data.client_id;
                option.textContent = data.client_name || ('Клиент #' + data.client_id);
                editOrderClient.appendChild(option);
            }

            option.selected = true;
            editOrderClient.value = String(data.client_id);
        }

        if (window.getOrderClientPicker) {
            const picker = window.getOrderClientPicker();
            if (picker) picker.setClient(data.client_id || '');
        }
        editOrderStatus.value = data.status || 'request';
        editOrderAddress.value = data.address || '';
        editOrderContactName.value = data.contact_name || '';
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

        if (editOrderCityGroup) {
            editOrderCityGroup.value = data.city_group_id || '';
        }

        estimateItems = (data.estimate_items || []).map(i => ({...i}));
        employeeItems = (data.employee_items || []).map(i => ({...i}));

        const activeIds = new Set(allEmployees.filter(emp => emp.is_active !== false).map(emp => emp.id));

        employeeItems.forEach(item => {
            if (item.employee_id && allEmployees.length && !activeIds.has(item.employee_id)) {
                item.inactive = true;
            }
        });

        renderServices();
        renderEmployees();
        updateCostField();

        itemsSnapshot = JSON.stringify(estimateItems);
        formSnapshot = window.UI.snapshot(orderInfoForm);
    }

    function loadClientsForSelect(selectedId) {
        const params = new URLSearchParams();
        params.set('offset', '0');
        params.set('limit', '200');

        fetch(`/clients/list/?${params.toString()}`)
            .then(r => r.json())
            .then(data => {
                if (!data.clients) return;

                const known = new Set((window.allOrderClients || []).map(item => String(item.id)));

                const options = data.clients.map(c =>
                    `<option value="${c.id}">${escapeHtml(c.full_name)}${c.agency ? ' (' + escapeHtml(c.agency) + ')' : ''}</option>`
                ).join('');

                editOrderClient.innerHTML = '<option value="">Выберите клиента</option>' + options;

                let targetId = '';

                if (selectedId !== undefined && selectedId !== null && selectedId !== '') {
                    targetId = selectedId;
                } else if (currentOrderData) {
                    targetId = currentOrderData.client_id || '';
                }

                if (targetId) {
                    let option = editOrderClient.querySelector(`option[value="${targetId}"]`);

                    if (!option) {
                        const client = (window.allOrderClients || []).find(item => String(item.id) === String(targetId));

                        if (client) {
                            option = document.createElement('option');
                            option.value = client.id;
                            option.textContent = client.full_name + (client.agency ? ' (' + client.agency + ')' : '');
                            editOrderClient.appendChild(option);
                        }
                    }

                    if (option) {
                        option.selected = true;
                        editOrderClient.value = String(targetId);
                    }
                }

                if (window.getOrderClientPicker) {
                    const picker = window.getOrderClientPicker();
                    if (picker) picker.setClient(targetId);
                }

                if (data.has_more) {
                    loadClientsNextPage(data.clients.length, selectedId);
                }
            })
            .catch(err => console.error('Ошибка загрузки клиентов:', err));
    }

    function loadClientsNextPage(offset, selectedId) {
        const params = new URLSearchParams();
        params.set('offset', String(offset));
        params.set('limit', '200');

        fetch(`/clients/list/?${params.toString()}`)
            .then(r => r.json())
            .then(data => {
                if (!data.clients || !data.clients.length) return;

                const options = data.clients.map(c =>
                    `<option value="${c.id}">${escapeHtml(c.full_name)}${c.agency ? ' (' + escapeHtml(c.agency) + ')' : ''}</option>`
                ).join('');

                editOrderClient.insertAdjacentHTML('beforeend', options);

                const current = editOrderClient.value;

                if (current) {
                    editOrderClient.value = current;
                }

                if (data.has_more) {
                    loadClientsNextPage(offset + data.clients.length, selectedId);
                }
            })
            .catch(err => console.error('Ошибка загрузки клиентов:', err));
    }

    function loadCities() {
        Promise.all([
            fetch('/services/cities/').then(r => r.json()),
            fetch('/orders/city-groups/').then(r => r.json())
        ])
            .then(([citiesData, groupsData]) => {
                if (citiesData.cities) {
                    allCities = citiesData.cities;
                    const options = citiesData.cities.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
                    editOrderCity.innerHTML = '<option value="">Не выбран (Казань по умолчанию)</option>' + options;
                    if (currentOrderData) editOrderCity.value = currentOrderData.city_id || '';
                }

                if (groupsData.groups) {
                    allCityGroups = groupsData.groups;
                    cityGroupsByCity = groupsData.city_groups || {};

                    const options = groupsData.groups.map(g =>
                        `<option value="${g.id}">${escapeHtml(g.name)} (×${g.coefficient})</option>`
                    ).join('');

                    editOrderCityGroup.innerHTML = '<option value="">По городу заказа</option>' + options;
                }

                if (currentOrderData) {
                    editOrderCityGroup.value = currentOrderData.city_group_id || '';
                }

                renderCityGroupHint();
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

    function buildCatalogTreeHtml(parentId, search, parentMatched) {
        const children = allServices.filter(n => (n.parent_id || null) === parentId);
        let html = '';

        children.forEach(node => {
            const selfMatch = !search || node.name.toLowerCase().includes(search);
            const matched = parentMatched || selfMatch;

            if (node.type === 'service') {
                if (!matched) return;
                const isAdded = estimateItems.some(it => it.service_id === node.id);
                html += `
                    <li>
                        <div class="service-catalog-item ${isAdded ? 'added' : ''}" data-service-id="${node.id}">
                            <div class="service-catalog-info">
                                <div class="service-catalog-name">${escapeHtml(node.name)}</div>
                                <div class="service-catalog-meta">${escapeHtml(getPriceRangeLabel(node))}</div>
                            </div>
                            <button class="add-service-catalog-btn" data-service-id="${node.id}" title="Добавить в заказ">+</button>
                        </div>
                    </li>
                `;
                return;
            }

            const childrenHtml = buildCatalogTreeHtml(node.id, search, matched);
            if (search && !matched && childrenHtml === '') return;

            const isCollapsed = !search && !expandedCats.has(node.id);
            html += `
                <li>
                    <div class="svc-cat" data-cat-id="${node.id}">
                        <svg class="svc-toggle ${isCollapsed ? '' : 'expanded'}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                        <svg class="svc-folder" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span class="svc-cat-name">${escapeHtml(node.name)}</span>
                    </div>
                    <ul class="svc-tree-children ${isCollapsed ? 'collapsed' : ''}">${childrenHtml}</ul>
                </li>
            `;
        });

        return html;
    }

    function renderServicesCatalogPanel() {
        const search = (serviceSearchInput.value || '').toLowerCase().trim();
        const html = buildCatalogTreeHtml(null, search, false);

        if (!html) {
            servicesCatalogList.innerHTML = '<div style="padding:1rem;text-align:center;color:#7a7267;font-size:0.85rem;">Услуги не найдены</div>';
            return;
        }

        servicesCatalogList.innerHTML = `<ul class="svc-tree">${html}</ul>`;
    }

    if (servicesCatalogList) {
        servicesCatalogList.addEventListener('click', function(e) {
            const addBtn = e.target.closest('.add-service-catalog-btn');
            if (addBtn) {
                e.stopPropagation();
                addServiceToEstimate(parseInt(addBtn.dataset.serviceId));
                return;
            }

            const cat = e.target.closest('.svc-cat');
            if (cat) {
                const id = parseInt(cat.dataset.catId);
                if (expandedCats.has(id)) expandedCats.delete(id);
                else expandedCats.add(id);
                renderServicesCatalogPanel();
                return;
            }

            const item = e.target.closest('.service-catalog-item');
            if (item) {
                addServiceToEstimate(parseInt(item.dataset.serviceId));
            }
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

        const rows = getSortedRows(service);
        const minRow = rows.length > 0 ? rows[0] : null;

        estimateItems.push({
            service_id: serviceId,
            name: service.name,
            people_count: minRow ? minRow.artist_count : 0,
            coefficient: 1,
            price: minRow ? applyPricePeriod(minRow.cost) : 0,
            comment: '',
            overridden: false,
        });

        refreshEmployeeDefaults();
        renderServices();
        renderEmployees();
    }

    function recalcServicePrice(index) {
        const item = estimateItems[index];
        if (!item || !item.service_id) return;
        const service = allServices.find(s => s.id === item.service_id);
        const row = pickRow(service, item.people_count);
        item.price = row ? applyPricePeriod(row.cost) : 0;
        item.overridden = false;
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
                    <input type="number" class="cell-input cell-input--price ${item.overridden ? 'cell-input--overridden' : ''}" step="0.01" min="0"
                           value="${item.price}" data-field="price" data-index="${index}"
                           title="${item.overridden ? 'Стоимость изменена вручную' : ''}">
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

                estimateItems[index][field] = value;

                if (field === 'people_count') {
                    recalcServicePrice(index);
                    renderServices();
                } else if (field === 'price') {
                    estimateItems[index].overridden = true;
                    renderServices();
                } else {
                    updateServicesTotal();
                }
            });
        });

        servicesTableBody.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.removeIndex);
                estimateItems.splice(index, 1);
                refreshEmployeeDefaults();
                renderServices();
                renderEmployees();
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
            if (emp.is_active === false) return false;
            if (!search) return true;
            const label = (roleLabels[emp.role] || emp.role || '').toLowerCase();
            return emp.full_name.toLowerCase().includes(search) || label.includes(search);
        });

        if (filteredEmployees.length === 0) {
            employeesListPanel.innerHTML = '<div style="padding:1rem;text-align:center;color:#7a7267;font-size:0.85rem;">Сотрудники не найдены</div>';
            return;
        }

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

        const def = getDefaultPaymentByRole(rawRole);

        employeeItems.push({
            employee_id: id,
            name: name,
            role: roleLabel,
            payment: def !== null ? def : 0,
            overridden: false,
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

        employeesTableBody.innerHTML = employeeItems.map((item, index) => {
            const def = getDefaultPaymentForItem(item);
            const title = item.overridden && def !== null
                ? `Ставка изменена вручную. Ставка по шоу: ${formatPrice(def)}`
                : '';
            const isInactive = item.inactive === true;
            return `
            <tr data-index="${index}" class="${item.overridden ? 'row-overridden' : ''} ${isInactive ? 'row-inactive-employee' : ''}">
                <td>
                    ${escapeHtml(item.name)}
                    ${item.overridden ? '<span class="override-badge">Ставка изменена</span>' : ''}
                    ${isInactive ? '<span class="inactive-badge">Деактивирован</span>' : ''}
                </td>
                <td>${escapeHtml(item.role)}</td>
                <td>
                    <input type="number" class="cell-input cell-input--price ${item.overridden ? 'cell-input--overridden' : ''}" step="0.01" min="0"
                           value="${item.payment}" data-field="payment" data-index="${index}" title="${escapeHtml(title)}">
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
        `;
        }).join('');

        attachEmployeeTableEvents();
        updateEmployeesTotal();
    }

    function attachEmployeeTableEvents() {
        employeesTableBody.querySelectorAll('.cell-input').forEach(input => {
            input.addEventListener('change', function() {
                const index = parseInt(this.dataset.index);
                const field = this.dataset.field;
                let value = this.value;
                if (field === 'payment') {
                    value = parseFloat(value) || 0;
                    employeeItems[index].payment = value;
                    const def = getDefaultPaymentForItem(employeeItems[index]);
                    employeeItems[index].overridden = def !== null && Math.abs(value - def) > 0.005;
                    renderEmployees();
                    return;
                }
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
        return getServicesTotal();
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

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', function() {
            if (!currentOrderData) return;

            window.UI.confirm({
                title: 'Отменить изменения?',
                text: 'Все несохранённые изменения будут отменены.',
                okText: 'Отменить изменения',
                cancelText: 'Остаться',
                danger: true
            }).then(confirmed => {
                if (!confirmed) return;

                costOverride = false;
                manualCost = '';

                if (overrideCostBtn) overrideCostBtn.classList.remove('active');
                if (editOrderCost) {
                    editOrderCost.readOnly = true;
                    editOrderCost.classList.add('form-input--readonly');
                }

                resetForm();
                showToast('Изменения отменены');
            });
        });
    }

    if (deleteOrderBtn) {
        deleteOrderBtn.addEventListener('click', function() {
            if (!currentOrderId) return;

            window.UI.confirm({
                title: 'Удалить заказ?',
                text: 'Заказ будет удалён из расписания и списка заказов. Действие необратимо.',
                okText: 'Удалить',
                cancelText: 'Отмена',
                danger: true
            }).then(confirmed => {
                if (!confirmed) return;

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

                        if (window.renderOrders) {
                            window.renderOrders();
                        } else {
                            location.reload();
                        }
                    }
                })
                .catch(err => { showToast('Ошибка удаления'); console.error(err); });
            });
        });
    }

    if (editOrderCity) {
        editOrderCity.addEventListener('change', function() {
            if (editOrderCityGroup && editOrderCityGroup.value) {
                editOrderCityGroup.value = '';
            }

            renderCityGroupHint();
            recalcEstimatePrices();
        });
    }

    if (editOrderCityGroup) {
        editOrderCityGroup.addEventListener('change', function() {
            renderCityGroupHint();
            recalcEstimatePrices();
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
                city_group_id: editOrderCityGroup ? editOrderCityGroup.value : '',
                status: editOrderStatus.value,
                address: editOrderAddress.value.trim(),
                contact_name: editOrderContactName.value.trim(),
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
            if (!data.client_id) { showToast('Выберите клиента из списка'); return; }

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

                    formSnapshot = window.UI.snapshot(orderInfoForm);
                    itemsSnapshot = JSON.stringify(estimateItems);

                    if (currentOrderData) {
                        currentOrderData = Object.assign({}, currentOrderData, res.order || {});
                    }

                    if (window.renderOrders) window.renderOrders(); else location.reload();
                }
            })
            .catch(err => { showToast('Ошибка сохранения'); console.error(err); });
        });
    }

    window.OrderEditor = {
        open: open,
        close: close,
        loadEmployees: loadEmployeesForSelects,
        loadClients: loadClientsForSelect
    };

    document.addEventListener('DOMContentLoaded', function() {
        loadEmployeesForSelects();
        loadClientsForSelect();
        loadCities();
    });

    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (document.getElementById('uiConfirmModal')) return;

        if (copyOrderModal && copyOrderModal.classList.contains('active')) {
            e.preventDefault();
            closeCopyModal();
            return;
        }

        if (editorModal.classList.contains('active')) {
            e.preventDefault();
            requestClose();
        }
    }, true);

    const editorCloseBtn = document.getElementById('editorModalCloseBtn');

    if (editorCloseBtn) {
        editorCloseBtn.addEventListener('click', requestClose);
    }

    if (editorModal) {
        editorModal.addEventListener('click', function(e) {
            if (e.target === this) requestClose();
        });
    }
})();