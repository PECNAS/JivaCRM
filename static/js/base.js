(function() {
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
      if (window.innerWidth <= 768) {
        setMenuOpen(false);
      }
    });
  });

  syncNavbarHeight();
  window.addEventListener('resize', syncNavbarHeight);
  window.addEventListener('load', syncNavbarHeight);

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
