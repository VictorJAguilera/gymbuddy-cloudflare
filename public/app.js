/* Loader con overlay (diagnóstico visible sin consola) */
(function () {
  function overlay(msg) {
    try {
      var box = document.getElementById('__gb_overlay__');
      if (!box) {
        box = document.createElement('div');
        box.id = '__gb_overlay__';
        box.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#231;color:#FAE750;padding:10px 12px;font:14px/1.4 system-ui;white-space:pre-wrap;border-bottom:1px solid #553;';
        document.body.appendChild(box);
      }
      box.textContent = msg;
    } catch (_) {}
  }
  // Exponer overlay por si el core quiere escribir algo
  window.__gb_overlay = overlay;

  function loadCore() {
    var CORE_ID = '__gb_core_fix9';          // cambia si vuelves a probar
    var url = '/app.main.js?v=fix9';         // cache-buster; cambia si subes cambios

    overlay('Loader: descargando ' + url);

    fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' al descargar app.main.js');
        return res.text();
      })
      .then(function (code) {
        var s = document.createElement('script');
        s.id = CORE_ID;
        s.type = 'text/javascript';
        s.text = 'try{window.__GB_CORE_INJECTED__=true;window.__gb_overlay&&__gb_overlay("Core: evaluando");}catch(e){};\n'
               + code + '\n//# sourceURL=' + location.origin + '/app.main.js';
        s.onerror = function (e) { overlay('Loader: error al evaluar core: ' + (e && e.message)); };
        document.head.appendChild(s);
        overlay('Loader: core inyectado (' + CORE_ID + ')');
      })
      .catch(function (err) { overlay('Loader: fallo al descargar core — ' + (err && err.message)); });
  }

  window.addEventListener('error', function (e) {
    overlay('JS error: ' + (e && (e.message || (e.filename + ':' + e.lineno))));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    overlay('Promise rejection: ' + (r && (r.message || String(r))));
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadCore);
  else loadCore();
})();
