/* DIAGNÓSTICO MINIMAL — NO BORRES HASTA PROBAR */
/* Objetivo: saber si el JS se ejecuta y si #app existe, sin depender de nada más */
(function(){
  function paint(msg, color) {
    var box = document.createElement('div');
    box.style.cssText = 'margin:16px; padding:12px; border:1px solid #444; border-radius:10px; background:#15171A; color:'+ (color||'#FAE750') +'; font: 14px/1.4 system-ui';
    box.innerHTML = msg;
    return box;
  }

  function boot() {
    var app = document.getElementById('app');
    var fab = document.getElementById('fab-add');
    var root = app || document.body;

    // Muestra diagnóstico visible SIN consola
    if (!app) {
      root.appendChild(paint('❌ No existe <code>#app</code> en el HTML', '#FF5C5C'));
    } else {
      app.innerHTML = '';
      app.appendChild(paint('✅ JS OK — DOMContentLoaded y encontrado <code>#app</code>'));
      var testCard = document.createElement('div');
      testCard.className = 'card';
      testCard.style.margin = '16px';
      testCard.innerHTML = '<h3>HOME de prueba</h3><p style="color:#A5ADBB">Si ves esto, el JS se está ejecutando bien.</p>';
      app.appendChild(testCard);
    }

    if (fab) {
      fab.addEventListener('click', function(){
        alert('FAB OK — el JS está enganchado');
      });
    } else {
      root.appendChild(paint('⚠️ No se encontró el botón FAB (#fab-add).', '#FFF489'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
