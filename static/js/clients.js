(function() {
    let currentClientId = null;
    let duplicateMatches = [];
    let selectedMatchId = null;

    const orderColors = (function() {
        const node = document.getElementById('calendarColorsData');
        const result = {};

        if (!node) return result;

        try {
            const raw = JSON.parse(node.textContent || '{}');
            Object.keys(raw).forEach(function(key) {
                if (key.indexOf('order:') === 0) {
                    result[key.slice(6)] = raw[key];
                }
            });
        } catch (e) {
            return result;
        }

        return result;
    })();

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
    const phoneInput = document.getElementById('addPhone');
    const deleteClientBtn = document.getElementById('deleteClientBtn');

    const duplicateModal = document.getElementById('duplicateModal');
    const duplicateModalCloseBtn = document.getElementById('duplicateModalCloseBtn');
    const duplicateBackBtn = document.getElementById('dupBackBtn');
    const duplicateCreateBtn = document.getElementById('dupCreateBtn');
    const duplicateMatchesList = document.getElementById('duplicateMatchesList');
    const duplicateCard = document.getElementById('duplicateCard');

    const cityFilter = document.getElementById('cityFilter');

    function createCitySelector(containerId, hiddenInputId) {
        let container = document.getElementById(containerId);
        const hiddenInput = document.getElementById(hiddenInputId);

        if (!container) return null;
        if (container.dataset.mounted === '1') return container.__api || null;

        const chipsBox = container;

        if (!hiddenInput) return null;

        let selectedCities = [];
        let suggestions = [];
        let suggestionIndex = -1;
        let searchTimer = null;
        let requestCounter = 0;

        const input = chipsBox.querySelector('input[type="text"]') || document.createElement('input');

        if (!input.parentNode) {
            input.type = 'text';
            input.className = 'chip-input';
            input.placeholder = 'Начните вводить город';
            input.autocomplete = 'off';
            chipsBox.appendChild(input);
        }

        const dropdown = document.createElement('div');
        dropdown.className = 'city-selector__dropdown';

        chipsBox.style.position = 'relative';
        chipsBox.appendChild(dropdown);
        container.dataset.mounted = '1';

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

        const api = {
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

        container.__api = api;

        return api;
    }

    const addCitySelector = createCitySelector('addCitySelector', 'addCityNames');
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

            if (query) {
                const exact = items.find(agency => agency.name.toLowerCase() === query.toLowerCase());

                if (!exact) {
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

            if (currentAgencyField === api) setAgencyAliases(existing ? existing.aliases || [] : []);

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
                    hidden.value = data.agency.id;
                    input.value = data.agency.name;

                    if (currentAgencyField === api) setAgencyAliases(data.agency.aliases || []);

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
            setAgencyAliases([]);
            const query = this.value.trim();
            clearTimeout(timer);
            timer = setTimeout(() => load(query), 180);
        });

        input.addEventListener('focus', function() {
            currentAgencyField = api;
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

        const api = {
            setAgency: function(id, name) {
                hidden.value = id ? String(id) : '';
                input.value = name || '';
                close();
                setAgencyAliases([]);
            },
            syncAliases: function(list) {
                if (api.aliasField) api.aliasField.setAliases(list || []);
            },
            setAliases: function(list) {
                if (api.aliasField) api.aliasField.setAliases(list || []);
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
                if (api.aliasField) api.aliasField.setAliases([]);
            }
        };

        return api;
    }

    function createAliasChips(containerId, inputId, groupId, agencyField) {
        const container = document.getElementById(containerId);
        const input = document.getElementById(inputId);
        const group = document.getElementById(groupId);

        if (!container || !input) return null;

        let aliases = [];

        function render() {
            container.querySelectorAll('.city-chip').forEach(node => node.remove());

            aliases.forEach(name => {
                const chip = document.createElement('span');
                chip.className = 'city-chip';
                chip.innerHTML = '<span></span><button type="button" class="city-chip__remove" aria-label="Удалить вариацию">'
                    + '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
                    + '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
                chip.querySelector('span').textContent = name;
                chip.querySelector('button').addEventListener('click', function() {
                    removeAlias(name);
                });
                container.insertBefore(chip, input);
            });

            input.disabled = !(agencyField && agencyField.getValue());

            container.title = input.disabled ? 'Сначала выберите агентство' : '';
            container.dataset.aliases = JSON.stringify(aliases);
        }

        function normalize(value) {
            return String(value || '').replace(/\s+/g, ' ').trim();
        }

        function addAlias(value) {
            const name = normalize(value);

            if (!name) return false;

            if (aliases.some(item => item.toLowerCase() === name.toLowerCase())) {
                input.value = '';
                return false;
            }

            aliases.push(name);
            input.value = '';
            render();
            return true;
        }

        function setAliases(list) {
            const filtered = [];

            (list || []).forEach(item => {
                const name = normalize(item);

                if (!name) return;
                if (filtered.some(existing => existing.toLowerCase() === name.toLowerCase())) return;

                filtered.push(name);
            });

            aliases = filtered;
            render();
        }

        function removeAlias(name) {
            const index = aliases.indexOf(name);

            if (index < 0) return;

            if (aliasAuthors[name] === 'created') {
                pendingAliasDelete.push(name);
                delete aliasAuthors[name];
            }

            aliases.splice(index, 1);
            render();
        }

        input.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter') return;

            e.preventDefault();
            e.stopPropagation();
            addAlias(input.value);
        });

        input.addEventListener('blur', function() {
            if (input.value.trim()) addAlias(input.value);
        });

        function setVisible(visible) {
            if (!group) return;

            group.style.display = visible ? '' : 'none';

            if (!visible) {
                input.value = '';
                setAliases([]);
            }
        }

        const api = {
            setAliases: function(list) { setAliases(list); },
            getAliases: function() { return aliases.slice(); },
            markCreated: function(name) {
                aliasAuthors[normalize(name)] = 'created';
            },
            setVisible: setVisible,
            clear: function() {
                input.value = '';
                setAliases([]);
            },
            commitPending: function() {
                if (input.value.trim()) addAlias(input.value);
            },
            syncFromDom: function() {
                const chips = container.querySelectorAll('.city-chip > span');
                aliases = Array.from(chips).map(node => node.textContent.trim()).filter(Boolean);
                return aliases.slice();
            }
        };

        render();

        return api;
    }

    const aliasAuthors = {};
    let pendingAliasDelete = [];

    function setAgencyAliases(list) {
        if (currentAgencyField) currentAgencyField.syncAliases(list || []);
    }

    function postAlias(agencyId, name) {
        if (!agencyId || !String(name || '').trim()) return Promise.resolve({ success: true });

        return fetch(`/agencies/${agencyId}/aliases/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCSRFToken()
            },
            body: new URLSearchParams({ name: name })
        })
        .then(response => response.json())
        .catch(error => {
            console.error(error);
            return { error: 'Ошибка сети' };
        });
    }

    function deleteAlias(agencyId, name) {
        if (!agencyId || !String(name || '').trim()) return Promise.resolve({ success: true });

        return fetch(`/agencies/${agencyId}/aliases/?name=${encodeURIComponent(name)}`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCSRFToken() }
        })
        .then(response => response.json())
        .catch(error => {
            console.error(error);
            return { error: 'Ошибка сети' };
        });
    }

    function requestAliasesSave(field, agencyId, clientType) {
        if (!field) return Promise.resolve();

        field.commitPending();

        const names = field.syncFromDom();

        if (clientType !== 'agency' || !agencyId) {
            return Promise.resolve();
        }

        return names.reduce(function(chain, name) {
            return chain.then(function() {
                return postAlias(agencyId, name).then(function(result) {
                    if (result && result.error && result.error !== 'Такая вариация уже добавлена') {
                        showToast(result.error);
                    }
                });
            });
        }, Promise.resolve());
    }

    function saveAliases(field, agencyId, clientType) {
        if (!field || clientType !== 'agency' || !agencyId) {
            return Promise.resolve();
        }

        field.commitPending();

        const list = field.getAliases();

        return list.reduce(function(chain, name) {
            return chain.then(function() {
                return postAlias(agencyId, name).then(function(result) {
                    if (result && result.error && result.error !== 'Такая вариация уже добавлена') {
                        showToast(result.error);
                    }
                });
            });
        }, Promise.resolve());
    }

    const addAgencyField = createAgencyCombobox('addAgencySearch', 'addAgency', addAgencySelect);
    const addAliasField = createAliasChips('addAliasChips', 'addAliasInput', 'addAliasGroup', addAgencyField);

    if (addAgencyField) addAgencyField.aliasField = addAliasField;

    function getSegmentValue(group, attr) {
        if (!group) return '';

        const active = group.querySelector('[' + attr + '].is-on');

        return active ? active.getAttribute(attr) : '';
    }

    function setSegmentValue(group, attr, value, fallback) {
        if (!group) return;

        const buttons = group.querySelectorAll('[' + attr + ']');
        let matched = false;

        buttons.forEach(function(button) {
            const isMatch = button.getAttribute(attr) === value;
            button.classList.toggle('is-on', isMatch);

            if (isMatch) matched = true;
        });

        if (!matched && fallback) {
            buttons.forEach(function(button) {
                button.classList.toggle('is-on', button.getAttribute(attr) === fallback);
            });
        }
    }

    function bindSegmentGroup(group, attr, onChange) {
        if (!group) return;

        group.addEventListener('click', function(e) {
            const button = e.target.closest('[' + attr + ']');

            if (!button) return;

            e.preventDefault();

            group.querySelectorAll('[' + attr + ']').forEach(function(item) {
                item.classList.toggle('is-on', item === button);
            });

            if (onChange) onChange(button.getAttribute(attr));
        });
    }

    function getClientTypeValue(group) {
        const value = getSegmentValue(group, 'data-type');

        return value || 'organizer';
    }

    function setClientTypeValue(group, value) {
        setSegmentValue(group, 'data-type', value, 'organizer');
    }

    function getRatingValue(group) {
        const value = getSegmentValue(group, 'data-rating');

        return value || 'medium';
    }

    function setRatingValue(group, value) {
        setSegmentValue(group, 'data-rating', value, 'medium');
    }

    function toggleAgencyField(clientType, agencyGroup, isAdd) {
        const field = addAgencyField;
        const aliasField = addAliasField;
        const visible = clientType === 'agency';

        currentAgencyField = field;

        if (agencyGroup) {
            agencyGroup.style.display = visible ? '' : 'none';
        }

        if (aliasField) {
            aliasField.setVisible(visible);
        }

        if (!visible && field) {
            field.clear();
        }
    }

    function looksLikePhone(value) {
        const digits = String(value || '').replace(/\D/g, '');
        return digits.length >= 10;
    }

    if (phoneInput && window.UI && window.UI.attachPhoneMask) {
        window.UI.attachPhoneMask(phoneInput);
    }

    function attachOpenModalMasks() {
        ['addClientModal', 'duplicateModal'].forEach(function(modalId) {
            const modal = document.getElementById(modalId);

            if (!modal || !window.UI || !window.UI.attachAllPhoneMasks) return;

            const observer = new MutationObserver(function() {
                if (modal.classList.contains('active')) {
                    window.UI.attachAllPhoneMasks(modal);
                }
            });

            observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
        });
    }

    attachOpenModalMasks();

    function applyContactDetection(input, typeField) {
        if (!input) return;

        const sync = function () {
            const value = input.value.trim();
            const digits = value.replace(/\D/g, '');
            const detected = value.charAt(0) === '@' ? 'telegram' : (digits.length >= 10 ? 'phone' : '');

            if (typeField) typeField.value = detected;

            if (detected === 'phone' && window.UI && window.UI.attachPhoneMask) {
                input.setAttribute('inputmode', 'tel');
            } else {
                input.removeAttribute('inputmode');
            }
        };

        input.addEventListener('input', sync);
        input.addEventListener('blur', sync);
        sync();
    }

    bindSegmentGroup(addClientType, 'data-type', function(value) {
        toggleAgencyField(value, addAgencyGroup, true);
    });

    bindSegmentGroup(document.getElementById('addRating'), 'data-rating');
    bindSegmentGroup(document.getElementById('editRating'), 'data-rating');

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

    function validatePhone(phone) {
        return window.UI.extractPhoneDigits(phone).length === 10;
    }

    let currentClientData = null;

    function setV6Text(id, value) {
        const node = document.getElementById(id);

        if (!node) return;

        const text = value && value !== '—' ? value : '—';

        node.textContent = text;
        node.classList.toggle('m-editable--empty', text === '—' && !!node.dataset.edit);
    }

    function refreshV6AliasState() {
        const node = document.getElementById('v6AgencyAliases');

        if (!node) return;

        const disabled = !(currentClientData && currentClientData.agency_id);

        node.classList.toggle('m-editable--disabled', disabled);
        node.dataset.disabled = disabled ? '1' : '';
    }

    function setV6Switch(group, attr, value) {
        if (!group) return;

        group.querySelectorAll('[' + attr + ']').forEach(function(btn) {
            btn.classList.toggle('is-on', btn.getAttribute(attr) === value);
        });
    }

    function formatV6Cost(value) {
        const raw = String(value === undefined || value === null ? '' : value).replace(/\s/g, '').replace(',', '.').replace('₽', '');

        const number = parseFloat(raw);

        if (!raw || isNaN(number) || number <= 0) return '—';

        const rounded = Math.round(number);

        return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '₽';
    }

    function renderV6Summary(data, typeKey, aliases, cities) {
        const node = document.getElementById('v6Summary');

        if (!node) return;

        const typeLabel = typeKey === 'agency' ? 'Агентство' : (typeKey === 'organizer' ? 'Орг' : 'Без типа');
        const ratingKey = data.rating_key || 'medium';
        const ratingLabel = ratingKey === 'high' ? 'Высокий' : (ratingKey === 'low' ? 'Низкий' : 'Средний');
        const ratingCls = ratingKey === 'high' ? ' chip--ok' : (ratingKey === 'low' ? ' chip--danger' : ' chip--warn');
        const cityList = Array.isArray(cities) ? cities : [];
        const aliasList = Array.isArray(aliases) ? aliases : [];

        const chips = ['<span class="chip">' + escapeHtml(typeLabel) + '</span>',
            '<span class="chip' + ratingCls + '">' + ratingLabel + '</span>'];

        if (cityList.length) {
            chips.push('<span class="chip">' + cityList.length + ' ' + (cityList.length === 1 ? 'город' : 'города') + '</span>');
        }

        if (aliasList.length) {
            chips.push('<span class="chip">' + aliasList.length + ' вариации</span>');
        }

        node.innerHTML = chips.join('');
        node.hidden = false;
    }

    function renderV6Card(data) {
        currentClientData = data;

        document.getElementById('modalClientName').textContent = data.full_name;

        const telegramValue = String(data.telegram && data.telegram !== '—' ? data.telegram : '').replace(/^@/, '');
        const telegramNode = document.getElementById('v6Telegram');

        if (telegramNode) {
            telegramNode.innerHTML = telegramValue
                ? '<a class="m-link" href="https://t.me/' + encodeURIComponent(telegramValue) + '" target="_blank" rel="noopener">@' + escapeHtml(telegramValue) + '</a>'
                : '—';
        }

        const instaValue = String(data.instagram && data.instagram !== '—' ? data.instagram : '')
            .trim()
            .replace(/^@/, '')
            .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
            .replace(/\/$/, '');

        const instaNode = document.getElementById('v6Instagram');

        if (instaNode) {
            instaNode.innerHTML = instaValue
                ? '<a class="m-link" href="https://instagram.com/' + encodeURIComponent(instaValue) + '" target="_blank" rel="noopener">@' + escapeHtml(instaValue) + '</a>'
                : '—';
        }

        setV6Text('v6Phone', data.phone);
        setV6Text('v6Email', data.email);

        const typeKey = data.client_type_key || 'organizer';

        setV6Switch(document.getElementById('v6TypeSwitch'), 'data-type', typeKey);

        const agencyRow = document.getElementById('v6AgencyRow');
        const aliasRow = document.getElementById('v6AliasRow');

        if (agencyRow) agencyRow.style.display = typeKey === 'agency' ? '' : 'none';
        if (aliasRow) aliasRow.style.display = typeKey === 'agency' ? '' : 'none';

        setV6Text('v6Agency', data.agency);

        const aliases = Array.isArray(data.agency_aliases) ? data.agency_aliases.filter(Boolean) : [];
        setV6Text('v6AgencyAliases', aliases.join(', '));

        const aliasesNode = document.getElementById('v6AgencyAliases');

        if (aliasesNode) aliasesNode.dataset.values = JSON.stringify(aliases);

        refreshV6AliasState();

        const cities = Array.isArray(data.cities)
            ? data.cities.filter(Boolean)
            : String(data.city || '').split(',').map(item => item.trim()).filter(Boolean);

        setV6Text('v6Cities', data.city);

        const citiesNode = document.getElementById('v6Cities');

        if (citiesNode) citiesNode.dataset.values = JSON.stringify(cities);
        setV6Switch(document.getElementById('v6RatingSwitch'), 'data-rating', data.rating_key || 'medium');
        setV6Text('v6Comment', data.comment || '');

        renderV6Summary(data, typeKey, aliases, cities);

        setV6Text('v6OrdersCount', String(data.orders_count || 0));
        setV6Text('v6RequestsCount', String(data.requests_count || 0));
        setV6Text('v6LastOrder', data.last_order);

        const turnoverNode = document.getElementById('v6Turnover');

        if (turnoverNode) {
            turnoverNode.textContent = window.UI && window.UI.formatMoney
                ? window.UI.formatMoney(data.turnover || 0)
                : (data.turnover || '0.00') + '₽';
        }

        const streamCount = document.getElementById('v6StreamCount');

        if (streamCount) {
            const total = data.orders_count || (data.orders ? data.orders.length : 0);
            streamCount.textContent = total + ' заказов';
        }

        const foot = document.getElementById('v6Foot');

        if (foot) {
            foot.textContent = 'Создан ' + (data.created_at || '—') + (data.created_by ? ' · ' + data.created_by : '');
        }

        const ordersContainer = document.getElementById('viewOrdersList');

        if (ordersContainer) {
            const orders = Array.isArray(data.orders) ? data.orders : [];
            const colors = data.colors || {};

            if (!orders.length) {
                ordersContainer.innerHTML = '<div class="m-empty">Нет заказов</div>';
            } else {
                ordersContainer.innerHTML = orders.map(function(order) {
                    const key = order.status_key || 'request';
                    const c = colors['order:' + key];
                    const style = c
                        ? ' style="background:' + escapeHtml(c.background) + ';border-color:' + escapeHtml(c.border) + ';'
                            + '--bar:' + escapeHtml(c.border) + ';--bar-text:' + escapeHtml(c.text) + ';color:' + escapeHtml(c.text) + ';"'
                        : '';

                    return '<button type="button" class="m-event m-event--' + escapeHtml(key) + '" data-order-id="' + order.id + '"' + style + '>'
                        + '<span class="m-event__date">' + escapeHtml(order.date || '—') + '</span>'
                        + '<span class="m-event__name">' + escapeHtml(order.name || order.address || '—') + '</span>'
                        + '<span class="m-event__cost">' + escapeHtml(formatV6Cost(order.cost)) + '</span>'
                        + '</button>';
                }).join('');

                ordersContainer.querySelectorAll('[data-order-id]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        const orderId = this.getAttribute('data-order-id');
                        closeModal();
                        window.location.href = '/schedule/?order=' + encodeURIComponent(orderId);
                    });
                });
            }
        }
    }

    function openClientModal(clientId, options) {
        currentClientId = clientId;

        fetch(`/clients/${clientId}/`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                renderV6Card(data);

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
        currentClientData = null;
        v6Dirty = {};
        toggleV6SaveButton();
    }

    const V6_FIELD_META = {
        name: { label: 'Имя', type: 'text' },
        phone: { label: 'Телефон', type: 'tel' },
        telegram: { label: 'Телеграм', type: 'text' },
        instagram: { label: 'Инстаграм', type: 'text' },
        email: { label: 'Email', type: 'email' },
        agency: { label: 'Агентство', type: 'text' },
        comment: { label: 'Комментарий', type: 'textarea' },
        cities: { label: 'Города', type: 'chips' },
        agencyAliases: { label: 'Вариации', type: 'chips' },
    };

    function v6FieldValue(key) {
        const data = currentClientData || {};
        const node = document.querySelector('[data-edit="' + key + '"]');

        if (node && node.dataset.values) {
            try {
                const stored = JSON.parse(node.dataset.values);

                if (Array.isArray(stored)) return stored;
            } catch (error) {
                console.error(error);
            }
        }

        if (key === 'name') return data.full_name || '';

        if (key === 'city' || key === 'cities') {
            return Array.isArray(data.cities) && data.cities.length
                ? data.cities
                : String(data.city || '').split(',').map(item => item.trim()).filter(Boolean);
        }

        if (key === 'agencyAliases') return Array.isArray(data.agency_aliases) ? data.agency_aliases : [];

        const value = data[key];

        return value === '—' ? '' : (value || '');
    }

    let v6Dirty = {};

    function getV6Input(key) {
        const node = key === 'name'
            ? document.getElementById('modalClientName')
            : document.querySelector('[data-edit="' + key + '"]');

        return node ? node.querySelector('input, textarea') : null;
    }

    function startV6Edit(key) {
        if (!currentClientData) return;

        if (key === 'agencyAliases' && !currentClientData.agency_id) {
            showToast('Сначала выберите агентство');
            return;
        }

        if (getV6Input(key)) return;

        if (key === 'agency') {
            openV6AgencyPicker();
            return;
        }

        const meta = V6_FIELD_META[key];

        if (!meta) return;

        const node = key === 'name'
            ? document.getElementById('modalClientName')
            : document.querySelector('[data-edit="' + key + '"]');

        if (!node) return;

        const currentValue = v6FieldValue(key);

        if (meta.type === 'chips') {
            startV6ChipsEdit(node, key, currentValue);
            return;
        }

        const input = document.createElement(meta.type === 'textarea' ? 'textarea' : 'input');

        input.className = 'm-input' + (meta.type === 'textarea' ? ' m-input--area' : '');

        if (input.tagName === 'INPUT') {
            input.type = meta.type;
            input.value = currentValue;
        } else {
            input.rows = 2;
            input.value = currentValue;
        }

        node.classList.remove('m-editable');
        node.textContent = '';
        node.appendChild(input);
        input.focus();

        if (input.tagName === 'TEXTAREA') {
            autoGrowField(input);
        } else {
            input.select();
        }

        v6Dirty[key] = true;

        input.addEventListener('input', function() {
            v6Dirty[key] = true;

            if (input.tagName === 'TEXTAREA') autoGrowField(input);
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && input.tagName === 'INPUT') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                input.blur();
            }
        });

        input.addEventListener('blur', function() {
            setTimeout(function() {
                if (node.contains(document.activeElement)) return;

                node.classList.add('m-editable');
                node.textContent = (v6Dirty[key] ? input.value.trim() : currentValue) || '—';
                toggleV6SaveButton();
            }, 60);
        });
    }

    function startV6ChipsEdit(node, key, list) {
        const values = list.slice();
        const isCities = key === 'cities';

        node.classList.remove('m-editable');
        node.innerHTML = '';

        const box = document.createElement('span');
        box.className = 'chips';
        box.setAttribute('data-chips-key', key);
        node.appendChild(box);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'chip-input';
        input.placeholder = isCities ? 'Начните вводить город' : 'Добавить';
        input.autocomplete = 'off';

        const dropdown = document.createElement('div');
        dropdown.className = 'city-selector__dropdown';

        box.appendChild(dropdown);

        let items = [];
        let counter = 0;
        let timer = null;

        function closeDropdown() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            items = [];
        }

        function addValue(name) {
            const value = String(name || '').trim();

            if (!value) return false;

            if (values.some(item => item.toLowerCase() === value.toLowerCase())) {
                input.value = '';
                return false;
            }

            values.push(value);
            v6Dirty[key] = true;
            input.value = '';
            render();
            toggleV6SaveButton();
            return true;
        }

        function createCity(name) {
            fetch('/orders/cities/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams({ name: name })
            })
            .then(r => r.json())
            .then(function(data) {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                addValue(data.city ? data.city.name : name);
                closeDropdown();
                input.focus();
            })
            .catch(function() { showToast('Ошибка создания города'); });
        }

        function renderChips() {
            box.querySelectorAll('.city-chip').forEach(chip => chip.remove());

            node.dataset.values = JSON.stringify(values);

            values.forEach(function(name) {
                const chip = document.createElement('span');
                chip.className = 'city-chip';

                const label = document.createElement('span');
                label.textContent = name;

                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'city-chip__remove';
                remove.setAttribute('aria-label', 'Удалить');
                remove.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
                remove.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    const index = values.indexOf(name);

                    if (index >= 0) values.splice(index, 1);

                    v6Dirty[key] = true;
                    renderChips();
                    toggleV6SaveButton();
                });

                chip.appendChild(label);
                chip.appendChild(remove);
                box.insertBefore(chip, input);
            });
        }

        function renderChipsAll() {
            renderChips();
        }

        function render() {
            renderChipsAll();
        }

        function renderSuggestions(query) {
            dropdown.innerHTML = '';

            if (!isCities) {
                dropdown.classList.remove('open');
                return;
            }

            const clean = String(query || '').trim();
            const existing = new Set(values.map(item => item.toLowerCase()));

            if (clean && !existing.has(clean.toLowerCase())) {
                const create = document.createElement('button');
                create.type = 'button';
                create.className = 'city-selector__option city-selector__option--create';
                create.textContent = 'Создать город «' + clean + '»';

                create.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    createCity(clean);
                });

                dropdown.appendChild(create);
            }

            items
                .filter(item => !existing.has(item.toLowerCase()))
                .slice(0, 30)
                .forEach(function(name) {
                    const option = document.createElement('button');
                    option.type = 'button';
                    option.className = 'city-selector__option';
                    option.textContent = name;

                    option.addEventListener('mousedown', function(e) {
                        e.preventDefault();
                        addValue(name);
                        closeDropdown();
                        input.focus();
                    });

                    dropdown.appendChild(option);
                });

            dropdown.classList.toggle('open', dropdown.children.length > 0);
        }

        function load(query) {
            const current = ++counter;

            fetch('/clients/cities/?search=' + encodeURIComponent(query))
                .then(r => r.json())
                .then(function(data) {
                    if (current !== counter) return;

                    const source = data.cities || data.results || [];
                    items = source.map(function(item) { return typeof item === 'string' ? item : (item.name || ''); }).filter(Boolean);

                    renderSuggestions(query);
                })
                .catch(function(error) { console.error(error); });
        }

        box.appendChild(input);
        render();

        input.focus();

        input.addEventListener('input', function() {
            clearTimeout(timer);

            const query = input.value.trim();

            if (!isCities) {
                if (query) renderSuggestions(query);
                return;
            }

            timer = setTimeout(function() { load(query); }, 150);
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();

                const value = input.value.trim();
                const first = dropdown.querySelector('.city-selector__option');

                if (first && first.classList.contains('city-selector__option--create') && value) {
                    first.dispatchEvent(new MouseEvent('mousedown'));
                    return;
                }

                const active = dropdown.querySelector('.city-selector__option');

                if (active) {
                    active.dispatchEvent(new MouseEvent('mousedown'));
                    return;
                }

                if (value) addValue(value);

                input.focus();
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                closeDropdown();
                input.blur();
            }
        });

        input.addEventListener('blur', function() {
            setTimeout(function() {
                if (node.contains(document.activeElement)) return;

                closeDropdown();

                node.classList.add('m-editable');
                node.textContent = values.join(', ') || '—';
                toggleV6SaveButton();
            }, 80);
        });
    }

    function openV6AgencyPicker() {
        const cell = document.querySelector('[data-edit="agency"]');

        if (!cell || cell.querySelector('input')) return;

        cell.classList.remove('m-editable');
        cell.textContent = '';

        const holder = document.createElement('span');
        holder.className = 'agency-combobox';
        holder.style.position = 'relative';
        holder.style.display = 'block';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'm-input';
        input.placeholder = 'Начните вводить название';
        input.autocomplete = 'off';
        input.value = currentClientData && currentClientData.agency && currentClientData.agency !== '—'
            ? currentClientData.agency
            : '';

        const dropdown = document.createElement('div');
        dropdown.className = 'city-selector__dropdown';

        holder.appendChild(input);
        holder.appendChild(dropdown);
        cell.appendChild(holder);

        let items = [];
        let index = -1;
        let counter = 0;

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            items = [];
            index = -1;
        }

        function apply(agency) {
            currentClientData.agency_id = agency.id;
            currentClientData.agency = agency.name;
            currentClientData.agency_aliases = agency.aliases || [];

            v6Dirty.agency = true;
            v6Dirty.agencyAliases = true;

            close();

            cell.classList.add('m-editable');
            cell.textContent = agency.name || '—';

            setV6Text('v6AgencyAliases', (agency.aliases || []).join(', '));

            const node = document.getElementById('v6AgencyAliases');

            if (node) node.dataset.values = JSON.stringify(agency.aliases || []);

            refreshV6AliasState();
            toggleV6SaveButton();
        }

        function createAgency(name) {
            fetch('/agencies/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams({ name: name })
            })
            .then(r => r.json())
            .then(function(data) {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                if (data.success) {
                    addAgencyToSelect(addAgencySelect, data.agency.id, data.agency.name);
                    apply(data.agency);
                }
            })
            .catch(function() { showToast('Ошибка создания агентства'); });
        }

        function render(query) {
            dropdown.innerHTML = '';

            items.forEach(function(agency, position) {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'city-selector__option' + (position === index ? ' active' : '');
                option.textContent = agency.name;

                option.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    apply(agency);
                });

                dropdown.appendChild(option);
            });

            if (query && !items.some(item => item.name.toLowerCase() === query.toLowerCase())) {
                const create = document.createElement('button');
                create.type = 'button';
                create.className = 'city-selector__option city-selector__option--create';
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
            const current = ++counter;

            fetch('/agencies/catalog/?search=' + encodeURIComponent(query))
                .then(r => r.json())
                .then(function(data) {
                    if (current !== counter) return;

                    items = data.agencies || [];
                    index = -1;
                    render(query);
                })
                .catch(function(error) { console.error(error); });
        }

        input.focus();
        load('');

        input.addEventListener('input', function() {
            load(input.value.trim());
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                close();
                input.blur();
            }
        });

        input.addEventListener('blur', function() {
            setTimeout(function() {
                if (holder.contains(document.activeElement)) return;

                close();

                cell.classList.add('m-editable');
                cell.textContent = currentClientData && currentClientData.agency && currentClientData.agency !== '—'
                    ? currentClientData.agency
                    : '—';
            }, 120);
        });
    }

    function bindV6Card() {
        const typeSwitch = document.getElementById('v6TypeSwitch');
        const ratingSwitch = document.getElementById('v6RatingSwitch');

        if (typeSwitch) {
            typeSwitch.addEventListener('click', function(e) {
                const btn = e.target.closest('[data-type]');

                if (!btn) return;

                setV6Switch(typeSwitch, 'data-type', btn.dataset.type);

                v6Dirty.client_type = true;

                if (btn.dataset.type === 'agency') {
                    const agencyRow = document.getElementById('v6AgencyRow');
                    const aliasRow = document.getElementById('v6AliasRow');

                    if (agencyRow) agencyRow.style.display = '';
                    if (aliasRow) aliasRow.style.display = '';

                    refreshV6AliasState();
                }

                if (btn.dataset.type !== 'agency' && currentClientData) {
                    currentClientData.agency_id = null;
                    currentClientData.agency = null;
                    currentClientData.agency_aliases = [];

                    setV6Text('v6Agency', '');
                    setV6Text('v6AgencyAliases', '');

                    const aliasNode = document.getElementById('v6AgencyAliases');

                    if (aliasNode) aliasNode.dataset.values = '[]';

                    refreshV6AliasState();
                }

                toggleV6SaveButton();
            });
        }

        if (ratingSwitch) {
            ratingSwitch.addEventListener('click', function(e) {
                const btn = e.target.closest('[data-rating]');

                if (!btn) return;

                setV6Switch(ratingSwitch, 'data-rating', btn.dataset.rating);

                v6Dirty.rating = true;
                toggleV6SaveButton();
            });
        }

        const card = document.getElementById('clientModal');

        if (card) {
            card.addEventListener('click', function(e) {
                const target = e.target.closest('[data-edit]');

                if (!target) return;

                e.preventDefault();
                startV6Edit(target.dataset.edit);
            });
        }
    }

    function toggleV6SaveButton() {
        const btn = document.getElementById('v6SaveBtn');

        if (!btn) return;

        btn.classList.add('is-visible');
        btn.disabled = false;
    }

    function v6CellText(key) {
        if (key === 'cities' || key === 'agencyAliases') {
            const node = document.querySelector('[data-edit="' + key + '"]');

            if (node && node.dataset.values) {
                try {
                    const stored = JSON.parse(node.dataset.values);

                    if (Array.isArray(stored)) return stored.join(', ');
                } catch (error) {
                    console.error(error);
                }
            }

            const box = document.querySelector('[data-chips-key="' + key + '"]');

            if (box) {
                return Array.from(box.querySelectorAll('.city-chip > span'))
                    .map(node => node.textContent.trim())
                    .filter(Boolean)
                    .join(', ');
            }

            return (v6FieldValue(key) || []).join(', ');
        }

        const node = key === 'name'
            ? document.getElementById('modalClientName')
            : document.querySelector('[data-edit="' + key + '"]');

        if (!node) return '';

        const input = node.querySelector('input, textarea');

        if (input) return input.value.trim();

        const text = node.textContent.trim();

        return text === '—' ? '' : text;
    }

    function collectV6Changes() {
        const data = {
            full_name: v6CellText('name'),
            phone: v6CellText('phone'),
            telegram: v6CellText('telegram'),
            instagram: v6CellText('instagram'),
            email: v6CellText('email'),
            comment: v6CellText('comment'),
            city_names: v6CellText('cities').split(',').map(item => item.trim()).filter(Boolean).join(','),
            client_type: getSegmentValue(document.getElementById('v6TypeSwitch'), 'data-type') || 'organizer',
            rating: getSegmentValue(document.getElementById('v6RatingSwitch'), 'data-rating') || 'medium',
            agency_id: (currentClientData && currentClientData.agency_id) || '',
        };

        if (data.client_type === 'agency' && !data.agency_id) {
            showToast('Выберите агентство');
            return null;
        }

        if (!data.full_name) {
            showToast('Укажите имя клиента');
            return null;
        }

        return data;
    }

    function saveV6Card() {
        if (!currentClientId) {
            showToast('Клиент не выбран');
            return;
        }

        const data = collectV6Changes();

        if (!data) return;

        const btn = document.getElementById('v6SaveBtn');
        const aliasesNode = document.querySelector('[data-edit="agencyAliases"]');
        let aliases = [];

        if (aliasesNode && aliasesNode.dataset.values) {
            try {
                const stored = JSON.parse(aliasesNode.dataset.values);

                if (Array.isArray(stored)) aliases = stored;
            } catch (error) {
                console.error(error);
            }
        }

        if (!aliases.length) {
            aliases = v6CellText('agencyAliases')
                .split(',')
                .map(item => item.trim().replace(/\s+/g, ' '))
                .filter(Boolean);
        }

        if (btn) window.UI.setButtonBusy(btn, true, 'Сохранение...');

        let chain = Promise.resolve();
        let aliasFailures = 0;

        if (data.client_type === 'agency' && data.agency_id) {
            const agencyId = data.agency_id;
            const lower = item => String(item).toLowerCase().replace(/ё/g, 'е');
            const wanted = aliases.map(lower);
            const current = (currentClientData && currentClientData.agency_aliases) || [];
            const removeList = current.filter(name => wanted.indexOf(lower(name)) < 0);

            chain = removeList.reduce(function(next, name) {
                return next.then(function() {
                    return deleteAlias(agencyId, name).then(function(result) {
                        if (result && result.error && result.error !== 'Вариация не найдена') {
                            aliasFailures += 1;
                            console.error('alias delete', name, result.error);
                        }
                    });
                });
            }, Promise.resolve());

            chain = chain.then(function() {
                return aliases.reduce(function(next, name) {
                    return next.then(function() {
                        return postAlias(agencyId, name).then(function(result) {
                            if (result && result.error && result.error !== 'Такая вариация уже добавлена') {
                                aliasFailures += 1;
                                console.error('alias post', name, result.error);
                            }
                        });
                    });
                }, Promise.resolve());
            });
        }

        chain
            .then(function() {
                return fetch('/clients/' + currentClientId + '/update/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: new URLSearchParams(data)
                });
            })
            .then(r => r.json())
            .then(function(res) {
                if (res.error) {
                    showToast(res.error);
                    return;
                }

                if (!res.success) return;

                v6Dirty = {};

                if (aliasFailures > 0) {
                    showToast('Часть вариаций не сохранилась (' + aliasFailures + ')');
                }

                return fetch('/clients/' + currentClientId + '/')
                    .then(r => r.json())
                    .then(function(fresh) {
                        if (fresh.error) return;

                        fresh.agency_aliases = aliases;
                        fresh.cities = data.city_names
                            ? data.city_names.split(',').map(item => item.trim()).filter(Boolean)
                            : [];

                        renderV6Card(fresh);
                    });
            })
            .catch(function() { showToast('Ошибка сохранения'); })
            .finally(function() {
                if (btn) window.UI.setButtonBusy(btn, false);
                toggleV6SaveButton();
            });
    }

    function openAddModal() {
        addModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        addForm.reset();
        document.getElementById('addInstagram').value = '';
        setRatingValue(document.getElementById('addRating'), 'medium');
        setClientTypeValue(addClientType, 'organizer');
        const phoneField = document.getElementById('addPhone');
        if (phoneField) phoneField.value = '';
        const telegramField = document.getElementById('addTelegram');
        if (telegramField) telegramField.value = '';
        document.getElementById('addComment').value = '';
        toggleAgencyField(addClientType ? getClientTypeValue(addClientType) : 'organizer', addAgencyGroup, true);
        if (addAliasField) addAliasField.clear();
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

    function validateAddPayload(payload, focusIdPrefix) {
        if (!payload.full_name) {
            showToast('Пожалуйста, заполните поле Имя');
            document.getElementById(focusIdPrefix + 'FullName').focus();
            return false;
        }

        const contactField = document.getElementById(focusIdPrefix + 'Phone');

        if (!payload.phone && !payload.telegram) {
            showToast('Укажите телефон или телеграм');
            if (contactField) contactField.focus();
            return false;
        }

        if (payload.phone && (!looksLikePhone(payload.phone) || !validatePhone(payload.phone))) {
            showToast('Пожалуйста, введите корректный номер телефона (11 цифр)');
            if (contactField) contactField.focus();
            return false;
        }

        if (payload.client_type === 'agency' && !payload.agency_id) {
            showToast('Пожалуйста, выберите агентство');

            const agencyInput = document.getElementById(focusIdPrefix + 'AgencySearch');

            if (agencyInput) agencyInput.focus();

            return false;
        }

        return true;
    }

    function duplicateRatingHtml(key) {
        return '<span class="switch switch--readonly">'
            + '<span class="switch__btn' + (key === 'low' ? ' is-on' : '') + '">Низкий</span>'
            + '<span class="switch__btn' + (key === 'medium' ? ' is-on' : '') + '">Средний</span>'
            + '<span class="switch__btn' + (key === 'high' ? ' is-on' : '') + '">Высокий</span>'
            + '</span>';
    }

    function duplicateCardRow(label, value) {
        const text = String(value === undefined || value === null || value === '' ? '—' : value);

        return '<div class="duplicate-card__row">'
            + '<span class="duplicate-card__key">' + escapeHtml(label) + '</span>'
            + '<span class="duplicate-card__val">' + escapeHtml(text) + '</span>'
            + '</div>';
    }

    function renderDuplicateCard(match) {
        if (!duplicateCard) return;

        if (!match) {
            duplicateCard.innerHTML = '<div class="duplicate-card__empty">Данные нового клиента не заполнены</div>';
            return;
        }

        const cities = Array.isArray(match.cities) && match.cities.length ? match.cities.join(', ') : (match.city || '');
        const telegram = String(match.telegram || '').replace(/^@/, '');
        const rating = match.rating_key || 'medium';
        const typeLabel = match.client_type_key === 'agency'
            ? 'Агентство'
            : (match.client_type_key === 'organizer' ? 'Организатор' : '—');

        duplicateCard.innerHTML = ''
            + '<div class="duplicate-card__head">'
            + '<span class="duplicate-card__name">' + escapeHtml(match.full_name || 'Без имени') + '</span>'
            + '<span class="duplicate-card__sub">Клиент №' + escapeHtml(String(match.id)) + '</span>'
            + '</div>'
            + '<div class="duplicate-card__group">'
            + '<div class="duplicate-card__title">Контакты</div>'
            + duplicateCardRow('Телефон', match.phone || '')
            + duplicateCardRow('Телеграм', telegram ? '@' + telegram : '')
            + duplicateCardRow('Инстаграм', match.instagram ? '@' + String(match.instagram).replace(/^@/, '') : '')
            + duplicateCardRow('Email', match.email || '')
            + '</div>'
            + '<div class="duplicate-card__group">'
            + '<div class="duplicate-card__title">Клиент</div>'
            + duplicateCardRow('Тип', typeLabel)
            + duplicateCardRow('Агентство', match.agency || '')
            + duplicateCardRow('Города', cities)
            + '<div class="duplicate-card__row">'
            + '<span class="duplicate-card__key">Рейтинг</span>'
            + '<span class="duplicate-card__val">' + duplicateRatingHtml(rating) + '</span>'
            + '</div>'
            + '</div>'
            + '<div class="duplicate-card__group">'
            + '<div class="duplicate-card__title">Активность</div>'
            + duplicateCardRow('Заказов', String(match.orders_count || 0))
            + duplicateCardRow('Запросов', String(match.requests_count || 0))
            + duplicateCardRow('Добавлен', match.created_at || '')
            + '</div>'
            + (match.comment
                ? '<div class="duplicate-card__group">'
                    + '<div class="duplicate-card__title">Комментарий</div>'
                    + '<div class="duplicate-card__note">' + escapeHtml(match.comment) + '</div>'
                    + '</div>'
                : '');
    }

    window.selectDuplicateMatch = function(matchId) {
        const match = duplicateMatches.find(item => item.id === matchId);
        if (!match) return;

        selectedMatchId = match.id;

        duplicateMatchesList.querySelectorAll('.duplicate-match').forEach(button => {
            button.classList.toggle('active', parseInt(button.getAttribute('data-match-id'), 10) === match.id);
        });

        renderDuplicateCard(match);
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
            const card = document.createElement('div');
            card.className = 'duplicate-match' + (index === 0 ? ' active' : '');
            card.setAttribute('data-match-id', String(match.id));
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');

            const name = document.createElement('span');
            name.className = 'duplicate-match__name';
            name.textContent = match.full_name || 'Без имени';
            card.appendChild(name);

            const meta = document.createElement('span');
            meta.className = 'duplicate-match__meta';
            meta.textContent = (match.phone || 'Телефон не указан') + (match.agency ? ' · ' + match.agency : '');
            card.appendChild(meta);

            const info = document.createElement('span');
            info.className = 'duplicate-match__meta';
            info.textContent = 'Заказов: ' + (match.orders_count || 0) + (match.created_at ? ' · Добавлен ' + match.created_at : '');
            card.appendChild(info);

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

                card.appendChild(reasonsBox);
            }

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'btn btn-danger btn-sm duplicate-match__delete';
            remove.textContent = 'Удалить';

            remove.addEventListener('click', function(e) {
                e.stopPropagation();
                deleteDuplicateMatch(match);
            });

            card.appendChild(remove);

            card.addEventListener('click', function() {
                window.selectDuplicateMatch(match.id);
            });

            card.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    window.selectDuplicateMatch(match.id);
                }
            });

            duplicateMatchesList.appendChild(card);
        });
    }

    function deleteDuplicateMatch(match) {
        if (!match) return;

        const text = match.orders_count
            ? 'Клиент «' + match.full_name + '» будет удалён вместе с заказами (' + match.orders_count + '). Новый клиент создан не будет.'
            : 'Клиент «' + match.full_name + '» будет удалён. Новый клиент создан не будет.';

        window.UI.confirm({
            title: 'Удалить клиента?',
            text: text,
            okText: 'Удалить',
            cancelText: 'Отмена',
            danger: true
        }).then(function(confirmed) {
            if (!confirmed) return;

            fetch('/clients/replace/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCSRFToken()
                },
                body: new URLSearchParams({ client_id: match.id })
            })
            .then(function(response) {
                return response.json().then(function(body) {
                    return { status: response.status, body: body };
                });
            })
            .then(function(result) {
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

                if (!data.success) return;

                showToast(data.deactivated
                    ? 'Клиент деактивирован, заказы сохранены'
                    : 'Клиент удалён');

                duplicateMatches = duplicateMatches.filter(function(item) {
                    return item.id !== (data.deleted_id || match.id);
                });

                selectedMatchId = null;
                renderDuplicateMatches();

                if (duplicateMatches.length) {
                    selectDuplicateMatch(duplicateMatches[0].id);
                } else {
                    renderDuplicateCard(null);
                    showToast('Совпадений больше нет');
                }
            })
            .catch(function(error) {
                showToast('Ошибка при удалении клиента');
                console.error(error);
            });
        });
    }

    function openDuplicateModal(matches) {
        duplicateMatches = Array.isArray(matches) ? matches : [];
        duplicateMatchesList.innerHTML = '';
        renderDuplicateCard(null);
        duplicateModal.classList.add('active');
        addModal.classList.remove('active');
        document.body.style.overflow = 'hidden';

        try {
            if (duplicateMatches.length) {
                renderDuplicateMatches();
                selectDuplicateMatch(duplicateMatches[0].id);
            } else {
                selectedMatchId = null;
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
        renderDuplicateCard(null);

        if (restoreAdd) {
            addModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    function readAddFormPayload() {
        const phoneField = document.getElementById('addPhone');
        const telegramField = document.getElementById('addTelegram');
        const phoneValue = phoneField ? phoneField.value.trim() : '';
        const telegramValue = telegramField ? telegramField.value.trim() : '';

        return {
            full_name: document.getElementById('addFullName').value.trim(),
            contact_type: phoneValue ? 'phone' : (telegramValue ? 'telegram' : ''),
            phone: phoneValue,
            client_type_key: getClientTypeValue(addClientType),
            agency_id: addAgencyField ? addAgencyField.getValue() : null,
            agency: addAgencyField ? addAgencyField.getText() : '',
            telegram: telegramValue,
            email: document.getElementById('addEmail').value.trim(),
            cities: addCitySelector ? addCitySelector.getValues() : [],
            comment: document.getElementById('addComment').value.trim(),
            rating_key: getRatingValue(document.getElementById('addRating'))
        };
    }

    function recheckClientDuplicates(matches) {
        if (!matches || !matches.length) return false;

        const existingIds = new Set(duplicateMatches.map(item => item.id));
        const changed = matches.some(item => !existingIds.has(item.id));

        if (!changed) return false;

        duplicateMatches = matches;
        renderDuplicateMatches();

        if (selectedMatchId && matches.some(item => item.id === selectedMatchId)) {
            selectDuplicateMatch(selectedMatchId);
        } else {
            selectedMatchId = null;
            renderDuplicateCard(null);
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

        if (cookieValue) return cookieValue[2];

        return window.__csrfToken || '';
    }

    modalCloseBtn.addEventListener('click', requestCloseClientModal);

    modal.addEventListener('click', function(e) {
        if (e.target === this) requestCloseClientModal();
    });

    bindV6Card();

    const v6SaveBtnEl = document.getElementById('v6SaveBtn');

    if (v6SaveBtnEl) v6SaveBtnEl.addEventListener('click', saveV6Card);

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

    addClientBtn.addEventListener('click', openAddModal);

const addClientFab = document.getElementById('addClientFab');

if (addClientFab) addClientFab.addEventListener('click', openAddModal);
    addModalCloseBtn.addEventListener('click', requestCloseAddModal);
    addModalCancelBtn.addEventListener('click', requestCloseAddModal);
    addModal.addEventListener('click', function(e) {
        if (e.target === this) requestCloseAddModal();
    });

    addForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const phoneField = document.getElementById('addPhone');
        const telegramField = document.getElementById('addTelegram');
        const phoneValue = phoneField ? phoneField.value.trim() : '';
        const telegramValue = telegramField ? telegramField.value.trim() : '';

        const data = {
            full_name: document.getElementById('addFullName').value.trim(),
            contact_type: phoneValue ? 'phone' : (telegramValue ? 'telegram' : ''),
            phone: phoneValue,
            telegram: telegramValue,
            client_type: getClientTypeValue(addClientType),
            agency_id: addAgencyField ? addAgencyField.getValue() : '',
            email: document.getElementById('addEmail').value.trim(),
            instagram: document.getElementById('addInstagram').value.trim(),
            city_names: addCitySelector ? addCitySelector.getValues().join(',') : '',
            comment: document.getElementById('addComment').value.trim(),
            rating: getRatingValue(document.getElementById('addRating'))
        };

        if (!validateAddPayload(data, 'add')) return;

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
                requestAliasesSave(addAliasField, data.agency_id, data.client_type).finally(function() {
                    closeAddModal();
                    setTimeout(() => location.reload(), 500);
                });
            }
        })
        .catch(error => {
            showToast('Ошибка при добавлении клиента');
            console.error(error);
        });
    });

    duplicateBackBtn.addEventListener('click', function() {
        closeDuplicateModal(true);
    });

    duplicateModalCloseBtn.addEventListener('click', requestCloseDuplicateModal);

    duplicateModal.addEventListener('click', function(e) {
        if (e.target === this) requestCloseDuplicateModal();
    });

    duplicateCreateBtn.addEventListener('click', function() {
        const payload = readAddFormPayload();
        const data = {
            full_name: payload.full_name,
            phone: payload.phone,
            client_type: payload.client_type_key || 'organizer',
            agency_id: payload.agency_id || '',
            telegram: payload.telegram,
            email: payload.email,
            instagram: document.getElementById('addInstagram').value.trim(),
            city_names: (payload.cities || []).join(','),
            comment: payload.comment,
            rating: payload.rating_key || 'medium',
            force_create: '1'
        };

        if (!validateAddPayload(data, 'add')) {
            closeDuplicateModal(true);
            return;
        }

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

            if (body.error) {
                showToast(body.error);
                return;
            }

            if (!body.success) return;

            showToast(`Клиент "${body.client.full_name}" успешно добавлен`);

            requestAliasesSave(addAliasField, data.agency_id, data.client_type).finally(function() {
                closeDuplicateModal(false);
                closeAddModal();
                setTimeout(() => location.reload(), 500);
            });
        })
        .catch(error => {
            showToast('Ошибка при добавлении клиента');
            console.error(error);
        });
    });

    tableBody.addEventListener('click', function(e) {
        if (e.target.closest('a[href^="https://t.me/"]')) return;

        const row = e.target.closest('tr[data-client-id]');
        if (row) {
            const id = parseInt(row.getAttribute('data-client-id'));
            openClientModal(id);
        }
    });

    tableBody.addEventListener('contextmenu', function(e) {
        if (e.target.closest('a[href^="https://t.me/"]')) return;

        const row = e.target.closest('tr[data-client-id]');
        if (!row) return;

        e.preventDefault();
        const id = parseInt(row.getAttribute('data-client-id'));
        openClientModal(id, { edit: true });
    });

    const CLIENTS_PAGE = 50;

    const clientsLoadMore = document.getElementById('clientsLoadMore');
    const clientsLoadMoreBtn = document.getElementById('clientsLoadMoreBtn');
    const agencySortBtn = document.getElementById('agencySortBtn');
    const agencySortIndicator = document.getElementById('agencySortIndicator');
    const requestsSortBtn = document.getElementById('requestsSortBtn');
    const requestsSortIndicator = document.getElementById('requestsSortIndicator');
    const ordersSortBtn = document.getElementById('ordersSortBtn');
    const ordersSortIndicator = document.getElementById('ordersSortIndicator');
    let clientsSort = new URLSearchParams(window.location.search).get('sort') || '';
    let clientsOffset = document.querySelectorAll('#clientsTableBody tr[data-client-id]').length;

    function renderClientsSortState() {
        [
            ['agency', agencySortBtn, agencySortIndicator],
            ['requests', requestsSortBtn, requestsSortIndicator],
            ['orders', ordersSortBtn, ordersSortIndicator],
        ].forEach(function(entry) {
            const active = clientsSort === entry[0];

            if (entry[1]) {
                entry[1].classList.toggle('clients-table__sortable--active', active);
                entry[1].setAttribute('aria-sort', active ? 'descending' : 'none');
            }

            if (entry[2]) {
                entry[2].textContent = active ? '↓' : '';
            }
        });
    }

    function bindSortButton(button, key) {
        if (!button) return;

        const toggle = function() {
            clientsSort = clientsSort === key ? '' : key;
            renderClientsSortState();
            loadClientsLive();
        };

        button.addEventListener('click', toggle);
        button.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
    }

    bindSortButton(agencySortBtn, 'agency');
    bindSortButton(requestsSortBtn, 'requests');
    bindSortButton(ordersSortBtn, 'orders');

    renderClientsSortState();

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
        if (clientsSort) params.append('sort', clientsSort);
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
                                <td colspan="9" class="load-more__empty">Клиенты не найдены</td>
                            </tr>
                        `;
                    } else {
                        tableBody.innerHTML = numberedRows(rows);
                    }
                } else if (rows.length) {
                    tableBody.insertAdjacentHTML('beforeend', numberedRows(rows));
                }

                updateRowNumbers();
                clientsOffset += rows.length;

                if (clientsLoadMore) {
                    clientsLoadMore.classList.toggle('load-more--done', !data.has_more);
                }

                const filterParams = new URLSearchParams();

                if (search) filterParams.append('search', search);
                if (rating && rating !== 'all') filterParams.append('rating', rating);
                if (city && city !== 'all') filterParams.append('city', city);
                if (clientsSort) filterParams.append('sort', clientsSort);

                const url = filterParams.toString() ? `/clients/?${filterParams.toString()}` : '/clients/';
                window.history.replaceState({}, '', url);
            })
            .catch(error => {
                tableBody.style.opacity = '';

                if (clientsLoadMoreBtn) clientsLoadMoreBtn.disabled = false;

                console.error(error);
            });
    }

    function numberedRows(rows) {
        return rows.map(function(client, index) {
            return clientRow(client, clientsOffset + index + 1);
        }).join('');
    }

    function updateRowNumbers() {
        tableBody.querySelectorAll('tr[data-client-id]').forEach(function(row, index) {
            const cell = row.querySelector('.clients-table__index');

            if (cell) cell.textContent = String(index + 1);
        });
    }

    function agencyAliasesTitle(client) {
        const aliases = Array.isArray(client.agency_aliases) ? client.agency_aliases.filter(Boolean) : [];

        if (!aliases.length) return '';

        return ' title="' + escapeHtml('Вариации: ' + aliases.join(', ')) + '"';
    }

    function clientRow(client, index) {
        const telegram = (client.telegram || '').replace(/^@/, '');
        const telegramHtml = telegram
            ? `<a href="https://t.me/${encodeURIComponent(telegram)}" target="_blank" rel="noopener">@${escapeHtml(telegram)}</a>`
            : '—';

        return `
            <tr data-client-id="${client.id}" class="clients-table__row--${escapeHtml(client.rating || 'medium')}">
                <td class="clients-table__index">${index}</td>
                <td class="clients-table__name">${escapeHtml(client.full_name)}</td>
                <td class="clients-table__phone">${escapeHtml(client.phone || '—')}</td>
                <td class="clients-table__telegram">${telegramHtml}</td>
                <td class="clients-table__agency"${agencyAliasesTitle(client)}>${escapeHtml(client.agency || '—')}</td>
                <td class="clients-table__cities" title="${escapeHtml(client.city || '')}">${escapeHtml(client.city || '—')}</td>
                <td class="clients-table__num" data-label="Запросы">${client.requests_count || 0}</td>
                <td class="clients-table__num" data-label="Заказы">${client.orders_count || 0}</td>
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

    function mountCityFilterPicker() {
        const input = document.getElementById('cityFilterSearch');
        const hidden = document.getElementById('cityFilter');
        const dropdown = document.getElementById('cityFilterDropdown');

        if (!input || !hidden || !dropdown || input.dataset.mounted === '1') return;

        input.dataset.mounted = '1';

        let items = [];
        let index = -1;
        let timer = null;
        let counter = 0;

        function positionDropdown() {
            const rect = input.getBoundingClientRect();
            const available = window.innerHeight - rect.bottom - 12;
            const height = Math.max(140, Math.min(280, available));

            dropdown.style.position = 'fixed';
            dropdown.style.left = rect.left + 'px';
            dropdown.style.top = (rect.bottom + 6) + 'px';
            dropdown.style.width = rect.width + 'px';
            dropdown.style.minWidth = rect.width + 'px';
            dropdown.style.maxHeight = height + 'px';
            dropdown.style.zIndex = '3000';
        }

        function close() {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            index = -1;
        }

        function pick(id, name) {
            hidden.value = id ? String(id) : 'all';
            input.value = name || '';
            close();
            loadClientsLive();
        }

        function render() {
            const options = [{ id: '', name: 'Все города' }].concat(items);

            dropdown.innerHTML = options.map(function(item, position) {
                const active = position === index ? ' active' : '';

                return `<button type="button" class="city-selector__option${active}" data-city-id="${item.id}" data-city-name="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>`;
            }).join('');

            positionDropdown();
            dropdown.classList.add('open');

            dropdown.querySelectorAll('[data-city-id]').forEach(function(button) {
                button.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    pick(this.dataset.cityId, this.dataset.cityName);
                });
            });
        }

        function load() {
            const currentRequest = ++counter;

            fetch('/cities/list/')
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (currentRequest !== counter) return;

                    const all = (data.cities || []).map(function(item) {
                        return { id: item.id, name: item.name };
                    });

                    const query = input.value.trim().toLowerCase().replace('ё', 'е');

                    items = query
                        ? all.filter(function(item) {
                            return item.name.toLowerCase().replace('ё', 'е').includes(query);
                        })
                        : all;

                    index = -1;
                    render();
                })
                .catch(function(error) { console.error(error); });
        }

        input.addEventListener('focus', function() {
            clearTimeout(timer);
            timer = setTimeout(load, 60);
        });

        input.addEventListener('input', function() {
            if (!this.value.trim()) {
                hidden.value = 'all';
            }

            clearTimeout(timer);
            timer = setTimeout(load, 150);
        });

        input.addEventListener('keydown', function(e) {
            const options = dropdown.querySelectorAll('.city-selector__option');

            if (e.key === 'ArrowDown' && options.length) {
                e.preventDefault();
                index = (index + 1) % options.length;
                options.forEach(function(option, position) {
                    option.classList.toggle('active', position === index);
                });
            } else if (e.key === 'ArrowUp' && options.length) {
                e.preventDefault();
                index = index <= 0 ? options.length - 1 : index - 1;
                options.forEach(function(option, position) {
                    option.classList.toggle('active', position === index);
                });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const active = options[index >= 0 ? index : 0];
                if (active) pick(active.dataset.cityId, active.dataset.cityName);
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                close();
            }
        });

        document.addEventListener('click', function(e) {
            const box = document.getElementById('cityFilterBox');

            if (box && !box.contains(e.target) && !dropdown.contains(e.target)) close();
        });

        window.addEventListener('resize', function() {
            if (dropdown.classList.contains('open')) positionDropdown();
        });

        window.addEventListener('scroll', function() {
            if (dropdown.classList.contains('open')) positionDropdown();
        }, true);

        if (hidden && hidden.value && hidden.value !== 'all') {
            const preset = document.querySelector('#cityFilter option[value="' + hidden.value + '"]');
            input.value = preset ? preset.textContent : '';
        }
    }

    let searchTimeout;

    const searchBox = searchInput ? searchInput.closest('.search-box') : null;
    const searchClearBtn = document.getElementById('searchClearBtn');

    function syncSearchClear() {
        if (!searchBox) return;

        searchBox.classList.toggle('search-box--filled', !!searchInput.value.trim());
    }

    syncSearchClear();

    searchInput.addEventListener('input', function() {
        syncSearchClear();
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadClientsLive, 400);
    });

    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', function() {
            searchInput.value = '';
            syncSearchClear();
            clearTimeout(searchTimeout);
            loadClientsLive(true);
            searchInput.focus();
        });
    }

    function isFormDirty(form) {
        if (!form) return false;

        const fields = form.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]), textarea, select');

        for (const field of fields) {
            const value = (field.value || '').trim();

            if (!value) continue;

            if (field.type === 'tel') {
                const digits = value.replace(/\D/g, '');
                if (digits.length > 1) return true;
                continue;
            }

            if (field.tagName === 'SELECT') continue;

            return true;
        }

        if (addCitySelector && addCitySelector.getValues().length) return true;

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
        closeModal();
    }

    function requestCloseDuplicateModal() {
        closeDuplicateModal(true);
    }

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (e.defaultPrevented) return;
        if (window.UI.isConfirmOpen()) return;

        const openDropdowns = document.querySelectorAll('.city-selector__dropdown.open');

        if (!openDropdowns.length) return;

        e.preventDefault();
        openDropdowns.forEach(dropdown => dropdown.classList.remove('open'));
    }, false);

    if (duplicateModal) window.UI.registerModal(duplicateModal, requestCloseDuplicateModal);
    if (modal) window.UI.registerModal(modal, requestCloseClientModal);
    if (addModal) window.UI.registerModal(addModal, requestCloseAddModal);

    const openClientParam = new URLSearchParams(window.location.search).get('open_client');

    if (openClientParam && /^\d+$/.test(openClientParam)) {
        window.history.replaceState({}, '', window.location.pathname);

        if (typeof openClientModal === 'function') {
            openClientModal(parseInt(openClientParam, 10));
        }
    }

    function escapeHtml(text) {
        if (!text && text !== 0) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    mountCityFilterPicker();
})();