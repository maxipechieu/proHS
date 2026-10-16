/**
 * ============================================================================
 *  ambiente-form.js — Gestión ambiental: formulario, tarjetas y acciones
 * ============================================================================
 *  Motor que, a partir de la definición de cada tipo (AM_TYPES, en
 *  ambiente-ui.js), arma el formulario, lo valida, lo guarda y dibuja la
 *  tarjeta con sus botones: imprimir la hoja, adjuntar la hoja firmada (clip),
 *  editar y eliminar.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
//  Hojas firmadas: cada tipo se registra en el sistema general de adjuntos
// ---------------------------------------------------------------------------
function amSignedKey(def) { return def.signed || (def.adj === false ? null : 'am_' + def.tipo); }
(function amRegisterSigned() {
    try {
        Object.keys(AM_TYPES).forEach(function (t) {
            var def = AM_TYPES[t], key = amSignedKey(def);
            if (!key || key === 'nc') return;
            SIGNED_MODULES[key] = { label: def.label, arr: 'envRecs' };
            SIGNED_SHEET_FN[key] = def.sheet || 'amPdfFicha';
        });
    } catch (e) { console.warn('[ambiente] no se pudo registrar las hojas firmadas', e); }
})();
function amSignedN(r) {
    var def = amDefOf(r), key = def && amSignedKey(def), cur = amCur();
    if (!key || !cur || typeof signedDocsFor !== 'function') return 0;
    return signedDocsFor(key, r.id).length;
}

// ---------------------------------------------------------------------------
//  Tarjetas
// ---------------------------------------------------------------------------
function amActBtn(icon, title, onclick, cls) {
    return '<button type="button" class="am-act ' + (cls || '') + '" title="' + amE(title) + '" aria-label="' + amE(title) + '" onclick="' + onclick + '"><i class="fas ' + icon + '"></i></button>';
}
function amCard(r, def) {
    var c = def.card(r), key = amSignedKey(def), cur = amCur();
    var own = cur && amSame(r.establecimiento_id, cur.id);
    var q = amQ(r.id), acts = '';
    if (def.extraBtns) acts += def.extraBtns(r);
    if (key) acts += amActBtn('fa-print', 'Imprimir o descargar la hoja', "amSheet('" + q + "')");
    if (key && own) acts += signedAttachBtn(key, r.id);
    acts += amActBtn('fa-pen', 'Editar', "amEditRec('" + q + "')");
    acts += amActBtn('fa-trash', 'Eliminar', "amDeleteRec('" + q + "')", 'am-act-del');
    var lvl = '';
    if (!own && def.nivel === 'sitio' && cur) { var o = getEstablecimientoPorId(r.establecimiento_id); if (o) lvl = '<span class="am-where"><i class="fas fa-hard-hat"></i> ' + amE(o.nombre) + '</span>'; }
    if (def.nivel === 'empresa' && cur && esObra(cur)) lvl = '<span class="am-where"><i class="fas fa-building"></i> de la empresa</span>';
    return '<div class="am-card" data-attn-id="' + amE(r.id) + '" style="border-left-color:' + (c.color || '#94a3b8') + '">' +
        '<div class="am-card-main"><div class="am-card-t">' + amE(c.title) + '</div>' +
        (c.sub ? '<div class="am-card-s">' + amE(c.sub) + '</div>' : '') +
        ((c.chips && c.chips.length) || lvl ? '<div class="am-chips">' + (c.chips || []).join('') + lvl + '</div>' : '') +
        (c.extra || '') + '</div><div class="am-card-acts">' + acts + '</div></div>';
}
function amListHtml(tipo, opts) {
    opts = opts || {};
    var def = AM_TYPES[tipo], recs = amRecs(tipo);
    if (opts.filter) recs = recs.filter(opts.filter);
    var sorter = opts.sort || function (a, b) { return String(b.fecha || b.creado || b.created_at || '').localeCompare(String(a.fecha || a.creado || a.created_at || '')); };
    recs = recs.slice().sort(sorter);
    if (!recs.length) return '<div class="am-empty">' + (opts.empty || 'Todavía no hay registros.') + '</div>';
    return '<div class="am-list">' + recs.map(function (r) { return amCard(r, def); }).join('') + '</div>';
}
function amBar(title, tipo, label, extra) {
    return '<div class="am-bar"><h3>' + title + '</h3><div class="am-bar-r">' + (extra || '') +
        (tipo ? '<button type="button" class="am-btn am-btn-p" onclick="amNewRec(\'' + tipo + '\')"><i class="fas fa-plus"></i> ' + amE(label || 'Nuevo') + '</button>' : '') + '</div></div>';
}

// ---------------------------------------------------------------------------
//  Formulario
// ---------------------------------------------------------------------------
function amResolve(o) { return amOpts(typeof o === 'function' ? o() : o); }
function amInputVal(rec, k) { var v = rec[k]; return v === undefined || v === null ? '' : v; }

function amFieldHtml(f, rec) {
    if (f.t === 'sec') return '<div class="am-fsec">' + amE(f.l) + '</div>';
    if (f.t === 'insp') return '<div class="am-full" id="amInspBody">' + amInspBodyHtml(rec) + '</div>';
    if (f.t === 'list') return '<div class="am-full">' + amListFieldHtml(f, rec) + '</div>';
    var full = f.w === 'full' || f.t === 'textarea' || f.t === 'multi' || f.t === 'check';
    var cls = 'am-f' + (full ? ' am-full' : '');
    var help = f.help ? '<div class="am-help">' + amE(f.help) + '</div>' : '';
    var lab = '<label class="am-fl">' + amE(f.l) + (f.req ? ' <b class="am-req">*</b>' : '') + '</label>';
    var v = amInputVal(rec, f.k);
    if (f.t === 'check') {
        return '<div class="' + cls + '"><label class="am-chk"><input type="checkbox" data-k="' + f.k + '"' + (rec[f.k] ? ' checked' : '') + '> <span>' + amE(f.l) + '</span></label>' + help + '</div>';
    }
    if (f.t === 'textarea') return '<div class="' + cls + '">' + lab + '<textarea class="am-in" rows="3" data-k="' + f.k + '"' + (f.ph ? ' placeholder="' + amE(f.ph) + '"' : '') + '>' + amE(v) + '</textarea>' + help + '</div>';
    if (f.t === 'select') {
        var opts = amResolve(f.opts), found = false;
        var h = '<option value="">—</option>' + opts.map(function (o) { var sel = String(o.v) === String(v); if (sel) found = true; return '<option value="' + amE(o.v) + '"' + (sel ? ' selected' : '') + '>' + amE(o.l) + '</option>'; }).join('');
        if (v !== '' && !found) h += '<option value="' + amE(v) + '" selected>' + amE(v) + ' (no disponible)</option>';
        return '<div class="' + cls + '">' + lab + '<select class="am-in" data-k="' + f.k + '">' + h + '</select>' + help + '</div>';
    }
    if (f.t === 'multi') {
        var mo = amResolve(f.opts), cur = (Array.isArray(rec[f.k]) ? rec[f.k] : []).map(String);
        var body = mo.length ? mo.map(function (o) { return '<label class="am-mi"><input type="checkbox" data-multi="' + f.k + '" value="' + amE(o.v) + '"' + (cur.indexOf(String(o.v)) !== -1 ? ' checked' : '') + '> <span>' + amE(o.l) + '</span></label>'; }).join('') : '<div class="am-help">No hay opciones cargadas todavía.</div>';
        return '<div class="' + cls + '">' + lab + '<div class="am-multi">' + body + '</div>' + help + '</div>';
    }
    var type = f.t === 'number' ? 'number' : (f.t === 'date' ? 'date' : 'text');
    var dl = '', listAttr = '';
    if (f.dl && typeof f.dl === 'function') { dl = '<datalist id="amdl_' + f.k + '">' + f.dl().map(function (x) { return '<option value="' + amE(x) + '">'; }).join('') + '</datalist>'; listAttr = ' list="amdl_' + f.k + '"'; }
    return '<div class="' + cls + '">' + lab + '<input class="am-in" type="' + type + '" data-k="' + f.k + '" value="' + amE(v) + '"' + (f.t === 'number' ? ' step="' + (f.step || 'any') + '" min="0" inputmode="decimal"' : '') + (f.ph ? ' placeholder="' + amE(f.ph) + '"' : '') + listAttr + ' autocomplete="off">' + dl + help + '</div>';
}
function amColInput(col, val, attrs) {
    if (col.t === 'check') return '<input type="checkbox" ' + attrs + (val ? ' checked' : '') + '>';
    if (col.t === 'select') {
        var o = amResolve(col.opts), found = false;
        var h = '<option value="">—</option>' + o.map(function (x) { var s = String(x.v) === String(val); if (s) found = true; return '<option value="' + amE(x.v) + '"' + (s ? ' selected' : '') + '>' + amE(x.l) + '</option>'; }).join('');
        if (val && !found) h += '<option value="' + amE(val) + '" selected>' + amE(val) + '</option>';
        return '<select class="am-in am-in-s" ' + attrs + '>' + h + '</select>';
    }
    var listAttr = col.dl ? ' list="amdl_' + col.dl + '"' : '';
    return '<input class="am-in am-in-s" type="' + (col.t === 'date' ? 'date' : 'text') + '" ' + attrs + ' value="' + amE(val === undefined || val === null ? '' : val) + '"' + listAttr + ' autocomplete="off">';
}
function amHabsOptions() { return AM_HABS_TRANSP.concat(AM_HABS_OPER); }
function amListFieldHtml(f, rec) {
    var h = '';
    if (f.fixed) {
        var obj = rec[f.k] && typeof rec[f.k] === 'object' && !Array.isArray(rec[f.k]) ? rec[f.k] : {};
        h += '<div class="am-ltab">';
        f.fixed.forEach(function (row) {
            var vals = obj[row.k] || {};
            h += '<div class="am-lrow"><div class="am-lname">' + amE(row.n) + '</div><div class="am-lcols">' +
                f.cols.map(function (c) {
                    var attrs = 'data-list="' + f.k + '" data-row="' + row.k + '" data-col="' + c.k + '" title="' + amE(c.l) + '"';
                    return '<label class="am-lcol' + (c.t === 'check' ? ' am-lcol-c' : '') + '"><small>' + amE(c.l) + '</small>' + amColInput(c, vals[c.k], attrs) + '</label>';
                }).join('') + '</div></div>';
        });
        return h + '</div>';
    }
    var arr = Array.isArray(rec[f.k]) ? rec[f.k] : [];
    if (f.k === 'habs') h += '<datalist id="amdl_habs">' + amHabsOptions().map(function (x) { return '<option value="' + amE(x) + '">'; }).join('') + '</datalist>';
    h += '<div class="am-ltab">';
    arr.forEach(function (row, i) {
        h += '<div class="am-lrow am-lrow-d"><div class="am-lcols">' +
            f.cols.map(function (c) {
                var attrs = 'data-list="' + f.k + '" data-idx="' + i + '" data-col="' + c.k + '" title="' + amE(c.l) + '"';
                return '<label class="am-lcol' + (c.w === 'wide' ? ' am-lcol-w' : '') + '"><small>' + amE(c.l) + '</small>' + amColInput(c, row[c.k], attrs) + '</label>';
            }).join('') +
            '</div><button type="button" class="am-act am-act-del" title="Quitar" onclick="amListDelRow(\'' + f.k + '\',' + i + ')"><i class="fas fa-times"></i></button></div>';
    });
    if (!arr.length) h += '<div class="am-help">Todavía no cargaste ninguna.</div>';
    h += '</div><div class="am-lbtns"><button type="button" class="am-btn" onclick="amListAddRow(\'' + f.k + '\')"><i class="fas fa-plus"></i> ' + amE(f.add || 'Agregar') + '</button>' +
        (f.presetBtn ? '<button type="button" class="am-btn" onclick="amListPreset(\'' + f.k + '\')"><i class="fas fa-list-check"></i> Cargar las habilitaciones típicas</button>' : '') + '</div>';
    return h;
}

function amFormHtml(def, rec) {
    return def.fields.map(function (f) { return amFieldHtml(f, rec); }).join('');
}
function amReadList(f, m) {
    if (f.fixed) {
        var obj = {};
        f.fixed.forEach(function (row) {
            var o = {};
            f.cols.forEach(function (c) {
                var el = m.querySelector('[data-list="' + f.k + '"][data-row="' + row.k + '"][data-col="' + c.k + '"]');
                if (!el) return;
                o[c.k] = c.t === 'check' ? el.checked : el.value;
            });
            obj[row.k] = o;
        });
        return obj;
    }
    var rows = [];
    m.querySelectorAll('[data-list="' + f.k + '"][data-col="' + f.cols[0].k + '"]').forEach(function (first) {
        var idx = first.getAttribute('data-idx'), o = {};
        f.cols.forEach(function (c) {
            var el = m.querySelector('[data-list="' + f.k + '"][data-idx="' + idx + '"][data-col="' + c.k + '"]');
            if (el) o[c.k] = c.t === 'check' ? el.checked : el.value.trim();
        });
        rows.push(o);
    });
    return rows;
}
function amReadForm() {
    var D = AM.draft, def = AM_TYPES[D.tipo], m = document.getElementById('amModal');
    var rec = JSON.parse(JSON.stringify(D.rec));
    if (!m) return rec;
    def.fields.forEach(function (f) {
        if (f.t === 'sec' || f.t === 'insp') return;
        if (f.t === 'list') { rec[f.k] = amReadList(f, m); return; }
        if (f.t === 'multi') { rec[f.k] = Array.prototype.map.call(m.querySelectorAll('input[data-multi="' + f.k + '"]:checked'), function (x) { return x.value; }); return; }
        var el = m.querySelector('[data-k="' + f.k + '"]');
        if (!el) return;
        if (el.type === 'checkbox') rec[f.k] = el.checked;
        else if (f.t === 'number') { var s = String(el.value).trim().replace(',', '.'); rec[f.k] = s === '' ? '' : parseFloat(s); if (rec[f.k] !== '' && !isFinite(rec[f.k])) rec[f.k] = ''; }
        else rec[f.k] = String(el.value).trim();
    });
    return rec;
}
function amSyncDraft() { if (AM.draft) AM.draft.rec = amReadForm(); }
function amRenderFormBody() {
    var D = AM.draft, def = AM_TYPES[D.tipo], b = document.getElementById('amFormBody');
    if (!b) return;
    var top = b.scrollTop;
    b.innerHTML = amFormHtml(def, D.rec);
    b.scrollTop = top;
    amFormChanged();
}

function amFindSingle(def) {
    var cur = amCur(); if (!cur) return null;
    return def.nivel === 'empresa' ? amOwnerRecs(def.tipo, cur.id)[0] : amOne(def.tipo, cur.id);
}
function amNewRec(tipo, preset) {
    var def = AM_TYPES[tipo], cur = amCur();
    if (!def) return;
    if (!cur) { appAlert('Elegí primero una empresa u obra.'); return; }
    if (def.single) { var ex = amFindSingle(def); if (ex) { amEditRec(ex.id); return; } }
    var rec = Object.assign({}, def.defaults ? def.defaults() : {}, preset || {});
    if (def.coll === 'envRecs') rec.tipo = tipo;
    amOpenForm(def, rec, null);
}
function amEditRec(id) {
    var r = amFindAny(id);
    if (!r) { appAlert('No se encontró el registro.'); return; }
    var def = amDefOf(r);
    if (!def) return;
    var rec = JSON.parse(JSON.stringify(r));
    if (def.tipo === 'cfg') rec.aseguradoras_txt = (rec.aseguradoras || []).join('\n');
    if (def.tipo === 'cfg' && rec.niveles) { rec.niv_bajo = rec.niveles.bajo || ''; rec.niv_medio = rec.niveles.medio || ''; rec.niv_alto = rec.niveles.alto || ''; }
    amOpenForm(def, rec, r.id);
}
function amOpenForm(def, rec, id) {
    var cur = amCur();
    AM.draft = { tipo: def.tipo, id: id, rec: rec, estId: cur.id };
    amCloseModalOnly();
    var nivelTxt = def.nivel === 'empresa'
        ? (esObra(cur) ? 'Se guarda en la empresa y lo ven todas sus obras.' : 'Se guarda en la empresa y lo ven todas sus obras.')
        : 'Se guarda en: ' + (cur.nombre || 'este establecimiento') + '.';
    var bg = document.createElement('div');
    bg.id = 'amModal'; bg.className = 'am-modal-bg no-print';
    bg.innerHTML = '<form class="am-modal" onsubmit="amSaveForm(event);return false;" novalidate>' +
        '<div class="am-m-head"><i class="fas ' + def.icon + '"></i><div><h3>' + (id ? 'Editar' : 'Nuevo') + ' · ' + amE(def.label) + '</h3><small>' + amE(nivelTxt) + '</small></div>' +
        '<button type="button" class="am-x" onclick="amCloseForm()" aria-label="Cerrar"><i class="fas fa-times"></i></button></div>' +
        '<div class="am-m-body"><div class="am-grid" id="amFormBody">' + amFormHtml(def, rec) + '</div><div id="amLive"></div></div>' +
        '<div class="am-m-foot"><button type="button" class="am-btn" onclick="amCloseForm()">Cancelar</button><button type="submit" class="am-btn am-btn-p"><i class="fas fa-check"></i> Guardar</button></div></form>';
    bg.addEventListener('input', amFormEvent);
    bg.addEventListener('change', amFormEvent);
    document.body.appendChild(bg);
    amFormChanged();
    var first = bg.querySelector('.am-in'); if (first && !('ontouchstart' in window)) { try { first.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
}
function amFormEvent(ev) {
    if (ev.target && ev.target.closest && ev.target.closest('#amInspBody')) return;
    amFormChanged();
}
function amCloseModalOnly() { var m = document.getElementById('amModal'); if (m) m.remove(); }
function amCloseForm() { amCloseModalOnly(); AM.draft = null; }

// Controles en vivo mientras se escribe
function amFormChanged() {
    var D = AM.draft; if (!D) return;
    var live = document.getElementById('amLive'); if (!live) return;
    var rec = amReadForm(), html = '';
    if (D.tipo === 'retiro') {
        var cks = amRetiroChecks(rec, D.estId);
        if (!rec.corriente_id) html = '';
        else if (!cks.length) html = '<div class="am-live am-live-ok"><i class="fas fa-check-circle"></i> Los controles de trazabilidad están cumplidos.</div>';
        else html = '<div class="am-live"><b>Controles de trazabilidad</b>' + cks.map(function (c) {
            return '<div class="am-live-i am-live-' + c.sev + '"><i class="fas ' + (c.sev === 'err' ? 'fa-ban' : 'fa-exclamation-triangle') + '"></i> <span>' + amE(c.msg) + '</span> ' + amRuleChip(c.rule) + '</div>';
        }).join('') + '</div>';
        var c0 = amById(rec.corriente_id);
        if (c0 && amEsPeligroso(c0) && amNum(rec.cantidad) > 0 && !amCAFor(D.estId)) { /* aviso ya incluido en los controles */ }
    } else if (D.tipo === 'riesgo') {
        var n = amNivelRiesgo(rec.p, rec.c, D.estId);
        html = '<div class="am-live"><span class="am-lvl" style="background:' + n.c + '">' + amE(n.n) + '</span> Probabilidad ' + amE(rec.p) + ' × Consecuencia ' + amE(rec.c) + ' = <b>' + (amNum(rec.p) * amNum(rec.c)) + '</b></div>';
    } else if (D.tipo === 'insp') {
        var body = document.getElementById('amInspBody');
        if (body) {
            var act = document.activeElement;
            D.rec = rec;
            if (!act || !body.contains(act)) body.innerHTML = amInspBodyHtml(rec);
        }
    }
    live.innerHTML = html;
}

async function amSaveForm(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var D = AM.draft; if (!D) return;
    var def = AM_TYPES[D.tipo], cur = amCur();
    if (!cur) { appAlert('Elegí primero una empresa u obra.'); return; }
    var rec = amReadForm();
    // campos obligatorios
    var miss = [];
    def.fields.forEach(function (f) {
        if (!f.req) return;
        var v = rec[f.k];
        if (v === '' || v === undefined || v === null || (Array.isArray(v) && !v.length)) miss.push(f);
    });
    var m = document.getElementById('amModal');
    if (m) m.querySelectorAll('.am-bad').forEach(function (n) { n.classList.remove('am-bad'); });
    if (miss.length) {
        miss.forEach(function (f) { var el = m && m.querySelector('[data-k="' + f.k + '"]'); if (el) el.classList.add('am-bad'); });
        var first = m && m.querySelector('.am-bad'); if (first && first.scrollIntoView) first.scrollIntoView({ block: 'center' });
        appAlert('Completá: ' + miss.map(function (f) { return f.l; }).join(', ') + '.');
        return;
    }
    // números negativos
    var neg = def.fields.filter(function (f) { return f.t === 'number' && rec[f.k] !== '' && rec[f.k] < 0; });
    if (neg.length) { appAlert('No puede haber valores negativos: ' + neg.map(function (f) { return f.l; }).join(', ') + '.'); return; }
    // dueño del registro
    var prev = D.id ? amFindAny(D.id) : null;
    var estId = prev ? prev.establecimiento_id : (def.nivel === 'empresa' ? amOwnerOf(cur.id) : cur.id);
    rec.establecimiento_id = estId;
    var msg = def.validate ? def.validate(rec) : null;
    if (!msg && def.beforeSave) msg = def.beforeSave(rec);
    if (msg) { appAlert(msg); return; }
    // retiro: controles de trazabilidad
    if (def.guard) {
        var errs = amRetiroChecks(rec, cur.id).filter(function (c) { return c.sev === 'err'; });
        if (errs.length) {
            var ch = await appChoice('No se cumplen estos controles:\n\n• ' + errs.map(function (e) { return e.msg; }).join('\n• ') + '\n\nLo recomendable es corregirlo antes de registrar. Si igual hay que dejarlo cargado, queda una constancia con el motivo.', [
                { label: 'Volver y corregir', value: 'fix', primary: true }, { label: 'Registrar igual, con constancia', value: 'force' }], { title: 'Controles del retiro', type: 'warning' });
            if (ch !== 'force') return;
            var mot = await appPrompt('Motivo por el que se registra igual (queda guardado en el retiro):', rec.override_motivo || '', { multiline: true, title: 'Constancia' });
            if (mot === null || !String(mot).trim()) return;
            rec.override_motivo = String(mot).trim(); rec.override_fecha = amToday();
        } else { delete rec.override_motivo; delete rec.override_fecha; }
    }
    var coll = amColl(def), isNew = !D.id, old = null, now = new Date().toISOString();
    if (isNew) {
        rec.id = def.idPrefix ? def.idPrefix + Date.now() : amUid('am');
        rec.creado = now;
        if (def.coll === 'nonconformities') { rec.amb = true; rec.estado = 'abierta'; rec.created_at = now; rec.origen = rec.origen || 'proceso'; }
        coll.push(rec);
    } else {
        var idx = coll.findIndex(function (x) { return amSame(x.id, D.id); });
        if (idx === -1) { appAlert('El registro ya no existe.'); amCloseForm(); amRender(); return; }
        old = coll[idx];
        rec = Object.assign({}, old, rec, { id: old.id, establecimiento_id: old.establecimiento_id, creado: old.creado, modificado: now });
        if (def.coll === 'envRecs') rec.tipo = old.tipo;
        coll[idx] = rec;
    }
    if (def.tipo === 'cfg') { delete rec.aseguradoras_txt; }
    try { if (def.afterSave) def.afterSave(rec, old, isNew); } catch (e) { console.error('[ambiente] afterSave', e); }
    saveData();
    amCloseForm();
    amRender();
    amToast(isNew ? 'Registro guardado.' : 'Cambios guardados.');
}

// listas del formulario (filas dinámicas)
function amListDefOf(k) { var def = AM_TYPES[AM.draft.tipo]; return def.fields.filter(function (f) { return f.t === 'list' && f.k === k; })[0]; }
function amListAddRow(k) {
    amSyncDraft(); var f = amListDefOf(k); if (!f) return;
    var arr = Array.isArray(AM.draft.rec[k]) ? AM.draft.rec[k] : [];
    arr.push({}); AM.draft.rec[k] = arr; amRenderFormBody();
}
function amListDelRow(k, i) {
    amSyncDraft(); var arr = AM.draft.rec[k]; if (!Array.isArray(arr)) return;
    arr.splice(i, 1); amRenderFormBody();
}
function amListPreset(k) {
    amSyncDraft();
    var rec = AM.draft.rec, arr = Array.isArray(rec[k]) ? rec[k] : [];
    var base = rec.rol === 'operador' ? AM_HABS_OPER : (rec.rol === 'ambos' ? AM_HABS_TRANSP.concat(AM_HABS_OPER) : AM_HABS_TRANSP);
    base.forEach(function (c) { if (!arr.some(function (x) { return x.concepto === c; })) arr.push({ concepto: c, numero: '', vence: '' }); });
    rec[k] = arr; amRenderFormBody();
}

// ---------------------------------------------------------------------------
//  Eliminar
// ---------------------------------------------------------------------------
async function amDeleteRec(id) {
    var r = amFindAny(id); if (!r) return;
    var def = amDefOf(r); if (!def) return;
    var why = def.canDelete ? def.canDelete(r) : null;
    if (why) { appAlert(why); return; }
    if (!await appConfirm('¿Eliminar «' + amTxt(def.title(r), 70) + '»?\n\nSe borra también la hoja firmada adjunta, si la tiene. No se puede deshacer.')) return;
    var coll = amColl(def);
    var i = coll.findIndex(function (x) { return amSame(x.id, id); });
    if (i === -1) return;
    coll.splice(i, 1);
    var key = amSignedKey(def);
    if (key && Array.isArray(appData.signedDocs)) appData.signedDocs = appData.signedDocs.filter(function (d) { return !(d.modulo === key && amSame(d.registro_id, id)); });
    if (def.tipo === 'retiro') amAll().forEach(function (x) { if (x.tipo === 'incidente' && amSame(x.retiro_id, id)) delete x.retiro_id; });
    if (def.tipo === 'incompat' || def.tipo === 'corriente') { /* sin vínculos que limpiar */ }
    saveData();
    amRender();
}

// ---------------------------------------------------------------------------
//  Acciones sobre registros
// ---------------------------------------------------------------------------
function amSheet(id) {
    var r = amFindAny(id); if (!r) return;
    var def = amDefOf(r), fn = def.sheet || 'amPdfFicha';
    if (typeof window[fn] === 'function') window[fn](id);
}
async function amMarkNcCerrada(id) {
    var nc = amFindAny(id); if (!nc) return;
    var eficaz = await appChoice('¿La acción correctiva fue eficaz?', [{ label: 'No fue eficaz', value: false }, { label: 'Sí, fue eficaz', value: true, primary: true }], { title: 'Cerrar no conformidad' });
    if (eficaz === null) return;
    nc.estado = 'cerrada'; nc.fecha_cierre = new Date().toISOString(); nc.eficaz = eficaz;
    saveData(); amRender();
}
function amGoRec(id) { amFocusRecord(id); setTimeout(function () { attnFocus('ambgest', id); }, 60); }

// Crear en Acciones (módulo general) una acción correctiva a partir de un derrame
async function amAddAccion(incId) {
    var r = amById(incId), cur = amCur(); if (!r || !cur) return;
    if (r.accion_id) {
        var ex = (appData.actions || []).filter(function (a) { return amSame(a.id, r.accion_id); })[0];
        if (ex) {
            var go = await appChoice('Este derrame ya tiene una acción correctiva creada («' + amTxt(ex.titulo, 60) + '», ' + (ex.estado === 'cerrado' ? 'cerrada' : 'abierta') + ').', [{ label: 'Cancelar', value: null }, { label: 'Crear otra', value: 'otra' }, { label: 'Ir a Acciones', value: 'ir', primary: true }], { title: 'Acción correctiva' });
            if (go === 'ir') { showModule('actions'); return; }
            if (go !== 'otra') return;
        }
    }
    if (!Array.isArray(appData.actions)) appData.actions = [];
    var a = {
        id: 'act-' + Date.now(), titulo: 'Sanear el derrame del ' + amFmt(r.fecha) + ' · ' + amTxt(r.lugar, 50),
        descripcion: [r.causa ? 'Causa: ' + r.causa : '', r.medidas ? 'Medidas inmediatas: ' + r.medidas : '', r.plan_remed ? 'Plan de remediación: ' + r.plan_remed : ''].filter(Boolean).join('\n'),
        prioridad: 'Alta', sector: r.lugar || '', responsable: r.responsable || '', vencimiento: amAddDays(amToday(), 15), estado: 'pendiente',
        origen: 'incidente', origen_detalle: 'Derrame ambiental', establecimiento_id: cur.id, fecha_creacion: new Date().toISOString(),
        amb: true, amb_ref: r.id
    };
    appData.actions.push(a);
    r.accion_id = a.id;
    saveData(); amRender();
    amToast('Acción creada en el módulo Acciones (vence en 15 días).');
}
// Crear acciones a partir de los ítems que no cumplen en una inspección
async function amAddAccionesInsp(inspId) {
    var d = amById(inspId), cur = amCur(); if (!d || !cur) return;
    var x = amInspItems(d, cur.id), nos = AM_INSP_ITEMS.filter(function (it) { return x.items[it.id].r === 'no'; });
    if (!nos.length) { appAlert('Esta inspección no tiene ítems que no cumplan.'); return; }
    if (!Array.isArray(appData.actions)) appData.actions = [];
    d.acciones_ids = Array.isArray(d.acciones_ids) ? d.acciones_ids : [];
    var nuevos = nos.filter(function (it) {
        return !appData.actions.some(function (a) { return a.amb && amSame(a.amb_ref, d.id) && a.amb_item === it.id; });
    });
    if (!nuevos.length) { appAlert('Ya se crearon las acciones de todos los ítems que no cumplen.'); return; }
    if (!await appConfirm('Se van a crear ' + nuevos.length + (nuevos.length === 1 ? ' acción' : ' acciones') + ' en el módulo Acciones, una por cada ítem que no cumple (' + nuevos.map(function (i) { return i.id; }).join(', ') + ').')) return;
    nuevos.forEach(function (it, n) {
        var a = {
            id: 'act-' + Date.now() + '-' + n, titulo: 'Obrador: ' + it.t, descripcion: 'Inspección del ' + amFmt(d.fecha) + '. ' + (x.items[it.id].obs || ''),
            prioridad: it.crit ? 'Alta' : 'Media', sector: 'Obrador · área de acopio', responsable: d.inspector || '', vencimiento: amAddDays(amToday(), it.crit ? 7 : 15), estado: 'pendiente',
            origen: 'inspeccion', origen_detalle: 'Inspección ambiental del obrador', establecimiento_id: cur.id, fecha_creacion: new Date().toISOString(),
            amb: true, amb_ref: d.id, amb_item: it.id
        };
        appData.actions.push(a); d.acciones_ids.push(a.id);
    });
    saveData(); amRender();
    amToast(nuevos.length + (nuevos.length === 1 ? ' acción creada' : ' acciones creadas') + ' en Acciones.');
}

// Derrame -> retiro del suelo contaminado (Y48)
function amIncidenteGenerarRetiro(inc) {
    var cur = amCur(); if (!cur) return;
    var cant = amNum(inc.suelo_cant);
    if (!(cant > 0)) return;
    var owner = amOwnerOf(inc.establecimiento_id);
    var corr = amCorrs(inc.establecimiento_id).filter(function (c) { return c.codigo === 'Y48'; })[0];
    if (!corr) {
        var b = AM_CORRIENTES_BASE.filter(function (x) { return x.codigo === 'Y48'; })[0];
        corr = { id: amUid('am'), tipo: 'corriente', establecimiento_id: owner, codigo: b.codigo, descripcion: b.desc, cat: b.cat, fisico: b.fisico, h: b.h, unidad: 'kg', creado: new Date().toISOString() };
        amAll().push(corr);
    }
    var ret = amById(inc.retiro_id);
    if (ret && ret.tipo === 'retiro') {
        if (!ret.fecha_retiro) { ret.cantidad = cant; ret.unidad = inc.suelo_un || 'kg'; ret.modificado = new Date().toISOString(); }
        return;
    }
    var ex = amSiteRecs('expediente', inc.establecimiento_id)[0];
    var m = getEmpresaMadre(getEstablecimientoPorId(inc.establecimiento_id) || cur);
    ret = {
        id: amUid('am'), tipo: 'retiro', establecimiento_id: inc.establecimiento_id, creado: new Date().toISOString(),
        fecha_gen: inc.fecha, corriente_id: corr.id, cantidad: cant, unidad: inc.suelo_un || 'kg', area_origen: inc.lugar || '',
        generador: (ex && ex.generador_nombre) || (m ? m.nombre : ''), hs_copias: '3', envase_ok: true, mezclado: false, otras_ids: [],
        acopio_ingreso: inc.fecha, destino: inc.destino_suelo || '', incidente_id: inc.id,
        obs: 'Suelo del derrame del ' + amFmt(inc.fecha) + ' (' + (inc.lugar || '') + '). Generado desde Derrames.'
    };
    amAll().push(ret);
    inc.retiro_id = ret.id;
}

// ---------------------------------------------------------------------------
//  Inspección del obrador: parte propia del formulario
// ---------------------------------------------------------------------------
function amInspBodyHtml(rec) {
    var estId = AM.draft ? AM.draft.estId : (amCur() || {}).id;
    var x = amInspItems(rec, estId), c = x.calc, cfg = amCfg(estId);
    if (!rec.items) rec.items = {};
    var h = '<div class="am-fsec">Cálculos del área de acopio</div><div class="am-calc">';
    h += '<div><small>Contención mínima (más del ' + cfg.pct_contencion + ' % de los líquidos)</small><b>' + (amNum(rec.liquidos_L) > 0 ? amF1(c.contMin) + ' L' : '—') + '</b></div>';
    h += '<div><small>Ocupación máxima (menos del ' + cfg.pct_ocupacion + ' %)</small><b>' + (amNum(rec.superficie_m2) > 0 ? amF1(c.capMax) + ' m²' : '—') + '</b></div>';
    h += '<div><small>Ocupación actual</small><b class="' + (c.ocupPct !== null && c.ocupPct >= cfg.pct_ocupacion ? 'am-t-bad' : '') + '">' + (c.ocupPct !== null ? amF1(c.ocupPct) + ' %' : '—') + '</b></div></div>';
    if (c.cartFalt && c.cartFalt.length) h += '<div class="am-help am-t-bad">Falta cartel de: ' + c.cartFalt.map(function (id) { var cc = amById(id); return amE(cc ? cc.codigo : '?'); }).join(', ') + '</div>';
    h += '<div class="am-fsec">Lista de verificación</div><div class="am-checks">';
    AM_INSP_ITEMS.forEach(function (it) {
        var res = x.items[it.id], man = rec.items[it.id] || {}, auto = res.auto;
        var radios = [['ok', 'Cumple'], ['no', 'No cumple'], ['na', 'No aplica']].map(function (o) {
            return '<label class="am-rad am-rad-' + o[0] + (res.r === o[0] ? ' on' : '') + '"><input type="radio" name="amr_' + it.id + '" value="' + o[0] + '"' + (res.r === o[0] ? ' checked' : '') + (auto ? ' disabled' : '') + ' onclick="amInspPick(\'' + it.id + '\',\'' + o[0] + '\')"> ' + o[1] + '</label>';
        }).join('');
        h += '<div class="am-chk-i' + (res.r === 'no' ? ' am-chk-no' : '') + '"><div class="am-chk-h"><b>' + it.id + '</b> ' + amE(it.t) + (it.crit ? ' <span class="am-crit">crítico</span>' : '') + (auto ? ' <span class="am-auto">automático</span>' : '') + '</div>' +
            '<div class="am-help">' + amE(it.r) + '</div><div class="am-chk-r">' + radios + '</div>' +
            '<div class="am-chk-o"><input class="am-in am-in-s" type="text" placeholder="Observación" value="' + amE(man.obs || '') + '" oninput="amInspObs(\'' + it.id + '\',this.value)">' +
            '<label class="am-photo" title="Foto"><i class="fas fa-camera"></i><input type="file" accept="image/*" onchange="amInspPhoto(this,\'' + it.id + '\')"></label></div>' +
            (man.foto ? '<div class="am-ph"><img src="' + man.foto + '" alt="Foto ' + it.id + '"><button type="button" class="am-act am-act-del" title="Quitar la foto" onclick="amInspPhotoDel(\'' + it.id + '\')"><i class="fas fa-times"></i></button></div>' : '') + '</div>';
    });
    return h + '</div>';
}
function amInspItem(id) { var r = AM.draft.rec; r.items = r.items || {}; r.items[id] = r.items[id] || {}; return r.items[id]; }
function amInspPick(id, v) { amInspItem(id).r = v; var b = document.getElementById('amInspBody'); AM.draft.rec = amReadForm(); b.innerHTML = amInspBodyHtml(AM.draft.rec); }
function amInspObs(id, v) { amInspItem(id).obs = v; }
function amInspPhoto(input, id) {
    var f = input.files && input.files[0]; if (!f) return;
    compressImage(f, 1000, 0.75).then(function (d) {
        amInspItem(id).foto = d;
        var b = document.getElementById('amInspBody'); if (!b) return;
        AM.draft.rec = amReadForm(); b.innerHTML = amInspBodyHtml(AM.draft.rec);
    });
}
function amInspPhotoDel(id) { delete amInspItem(id).foto; var b = document.getElementById('amInspBody'); AM.draft.rec = amReadForm(); b.innerHTML = amInspBodyHtml(AM.draft.rec); }

amDef('insp', {
    label: 'Inspección del obrador', icon: 'fa-clipboard-check', nivel: 'sitio', signed: 'am_insp', sheet: 'amPdfInsp',
    fields: [
        { k: 'fecha', l: 'Fecha', t: 'date', req: 1 },
        { k: 'etapa', l: 'Etapa de obra', t: 'select', req: 1, opts: AM_ETAPAS.map(function (e) { return { v: e.id, l: e.n }; }), help: 'Se repite en cada cambio de etapa.' },
        { k: 'inspector', l: 'Inspector', t: 'text' },
        { t: 'sec', l: 'Medidas del área de acopio (las verificaciones se calculan solas)' },
        { k: 'liquidos_L', l: 'Líquidos acumulados (litros)', t: 'number' },
        { k: 'contencion_L', l: 'Capacidad de la bandeja o sistema de recolección (litros)', t: 'number' },
        { k: 'superficie_m2', l: 'Superficie total del área de acopio (m²)', t: 'number' },
        { k: 'ocupada_m2', l: 'Superficie ocupada (m²)', t: 'number' },
        { k: 'carteles_ids', l: 'Corrientes que tienen cartel en el área', t: 'multi', opts: amOptCorr, w: 'full' },
        { t: 'insp' },
        { k: 'obs', l: 'Observaciones generales', t: 'textarea', w: 'full' }
    ],
    defaults: function () { var e = amCur(), x = e ? amOne('expediente', e.id) : null; return { fecha: amToday(), etapa: x && x.etapa_obra ? x.etapa_obra : 'obrador', items: {}, carteles_ids: [] }; },
    title: function (r) { return 'Inspección del obrador ' + amFmt(r.fecha); },
    extraBtns: function (r) {
        return amActBtn('fa-tasks', 'Crear acciones de los ítems que no cumplen', "amAddAccionesInsp('" + amQ(r.id) + "')", (r.acciones_ids || []).length ? 'on' : '');
    },
    card: function (r) {
        var rs = amInspResumen(r, r.establecimiento_id);
        var chips = [amChip(amEtapaN(r.etapa), 'mut')];
        if (rs.pct !== null) chips.push(amChip('Cumple ' + rs.pct + ' %', rs.pct >= 90 ? 'ok' : (rs.pct >= 70 ? 'warn' : 'bad')));
        if (rs.no) chips.push(amChip(rs.no + (rs.no === 1 ? ' ítem no cumple' : ' ítems no cumplen'), 'bad'));
        if (rs.crit) chips.push(amChip(rs.crit + ' crítico' + (rs.crit === 1 ? '' : 's'), 'bad', 'fa-exclamation-circle'));
        if (rs.pend) chips.push(amChip(rs.pend + ' sin completar', 'mut'));
        var fotos = AM_INSP_ITEMS.filter(function (it) { return r.items && r.items[it.id] && r.items[it.id].foto; }).length;
        if (fotos) chips.push(amChip(fotos + ' foto' + (fotos === 1 ? '' : 's'), 'info', 'fa-camera'));
        if ((r.acciones_ids || []).length) chips.push(amChip((r.acciones_ids || []).length + ' en Acciones', 'info', 'fa-tasks'));
        return { title: 'Inspección del obrador · ' + amFmt(r.fecha), sub: [r.inspector ? 'Inspector: ' + r.inspector : '', rs.calc.ocupPct !== null ? 'Ocupación ' + amF0(rs.calc.ocupPct) + ' %' : ''].filter(Boolean).join(' · '), chips: chips, color: rs.crit ? '#dc2626' : (rs.no ? '#d97706' : '#16a34a') };
    }
});
AM_TIPO_TAB.insp = ['obrador'];
(function () {
    try {
        var d = AM_TYPES.insp, key = amSignedKey(d);
        SIGNED_MODULES[key] = { label: d.label, arr: 'envRecs' }; SIGNED_SHEET_FN[key] = d.sheet;
    } catch (e) { /* noop */ }
})();

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','j5K8uK6xy4yUh4aFwfKHnMrU2siZ7On48eqX2M8=');}catch(e){}})();
