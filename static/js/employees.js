(function() {
    let currentEmployeeId = null;
    let isEditMode = false;

    const tableBody = document.getElementById('employeesTableBody');
    const searchInput = document.getElementById('searchInput');
    const roleFilter = document.getElementById('roleFilter');
    const modal = document.getElementById('employeeModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const addEmployeeBtn = document.getElementById('addEmployeeBtn');
    const addModal = document.getElementById('addEmployeeModal');
    const addModalCloseBtn = document.getElementById('addModalCloseBtn');
    const addModalCancelBtn = document.getElementById('addModalCancelBtn');
    const addForm = document.getElementById('addEmployeeForm');
    const editForm = document.getElementById('editEmployeeForm');
    const editCancelBtn = document.getElementById('editCancelBtn');
    const editEmployeeBtn = document.getElementById('editEmployeeBtn');
    const deleteEmployeeBtn = document.getElementById('deleteEmployeeBtn');
    const viewMode = document.getElementById('viewMode');
    const editMode = document.getElementById('editMode');

    function getCSRFToken() {
        const cookieValue = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
        return cookieValue ? cookieValue[2] : '';
    }

    function renderEmployees() {
        const search = searchInput.value.trim();
        const role = roleFilter.value;
        
        fetch(`/employees/?search=${encodeURIComponent(search)}&role=${role}`)
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const newBody = doc.querySelector('#employeesTableBody');
                if (newBody) {
                    tableBody.innerHTML = newBody.innerHTML;
                    attachRowEvents();
                }
            })
            .catch(error => {
                console.error('Ошибка загрузки сотрудников:', error);
                showToast('Ошибка загрузки сотрудников');
            });
    }

    function attachRowEvents() {
        tableBody.querySelectorAll('[data-id]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = parseInt(this.getAttribute('data-id'));
                openEmployeeModal(id);
            });
        });

        tableBody.querySelectorAll('tr[data-employee-id]').forEach(row => {
            row.addEventListener('click', function() {
                const id = parseInt(this.getAttribute('data-employee-id'));
                openEmployeeModal(id);
            });
        });
    }

    function openEmployeeModal(employeeId) {
        currentEmployeeId = employeeId;
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        
        fetch(`/employees/${employeeId}/`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }

                document.getElementById('modalEmployeeName').textContent = data.full_name;
                document.getElementById('viewFullName').textContent = data.full_name;
                document.getElementById('viewUsername').textContent = data.username;
                document.getElementById('viewRole').textContent = data.role_name;
                document.getElementById('viewPhone').textContent = data.phone || '—';
                document.getElementById('viewTelegram').textContent = data.telegram || '—';
                document.getElementById('viewStatus').textContent = data.is_active ? 'Активен' : 'Неактивен';
                document.getElementById('viewDateJoined').textContent = data.date_joined || '—';
                document.getElementById('viewLastLogin').textContent = data.last_login || '—';

                document.getElementById('editUsername').value = data.username;
                document.getElementById('editPassword').value = '';
                document.getElementById('editFullName').value = data.full_name;
                document.getElementById('editRole').value = data.role_id;
                document.getElementById('editPhone').value = data.phone || '';
                document.getElementById('editTelegram').value = data.telegram || '';
                document.getElementById('editIsActive').checked = data.is_active;

                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            })
            .catch(error => {
                showToast('Ошибка загрузки данных сотрудника');
                console.error(error);
            });
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentEmployeeId = null;
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        isEditMode = false;
    }

    function openEditMode() {
        isEditMode = true;
        viewMode.style.display = 'none';
        editMode.style.display = 'block';
    }

    function cancelEdit() {
        isEditMode = false;
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
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

    function openAddModal() {
        addModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        addForm.reset();
        document.getElementById('addIsActive').checked = true;
    }

    function closeAddModal() {
        addModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });

    editEmployeeBtn.addEventListener('click', openEditMode);
    editCancelBtn.addEventListener('click', cancelEdit);

    editForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const data = {
            username: document.getElementById('editUsername').value.trim(),
            password: document.getElementById('editPassword').value.trim(),
            full_name: document.getElementById('editFullName').value.trim(),
            role_id: document.getElementById('editRole').value,
            phone: document.getElementById('editPhone').value.trim(),
            telegram: document.getElementById('editTelegram').value.trim(),
            is_active: document.getElementById('editIsActive').checked ? 'on' : 'off'
        };

        if (!data.username || !data.full_name || !data.role_id) {
            showToast('Пожалуйста, заполните обязательные поля');
            return;
        }

        fetch(`/employees/${currentEmployeeId}/update/`, {
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
                showToast('Данные сотрудника успешно обновлены');
                cancelEdit();
                renderEmployees();
                openEmployeeModal(currentEmployeeId);
            }
        })
        .catch(error => {
            showToast('Ошибка при обновлении сотрудника');
            console.error(error);
        });
    });

    deleteEmployeeBtn.addEventListener('click', function() {
        if (confirm('Вы уверены, что хотите удалить этого сотрудника?')) {
            fetch(`/employees/${currentEmployeeId}/delete/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken()
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showToast(data.error);
                    return;
                }
                if (data.success) {
                    showToast('Сотрудник успешно удалён');
                    closeModal();
                    renderEmployees();
                }
            })
            .catch(error => {
                showToast('Ошибка при удалении сотрудника');
                console.error(error);
            });
        }
    });

    addEmployeeBtn.addEventListener('click', openAddModal);
    addModalCloseBtn.addEventListener('click', closeAddModal);
    addModalCancelBtn.addEventListener('click', closeAddModal);
    addModal.addEventListener('click', function(e) {
        if (e.target === this) closeAddModal();
    });

    addForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const data = {
            username: document.getElementById('addUsername').value.trim(),
            password: document.getElementById('addPassword').value.trim(),
            full_name: document.getElementById('addFullName').value.trim(),
            role_id: document.getElementById('addRole').value,
            phone: document.getElementById('addPhone').value.trim(),
            telegram: document.getElementById('addTelegram').value.trim(),
            is_active: document.getElementById('addIsActive').checked ? 'on' : 'off'
        };

        if (!data.username || !data.password || !data.full_name || !data.role_id) {
            showToast('Пожалуйста, заполните обязательные поля');
            return;
        }

        fetch('/employees/', {
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
                showToast(`Сотрудник "${data.employee.full_name}" успешно добавлен`);
                closeAddModal();
                renderEmployees();
            }
        })
        .catch(error => {
            showToast('Ошибка при добавлении сотрудника');
            console.error(error);
        });
    });

    function filterEmployees() {
        const search = searchInput.value.trim();
        const role = roleFilter.value;
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (role && role !== 'all') params.append('role', role);
        window.location.href = `/employees/?${params.toString()}`;
    }

    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filterEmployees, 500);
    });

    roleFilter.addEventListener('change', filterEmployees);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (modal.classList.contains('active')) closeModal();
            if (addModal.classList.contains('active')) closeAddModal();
        }
    });

    attachRowEvents();
})();