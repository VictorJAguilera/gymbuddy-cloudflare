/* GymBuddy core — UI 2025 + Rest entre ejercicios y entre series (cuenta atrás),
   Beep + vibración al terminar, Wake Lock, Nav superior */

if (window.__GB_APP_ALREADY_LOADED__) {
  console.warn('GymBuddy core ya cargado — omito reevaluación');
} else {
  window.__GB_APP_ALREADY_LOADED__ = true;

  /* ---------- Bloqueo de zoom global (pinch/double-tap) ---------- */
  (function(){
    document.addEventListener('touchstart', function(e){
      if (e.touches && e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', function(e){
      e.preventDefault();
    }, { passive: false });
    var lastTouchTime = 0;
    document.addEventListener('touchend', function(e){
      var now = Date.now();
      if (now - lastTouchTime <= 300) e.preventDefault();
      lastTouchTime = now;
    }, { passive: false });
  })();

  /* ---------- Config / Estado ---------- */
  var API = (window.API_BASE || "").replace(/\/+$/, "");
  var Views = { HOME:"home", ROUTINES:"routines", EDIT:"edit", WORKOUT:"workout", MARKS:"marks" };

  var STATE = {
    view: Views.HOME,
    currentRoutineId: null,
    workoutSession: null,
    stopwatchTimer: null,
    // Descanso entre ejercicios (inline)
    rest: { active:false, targetIndex:null, totalMs:0, remainingMs:0, tick:null },
    // Descanso entre series (modal)
    srest: { active:false, totalMs:0, remainingMs:0, tick:null }
  };

  /* ---------- Wake Lock ---------- */
  var wakeLock = null;
  async function requestWakeLock(){
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        if (wakeLock) wakeLock.addEventListener('release', function(){ /* opcional */ });
      }
    } catch(_) {}
  }
  function releaseWakeLock(){
    try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch(_) {}
  }
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible' && STATE.view === Views.WORKOUT) requestWakeLock();
  });

  /* ---------- Refs ---------- */
  var appEl, FAB, modalRoot, modalTitle, modalContent, modalClose;

  /* ---------- Utils ---------- */
  window.__GB_DEBOUNCE_MAP__ = window.__GB_DEBOUNCE_MAP__ || {};
  function debounce(fn, key, wait){ if(wait==null) wait=300; var m=window.__GB_DEBOUNCE_MAP__; if(m[key]) clearTimeout(m[key]); m[key]=setTimeout(fn,wait); }

  // API robusta: soporta 204/Texto/JSON y muestra texto de error del servidor
  function api(path, opts){
    opts = opts || {};
    var h = opts.headers || {};
    if (!('Content-Type' in h) && opts.method && opts.method !== 'GET' && opts.body != null && typeof opts.body === 'object') {
      h["Content-Type"]="application/json";
    }
    var o={}; for(var k in opts) o[k]=opts[k];
    o.headers=h;

    return fetch(API + path, o).then(function(r){
      var ct = r.headers.get('content-type') || '';
      if (!r.ok){
        return r.text().then(function(t){
          var msg = "API " + r.status + (t ? (" — " + t.slice(0,140)) : "");
          throw new Error(msg);
        });
      }
      if (r.status === 204) return null;
      if (ct.indexOf('application/json') !== -1) return r.json();
      return r.text().then(function(t){ return t || null; });
    });
  }

  // fetchRaw para probing sin imponer JSON por defecto
  function fetchRaw(path, opts){
    opts = opts || {};
    var url = API + path;
    return fetch(url, opts).then(function(r){
      var allow = r.headers.get('Allow') || r.headers.get('allow') || '';
      return r.text().then(function(t){
        return { url:url, status:r.status, ok:r.ok, allow:allow, body:(t||'') };
      });
    }).catch(function(err){
      return { url:url, status:0, ok:false, allow:'', body:String(err && err.message || err) };
    });
  }

  function $(s,r){ return (r||document).querySelector(s); }
  function $$(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function fmtDate(ts){ var d=new Date(ts); return d.toLocaleDateString(undefined,{day:"2-digit",month:"short"}); }
  function escapeHtml(str){
    str=(str==null?"":String(str));
    return str.replace(/[&<>"']/g,function(m){
      return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[m];
    });
  }
  function showFAB(b){ var f=FAB||document.getElementById("fab-add"); if(f) f.style.display=b?"grid":"none"; }

  // Beep + vibración al terminar
  function restDoneFeedback(){
    if (navigator.vibrate) { try { navigator.vibrate([60,40,60]); } catch(_){} }
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      o.start();
      setTimeout(function(){
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        o.stop(ctx.currentTime + 0.14);
      }, 120);
    } catch(_) {}
  }

  function go(v){
    var prev = STATE.view;
    STATE.view = v;
    render();
    if (prev !== Views.WORKOUT && v === Views.WORKOUT) requestWakeLock();
    if (prev === Views.WORKOUT && v !== Views.WORKOUT) releaseWakeLock();
  }

  /* ---------- Modal ---------- */
  function showModal(title, html, onMount){
    if(!modalRoot) return;
    if(modalTitle) modalTitle.textContent=title;
    if(modalContent) modalContent.innerHTML=html;
    modalRoot.classList.remove("hidden"); modalRoot.setAttribute("aria-hidden","false");
    var tryClose=function(ev){ var t=ev.target; if(t && (t.id==="modal-close" || t.getAttribute("data-close")==="true")) closeModal(); };
    if(modalClose) modalClose.addEventListener("click", tryClose, {once:true});
    var back=modalRoot.querySelector(".modal-backdrop"); if(back) back.addEventListener("click", tryClose, {once:true});
    if(typeof onMount==="function") onMount();
  }
  function closeModal(){ if(!modalRoot) return; modalRoot.classList.add("hidden"); modalRoot.setAttribute("aria-hidden","true"); }

  /* ---------- Branding / Header ---------- */
  function brandHTML(){
    return '' +
    '<div class="brand">' +
    '  <svg class="brand-icon" width="22" height="22" viewBox="0 0 64 64" aria-hidden="true">' +
    '    <rect x="10" y="28" width="44" height="8" rx="4" fill="#FAE750"/>' +
    '    <rect x="6" y="22" width="6" height="20" rx="3" fill="#FAE750"/>' +
    '    <rect x="52" y="22" width="6" height="20" rx="3" fill="#FAE750"/>' +
    '  </svg>' +
    '  <span class="brand-text">GYMBUDDY</span>' +
    '</div>';
  }
  function headerShell(leftHTML, rightHTML){
    return '' +
    '<header class="header">' +
    '  <div class="bar">' +
    '    <div class="left">'+ (leftHTML||'') +'</div>' +
    '    <div class="center">'+ brandHTML() +'</div>' +
    '    <div class="right">'+ (rightHTML||'') +'</div>' +
    '  </div>' +
    '</header>';
  }

  /* ---------- Router ---------- */
  function render(){
    if(STATE.view===Views.HOME) return renderHome();
    if(STATE.view===Views.ROUTINES) return renderRoutines();
    if(STATE.view===Views.EDIT) return renderEditRoutine(STATE.currentRoutineId);
    if(STATE.view===Views.WORKOUT) return renderWorkout();
    if(STATE.view===Views.MARKS) return renderMarks();
  }

  /* ---------- HOME ---------- */
  function renderHome(){
    showFAB(false);
    appEl.innerHTML = headerShell()
    + '<section class="hero-grid">'
    + '  <article class="hero-card" id="card-train">'
    + '    <div class="bg" style="background-image:url(\'https://images.unsplash.com/photo-1586401100295-7a8096fd231a?q=80&w=1600&auto=format&fit=crop\');"></div>'
    + '    <div class="overlay"></div>'
    + '    <div class="label">ENTRENAR AHORA</div>'
    + '  </article>'
    + '  <article class="hero-card" id="card-marks">'
    + '    <div class="bg" style="background-image:url(\'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=1600&auto=format&fit=crop\');"></div>'
    + '    <div class="overlay"></div>'
    + '    <div class="label">MIS MARCAS</div>'
    + '  </article>'
    + '</section>';

    var ct=$("#card-train"); if(ct) ct.addEventListener("click", function(){ go(Views.ROUTINES); });
    var cm=$("#card-marks"); if(cm) cm.addEventListener("click", function(){ go(Views.MARKS); });
  }

  /* ---------- RUTINAS ---------- */
  function renderRoutines(){
    showFAB(true);
    api("/api/routines").then(function(routines){
      var left = '<button class="back-btn" id="back-home"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg><span>Inicio</span></button>';
      appEl.innerHTML = headerShell(left)
        + ((routines && routines.length)
          ? '<section class="grid">' + routines.map(RoutineCard).join("") + '</section>'
          : '<div class="empty card"><p><strong>¿Sin rutinas aún?</strong></p><p>Crea y registra tus entrenamientos.</p><div class="cta"><button class="btn" id="cta-new">Crea tu primera rutina</button></div></div>');

      var bh=$("#back-home"); if(bh) bh.addEventListener("click", function(){ go(Views.HOME); });
      var cta=$("#cta-new"); if(cta) cta.addEventListener("click", openCreateRoutine);
      $$("[data-edit]").forEach(function(el){ el.addEventListener("click", function(){ STATE.currentRoutineId=el.getAttribute("data-edit"); go(Views.EDIT); }); });
      $$("[data-play]").forEach(function(el){ el.addEventListener("click", function(){ startWorkout(el.getAttribute("data-play")); }); });
    }).catch(function(err){
      appEl.innerHTML = headerShell('<button class="back-btn" id="back-home">Inicio</button>') + '<div class="empty card"><p>Error cargando rutinas</p><p class="small">'+ escapeHtml(err.message) +'</p></div>';
      var bh=$("#back-home"); if(bh) bh.addEventListener("click", function(){ go(Views.HOME); });
    });
  }

  function RoutineCard(r){
    var exs=r.exercises||[], totalSets=0; for(var i=0;i<exs.length;i++) totalSets += (exs[i].sets||[]).length;
    return '' +
    '<article class="card list">' +
    '  <div class="row" style="align-items:center">' +
    '    <div class="badge">'+ (exs.length||0) +' ex</div>' +
    '    <div style="flex:1">' +
    '      <h3 style="margin:0 0 4px">'+ escapeHtml(r.name) +'</h3>' +
    '      <div class="small">'+ totalSets +' series • actualizado '+ fmtDate(r.updatedAt) +'</div>' +
    '    </div>' +
    '    <div class="row" style="gap:8px">' +
    '      <button class="btn icon secondary" aria-label="Editar rutina" data-edit="'+ r.id +'" title="Editar (⚙️)">' +
    '        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M19.14,12.94a7.14,7.14,0,0,0,.05-1l1.67-1.3a.5.5,0,0,0,.12-.64l-1.58-2.73a.5.5,0,0,0-.6-.22l-2,.8a6.81,6.81,0,0,0-1.73-1l-.3-2.1a.5.5,0,0,0-.5-.42H10.73a.5.5,0,0,0-.5.42l-.3,2.1a6.81,6.81,0,0,0-1.73-1l-2-.8a.5.5,0,0,0-.6.22L3,10a.5.5,0,0,0,.12.64L4.79,12a7.14,7.14,0,0,0,0,2L3.14,15.3A.5.5,0,0,0,3,15.94l1.58,2.73a.5.5,0,0,0,.6.22l2,.8a6.81,6.81,0,0,0,1.73,1l.3,2.1a.5.5,0,0,0,.5.42h3.06a.5.5,0,0,0,.5-.42l.3-2.1a6.81,6.81,0,0,0,1.73-1l2,.8a.5.5,0,0,0,.6-.22l1.58-2.73a.5.5,0,0,0-.12-.64Z"/></svg>' +
    '      </button>' +
    '      <button class="btn icon" aria-label="Empezar entrenamiento" data-play="'+ r.id +'" title="Empezar (▶)">' +
    '        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
    '      </button>' +
    '    </div>' +
    '  </div>' +
    '</article>';
  }

  /* ---------- Crear rutina ---------- */
  function openCreateRoutine(){
    showModal("Nueva rutina",
      '<div class="row" style="gap:10px">' +
      '<input id="rut-name" class="input" placeholder="Nombre de la rutina (p.ej. \'Full body A\')" />' +
      '<button id="rut-save" class="btn">Guardar</button>' +
      '</div>',
      function(){
        var save=$("#rut-save");
        if(save) save.addEventListener("click", function(){
          var name = ($("#rut-name").value||"").trim();
          if(!name){ $("#rut-name").focus(); return; }
          api("/api/routines", { method:"POST", body: JSON.stringify({ name:name }) })
            .then(function(){ closeModal(); go(Views.ROUTINES); });
        });
      }
    );
  }

  /* ---------- DELETE inteligente con variantes ---------- */
  function tryDeleteVariant(rid, variant){
    switch(variant){
      case 'body':     // DELETE /api/routines  {id}
        return api('/api/routines', { method:'DELETE', body: JSON.stringify({ id: rid }) });
      case 'rest':     // DELETE /api/routines/:id
        return api('/api/routines/' + encodeURIComponent(rid), { method:'DELETE' });
      case 'qs':       // DELETE /api/routines?id=RID
        return api('/api/routines?id=' + encodeURIComponent(rid), { method:'DELETE' });
      case 'overrideHeader': // POST /api/routines/:id  (X-HTTP-Method-Override: DELETE)
        return api('/api/routines/' + encodeURIComponent(rid), {
          method:'POST',
          headers:{ 'X-HTTP-Method-Override':'DELETE' }
        });
      case 'overrideBody':   // POST /api/routines/:id  {"_method":"DELETE"}
        return api('/api/routines/' + encodeURIComponent(rid), { method:'POST', body: JSON.stringify({ _method:'DELETE' }) });
      case 'actionDelete':   // POST /api/routines/:id/delete
        return api('/api/routines/' + encodeURIComponent(rid) + '/delete', { method:'POST' });
      case 'collectionDelete': // POST /api/routines/delete  {id}
        return api('/api/routines/delete', { method:'POST', body: JSON.stringify({ id: rid }) });
      case 'formUrlencoded': // POST /api/routines/delete  id=RID (x-www-form-urlencoded)
        return api('/api/routines/delete', {
          method:'POST',
          headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
          body:'id=' + encodeURIComponent(rid)
        });
      default:
        return Promise.reject(new Error('Variant desconocida'));
    }
  }

  function deleteRoutineSmart(rid){
    var pref = null;
    try { pref = localStorage.getItem('GB_DELETE_STYLE') || null; } catch(_) {}
    var order = pref
      ? [pref, 'body','rest','qs','overrideHeader','overrideBody','actionDelete','collectionDelete','formUrlencoded']
          .filter(function(v, i, self){ return self.indexOf(v) === i; })
      : ['body','rest','qs','overrideHeader','overrideBody','actionDelete','collectionDelete','formUrlencoded'];

    function loop(i){
      if (i >= order.length) {
        return Promise.reject(new Error('No funcionó ninguna variante de borrado'));
      }
      var variant = order[i];
      return tryDeleteVariant(rid, variant).then(function(res){
        try { localStorage.setItem('GB_DELETE_STYLE', variant); } catch(_) {}
        return res;
      }).catch(function(err){
        // Si es 4xx/405 típicos de ruta/método, prueba siguiente; otros errores (401/403) se propagan
        if (/API 404|API 405|API 400|API 415/i.test(err.message)) {
          return loop(i + 1);
        }
        throw err;
      });
    }
    return loop(0);
  }

  // ---- PROBADOR de rutas: OPTIONS/HEAD/GET para ver status y Allow ----
  function probeDeleteRoutes(rid){
    var candidates = [
      { label:'DELETE /api/routines',         method:'OPTIONS', path:'/api/routines' },
      { label:'DELETE /api/routines/:id',     method:'OPTIONS', path:'/api/routines/'+encodeURIComponent(rid) },
      { label:'POST /api/routines/:id/delete',method:'OPTIONS', path:'/api/routines/'+encodeURIComponent(rid)+'/delete' },
      { label:'POST /api/routines/delete',    method:'OPTIONS', path:'/api/routines/delete' },
      { label:'GET /api/routines/:id',        method:'GET',     path:'/api/routines/'+encodeURIComponent(rid) }, // si GET existe, la ruta base existe
      { label:'HEAD /api/routines/:id',       method:'HEAD',    path:'/api/routines/'+encodeURIComponent(rid) },
    ];
    return Promise.all(candidates.map(function(c){
      return fetchRaw(c.path, { method:c.method }).then(function(r){
        return { label:c.label, method:c.method, path:c.path, status:r.status, allow:r.allow };
      });
    }));
  }

  /* ---------- EDITAR RUTINA ---------- */
  function renderEditRoutine(routineId){
    showFAB(false);
    api('/api/routines/'+encodeURIComponent(routineId)).then(function(r){
      var exs=r.exercises||[];
      var left='<button class="back-btn" id="back-routines"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg><span>Mis rutinas</span></button>';
      appEl.innerHTML = headerShell(left)
        + ((exs.length===0)
          ? '<section class="grid"><div class="empty card"><p><strong>Ningún ejercicio añadido aún.</strong></p><p>Usa “Añadir ejercicios”.</p></div></section>'
          : '<section class="grid">'+ exs.map(function(x){ return EditExerciseCard(r,x); }).join("") +'</section>')
        + '<div class="row" style="align-items:center;margin-top:14px">'
          + '<div class="row" style="gap:8px">'
            + '<button id="add-ex" class="btn secondary">Añadir ejercicios</button>'
            + '<button id="save-routine" class="btn">Guardar cambios</button>'
          + '</div>'
          + '<div class="space"></div>'
          + '<button id="delete-routine" class="btn danger">Eliminar rutina</button>'
        + '</div>'
        + '<div class="footer-safe"></div>';

      var back=$("#back-routines"); if(back) back.addEventListener("click", function(){ go(Views.ROUTINES); });
      var add=$("#add-ex"); if(add) add.addEventListener("click", function(){ openExercisePicker(r.id, function(){ renderEditRoutine(r.id); }); });
      var save=$("#save-routine"); if(save) save.addEventListener("click", function(){ var payload=collectRoutineFromDOM(r); api('/api/routines/'+encodeURIComponent(r.id),{method:"PUT",body:JSON.stringify(payload)}).then(function(){ go(Views.ROUTINES); }); });

      var del = $("#delete-routine");
      if (del) del.addEventListener("click", function(){
        showModal("Eliminar rutina",
          '<div class="card">'
            + '<p>¿Estas seguro de que deseas eliminar esta rutina?</p>'
            + '<div class="row" style="justify-content:center;margin-top:10px;gap:8px">'
              + '<button id="del-cancel" class="btn secondary">Cancelar</button>'
              + '<button id="del-confirm" class="btn danger">Aceptar</button>'
            + '</div>'
            + '<hr style="opacity:.15;margin:12px 0" />'
            + '<div class="row" style="gap:8px;align-items:center;justify-content:center">'
              + '<button id="del-probe" class="btn secondary" title="Probar rutas y métodos disponibles">Probar rutas</button>'
            + '</div>'
          + '</div>',
          function(){
            var c = $("#del-cancel"); if (c) c.addEventListener("click", closeModal);

            var probeBtn = $("#del-probe");
            if (probeBtn) probeBtn.addEventListener("click", function(){
              probeBtn.disabled = true;
              probeBtn.textContent = "Probando…";
              probeDeleteRoutes(r.id).then(function(rows){
                var html = '<div class="card"><h4 style="margin:0 0 8px">Diagnóstico de rutas</h4>'
                  + '<table class="diag-table"><thead><tr><th>Ruta</th><th>Método</th><th>Status</th><th>Allow</th></tr></thead><tbody>'
                  + rows.map(function(x){
                      var badge = x.status >=200 && x.status<300 ? 'ok' : (x.status===405 ? 'warn' : 'err');
                      return '<tr>'
                        + '<td>'+escapeHtml(x.path)+'</td>'
                        + '<td>'+escapeHtml(x.method)+'</td>'
                        + '<td><span class="badge '+badge+'">'+x.status+'</span></td>'
                        + '<td style="white-space:nowrap">'+escapeHtml(x.allow||'')+'</td>'
                        + '</tr>';
                    }).join('')
                  + '</tbody></table>'
                  + '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn" data-close="true">Cerrar</button></div>'
                  + '</div>';
                showModal("Inspector de API", html);
              }).catch(function(err){
                showModal("Inspector de API",
                  '<div class="card"><p>Error al probar rutas.</p><p class="small">'+escapeHtml(err.message)+'</p><div class="row" style="justify-content:center;margin-top:10px"><button class="btn" data-close="true">Cerrar</button></div></div>'
                );
              }).finally(function(){
                probeBtn.disabled = false;
                probeBtn.textContent = "Probar rutas";
              });
            });

            var ok = $("#del-confirm");
            if (ok) ok.addEventListener("click", function(){
              deleteRoutineSmart(r.id)
                .then(function(){
                  closeModal();
                  go(Views.ROUTINES);
                })
                .catch(function(err){
                  var hint = '';
                  try { hint = localStorage.getItem('GB_DELETE_STYLE') || ''; } catch(_) {}
                  showModal("Error",
                    '<div class="card"><p>No se pudo eliminar (borrado).</p>'
                    + '<p class="small">'+ escapeHtml(err.message) + (hint ? ' • último intento: ' + escapeHtml(hint) : '') +'</p>'
                    + '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn" data-close="true">Cerrar</button></div></div>'
                  );
                });
            });
          }
        );
      });
    });
  }

  function EditExerciseCard(r,x){
    var ex=x.exercise||{}; var img=ex.image?'<img class="thumb" src="'+ ex.image +'" alt="'+ escapeHtml(ex.name||"Ejercicio") +'">':'<div class="thumb">🏋️</div>';
    var setsHTML=(x.sets||[]).map(function(s){
      return '<div class="set" data-set="'+ s.id +'">' +
             '  <input class="inp-reps" inputmode="numeric" type="number" min="0" placeholder="reps" value="'+ (s.reps==null?"":s.reps) +'">' +
             '  <input class="inp-peso" inputmode="decimal" type="number" step="0.5" min="0" placeholder="peso" value="'+ (s.peso==null?"":s.peso) +'">' +
             '  <button class="icon-btn remove" aria-label="Eliminar serie">🗑️</button>' +
             '</div>';
    }).join("");
    return '<article class="card" data-rex="'+ x.id +'">' +
           '  <div class="exercise-card">'+ img +
           '    <div class="info"><h3 style="margin:0 0 4px">'+ escapeHtml(ex.name||"Ejercicio") +'</h3><div class="small">'+ escapeHtml(ex.bodyPart||"—") +' • <span class="small">'+ escapeHtml(ex.equipment||"") +'</span></div></div>' +
           '  </div>' +
           '  <div class="sets">'+ setsHTML +
           '    <div class="row"><button class="btn add-set">Añadir serie</button><button class="btn secondary remove-ex">Quitar ejercicio</button></div>' +
           '  </div>' +
           '</article>';
  }

  function collectRoutineFromDOM(r){
    var exercises = $$("article.card[data-rex]").map(function(card){
      var rexId=card.getAttribute("data-rex");
      var sets=$$(".set",card).map(function(row){
        var repsVal=$(".inp-reps",row).value, pesoVal=$(".inp-peso",row).value;
        return { id:row.getAttribute("data-set"), reps:(repsVal===""?null:parseInt(repsVal,10)), peso:(pesoVal===""?null:parseFloat(pesoVal)) };
      });
      return { id:rexId, sets:sets };
    });
    return { exercises:exercises };
  }

  document.addEventListener("click", function(ev){
    var t=ev.target; if(!t||!t.classList) return;

    if(t.classList.contains("add-set")){
      var card=t.closest("article.card[data-rex]"); var rexId=card.getAttribute("data-rex");
      api('/api/routines/'+STATE.currentRoutineId+'/exercises/'+rexId+'/sets',{method:"POST",body:JSON.stringify({reps:null,peso:null})})
        .then(function(){ renderEditRoutine(STATE.currentRoutineId); });
    }
    if(t.classList.contains("remove-ex")){
      var card2=t.closest("article.card[data-rex]"); var rexId2=card2.getAttribute("data-rex");
      api('/api/routines/'+STATE.currentRoutineId+'/exercises/'+rexId2,{method:"DELETE"}).then(function(){ renderEditRoutine(STATE.currentRoutineId); });
    }
    if(t.classList.contains("remove")){
      var row=t.closest(".set"); var setId=row.getAttribute("data-set"); var rexCard=t.closest("article.card[data-rex]"); var rexId3=rexCard.getAttribute("data-rex");
      api('/api/routines/'+STATE.currentRoutineId+'/exercises/'+rexId3+'/sets/'+setId, { method:"DELETE" }).then(function(){ renderEditRoutine(STATE.currentRoutineId); });

    }
  });

  /* ---------- PICKER DE EJERCICIOS ---------- */
  function openExercisePicker(routineId, onAfter){
    api("/api/exercises/groups").then(function(groups){
      showModal("Añadir ejercicios",
        '<div class="row" style="gap:8px; margin-bottom:8px"><input id="search" class="input" placeholder="Buscar por nombre"></div>' +
        '<div class="chips" id="chips"><span class="chip active" data-group="*">Todos</span>' + groups.map(function(g){ return '<span class="chip" data-group="'+ escapeHtml(g) +'">'+ escapeHtml(g) +'</span>'; }).join("") + '</div>' +
        '<div class="row" style="justify-content:space-between;align-items:center;margin:8px 0"><div class="small">Filtra por grupo o busca por texto</div><button id="new-ex" class="btn secondary">+ Crear ejercicio</button></div>' +
        '<div class="grid" id="ex-grid"></div>',
        function(){
          var state={q:"",group:"*"}, search=$("#search"), chips=$$("#chips .chip"), grid=$("#ex-grid");
          function renderGrid(){
            api('/api/exercises?group='+encodeURIComponent(state.group)+'&q='+encodeURIComponent(state.q))
              .then(function(list){
                grid.innerHTML = list.map(function(e){
                  var img=e.image?'<img class="thumb" src="'+e.image+'" alt="'+escapeHtml(e.name)+'">':'<div class="thumb">🏋️</div>';
                  return '<article class="card list"><div class="exercise-card">'+img+'<div class="info"><h3 style="margin:0 0 6px">'+escapeHtml(e.name)+'</h3><div class="small">'+escapeHtml(e.bodyPart||"")+' • <span class="small">'+escapeHtml(e.equipment||"")+'</span></div><div class="small">'+escapeHtml(e.primaryMuscles||"")+(e.secondaryMuscles?' • '+escapeHtml(e.secondaryMuscles):'')+'</div></div><div class="row"><button class="btn" data-add="'+e.id+'">Añadir</button></div></div></article>';
                }).join("");
                $$("[data-add]",grid).forEach(function(btn){
                  btn.addEventListener("click", function(){
                    api('/api/routines/'+routineId+'/exercises',{method:"POST",body:JSON.stringify({exerciseId:btn.getAttribute("data-add")})})
                      .then(function(){ closeModal(); if(onAfter) onAfter(); });
                  });
                });
              });
          }
          if(search) search.addEventListener("input", function(){ state.q=(search.value||"").trim().toLowerCase(); renderGrid(); });
          chips.forEach(function(ch){ ch.addEventListener("click", function(){ chips.forEach(function(x){x.classList.remove("active");}); ch.classList.add("active"); state.group=ch.getAttribute("data-group"); renderGrid(); }); });
          var ne=$("#new-ex"); if(ne) ne.addEventListener("click", function(){ openCreateExerciseForm(onAfter); });
          renderGrid();
        }
      );
    });
  }

  function openCreateExerciseForm(onSaved){
    showModal("Crear ejercicio",
      '<div class="grid">' +
      '<div class="card"><label>Nombre</label><input id="ex-name" class="input" placeholder="p.ej. Dominadas pronas"></div>' +
      '<div class="card"><label>URL de imagen</label><input id="ex-img" class="input" placeholder="https://..."></div>' +
      '<div class="card"><label>Grupo muscular primario</label><input id="ex-body" class="input" placeholder="p.ej. Espalda"></div>' +
      '<div class="card"><label>Músculos primarios</label><input id="ex-primary" class="input" placeholder="p.ej. Latissimus Dorsi"></div>' +
      '<div class="card"><label>Músculos secundarios</label><input id="ex-secondary" class="input" placeholder="p.ej. Bíceps Brachii"></div>' +
      '<div class="card"><label>Equipo</label><input id="ex-eq" class="input" placeholder="p.ej. Barra, Mancuernas..."></div>' +
      '</div>' +
      '<div class="row" style="margin-top:12px"><button id="save-custom-ex" class="btn">Guardar ejercicio</button><button id="cancel-custom-ex" class="btn secondary">Cancelar</button></div>',
      function(){
        var save=$("#save-custom-ex");
        if(save) save.addEventListener("click", function(){
          var payload={ name:$("#ex-name").value, image:$("#ex-img").value, bodyPart:$("#ex-body").value, primaryMuscles:$("#ex-primary").value, secondaryMuscles:$("#ex-secondary").value, equipment:$("#ex-eq").value };
          if(!payload.name || !payload.name.trim()){ $("#ex-name").focus(); return; }
          api("/api/exercises",{method:"POST",body:JSON.stringify(payload)}).then(function(){ closeModal(); if(typeof onSaved==="function") onSaved(); });
        });
        var cancel=$("#cancel-custom-ex"); if(cancel) cancel.addEventListener("click", closeModal);
      }
    );
  }

  /* ---------- ENTRENAMIENTO + RESTs ---------- */
  function startWorkout(routineId){
    api('/api/routines/'+encodeURIComponent(routineId)).then(function(r){
      var exs=r&&r.exercises?r.exercises:[];
      if(!r || exs.length===0){ STATE.currentRoutineId=routineId; go(Views.EDIT); return; }
      STATE.currentRoutineId=r.id;
      STATE.workoutSession={
        routineId:r.id, startedAt:Date.now(), finishedAt:null, durationSec:0,
        currentIndex:0,
        items: exs.map(function(x){ var e=x.exercise||{}; return { rexId:x.id, exerciseId:e.id, name:e.name, image:e.image, bodyPart:e.bodyPart, sets:(x.sets||[]).map(function(s){ return { id:s.id, reps:s.reps, peso:s.peso, done:false }; }) }; })
      };
      go(Views.WORKOUT);
      startStopwatch();
    });
  }

  function startStopwatch(){
    var s=STATE.workoutSession; if(STATE.stopwatchTimer) clearInterval(STATE.stopwatchTimer);
    STATE.stopwatchTimer=setInterval(function(){ s.durationSec=Math.floor((Date.now()-s.startedAt)/1000); var el=$("#clock"); if(el) el.textContent=fmtDuration(s.durationSec); },1000);
  }
  function stopStopwatch(){ if(STATE.stopwatchTimer){ clearInterval(STATE.stopwatchTimer); STATE.stopwatchTimer=null; } }
  function fmtDuration(sec){ var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60; return (h>0?String(h).padStart(2,"0")+":":"")+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0"); }
  function completedSetsCount(sess){ return sess.items.reduce(function(a,it){ return a + it.sets.filter(function(s){return !!s.done;}).length; },0); }
  function maxSetsCount(sess){ return sess.items.reduce(function(a,it){ return a + it.sets.length; },0) || 1; }

  /* Header y nav */
  function workoutHeader(){
    var s=STATE.workoutSession, totalSets=maxSetsCount(s), done=completedSetsCount(s), pct=Math.round(100*done/Math.max(1,totalSets));
    var left='<button class="back-btn" id="back-routines-wo"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg><span>Mis rutinas</span></button>';
    return headerShell(left) +
      '<div class="progressbar"><div class="progressbar-fill" id="wo-bar" style="width:'+pct+'%"></div></div>' +
      '<div class="wo-topline"><div class="wo-meta"><span id="wo-counter">'+(s.currentIndex+1)+'</span> de <span id="wo-total">'+(s.items.length)+'</span></div><div class="wo-meta"><span id="wo-progress">'+pct+'%</span> · <span id="clock">'+fmtDuration(s.durationSec||0)+'</span></div></div>';
  }
  function navlineHTML(){
    return '<div class="workout-navline">' +
           '  <button class="navline-btn" id="nav-prev" aria-label="Anterior"><svg width="22" height="22" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg></button>' +
           '  <div class="navline-spacer"></div>' +
           '  <button class="navline-btn" id="nav-next" aria-label="Siguiente"><svg width="22" height="22" viewBox="0 0 24 24"><path fill="currentColor" d="M9 5l7 7-7 7"/></svg></button>' +
           '</div>';
  }

  function workoutCardHTML(item, idx, total){
    return '<article class="card workout-card" data-index="'+idx+'">' +
           '  <div class="exercise-card">'+
           (item.image?'<img class="thumb" src="'+item.image+'" alt="'+escapeHtml(item.name)+'">':'<div class="thumb">🏋️</div>')+
           '    <div class="info"><h3 style="margin:0 0 6px">'+escapeHtml(item.name)+'</h3><div class="small">'+escapeHtml(item.bodyPart||"")+'</div></div>' +
           '  </div>' +
           '  <div class="sets">' +
           item.sets.map(function(s){
             return '<div class="set">' +
                    '  <input inputmode="numeric" type="number" min="0" placeholder="Reps" value="'+(s.reps==null?"":s.reps)+'" data-reps="'+s.id+'">' +
                    '  <input inputmode="decimal" type="number" step="0.5" min="0" placeholder="Peso (kg)" value="'+(s.peso==null?"":s.peso)+'" data-peso="'+s.id+'">' +
                    '  <div class="toggle'+(s.done?' complete':'')+'" data-toggle="'+s.id+'" title="'+(s.done?'Completada':'Incompleta')+'"><span class="check">✓</span></div>' +
                    '</div>';
           }).join("") +
           '  </div>' +
           '</article>';
  }

  function renderWorkout(){
    showFAB(false);
    var s=STATE.workoutSession;
    appEl.innerHTML = workoutHeader() + navlineHTML() + '<section class="grid"><div id="exercise-stage" class="exercise-shell"></div><div id="finish-container"></div></section>';
    var back=$("#back-routines-wo"); if(back) back.addEventListener("click", function(){ go(Views.ROUTINES); });

    $("#nav-prev").addEventListener("click", function(){
      if(STATE.rest.active) stopRest(true);
      navigateWorkout("prev");
    });
    $("#nav-next").addEventListener("click", function(){
      if(STATE.rest.active){ finishNavigateTo(STATE.rest.targetIndex); return; }
      requestNextWithRest();
    });

    var stage=$("#exercise-stage");
    stage.innerHTML = workoutCardHTML(s.items[s.currentIndex], s.currentIndex, s.items.length);
    attachWorkoutHandlers(stage.firstElementChild, s.items[s.currentIndex]);
    updateFinishCard();
  }

  function updateWorkoutHeader(){
    var s=STATE.workoutSession;
    var pct=Math.round((100*completedSetsCount(s))/Math.max(1,maxSetsCount(s)));
    var counter=$("#wo-counter"); if(counter) counter.textContent=String(s.currentIndex+1);
    var prog=$("#wo-progress"); if(prog) prog.textContent=pct+'%';
    var bar=$("#wo-bar"); if(bar) bar.style.width=pct+'%';
  }

  function updateFinishCard(){
    var s=STATE.workoutSession, total=s.items.length, idx=s.currentIndex;
    var cont=$("#finish-container");
    cont.innerHTML = (idx===total-1)
      ? '<article class="card"><div class="exercise-card"><div class="info"><h3 style="margin:0 0 4px">Último ejercicio listo</h3><p class="small">Pulsa para finalizar tu sesión</p></div><div class="row"><button class="btn" id="wo-finish">Finalizar entrenamiento</button></div></div></article>'
      : '';
    var fin=$("#wo-finish");
    if(fin) fin.addEventListener("click", function(){
      showModal("Confirmar",
        '<div class="card"><p>¿Quieres finalizar el entrenamiento?</p><div class="row" style="justify-content:center;margin-top:10px"><button class="btn secondary" id="resume">Reanudar</button><button class="btn" id="confirm-finish">Finalizar entrenamiento</button></div></div>',
        function(){
          var resume=$("#resume"); if(resume) resume.addEventListener("click", closeModal);
          var confirm=$("#confirm-finish"); if(confirm) confirm.addEventListener("click", function(){
            closeModal(); stopStopwatch(); releaseWakeLock();
            STATE.workoutSession.finishedAt=Date.now();
            api("/api/workouts",{method:"POST",body:JSON.stringify(STATE.workoutSession)})
              .then(function(){
                showModal("BIEN TRABAJADO",
                  '<div class="card" style="text-align:center"><h3>BIEN TRABAJADO</h3><p>Duración: '+ fmtDuration(STATE.workoutSession.durationSec) +'</p><div class="row" style="justify-content:center;margin-top:10px"><button id="ok-done" class="btn">Aceptar</button></div></div>',
                  function(){ var ok=$("#ok-done"); if(ok) ok.addEventListener("click", function(){ closeModal(); STATE.workoutSession=null; go(Views.HOME); }); }
                );
              });
          });
        }
      );
    });
  }

  /* -------- Navegación con descanso entre ejercicios -------- */
  function requestNextWithRest(){
    var s=STATE.workoutSession;
    var oldIdx=s.currentIndex, newIdx=Math.min(s.items.length-1, oldIdx+1);
    if(newIdx===oldIdx) return;
    var stage=$("#exercise-stage"), oldEl=stage.firstElementChild; if(!oldEl) return;

    oldEl.classList.add("slide-exit-left");
    oldEl.addEventListener("animationend", function(){ if(oldEl.parentNode) oldEl.parentNode.removeChild(oldEl); showRestTimer(newIdx); }, {once:true});
  }

  function restHTML(){
    return '<article class="card rest-card">' +
           '  <h3 class="rest-title">¿Un descanso?</h3>' +
           '  <div class="rest-circle-wrap">' +
           '    <svg class="rest-svg" width="160" height="160" viewBox="0 0 120 120">' +
           '      <circle cx="60" cy="60" r="54" class="rest-bg"></circle>' +
           '      <circle cx="60" cy="60" r="54" class="rest-fg" id="rest-fg" stroke-dasharray="339.292" stroke-dashoffset="339.292"></circle>' +
           '    </svg>' +
           '    <div class="rest-time" id="rest-time">00:00</div>' +
           '  </div>' +
           '  <div class="row rest-presets">' +
           '    <button class="btn rest-preset" data-sec="30">0:30</button>' +
           '    <button class="btn rest-preset" data-sec="60">1:00</button>' +
           '    <button class="btn rest-preset" data-sec="90">1:30</button>' +
           '    <button class="btn rest-preset" data-sec="120">2:00</button>' +
           '  </div>' +
           '  <div class="row rest-actions">' +
           '    <button class="btn secondary" id="rest-plus">+30seg</button>' +
           '    <div class="space"></div>' +
           '    <button class="btn" id="rest-skip">Saltar</button>' +
           '  </div>' +
           '</article>';
  }

  function showRestTimer(targetIdx){
    STATE.rest = { active:true, targetIndex:targetIdx, totalMs:0, remainingMs:0, tick:null };
    var stage=$("#exercise-stage");
    stage.innerHTML = restHTML();

    $$(".rest-preset").forEach(function(b){
      b.addEventListener("click", function(){
        var sec=parseInt(b.getAttribute("data-sec"),10)||0;
        startRest(sec*1000);
      });
    });
    $("#rest-plus").addEventListener("click", function(){
      if (!STATE.rest.active){
        startRest(30000); return;
      }
      STATE.rest.remainingMs += 30000;
      STATE.rest.totalMs     += 30000;
      renderRestTime();
    });
    $("#rest-skip").addEventListener("click", function(){
      stopRest(true);
      finishNavigateTo(STATE.rest.targetIndex);
    });

    renderRestTime();
  }

  function startRest(totalMs){
    stopRest(true);
    STATE.rest.active = true;
    STATE.rest.totalMs = totalMs;
    STATE.rest.remainingMs = totalMs;
    renderRestTime();

    STATE.rest.tick = setInterval(function(){
      STATE.rest.remainingMs -= 100;
      if (STATE.rest.remainingMs <= 0){
        stopRest(false);
        restDoneFeedback();
        setTimeout(function(){ finishNavigateTo(STATE.rest.targetIndex); }, 150);
      } else {
        renderRestTime();
      }
    }, 100);
  }
  function stopRest(cancelOnly){
    if(STATE.rest.tick){ clearInterval(STATE.rest.tick); STATE.rest.tick=null; }
    if(cancelOnly){ /* noop */ }
    STATE.rest.active=false;
  }
  function renderRestTime(){
    var t  = $("#rest-time");
    var fg = $("#rest-fg");
    var total = STATE.rest.totalMs;
    var rem   = Math.max(0, STATE.rest.remainingMs);

    var secs = Math.floor(rem / 1000), m = Math.floor(secs/60), s = secs%60;
    if (t) t.textContent = String(m).padStart(1,"0")+":"+String(s).padStart(2,"0");

    var C=339.292, pct = total===0 ? 0 : ((total-rem)/total), offset = C*(1-pct);
    if (fg) fg.style.strokeDashoffset = String(offset);
  }

  function finishNavigateTo(newIdx){
    stopRest(true);
    var s=STATE.workoutSession, stage=$("#exercise-stage");
    var temp=document.createElement("div");
    var item=s.items[newIdx];
    temp.innerHTML = workoutCardHTML(item,newIdx,s.items.length);
    var newEl=temp.firstElementChild;
    newEl.classList.add("slide-enter-right");
    stage.innerHTML=""; stage.appendChild(newEl);
    s.currentIndex=newIdx;
    updateWorkoutHeader();
    updateFinishCard();
    attachWorkoutHandlers(newEl, item);
  }

  function navigateWorkout(dir){
    var s=STATE.workoutSession;
    var oldIdx=s.currentIndex, newIdx=(dir==="next")?Math.min(s.items.length-1, oldIdx+1):Math.max(0, oldIdx-1);
    if(newIdx===oldIdx) return;

    var stage=$("#exercise-stage"), oldEl=stage.firstElementChild; if(!oldEl) return;
    var outClass=(dir==="next")?"slide-exit-left":"slide-exit-right";
    var inClass=(dir==="next")?"slide-enter-right":"slide-enter-left";

    var temp=document.createElement("div");
    temp.innerHTML=workoutCardHTML(s.items[newIdx], newIdx, s.items.length);
    var newEl=temp.firstElementChild; newEl.classList.add(inClass);

    oldEl.classList.add(outClass);
    oldEl.addEventListener("animationend", function(){
      if(oldEl.parentNode) oldEl.parentNode.removeChild(oldEl);
      stage.appendChild(newEl);
      s.currentIndex=newIdx;
      updateWorkoutHeader(); updateFinishCard();
      attachWorkoutHandlers(newEl, s.items[newIdx]);
    }, {once:true});
  }

  // Persistencia de sets
  function persistSet(rexId, setId, reps, peso){
    var rid=STATE.currentRoutineId;
    var body={ exercises:[{ id:rexId, sets:[{ id:setId, reps:reps, peso:peso }] }] };
    return api('/api/routines/'+rid,{method:"PUT",body:JSON.stringify(body)}).catch(function(){});
  }

  // ------- Descanso entre series (modal) -------
  function srestHTML(){
    return '<div class="card rest-card">' +
           '  <h3 class="rest-title">¿Un descanso?</h3>' +
           '  <div class="rest-circle-wrap">' +
           '    <svg class="rest-svg" width="160" height="160" viewBox="0 0 120 120">' +
           '      <circle cx="60" cy="60" r="54" class="rest-bg"></circle>' +
           '      <circle cx="60" cy="60" r="54" class="rest-fg" id="srest-fg" stroke-dasharray="339.292" stroke-dashoffset="339.292"></circle>' +
           '    </svg>' +
           '    <div class="rest-time" id="srest-time">00:00</div>' +
           '  </div>' +
           '  <div class="row rest-presets">' +
           '    <button class="btn rest-preset" data-sec="30">0:30</button>' +
           '    <button class="btn rest-preset" data-sec="60">1:00</button>' +
           '    <button class="btn rest-preset" data-sec="90">1:30</button>' +
           '    <button class="btn rest-preset" data-sec="120">2:00</button>' +
           '  </div>' +
           '  <div class="row rest-actions">' +
           '    <button class="btn secondary" id="srest-plus">+30seg</button>' +
           '    <div class="space"></div>' +
           '    <button class="btn" id="srest-skip">Saltar</button>' +
           '  </div>' +
           '</div>';
  }
  function openSetRestModal(){
    showModal("Descanso entre series", srestHTML(), function(){
      $$(".rest-preset", modalContent).forEach(function(b){
        b.addEventListener("click", function(){
          var sec = parseInt(b.getAttribute("data-sec"),10)||0;
          srestStart(sec*1000);
        });
      });
      $("#srest-plus").addEventListener("click", function(){
        if(!STATE.srest.active){ srestStart(30000); return; }
        STATE.srest.remainingMs += 30000;
        STATE.srest.totalMs     += 30000;
        srestRender();
      });
      $("#srest-skip").addEventListener("click", function(){
        srestStop(true);
        closeModal();
      });
      srestRender();
    });
  }
  function srestStart(totalMs){
    srestStop(true);
    STATE.srest.active = true;
    STATE.srest.totalMs = totalMs;
    STATE.srest.remainingMs = totalMs;
    srestRender();
    STATE.srest.tick = setInterval(function(){
      STATE.srest.remainingMs -= 100;
      if (STATE.srest.remainingMs <= 0){
        srestStop(false);
        restDoneFeedback();
        setTimeout(function(){ closeModal(); }, 120);
      } else {
        srestRender();
      }
    }, 100);
  }
  function srestStop(cancelOnly){
    if(STATE.srest.tick){ clearInterval(STATE.srest.tick); STATE.srest.tick=null; }
    if(cancelOnly){ /* noop */ }
    STATE.srest.active=false;
  }
  function srestRender(){
    var t=$("#srest-time"), fg=$("#srest-fg");
    var total=STATE.srest.totalMs, rem=Math.max(0,STATE.srest.remainingMs);
    var secs=Math.floor(rem/1000), m=Math.floor(secs/60), s=secs%60;
    if(t) t.textContent = String(m).padStart(1,"0")+":"+String(s).padStart(2,"0");
    var C=339.292, pct= total===0?0:((total-rem)/total), offset=C*(1-pct);
    if(fg) fg.style.strokeDashoffset = String(offset);
  }

  // Handlers de workout (incluye disparar descanso por serie)
  function attachWorkoutHandlers(cardEl, item){
    for(var i=0;i<item.sets.length;i++){
      (function(st){
        var reps=cardEl.querySelector('[data-reps="'+st.id+'"]');
        var peso=cardEl.querySelector('[data-peso="'+st.id+'"]');
        var tog =cardEl.querySelector('[data-toggle="'+st.id+'"]');

        if(reps) reps.addEventListener("input", function(ev){ var v=ev.target.value; st.reps=(v===""?null:parseInt(v,10)); debounce(function(){ persistSet(item.rexId,st.id,st.reps,st.peso); }, 'reps:'+st.id, 300); });
        if(peso) peso.addEventListener("input", function(ev){ var v2=ev.target.value; st.peso=(v2===""?null:parseFloat(v2)); debounce(function(){ persistSet(item.rexId,st.id,st.reps,st.peso); }, 'peso:'+st.id, 300); });
        if(tog)  tog.addEventListener("click", function(){
          st.done=!st.done; tog.classList.toggle("complete", st.done);
          if(navigator && navigator.vibrate){ try{ navigator.vibrate(30); }catch(_){} }
          updateWorkoutHeader();

          if (st.done) { openSetRestModal(); }
          checkAutoNext(STATE.workoutSession, item);
        });
      })(item.sets[i]);
    }
  }

  function checkAutoNext(sess, item){
    var allDone = item.sets.length>0 && item.sets.every(function(x){return !!x.done;});
    var last = sess.currentIndex === (sess.items.length-1);
    if(allDone && !last){ requestNextWithRest(); }
  }

  /* ---------- MIS MARCAS ---------- */
  function renderMarks(){
    showFAB(false);
    var left='<button class="back-btn" id="back-home-marks"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg><span>Inicio</span></button>';
    api("/api/marks").then(function(marks){
      var body=(!marks||marks.length===0)
        ? '<div class="empty card"><p><strong>Todavía no hay marcas.</strong></p><p>Completa entrenamientos para ver tus PRs.</p></div>'
        : '<section class="grid">' + marks.map(function(m){
            var img=m.image?'<img class="thumb" src="'+m.image+'" alt="'+escapeHtml(m.name)+'">':'<div class="thumb">🏋️</div>';
            return '<article class="card list"><div class="exercise-card">'+img+'<div class="info"><h3 style="margin:0 0 4px)">'+escapeHtml(m.name)+'</h3><div class="small">'+escapeHtml(m.bodyPart||"")+'</div><div class="small">PR: <strong>'+m.pr_weight+'</strong> kg • Reps con PR: <strong>'+m.reps_at_pr+'</strong></div></div></div></article>';
          }).join("") + '</section>';
      appEl.innerHTML = headerShell(left) + body;
      var bk=$("#back-home-marks"); if(bk) bk.addEventListener("click", function(){ go(Views.HOME); });
    });
  }

  /* ---------- Boot ---------- */
  function boot(){
    appEl=$("#app"); if(!appEl) return;
    FAB=$("#fab-add"); modalRoot=$("#modal-root"); modalTitle=$("#modal-title"); modalContent=$("#modal-content"); modalClose=$("#modal-close");
    if(FAB) FAB.addEventListener("click", function(){ openCreateRoutine(); });
    render();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}
