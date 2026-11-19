/* proHS · recorrido por la gestión documental sobre capturas reales de la aplicación (datos de ejemplo) */
(function () {
  'use strict';
  var host = document.getElementById('dtour');
  if (!host) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var VW = 1440, VH = 1000;                       // tamaño de la ventana donde se tomaron las capturas
  var IMG = 'assets/img/doc/tour/';
  var NF = 12;

  var STEPS = [
    ['Resumen', 'Los cuatro recuadros cuentan lo que está al día, por vencer, vencido o en trámite. Al tocar uno, la aplicación lista esos documentos y permite abrirlos.'],
    ['Guía de requisitos', 'Se elige la provincia y el rubro, y la guía lista lo que corresponde y lo cruza con lo ya cargado: qué cumple y qué falta.'],
    ['Categorías', 'Laboral y H&amp;S, habilitaciones, incendios, ambiental, sanitario, salud y SGC / ISO 9001, cada una con su cuenta de pendientes.'],
    ['Agregar un documento', 'Tipo, estado, fechas, responsable, expediente y organismo, más el archivo adjunto (PDF, imagen o Word). Al guardar, queda en su categoría.'],
    ['Legajo de obra (PDF)', 'Un clic genera el legajo técnico de la obra en PDF, con la guía de requisitos y su estado, listo para mostrar en obra.']
  ];

  // cada pantalla: [x, y, ancho, alto] en píxeles de la ventana original (1440 × 1000)
  var B = {
    tileOk: [336, 489, 250, 86], tilePv: [602, 489, 250, 86],
    panel: [336, 575, 1048, 114], rgHead: [337, 374, 1046, 66],
    prov: [352, 294, 272, 38], rubro: [639, 294, 172, 34], prog: [353, 453, 1013, 102], req1: [354, 700, 1012, 180],
    tabHab: [512, 130, 134, 36], tabInc: [654, 130, 133, 36], faltante: [336, 280, 1048, 136], add: [336, 732, 208, 40],
    tipo: [408, 224, 624, 48], venc: [408, 410, 304, 50], resp: [728, 410, 304, 50], file: [408, 746, 624, 44], save: [408, 850, 493, 50],
    ok: [842, 531, 106, 42], nuevo: [336, 578, 1048, 258], legajo: [966, 193, 216, 40]
  };
  // beats: s = paso, f = captura que se ve antes de mover el cursor, t = [caja, fx, fy], hl = caja a resaltar, c = captura que aparece al hacer clic, w = pausa (ms)
  var BEATS = [
    { s: 0, f: 0, t: [B.tileOk, .35, .55], hl: B.tileOk, w: 1500 },
    { s: 0, f: 0, t: [B.tilePv, .35, .55], c: 1, w: 1900 },
    { s: 0, f: 1, t: [B.panel, .5, .6], hl: B.panel, w: 1600 },
    { s: 1, f: 1, t: [B.rgHead, .45, .5], c: 2, w: 1500 },
    { s: 1, f: 2, t: [B.prov, .5, .55], hl: B.prov, w: 1400 },
    { s: 1, f: 2, t: [B.rubro, .5, .55], hl: B.rubro, w: 1400 },
    { s: 1, f: 2, t: [B.prog, .3, .55], hl: B.prog, w: 1500 },
    { s: 1, f: 2, t: [B.req1, .55, .5], hl: B.req1, w: 1700 },
    { s: 2, f: 3, t: [B.tabHab, .5, .55], hl: B.tabHab, w: 1200 },
    { s: 2, f: 3, t: [B.tabInc, .5, .55], c: 4, w: 1700 },
    { s: 2, f: 4, t: [B.faltante, .5, .5], hl: B.faltante, w: 1800 },
    { s: 3, f: 5, t: [B.add, .5, .5], c: 6, w: 1500 },
    { s: 3, f: 6, t: [B.tipo, .5, .5], c: 7, w: 1400 },
    { s: 3, f: 7, t: [B.venc, .5, .5], hl: B.venc, w: 1100 },
    { s: 3, f: 7, t: [B.resp, .5, .5], hl: B.resp, w: 1100 },
    { s: 3, f: 7, t: [B.file, .25, .5], c: 8, w: 2100 },
    { s: 3, f: 8, t: [B.save, .5, .5], c: 9, w: 1900 },
    { s: 3, f: 9, t: [B.ok, .5, .5], c: 10, w: 1300 },
    { s: 3, f: 10, t: [B.nuevo, .5, .5], hl: B.nuevo, w: 2300 },
    { s: 4, f: 11, t: [B.legajo, .5, .5], c: 11, pdf: true, w: 4200 }
  ];

  var h = '<div class="dtgrid"><div><div class="dtbr"><div class="bar"><i></i><i></i><i></i><span>proHS · Gestión Documental</span></div><div class="dtsh">';
  for (var i = 0; i < NF; i++) h += '<img class="fr' + (i ? '' : ' on') + '" src="' + IMG + 't' + i + '.jpg" alt="' + (i === 0 ? 'Pantalla de Gestión Documental de proHS' : '') + '" decoding="async"' + (i > 1 ? ' loading="lazy"' : '') + '>';
  h += '<div class="dtring"></div><div class="dtpdfo"><img src="' + IMG + 'legajo.jpg" alt="Primera página del legajo técnico de la obra en PDF" loading="lazy"><span><i class="fa-solid fa-file-pdf"></i> Legajo técnico de la obra.pdf</span></div>' +
    '<svg class="dtcur" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M5 3l14 8-6.2 1.7L10 19z" fill="#0f172a" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg></div></div>' +
    '<p class="dtnote">Capturas reales de la aplicación, con datos de ejemplo.</p></div><div class="dtsteps" role="tablist" aria-label="Secciones de la gestión documental">';
  STEPS.forEach(function (s, k) {
    h += '<button type="button" role="tab" class="dtst' + (k ? '' : ' on') + '" data-s="' + k + '"><span class="tt"><span class="nb">' + (k + 1) + '</span>' + s[0] + '</span><span class="ds"><p>' + s[1] + '</p></span></button>';
  });
  h += '</div></div>';
  host.innerHTML = h;

  var sh = host.querySelector('.dtsh'), frs = [].slice.call(host.querySelectorAll('img.fr')), ring = host.querySelector('.dtring'), cur = host.querySelector('.dtcur'), pdfo = host.querySelector('.dtpdfo');
  var steps = [].slice.call(host.querySelectorAll('.dtst'));
  var timers = [], g = 0, bi = 0, running = false;

  function T(fn, ms) { var k = g; timers.push(setTimeout(function () { if (k === g) fn(); }, ms)); }
  function stop() { g++; timers.forEach(clearTimeout); timers = []; }
  function frame(n) { frs.forEach(function (im, k) { im.classList.toggle('on', k === n); }); }
  function setStep(s) { steps.forEach(function (b, k) { b.classList.toggle('on', k === s); b.setAttribute('aria-selected', k === s ? 'true' : 'false'); }); }
  function mv(box, fx, fy) {
    var W = sh.offsetWidth, H = sh.offsetHeight;
    cur.style.transform = 'translate(' + ((box[0] + box[2] * fx) / VW * W) + 'px,' + ((box[1] + box[3] * fy) / VH * H) + 'px)';
  }
  function tap() { cur.classList.remove('tap'); void cur.offsetWidth; cur.classList.add('tap'); }
  function showRing(b) { ring.style.left = (b[0] / VW * 100) + '%'; ring.style.top = (b[1] / VH * 100) + '%'; ring.style.width = (b[2] / VW * 100) + '%'; ring.style.height = (b[3] / VH * 100) + '%'; ring.classList.add('on'); }
  function hideRing() { ring.classList.remove('on'); }

  function beat(i) {
    var b = BEATS[i]; bi = i;
    setStep(b.s); frame(b.f); hideRing();
    if (b.s !== 4) pdfo.classList.remove('on');
    if (!cur.classList.contains('on')) {
      cur.style.transition = 'none'; cur.style.transform = 'translate(' + sh.offsetWidth * .86 + 'px,' + sh.offsetHeight * .9 + 'px)'; void cur.offsetWidth; cur.style.transition = ''; cur.classList.add('on');
    }
    T(function () { mv(b.t[0], b.t[1], b.t[2]); }, 120);
    T(function () {
      if (b.hl) showRing(b.hl);
      if (b.c != null) { tap(); T(function () { hideRing(); frame(b.c); if (b.pdf) pdfo.classList.add('on'); }, 260); }
    }, 1150);
    T(function () { beat((i + 1) % BEATS.length); }, 1150 + (b.c != null ? 260 : 0) + (b.w || 1500));
  }
  function first(s) { for (var i = 0; i < BEATS.length; i++) if (BEATS[i].s === s) return i; return 0; }
  function still(s) {         // estado final de cada sección, sin movimiento
    var last = 0; BEATS.forEach(function (b, i) { if (b.s === s) last = i; });
    var b = BEATS[last]; setStep(s); frame(b.c != null ? b.c : b.f); hideRing(); cur.classList.remove('on'); pdfo.classList.toggle('on', s === 4);
  }

  steps.forEach(function (b, k) {
    b.addEventListener('click', function () {
      if (reduce || !running) { stop(); bi = first(k); still(k); }
      else { stop(); pdfo.classList.remove('on'); cur.classList.remove('on'); beat(first(k)); }
    });
  });

  setStep(0); frame(0);
  if (reduce) return;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio > .3) { if (!running) { running = true; beat(bi); } }
        else if (!e.isIntersecting && running) { running = false; stop(); cur.classList.remove('on'); hideRing(); still(BEATS[bi].s); }
      });
    }, { threshold: [0, .3, .6] }).observe(host);
  }
})();
