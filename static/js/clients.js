(function() {
    let currentClientId = null;
    let duplicateMatches = [];
    let selectedMatchId = null;

    const tableBody = document.getElementById('clientsTableBody');
    const searchInput = document.getElementById('searchInput');
    const ratingFilter = document.getElementById('ratingFilter');
    const modal = document.getElementById('clientModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const addClientBtn = document.getElementById('addClientBtn');
    const addModal = document.getElementById('addClientModal');
    const addModalCloseBtn = document.getElementById('addModalCloseBtn');
    const addModalCancelBtn = document.getElementById('addModalCancelBtn');
    const addForm = document.getElementById('addClientForm');
    const addClientType = document.getElementById('addClientType');
    const addAgencyGroup = document.getElementById('addAgencyGroup');
    const addAgencySelect = document.getElementById('addAgency');
    const editClientType = document.getElementById('editClientType');
    const editAgencyGroup = document.getElementById('editAgencyGroup');
    const editAgencySelect = document.getElementById('editAgency');
    const phoneInput = document.getElementById('addPhone');
    const editPhoneInput = document.getElementById('editPhone');
    const editClientBtn = document.getElementById('editClientBtn');
    const deleteClientBtn = document.getElementById('deleteClientBtn');
    const editCancelBtn = document.getElementById('editCancelBtn');
    const editForm = document.getElementById('editClientForm');
    const viewMode = document.getElementById('viewMode');
    const editMode = document.getElementById('editMode');

    const duplicateModal = document.getElementById('duplicateModal');
    const duplicateModalCloseBtn = document.getElementById('duplicateModalCloseBtn');
    const duplicateCancelBtn = document.getElementById('dupCancelBtn');
    const duplicateCreateBtn = document.getElementById('dupCreateBtn');
    const duplicateDeleteOldBtn = document.getElementById('dupDeleteOldBtn');
    const duplicateMatchesList = document.getElementById('duplicateMatchesList');
    const duplicateClientType = document.getElementById('dupClientType');
    const duplicateAgencyGroup = document.getElementById('dupAgencyGroup');
    const duplicateAgencySelect = document.getElementById('dupAgency');
    const duplicatePhoneInput = document.getElementById('dupPhone');
    const duplicateForm = document.getElementById('duplicateClientForm');
    const duplicateMatchedClientId = document.getElementById('dupMatchedClientId');

    const cityFilter = document.getElementById('cityFilter');

    function createCitySelector(containerId, hiddenInputId) {
        const container = document.getElementById(containerId);
        const hiddenInput = document.getElementById(hiddenInputId);

        if (!container || !hiddenInput) return null;

        let selectedCities = [];
        let suggestions = [];
        let suggestionIndex = -1;
        let searchTimer = null;
        let requestCounter = 0;

        const wrapper = document.createElement('div');
        wrapper.className = 'city-selector__field';

        const chipsBox = document.createElement('div');
        chipsBox.className = 'city-selector__chips';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'city-selector__input';
        input.placeholder = 'Начните вводить город';
        input.autocomplete = 'off';

        const dropdown = document.createElement('div');
        dropdown.className = 'city-selector__dropdown';

        chipsBox.appendChild(input);
        wrapper.appendChild(chipsBox);
        wrapper.appendChild(dropdown);
        container.appendChild(wrapper);

        function syncHidden() {
            hiddenInput.value = selectedCities.join(',');
        }

        function renderChips() {
            chipsBox.querySelectorAll('.city-chip').forEach(chip => chip.remove());

            selectedCities.forEach(name => {
                const chip = document.createElement('span');
                chip.className = 'city-chip';

                const label = document.createElement('span');
                label.textContent = name;

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'city-chip__remove';
                removeBtn.setAttribute('aria-label', 'Удалить город');
                removeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

                removeBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    removeCity(name);
                });

                chip.appendChild(label);
                chip.appendChild(removeBtn);
                chipsBox.insertBefore(chip, input);
            });

            syncHidden();
        }

        function addCity(name) {
            const clean = (name || '').trim();
            if (!clean) return;

            const exists = selectedCities.some(city => city.toLowerCase() === clean.toLowerCase());
            if (exists) {
                input.value = '';
                closeDropdown();
                return;
            }

            selectedCities.push(clean);
            input.value = '';
            renderChips();
            closeDropdown();
            input.focus();
        }

        function removeCity(name) {
            selectedCities = selectedCities.filter(city => city !== name);
            renderChips();
        }

        function closeDropdown() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            suggestions = [];
            suggestionIndex = -1;
        }

        function renderSuggestions(query) {
            dropdown.innerHTML = '';

            const existing = new Set(selectedCities.map(city => city.toLowerCase()));
            suggestions = suggestions.filter(city => !existing.has(city.name.toLowerCase()));

            suggestions.forEach((city, index) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'city-selector__option' + (index === suggestionIndex ? ' active' : '');

                const optionName = document.createElement('span');
                optionName.className = 'city-selector__option-name';
                optionName.textContent = city.name;
                option.appendChild(optionName);

                if (city.subject) {
                    const optionSubject = document.createElement('span');
                    optionSubject.className = 'city-selector__option-subject';
                    optionSubject.textContent = city.subject;
                    option.appendChild(optionSubject);
                }

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    addCity(city.name);
                });

                dropdown.appendChild(option);
            });

            if (query && !selectedCities.some(city => city.toLowerCase() === query.toLowerCase())) {
                const create = document.createElement('button');
                create.type = 'button';
                create.className = 'city-selector__option city-selector__option--create' + (suggestionIndex === suggestions.length ? ' active' : '');
                create.textContent = 'Добавить город "' + query + '"';

                create.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    addCity(query);
                });

                dropdown.appendChild(create);
            }

            dropdown.classList.toggle('open', dropdown.children.length > 0);
        }

        function loadSuggestions(query) {
            const currentRequest = ++requestCounter;

            fetch('/clients/cities/?search=' + encodeURIComponent(query))
                .then(response => response.json())
                .then(data => {
                    if (currentRequest !== requestCounter) return;
                    suggestions = data.cities || [];
                    suggestionIndex = -1;
                    renderSuggestions(query);
                })
                .catch(error => console.error(error));
        }

        input.addEventListener('input', function() {
            const query = this.value.trim();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => loadSuggestions(query), 180);
        });

        input.addEventListener('focus', function() {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => loadSuggestions(this.value.trim()), 60);
        });

        input.addEventListener('keydown', function(e) {
            const options = dropdown.querySelectorAll('.city-selector__option');

            if (e.key === 'Backspace' && !this.value && selectedCities.length) {
                removeCity(selectedCities[selectedCities.length - 1]);
                return;
            }

            if (!options.length) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addCity(this.value.trim());
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                suggestionIndex = (suggestionIndex + 1) % options.length;
                options.forEach((option, index) => option.classList.toggle('active', index === suggestionIndex));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                suggestionIndex = suggestionIndex <= 0 ? options.length - 1 : suggestionIndex - 1;
                options.forEach((option, index) => option.classList.toggle('active', index === suggestionIndex));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const active = suggestionIndex >= 0 ? options[suggestionIndex] : options[0];
                if (active) {
                    active.dispatchEvent(new MouseEvent('mousedown'));
                } else {
                    addCity(this.value.trim());
                }
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                closeDropdown();
            }
        });

        document.addEventListener('click', function(e) {
            if (!container.contains(e.target)) closeDropdown();
        });

        return {
            setValues: function(names) {
                selectedCities = (names || []).map(name => String(name).trim()).filter(Boolean);
                renderChips();
            },
            getValues: function() {
                return selectedCities.slice();
            },
            clear: function() {
                selectedCities = [];
                input.value = '';
                renderChips();
                closeDropdown();
            }
        };
    }

    const addCitySelector = createCitySelector('addCitySelector', 'addCityNames');
    const editCitySelector = createCitySelector('editCitySelector', 'editCityNames');
    const dupCitySelector = createCitySelector('dupCitySelector', 'dupCityNames');

    let currentAgencyField = null;

    function createAgencyCombobox(inputId, hiddenId, options) {
        const input = document.getElementById(inputId);
        const hidden = document.getElementById(hiddenId);

        if (!input || !hidden) return null;

        const wrapper = document.createElement('div');
        wrapper.className = 'agency-combobox';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const dropdown = document.createElement('div');
        dropdown.className = 'city-selector__dropdown';
        wrapper.appendChild(dropdown);

        let items = [];
        let index = -1;
        let timer = null;
        let counter = 0;

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            items = [];
            index = -1;
        }

        function render(query) {
            dropdown.innerHTML = '';

            items.forEach((agency, position) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'city-selector__option' + (position === index ? ' active' : '');
                option.textContent = agency.name;

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    pick(agency.name);
                });

                dropdown.appendChild(option);
            });

            if (query && !items.some(agency => agency.name.toLowerCase() === query.toLowerCase())) {
                const create = document.createElement('button');
                create.type = 'button';
                create.className = 'city-selector__option city-selector__option--create' + (index === items.length ? ' active' : '');
                create.textContent = 'Создать агентство "' + query + '"';

                create.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    createAgency(query);
                });

                dropdown.appendChild(create);
            }

            dropdown.classList.toggle('open', dropdown.children.length > 0);
        }

        function load(query) {
            const currentRequest = ++counter;

            fetch('/agencies/catalog/?search=' + encodeURIComponent(query))
                .then(response => response.json())
                .then(data => {
                    if (currentRequest !== counter) return;
                    items = data.agencies || [];
                    index = -1;
                    render(query);
                })
                .catch(error => console.error(error));
        }

        function pick(name) {
            const existing = items.find(agency => agency.name === name);

            if (existing) {
                hidden.value = existing.id;
            } else {
                const match = options.querySelector('option[data-name="' + name.replace(/"/g, '\\"') + '"]');
                if (match) hidden.value = match.value;
            }

            input.value = name;
            close();
            input.focus();
        }

        function createAgency(name) {
            close();

            fetch('/agencies/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams({ name: name })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                if (data.success) {
                    addAgencyToSelect(options, data.agency.id, data.agency.name);
                    addAgencyToSelect(addAgencySelect, data.agency.id, data.agency.name);
                    addAgencyToSelect(editAgencySelect, data.agency.id, data.agency.name);
                    addAgencyToSelect(duplicateAgencySelect, data.agency.id, data.agency.name);
                    hidden.value = data.agency.id;
                    input.value = data.agency.name;
                    showToast('Агентство "' + data.agency.name + '" создано');
                }
            })
            .catch(error => {
                showToast('Ошибка при создании агентства');
                console.error(error);
            });
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
            const optionButtons = dropdown.querySelectorAll('.city-selector__option');

            if (!optionButtons.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                index = (index + 1) % optionButtons.length;
                optionButtons.forEach((option, position) => option.classList.toggle('active', position === index));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                index = index <= 0 ? optionButtons.length - 1 : index - 1;
                optionButtons.forEach((option, position) => option.classList.toggle('active', position === index));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const active = index >= 0 ? optionButtons[index] : optionButtons[0];
                if (active) active.dispatchEvent(new MouseEvent('mousedown'));
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                close();
            }
        });

        document.addEventListener('click', function(e) {
            if (!wrapper.contains(e.target)) close();
        });

        return {
            setAgency: function(id, name) {
                hidden.value = id ? String(id) : '';
                input.value = name || '';
                close();
            },
            getValue: function() {
                return hidden.value;
            },
            getText: function() {
                return input.value.trim();
            },
            isDirty: function() {
                return !!input.value.trim();
            },
            clear: function() {
                hidden.value = '';
                input.value = '';
                close();
            }
        };
    }

    const addAgencyField = createAgencyCombobox('addAgencySearch', 'addAgency', addAgencySelect);
    const editAgencyField = createAgencyCombobox('editAgencySearch', 'editAgency', editAgencySelect);
    const dupAgencyField = createAgencyCombobox('dupAgencySearch', 'dupAgency', duplicateAgencySelect);

    function toggleAgencyField(clientType, agencyGroup, isAdd) {
        const field = isAdd ? addAgencyField : editAgencyField;

        if (clientType === 'agency') {
            agencyGroup.style.display = 'block';
        } else {
            agencyGroup.style.display = 'none';
            if (field) field.clear();
        }
    }

    if (addClientType) {
        addClientType.addEventListener('change', function() {
            toggleAgencyField(this.value, addAgencyGroup, true);
        });
    }

    if (editClientType) {
        editClientType.addEventListener('change', function() {
            toggleAgencyField(this.value, editAgencyGroup, false);
        });
    }

    function toggleDuplicateAgencyField(clientType) {
        if (clientType === 'agency') {
            duplicateAgencyGroup.style.display = 'block';
        } else {
            duplicateAgencyGroup.style.display = 'none';
            if (dupAgencyField) dupAgencyField.clear();
        }
    }

    if (duplicateClientType) {
        duplicateClientType.addEventListener('change', function() {
            toggleDuplicateAgencyField(this.value);
        });
    }

    function addAgencyToSelect(select, agencyId, agencyName) {
        if (!select) return;

        const exists = Array.from(select.options).some(option => option.value === String(agencyId));

        if (exists) {
            const option = Array.from(select.options).find(item => item.value === String(agencyId));
            option.selected = true;
            return;
        }

        const option = document.createElement('option');
        option.value = agencyId;
        option.textContent = agencyName;
        option.setAttribute('data-name', agencyName);
        option.selected = true;
        select.appendChild(option);
    }

    function phoneMask(input) {
        let value = input.value.replace(/\D/g, '');

        if (value.length > 0 && value[0] !== '7' && value[0] !== '8') {
            value = '7' + value;
        }

        if (value.length > 0 && value[0] === '8') {
            value = '7' + value.slice(1);
        }

        let formatted = '';
        if (value.length > 0) {
            formatted = '+7';
            let remaining = value.slice(1);

            if (remaining.length > 0) {
                formatted += ' (' + remaining.slice(0, 3);
                if (remaining.length > 3) {
                    formatted += ') ' + remaining.slice(3, 6);
                    if (remaining.length > 6) {
                        formatted += '-' + remaining.slice(6, 8);
                        if (remaining.length > 8) {
                            formatted += '-' + remaining.slice(8, 10);
                        }
                    }
                }
            }
        }

        input.value = formatted;
        return input.value;
    }

    if (phoneInput) {
        phoneInput.addEventListener('input', function() { phoneMask(this); });
        phoneInput.addEventListener('focus', function() {
            if (this.value === '') this.value = '+7';
        });
        phoneInput.addEventListener('blur', function() {
            if (this.value === '+7') this.value = '';
        });
    }

    if (editPhoneInput) {
        editPhoneInput.addEventListener('input', function() { phoneMask(this); });
        editPhoneInput.addEventListener('focus', function() {
            if (this.value === '') this.value = '+7';
        });
        editPhoneInput.addEventListener('blur', function() {
            if (this.value === '+7') this.value = '';
        });
    }

    if (duplicatePhoneInput) {
        duplicatePhoneInput.addEventListener('input', function() { phoneMask(this); });
        duplicatePhoneInput.addEventListener('focus', function() {
            if (this.value === '') this.value = '+7';
        });
        duplicatePhoneInput.addEventListener('blur', function() {
            if (this.value === '+7') this.value = '';
        });
    }

    function validatePhone(phone) {
        const digits = phone.replace(/\D/g, '');
        return digits.length === 11 && (digits[0] === '7' || digits[0] === '8');
    }

    function openClientModal(clientId) {
        currentClientId = clientId;
        viewMode.style.display = 'block';
        editMode.style.display = 'none';

        fetch(`/clients/${clientId}/`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                document.getElementById('modalClientName').textContent = data.full_name;
                document.getElementById('viewFullName').textContent = data.full_name;
                document.getElementById('viewPhone').textContent = data.phone;
                document.getElementById('viewClientType').textContent = data.client_type_display || '—';
                document.getElementById('viewAgency').textContent = data.agency || '—';
                document.getElementById('viewRating').textContent = data.rating_display;
                document.getElementById('viewEmail').textContent = data.email || '—';
                document.getElementById('viewTelegram').textContent = data.telegram || '—';
                document.getElementById('viewCity').textContent = data.city || '—';
                document.getElementById('viewComment').textContent = data.comment || '—';

                const ordersContainer = document.getElementById('viewOrdersList');
                if (data.orders && data.orders.length > 0) {
                    ordersContainer.innerHTML = data.orders.map(order => `
                        <div class="order-item">
                            <div class="order-info">
                                <span class="order-name">${escapeHtml(order.address)}</span>
                                <span class="order-meta">${order.date} · ${order.status}</span>
                            </div>
                            <a href="#" class="order-link" data-order-id="${order.id}">Перейти к заказу →</a>
                        </div>
                    `).join('');

                    ordersContainer.querySelectorAll('.order-link').forEach(link => {
                        link.addEventListener('click', function(e) {
                            e.preventDefault();
                            const orderId = this.getAttribute('data-order-id');
                            window.location.href = `/orders/`;
                        });
                    });
                } else {
                    ordersContainer.innerHTML = '<p class="orders-empty">Нет заказов</p>';
                }

                document.getElementById('editFullName').value = data.full_name;
                document.getElementById('editPhone').value = data.phone;
                document.getElementById('editClientType').value = data.client_type_key || 'organizer';
                document.getElementById('editTelegram').value = data.telegram === '—' ? '' : data.telegram;
                document.getElementById('editEmail').value = data.email === '—' ? '' : data.email;
                document.getElementById('editRating').value = data.rating_key || 'medium';
                document.getElementById('editComment').value = data.comment || '';

                if (editAgencyField) {
                    editAgencyField.setAgency(data.agency_id || '', data.agency === '—' ? '' : (data.agency || ''));
                }

                if (editCitySelector) {
                    const names = Array.isArray(data.cities) && data.cities.length
                        ? data.cities
                        : (data.city && data.city !== '—' ? data.city.split(',').map(item => item.trim()) : []);
                    editCitySelector.setValues(names);
                }

                toggleAgencyField(data.client_type_key || 'organizer', editAgencyGroup, false);

                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            })
            .catch(error => {
                showToast('Ошибка загрузки данных клиента');
                console.error(error);
            });
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentClientId = null;
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        if (editCitySelector) editCitySelector.clear();
        if (editAgencyField) editAgencyField.clear();
    }

    function openEditMode() {
        viewMode.style.display = 'none';
        editMode.style.display = 'block';
    }

    function cancelEdit() {
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
    }

    function openAddModal() {
        addModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        addForm.reset();
        document.getElementById('addRating').value = 'medium';
        document.getElementById('addClientType').value = 'organizer';
        document.getElementById('addPhone').value = '';
        document.getElementById('addComment').value = '';
        addAgencyGroup.style.display = 'none';
        if (addAgencyField) addAgencyField.clear();
        if (addCitySelector) addCitySelector.clear();
        setTimeout(() => document.getElementById('addFullName').focus(), 100);
    }

    function closeAddModal() {
        addModal.classList.remove('active');
        document.body.style.overflow = '';
        if (addCitySelector) addCitySelector.clear();
        if (addAgencyField) addAgencyField.clear();
    }

    function collectDuplicatePayload() {
        return {
            full_name: document.getElementById('dupFullName').value.trim(),
            phone: duplicatePhoneInput.value.trim(),
            client_type: duplicateClientType.value,
            agency_id: dupAgencyField ? dupAgencyField.getValue() : '',
            telegram: document.getElementById('dupTelegram').value.trim(),
            email: document.getElementById('dupEmail').value.trim(),
            city_names: dupCitySelector ? dupCitySelector.getValues().join(',') : '',
            comment: document.getElementById('dupComment').value.trim(),
            rating: document.getElementById('dupRating').value
        };
    }

    function validateDuplicatePayload(payload, focusPrefix) {
        if (!payload.full_name) {
            showToast('Пожалуйста, заполните поле ФИО');
            document.getElementById(focusPrefix + 'FullName').focus();
            return false;
        }
        if (payload.phone && payload.phone !== '+7' && !validatePhone(payload.phone)) {
            showToast('Пожалуйста, введите корректный номер телефона (11 цифр)');
            document.getElementById(focusPrefix + 'Phone').focus();
            return false;
        }
        if (payload.client_type === 'agency' && !payload.agency_id) {
            showToast('Пожалуйста, выберите агентство');
            const agencyInput = document.getElementById(focusPrefix + 'AgencySearch');

            if (agencyInput) {
                agencyInput.focus();
            } else {
                document.getElementById(focusPrefix + 'Agency').focus();
            }

            return false;
        }
        return true;
    }

    window.selectDuplicateMatch = function(matchId) {
        const match = duplicateMatches.find(item => item.id === matchId);
        if (!match) return;

        selectedMatchId = match.id;
        duplicateMatchedClientId.value = match.id;

        duplicateMatchesList.querySelectorAll('.duplicate-match').forEach(button => {
            button.classList.toggle('active', parseInt(button.getAttribute('data-match-id'), 10) === match.id);
        });

        updateDeleteButtonLabel();
    };

    function selectDuplicateMatch(matchId) {
        window.selectDuplicateMatch(matchId);
    }

    function renderDuplicateMatches() {
        duplicateMatchesList.innerHTML = '';

        if (!duplicateMatches.length) {
            return;
        }

        duplicateMatches.forEach(function(match, index) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'duplicate-match' + (index === 0 ? ' active' : '');
            button.setAttribute('data-match-id', String(match.id));

            const name = document.createElement('span');
            name.className = 'duplicate-match__name';
            name.textContent = match.full_name || 'Без имени';
            button.appendChild(name);

            const meta = document.createElement('span');
            meta.className = 'duplicate-match__meta';
            meta.textContent = (match.phone || 'Телефон не указан') + (match.agency ? ' · ' + match.agency : '');
            button.appendChild(meta);

            const info = document.createElement('span');
            info.className = 'duplicate-match__meta';
            info.textContent = 'Заказов: ' + (match.orders_count || 0) + (match.created_at ? ' · Добавлен ' + match.created_at : '');
            button.appendChild(info);

            const reasons = Array.isArray(match.reasons) ? match.reasons : [];

            if (reasons.length) {
                const reasonsBox = document.createElement('span');
                reasonsBox.className = 'duplicate-match__reasons';

                reasons.forEach(function(reason) {
                    const chip = document.createElement('span');
                    chip.className = 'duplicate-reason';
                    chip.textContent = reason;
                    reasonsBox.appendChild(chip);
                });

                button.appendChild(reasonsBox);
            }

            button.addEventListener('click', function() {
                window.selectDuplicateMatch(match.id);
            });

            duplicateMatchesList.appendChild(button);
        });
    }

    function fillDuplicateForm(source) {
        document.getElementById('dupFullName').value = source.full_name || '';
        duplicatePhoneInput.value = source.phone || '';
        duplicateClientType.value = source.client_type_key || 'organizer';
        if (dupAgencyField) {
            dupAgencyField.setAgency(source.agency_id || '', source.agency || '');
        }
        document.getElementById('dupTelegram').value = source.telegram || '';
        document.getElementById('dupEmail').value = source.email || '';
        document.getElementById('dupComment').value = source.comment || '';
        document.getElementById('dupRating').value = source.rating_key || 'medium';

        if (dupCitySelector) {
            dupCitySelector.setValues(Array.isArray(source.cities) ? source.cities : []);
        }

        toggleDuplicateAgencyField(duplicateClientType.value);
    }

    function updateDeleteButtonLabel() {
        const match = duplicateMatches.find(item => item.id === selectedMatchId);
        duplicateDeleteOldBtn.textContent = 'Удалить выбранного';
        duplicateDeleteOldBtn.disabled = !match;
    }

    function setDuplicateColumnEnabled(enabled) {
        duplicateForm.querySelectorAll('input, select, textarea').forEach(field => {
            field.disabled = !enabled;
        });
    }

    function openDuplicateModal(matches) {
        duplicateMatches = Array.isArray(matches) ? matches : [];
        duplicateMatchesList.innerHTML = '';
        duplicateModal.classList.add('active');
        addModal.classList.remove('active');
        document.body.style.overflow = 'hidden';
        setDuplicateColumnEnabled(true);

        try {
            applyAddFormPayloadToDuplicate(readAddFormPayload());
        } catch (error) {
            console.error(error);
        }

        try {
            if (duplicateMatches.length) {
                renderDuplicateMatches();
                selectDuplicateMatch(duplicateMatches[0].id);
            } else {
                duplicateMatchedClientId.value = '';
                selectedMatchId = null;
                updateDeleteButtonLabel();
            }
        } catch (error) {
            console.error(error);
            duplicateMatchesList.innerHTML = '<p class="orders-empty">Не удалось отобразить совпадения</p>';
        }

        window.scrollTo(0, 0);
    }

    function closeDuplicateModal(restoreAdd) {
        duplicateModal.classList.remove('active');
        duplicateMatches = [];
        selectedMatchId = null;
        duplicateMatchesList.innerHTML = '';
        duplicateMatchedClientId.value = '';
        duplicateDeleteOldBtn.disabled = false;

        if (restoreAdd) {
            addModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    function readAddFormPayload() {
        return {
            full_name: document.getElementById('addFullName').value.trim(),
            phone: document.getElementById('addPhone').value.trim(),
            client_type_key: document.getElementById('addClientType').value,
            agency_id: addAgencyField ? addAgencyField.getValue() : null,
            agency: addAgencyField ? addAgencyField.getText() : '',
            telegram: document.getElementById('addTelegram').value.trim(),
            email: document.getElementById('addEmail').value.trim(),
            cities: addCitySelector ? addCitySelector.getValues() : [],
            comment: document.getElementById('addComment').value.trim(),
            rating_key: document.getElementById('addRating').value
        };
    }

    function applyAddFormPayloadToDuplicate(formData) {
        const fill = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.value = value;
        };

        fill('dupFullName', formData.full_name || '');
        fill('dupPhone', formData.phone || '');
        fill('dupTelegram', formData.telegram || '');
        fill('dupEmail', formData.email || '');
        fill('dupComment', formData.comment || '');
        fill('dupRating', formData.rating_key || 'medium');

        if (dupCitySelector) {
            dupCitySelector.setValues(Array.isArray(formData.cities) ? formData.cities : []);
        }

        if (duplicateClientType) {
            duplicateClientType.value = formData.client_type_key || 'organizer';
        }

        if (dupAgencyField) {
            dupAgencyField.setAgency(formData.agency_id || '', formData.agency || '');
        }

        if (duplicateClientType) {
            duplicateAgencyGroup.style.display = duplicateClientType.value === 'agency' ? 'block' : 'none';
        }
    }

    function recheckClientDuplicates(matches) {
        if (!matches || !matches.length) return false;

        const existingIds = new Set(duplicateMatches.map(item => item.id));
        const changed = matches.some(item => !existingIds.has(item.id));
        const reasonsMissing = matches.some(item => !Array.isArray(item.reasons) || !item.reasons.length);

        if (!changed && !reasonsMissing) return false;

        duplicateMatches = matches;
        renderDuplicateMatches();

        if (selectedMatchId && matches.some(item => item.id === selectedMatchId)) {
            selectDuplicateMatch(selectedMatchId);
        } else {
            selectedMatchId = null;
            duplicateMatchedClientId.value = '';
            updateDeleteButtonLabel();
        }

        return true;
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
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 2000);
    }

    function getCSRFToken() {
        const cookieValue = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
        return cookieValue ? cookieValue[2] : '';
    }

    modalCloseBtn.addEventListener('click', requestCloseClientModal);
    modal.addEventListener('click', function(e) {
        if (e.target === this) requestCloseClientModal();
    });

    editClientBtn.addEventListener('click', openEditMode);
    editCancelBtn.addEventListener('click', cancelEdit);

    deleteClientBtn.addEventListener('click', function() {
        if (!currentClientId) return;

        window.UI.confirm({
            title: 'Удалить клиента?',
            text: 'Если у клиента есть заказы, он будет деактивирован: исчезнет из списка, но заказы сохранятся.',
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true
        }).then(confirmed => {
            if (!confirmed) return;

        fetch(`/clients/${currentClientId}/delete/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCSRFToken() }
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showToast(data.error);
                return;
            }
            if (data.success) {
                showToast(data.deactivated ? 'Клиент деактивирован, заказы сохранены' : 'Клиент успешно удалён');
                closeModal();
                setTimeout(() => location.reload(), 500);
            }
        })
        .catch(error => {
            showToast('Ошибка при удалении клиента');
            console.error(error);
        });
        });
    });

    editForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const clientType = document.getElementById('editClientType').value;
        const agencyId = editAgencyField ? editAgencyField.getValue() : '';
        const fullName = document.getElementById('editFullName').value.trim();
        const phone = document.getElementById('editPhone').value.trim();
        const telegram = document.getElementById('editTelegram').value.trim();
        const email = document.getElementById('editEmail').value.trim();
        const cityNames = editCitySelector ? editCitySelector.getValues().join(',') : '';
        const comment = document.getElementById('editComment').value.trim();
        const rating = document.getElementById('editRating').value;

        if (!fullName) {
            showToast('Пожалуйста, заполните поле ФИО');
            document.getElementById('editFullName').focus();
            return;
        }

        if (phone && phone !== '+7' && !validatePhone(phone)) {
            showToast('Пожалуйста, введите корректный номер телефона (11 цифр)');
            document.getElementById('editPhone').focus();
            return;
        }

        if (clientType === 'agency' && !agencyId) {
            showToast('Пожалуйста, выберите агентство');
            document.getElementById('editAgencySearch').focus();
            return;
        }

        const data = {
            full_name: fullName,
            phone: phone,
            client_type: clientType,
            agency_id: agencyId,
            telegram: telegram,
            email: email,
            city_names: cityNames,
            comment: comment,
            rating: rating
        };

        fetch(`/clients/${currentClientId}/update/`, {
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
                showToast('Данные клиента успешно обновлены');
                cancelEdit();
                setTimeout(() => location.reload(), 500);
            }
        })
        .catch(error => {
            showToast('Ошибка при обновлении клиента');
            console.error(error);
        });
    });

    addClientBtn.addEventListener('click', openAddModal);
    addModalCloseBtn.addEventListener('click', requestCloseAddModal);
    addModalCancelBtn.addEventListener('click', requestCloseAddModal);
    addModal.addEventListener('click', function(e) {
        if (e.target === this) requestCloseAddModal();
    });

    addForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const data = {
            full_name: document.getElementById('addFullName').value.trim(),
            phone: document.getElementById('addPhone').value.trim(),
            client_type: document.getElementById('addClientType').value,
            agency_id: addAgencyField ? addAgencyField.getValue() : '',
            telegram: document.getElementById('addTelegram').value.trim(),
            email: document.getElementById('addEmail').value.trim(),
            city_names: addCitySelector ? addCitySelector.getValues().join(',') : '',
            comment: document.getElementById('addComment').value.trim(),
            rating: document.getElementById('addRating').value
        };

        if (!validateDuplicatePayload(data, 'add')) return;

        fetch('/clients/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: new URLSearchParams(data)
        })
        .then(response => response.json().then(body => ({ status: response.status, body: body })))
        .then(result => {
            const body = result.body;

            if (result.status === 409 && Array.isArray(body.matches)) {
                openDuplicateModal(body.matches);
                return;
            }

            if (body.error) {
                showToast(body.error);
                return;
            }
            if (body.success) {
                showToast(`Клиент "${body.client.full_name}" успешно добавлен`);
                closeAddModal();
                setTimeout(() => location.reload(), 500);
            }
        })
        .catch(error => {
            showToast('Ошибка при добавлении клиента');
            console.error(error);
        });
    });

    duplicateForm.addEventListener('submit', function(e) {
        e.preventDefault();
    });

    duplicateCancelBtn.addEventListener('click', requestCloseDuplicateModal);

    duplicateModalCloseBtn.addEventListener('click', requestCloseDuplicateModal);

    duplicateModal.addEventListener('click', function(e) {
        if (e.target === this) requestCloseDuplicateModal();
    });

    duplicateCreateBtn.addEventListener('click', function() {
        const payload = collectDuplicatePayload();
        if (!validateDuplicatePayload(payload, 'dup')) return;

        payload.force_create = '1';

        fetch('/clients/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: new URLSearchParams(payload)
        })
        .then(response => response.json().then(body => ({ status: response.status, body: body })))
        .then(result => {
            const body = result.body;

            if (body.error) {
                showToast(body.error);
                return;
            }
            if (body.success) {
                showToast(`Клиент "${body.client.full_name}" успешно добавлен`);
                closeDuplicateModal(false);
                closeAddModal();
                setTimeout(() => location.reload(), 500);
            }
        })
        .catch(error => {
            showToast('Ошибка при добавлении клиента');
            console.error(error);
        });
    });

    duplicateDeleteOldBtn.addEventListener('click', function() {
        if (!selectedMatchId) {
            showToast('Сначала выберите клиента в списке совпадений');
            return;
        }

        const match = duplicateMatches.find(item => item.id === selectedMatchId);
        if (!match) return;

        const confirmText = match.orders_count
            ? `Клиент "${match.full_name}" будет удалён вместе с заказами (${match.orders_count}). Новый клиент создан не будет.`
            : `Клиент "${match.full_name}" будет удалён. Новый клиент создан не будет.`;

        window.UI.confirm({
            title: 'Удалить выбранного клиента?',
            text: confirmText,
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true
        }).then(confirmed => {
            if (!confirmed) return;

        fetch('/clients/replace/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: new URLSearchParams({ client_id: selectedMatchId })
        })
        .then(response => response.json().then(body => ({ status: response.status, body: body })))
        .then(result => {
            const data = result.body;

            if (result.status === 409 && Array.isArray(data.matches)) {
                if (recheckClientDuplicates(data.matches)) {
                    showToast('Обнаружены совпадения в базе клиентов');
                }
                return;
            }

            if (data.error) {
                showToast(data.error);
                return;
            }

            if (data.success) {
                showToast(data.deactivated
                    ? 'Клиент деактивирован, заказы сохранены. Новый клиент не создан.'
                    : 'Клиент удалён. Новый клиент не создан.');

                duplicateMatches = duplicateMatches.filter(item => item.id !== data.deleted_id);
                selectedMatchId = null;
                duplicateMatchedClientId.value = '';

                if (duplicateMatches.length) {
                    renderDuplicateMatches();
                    selectDuplicateMatch(duplicateMatches[0].id);
                } else {
                    duplicateMatchesList.innerHTML = '';
                    updateDeleteButtonLabel();
                    closeDuplicateModal(false);
                    closeAddModal();
                    setTimeout(() => location.reload(), 500);
                }
            }
        })
        .catch(error => {
            showToast('Ошибка при удалении клиента');
            console.error(error);
        });
        });
    });

    tableBody.addEventListener('click', function(e) {
        const viewLink = e.target.closest('.view-link');
        if (viewLink) {
            e.stopPropagation();
            const id = parseInt(viewLink.getAttribute('data-id'));
            openClientModal(id);
            return;
        }

        const row = e.target.closest('tr[data-client-id]');
        if (row) {
            const id = parseInt(row.getAttribute('data-client-id'));
            openClientModal(id);
        }
    });

    const CLIENTS_PAGE = 50;

    const clientsLoadMore = document.getElementById('clientsLoadMore');
    const clientsLoadMoreBtn = document.getElementById('clientsLoadMoreBtn');
    let clientsOffset = document.querySelectorAll('#clientsTableBody tr[data-client-id]').length;

    function loadClientsLive(reset) {
        const search = searchInput.value.trim();
        const rating = ratingFilter.value;
        const city = cityFilter ? cityFilter.value : 'all';
        const params = new URLSearchParams();

        if (reset !== false) {
            clientsOffset = 0;
        }

        if (search) params.append('search', search);
        if (rating && rating !== 'all') params.append('rating', rating);
        if (city && city !== 'all') params.append('city', city);
        params.append('offset', String(clientsOffset));
        params.append('limit', String(CLIENTS_PAGE));

        if (clientsLoadMoreBtn) clientsLoadMoreBtn.disabled = true;
        tableBody.style.opacity = '0.5';

        fetch(`/clients/list/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                tableBody.style.opacity = '';

                if (clientsLoadMoreBtn) clientsLoadMoreBtn.disabled = false;

                if (data.error) {
                    showToast(data.error);
                    return;
                }

                const rows = data.clients || [];

                if (clientsOffset === 0) {
                    if (!rows.length) {
                        tableBody.innerHTML = `
                            <tr>
                                <td colspan="8" class="load-more__empty">Клиенты не найдены</td>
                            </tr>
                        `;
                    } else {
                        tableBody.innerHTML = rows.map(clientRow).join('');
                    }
                } else if (rows.length) {
                    tableBody.insertAdjacentHTML('beforeend', rows.map(clientRow).join(''));
                }

                clientsOffset += rows.length;

                if (clientsLoadMore) {
                    clientsLoadMore.classList.toggle('load-more--done', !data.has_more);
                }

                const filterParams = new URLSearchParams();

                if (search) filterParams.append('search', search);
                if (rating && rating !== 'all') filterParams.append('rating', rating);
                if (city && city !== 'all') filterParams.append('city', city);

                const url = filterParams.toString() ? `/clients/?${filterParams.toString()}` : '/clients/';
                window.history.replaceState({}, '', url);
            })
            .catch(error => {
                tableBody.style.opacity = '';

                if (clientsLoadMoreBtn) clientsLoadMoreBtn.disabled = false;

                console.error(error);
            });
    }

    function clientRow(client) {
        return `
            <tr data-client-id="${client.id}">
                <td>${escapeHtml(client.full_name)}</td>
                <td>${escapeHtml(client.phone || '—')}</td>
                <td>${escapeHtml(client.agency || '—')}</td>
                <td class="clients-table__cities" title="${escapeHtml(client.city || '')}">${escapeHtml(client.city || '—')}</td>
                <td>
                    <span class="rating-badge rating-badge--${client.rating}">${escapeHtml(client.rating_display)}</span>
                </td>
                <td>${client.requests_count || 0}</td>
                <td>${client.orders_count || 0}</td>
                <td><button class="view-link" data-id="${client.id}">Подробнее</button></td>
            </tr>
        `;
    }

    if (clientsLoadMoreBtn) {
        clientsLoadMoreBtn.addEventListener('click', function() {
            loadClientsLive(false);
        });
    }

    if (clientsLoadMore) {
        clientsLoadMore.classList.toggle('load-more--done', clientsLoadMore.dataset.hasMore !== '1');
    }

    ratingFilter.addEventListener('change', function() {
        loadClientsLive();
    });

    if (cityFilter) {
        cityFilter.addEventListener('change', function() {
            loadClientsLive();
        });
    }

    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadClientsLive, 400);
    });

    function isFormDirty(form) {
        if (!form) return false;

        const fields = form.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]), textarea, select');

        for (const field of fields) {
            if (field.type === 'tel') {
                const digits = field.value.replace(/\D/g, '');
                if (digits.length > 1) return true;
                continue;
            }

            if (field.value && field.value.trim()) return true;
        }

        if (addCitySelector && addCitySelector.getValues().length) return true;
        if (editCitySelector && editCitySelector.getValues().length) return true;
        if (dupCitySelector && dupCitySelector.getValues().length) return true;

        return false;
    }

    function requestCloseAddModal() {
        if (!isFormDirty(addForm)) {
            closeAddModal();
            return;
        }

        window.UI.confirm({
            title: 'Завершить редактирование?',
            text: 'Вы действительно хотите завершить редактирование? Введённые данные не сохранятся.',
            okText: 'Завершить',
            cancelText: 'Остаться',
            danger: true
        }).then(confirmed => {
            if (confirmed) closeAddModal();
        });
    }

    function requestCloseClientModal() {
        if (editMode.style.display === 'none') {
            closeModal();
            return;
        }

        if (!isFormDirty(editForm)) {
            closeModal();
            return;
        }

        window.UI.confirm({
            title: 'Завершить редактирование?',
            text: 'Вы действительно хотите завершить редактирование? Изменения не сохранятся.',
            okText: 'Завершить',
            cancelText: 'Остаться',
            danger: true
        }).then(confirmed => {
            if (confirmed) closeModal();
        });
    }

    function requestCloseDuplicateModal() {
        if (!isFormDirty(duplicateForm)) {
            closeDuplicateModal(true);
            return;
        }

        window.UI.confirm({
            title: 'Завершить редактирование?',
            text: 'Вы действительно хотите завершить редактирование? Новый клиент не будет создан.',
            okText: 'Завершить',
            cancelText: 'Остаться',
            danger: true
        }).then(confirmed => {
            if (confirmed) closeDuplicateModal(true);
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (document.getElementById('uiConfirmModal')) return;

        if (duplicateModal && duplicateModal.classList.contains('active')) {
            e.preventDefault();
            requestCloseDuplicateModal();
        } else if (modal && modal.classList.contains('active')) {
            e.preventDefault();
            requestCloseClientModal();
        } else if (addModal && addModal.classList.contains('active')) {
            e.preventDefault();
            requestCloseAddModal();
        }
    }, true);

    function escapeHtml(text) {
        if (!text && text !== 0) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
})();