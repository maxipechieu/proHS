(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var C = window.CATALOG;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var T = function (f) { return 'assets/img/thumb/' + f + '.jpg'; };
  var F = function (f) { return 'assets/img/full/' + f + '.jpg'; };

  /* ---------- progreso y nav ---------- */
  var prog = $('#prog'), nav = $('#nav');
  function onScroll() {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    prog.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    nav.classList.toggle('stuck', h.scrollTop > 30);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- reveal ---------- */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  $$('.rv').forEach(function (n) { io.observe(n); });

  /* ---------- contadores ---------- */
  var cio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return; cio.unobserve(e.target);
      var n = e.target, to = +n.dataset.count, plus = n.dataset.plus || '', t0 = null, dur = 1400;
      if (reduce) { n.textContent = to + plus; return; }
      (function step(t) {
        if (!t0) t0 = t; var p = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
        n.textContent = v + (p === 1 ? plus : ''); if (p < 1) requestAnimationFrame(step);
      })(performance.now());
    });
  }, { threshold: .5 });
  $$('[data-count]').forEach(function (n) { cio.observe(n); });

  /* ---------- rotador de palabras ---------- */
  var words = ['los incidentes', 'los extintores', 'las capacitaciones', 'los permisos de trabajo', 'la ART del personal', 'las entregas de EPP', 'los residuos', 'las auditorías'];
  var rot = $('#rot'), wi = 0, ci = 0, del = false;
  (function type() {
    var w = words[wi];
    if (reduce) { rot.textContent = words[0]; return; }
    rot.textContent = w.slice(0, ci);
    if (!del && ci === w.length) { del = true; return setTimeout(type, 1500); }
    if (del && ci === 0) { del = false; wi = (wi + 1) % words.length; }
    ci += del ? -1 : 1; setTimeout(type, del ? 28 : 62);
  })();

  /* ---------- marquee ---------- */
  var norms = ['Ley 19.587', 'Decreto 351/79', 'Decreto 911/96', 'Ley 24.557', 'Res. SRT 299/11', 'Res. SRT 463/09', 'Res. SRT 295/03', 'Res. SRT 37/10', 'Res. SRT 503/14', 'Res. SRT 550/11', 'Res. SRT 61/2023', 'ISO 9001:2015', 'ISO 45001', 'ISO 14001'];
  var mq = $('#marq'), mh = '';
  for (var k = 0; k < 2; k++) norms.forEach(function (n) { mh += '<span><i class="fa-solid fa-circle-check"></i>' + n + '</span>'; });
  mq.innerHTML = mh;

  /* ---------- hero carrusel + tilt ---------- */
  var hs = $$('#hslides img'), hi = 0, hwin = $('#hwin');
  if (!reduce) setInterval(function () {
    hs[hi].classList.remove('on'); hi = (hi + 1) % hs.length; hs[hi].classList.add('on'); hwin.textContent = 'proHS · ' + hs[hi].dataset.win;
  }, 4200);
  var tilt = $('#tilt'), st = $('#stage3d');
  if (!reduce && matchMedia('(hover:hover)').matches) {
    st.addEventListener('mousemove', function (e) {
      var r = st.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      tilt.style.transform = 'rotateY(' + (x * 9) + 'deg) rotateX(' + (-y * 7) + 'deg)';
    });
    st.addEventListener('mouseleave', function () { tilt.style.transform = ''; });
  }

  /* ---------- explorador ---------- */
  var tabs = $('#tabs'), grid = $('#mgrid'), blurb = $('#blurb'), curCat = null;
  function catOf(id) { return C.cats.filter(function (c) { return c.id === id; })[0]; }
  C.cats.forEach(function (c) {
    var n = C.mods.filter(function (m) { return m.cat === c.id; }).length;
    var b = el('button', 'tab', '<i class="fa-solid ' + c.icon + '"></i>' + esc(c.name) + ' <em>' + n + '</em>');
    b.style.setProperty('--c', c.color); b.dataset.cat = c.id;
    b.addEventListener('click', function () { show(c.id); });
    tabs.appendChild(b);
  });
  function slidesFor(cat) {
    var out = [], starts = {};
    C.mods.filter(function (m) { return m.cat === cat; }).forEach(function (m) {
      starts[m.id] = out.length;
      m.shots.forEach(function (s) { out.push({ src: F(s.img), title: m.title, win: s.win, cap: s.cap, desc: m.desc, ex: null, color: catOf(cat).color }); });
      if (m.pdf) out.push({ src: 'assets/img/pdf/' + m.pdf + '.jpg', title: m.title + ' · Informe PDF', win: 'Primera página del informe', cap: 'Informe generado por el módulo con datos de ejemplo.', desc: m.desc, ex: m.ex || null });
    });
    return { slides: out, starts: starts };
  }
  function show(id) {
    curCat = id; var c = catOf(id);
    $$('.tab', tabs).forEach(function (t) { t.classList.toggle('on', t.dataset.cat === id); });
    blurb.textContent = c.blurb; grid.innerHTML = '';
    var pack = slidesFor(id), mods = C.mods.filter(function (m) { return m.cat === id; });
    mods.forEach(function (m, i) {
      var card = el('article', 'card');
      card.style.setProperty('--c', c.color); card.style.animationDelay = (i * 60) + 'ms';
      card.innerHTML = '<div class="th"><img src="' + T(m.shots[0].img) + '" alt="' + esc(m.title) + '" loading="lazy">' +
        '<div class="badge">' + (m.pdf ? '<span class="pdf"><i class="fa-solid fa-file-pdf"></i> PDF</span>' : '') + (m.shots.length > 1 ? '<span><i class="fa-regular fa-images"></i> ' + (m.shots.length + (m.pdf ? 1 : 0)) + '</span>' : '') + '</div>' +
        '<div class="zm"><i class="fa-solid fa-magnifying-glass-plus"></i> Ver grande</div></div>' +
        '<div class="bd"><h3><i class="fa-solid ' + m.icon + '"></i>' + esc(m.title) + '</h3><p>' + esc(m.desc) + '</p>' +
        '<div class="ch">' + m.chips.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div></div>';
      card.addEventListener('click', function () { LB.open(pack.slides, pack.starts[m.id]); });
      grid.appendChild(card);
    });
    var amb = $('#ambbox'); amb.style.display = id === 'ambiente' ? 'block' : 'none';
    if (id === 'ambiente') {
      var amod = C.mods.filter(function (m) { return m.id === 'ambgest'; })[0], ag = $('#agrid'); ag.innerHTML = '';
      var aslides = amod.gallery.map(function (g) { return { src: F(g.img), title: 'Gestión ambiental · ' + g.name, win: 'Pestaña ' + g.name, cap: 'Una de las trece pestañas del módulo de gestión ambiental.', desc: amod.desc }; });
      amod.gallery.forEach(function (g, i) {
        var b = el('button', '', '<img src="' + T(g.img) + '" alt="' + esc(g.name) + '" loading="lazy"><span>' + esc(g.name) + '</span>');
        b.addEventListener('click', function () { LB.open(aslides, i); }); ag.appendChild(b);
      });
    }
  }
  show('inicio');
  // permitir abrir una categoría con #modulos-<id>
  if (/^#modulos-/.test(location.hash)) { var hid = location.hash.slice(9); if (catOf(hid)) show(hid); }

  /* ---------- informes ---------- */
  var reps = [['incidentes', 'Incidentes y accidentes'], ['riesgos', 'Matriz de riesgos'], ['extintores', 'Extintores'], ['nomina', 'Nómina de personal'], ['capacitaciones', 'Capacitaciones'], ['epp', 'Entregas de EPP'], ['salud', 'Vigilancia de salud'], ['jsa', 'Permisos de trabajo'], ['acciones', 'Gestor de acciones'], ['contratistas', 'Contratistas'], ['vehiculos', 'Flota de vehículos'], ['maquinaria', 'Maquinaria'], ['mantenimiento', 'Mantenimiento preventivo'], ['legajo', 'Legajo técnico de obra'], ['protocolos', 'Listado maestro'], ['quimicos', 'Químicos y SDS'], ['mediciones', 'Mediciones ambientales'], ['residuos', 'Gestión de residuos'], ['iso', 'Evaluación ISO 9001'], ['auditorias', 'Auditorías internas'], ['nc', 'No conformidades'], ['satisfaccion', 'Satisfacción del cliente']];
  var rt = $('#rtrack'), rslides = reps.map(function (r) { return { src: 'assets/img/pdf/' + r[0] + '.jpg', title: 'Informe · ' + r[1], win: 'PDF generado por proHS', cap: 'Primera página del informe con los datos de la obra de ejemplo.', desc: 'Cada informe lleva membrete, resumen ejecutivo y detalle del módulo.' }; });
  reps.forEach(function (r, i) {
    var d = el('div', 'rep', '<div class="pp"><img src="assets/img/pdf/' + r[0] + '.jpg" alt="Informe ' + esc(r[1]) + '" loading="lazy"><b>PDF</b></div><h4>' + esc(r[1]) + '</h4><small>Informe de ejemplo</small>');
    d.addEventListener('click', function () { LB.open(rslides, i); }); rt.appendChild(d);
  });
  $('#rprev').addEventListener('click', function () { rt.scrollBy({ left: -520, behavior: 'smooth' }); });
  $('#rnext').addEventListener('click', function () { rt.scrollBy({ left: 520, behavior: 'smooth' }); });

  /* ---------- celulares ---------- */
  var ph = [['mobile-home', 'Inicio'], ['mobile-checklist', 'Checklist'], ['mobile-incidents', 'Incidentes'], ['mobile-ppe', 'EPP']];
  var pslides = ph.map(function (p) { return { src: F(p[0]), title: 'En el celular · ' + p[1], win: 'proHS móvil', cap: 'La aplicación adaptada a la pantalla del teléfono.', desc: '' }; });
  var pn = $('#phones');
  ph.forEach(function (p, i) {
    var d = el('div', 'ph rv z', '<div class="fr"><img src="' + T(p[0]) + '" alt="' + p[1] + '" loading="lazy"></div><span>' + p[1] + '</span>');
    d.style.setProperty('--d', (i * .1) + 's'); d.addEventListener('click', function () { LB.open(pslides, i); }); pn.appendChild(d); io.observe(d);
  });

  /* ---------- foto: efecto 3D leve ---------- */
  var pc = $('#pcard');
  if (!reduce && matchMedia('(hover:hover)').matches) {
    pc.addEventListener('mousemove', function (e) {
      var r = pc.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      pc.style.transform = 'perspective(900px) rotateY(' + (x * 10) + 'deg) rotateX(' + (-y * 8) + 'deg)';
    });
    pc.addEventListener('mouseleave', function () { pc.style.transform = ''; });
  }

  /* ---------- elementos data-zoom del HTML ---------- */
  $$('[data-zoom]').forEach(function (n) {
    n.addEventListener('click', function (ev) {
      var g = n.dataset.group, nodes = $$('[data-zoom][data-group="' + g + '"]'), slides = [], start = 0;
      nodes.forEach(function (x) {
        var imgs = x.dataset.full ? [x] : $$('img[data-full]', x);
        imgs.forEach(function (im) {
          if (x === n && (x.dataset.full ? true : im.classList.contains('on'))) start = slides.length;
          slides.push({ src: im.dataset.full, title: im.dataset.title || x.dataset.title || '', win: im.dataset.win || '', cap: x.dataset.cap || '', desc: '' });
        });
      });
      LB.open(slides, start);
    });
  });

  /* ---------- lightbox ---------- */
  var LB = (function () {
    var box = $('#lb'), stage = $('#stage'), img = $('#lbI'), s = [], i = 0, level = 0, levels = [0, 1, 1.5, 2.2];
    function render() {
      var x = s[i]; level = 0; applyZoom();
      img.onload = null; img.src = x.src; img.alt = x.title; img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
      $('#lbT').textContent = x.title; $('#lbW').textContent = x.win || ''; $('#lbC').textContent = (i + 1) + ' / ' + s.length;
      $('#lbD').textContent = [x.cap, x.desc && x.desc !== x.cap ? x.desc : ''].filter(Boolean).join(' ');
      var ex = $('#lbE'); ex.innerHTML = ''; if (x.ex) x.ex.forEach(function (t) { ex.appendChild(el('span', '', esc(t))); });
      $('#lbP').style.display = $('#lbN').style.display = s.length > 1 ? '' : 'none';
      stage.scrollTo(0, 0);
    }
    function applyZoom(fx, fy) {
      var z = level > 0;
      stage.classList.toggle('z', z);
      if (!z) { img.style.width = ''; img.style.height = ''; return; }
      var nw = img.naturalWidth || img.width, r = { w: img.clientWidth || 1, h: img.clientHeight || 1 };
      var fxx = fx == null ? .5 : fx, fyy = fy == null ? .5 : fy;
      img.style.width = (nw * levels[level]) + 'px'; img.style.height = 'auto';
      requestAnimationFrame(function () {
        stage.scrollLeft = Math.max(0, img.clientWidth * fxx - stage.clientWidth / 2 + 20);
        stage.scrollTop = Math.max(0, img.clientHeight * fyy - stage.clientHeight / 2 + 20);
      });
    }
    function step(d) { var prev = level; level = Math.max(0, Math.min(levels.length - 1, level + d)); if (level !== prev) applyZoom(); }
    function go(d) { i = (i + d + s.length) % s.length; render(); }
    function close() { box.classList.remove('open'); document.body.style.overflow = ''; }
    var drag = null;
    stage.addEventListener('pointerdown', function (e) {
      if (!stage.classList.contains('z')) { drag = { x: e.clientX, y: e.clientY, moved: false, fit: true }; return; }
      drag = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop, moved: false }; stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag || drag.fit) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; stage.classList.add('drag'); }
      stage.scrollLeft = drag.sl - dx; stage.scrollTop = drag.st - dy;
    });
    stage.addEventListener('pointerup', function (e) {
      var d = drag; drag = null; stage.classList.remove('drag');
      if (!d || d.moved) return;
      var r = img.getBoundingClientRect();
      var fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      if (level === 0) { level = 1; applyZoom(fx, fy); } else { level = 0; applyZoom(); }
    });
    $('#lbX').addEventListener('click', close); $('#lbP').addEventListener('click', function () { go(-1); }); $('#lbN').addEventListener('click', function () { go(1); });
    $('#lbPlus').addEventListener('click', function () { step(1); }); $('#lbMinus').addEventListener('click', function () { step(-1); });
    box.addEventListener('click', function (e) { if (e.target === box || e.target.classList.contains('lbs')) close(); });
    addEventListener('keydown', function (e) {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1);
      else if (e.key === '+' || e.key === '=') step(1); else if (e.key === '-') step(-1);
    });
    // deslizar en pantallas táctiles (solo en vista ajustada)
    var tx = null;
    stage.addEventListener('touchstart', function (e) { tx = !stage.classList.contains('z') && e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    stage.addEventListener('touchend', function (e) { if (tx == null) return; var dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 70) go(dx < 0 ? 1 : -1); tx = null; }, { passive: true });
    return {
      open: function (slides, idx) { s = slides; i = idx || 0; box.classList.add('open'); document.body.style.overflow = 'hidden'; render(); }
    };
  })();

  /* ---------- comunicación del equipo: pestañas y chat animado ---------- */
  (function () {
    var tb = $('#ttabs'); if (!tb) return;
    $$('button', tb).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('button', tb).forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        $$('.tp').forEach(function (p) { p.classList.toggle('on', p.id === 'tp-' + b.dataset.t); });
      });
    });
    var live = $('#live'); if (!live) return;
    var msgs = $$('.msg', live), typ = $('.typing', live), timers = [];
    if (reduce) { msgs.forEach(function (m) { m.classList.add('on'); }); typ.classList.add('on'); return; }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function play() {
      timers.forEach(clearTimeout); timers = [];
      msgs.forEach(function (m) { m.classList.remove('on'); }); typ.classList.remove('on');
      msgs.forEach(function (m, k) { later(function () { m.classList.add('on'); }, 600 + k * 1500); });
      later(function () { typ.classList.add('on'); }, 600 + msgs.length * 1500);
      later(play, 600 + msgs.length * 1500 + 4200);
    }
    if ('IntersectionObserver' in window) {
      var seen = false;
      new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !seen) { seen = true; play(); } else if (!e.isIntersecting && seen) { timers.forEach(clearTimeout); seen = false; } }); }, { threshold: .35 }).observe(live);
    } else { play(); }
  })();

  /* ---------- video del simulador: se reproduce solo cuando se ve ---------- */
  (function () {
    var v = document.getElementById('plvid'); if (!v) return;
    if (reduce) { v.controls = true; return; }
    if (!('IntersectionObserver' in window)) { v.controls = true; return; }
    new IntersectionObserver(function (es) { es.forEach(function (e) {
      if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () { v.controls = true; }); } else { v.pause(); }
    }); }, { threshold: .4 }).observe(v);
  })();

  /* ---------- nómina: lo que se carga en un módulo se refleja en la ficha ---------- */
  function mkSim(stId, tabsSel, capId, CAPS, FLY) {
    var st = document.getElementById(stId); if (!st) return;
    var tabs = $$(tabsSel), lps = $$('.lp', st), rps = $$('.rp', st), cur = $('.cur', st), fly = $('.fly', st), cap = document.getElementById(capId);
    var idx = 0, timers = [], running = false, gen = 0;
    function later(fn, ms, g) { timers.push(setTimeout(function () { if (g === gen) fn(); }, ms)); }
    function stopAll() { gen++; timers.forEach(clearTimeout); timers = []; }
    function rel(el) {
      var a = el.getBoundingClientRect(), b = st.getBoundingClientRect();
      return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
    }
    function moveCur(el, fx, fy) {
      var r = rel(el); cur.classList.add('on');
      cur.style.transform = 'translate(' + (r.x + r.w * (fx == null ? .55 : fx)) + 'px,' + (r.y + r.h * (fy == null ? .6 : fy)) + 'px)';
    }
    function resetScenario(i) {
      lps.forEach(function (l, k) { l.classList.toggle('on', k === i); });
      rps.forEach(function (r, k) { r.classList.toggle('on', k === i); r.classList.remove('done'); $$('.nw', r).forEach(function (n) { n.classList.remove('flash'); }); $$('.cd', r).forEach(function (c) { c.classList.remove('hit'); }); });
      var l = lps[i];
      $$('.fld', l).forEach(function (n) { n.classList.remove('fill', 'act'); $('.tx', n).textContent = ''; });
      $$('.ck', l).forEach(function (n) { n.classList.remove('on'); });
      $$('.sg', l).forEach(function (n) { n.classList.remove('draw'); });
      $$('.bt', l).forEach(function (n) { n.classList.remove('press'); });
      $$('.tst', l).forEach(function (n) { n.classList.remove('on'); });
      fly.className = 'fly'; fly.style.transform = ''; cur.className = 'cur';
      tabs.forEach(function (b, k) { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      cap.innerHTML = '<span style="opacity:.55">…</span>';
    }
    function showCap(i) { cap.innerHTML = CAPS[i][0] + ' <br>' + CAPS[i][1] + '<small>Datos de ejemplo</small>'; }
    function finish(i, instant) {
      var r = rps[i]; r.classList.add('done');
      if (!instant) { $$('.nw', r).forEach(function (n) { void n.offsetWidth; n.classList.add('flash'); }); }
      var tg = $('[data-fly]', r); if (tg && !instant) tg.classList.add('hit');
      showCap(i);
    }
    function complete(i) {   // estado final inmediato (sin movimiento)
      resetScenario(i); var l = lps[i];
      $$('.fld', l).forEach(function (n) { n.classList.add('fill'); $('.tx', n).textContent = n.dataset.t || ''; });
      $$('.ck[data-step]', l).forEach(function (n) { n.classList.add('on'); });
      $$('.sg', l).forEach(function (n) { n.classList.add('draw'); });
      finish(i, true);
    }
    function play(i) {
      stopAll(); var g = gen; idx = i; resetScenario(i);
      var l = lps[i], t = 400, steps = $$('[data-step]', l);
      later(function () { cur.style.transition = 'none'; var r = rel(l); cur.style.transform = 'translate(' + (r.x + r.w * .5) + 'px,' + (r.y + 40) + 'px)'; void cur.offsetWidth; cur.style.transition = ''; cur.classList.add('on'); }, 10, g);
      steps.forEach(function (el) {
        var kind = el.classList.contains('fld') ? 'fld' : el.classList.contains('ck') ? 'ck' : el.classList.contains('sg') ? 'sg' : 'bt';
        if (kind === 'fld') {
          var txt = el.dataset.t || '';
          later(function () { moveCur(el, .3, .55); }, t, g);
          later(function () { el.classList.add('act', 'fill'); var tx = $('.tx', el), n = 0; (function typ() { if (g !== gen) return; n++; tx.textContent = txt.slice(0, n); if (n < txt.length) timers.push(setTimeout(typ, 42)); else el.classList.remove('act'); })(); }, t + 750, g);
          t += 750 + 80 + txt.length * 42 + 260;
        } else if (kind === 'ck') {
          later(function () { moveCur(el, .1, .5); }, t, g);
          later(function () { cur.classList.remove('click'); void cur.offsetWidth; cur.classList.add('click'); el.classList.add('on'); }, t + 760, g);
          t += 760 + 420;
        } else if (kind === 'sg') {
          later(function () { moveCur(el, .15, .65); }, t, g);
          later(function () { el.classList.add('draw'); }, t + 700, g);
          t += 700 + 1100;
        } else {
          later(function () { moveCur(el, .5, .5); }, t, g);
          later(function () { cur.classList.remove('click'); void cur.offsetWidth; cur.classList.add('click'); el.classList.add('press'); $('.tst', l).classList.add('on'); }, t + 800, g);
          later(function () { el.classList.remove('press'); }, t + 1000, g);
          t += 800 + 700;
        }
      });
      // vuelo del dato hacia la ficha
      var btn = $('.bt', l);
      later(function () {
        cur.classList.remove('on');
        var b = rel(btn), tg = $('[data-fly]', rps[i]) || rps[i], d = rel(tg);
        $('span', fly).textContent = FLY[i];
        fly.className = 'fly'; fly.style.transition = 'none'; fly.style.transform = 'translate(' + (b.x + b.w / 2 - 60) + 'px,' + (b.y + b.h / 2 - 16) + 'px)'; void fly.offsetWidth;
        fly.style.transition = ''; fly.classList.add('go');
        fly.style.transform = 'translate(' + (d.x + Math.min(d.w * .35, 120)) + 'px,' + (d.y + 6) + 'px)';
      }, t + 150, g);
      later(function () { fly.classList.add('end'); finish(i, false); }, t + 150 + 980, g);
      later(function () { play((i + 1) % lps.length); }, t + 150 + 980 + 5200, g);
    }
    tabs.forEach(function (b, k) {
      b.addEventListener('click', function () { idx = k; if (reduce || !running) { stopAll(); complete(k); } else { play(k); } });
    });
    if (reduce) { complete(0); return; }
    complete(0);   // estado inicial legible mientras no se ve en pantalla
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { es.forEach(function (e) {
        if (e.isIntersecting && !running) { running = true; play(idx); }
        else if (!e.isIntersecting && running) { running = false; stopAll(); complete(idx); }
      }); }, { threshold: .35 }).observe(st);
    } else { running = true; play(0); }
  }
  mkSim('nmst', '#nmt button', 'nmcap', [
      ['Cargaste una <b>entrega de EPP</b> con el nombre del trabajador.', 'Ya figura en su ficha, con fecha y artículo, sin cargar nada dos veces.'],
      ['Registraste una <b>capacitación</b> y marcaste a los asistentes y el protocolo.', 'La ficha suma la capacitación y el protocolo pasa de «Sin capacitar» a «Al día».'],
      ['Cargaste un <b>examen médico</b> periódico con su próximo control.', 'La ficha pasa de «Sin examen médico» a «Apto» y toma las fechas de vencimiento.'],
      ['Diste de alta un <b>protocolo nuevo</b> como vigente.', 'En la ficha de cada trabajador aparece como pendiente de explicar y comunicar.']
  ], ['EPP registrado', 'Capacitación registrada', 'Examen registrado', 'Protocolo nuevo']);
  mkSim('dcst', '#dct button', 'dccap', [
    ['Cargaste el <b>Programa de Seguridad</b> renovado con su vencimiento y el archivo adjunto.', 'El documento pasa de «Vencido» a «Vigente» y los contadores se actualizan solos.'],
    ['Subiste la <b>constancia de afiliación a la ART</b> que figuraba como faltante.', 'La guía de requisitos lo marca como «Cumple» y sube el porcentaje cubierto.'],
    ['Adjuntaste el <b>plano de evacuación</b> firmado, con su fecha de revisión.', 'Queda en el legajo de la obra, listo para el próximo informe o inspección.']
  ], ['Documento cargado', 'Constancia cargada', 'Plano adjuntado']);
})();
