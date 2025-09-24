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

  // API robusta: soporta 204/Texto/JSON
  function api(path, opts){
    opts = opts || {};
    var h = opts.headers || {};
    if (!('Content-Type' in h) && opts.method && opts.method !== 'GET') {
      h["Content-Type"]="application/json";
    }
    var o={}; for(var k in opts) o[k]=opts[k];
    o.headers=h;

    return fetch(API + path, o).then(function(r){
      if (!r.ok) throw new Error("API " + r.status);
      if (r.status === 204) return null;
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('application/json') !== -1) return r.json();
      return r.text().then(function(t){ return t || null; });
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
    '  <svg class="brand-icon" width="22" height="22" viewBox="0 0 64 64"
