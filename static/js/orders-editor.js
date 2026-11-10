(function() {
    let currentOrderId = null;
    let currentOrderData = null;
    let estimateItems = [];
    let employeeItems = [];
    let allEmployees = [];
    let employeeAvailability = {};
    let allServices = [];
    let allCities = [];
    let allCityGroups = [];
    let cityGroupsByCity = {};
    let filteredEmployees = [];
    let expandedCats = new Set();
    let costOverride = false;
    let manualCost = '';
    let servicesTotalManual = false;
    let servicesTotalManualBase = 0;
    let servicesTotalBaseMaterial = 0;
    let servicesTotalOpen = false;
    let pricePeriodPercent = 0;
    let pricePeriodInfo = null;
    let formSnapshot = null;
    let itemsSnapshot = '[]';
    let isSavingOrder = false;
    let isSavingPayment = false;
    let isSavingExpense = false;
    let saveBtnLocked = false;
    let saveWatchdog = null;

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
    const editOrderChat = document.getElementById('editOrderChat');
    const editOrderStart = document.getElementById('editOrderStart');
    const editOrderEnd = document.getElementById('editOrderEnd');
    const editOrderPaymentDue = document.getElementById('editOrderPaymentDue');
    const editOrderPaymentComment = document.getElementById('editOrderPaymentComment');
    const orderPaymentsList = document.getElementById('orderPaymentsList');
    const orderPaymentsTotal = document.getElementById('orderPaymentsTotal');
    const orderPaymentDate = document.getElementById('orderPaymentDate');
    const orderPaymentAmount = document.getElementById('orderPaymentAmount');
    const orderPaymentComment = document.getElementById('orderPaymentComment');
    const orderPaymentAddBtn = document.getElementById('orderPaymentAddBtn');

    let orderPayments = [];
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
    const editOrderManagerAdd = document.getElementById('editOrderManagerAdd');
    const editOrderManagerChips = document.getElementById('editOrderManagerChips');
    const editOrderExtraManagersGroup = document.getElementById('editOrderExtraManagersGroup');
    const editOrderCost = document.getElementById('editOrderCost');
    const editOrderPaymentMethod = document.getElementById('editOrderPaymentMethod');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    const servicesCatalogList = document.getElementById('servicesCatalogList');
    const servicesTableBody = document.getElementById('servicesTableBody');
    const servicesTotal = document.getElementById('servicesTotal');
    const serviceSearchInput = document.getElementById('serviceSearchInput');

    const orderEditorTabs = document.getElementById('orderEditorTabs');
    const modalBody = document.querySelector('#orderEditorModal .modal__body');

    const orderChecklistList = document.getElementById('orderChecklistList');
    const orderChecklistProgress = document.getElementById('orderChecklistProgress');
    const orderChecklistBadge = document.getElementById('orderChecklistBadge');
    const orderChecklistTemplateInput = document.getElementById('orderChecklistTemplateInput');
    const orderChecklistTemplateDropdown = document.getElementById('orderChecklistTemplateDropdown');

    let orderChecklist = { items: [], groups: [], shows: [], can_edit: false, total: 0, done: 0 };
    let checklistTemplates = [];
    let expandedChecklists = {};
    let checklistPickerIndex = -1;
    let checklistPickerItems = [];

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

        if (cookieValue) return cookieValue[2];

        return window.__csrfToken || '';
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
        return window.UI.formatMoney(num);
    }

    function autoSizeConcept() {
        if (!editOrderConcept) return;

        editOrderConcept.style.height = 'auto';
        editOrderConcept.style.height = Math.max(editOrderConcept.scrollHeight, 38) + 'px';
    }

    function switchTab(tabName) {
        if (!orderEditorTabs) return;

        orderEditorTabs.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        if (modalBody) {
            modalBody.querySelectorAll('.tab-content').forEach(node => {
                node.classList.toggle('active', node.id === 'tab-' + tabName);
            });
        }
    }

    function updateEditorTitle(data) {
        if (!editorOrderTitle) return;

        editorOrderTitle.textContent = data.name || ('Заказ #' + data.id);

        const subtitle = document.getElementById('editorOrderSubtitle');

        if (subtitle) {
            const meta = [];

            if (data.date_display) meta.push(data.date_display);
            if (data.city_name) meta.push(data.city_name);

            subtitle.textContent = meta.join(' · ');
            subtitle.style.display = meta.length ? 'block' : 'none';
        }
    }

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

    function mountEditCityPicker() {
        const wrapper = document.getElementById('editOrderCityPicker');
        const input = document.getElementById('editOrderCityInput');
        const dropdown = document.getElementById('editOrderCityDropdown');
        const hidden = document.getElementById('editOrderCity');

        if (!wrapper || !input || !dropdown || !hidden || wrapper.dataset.mounted === '1') return;

        wrapper.dataset.mounted = '1';

        let suggestions = [];
        let index = -1;
        let timer = null;
        let counter = 0;

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            index = -1;
        }

        function pick(city) {
            hidden.value = city.id || '';
            input.value = city.name || '';
            close();
            hidden.dispatchEvent(new Event('city-changed'));
        }

        function createCity(name) {
            const trimmed = (name || '').trim();

            if (!trimmed) return;

            const existing = suggestions.find(city => city.name.toLowerCase() === trimmed.toLowerCase());

            if (existing) {
                pick(existing);
                return;
            }

            fetch('/orders/cities/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken(),
                },
                body: new URLSearchParams({ name: trimmed }),
            })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                pick({ id: data.city.id, name: data.city.name });
                showToast('Город «' + data.city.name + '» добавлен');
            })
            .catch(() => showToast('Не удалось создать город'));
        }

        function render(query) {
            dropdown.innerHTML = '';

            const trimmed = (query || '').trim();
            const exact = suggestions.some(city => city.name.toLowerCase() === trimmed.toLowerCase());

            suggestions.forEach((city, position) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'single-city-picker__option' + (position === index ? ' active' : '');

                const name = document.createElement('span');
                name.className = 'single-city-picker__name';
                name.textContent = city.name;
                option.appendChild(name);

                if (city.subject) {
                    const subject = document.createElement('span');
                    subject.className = 'single-city-picker__subject';
                    subject.textContent = city.subject;
                    option.appendChild(subject);
                }

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    pick(city);
                });

                dropdown.appendChild(option);
            });

            if (trimmed && !exact) {
                const create = document.createElement('button');
                create.type = 'button';
                create.className = 'single-city-picker__option single-city-picker__option--create';
                create.textContent = 'Создать город «' + trimmed + '»';
                create.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    createCity(trimmed);
                });
                dropdown.appendChild(create);
            }

            dropdown.classList.toggle('open', dropdown.children.length > 0);
        }

        function load(query) {
            const current = ++counter;

            const params = new URLSearchParams();
            params.set('search', query);
            params.set('limit', '20');

            fetch('/clients/cities/?' + params.toString(), { cache: 'no-store' })
                .then(r => r.json())
                .then(data => {
                    if (current !== counter) return;
                    suggestions = data.cities || [];
                    index = -1;
                    render(query);
                })
                .catch(() => {});
        }

        input.addEventListener('input', function() {
            hidden.value = '';

            const query = this.value.trim();
            clearTimeout(timer);
            timer = setTimeout(() => load(query), 180);
        });

        input.addEventListener('focus', function() {
            clearTimeout(timer);
            timer = setTimeout(() => load(this.value.trim()), 60);
        });

        input.addEventListener('keydown', function(e) {
            const options = dropdown.querySelectorAll('.single-city-picker__option');

            if (e.key === 'ArrowDown' && options.length) {
                e.preventDefault();
                index = (index + 1) % options.length;
                options.forEach((option, position) => option.classList.toggle('active', position === index));
            } else if (e.key === 'ArrowUp' && options.length) {
                e.preventDefault();
                index = index <= 0 ? options.length - 1 : index - 1;
                options.forEach((option, position) => option.classList.toggle('active', position === index));
            } else if (e.key === 'Enter') {
                e.preventDefault();

                const active = index >= 0 ? options[index] : options[0];

                if (active && !active.classList.contains('single-city-picker__option--create')) {
                    active.dispatchEvent(new MouseEvent('mousedown'));
                } else {
                    createCity(this.value);
                }
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                close();
            }
        });

        document.addEventListener('click', function(e) {
            if (!wrapper.contains(e.target)) close();
        });

        window.editOrderCityPicker = {
            setValue: function(id, name) {
                hidden.value = id || '';
                input.value = name || '';
                close();
            },
            getValue: function() {
                return { id: hidden.value, name: input.value.trim() };
            }
        };
    }

    mountEditCityPicker();

    function canManageOrders() {
        return document.body.dataset.canManageOrders === '1';
    }

    function open(orderId) {
        if (!canManageOrders()) {
            showToast('У вас нет прав на редактирование заказов');
            return false;
        }

        currentOrderId = orderId;
        costOverride = false;
        manualCost = '';
        resetServicesTotalOverride();
        pricePeriodPercent = 0;
        pricePeriodInfo = null;
        isSavingOrder = false;
        isSavingPayment = false;
        isSavingExpense = false;
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
                updateEditorTitle(data);
                editorModal.classList.add('active');
                document.body.style.overflow = 'hidden';
                switchTab('info');
                loadPricePeriod();
                loadServicesList();
                loadChecklist();
                loadChecklistTemplates();
                loadEmployeesList();
                loadEmployeeAvailability();
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
        itemsSnapshot = '[]';

        estimateItems = [];
        employeeItems = [];
        employeeAvailability = {};
        costOverride = false;
        manualCost = '';
        resetServicesTotalOverride();

        if (typeof orderExpenses !== 'undefined') {
            orderExpenses = [];
        }

        if (typeof orderPayments !== 'undefined') {
            orderPayments = [];
        }

        if (orderEditorTabs) {
            orderEditorTabs.querySelectorAll('.tab-btn[data-show-index]').forEach(btn => btn.remove());
            orderEditorTabs.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === 'info');
            });
        }

        if (modalBody) {
            modalBody.querySelectorAll('.tab-content[data-show-index]').forEach(node => node.remove());
            modalBody.querySelectorAll('.tab-content').forEach(node => {
                node.classList.toggle('active', node.id === 'tab-info');
            });
        }

        const subtitle = document.getElementById('editorOrderSubtitle');

        if (subtitle) {
            subtitle.textContent = '';
            subtitle.style.display = 'none';
        }
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

        copyOrderModal.classList.add('modal-overlay--stacked');
        copyOrderModal.style.zIndex = '2600';
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
        if (copyOrderModal) {
            copyOrderModal.classList.remove('active');
            copyOrderModal.classList.remove('modal-overlay--stacked');
            copyOrderModal.style.zIndex = '';
        }
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
            loadEmployeeAvailability();
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

                    if (window.refreshSchedule) {
                        window.refreshSchedule(true);
                    }
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

    const orderExpensesList = document.getElementById('orderExpensesList');
    const orderExpensesTotal = document.getElementById('orderExpensesTotal');
    const orderExpenseModal = document.getElementById('orderExpenseModal');
    const orderExpenseForm = document.getElementById('orderExpenseForm');
    const orderExpensePayer = document.getElementById('orderExpensePayer');
    const orderExpenseAmount = document.getElementById('orderExpenseAmount');
    const orderExpenseComment = document.getElementById('orderExpenseComment');
    const orderExpenseModalTitle = document.getElementById('orderExpenseModalTitle');
    const orderExpenseDeleteBtn = document.getElementById('orderExpenseDeleteBtn');

    let orderExpenses = [];
    let editingExpenseId = null;
    let expenseModalSnapshot = null;

    function formatExpenseMoney(value) {
        return window.UI.formatMoney(value);
    }

    function formatPaymentMoney(value) {
        return window.UI.formatMoney(value);
    }

    function renderOrderPayments() {
        if (!orderPaymentsList) return;

        const active = orderPayments.filter(item => !item.is_cancelled);
        const total = active.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        if (orderPaymentsTotal) {
            orderPaymentsTotal.textContent = formatPaymentMoney(total);
        }

        if (!orderPayments.length) {
            orderPaymentsList.innerHTML = '<div class="order-payments__empty">Оплаты не зафиксированы</div>';
            return;
        }

        orderPaymentsList.innerHTML = orderPayments.map(item => `
            <div class="order-payment${item.is_cancelled ? ' order-payment--cancelled' : ''}">
                <span class="order-payment__date">${escapeHtml(item.paid_at_display || item.paid_at)}</span>
                <span class="order-payment__amount">${formatPaymentMoney(item.amount)}</span>
                <span class="order-payment__comment">${escapeHtml(item.comment || '')}</span>
                <span class="order-payment__author">${escapeHtml(item.created_by || '')}</span>
                ${item.is_cancelled ? '<span class="order-payment__status">Отменена</span>' : `<button type="button" class="order-payment__remove" data-payment-cancel="${item.id}">Отменить</button>`}
            </div>
        `).join('');

        orderPaymentsList.querySelectorAll('[data-payment-cancel]').forEach(button => {
            button.addEventListener('click', function () {
                const paymentId = this.getAttribute('data-payment-cancel');

                fetch(`/orders/${currentOrderId}/payment/?id=${paymentId}`, {
                    method: 'DELETE',
                    headers: { 'X-CSRFToken': getCSRFToken() },
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        showToast(data.error);
                        return;
                    }

                    const target = orderPayments.find(item => String(item.id) === String(paymentId));
                    if (target) target.is_cancelled = true;
                    renderOrderPayments();
                })
                .catch(() => showToast('Не удалось отменить оплату'));
            });
        });
    }

    function addOrderPayment() {
        if (!currentOrderId) return;

        const amount = orderPaymentAmount ? orderPaymentAmount.value.trim() : '';

        if (!amount) {
            showToast('Укажите сумму оплаты');
            return;
        }

        persistOrderPayment(orderPaymentAddBtn, 'Добавление...');
    }

    function persistOrderPayment(button, busyLabel) {
        if (!currentOrderId) return;

        const amount = orderPaymentAmount ? orderPaymentAmount.value.trim() : '';

        if (!amount) {
            return;
        }

        if (isSavingPayment) return;

        isSavingPayment = true;

        if (button) {
            window.UI.setButtonBusy(button, true, busyLabel || 'Сохранение...');
        }

        const body = new URLSearchParams({
            amount: amount,
            paid_at: orderPaymentDate ? orderPaymentDate.value : '',
            comment: orderPaymentComment ? orderPaymentComment.value.trim() : '',
        });

        fetch(`/orders/${currentOrderId}/payment/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken(),
            },
            body: body,
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showToast(data.error);
                return;
            }

            orderPayments.push({ ...data.payment });
            if (orderPaymentAmount) orderPaymentAmount.value = '';
            if (orderPaymentComment) orderPaymentComment.value = '';
            renderOrderPayments();

            if (window.refreshSchedule) window.refreshSchedule(true);
        })
        .catch(() => showToast('Не удалось зафиксировать оплату'))
        .finally(() => {
            isSavingPayment = false;

            if (button) {
                window.UI.setButtonBusy(button, false);
            }
        });
    }

    function renderOrderExpenses() {
        if (!orderExpensesList) return;

        const badge = document.getElementById('orderExpensesBadge');

        if (badge) {
            badge.textContent = orderExpenses.length ? String(orderExpenses.length) : '';
            badge.style.display = orderExpenses.length ? 'inline-flex' : 'none';
        }

        const total = orderExpenses.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const pending = orderExpenses.filter(item => item.status === 'pending').length;

        if (orderExpensesTotal) {
            orderExpensesTotal.innerHTML = orderExpenses.length
                ? `<span class="order-expenses__total-value">${formatExpenseMoney(total)}</span>
                   <span class="order-expenses__total-meta">${orderExpenses.length} ${orderExpenses.length === 1 ? 'расход' : 'расходов'}${pending ? ' · ' + pending + ' на рассмотрении' : ''}</span>`
                : '';
        }

        if (!orderExpenses.length) {
            orderExpensesList.innerHTML = `
                <div class="order-expenses__empty">
                    <span>Расходов пока нет</span>
                    <span class="order-expenses__empty-hint">Такси, корпоративные траты, материалы — добавьте их здесь</span>
                </div>
            `;
            return;
        }

        orderExpensesList.innerHTML = orderExpenses.map(item => `
            <button type="button" class="order-expense" data-expense-edit="${item.id}">
                <span class="order-expense__top">
                    <span class="order-expense__payer">${escapeHtml(item.payer_name)}</span>
                    <span class="order-expense__amount">${formatExpenseMoney(item.amount)}</span>
                </span>
                <span class="order-expense__comment">${escapeHtml(item.comment || 'Без комментария')}</span>
                <span class="order-expense__bottom">
                    <span class="order-expense__status order-expense__status--${item.status_class}">${escapeHtml(item.status_display)}</span>
                    ${item.created_by ? `<span class="order-expense__author">${escapeHtml(item.created_by)}</span>` : ''}
                </span>
            </button>
        `).join('');

        orderExpensesList.querySelectorAll('[data-expense-edit]').forEach(btn => {
            btn.addEventListener('click', function() {
                openExpenseModal(parseInt(this.dataset.expenseEdit, 10));
            });
        });
    }

    function openExpenseModal(expenseId) {
        if (!orderExpenseModal) return;

        editingExpenseId = expenseId || null;
        orderExpenseForm.reset();

        if (editingExpenseId) {
            const item = orderExpenses.find(row => row.id === editingExpenseId);

            if (!item) return;

            orderExpenseModalTitle.textContent = 'Изменить расход';
            orderExpenseDeleteBtn.style.display = '';
            orderExpensePayer.value = item.payer_name;
            orderExpenseAmount.value = item.amount;
            orderExpenseComment.value = item.comment || '';
        } else {
            orderExpenseModalTitle.textContent = 'Новый расход';
            orderExpenseDeleteBtn.style.display = 'none';
        }

        expenseModalSnapshot = captureExpenseSnapshot();
        orderExpenseModal.classList.add('active');
        setTimeout(() => orderExpensePayer.focus(), 60);
    }

    function closeExpenseModal() {
        if (!orderExpenseModal) return;

        orderExpenseModal.classList.remove('active');
        editingExpenseId = null;
        expenseModalSnapshot = null;
    }

    function captureExpenseSnapshot() {
        const data = {};

        [orderExpensePayer, orderExpenseAmount, orderExpenseComment].forEach(function(field, index) {
            if (!field) return;
            data['field_' + index] = (field.value || '').trim();
        });

        return data;
    }

    function isExpenseModalDirty() {
        if (!orderExpenseModal || !expenseModalSnapshot) return false;

        const current = captureExpenseSnapshot();

        return Object.keys(current).some(function(key) {
            return String(current[key]) !== String(expenseModalSnapshot[key] || '');
        });
    }

    function requestCloseExpenseModal() {
        if (!orderExpenseModal) return;

        if (!isExpenseModalDirty()) {
            closeExpenseModal();
            return;
        }

        window.UI.confirm({
            title: 'Завершить редактирование?',
            text: 'Вы действительно хотите завершить редактирование? Изменения не сохранятся.',
            okText: 'Завершить',
            cancelText: 'Остаться',
            danger: true
        }).then(confirmed => {
            if (confirmed) closeExpenseModal();
        });
    }

    function submitExpense(e) {
        e.preventDefault();

        if (!currentOrderId) return;

        if (isSavingExpense) return;

        isSavingExpense = true;

        const submitBtn = orderExpenseForm ? orderExpenseForm.querySelector('[type="submit"]') : null;

        if (submitBtn) {
            window.UI.setButtonBusy(submitBtn, true, 'Сохранение...');
        }

        const formData = new FormData();
        formData.append('payer_name', orderExpensePayer.value.trim());
        formData.append('amount', orderExpenseAmount.value);
        formData.append('comment', orderExpenseComment.value.trim());

        if (editingExpenseId) {
            formData.append('id', editingExpenseId);
        }

        fetch(`/orders/${currentOrderId}/expense/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCSRFToken() },
            body: formData
        })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                const saved = data.expense;
                const index = orderExpenses.findIndex(row => row.id === saved.id);

                if (index >= 0) {
                    orderExpenses[index] = saved;
                } else {
                    orderExpenses.unshift(saved);
                }

                renderOrderExpenses();
                closeExpenseModal();
                showToast(editingExpenseId ? 'Расход обновлён' : 'Расход добавлен');
                switchTab('expenses');
            })
            .catch(() => showToast('Ошибка сохранения расхода'))
            .finally(() => {
                isSavingExpense = false;

                if (submitBtn) {
                    window.UI.setButtonBusy(submitBtn, false);
                }
            });
    }

    function deleteExpense() {
        if (!currentOrderId || !editingExpenseId) return;

        const expenseId = editingExpenseId;

        window.UI.confirm({
            title: 'Удалить расход',
            text: 'Расход будет удалён безвозвратно.',
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true,
        }).then(confirmed => {
            if (!confirmed) return;

            fetch(`/orders/${currentOrderId}/expense/?id=${expenseId}`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCSRFToken() }
            })
                .then(r => r.json())
                .then(data => {
                    if (data.error) {
                        showToast(data.error);
                        return;
                    }

                    orderExpenses = orderExpenses.filter(row => row.id !== expenseId);
                    renderOrderExpenses();
                    closeExpenseModal();
                    showToast('Расход удалён');
                })
                .catch(() => showToast('Ошибка удаления'));
        });
    }

    function populateForm(data) {
        costOverride = false;
        manualCost = '';
        resetServicesTotalOverride();

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
        if (editOrderChat) editOrderChat.value = data.chat_number || '';
        if (editOrderStart) editOrderStart.value = data.start_datetime || '';
        if (editOrderEnd) editOrderEnd.value = data.end_datetime || '';
        if (window.editOrderCityPicker) window.editOrderCityPicker.setValue(data.city_id, data.city_name);
        if (editOrderPaymentDue) editOrderPaymentDue.value = data.payment_due_date || '';
        if (editOrderPaymentComment) editOrderPaymentComment.value = data.payment_due_comment || '';
        orderPayments = (data.payments || []).map(item => ({ ...item }));
        renderOrderPayments();
        editOrderDressingRoom.value = data.dressing_room_comment || '';
        editOrderMeal.value = data.meal_comment || '';
        editOrderConcept.value = data.concept || '';
        setTimeout(autoSizeConcept, 0);

        editOrderTechLamps.checked = data.tech_lamps || false;
        editOrderTechLaser.checked = data.tech_laser || false;
        editOrderTechHazer.checked = data.tech_hazer || false;
        editOrderTechGrid.checked = data.tech_grid || false;
        editOrderTechProjection.checked = data.tech_projection || false;
        editOrderTechComment.value = data.tech_comment || '';
        editOrderVenueComment.value = data.venue_comment || '';
        editOrderPropsComment.value = data.props_comment || '';
        editOrderManager.value = data.manager_id || '';
        extraManagerIds = (data.manager_ids || [])
            .map(item => String(item))
            .filter(item => String(item) !== String(data.manager_id || ''));
        editOrderPaymentMethod.value = data.payment_method || '';

        const managerGroup = document.getElementById('editOrderManagerGroup');

        if (managerGroup) {
            managerGroup.style.display = canManageOrders() ? '' : 'none';
        }

        if (editOrderExtraManagersGroup) {
            editOrderExtraManagersGroup.style.display = canManageOrders() ? '' : 'none';
        }

        renderExtraManagers();

        renderPaymentTax();

        if (editOrderCityGroup) {
            editOrderCityGroup.value = data.city_group_id || '';
        }

        orderExpenses = (data.expenses || []).map(item => ({...item}));
        renderOrderExpenses();

        estimateItems = (data.estimate_items || []).map(i => ({
            ...i,
            people_count_unknown: !!i.people_count_unknown,
            is_main: !!i.is_main,
        }));

        const idToIndex = new Map(estimateItems.map((item, index) => [String(item.id), index]));

        employeeItems = (data.employee_items || []).map(i => {
            let showIndex = null;

            if (i.show_id !== null && i.show_id !== undefined) {
                showIndex = idToIndex.has(String(i.show_id)) ? idToIndex.get(String(i.show_id)) : null;
            }

            if (showIndex === null && estimateItems.length === 1) {
                showIndex = 0;
            }

            return {
                ...i,
                show_index: showIndex,
                is_story: !!i.is_story,
                is_responsible: !!i.is_responsible,
            };
        });

        const activeIds = new Set(allEmployees.filter(emp => emp.is_active !== false).map(emp => emp.id));

        employeeItems.forEach(item => {
            if (item.employee_id && allEmployees.length && !activeIds.has(item.employee_id)) {
                item.inactive = true;
            }
        });

        renderServices();
        renderEmployees();

        if (canSeeRates() && currentOrderData && currentOrderData.cost_is_manual) {
            const stored = currentOrderData.cost && currentOrderData.cost !== '—'
                ? formatPrice(parseCostValue(currentOrderData.cost) || 0)
                : '';
            costOverride = true;
            manualCost = stored;

            if (editOrderCost) {
                editOrderCost.value = stored;
            }
        }

        updateCostField();

        itemsSnapshot = JSON.stringify(estimateItems);
        formSnapshot = window.UI.snapshot(orderInfoForm);
    }

    function loadClientsForSelect(selectedId) {
        if (!canManageOrders()) return;

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

                    if (currentOrderData && window.editOrderCityPicker) {
                        window.editOrderCityPicker.setValue(currentOrderData.city_id, currentOrderData.city_name);
                    }
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

    let extraManagerIds = [];

    const MAX_ORDER_MANAGERS = 2;

    function employeeLabelById(employeeId) {
        const employee = allEmployees.find(item => String(item.id) === String(employeeId));

        return employee ? (employee.display_name || employee.full_name) : 'Сотрудник';
    }

    function managerCount() {
        const mainId = editOrderManager ? editOrderManager.value : '';
        const ids = extraManagerIds.map(item => String(item));

        if (mainId && !ids.includes(String(mainId))) ids.push(String(mainId));

        return ids.length;
    }

    function renderExtraManagers() {
        if (!editOrderManagerChips) return;

        const mainId = editOrderManager ? editOrderManager.value : '';

        editOrderManagerChips.innerHTML = extraManagerIds.map(employeeId => `
            <span class="manager-chip" data-extra-manager="${employeeId}">
                <span class="manager-chip__name">${escapeHtml(employeeLabelById(employeeId))}</span>
                <button type="button" class="manager-chip__remove" data-extra-manager-remove="${employeeId}" aria-label="Убрать менеджера">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </span>
        `).join('');

        if (!extraManagerIds.length) {
            editOrderManagerChips.innerHTML = '<span class="manager-chips__empty">Менеджер не выбран</span>';
        }

        editOrderManagerChips.querySelectorAll('[data-extra-manager-remove]').forEach(btn => {
            btn.addEventListener('click', function() {
                const targetId = String(this.dataset.extraManagerRemove);

                extraManagerIds = extraManagerIds.filter(item => String(item) !== targetId);
                renderExtraManagers();
                fillExtraManagerOptions();
            });
        });

        fillExtraManagerOptions(mainId);
    }

    function fillExtraManagerOptions(mainId) {
        if (!editOrderManagerAdd) return;

        const selectedMain = String(mainId !== undefined ? mainId : (editOrderManager ? editOrderManager.value : ''));
        const taken = new Set(extraManagerIds.map(item => String(item)));

        if (selectedMain) taken.add(selectedMain);

        const limitReached = managerCount() >= MAX_ORDER_MANAGERS;

        editOrderManagerAdd.disabled = limitReached;

        if (limitReached) {
            editOrderManagerAdd.innerHTML = '<option value="">В заказе уже два менеджера</option>';
            return;
        }

        const options = allEmployees
            .filter(item => !taken.has(String(item.id)))
            .map(item => `<option value="${item.id}">${escapeHtml(item.display_name || item.full_name)}</option>`)
            .join('');

        editOrderManagerAdd.innerHTML = '<option value="">Выберите сотрудника</option>' + options;
    }

    if (editOrderManagerAdd) {
        editOrderManagerAdd.addEventListener('change', function() {
            const employeeId = this.value;

            if (!employeeId) return;

            if (managerCount() >= MAX_ORDER_MANAGERS) {
                showToast('В заказе может быть не больше двух менеджеров');
                this.value = '';
                fillExtraManagerOptions();
                return;
            }

            if (!extraManagerIds.some(item => String(item) === String(employeeId))) {
                extraManagerIds.push(employeeId);
            }

            this.value = '';
            renderExtraManagers();
        });
    }

    if (editOrderManager) {
        editOrderManager.addEventListener('change', function() {
            const mainId = this.value;

            extraManagerIds = extraManagerIds.filter(item => String(item) !== String(mainId));
            renderExtraManagers();
        });
    }

    function loadEmployeesForSelects() {
        if (!canManageOrders()) return;

        fetch('/employees/list/')
            .then(r => r.json())
            .then(data => {
                if (data.employees) {
                    allEmployees = data.employees;
                    const managerOptions = data.employees.map(e =>
                        `<option value="${e.id}">${escapeHtml(e.display_name || e.full_name)}</option>`
                    ).join('');
                    editOrderManager.innerHTML = '<option value="">Выберите менеджера</option>' + managerOptions;
                    if (currentOrderData) {
                        editOrderManager.value = currentOrderData.manager_id || '';
                    }
                    renderExtraManagers();
                    renderShowsTab();
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
        if (!canManageOrders()) return;

        if (allEmployees.length === 0) {
            loadEmployeesForSelects();
        } else {
            renderShowsTab();
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

    function renderServices() {
        renderShowsTab();

        if (typeof servicesTableBody !== 'undefined' && servicesTableBody) {
            if (!estimateItems.length) {
                servicesTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">Добавьте услуги из каталога</td></tr>';
            } else {
                servicesTableBody.innerHTML = estimateItems.map((item, index) => {
                    const countUnknown = item.people_count_unknown || !item.people_count;

                    return `
                        <tr data-index="${index}">
                            <td><span class="service-name-cell__title">${escapeHtml(item.name)}</span></td>
                            <td>
                                <input type="text" inputmode="numeric" class="cell-input cell-input--number"
                                       value="${countUnknown ? '' : item.people_count}" data-field="people_count" data-index="${index}"
                                       placeholder="—" ${countUnknown ? 'disabled' : ''}>
                            </td>
                            <td>
                                ${canSeeRates()
                                    ? `<input type="text" inputmode="decimal" class="cell-input cell-input--price ${item.overridden ? 'cell-input--overridden' : ''}"
                                       value="${item.price}" data-field="price" data-index="${index}">`
                                    : '<span class="cell-input cell-input--locked">—</span>'}
                            </td>
                            <td>
                                <input type="text" class="cell-input" value="${escapeHtml(item.comment || '')}"
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

                attachServicesTableEvents();
            }

            updateServicesTotal();
        }

        renderServicesCatalogPanel();
    }

    function attachServicesTableEvents() {
        if (!servicesTableBody) return;

        servicesTableBody.querySelectorAll('.cell-input').forEach(input => {
            input.addEventListener('change', function() {
                const index = parseInt(this.dataset.index, 10);
                const field = this.dataset.field;
                let value = this.value;

                if (field === 'people_count' || field === 'price') {
                    value = parseFloat(String(value).replace(',', '.')) || 0;
                }

                if (field === 'price') {
                    estimateItems[index].overridden = true;
                }

                estimateItems[index][field] = value;

                if (field === 'people_count') {
                    recalcServicePrice(index);
                    renderServices();
                } else {
                    updateServicesTotal();
                }
            });
        });

        servicesTableBody.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.removeIndex, 10);

                estimateItems.splice(index, 1);

                if (activeShowIndex >= estimateItems.length) activeShowIndex = 0;

                renderServices();
                renderEmployees();
            });
        });
    }

    function updateServicesTotal() {
        if (!servicesTotal) return;

        if (servicesTotalOpen) {
            if (document.activeElement !== servicesTotal) {
                servicesTotal.textContent = formatPrice(getServicesTotal());
            }

            updateCostField();
            return;
        }

        servicesTotal.textContent = canSeeRates() ? formatPrice(getServicesTotal()) : '—';
        updateCostField();
    }

    function renderEmployees() {
        renderShowsTab();
    }

    function getServicesTotal() {
        const material = estimateItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

        if (!servicesTotalManual) {
            return material;
        }

        return Math.max(0, servicesTotalManualBase + (material - servicesTotalBaseMaterial));
    }

    function resetServicesTotalOverride() {
        servicesTotalManual = false;
        servicesTotalManualBase = 0;
        servicesTotalBaseMaterial = 0;
    }

    function enterServicesTotalEdit() {
        if (!servicesTotal || !canSeeRates()) return;

        servicesTotalManual = true;
        servicesTotalManualBase = getServicesTotal();
        servicesTotalBaseMaterial = estimateItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
        servicesTotalOpen = true;
        servicesTotal.classList.add('services-total__value--editing');
        servicesTotal.setAttribute('contenteditable', 'true');
        servicesTotal.focus();

        const range = document.createRange();
        range.selectNodeContents(servicesTotal);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function exitServicesTotalEdit() {
        if (!servicesTotal) return;

        if (servicesTotal.getAttribute('contenteditable') !== 'true') return;

        const parsed = parseCostValue(servicesTotal.textContent);

        servicesTotalOpen = false;
        servicesTotal.removeAttribute('contenteditable');
        servicesTotal.classList.remove('services-total__value--editing');

        if (parsed !== null && parsed >= 0) {
            servicesTotalManual = true;
            servicesTotalManualBase = parsed;
            servicesTotalBaseMaterial = estimateItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
        } else {
            resetServicesTotalOverride();
        }

        servicesTotal.textContent = formatPrice(getServicesTotal());
        updateCostField();
        renderPaymentTax();
    }

    if (editOrderConcept) {
        editOrderConcept.addEventListener('input', autoSizeConcept);

        editOrderConcept.addEventListener('focus', function() {
            this.classList.add('order-comment-field--active');
            autoSizeConcept();
        });

        editOrderConcept.addEventListener('blur', function() {
            this.classList.remove('order-comment-field--active');
            autoSizeConcept();
        });
    }

    if (servicesTotal) {
        servicesTotal.addEventListener('dblclick', function(e) {
            e.preventDefault();
            enterServicesTotalEdit();
        });

        servicesTotal.addEventListener('blur', function() {
            exitServicesTotalEdit();
        });

        servicesTotal.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                servicesTotal.blur();
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                resetServicesTotalOverride();
                servicesTotal.textContent = formatPrice(getServicesTotal());
                servicesTotal.blur();
            }
        });
    }

    function loadEmployeeAvailability() {
        const dateValue = editOrderDate && editOrderDate.value ? editOrderDate.value : '';

        if (!dateValue) {
            employeeAvailability = {};
            renderShowsTab();
            return;
        }

        const employeeIds = allEmployees
            .filter(emp => emp.is_active !== false)
            .map(emp => emp.id);

        if (!employeeIds.length) {
            employeeAvailability = {};
            return;
        }

        const params = new URLSearchParams();
        params.set('date', dateValue);
        params.set('employee_id', employeeIds.join(','));

        fetch('/employees/availability/?' + params.toString())
            .then(r => r.json())
            .then(data => {
                const map = {};

                (data.items || []).forEach(item => {
                    if (item.employee_id) map[item.employee_id] = item;
                });

                employeeAvailability = map;
                renderShowsTab();
            })
            .catch(() => {
                employeeAvailability = {};
            });
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

    function findFirstServiceByName(query) {
        const search = (query || '').toLowerCase().trim();

        if (!search) return null;

        const candidates = allServices.filter(s => s.type === 'service');

        const exact = candidates.find(s => s.name.toLowerCase() === search);

        if (exact) return exact;

        const starts = candidates.find(s => s.name.toLowerCase().startsWith(search));

        if (starts) return starts;

        return candidates.find(s => s.name.toLowerCase().includes(search)) || null;
    }

    function handleServiceSearchEnter() {
        if (!serviceSearchInput) return;

        const query = serviceSearchInput.value.trim();

        if (!query) return;

        const service = findFirstServiceByName(query);

        if (!service) {
            showToast('Услуга не найдена');
            return;
        }

        addServiceToEstimate(service.id);
        serviceSearchInput.value = '';
        renderServicesCatalogPanel();
        serviceSearchInput.focus();
    }

    if (serviceSearchInput) {
        serviceSearchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleServiceSearchEnter();
            }

            if (e.key === 'Escape') {
                this.value = '';
                renderServicesCatalogPanel();
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
            people_count_unknown: false,
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

    function getRole() {
        return document.body.dataset.role || '';
    }

    function canSeeRates() {
        const role = getRole();

        return role === 'boss' || role === 'senior_admin';
    }

    let activeShowIndex = 0;

    function selectShowService(index) {
        activeShowIndex = index;

        const list = document.getElementById('orderShowSelectorList');
        const label = document.getElementById('orderShowSelectorLabel');

        if (list) list.classList.remove('open');

        if (label) {
            const item = estimateItems[index];
            label.textContent = item ? item.name || 'Услуга' : 'Выберите услугу';
        }

        const panel = document.getElementById('orderShowPanel');

        if (!panel) return;

        const item = estimateItems[index];

        if (!item) {
            panel.innerHTML = '<div class="order-show-empty">Добавьте услуги из каталога</div>';
            return;
        }

        panel.innerHTML = buildShowTabHtml(index, item);
        attachShowTabEvents(panel, index, '');
        renderShowStaffTotals(panel, index);
    }

    function renderShowStaffTotals(panel, index) {
        const node = panel ? panel.querySelector('[data-show-total]') : null;

        if (!node) return;

        const total = employeeItems
            .filter(item => item.show_index === index)
            .reduce((sum, item) => sum + (parseFloat(item.payment) || 0), 0);

        node.textContent = formatPrice(total);
    }

    function renderShowsTab() {
        const badge = document.getElementById('orderShowsBadge');
        const list = document.getElementById('orderShowSelectorList');
        const dropdown = document.getElementById('orderShowsDropdown');

        if (badge) badge.textContent = String(estimateItems.length);

        if (dropdown) {
            dropdown.innerHTML = estimateItems.length
                ? estimateItems.map((item, index) => `
                    <button type="button" class="tab-btn-dropdown__item" data-show-jump="${index}">
                        ${index + 1}. ${escapeHtml(item.name || 'Услуга')}
                    </button>
                `).join('')
                : '<div class="tab-btn-dropdown__empty">Услуги не выбраны</div>';

            dropdown.querySelectorAll('[data-show-jump]').forEach(btn => {
                btn.addEventListener('click', function() {
                    const index = parseInt(this.dataset.showJump, 10);

                    const showBtn = orderEditorTabs ? orderEditorTabs.querySelector('.tab-btn[data-tab="show"]') : null;

                    if (showBtn) switchTab('show');

                    if (dropdown) dropdown.classList.remove('open');

                    selectShowService(index);
                });
            });
        }

        if (!list) return;

        if (!estimateItems.length) {
            list.innerHTML = '<div class="order-show-empty">Услуги не выбраны</div>';
            return;
        }

        list.innerHTML = estimateItems.map((item, index) => {
            const count = item.people_count_unknown || !item.people_count
                ? 'артисты не указаны'
                : `${item.people_count} чел.`;

            return `
                <button type="button" class="order-show-selector__item ${index === activeShowIndex ? 'active' : ''}" data-show-pick="${index}">
                    <span>${index + 1}. ${escapeHtml(item.name || 'Услуга')}</span>
                    <span class="order-show-selector__count">${escapeHtml(count)}</span>
                </button>
            `;
        }).join('');

        list.querySelectorAll('[data-show-pick]').forEach(btn => {
            btn.addEventListener('click', function() {
                selectShowService(parseInt(this.dataset.showPick, 10));
            });
        });

        if (activeShowIndex >= estimateItems.length) activeShowIndex = 0;

        selectShowService(activeShowIndex);
    }

    function buildShowTabHtml(index, item) {
        const showStaff = employeeItems
            .map((emp, empIndex) => ({ ...emp, empIndex }))
            .filter(emp => emp.show_index === index);

        const staffRows = showStaff.length
            ? showStaff.map(emp => buildShowStaffRow(emp)).join('')
            : '<tr class="empty-row"><td colspan="7">Добавьте сотрудников для этой услуги</td></tr>';

        const countLabel = item.people_count_unknown || !item.people_count
            ? 'количество не указано'
            : item.people_count + ' чел.';

        return `
            <div class="show-tab">
                <div class="employees-container employees-container--in-show">
                    <div class="employees-list-panel">
                        <div class="panel-header">
                            <h3>Сотрудники</h3>
                            <input type="text" class="search-input-sm" data-employee-search="${index}" placeholder="Поиск...">
                        </div>
                        <div class="employees-list" data-employees-list="${index}"></div>
                    </div>
                    <div class="employees-table-wrapper">
                        <div class="show-unified-head">
                            <div class="show-unified-head__main">
                                <span class="show-unified-head__title">${escapeHtml(item.name || 'Услуга')}</span>
                                <span class="show-unified-head__meta">${countLabel} · ${formatPrice(item.price)}</span>
                            </div>
                            <div class="show-unified-head__side">
                                <label class="show-unified-head__main-toggle">
                                    <input type="checkbox" data-show-main="${index}" ${item.is_main ? 'checked' : ''}>
                                    <span>Основное</span>
                                </label>
                                <span class="show-unified-head__total">Итого: <span data-show-total="${index}">0.00₽</span></span>
                            </div>
                        </div>
                        <div class="employees-table-container">
                            <table class="employees-table-editor">
                                <thead>
                                    <tr>
                                        <th>Сотрудник</th>
                                        <th>Роль</th>
                                        <th style="width:110px;">Оплата</th>
                                        <th>Комментарий</th>
                                        <th style="width:36px;" title="Сториз">С</th>
                                        <th style="width:36px;" title="Ответственный">О</th>
                                        <th style="width:40px;"></th>
                                    </tr>
                                </thead>
                                <tbody data-show-staff="${index}">
                                    ${staffRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function buildShowStaffRow(emp) {
        const partners = employeeItems
            .filter(other => other !== emp && other.show_index === emp.show_index && other.employee_id !== emp.employee_id)
            .map(other => other.name + (other.comment ? ' (' + other.comment + ')' : ''));

        return `
            <tr data-index="${emp.empIndex}" class="${emp.overridden ? 'row-overridden' : ''} ${emp.inactive ? 'row-inactive-employee' : ''}">
                <td>
                    <span class="employee-cell">
                        <span class="employee-cell__name">${escapeHtml(emp.name)}</span>
                        ${partners.length
                            ? `<span class="employee-cell__partners" title="${escapeHtml(partners.join(', '))}">с ${escapeHtml(partners.join(', '))}</span>`
                            : ''}
                    </span>
                    ${emp.inactive ? '<span class="inactive-badge">Деактивирован</span>' : ''}
                </td>
                <td>${escapeHtml(emp.role)}</td>
                <td>
                    ${canSeeRates()
                        ? `<input type="text" inputmode="decimal" class="cell-input cell-input--price ${emp.overridden ? 'cell-input--overridden' : ''}"
                           value="${emp.payment}" data-field="payment" data-index="${emp.empIndex}">`
                        : '<span class="cell-input cell-input--locked">—</span>'}
                </td>
                <td>
                    <input type="text" class="cell-input" value="${escapeHtml(emp.comment || '')}"
                           placeholder="Комментарий" data-field="comment" data-index="${emp.empIndex}">
                </td>
                <td class="cell-center">
                    <input type="checkbox" class="cell-checkbox" data-field="is_story" data-index="${emp.empIndex}" ${emp.is_story ? 'checked' : ''}>
                </td>
                <td class="cell-center">
                    <input type="checkbox" class="cell-checkbox" data-field="is_responsible" data-index="${emp.empIndex}" ${emp.is_responsible ? 'checked' : ''}>
                </td>
                <td>
                    <button class="remove-btn" data-remove-index="${emp.empIndex}" title="Удалить">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }

    function updateChecklistBadge() {
        if (!orderChecklistBadge) return;

        const total = orderChecklist.total || 0;
        const done = orderChecklist.done || 0;

        if (!total) {
            orderChecklistBadge.style.display = 'none';
            orderChecklistBadge.textContent = '';
            return;
        }

        orderChecklistBadge.style.display = '';
        orderChecklistBadge.textContent = `${done}/${total}`;
    }

    function isChecklistExpanded(key) {
        return !!expandedChecklists[key];
    }

    function toggleChecklist(key) {
        if (expandedChecklists[key]) {
            delete expandedChecklists[key];
        } else {
            expandedChecklists[key] = true;
        }

        renderChecklist();
    }

    function renderChecklistGroup(group, canEdit, canBuild) {
        const key = String(group.template_id || 'none');
        const expanded = isChecklistExpanded(key);
        const percent = group.total ? Math.round((group.done / group.total) * 100) : 0;

        const renderItem = function(item) {
            return `
                <div class="order-checklist__row ${item.is_done ? 'order-checklist__row--done' : ''}" data-checklist-id="${item.id}">
                    <label class="order-checklist__check">
                        <input type="checkbox" data-checklist-toggle="${item.id}" ${item.is_done ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
                    </label>
                    <span class="order-checklist__text">${escapeHtml(item.body || item.text)}</span>
                    ${canBuild ? `
                        <button type="button" class="money-icon-btn" data-checklist-edit="${item.id}" aria-label="Изменить">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button type="button" class="money-icon-btn money-icon-btn--danger" data-checklist-delete="${item.id}" aria-label="Удалить пункт">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            `;
        };

        const sections = group.sections || [{ title: '', items: group.items, total: group.total, done: group.done }];
        const hasSections = sections.some(section => section.title);

        const rows = hasSections
            ? sections.map((section, sectionIndex) => {
                const percentSection = section.total ? Math.round((section.done / section.total) * 100) : 0;

                return `
                    <div class="order-checklist__section">
                        <div class="order-checklist__section-head">
                            ${section.title ? `<span class="order-checklist__section-num">${sectionIndex + 1}</span>` : ''}
                            <span class="order-checklist__section-title">${escapeHtml(section.title || 'Прочее')}</span>
                            <span class="order-checklist__section-progress">
                                <span class="order-checklist__section-bar"><span style="width:${percentSection}%"></span></span>
                                <span class="order-checklist__section-count">${section.done}/${section.total}</span>
                            </span>
                        </div>
                        <div class="order-checklist__section-body">${section.items.map(renderItem).join('')}</div>
                    </div>
                `;
            }).join('')
            : group.items.map(renderItem).join('');

        return `
            <div class="order-checklist__card ${expanded ? 'order-checklist__card--open' : ''}" data-checklist-key="${key}">
                <div class="order-checklist__card-head" data-checklist-toggle-open="${key}">
                    <span class="order-checklist__chevron">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </span>
                    <span class="order-checklist__card-title">${escapeHtml(group.name)}</span>
                    <span class="order-checklist__card-progress">
                        <span class="order-checklist__card-bar"><span style="width:${percent}%"></span></span>
                        <span class="order-checklist__count">${group.done} из ${group.total}</span>
                    </span>
                    ${canBuild ? `
                        <button type="button" class="money-icon-btn money-icon-btn--danger" data-checklist-delete-group="${key}" aria-label="Удалить чек-лист">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    ` : ''}
                </div>
                ${expanded ? `
                    <div class="order-checklist__card-body">
                        ${rows || '<div class="order-checklist__empty">Пунктов нет</div>'}
                        ${canBuild ? `
                            <div class="order-checklist__new-item">
                                <input type="text" class="form-input" data-checklist-new="${key}" placeholder="Добавить пункт чек-листа">
                                <button type="button" class="order-checklist__new-btn" data-checklist-new-add="${key}" title="Добавить пункт">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"/>
                                        <line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderChecklist() {
        if (!orderChecklistList) return;

        const canEdit = !!orderChecklist.can_edit;
        const canBuild = !!orderChecklist.can_build;
        const items = orderChecklist.items || [];
        const groups = orderChecklist.groups || [];

        updateChecklistBadge();

        if (orderChecklistProgress) {
            const total = orderChecklist.total || 0;
            const done = orderChecklist.done || 0;
            const percent = total ? Math.round((done / total) * 100) : 0;

            orderChecklistProgress.innerHTML = total
                ? `<div class="order-checklist__bar"><span style="width:${percent}%"></span></div><span class="order-checklist__count">Выполнено ${done} из ${total}</span>`
                : '<span class="order-checklist__count">Чек-листов в заказе нет</span>';
        }

        if (orderChecklistTemplateInput) {
            orderChecklistTemplateInput.disabled = !canBuild;
        }

        if (!groups.length) {
            orderChecklistList.innerHTML = '<div class="order-checklist__empty">Чек-листов пока нет. Добавьте из списка выше.</div>';
            return;
        }

        orderChecklistList.innerHTML = groups.map(group => renderChecklistGroup(group, canEdit, canBuild)).join('');

        orderChecklistList.querySelectorAll('[data-checklist-toggle-open]').forEach(node => {
            node.addEventListener('click', function(e) {
                if (e.target.closest('[data-checklist-delete-group]')) return;
                toggleChecklist(this.dataset.checklistToggleOpen);
            });
        });

        orderChecklistList.querySelectorAll('[data-checklist-toggle]').forEach(input => {
            input.addEventListener('change', function(e) {
                e.stopPropagation();
                checklistRequest({ action: 'toggle', id: this.dataset.checklistToggle });
            });
        });

        orderChecklistList.querySelectorAll('[data-checklist-delete]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                checklistRequest({ action: 'delete', id: this.dataset.checklistDelete });
            });
        });

        orderChecklistList.querySelectorAll('[data-checklist-delete-group]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();

                const key = this.dataset.checklistDeleteGroup;
                const group = groups.find(item => String(item.template_id || 'none') === key);

                window.UI.confirm({
                    title: 'Удалить чек-лист',
                    text: group ? `Чек-лист «${group.name}» будет удалён из заказа.` : 'Чек-лист будет удалён из заказа.',
                    okText: 'Удалить',
                    cancelText: 'Отмена',
                    danger: true,
                }).then(confirmed => {
                    if (!confirmed) return;

                    delete expandedChecklists[key];
                    checklistRequest({ action: 'delete_group', template_id: key === 'none' ? '' : key });
                });
            });
        });

        orderChecklistList.querySelectorAll('[data-checklist-new-add]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();

                const key = this.dataset.checklistNewAdd;
                const input = orderChecklistList.querySelector(`[data-checklist-new="${key}"]`);
                const text = input ? input.value.trim() : '';

                if (!text) {
                    showToast('Введите текст пункта');
                    if (input) input.focus();
                    return;
                }

                const templateId = key === 'none' ? '' : key;

                checklistRequest({ action: 'add', text: text, template_id: templateId }).then(() => {
                    checklistExpanded[key] = true;
                });
            });
        });

        orderChecklistList.querySelectorAll('[data-checklist-new]').forEach(input => {
            input.addEventListener('click', function(e) {
                e.stopPropagation();
            });

            input.addEventListener('keydown', function(e) {
                if (e.key !== 'Enter') return;

                e.preventDefault();

                const key = this.dataset.checklistNew;
                const btn = orderChecklistList.querySelector(`[data-checklist-new-add="${key}"]`);

                if (btn) btn.click();
            });
        });

        orderChecklistList.querySelectorAll('[data-checklist-edit]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();

                const id = this.dataset.checklistEdit;
                const item = items.find(row => String(row.id) === String(id));

                if (!item) return;

                const value = window.prompt('Пункт чек-листа', item.text);

                if (value === null) return;

                const text = value.trim();

                if (!text || text === item.text) return;

                checklistRequest({ action: 'update', id: id, text: text });
            });
        });
    }

    function applyChecklist(data) {
        if (!data) return;

        orderChecklist = {
            items: data.items || [],
            groups: data.groups || [],
            shows: data.shows || [],
            can_edit: !!data.can_edit,
            can_build: data.can_build === undefined ? !!data.can_edit : !!data.can_build,
            total: data.total || 0,
            done: data.done || 0,
        };

        renderChecklist();
    }

    function checklistRequest(params) {
        if (!currentOrderId) return Promise.resolve();

        const body = new URLSearchParams();

        Object.keys(params).forEach(key => body.append(key, params[key]));

        return fetch(`/orders/${currentOrderId}/checklist/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken(),
            },
            body: body,
        })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                applyChecklist(data.checklist);
            })
            .catch(() => showToast('Не удалось сохранить чек-лист'));
    }

    function loadChecklist() {
        if (!currentOrderId) return;

        expandedChecklists = {};

        fetch(`/orders/${currentOrderId}/checklist/`, { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                (data.groups || []).forEach(group => {
                    expandedChecklists[String(group.template_id || 'none')] = true;
                });

                applyChecklist(data);
            })
            .catch(() => showToast('Не удалось загрузить чек-лист'));
    }

    function normalizeChecklistQuery(value) {
        return (value || '').toLowerCase().replace(/ё/g, 'е').trim();
    }

    function closeChecklistPicker() {
        if (!orderChecklistTemplateDropdown) return;

        orderChecklistTemplateDropdown.classList.remove('open');
        orderChecklistTemplateDropdown.innerHTML = '';
        checklistPickerItems = [];
        checklistPickerIndex = -1;
    }

    function openChecklistGroup(templateId) {
        expandedChecklists[String(templateId)] = true;
    }

    function addChecklistTemplate(template) {
        if (!template) return;

        openChecklistGroup(template.id);

        checklistRequest({ action: 'template', template_id: template.id }).then(() => {
            if (orderChecklistTemplateInput) orderChecklistTemplateInput.value = '';
            closeChecklistPicker();
        });
    }

    function renderChecklistPicker() {
        if (!orderChecklistTemplateDropdown) return;

        const query = normalizeChecklistQuery(orderChecklistTemplateInput ? orderChecklistTemplateInput.value : '');

        checklistPickerItems = checklistTemplates.filter(template => {
            if (!query) return true;

            return normalizeChecklistQuery(template.name).indexOf(query) !== -1;
        });

        if (!checklistPickerItems.length) {
            orderChecklistTemplateDropdown.innerHTML = '<div class="order-checklist__dropdown-empty">Чек-листы не найдены</div>';
            orderChecklistTemplateDropdown.classList.add('open');
            checklistPickerIndex = -1;
            return;
        }

        orderChecklistTemplateDropdown.innerHTML = checklistPickerItems.map((template, index) => `
            <button type="button" class="order-checklist__dropdown-item ${index === checklistPickerIndex ? 'active' : ''}" data-checklist-template="${template.id}">
                <span class="order-checklist__dropdown-name">${escapeHtml(template.name)}</span>
                <span class="order-checklist__dropdown-meta">${template.items.length} п.</span>
            </button>
        `).join('');

        orderChecklistTemplateDropdown.classList.add('open');

        orderChecklistTemplateDropdown.querySelectorAll('[data-checklist-template]').forEach(btn => {
            btn.addEventListener('mousedown', function(e) {
                e.preventDefault();

                const template = checklistTemplates.find(item => String(item.id) === String(this.dataset.checklistTemplate));

                addChecklistTemplate(template);
            });
        });
    }

    function loadChecklistTemplates() {
        fetch('/checklists/', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                checklistTemplates = data.templates || [];
            })
            .catch(() => {});
    }

    function attachShowDropdownHover() {
        const wrap = document.getElementById('orderShowsTabWrap');
        const dropdown = document.getElementById('orderShowsDropdown');
        const btn = document.getElementById('orderShowsTabBtn');

        if (!wrap || !dropdown || !btn) return;

        let hideTimer = null;

        const open = function() {
            clearTimeout(hideTimer);

            if (!estimateItems.length) return;

            dropdown.classList.add('open');
        };

        const scheduleClose = function() {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(function() {
                dropdown.classList.remove('open');
            }, 180);
        };

        wrap.addEventListener('mouseenter', open);
        wrap.addEventListener('mouseleave', scheduleClose);

        btn.addEventListener('click', function(e) {
            if (!estimateItems.length) return;

            if (dropdown.classList.contains('open')) {
                dropdown.classList.remove('open');
                return;
            }

            e.stopPropagation();
            open();
        });

        document.addEventListener('click', function(e) {
            if (!wrap.contains(e.target)) dropdown.classList.remove('open');
        });
    }

    function attachTabSwitching() {
        if (!orderEditorTabs) return;

        orderEditorTabs.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = function() {
                const target = this.dataset.tab;

                orderEditorTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === this));

                if (modalBody) {
                    modalBody.querySelectorAll('.tab-content').forEach(node => {
                        node.classList.toggle('active', node.id === 'tab-' + target);
                    });
                }
            };
        });
    }

    function attachShowTabEvents(content, showIndex, initialSearch) {
        const searchInput = content.querySelector('[data-employee-search]');
        const listPanel = content.querySelector('[data-employees-list]');
        const staffBody = content.querySelector('[data-show-staff]');

        if (searchInput && initialSearch) {
            searchInput.value = initialSearch;
        }

        function renderList() {
            if (!listPanel) return;

            const search = (searchInput ? searchInput.value : '').toLowerCase().trim();

            const filtered = allEmployees.filter(emp => {
                if (emp.is_active === false) return false;

                if (!search) return true;

                const label = (roleLabels[emp.role] || emp.role || '').toLowerCase();

                return (emp.display_name || emp.full_name).toLowerCase().includes(search)
                    || emp.full_name.toLowerCase().includes(search)
                    || label.includes(search);
            });

            if (!filtered.length) {
                listPanel.innerHTML = '<div class="employees-empty">Сотрудники не найдены</div>';
                return;
            }

            listPanel.innerHTML = filtered.map(emp => {
                const initials = emp.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const roleLabel = roleLabels[emp.role] || emp.role;
                const isAdded = employeeItems.some(item => item.employee_id === emp.id && item.show_index === showIndex);
                const availability = employeeAvailability[emp.id];
                let availabilityHtml = '';

                if (availability && availability.status !== 'free') {
                    const cls = availability.status === 'off' ? 'employee-availability--off' : 'employee-availability--partial';
                    const lbl = availability.status === 'off' ? 'Занят весь день' : 'Занят: ' + availability.label;
                    availabilityHtml = `<div class="employee-availability ${cls}">${escapeHtml(lbl)}</div>`;
                }

                return `
                    <div class="employee-item ${isAdded ? 'added' : ''}">
                        <div class="employee-avatar">${initials}</div>
                        <div class="employee-info">
                            <div class="employee-name">${escapeHtml(emp.display_name || emp.full_name)}</div>
                            <div class="employee-role">${escapeHtml(roleLabel)}</div>
                            ${availabilityHtml}
                        </div>
                        <button class="add-employee-btn" data-employee-id="${emp.id}" data-role="${emp.role}" title="Добавить">+</button>
                    </div>
                `;
            }).join('');

            listPanel.querySelectorAll('.add-employee-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    addEmployeeToShow(parseInt(this.dataset.employeeId, 10), this.dataset.role, showIndex);
                });
            });
        }

        if (searchInput) {
            let timer;
            searchInput.addEventListener('input', function() {
                clearTimeout(timer);
                timer = setTimeout(renderList, 150);
            });
        }

        if (staffBody) {
            staffBody.addEventListener('change', function(e) {
                const target = e.target;
                const field = target.dataset.field;

                if (!field) return;

                const index = parseInt(target.dataset.index, 10);
                const item = employeeItems[index];

                if (!item) return;

                if (field === 'payment') {
                    item.payment = parseFloat(String(target.value).replace(',', '.')) || 0;
                    item.overridden = true;
                    updateCostField();
                    updateShowTotals();
                    return;
                }

                if (field === 'comment') {
                    item.comment = target.value;
                    return;
                }

                if (field === 'is_story' || field === 'is_responsible') {
                    if (target.checked) {
                        employeeItems.forEach(other => {
                            if (other !== item) other[field] = false;
                        });
                    }

                    item[field] = target.checked;
                    renderShowsTab();
                }
            });

            staffBody.addEventListener('click', function(e) {
                const btn = e.target.closest('.remove-btn');

                if (!btn) return;

                employeeItems.splice(parseInt(btn.dataset.removeIndex, 10), 1);
                updateCostField();
                renderShowsTab();
            });
        }

        const mainCheckbox = content.querySelector('[data-show-main]');

        if (mainCheckbox) {
            mainCheckbox.addEventListener('change', function() {
                const idx = parseInt(this.dataset.showMain, 10);
                const checked = this.checked;

                estimateItems.forEach((item, i) => {
                    item.is_main = checked && i === idx;
                });

                renderShowsTab();
            });
        }

        renderList();
        updateShowTotals();
    }

    function updateShowTotals() {
        if (!modalBody) return;

        modalBody.querySelectorAll('[data-show-total]').forEach(node => {
            const idx = parseInt(node.dataset.showTotal, 10);
            const total = employeeItems
                .filter(item => item.show_index === idx)
                .reduce((sum, item) => sum + (parseFloat(item.payment) || 0), 0);

            node.textContent = formatPrice(total);
        });
    }

    function addEmployeeToShow(employeeId, roleCode, showIndex) {
        const emp = allEmployees.find(e => e.id === employeeId);

        if (!emp) return;

        const exists = employeeItems.some(item => item.employee_id === employeeId && item.show_index === showIndex);

        if (exists) {
            showToast('Сотрудник уже добавлен в эту услугу');
            return;
        }

        const roleLabelText = roleLabels[roleCode] || emp.role_label || emp.role || '';
        const def = getDefaultPaymentByRole(roleCode);

        employeeItems.push({
            employee_id: employeeId,
            name: emp.display_name || emp.full_name,
            role: roleLabelText,
            role_code: roleCode || emp.role,
            show_index: showIndex,
            payment: def !== null ? def : 0,
            overridden: false,
            is_story: false,
            is_responsible: false,
            comment: ''
        });

        updateCostField();
        renderShowsTab();
    }

    function updateEmployeesTotal() {
        updateShowTotals();
        updateCostField();
    }

    function getEmployeesTotal() {
        return employeeItems.reduce((sum, it) => sum + (parseFloat(it.payment) || 0), 0);
    }

    function getCalculatedCost() {
        return getServicesTotal();
    }

    function updateCostField() {
        if (!editOrderCost) return;

        if (!canSeeRates()) {
            editOrderCost.value = '—';
            return;
        }

        if (costOverride) {
            editOrderCost.value = manualCost;
            return;
        }

        const calc = getCalculatedCost();

        editOrderCost.value = formatPrice(calc);
        manualCost = editOrderCost.value;
    }

    function parseCostValue(value) {
        const number = parseFloat(String(value === undefined || value === null ? '' : value)
            .replace(/\s/g, '')
            .replace('₽', '')
            .replace(',', '.'));

        return isFinite(number) ? number : null;
    }

    function serializeCostForServer() {
        if (!editOrderCost) return '0.00';

        const number = parseCostValue(editOrderCost.value);
        const calc = getCalculatedCost();

        if (costOverride && number !== null && number > 0) {
            return number.toFixed(2);
        }

        if (calc > 0) {
            return calc.toFixed(2);
        }

        return '0.00';
    }

    function renderPaymentTax() {
        const box = document.getElementById('orderPaymentTax');

        if (!box) return;

        if (!canSeeRates() || !editOrderPaymentMethod) {
            box.style.display = 'none';
            return;
        }

        const method = editOrderPaymentMethod.value;
        const base = getCalculatedCost();
        let rate = 0;

        if (method === 'self') rate = 0.07;
        if (method === 'ip') rate = 0.1;

        if (!rate || base <= 0) {
            box.style.display = 'none';
            return;
        }

        const tax = Math.round((base * rate) * 100) / 100;

        box.style.display = 'block';
        box.innerHTML = `Налог (${Math.round(rate * 100)}%): <b>${formatPrice(tax)}</b>`;
    }

    function enterCostEdit() {
        if (!editOrderCost || !canSeeRates()) return;

        costOverride = true;
        editOrderCost.readOnly = false;
        editOrderCost.classList.remove('form-input--readonly');
        editOrderCost.focus();
        editOrderCost.select();
    }

    function exitCostEdit() {
        if (!editOrderCost) return;

        if (!costOverride) return;

        manualCost = editOrderCost.value;
        editOrderCost.readOnly = true;
        editOrderCost.classList.add('form-input--readonly');
        renderPaymentTax();
    }

    if (editOrderCost) {
        editOrderCost.addEventListener('dblclick', function(e) {
            e.preventDefault();
            enterCostEdit();
        });

        editOrderCost.addEventListener('input', function() {
            costOverride = true;
            manualCost = this.value;
        });

        editOrderCost.addEventListener('blur', function() {
            exitCostEdit();
        });

        editOrderCost.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.blur();
            }
        });
    }

    if (editOrderPaymentMethod) {
        editOrderPaymentMethod.addEventListener('change', renderPaymentTax);
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
                resetServicesTotalOverride();

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

                        if (window.refreshSchedule) {
                            window.refreshSchedule(true);
                        } else {
                            window.location.href = '/schedule/';
                        }
                    }
                })
                .catch(err => { showToast('Ошибка удаления'); console.error(err); });
            });
        });
    }

    if (editOrderCity) {
        editOrderCity.addEventListener('city-changed', function() {
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

    if (orderPaymentAddBtn) {
        orderPaymentAddBtn.addEventListener('click', addOrderPayment);
    }

    if (orderPaymentDate) {
        orderPaymentDate.value = new Date().toISOString().slice(0, 10);
    }

    const addOrderExpenseBtn = document.getElementById('addOrderExpenseBtn');
    const orderExpenseCloseBtn = document.getElementById('orderExpenseCloseBtn');
    const orderExpenseCancelBtn = document.getElementById('orderExpenseCancelBtn');

    if (addOrderExpenseBtn) addOrderExpenseBtn.addEventListener('click', () => openExpenseModal(null));
    if (orderExpenseCloseBtn) orderExpenseCloseBtn.addEventListener('click', requestCloseExpenseModal);
    if (orderExpenseCancelBtn) orderExpenseCancelBtn.addEventListener('click', requestCloseExpenseModal);
    if (orderExpenseForm) orderExpenseForm.addEventListener('submit', submitExpense);
    if (orderExpenseDeleteBtn) orderExpenseDeleteBtn.addEventListener('click', deleteExpense);

    if (orderExpenseModal) {
        orderExpenseModal.addEventListener('click', function(e) {
            if (e.target === orderExpenseModal) requestCloseExpenseModal();
        });
    }

    if (orderChecklistTemplateInput) {
        orderChecklistTemplateInput.addEventListener('focus', function() {
            checklistPickerIndex = -1;
            renderChecklistPicker();
        });

        orderChecklistTemplateInput.addEventListener('input', function() {
            checklistPickerIndex = -1;
            renderChecklistPicker();
        });

        orderChecklistTemplateInput.addEventListener('keydown', function(e) {
            const count = checklistPickerItems.length;

            if (e.key === 'ArrowDown' && count) {
                e.preventDefault();
                checklistPickerIndex = (checklistPickerIndex + 1) % count;
                renderChecklistPicker();
            } else if (e.key === 'ArrowUp' && count) {
                e.preventDefault();
                checklistPickerIndex = checklistPickerIndex <= 0 ? count - 1 : checklistPickerIndex - 1;
                renderChecklistPicker();
            } else if (e.key === 'Enter') {
                e.preventDefault();

                if (checklistPickerIndex >= 0 && checklistPickerItems[checklistPickerIndex]) {
                    addChecklistTemplate(checklistPickerItems[checklistPickerIndex]);
                } else if (count === 1) {
                    addChecklistTemplate(checklistPickerItems[0]);
                }
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                closeChecklistPicker();
            }
        });

        orderChecklistTemplateInput.addEventListener('blur', function() {
            setTimeout(() => {
                closeChecklistPicker();
            }, 120);
        });
    }

    document.addEventListener('click', function(e) {
        if (!orderChecklistTemplateInput) return;

        const wrapper = orderChecklistTemplateInput.closest('.order-checklist__picker');

        if (wrapper && !wrapper.contains(e.target)) closeChecklistPicker();
    });


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

            const cityValue = window.editOrderCityPicker ? window.editOrderCityPicker.getValue() : { id: '', name: '' };

            const data = {
                name: editOrderName.value.trim(),
                date: editOrderDate.value,
                client_id: editOrderClient.value,
                city_id: cityValue.id || '',
                city_group_id: editOrderCityGroup ? editOrderCityGroup.value : '',
                status: editOrderStatus.value,
                address: editOrderAddress.value.trim(),
                contact_name: editOrderContactName.value.trim(),
                contact_phone: editOrderContactPhone.value.trim(),
                contact_telegram: editOrderContactTelegram.value.trim(),
                setup_time: editOrderSetupTime.value.trim(),
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
                manager_ids: extraManagerIds.join(','),
                cost: serializeCostForServer(),
                cost_is_manual: costOverride ? '1' : '0',
                payment_method: editOrderPaymentMethod.value,
                chat_number: editOrderChat ? editOrderChat.value.trim() : '',
                start_datetime: editOrderStart ? editOrderStart.value : '',
                end_datetime: editOrderEnd ? editOrderEnd.value : '',
                city_name: cityValue.id ? '' : cityValue.name,
                payment_due_date: editOrderPaymentDue ? editOrderPaymentDue.value : '',
                payment_due_comment: editOrderPaymentComment ? editOrderPaymentComment.value.trim() : '',
                estimate_items: JSON.stringify(estimateItems.map(item => ({
                    service_id: item.service_id,
                    name: item.name,
                    people_count: item.people_count,
                    people_count_unknown: !!item.people_count_unknown,
                    coefficient: item.coefficient,
                    price: item.price,
                    comment: item.comment,
                    overridden: !!item.overridden,
                    is_main: !!item.is_main,
                }))),
                employee_items: JSON.stringify(employeeItems.map(item => ({
                    employee_id: item.employee_id,
                    name: item.name,
                    role: item.role,
                    role_code: item.role_code || '',
                    show_index: item.show_index,
                    payment: item.payment,
                    overridden: !!item.overridden,
                    is_story: !!item.is_story,
                    is_responsible: !!item.is_responsible,
                    comment: item.comment || '',
                })))
            };

            if (!data.name) { showToast('Введите название заказа'); return; }
            if (!data.client_id) { showToast('Выберите клиента из списка'); return; }

            if (isSavingOrder) {
                return;
            }

            isSavingOrder = true;

            const saveBtn = document.getElementById('globalSaveBtn');

            if (saveBtn) {
                window.UI.setButtonBusy(saveBtn, true, 'Сохранение...');
            }

            const releaseSave = function() {
                isSavingOrder = false;
                saveBtnLocked = false;

                if (saveBtn) {
                    window.UI.setButtonBusy(saveBtn, false);
                }
            };

            saveBtnLocked = true;
            clearTimeout(saveWatchdog);
            saveWatchdog = setTimeout(function() {
                if (!isSavingOrder) return;

                releaseSave();
                showToast('Сервер не ответил, попробуйте сохранить ещё раз');
            }, 20000);


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

                    close();

                    if (window.refreshSchedule) {
                        window.refreshSchedule(true);
                    }

                    if (window.refreshClientsList) {
                        window.refreshClientsList();
                    }
                }
            })
            .catch(err => { showToast('Ошибка сохранения'); console.error(err); })
            .finally(() => {
                clearTimeout(saveWatchdog);
                releaseSave();
            });
        });
    }

    const globalSaveBtn = document.getElementById('globalSaveBtn');

    if (globalSaveBtn) {
        globalSaveBtn.addEventListener('click', function() {
            if (!currentOrderId) return;

            if (isSavingOrder) {
                showToast('Сохранение уже выполняется');
                return;
            }

            if (orderInfoForm) {
                orderInfoForm.requestSubmit();
            }
        });
    }

    attachTabSwitching();
    attachShowDropdownHover();

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

        const confirmElement = document.getElementById('uiConfirmModal');

        if (confirmElement && confirmElement.classList.contains('active')) {
            if (editorModal.classList.contains('active')) {
                e.preventDefault();
            }

            return;
        }

        if (orderExpenseModal && orderExpenseModal.classList.contains('active')) {
            e.preventDefault();
            requestCloseExpenseModal();
            return;
        }

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