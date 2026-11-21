(function () {
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-toast]');
    if (!el) return;
    window.toast(el.getAttribute('data-toast'));
  });
})();
