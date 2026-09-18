(function() {
    let selectedNodeId = null;
    let selectedNodeType = null;
    let contextNode = null;
    let currentServiceData = null;
    let currentActiveTab = 'info';
    let debounceTimer = null;
    let isSaving = false;

    const treeContainer = document.getElementById('treeRoot');
    const contentBody = document.getElementById('contentBody');
    const contentTitle = document.getElementById('contentTitle');
    const saveServiceBtn = document.getElementById('saveServiceBtn');
    const deleteServiceBtn = document.getElementById('deleteServiceBtn');
    const addRootCategoryBtn = document.getElementById('addRootCategoryBtn');
    const contextMenu = document.getElementById('contextMenu');
    const loadingOverlay = document.getElementById('loadingOverlay');

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

    function showLoading() { loadingOverlay.style.display = 'flex'; }
    function hideLoading() { loadingOverlay.style.display = 'none'; }

    function getScrollableContainers() {
        const containers = [];
        const treeBody = document.querySelector('.tree-body');
        if (treeBody) containers.push({ el: treeBody, scroll: treeBody.scrollTop });
        const activeTab = contentBody.querySelector('.service-tab-content.active');
        if (activeTab) containers.push({ el: activeTab, scroll: activeTab.scrollTop });
        const contentBodyEl = contentBody;
        if (contentBodyEl) containers.push({ el: contentBodyEl, scroll: contentBodyEl.scrollTop });
        return containers;
    }

    function restoreScroll(containers) {
        containers.forEach(item => {
            if (item.el) item.el.scrollTop = item.scroll;
        });
    }

    function fetchTree() {
        fetch('/services/tree/')
            .then(r => r.json())
            .then(data => {
                if (data.error) { showToast(data.error); return; }
                renderTree(data.tree);
            })
            .catch(err => { showToast('Ошибка загрузки дерева'); console.error(err); });
    }

    function renderTree(treeData) {
        if (!treeData || treeData.length === 0) {
            treeContainer.innerHTML = '<div class="empty-state" style="padding:1rem;text-align:center;"><p style="color:#7a7267;font-size:0.85rem;">Нет услуг</p></div>';
            return;
        }
        treeContainer.innerHTML = buildTreeHtml(treeData);
        attachTreeEvents();
    }

    function buildTreeHtml(nodes) {
        let html = '';
        nodes.forEach(node => {
            const hasChildren = node.children && node.children.length > 0;
            const isCategory = node.type === 'category';
            const iconName = isCategory ? 'category' : 'service';
            const label = isCategory ? 'каталог' : 'услуга';

            html += `<li data-id="${node.id}" data-type="${node.type}">`;
            html += `<div class="tree-item" data-id="${node.id}">`;
            html += hasChildren
                ? `<span class="toggle-icon expanded" data-toggle="1">▶</span>`
                : `<span class="toggle-icon" style="opacity:0;">▶</span>`;
            html += `<svg class="item-icon ${iconName}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
            html += isCategory
                ? `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`
                : `<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>`;
            html += `</svg>`;
            html += `<span class="item-name">${escapeHtml(node.name)}</span>`;
            html += `<span class="item-badge">${label}</span>`;
            html += `</div>`;
            if (hasChildren) {
                html += `<ul class="tree-children">${buildTreeHtml(node.children)}</ul>`;
            }
            html += `</li>`;
        });
        return html;
    }

    function attachTreeEvents() {
        document.querySelectorAll('.tree-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (e.target.classList.contains('toggle-icon')) return;
                e.stopPropagation();
                selectNode(parseInt(this.dataset.id), this);
            });
            item.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                contextNode = parseInt(this.dataset.id);
                showContextMenu(e.clientX, e.clientY);
            });
        });

        document.querySelectorAll('.toggle-icon[data-toggle="1"]').forEach(icon => {
            icon.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                const li = this.closest('li');
                if (!li) return;
                const children = li.querySelector(':scope > .tree-children');
                if (children) {
                    const isCollapsed = children.classList.toggle('collapsed');
                    this.classList.toggle('expanded', !isCollapsed);
                }
            });
        });

        document.addEventListener('click', function(e) {
            if (contextMenu && !contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        });
    }

    function showContextMenu(x, y) {
        contextMenu.style.display = 'block';
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
    }

    function selectNode(id, element) {
        document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
        if (element) element.classList.add('selected');

        selectedNodeId = id;
        showLoading();
        const scrollPositions = getScrollableContainers();

        fetch(`/services/${id}/`)
            .then(r => r.json())
            .then(data => {
                hideLoading();
                if (data.error) { showToast(data.error); return; }
                currentServiceData = data;
                selectedNodeType = data.type;
                renderServiceCard(data);
                restoreScroll(scrollPositions);
            })
            .catch(err => { hideLoading(); showToast('Ошибка загрузки'); console.error(err); });
    }

    function renderServiceCard(data) {
        contentTitle.textContent = data.name;
        saveServiceBtn.style.display = 'inline-flex';
        deleteServiceBtn.style.display = 'inline-flex';

        if (data.type === 'category') {
            renderCategoryCard(data);
        } else {
            renderServiceTabs(data);
        }
    }

    function renderCategoryCard(data) {
        contentBody.innerHTML = `
            <div class="service-tab-content active" style="display:block;">
                <div class="field-row">
                    <div class="field-label">Название</div>
                    <div class="field-value" data-field="name" data-type="text">${escapeHtml(data.name)}</div>
                </div>
            </div>
        `;
        attachFieldEvents();
    }

    function renderServiceTabs(data) {
        contentBody.innerHTML = `
            <div class="service-tabs">
                <button class="service-tab-btn ${currentActiveTab === 'info' ? 'active' : ''}" data-tab="info">Информация</button>
                <button class="service-tab-btn ${currentActiveTab === 'artists' ? 'active' : ''}" data-tab="artists">Артисты</button>
                <button class="service-tab-btn ${currentActiveTab === 'technicians' ? 'active' : ''}" data-tab="technicians">Техника</button>
                <button class="service-tab-btn ${currentActiveTab === 'transport' ? 'active' : ''}" data-tab="transport">Транспорт</button>
                <button class="service-tab-btn ${currentActiveTab === 'calc' ? 'active' : ''}" data-tab="calc">Расчёт</button>
            </div>
            <div class="service-tab-content ${currentActiveTab === 'info' ? 'active' : ''}" data-content="info"></div>
            <div class="service-tab-content ${currentActiveTab === 'artists' ? 'active' : ''}" data-content="artists"></div>
            <div class="service-tab-content ${currentActiveTab === 'technicians' ? 'active' : ''}" data-content="technicians"></div>
            <div class="service-tab-content ${currentActiveTab === 'transport' ? 'active' : ''}" data-content="transport"></div>
            <div class="service-tab-content service-tab-content--calc ${currentActiveTab === 'calc' ? 'active' : ''}" data-content="calc"></div>
        `;

        contentBody.querySelectorAll('.service-tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                currentActiveTab = this.dataset.tab;
                contentBody.querySelectorAll('.service-tab-btn').forEach(b => b.classList.remove('active'));
                contentBody.querySelectorAll('.service-tab-content').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                const target = contentBody.querySelector(`[data-content="${currentActiveTab}"]`);
                if (target) target.classList.add('active');
            });
        });

        renderInfoTab(data);
        renderArtistsTab(data);
        renderTechniciansTab(data);
        renderTransportTab(data);
        renderCalcTab(data);

        attachFieldEvents();
    }

    function renderInfoTab(data) {
        const tab = contentBody.querySelector('[data-content="info"]');
        tab.innerHTML = `
            <div class="field-row">
                <div class="field-label">Название</div>
                <div class="field-value" data-field="name" data-type="text">${escapeHtml(data.name)}</div>
            </div>
            <div class="field-row field-row--multiline">
                <div class="field-label">Описание</div>
                <div class="field-value ${data.description ? '' : 'field-value--empty'}" data-field="description" data-type="textarea">${escapeHtml(data.description || 'Добавить описание')}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Длительность</div>
                <div class="field-value ${data.duration ? '' : 'field-value--empty'}" data-field="duration" data-type="text">${escapeHtml(data.duration || 'Указать длительность')}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Медиаконтент</div>
                <div class="field-value ${data.media_url ? '' : 'field-value--empty'}" data-field="media_url" data-type="text">${data.media_url ? `<a href="${escapeHtml(data.media_url)}" target="_blank" rel="noopener">${escapeHtml(data.media_url)}</a>` : 'Добавить ссылку'}</div>
            </div>
        `;
    }

    function renderArtistsTab(data) {
        const tab = contentBody.querySelector('[data-content="artists"]');
        tab.innerHTML = `
            <div class="field-row">
                <div class="field-label">Минимум артистов</div>
                <div class="field-value" data-field="artist_min" data-type="number">${data.artist_min}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Максимум артистов</div>
                <div class="field-value" data-field="artist_max" data-type="number">${data.artist_max}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Ставка за артиста</div>
                <div class="field-value" data-field="artist_rate" data-type="number">${formatPrice(data.artist_rate)}</div>
            </div>
        `;
    }

    function renderTechniciansTab(data) {
        const tab = contentBody.querySelector('[data-content="technicians"]');
        tab.innerHTML = `
            <div class="field-row">
                <div class="field-label">Минимум техников</div>
                <div class="field-value" data-field="technician_min" data-type="number">${data.technician_min}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Максимум техников</div>
                <div class="field-value" data-field="technician_max" data-type="number">${data.technician_max}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Ставка за техника</div>
                <div class="field-value" data-field="technician_rate" data-type="number">${formatPrice(data.technician_rate)}</div>
            </div>
        `;
    }

    function renderTransportTab(data) {
        const tab = contentBody.querySelector('[data-content="transport"]');
        tab.innerHTML = `
            <div class="field-row">
                <div class="field-label">Минимум водителей</div>
                <div class="field-value" data-field="driver_min" data-type="number">${data.driver_min}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Максимум водителей</div>
                <div class="field-value" data-field="driver_max" data-type="number">${data.driver_max}</div>
            </div>
            <div class="field-row">
                <div class="field-label">Ставка за водителя</div>
                <div class="field-value" data-field="driver_rate" data-type="number">${formatPrice(data.driver_rate)}</div>
            </div>
        `;
    }

    function renderCalcTab(data) {
        const tab = contentBody.querySelector('[data-content="calc"]');
        tab.innerHTML = `
            <table class="calc-table">
                <thead>
                    <tr>
                        <th>Позиция</th>
                        <th style="text-align:right;">Стоимость</th>
                    </tr>
                </thead>
                <tbody id="calcTableBody"></tbody>
            </table>
            <div class="calc-hint">Кликните на значение, чтобы изменить его вручную</div>
        `;
        updateCalcTable();
    }

    function updateCalcTable() {
        if (!currentServiceData || selectedNodeType !== 'service') return;
        const tbody = contentBody.querySelector('#calcTableBody');
        if (!tbody) return;

        fetch(`/services/${selectedNodeId}/calculate/`)
            .then(r => r.json())
            .then(res => {
                if (res.error) { showToast(res.error); return; }
                const c = res.calculation;
                const override = currentServiceData.overridden_total;

                const totalToShow = override !== null && override !== undefined ? override : c.total;

                tbody.innerHTML = `
                    <tr class="calc-editable">
                        <td class="calc-label">Артисты (${currentServiceData.artist_min} × ${formatPrice(currentServiceData.artist_rate + c.salary_bonus)})</td>
                        <td style="text-align:right;"><span class="calc-value">${formatPrice(c.artist_sum)}</span></td>
                    </tr>
                    <tr class="calc-editable">
                        <td class="calc-label">Техники (${currentServiceData.technician_min} × ${formatPrice(currentServiceData.technician_rate + c.salary_bonus)})</td>
                        <td style="text-align:right;"><span class="calc-value">${formatPrice(c.technician_sum)}</span></td>
                    </tr>
                    <tr class="calc-editable">
                        <td class="calc-label">Водители (${currentServiceData.driver_min} × ${formatPrice(currentServiceData.driver_rate + c.salary_bonus)})</td>
                        <td style="text-align:right;"><span class="calc-value">${formatPrice(c.driver_sum)}</span></td>
                    </tr>
                    <tr class="calc-editable">
                        <td class="calc-label">Дорожные расходы (${c.total_people} чел., ${c.city_name})</td>
                        <td style="text-align:right;"><span class="calc-value">${formatPrice(c.transport)}</span></td>
                    </tr>
                    <tr class="calc-editable">
                        <td class="calc-label">Амортизация</td>
                        <td style="text-align:right;"><span class="calc-value" data-field="amortization">${formatPrice(currentServiceData.amortization)}</span></td>
                    </tr>
                    <tr class="calc-editable">
                        <td class="calc-label">Логист</td>
                        <td style="text-align:right;"><span class="calc-value" data-field="logist">${formatPrice(currentServiceData.logist)}</span></td>
                    </tr>
                    <tr class="calc-editable">
                        <td class="calc-label">Лазер</td>
                        <td style="text-align:right;"><span class="calc-value" data-field="laser">${formatPrice(currentServiceData.laser)}</span></td>
                    </tr>
                    <tr class="calc-editable">
                        <td class="calc-label">ЗП менеджера</td>
                        <td style="text-align:right;"><span class="calc-value" data-field="manager_salary">${formatPrice(currentServiceData.manager_salary)}</span></td>
                    </tr>
                    <tr class="calc-editable">
                        <td class="calc-label">Запас на непредвиденные</td>
                        <td style="text-align:right;"><span class="calc-value" data-field="unforeseen">${formatPrice(currentServiceData.unforeseen)}</span></td>
                    </tr>
                    <tr class="calc-editable">
                        <td class="calc-label">Доп. моржа</td>
                        <td style="text-align:right;"><span class="calc-value" data-field="extra_margin">${formatPrice(currentServiceData.extra_margin)}</span></td>
                    </tr>
                    <tr class="calc-editable">
                        <td class="calc-label">Способ оплаты</td>
                        <td style="text-align:right;"><span class="calc-value" data-field="payment_method">${getPaymentLabel(currentServiceData.payment_method)}</span></td>
                    </tr>
                    <tr class="calc-editable">
                        <td class="calc-label">Подытог</td>
                        <td style="text-align:right;"><span class="calc-value">${formatPrice(c.subtotal)}</span></td>
                    </tr>
                    <tr class="calc-editable ${override !== null && override !== undefined ? 'calc-overridden' : ''}">
                        <td class="calc-label">Итоговая стоимость ${override !== null && override !== undefined ? '(переопределена)' : ''}</td>
                        <td style="text-align:right;"><span class="calc-value" data-field="overridden_total">${formatPrice(totalToShow)}</span></td>
                    </tr>
                `;
                attachCalcEvents();
            })
            .catch(err => { showToast('Ошибка расчёта'); console.error(err); });
    }

    function getPaymentLabel(pm) {
        if (pm === 'self') return 'Самозанятость';
        if (pm === 'ip') return 'ИП';
        return 'Наличные';
    }

    function attachCalcEvents() {
        const tbody = contentBody.querySelector('#calcTableBody');
        if (!tbody) return;
        tbody.querySelectorAll('.calc-value[data-field]').forEach(el => {
            el.addEventListener('click', function() {
                const field = this.dataset.field;
                const currentText = this.textContent.trim();
                const currentValue = parseFloat(currentText.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;

                if (field === 'payment_method') {
                    const select = document.createElement('select');
                    select.className = 'calc-input';
                    select.innerHTML = `
                        <option value="cash" ${currentServiceData.payment_method === 'cash' ? 'selected' : ''}>Наличные</option>
                        <option value="self" ${currentServiceData.payment_method === 'self' ? 'selected' : ''}>Самозанятость</option>
                        <option value="ip" ${currentServiceData.payment_method === 'ip' ? 'selected' : ''}>ИП</option>
                    `;
                    this.replaceWith(select);
                    select.focus();
                    const save = () => saveField(field, select.value, 'calc');
                    select.addEventListener('blur', save);
                    select.addEventListener('change', save);
                    return;
                }

                const input = document.createElement('input');
                input.type = 'number';
                input.step = '0.01';
                input.className = 'calc-input';
                input.value = currentValue;
                this.replaceWith(input);
                input.focus();
                input.select();

                const save = () => saveField(field, input.value, 'calc');
                input.addEventListener('blur', save);
                input.addEventListener('keydown', e => {
                    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                    if (e.key === 'Escape') { input.value = currentValue; input.blur(); }
                });
            });
        });
    }

    function attachFieldEvents() {
        contentBody.querySelectorAll('.field-value[data-field]').forEach(el => {
            el.addEventListener('click', function() {
                if (this.querySelector('input, textarea, select')) return;
                startEditing(this);
            });
        });
    }

    function startEditing(el) {
        const field = el.dataset.field;
        const type = el.dataset.type;
        const rawValue = currentServiceData[field] !== undefined ? currentServiceData[field] : '';

        let input;
        if (type === 'textarea') {
            input = document.createElement('textarea');
            input.className = 'field-input field-input--textarea';
            input.value = rawValue;
        } else if (type === 'number') {
            input = document.createElement('input');
            input.type = 'number';
            input.className = 'field-input field-input--number';
            input.value = parseFloat(rawValue) || 0;
            if (field.endsWith('_rate') || ['amortization', 'logist', 'laser', 'manager_salary', 'unforeseen', 'extra_margin'].includes(field)) {
                input.step = '0.01';
            } else {
                input.step = '1';
                input.min = '0';
            }
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'field-input';
            input.value = rawValue;
        }

        el.textContent = '';
        el.appendChild(input);
        input.focus();
        if (input.select) input.select();

        let cancelled = false;

        const finish = () => {
            if (cancelled) return;
            saveField(field, input.value, 'field');
        };

        input.addEventListener('blur', finish);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && type !== 'textarea') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { cancelled = true; renderServiceCard(currentServiceData); }
        });
    }

    function getCascadeUpdates(field, value) {
        const updates = {};
        const data = currentServiceData;
        const pairs = [
            { min: 'artist_min', max: 'artist_max' },
            { min: 'technician_min', max: 'technician_max' },
            { min: 'driver_min', max: 'driver_max' },
        ];

        for (const pair of pairs) {
            if (field === pair.min) {
                const currentMax = parseInt(data[pair.max]) || 0;
                if (value > currentMax) {
                    updates[pair.max] = value;
                }
            } else if (field === pair.max) {
                const currentMin = parseInt(data[pair.min]) || 0;
                if (value < currentMin) {
                    updates[pair.min] = value;
                }
            }
        }

        return updates;
    }

    function saveField(field, value, mode) {
        if (isSaving) return;
        isSaving = true;

        if (field === 'artist_min' || field === 'artist_max' || field === 'technician_min' || field === 'technician_max' || field === 'driver_min' || field === 'driver_max') {
            value = Math.max(0, parseInt(value) || 0);
        } else if (['artist_rate', 'technician_rate', 'driver_rate', 'amortization', 'logist', 'laser', 'manager_salary', 'unforeseen', 'extra_margin', 'overridden_total'].includes(field)) {
            value = parseFloat(value) || 0;
        }

        const cascade = getCascadeUpdates(field, value);

        const payload = { [field]: value };
        for (const key in cascade) {
            payload[key] = cascade[key];
        }

        showLoading();
        const scrollPositions = getScrollableContainers();

        fetch(`/services/${selectedNodeId}/update/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: new URLSearchParams(payload)
        })
        .then(r => r.json())
        .then(data => {
            hideLoading();
            isSaving = false;
            if (data.error) {
                showToast(data.error);
                renderServiceCard(currentServiceData);
                restoreScroll(scrollPositions);
                return;
            }
            currentServiceData = data.service;
            fetchTree();
            renderServiceCard(currentServiceData);
            restoreScroll(scrollPositions);
        })
        .catch(err => {
            hideLoading();
            isSaving = false;
            showToast('Ошибка сохранения');
            console.error(err);
        });
    }

    function createNode(parentId, type) {
        showLoading();
        fetch('/services/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: new URLSearchParams({ parent_id: parentId || '', type: type })
        })
        .then(r => r.json())
        .then(data => {
            hideLoading();
            if (data.error) { showToast(data.error); return; }
            if (data.success) {
                showToast(`Создан ${type === 'category' ? 'каталог' : 'услуга'}`);
                contextMenu.style.display = 'none';
                fetchTree();
                setTimeout(() => {
                    const el = document.querySelector(`.tree-item[data-id="${data.service.id}"]`);
                    if (el) selectNode(data.service.id, el);
                }, 300);
            }
        })
        .catch(err => { hideLoading(); showToast('Ошибка создания'); console.error(err); });
    }

    function deleteNode(id) {
        if (!confirm('Удалить элемент?')) return;
        showLoading();
        fetch(`/services/${id}/delete/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCSRFToken() }
        })
        .then(r => r.json())
        .then(data => {
            hideLoading();
            if (data.error) { showToast(data.error); return; }
            if (data.success) {
                showToast('Элемент удалён');
                contentBody.innerHTML = '<div class="empty-state"><p>Выберите каталог или услугу для просмотра</p></div>';
                contentTitle.textContent = 'Выберите элемент';
                saveServiceBtn.style.display = 'none';
                deleteServiceBtn.style.display = 'none';
                selectedNodeId = null;
                currentServiceData = null;
                fetchTree();
            }
        })
        .catch(err => { hideLoading(); showToast('Ошибка удаления'); console.error(err); });
    }

    document.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', function() {
            const action = this.dataset.action;
            if (contextNode === null) return;
            if (action === 'add-category') createNode(contextNode, 'category');
            else if (action === 'add-service') createNode(contextNode, 'service');
            else if (action === 'rename') {
                const el = document.querySelector(`.tree-item[data-id="${contextNode}"]`);
                if (el) selectNode(contextNode, el);
            } else if (action === 'delete') deleteNode(contextNode);
            contextMenu.style.display = 'none';
        });
    });

    if (addRootCategoryBtn) {
        addRootCategoryBtn.addEventListener('click', () => createNode(null, 'category'));
    }

    if (saveServiceBtn) {
        saveServiceBtn.addEventListener('click', function() {
            if (!selectedNodeId) return;
            showLoading();
            setTimeout(() => {
                hideLoading();
                showToast('Услуга сохранена');
            }, 300);
        });
    }

    if (deleteServiceBtn) {
        deleteServiceBtn.addEventListener('click', function() {
            if (selectedNodeId) deleteNode(selectedNodeId);
        });
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') contextMenu.style.display = 'none';
    });

    fetchTree();
})();