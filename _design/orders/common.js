(function () {
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-toast]');
    if (!el) return;
    e.preventDefault();
    window.oToast(el.getAttribute('data-toast'));
  });
})();
