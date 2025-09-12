// Loader limpio (producción)
(function () {
  function loadCore() {
    var url = '/app.main.js?v=ui2025-rt3'; // <-- sube este número al desplegar
    fetch(url, { cache: 'no-store' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.text(); })
      .then(function (code) {
        var s = document.createElement('script');
        s.type = 'text/javascript';
        s.text = code + '\n//# sourceURL=' + location.origin + '/app.main.js';
        document.head.appendChild(s);
      })
      .catch(function (err) { console.error('Error cargando core:', err); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadCore);
  else loadCore();
})();
