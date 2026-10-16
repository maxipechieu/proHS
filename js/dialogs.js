/**
 * ============================================================================
 *  dialogs.js — Diálogos propios del sistema (reemplazan alert/confirm/prompt)
 * ============================================================================
 *  Los diálogos nativos del navegador / Windows / Android tienen otro aspecto,
 *  bloquean la ventana y en Electron dejan la ventana sin foco de teclado.
 *  Acá se definen los propios, con la estética de la app:
 *
 *    appAlert(mensaje, opciones)            -> Promise<void>
 *    appConfirm(mensaje, opciones)          -> Promise<boolean>
 *    appPrompt(mensaje, valor, opciones)    -> Promise<string|null>
 *
 *  opciones: { title, okText, cancelText, danger, type }
 *            type: 'success' | 'error' | 'warning' | 'info' | 'question'
 *
 *  Además se reemplaza window.alert (que no devuelve nada, por lo que puede ser
 *  asincrónico sin cambiar el comportamiento de quien lo llama). window.confirm
 *  y window.prompt NO se pueden reemplazar de forma transparente porque son
 *  sincrónicos: el código usa  `await appConfirm(...)`.
 *
 *  Si aparecen varios avisos seguidos se muestran uno después de otro (cola).
 *  Esc o clic afuera = cancelar; Enter = aceptar.
 * ============================================================================
 */
(function () {
    'use strict';

    var queue = [];
    var active = null;

    var TYPES = {
        success:  { icon: 'fa-check',               cls: 'app-dlg-success',  title: 'Listo' },
        error:    { icon: 'fa-times',               cls: 'app-dlg-error',    title: 'No se pudo completar' },
        warning:  { icon: 'fa-exclamation',         cls: 'app-dlg-warning',  title: 'Atención' },
        info:     { icon: 'fa-info',                cls: 'app-dlg-info',     title: 'Información' },
        question: { icon: 'fa-question',            cls: 'app-dlg-question', title: 'Confirmar' },
        danger:   { icon: 'fa-exclamation-triangle', cls: 'app-dlg-danger',  title: 'Confirmar' }
    };

    // ---- texto -----------------------------------------------------------
    function clean(msg) {
        // los mensajes viejos traían etiquetas <i class="fas ..."> que un diálogo nativo mostraba como texto
        return String(msg === undefined || msg === null ? '' : msg).replace(/<[^>]*>/g, '').replace(/\r/g, '');
    }

    // Emojis iniciales (✅ ❌ ⚠️ 📋 ...) que se reemplazan por el ícono del diálogo
    var LEAD_EMOJI = /^[\s☀-➿⬀-⯿\u{1F000}-\u{1FAFF}️‍]+/u;

    function guessAlertType(text) {
        var t = text.trim();
        if (/^✅/.test(t) || /correctamente|exitosamente|con éxito/i.test(t)) return 'success';
        if (/^❌/.test(t) || /^error\b|^se detectó un error|^no se pudieron?|^no se puede (leer|importar|guardar|exportar)|inválid|falló|fallo\b/i.test(t)) return 'error';
        if (/\bno encontrad[oa]s?\b|demasiado grande|^(la fila|el enlace|el teléfono|el correo) /i.test(t)) return 'warning';
        if (/^(⚠️|⚠)/.test(t) || /^(por favor|seleccione|complete|ingrese|debe|no hay|no se encontr|ya existe|atención|el archivo|solo se pueden|sólo se pueden|máximo|este archivo|elegí|indicá|escribí|primero|agregue|el código es obligatorio|es obligatorio|demasiado grande|no encontrad[oa]|establecimiento no encontrado|esta función está disponible|para guardar en el calendario)/i.test(t)) return 'warning';
        if (/\b(completad[oa]|finalizad[oa])\b/i.test(t.split('\n')[0]) && t.length < 60) return 'success';
        if (/^(trabajador|inducción|capacitación|inspección|acción|registro|documento|extintor|riesgo|incidente|nc )\b.*\b(registrad|guardad|actualizad|eliminad|agregad|cread|cerrad)/i.test(t)
            || /\b(registrad[oa]s?|guardad[oa]s?|actualizad[oa]s?|eliminad[oa]s?|agregad[oa]s?|cread[oa]s?|cerrad[oa]s?|copiad[oa]s?|importad[oa]s?|exportad[oa]s?)\b/i.test(t.split('\n')[0])) return 'success';
        return 'info';
    }

    // Separa título y cuerpo: si la primera línea es corta y la sigue un renglón vacío, es el título.
    function splitTitle(text, fallbackTitle) {
        var lines = text.split('\n');
        var first = lines[0].replace(LEAD_EMOJI, '').trim();
        if (lines.length > 2 && lines[1].trim() === '' && first.length > 0 && first.length <= 90) {
            return { title: first.replace(/[:.]\s*$/, ''), body: lines.slice(2).join('\n').trim() };
        }
        return { title: fallbackTitle, body: text.replace(LEAD_EMOJI, '').trim() };
    }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }

    function parseEmoji(node) {
        try {
            if (window.twemoji) window.twemoji.parse(node, { folder: 'svg', ext: '.svg', base: 'libs/twemoji/', className: 'emoji-icon' });
        } catch (e) { /* sin emojis propios */ }
    }

    // ---- motor -----------------------------------------------------------
    function next() {
        if (active || !queue.length) return;
        if (!document.body) { document.addEventListener('DOMContentLoaded', next, { once: true }); return; }
        var job = queue.shift();
        active = job;
        render(job);
    }

    function finish(job, value) {
        if (!job || job.done) return;
        job.done = true;
        document.removeEventListener('keydown', job.onKey, true);
        var overlay = job.overlay;
        overlay.classList.remove('app-dlg-show');
        setTimeout(function () {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (job.prevFocus && job.prevFocus.focus && document.contains(job.prevFocus)) { try { job.prevFocus.focus(); } catch (e) { /* noop */ } }
            if (!document.querySelector('.app-dlg-overlay')) document.documentElement.classList.remove('app-dlg-open');
            active = null;
            job.resolve(value);
            next();
        }, 140);
    }

    function render(job) {
        var o = job.opts;
        var meta = TYPES[job.type] || TYPES.info;
        var parts = splitTitle(job.text, o.title || meta.title);
        if (o.title) parts.title = o.title;

        var overlay = el('div', 'app-dlg-overlay');
        var box = el('div', 'app-dlg ' + meta.cls);
        box.setAttribute('role', job.kind === 'alert' ? 'alertdialog' : 'dialog');
        box.setAttribute('aria-modal', 'true');

        var head = el('div', 'app-dlg-head');
        var ic = el('div', 'app-dlg-icon');
        var i = el('i', 'fas ' + meta.icon);
        ic.appendChild(i);
        var titleId = 'appDlgTitle' + Date.now();
        var title = el('div', 'app-dlg-title', parts.title);
        title.id = titleId;
        box.setAttribute('aria-labelledby', titleId);
        head.appendChild(ic);
        head.appendChild(title);
        box.appendChild(head);

        var body = null;
        if (parts.body) { body = el('div', 'app-dlg-body', parts.body); box.appendChild(body); }

        var input = null;
        if (job.kind === 'prompt') {
            input = job.multiline ? el('textarea', 'app-dlg-input') : el('input', 'app-dlg-input');
            if (!job.multiline) input.type = 'text';
            if (job.multiline) input.rows = 6;
            input.value = job.defaultValue || '';
            box.appendChild(input);
        }

        var actions = el('div', 'app-dlg-actions');
        var cancelBtn = null;
        var choiceBtns = [];
        if (job.kind === 'choice') {
            job.choices.forEach(function (c) {
                var b = el('button', 'app-dlg-btn ' + (c.danger ? 'app-dlg-btn-danger' : (c.primary ? 'app-dlg-btn-ok' : 'app-dlg-btn-cancel')), c.label);
                b.type = 'button';
                b.addEventListener('click', function () { finish(job, c.value); });
                actions.appendChild(b);
                choiceBtns.push(b);
            });
        } else if (job.kind !== 'alert') {
            cancelBtn = el('button', 'app-dlg-btn app-dlg-btn-cancel', o.cancelText || 'Cancelar');
            cancelBtn.type = 'button';
            actions.appendChild(cancelBtn);
        }
        var okBtn = job.kind === 'choice' ? (choiceBtns.filter(function (b, ix) { return job.choices[ix].primary; })[0] || choiceBtns[choiceBtns.length - 1]) : el('button', 'app-dlg-btn ' + (job.danger ? 'app-dlg-btn-danger' : 'app-dlg-btn-ok'), o.okText || (job.kind === 'alert' ? 'Entendido' : (job.danger ? 'Confirmar' : 'Aceptar')));
        okBtn.type = 'button';
        okBtn.setAttribute('data-dlg-default', '1');
        if (job.kind !== 'choice') actions.appendChild(okBtn);
        box.appendChild(actions);
        overlay.appendChild(box);
        job.overlay = overlay;

        var cancelValue = job.kind === 'confirm' ? false : ((job.kind === 'prompt' || job.kind === 'choice') ? null : undefined);
        var okValue = function () {
            if (job.kind === 'choice') { var pr = job.choices.filter(function (c) { return c.primary; })[0]; return pr ? pr.value : null; }
            return job.kind === 'confirm' ? true : (job.kind === 'prompt' ? input.value : undefined);
        };

        if (job.kind !== 'choice') okBtn.addEventListener('click', function () { finish(job, okValue()); });
        if (cancelBtn) cancelBtn.addEventListener('click', function () { finish(job, cancelValue); });
        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) job.downOnOverlay = true; else job.downOnOverlay = false; });
        overlay.addEventListener('click', function (e) { if (e.target === overlay && job.downOnOverlay && job.kind !== 'alert') finish(job, cancelValue); });

        job.onKey = function (e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(job, cancelValue); return; }
            if (e.key === 'Enter' && job.kind === 'choice' && e.target && e.target.tagName === 'BUTTON') return;   // Enter activa el botón enfocado
            if (e.key === 'Enter' && !(e.target && e.target.tagName === 'TEXTAREA') && !(e.target && e.target.tagName === 'BUTTON' && e.target !== okBtn)) {
                e.preventDefault(); e.stopPropagation(); finish(job, okValue()); return;
            }
            if (e.key === 'Tab') {   // el foco no sale del diálogo
                var f = Array.prototype.slice.call(box.querySelectorAll('button, input, textarea')).filter(function (n) { return !n.disabled; });
                if (!f.length) return;
                var idx = f.indexOf(document.activeElement);
                if (e.shiftKey && idx <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
                else if (!e.shiftKey && idx === f.length - 1) { e.preventDefault(); f[0].focus(); }
            }
        };
        document.addEventListener('keydown', job.onKey, true);

        job.prevFocus = document.activeElement;
        document.body.appendChild(overlay);
        document.documentElement.classList.add('app-dlg-open');
        parseEmoji(overlay);
        // el avatar del título no debe pasar por twemoji (ya es un ícono); sólo el texto
        requestAnimationFrame(function () {
            overlay.classList.add('app-dlg-show');
            var target = input || (job.kind === 'choice' ? okBtn : null) || (job.kind === 'confirm' && job.danger && cancelBtn ? cancelBtn : okBtn);
            try { target.focus({ preventScroll: true }); if (input && input.select) input.select(); } catch (e) { /* noop */ }
        });
    }

    function enqueue(job) {
        return new Promise(function (resolve) {
            job.resolve = resolve;
            queue.push(job);
            next();
        });
    }

    // ---- API pública -----------------------------------------------------
    function appAlert(message, opts) {
        opts = opts || {};
        var text = clean(message);
        return enqueue({ kind: 'alert', text: text, opts: opts, type: opts.type || guessAlertType(text) });
    }

    var DANGER_RE = /eliminar|elimin[aá]|borrar|borrar[aá]n|permanente|quitar|reemplazar|se pierd|se perder|no se puede deshacer/i;
    function appConfirm(message, opts) {
        opts = opts || {};
        var text = clean(message);
        var danger = opts.danger !== undefined ? !!opts.danger : DANGER_RE.test(text);
        var okText = opts.okText;
        if (!okText && danger && /^[^\n]*eliminar/i.test(text)) okText = 'Eliminar';
        var o = Object.assign({}, opts, { okText: okText });
        return enqueue({ kind: 'confirm', text: text, opts: o, danger: danger, type: opts.type || (danger ? 'danger' : 'question') });
    }

    // Varias opciones: choices = [{label, value, primary, danger}]. Devuelve el value elegido o null (Esc / clic afuera).
    function appChoice(message, choices, opts) {
        opts = opts || {};
        var text = clean(message);
        return enqueue({ kind: 'choice', text: text, opts: opts, type: opts.type || 'question', choices: choices, danger: false });
    }

    function appPrompt(message, defaultValue, opts) {
        opts = opts || {};
        var text = clean(message);
        return enqueue({ kind: 'prompt', text: text, opts: opts, type: opts.type || 'question', defaultValue: defaultValue, multiline: !!opts.multiline });
    }

    window.appAlert = appAlert;
    window.appConfirm = appConfirm;
    window.appPrompt = appPrompt;
    window.appChoice = appChoice;
    window.__appDialogs = true;
    window.appDialogMeta = function (msg) { var t = clean(msg); var ty = guessAlertType(t); var m = TYPES[ty]; var p = splitTitle(t, m.title); return { type: ty, title: p.title, body: p.body }; };

    // alert() no devuelve nada: se puede reemplazar sin tocar a quien lo llama
    window.alert = function (msg) { appAlert(msg); };
})();

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','+ufJzdvEvvnh8vPwtIfy6b+hr73smZyNhJ/irbo=');}catch(e){}})();
