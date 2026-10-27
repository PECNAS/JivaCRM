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
        return match ? match[2] : '';
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
        modal.style.zIndex = '1300';
        modal.classList.add('active');

        setTimeout(() => okBtn.focus(), 50);

        return new Promise(resolve => {
            confirmResolve = resolve;
        });
    }

    uiConfirm.cancel = function() {
        settle(false);
    };

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

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && confirmModal && confirmModal.classList.contains('active')) {
            e.stopPropagation();
            settle(false);
        }
    }, true);

    window.UI = {
        escapeHtml: escapeHtml,
        getCSRFToken: getCSRFToken,
        showToast: showToast,
        confirm: uiConfirm,
        snapshot: snapshot,
        isDirtyFromSnapshot: isDirtyFromSnapshot,
        isEmptyForm: isEmptyForm
    };

    window.escapeHtml = escapeHtml;
    window.getCSRFToken = getCSRFToken;
    window.showToast = showToast;
    window.uiConfirm = uiConfirm;
})();
