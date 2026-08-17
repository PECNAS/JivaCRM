(function() {
  const menuToggle = document.getElementById('menuToggle');
  const mainMenu = document.getElementById('mainMenu');

  if (menuToggle && mainMenu) {
    menuToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      mainMenu.classList.toggle('open');
    });

    document.addEventListener('click', function(e) {
      if (!mainMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        mainMenu.classList.remove('open');
      }
    });
  }

  const navLinks = document.querySelectorAll('.menu__link');
  navLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      navLinks.forEach(function(l) { l.classList.remove('active'); });
      this.classList.add('active');

      if (window.innerWidth <= 768) {
        mainMenu.classList.remove('open');
      }
    });
  });
})();