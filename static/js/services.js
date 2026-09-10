(function() {
    let selectedNode = null;
    let contextNode = null;
    let editingServiceId = null;
    let currentServiceType = null;
    let currentParentId = null;

    const treeContainer = document.getElementById('treeRoot');
    const contentBody = document.getElementById('contentBody');
    const contentTitle = document.getElementById('contentTitle');
    const editServiceBtn = document.getElementById('editServiceBtn');
    const deleteServiceBtn = document.getElementById('deleteServiceBtn');
    const addRootCategoryBtn = document.getElementById('addRootCategoryBtn');

    const contextMenu = document.getElementById('contextMenu');
    const editModal = document.getElementById('editServiceModal');
    const editModalCloseBtn = document.getElementById('editModalCloseBtn');
    const editModalCancelBtn = document.getElementById('editModalCancelBtn');
    const editForm = document.getElementById('editServiceForm');
    const editServiceName = document.getElementById('editServiceName');
    const editServiceDescription = document.getElementById('editServiceDescription');
    const editServicePrice = document.getElementById('editServicePrice');
    const editServiceDuration = document.getElementById('editServiceDuration');
    const editServiceActive = document.getElementById('editServiceActive');
    const serviceFields = document.getElementById('serviceFields');

    let serviceData = {};

    function getCSRFToken() {
        const cookieValue = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
        return cookieValue ? cookieValue[2] : '';
    }

    function showToast(message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
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

    function fetchTree() {
        fetch('/services/tree/')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }
                serviceData = data;
                renderTree(data.tree);
            })
            .catch(error => {
                showToast('Ошибка загрузки дерева услуг');
                console.error(error);
            });
    }

    function renderTree(treeData) {
        if (!treeData || treeData.length === 0) {
            treeContainer.innerHTML = `
                <div class="empty-state" style="padding: 1rem; text-align: center;">
                    <p style="color: #7a7267; font-size: 0.85rem;">Нет услуг</p>
                </div>
            `;
            return;
        }

        treeContainer.innerHTML = buildTreeHtml(treeData);
        attachTreeEvents();
    }

    function buildTreeHtml(nodes, isChild = false) {
        let html = '';
        if (!isChild) {
            html = '<ul class="tree-root">';
        } else {
            html = '<ul class="tree-children">';
        }

        nodes.forEach(node => {
            const hasChildren = node.children && node.children.length > 0;
            const isCategory = node.type === 'category';
            const iconName = isCategory ? 'category' : 'service';
            const label = isCategory ? 'каталог' : 'услуга';

            html += `<li data-id="${node.id}" data-type="${node.type}" data-parent-id="${node.parent_id || ''}">`;
            html += `<div class="tree-item" data-id="${node.id}">`;
            
            if (hasChildren) {
                html += `<span class="toggle-icon expanded">▶</span>`;
            } else {
                html += `<span class="toggle-icon" style="opacity:0;">▶</span>`;
            }
            
            html += `<svg class="item-icon ${iconName}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
            if (isCategory) {
                html += `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`;
            } else {
                html += `<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>`;
            }
            html += `</svg>`;
            
            html += `<span class="item-name">${escapeHtml(node.name)}</span>`;
            html += `<span class="item-badge">${label}</span>`;
            html += `</div>`;

            if (hasChildren) {
                html += buildTreeHtml(node.children, true);
            }

            html += `</li>`;
        });

        html += '</ul>';
        return html;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function attachTreeEvents() {
        const treeItems = document.querySelectorAll('.tree-item');
        treeItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.dataset.id);
                selectNode(id, this);
            });

            item.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(this.dataset.id);
                contextNode = id;
                showContextMenu(e.clientX, e.clientY, id);
            });
        });

        const toggleIcons = document.querySelectorAll('.toggle-icon');
        toggleIcons.forEach(icon => {
            icon.addEventListener('click', function(e) {
                e.stopPropagation();
                const li = this.closest('li');
                const children = li.querySelector('.tree-children');
                if (children) {
                    children.classList.toggle('collapsed');
                    this.classList.toggle('expanded');
                }
            });
        });

        // Закрываем контекстное меню при клике вне
        document.addEventListener('click', function(e) {
            if (contextMenu && !contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        });
    }

    function selectNode(id, element) {
        document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
        if (element) {
            element.classList.add('selected');
        }

        selectedNode = id;
        editingServiceId = id;
        fetch(`/services/${id}/`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }
                currentServiceType = data.type;
                currentParentId = data.parent_id || null;
                displayNodeDetails(data);
            })
            .catch(error => {
                showToast('Ошибка загрузки данных');
                console.error(error);
            });
    }

    function displayNodeDetails(data) {
        contentTitle.textContent = data.name;
        
        let pathHtml = '';
        if (data.parent_name) {
            pathHtml = `<div class="path">${escapeHtml(data.parent_name)} → ${escapeHtml(data.name)}</div>`;
        }

        const isCategory = data.type === 'category';
        const statusClass = data.data.is_active ? 'active' : 'inactive';
        const statusText = data.data.is_active ? 'Активен' : 'Неактивен';

        let detailsHtml = `
            ${pathHtml}
            <div class="service-detail">
                <div class="detail-row">
                    <span class="detail-label">Тип</span>
                    <span class="detail-value">${isCategory ? 'Каталог' : 'Услуга'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Название</span>
                    <span class="detail-value">${escapeHtml(data.name)}</span>
                </div>
        `;

        if (!isCategory) {
            detailsHtml += `
                <div class="detail-row">
                    <span class="detail-label">Описание</span>
                    <span class="detail-value">${escapeHtml(data.data.description || '—')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Цена</span>
                    <span class="detail-value">${data.data.price ? data.data.price + ' ₽' : '—'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Длительность</span>
                    <span class="detail-value">${escapeHtml(data.data.duration || '—')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Статус</span>
                    <span class="detail-value ${statusClass}">${statusText}</span>
                </div>
            `;
        }

        detailsHtml += `
                <div class="detail-row">
                    <span class="detail-label">Создан</span>
                    <span class="detail-value">${data.created_at}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Обновлен</span>
                    <span class="detail-value">${data.updated_at}</span>
                </div>
            </div>
        `;

        contentBody.innerHTML = detailsHtml;
        editingServiceId = data.id;
        currentServiceType = data.type;
        currentParentId = data.parent_id || null;

        editServiceBtn.style.display = 'inline-flex';
        deleteServiceBtn.style.display = 'inline-flex';
    }

    function showContextMenu(x, y, id) {
        if (contextMenu) {
            contextMenu.style.display = 'block';
            contextMenu.style.left = x + 'px';
            contextMenu.style.top = y + 'px';
            contextNode = id;
        }
    }

    function createNode(parentId, type) {
        const url = '/services/create/';
        const data = {
            parent_id: parentId || '',
            type: type
        };

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: new URLSearchParams(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showToast(data.error);
                return;
            }
            if (data.success) {
                showToast(`Создан ${type === 'category' ? 'каталог' : 'услуга'}`);
                if (contextMenu) contextMenu.style.display = 'none';
                fetchTree();
                if (parentId) {
                    setTimeout(() => {
                        const parentElement = document.querySelector(`.tree-item[data-id="${parentId}"]`);
                        if (parentElement) {
                            selectNode(parentId, parentElement);
                        }
                    }, 300);
                }
            }
        })
        .catch(error => {
            showToast('Ошибка создания');
            console.error(error);
        });
    }

    function deleteNode(id) {
        if (!confirm('Вы уверены, что хотите удалить этот элемент?')) return;

        fetch(`/services/${id}/delete/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showToast(data.error);
                return;
            }
            if (data.success) {
                showToast('Элемент удален');
                contentBody.innerHTML = `<div class="empty-state"><p>Выберите каталог или услугу для просмотра</p></div>`;
                contentTitle.textContent = 'Выберите элемент';
                editServiceBtn.style.display = 'none';
                deleteServiceBtn.style.display = 'none';
                selectedNode = null;
                editingServiceId = null;
                currentParentId = null;
                fetchTree();
            }
        })
        .catch(error => {
            showToast('Ошибка удаления');
            console.error(error);
        });
    }

    function openEditModal(data) {
        const isCategory = data.type === 'category';
        
        if (serviceFields) {
            serviceFields.style.display = isCategory ? 'none' : 'block';
        }
        
        editServiceName.value = data.name;
        currentParentId = data.parent_id || null;
        
        if (!isCategory) {
            editServiceDescription.value = data.data.description || '';
            editServicePrice.value = data.data.price || '';
            editServiceDuration.value = data.data.duration || '';
            editServiceActive.checked = data.data.is_active;
        }
        
        document.getElementById('editModalTitle').textContent = isCategory ? 'Редактирование каталога' : 'Редактирование услуги';
        editModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeEditModal() {
        editModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Обработчики контекстного меню
    document.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', function(e) {
            const action = this.dataset.action;
            if (contextNode === null) return;

            if (action === 'add-category') {
                createNode(contextNode, 'category');
            } else if (action === 'add-service') {
                createNode(contextNode, 'service');
            } else if (action === 'rename') {
                fetch(`/services/${contextNode}/`)
                    .then(response => response.json())
                    .then(data => {
                        if (!data.error) {
                            openEditModal(data);
                        }
                    });
            } else if (action === 'delete') {
                deleteNode(contextNode);
            }
            if (contextMenu) contextMenu.style.display = 'none';
        });
    });

    // Кнопка "Добавить каталог" в корень
    if (addRootCategoryBtn) {
        addRootCategoryBtn.addEventListener('click', function() {
            createNode(null, 'category');
        });
    }

    // Кнопка "Редактировать"
    if (editServiceBtn) {
        editServiceBtn.addEventListener('click', function() {
            if (selectedNode) {
                fetch(`/services/${selectedNode}/`)
                    .then(response => response.json())
                    .then(data => {
                        if (!data.error) {
                            openEditModal(data);
                        }
                    });
            }
        });
    }

    // Кнопка "Удалить"
    if (deleteServiceBtn) {
        deleteServiceBtn.addEventListener('click', function() {
            if (selectedNode) {
                deleteNode(selectedNode);
            }
        });
    }

    // Модальное окно редактирования
    if (editModalCloseBtn) {
        editModalCloseBtn.addEventListener('click', closeEditModal);
    }
    if (editModalCancelBtn) {
        editModalCancelBtn.addEventListener('click', closeEditModal);
    }
    if (editModal) {
        editModal.addEventListener('click', function(e) {
            if (e.target === this) closeEditModal();
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!editingServiceId) {
                showToast('Ошибка: не выбран элемент для редактирования');
                return;
            }
            
            const isCategory = currentServiceType === 'category';
            const data = {
                name: editServiceName.value.trim(),
                parent_id: currentParentId || '',
                is_active: 'true'
            };

            if (!isCategory) {
                data.description = editServiceDescription.value.trim();
                data.price = editServicePrice.value;
                data.duration = editServiceDuration.value.trim();
                data.is_active = editServiceActive.checked ? 'true' : 'false';
            }

            if (!data.name) {
                showToast('Пожалуйста, введите название');
                return;
            }

            fetch(`/services/${editingServiceId}/update/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams(data)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }
                if (data.success) {
                    showToast('Данные успешно обновлены');
                    closeEditModal();
                    fetchTree();
                    if (selectedNode) {
                        setTimeout(() => {
                            const selectedElement = document.querySelector(`.tree-item[data-id="${selectedNode}"]`);
                            if (selectedElement) {
                                selectNode(selectedNode, selectedElement);
                            }
                        }, 300);
                    }
                }
            })
            .catch(error => {
                showToast('Ошибка обновления: ' + error.message);
                console.error(error);
            });
        });
    }

    // Закрытие по Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (editModal && editModal.classList.contains('active')) closeEditModal();
            if (contextMenu) contextMenu.style.display = 'none';
        }
    });

    // Инициализация
    fetchTree();
})();