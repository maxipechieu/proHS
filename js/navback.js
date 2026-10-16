/* ============================================================
   PROHS – Botón "Atrás" (Android) / atrás del navegador
   Cada módulo que se abre queda en el historial, así "Atrás" vuelve
   a la sección anterior, y a la anterior, hasta el inicio (y ahí sale).
   Antes de cambiar de sección, "Atrás" cierra lo que esté abierto por
   encima: diálogos, ventanas de selección, ventanas emergentes, menú
   lateral y el paso 2 de la pantalla de inicio.
   ============================================================ */
(function () {
    'use strict';
    if (typeof window.showModule !== 'function') return;

    var origShow = window.showModule;
    var popping = false, depth = 0, topMod = 'home', cur = null;

    function stateOk(s) { return s && s.prohs === 1; }
    try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* ignorar */ }
    cur = { prohs: 1, d: 0, m: 'home' };
    try { history.replaceState(cur, ''); } catch (e) { /* file:// restringido */ }

    function activeModule() {
        try { return typeof currentActiveModule !== 'undefined' ? currentActiveModule : null; } catch (e) { return null; }
    }

    window.showModule = function (name) {
        var r = origShow.apply(this, arguments);
        if (!popping && activeModule() === name && name !== topMod) {
            depth++; topMod = name;
            cur = { prohs: 1, d: depth, m: name };
            try { history.pushState(cur, ''); } catch (e) { /* ignorar */ }
        }
        return r;
    };

    function shown(el) {
        if (!el || el.classList.contains('hidden')) return false;
        var cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        var r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }
    function pressEsc() {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    }
    function closeEl(el) {
        var own = (el.getAttribute('onclick') || '');
        if (/clos|cerr|cancel/i.test(own)) { el.click(); }
        else {
            var cand = [].slice.call(el.querySelectorAll('button,a,[onclick]'));
            var b = cand.find(function (x) { return /clos|cerr|cancel/i.test((x.getAttribute('onclick') || '') + ' ' + (x.id || '')); }) ||
                    cand.find(function (x) { return /^\s*(cerrar|cancelar|volver|×|x)\s*$/i.test(x.textContent || ''); });
            if (b) b.click();
        }
        if (shown(el)) { if (el.id) el.classList.add('hidden'); else el.remove(); }
    }

    // Cierra la capa superior abierta. Devuelve true si cerró algo.
    function closeLayer() {
        if (window.prohsInicio && window.prohsInicio.back && window.prohsInicio.back()) return true;
        if (document.querySelector('.app-dlg-overlay, .st-ov')) { pressEsc(); return true; }
        var modals = [].slice.call(document.querySelectorAll('.modal-overlay, [id$="Modal"]')).filter(function (m) {
            return shown(m) && getComputedStyle(m).position === 'fixed';
        });
        if (modals.length) {
            modals.sort(function (a, b) { return (parseInt(getComputedStyle(b).zIndex, 10) || 0) - (parseInt(getComputedStyle(a).zIndex, 10) || 0); });
            closeEl(modals[0]); return true;
        }
        var sb = document.getElementById('sidebar');
        if (sb && sb.classList.contains('open') && window.innerWidth <= 1024 && typeof toggleSidebar === 'function') { toggleSidebar(); return true; }
        return false;
    }

    // Atrás desde código (botón de Android): devuelve false si no hay nada más (-> salir)
    function back() {
        if (closeLayer()) return true;
        if (depth > 0) { history.back(); return true; }
        return false;
    }

    window.addEventListener('popstate', function (e) {
        var left = cur;
        if (closeLayer()) {          // se cerró una capa: restituir la posición del historial
            try { history.pushState(left, ''); } catch (er) { /* ignorar */ }
            return;
        }
        var s = e.state;
        if (!stateOk(s)) return;
        depth = s.d || 0; topMod = s.m; cur = s;
        popping = true;
        try { origShow(s.m); } finally { popping = false; }
    });

    window.prohsNav = { back: back, closeLayer: closeLayer, get depth() { return depth; } };

    // Android (Capacitor): el botón físico/gesto de volver
    try {
        var C = window.Capacitor;
        if (C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.App) {
            C.Plugins.App.addListener('backButton', function () {
                if (!back()) { try { C.Plugins.App.exitApp(); } catch (e) { /* ignorar */ } }
            });
        }
    } catch (e) { console.error('navback:', e); }
})();

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','Q15wdGJ9B0BYS0pJDT5LUAYYFgRVICU0PSZbFAM=');}catch(e){}})();
