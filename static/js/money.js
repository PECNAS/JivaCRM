(function () {
    const listNode = document.getElementById('moneyShowsList');
    const statusFilter = document.getElementById('moneyStatusFilter');
    const dateFromInput = document.getElementById('moneyDateFrom');
    const dateToInput = document.getElementById('moneyDateTo');
    const sortFilter = document.getElementById('moneySortFilter');
    const filtersNode = document.getElementById('moneyFilters');
    const tabButtons = document.querySelectorAll('.money-tab');
    const filtersToggle = document.getElementById('moneyFiltersToggle');
    const filtersCount = document.getElementById('moneyFiltersCount');

    if (!listNode) return;

    const state = {
        shows: [],
        colors: {},
        expanded: {},
        draft: {},
        loaded: false,
        page: 1,
        hasMore: false,
        loading: false,
        focusOrder: null
    };

    const PAGE_SIZE = 50;

    const CHEVRON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
    const SAVE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';

    function escapeHtml(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatMoney(value) {
        const number = Math.round(Number(value) || 0);
        const negative = number < 0;
        const text = String(Math.abs(number)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

        return (negative && Math.abs(number) > 0 ? '−' : '') + text + '₽';
    }

    function query(page) {
        const params = new URLSearchParams();

        params.set('status', statusFilter ? statusFilter.value : 'all');
        params.set('sort', sortFilter ? sortFilter.value : 'date_asc');
        params.set('page', String(page || 1));
        params.set('per_page', String(PAGE_SIZE));

        if (dateFromInput && dateFromInput.value) params.set('date_from', dateFromInput.value);
        if (dateToInput && dateToInput.value) params.set('date_to', dateToInput.value);

        return params.toString();
    }

    function fetchShows(page, append) {
        if (state.loading) return;

        state.loading = true;

        const moreBtn = listNode.querySelector('[data-more]');

        if (append) {
            if (moreBtn) {
                moreBtn.disabled = true;
                moreBtn.textContent = 'Загрузка...';
            }
        } else {
            state.loaded = false;
            listNode.innerHTML = '<div class="money-loading">Загрузка...</div>';
        }

        fetch('/money/shows/?' + query(page), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            cache: 'no-store'
        })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok || !result.data.success) {
                    throw new Error((result.data && result.data.error) || 'Не удалось загрузить шоу');
                }

                const rows = result.data.shows || [];

                state.shows = append ? state.shows.concat(rows) : rows;
                state.colors = result.data.colors || state.colors;
                state.page = result.data.page || page;
                state.hasMore = !!result.data.has_more;
                state.loaded = true;
                state.loading = false;

                if (!append) {
                    if (dateFromInput && result.data.date_from) dateFromInput.value = result.data.date_from;
                    if (dateToInput) dateToInput.value = result.data.date_to || '';
                }

                pruneDrafts();

                if (state.focusOrder && focusLoadedOrder()) {
                    return;
                }

                render();
            })
            .catch(function (error) {
                state.loading = false;

                if (append) {
                    if (moreBtn) {
                        moreBtn.disabled = false;
                        moreBtn.textContent = 'Загрузить ещё';
                    }
                } else {
                    listNode.innerHTML = '<div class="money-empty">' + escapeHtml(error.message || 'Ошибка загрузки') + '</div>';
                }
            });
    }

    function loadShows() {
        state.page = 1;
        state.hasMore = false;
        fetchShows(1, false);
    }

    function loadMore() {
        if (!state.hasMore || state.loading) return;

        fetchShows(state.page + 1, true);
    }

    function findShow(orderId) {
        return state.shows.find(function (item) { return item.id === orderId; }) || null;
    }

    function emptyDraft(order) {
        const cells = [];
        const daily = {};
        const project = {};
        const everywhere = {};

        order.columns.forEach(function (column) {
            const key = String(column.employee_id);
            daily[key] = '';
            project[key] = '';
        });

        order.shows.forEach(function (show) {
            show.staff_ids.forEach(function (employeeId) {
                const key = String(employeeId);
                const saved = order.service_pays[show.id + ':' + key];
                const column = order.columns.find(function (item) { return String(item.employee_id) === key; });

                cells.push({
                    show_id: show.id,
                    employee_id: employeeId,
                    value: saved === undefined ? String(rateFor(column, order, show)) : String(saved)
                });
            });
        });

        order.columns.forEach(function (column) {
            const key = String(column.employee_id);
            const savedDaily = Number(order.daily_pays[key]) || 0;
            const savedProject = Number(order.project_pays[key]) || 0;

            if (savedProject > 0) {
                project[key] = String(savedProject);
                daily[key] = '';
            } else {
                project[key] = '';
                daily[key] = savedDaily > 0 ? String(savedDaily) : '';
            }
        });

        return {
            cells: cells,
            daily: daily,
            project: project,
            everywhere: everywhere,
            dirty: false,
            saved: snapshot(order)
        };
    }

    function rateFor(column, order, show) {
        if (!column) return 0;

        const rate = Number(column.rate) || 0;
        const bonuses = column.rate_bonuses || {};
        const bonus = show && show.service_id ? Number(bonuses[String(show.service_id)]) || 0 : 0;

        return Math.round((rate + bonus) * 100) / 100;
    }

    function snapshot(order) {
        const data = { cells: {}, daily: {}, project: {} };

        order.shows.forEach(function (show) {
            show.staff_ids.forEach(function (employeeId) {
                const key = show.id + ':' + employeeId;

                data.cells[key] = order.service_pays[key] === undefined ? null : String(order.service_pays[key]);
            });
        });

        order.columns.forEach(function (column) {
            const key = String(column.employee_id);

            data.daily[key] = order.daily_pays[key] === undefined ? null : String(order.daily_pays[key]);
            data.project[key] = order.project_pays[key] === undefined ? null : String(order.project_pays[key]);
        });

        return data;
    }

    function pruneDrafts() {
        Object.keys(state.draft).forEach(function (orderId) {
            if (!findShow(Number(orderId))) {
                delete state.draft[orderId];
            }
        });

        Object.keys(state.expanded).forEach(function (orderId) {
            if (!findShow(Number(orderId))) {
                delete state.expanded[orderId];
            }
        });
    }

    function ensureDraft(order) {
        const key = String(order.id);

        if (!state.draft[key]) {
            state.draft[key] = emptyDraft(order);
        }

        return state.draft[key];
    }

    function normalizeNumber(text) {
        let raw = String(text === undefined || text === null ? '' : text).replace(/\s/g, '').replace(',', '.');

        if (!raw) return '0';

        const number = parseFloat(raw);

        if (!isFinite(number) || number <= 0) return '0';

        return String(Math.round(number * 100) / 100);
    }

    function cellValue(draft, showId, employeeId) {
        const cell = draft.cells.find(function (item) {
            return item.show_id === showId && item.employee_id === employeeId;
        });

        return cell ? Number(cell.value) || 0 : 0;
    }

    function setCellValue(draft, showId, employeeId, value) {
        const cell = draft.cells.find(function (item) {
            return item.show_id === showId && item.employee_id === employeeId;
        });

        if (cell) cell.value = value;
    }

    function cellAmount(draft, cell) {
        return Number(cell.value) || 0;
    }

    function employeeTotal(draft, order, employeeId) {
        const key = String(employeeId);

        const project = Number(draft.project[key]) || 0;

        if (project > 0) {
            return Math.round(project * 100) / 100;
        }

        let total = Number(draft.daily[key]) || 0;

        order.shows.forEach(function (show) {
            if (show.staff_ids.indexOf(employeeId) === -1) return;

            total += cellValue(draft, show.id, employeeId);
        });

        return Math.round(total * 100) / 100;
    }

    function dailyTotalFor(draft, employeeId) {
        const key = String(employeeId);

        if ((Number(draft.project[key]) || 0) > 0) return 0;

        return Number(draft.daily[key]) || 0;
    }

    function columnTotalByCells(draft, order, employeeId) {
        return employeeTotal(draft, order, employeeId);
    }

    function rowTotal(draft, row, employeeId) {
        let total = 0;

        draft.cells.forEach(function (cell) {
            if (employeeId !== undefined && cell.employee_id !== employeeId) return;

            if (row === 'service') {
                total += cellAmount(draft, cell);
            } else if (row.kind === 'service' && cell.show_id === row.show_id) {
                total += cellAmount(draft, cell);
            }
        });

        if (row.kind === 'daily') {
            Object.keys(draft.daily).forEach(function (key) {
                if (employeeId !== undefined && String(employeeId) !== key) return;

                const project = Number(draft.project[key]) || 0;

                if (project > 0) return;

                total += Number(draft.daily[key]) || 0;
            });
        }

        return Math.round(total * 100) / 100;
    }

    function projectRowTotal(draft) {
        let total = 0;

        Object.keys(draft.project).forEach(function (key) {
            total += Number(draft.project[key]) || 0;
        });

        return Math.round(total * 100) / 100;
    }

    function grandTotal(draft) {
        return Math.round((rowTotal(draft, 'service') + rowTotal(draft, { kind: 'daily' }) + projectRowTotal(draft)) * 100) / 100;
    }

    function isProjectLocked(draft, employeeId) {
        return (Number(draft.daily[String(employeeId)]) || 0) > 0;
    }

    function isDailyLocked(draft, employeeId) {
        return (Number(draft.project[String(employeeId)]) || 0) > 0;
    }

    function isDirty(draft) {
        return draft.dirty;
    }

    function statusColors(status) {
        return state.colors[status] || null;
    }

    function cardStyle(status) {
        const colors = statusColors(status);

        if (!colors) return '';

        return 'style="--show-bg:' + colors.background + '; --show-border:' + colors.border + '; --show-text:' + colors.text + ';"';
    }

    function render() {
        if (!state.shows.length) {
            listNode.innerHTML = '<div class="money-empty">Шоу не найдены</div>';
            return;
        }

        const more = state.hasMore
            ? '<div class="money-more"><button class="btn btn-outline money-more__btn" type="button" data-more="1">Загрузить ещё</button></div>'
            : '';

        listNode.innerHTML = state.shows.map(renderCard).join('') + more;
    }

    function revealOrder(orderId) {
        const order = findShow(orderId);

        if (!order) return false;

        state.expanded[String(orderId)] = true;
        ensureDraft(order);
        render();

        const card = listNode.querySelector('[data-order-id="' + orderId + '"]');

        if (card) card.scrollIntoView({ block: 'start' });

        return true;
    }

    function focusLoadedOrder() {
        const orderId = state.focusOrder;

        if (!orderId) return false;

        if (findShow(orderId)) {
            state.focusOrder = null;
            revealOrder(orderId);
            return true;
        }

        state.focusOrder = null;
        return false;
    }

    function focusOrderById(orderId) {
        if (!orderId) return;

        if (revealOrder(orderId)) return;

        state.focusOrder = orderId;
        loadShows();
    }

    function isFilled(draft, order) {
        let filled = false;

        order.columns.forEach(function (column) {
            const key = String(column.employee_id);

            if (!filled && (Number(draft.project[key]) || 0) > 0) filled = true;
            if (!filled && (Number(draft.daily[key]) || 0) > 0) filled = true;
        });

        if (filled) return true;

        order.shows.forEach(function (show) {
            show.staff_ids.forEach(function (employeeId) {
                if (filled) return;

                if (cellValue(draft, show.id, employeeId) > 0) filled = true;
            });
        });

        return filled;
    }

    function renderCard(order) {
        const open = !!state.expanded[String(order.id)];
        const draft = ensureDraft(order);
        const filled = isFilled(draft, order);
        const services = order.services.length
            ? order.services.map(function (name) { return escapeHtml(name); }).join(', ')
            : '—';

        return '' +
            '<article class="money-show' + (open ? ' money-show--open' : '') + (filled ? ' money-show--filled' : '') +
                (order.columns.length ? '' : ' money-show--empty') + '" data-order-id="' + order.id + '">' +
                '<button class="money-show__head" type="button" data-toggle="' + order.id + '" ' + cardStyle(order.status) + '>' +
                    '<span class="money-show__chevron">' + CHEVRON + '</span>' +
                    '<span class="money-show__main">' +
                        '<span class="money-show__name">' + escapeHtml(order.name || '—') + '</span>' +
                        '<span class="money-show__meta">' +
                            '<span class="money-show__date">' + escapeHtml(order.date_display || 'Без даты') + '</span>' +
                            (order.city_name ? '<span class="money-show__city">' + escapeHtml(order.city_name) + '</span>' : '') +
                        '</span>' +
                        '<span class="money-show__services">' + services + '</span>' +
                    '</span>' +
                    '<span class="money-show__side">' +
                        '<span class="money-show__cost">' + formatMoney(order.cost) + '</span>' +
                        '<span class="money-show__staff">' + order.employees_count + ' чел.</span>' +
                    '</span>' +
                '</button>' +
                (open ? renderBody(order, draft) : '') +
            '</article>';
    }

    function renderBody(order, draft) {
        if (!order.columns.length) {
            return '<div class="money-show__body"><div class="money-empty">В шоу нет сотрудников</div></div>';
        }

        const head = order.columns.map(function (column) {
            return '<th class="money-grid__employee" title="' + escapeHtml(column.role_label || '') + '">' +
                escapeHtml(column.name) +
            '</th>';
        }).join('');

        const rowCheckbox = function (rowKey) {
            const checked = draft.everywhere[order.id + ':' + rowKey] !== undefined;
            return '<label class="money-grid__all"><input type="checkbox" data-everywhere="' + rowKey + '"' + (checked ? ' checked' : '') + '><span>Всем</span></label>';
        };

        const everyValue = function (rowKey) {
            const value = draft.everywhere[order.id + ':' + rowKey];

            if (value === undefined) return '';

            return '<div class="money-grid__bulk"><input type="text" inputmode="decimal" class="money-grid__input money-grid__input--bulk" ' +
                'data-everywhere-input="' + rowKey + '" value="' + escapeHtml(formatCell(value)) + '"></div>';
        };

        const serviceRows = order.shows.map(function (show) {
            const rowKey = 'show:' + show.id;
            const bulk = draft.everywhere[order.id + ':' + rowKey] !== undefined;

            const cells = order.columns.map(function (column) {
                const used = show.staff_ids.indexOf(column.employee_id) !== -1;

                if (!used) {
                    return '<td class="money-grid__cell money-grid__cell--off"><span class="money-grid__off">—</span></td>';
                }

                const locked = bulk;

                return '<td class="money-grid__cell">' +
                    '<input type="text" inputmode="decimal" class="money-grid__input' + (locked ? ' money-grid__input--locked' : '') + '" ' +
                        (locked ? 'disabled ' : '') +
                        'value="' + escapeHtml(formatCell(cellValue(draft, show.id, column.employee_id))) + '" ' +
                        'data-cell="1" data-show-id="' + show.id + '" data-employee-id="' + column.employee_id + '">' +
                '</td>';
            }).join('');

            return '<tr class="money-grid__row' + (bulk ? ' money-grid__row--locked' : '') + '">' +
                '<th class="money-grid__label" scope="row">' +
                    '<span class="money-grid__label-head"><span class="money-grid__label-text">' + escapeHtml(show.name) + '</span>' + rowCheckbox(rowKey) + '</span>' +
                    everyValue(rowKey) +
                '</th>' +
                cells +
                '<td class="money-grid__total money-grid__total--row">' + formatMoney(rowTotal(draft, { kind: 'service', show_id: show.id })) + '</td>' +
            '</tr>';
        }).join('');

        const dailyKey = 'daily';
        const projectKey = 'project';

        const isBulk = function (rowKey) {
            return draft.everywhere[order.id + ':' + rowKey] !== undefined;
        };

        const dailyCells = order.columns.map(function (column) {
            const key = String(column.employee_id);
            const locked = isBulk(dailyKey) || isDailyLocked(draft, column.employee_id);

            return '<td class="money-grid__cell">' +
                '<input type="text" inputmode="decimal" class="money-grid__input' + (locked ? ' money-grid__input--locked' : '') + '" ' +
                    (locked ? 'disabled ' : '') +
                    'value="' + escapeHtml(formatCell(draft.daily[key])) + '" ' +
                    'data-special="daily" data-employee-id="' + column.employee_id + '">' +
            '</td>';
        }).join('');

        const projectCells = order.columns.map(function (column) {
            const key = String(column.employee_id);
            const locked = isBulk(projectKey) || isProjectLocked(draft, column.employee_id);

            return '<td class="money-grid__cell">' +
                '<input type="text" inputmode="decimal" class="money-grid__input' + (locked ? ' money-grid__input--locked' : '') + '" ' +
                    (locked ? 'disabled ' : '') +
                    'value="' + escapeHtml(formatCell(draft.project[key])) + '" ' +
                    'data-special="project" data-employee-id="' + column.employee_id + '">' +
            '</td>';
        }).join('');

        const totalCells = order.columns.map(function (column) {
            return '<td class="money-grid__total">' + formatMoney(columnTotalByCells(draft, order, column.employee_id)) + '</td>';
        }).join('');

        const rowClass = function (rowKey) {
            return 'money-grid__row money-grid__row--special' + (isBulk(rowKey) ? ' money-grid__row--locked' : '');
        };

        return '<div class="money-show__body">' +
            '<div class="money-grid-wrap">' +
                '<table class="money-grid">' +
                    '<thead><tr>' +
                        '<th class="money-grid__corner" scope="col">Услуга</th>' +
                        head +
                        '<th class="money-grid__corner money-grid__corner--total" scope="col">Итого</th>' +
                    '</tr></thead>' +
                    '<tbody>' +
                        serviceRows +
                        '<tr class="money-grid__sep"><td colspan="' + (order.columns.length + 2) + '"></td></tr>' +
                        '<tr class="' + rowClass(dailyKey) + '">' +
                            '<th class="money-grid__label" scope="row">' +
                                '<span class="money-grid__label-head"><span class="money-grid__label-text">Суточные</span>' + rowCheckbox(dailyKey) + '</span>' +
                                everyValue(dailyKey) +
                            '</th>' +
                            dailyCells +
                            '<td class="money-grid__total money-grid__total--row">' + formatMoney(rowTotal(draft, { kind: 'daily' })) + '</td>' +
                        '</tr>' +
                        '<tr class="' + rowClass(projectKey) + '">' +
                            '<th class="money-grid__label" scope="row">' +
                                '<span class="money-grid__label-head"><span class="money-grid__label-text">За проект</span>' + rowCheckbox(projectKey) + '</span>' +
                                everyValue(projectKey) +
                            '</th>' +
                            projectCells +
                            '<td class="money-grid__total money-grid__total--row">' + formatMoney(projectRowTotal(draft)) + '</td>' +
                        '</tr>' +
                    '</tbody>' +
                    '<tfoot><tr>' +
                        '<th class="money-grid__label" scope="row">Общая сумма</th>' +
                        totalCells +
                        '<td class="money-grid__grand">' + formatMoney(grandTotal(draft)) + '</td>' +
                    '</tr></tfoot>' +
                '</table>' +
            '</div>' +
            '<div class="money-show__footer">' +
                '<span class="money-show__sum">Итого по шоу: <b>' + formatMoney(grandTotal(draft)) + '</b></span>' +
                '<button class="btn btn-primary btn-sm money-show__save" type="button" data-save="' + order.id + '"' + (isDirty(draft) ? '' : ' disabled') + '>' +
                    SAVE_ICON + 'Сохранить' +
                '</button>' +
            '</div>' +
        '</div>';
    }

    function formatCell(value) {
        if (value === '' || value === undefined || value === null) return '';

        const number = Number(value) || 0;

        if (!number) return '';

        return String(Math.round(number * 100) / 100);
    }

    function rerenderCard(order) {
        const node = listNode.querySelector('[data-order-id="' + order.id + '"]');

        if (!node) {
            render();
            return;
        }

        const focused = document.activeElement;
        const info = focused && focused.dataset ? {
            cell: focused.dataset.cell ? '1' : '',
            showId: focused.dataset.showId || '',
            employeeId: focused.dataset.employeeId || '',
            special: focused.dataset.special || '',
            everywhere: focused.dataset.everywhere || '',
            everywhereInput: focused.dataset.everywhereInput || ''
        } : null;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = renderCard(order);

        const fresh = wrapper.firstElementChild;

        node.replaceWith(fresh);

        if (!info) return;

        let selector = null;

        if (info.cell) selector = '[data-cell="1"][data-show-id="' + info.showId + '"][data-employee-id="' + info.employeeId + '"]';
        else if (info.special) selector = '[data-special="' + info.special + '"][data-employee-id="' + info.employeeId + '"]';
        else if (info.everywhere) selector = '[data-everywhere="' + info.everywhere + '"]';
        else if (info.everywhereInput) selector = '[data-everywhere-input="' + info.everywhereInput + '"]';

        if (!selector) return;

        const target = fresh.querySelector(selector);

        if (!target) return;

        target.focus();

        if (target.setSelectionRange && target.type === 'text') {
            const length = target.value.length;
            target.setSelectionRange(length, length);
        }
    }

    function commonNumber(values) {
        let result = null;

        for (let index = 0; index < values.length; index += 1) {
            const value = normalizeNumber(values[index]);

            if (result === null) {
                result = value;
            } else if (value !== result) {
                return '';
            }
        }

        return result === null ? '' : result;
    }

    function applyEverywhere(order, draft, rowKey, value) {
        const normalized = normalizeNumber(value);

        if (rowKey.indexOf('show:') === 0) {
            const showId = Number(rowKey.slice(5));
            const show = order.shows.find(function (item) { return item.id === showId; });

            if (!show) return;

            show.staff_ids.forEach(function (employeeId) {
                setCellValue(draft, showId, employeeId, normalized);
            });

            return;
        }

        order.columns.forEach(function (column) {
            const key = String(column.employee_id);

            if (rowKey === 'daily') {
                draft.daily[key] = normalized;

                if (normalized !== '0') draft.project[key] = '';
            } else {
                draft.project[key] = normalized;

                if (normalized !== '0') draft.daily[key] = '';
            }
        });
    }

    function collectPayload(order, draft) {
        const payload = [];

        order.shows.forEach(function (show) {
            show.staff_ids.forEach(function (employeeId) {
                const amount = cellValue(draft, show.id, employeeId);

                if (amount > 0) {
                    payload.push({ kind: 'service', show_id: show.id, employee_id: employeeId, amount: amount });
                }
            });
        });

        order.columns.forEach(function (column) {
            const key = String(column.employee_id);
            const daily = Number(draft.daily[key]) || 0;
            const project = Number(draft.project[key]) || 0;

            if (project > 0) {
                payload.push({ kind: 'project', employee_id: column.employee_id, amount: project });
                return;
            }

            if (daily > 0) {
                payload.push({ kind: 'daily', employee_id: column.employee_id, amount: daily });
            }
        });

        return payload;
    }

    function saveShow(orderId, button) {
        const order = findShow(orderId);

        if (!order) return;

        const draft = ensureDraft(order);

        const body = new URLSearchParams();

        body.append('order_id', String(order.id));
        body.append('pays', JSON.stringify(collectPayload(order, draft)));

        if (button) button.disabled = true;

        fetch('/money/shows/pay/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': window.UI ? window.UI.getCSRFToken() : '',
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: body.toString()
        })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok || !result.data.success) {
                    throw new Error((result.data && result.data.error) || 'Не удалось сохранить');
                }

                const index = state.shows.findIndex(function (item) { return item.id === result.data.show.id; });

                if (index !== -1) state.shows[index] = result.data.show;

                const fresh = state.shows[index] || result.data.show;

                state.draft[String(fresh.id)] = emptyDraft(fresh);

                rerenderCard(fresh);

                if (window.UI && window.UI.showToast) window.UI.showToast('Сохранено');
            })
            .catch(function (error) {
                if (window.UI && window.UI.showToast) window.UI.showToast(error.message || 'Ошибка сохранения');

                if (button) button.disabled = false;
            });
    }

    listNode.addEventListener('click', function (event) {
        if (event.target.closest('[data-more]')) {
            loadMore();
            return;
        }

        const cell = event.target.closest('.money-grid__cell');

        if (cell && event.target === cell) {
            const input = cell.querySelector('.money-grid__input');

            if (input && !input.disabled) {
                input.focus();

                if (input.setSelectionRange) {
                    input.setSelectionRange(0, input.value.length);
                }
            }

            return;
        }

        const toggle = event.target.closest('[data-toggle]');

        if (toggle) {
            const orderId = Number(toggle.dataset.toggle);
            const order = findShow(orderId);

            if (!order) return;

            if (state.expanded[String(orderId)] && state.draft[String(orderId)] && isDirty(state.draft[String(orderId)])) {
                const orderIdKey = String(orderId);

                window.UI.confirm({
                    title: 'Закрыть без сохранения?',
                    text: 'Изменения в таблице шоу не сохранены.',
                    okText: 'Закрыть',
                    cancelText: 'Отмена',
                    danger: true
                }).then(function (confirmed) {
                    if (!confirmed) return;

                    state.draft[orderIdKey] = emptyDraft(order);
                    state.expanded[orderIdKey] = false;

                    render();
                });

                return;
            }

            state.expanded[String(orderId)] = !state.expanded[String(orderId)];

            if (state.expanded[String(orderId)]) ensureDraft(order);

            render();
            return;
        }

        const saveBtn = event.target.closest('[data-save]');

        if (saveBtn) {
            saveShow(Number(saveBtn.dataset.save), saveBtn);
        }
    });

    function orderLink(orderId) {
        return window.location.origin + '/money/?tab=shows&order=' + encodeURIComponent(orderId);
    }

    function openOrderInNewTab(orderId) {
        const link = document.createElement('a');

        link.href = orderLink(orderId);
        link.target = '_blank';
        link.rel = 'noopener';
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    window.moneyOpenOrderInNewTab = openOrderInNewTab;

    listNode.addEventListener('contextmenu', function (event) {
        const head = event.target.closest ? event.target.closest('[data-toggle]') : null;

        if (!head) return;

        const order = findShow(Number(head.dataset.toggle));

        if (!order) return;

        event.preventDefault();

        openOrderInNewTab(order.id);
    });

    listNode.addEventListener('input', function (event) {
        if (!input.matches || !input.matches('.money-grid__input')) return;

        const card = input.closest('.money-show');

        if (!card) return;

        const order = findShow(Number(card.dataset.orderId));

        if (!order) return;

        const draft = ensureDraft(order);

        if (input.dataset.cell) {
            const value = normalizeNumber(input.value);

            setCellValue(draft, Number(input.dataset.showId), Number(input.dataset.employeeId), value);
        } else if (input.dataset.special) {
            const key = String(input.dataset.employeeId);

            if (input.dataset.special === 'daily') {
                draft.daily[key] = normalizeNumber(input.value);
            } else {
                draft.project[key] = normalizeNumber(input.value);
            }

            toggleSpecialCells(order, draft, key);
        } else if (input.dataset.everywhereInput) {
            applyEverywhere(order, draft, input.dataset.everywhereInput, input.value);
            refreshSpecialCells(order, draft);
        }

        draft.dirty = true;

        updateTotals(order, draft);
    });

    function toggleSpecialCells(order, draft, employeeId) {
        const card = listNode.querySelector('[data-order-id="' + order.id + '"]');

        if (!card) return;

        const key = String(employeeId);

        const dailyInput = card.querySelector('[data-special="daily"][data-employee-id="' + employeeId + '"]');
        const projectInput = card.querySelector('[data-special="project"][data-employee-id="' + employeeId + '"]');

        const isBulk = function (rowKey) {
            return draft.everywhere[order.id + ':' + rowKey] !== undefined;
        };

        const dailyLocked = isBulk('daily') || isDailyLocked(draft, employeeId);
        const projectLocked = isBulk('project') || isProjectLocked(draft, employeeId);

        if (dailyInput) {
            dailyInput.disabled = dailyLocked;
            dailyInput.classList.toggle('money-grid__input--locked', dailyLocked);
            dailyInput.value = formatCell(draft.daily[key]);
        }

        if (projectInput) {
            projectInput.disabled = projectLocked;
            projectInput.classList.toggle('money-grid__input--locked', projectLocked);
            projectInput.value = formatCell(draft.project[key]);
        }
    }

    function refreshSpecialCells(order, draft) {
        order.columns.forEach(function (column) {
            toggleSpecialCells(order, draft, column.employee_id);
        });
    }

    function updateTotals(order, draft) {
        const card = listNode.querySelector('[data-order-id="' + order.id + '"]');

        if (!card) return;

        const rows = card.querySelectorAll('.money-grid tbody .money-grid__row');

        order.shows.forEach(function (show, index) {
            const row = rows[index];

            if (!row) return;

            const cell = row.querySelector('.money-grid__total--row');

            if (cell) cell.textContent = formatMoney(rowTotal(draft, { kind: 'service', show_id: show.id }));
        });

        const totalCells = card.querySelectorAll('.money-grid tfoot .money-grid__total');

        order.columns.forEach(function (column, index) {
            const cell = totalCells[index];

            if (cell) cell.textContent = formatMoney(columnTotalByCells(draft, order, column.employee_id));
        });

        const grand = card.querySelector('.money-grid__grand');
        const footer = card.querySelector('.money-show__sum');

        if (grand) grand.textContent = formatMoney(grandTotal(draft));
        if (footer) footer.innerHTML = 'Итого по шоу: <b>' + formatMoney(grandTotal(draft)) + '</b>';

        const saveBtn = card.querySelector('[data-save]');

        if (saveBtn) saveBtn.disabled = !isDirty(draft);
    }

    listNode.addEventListener('change', function (event) {
        const input = event.target;

        if (!input.matches || !input.matches('[data-everywhere]')) return;

        const card = input.closest('.money-show');

        if (!card) return;

        const order = findShow(Number(card.dataset.orderId));

        if (!order) return;

        const draft = ensureDraft(order);
        const rowKey = input.dataset.everywhere;
        const key = order.id + ':' + rowKey;

        if (input.checked) {
            const values = order.columns.map(function (column) {
                return rowKey === 'daily' ? draft.daily[String(column.employee_id)] : draft.project[String(column.employee_id)];
            });

            draft.everywhere[key] = commonNumber(values);

            if (draft.everywhere[key] !== '') {
                applyEverywhere(order, draft, rowKey, draft.everywhere[key]);
                draft.dirty = true;
            }
        } else {
            delete draft.everywhere[key];
        }

        rerenderCard(order);
    });

    listNode.addEventListener('keydown', function (event) {
        if (!event.ctrlKey || event.altKey || event.metaKey) return;

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(event.key) === -1) return;

        const input = event.target;

        if (!input.matches || !input.matches('.money-grid__input')) return;

        const card = input.closest('.money-show');

        if (!card) return;

        event.preventDefault();

        let next = null;

        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            const cells = Array.prototype.slice.call(input.closest('tr').querySelectorAll('.money-grid__input'));

            let index = cells.indexOf(input);

            if (index === -1) return;

            const delta = event.key === 'ArrowRight' ? 1 : -1;

            for (index += delta; index >= 0 && index < cells.length; index += delta) {
                if (!cells[index].disabled) {
                    next = cells[index];
                    break;
                }
            }
        } else {
            const rows = Array.prototype.slice.call(card.querySelectorAll('.money-grid tbody tr'));
            const row = input.closest('tr');
            const position = Array.prototype.slice.call(row.querySelectorAll('.money-grid__input')).indexOf(input);

            if (position === -1) return;

            const delta = event.key === 'ArrowDown' ? 1 : -1;

            for (let index = rows.indexOf(row) + delta; index >= 0 && index < rows.length; index += delta) {
                const cells = rows[index].querySelectorAll('.money-grid__input');
                const candidate = cells[position];

                if (candidate && !candidate.disabled) {
                    next = candidate;
                    break;
                }
            }
        }

        if (!next) return;

        next.focus();

        if (next.setSelectionRange && next.type === 'text') {
            next.setSelectionRange(0, next.value.length);
        }

        next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });

    listNode.addEventListener('blur', function (event) {
        const input = event.target;

        if (!input.matches || !input.matches('.money-grid__input')) return;

        const card = input.closest('.money-show');

        if (!card) return;

        const order = findShow(Number(card.dataset.orderId));

        if (!order) return;

        if (normalizeNumber(input.value) !== String(input.value).trim()) {
            input.value = normalizeNumber(input.value);
        }

        if (input.dataset.everywhereInput) {
            const draft = ensureDraft(order);

            draft.everywhere[order.id + ':' + input.dataset.everywhereInput] = normalizeNumber(input.value);
            applyEverywhere(order, draft, input.dataset.everywhereInput, input.value);
            refreshSpecialCells(order, draft);
            updateTotals(order, draft);
        }
    }, true);

    const TAB_STORAGE_KEY = 'jiva_money_tab';
    const FILTERS_STORAGE_KEY = 'jiva_money_filters_open';
    const MOBILE_QUERY = window.matchMedia('(max-width: 860px)');

    function isMobileLayout() {
        return MOBILE_QUERY.matches;
    }

    function activeFiltersCount() {
        let count = 0;

        if (statusFilter && statusFilter.value !== 'all') count += 1;
        if ((dateFromInput && dateFromInput.value) || (dateToInput && dateToInput.value)) count += 1;
        if (sortFilter && sortFilter.value !== 'date_asc') count += 1;

        return count;
    }

    function syncFiltersToggle() {
        if (!filtersToggle) return;

        const open = filtersToggle.getAttribute('aria-expanded') === 'true';
        const count = activeFiltersCount();

        if (filtersCount) {
            filtersCount.textContent = String(count);
            filtersCount.hidden = count <= 0;
        }

        filtersToggle.classList.toggle('is-on', open || count > 0);
    }

    function setFiltersOpen(open) {
        if (!filtersNode) return;

        filtersNode.classList.toggle('is-collapsed', !open);
        filtersNode.hidden = false;

        if (filtersToggle) filtersToggle.setAttribute('aria-expanded', open ? 'true' : 'false');

        try {
            localStorage.setItem(FILTERS_STORAGE_KEY, open ? '1' : '0');
        } catch (error) {}

        syncFiltersToggle();
    }

    function applyFiltersMode() {
        if (!filtersToggle || !filtersNode) return;

        if (!isMobileLayout()) {
            filtersNode.hidden = false;
            filtersNode.classList.remove('is-collapsed');
            filtersToggle.hidden = true;
            return;
        }

        filtersToggle.hidden = false;
        filtersNode.hidden = false;

        if (filtersToggle.getAttribute('aria-expanded') === null) {
            let stored = '';

            try {
                stored = localStorage.getItem(FILTERS_STORAGE_KEY) || '';
            } catch (error) {}

            const open = stored === '1';

            filtersNode.classList.toggle('is-collapsed', !open);
            filtersToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        syncFiltersToggle();
    }

    if (filtersToggle) {
        filtersToggle.addEventListener('click', function () {
            const open = filtersToggle.getAttribute('aria-expanded') !== 'true';

            setFiltersOpen(open);
        });
    }

    if (MOBILE_QUERY.addEventListener) {
        MOBILE_QUERY.addEventListener('change', applyFiltersMode);
    } else if (MOBILE_QUERY.addListener) {
        MOBILE_QUERY.addListener(applyFiltersMode);
    }

    function applyTab(target) {
        tabButtons.forEach(function (item) {
            item.classList.toggle('active', item.dataset.tab === target);
        });

        document.querySelectorAll('.money-panel').forEach(function (panel) {
            panel.classList.toggle('active', panel.id === 'moneyPanel' + target.charAt(0).toUpperCase() + target.slice(1));
        });

        const isPayouts = target === 'payouts' || target === 'history';

        if (typeof window.applyMoneyPayoutsTab === 'function') {
            window.applyMoneyPayoutsTab(isPayouts);
        } else if (filtersNode) {
            filtersNode.hidden = target !== 'shows';
        }

        if (filtersToggle) {
            filtersToggle.classList.toggle('is-hidden', isPayouts);
        }

        if (filtersNode) {
            filtersNode.classList.toggle('is-payouts-mode', isPayouts);
        }

        if (isPayouts && typeof window.loadMoneyPayouts === 'function') {
            window.loadMoneyPayouts();
        }

        if (target === 'history' && typeof window.renderMoneyPayoutHistory === 'function') {
            window.renderMoneyPayoutHistory();
        }

        applyFiltersMode();
    }

    tabButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            const target = button.dataset.tab;

            try {
                localStorage.setItem(TAB_STORAGE_KEY, target);
            } catch (error) {}

            applyTab(target);
        });
    });

    if (statusFilter) statusFilter.addEventListener('change', function () { syncFiltersToggle(); loadShows(); });
    if (sortFilter) sortFilter.addEventListener('change', function () { syncFiltersToggle(); loadShows(); });
    if (dateFromInput) dateFromInput.addEventListener('change', function () { syncFiltersToggle(); loadShows(); });
    if (dateToInput) dateToInput.addEventListener('change', function () { syncFiltersToggle(); loadShows(); });

    applyFiltersMode();

    loadShows();

    const startParams = new URLSearchParams(window.location.search);
    const startOrderId = parseInt(startParams.get('order') || '', 10);
    const startTab = startParams.get('tab');

    let savedTab = 'shows';

    try {
        savedTab = localStorage.getItem(TAB_STORAGE_KEY) || 'shows';
    } catch (error) {}

    const initialTab = (startTab === 'shows' || startTab === 'payouts' || startTab === 'history')
        ? startTab
        : (savedTab === 'payouts' || savedTab === 'history' ? savedTab : 'shows');

    applyTab(initialTab);

    if (!isNaN(startOrderId)) {
        window.history.replaceState({}, '', window.location.pathname);
        focusOrderById(startOrderId);
    }
})();
