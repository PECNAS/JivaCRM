(function() {
    let selectedNodeId = null;
    let selectedNodeType = null;
    let contextNode = null;
    let currentServiceData = null;
    let currentActiveTab = 'info';
    let staffRows = [];
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
        if (contentBody) containers.push({ el: contentBody, scroll: contentBody.scrollTop });
        return containers;
    }

    function restoreScroll(containers) {
        containers.forEach(item => {
            if (item.el) item.el.scrollTop = item.scroll;
        });
    }

    function showContextMenu(x, y) {
        contextMenu.style.display = 'block';
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
    }

    function hideContextMenu() {
        contextMenu.style.display = 'none';
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
                selectNode(parseInt(this.dataset.id, 10), this);
            });
            item.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                contextNode = parseInt(this.dataset.id, 10);
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
        deleteServiceBtn.style.display = 'inline-flex';
        saveServiceBtn.style.display = data.type === 'service' ? 'inline-flex' : 'none';

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
        if (currentActiveTab !== 'info' && currentActiveTab !== 'staff') {
            currentActiveTab = 'info';
        }

        contentBody.innerHTML = `
            <div class="service-tabs">
                <button class="service-tab-btn ${currentActiveTab === 'info' ? 'active' : ''}" data-tab="info">Информация</button>
                <button class="service-tab-btn ${currentActiveTab === 'staff' ? 'active' : ''}" data-tab="staff">Персонал</button>
            </div>
            <div class="service-tab-content ${currentActiveTab === 'info' ? 'active' : ''}" data-content="info"></div>
            <div class="service-tab-content ${currentActiveTab === 'staff' ? 'active' : ''}" data-content="staff"></div>
        `;

        contentBody.querySelectorAll('.service-tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                currentActiveTab = this.dataset.tab;
                contentBody.querySelectorAll('.service-tab-btn').forEach(b => b.classList.toggle('active', b === this));
                contentBody.querySelectorAll('[data-content]').forEach(c => c.classList.toggle('active', c.dataset.content === currentActiveTab));
            });
        });

        renderInfoTab(data);
        renderStaffTab(data);
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

    function isStaffRowEmpty(row) {
        return !String(row.artist_count).trim() && !String(row.cost).trim();
    }

    function ensureTrailingEmptyRow() {
        if (staffRows.length === 0 || !isStaffRowEmpty(staffRows[staffRows.length - 1])) {
            staffRows.push({ artist_count: '', cost: '' });
        }
    }

    function buildStaffRowHtml(index, row) {
        return `
            <tr>
                <td>
                    <input type="text" inputmode="numeric" class="field-input field-input--number" data-field="artist_count" data-index="${index}" value="${escapeHtml(row.artist_count)}" placeholder="0">
                </td>
                <td>
                    <input type="number" step="0.01" min="0.01" class="field-input field-input--number" data-field="cost" data-index="${index}" value="${escapeHtml(row.cost)}" placeholder="0">
                </td>
            </tr>
        `;
    }

    function attachStaffEvents(tbody) {
        if (!tbody) return;

        tbody.addEventListener('input', function(e) {
            const input = e.target;
            const field = input.dataset.field;
            if (!field) return;
            const index = parseInt(input.dataset.index, 10);

            if (field === 'artist_count') {
                const digits = input.value.replace(/\D/g, '').replace(/^0+/, '');
                if (digits !== input.value) input.value = digits;
            }

            staffRows[index][field] = input.value;

            if (index === staffRows.length - 1 && !isStaffRowEmpty(staffRows[index])) {
                staffRows.push({ artist_count: '', cost: '' });
                tbody.insertAdjacentHTML('beforeend', buildStaffRowHtml(staffRows.length - 1, staffRows[staffRows.length - 1]));
            }
        });

        tbody.addEventListener('change', function(e) {
            const input = e.target;
            if (input.dataset.field !== 'cost') return;
            const index = parseInt(input.dataset.index, 10);
            if (input.value !== '' && !(parseFloat(input.value) > 0)) {
                input.value = '';
                staffRows[index].cost = '';
                showToast('Стоимость должна быть положительным числом');
            }
        });
    }

    function renderStaffTab(data) {
        const tab = contentBody.querySelector('[data-content="staff"]');
        staffRows = (data.staff_rows || []).map(r => ({
            artist_count: String(r.artist_count),
            cost: String(r.cost),
        }));
        ensureTrailingEmptyRow();

        tab.innerHTML = `
            <div class="field-row">
                <div class="field-label">Ставка за артиста</div>
                <div class="field-value" data-field="artist_rate" data-type="number">${formatPrice(data.artist_rate)}</div>
            </div>
            <table class="calc-table staff-table">
                <thead>
                    <tr>
                        <th>Кол-во артистов</th>
                        <th style="text-align:right;">Стоимость</th>
                    </tr>
                </thead>
                <tbody id="staffTableBody">
                    ${staffRows.map((row, index) => buildStaffRowHtml(index, row)).join('')}
                </tbody>
            </table>
            <div class="calc-hint">Новая строка добавляется автоматически. Пустые строки при сохранении пропускаются.</div>
        `;

        attachStaffEvents(tab.querySelector('#staffTableBody'));
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
        const rawValue = currentServiceData[field] !== undefined && currentServiceData[field] !== null
            ? currentServiceData[field]
            : '';

        let input;
        if (type === 'textarea') {
            input = document.createElement('textarea');
            input.className = 'field-input field-input--textarea';
            input.value = rawValue;
        } else if (type === 'number') {
            input = document.createElement('input');
            input.type = 'number';
            input.className = 'field-input field-input--number';
            input.step = '0.01';
            input.min = '0';
            input.value = parseFloat(rawValue) || 0;
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'field-input';
            input.value = rawValue;
        }

        el.textContent = '';
        el.appendChild(input);
        input.focus();
        input.select();

        let cancelled = false;

        input.addEventListener('blur', function() {
            if (cancelled) return;
            saveField(field, input.value);
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && type !== 'textarea') {
                e.preventDefault();
                input.blur();
            }
            if (e.key === 'Escape') {
                cancelled = true;
                renderServiceCard(currentServiceData);
            }
        });
    }

    function saveField(field, value) {
        if (isSaving) return;

        if (field === 'artist_rate') {
            value = parseFloat(value) || 0;
            if (value < 0) {
                showToast('Ставка не может быть отрицательной');
                renderServiceCard(currentServiceData);
                return;
            }
        }

        isSaving = true;
        showLoading();
        const scrollPositions = getScrollableContainers();

        fetch(`/services/${selectedNodeId}/update/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: new URLSearchParams({ [field]: value })
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

    function collectStaffRows() {
        const result = [];
        for (const row of staffRows) {
            const countRaw = String(row.artist_count).trim();
            const costRaw = String(row.cost).trim();
            if (!countRaw && !costRaw) continue;
            if (!countRaw || !costRaw) {
                showToast('Заполните обе ячейки строки');
                return null;
            }
            const count = parseInt(countRaw, 10);
            const cost = parseFloat(costRaw);
            if (!(count > 0) || !(cost > 0)) {
                showToast('Значения должны быть положительными');
                return null;
            }
            result.push({ artist_count: count, cost: cost });
        }
        return result;
    }

    function saveStaffRows() {
        if (!selectedNodeId || selectedNodeType !== 'service' || isSaving) return;

        const rows = collectStaffRows();
        if (rows === null) return;

        isSaving = true;
        showLoading();
        const scrollPositions = getScrollableContainers();

        fetch(`/services/${selectedNodeId}/update/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: new URLSearchParams({ staff_rows: JSON.stringify(rows) })
        })
        .then(r => r.json())
        .then(data => {
            hideLoading();
            isSaving = false;
            if (data.error) {
                showToast(data.error);
                return;
            }
            showToast('Персонал сохранён');
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
        const isCategory = selectedNodeType === 'category';
        const elementLabel = isCategory ? 'каталог вместе со всем содержимым' : 'услугу';

        window.UI.confirm({
            title: 'Удалить элемент?',
            text: `Будет удалён ${elementLabel}. Действие необратимо.`,
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true
        }).then(confirmed => {
            if (!confirmed) return;

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
                    selectedNodeType = null;
                    currentServiceData = null;
                    staffRows = [];
                    fetchTree();
                }
            })
            .catch(err => { hideLoading(); showToast('Ошибка удаления'); console.error(err); });
        });
    }

    document.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', function() {
            const action = this.dataset.action;
            hideContextMenu();
            if (contextNode === null) return;
            if (action === 'add-category') createNode(contextNode, 'category');
            else if (action === 'add-service') createNode(contextNode, 'service');
            else if (action === 'rename') {
                const el = document.querySelector(`.tree-item[data-id="${contextNode}"]`);
                if (el) selectNode(contextNode, el);
            } else if (action === 'delete') deleteNode(contextNode);
        });
    });

    document.addEventListener('click', function(e) {
        if (contextMenu && !contextMenu.contains(e.target)) hideContextMenu();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') hideContextMenu();
    });

    if (addRootCategoryBtn) {
        addRootCategoryBtn.addEventListener('click', () => createNode(null, 'category'));
    }

    if (saveServiceBtn) {
        saveServiceBtn.addEventListener('click', function() {
            saveServiceCard();
        });
    }

    function saveServiceCard() {
        if (!selectedNodeId || isSaving) return;

        const rows = collectStaffRows();

        if (rows === null) return;

        isSaving = true;
        showLoading();
        const scrollPositions = getScrollableContainers();

        const payload = { staff_rows: JSON.stringify(rows) };
        const nameInput = document.querySelector('[data-field="name"]');

        if (nameInput && nameInput.tagName === 'INPUT') {
            payload.name = nameInput.value.trim();
        }

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
                restoreScroll(scrollPositions);
                return;
            }

            currentServiceData = data.service;
            fetchTree();
            renderServiceCard(currentServiceData);
            restoreScroll(scrollPositions);
            showToast('Изменения сохранены');
        })
        .catch(err => {
            hideLoading();
            isSaving = false;
            showToast('Ошибка сохранения');
            console.error(err);
        });
    }

    if (deleteServiceBtn) {
        deleteServiceBtn.addEventListener('click', function() {
            if (selectedNodeId) deleteNode(selectedNodeId);
        });
    }

    fetchTree();
})();