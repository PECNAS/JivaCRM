(function() {
  const MENU_BREAKPOINT = 1100;
  const MOBILE_BREAKPOINT = 860;

  const menuToggle = document.getElementById('menuToggle');
  const mainMenu = document.getElementById('mainMenu');
  const navbar = document.querySelector('.navbar');
  const tabletMenu = window.matchMedia('(max-width: ' + MENU_BREAKPOINT + 'px)');
  const mobileQuery = window.matchMedia('(max-width: ' + MOBILE_BREAKPOINT + 'px)');

  function placeMenuToggle() {
    if (!menuToggle) return;

    if (isMobile()) {
      if (menuToggle.parentNode !== document.body) {
        document.body.appendChild(menuToggle);
      }

      menuToggle.classList.add('mob-menu-btn');

      if (mainMenu && mainMenu.parentNode !== document.body) {
        document.body.appendChild(mainMenu);
      }

      return;
    }

    menuToggle.classList.remove('mob-menu-btn');

    const actions = document.querySelector('.navbar__actions');

    if (actions && menuToggle.parentNode !== actions) {
      actions.appendChild(menuToggle);
    }

    const slot = document.querySelector('.navbar__menu-slot');

    if (mainMenu && slot && mainMenu.parentNode !== slot) {
      slot.appendChild(mainMenu);
    }
  }

  function isMobile() {
    return mobileQuery.matches;
  }

  function syncNavbarHeight() {
    if (navbar) {
      document.documentElement.style.setProperty('--navbar-height', navbar.offsetHeight + 'px');
    }
  }

  function setMenuOpen(isOpen) {
    if (!menuToggle || !mainMenu) return;

    mainMenu.classList.toggle('open', isOpen);
    menuToggle.classList.toggle('active', isOpen);
    menuToggle.classList.toggle('mob-open', isOpen);
    menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    document.body.classList.toggle('mob-menu-open', isOpen && isMobile());

    if (tabletMenu.matches && !isMobile()) {
      const scrollY = window.scrollY || 0;

      document.body.classList.toggle('menu-open', isOpen);

      if (isOpen) {
        document.body.style.top = '-' + scrollY + 'px';
      } else {
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
      }
    } else {
      document.body.classList.remove('menu-open');
      document.body.style.top = '';
    }
  }

  placeMenuToggle();

  window.addEventListener('DOMContentLoaded', placeMenuToggle);
  window.addEventListener('load', placeMenuToggle);

  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener('change', function() {
      setMenuOpen(false);
      placeMenuToggle();
      syncNavbarHeight();
    });
  } else if (mobileQuery.addListener) {
    mobileQuery.addListener(function() {
      setMenuOpen(false);
      placeMenuToggle();
      syncNavbarHeight();
    });
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
    link.addEventListener('click', function(e) {
      if (!tabletMenu.matches) return;

      const dropdown = link.closest('.menu__item--dropdown');

      if (dropdown && link.classList.contains('menu__link--dropdown')) {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = !dropdown.classList.contains('menu__item--open');

        document.querySelectorAll('.menu__item--open').forEach(function(item) {
          item.classList.remove('menu__item--open');
        });

        dropdown.classList.toggle('menu__item--open', willOpen);
        link.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        return;
      }

      setMenuOpen(false);
    });
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.menu__item--dropdown')) {
      document.querySelectorAll('.menu__item--open').forEach(function(item) {
        item.classList.remove('menu__item--open');
      });
    }
  });

  document.addEventListener('touchstart', function(e) {
    if (e.target.closest('.modal-overlay.active')) return;

    if (mainMenu && mainMenu.classList.contains('open')) {
      if (!mainMenu.contains(e.target) && menuToggle && !menuToggle.contains(e.target)) {
        setMenuOpen(false);
        return;
      }
    }

    const popup = e.target.closest('.menu__item--dropdown');

    if (popup && e.target.closest('.menu__link--dropdown')) {
      e.preventDefault();
      popup.classList.toggle('menu__item--open');
      return;
    }

    document.querySelectorAll('.menu__item--open').forEach(function(item) {
      item.classList.remove('menu__item--open');
    });
  }, { passive: true });

  syncNavbarHeight();
  window.addEventListener('resize', syncNavbarHeight);
  window.addEventListener('load', syncNavbarHeight);

  function syncModalLock() {
    const activeModal = Array.from(document.querySelectorAll('.modal-overlay.active')).length > 0;

    document.body.classList.toggle('modal-lock', activeModal);
  }

  const SCROLLABLE_IN_MODAL = [
    '.modal__body',
    '.modal__footer',
    '.modal__tabs',
    '.m-body',
    '.m-side',
    '.p-body',
    '.tab-content',
    '.js-editor-body',
    '.cof-write__scroll',
    '.cof-preview__body',
    '.cof-preview',
    '.cof__body',
    '#eventModalPreviewBody',
    '#createOrderPreview',
    '.event-modal__footer',
    '.tasks-editor__body',
    '.tasks-editor__dialog',
    '.tasks-main',
    '.tasks-list',
    '.money-list',
    '.client-combobox__dropdown',
    '.city-selector__dropdown',
    '.single-city-picker__dropdown',
    '.document-cards',
    '.emp-docs',
    '[data-modal-scroll]'
  ].join(', ');

  function hasScrollableParent(node) {
    let el = node;

    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      const canScrollY = /(auto|scroll)/.test(style.overflowY);

      if (canScrollY && el.scrollHeight > el.clientHeight + 2) return true;

      el = el.parentElement;
    }

    return false;
  }

  document.addEventListener('touchmove', function(e) {
    if (!document.body.classList.contains('modal-lock')) return;

    const overlay = e.target.closest('.modal-overlay.active');

    if (!overlay) return;

    if (e.target.closest(SCROLLABLE_IN_MODAL)) return;

    if (hasScrollableParent(e.target)) return;

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
  const mobileTasksBadge = document.getElementById('mobTasksBadge');

  function paintBadges(count) {
    [tasksBadge, mobileTasksBadge].forEach(function(node) {
      if (!node) return;

      node.hidden = count <= 0;
      node.textContent = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
    });
  }

  if (tasksBadge || mobileTasksBadge) {
    let wasVisible = false;

    function loadBadge() {
      fetch('/tasks/badge/', { headers: { 'X-Requested-With': 'XMLHttpRequest' }, cache: 'no-store' })
        .then(function(response) { return response.json(); })
        .then(function(data) {
          const count = Number(data.count) || 0;

          wasVisible = count > 0;
          paintBadges(count);
        })
        .catch(function() {});
    }

    loadBadge();

    setInterval(function() {
      if (document.hidden) return;

      loadBadge();
    }, 120000);

    document.addEventListener('visibilitychange', function() {
      if (document.hidden) return;

      loadBadge();
    });

    window.addEventListener('focus', function() {
      loadBadge();
    });

    window.refreshTasksBadge = function(count) {
      paintBadges(Number(count) || 0);
    };

    window.tasksBadgeWasVisible = function() {
      return wasVisible;
    };
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
