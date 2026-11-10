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
                    <button type="button" class="modal__close" data-confirm-close>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal__body">
                    <p class="confirm-text" data-confirm-text></p>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" data-confirm-cancel>Отмена</button>
                        <button type="button" class="btn btn-primary" data-confirm-ok>Подтвердить</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        confirmModal.querySelector('[data-confirm-ok]').addEventListener('click', () => settle(true));
        confirmModal.querySelector('[data-confirm-cancel]').addEventListener('click', () => settle(false));
        confirmModal.querySelector('[data-confirm-close]').addEventListener('click', () => settle(false));

        confirmModal.addEventListener('click', function(e) {
            if (e.target === confirmModal) settle(false);
        });

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

    function uiConfirm(options) {
        const settings = typeof options === 'string' ? { text: options } : (options || {});
        const modal = buildConfirmModal();

        modal.querySelector('[data-confirm-title]').textContent = settings.title || 'Подтверждение';
        modal.querySelector('[data-confirm-text]').textContent = settings.text || 'Вы уверены?';

        const okBtn = modal.querySelector('[data-confirm-ok]');
        okBtn.textContent = settings.okText || 'Подтвердить';
        okBtn.className = 'btn ' + (settings.danger ? 'btn-danger' : 'btn-primary');

        modal.querySelector('[data-confirm-cancel]').textContent = settings.cancelText || 'Отмена';

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
    const PHONE_EMPTY = '+7 (';

    function subscriberDigits(value) {
        const text = String(value || '').trim();
        let digits = text.replace(/\D/g, '');

        const hasPrefix = text.startsWith('+7') || text.startsWith('7') || text.startsWith('8');

        if (hasPrefix && digits.length > 0) {
            digits = digits.slice(1);
        } else if (digits.length === 11) {
            digits = digits.slice(1);
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

    function caretForDigits(count) {
        const total = Math.max(0, Math.min(count, 10));

        if (total === 0) {
            return PHONE_EMPTY.length;
        }

        return formatPhone('7' + '9'.repeat(total)).length;
    }

    function setPhoneValue(input, value) {
        if (!input) return;

        const digits = subscriberDigits(value);

        input.dataset.phoneDigits = digits;
        input.value = digits ? formatPhone(digits) : '';
    }

    function attachPhoneMask(input) {
        if (!input || input.dataset.phoneMask === '1') {
            return;
        }

        input.dataset.phoneMask = '1';
        input.setAttribute('type', 'tel');
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('autocomplete', 'tel');
        input.setAttribute('maxlength', '18');

        function caretPosition(digitsBefore) {
            const total = Math.max(0, Math.min(digitsBefore, 10));

            if (total === 0) {
                return PHONE_EMPTY.length;
            }

            return formatPhone('7' + '9'.repeat(total)).length;
        }

        function applyDigits(digits, digitsBefore) {
            const limited = digits.slice(0, 10);

            input.dataset.phoneDigits = limited;
            input.value = limited ? formatPhone(limited) : '';

            if (!limited) {
                return;
            }

            const position = caretPosition(Math.min(digitsBefore, limited.length));

            try {
                input.setSelectionRange(position, position);
            } catch (error) {}
        }

        input.addEventListener('keydown', function(e) {
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            if (e.key === 'Backspace') {
                const caretStart = input.selectionStart || 0;
                const caretEnd = input.selectionEnd || 0;

                if (caretStart !== caretEnd) {
                    return;
                }

                const value = input.value;
                const charBefore = value.slice(0, caretStart).slice(-1);

                if (!charBefore) {
                    return;
                }

                if (/\d/.test(charBefore)) {
                    const digits = subscriberDigits(value.slice(0, caretStart));
                    const rest = subscriberDigits(value.slice(caretStart));
                    const next = (digits.slice(0, -1) + rest).slice(0, 10);

                    if (!next) {
                        e.preventDefault();
                        input.value = '';
                        input.dataset.phoneDigits = '';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        return;
                    }

                    e.preventDefault();
                    applyDigits(next, digits.length - 1);
                    return;
                }

                e.preventDefault();

                const digits = subscriberDigits(value);
                const digitsBefore = subscriberDigits(value.slice(0, caretStart)).length;
                const next = digits.slice(0, Math.max(digitsBefore - 1, 0)) + digits.slice(digitsBefore);

                applyDigits(next, Math.max(digitsBefore - 1, 0));
                return;
            }

            if (e.key === 'Delete') {
                const caretStart = input.selectionStart || 0;
                const caretEnd = input.selectionEnd || 0;

                if (caretStart !== caretEnd) {
                    return;
                }

                const value = input.value;
                const charAfter = value.slice(caretStart).slice(0, 1);

                if (!charAfter) {
                    return;
                }

                e.preventDefault();

                const digits = subscriberDigits(value);
                const digitsBefore = subscriberDigits(value.slice(0, caretStart)).length;
                const next = digits.slice(0, digitsBefore) + digits.slice(digitsBefore + 1);

                applyDigits(next, digitsBefore);
                return;
            }

            const allowed = [
                'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight',
                'ArrowUp', 'ArrowDown', 'Home', 'End',
            ];

            if (allowed.indexOf(e.key) >= 0) return;

            if (!/^\d$/.test(e.key)) {
                e.preventDefault();
            }
        });

        input.addEventListener('input', function() {
            const caret = input.selectionStart || 0;
            const digitsBefore = subscriberDigits(input.value.slice(0, caret)).length;
            const digits = subscriberDigits(input.value);

            input.dataset.phoneDigits = digits;
            input.value = digits ? formatPhone(digits) : '';

            if (!input.value) {
                return;
            }

            const position = caretPosition(Math.min(digitsBefore, digits.length));

            try {
                input.setSelectionRange(position, position);
            } catch (error) {}
        });

        input.addEventListener('paste', function(e) {
            const clipboard = e.clipboardData || window.clipboardData;

            if (!clipboard) return;

            const text = clipboard.getData('text');

            if (!text) return;

            e.preventDefault();

            const digits = subscriberDigits(text);

            applyDigits(digits, digits.length);
        });

        input.addEventListener('focus', function() {
            if (!input.value) {
                input.value = PHONE_EMPTY;

                try {
                    input.setSelectionRange(PHONE_EMPTY.length, PHONE_EMPTY.length);
                } catch (error) {}
            }
        });

        input.addEventListener('blur', function() {
            const digits = subscriberDigits(input.value);

            input.dataset.phoneDigits = digits;
            input.value = digits ? formatPhone(digits) : '';
        });

        if (input.value) {
            const digits = subscriberDigits(input.value);

            input.dataset.phoneDigits = digits;
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
        const absolute = Math.abs(safe);

        const parts = absolute.toFixed(2).split('.');
        const grouped = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        const text = (negative ? '−' : '') + grouped + '.' + parts[1];

        return withCurrency === false ? text : text + '₽';
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
