(function() {
    let currentClientId = null;
    let currentAgencySelect = null;
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
    const duplicateAddAgencyBtn = document.getElementById('dupAddAgencyBtn');
    const addAgencyModal = document.getElementById('addAgencyModal');
    const addAgencyModalCloseBtn = document.getElementById('addAgencyModalCloseBtn');
    const addAgencyCancelBtn = document.getElementById('addAgencyCancelBtn');
    const addAgencyForm = document.getElementById('addAgencyForm');
    const addAgencyName = document.getElementById('addAgencyName');

    const addAddAgencyBtn = document.getElementById('addAddAgencyBtn');
    const editAddAgencyBtn = document.getElementById('editAddAgencyBtn');

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
                option.textContent = city.name;

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

    function toggleAgencyField(clientType, agencyGroup, isAdd) {
        if (clientType === 'agency') {
            agencyGroup.style.display = 'block';
            if (isAdd) addAgencySelect.required = true;
            else editAgencySelect.required = true;
        } else {
            agencyGroup.style.display = 'none';
            if (isAdd) {
                addAgencySelect.required = false;
                addAgencySelect.value = '';
            } else {
                editAgencySelect.required = false;
                editAgencySelect.value = '';
            }
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
            duplicateAgencySelect.required = true;
        } else {
            duplicateAgencyGroup.style.display = 'none';
            duplicateAgencySelect.required = false;
        }
    }

    if (duplicateClientType) {
        duplicateClientType.addEventListener('change', function() {
            toggleDuplicateAgencyField(this.value);
        });
    }

    function openAddAgencyModal(selectElement) {
        currentAgencySelect = selectElement;
        addAgencyModal.classList.add('active');
        addAgencyForm.reset();
        setTimeout(() => addAgencyName.focus(), 100);
    }

    function closeAddAgencyModal() {
        addAgencyModal.classList.remove('active');
        currentAgencySelect = null;
    }

    function addAgencyToSelect(select, agencyId, agencyName) {
        const option = document.createElement('option');
        option.value = agencyId;
        option.textContent = agencyName;
        option.selected = true;
        select.appendChild(option);
    }

    if (addAddAgencyBtn) {
        addAddAgencyBtn.addEventListener('click', function() {
            openAddAgencyModal(addAgencySelect);
        });
    }

    if (editAddAgencyBtn) {
        editAddAgencyBtn.addEventListener('click', function() {
            openAddAgencyModal(editAgencySelect);
        });
    }

    if (addAgencyModalCloseBtn) {
        addAgencyModalCloseBtn.addEventListener('click', closeAddAgencyModal);
    }
    if (addAgencyCancelBtn) {
        addAgencyCancelBtn.addEventListener('click', closeAddAgencyModal);
    }
    if (addAgencyModal) {
        addAgencyModal.addEventListener('click', function(e) {
            if (e.target === this) closeAddAgencyModal();
        });
    }

    if (addAgencyForm) {
        addAgencyForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const name = addAgencyName.value.trim();
            if (!name) {
                showToast('Пожалуйста, введите название агентства');
                addAgencyName.focus();
                return;
            }

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
                    showToast(`Агентство "${data.agency.name}" успешно создано`);
                    if (currentAgencySelect) {
                        addAgencyToSelect(currentAgencySelect, data.agency.id, data.agency.name);
                    }
                    if (currentAgencySelect === addAgencySelect && editAgencySelect) {
                        addAgencyToSelect(editAgencySelect, data.agency.id, data.agency.name);
                    } else if (currentAgencySelect === editAgencySelect && addAgencySelect) {
                        addAgencyToSelect(addAgencySelect, data.agency.id, data.agency.name);
                    }
                    if (duplicateAgencySelect && currentAgencySelect !== duplicateAgencySelect) {
                        addAgencyToSelect(duplicateAgencySelect, data.agency.id, data.agency.name);
                    }
                    closeAddAgencyModal();
                }
            })
            .catch(error => {
                showToast('Ошибка при создании агентства');
                console.error(error);
            });
        });
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

    if (duplicateAddAgencyBtn) {
        duplicateAddAgencyBtn.addEventListener('click', function() {
            openAddAgencyModal(duplicateAgencySelect);
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
                document.getElementById('editAgency').value = data.agency_id || '';
                document.getElementById('editTelegram').value = data.telegram === '—' ? '' : data.telegram;
                document.getElementById('editEmail').value = data.email === '—' ? '' : data.email;
                document.getElementById('editRating').value = data.rating_key || 'medium';
                document.getElementById('editComment').value = data.comment || '';

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
        addAgencySelect.value = '';
        addAgencySelect.required = false;
        if (addCitySelector) addCitySelector.clear();
        setTimeout(() => document.getElementById('addFullName').focus(), 100);
    }

    function closeAddModal() {
        addModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function collectDuplicatePayload() {
        return {
            full_name: document.getElementById('dupFullName').value.trim(),
            phone: duplicatePhoneInput.value.trim(),
            client_type: duplicateClientType.value,
            agency_id: duplicateAgencySelect.value,
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
        if (!payload.phone || payload.phone === '+7') {
            showToast('Пожалуйста, введите номер телефона');
            document.getElementById(focusPrefix + 'Phone').focus();
            return false;
        }
        if (!validatePhone(payload.phone)) {
            showToast('Пожалуйста, введите корректный номер телефона (11 цифр)');
            document.getElementById(focusPrefix + 'Phone').focus();
            return false;
        }
        if (payload.client_type === 'agency' && !payload.agency_id) {
            showToast('Пожалуйста, выберите агентство');
            document.getElementById(focusPrefix + 'Agency').focus();
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
        duplicateAgencySelect.value = source.agency_id || '';
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
        duplicateDeleteOldBtn.textContent = match ? `Удалить выбранного (${match.orders_count})` : 'Удалить выбранного';
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
        const agencySelect = document.getElementById('addAgency');
        const useAgency = !!agencySelect.value;

        return {
            full_name: document.getElementById('addFullName').value.trim(),
            phone: document.getElementById('addPhone').value.trim(),
            client_type_key: document.getElementById('addClientType').value,
            agency_id: useAgency ? agencySelect.value : null,
            agency: useAgency ? agencySelect.options[agencySelect.selectedIndex].textContent : null,
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

        if (duplicateAgencySelect) {
            const agencyValue = formData.agency_id ? String(formData.agency_id) : '';
            const options = Array.from(duplicateAgencySelect.options);
            const hasOption = agencyValue && options.some(option => option.value === agencyValue);

            if (hasOption) {
                duplicateAgencySelect.value = agencyValue;
            } else if (formData.agency) {
                const created = options.find(option => option.textContent.trim() === formData.agency);
                duplicateAgencySelect.value = created ? created.value : '';
            } else {
                duplicateAgencySelect.value = '';
            }
        }

        if (duplicateClientType) {
            toggleDuplicateAgencyField(duplicateClientType.value);
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

    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });

    editClientBtn.addEventListener('click', openEditMode);
    editCancelBtn.addEventListener('click', cancelEdit);

    deleteClientBtn.addEventListener('click', function() {
        if (!currentClientId) return;

        if (!confirm('Вы уверены, что хотите удалить этого клиента?')) return;

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
                showToast('Клиент успешно удалён');
                closeModal();
                setTimeout(() => location.reload(), 500);
            }
        })
        .catch(error => {
            showToast('Ошибка при удалении клиента');
            console.error(error);
        });
    });

    editForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const clientType = document.getElementById('editClientType').value;
        const agencyId = document.getElementById('editAgency').value;
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

        if (!phone || phone === '+7') {
            showToast('Пожалуйста, введите номер телефона');
            document.getElementById('editPhone').focus();
            return;
        }

        if (!validatePhone(phone)) {
            showToast('Пожалуйста, введите корректный номер телефона (11 цифр)');
            document.getElementById('editPhone').focus();
            return;
        }

        if (clientType === 'agency' && !agencyId) {
            showToast('Пожалуйста, выберите агентство');
            document.getElementById('editAgency').focus();
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
    addModalCloseBtn.addEventListener('click', closeAddModal);
    addModalCancelBtn.addEventListener('click', closeAddModal);
    addModal.addEventListener('click', function(e) {
        if (e.target === this) closeAddModal();
    });

    addForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const data = {
            full_name: document.getElementById('addFullName').value.trim(),
            phone: document.getElementById('addPhone').value.trim(),
            client_type: document.getElementById('addClientType').value,
            agency_id: document.getElementById('addAgency').value,
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

    duplicateCancelBtn.addEventListener('click', function() {
        closeDuplicateModal(true);
    });

    duplicateModalCloseBtn.addEventListener('click', function() {
        closeDuplicateModal(true);
    });

    duplicateModal.addEventListener('click', function(e) {
        if (e.target === this) closeDuplicateModal(true);
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
            ? `Удалить клиента "${match.full_name}" вместе с его заказами (${match.orders_count})?`
            : `Удалить клиента "${match.full_name}"?`;

        if (!confirm(confirmText)) return;

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
                showToast(data.deleted_orders
                    ? `Клиент удалён, вместе с ним удалено заказов: ${data.deleted_orders}. Новый клиент не создан.`
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

    function filterClients() {
        const search = searchInput.value.trim();
        const rating = ratingFilter.value;
        const city = cityFilter ? cityFilter.value : 'all';
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (rating && rating !== 'all') params.append('rating', rating);
        if (city && city !== 'all') params.append('city', city);
        window.location.href = `/clients/?${params.toString()}`;
    }

    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filterClients, 500);
    });

    ratingFilter.addEventListener('change', filterClients);

    if (cityFilter) {
        cityFilter.addEventListener('change', filterClients);
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (addAgencyModal && addAgencyModal.classList.contains('active')) {
                closeAddAgencyModal();
            } else if (duplicateModal && duplicateModal.classList.contains('active')) {
                closeDuplicateModal(true);
            } else if (modal && modal.classList.contains('active')) {
                closeModal();
            } else if (addModal && addModal.classList.contains('active')) {
                closeAddModal();
            }
        }
    });

    function escapeHtml(text) {
        if (!text && text !== 0) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
})();