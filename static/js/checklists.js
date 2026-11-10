(function() {
    const listEl = document.getElementById('clList');
    const editorEl = document.getElementById('clEditor');
    const createBtn = document.getElementById('clCreateBtn');
    const modal = document.getElementById('clTemplateModal');
    const modalTitle = document.getElementById('clTemplateModalTitle');
    const nameInput = document.getElementById('clTemplateName');
    const serviceSelect = document.getElementById('clTemplateService');
    const defaultCheck = document.getElementById('clTemplateDefault');
    const modalClose = document.getElementById('clTemplateModalClose');
    const modalCancel = document.getElementById('clTemplateCancel');
    const modalSave = document.getElementById('clTemplateSave');

    let templates = [];
    let activeId = parseInt(new URLSearchParams(window.location.search).get('id'), 10) || null;
    let editingId = null;

    function escapeHtml(text) {
        return window.UI.escapeHtml(text);
    }

    function request(url, options) {
        const settings = Object.assign({ headers: {} }, options || {});
        settings.headers['X-CSRFToken'] = window.UI.getCSRFToken();

        return fetch(url, settings).then(function(response) {
            return response.json().then(function(body) {
                return { status: response.status, body: body };
            });
        });
    }

    function splitText(text) {
        const value = (text || '').trim();
        const separator = value.indexOf(':');

        if (separator > 0) {
            const head = value.slice(0, separator).trim();

            if (head && head.length <= 40) {
                return { section: head, body: value.slice(separator + 1).trim() };
            }
        }

        return { section: '', body: value };
    }

    function groupItems(items) {
        const groups = [];
        const map = new Map();

        (items || []).forEach(function(item) {
            const parts = splitText(item.text);

            if (!map.has(parts.section)) {
                const group = { title: parts.section, items: [] };
                map.set(parts.section, group);
                groups.push(group);
            }

            map.get(parts.section).items.push(Object.assign({}, item, { body: parts.body }));
        });

        return groups;
    }

    function activeTemplate() {
        return templates.find(function(item) {
            return String(item.id) === String(activeId);
        });
    }

    function templateItem(itemId) {
        const template = activeTemplate();

        if (!template) return null;

        return (template.items || []).find(function(entry) {
            return String(entry.id) === String(itemId);
        }) || null;
    }

    function renderList() {
        if (!templates.length) {
            listEl.innerHTML = '<div class="cl-empty">Чек-листов пока нет</div>';
            return;
        }

        listEl.innerHTML = templates.map(function(template) {
            const active = String(template.id) === String(activeId) ? ' cl-list__item--active' : '';

            return `
                <button type="button" class="cl-list__item${active}" data-template-id="${template.id}">
                    <span class="cl-list__name">${escapeHtml(template.name)}</span>
                    <span class="cl-list__meta">${escapeHtml(template.service_name || 'Без шоу')} · ${template.items_count} п.</span>
                </button>
            `;
        }).join('');

        listEl.querySelectorAll('[data-template-id]').forEach(function(button) {
            button.addEventListener('click', function() {
                selectTemplate(parseInt(this.dataset.templateId, 10));
            });
        });
    }

    function renderEditor() {
        const template = activeTemplate();

        if (!template) {
            editorEl.innerHTML = '<div class="cl-empty">Выберите чек-лист слева или создайте новый</div>';
            return;
        }

        const groups = groupItems(template.items);
        const sectionOptions = ['<option value="">Без раздела</option>']
            .concat(groups.filter(function(group) {
                return group.title;
            }).map(function(group) {
                return `<option value="${escapeHtml(group.title)}">${escapeHtml(group.title)}</option>`;
            }))
            .join('');

        const groupsHtml = groups.map(function(group, index) {
            const head = group.title
                ? `<div class="cl-group__head">
                        <span class="cl-group__num">${index + 1}</span>
                        <span class="cl-group__title">${escapeHtml(group.title)}</span>
                        <button type="button" class="cl-group__btn" data-section-rename="${escapeHtml(group.title)}">Переименовать</button>
                        <button type="button" class="cl-group__btn cl-group__btn--danger" data-section-delete="${escapeHtml(group.title)}">Удалить раздел</button>
                    </div>`
                : '';

            const rows = group.items.map(function(item) {
                return `
                    <div class="cl-item" data-item-id="${item.id}" draggable="true">
                        <span class="cl-item__handle" title="Перетащите, чтобы изменить порядок">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="9" cy="6" r="1"/>
                                <circle cx="15" cy="6" r="1"/>
                                <circle cx="9" cy="12" r="1"/>
                                <circle cx="15" cy="12" r="1"/>
                                <circle cx="9" cy="18" r="1"/>
                                <circle cx="15" cy="18" r="1"/>
                            </svg>
                        </span>
                        <span class="cl-item__dot"></span>
                        <span class="cl-item__text">${escapeHtml(item.body)}</span>
                        <button type="button" class="cl-item__btn" data-item-edit="${item.id}" aria-label="Изменить">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button type="button" class="cl-item__btn cl-item__btn--danger" data-item-delete="${item.id}" aria-label="Удалить">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                `;
            }).join('');

            return `<div class="cl-group">${head}<div class="cl-group__body">${rows}</div></div>`;
        }).join('');

        editorEl.innerHTML = `
            <div class="cl-editor__head">
                <div class="cl-editor__info">
                    <h2 class="cl-editor__title">${escapeHtml(template.name)}</h2>
                    <span class="cl-editor__meta">${escapeHtml(template.service_name || 'Без шоу')}${template.is_default ? ' · в каждом заказе' : ''}</span>
                </div>
                <div class="cl-editor__actions">
                    <button type="button" class="cl-btn" id="clEditTemplate">Изменить</button>
                    <button type="button" class="cl-btn cl-btn--danger" id="clDeleteTemplate">Удалить</button>
                </div>
            </div>
            <div class="cl-groups">${groupsHtml || '<div class="cl-empty">В чек-листе пока нет пунктов</div>'}</div>
            <div class="cl-add">
                <input type="text" class="form-input cl-add__section" id="clNewSection" placeholder="Раздел" list="clSectionList" autocomplete="off">
                <datalist id="clSectionList">${groups.filter(function(g) { return g.title; }).map(function(g) { return `<option value="${escapeHtml(g.title)}"></option>`; }).join('')}</datalist>
                <input type="text" class="form-input" id="clNewItem" placeholder="Текст пункта">
                <button type="button" class="btn btn-primary btn-sm" id="clAddItemBtn">Добавить</button>
            </div>
        `;

        const editBtn = document.getElementById('clEditTemplate');
        const deleteBtn = document.getElementById('clDeleteTemplate');
        const sectionInput = document.getElementById('clNewSection');
        const itemInput = document.getElementById('clNewItem');
        const addBtn = document.getElementById('clAddItemBtn');

        if (editBtn) editBtn.addEventListener('click', function() { openTemplateModal(template); });
        if (deleteBtn) deleteBtn.addEventListener('click', function() { deleteTemplate(template); });

        [sectionInput, itemInput].forEach(function(input) {
            if (!input) return;

            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                }
            });
        });

        if (addBtn) addBtn.addEventListener('click', addItem);

        editorEl.querySelectorAll('[data-item-edit]').forEach(function(button) {
            button.addEventListener('click', function() {
                startItemEdit(this.closest('.cl-item'), parseInt(this.dataset.itemEdit, 10), sectionOptions);
            });
        });

        editorEl.querySelectorAll('[data-item-delete]').forEach(function(button) {
            button.addEventListener('click', function() {
                deleteItem(parseInt(this.dataset.itemDelete, 10));
            });
        });

        attachDragAndDrop();

        editorEl.querySelectorAll('[data-section-rename]').forEach(function(button) {
            button.addEventListener('click', function() {
                renameSection(this.dataset.sectionRename);
            });
        });

        editorEl.querySelectorAll('[data-section-delete]').forEach(function(button) {
            button.addEventListener('click', function() {
                deleteSection(this.dataset.sectionDelete);
            });
        });
    }

    function attachDragAndDrop() {
        let draggingId = null;

        editorEl.querySelectorAll('.cl-item[draggable="true"]').forEach(function(row) {
            row.addEventListener('dragstart', function(e) {
                draggingId = this.dataset.itemId;
                this.classList.add('cl-item--dragging');

                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', draggingId);
                }
            });

            row.addEventListener('dragend', function() {
                draggingId = null;
                clearDropMarks();
                this.classList.remove('cl-item--dragging');
            });

            row.addEventListener('dragover', function(e) {
                if (!draggingId || draggingId === this.dataset.itemId) return;

                e.preventDefault();

                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

                clearDropMarks();
                this.classList.add('cl-item--drop');
            });

            row.addEventListener('dragleave', function() {
                this.classList.remove('cl-item--drop');
            });

            row.addEventListener('drop', function(e) {
                if (!draggingId || draggingId === this.dataset.itemId) return;

                e.preventDefault();

                const template = activeTemplate();

                if (!template) return;

                const ids = (template.items || []).map(function(item) { return item.id; });
                const from = ids.indexOf(parseInt(draggingId, 10));
                const to = ids.indexOf(parseInt(this.dataset.itemId, 10));

                clearDropMarks();

                if (from < 0 || to < 0 || from === to) return;

                ids.splice(to, 0, ids.splice(from, 1)[0]);
                persistOrder(ids);
            });
        });
    }

    function clearDropMarks() {
        editorEl.querySelectorAll('.cl-item--drop').forEach(function(row) {
            row.classList.remove('cl-item--drop');
        });
    }

    function persistOrder(ids) {
        request('/checklists/items/order/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template_id: activeId, ids: ids })
        }).then(function(result) {
            if (result.body.error) {
                window.UI.showToast(result.body.error);
                return;
            }

            reload();
        });
    }

    function startItemEdit(row, itemId, sectionOptions) {
        if (!row || row.querySelector('.cl-item__editor')) return;

        const item = templateItem(itemId);

        if (!item) return;

        const parts = splitText(item.text);
        const textNode = row.querySelector('.cl-item__text');

        const wrapper = document.createElement('div');
        wrapper.className = 'cl-item__editor';
        wrapper.innerHTML = `
            <input type="text" class="form-input cl-item__section-input" list="clSectionList" placeholder="Раздел" value="${escapeHtml(parts.section)}">
            <input type="text" class="form-input cl-item__input" placeholder="Текст пункта" value="${escapeHtml(parts.body)}">
        `;

        textNode.replaceWith(wrapper);

        const sectionInput = wrapper.querySelector('.cl-item__section-input');
        const bodyInput = wrapper.querySelector('.cl-item__input');

        bodyInput.focus();
        bodyInput.select();

        let done = false;

        function finish(save) {
            if (done) return;
            done = true;

            const section = sectionInput.value.trim();
            const body = bodyInput.value.trim();

            if (!save || !body) {
                renderEditor();
                return;
            }

            request('/checklists/items/', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: itemId, section: section, text: body })
            }).then(function(result) {
                if (result.body.error) {
                    window.UI.showToast(result.body.error);
                    renderEditor();
                    return;
                }

                reload();
            });
        }

        [sectionInput, bodyInput].forEach(function(input) {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finish(true);
                }

                if (e.key === 'Escape') {
                    e.preventDefault();
                    finish(false);
                }
            });
        });

        let blurTimer = null;

        [sectionInput, bodyInput].forEach(function(input) {
            input.addEventListener('focus', function() {
                clearTimeout(blurTimer);
            });

            input.addEventListener('blur', function() {
                clearTimeout(blurTimer);
                blurTimer = setTimeout(function() {
                    if (!wrapper.contains(document.activeElement)) finish(true);
                }, 120);
            });
        });
    }

    function addItem() {
        const sectionInput = document.getElementById('clNewSection');
        const itemInput = document.getElementById('clNewItem');
        let section = (sectionInput ? sectionInput.value : '').trim();
        const text = (itemInput ? itemInput.value : '').trim();

        if (!text) {
            window.UI.showToast('Введите текст пункта');
            return;
        }

        if (!section) {
            section = lastSectionTitle();
        }

        request('/checklists/items/', {
            method: 'POST',
            body: new URLSearchParams({ template_id: activeId, section: section, text: text })
        }).then(function(result) {
            if (result.body.error) {
                window.UI.showToast(result.body.error);
                return;
            }

            reload();
        });
    }

    function lastSectionTitle() {
        const template = activeTemplate();

        if (!template) return '';

        let last = '';

        (template.items || []).forEach(function(item) {
            const parts = splitText(item.text);

            if (parts.section) last = parts.section;
        });

        return last;
    }

    function renameSection(section) {
        const value = window.prompt('Новое название раздела', section);

        if (value === null) return;

        const title = value.trim();

        if (!title) {
            window.UI.showToast('Название раздела не может быть пустым');
            return;
        }

        request('/checklists/section/', {
            method: 'POST',
            body: new URLSearchParams({ template_id: activeId, section: section, title: title })
        }).then(function(result) {
            if (result.body.error) {
                window.UI.showToast(result.body.error);
                return;
            }

            reload();
        });
    }

    function deleteSection(section) {
        window.UI.confirm({
            title: 'Удалить раздел',
            text: 'Раздел «' + section + '» и все его пункты будут удалены.',
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true
        }).then(function(confirmed) {
            if (!confirmed) return;

            request('/checklists/section/?template_id=' + activeId + '&section=' + encodeURIComponent(section), { method: 'DELETE' })
                .then(function(result) {
                    if (result.body.error) {
                        window.UI.showToast(result.body.error);
                        return;
                    }

                    reload();
                });
        });
    }

    function deleteItem(itemId) {
        window.UI.confirm({
            title: 'Удалить пункт',
            text: 'Пункт будет удалён из чек-листа.',
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true
        }).then(function(confirmed) {
            if (!confirmed) return;

            request('/checklists/items/?id=' + itemId, { method: 'DELETE' }).then(function(result) {
                if (result.body.error) {
                    window.UI.showToast(result.body.error);
                    return;
                }

                reload();
            });
        });
    }

    function deleteTemplate(template) {
        window.UI.confirm({
            title: 'Удалить чек-лист',
            text: 'Чек-лист «' + template.name + '» и все его пункты будут удалены.',
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true
        }).then(function(confirmed) {
            if (!confirmed) return;

            request('/checklists/manage/' + template.id + '/', { method: 'DELETE' }).then(function(result) {
                if (result.body.error) {
                    window.UI.showToast(result.body.error);
                    return;
                }

                window.UI.showToast('Чек-лист удалён');
                activeId = null;
                reload();
            });
        });
    }

    function selectTemplate(id) {
        activeId = id;

        const url = new URL(window.location.href);
        url.searchParams.set('id', String(id));
        window.history.replaceState({}, '', url.toString());

        renderList();
        renderEditor();
    }

    function openTemplateModal(template) {
        editingId = template ? template.id : null;
        modalTitle.textContent = template ? 'Изменить чек-лист' : 'Новый чек-лист';
        nameInput.value = template ? template.name : '';
        serviceSelect.value = template && template.service_id ? String(template.service_id) : '';
        defaultCheck.checked = template ? !!template.is_default : false;
        modal.classList.add('active');
        setTimeout(function() { nameInput.focus(); }, 60);
    }

    function closeTemplateModal() {
        modal.classList.remove('active');
        editingId = null;
    }

    function saveTemplate() {
        const name = nameInput.value.trim();

        if (!name) {
            window.UI.showToast('Введите название чек-листа');
            return;
        }

        const body = new URLSearchParams({
            name: name,
            service_id: serviceSelect.value || '',
            is_default: defaultCheck.checked ? '1' : '0'
        });

        const url = editingId ? '/checklists/manage/' + editingId + '/' : '/checklists/manage/create/';

        request(url, { method: 'POST', body: body }).then(function(result) {
            if (result.body.error) {
                window.UI.showToast(result.body.error);
                return;
            }

            window.UI.showToast(editingId ? 'Чек-лист сохранён' : 'Чек-лист создан');
            activeId = result.body.template.id;
            closeTemplateModal();
            reload();
        });
    }

    function reload() {
        fetch(window.location.pathname + window.location.search, { cache: 'no-store' })
            .then(function(response) { return response.text(); })
            .then(function(html) {
                const parsed = new DOMParser().parseFromString(html, 'text/html');
                const dataScript = parsed.querySelector('script[data-checklists]');

                if (!dataScript) {
                    window.location.reload();
                    return;
                }

                templates = JSON.parse(dataScript.textContent);
                renderList();
                renderEditor();
            })
            .catch(function() { window.location.reload(); });
    }

    if (createBtn) createBtn.addEventListener('click', function() { openTemplateModal(null); });
    if (modalClose) modalClose.addEventListener('click', closeTemplateModal);
    if (modalCancel) modalCancel.addEventListener('click', closeTemplateModal);
    if (modalSave) modalSave.addEventListener('click', saveTemplate);

    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeTemplateModal();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;

        if (modal && modal.classList.contains('active')) {
            e.preventDefault();
            closeTemplateModal();
        }
    }, true);

    const dataScript = document.querySelector('script[data-checklists]');

    if (dataScript) {
        try {
            templates = JSON.parse(dataScript.textContent);
        } catch (error) {
            templates = [];
        }
    }

    renderList();
    renderEditor();
})();
