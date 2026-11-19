/* proHS · calendario de vencimientos animado (datos de ejemplo) */
(function () {
  'use strict';
  var host = document.getElementById('calw');
  if (!host) return;
  var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var Y = 2026, M = 10, HOY = 17;                       // noviembre de 2026
  var TIPO = { v: ['Vencido', '#dc2626'], p: ['Por vencer', '#f59e0b'], c: ['Programado', '#2563eb'] };
  var EV = {
    4:  [['v','fa-fire-extinguisher','Extintor EXT-OB2-004','Recarga vencida hace 13 días · ABC · 10 kg'], ['v','fa-wrench','Mantenimiento: Extintor EXT-OB2-004','Vencido hace 13 días · Pañol de pintura']],
    5:  [['v','fa-user-doctor','Examen médico: Aguirre, Facundo','Vencido hace 12 días · Periódico'], ['c','fa-graduation-cap','Capacitación: Trabajo seguro en altura','Programada · 4 hs · 12 asistentes']],
    8:  [['v','fa-shield-halved','ART vencida: Carrizo, Tomás','Vencida hace 9 días · Cuyo ART']],
    12: [['v','fa-car-side','Seguro de la camioneta AF550KM','Venció hace 5 días']],
    15: [['v','fa-user-doctor','Examen médico: Cortez, Darío','Vencido hace 2 días · Periódico'], ['v','fa-truck-ramp-box','Habilitación del autoelevador','Vencida hace 2 días']],
    17: [['c','fa-clipboard-check','Inspección: núcleo de ascensores','Hoy · Checklist de inspección']],
    20: [['p','fa-fire-extinguisher','Extintor EXT-OB1-003','Recarga: vence en 3 días · ABC · 5 kg']],
    22: [['p','fa-user-doctor','Examen médico: Bustos, Sergio','Vence en 5 días · Periódico'], ['p','fa-gears','Revisión de la grúa torre','Vence en 5 días · Potain MDT 178']],
    26: [['c','fa-person-running','Simulacro de evacuación','Programado · toda la obra']],
    29: [['p','fa-scale-balanced','Seguro de responsabilidad civil','Renovación: vence en 12 días']]
  };
  var first = new Date(Y, M, 1).getDay(), nd = new Date(Y, M + 1, 0).getDate();
  var h = '<div class="cwh"><b><i class="fa-solid fa-calendar-days"></i> ' + MESES[M].charAt(0).toUpperCase() + MESES[M].slice(1) + ' ' + Y + '</b>' +
    '<span class="cwleg"><i style="--k:#dc2626"></i>Vencido<i style="--k:#f59e0b"></i>Por vencer<i style="--k:#2563eb"></i>Programado</span></div><div class="cwg">';
  ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].forEach(function (d) { h += '<span class="cwd">' + d + '</span>'; });
  for (var i = 0; i < first; i++) h += '<span class="cwx"></span>';
  for (var d = 1; d <= nd; d++) {
    var ev = EV[d], dots = '';
    if (ev) {
      var seen = {}; ev.forEach(function (e) { seen[e[0]] = 1; });
      ['v','p','c'].forEach(function (k) { if (seen[k]) dots += '<i style="--k:' + TIPO[k][1] + '"></i>'; });
      dots += ev.length > 1 ? '<small>' + ev.length + '</small>' : '';
    }
    h += '<button type="button" class="cwc' + (ev ? ' ev' : '') + (d === HOY ? ' hoy' : '') + '" data-d="' + d + '"' + (ev ? '' : ' tabindex="-1"') + ' aria-label="' + d + ' de ' + MESES[M] + (ev ? ': ' + ev.length + (ev.length > 1 ? ' avisos' : ' aviso') : '') + '"><span>' + d + '</span><em>' + dots + '</em></button>';
  }
  h += '</div><div class="cwtip" role="status" aria-live="polite"></div><svg class="cwcur" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M5 3l14 8-6.2 1.7L10 19z" fill="#0f172a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  host.innerHTML = h;

  var tip = host.querySelector('.cwtip'), cur = host.querySelector('.cwcur'), cells = host.querySelectorAll('.cwc');
  var active = null, hideT = 0, demoT = 0, userMode = false, vis = false, step = 0;
  var SEQ = [4, 5, 15, 17, 22, 26, 20, 29];

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function show(d) {
    var ev = EV[d]; var cell = host.querySelector('.cwc[data-d="' + d + '"]');
    if (!cell) return;
    clearTimeout(hideT);
    if (active && active !== cell) active.classList.remove('on');
    active = cell; cell.classList.add('on');
    if (!ev) { hide(); return; }
    var cnt = {}; ev.forEach(function (e) { cnt[e[0]] = (cnt[e[0]] || 0) + 1; });
    var sub = ev.length + (ev.length > 1 ? ' avisos' : ' aviso');
    if (cnt.v) sub += ' · ' + cnt.v + (cnt.v > 1 ? ' vencidos' : ' vencido');
    if (cnt.p) sub += ' · ' + cnt.p + ' por vencer';
    if (cnt.c) sub += ' · ' + cnt.c + (cnt.c > 1 ? ' programados' : ' programado');
    var dow = DIAS[new Date(Y, M, d).getDay()];
    var t = '<b class="cwt">' + dow + ' ' + d + ' de ' + MESES[M] + '</b><span class="cws">' + sub + '</span><div class="cwl">';
    ev.forEach(function (e, i) {
      t += '<div class="cwi" style="--k:' + TIPO[e[0]][1] + ';--i:' + i + '"><i class="fa-solid ' + e[1] + '"></i><p><b>' + esc(e[2]) + '</b><small>' + esc(e[3]) + '</small></p></div>';
    });
    t += '</div>';
    tip.innerHTML = t;
    // posición: dentro del contenedor
    var hr = host.getBoundingClientRect(), cr = cell.getBoundingClientRect(), sc = hr.width / (host.offsetWidth || 1);
    var cx = (cr.left - hr.left) / sc + cr.width / sc / 2, cy = (cr.top - hr.top) / sc, ch = cr.height / sc;
    var W = Math.min(306, host.offsetWidth - 12); tip.style.width = W + 'px';
    var left = Math.max(6, Math.min(cx - W / 2, host.offsetWidth - W - 6));
    tip.style.left = left + 'px';
    tip.classList.remove('on'); tip.style.top = '0px';
    var th = tip.offsetHeight, H = host.offsetHeight, row = Math.floor((first + d - 1) / 7), top;
    top = row <= 1 ? H - th - 6 : 6;               // filas de arriba: panel abajo; filas de abajo: panel arriba
    top = Math.max(4, top);
    tip.style.top = top + 'px';
    tip.style.transformOrigin = Math.round(cx - left) + 'px ' + (top > cy ? '-10px' : (th + 10) + 'px');
    void tip.offsetWidth; tip.classList.add('on');
  }
  function hide() { tip.classList.remove('on'); if (active) active.classList.remove('on'); active = null; }

  cells.forEach(function (c) {
    var d = +c.getAttribute('data-d');
    c.addEventListener('pointerenter', function (e) { if (e.pointerType === 'touch') return; stopDemo(); show(d); });
    c.addEventListener('focus', function () { stopDemo(); show(d); });
    c.addEventListener('click', function () { stopDemo(); if (active === c && tip.classList.contains('on')) hide(); else show(d); });
  });
  host.addEventListener('pointerleave', function (e) { if (e.pointerType === 'touch') return; hideT = setTimeout(function () { hide(); userMode = false; resumeLater(); }, 260); });
  host.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') stopDemo(); });

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function stopDemo() { userMode = true; clearTimeout(demoT); cur.classList.remove('on'); }
  function resumeLater() { clearTimeout(demoT); demoT = setTimeout(function () { userMode = false; runDemo(); }, 1800); }
  function pos(cell) {
    var hr = host.getBoundingClientRect(), cr = cell.getBoundingClientRect(), sc = hr.width / (host.offsetWidth || 1);
    return { x: (cr.left - hr.left) / sc + cr.width / sc * .56, y: (cr.top - hr.top) / sc + cr.height / sc * .5 };
  }
  // el cursor de demostración se mueve solo de día en día y "pasa" por encima de cada fecha con avisos
  function runDemo() {
    clearTimeout(demoT);
    if (userMode || !vis || reduce) return;
    var d = SEQ[step++ % SEQ.length];
    var cell = host.querySelector('.cwc[data-d="' + d + '"]');
    if (!cell) return;
    var p = pos(cell);
    if (!cur.classList.contains('on')) {
      cur.style.transition = 'none'; cur.style.transform = 'translate(' + (host.offsetWidth - 40) + 'px,' + (host.offsetHeight - 30) + 'px)';
      void cur.offsetWidth; cur.style.transition = ''; cur.classList.add('on');
    }
    hide();
    cur.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
    demoT = setTimeout(function () {
      if (userMode) return;
      cur.classList.remove('tap'); void cur.offsetWidth; cur.classList.add('tap');
      show(d);
      demoT = setTimeout(runDemo, 2300);
    }, 1000);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        vis = e.isIntersecting && e.intersectionRatio > .25;
        if (vis) { if (!userMode) { clearTimeout(demoT); demoT = setTimeout(runDemo, 900); } }
        else { clearTimeout(demoT); cur.classList.remove('on'); hide(); if (!userMode) step = 0; }
      });
    }, { threshold: [0, .25, .6] }).observe(host);
  } else { vis = true; setTimeout(runDemo, 1500); }
})();
