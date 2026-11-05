(function() {
  const MENU_BREAKPOINT = 1100;

  const menuToggle = document.getElementById('menuToggle');
  const mainMenu = document.getElementById('mainMenu');
  const navbar = document.querySelector('.navbar');

  function syncNavbarHeight() {
    if (navbar) {
      document.documentElement.style.setProperty('--navbar-height', navbar.offsetHeight + 'px');
    }
  }

  function setMenuOpen(isOpen) {
    if (!menuToggle || !mainMenu) return;

    mainMenu.classList.toggle('open', isOpen);
    menuToggle.classList.toggle('active', isOpen);
    menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

    if (window.innerWidth <= MENU_BREAKPOINT) {
      document.body.classList.toggle('menu-open', isOpen);
    } else {
      document.body.classList.remove('menu-open');
    }
  }

  if (menuToggle && mainMenu) {
    menuToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      setMenuOpen(!mainMenu.classList.contains('open'));
    });

    document.addEventListener('click', function(e) {
      if (!mainMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        setMenuOpen(false);
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && mainMenu.classList.contains('open')) {
        setMenuOpen(false);
      }
    });
  }

  document.querySelectorAll('.menu__link').forEach(function(link) {
    link.addEventListener('click', function() {
      if (window.innerWidth <= MENU_BREAKPOINT) {
        setMenuOpen(false);
      }
    });
  });

  document.addEventListener('touchstart', function(e) {
    if (!mainMenu || !mainMenu.classList.contains('open')) return;

    if (mainMenu.contains(e.target) || menuToggle.contains(e.target)) return;

    setMenuOpen(false);
  }, { passive: true });

  syncNavbarHeight();
  window.addEventListener('resize', syncNavbarHeight);
  window.addEventListener('load', syncNavbarHeight);

  function syncModalLock() {
    const activeModal = Array.from(document.querySelectorAll('.modal-overlay.active')).length > 0;

    document.body.classList.toggle('modal-lock', activeModal);
  }

  document.addEventListener('touchmove', function(e) {
    if (!document.body.classList.contains('modal-lock')) return;

    if (e.target.closest('.modal__body, .modal__footer, .money-list, .client-combobox__dropdown')) return;

    e.preventDefault();
  }, { passive: false });

  window.addEventListener('DOMContentLoaded', syncModalLock);
  setInterval(syncModalLock, 400);

  const SEARCH_FIELDS = ['searchInput', 'moneySearchInput'];

  function findSearchField() {
    for (const id of SEARCH_FIELDS) {
      const field = document.getElementById(id);

      if (field && field.offsetParent !== null) {
        return field;
      }
    }

    const visible = Array.from(document.querySelectorAll('input.search-input, input[type="search"]'))
      .filter(field => field.offsetParent !== null);

    return visible.length ? visible[0] : null;
  }

  document.addEventListener('keydown', function(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;

    if (String(e.key).toLowerCase() !== 'f') return;

    const field = findSearchField();

    if (!field) return;

    e.preventDefault();
    field.focus();

    if (typeof field.select === 'function') {
      field.select();
    }
  });
})();
