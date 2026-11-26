(function () {
    const root = document.getElementById('tasksPage');

    if (!root) return;

    const listNode = document.getElementById('tasksList');
    const mainNode = document.getElementById('tasksMain');
    const counterNode = document.getElementById('tasksCounter');
    const searchInput = document.getElementById('tasksSearch');
    const modesNode = document.getElementById('tasksModes');
    const newBtn = document.getElementById('tasksNew');
    const editor = document.getElementById('tasksEditor');

    const manage = root.dataset.manage === '1';
    const me = Number(root.dataset.me);

    const STATUS_LABEL = {
        open: 'Новая',
        in_work: 'В работе',
        done: 'Выполнена',
        rejected: 'Отклонена'
    };

    const STATUS_ORDER = ['in_work', 'open', 'done', 'rejected'];

    const state = {
        tasks: [],
        employees: [],
        mode: 'all',
        search: '',
        selected: null,
        loaded: false,
        editorId: null,
        picks: [],
        pickQuery: '',
        pickOpen: false,
        saving: false
    };

    const CLOSE_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    function escapeHtml(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function toast(text) {
        if (window.UI && window.UI.showToast) window.UI.showToast(text);
    }

    function csrf() {
        return window.UI ? window.UI.getCSRFToken() : (window.__csrfToken || '');
    }

    function post(url, data) {
        const body = new URLSearchParams();

        Object.keys(data).forEach(function (key) {
            body.append(key, data[key] === undefined || data[key] === null ? '' : String(data[key]));
        });

        return fetch(url, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrf(),
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: body.toString()
        }).then(function (response) {
            return response.json().then(function (payload) {
                return { ok: response.ok, data: payload };
            });
        });
    }

    function found(id) {
        return state.tasks.find(function (item) { return item.id === Number(id); }) || null;
    }

    function selectedTask() {
        return found(state.selected);
    }

    function shortName(assignee) {
        const parts = String(assignee.name || '').trim().split(/\s+/);

        if (parts.length < 2) return parts[0] || '';

        return parts[0] + ' ' + parts[1].charAt(0) + '.';
    }

    function taskKey(task) {
        if (task.deadline_state === 'over') return 'over';
        if (task.deadline_state === 'today') return 'today';
        if (task.deadline_state === 'soon') return 'soon';

        return '';
    }

    function deadlineClass(task) {
        const key = taskKey(task);

        return key ? ' t-deadline--' + key : '';
    }

    function renderList() {
        if (!state.loaded) {
            listNode.innerHTML = '<div class="tasks-empty">Загрузка...</div>';
            return;
        }

        if (!state.tasks.length) {
            listNode.innerHTML = '<div class="tasks-empty">' + (state.search ? 'Ничего не найдено' : 'Задач нет') + '</div>';
            return;
        }

        listNode.innerHTML = state.tasks.map(function (task) {
            const who = task.assignees.slice(0, 3).map(function (assignee) {
                return '<span class="t-ava t-ava--sm" title="' + escapeHtml(assignee.name) + '">' + escapeHtml(assignee.initial) + '</span>';
            }).join('');

            const more = task.assignees.length > 3 ? '<span>+' + (task.assignees.length - 3) + '</span>' : '';

            return '<div class="tasks-item' + (task.id === state.selected ? ' is-on' : '') + (task.status === 'done' ? ' is-done' : '') + '" data-task="' + task.id + '">' +
                '<span class="tasks-item__dot tasks-item__dot--' + task.status + '"></span>' +
                '<div class="tasks-item__main">' +
                    '<div class="tasks-item__title">' + escapeHtml(task.title) + '</div>' +
                    '<div class="tasks-item__meta">' +
                        '<span class="' + deadlineClass(task).trim() + '">' + escapeHtml(task.deadline_text) + '</span>' +
                        '<span>·</span><span>' + escapeHtml(STATUS_LABEL[task.status] || '') + '</span>' +
                        (task.assignees.length ? '<span>·</span><span class="tasks-item__who">' + who + more + '</span>' : '') +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    function renderPeople(task) {
        if (!task.assignees.length) {
            return '<div class="t-hint">Исполнители не назначены</div>';
        }

        return task.assignees.map(function (assignee) {
            return '<span class="tasks-person"><span class="t-ava">' + escapeHtml(assignee.initial) + '</span>' + escapeHtml(assignee.name) + '</span>';
        }).join('');
    }

    function renderComments(task) {
        if (!task.comments.length) {
            return '<div class="tasks-comment tasks-comment--empty">Комментариев пока нет</div>';
        }

        return task.comments.map(function (comment) {
            return '<div class="tasks-comment">' +
                '<div class="tasks-comment__head"><b>' + escapeHtml(comment.author) + '</b>' +
                    '<span class="tasks-comment__date">' + escapeHtml(comment.date) + '</span></div>' +
                '<p>' + escapeHtml(comment.text) + '</p>' +
            '</div>';
        }).join('');
    }

    function renderStatusActions(task) {
        const buttons = manage
            ? ['open', 'in_work', 'done', 'rejected']
            : ['in_work', 'done', 'rejected'];

        return buttons.map(function (key) {
            return '<button type="button" class="t-act' + (task.status === key ? ' is-on' : '') + '" ' +
                'data-status="' + key + '" data-task-id="' + task.id + '">' + STATUS_LABEL[key] + '</button>';
        }).join('');
    }

    function renderCard() {
        const task = selectedTask();

        if (!task) {
            mainNode.innerHTML = '<div class="tasks-empty">' +
                (manage ? 'Выберите задачу или создайте новую' : 'Назначенных задач нет') +
            '</div>';
            return;
        }

        const priority = task.priority === 'high'
            ? '<span class="t-chip t-chip--high">Важный</span>'
            : (task.priority === 'low' ? '<span class="t-chip">Низкий</span>' : '');

        const mine = task.is_mine ? '<span class="t-chip">Моя задача</span>' : '';

        mainNode.innerHTML = '<div class="tasks-card">' +
            '<h2 class="tasks-card__title">' + escapeHtml(task.title) + '</h2>' +
            '<div class="tasks-card__meta">' +
                '<span class="t-chip t-chip--' + task.status + '">' + escapeHtml(task.status_display) + '</span>' +
                priority + mine +
                '<span class="' + deadlineClass(task).trim() + '">' + escapeHtml(task.deadline_text) + '</span>' +
                (task.author ? '<span>· поставил ' + escapeHtml(task.author) + '</span>' : '') +
                '<span>· ' + escapeHtml(task.created_display) + '</span>' +
            '</div>' +
            (task.description ? '<div class="tasks-desc">' + escapeHtml(task.description) + '</div>' : '') +
            '<div class="tasks-block"><span class="tasks-block__k">Исполнители</span>' +
                '<div class="tasks-people">' + renderPeople(task) + '</div></div>' +
            '<div class="tasks-block"><span class="tasks-block__k">Статус</span>' +
                '<div class="tasks-actions">' + renderStatusActions(task) + '</div></div>' +
            '<div class="tasks-block"><span class="tasks-block__k">Комментарии</span>' +
                renderComments(task) +
                '<div class="tasks-add">' +
                    '<input type="text" class="t-input" id="taskCommentInput" placeholder="Написать комментарий" maxlength="2000">' +
                    '<button type="button" class="btn btn-primary" id="taskCommentAdd">Отправить</button>' +
                '</div>' +
            '</div>' +
            (manage
                ? '<div class="tasks-card__foot">' +
                    '<button type="button" class="btn btn-outline" id="taskEdit">Редактировать</button>' +
                    '<button type="button" class="btn btn-outline tasks-del" id="taskDelete">Удалить</button>' +
                  '</div>'
                : '') +
        '</div>';
    }

    function render() {
        renderList();
        renderCard();

        if (counterNode) counterNode.textContent = state.tasks.length;
    }

    function load(preserve) {
        const params = new URLSearchParams();

        params.set('mode', state.mode);

        if (state.search) params.set('search', state.search);

        return fetch('/tasks/list/?' + params.toString(), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            cache: 'no-store'
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (!data.success) throw new Error(data.error || 'Не удалось загрузить задачи');

                state.tasks = data.tasks || [];
                state.employees = data.employees || [];
                state.loaded = true;

                if (!preserve || !found(state.selected)) {
                    const first = state.tasks.filter(function (item) { return item.status === 'in_work'; })[0] || state.tasks[0];
                    state.selected = first ? first.id : null;
                }

                render();
            })
            .catch(function (error) {
                state.loaded = true;
                listNode.innerHTML = '<div class="tasks-empty">' + escapeHtml(error.message || 'Ошибка загрузки') + '</div>';
            });
    }

    function replaceTask(task) {
        const index = state.tasks.findIndex(function (item) { return item.id === task.id; });

        if (index === -1) {
            state.tasks.unshift(task);
        } else {
            state.tasks[index] = task;
        }

        state.selected = task.id;
    }

    function setStatus(taskId, status) {
        const task = found(taskId);

        if (!task) return;

        post('/tasks/' + taskId + '/status/', { status: status })
            .then(function (result) {
                if (!result.ok || !result.data.success) {
                    throw new Error((result.data && result.data.error) || 'Не удалось изменить статус');
                }

                replaceTask(result.data.task);
                render();
                toast('Статус: ' + (STATUS_LABEL[result.data.task.status] || ''));
            })
            .catch(function (error) {
                toast(error.message || 'Ошибка');
            });
    }

    function addComment() {
        const input = document.getElementById('taskCommentInput');
        const task = selectedTask();

        if (!input || !task) return;

        const text = input.value.trim();

        if (!text) return;

        const button = document.getElementById('taskCommentAdd');

        if (button) button.disabled = true;

        post('/tasks/' + task.id + '/comments/', { text: text })
            .then(function (result) {
                if (!result.ok || !result.data.success) {
                    throw new Error((result.data && result.data.error) || 'Не удалось добавить комментарий');
                }

                task.comments.push(result.data.comment);
                render();
                toast('Комментарий добавлен');
            })
            .catch(function (error) {
                toast(error.message || 'Ошибка');
                if (button) button.disabled = false;
            });
    }

    function removeTask(taskId) {
        const task = found(taskId);

        if (!task) return;

        window.UI.confirm({
            title: 'Удалить задачу?',
            text: task.title,
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true
        }).then(function (confirmed) {
            if (!confirmed) return;

            post('/tasks/' + taskId + '/delete/', {})
                .then(function (result) {
                    if (!result.ok || !result.data.success) {
                        throw new Error((result.data && result.data.error) || 'Не удалось удалить задачу');
                    }

                    state.tasks = state.tasks.filter(function (item) { return item.id !== Number(taskId); });

                    if (state.selected === Number(taskId)) state.selected = null;

                    toast('Задача удалена');
                    load(true);
                })
                .catch(function (error) {
                    toast(error.message || 'Ошибка');
                });
        });
    }

    function openEditor(taskId) {
        if (!editor) return;

        const task = taskId ? found(taskId) : null;

        state.editorId = task ? task.id : null;
        state.picks = task ? task.assignee_ids.slice() : [];
        state.pickQuery = '';
        state.pickOpen = false;

        document.getElementById('tasksEditorTitle').textContent = task ? 'Редактирование задачи' : 'Новая задача';
        document.getElementById('taskTitle').value = task ? task.title : '';
        document.getElementById('taskDesc').value = task ? task.description : '';
        document.getElementById('taskDeadline').value = task ? task.deadline : '';
        document.getElementById('taskPriority').value = task ? task.priority : 'normal';
        document.getElementById('taskStatus').value = task ? task.status : 'open';
        document.getElementById('taskPickerInput').value = '';

        editor.hidden = false;
        renderPicker();
        document.getElementById('taskTitle').focus();
    }

    function closeEditor() {
        if (!editor) return;

        editor.hidden = true;
        state.editorId = null;
        state.picks = [];
        state.pickQuery = '';
        state.pickOpen = false;
    }

    function pickedEmployees() {
        return state.picks.map(function (id) {
            return state.employees.find(function (item) { return item.id === Number(id); });
        }).filter(Boolean);
    }

    function renderPicker() {
        const chips = document.getElementById('taskPickerChips');
        const drop = document.getElementById('taskPickerDrop');
        const hint = document.getElementById('taskPickHint');
        const host = document.getElementById('taskPicker');
        const input = document.getElementById('taskPickerInput');

        if (!chips || !drop) return;

        chips.innerHTML = pickedEmployees().map(function (employee) {
            return '<span class="t-pick-chip"><span class="t-ava">' + escapeHtml(employee.initial) + '</span>' +
                escapeHtml(employee.name) +
                '<button type="button" class="t-pick-chip__x" data-unpick="' + employee.id + '" aria-label="Убрать">×</button></span>';
        }).join('');

        if (hint) hint.textContent = 'выбрано ' + state.picks.length;

        if (host) host.classList.toggle('is-open', state.pickOpen);

        if (input) input.placeholder = state.picks.length ? 'ещё' : 'Найти сотрудника';

        if (!state.pickOpen) {
            drop.hidden = true;
            drop.innerHTML = '';
            return;
        }

        const query = state.pickQuery.trim().toLowerCase();

        const picked = pickedEmployees();

        const rest = state.employees.filter(function (employee) {
            if (state.picks.indexOf(employee.id) !== -1) return false;

            if (!query) return true;

            return employee.name.toLowerCase().indexOf(query) !== -1
                || String(employee.full_name || '').toLowerCase().indexOf(query) !== -1
                || String(employee.role || '').toLowerCase().indexOf(query) !== -1;
        });

        let html = '';

        if (picked.length) {
            html += '<div class="t-group"><div class="t-group__label">Выбраны</div>' +
                picked.map(function (employee) {
                    return '<button type="button" class="t-opt is-on" data-pick="' + employee.id + '">' +
                        '<span class="t-ava">' + escapeHtml(employee.initial) + '</span>' +
                        '<span class="t-opt__who"><b>' + escapeHtml(employee.name) + '</b><span class="dim">' + escapeHtml(employee.role) + '</span></span>' +
                        '<span class="t-opt__mark">×</span></button>';
                }).join('') + '</div>';
        }

        html += '<div class="t-group"><div class="t-group__label">Сотрудники</div>' +
            (rest.length
                ? rest.map(function (employee) {
                    const badge = employee.open ? ' · ' + employee.open + ' активн.' : '';

                    return '<button type="button" class="t-opt" data-pick="' + employee.id + '">' +
                        '<span class="t-ava">' + escapeHtml(employee.initial) + '</span>' +
                        '<span class="t-opt__who"><b>' + escapeHtml(employee.name) + '</b><span class="dim">' + escapeHtml(employee.role + badge) + '</span></span>' +
                        '<span class="t-opt__mark">+</span></button>';
                }).join('')
                : '<div class="t-group__empty">Никого не найдено</div>') +
            '</div>';

        drop.innerHTML = html;
        drop.hidden = false;
    }

    function togglePick(id) {
        const value = Number(id);

        if (state.picks.indexOf(value) === -1) {
            state.picks.push(value);
        } else {
            state.picks = state.picks.filter(function (item) { return item !== value; });
        }

        renderPicker();
    }

    function saveTask() {
        if (state.saving) return;

        const title = document.getElementById('taskTitle').value.trim();

        if (!title) {
            toast('Введите название задачи');
            document.getElementById('taskTitle').focus();
            return;
        }

        const payload = {
            title: title,
            description: document.getElementById('taskDesc').value.trim(),
            deadline: document.getElementById('taskDeadline').value,
            priority: document.getElementById('taskPriority').value,
            status: document.getElementById('taskStatus').value,
            assignees: JSON.stringify(state.picks)
        };

        const button = document.getElementById('taskSave');
        const url = state.editorId ? '/tasks/' + state.editorId + '/save/' : '/tasks/create/';

        state.saving = true;

        if (button) {
            button.disabled = true;
            button.textContent = 'Сохранение...';
        }

        post(url, payload)
            .then(function (result) {
                if (!result.ok || !result.data.success) {
                    throw new Error((result.data && result.data.error) || 'Не удалось сохранить задачу');
                }

                state.saving = false;

                if (button) {
                    button.disabled = false;
                    button.textContent = 'Сохранить';
                }

                replaceTask(result.data.task);
                closeEditor();
                toast(state.editorId ? 'Задача обновлена' : 'Задача создана');
                load(true);
            })
            .catch(function (error) {
                state.saving = false;

                if (button) {
                    button.disabled = false;
                    button.textContent = 'Сохранить';
                }

                toast(error.message || 'Ошибка');
            });
    }

    if (modesNode) {
        modesNode.addEventListener('click', function (event) {
            const button = event.target.closest('[data-mode]');

            if (!button) return;

            state.mode = button.dataset.mode;
            state.selected = null;

            modesNode.querySelectorAll('.tasks-mode').forEach(function (item) {
                item.classList.toggle('is-on', item === button);
            });

            load(false);
        });
    }

    if (searchInput) {
        let timer = null;

        searchInput.addEventListener('input', function () {
            clearTimeout(timer);

            timer = setTimeout(function () {
                state.search = searchInput.value.trim();
                load(true);
            }, 320);
        });
    }

    if (newBtn) newBtn.addEventListener('click', function () { openEditor(null); });

    listNode.addEventListener('click', function (event) {
        const item = event.target.closest('[data-task]');

        if (!item) return;

        state.selected = Number(item.dataset.task);
        render();
    });

    mainNode.addEventListener('click', function (event) {
        const statusBtn = event.target.closest('[data-status][data-task-id]');

        if (statusBtn) {
            setStatus(Number(statusBtn.dataset.taskId), statusBtn.dataset.status);
            return;
        }

        if (event.target.closest('#taskCommentAdd')) {
            addComment();
            return;
        }

        if (event.target.closest('#taskEdit')) {
            openEditor(state.selected);
            return;
        }

        if (event.target.closest('#taskDelete')) {
            removeTask(state.selected);
        }
    });

    mainNode.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;

        if (event.target && event.target.id === 'taskCommentInput') {
            event.preventDefault();
            addComment();
        }
    });

    if (editor) {
        const pickerBox = document.getElementById('taskPickerBox');
        const pickerInput = document.getElementById('taskPickerInput');
        const drop = document.getElementById('taskPickerDrop');

        document.getElementById('tasksEditorClose').addEventListener('click', closeEditor);
        document.getElementById('taskCancel').addEventListener('click', closeEditor);
        document.getElementById('taskSave').addEventListener('click', saveTask);

        editor.addEventListener('click', function (event) {
            if (event.target === editor) closeEditor();
        });

        if (pickerBox) {
            pickerBox.addEventListener('click', function (event) {
                if (event.target.closest('[data-unpick]')) return;

                if (event.target.closest('[data-pick]')) return;

                state.pickOpen = true;
                renderPicker();

                if (pickerInput) pickerInput.focus();
            });
        }

        if (pickerInput) {
            pickerInput.addEventListener('click', function () {
                state.pickOpen = true;
                renderPicker();
            });

            pickerInput.addEventListener('focus', function () {
                state.pickOpen = true;
                renderPicker();
            });

            pickerInput.addEventListener('input', function () {
                state.pickQuery = pickerInput.value;
                state.pickOpen = true;
                renderPicker();
            });

            pickerInput.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') {
                    state.pickOpen = false;
                    state.pickQuery = '';
                    pickerInput.value = '';
                    renderPicker();
                }
            });
        }

        if (drop) {
            drop.addEventListener('click', function (event) {
                const unpick = event.target.closest('[data-unpick]');

                if (unpick) {
                    togglePick(unpick.dataset.unpick);
                    return;
                }

                const pick = event.target.closest('[data-pick]');

                if (pick) {
                    togglePick(pick.dataset.pick);
                    state.pickQuery = '';
                    if (pickerInput) {
                        pickerInput.value = '';
                        pickerInput.focus();
                    }
                    renderPicker();
                }
            });
        }

        document.getElementById('taskPickerChips').addEventListener('click', function (event) {
            const unpick = event.target.closest('[data-unpick]');

            if (!unpick) return;

            togglePick(unpick.dataset.unpick);
        });

        document.addEventListener('mousedown', function (event) {
            if (!state.pickOpen) return;

            const host = document.getElementById('taskPicker');

            if (host && host.contains(event.target)) return;

            state.pickOpen = false;
            renderPicker();
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !editor.hidden && !state.pickOpen) closeEditor();
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape' || !state.pickOpen) return;

        state.pickOpen = false;
        state.pickQuery = '';

        const field = document.getElementById('taskPickerInput');

        if (field) field.value = '';

        renderPicker();
    });

    load(false);

    window.tasksRefresh = function () {
        load(true);
    };
})();