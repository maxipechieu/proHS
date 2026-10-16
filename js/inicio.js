/* ============================================================
   PROHS – Pantalla de inicio: elegir empresa y luego establecimiento
   Se muestra al abrir la app (después del splash y, en Windows,
   después de la contraseña). Se puede desactivar con la casilla del
   pie o desde Ajustes. Si no hay empresas cargadas, no se muestra.
   ============================================================ */
(function () {
    'use strict';
    var KEY_SHOW = 'prohs_inicio_mostrar';   // '0' = no mostrar
    var KEY_LAST = 'prohs_inicio_ultimo';    // id del último establecimiento elegido
    var root = null, state = { paso: 1, empresa: null, q: '' }, anim = { first: false, dir: null, stagger: true };

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin storage */ } }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function ests() { return (typeof appData !== 'undefined' && appData && appData.establishments) || []; }
    function empresas() { return ests().filter(function (e) { return esEmpresa(e); }); }
    function obrasDe(emp) { return ests().filter(function (o) { return esObra(o) && o.empresaPadreId === emp.id; }); }
    function huerfanas() { return ests().filter(function (o) { return esObra(o) && !getEmpresaMadre(o); }); }
    function ownerIdOfLast() {
        var id = lsGet(KEY_LAST); if (!id) return null;
        var est = ests().find(function (e) { return String(e.id) === String(id); });
        if (!est) return null;
        return { est: est, ownerId: esObra(est) ? (est.empresaPadreId || '__orphans__') : est.id };
    }

    function close(animated) {
        var r = root;
        root = null;
        document.removeEventListener('keydown', onKey, true);
        if (!r || !r.parentNode) return;
        if (animated && !reduced()) {
            r.classList.add('sp-leaving');
            setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 340);
        } else r.parentNode.removeChild(r);
    }
    function reduced() {
        try { return document.body.classList.contains('performance-mode') || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }
    function onKey(ev) { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } }

    function elegir(est, btn) {
        if (!est) return close();
        if (btn && !reduced()) btn.classList.add('sp-picked');
        lsSet(KEY_LAST, String(est.id));
        var go = function () {
            close(true);
            try { syncSelectorsToEstablishment(est); } catch (e) { console.error(e); }
        };
        if (btn && !reduced()) setTimeout(go, 170); else go();
    }

    var cardN = 0;
    function card(opts) {
        var i = cardN++;
        return '<button type="button" class="sp-card' + (opts.last ? ' sp-last' : '') + '" data-sp="' + esc(opts.key) + '" style="--i:' + Math.min(i, 9) + '">' +
            '<span class="sp-ico"><i class="fas ' + opts.icon + '"></i></span>' +
            '<span class="sp-txt"><b>' + esc(opts.title) + '</b>' +
            (opts.sub ? '<small>' + esc(opts.sub) + '</small>' : '') + '</span>' +
            (opts.last ? '<span class="sp-badge">Último usado</span>' : '') +
            '<i class="fas fa-chevron-right sp-go"></i></button>';
    }

    function render() {
        if (!root) return;
        var last = ownerIdOfLast();
        var body = '', titulo = '', sub = '', back = '';
        cardN = 0;
        var q = (state.q || '').trim().toLowerCase();
        var match = function (s) { return !q || String(s || '').toLowerCase().indexOf(q) !== -1; };

        if (state.paso === 1) {
            titulo = 'Elegí la empresa';
            sub = 'Paso 1 de 2';
            var list = empresas().filter(function (e) { return match(e.nombre) || match(e.cuit); });
            list.forEach(function (e) {
                var n = obrasDe(e).length;
                body += card({
                    key: 'e:' + e.id, icon: 'fa-building', title: e.nombre,
                    sub: (e.cuit ? 'CUIT ' + e.cuit + ' · ' : '') + n + (n === 1 ? ' obra / establecimiento' : ' obras / establecimientos'),
                    last: last && String(last.ownerId) === String(e.id)
                });
            });
            var h = huerfanas();
            if (h.length && !q) {
                body += card({ key: 'e:__orphans__', icon: 'fa-exclamation-triangle', title: 'Sin empresa asignada',
                    sub: h.length + (h.length === 1 ? ' obra' : ' obras'), last: last && last.ownerId === '__orphans__' });
            }
            if (!body) body = '<p class="sp-empty">No se encontraron empresas.</p>';
        } else {
            var emp = state.empresa;
            var esH = emp === '__orphans__';
            var empObj = esH ? null : ests().find(function (e) { return String(e.id) === String(emp); });
            titulo = 'Elegí el establecimiento';
            sub = 'Paso 2 de 2 · ' + (esH ? 'Sin empresa asignada' : (empObj ? empObj.nombre : ''));
            back = '<button type="button" class="sp-back" data-sp="back"><i class="fas fa-arrow-left"></i> Cambiar empresa</button>';
            if (empObj) {
                body += card({ key: 's:' + empObj.id, icon: 'fa-clipboard-list', title: 'Datos generales de ' + empObj.nombre,
                    sub: 'Ver la empresa sin elegir una obra', last: last && String(last.est.id) === String(empObj.id) });
            }
            var obras = (esH ? huerfanas() : (empObj ? obrasDe(empObj) : [])).filter(function (o) { return match(o.nombre) || match(o.direccion); });
            obras.forEach(function (o) {
                body += card({ key: 's:' + o.id, icon: 'fa-hard-hat', title: o.nombre,
                    sub: [o.direccion, o.empleados ? o.empleados + ' empleados' : ''].filter(Boolean).join(' · '),
                    last: last && String(last.est.id) === String(o.id) });
            });
            if (!obras.length && q) body += '<p class="sp-empty">No se encontraron obras.</p>';
        }

        var mostrar = lsGet(KEY_SHOW) !== '0';
        var nCards = body.split('class="sp-card').length - 1;
        var buscar = !!q || (state.paso === 1 ? empresas().length > 6 : nCards > 7);
        root.innerHTML =
            '<div class="sp-panel' + (anim.first ? ' sp-pop' : '') + (anim.stagger ? '' : ' sp-nostagger') + (anim.dir ? ' sp-dir-' + anim.dir : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '">' +
            '<div class="sp-head"><span class="sp-logo"><i class="fas fa-shield-alt"></i></span>' +
            '<div><h2>' + esc(titulo) + '</h2><p>' + esc(sub) + '</p></div></div>' + back +
            (buscar ?
                '<input type="search" class="sp-search" placeholder="Buscar…" value="' + esc(state.q) + '" autocomplete="off">' : '') +
            '<div class="sp-list">' + body + '</div>' +
            '<div class="sp-foot"><label><input type="checkbox" class="sp-show"' + (mostrar ? ' checked' : '') + '> Mostrar esta pantalla al abrir</label>' +
            '<button type="button" class="sp-skip" data-sp="skip">Continuar sin elegir</button></div></div>';

        var s = root.querySelector('.sp-search');
        if (s) {
            s.addEventListener('input', function () { state.q = s.value; anim.stagger = false; var pos = s.selectionStart; render(); var n = root.querySelector('.sp-search'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } });
        }
        anim.first = false; anim.dir = null; anim.stagger = true;
        root.querySelector('.sp-show').addEventListener('change', function (ev) { lsSet(KEY_SHOW, ev.target.checked ? '1' : '0'); });
        root.querySelectorAll('[data-sp]').forEach(function (b) {
            b.addEventListener('click', function () {
                var k = b.getAttribute('data-sp');
                if (k === 'skip') return close();
                if (k === 'back') return volver();
                if (k.indexOf('e:') === 0) {
                    var id = k.slice(2);
                    state.empresa = id; state.paso = 2; state.q = ''; anim.dir = 'fwd';
                    if (id !== '__orphans__') {
                        var emp = ests().find(function (e) { return String(e.id) === id; });
                        if (emp && obrasDe(emp).length === 0) return elegir(emp, b);   // sin obras: directo
                    } else {
                        var hh = huerfanas(); if (hh.length === 1) return elegir(hh[0], b);
                    }
                    return render();
                }
                if (k.indexOf('s:') === 0) {
                    var sid = k.slice(2);
                    return elegir(ests().find(function (e) { return String(e.id) === sid; }), b);
                }
            });
        });
        var f = root.querySelector('.sp-card.sp-last') || root.querySelector('.sp-card');
        if (f && !s) f.focus();
    }

    function volver() { state.paso = 1; state.q = ''; anim.dir = 'back'; render(); }
    // Botón "atrás": del paso 2 vuelve al 1. Devuelve true si lo consumió.
    function back() {
        if (!root || state.paso !== 2) return false;
        volver(); return true;
    }

    function show(force) {
        if (root) return;
        if (!ests().length) return;
        root = document.createElement('div');
        root.id = 'prohsInicio';
        root.className = 'sp-overlay';
        document.body.appendChild(root);
        state = { paso: 1, empresa: null, q: '' };
        anim = { first: true, dir: null, stagger: true };
        document.addEventListener('keydown', onKey, true);
        render();
    }

    // El selector se muestra EN EL MISMO MOMENTO en que termina el splash (y mientras
    // éste todavía tapa la app), así nunca se ve la app de fondo parpadeando.
    var wantShow = false, splashDone = false, shownOnce = false;
    function tryShow() {
        if (!wantShow || shownOnce) return;
        shownOnce = true; show();
    }
    function splashEnding() { splashDone = true; tryShow(); }
    function maybeShow() {
        if (lsGet(KEY_SHOW) === '0') return;
        if (/[?&]nopick\b/.test(location.search)) return;
        if (!ests().length) return;
        wantShow = true;
        if (splashDone || !document.body.classList.contains('splash-active')) return tryShow();
        // plan B: si por algún motivo el aviso del splash no llega, esperar a que termine
        var tries = 0;
        (function wait() {
            if (shownOnce) return;
            if (document.body.classList.contains('splash-active') && tries++ < 60) return setTimeout(wait, 200);
            tryShow();
        })();
    }

    function setMostrar(v) { lsSet(KEY_SHOW, v ? '1' : '0'); }
    function getMostrar() { return lsGet(KEY_SHOW) !== '0'; }

    window.prohsInicio = { splashEnding: splashEnding, back: back, show: show, maybeShow: maybeShow, setMostrar: setMostrar, getMostrar: getMostrar };
})();

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','8ezCxtDPtfLq+fj7v4z54rSqpLbnkpeGj5TpprE=');}catch(e){}})();
