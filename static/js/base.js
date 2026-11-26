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

  function applySidebarScroll() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const limit = 140;
    const offset = Math.min(scrollY * 0.06, 8);

    document.querySelectorAll('.js-sidebar').forEach(function(node) {
      node.style.transform = scrollY > 0 ? 'translateY(' + offset.toFixed(2) + 'px)' : '';

      if (scrollY > limit) {
        node.classList.add('js-sidebar--scrolled');
      } else {
        node.classList.remove('js-sidebar--scrolled');
      }
    });
  }

  let sidebarFrame = null;

  window.addEventListener('scroll', function() {
    if (sidebarFrame) return;

    sidebarFrame = window.requestAnimationFrame(function() {
      sidebarFrame = null;
      applySidebarScroll();
    });
  }, { passive: true });

  window.addEventListener('DOMContentLoaded', applySidebarScroll);

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

  const tasksBadge = document.getElementById('tasksNavBadge');

  if (tasksBadge) {
    fetch('/tasks/badge/', { headers: { 'X-Requested-With': 'XMLHttpRequest' }, cache: 'no-store' })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        const count = Number(data.count) || 0;

        tasksBadge.hidden = count <= 0;
        tasksBadge.textContent = count > 99 ? '99+' : String(count);
      })
      .catch(function() {});
  }

  const snowfallBox = document.getElementById('snowfall');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (snowfallBox && !reduceMotion) {
    const FLAKE_COUNT = 14;

    function makeFlake() {
      const flake = document.createElement('span');

      flake.className = 'snowflake';
      flake.style.left = (Math.random() * 100).toFixed(2) + '%';
      flake.style.setProperty('--size', (3 + Math.random() * 4).toFixed(1) + 'px');
      flake.style.setProperty('--drift', (Math.random() * 80 - 40).toFixed(0) + 'px');
      flake.style.setProperty('--fall', (18 + Math.random() * 14).toFixed(1) + 's');
      flake.style.setProperty('--delay', (Math.random() * 18).toFixed(1) + 's');
      flake.style.setProperty('--opacity', (0.25 + Math.random() * 0.45).toFixed(2));

      snowfallBox.appendChild(flake);
    }

    for (let i = 0; i < FLAKE_COUNT; i += 1) {
      makeFlake();
    }

    document.addEventListener('visibilitychange', function() {
      snowfallBox.classList.toggle('snowfall--paused', document.hidden);
    });
  }
})();
