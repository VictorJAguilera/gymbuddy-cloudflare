/* GymBuddy 2025 — Frontend v3 (UI + animaciones exactas) */
const API = (window.API_BASE || "").replace(/\/+$/, "");
const Views = { HOME: "home", ROUTINES: "routines", EDIT: "edit", WORKOUT: "workout", MARKS: "marks" };

let STATE = {
  view: Views.HOME,
  currentRoutineId: null,
  workoutSession: null,
  stopwatchTimer: null,
};

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------------- Modal ---------------- */
const modalRoot = document.getElementById("modal-root");
const modalTitle = document.getElementById("modal-title");
const modalContent = document.getElementById("modal-content");
const modalClose = document.getElementById("modal-close");

function showModal(title, html, onMount) {
  modalTitle.textContent = title;
  modalContent.innerHTML = html;
  modalRoot.classList.remove("hidden");
  modalRoot.setAttribute("aria-hidden", "false");

  const tryClose = (ev) => {
    const t = ev.target;
    if (t.id === "modal-close" || t.dataset.close === "true") closeModal();
  };
  modalClose.addEventListener("click", tryClose, { once: true });
  modalRoot.querySelector(".modal-backdrop").addEventListener("click", tryClose, { once: true });

  if (typeof onMount === "function") onMount();
}
function closeModal() {
  modalRoot.classList.add("hidden");
  modalRoot.setAttribute("aria-hidden", "true");
}

/* ---------------- Utils ---------------- */
function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}
function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function showFAB(show) { const fab = document.getElementById("fab-add"); if (fab) fab.style.display = show ? "grid" : "none"; }
function go(view) { STATE.view = view; render(); }

const appEl = document.getElementById("app");
const FAB = document.getElementById("fab-add");
FAB.addEventListener("click", () => openCreateRoutine());

/* ---------------- Router ---------------- */
async function render() {
  if (STATE.view === Views.HOME) return renderHome();
  if (STATE.view === Views.ROUTINES) return renderRoutines();
  if (STATE.view === Views.EDIT) return renderEditRoutine(STATE.currentRoutineId);
  if (STATE.view === Views.WORKOUT) return renderWorkout();
  if (STATE.view === Views.MARKS) return renderMarks();
}

/* ---------- HOME ---------- */
function renderHome() {
  showFAB(false);
  appEl.innerHTML = `
    <header class="header">
      <div class="title-row">
        <div class="app-title">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M13 3h-2l-1 4H6a2 2 0 0 0-2 2v3h2V9h3l1 4h2l-1-4h3v3h2V9a2 2 0 0 0-2-2h-4l-1-4zM4 14v3a2 2 0 0 0 2 2h4l1 4h2l-1-4h4a2 2 0 0 0 2-2v-3h-2v3h-4l-1 4h-2l-1-4H6v-3H4z"/>
          </svg>
          <div>
            <div>GymBuddy</div>
            <div class="app-sub">Entrenamiento funcional • 2025</div>
          </div>
        </div>
      </div>
    </header>

    <section class="hero-grid">
      <article class="hero-card" id="card-train">
        <div class="bg" style="background-image:url('https://images.unsplash.com/photo-1586401100295-7a8096fd231a?q=80&w=1600&auto=format&fit=crop');"></div>
        <div class="overlay"></div>
        <div class="label">ENTRENAR AHORA</div>
      </article>

      <article class="hero-card" id="card-marks">
        <div class="bg" style="background-image:url('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=1600&auto=format&fit=crop');"></div>
        <div class="overlay"></div>
        <div class="label">MIS MARCAS</div>
      </article>
    </section>
  `;
  $("#card-train").addEventListener("click", () => go(Views.ROUTINES));
  $("#card-marks").addEventListener("click", () => go(Views.MARKS));
}

/* ---------- ROUTINES LIST ---------- */
async function renderRoutines() {
  showFAB(true);
  const routines = await api("/api/routines");
  appEl.innerHTML = `
    <header class="header">
      <div class="title-row">
        <button class="back-btn" id="back-home">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg>
          <span>Inicio</span>
        </button>
        <div class="app-title"><div>MIS RUTINAS</div></div>
        <span class="space"></span>
      </div>
    </header>

    ${
      routines.length === 0
        ? `
      <div class="empty card">
        <p><strong>¿Sin rutinas aún?</strong></p>
        <p>Crea y registra tus entrenamientos.</p>
        <div class="cta"><button class="btn" id="cta-new">Crea tu primera rutina</button></div>
      </div>
    `
        : `
      <section class="grid">
        ${routines.map((r) => RoutineCard(r)).join("")}
      </section>
    `
    }
  `;
  $("#back-home").addEventListener("click", () => go(Views.HOME));
  const cta = $("#cta-new");
  if (cta) cta.addEventListener("click", openCreateRoutine);
  $$("[data-edit]").forEach((el) =>
    el.addEventListener("click", () => {
      STATE.currentRoutineId = el.getAttribute("data-edit");
      go(Views.EDIT);
    })
  );
  $$("[data-play]").forEach((el) =>
    el.addEventListener("click", () => startWorkout(el.getAttribute("data-play")))
  );
}
function RoutineCard(r) {
  const totalSets = (r.exercises || []).reduce((acc, e) => acc + e.sets.length, 0);
  return `
  <article class="card">
    <div class="row" style="align-items:center">
      <div style="width:54px;height:54px;border-radius:16px;background:#0e0f13;display:grid;place-items:center;border:1px solid var(--ring)">
        <span class="kbd">${r.exercises.length || 0}</span>
      </div>
      <div style="flex:1">
        <h3 style="margin:0 0 4px">${escapeHtml(r.name)}</h3>
        <div class="small">${totalSets} series • actualizado ${fmtDate(r.updatedAt)}</div>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn icon secondary" aria-label="Editar rutina" data-edit="${r.id}" title="Editar (⚙️)">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M19.14,12.94a7.14,7.14,0,0,0,.05-1l1.67-1.3a.5.5,0,0,0,.12-.64l-1.58-2.73a.5.5,0,0,0-.6-.22l-2,.8a6.81,6.81,0,0,0-1.73-1l-.3-2.1a.5.5,0,0,0-.5-.42H10.73a.5.5,0,0,0-.5.42l-.3,2.1a6.81,6.81,0,0,0-1.73,1l-2-.8a.5.5,0,0,0-.6.22L3,10a.5.5,0,0,0,.12.64L4.79,12a7.14,7.14,0,0,0,0,2L3.14,15.3A.5.5,0,0,0,3,15.94l1.58,2.73a.5.5,0,0,0,.6.22l2-.8a6.81,6.81,0,0,0,1.73,1l.3,2.1a.5.5,0,0,0,.5.42h3.06a.5.5,0,0,0,.5-.42l.3-2.1a6.81,6.81,0,0,0,1.73-1l2,.8a.5.5,0,0,0,.6-.22l1.58-2.73a.5.5,0,0,0-.12-.64Z"/>
          </svg>
        </button>
        <button class="btn icon" aria-label="Empezar entrenamiento" data-play="${r.id}" title="Empezar (▶)">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
    </div>
  </article>`;
}
function openCreateRoutine() {
  showModal(
    "Nueva rutina",
    `
    <div class="row" style="gap:10px">
      <input id="rut-name" class="input" placeholder="Nombre de la rutina (p.ej. 'Full body A')" />
      <button id="rut-save" class="btn">Guardar</button>
    </div>
  `,
    () => {
      $("#rut-save").addEventListener("click", async () => {
        const name = ($("#rut-name").value || "").trim();
        if (!name) return $("#rut-name").focus();
        await api("/api/routines", { method: "POST", body: JSON.stringify({ name }) });
        closeModal();
        go(Views.ROUTINES);
      });
    }
  );
}

/* ---------- EDIT ROUTINE ---------- */
async function renderEditRoutine(routineId) {
  showFAB(false);
  const r = await api(`/api/routines/${routineId}`);
  appEl.innerHTML = `
    <header class="header">
      <div class="title-row">
        <button class="back-btn" id="back-routines">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg>
          <span>Mis rutinas</span>
        </button>
        <div class="app-title">
          <button id="rename" class="icon-btn ghost" style="display:flex;gap:8px;align-items:center">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
            <span id="rname" style="font-weight:800">${escapeHtml(r.name)}</span>
          </button>
        </div>
        <span class="space"></span>
      </div>
    </header>

    <section class="grid">
      ${
        (r.exercises || []).length === 0
          ? `
        <div class="empty card">
          <p><strong>Ningún ejercicio añadido aún.</strong></p>
          <p>Usa “Añadir ejercicios” para buscar por grupo muscular o nombre.</p>
        </div>`
          : r.exercises.map((x) => EditExerciseCard(r, x)).join("")
      }
    </section>

    <div class="row" style="justify-content:center;margin-top:14px">
      <button id="add-ex" class="btn secondary">Añadir ejercicios</button>
      <button id="save-routine" class="btn">Guardar cambios</button>
    </div>
    <div class="footer-safe"></div>
  `;

  $("#back-routines").addEventListener("click", () => go(Views.ROUTINES));
  $("#add-ex").addEventListener("click", () => openExercisePicker(r.id, () => renderEditRoutine(r.id)));
  $("#save-routine").addEventListener("click", async () => {
    const payload = collectRoutineFromDOM(r);
    await api(`/api/routines/${r.id}`, { method: "PUT", body: JSON.stringify(payload) });
    go(Views.ROUTINES);
  });
  $("#rename").addEventListener("click", () => {
    showModal(
      "Renombrar rutina",
      `
      <div class="row">
        <input id="newname" class="input" placeholder="Nombre de la rutina" value="${escapeHtml(r.name)}">
        <button id="ok" class="btn">Aceptar</button>
      </div>
    `,
      () => {
        $("#ok").addEventListener("click", async () => {
          const nv = ($("#newname").value || "").trim();
          if (!nv) return;
          await api(`/api/routines/${r.id}`, { method: "PUT", body: JSON.stringify({ name: nv }) });
          closeModal();
          renderEditRoutine(r.id);
        });
      }
    );
  });
}

function EditExerciseCard(r, x) {
  const ex = x.exercise;
  const img = ex?.image
    ? `<img class="thumb" src="${ex.image}" alt="${escapeHtml(ex.name)}">`
    : `<div class="thumb">🏋️</div>`;
  return `
  <article class="card" data-rex="${x.id}">
    <div class="exercise-card">
      ${img}
      <div class="info">
        <h3 style="margin:0 0 4px">${escapeHtml(ex?.name || "Ejercicio")}</h3>
        <div class="small">${ex?.bodyPart || "—"} • <span class="small">${ex?.equipment || ""}</span></div>
      </div>
    </div>
    <div class="sets">
      ${(x.sets || [])
        .map(
          (s) => `
        <div class="set" data-set="${s.id}">
          <input class="inp-reps" inputmode="numeric" type="number" min="0" placeholder="reps" value="${s.reps ?? ""}">
          <input class="inp-peso" inputmode="decimal" type="number" step="0.5" min="0" placeholder="peso" value="${s.peso ?? ""}">
          <button class="icon-btn remove" aria-label="Eliminar serie">🗑️</button>
        </div>
      `
        )
        .join("")}
      <div class="row">
        <button class="btn add-set">Añadir serie</button>
        <button class="btn secondary remove-ex">Quitar ejercicio</button>
      </div>
    </div>
  </article>`;
}

function collectRoutineFromDOM(r) {
  const exCards = $$("article.card[data-rex]");
  const exercises = exCards.map((card) => {
    const rexId = card.getAttribute("data-rex");
    const sets = $$(".set", card).map((row) => {
      const repsVal = $(".inp-reps", row).value;
      const pesoVal = $(".inp-peso", row).value;
      return {
        id: row.getAttribute("data-set"),
        reps: repsVal === "" ? null : parseInt(repsVal, 10),
        peso: pesoVal === "" ? null : parseFloat(pesoVal),
      };
    });
    return { id: rexId, sets };
  });
  return { exercises };
}

document.addEventListener("click", async (ev) => {
  const t = ev.target;
  if (t.classList.contains("add-set")) {
    const card = t.closest("article.card[data-rex]");
    const rexId = card.getAttribute("data-rex");
    await api(`/api/routines/${STATE.currentRoutineId}/exercises/${rexId}/sets`, {
      method: "POST",
      body: JSON.stringify({ reps: null, peso: null }),
    });
    renderEditRoutine(STATE.currentRoutineId);
  }
  if (t.classList.contains("remove-ex")) {
    const card = t.closest("article.card[data-rex]");
    const rexId = card.getAttribute("data-rex");
    await api(`/api/routines/${STATE.currentRoutineId}/exercises/${rexId}`, { method: "DELETE" });
    renderEditRoutine(STATE.currentRoutineId);
  }
  if (t.classList.contains("remove")) {
    const row = t.closest(".set");
    const setId = row.getAttribute("data-set");
    const rexCard = t.closest("article.card[data-rex]");
    const rexId = rexCard.getAttribute("data-rex");
    await api(`/api/routines/${STATE.currentRoutineId}/exercises/${rexId}/sets/${setId}`, { method: "DELETE" });
    renderEditRoutine(STATE.currentRoutineId);
  }
});

/* ---------- EXERCISE PICKER ---------- */
async function openExercisePicker(routineId, onAfter) {
  const groups = await api("/api/exercises/groups");
  showModal(
    "Añadir ejercicios",
    `
    <div class="row" style="gap:8px; margin-bottom:8px">
      <input id="search" class="input" placeholder="Buscar por nombre (p.ej. 'sentadilla', 'press banca')">
    </div>
    <div class="chips" id="chips">
      <span class="chip active" data-group="*">Todos</span>
      ${groups.map((g) => `<span class="chip" data-group="${escapeHtml(g)}">${escapeHtml(g)}</span>`).join("")}
    </div>
    <div class="row" style="justify-content:space-between;align-items:center;margin:8px 0">
      <div class="small">Filtra por grupo o busca por texto</div>
      <button id="new-ex" class="btn secondary">+ Crear ejercicio</button>
    </div>
    <div class="grid" id="ex-grid"></div>
  `,
    async () => {
      let state = { q: "", group: "*" };
      const search = $("#search");
      const chips = $$("#chips .chip");
      const grid = $("#ex-grid");

      async function renderGrid() {
        const list = await api(
          `/api/exercises?group=${encodeURIComponent(state.group)}&q=${encodeURIComponent(state.q)}`
        );
        grid.innerHTML = list
          .map(
            (e) => `
        <article class="card">
          <div class="exercise-card">
            ${
              e.image
                ? `<img class="thumb" src="${e.image}" alt="${escapeHtml(e.name)}">`
                : `<div class="thumb">🏋️</div>`
            }
            <div class="info">
              <h3 style="margin:0 0 6px">${escapeHtml(e.name)}</h3>
              <div class="small">${e.bodyPart || ""} • <span class="small">${e.equipment || ""}</span></div>
              <div class="small">${e.primaryMuscles || ""}${e.secondaryMuscles ? " • " + e.secondaryMuscles : ""}</div>
            </div>
            <div class="row">
              <button class="btn" data-add="${e.id}">Añadir</button>
            </div>
          </div>
        </article>
      `
          )
          .join("");
        $$("[data-add]", grid).forEach((btn) =>
          btn.addEventListener("click", async () => {
            await api(`/api/routines/${routineId}/exercises`, {
              method: "POST",
              body: JSON.stringify({ exerciseId: btn.getAttribute("data-add") }),
            });
            closeModal();
            if (onAfter) onAfter();
          })
        );
      }

      search.addEventListener("input", () => {
        state.q = search.value.trim().toLowerCase();
        renderGrid();
      });
      chips.forEach((ch) =>
        ch.addEventListener("click", () => {
          chips.forEach((x) => x.classList.remove("active"));
          ch.classList.add("active");
          state.group = ch.getAttribute("data-group");
          renderGrid();
        })
      );
      $("#new-ex").addEventListener("click", () => openCreateExerciseForm(onAfter));
      renderGrid();
    }
  );
}
function openCreateExerciseForm(onSaved) {
  showModal(
    "Crear ejercicio",
    `
    <div class="grid">
      <div class="card"><label>Nombre</label><input id="ex-name" class="input" placeholder="p.ej. Dominadas pronas"></div>
      <div class="card"><label>URL de imagen</label><input id="ex-img" class="input" placeholder="https://..."></div>
      <div class="card"><label>Grupo muscular primario</label><input id="ex-body" class="input" placeholder="p.ej. Espalda"></div>
      <div class="card"><label>Músculos primarios</label><input id="ex-primary" class="input" placeholder="p.ej. Latissimus Dorsi"></div>
      <div class="card"><label>Músculos secundarios</label><input id="ex-secondary" class="input" placeholder="p.ej. Biceps Brachii"></div>
      <div class="card"><label>Equipo</label><input id="ex-eq" class="input" placeholder="p.ej. Barra, Mancuernas..."></div>
    </div>
    <div class="row" style="margin-top:12px">
      <button id="save-custom-ex" class="btn">Guardar ejercicio</button>
      <button id="cancel-custom-ex" class="btn secondary">Cancelar</button>
    </div>
  `,
    () => {
      $("#save-custom-ex").addEventListener("click", async () => {
        const payload = {
          name: $("#ex-name").value,
          image: $("#ex-img").value,
          bodyPart: $("#ex-body").value,
          primaryMuscles: $("#ex-primary").value,
          secondaryMuscles: $("#ex-secondary").value,
          equipment: $("#ex-eq").value,
        };
        if (!payload.name.trim()) {
          $("#ex-name").focus();
          return;
        }
        await api("/api/exercises", { method: "POST", body: JSON.stringify(payload) });
        closeModal();
        if (typeof onSaved === "function") onSaved();
      });
      $("#cancel-custom-ex").addEventListener("click", closeModal);
    }
  );
}

/* ---------- WORKOUT ---------- */
async function startWorkout(routineId) {
  const r = await api(`/api/routines/${routineId}`);
  if (!r || (r.exercises || []).length === 0) {
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
    items: r.exercises.map((x) => ({
      rexId: x.id,
      exerciseId: x.exercise.id,
      name: x.exercise.name,
      image: x.exercise.image,
      bodyPart: x.exercise.bodyPart,
      sets: (x.sets || []).map((s) => ({ id: s.id, reps: s.reps, peso: s.peso, done: false })),
    })),
  };
  go(Views.WORKOUT);
  startStopwatch();
}

function startStopwatch() {
  const s = STATE.workoutSession;
  if (STATE.stopwatchTimer) clearInterval(STATE.stopwatchTimer);
  STATE.stopwatchTimer = setInterval(() => {
    s.durationSec = Math.floor((Date.now() - s.startedAt) / 1000);
    const el = $("#clock");
    if (el) el.textContent = fmtDuration(s.durationSec);
  }, 1000);
}
function stopStopwatch() { if (STATE.stopwatchTimer) { clearInterval(STATE.stopwatchTimer); STATE.stopwatchTimer = null; } }
function fmtDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${h > 0 ? String(h).padStart(2, "0") + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function completedSetsCount(sess) { return sess.items.reduce((acc, it) => acc + it.sets.filter((s) => s.done).length, 0); }
function maxSetsCount(sess) { return sess.items.reduce((acc, it) => acc + it.sets.length, 0) || 1; }

/* Tarjeta de ejercicio */
function workoutCardHTML(item, idx, total) {
  return `
    <article class="card workout-card" data-index="${idx}">
      <div class="nav-top">
        ${idx > 0 ? `<button class="nav-btn" id="wo-prev"><svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg> Anterior</button>` : `<span></span>`}
        <div class="spacer"></div>
        ${idx < total - 1 ? `<button class="nav-btn" id="wo-next">Siguiente <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M9 5l7 7-7 7"/></svg></button>` : `<span></span>`}
      </div>

      <div class="exercise-card">
        ${ item.image ? `<img class="thumb" src="${item.image}" alt="${escapeHtml(item.name)}">` : `<div class="thumb">🏋️</div>` }
        <div class="info">
          <h3 style="margin:0 0 6px">${escapeHtml(item.name)}</h3>
          <div class="small">${item.bodyPart || ""}</div>
        </div>
      </div>

      <div class="sets">
        ${item.sets.map((s) => `
          <div class="set">
            <input inputmode="numeric" type="number" min="0" placeholder="Reps" value="${s.reps ?? ""}" data-reps="${s.id}">
            <input inputmode="decimal" type="number" step="0.5" min="0" placeholder="Peso (kg)" value="${s.peso ?? ""}" data-peso="${s.id}">
            <div class="toggle ${s.done ? "complete" : ""}" data-toggle="${s.id}" title="${s.done ? "Completada" : "Incompleta"}">
              <span class="check">✓</span>
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderWorkout() {
  showFAB(false);
  const sess = STATE.workoutSession;
  const total = sess.items.length;
  const idx = sess.currentIndex;
  const item = sess.items[idx];
  const progress = Math.round((100 * completedSetsCount(sess)) / Math.max(1, maxSetsCount(sess)));

  appEl.innerHTML = `
    <header class="workout-header">
      <div class="title-row">
        <button class="back-btn" id="back-routines-wo">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg>
          <span>Mis rutinas</span>
        </button>
        <div>
          <div class="workout-title">Entrenamiento</div>
          <div class="workout-sub"><span id="wo-counter">${idx + 1}</span> de <span id="wo-total">${total}</span></div>
        </div>
        <div class="workout-progress">
          <span id="wo-progress">${progress}%</span>
          <span class="stopwatch" id="clock">${fmtDuration(sess.durationSec || 0)}</span>
        </div>
      </div>
    </header>

    <section class="grid">
      <div id="exercise-stage" class="exercise-shell"></div>
      <div id="finish-container"></div>
    </section>
  `;

  $("#back-routines-wo").addEventListener("click", () => go(Views.ROUTINES));

  const stage = $("#exercise-stage");
  stage.innerHTML = workoutCardHTML(item, idx, total);
  attachWorkoutHandlers(stage.firstElementChild, item);

  updateFinishCard();
}

function updateWorkoutHeader() {
  const s = STATE.workoutSession;
  const progress = Math.round((100 * completedSetsCount(s)) / Math.max(1, maxSetsCount(s)));
  const counter = $("#wo-counter"); if (counter) counter.textContent = String(s.currentIndex + 1);
  const prog = $("#wo-progress"); if (prog) prog.textContent = `${progress}%`;
}

function updateFinishCard() {
  const s = STATE.workoutSession;
  const total = s.items.length;
  const idx = s.currentIndex;
  const cont = $("#finish-container");
  cont.innerHTML = idx === total - 1 ? `
    <article class="card">
      <div class="exercise-card">
        <div class="info">
          <h3 style="margin:0 0 4px">Último ejercicio listo</h3>
          <p class="small">Pulsa para finalizar tu sesión</p>
        </div>
        <div class="row"><button class="btn" id="wo-finish">Finalizar entrenamiento</button></div>
      </div>
    </article>
  ` : "";

  const fin = $("#wo-finish");
  if (fin) fin.addEventListener("click", () => {
    showModal(
      "Confirmar",
      `
      <div class="card">
        <p>¿Quieres finalizar el entrenamiento?</p>
        <div class="row" style="justify-content:center;margin-top:10px">
          <button class="btn secondary" id="resume">Reanudar</button>
          <button class="btn" id="confirm-finish">Finalizar entrenamiento</button>
        </div>
      </div>
    `,
      () => {
        $("#resume").addEventListener("click", closeModal);
        $("#confirm-finish").addEventListener("click", async () => {
          closeModal();
          stopStopwatch();
          STATE.workoutSession.finishedAt = Date.now();
          await api("/api/workouts", { method: "POST", body: JSON.stringify(STATE.workoutSession) });
          showModal(
            "BIEN TRABAJADO",
            `
            <div class="card" style="text-align:center">
              <h3>BIEN TRABAJADO</h3>
              <p>Duración: ${fmtDuration(STATE.workoutSession.durationSec)}</p>
              <div class="row" style="justify-content:center;margin-top:10px"><button id="ok-done" class="btn">Aceptar</button></div>
            </div>
          `,
            () => {
              $("#ok-done").addEventListener("click", () => {
                closeModal();
                STATE.workoutSession = null;
                go(Views.HOME);
              });
            }
          );
        });
      }
    );
  });
}

/* -------- Navegación con animación EXACTA -------- */
function navigateWorkout(dir) {
  const s = STATE.workoutSession;
  const oldIdx = s.currentIndex;
  const newIdx = dir === "next" ? Math.min(s.items.length - 1, oldIdx + 1) : Math.max(0, oldIdx - 1);
  if (newIdx === oldIdx) return;

  const stage = $("#exercise-stage");
  const oldEl = stage.firstElementChild;
  if (!oldEl) return;

  // EXACTO a lo que pediste:
  // next: sale a la IZQUIERDA, entra desde la DERECHA
  // prev: sale a la DERECHA, entra desde la IZQUIERDA
  const outClass = dir === "next" ? "slide-exit-left" : "slide-exit-right";

  const item = s.items[newIdx];
  const temp = document.createElement("div");
  temp.innerHTML = workoutCardHTML(item, newIdx, s.items.length);
  const newEl = temp.firstElementChild;
  const inClass = dir === "next" ? "slide-enter-right" : "slide-enter-left";

  oldEl.classList.add(outClass);
  newEl.classList.add(inClass);
  stage.appendChild(newEl);

  const onDone = () => {
    oldEl.remove();
    s.currentIndex = newIdx;
    updateWorkoutHeader();
    updateFinishCard();
    attachWorkoutHandlers(newEl, item);
  };
  newEl.addEventListener("animationend", onDone, { once: true });
}

/* -------- Persistencia rápida -------- */
const debounceMap = new Map();
function debounce(fn, key, wait = 300) {
  clearTimeout(debounceMap.get(key));
  const t = setTimeout(fn, wait);
  debounceMap.set(key, t);
}
function persistSet(rexId, setId, reps, peso) {
  const rid = STATE.currentRoutineId;
  const body = { exercises: [{ id: rexId, sets: [{ id: setId, reps, peso }] }] };
  return api(`/api/routines/${rid}`, { method: "PUT", body: JSON.stringify(body) }).catch(() => {});
}

/* -------- Handlers de una tarjeta -------- */
function attachWorkoutHandlers(cardEl, item) {
  const s = STATE.workoutSession;

  const prev = cardEl.querySelector("#wo-prev");
  const next = cardEl.querySelector("#wo-next");
  if (prev) prev.addEventListener("click", () => navigateWorkout("prev"));
  if (next) next.addEventListener("click", () => navigateWorkout("next"));

  item.sets.forEach((st) => {
    const reps = cardEl.querySelector(`[data-reps="${st.id}"]`);
    const peso = cardEl.querySelector(`[data-peso="${st.id}"]`);
    const tog  = cardEl.querySelector(`[data-toggle="${st.id}"]`);
    if (reps) reps.addEventListener("input", (ev) => {
      st.reps = ev.target.value === "" ? null : parseInt(ev.target.value, 10);
      debounce(() => persistSet(item.rexId, st.id, st.reps, st.peso), `reps:${st.id}`);
    });
    if (peso) peso.addEventListener("input", (ev) => {
      st.peso = ev.target.value === "" ? null : parseFloat(ev.target.value);
      debounce(() => persistSet(item.rexId, st.id, st.reps, st.peso), `peso:${st.id}`);
    });
    if (tog) tog.addEventListener("click", () => {
      st.done = !st.done;
      tog.classList.toggle("complete", st.done);
      navigator.vibrate?.(30);
      checkAutoNext(s, item);
      updateWorkoutHeader();
    });
  });
}

/* Auto-siguiente al completar todas las series */
function checkAutoNext(sess, item) {
  const allDone = item.sets.length > 0 && item.sets.every((x) => x.done);
  const last = sess.currentIndex === sess.items.length - 1;
  if (allDone && !last) {
    setTimeout(() => navigateWorkout("next"), 220);
  }
}

/* ---------- MARKS ---------- */
async function renderMarks() {
  showFAB(false);
  const marks = await api("/api/marks");
  appEl.innerHTML = `
    <header class="header">
      <div class="title-row">
        <button class="back-btn" id="back-home-marks">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg>
          <span>Inicio</span>
        </button>
        <div class="app-title"><div>MIS MARCAS</div></div>
        <span class="space"></span>
      </div>
    </header>

    ${
      marks.length === 0
        ? `
      <div class="empty card">
        <p><strong>Todavía no hay marcas.</strong></p>
        <p>Cuando completes entrenamientos, verás aquí tus mejores pesos.</p>
      </div>`
        : `<section class="grid">
        ${marks.map((m) => `
          <article class="card">
            <div class="exercise-card">
              ${m.image ? `<img class="thumb" src="${m.image}" alt="${escapeHtml(m.name)}">` : `<div class="thumb">🏋️</div>`}
              <div class="info">
                <h3 style="margin:0 0 4px">${escapeHtml(m.name)}</h3>
                <div class="small">${m.bodyPart || ""}</div>
                <div class="small">PR: <strong>${m.pr_weight}</strong> kg • Reps con PR: <strong>${m.reps_at_pr}</strong></div>
              </div>
            </div>
          </article>
        `).join("")}
      </section>`
    }
  `;
  $("#back-home-marks").addEventListener("click", () => go(Views.HOME));
}

/* ---------- Arranque ---------- */
render();
FAB.addEventListener("click", () => openCreateRoutine());

/* ---------------- Router ---------------- */
async function render() {
  if (STATE.view === Views.HOME) return renderHome();
  if (STATE.view === Views.ROUTINES) return renderRoutines();
  if (STATE.view === Views.EDIT) return renderEditRoutine(STATE.currentRoutineId);
  if (STATE.view === Views.WORKOUT) return renderWorkout();
  if (STATE.view === Views.MARKS) return renderMarks();
}

/* ---------- HOME ---------- */
function renderHome() {
  showFAB(false);
  appEl.innerHTML = `
    <header class="header">
      <div class="title-row">
        <div class="app-title">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M13 3h-2l-1 4H6a2 2 0 0 0-2 2v3h2V9h3l1 4h2l-1-4h3v3h2V9a2 2 0 0 0-2-2h-4l-1-4zM4 14v3a2 2 0 0 0 2 2h4l1 4h2l-1-4h4a2 2 0 0 0 2-2v-3h-2v3h-4l-1 4h-2l-1-4H6v-3H4z"/>
          </svg>
          <div>
            <div>GymBuddy</div>
            <div class="app-sub">Entrenamiento funcional • 2025</div>
          </div>
        </div>
      </div>
    </header>

    <section class="hero-grid">
      <article class="hero-card" id="card-train">
        <div class="bg" style="background-image:url('https://images.unsplash.com/photo-1586401100295-7a8096fd231a?q=80&w=1600&auto=format&fit=crop');"></div>
        <div class="overlay"></div>
        <div class="label">ENTRENAR AHORA</div>
      </article>

      <article class="hero-card" id="card-marks">
        <div class="bg" style="background-image:url('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=1600&auto=format&fit=crop');"></div>
        <div class="overlay"></div>
        <div class="label">MIS MARCAS</div>
      </article>
    </section>
  `;
  $("#card-train").addEventListener("click", () => go(Views.ROUTINES));
  $("#card-marks").addEventListener("click", () => go(Views.MARKS));
}

/* ---------- ROUTINES LIST ---------- */
async function renderRoutines() {
  showFAB(true);
  const routines = await api("/api/routines");
  appEl.innerHTML = `
    <header class="header">
      <div class="title-row">
        <button class="back-btn" id="back-home">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg>
          <span>Inicio</span>
        </button>
        <div class="app-title"><div>MIS RUTINAS</div></div>
        <span class="space"></span>
      </div>
    </header>

    ${
      routines.length === 0
        ? `
      <div class="empty card">
        <p><strong>¿Sin rutinas aún?</strong></p>
        <p>Crea y registra tus entrenamientos.</p>
        <div class="cta"><button class="btn" id="cta-new">Crea tu primera rutina</button></div>
      </div>
    `
        : `
      <section class="grid">
        ${routines.map((r) => RoutineCard(r)).join("")}
      </section>
    `
    }
  `;
  $("#back-home").addEventListener("click", () => go(Views.HOME));
  const cta = $("#cta-new");
  if (cta) cta.addEventListener("click", openCreateRoutine);
  $$("[data-edit]").forEach((el) =>
    el.addEventListener("click", () => {
      STATE.currentRoutineId = el.getAttribute("data-edit");
      go(Views.EDIT);
    })
  );
  $$("[data-play]").forEach((el) =>
    el.addEventListener("click", () => startWorkout(el.getAttribute("data-play")))
  );
}
function RoutineCard(r) {
  const totalSets = (r.exercises || []).reduce((acc, e) => acc + e.sets.length, 0);
  return `
  <article class="card">
    <div class="row" style="align-items:center">
      <div style="width:54px;height:54px;border-radius:16px;background:#0e0f13;display:grid;place-items:center;border:1px solid var(--ring)">
        <span class="kbd">${r.exercises.length || 0}</span>
      </div>
      <div style="flex:1">
        <h3 style="margin:0 0 4px">${escapeHtml(r.name)}</h3>
        <div class="small">${totalSets} series • actualizado ${fmtDate(r.updatedAt)}</div>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn icon secondary" aria-label="Editar rutina" data-edit="${r.id}" title="Editar (⚙️)">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M19.14,12.94a7.14,7.14,0,0,0,.05-1l1.67-1.3a.5.5,0,0,0,.12-.64l-1.58-2.73a.5.5,0,0,0-.6-.22l-2,.8a6.81,6.81,0,0,0-1.73-1l-.3-2.1a.5.5,0,0,0-.5-.42H10.73a.5.5,0,0,0-.5.42l-.3,2.1a6.81,6.81,0,0,0-1.73,1l-2-.8a.5.5,0,0,0-.6.22L3,10a.5.5,0,0,0,.12.64L4.79,12a7.14,7.14,0,0,0,0,2L3.14,15.3A.5.5,0,0,0,3,15.94l1.58,2.73a.5.5,0,0,0,.6.22l2-.8a6.81,6.81,0,0,0,1.73,1l.3,2.1a.5.5,0,0,0,.5.42h3.06a.5.5,0,0,0,.5-.42l.3-2.1a6.81,6.81,0,0,0,1.73-1l2,.8a.5.5,0,0,0,.6-.22l1.58-2.73a.5.5,0,0,0-.12-.64Z"/>
          </svg>
        </button>
        <button class="btn icon" aria-label="Empezar entrenamiento" data-play="${r.id}" title="Empezar (▶)">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
    </div>
  </article>`;
}
function openCreateRoutine() {
  showModal(
    "Nueva rutina",
    `
    <div class="row" style="gap:10px">
      <input id="rut-name" class="input" placeholder="Nombre de la rutina (p.ej. 'Full body A')" />
      <button id="rut-save" class="btn">Guardar</button>
    </div>
  `,
    () => {
      $("#rut-save").addEventListener("click", async () => {
        const name = ($("#rut-name").value || "").trim();
        if (!name) return $("#rut-name").focus();
        await api("/api/routines", { method: "POST", body: JSON.stringify({ name }) });
        closeModal();
        go(Views.ROUTINES);
      });
    }
  );
}

/* ---------- EDIT ROUTINE ---------- */
async function renderEditRoutine(routineId) {
  showFAB(false);
  const r = await api(`/api/routines/${routineId}`);
  appEl.innerHTML = `
    <header class="header">
      <div class="title-row">
        <button class="back-btn" id="back-routines">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg>
          <span>Mis rutinas</span>
        </button>
        <div class="app-title">
          <button id="rename" class="icon-btn ghost" style="display:flex;gap:8px;align-items:center">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
            <span id="rname" style="font-weight:800">${escapeHtml(r.name)}</span>
          </button>
        </div>
        <span class="space"></span>
      </div>
    </header>

    <section class="grid">
      ${
        (r.exercises || []).length === 0
          ? `
        <div class="empty card">
          <p><strong>Ningún ejercicio añadido aún.</strong></p>
          <p>Usa “Añadir ejercicios” para buscar por grupo muscular o nombre.</p>
        </div>`
          : r.exercises.map((x) => EditExerciseCard(r, x)).join("")
      }
    </section>

    <div class="row" style="justify-content:center;margin-top:14px">
      <button id="add-ex" class="btn secondary">Añadir ejercicios</button>
      <button id="save-routine" class="btn">Guardar cambios</button>
    </div>
    <div class="footer-safe"></div>
  `;

  $("#back-routines").addEventListener("click", () => go(Views.ROUTINES));
  $("#add-ex").addEventListener("click", () => openExercisePicker(r.id, () => renderEditRoutine(r.id)));
  $("#save-routine").addEventListener("click", async () => {
    const payload = collectRoutineFromDOM(r);
    await api(`/api/routines/${r.id}`, { method: "PUT", body: JSON.stringify(payload) });
    go(Views.ROUTINES);
  });
  $("#rename").addEventListener("click", () => {
    showModal(
      "Renombrar rutina",
      `
      <div class="row">
        <input id="newname" class="input" placeholder="Nombre de la rutina" value="${escapeHtml(r.name)}">
        <button id="ok" class="btn">Aceptar</button>
      </div>
    `,
      () => {
        $("#ok").addEventListener("click", async () => {
          const nv = ($("#newname").value || "").trim();
          if (!nv) return;
          await api(`/api/routines/${r.id}`, { method: "PUT", body: JSON.stringify({ name: nv }) });
          closeModal();
          renderEditRoutine(r.id);
        });
      }
    );
  });
}

function EditExerciseCard(r, x) {
  const ex = x.exercise;
  const img = ex?.image
    ? `<img class="thumb" src="${ex.image}" alt="${escapeHtml(ex.name)}">`
    : `<div class="thumb">🏋️</div>`;
  return `
  <article class="card" data-rex="${x.id}">
    <div class="exercise-card">
      ${img}
      <div class="info">
        <h3 style="margin:0 0 4px">${escapeHtml(ex?.name || "Ejercicio")}</h3>
        <div class="small">${ex?.bodyPart || "—"} • <span class="small">${ex?.equipment || ""}</span></div>
      </div>
    </div>
    <div class="sets">
      ${(x.sets || [])
        .map(
          (s) => `
        <div class="set" data-set="${s.id}">
          <input class="inp-reps" inputmode="numeric" type="number" min="0" placeholder="reps" value="${s.reps ?? ""}">
          <input class="inp-peso" inputmode="decimal" type="number" step="0.5" min="0" placeholder="peso" value="${s.peso ?? ""}">
          <button class="icon-btn remove" aria-label="Eliminar serie">🗑️</button>
        </div>
      `
        )
        .join("")}
      <div class="row">
        <button class="btn add-set">Añadir serie</button>
        <button class="btn secondary remove-ex">Quitar ejercicio</button>
      </div>
    </div>
  </article>`;
}
function collectRoutineFromDOM(r) {
  const exCards = $$("article.card[data-rex]");
  const exercises = exCards.map((card) => {
    const rexId = card.getAttribute("data-rex");
    const sets = $$(".set", card).map((row) => {
      const repsVal = $(".inp-reps", row).value;
      const pesoVal = $(".inp-peso", row).value;
      return {
        id: row.getAttribute("data-set"),
        reps: repsVal === "" ? null : parseInt(repsVal, 10),
        peso: pesoVal === "" ? null : parseFloat(pesoVal),
      };
    });
    return { id: rexId, sets };
  });
  return { exercises };
}

document.addEventListener("click", async (ev) => {
  const t = ev.target;
  if (t.classList.contains("add-set")) {
    const card = t.closest("article.card[data-rex]");
    const rexId = card.getAttribute("data-rex");
    await api(`/api/routines/${STATE.currentRoutineId}/exercises/${rexId}/sets`, {
      method: "POST",
      body: JSON.stringify({ reps: null, peso: null }),
    });
    renderEditRoutine(STATE.currentRoutineId);
  }
  if (t.classList.contains("remove-ex")) {
    const card = t.closest("article.card[data-rex]");
    const rexId = card.getAttribute("data-rex");
    await api(`/api/routines/${STATE.currentRoutineId}/exercises/${rexId}`, { method: "DELETE" });
    renderEditRoutine(STATE.currentRoutineId);
  }
  if (t.classList.contains("remove")) {
    const row = t.closest(".set");
    const setId = row.getAttribute("data-set");
    const rexCard = t.closest("article.card[data-rex]");
    const rexId = rexCard.getAttribute("data-rex");
    await api(`/api/routines/${STATE.currentRoutineId}/exercises/${rexId}/sets/${setId}`, { method: "DELETE" });
    renderEditRoutine(STATE.currentRoutineId);
  }
});

/* ---------- EXERCISE PICKER ---------- */
async function openExercisePicker(routineId, onAfter) {
  const groups = await api("/api/exercises/groups");
  showModal(
    "Añadir ejercicios",
    `
    <div class="row" style="gap:8px; margin-bottom:8px">
      <input id="search" class="input" placeholder="Buscar por nombre (p.ej. 'sentadilla', 'press banca')">
    </div>
    <div class="chips" id="chips">
      <span class="chip active" data-group="*">Todos</span>
      ${groups.map((g) => `<span class="chip" data-group="${escapeHtml(g)}">${escapeHtml(g)}</span>`).join("")}
    </div>
    <div class="row" style="justify-content:space-between;align-items:center;margin:8px 0">
      <div class="small">Filtra por grupo o busca por texto</div>
      <button id="new-ex" class="btn secondary">+ Crear ejercicio</button>
    </div>
    <div class="grid" id="ex-grid"></div>
  `,
    async () => {
      let state = { q: "", group: "*" };
      const search = $("#search");
      const chips = $$("#chips .chip");
      const grid = $("#ex-grid");

      async function renderGrid() {
        const list = await api(
          `/api/exercises?group=${encodeURIComponent(state.group)}&q=${encodeURIComponent(state.q)}`
        );
        grid.innerHTML = list
          .map(
            (e) => `
        <article class="card">
          <div class="exercise-card">
            ${
              e.image
                ? `<img class="thumb" src="${e.image}" alt="${escapeHtml(e.name)}">`
                : `<div class="thumb">🏋️</div>`
            }
            <div class="info">
              <h3 style="margin:0 0 6px">${escapeHtml(e.name)}</h3>
              <div class="small">${e.bodyPart || ""} • <span class="small">${e.equipment || ""}</span></div>
              <div class="small">${e.primaryMuscles || ""}${e.secondaryMuscles ? " • " + e.secondaryMuscles : ""}</div>
            </div>
            <div class="row">
              <button class="btn" data-add="${e.id}">Añadir</button>
            </div>
          </div>
        </article>
      `
          )
          .join("");
        $$("[data-add]", grid).forEach((btn) =>
          btn.addEventListener("click", async () => {
            await api(`/api/routines/${routineId}/exercises`, {
              method: "POST",
              body: JSON.stringify({ exerciseId: btn.getAttribute("data-add") }),
            });
            closeModal();
            if (onAfter) onAfter();
          })
        );
      }

      search.addEventListener("input", () => {
        state.q = search.value.trim().toLowerCase();
        renderGrid();
      });
      chips.forEach((ch) =>
        ch.addEventListener("click", () => {
          chips.forEach((x) => x.classList.remove("active"));
          ch.classList.add("active");
          state.group = ch.getAttribute("data-group");
          renderGrid();
        })
      );
      $("#new-ex").addEventListener("click", () => openCreateExerciseForm(onAfter));
      renderGrid();
    }
  );
}
function openCreateExerciseForm(onSaved) {
  showModal(
    "Crear ejercicio",
    `
    <div class="grid">
      <div class="card"><label>Nombre</label><input id="ex-name" class="input" placeholder="p.ej. Dominadas pronas"></div>
      <div class="card"><label>URL de imagen</label><input id="ex-img" class="input" placeholder="https://..."></div>
      <div class="card"><label>Grupo muscular primario</label><input id="ex-body" class="input" placeholder="p.ej. Espalda"></div>
      <div class="card"><label>Músculos primarios</label><input id="ex-primary" class="input" placeholder="p.ej. Latissimus Dorsi"></div>
      <div class="card"><label>Músculos secundarios</label><input id="ex-secondary" class="input" placeholder="p.ej. Biceps Brachii"></div>
      <div class="card"><label>Equipo</label><input id="ex-eq" class="input" placeholder="p.ej. Barra, Mancuernas..."></div>
    </div>
    <div class="row" style="margin-top:12px">
      <button id="save-custom-ex" class="btn">Guardar ejercicio</button>
      <button id="cancel-custom-ex" class="btn secondary">Cancelar</button>
    </div>
  `,
    () => {
      $("#save-custom-ex").addEventListener("click", async () => {
        const payload = {
          name: $("#ex-name").value,
          image: $("#ex-img").value,
          bodyPart: $("#ex-body").value,
          primaryMuscles: $("#ex-primary").value,
          secondaryMuscles: $("#ex-secondary").value,
          equipment: $("#ex-eq").value,
        };
        if (!payload.name.trim()) {
          $("#ex-name").focus();
          return;
        }
        await api("/api/exercises", { method: "POST", body: JSON.stringify(payload) });
        closeModal();
        if (typeof onSaved === "function") onSaved();
      });
      $("#cancel-custom-ex").addEventListener("click", closeModal);
    }
  );
}

/* ---------- WORKOUT ---------- */
async function startWorkout(routineId) {
  const r = await api(`/api/routines/${routineId}`);
  if (!r || (r.exercises || []).length === 0) {
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
    items: r.exercises.map((x) => ({
      rexId: x.id,                     // <-- para guardar al vuelo
      exerciseId: x.exercise.id,
      name: x.exercise.name,
      image: x.exercise.image,
      bodyPart: x.exercise.bodyPart,
      sets: (x.sets || []).map((s) => ({ id: s.id, reps: s.reps, peso: s.peso, done: false })),
    })),
  };
  go(Views.WORKOUT);
  startStopwatch();
}

function startStopwatch() {
  const s = STATE.workoutSession;
  if (STATE.stopwatchTimer) clearInterval(STATE.stopwatchTimer);
  STATE.stopwatchTimer = setInterval(() => {
    s.durationSec = Math.floor((Date.now() - s.startedAt) / 1000);
    const el = $("#clock");
    if (el) el.textContent = fmtDuration(s.durationSec);
  }, 1000);
}
function stopStopwatch() { if (STATE.stopwatchTimer) { clearInterval(STATE.stopwatchTimer); STATE.stopwatchTimer = null; } }
function fmtDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${h > 0 ? String(h).padStart(2, "0") + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function completedSetsCount(sess) { return sess.items.reduce((acc, it) => acc + it.sets.filter((s) => s.done).length, 0); }
function maxSetsCount(sess) { return sess.items.reduce((acc, it) => acc + it.sets.length, 0) || 1; }

/* Stage helpers */
function workoutCardHTML(item, idx, total) {
  return `
    <article class="card workout-card" data-index="${idx}">
      <div class="nav-top">
        ${idx > 0 ? `<button class="nav-btn" id="wo-prev"><svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg> Anterior</button>` : `<span></span>`}
        <div class="spacer"></div>
        ${idx < total - 1 ? `<button class="nav-btn" id="wo-next">Siguiente <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M9 5l7 7-7 7"/></svg></button>` : `<span></span>`}
      </div>

      <div class="exercise-card">
        ${ item.image ? `<img class="thumb" src="${item.image}" alt="${escapeHtml(item.name)}">` : `<div class="thumb">🏋️</div>` }
        <div class="info">
          <h3 style="margin:0 0 6px">${escapeHtml(item.name)}</h3>
          <div class="small">${item.bodyPart || ""}</div>
        </div>
      </div>

      <div class="sets">
        ${item.sets.map((s) => `
          <div class="set">
            <input inputmode="numeric" type="number" min="0" placeholder="Reps" value="${s.reps ?? ""}" data-reps="${s.id}">
            <input inputmode="decimal" type="number" step="0.5" min="0" placeholder="Peso (kg)" value="${s.peso ?? ""}" data-peso="${s.id}">
            <div class="toggle ${s.done ? "complete" : ""}" data-toggle="${s.id}" title="${s.done ? "Completada" : "Incompleta"}">
              <span class="check">✓</span>
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderWorkout() {
  showFAB(false);
  const sess = STATE.workoutSession;
  const total = sess.items.length;
  const idx = sess.currentIndex;
  const item = sess.items[idx];
  const progress = Math.round((100 * completedSetsCount(sess)) / Math.max(1, maxSetsCount(sess)));

  appEl.innerHTML = `
    <header class="workout-header">
      <div class="title-row">
        <button class="back-btn" id="back-routines-wo">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg>
          <span>Mis rutinas</span>
        </button>
        <div>
          <div class="workout-title">Entrenamiento</div>
          <div class="workout-sub"><span id="wo-counter">${idx + 1}</span> de <span id="wo-total">${total}</span></div>
        </div>
        <div class="workout-progress">
          <span id="wo-progress">${progress}%</span>
          <span class="stopwatch" id="clock">${fmtDuration(sess.durationSec || 0)}</span>
        </div>
      </div>
    </header>

    <section class="grid">
      <div id="exercise-stage" class="exercise-shell"></div>
      <div id="finish-container"></div>
    </section>
  `;

  $("#back-routines-wo").addEventListener("click", () => go(Views.ROUTINES));

  // Primera tarjeta sin animación
  const stage = $("#exercise-stage");
  stage.innerHTML = workoutCardHTML(item, idx, total);
  attachWorkoutHandlers(stage.firstElementChild, item);

  updateFinishCard();
}

function updateWorkoutHeader() {
  const s = STATE.workoutSession;
  const progress = Math.round((100 * completedSetsCount(s)) / Math.max(1, maxSetsCount(s)));
  const counter = $("#wo-counter"); if (counter) counter.textContent = String(s.currentIndex + 1);
  const prog = $("#wo-progress"); if (prog) prog.textContent = `${progress}%`;
}

function updateFinishCard() {
  const s = STATE.workoutSession;
  const total = s.items.length;
  const idx = s.currentIndex;
  const cont = $("#finish-container");
  cont.innerHTML = idx === total - 1 ? `
    <article class="card">
      <div class="exercise-card">
        <div class="info">
          <h3 style="margin:0 0 4px">Último ejercicio listo</h3>
          <p class="small">Pulsa para finalizar tu sesión</p>
        </div>
        <div class="row"><button class="btn" id="wo-finish">Finalizar entrenamiento</button></div>
      </div>
    </article>
  ` : "";

  const fin = $("#wo-finish");
  if (fin) fin.addEventListener("click", () => {
    showModal(
      "Confirmar",
      `
      <div class="card">
        <p>¿Quieres finalizar el entrenamiento?</p>
        <div class="row" style="justify-content:center;margin-top:10px">
          <button class="btn secondary" id="resume">Reanudar</button>
          <button class="btn" id="confirm-finish">Finalizar entrenamiento</button>
        </div>
      </div>
    `,
      () => {
        $("#resume").addEventListener("click", closeModal);
        $("#confirm-finish").addEventListener("click", async () => {
          closeModal();
          stopStopwatch();
          STATE.workoutSession.finishedAt = Date.now();
          await api("/api/workouts", { method: "POST", body: JSON.stringify(STATE.workoutSession) });
          showModal(
            "BIEN TRABAJADO",
            `
            <div class="card" style="text-align:center">
              <h3>BIEN TRABAJADO</h3>
              <p>Duración: ${fmtDuration(STATE.workoutSession.durationSec)}</p>
              <div class="row" style="justify-content:center;margin-top:10px"><button id="ok-done" class="btn">Aceptar</button></div>
            </div>
          `,
            () => {
              $("#ok-done").addEventListener("click", () => {
                closeModal();
                STATE.workoutSession = null;
                go(Views.HOME);
              });
            }
          );
        });
      }
    );
  });
}

/* Swap de tarjeta con animación y re-binding de handlers */
function navigateWorkout(dir) {
  const s = STATE.workoutSession;
  const oldIdx = s.currentIndex;
  const newIdx = dir === "next" ? Math.min(s.items.length - 1, oldIdx + 1) : Math.max(0, oldIdx - 1);
  if (newIdx === oldIdx) return;

  const stage = $("#exercise-stage");
  const oldEl = stage.firstElementChild;
  if (!oldEl) return;

  const outClass = dir === "next" ? "slide-exit-left" : "slide-exit-right";
  oldEl.classList.add(outClass);

  const item = s.items[newIdx];
  const temp = document.createElement("div");
  temp.innerHTML = workoutCardHTML(item, newIdx, s.items.length);
  const newEl = temp.firstElementChild;
  const inClass = dir === "next" ? "slide-enter-right" : "slide-enter-left";
  newEl.classList.add(inClass);
  stage.appendChild(newEl);

  const onDone = () => {
    oldEl.remove();
    s.currentIndex = newIdx;
    updateWorkoutHeader();
    updateFinishCard();
    attachWorkoutHandlers(newEl, item);
  };
  newEl.addEventListener("animationend", onDone, { once: true });
}

/* Persistencia rápida del set (PUT granular) */
const debounceMap = new Map();
function debounce(fn, key, wait = 300) {
  clearTimeout(debounceMap.get(key));
  const t = setTimeout(fn, wait);
  debounceMap.set(key, t);
}
function persistSet(rexId, setId, reps, peso) {
  const rid = STATE.currentRoutineId;
  const body = { exercises: [{ id: rexId, sets: [{ id: setId, reps, peso }] }] };
  return api(`/api/routines/${rid}`, { method: "PUT", body: JSON.stringify(body) }).catch(() => {});
}

/* Añade listeners a inputs/toggles de una tarjeta */
function attachWorkoutHandlers(cardEl, item) {
  const s = STATE.workoutSession;

  const prev = cardEl.querySelector("#wo-prev");
  const next = cardEl.querySelector("#wo-next");
  if (prev) prev.addEventListener("click", () => navigateWorkout("prev"));
  if (next) next.addEventListener("click", () => navigateWorkout("next"));

  // Inputs: actualizan modelo y guardan al vuelo (debounced)
  item.sets.forEach((st) => {
    const reps = cardEl.querySelector(`[data-reps="${st.id}"]`);
    const peso = cardEl.querySelector(`[data-peso="${st.id}"]`);
    const tog  = cardEl.querySelector(`[data-toggle="${st.id}"]`);
    if (reps) reps.addEventListener("input", (ev) => {
      st.reps = ev.target.value === "" ? null : parseInt(ev.target.value, 10);
      debounce(() => persistSet(item.rexId, st.id, st.reps, st.peso), `reps:${st.id}`);
    });
    if (peso) peso.addEventListener("input", (ev) => {
      st.peso = ev.target.value === "" ? null : parseFloat(ev.target.value);
      debounce(() => persistSet(item.rexId, st.id, st.reps, st.peso), `peso:${st.id}`);
    });
    if (tog) tog.addEventListener("click", () => {
      st.done = !st.done;
      tog.classList.toggle("complete", st.done);
      checkAutoNext(s, item);
      updateWorkoutHeader();
    });
  });
}

/* Auto-siguiente: si todas las series del ejercicio están completas, pasa al siguiente */
function checkAutoNext(sess, item) {
  const allDone = item.sets.length > 0 && item.sets.every((x) => x.done);
  const last = sess.currentIndex === sess.items.length - 1;
  if (allDone && !last) {
    setTimeout(() => navigateWorkout("next"), 220);
  }
}

/* ---------- MARKS ---------- */
async function renderMarks() {
  showFAB(false);
  const marks = await api("/api/marks");
  appEl.innerHTML = `
    <header class="header">
      <div class="title-row">
        <button class="back-btn" id="back-home-marks">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M15 19l-7-7 7-7"/></svg>
          <span>Inicio</span>
        </button>
        <div class="app-title"><div>MIS MARCAS</div></div>
        <span class="space"></span>
      </div>
    </header>

    ${
      marks.length === 0
        ? `
      <div class="empty card">
        <p><strong>Todavía no hay marcas.</strong></p>
        <p>Cuando completes entrenamientos, verás aquí tus mejores pesos.</p>
      </div>`
        : `<section class="grid">
        ${marks.map((m) => `
          <article class="card">
            <div class="exercise-card">
              ${m.image ? `<img class="thumb" src="${m.image}" alt="${escapeHtml(m.name)}">` : `<div class="thumb">🏋️</div>`}
              <div class="info">
                <h3 style="margin:0 0 4px">${escapeHtml(m.name)}</h3>
                <div class="small">${m.bodyPart || ""}</div>
                <div class="small">PR: <strong>${m.pr_weight}</strong> kg • Reps con PR: <strong>${m.reps_at_pr}</strong></div>
              </div>
            </div>
          </article>
        `).join("")}
      </section>`
    }
  `;
  $("#back-home-marks").addEventListener("click", () => go(Views.HOME));
}

/* ---------- Arranque ---------- */
render();

