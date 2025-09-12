/* GymBuddy core (guard anti-doble carga, sin returns top-level) */
if (window.__GB_APP_ALREADY_LOADED__) {
  console.warn('GymBuddy core ya cargado — omito reevaluación');
} else {
  window.__GB_APP_ALREADY_LOADED__ = true;

  // ====== BEGIN CORE ======

  /* Config */
  var API = (window.API_BASE || "").replace(/\/+$/, "");
  var Views = { HOME: "home", ROUTINES: "routines", EDIT: "edit", WORKOUT: "workout", MARKS: "marks" };

  /* Estado */
  var STATE = {
    view: Views.HOME,
    currentRoutineId: null,
    workoutSession: null,
    stopwatchTimer: null
  };

  /* Refs DOM (una sola declaración) */
  var appEl, FAB, modalRoot, modalTitle, modalContent, modalClose;

  /* Debounce idempotente */
  window.__GB_DEBOUNCE_MAP__ = window.__GB_DEBOUNCE_MAP__ || {};
  function debounce(fn, key, wait) {
    if (wait == null) wait = 300;
    var m = window.__GB_DEBOUNCE_MAP__;
    if (m[key]) clearTimeout(m[key]);
    m[key] = setTimeout(fn, wait);
  }

  /* Utils */
  function api(path, opts) {
    if (!opts) opts = {};
    var headers = opts.headers || {};
    headers["Content-Type"] = "application/json";
    var options = {}; for (var k in opts) options[k] = opts[k];
    options.headers = headers;
    return fetch(API + path, options).then(function (res) {
      if (!res.ok) throw new Error("API " + res.status);
      return res.json();
    });
  }
  function $(sel, root){ return (root || document).querySelector(sel); }
  function $$(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function fmtDate(ts){ var d = new Date(ts); return d.toLocaleDateString(undefined, { day:"2-digit", month:"short" }); }
  function escapeHtml(str){ str = (str==null?"":String(str)); return str.replace(/[&<>"']/g, function(m){ return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[m]; }); }
  function showFAB(show){ var f = FAB || document.getElementById("fab-add"); if (f) f.style.display = show ? "grid" : "none"; }
  function go(view){ STATE.view = view; render(); }

  /* Modal */
  function showModal(title, html, onMount) {
    if (!modalRoot) return;
    if (modalTitle) modalTitle.textContent = title;
    if (modalContent) modalContent.innerHTML = html;
    modalRoot.classList.remove("hidden");
    modalRoot.setAttribute("aria-hidden", "false");
    var tryClose = function(ev){
      var t = ev.target;
      if (t && (t.id === "modal-close" || t.getAttribute("data-close") === "true")) closeModal();
    };
    if (modalClose) modalClose.addEventListener("click", tryClose, { once: true });
    var back = modalRoot.querySelector(".modal-backdrop");
    if (back) back.addEventListener("click", tryClose, { once: true });
    if (typeof onMount === "function") onMount();
  }
  function closeModal(){
    if (!modalRoot) return;
    modalRoot.classList.add("hidden");
    modalRoot.setAttribute("aria-hidden", "true");
  }

  /* Router */
  function render(){
    if (STATE.view === Views.HOME) return renderHome();
    if (STATE.view === Views.ROUTINES) return renderRoutines();
    if (STATE.view === Views.EDIT) return renderEditRoutine(STATE.currentRoutineId);
    if (STATE.view === Views.WORKOUT) return renderWorkout();
    if (STATE.view === Views.MARKS) return renderMarks();
  }

  /* ---------- Header común (estilo referencia) ---------- */
  function headerHTML(left, rightExtra) {
    return '' +
    '<header class="header">' +
    '  <div class="title-row">' +
    '    <div class="app-title">' +
    '      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 3h-2l-1 4H6a2 2 0 0 0-2 2v3h2V9h3l1 4h2l-1-4h3v3h2V9a2 2 0 0 0-2-2h-4l-1-4zM4 14v3a2 2 0 0 0 2 2h4l1 4h2l-1-4h4a2 2 0 0 0 2-2v-3h-2v3h-4l-1 4h-2l-1-4H6v-3H4z"/></svg>' +
    '      <div><div style="font-weight:800">GymBuddy</div><div class="app-sub">Entrenamiento funcional • 2025</div></div>' +
    '    </div>' +
    '    <div class="metrics">' +
    '      <span class="metric-dot"></span><span class="metric-dot"></span><span class="metric-dot"></span>' +
    '    </div>' +
    '  </div>' +
    (left || rightExtra ? '<div class="subhead">' + (left || '') + (rightExtra || '') + '</div>' : '') +
    '</header>';
  }

  /* ---------- HOME ---------- */
  function renderHome(){
    showFAB(false);
    appEl.innerHTML = headerHTML(
      '<div class="sub-left"><div class="sub-title">¡Hola!</div><div class="sub-muted">'+ new Date().toLocaleDateString() +'</div></div>'
    )
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

    var ct = document.getElementById("card-train");
    if (ct) ct.addEventListener("click", function(){ go(Views.ROUTINES); });
    var cm = document.getElementById("card-marks");
    if (cm) cm.addEventListener("click", function(){ go(Views.MARKS); });
  }

  /* ---------- RUTINAS ---------- */
  function renderRoutines(){
    showFAB(true);
    api("/api/routines").then(function(routines){
      var left = '<button class="back-btn" id="back-home"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg><span>Inicio</span></button>';
      appEl.innerHTML = headerHTML(left)
        + ((routines && routines.length)
            ? '<section class="grid">' + routines.map(RoutineCard).join("") + '</section>'
            : '<div class="empty card"><p><strong>¿Sin rutinas aún?</strong></p><p>Crea y registra tus entrenamientos.</p><div class="cta"><button class="btn" id="cta-new">Crea tu primera rutina</button></div></div>'
          );

      var bh = document.getElementById("back-home");
      if (bh) bh.addEventListener("click", function(){ go(Views.HOME); });
      var cta = document.getElementById("cta-new");
      if (cta) cta.addEventListener("click", openCreateRoutine);

      $$("[data-edit]").forEach(function(el){
        el.addEventListener("click", function(){
          STATE.currentRoutineId = el.getAttribute("data-edit");
          go(Views.EDIT);
        });
      });
      $$("[data-play]").forEach(function(el){
        el.addEventListener("click", function(){
          startWorkout(el.getAttribute("data-play"));
        });
      });
    }).catch(function(err){
      appEl.innerHTML = headerHTML('<button class="back-btn" id="back-home">Inicio</button>')
        + '<div class="empty card"><p>Error cargando rutinas</p><p class="small">'+ escapeHtml(err.message) +'</p></div>';
      var bh = document.getElementById("back-home"); if (bh) bh.addEventListener("click", function(){ go(Views.HOME); });
    });
  }

  function RoutineCard(r){
    var totalSets = 0; var exs = r.exercises || [];
    for (var i=0;i<exs.length;i++) totalSets += (exs[i].sets || []).length;
    return '' +
    '<article class="card list">' +
    '  <div class="row" style="align-items:center">' +
    '    <div class="badge">'+ (exs.length || 0) +' ex</div>' +
    '    <div style="flex:1">' +
    '      <h3 style="margin:0 0 4px">'+ escapeHtml(r.name) +'</h3>' +
    '      <div class="small">'+ totalSets +' series • actualizado '+ fmtDate(r.updatedAt) +'</div>' +
    '    </div>' +
    '    <div class="row" style="gap:8px">' +
    '      <button class="btn icon secondary" aria-label="Editar rutina" data-edit="'+ r.id +'" title="Editar (⚙️)">' +
    '        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M19.14,12.94a7.14,7.14,0,0,0,.05-1l1.67-1.3a.5.5,0,0,0,.12-.64l-1.58-2.73a.5.5,0,0,0-.6-.22l-2,.8a6.81,6.81,0,0,0-1.73-1l-.3-2.1a.5.5,0,0,0-.5-.42H10.73a.5.5,0,0,0-.5.42l-.3,2.1a6.81,6.81,0,0,0-1.73,1l-2-.8a.5.5,0,0,0-.6.22L3,10a.5.5,0,0,0,.12.64L4.79,12a7.14,7.14,0,0,0,0,2L3.14,15.3A.5.5,0,0,0,3,15.94l1.58,2.73a.5.5,0,0,0,.6.22l2,.8a6.81,6.81,0,0,0,1.73,1l.3,2.1a.5.5,0,0,0,.5.42h3.06a.5.5,0,0,0,.5-.42l.3-2.1a6.81,6.81,0,0,0,1.73-1l2,.8a.5.5,0,0,0,.6-.22l1.58-2.73a.5.5,0,0,0-.12-.64Z"/></svg>' +
    '      </button>' +
    '      <button class="btn icon" aria-label="Empezar entrenamiento" data-play="'+ r.id +'" title="Empezar (▶)">' +
    '        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
    '      </button>' +
    '    </div>' +
    '  </div>' +
    '</article>';
  }

  function openCreateRoutine(){
    showModal("Nueva rutina",
      '<div class="row" style="gap:10px">' +
      '<input id="rut-name" class="input" placeholder="Nombre de la rutina (p.ej. \'Full body A\')" />' +
      '<button id="rut-save" class="btn">Guardar</button>' +
      '</div>',
      function(){
        var save = document.getElementById("rut-save");
        if (save) save.addEventListener("click", function(){
          var name = (document.getElementById("rut-name").value || "").trim();
          if (!name) { document.getElementById("rut-name").focus(); return; }
          api("/api/routines", { method:"POST", body: JSON.stringify({ name: name }) })
            .then(function(){ closeModal(); go(Views.ROUTINES); });
        });
      }
    );
  }

  /* ---------- EDITAR RUTINA ---------- */
  function renderEditRoutine(routineId){
    showFAB(false);
    api('/api/routines/' + routineId).then(function(r){
      var exs = r.exercises || [];
      var left = '<button class="back-btn" id="back-routines"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg><span>Mis rutinas</span></button>';
      appEl.innerHTML = headerHTML(left)
        + ((exs.length === 0)
            ? '<section class="grid"><div class="empty card"><p><strong>Ningún ejercicio añadido aún.</strong></p><p>Usa “Añadir ejercicios”.</p></div></section>'
            : '<section class="grid">' + exs.map(function(x){ return EditExerciseCard(r,x); }).join("") + '</section>'
          )
        + '<div class="row" style="justify-content:center;margin-top:14px">' +
          '<button id="add-ex" class="btn secondary">Añadir ejercicios</button>' +
          '<button id="save-routine" class="btn">Guardar cambios</button>' +
          '</div><div class="footer-safe"></div>';

      var back = document.getElementById("back-routines");
      if (back) back.addEventListener("click", function(){ go(Views.ROUTINES); });

      var add = document.getElementById("add-ex");
      if (add) add.addEventListener("click", function(){ openExercisePicker(r.id, function(){ renderEditRoutine(r.id); }); });

      var save = document.getElementById("save-routine");
      if (save) save.addEventListener("click", function(){
        var payload = collectRoutineFromDOM(r);
        api('/api/routines/' + r.id, { method:"PUT", body: JSON.stringify(payload) }).then(function(){ go(Views.ROUTINES); });
      });

      // Renombrar al tocar el título “GymBuddy” no es ideal: añadimos botón implícito:
      // (si quieres icono dedicado, avísame y lo pinto aquí)
    });
  }

  function EditExerciseCard(r, x){
    var ex = x.exercise || {};
    var hasImg = !!ex.image;
    var img = hasImg ? '<img class="thumb" src="'+ ex.image +'" alt="'+ escapeHtml(ex.name || "Ejercicio") +'">' : '<div class="thumb">🏋️</div>';

    var setsHTML = (x.sets || []).map(function(s){
      return '' +
      '<div class="set" data-set="'+ s.id +'">' +
      '  <input class="inp-reps" inputmode="numeric" type="number" min="0" placeholder="reps" value="'+ (s.reps == null ? "" : s.reps) +'">' +
      '  <input class="inp-peso" inputmode="decimal" type="number" step="0.5" min="0" placeholder="peso" value="'+ (s.peso == null ? "" : s.peso) +'">' +
      '  <button class="icon-btn remove" aria-label="Eliminar serie">🗑️</button>' +
      '</div>';
    }).join("");

    return '' +
    '<article class="card" data-rex="'+ x.id +'">' +
    '  <div class="exercise-card">' + img +
    '    <div class="info"><h3 style="margin:0 0 4px">'+ escapeHtml(ex.name || "Ejercicio") +'</h3>' +
    '    <div class="small">'+ escapeHtml(ex.bodyPart || "—") +' • <span class="small">'+ escapeHtml(ex.equipment || "") +'</span></div></div>' +
    '  </div>' +
    '  <div class="sets">'+ setsHTML +
    '    <div class="row"><button class="btn add-set">Añadir serie</button><button class="btn secondary remove-ex">Quitar ejercicio</button></div>' +
    '  </div>' +
    '</article>';
  }

  function collectRoutineFromDOM(r){
    var exercises = $$("article.card[data-rex]").map(function(card){
      var rexId = card.getAttribute("data-rex");
      var sets = $$(".set", card).map(function(row){
        var repsVal = $(".inp-reps", row).value;
        var pesoVal = $(".inp-peso", row).value;
        return {
          id: row.getAttribute("data-set"),
          reps: repsVal === "" ? null : parseInt(repsVal, 10),
          peso: pesoVal === "" ? null : parseFloat(pesoVal)
        };
      });
      return { id: rexId, sets: sets };
    });
    return { exercises: exercises };
  }

  document.addEventListener("click", function(ev){
    var t = ev.target; if (!t || !t.classList) return;

    if (t.classList.contains("add-set")){
      var card = t.closest("article.card[data-rex]");
      var rexId = card.getAttribute("data-rex");
      api('/api/routines/' + STATE.currentRoutineId + '/exercises/' + rexId + '/sets', {
        method:"POST", body: JSON.stringify({ reps:null, peso:null })
      }).then(function(){ renderEditRoutine(STATE.currentRoutineId); });
    }
    if (t.classList.contains("remove-ex")){
      var card2 = t.closest("article.card[data-rex]");
      var rexId2 = card2.getAttribute("data-rex");
      api('/api/routines/' + STATE.currentRoutineId + '/exercises/' + rexId2, { method:"DELETE" })
        .then(function(){ renderEditRoutine(STATE.currentRoutineId); });
    }
    if (t.classList.contains("remove")){
      var row = t.closest(".set");
      var setId = row.getAttribute("data-set");
      var rexCard = t.closest("article.card[data-rex]");
      var rexId3 = rexCard.getAttribute("data-rex");
      api('/api/routines/' + STATE.currentRoutineId + '/exercises/' + rexId3 + '/sets/' + setId, { method:"DELETE" })
        .then(function(){ renderEditRoutine(STATE.currentRoutineId); });
    }
  });

  /* ---------- PICKER DE EJERCICIOS ---------- */
  function openExercisePicker(routineId, onAfter){
    api("/api/exercises/groups").then(function(groups){
      showModal("Añadir ejercicios",
        '<div class="row" style="gap:8px; margin-bottom:8px"><input id="search" class="input" placeholder="Buscar por nombre"></div>' +
        '<div class="chips" id="chips"><span class="chip active" data-group="*">Todos</span>' +
        groups.map(function(g){ return '<span class="chip" data-group="'+ escapeHtml(g) +'">'+ escapeHtml(g) +'</span>'; }).join("") +
        '</div>' +
        '<div class="row" style="justify-content:space-between;align-items:center;margin:8px 0"><div class="small">Filtra por grupo o busca por texto</div><button id="new-ex" class="btn secondary">+ Crear ejercicio</button></div>' +
        '<div class="grid" id="ex-grid"></div>',
        function(){
          var state = { q:"", group:"*" };
          var search = document.getElementById("search");
          var chips = $$("#chips .chip");
          var grid = document.getElementById("ex-grid");

          function renderGrid(){
            api('/api/exercises?group='+ encodeURIComponent(state.group) +'&q='+ encodeURIComponent(state.q))
              .then(function(list){
                grid.innerHTML = list.map(function(e){
                  var hasImg = !!e.image;
                  var img = hasImg ? '<img class="thumb" src="'+ e.image +'" alt="'+ escapeHtml(e.name) +'">' : '<div class="thumb">🏋️</div>';
                  return '' +
                  '<article class="card list"><div class="exercise-card">' +
                    img +
                    '<div class="info"><h3 style="margin:0 0 6px">'+ escapeHtml(e.name) +'</h3>' +
                    '<div class="small">'+ escapeHtml(e.bodyPart || "") +' • <span class="small">'+ escapeHtml(e.equipment || "") +'</span></div>' +
                    '<div class="small">'+ escapeHtml(e.primaryMuscles || "") + (e.secondaryMuscles ? ' • ' + escapeHtml(e.secondaryMuscles) : '') +'</div>' +
                    '</div><div class="row"><button class="btn" data-add="'+ e.id +'">Añadir</button></div></div></article>';
                }).join("");
                $$("[data-add]", grid).forEach(function(btn){
                  btn.addEventListener("click", function(){
                    api('/api/routines/' + routineId + '/exercises', { method:"POST", body: JSON.stringify({ exerciseId: btn.getAttribute("data-add") }) })
                      .then(function(){ closeModal(); if (onAfter) onAfter(); });
                  });
                });
              });
          }

          if (search) search.addEventListener("input", function(){
            state.q = (search.value || "").trim().toLowerCase();
            renderGrid();
          });
          chips.forEach(function(ch){
            ch.addEventListener("click", function(){
              chips.forEach(function(x){ x.classList.remove("active"); });
              ch.classList.add("active");
              state.group = ch.getAttribute("data-group");
              renderGrid();
            });
          });
          var ne = document.getElementById("new-ex");
          if (ne) ne.addEventListener("click", function(){ openCreateExerciseForm(onAfter); });
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
        var save = document.getElementById("save-custom-ex");
        if (save) save.addEventListener("click", function(){
          var payload = {
            name: document.getElementById("ex-name").value,
            image: document.getElementById("ex-img").value,
            bodyPart: document.getElementById("ex-body").value,
            primaryMuscles: document.getElementById("ex-primary").value,
            secondaryMuscles: document.getElementById("ex-secondary").value,
            equipment: document.getElementById("ex-eq").value
          };
          if (!payload.name || !payload.name.trim()){
            document.getElementById("ex-name").focus(); return;
          }
          api("/api/exercises", { method:"POST", body: JSON.stringify(payload) })
            .then(function(){ closeModal(); if (typeof onSaved === "function") onSaved(); });
        });
        var cancel = document.getElementById("cancel-custom-ex");
        if (cancel) cancel.addEventListener("click", closeModal);
      }
    );
  }

  /* ---------- ENTRENAMIENTO ---------- */
  function startWorkout(routineId){
    api('/api/routines/' + routineId).then(function(r){
      var exs = r && r.exercises ? r.exercises : [];
      if (!r || exs.length === 0){
        STATE.currentRoutineId = routineId;
        go(Views.EDIT);
        return;
      }
      STATE.currentRoutineId = routineId;
      STATE.workoutSession = {
        routineId: r.id,
        startedAt: Date.now(),
        finishedAt: null,
        durationSec: 0,
        currentIndex: 0,
        items: exs.map(function(x){
          var e = x.exercise || {};
          return {
            rexId: x.id,
            exerciseId: e.id,
            name: e.name,
            image: e.image,
            bodyPart: e.bodyPart,
            sets: (x.sets || []).map(function(s){ return { id: s.id, reps: s.reps, peso: s.peso, done: false }; })
          };
        })
      };
      go(Views.WORKOUT);
      startStopwatch();
    });
  }

  function startStopwatch(){
    var s = STATE.workoutSession;
    if (STATE.stopwatchTimer) clearInterval(STATE.stopwatchTimer);
    STATE.stopwatchTimer = setInterval(function(){
      s.durationSec = Math.floor((Date.now() - s.startedAt) / 1000);
      var el = document.getElementById("clock");
      if (el) el.textContent = fmtDuration(s.durationSec);
    }, 1000);
  }
  function stopStopwatch(){ if (STATE.stopwatchTimer){ clearInterval(STATE.stopwatchTimer); STATE.stopwatchTimer = null; } }
  function fmtDuration(sec){ var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60; return (h>0?String(h).padStart(2,"0")+":":"")+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0"); }
  function completedSetsCount(sess){ return sess.items.reduce(function(acc,it){ return acc + it.sets.filter(function(s){return !!s.done;}).length; }, 0); }
  function maxSetsCount(sess){ return sess.items.reduce(function(acc,it){ return acc + it.sets.length; }, 0) || 1; }

  function workoutHeader(leftHTML, s){
    var totalSets = maxSetsCount(s), done = completedSetsCount(s);
    var pct = Math.round(100 * done / Math.max(1,totalSets));
    return '' +
    '<header class="workout-header">' +
    '  <div class="title-row">' +
    '    ' + leftHTML +
    '    <div><div class="workout-title">Entrenamiento</div><div class="workout-sub"><span id="wo-counter">'+ (s.currentIndex+1) +'</span> de <span id="wo-total">'+ (s.items.length) +'</span></div></div>' +
    '    <div class="workout-progress"><span id="wo-progress">'+ pct +'%</span><span class="stopwatch" id="clock">'+ fmtDuration(s.durationSec || 0) +'</span></div>' +
    '  </div>' +
    '  <div class="progressbar"><div class="progressbar-fill" id="wo-bar" style="width:'+ pct +'%"></div></div>' +
    '</header>';
  }

  function workoutCardHTML(item, idx, total){
    return '' +
    '<article class="card workout-card" data-index="'+ idx +'">' +
    '  <div class="nav-top">' +
    (idx>0 ? '<button class="nav-btn" id="wo-prev"><svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg> Anterior</button>' : '<span></span>') +
    '    <div class="spacer"></div>' +
    (idx<total-1 ? '<button class="nav-btn" id="wo-next">Siguiente <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M9 5l7 7-7 7"/></svg></button>' : '<span></span>') +
    '  </div>' +
    '  <div class="exercise-card">' +
    (item.image ? '<img class="thumb" src="'+ item.image +'" alt="'+ escapeHtml(item.name) +'">' : '<div class="thumb">🏋️</div>') +
    '    <div class="info"><h3 style="margin:0 0 6px">'+ escapeHtml(item.name) +'</h3><div class="small">'+ escapeHtml(item.bodyPart || "") +'</div></div>' +
    '  </div>' +
    '  <div class="sets">' +
    item.sets.map(function(s){
      return '' +
      '<div class="set">' +
      '  <input inputmode="numeric" type="number" min="0" placeholder="Reps" value="'+ (s.reps == null ? "" : s.reps) +'" data-reps="'+ s.id +'">' +
      '  <input inputmode="decimal" type="number" step="0.5" min="0" placeholder="Peso (kg)" value="'+ (s.peso == null ? "" : s.peso) +'" data-peso="'+ s.id +'">' +
      '  <div class="toggle'+ (s.done ? ' complete' : '') +'" data-toggle="'+ s.id +'" title="'+ (s.done ? 'Completada' : 'Incompleta') +'"><span class="check">✓</span></div>' +
      '</div>';
    }).join("") +
    '  </div>' +
    '</article>';
  }

  function renderWorkout(){
    showFAB(false);
    var s = STATE.workoutSession;
    var left = '<button class="back-btn" id="back-routines-wo"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg><span>Mis rutinas</span></button>';
    appEl.innerHTML = workoutHeader(left, s)
      + '<section class="grid"><div id="exercise-stage" class="exercise-shell"></div><div id="finish-container"></div></section>';
    var back = document.getElementById("back-routines-wo");
    if (back) back.addEventListener("click", function(){ go(Views.ROUTINES); });

    var stage = document.getElementById("exercise-stage");
    stage.innerHTML = workoutCardHTML(s.items[s.currentIndex], s.currentIndex, s.items.length);
    attachWorkoutHandlers(stage.firstElementChild, s.items[s.currentIndex]);
    updateFinishCard();
  }

  function updateWorkoutHeader(){
    var s = STATE.workoutSession;
    var progress = Math.round((100 * completedSetsCount(s)) / Math.max(1, maxSetsCount(s)));
    var counter = document.getElementById("wo-counter"); if (counter) counter.textContent = String(s.currentIndex + 1);
    var prog = document.getElementById("wo-progress"); if (prog) prog.textContent = progress + '%';
    var bar = document.getElementById("wo-bar"); if (bar) bar.style.width = progress + '%';
  }

  function updateFinishCard(){
    var s = STATE.workoutSession;
    var total = s.items.length, idx = s.currentIndex;
    var cont = document.getElementById("finish-container");
    cont.innerHTML = (idx === total - 1)
      ? '<article class="card"><div class="exercise-card"><div class="info"><h3 style="margin:0 0 4px">Último ejercicio listo</h3><p class="small">Pulsa para finalizar tu sesión</p></div><div class="row"><button class="btn" id="wo-finish">Finalizar entrenamiento</button></div></div></article>'
      : '';
    var fin = document.getElementById("wo-finish");
    if (fin) fin.addEventListener("click", function(){
      showModal("Confirmar",
        '<div class="card"><p>¿Quieres finalizar el entrenamiento?</p><div class="row" style="justify-content:center;margin-top:10px"><button class="btn secondary" id="resume">Reanudar</button><button class="btn" id="confirm-finish">Finalizar entrenamiento</button></div></div>',
        function(){
          var resume = document.getElementById("resume"); if (resume) resume.addEventListener("click", closeModal);
          var confirm = document.getElementById("confirm-finish");
          if (confirm) confirm.addEventListener("click", function(){
            closeModal(); stopStopwatch();
            STATE.workoutSession.finishedAt = Date.now();
            api("/api/workouts", { method:"POST", body: JSON.stringify(STATE.workoutSession) })
              .then(function(){
                showModal("BIEN TRABAJADO",
                  '<div class="card" style="text-align:center"><h3>BIEN TRABAJADO</h3><p>Duración: '+ fmtDuration(STATE.workoutSession.durationSec) +'</p><div class="row" style="justify-content:center;margin-top:10px"><button id="ok-done" class="btn">Aceptar</button></div></div>',
                  function(){
                    var ok = document.getElementById("ok-done");
                    if (ok) ok.addEventListener("click", function(){
                      closeModal(); STATE.workoutSession = null; go(Views.HOME);
                    });
                  }
                );
              });
          });
        }
      );
    });
  }

  function navigateWorkout(dir){
    var s = STATE.workoutSession;
    var oldIdx = s.currentIndex;
    var newIdx = (dir === "next") ? Math.min(s.items.length - 1, oldIdx + 1) : Math.max(0, oldIdx - 1);
    if (newIdx === oldIdx) return;

    var stage = document.getElementById("exercise-stage");
    var oldEl = stage.firstElementChild; if (!oldEl) return;

    var outClass = (dir === "next") ? "slide-exit-left" : "slide-exit-right";
    var item = s.items[newIdx];
    var temp = document.createElement("div");
    temp.innerHTML = workoutCardHTML(item, newIdx, s.items.length);
    var newEl = temp.firstElementChild;
    var inClass = (dir === "next") ? "slide-enter-right" : "slide-enter-left";

    oldEl.classList.add(outClass);
    newEl.classList.add(inClass);
    stage.appendChild(newEl);

    newEl.addEventListener("animationend", function(){
      if (oldEl.parentNode) oldEl.parentNode.removeChild(oldEl);
      s.currentIndex = newIdx;
      updateWorkoutHeader();
      updateFinishCard();
      attachWorkoutHandlers(newEl, item);
    }, { once:true });
  }

  function persistSet(rexId, setId, reps, peso){
    var rid = STATE.currentRoutineId;
    var body = { exercises: [{ id: rexId, sets: [{ id: setId, reps: reps, peso: peso }] }] };
    return api('/api/routines/' + rid, { method:"PUT", body: JSON.stringify(body) }).catch(function(){});
  }

  function attachWorkoutHandlers(cardEl, item){
    var prev = cardEl.querySelector("#wo-prev");
    var next = cardEl.querySelector("#wo-next");
    if (prev) prev.addEventListener("click", function(){ navigateWorkout("prev"); });
    if (next) next.addEventListener("click", function(){ navigateWorkout("next"); });

    for (var i=0;i<item.sets.length;i++){
      (function(st){
        var reps = cardEl.querySelector('[data-reps="'+ st.id +'"]');
        var peso = cardEl.querySelector('[data-peso="'+ st.id +'"]');
        var tog  = cardEl.querySelector('[data-toggle="'+ st.id +'"]');

        if (reps) reps.addEventListener("input", function(ev){
          var v = ev.target.value; st.reps = (v === "" ? null : parseInt(v,10));
          debounce(function(){ persistSet(item.rexId, st.id, st.reps, st.peso); }, 'reps:'+st.id, 300);
        });
        if (peso) peso.addEventListener("input", function(ev){
          var v2 = ev.target.value; st.peso = (v2 === "" ? null : parseFloat(v2));
          debounce(function(){ persistSet(item.rexId, st.id, st.reps, st.peso); }, 'peso:'+st.id, 300);
        });
        if (tog) tog.addEventListener("click", function(){
          st.done = !st.done;
          tog.classList.toggle("complete", st.done);
          if (navigator && navigator.vibrate) { try { navigator.vibrate(30); } catch(_){} }
          checkAutoNext(STATE.workoutSession, item);
          updateWorkoutHeader();
        });
      })(item.sets[i]);
    }
  }

  function checkAutoNext(sess, item){
    var allDone = item.sets.length > 0 && item.sets.every(function(x){ return !!x.done; });
    var last = sess.currentIndex === (sess.items.length - 1);
    if (allDone && !last){ setTimeout(function(){ navigateWorkout("next"); }, 220); }
  }

  /* ---------- MIS MARCAS ---------- */
  function renderMarks(){
    showFAB(false);
    var left = '<button class="back-btn" id="back-home-marks"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg><span>Inicio</span></button>';
    api("/api/marks").then(function(marks){
      var body = (!marks || marks.length === 0)
        ? '<div class="empty card"><p><strong>Todavía no hay marcas.</strong></p><p>Completa entrenamientos para ver tus PRs.</p></div>'
        : '<section class="grid">' + marks.map(function(m){
            var img = m.image ? '<img class="thumb" src="'+ m.image +'" alt="'+ escapeHtml(m.name) +'">' : '<div class="thumb">🏋️</div>';
            return '<article class="card list"><div class="exercise-card">'+ img +
              '<div class="info"><h3 style="margin:0 0 4px">'+ escapeHtml(m.name) +'</h3><div class="small">'+ escapeHtml(m.bodyPart || "") +'</div>' +
              '<div class="small">PR: <strong>'+ m.pr_weight +'</strong> kg • Reps con PR: <strong>'+ m.reps_at_pr +'</strong></div></div></div></article>';
          }).join("") + '</section>';
      appEl.innerHTML = headerHTML(left) + body;
      var bk = document.getElementById("back-home-marks"); if (bk) bk.addEventListener("click", function(){ go(Views.HOME); });
    });
  }

  /* Boot */
  function boot(){
    appEl = document.getElementById('app');
    if (!appEl) return;
    FAB = document.getElementById('fab-add');
    modalRoot = document.getElementById('modal-root');
    modalTitle = document.getElementById('modal-title');
    modalContent = document.getElementById('modal-content');
    modalClose = document.getElementById('modal-close');
    if (FAB) FAB.addEventListener('click', function(){ openCreateRoutine(); });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // ====== END CORE ======
}
