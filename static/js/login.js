(function() {
    const form = document.querySelector('.login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    if (form) {
        form.addEventListener('submit', function(e) {
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                e.preventDefault();
                showError('Пожалуйста, заполните все поля');
                return;
            }

            if (username.length < 3) {
                e.preventDefault();
                showError('Логин должен содержать минимум 3 символа');
                return;
            }
        });
    }

    function showError(message) {
        const existingError = document.querySelector('.form-error');
        if (existingError) {
            existingError.remove();
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'form-error';
        errorDiv.textContent = message;
        
        const formGroup = document.querySelector('.login-form .form-group:last-of-type');
        if (formGroup) {
            formGroup.parentNode.insertBefore(errorDiv, formGroup.nextSibling);
        }

        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 4000);
    }

    usernameInput.addEventListener('input', function() {
        const error = document.querySelector('.form-error');
        if (error && error.textContent.includes('Логин')) {
            error.remove();
        }
    });

    passwordInput.addEventListener('input', function() {
        const error = document.querySelector('.form-error');
        if (error && error.textContent.includes('пароль')) {
            error.remove();
        }
    });
})();