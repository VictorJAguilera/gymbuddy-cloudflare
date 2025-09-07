/* GymBuddy loader con paracaídas (app.js) — inyecta app.main.js y muestra errores en pantalla */
(function () {
  function overlay(title, details) {
    try {
      var box = document.getElementById('__gb_overlay__');
      if (!box) {
        box = document.createElement('div');
        box.id = '__gb_overlay__';
        box.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#231;color:#FAE750;padding:10px 12px;font:14px/1.4 system-ui;white-space:pre-wrap;border-bottom:1px solid #553;';
        document.addEventListener('click', function(){ box.remove(); }, { once:true });
        document.body.appendChild(box);
      }
      box.textContent = (title || 'Error') + (details ? ' — ' + details : '');
    } catch (_) {}
  }

  function loadCore() {
    var url = '/app.main.js?v=final1'; // cambia el sufijo si subes cambios
    fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('No se pudo descargar app.main.js (' + res.status + ')');
        return res.text();
      })
      .then(function (code) {
        // Evita inyectar dos veces el core
        var EXIST = document.getElementById('__gb_core__');
        if (EXIST) return;
        var s = document.createElement('script');
        s.id = '__gb_core__';
        s.type = 'text/javascript';
        s.text = code + '\n//# sourceURL=' + location.origin + '/app.main.js';
        s.onerror = function (e) {
          overlay('Error cargando app.main.js', (e && e.message) || 'desconocido');
        };
        try { document.head.appendChild(s); }
        catch (err) { overlay('Excepción al evaluar app.main.js', err && err.message); }
      })
      .catch(function (err) {
        overlay('Fallo al descargar app.main.js', err && err.message);
      });
  }

  window.addEventListener('error', function (e) {
    overlay('JS error', (e && (e.message || (e.filename + ':' + e.lineno))) || 'desconocido');
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    overlay('Promise rejection', (r && (r.message || String(r))) || 'desconocido');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCore);
  } else {
    loadCore();
  }
})();
