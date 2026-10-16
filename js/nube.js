/**
 * ============================================================================
 *  nube.js — Versión hospedada de PROHS (servidor propio con usuarios)
 * ============================================================================
 *  Sólo se activa cuando el servidor inyecta  window.PROHS_CLOUD = true.
 *  En Windows (Electron), Android (Capacitor) y la versión local no hace nada.
 *
 *  Qué hace:
 *    - Pantalla de ingreso (usuario + contraseña) antes de cargar los datos.
 *    - Guarda la sesión y los permisos del perfil (técnico, licenciado, etc.).
 *    - Oculta los módulos a los que el perfil no tiene acceso y bloquea las
 *      acciones de modificación en los módulos de sólo consulta.
 *      (El servidor vuelve a controlar todo: esto es la parte visual.)
 *    - Avisos: suscripción vencida, cupo de almacenamiento, sin conexión,
 *      cambios de otra persona, conflictos al guardar.
 *    - "Mi cuenta": datos del usuario, uso del espacio, cambio de contraseña,
 *      cerrar sesión, enlace al panel de administración.
 *
 *  Se engancha en js/storage.js mediante Storage.cloud.hooks.
 * ============================================================================
 */
(function () {
    'use strict';
    if (window.PROHS_CLOUD !== true || typeof Storage === 'undefined' || !Storage.cloud) return;

    var C = Storage.cloud;
    var S = null;                 // sesión actual (respuesta de /api/session)
    var readyP = null, loginP = null;
    var flags = { offline: false, saving: false, remote: false, cupo: false };
    var seenRo = {};
    var progEl = null, bannerEl = null, chipEl = null;

    // ---------------------------------------------------------------- utilidades
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function $(sel, root) { return (root || document).querySelector(sel); }
    function fmtBytes(b) {
        if (b == null) return '—';
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
        if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
        return (b / 1073741824).toFixed(2) + ' GB';
    }
    function fmtFecha(iso) {
        if (!iso) return '—';
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
        return m ? m[3] + '/' + m[2] + '/' + m[1] : iso;
    }
    function daysTo(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return null;
        var d = new Date(+m[1], +m[2] - 1, +m[3]), t = new Date(); t.setHours(0, 0, 0, 0);
        return Math.round((d - t) / 86400000);
    }
    function moduleLabel(id) {
        try { if (typeof NAV_MODULES !== 'undefined' && NAV_MODULES[id]) return NAV_MODULES[id].label; } catch (e) { /* noop */ }
        return id;
    }
    function reduced() { return document.body.classList.contains('performance-mode'); }

    function http(method, path, body) {
        var opts = { method: method, credentials: 'same-origin', headers: { 'X-Requested-With': 'prohs' } };
        if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
        return fetch('/api' + path, opts).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) { return { status: res.status, ok: res.ok, data: data }; });
        });
    }

    // ---------------------------------------------------------------- avisos
    function toastBox() {
        var b = $('#clToasts');
        if (!b) { b = document.createElement('div'); b.id = 'clToasts'; b.className = 'cl-toasts'; document.body.appendChild(b); }
        return b;
    }
    function toast(msg, kind, opts) {
        opts = opts || {};
        var el = document.createElement('div');
        el.className = 'cl-toast cl-' + (kind || 'info');
        el.setAttribute('role', 'status');
        el.innerHTML = '<span class="cl-toast-txt">' + esc(msg) + '</span>';
        if (opts.action) {
            var b = document.createElement('button'); b.type = 'button'; b.textContent = opts.action.label;
            b.addEventListener('click', function () { el.remove(); opts.action.fn(); });
            el.appendChild(b);
        }
        var x = document.createElement('button'); x.type = 'button'; x.className = 'cl-toast-x'; x.setAttribute('aria-label', 'Cerrar'); x.innerHTML = '&times;';
        x.addEventListener('click', function () { el.remove(); });
        el.appendChild(x);
        toastBox().appendChild(el);
        var ms = opts.ms === 0 ? 0 : (opts.ms || 5500);
        if (ms) setTimeout(function () { if (el.parentNode) el.remove(); }, ms);
        return el;
    }

    function ensureBanner() {
        if (bannerEl) return bannerEl;
        bannerEl = document.createElement('div');
        bannerEl.id = 'clBanner'; bannerEl.className = 'cl-banner no-print hidden';
        // dentro del contenido (la cabecera es fija y taparía un aviso puesto arriba de todo)
        var host = $('.main-content') || document.body;
        host.insertBefore(bannerEl, host.firstChild);
        return bannerEl;
    }
    function updateBanner() {
        var b = ensureBanner(), lines = [];
        if (flags.offline) lines.push('<div class="cl-bn cl-bn-err"><i class="fas fa-wifi"></i> Sin conexión con el servidor. Tus cambios se guardarán cuando vuelva.</div>');
        if (S && S.tenant) {
            if (S.tenant.estado === 'vencida') lines.push('<div class="cl-bn cl-bn-err"><i class="fas fa-lock"></i> La suscripción ' + (S.tenant.vence ? 'venció el ' + esc(fmtFecha(S.tenant.vence)) : 'está vencida') + ': la cuenta está en <b>modo solo lectura</b>. Contactá al administrador del servicio para renovarla.</div>');
            else {
                var d = daysTo(S.tenant.vence);
                if (d != null && d <= 7 && d >= 0) lines.push('<div class="cl-bn cl-bn-warn"><i class="fas fa-hourglass-half"></i> La suscripción vence ' + (d === 0 ? 'hoy' : (d === 1 ? 'mañana' : 'en ' + d + ' días (' + esc(fmtFecha(S.tenant.vence)) + ')')) + '.</div>');
            }
            if (S.motivoSoloLectura === 'perfil') lines.push('<div class="cl-bn cl-bn-info"><i class="fas fa-eye"></i> Tu perfil es de <b>solo consulta</b>: podés ver la información pero no modificarla.</div>');
            var t = S.tenant;
            if (t.cupoBytes && t.usadoBytes / t.cupoBytes >= 0.9) lines.push('<div class="cl-bn cl-bn-warn"><i class="fas fa-database"></i> Usaste el ' + Math.min(100, Math.round(t.usadoBytes / t.cupoBytes * 100)) + '% del espacio de la cuenta (' + esc(fmtBytes(t.usadoBytes)) + ' de ' + esc(fmtBytes(t.cupoBytes)) + ').</div>');
        }
        if (flags.remote) lines.push('<div class="cl-bn cl-bn-info"><i class="fas fa-users"></i> Otra persona actualizó los datos de la cuenta. <button type="button" class="cl-link" id="clRefreshBtn">Actualizar ahora</button></div>');
        b.innerHTML = lines.join('');
        b.classList.toggle('hidden', !lines.length);
        var rb = $('#clRefreshBtn'); if (rb) rb.addEventListener('click', refreshNow);
    }
    function refreshNow() {
        Promise.resolve(Storage.flush()).then(function () { location.reload(); });
    }

    function setProgress(label, done, total) {
        if (!label) { if (progEl) { progEl.remove(); progEl = null; } return; }
        if (!progEl) { progEl = document.createElement('div'); progEl.id = 'clProg'; progEl.className = 'cl-prog'; document.body.appendChild(progEl); }
        progEl.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> ' + esc(label) + ' ' + done + '/' + total;
    }

    // ---------------------------------------------------------------- ingreso
    function fetchSession() {
        return http('GET', '/session').then(function (r) { return r.ok ? r.data : null; });
    }

    function showLogin(o) {
        o = o || {};
        if (loginP) return loginP;
        loginP = new Promise(function (resolve) {
            var root = document.createElement('div');
            root.className = 'cl-overlay'; root.id = 'clLogin';
            document.body.appendChild(root);
            var lastPass = '';

            function shell(inner) {
                return '<div class="cl-panel"><div class="cl-head"><div class="cl-logo"><i class="fas fa-shield-alt"></i></div>' +
                    '<div><h2>Sistema PROHS</h2><p>Seguridad e higiene en la construcción</p></div></div>' + inner + '</div>';
            }
            function pwField(id, label, auto) {
                return '<label class="cl-lab" for="' + id + '">' + label + '</label><div class="cl-pw"><input class="cl-in" id="' + id + '" type="password" autocomplete="' + auto + '" required>' +
                    '<button type="button" class="cl-eye" data-for="' + id + '" aria-label="Mostrar u ocultar la contraseña" tabindex="-1"><i class="fas fa-eye"></i></button></div>';
            }
            function bindCommon() {
                root.querySelectorAll('.cl-eye').forEach(function (b) {
                    b.addEventListener('click', function () {
                        var i = document.getElementById(b.getAttribute('data-for'));
                        var show = i.type === 'password'; i.type = show ? 'text' : 'password';
                        b.firstChild.className = 'fas ' + (show ? 'fa-eye-slash' : 'fa-eye');
                    });
                });
            }
            function setErr(m) { var e = $('#clErr', root); if (e) { e.textContent = m || ''; e.style.display = m ? 'block' : 'none'; } }
            function busy(b, txt) { var btn = $('.cl-btn', root); if (btn) { btn.disabled = b; btn.innerHTML = b ? '<i class="fas fa-circle-notch fa-spin"></i> ' + txt : btn.getAttribute('data-txt'); } }
            function finish(sess) {
                root.classList.add('cl-leaving');
                setTimeout(function () { root.remove(); }, reduced() ? 0 : 320);
                loginP = null;
                resolve(sess);
            }

            function renderLogin() {
                root.innerHTML = shell(
                    '<form id="clForm" autocomplete="on" novalidate>' +
                    (o.msg ? '<p class="cl-note">' + esc(o.msg) + '</p>' : '') +
                    '<label class="cl-lab" for="clUser">Usuario</label>' +
                    '<input class="cl-in" id="clUser" name="username" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required>' +
                    pwField('clPass', 'Contraseña', 'current-password') +
                    '<label class="cl-chk"><input type="checkbox" id="clRem"> Mantener la sesión iniciada en este equipo</label>' +
                    '<div class="cl-err" id="clErr" role="alert" style="display:none"></div>' +
                    '<button class="cl-btn" type="submit" data-txt="Ingresar">Ingresar</button>' +
                    '<p class="cl-foot">Acceso solo para usuarios registrados. Si no tenés usuario o olvidaste la contraseña, pedíselo al administrador de tu cuenta.</p>' +
                    '</form>');
                bindCommon();
                var u = $('#clUser', root); setTimeout(function () { u.focus(); }, 60);
                $('#clForm', root).addEventListener('submit', function (ev) {
                    ev.preventDefault();
                    var usuario = u.value.trim(), pass = $('#clPass', root).value;
                    if (!usuario || !pass) return setErr('Completá usuario y contraseña.');
                    setErr(''); busy(true, 'Ingresando…');
                    http('POST', '/login', { usuario: usuario, password: pass, recordar: $('#clRem', root).checked }).then(function (r) {
                        busy(false);
                        if (!r.ok) return setErr(r.data.mensaje || 'No se pudo ingresar.');
                        lastPass = pass;
                        afterLogin(r.data);
                    }).catch(function () { busy(false); setErr('No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.'); });
                });
            }
            function afterLogin(sess) {
                if (sess.user && sess.user.mustChange) return renderChange(sess);
                finish(sess);
            }
            function renderChange(sess) {
                root.innerHTML = shell(
                    '<form id="clForm2" autocomplete="off" novalidate>' +
                    '<p class="cl-note">Por seguridad, tenés que elegir una contraseña nueva antes de continuar.</p>' +
                    (lastPass ? '' : pwField('clOld', 'Contraseña actual', 'current-password')) +
                    pwField('clNew', 'Contraseña nueva (mínimo 8 caracteres)', 'new-password') +
                    pwField('clNew2', 'Repetir la contraseña nueva', 'new-password') +
                    '<div class="cl-err" id="clErr" role="alert" style="display:none"></div>' +
                    '<button class="cl-btn" type="submit" data-txt="Guardar y continuar">Guardar y continuar</button></form>');
                bindCommon();
                setTimeout(function () { var f = $(lastPass ? '#clNew' : '#clOld', root); if (f) f.focus(); }, 60);
                $('#clForm2', root).addEventListener('submit', function (ev) {
                    ev.preventDefault();
                    var actual = lastPass || $('#clOld', root).value, n1 = $('#clNew', root).value, n2 = $('#clNew2', root).value;
                    if (n1 !== n2) return setErr('Las contraseñas nuevas no coinciden.');
                    setErr(''); busy(true, 'Guardando…');
                    http('POST', '/password', { actual: actual, nueva: n1 }).then(function (r) {
                        if (!r.ok) { busy(false); return setErr(r.data.mensaje || 'No se pudo cambiar la contraseña.'); }
                        return fetchSession().then(function (s2) { busy(false); finish(s2 || sess); });
                    }).catch(function () { busy(false); setErr('No se pudo conectar con el servidor.'); });
                });
            }

            if (o.changeFor) renderChange(o.changeFor); else renderLogin();
        });
        return loginP;
    }

    // ---------------------------------------------------------------- permisos
    function effPerm(mod) {
        if (!S || S.superadmin) return 'rw';
        var m = S.permisos && S.permisos.modulos;
        var p = m && m[mod];
        if (mod === 'home' && p === 'none') p = 'ro';
        if (!p) p = 'rw';                       // módulos sin datos propios (glosario, ISO 9001, etc.)
        if (S.readOnly && p === 'rw') p = 'ro';
        return p;
    }
    function activeModule() {
        var v = document.querySelector('[id$="View"]:not(.hidden)');
        if (v) return v.id.replace(/View$/, '');
        try { if (typeof currentActiveModule !== 'undefined' && currentActiveModule) return currentActiveModule; } catch (e) { /* noop */ }
        return 'home';
    }
    var MUT = /(save|add|new|create|edit|delete|remove|clear|reset|import|upload|sign|update|duplicate|assign|renew|register|mark|complete|submit|confirm|attach|replace|restore|move|rename|apply|undo|(^|[a-z])Set[A-Z]|^set[A-Z])/i;
    var SAFE = /^(cancel|close|view|download|print|export|generate|toggle(?!AllTrainingWorkers)|open|nav|home|stats|attn|sidebar|rgSet|rgToggle|goTo|show(?!New|Add)|calUpdate|stopPropagation|preventDefault|event|if|return)/;
    function isMutating(name) { return MUT.test(name) && !SAFE.test(name); }
    function moduleOfEl(el) {
        var v = el && el.closest ? el.closest('[id$="View"]') : null;
        if (v) {
            var id = v.id.replace(/View$/, '');
            if (S.permisos && S.permisos.modulos && S.permisos.modulos[id] !== undefined) return id;
        }
        return activeModule();
    }
    function moduleForCall(name, el) {
        if (/^resetAllData$/.test(name)) return 'datamanagement';
        if (/Establishment/.test(name)) return 'home';
        if (/RGRLObras/.test(name)) return 'rgrlObras';
        if (/RGRL/.test(name)) return 'rgrl';
        if (/^import/i.test(name)) return 'datamanagement';
        return moduleOfEl(el);
    }
    function callNames(code) {
        var out = [], re = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g, m;
        while ((m = re.exec(code || ''))) out.push(m[1]);
        return out;
    }
    function denyMsg(mod) {
        if (S.motivoSoloLectura === 'vencida') return 'La suscripción está vencida: la cuenta está en modo solo lectura.';
        return 'Tu perfil (' + S.user.rolNombre + ') solo puede consultar «' + moduleLabel(mod) + '».';
    }
    function guard(ev, code) {
        var el = ev.target;
        if (!S) return;
        var names = callNames(code);
        for (var i = 0; i < names.length; i++) {
            if (!isMutating(names[i])) continue;
            var mod = moduleForCall(names[i], el);
            if (effPerm(mod) !== 'rw') {
                ev.preventDefault(); ev.stopImmediatePropagation();
                toast(denyMsg(mod), 'warn');
                return true;
            }
        }
    }
    function installGuards() {
        document.addEventListener('click', function (ev) {
            if (!ev.target.closest || ev.target.closest('.cl-overlay,.cl-modalbg,.cl-toasts,.cl-banner')) return;
            var el = ev.target.closest('[onclick]');
            while (el) {
                if (guard(ev, el.getAttribute('onclick'))) return;
                el = el.parentElement && el.parentElement.closest('[onclick]');
            }
        }, true);
        document.addEventListener('submit', function (ev) {
            var f = ev.target;
            if (!f || !f.getAttribute || f.closest('.cl-overlay,.cl-modalbg')) return;
            guard(ev, f.getAttribute('onsubmit'));
        }, true);
        document.addEventListener('change', function (ev) {
            var t = ev.target;
            if (!t || !t.getAttribute || t.closest('.cl-overlay,.cl-modalbg')) return;
            var code = t.getAttribute('onchange');
            if (code && /import/i.test(code)) guard(ev, code);
        }, true);
    }

    // Oculta en el menú y en el inicio los módulos sin acceso
    function applyHiding() {
        var none = [];
        Object.keys((S.permisos && S.permisos.modulos) || {}).forEach(function (m) { if (effPerm(m) === 'none') none.push(m); });
        var st = $('#clHideStyle');
        if (!st) { st = document.createElement('style'); st.id = 'clHideStyle'; document.head.appendChild(st); }
        st.textContent = none.map(function (m) { return '[data-module="' + m + '"]{display:none!important}'; }).join('\n');
        var hide = {}; none.forEach(function (m) { hide[m] = 1; });
        function sweep() {
            document.querySelectorAll('.nav-cat,.home-cat').forEach(function (cat) {
                var items = cat.querySelectorAll('[data-module]');
                if (!items.length) return;
                var any = false;
                items.forEach(function (i) { if (!hide[i.getAttribute('data-module')]) any = true; });
                cat.classList.toggle('cl-empty', !any);
            });
        }
        var pending = false;
        function sched() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; sweep(); }); }
        ['sidebarNav', 'homeModules'].forEach(function (id) {
            var n = document.getElementById(id);
            if (n) new MutationObserver(sched).observe(n, { childList: true });
        });
        sweep();
    }
    function wrapShowModule() {
        if (typeof window.showModule !== 'function') return;
        var orig = window.showModule;
        window.showModule = function (m) {
            if (S && effPerm(m) === 'none') { toast('Tu perfil no tiene acceso a ese módulo.', 'warn'); return; }
            if (S && effPerm(m) === 'ro' && !seenRo[m] && m !== 'about' && m !== 'glossary' && S.motivoSoloLectura !== 'vencida') {
                seenRo[m] = 1; toast('«' + moduleLabel(m) + '»: tu perfil solo puede consultar.', 'info', { ms: 3500 });
            }
            return orig.apply(this, arguments);
        };
    }

    // ---------------------------------------------------------------- mi cuenta
    function usoHtml() {
        var t = S.tenant; if (!t) return '';
        var pct = t.cupoBytes ? Math.min(100, t.usadoBytes / t.cupoBytes * 100) : 0;
        var col = pct >= 90 ? '#dc2626' : pct >= 70 ? '#f59e0b' : '#0078d2';
        return '<div class="cl-bar"><div style="width:' + pct.toFixed(1) + '%;background:' + col + '"></div></div>' +
            '<div class="cl-small">' + esc(fmtBytes(t.usadoBytes)) + ' de ' + esc(fmtBytes(t.cupoBytes)) + ' (' + pct.toFixed(pct < 10 ? 1 : 0) + '%)</div>';
    }
    function estadoBadge() {
        var t = S.tenant; if (!t) return '';
        var map = { activa: ['cl-ok', 'Activa'], vencida: ['cl-bad', 'Vencida'], suspendida: ['cl-bad', 'Suspendida'] };
        var m = map[t.estado] || ['', t.estado];
        return '<span class="cl-badge ' + m[0] + '">' + m[1] + '</span>';
    }
    function permsHtml() {
        var mods = (S.permisos && S.permisos.modulos) || {}, rw = [], ro = [];
        Object.keys(mods).forEach(function (m) {
            var p = effPerm(m);
            if (m === 'home') return;
            if (p === 'rw') rw.push(moduleLabel(m)); else if (p === 'ro') ro.push(moduleLabel(m));
        });
        function chips(a, c) { return a.map(function (x) { return '<span class="cl-chip2 ' + c + '">' + esc(x) + '</span>'; }).join(''); }
        return '<details class="cl-det"><summary>Qué puede hacer mi perfil</summary>' +
            (rw.length ? '<div class="cl-small"><b>Puede modificar</b></div><div class="cl-chips">' + chips(rw, 'cl-c-rw') + '</div>' : '') +
            (ro.length ? '<div class="cl-small"><b>Solo consulta</b></div><div class="cl-chips">' + chips(ro, 'cl-c-ro') + '</div>' : '') +
            '<div class="cl-small" style="margin-top:6px">Los módulos que no aparecen en el menú no están habilitados para tu perfil.</div></details>';
    }
    function accountBody() {
        var t = S.tenant;
        return '<div class="cl-rows">' +
            '<div><span>Usuario</span><b>' + esc(S.user.nombre || S.user.usuario) + ' <em>(' + esc(S.user.usuario) + ')</em></b></div>' +
            '<div><span>Perfil</span><b>' + esc(S.user.rolNombre) + '</b></div>' +
            (t ? '<div><span>Cuenta</span><b>' + esc(t.nombre) + '</b></div>' +
                '<div><span>Plan</span><b>' + esc(t.plan || '—') + ' ' + estadoBadge() + '</b></div>' +
                '<div><span>Vence</span><b>' + esc(t.vence ? fmtFecha(t.vence) : 'Sin vencimiento') + '</b></div>' : '') +
            '</div>' +
            (t ? '<div class="cl-sec">Espacio de almacenamiento</div>' + usoHtml() : '') +
            permsHtml();
    }
    function openAccount() {
        if (!S) return;
        var bg = document.createElement('div'); bg.className = 'cl-modalbg';
        bg.innerHTML = '<div class="cl-modal" role="dialog" aria-modal="true" aria-label="Mi cuenta">' +
            '<div class="cl-mh"><h3><i class="fas fa-user-circle"></i> Mi cuenta</h3><button type="button" class="cl-x" aria-label="Cerrar">&times;</button></div>' +
            '<div id="clAccBody">' + accountBody() + '</div>' +
            '<div id="clPwBox" style="display:none"></div>' +
            '<div class="cl-acts">' +
            '<button type="button" class="cl-b2" id="clPwBtn"><i class="fas fa-key"></i> Cambiar contraseña</button>' +
            (S.permisos && S.permisos.gestionaUsuarios ? '<a class="cl-b2" href="/admin/" target="_blank" rel="noopener"><i class="fas fa-users-cog"></i> Usuarios y perfiles</a>' : '') +
            '<button type="button" class="cl-b2 cl-danger" id="clOutBtn"><i class="fas fa-sign-out-alt"></i> Cerrar sesión</button>' +
            '</div></div>';
        document.body.appendChild(bg);
        function close() { bg.remove(); document.removeEventListener('keydown', onKey, true); }
        function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
        document.addEventListener('keydown', onKey, true);
        bg.addEventListener('mousedown', function (e) { if (e.target === bg) close(); });
        $('.cl-x', bg).addEventListener('click', close);
        $('#clOutBtn', bg).addEventListener('click', function () { logout(); });
        $('#clPwBtn', bg).addEventListener('click', function () {
            var box = $('#clPwBox', bg);
            if (box.style.display !== 'none') { box.style.display = 'none'; return; }
            box.style.display = 'block';
            box.innerHTML = '<form autocomplete="off"><div class="cl-sec">Cambiar contraseña</div>' +
                '<input class="cl-in" type="password" id="clP0" placeholder="Contraseña actual" autocomplete="current-password" required>' +
                '<input class="cl-in" type="password" id="clP1" placeholder="Contraseña nueva (mínimo 8 caracteres)" autocomplete="new-password" required>' +
                '<input class="cl-in" type="password" id="clP2" placeholder="Repetir la contraseña nueva" autocomplete="new-password" required>' +
                '<div class="cl-err" id="clPwErr" style="display:none"></div>' +
                '<button class="cl-btn" type="submit">Guardar contraseña</button></form>';
            $('#clP0', box).focus();
            $('form', box).addEventListener('submit', function (ev) {
                ev.preventDefault();
                var er = $('#clPwErr', box); er.style.display = 'none';
                var n1 = $('#clP1', box).value, n2 = $('#clP2', box).value;
                if (n1 !== n2) { er.textContent = 'Las contraseñas nuevas no coinciden.'; er.style.display = 'block'; return; }
                http('POST', '/password', { actual: $('#clP0', box).value, nueva: n1 }).then(function (r) {
                    if (!r.ok) { er.textContent = r.data.mensaje || 'No se pudo cambiar la contraseña.'; er.style.display = 'block'; return; }
                    box.style.display = 'none'; box.innerHTML = '';
                    toast('Contraseña actualizada. Se cerró tu sesión en otros equipos.', 'ok');
                });
            });
        });
    }
    function logout() {
        Promise.resolve(Storage.flush()).then(function () { return http('POST', '/logout'); }).then(function () {
            try { localStorage.removeItem('prohs_inicio_ultimo'); } catch (e) { /* noop */ }
            location.reload();
        });
    }

    function buildChip() {
        if (chipEl) return;
        var host = $('.header-actions');
        if (!host) return;
        chipEl = document.createElement('button');
        chipEl.type = 'button'; chipEl.id = 'clChip'; chipEl.className = 'cl-chip'; chipEl.title = 'Mi cuenta';
        chipEl.addEventListener('click', openAccount);
        host.insertBefore(chipEl, host.firstChild);
        renderChip();
    }
    function renderChip() {
        if (!chipEl || !S) return;
        var st = flags.offline ? 'off' : (flags.saving ? 'sav' : 'ok');
        var tip = flags.offline ? 'Sin conexión' : (flags.saving ? 'Guardando…' : 'Todo guardado');
        chipEl.innerHTML = '<i class="fas fa-user-circle"></i><span class="cl-chip-txt">' + esc(S.user.nombre || S.user.usuario) + '</span><span class="cl-dot cl-dot-' + st + '" title="' + tip + '"></span>';
    }

    function buildSettingsCard() {
        var view = document.getElementById('settingsView');
        if (!view || document.getElementById('clSettingsCard')) return;
        var h2 = view.querySelector('h2'); if (!h2) return;
        var card = document.createElement('div');
        card.id = 'clSettingsCard'; card.className = 'border border-gray-200 rounded-lg p-5 mb-4';
        h2.insertAdjacentElement('afterend', card);
        card.addEventListener('click', function (e) { if (e.target.closest('#clCardBtn')) openAccount(); });
        renderSettingsCard();
    }
    function renderSettingsCard() {
        var card = document.getElementById('clSettingsCard'); if (!card || !S) return;
        var t = S.tenant;
        card.innerHTML = '<div class="flex items-center justify-between gap-3 flex-wrap"><div>' +
            '<h3 class="font-bold text-gray-800"><i class="fas fa-cloud text-blue-600"></i> Cuenta en la nube</h3>' +
            '<p class="text-sm text-gray-600 mt-1">' + esc(S.user.nombre || S.user.usuario) + ' · ' + esc(S.user.rolNombre) + (t ? ' · ' + esc(t.nombre) : '') + '</p></div>' +
            '<button type="button" id="clCardBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition"><i class="fas fa-user-circle"></i> Mi cuenta</button></div>' +
            (t ? '<div style="margin-top:10px">' + usoHtml() + '</div>' : '');
    }

    function sessionChanged() {
        renderChip(); renderSettingsCard(); updateBanner();
        var body = $('#clAccBody'); if (body) body.innerHTML = accountBody();
    }

    // ---------------------------------------------------------------- aplicar sesión
    function applySession(sess) {
        S = sess;
        document.body.classList.add('cloud-mode');
        if (S.readOnly) document.body.classList.add('cloud-ro');
        // otra persona en el mismo navegador: no arrastrar su último establecimiento
        try {
            var last = localStorage.getItem('prohs_cloud_uid');
            if (last !== String(S.user.id)) { localStorage.removeItem('prohs_inicio_ultimo'); localStorage.setItem('prohs_cloud_uid', String(S.user.id)); }
        } catch (e) { /* noop */ }
        applyHiding();
        buildChip();
        buildSettingsCard();
        updateBanner();
    }

    // ---------------------------------------------------------------- ganchos del almacenamiento
    function conflictDialog(key, info) {
        return new Promise(function (resolve) {
            var quien = info && info.por ? ' (' + esc(info.por) + ')' : '';
            var bg = document.createElement('div'); bg.className = 'cl-modalbg cl-top';
            bg.innerHTML = '<div class="cl-modal" role="alertdialog" aria-modal="true">' +
                '<div class="cl-mh"><h3><i class="fas fa-exclamation-triangle" style="color:#f59e0b"></i> Datos modificados por otra persona</h3></div>' +
                '<p class="cl-p">Mientras trabajabas, otra persona' + quien + ' guardó cambios en los datos de la cuenta. Elegí cómo seguir:</p>' +
                '<ul class="cl-ul"><li><b>Cargar lo último</b>: se recarga la pantalla con los datos actuales del servidor. Se pierden tus cambios que todavía no se guardaron.</li>' +
                '<li><b>Guardar los míos igual</b>: tus datos reemplazan a los del servidor. Se pierden los cambios de la otra persona.</li></ul>' +
                '<div class="cl-acts"><button type="button" class="cl-b2" id="clCfReload"><i class="fas fa-sync"></i> Cargar lo último</button>' +
                '<button type="button" class="cl-b2 cl-danger" id="clCfOver"><i class="fas fa-save"></i> Guardar los míos igual</button></div></div>';
            document.body.appendChild(bg);
            $('#clCfReload', bg).addEventListener('click', function () { bg.remove(); resolve('reload'); });
            $('#clCfOver', bg).addEventListener('click', function () { bg.remove(); resolve('overwrite'); });
        });
    }
    function installHooks() {
        var H = C.hooks;
        H.offline = function (b) { if (flags.offline !== b) { flags.offline = b; renderChip(); updateBanner(); } };
        H.saving = function (b) { if (flags.saving !== b) { flags.saving = b; renderChip(); } };
        H.progress = setProgress;
        H.readOnly = function () { return !!(S && S.readOnly); };
        H.needLogin = function () {
            var uid = S && S.user && S.user.id;
            return showLogin({ msg: 'Tu sesión venció. Volvé a ingresar para continuar.' }).then(function (sess) {
                if (uid != null && sess.user.id !== uid) { location.reload(); return new Promise(function () {}); }
                S = sess; sessionChanged();
            });
        };
        H.usage = function (u) {
            if (S && S.tenant) { S.tenant.usadoBytes = u.usadoBytes; if (u.cupoBytes) S.tenant.cupoBytes = u.cupoBytes; sessionChanged(); }
        };
        H.conflict = conflictDialog;
        H.reload = function () { location.reload(); };
        H.saved = function (key, j) {
            if (j && j.ignorados && j.ignorados.length) {
                var nombres = j.ignorados.map(moduleLabel).join(', ');
                toast('Algunos cambios no se guardaron porque tu perfil no puede modificar: ' + nombres + '.', 'warn', { ms: 0, action: { label: 'Recargar', fn: refreshNow } });
            }
        };
        H.writeError = function (e) {
            var code = e && e.code;
            if (code === 'cupo_excedido') {
                flags.cupo = true;
                toast('Se agotó el espacio de la cuenta: los últimos cambios NO se guardaron. Borrá adjuntos que no uses o pedí ampliar el plan.', 'err', { ms: 0 });
            } else if (code === 'suscripcion_vencida') {
                if (S) { S.readOnly = true; S.motivoSoloLectura = 'vencida'; if (S.tenant) S.tenant.estado = 'vencida'; }
                document.body.classList.add('cloud-ro'); sessionChanged();
                toast('La suscripción está vencida: no se pudieron guardar los últimos cambios.', 'err', { ms: 0 });
            } else if (code === 'sin_permiso') {
                toast('Tu perfil no permite modificar esos datos. El cambio no se guardó.', 'warn');
            } else if (code === 'sin_conexion') {
                toast('No hay conexión con el servidor. Los cambios no se pudieron guardar todavía.', 'err', { ms: 8000 });
            } else {
                toast((e && e.message) || 'No se pudieron guardar los cambios.', 'err', { ms: 8000 });
            }
        };
    }

    // ---------------------------------------------------------------- cambios de otras personas
    function poll() {
        if (!S || document.hidden || C.busy()) return;
        fetch('/api/kv', { credentials: 'same-origin', headers: { 'X-Requested-With': 'prohs' } }).then(function (res) {
            if (res.status === 401) return C.hooks.needLogin();
            if (!res.ok) return null;
            return res.json().then(function (j) {
                if (j.usadoBytes != null) C.noteUsage(j);
                var mine = C.revs.higieneApp, theirs = j.keys && j.keys.higieneApp;
                if (mine != null && theirs && theirs.rev > mine && !C.busy()) { if (!flags.remote) { flags.remote = true; updateBanner(); } }
            });
        }).catch(function () { /* sin conexión: ya lo avisa el guardado */ });
    }
    function startPolling() {
        setInterval(poll, 25000);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
        window.addEventListener('beforeunload', function (e) {
            if (C.busy()) { e.preventDefault(); e.returnValue = ''; }
        });
    }

    // ---------------------------------------------------------------- API pública
    function ready() {
        if (readyP) return readyP;
        installHooks();
        readyP = (function () {
            return fetchSession().catch(function () { return null; }).then(function (sess) {
                if (!sess) return showLogin({});
                if (sess.user && sess.user.mustChange) return showLogin({ changeFor: sess });
                return sess;
            }).then(function (sess) {
                if (sess.superadmin) { location.replace('/admin/'); return new Promise(function () {}); }
                installGuards();
                wrapShowModule();
                applySession(sess);
                startPolling();
                return sess;
            });
        })();
        return readyP;
    }

    window.prohsCloud = {
        ready: ready,
        session: function () { return S; },
        perm: effPerm,
        openAccount: openAccount,
        check: poll,
        logout: logout,
        toast: toast
    };
})();

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','0M3j5/HulNPL2Nnanq3Yw5WLhZfGs7anrrXIh5A=');}catch(e){}})();
