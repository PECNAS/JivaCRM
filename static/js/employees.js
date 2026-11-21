(function() {
    let currentEmployeeId = null;
    let allServices = [];
    let empData = null;
    let empMode = 'edit';
    let empDirty = false;
    let empPendingDocs = [];

    const tableBody = document.getElementById('employeesTableBody');
    const searchInput = document.getElementById('searchInput');
    const roleFilter = document.getElementById('roleFilter');
    const modal = document.getElementById('employeeModal');
    const cardView = document.getElementById('empCardView');
    const addEmployeeBtn = document.getElementById('addEmployeeBtn');
    const empSaveBtn = document.getElementById('empSaveBtn');
    const empCloseBtn = document.getElementById('empCloseBtn');
    const empDeactivateBtn = document.getElementById('empDeactivateBtn');
    const empCreatedText = document.getElementById('empCreatedText');
    const empDocFile = document.getElementById('empDocFile');
    const rolesTemplate = document.getElementById('empRolesTemplate');

    const artistCardModal = document.getElementById('artistCardModal');
    const artistCardModalCloseBtn = document.getElementById('artistCardModalCloseBtn');
    const artistCardCancelBtn = document.getElementById('artistCardCancelBtn');
    const artistCardForm = document.getElementById('artistCardForm');
    const showsMultiSelect = document.getElementById('showsMultiSelect');

    const roleLabels = {};

    function loadRoleLabels() {
        if (!rolesTemplate) return;

        rolesTemplate.content.querySelectorAll('[data-role]').forEach(function(node) {
            roleLabels[node.dataset.role] = node.dataset.label;
        });
    }

    loadRoleLabels();

    function getCSRFToken() {
        const cookieValue = document.cookie.match(/(^|; )csrftoken=([^;]+)/);

        if (cookieValue) return cookieValue[2];

        return window.__csrfToken || '';
    }

    function showToast(message) {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(message);
            return;
        }

        const container = document.getElementById('toastContainer');

        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
        }, 2000);
    }

    function escapeHtml(text) {
        if (!text && text !== 0) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function getPath(path) {
        const parts = String(path).split('.');
        let value = empData;

        parts.forEach(function(part) {
            value = value == null ? '' : value[part];
        });

        return value == null ? '' : value;
    }

    function setPath(path, value) {
        const parts = String(path).split('.');

        if (!empData[parts[0]]) empData[parts[0]] = {};

        let holder = empData;

        for (let i = 0; i < parts.length - 1; i += 1) {
            if (!holder[parts[i]]) holder[parts[i]] = {};
            holder = holder[parts[i]];
        }

        holder[parts[parts.length - 1]] = value;
    }

    const MASKS = {
        phone: function(v) {
            const digits = String(v || '').replace(/\D/g, '');
            return digits ? window.UI.formatPhone(digits) : '';
        },
        series: function(v) {
            const digits = String(v || '').replace(/\D/g, '').slice(0, 4);
            return digits.length > 2 ? digits.slice(0, 2) + ' ' + digits.slice(2) : digits;
        },
        code: function(v) {
            const digits = String(v || '').replace(/\D/g, '').slice(0, 6);
            return digits.length > 3 ? digits.slice(0, 3) + '-' + digits.slice(3) : digits;
        },
        date: function(v) {
            const digits = String(v || '').replace(/\D/g, '').slice(0, 8);
            let out = digits.slice(0, 2);
            if (digits.length > 2) out += '.' + digits.slice(2, 4);
            if (digits.length > 4) out += '.' + digits.slice(4, 8);
            return out;
        },
        number: function(v) {
            return String(v || '').replace(/\D/g, '').slice(0, 6);
        },
        inn: function(v) {
            return String(v || '').replace(/\D/g, '').slice(0, 12);
        },
        snils: function(v) {
            const d = String(v || '').replace(/\D/g, '').slice(0, 11);
            let out = d.slice(0, 3);
            if (d.length > 3) out += '-' + d.slice(3, 6);
            if (d.length > 6) out += '-' + d.slice(6, 9);
            if (d.length > 9) out += ' ' + d.slice(9, 11);
            return out;
        }
    };

    const MASK_BY_PATH = {
        phone: 'phone',
        inn: 'inn',
        snils: 'snils',
        'passport.series': 'series',
        'passport.number': 'number',
        'passport.code': 'code',
        'passport.issuedAt': 'date',
        'foreign.series': 'series',
        'foreign.number': 'number',
        'foreign.code': 'code',
        'foreign.issuedAt': 'date',
        'artist.weight': 'number',
        'artist.height': 'number',
        'artist.shoe': 'number'
    };

    const WIDE_KEYS = {
        name: true,
        address: true,
        comment: true,
        'artist.comment': true,
        'passport.issuedBy': true,
        'foreign.issuedBy': true
    };

    const REQUIRED_KEYS = {
        name: 'ФИО',
        login: 'Логин',
        password: 'Пароль'
    };

    function autoGrow(el) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    function renderValue(path, display, extraClass) {
        const raw = getPath(path);
        const text = display != null ? display : raw;
        const empty = String(text).trim() === '';

        return '<span class="p-row__v' + (empty ? ' is-empty' : '') + ' m-editable ' + (extraClass || '')
            + '" data-edit="' + escapeHtml(path) + '">'
            + (empty ? '<span class="p-empty">—</span>' : escapeHtml(text))
            + '</span>';
    }

    function renderRow(label, path, display) {
        return '<div class="p-row"><span class="p-row__k">' + escapeHtml(label) + '</span>'
            + renderValue(path, display)
            + '</div>';
    }

    function renderPassportCard(title, key) {
        const holder = empData[key] || {};
        const numberText = [holder.series, holder.number].filter(Boolean).join(' ');

        return '<div class="p-card">'
            + '<div class="sec">' + escapeHtml(title) + '</div>'
            + '<div class="p-pass">'
            + '<span class="p-pass__num">' + renderValue(key + '.number', numberText, 'p-pass__num-link') + '</span>'
            + '<span class="p-pass__code">' + renderValue(key + '.code') + '</span>'
            + '<span class="p-pass__by">' + renderValue(key + '.issuedBy') + '</span>'
            + '<span class="p-pass__date">' + renderValue(key + '.issuedAt') + '</span>'
            + '</div></div>';
    }

    function renderRoleChips() {
        if (!rolesTemplate) return '';

        const active = (empData.roles || []).slice();

        return Array.from(rolesTemplate.content.querySelectorAll('[data-role]')).map(function(node) {
            const on = active.indexOf(node.dataset.role) !== -1;

            return '<span class="chip chip--role' + (on ? ' is-on' : '') + '" data-role="'
                + escapeHtml(node.dataset.role) + '">' + escapeHtml(node.dataset.label) + '</span>';
        }).join('');
    }

    function renderSkills() {
        const skills = (empData.artist && empData.artist.skills) || [];

        if (!skills.length) return '<span class="p-empty">—</span>';

        return skills.map(function(name) {
            return '<span class="chip">' + escapeHtml(name)
                + '<button type="button" class="chip__x" data-skill-remove="' + escapeHtml(name) + '">×</button>'
                + '</span>';
        }).join('');
    }

    function renderDocs() {
        const docs = empPendingDocs || [];

        if (!docs.length) return '';

        return docs.map(function(doc, index) {
            return '<span class="p-doc" data-doc-index="' + index + '">'
                + '<span class="p-doc__type">' + escapeHtml(doc.typeLabel) + '</span>'
                + (doc.url
                    ? '<a class="p-doc__file" href="' + escapeHtml(doc.url) + '" target="_blank" rel="noopener">' + escapeHtml(doc.file) + '</a>'
                    : '<span class="p-doc__file">' + escapeHtml(doc.file) + '</span>')
                + '<span class="p-doc__size">' + escapeHtml(doc.size) + '</span>'
                + '<button type="button" class="p-doc__x" data-doc-remove="' + index + '" title="Удалить">'
                + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
                + '</button>'
                + '</span>';
        }).join('');
    }

    function isArtist() {
        return (empData.roles || []).indexOf('artist') !== -1;
    }

    function renderCard() {
        if (!cardView || !empData) return;

        const activeField = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.edit : null;
        const scrollTop = cardView.querySelector('.p-body') ? cardView.querySelector('.p-body').scrollTop : 0;

        let html = '';

        html += '<div class="p-head">'
            + '<div class="p-head__main">'
            + '<div class="p-head__name m-editable" data-edit="name">' + escapeHtml(empData.name || 'Новый сотрудник') + '</div>'
            + '<div class="p-head__sub">'
            + renderValue('nickname')
            + '<span class="p-dot"></span>'
            + renderValue('login')
            + '<button type="button" class="chip ' + (empData.active !== false ? 'chip--ok' : 'chip--off') + '" id="activeBtn">'
            + (empData.active !== false ? 'Активен' : 'Неактивен') + '</button>'
            + '</div>'
            + '</div>'
            + '<div class="p-head__roles" id="roleBox">' + renderRoleChips() + '</div>'
            + '<button type="button" class="icon-btn" data-close title="Закрыть">'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
            + '</button>'
            + '</div>';

        html += '<div class="p-body">';

        html += '<div class="p-col">';
        html += '<div class="p-card">'
            + '<div class="sec">Контакты</div>'
            + renderRow('Телефон', 'phone')
            + renderRow('Телеграм', 'telegram')
            + renderRow('Инстаграм', 'instagram')
            + renderRow('РЖД бонус', 'rzd')
            + renderRow('Адрес', 'address')
            + '</div>';

        html += '<div class="p-card">'
            + '<div class="sec">Доступ</div>'
            + renderRow('Логин', 'login')
            + renderRow('Пароль', 'password', empData.password || '')
            + '</div>';

        html += '<div class="p-card">'
            + '<div class="sec">Идентификация</div>'
            + renderRow('ИНН', 'inn')
            + renderRow('СНИЛС', 'snils')
            + '</div>';
        html += '</div>';

        html += '<div class="p-col">';
        html += renderPassportCard('Паспорт РФ', 'passport');
        html += renderPassportCard('Загранпаспорт', 'foreign');

        if (isArtist()) {
            html += '<div class="p-card">'
                + '<div class="sec">Карточка артиста</div>'
                + '<div class="p-params">'
                + '<div class="p-param"><span class="p-param__k">Вес</span>' + renderValue('artist.weight') + '</div>'
                + '<div class="p-param"><span class="p-param__k">Рост</span>' + renderValue('artist.height') + '</div>'
                + '<div class="p-param"><span class="p-param__k">Обувь</span>' + renderValue('artist.shoe') + '</div>'
                + '</div>'
                + '<div class="p-skills" id="skillBox">' + renderSkills() + '</div>'
                + renderRow('Комментарий', 'artist.comment')
                + '</div>';
        }

        html += '</div></div>';

        html += '<div class="p-foot">'
            + '<div class="p-docs"><span class="sec">Документы</span>'
            + '<div class="p-docs__list" id="docList">' + renderDocs() + '</div>'
            + '<button type="button" class="p-add" id="docAdd">'
            + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Загрузить</button>'
            + '</div>'
            + '</div>';

        cardView.innerHTML = html;

        const body = cardView.querySelector('.p-body');

        if (body) body.scrollTop = scrollTop;

        if (activeField) {
            const node = cardView.querySelector('[data-edit="' + activeField + '"]');

            if (node) startEdit(node, true);
        }
    }

    function emptyEmployee() {
        return {
            id: null,
            name: '',
            nickname: '',
            login: '',
            password: '',
            roles: [],
            phone: '',
            telegram: '',
            instagram: '',
            rzd: '',
            address: '',
            inn: '',
            snils: '',
            active: true,
            passport: { series: '', number: '', issuedBy: '', issuedAt: '', code: '' },
            foreign: { series: '', number: '', issuedBy: '', issuedAt: '', code: '' },
            artist: { weight: '', height: '', shoe: '', skills: [], comment: '' },
            created: '',
        };
    }

    function employeeFromData(data) {
        return {
            id: data.id,
            name: data.full_name || '',
            nickname: data.nickname || '',
            login: data.username || '',
            password: '',
            roles: (data.role_codes && data.role_codes.length ? data.role_codes : [data.role]).filter(Boolean),
            phone: data.phone || '',
            telegram: data.telegram || '',
            instagram: data.instagram || '',
            rzd: data.rzd_bonus_number || '',
            address: data.passport_registration || '',
            inn: data.passport_inn || '',
            snils: data.passport_snils || '',
            active: !!data.is_active,
            passport: {
                series: data.passport_series || '',
                number: data.passport_number || '',
                issuedBy: data.passport_issued_by || '',
                issuedAt: data.passport_issued_date ? data.passport_issued_date.split('-').reverse().join('.') : '',
                code: data.passport_department_code || '',
            },
            foreign: {
                series: data.international_passport_series || '',
                number: data.international_passport_number || '',
                issuedBy: '',
                issuedAt: '',
                code: '',
            },
            artist: {
                weight: data.artist_card ? (data.artist_card.weight || '') : '',
                height: data.artist_card ? (data.artist_card.height || '') : '',
                shoe: data.artist_card ? (data.artist_card.shoe_size || '') : '',
                skills: data.artist_card && data.artist_card.skills_text
                    ? String(data.artist_card.skills_text).split(',').map(s => s.trim()).filter(Boolean)
                    : [],
                comment: data.artist_card ? (data.artist_card.comment || '') : '',
            },
            created: data.date_joined ? 'Создан ' + data.date_joined : '',
        };
    }

    function openEmployeeModal(employeeId) {
        currentEmployeeId = employeeId;
        empMode = 'edit';
        empDirty = false;
        empPendingDocs = [];

        fetch('/employees/' + employeeId + '/')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                empData = employeeFromData(data);
                empPendingDocs = (data.documents || []).map(function(item) {
                    return {
                        id: item.id,
                        kind: item.kind,
                        typeLabel: item.kind_display,
                        file: (item.url || '').split('/').pop(),
                        size: item.uploaded_at,
                        url: item.url,
                    };
                });

                empCreatedText.textContent = empData.created || '';
                empDeactivateBtn.style.display = '';

                renderCard();
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            })
            .catch(error => {
                showToast('Ошибка загрузки данных сотрудника');
                console.error(error);
            });
    }

    function openAddEmployee() {
        currentEmployeeId = null;
        empMode = 'create';
        empDirty = false;
        empPendingDocs = [];
        empData = emptyEmployee();
        empData.roles = ['artist'];

        empCreatedText.textContent = '';
        empDeactivateBtn.style.display = 'none';

        renderCard();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeEmployeeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentEmployeeId = null;
        empData = null;
        empDirty = false;
        empPendingDocs = [];
    }

    function requestCloseEmployeeModal() {
        const proceed = function() {
            closeEmployeeModal();

            if (empMode === 'create') addEmployeeBtn.focus();
        };

        if (!empDirty) {
            proceed();
            return;
        }

        window.UI.confirm({
            title: 'Закрыть карточку?',
            text: 'Изменения не сохранены. Вы действительно хотите закрыть?',
            okText: 'Закрыть',
            cancelText: 'Остаться',
            danger: true
        }).then(function(confirmed) {
            if (confirmed) proceed();
        });
    }

    function startSkillEdit() {
        const box = document.getElementById('skillBox');

        if (!box || box.querySelector('.p-input')) return;

        const input = document.createElement('input');
        input.className = 'p-input p-input--chip';
        input.placeholder = 'навык';
        box.appendChild(input);
        input.focus();

        let done = false;

        function finish(save) {
            if (done) return;
            done = true;

            const value = input.value.trim();

            if (save && value && empData.artist.skills.indexOf(value) === -1) {
                empData.artist.skills.push(value);
                empDirty = true;
            }

            renderCard();
        }

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                finish(false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                finish(true);
            }
        });

        input.addEventListener('blur', function() {
            setTimeout(function() {
                if (input.value.trim()) finish(true);
                else finish(false);
            }, 60);
        });
    }

    function startEdit(target, silent) {
        if (!target || target.querySelector('input, textarea')) return;

        const path = target.dataset.edit;
        const raw = String(getPath(path) || '');
        const wide = WIDE_KEYS[path] || raw.length > 34;
        const maskName = MASK_BY_PATH[path];
        const mask = maskName ? MASKS[maskName] : null;

        const input = document.createElement(wide ? 'textarea' : 'input');
        input.className = 'p-input' + (wide ? ' p-input--area' : '');
        input.value = raw;
        input.dataset.edit = path;

        if (wide) input.rows = 2;

        const holder = document.createElement('span');
        holder.className = 'p-editbox' + (wide ? ' p-editbox--wide' : '');
        holder.appendChild(input);

        target.innerHTML = '';
        target.appendChild(holder);
        target.classList.add('is-editing');
        target.classList.remove('is-empty');

        if (!silent) input.focus();

        const end = input.value.length;
        input.setSelectionRange(end, end);

        if (wide) autoGrow(input);

        let done = false;

        function finish(save) {
            if (done) return;
            done = true;

            if (!save) {
                renderCard();
                return;
            }

            let value = mask ? mask(input.value) : input.value;
            value = String(value).trim();

            if (value === raw) {
                renderCard();
                return;
            }

            setPath(path, value);
            empDirty = true;

            if (path === 'role' || path.indexOf('roles') === 0) {
                /* noop */
            }

            if (path === 'name' && value) {
                const row = document.querySelector('tr[data-employee-id="' + currentEmployeeId + '"] [data-row-name]');
                if (row) row.textContent = value;
            }

            renderCard();
        }

        input.addEventListener('input', function() {
            if (wide) autoGrow(input);
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                finish(false);
                return;
            }

            if (e.key !== 'Enter') return;
            if (wide && !e.ctrlKey) return;

            e.preventDefault();
            finish(true);
        });

        input.addEventListener('blur', function() {
            setTimeout(function() { finish(true); }, 60);
        });
    }

    function collectRoles() {
        return (empData.roles || []).slice();
    }

    function toggleRole(code) {
        const list = (empData.roles || []).slice();
        const index = list.indexOf(code);

        if (index === -1) {
            list.push(code);
        } else {
            if (list.length === 1) {
                showToast('Должна быть выбрана хотя бы одна роль');
                return;
            }

            list.splice(index, 1);
        }

        empData.roles = list;
        empDirty = true;
        renderCard();
    }

    function buildPayload() {
        const passwordField = getPath('password');

        return {
            username: String(getPath('login') || '').trim(),
            password: String(passwordField || '').trim(),
            full_name: String(getPath('name') || '').trim(),
            nickname: String(getPath('nickname') || '').trim(),
            roles: collectRoles().join(','),
            phone: String(getPath('phone') || '').trim(),
            telegram: String(getPath('telegram') || '').trim(),
            is_active: empData.active !== false ? 'on' : 'off',
            passport_series: String(getPath('passport.series') || '').trim(),
            passport_number: String(getPath('passport.number') || '').trim(),
            passport_issued_by: String(getPath('passport.issuedBy') || '').trim(),
            passport_issued_date: isoDate(getPath('passport.issuedAt')),
            passport_department_code: String(getPath('passport.code') || '').trim(),
            passport_registration: String(getPath('address') || '').trim(),
            passport_inn: String(getPath('inn') || '').trim(),
            passport_snils: String(getPath('snils') || '').trim(),
            rzd_bonus_number: String(getPath('rzd') || '').trim(),
            instagram: String(getPath('instagram') || '').trim(),
            international_passport_series: String(getPath('foreign.series') || '').trim(),
            international_passport_number: String(getPath('foreign.number') || '').trim(),
        };
    }

    function isoDate(value) {
        const match = String(value || '').trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

        if (!match) return '';

        return match[3] + '-' + match[2] + '-' + match[1];
    }

    function validatePayload(payload) {
        if (!payload.full_name) {
            showToast('Укажите ФИО сотрудника');
            return false;
        }

        if (empMode === 'create' && !payload.username) {
            showToast('Укажите логин');
            return false;
        }

        if (empMode === 'create' && !payload.password) {
            showToast('Укажите пароль');
            return false;
        }

        if (!payload.roles) {
            showToast('Выберите хотя бы одну роль');
            return false;
        }

        return true;
    }

    function saveEmployee() {
        if (!empData) return;

        const payload = buildPayload();

        if (!validatePayload(payload)) return;

        const isCreate = empMode === 'create';
        const url = isCreate ? '/employees/' : '/employees/' + currentEmployeeId + '/update/';

        if (empSaveBtn) window.UI.setButtonBusy(empSaveBtn, true, 'Сохранение...');

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: new URLSearchParams(payload)
        })
        .then(response => response.json().then(body => ({ status: response.status, body: body })))
        .then(function(result) {
            const data = result.body;

            if (data.error) {
                showToast(data.error);
                return;
            }

            if (!data.success) return;

            const employeeId = (data.employee && data.employee.id) || currentEmployeeId;

            empDirty = false;

            const saveArtistCard = isArtist() && empData.artist
                ? fetch('/employees/' + employeeId + '/artist-card/update/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: new URLSearchParams({
                        weight: String(empData.artist.weight || '').trim(),
                        height: String(empData.artist.height || '').trim(),
                        shoe_size: String(empData.artist.shoe || '').trim(),
                        skills_text: (empData.artist.skills || []).join(', '),
                        comment: String(empData.artist.comment || '').trim(),
                    })
                }).catch(function() { return null; })
                : Promise.resolve(null);

            return saveArtistCard
                .then(function() { return uploadPendingDocuments(employeeId); })
                .then(function() {
                    showToast(isCreate ? 'Сотрудник создан' : 'Данные сохранены');

                    if (isCreate) {
                        closeEmployeeModal();
                    } else {
                        closeEmployeeModal();
                    }

                    loadEmployees(true);
                });
        })
        .catch(function(error) {
            showToast(isCreate ? 'Ошибка при создании сотрудника' : 'Ошибка сохранения');
            console.error(error);
        })
        .finally(function() {
            if (empSaveBtn) window.UI.setButtonBusy(empSaveBtn, false);
        });
    }

    function uploadPendingDocuments(employeeId) {
        const pending = (empPendingDocs || []).filter(function(doc) { return doc.fileRef; });

        if (!pending.length) return Promise.resolve();

        return pending.reduce(function(chain, doc) {
            return chain.then(function() {
                const formData = new FormData();
                formData.append('file', doc.fileRef);
                formData.append('kind', doc.kind || 'other');
                formData.append('title', doc.typeLabel || '');

                return fetch('/employees/' + employeeId + '/documents/', {
                    method: 'POST',
                    headers: { 'X-CSRFToken': getCSRFToken() },
                    body: formData,
                }).catch(function() { return null; });
            });
        }, Promise.resolve());
    }

    function deactivateCurrentEmployee() {
        if (!currentEmployeeId) return;

        window.UI.confirm({
            title: 'Деактивировать сотрудника?',
            text: 'Сотрудник перестанет отображаться во всех списках и не будет доступен для назначения. В уже существующих заказах он останется.',
            okText: 'Деактивировать',
            cancelText: 'Отмена',
            danger: true
        }).then(function(confirmed) {
            if (!confirmed) return;

            fetch('/employees/' + currentEmployeeId + '/delete/', {
                method: 'POST',
                headers: { 'X-CSRFToken': getCSRFToken() }
            })
            .then(response => response.json())
            .then(function(data) {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                if (data.success) {
                    showToast('Сотрудник деактивирован');
                    closeEmployeeModal();
                    loadEmployees(true);
                }
            })
            .catch(function(error) {
                showToast('Ошибка при деактивации сотрудника');
                console.error(error);
            });
        });
    }

    function removeDocument(index) {
        const doc = (empPendingDocs || [])[index];

        if (!doc) return;

        if (doc.id && currentEmployeeId) {
            fetch('/employees/' + currentEmployeeId + '/documents/' + doc.id + '/delete/', {
                method: 'POST',
                headers: { 'X-CSRFToken': getCSRFToken() },
            })
            .then(response => response.json())
            .then(function(data) {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                empPendingDocs.splice(index, 1);
                renderCard();
            })
            .catch(function() { showToast('Не удалось удалить документ'); });

            return;
        }

        empPendingDocs.splice(index, 1);
        renderCard();
    }

    function pickDocuments() {
        if (!empDocFile) return;

        empDocFile.value = '';
        empDocFile.click();
    }

    if (empDocFile) {
        empDocFile.addEventListener('change', function() {
            const files = Array.prototype.slice.call(empDocFile.files || []);

            if (!files.length) return;

            files.forEach(function(file) {
                empPendingDocs.push({
                    id: null,
                    kind: 'other',
                    typeLabel: 'Прочее',
                    file: file.name,
                    size: (file.size / 1048576).toFixed(1).replace('.', ',') + ' МБ',
                    fileRef: file,
                });
            });

            empDirty = true;
            renderCard();
        });
    }

    function bindCardEvents() {
        if (!cardView) return;

        cardView.addEventListener('click', function(e) {
            if (e.target.closest('input, textarea')) return;

            if (e.target.closest('[data-close]')) {
                requestCloseEmployeeModal();
                return;
            }

            if (e.target.closest('#activeBtn')) {
                empData.active = empData.active === false;
                empDirty = true;
                renderCard();
                return;
            }

            const roleChip = e.target.closest('.chip--role');

            if (roleChip) {
                toggleRole(roleChip.dataset.role);
                return;
            }

            if (e.target.closest('#docAdd')) {
                pickDocuments();
                return;
            }

            const docRemove = e.target.closest('[data-doc-remove]');

            if (docRemove) {
                removeDocument(Number(docRemove.dataset.docRemove));
                return;
            }

            const skillRemove = e.target.closest('[data-skill-remove]');

            if (skillRemove) {
                const name = skillRemove.dataset.skillRemove;

                empData.artist.skills = (empData.artist.skills || []).filter(function(item) {
                    return item !== name;
                });

                empDirty = true;
                renderCard();
                return;
            }

            if (e.target.closest('#skillBox')) {
                startSkillEdit();
                return;
            }

            const target = e.target.closest('[data-edit]');

            if (target) startEdit(target);
        });
    }

    bindCardEvents();

    if (empSaveBtn) empSaveBtn.addEventListener('click', saveEmployee);
    if (empCloseBtn) empCloseBtn.addEventListener('click', requestCloseEmployeeModal);
    if (empDeactivateBtn) empDeactivateBtn.addEventListener('click', deactivateCurrentEmployee);
    if (addEmployeeBtn) addEmployeeBtn.addEventListener('click', openAddEmployee);

    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) requestCloseEmployeeModal();
        });
    }

    function attachRowEvents() {
        tableBody.querySelectorAll('tr[data-employee-id]').forEach(row => {
            row.addEventListener('click', function(e) {
                if (e.button !== 0) return;

                const id = parseInt(row.getAttribute('data-employee-id'));
                openEmployeeModal(id);
            });

            row.addEventListener('contextmenu', function(e) {
                e.preventDefault();

                const id = parseInt(row.getAttribute('data-employee-id'));
                openEmployeeModal(id);
            });
        });
    }

    function renderShowsCheckboxes(selectedIds) {
        if (!showsMultiSelect) return;

        if (!allServices.length) {
            showsMultiSelect.innerHTML = '<span class="artist-card-empty">Нет доступных услуг</span>';
            return;
        }

        const selectedSet = new Set(selectedIds || []);

        showsMultiSelect.innerHTML = allServices.map(function(s) {
            const checked = selectedSet.has(s.id);

            return '<label class="show-checkbox-label' + (checked ? ' checked' : '') + '">'
                + '<input type="checkbox" value="' + s.id + '"' + (checked ? ' checked' : '') + '>'
                + escapeHtml(s.name)
                + '</label>';
        }).join('');

        showsMultiSelect.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
            cb.addEventListener('change', function() {
                this.closest('.show-checkbox-label').classList.toggle('checked', this.checked);
            });
        });
    }

    function closeArtistCardModal() {
        if (artistCardModal) artistCardModal.classList.remove('active');
    }

    function openArtistCardModal(employeeId) {
        fetch('/employees/' + employeeId + '/artist-card/')
            .then(r => r.json())
            .then(function(data) {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                const card = data.artist_card || {};

                document.getElementById('artistWeight').value = card.weight || '';
                document.getElementById('artistHeight').value = card.height || '';
                document.getElementById('artistShoeSize').value = card.shoe_size || '';
                document.getElementById('artistSkillsText').value = card.skills_text || '';
                document.getElementById('artistComment').value = card.comment || '';

                renderShowsCheckboxes((card.known_shows || []).map(s => s.id));
                artistCardModal.classList.add('active');
            })
            .catch(function(error) {
                showToast('Ошибка загрузки карточки артиста');
                console.error(error);
            });
    }

    if (artistCardModalCloseBtn) artistCardModalCloseBtn.addEventListener('click', closeArtistCardModal);
    if (artistCardCancelBtn) artistCardCancelBtn.addEventListener('click', closeArtistCardModal);

    if (artistCardModal) {
        artistCardModal.addEventListener('click', function(e) {
            if (e.target === this) closeArtistCardModal();
        });
    }

    if (artistCardForm) {
        artistCardForm.addEventListener('submit', function(e) {
            e.preventDefault();

            if (!currentEmployeeId) return;

            const selectedShows = [];

            showsMultiSelect.querySelectorAll('input[type="checkbox"]:checked').forEach(function(cb) {
                selectedShows.push(cb.value);
            });

            fetch('/employees/' + currentEmployeeId + '/artist-card/update/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams({
                    weight: document.getElementById('artistWeight').value.trim(),
                    height: document.getElementById('artistHeight').value.trim(),
                    shoe_size: document.getElementById('artistShoeSize').value.trim(),
                    skills_text: document.getElementById('artistSkillsText').value.trim(),
                    comment: document.getElementById('artistComment').value.trim(),
                    known_shows: selectedShows.join(','),
                })
            })
            .then(r => r.json())
            .then(function(res) {
                if (res.error) {
                    showToast(res.error);
                    return;
                }

                if (res.success) {
                    showToast('Карточка артиста сохранена');
                    closeArtistCardModal();
                }
            })
            .catch(function(error) {
                showToast('Ошибка сохранения карточки');
                console.error(error);
            });
        });
    }

    function loadServices() {
        fetch('/artist-card/services/')
            .then(r => r.json())
            .then(function(data) {
                if (data.services) allServices = data.services;
            })
            .catch(function(error) { console.error(error); });
    }

    const EMPLOYEES_PAGE = 50;
    let employeesOffset = 0;

    const loadMoreBox = document.getElementById('employeesLoadMore');
    const loadMoreBtn = document.getElementById('employeesLoadMoreBtn');

    function updateRowNumbers() {
        tableBody.querySelectorAll('tr[data-employee-id]').forEach(function(row, index) {
            const cell = row.querySelector('.employees-table__index');

            if (cell) cell.textContent = String(index + 1);
        });
    }

    function employeeRow(emp) {
        return '<tr data-employee-id="' + emp.id + '">'
            + '<td class="employees-table__index"></td>'
            + '<td>'
            + '<div class="employee-name-cell">'
            + '<span class="employee-name-cell__main" data-row-name>' + escapeHtml(emp.display_name || emp.full_name) + '</span>'
            + '<span class="employee-name-cell__sub">' + escapeHtml(emp.full_name) + '</span>'
            + '</div>'
            + '</td>'
            + '<td>' + escapeHtml(emp.username) + '</td>'
            + '<td>' + escapeHtml(emp.roles_label || emp.role_display || '') + '</td>'
            + '<td>' + escapeHtml(emp.phone || '—') + '</td>'
            + '</tr>';
    }

    function loadEmployees(reset) {
        const search = searchInput.value.trim();
        const role = roleFilter.value;
        const params = new URLSearchParams();

        if (reset) {
            employeesOffset = 0;
            tableBody.innerHTML = '<tr><td colspan="5" class="load-more__empty">Загрузка...</td></tr>';
        }

        if (search) params.set('search', search);
        if (role && role !== 'all') params.set('role', role);
        params.set('limit', String(EMPLOYEES_PAGE));
        params.set('offset', String(employeesOffset));

        if (loadMoreBtn) loadMoreBtn.disabled = true;

        fetch('/employees/list/?' + params.toString())
            .then(response => response.json())
            .then(function(data) {
                if (loadMoreBtn) loadMoreBtn.disabled = false;

                if (data.error) {
                    showToast(data.error);
                    return;
                }

                const rows = data.employees || [];

                if (reset) tableBody.innerHTML = '';

                if (!reset && !rows.length) {
                    if (loadMoreBox) loadMoreBox.classList.add('load-more--done');
                    return;
                }

                if (reset && !rows.length) {
                    tableBody.innerHTML = '<tr><td colspan="5" class="load-more__empty">Сотрудники не найдены</td></tr>';
                } else {
                    tableBody.insertAdjacentHTML('beforeend', rows.map(employeeRow).join(''));
                }

                employeesOffset += rows.length;
                updateRowNumbers();

                if (loadMoreBox) {
                    loadMoreBox.classList.toggle('load-more--done', !data.has_more);
                }

                attachRowEvents();
            })
            .catch(function(error) {
                if (loadMoreBtn) loadMoreBtn.disabled = false;
                console.error(error);
            });
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function() { loadEmployees(false); });
    }

    let searchTimeout;

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() { loadEmployees(true); }, 400);
        });
    }

    if (roleFilter) {
        roleFilter.addEventListener('change', function() { loadEmployees(true); });
    }

    if (artistCardModal) window.UI.registerModal(artistCardModal, closeArtistCardModal);
    if (modal) window.UI.registerModal(modal, requestCloseEmployeeModal);

    loadServices();
    attachRowEvents();

    if (loadMoreBox) {
        loadMoreBox.classList.toggle('load-more--done', loadMoreBox.dataset.hasMore !== '1');
    }

    employeesOffset = tableBody.querySelectorAll('tr[data-employee-id]').length;
})();
