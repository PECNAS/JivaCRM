(function() {
  const actionButtons = document.querySelectorAll('.action-btn');
  actionButtons.forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      const action = this.getAttribute('data-action') || 'действие';
      const message = 'Выполняется: ' + action.replace(/-/g, ' ');
      showTemporaryToast(message);
    });
  });

  function showTemporaryToast(text) {
    const existing = document.querySelector('.toast-notification');
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = text;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '2rem',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#1a1714',
      color: '#f0ece4',
      padding: '0.75rem 1.8rem',
      borderRadius: '60px',
      border: '1px solid #f0a868',
      boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
      fontSize: '0.95rem',
      fontWeight: '500',
      zIndex: '999',
      opacity: '0',
      transition: 'opacity 0.25s ease, transform 0.2s ease',
      maxWidth: '90%',
      textAlign: 'center',
      pointerEvents: 'none',
      backdropFilter: 'blur(4px)',
      fontFamily: "'Inter', sans-serif"
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(10px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, 2200);
  }
})();