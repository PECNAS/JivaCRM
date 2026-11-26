(function() {
    'use strict';

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function getCSRFToken() {
        const match = document.cookie.match(/(^|; )csrftoken=([^;]+)/);

        if (match) return match[2];

        return window.__csrfToken || '';
    }

    function getToastContainer() {
        const existingContainer = document.getElementById('toastContainer');

        if (existingContainer) return existingContainer;

        const container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);

        return container;
    }

    function showToast(message) {
        if (!message) return;

        const container = getToastContainer();

        document.querySelectorAll('.toast').forEach(existing => {
            if (existing.textContent === String(message)) existing.remove();
        });

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = String(message);
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, 2600);
    }

    function setButtonBusy(button, isBusy, busyLabel) {
        if (!button) return;

        if (isBusy) {
            if (button.dataset.originalHtml === undefined) {
                button.dataset.originalHtml = button.innerHTML;
            }

            button.disabled = true;
            button.classList.add('btn--busy');

            if (busyLabel) {
                button.innerHTML = '<span class="btn-spinner"></span>' + escapeHtml(busyLabel);
            } else if (!button.querySelector('.btn-spinner')) {
                button.innerHTML = '<span class="btn-spinner"></span>' + button.dataset.originalHtml;
            }
        } else {
            button.disabled = false;
            button.classList.remove('btn--busy');

            if (button.dataset.originalHtml !== undefined) {
                button.innerHTML = button.dataset.originalHtml;
                delete button.dataset.originalHtml;
            }
        }
    }

    function setFormBusy(form, isBusy) {
        if (!form) return;

        form.classList.toggle('form--busy', isBusy);

        form.querySelectorAll('input, select, textarea, button').forEach(field => {
            if (isBusy) {
                if (field.dataset.wasDisabled === undefined) {
                    field.dataset.wasDisabled = field.disabled ? '1' : '0';
                }

                field.disabled = true;
            } else if (field.dataset.wasDisabled !== undefined) {
                field.disabled = field.dataset.wasDisabled === '1';
                delete field.dataset.wasDisabled;
            }
        });
    }

    function withButtonBusy(button, task, busyLabel) {
        if (button && button.dataset.busy === '1') {
            return Promise.resolve(null);
        }

        if (button) {
            button.dataset.busy = '1';
            setButtonBusy(button, true, busyLabel);
        }

        const release = function() {
            if (button) {
                delete button.dataset.busy;
                setButtonBusy(button, false);
            }
        };

        let result;

        try {
            result = task();
        } catch (error) {
            release();
            throw error;
        }

        if (result && typeof result.then === 'function') {
            return result.finally(release);
        }

        release();
        return Promise.resolve(result);
    }

    let confirmModal = null;
    let confirmResolve = null;
    let lastFocused = null;

    function buildConfirmModal() {
        if (confirmModal) return confirmModal;

        confirmModal = document.createElement('div');
        confirmModal.className = 'modal-overlay ui-confirm';
        confirmModal.id = 'uiConfirmModal';
        confirmModal.innerHTML = `
            <div class="modal modal--confirm">
                <div class="modal__header">
                    <h2 class="modal__title" data-confirm-title>Подтверждение</h2>
                    <button type="button" class="modal__close modal__close--sm" data-confirm-close>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal__body modal__body--confirm">
                    <div class="confirm-row">
                        <div class="form-actions__left" data-confirm-check-slot hidden>
                            <label class="confirm-check" data-confirm-check>
                                <input type="checkbox" data-confirm-checkbox>
                                <span data-confirm-check-label></span>
                            </label>
                        </div>
                        <p class="confirm-text" data-confirm-text></p>
                    </div>
                    <div class="form-actions form-actions--confirm">
                        <div class="form-actions__right">
                            <button type="button" class="btn btn-outline" data-confirm-cancel>Отмена</button>
                            <button type="button" class="btn btn-primary" data-confirm-ok>Подтвердить</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        confirmModal.querySelector('[data-confirm-ok]').addEventListener('click', () => settleWithCheck(true));
        confirmModal.querySelector('[data-confirm-cancel]').addEventListener('click', () => settle(false));
        confirmModal.querySelector('[data-confirm-close]').addEventListener('click', () => settle(false));

        confirmModal.addEventListener('click', function(e) {
            if (e.target === confirmModal) settle(false);
        });

        const escapeHandler = function(e) {
            if (e.key !== 'Escape') return;
            if (!confirmModal.classList.contains('active')) return;

            e.preventDefault();
            e.stopImmediatePropagation();
            settle(false);
        };

        document.addEventListener('keydown', escapeHandler, true);

        confirmModal.__escapeHandler = escapeHandler;

        return confirmModal;
    }

    function settle(value) {
        if (!confirmModal || !confirmModal.classList.contains('active')) return;

        confirmModal.classList.remove('active');
        confirmModal.style.zIndex = '';

        const resolve = confirmResolve;
        confirmResolve = null;

        if (lastFocused && typeof lastFocused.focus === 'function') {
            try { lastFocused.focus(); } catch (error) {}
        }

        if (resolve) resolve(value);
    }

    function settleWithCheck(value) {
        if (!confirmModal || !confirmModal.classList.contains('active')) return;

        const checkSlot = confirmModal.querySelector('[data-confirm-check-slot]');
        const checkbox = confirmModal.querySelector('[data-confirm-checkbox]');
        const checked = !!(checkSlot && !checkSlot.hidden && checkbox && checkbox.checked);
        const wantsCheck = !!(checkSlot && !checkSlot.hidden && checkbox);

        confirmModal.classList.remove('active');
        confirmModal.style.zIndex = '';

        const resolve = confirmResolve;
        confirmResolve = null;

        if (lastFocused && typeof lastFocused.focus === 'function') {
            try { lastFocused.focus(); } catch (error) {}
        }

        if (resolve) resolve(wantsCheck ? { checked: checked } : value);
    }

    function uiConfirm(options) {
        const settings = typeof options === 'string' ? { text: options } : (options || {});
        const modal = buildConfirmModal();

        modal.querySelector('[data-confirm-title]').textContent = settings.title || 'Подтверждение';
        const confirmText = modal.querySelector('[data-confirm-text]');
        confirmText.textContent = settings.text || (settings.checkLabel ? '' : 'Вы уверены?');
        confirmText.hidden = !confirmText.textContent;

        const okBtn = modal.querySelector('[data-confirm-ok]');
        okBtn.textContent = settings.okText || 'Подтвердить';
        okBtn.className = 'btn ' + (settings.danger ? 'btn-danger' : 'btn-primary');

        modal.querySelector('[data-confirm-cancel]').textContent = settings.cancelText || 'Отмена';

        const checkSlot = modal.querySelector('[data-confirm-check-slot]');
        const checkbox = modal.querySelector('[data-confirm-checkbox]');

        if (settings.checkLabel) {
            checkSlot.hidden = false;
            checkbox.checked = !!settings.checkDefault;
            modal.querySelector('[data-confirm-check-label]').textContent = settings.checkLabel;
        } else {
            checkSlot.hidden = true;
            checkbox.checked = false;
        }

        lastFocused = document.activeElement;
        modal.style.zIndex = '6000';
        modal.classList.add('active');

        setTimeout(() => okBtn.focus(), 50);

        return new Promise(resolve => {
            confirmResolve = resolve;
        });
    }

    uiConfirm.cancel = function() {
        settle(false);
    };

    const PHONE_MASK = '+7 (###) ###-##-##';

    function subscriberDigits(value) {
        const text = String(value || '').trim();
        let digits = text.replace(/\D/g, '');

        if (!digits) {
            return '';
        }

        if (digits.length > 10) {
            digits = digits.slice(-10);
        }

        return digits.slice(0, 10);
    }

    function formatPhone(value) {
        const digits = subscriberDigits(value);

        if (!digits) {
            return '';
        }

        let result = '';
        let index = 0;

        for (const char of PHONE_MASK) {
            if (char === '#') {
                if (index >= digits.length) {
                    break;
                }

                result += digits[index];
                index += 1;
            } else {
                result += char;
            }
        }

        return result;
    }

    function setPhoneValue(input, value) {
        if (!input) return;

        const digits = subscriberDigits(value);

        input.dataset.phoneDigits = digits;
        input.dataset.phoneRaw = digits;
        input.value = digits ? formatPhone(digits) : '';
    }

    function attachPhoneMask(input) {
        if (!input || input.dataset.phoneMask === '1') {
            return;
        }

        input.dataset.phoneMask = '1';
        input.setAttribute('type', 'tel');
        input.setAttribute('inputmode', 'tel');
        input.setAttribute('autocomplete', 'tel');
        input.setAttribute('maxlength', '30');

        function commit(digits) {
            input.dataset.phoneDigits = digits;
            input.dataset.phoneRaw = digits;
        }

        input.addEventListener('input', function() {
            commit(input.value.replace(/\D/g, ''));
        });

        input.addEventListener('paste', function() {
            setTimeout(function() {
                commit(input.value.replace(/\D/g, ''));
            }, 0);
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                input.blur();
            }
        });

        input.addEventListener('blur', function() {
            const digits = subscriberDigits(input.value);

            commit(digits);
            input.value = digits ? formatPhone(digits) : '';
        });

        input.addEventListener('focus', function() {
            if (!input.value) return;

            if (input.dataset.phoneDigits) {
                input.value = String(input.dataset.phoneDigits).replace(/\D/g, '');

                try {
                    input.setSelectionRange(input.value.length, input.value.length);
                } catch (error) {}
            }
        });

        if (input.value) {
            const digits = subscriberDigits(input.value);

            commit(digits);
            input.value = digits ? formatPhone(digits) : '';
        }
    }

    function attachAllPhoneMasks(root) {
        const scope = root || document;

        scope.querySelectorAll('input[type="tel"], [data-phone-input]').forEach(attachPhoneMask);
    }

    function isVisible(element) {
        return !!element && element.offsetParent !== null && getComputedStyle(element).visibility !== 'hidden';
    }

    function collectFields(root) {
        if (!root) return [];

        return Array.from(root.querySelectorAll('input, textarea, select')).filter(field => {
            if (field.type === 'hidden' || field.disabled) return false;
            if (field.type === 'checkbox' || field.type === 'radio' || field.type === 'file') return false;
            if (field.hasAttribute('data-ignore-dirty')) return false;
            if (field.dataset.dirtyIgnore === '1') return false;
            return isVisible(field);
        });
    }

    function fieldValue(field) {
        if (field.type === 'tel') {
            const digits = field.value.replace(/\D/g, '');
            return digits.length > 1 ? digits : '';
        }
        return (field.value || '').trim();
    }

    function snapshot(root) {
        const data = {};

        collectFields(root).forEach((field, index) => {
            const key = field.id || field.name || 'field_' + index;
            data[key] = fieldValue(field);
        });

        return data;
    }

    function isDirtyFromSnapshot(root, original) {
        const current = snapshot(root);

        for (const key of Object.keys(current)) {
            if (String(current[key]) !== String(original[key] === undefined ? '' : original[key])) {
                return true;
            }
        }

        return false;
    }

    function isEmptyForm(root) {
        return collectFields(root).every(field => !fieldValue(field));
    }

    function isConfirmOpen() {
        return !!(confirmModal && confirmModal.classList.contains('active'));
    }

    const modalCloseHandlers = new Map();

    function modalId(modal) {
        return modal.id || ('modal_' + Array.prototype.indexOf.call(document.querySelectorAll('.modal-overlay'), modal));
    }

    function registerModal(modal, handler) {
        if (!modal || typeof handler !== 'function') return;

        modalCloseHandlers.set(modalId(modal), { modal: modal, handler: handler });
    }

    function unregisterModal(modal) {
        if (!modal) return;

        modalCloseHandlers.delete(modalId(modal));
    }

    function activeModalStack() {
        const stack = [];

        modalCloseHandlers.forEach(entry => {
            if (!entry.modal.isConnected) return;
            if (!entry.modal.classList.contains('active')) return;
            if (getComputedStyle(entry.modal).display === 'none') return;

            stack.push(entry);
        });

        stack.sort(function(a, b) {
            return (parseInt(getComputedStyle(b.modal).zIndex, 10) || 0)
                - (parseInt(getComputedStyle(a.modal).zIndex, 10) || 0);
        });

        return stack;
    }

    function closeTopModal() {
        if (isConfirmOpen()) {
            settle(false);
            return true;
        }

        const stack = activeModalStack();

        if (!stack.length) return false;

        stack[0].handler();
        return true;
    }

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (e.isComposing) return;
        if (e.defaultPrevented) return;

        if (!closeTopModal()) return;

        e.preventDefault();
    }, false);

    document.addEventListener('DOMContentLoaded', function() {
        attachAllPhoneMasks(document);
    });

    function formatMoney(value, withCurrency) {
        const raw = String(value === undefined || value === null ? 0 : value)
            .replace(/\s/g, '')
            .replace(/\u00a0/g, '')
            .replace(',', '.');

        const number = parseFloat(raw);
        const safe = isFinite(number) ? number : 0;
        const negative = safe < 0;
        const absolute = Math.round(Math.abs(safe));

        const text = (negative && absolute > 0 ? '−' : '') + String(absolute).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

        if (withCurrency === false) return text;

        return text === '0' ? '0₽' : text + '₽';
    }

    window.UI = {
        escapeHtml: escapeHtml,
        getCSRFToken: getCSRFToken,
        showToast: showToast,
        confirm: uiConfirm,
        cancelConfirm: uiConfirm.cancel,
        snapshot: snapshot,
        isDirtyFromSnapshot: isDirtyFromSnapshot,
        isEmptyForm: isEmptyForm,
        isConfirmOpen: isConfirmOpen,
        registerModal: registerModal,
        unregisterModal: unregisterModal,
        formatPhone: formatPhone,
        formatMoney: formatMoney,
        setButtonBusy: setButtonBusy,
        setFormBusy: setFormBusy,
        withButtonBusy: withButtonBusy,
        extractPhoneDigits: subscriberDigits,
        attachPhoneMask: attachPhoneMask,
        attachAllPhoneMasks: attachAllPhoneMasks,
        setPhoneValue: setPhoneValue
    };

    window.formatPhone = formatPhone;
    window.attachPhoneMask = attachPhoneMask;

    window.escapeHtml = escapeHtml;
    window.getCSRFToken = getCSRFToken;
    window.showToast = showToast;
    window.uiConfirm = uiConfirm;
    window.formatMoney = formatMoney;
    window.setButtonBusy = setButtonBusy;
    window.withButtonBusy = withButtonBusy;
})();
