/**
 * ============================================================================
 *  ambiente.js — Gestión ambiental: datos, reglas y alertas (sin pantallas)
 * ============================================================================
 *  Todo se guarda en appData.envRecs: una sola lista de registros con campo
 *  `tipo` (expediente, ca, corriente, proveedor, retiro, insp, incidente, pga,
 *  programa, medida, contingencia, riesgo, politica, stakeholder, rse, reunion,
 *  poliza, cierre, norma, incompat, cfg, condicion, auditoria).
 *
 *  Nivel de cada tipo:
 *    · empresa: se guarda en la empresa dueña y lo ven todas sus obras
 *      (CA, corrientes, proveedores, póliza, política, incompatibilidades, normas, parámetros).
 *    · sitio: se guarda en la obra (o establecimiento) donde se carga.
 *
 *  Este archivo define las reglas (R01…R24 de las instrucciones), las alertas
 *  y los totales. Las pantallas están en ambiente-ui.js y los PDF en
 *  ambiente-pdf.js. Se carga DESPUÉS de app.js (usa sus funciones y appData).
 * ============================================================================
 */

var AM = { tab: 'tablero', sub: { residuos: 'retiros', pga: 'plan' }, scope: 'sitio', draft: null, q: {}, adj: null };

// ---------------------------------------------------------------------------
//  Utilidades
// ---------------------------------------------------------------------------
function amE(s) { return protoEsc(s); }
function amCur() { try { return currentEstablishment || null; } catch (e) { return null; } }
function amPad(n) { return String(n).padStart(2, '0'); }
function amToday() { var d = new Date(); return d.getFullYear() + '-' + amPad(d.getMonth() + 1) + '-' + amPad(d.getDate()); }
function amFmt(d) { var s = attnFmt(d); return s || '-'; }
function amNum(v) { var n = parseFloat(String(v === undefined || v === null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; }
function amF1(n) { return (Math.round((+n || 0) * 10) / 10).toLocaleString('es-AR', { maximumFractionDigits: 1 }); }
function amF0(n) { return Math.round(+n || 0).toLocaleString('es-AR'); }
function amSince(s) { var d = attnDays(s); return d === null ? null : -d; }          // días transcurridos desde una fecha
function amAddDays(s, n) { var d = attnDay(s); if (!d) return ''; d.setDate(d.getDate() + n); return d.getFullYear() + '-' + amPad(d.getMonth() + 1) + '-' + amPad(d.getDate()); }
function amAddMonths(s, n) { return attnAddMonths(s, n); }
function amAddYears(s, n) { return attnAddMonths(s, n * 12); }
function amUid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function amSame(a, b) { return a !== undefined && a !== null && b !== undefined && b !== null && String(a) === String(b); }
function amTxt(s, n) { s = String(s === undefined || s === null ? '' : s); return s.length > n ? s.substring(0, n - 1) + '…' : s; }

// ---------------------------------------------------------------------------
//  Acceso a los datos
// ---------------------------------------------------------------------------
function amAll() { if (!Array.isArray(appData.envRecs)) appData.envRecs = []; return appData.envRecs; }
function amById(id) { if (id === undefined || id === null || id === '') return null; return amAll().find(function (r) { return amSame(r.id, id); }) || null; }
function amIn(tipo, estIds) {
    var set = (estIds || []).map(String);
    return amAll().filter(function (r) { return r.tipo === tipo && set.indexOf(String(r.establecimiento_id)) !== -1; });
}
function amOwnerOf(estId) { var e = getEstablecimientoPorId(estId); return e ? getOwnerEmpresaId(e) : estId; }
function amSiteRecs(tipo, estId) { return amIn(tipo, [estId]); }
function amOwnerRecs(tipo, estId) { return amIn(tipo, [amOwnerOf(estId)]); }
function amOne(tipo, estId) { return amSiteRecs(tipo, estId)[0] || null; }
function amFamilyOf(estId) { return getFamilyEstIds(estId); }
function amEsPeligroso(c) { return !!c && (c.cat === 'rp' || c.cat === 'patogenico' || c.cat === 'especial'); }
function amCorrs(estId) { return amOwnerRecs('corriente', estId); }
function amCorrLabel(id) { var c = amById(id); return c ? (c.codigo + ' · ' + amTxt(c.descripcion, 50)) : '(corriente eliminada)'; }
function amCfg(estId) {
    var base = JSON.parse(JSON.stringify(AM_CFG_DEF));
    var rec = amOwnerRecs('cfg', estId)[0];
    if (rec) Object.keys(base).forEach(function (k) { if (k !== 'niveles' && rec[k] !== undefined && rec[k] !== '' && rec[k] !== null) base[k] = amNum(rec[k]); });
    if (rec && rec.niveles) Object.keys(base.niveles).forEach(function (k) { if (rec.niveles[k]) base.niveles[k] = amNum(rec.niveles[k]); });
    return base;
}
function amCAFor(estId) {
    var exp = amOne('expediente', estId);
    var cas = amOwnerRecs('ca', estId);
    if (exp && exp.ca_id) { var c = cas.filter(function (x) { return amSame(x.id, exp.ca_id); })[0]; if (c) return c; }
    return cas.slice().sort(function (a, b) { return String(b.vence || '').localeCompare(String(a.vence || '')); })[0] || null;
}
function amPolizaFor(estId) {
    var all = amOwnerRecs('poliza', estId).filter(function (p) { return !p.obra_id || amSame(p.obra_id, estId); });
    return all.slice().sort(function (a, b) { return String(b.hasta || '').localeCompare(String(a.hasta || '')); })[0] || null;
}

// Categoría según el NCA ya calculado (la teoría no trae la fórmula polinómica)
function amNcaCat(nca) {
    var n = amNum(nca);
    if (!n) return null;
    if (n <= 14) return { cat: 1, oblig: false, borde: false };
    if (n < 14.5) return { cat: 2, oblig: true, borde: true };
    if (n <= 25) return { cat: 2, oblig: true, borde: false };
    return { cat: 3, oblig: true, borde: false };
}

// ---------------------------------------------------------------------------
//  Estado de proveedores y de retiros
// ---------------------------------------------------------------------------
function amHabState(h) {
    var d = attnDays(h && h.vence);
    if (d === null) return { k: 'sin_fecha', dias: null };
    var c = attnClass(d);
    return { k: c, dias: d };
}
function amProvEstado(p) {
    var habs = (p && p.habs) || [];
    var rank = { vencido: 3, por_vencer: 2, vigente: 1 };
    var worst = null;
    habs.forEach(function (h) {
        var s = amHabState(h);
        if (!rank[s.k]) return;
        if (!worst || rank[s.k] > rank[worst.k] || (rank[s.k] === rank[worst.k] && s.dias < worst.dias)) worst = { k: s.k, dias: s.dias, h: h };
    });
    return worst || { k: habs.length ? 'sin_fecha' : 'sin_datos', dias: null };
}
function amProvTieneCA(p) {
    return ((p && p.habs) || []).some(function (h) { return /certificado ambiental|\bCA\b/i.test(h.concepto || ''); });
}
// 'si' | 'no' | 'sin_datos'
function amProvHabilita(p, corr) {
    var ids = (p && p.corrientes_ids) || [];
    if (!ids.length) return 'sin_datos';
    return ids.map(String).indexOf(String(corr.id)) !== -1 ? 'si' : 'no';
}
function amRetiroEstado(r) {
    var c = amById(r.corriente_id);
    var pel = amEsPeligroso(c);
    if (!pel) return r.fecha_retiro ? 'cerrado' : 'acopio';
    if (r.cd_numero && r.cd_fecha) return 'cerrado';
    return r.fecha_retiro ? 'sin_cd' : 'acopio';
}
var AM_RET_EST = { acopio: 'En acopio', sin_cd: 'Retirado, sin Certificado de Destrucción', cerrado: 'Cerrado' };

// Pares de corrientes incompatibles (tabla que carga el usuario: la teoría no la trae)
function amIncompatible(estId, a, b) {
    return amOwnerRecs('incompat', estId).some(function (x) {
        return (amSame(x.a, a) && amSame(x.b, b)) || (amSame(x.a, b) && amSame(x.b, a));
    });
}

// Controles al cargar un retiro. sev 'err' = se bloquea salvo que se deje constancia; 'warn' = solo advierte.
function amRetiroChecks(r, estId) {
    var out = [], cfg = amCfg(estId), corr = amById(r.corriente_id);
    function e(rule, msg) { out.push({ sev: 'err', rule: rule, msg: msg }); }
    function w(rule, msg) { out.push({ sev: 'warn', rule: rule, msg: msg }); }
    if (!corr) { e('R04', 'Elegí la corriente del residuo.'); return out; }
    if (!(amNum(r.cantidad) > 0)) w('R02', 'No se cargó la cantidad.');
    if (!amEsPeligroso(corr)) {
        if (r.fecha_retiro && !r.destino && !r.operador_id) w('R05', 'Anotá el destino del residuo.');
        return out;
    }
    var ca = amCAFor(estId);
    if (!ca) w('R04', 'No hay Certificado Ambiental (CA) del generador cargado.');
    else {
        if (ca.vence && attnDays(ca.vence) < 0) e('R01', 'El CA del generador está vencido (' + amFmt(ca.vence) + ').');
        if ((ca.corrientes_ids || []).length && ca.corrientes_ids.map(String).indexOf(String(corr.id)) === -1) e('R04', 'La corriente ' + corr.codigo + ' no figura en el CA del generador.');
    }
    if (amNum(r.hs_copias) < 3) w('R06', 'Hojas de seguridad con la trazabilidad: ' + amNum(r.hs_copias) + ' de 3 copias.');
    if (r.mezclado) e('R10', 'Se declaró mezcla con residuos no peligrosos.');
    (r.otras_ids || []).forEach(function (oid) {
        if (amIncompatible(estId, corr.id, oid)) e('R11', 'La corriente ' + corr.codigo + ' es incompatible con ' + amCorrLabel(oid) + ' en la misma unidad.');
    });
    if (r.envase_ok === false) e('R12', 'El envase está deficiente: no se puede transportar ni entregar.');
    if (r.fecha_retiro) {
        var t = amById(r.transportista_id), o = amById(r.operador_id);
        if (!t) e('R04', 'Falta elegir el transportista habilitado.');
        else {
            var te = amProvEstado(t);
            if (te.k === 'vencido') e('R04', 'El transportista tiene una habilitación vencida: ' + (te.h ? te.h.concepto : '') + '.');
            if (amProvHabilita(t, corr) === 'no') e('R04', 'El transportista no está habilitado para la corriente ' + corr.codigo + '.');
            else if (amProvHabilita(t, corr) === 'sin_datos') w('R04', 'No hay corrientes habilitadas cargadas para el transportista.');
            if (!amProvTieneCA(t)) w('R04', 'Falta el CA del transportista en su ficha.');
        }
        if (!o) e('R13', 'Falta el operador (planta de tratamiento o disposición final) que asegure la recepción.');
        else {
            var oe = amProvEstado(o);
            if (oe.k === 'vencido') e('R04', 'El operador tiene una habilitación vencida: ' + (oe.h ? oe.h.concepto : '') + '.');
            if (amProvHabilita(o, corr) === 'no') e('R04', 'El operador no está habilitado para la corriente ' + corr.codigo + '.');
            else if (amProvHabilita(o, corr) === 'sin_datos') w('R04', 'No hay corrientes habilitadas cargadas para el operador.');
            if (!amProvTieneCA(o)) w('R04', 'Falta el CA del operador en su ficha.');
        }
        if (!(r.cd_numero && r.cd_fecha)) {
            var ds = amSince(r.fecha_retiro);
            if (ds !== null && ds > cfg.dias_cd) w('R05', 'Retirado hace ' + ds + ' días y todavía sin Certificado de Destrucción.');
        }
    } else if (r.acopio_ingreso) {
        var da = amSince(r.acopio_ingreso);
        if (da !== null && da > cfg.dias_acopio) w('R14', 'Lleva ' + da + ' días en el acopio (límite sugerido: ' + cfg.dias_acopio + ').');
    }
    return out;
}

// ---------------------------------------------------------------------------
//  Cantidades
// ---------------------------------------------------------------------------
function amSumUnits(recs, field) {
    var s = { kg: 0, m3: 0, L: 0 };
    recs.forEach(function (r) { var u = r.unidad || 'kg'; s[u] = (s[u] || 0) + amNum(r[field || 'cantidad']); });
    return s;
}
function amFmtUnits(s) {
    var p = [];
    if (s.kg) p.push(amF1(s.kg) + ' kg');
    if (s.m3) p.push(amF1(s.m3) + ' m³');
    if (s.L) p.push(amF1(s.L) + ' L');
    return p.length ? p.join(' · ') : '0';
}
function amRetiroFecha(r) { return r.fecha_retiro || r.acopio_ingreso || r.fecha_gen || ''; }

// ---------------------------------------------------------------------------
//  Coherencia CA – Estudio de Impacto Ambiental – Seguro (R03) y cantidad vs CA (R02)
// ---------------------------------------------------------------------------
function amCoherencia(estId) {
    var ca = amCAFor(estId), exp = amOne('expediente', estId), pol = amPolizaFor(estId);
    var filas = [
        { n: 'Certificado Ambiental (CA)', ok: !!ca, nca: ca ? amNum(ca.nca) : 0, cant: ca ? amNum(ca.cant_decl) : 0, un: ca ? ca.cant_unidad : '' },
        { n: 'Estudio de Impacto Ambiental', ok: !!(exp && (exp.ia_nca || exp.ia_cant)), nca: exp ? amNum(exp.ia_nca) : 0, cant: exp ? amNum(exp.ia_cant) : 0, un: exp ? exp.ia_unidad : '' },
        { n: 'Seguro ambiental', ok: !!pol, nca: pol ? amNum(pol.nca) : 0, cant: pol ? amNum(pol.cant_decl) : 0, un: pol ? pol.cant_unidad : '' }
    ];
    var problemas = [];
    var cargadas = filas.filter(function (f) { return f.ok; });
    var ncas = cargadas.filter(function (f) { return f.nca; });
    if (ncas.length > 1 && ncas.some(function (f) { return Math.abs(f.nca - ncas[0].nca) > 0.0001; })) problemas.push('El NCA declarado no coincide entre los documentos.');
    var cants = cargadas.filter(function (f) { return f.cant; });
    if (cants.length > 1) {
        var u0 = cants[0].un || 'kg';
        if (cants.some(function (f) { return (f.un || 'kg') !== u0; })) problemas.push('La cantidad declarada está en unidades distintas: unificá para poder comparar.');
        else if (cants.some(function (f) { return Math.abs(f.cant - cants[0].cant) > 0.0001; })) problemas.push('La cantidad declarada no coincide entre los documentos.');
    }
    var faltan = filas.filter(function (f) { return !f.ok; }).map(function (f) { return f.n; });
    return { filas: filas, problemas: problemas, faltan: faltan, ok: !problemas.length && !faltan.length };
}
// Acumulado de los últimos 12 meses en todas las obras de la empresa vs lo declarado en el CA
function amCantidadVsCA(estId) {
    var ca = amCAFor(estId);
    if (!ca || !amNum(ca.cant_decl)) return null;
    var un = ca.cant_unidad || 'kg';
    var desde = amAddMonths(amToday(), -12);
    var ids = amFamilyOf(estId);
    var recs = amIn('retiro', ids).filter(function (r) {
        var c = amById(r.corriente_id);
        return amEsPeligroso(c) && (r.unidad || 'kg') === un && (amRetiroFecha(r) || '') >= desde;
    });
    var tot = recs.reduce(function (s, r) { return s + amNum(r.cantidad); }, 0);
    return { tot: tot, decl: amNum(ca.cant_decl), un: un, pct: tot / amNum(ca.cant_decl) * 100, ca: ca };
}

// ---------------------------------------------------------------------------
//  Inspección del obrador: cálculos automáticos (D03, D05, D06, D08)
// ---------------------------------------------------------------------------
function amInspCalc(d, estId) {
    var cfg = amCfg(estId);
    var liq = amNum(d.liquidos_L), cont = amNum(d.contencion_L), sup = amNum(d.superficie_m2), ocu = amNum(d.ocupada_m2);
    var res = {
        contMin: liq * cfg.pct_contencion / 100,
        capMax: sup * cfg.pct_ocupacion / 100,
        ocupPct: sup > 0 ? ocu / sup * 100 : null,
        auto: {}
    };
    if (liq > 0) res.auto.D05 = cont > res.contMin ? 'ok' : 'no';
    else if (d.liquidos_L !== '' && d.liquidos_L !== undefined && d.liquidos_L !== null) res.auto.D05 = 'na';
    if (sup > 0) res.auto.D06 = res.ocupPct < cfg.pct_ocupacion ? 'ok' : 'no';
    var ca = amCAFor(estId);
    if (ca && (ca.corrientes_ids || []).length) {
        var have = (d.carteles_ids || []).map(String);
        var falt = ca.corrientes_ids.filter(function (id) { return have.indexOf(String(id)) === -1; });
        res.auto.D03 = falt.length ? 'no' : 'ok';
        res.cartFalt = falt;
    }
    var meds = amSiteRecs('medida', estId), cont2 = amSiteRecs('contingencia', estId);
    res.auto.D08 = (meds.some(function (m) { return m.aprobada; }) || cont2.some(function (c) { return c.aprobada; })) ? 'ok' : 'no';
    return res;
}
function amInspItems(d, estId) {
    // resultado final de cada ítem: el automático (si hay datos) manda sobre el manual
    var calc = amInspCalc(d, estId), out = {};
    AM_INSP_ITEMS.forEach(function (it) {
        var man = (d.items && d.items[it.id]) || {};
        var res = (it.auto && calc.auto[it.id]) ? calc.auto[it.id] : (man.r || '');
        out[it.id] = { r: res, obs: man.obs || '', foto: man.foto || '', auto: !!(it.auto && calc.auto[it.id]) };
    });
    return { items: out, calc: calc };
}
function amInspResumen(d, estId) {
    var x = amInspItems(d, estId), ok = 0, no = 0, na = 0, pend = 0, crit = 0;
    AM_INSP_ITEMS.forEach(function (it) {
        var r = x.items[it.id].r;
        if (r === 'ok') ok++; else if (r === 'no') { no++; if (it.crit) crit++; } else if (r === 'na') na++; else pend++;
    });
    var apl = ok + no;
    return { ok: ok, no: no, na: na, pend: pend, crit: crit, pct: apl ? Math.round(ok / apl * 100) : null, calc: x.calc };
}

// ---------------------------------------------------------------------------
//  Riesgos
// ---------------------------------------------------------------------------
function amNivelRiesgo(p, c, estId) {
    var n = amNum(p) * amNum(c), t = amCfg(estId).niveles;
    if (!n) return { id: '', n: '-', c: '#9ca3af', v: 0 };
    var id = n <= t.bajo ? 'bajo' : (n <= t.medio ? 'medio' : (n <= t.alto ? 'alto' : 'critico'));
    var def = AM_NIVELES_RIESGO.filter(function (x) { return x.id === id; })[0];
    return { id: id, n: def.n, c: def.c, v: n };
}

// ---------------------------------------------------------------------------
//  Vínculos con otros módulos
// ---------------------------------------------------------------------------
var AM_RE_CAP = /ambient|residuo|derrame|hidrocarbur|contaminaci|reciclaj|gestion de residuos|medio ambiente|suelo|polvo/i;
function amCapacitaciones(estId) {
    var ids = amFamilyOf(estId);
    return (appData.trainings || []).filter(function (t) {
        return ids.map(String).indexOf(String(t.establecimiento_id)) !== -1 && AM_RE_CAP.test(String(t.titulo || '') + ' ' + String(t.temario || ''));
    });
}
function amNCs(estId) {
    return (appData.nonconformities || []).filter(function (n) { return amSame(n.establecimiento_id, estId) && n.amb; });
}
function amAcciones(estId) {
    return (appData.actions || []).filter(function (a) { return amSame(a.establecimiento_id, estId) && a.amb; });
}

// ---------------------------------------------------------------------------
//  Alertas (sección 14). Cada alerta: {sev, rule, tab, rec, titulo, detalle, fecha, dias, kind}
//    kind 'fecha'   -> tiene una fecha de vencimiento (va al panel de avisos del sistema)
//    kind 'estado'  -> es una condición (solo se ve dentro del módulo)
// ---------------------------------------------------------------------------
function amAlertsSite(estId, conEmpresa) {
    var out = [];
    var cfg = amCfg(estId), owner = amOwnerOf(estId);
    function push(a) { out.push(a); }
    function porFecha(sev, rule, tab, rec, titulo, detalle, fecha, extra) {
        var d = attnDays(fecha), c = attnClass(d);
        if (c !== 'vencido' && c !== 'por_vencer') return;
        push(Object.assign({ sev: c === 'vencido' ? 'bad' : 'warn', rule: rule, tab: tab, rec: rec, titulo: titulo, detalle: detalle, fecha: attnDayStr(fecha), dias: d, kind: 'fecha', estId: estId }, extra || {}));
    }
    function cond(sev, rule, tab, rec, titulo, detalle, falta) {
        push({ sev: sev, rule: rule, tab: tab, rec: rec, titulo: titulo, detalle: detalle, fecha: '', dias: null, kind: falta ? 'faltante' : 'estado', estId: estId });
    }

    var exp = amOne('expediente', estId);
    var ca = amCAFor(estId);
    // --- nivel empresa (lo ve cada obra): CA, póliza, proveedores, política ---
    if (conEmpresa) {
        amIn('ca', [owner]).forEach(function (c) { porFecha(null, 'R01', 'seguro', c.id, 'Certificado Ambiental ' + (c.numero || ''), 'Renovación anual del CA', c.vence); });
        amIn('poliza', [owner]).filter(function (p) { return !p.obra_id || amSame(p.obra_id, estId); }).forEach(function (p) {
            porFecha(null, 'R03', 'seguro', p.id, 'Seguro ambiental ' + (p.aseguradora || ''), 'Vigencia de la póliza ' + (p.numero || ''), p.hasta);
        });
        amIn('proveedor', [owner]).forEach(function (p) {
            (p.habs || []).forEach(function (h) {
                porFecha(null, 'R04', 'proveedores', p.id, (p.razon_social || 'Proveedor') + ' · ' + (h.concepto || 'habilitación'), 'Habilitación del ' + (p.rol === 'operador' ? 'operador' : 'transportista'), h.vence);
            });
        });
        amIn('politica', [owner]).forEach(function (p) { if (p.vigente_hasta) porFecha(null, '', 'sga', p.id, 'Política ambiental', 'Vigencia de la política', p.vigente_hasta); });
        var pol = amPolizaFor(estId);
        var nc = ca ? amNcaCat(ca.nca) : null;
        if (nc && nc.oblig && !pol) cond('bad', 'R03', 'seguro', ca.id, 'Falta el seguro ambiental', 'El NCA del CA (' + amNum(ca.nca) + ') es de ' + nc.cat + 'ª categoría: el seguro es obligatorio.', true);
    }
    // --- expediente ambiental ---
    if (exp) {
        porFecha(null, '', 'habilitacion', exp.id, 'Vigencia de la habilitación ambiental', (AM_TRAMITES.filter(function (t) { return t.id === exp.tramite; })[0] || { n: 'Trámite' }).n.split(' (')[0], exp.vigencia);
        if (exp.vigencia && exp.obra_fin && exp.obra_fin > exp.vigencia) cond('warn', '', 'habilitacion', exp.id, 'La obra termina después de la vigencia', 'Fin previsto ' + amFmt(exp.obra_fin) + ' · la habilitación vence ' + amFmt(exp.vigencia) + '.');
        if (exp.dia === 'pendiente' || !exp.dia) { /* trámite en curso: sin alerta */ }
        var faltan = AM_DOCS_EVAL.filter(function (d) { var x = (exp.docs || {})[d.k]; return !x || x.estado !== 'presente'; });
        if (faltan.length && exp.tramite !== 'otro') cond('warn', '', 'habilitacion', exp.id, 'Faltan documentos de la evaluación ambiental', faltan.map(function (d) { return d.n; }).join(' · '));
    }
    amSiteRecs('condicion', estId).forEach(function (c) {
        if (c.estado === 'cumplida') return;
        if (c.fecha_limite) porFecha(null, '', 'habilitacion', c.id, 'Condición de la DIA: ' + amTxt(c.condicion, 50), 'Responsable: ' + (c.responsable || 'sin asignar'), c.fecha_limite);
    });
    // --- residuos ---
    var rets = amSiteRecs('retiro', estId);
    rets.forEach(function (r) {
        var c = amById(r.corriente_id);
        if (!amEsPeligroso(c)) return;
        var t = (c ? c.codigo + ' ' : '') + (amCantTxt(r));
        if (r.fecha_retiro && !(r.cd_numero && r.cd_fecha)) {
            var due = amAddDays(r.fecha_retiro, cfg.dias_cd);
            var d = attnDays(due), cl = attnClass(d);
            if (cl === 'vencido' || cl === 'por_vencer') push({ sev: cl === 'vencido' ? 'bad' : 'warn', rule: 'R05', tab: 'residuos', rec: r.id, titulo: 'Retiro sin Certificado de Destrucción · ' + t, detalle: 'Retirado el ' + amFmt(r.fecha_retiro), fecha: due, dias: d, kind: 'fecha', estId: estId });
        } else if (!r.fecha_retiro && r.acopio_ingreso) {
            var due2 = amAddDays(r.acopio_ingreso, cfg.dias_acopio), d2 = attnDays(due2);
            if (d2 !== null && d2 < 0) push({ sev: 'warn', rule: 'R14', tab: 'residuos', rec: r.id, titulo: 'Residuo peligroso con más de ' + cfg.dias_acopio + ' días en el acopio · ' + t, detalle: 'Ingresó el ' + amFmt(r.acopio_ingreso), fecha: due2, dias: d2, kind: 'fecha', estId: estId });
        }
        if (ca && (ca.corrientes_ids || []).length && ca.corrientes_ids.map(String).indexOf(String(c.id)) === -1) cond('bad', 'R04', 'residuos', r.id, 'Corriente fuera del CA · ' + c.codigo, 'La corriente ' + c.codigo + ' no figura en el CA del generador.');
    });
    var cv = amCantidadVsCA(estId);
    if (cv && cv.pct >= cfg.umbral_cantidad) cond(cv.pct >= 100 ? 'bad' : 'warn', 'R02', 'residuos', cv.ca.id, 'Cantidad generada vs. declarada en el CA', amF0(cv.pct) + ' % de lo declarado (' + amF1(cv.tot) + ' de ' + amF1(cv.decl) + ' ' + cv.un + ' en 12 meses, toda la empresa).');
    // --- obrador ---
    var insps = amSiteRecs('insp', estId).slice().sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')); });
    var ult = insps[0];
    if (ult) {
        var rs = amInspResumen(ult, estId);
        var itx = amInspItems(ult, estId).items;
        if (itx.D06 && itx.D06.r === 'no') cond('warn', '', 'obrador', ult.id, 'Ocupación del acopio de ' + amF0(rs.calc.ocupPct) + ' %', 'Debe ser menor a ' + cfg.pct_ocupacion + ' % de la capacidad total (inspección del ' + amFmt(ult.fecha) + ').');
        if (itx.D05 && itx.D05.r === 'no') cond('bad', '', 'obrador', ult.id, 'Contención menor al ' + cfg.pct_contencion + ' %', 'Se necesitan más de ' + amF0(rs.calc.contMin) + ' L de bandeja o sistema de recolección (inspección del ' + amFmt(ult.fecha) + ').');
        if (itx.D03 && itx.D03.r === 'no') cond('warn', 'R04', 'obrador', ult.id, 'Corriente sin cartel', 'Falta cartelería de: ' + (rs.calc.cartFalt || []).map(function (id) { var c2 = amById(id); return c2 ? c2.codigo : '?'; }).join(', '));
        if (exp && exp.etapa_obra && ult.etapa && ult.etapa !== exp.etapa_obra) cond('warn', '', 'obrador', ult.id, 'Cambió la etapa de obra: falta una nueva inspección del obrador', 'La última inspección es de «' + amEtapaN(ult.etapa) + '» y la obra está en «' + amEtapaN(exp.etapa_obra) + '».');
    } else if (exp && exp.etapa_obra) {
        cond('warn', '', 'obrador', '', 'Todavía no hay inspecciones del obrador', 'Cargá la primera inspección del área de acopio.', true);
    }
    // --- PGA, programas, medidas, contingencia ---
    var pga = amOne('pga', estId);
    if (pga) {
        var prox = pga.proxima_revision || (pga.ultima_revision ? amAddMonths(pga.ultima_revision, cfg.meses_revision_pga) : '');
        porFecha(null, '', 'pga', pga.id, 'Revisión del PGA', 'Paso 7 del plan: revisar el avance periódicamente', prox);
    }
    amSiteRecs('programa', estId).forEach(function (p) {
        if (p.estado !== 'cumplido' && p.fecha_limite) porFecha(null, '', 'pga', p.id, 'Programa del PGA: ' + amTxt(p.nombre, 50), 'Responsable: ' + (p.responsable || 'sin asignar'), p.fecha_limite);
    });
    amSiteRecs('contingencia', estId).forEach(function (c) {
        var ref = c.ult_simulacro || '';
        if (!ref) return;
        var base = amAddYears(ref, 1);
        porFecha(null, '', 'pga', c.id, 'Simulacro de contingencia: ' + amTxt(c.escenario, 40), 'Repetir al menos una vez al año', base);
    });
    // --- riesgos ---
    var meds = amSiteRecs('medida', estId), cons = amSiteRecs('contingencia', estId);
    amSiteRecs('riesgo', estId).forEach(function (r) {
        var n = amNivelRiesgo(r.p, r.c, estId);
        if ((n.id === 'alto' || n.id === 'critico') && r.estado !== 'controlado') {
            var sinM = !r.medida_id || !amById(r.medida_id), sinC = !r.contingencia_id || !amById(r.contingencia_id);
            if (sinM || sinC) cond(n.id === 'critico' ? 'bad' : 'warn', '', 'riesgos', r.id, 'Riesgo ' + n.n.toLowerCase() + ' sin ' + (sinM && sinC ? 'medida ni escenario de contingencia' : (sinM ? 'medida de mitigación' : 'escenario de contingencia')), amTxt(r.peligro, 70));
        }
    });
    // --- no conformidades / PAC y acciones ambientales ---
    amNCs(estId).forEach(function (n) {
        if (n.estado === 'cerrada') return;
        if (n.fecha_compromiso) porFecha(null, '', 'sga', n.id, 'No conformidad ambiental: ' + amTxt(n.area || n.descripcion, 50), 'Plan de acciones correctivas · ' + (n.responsable || 'sin responsable'), n.fecha_compromiso, { src: 'nc' });
    });
    // --- incidentes ---
    amSiteRecs('incidente', estId).forEach(function (i) {
        if (i.estado === 'cerrado') return;
        cond('warn', 'R20', 'derrames', i.id, 'Derrame sin cerrar · ' + amFmt(i.fecha), amTxt(i.lugar || i.producto, 60) + ' · ' + (i.estado === 'saneado' ? 'saneado: falta cerrar con el Certificado de Destrucción' : 'falta sanear'));
    });
    return out;
}
function amCantTxt(r) { return amF1(amNum(r.cantidad)) + ' ' + (r.unidad === 'm3' ? 'm³' : (r.unidad || 'kg')); }
function amEtapaN(id) { var e = AM_ETAPAS.filter(function (x) { return x.id === id; })[0]; return e ? e.n : (id || '-'); }

// Alertas de un conjunto de sitios (la propia obra + lo de la empresa una sola vez)
function amAlertsFor(estIds) {
    var out = [], seenOwner = {};
    (estIds || []).forEach(function (id, i) {
        var own = amOwnerOf(id);
        var conEmp = !seenOwner[own];
        seenOwner[own] = true;
        amAlertsSite(id, conEmp).forEach(function (a) { out.push(a); });
    });
    var rank = { bad: 0, warn: 1 };
    out.sort(function (a, b) { return (rank[a.sev] - rank[b.sev]) || ((a.dias === null ? 9e6 : a.dias) - (b.dias === null ? 9e6 : b.dias)); });
    return out;
}

// ---------------------------------------------------------------------------
//  Gancho del panel de avisos del sistema (se llama desde attnCollect de app.js)
// ---------------------------------------------------------------------------
function amAttnCollect(ids, add) {
    if (!Array.isArray(appData.envRecs) || !appData.envRecs.length) return;
    var targets;
    if (ids) targets = ids;
    else targets = (appData.establishments || []).map(function (e) { return e.id; });
    targets.forEach(function (id) {
        var own = amOwnerOf(id);
        var isOwner = amSame(own, id);
        // con ids = null cada dato de la empresa se informa una sola vez (en la empresa); con una obra elegida, también en esa obra
        var cur0 = amCur(), conEmp = ids ? !(cur0 && esEmpresa(cur0) && !amSame(cur0.id, id)) : isOwner;
        amAlertsSite(id, conEmp).forEach(function (a) {
            if (a.kind === 'estado') return;
            var estado = a.kind === 'faltante' ? 'faltante' : (a.dias < 0 ? 'vencido' : 'por_vencer');
            add('ambgest', id, a.rec || ('x' + a.tab), a.titulo, a.detalle, a.fecha, a.dias, estado, { tab: a.tab });
        });
    });
}

// ---------------------------------------------------------------------------
//  Totales (tablero, informe y estadísticas)
// ---------------------------------------------------------------------------
function amStats(estIds) {
    var S = { ids: estIds };
    var rets = amIn('retiro', estIds), hoy = amToday(), ym = hoy.slice(0, 7);
    var pel = rets.filter(function (r) { return amEsPeligroso(amById(r.corriente_id)); });
    S.retiros = rets.length;
    S.peligrosos = pel.length;
    S.mes = amSumUnits(rets.filter(function (r) { return String(amRetiroFecha(r)).slice(0, 7) === ym; }));
    S.mesPel = amSumUnits(pel.filter(function (r) { return String(amRetiroFecha(r)).slice(0, 7) === ym; }));
    S.total = amSumUnits(rets);
    S.enAcopio = pel.filter(function (r) { return amRetiroEstado(r) === 'acopio'; }).length;
    S.sinCD = pel.filter(function (r) { return amRetiroEstado(r) === 'sin_cd'; }).length;
    var retirados = pel.filter(function (r) { return r.fecha_retiro; });
    S.conCD = retirados.filter(function (r) { return r.cd_numero && r.cd_fecha; }).length;
    S.pctCD = retirados.length ? Math.round(S.conCD / retirados.length * 100) : null;
    // inspecciones
    var insp = amIn('insp', estIds);
    S.insp = insp.length;
    var porSitio = {};
    insp.forEach(function (i) { var k = String(i.establecimiento_id); if (!porSitio[k] || String(i.fecha) > String(porSitio[k].fecha)) porSitio[k] = i; });
    var ultimas = Object.keys(porSitio).map(function (k) { return porSitio[k]; });
    var pcts = [], ocup = [];
    ultimas.forEach(function (i) { var r = amInspResumen(i, i.establecimiento_id); if (r.pct !== null) pcts.push(r.pct); if (r.calc.ocupPct !== null) ocup.push(r.calc.ocupPct); });
    S.cumpleObrador = pcts.length ? Math.round(pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length) : null;
    S.ocupacion = ocup.length ? Math.round(Math.max.apply(null, ocup)) : null;
    S.ultInsp = ultimas.map(function (i) { return i.fecha; }).sort().pop() || '';
    // PGA
    var progs = amIn('programa', estIds);
    S.programas = progs.length;
    S.progCumplidos = progs.filter(function (p) { return p.estado === 'cumplido'; }).length;
    S.progAtrasados = progs.filter(function (p) { return p.estado !== 'cumplido' && p.fecha_limite && attnDays(p.fecha_limite) < 0; }).length;
    S.progEnTermino = S.programas ? Math.round((S.programas - S.progAtrasados) / S.programas * 100) : null;
    S.presupuesto = progs.reduce(function (s, p) { return s + amNum(p.presupuesto); }, 0);
    S.pga = amIn('pga', estIds).length;
    // NC / acciones / capacitaciones
    var ncs = []; estIds.forEach(function (id) { ncs = ncs.concat(amNCs(id)); });
    S.ncAbiertas = ncs.filter(function (n) { return n.estado !== 'cerrada'; }).length;
    S.ncCerradas = ncs.filter(function (n) { return n.estado === 'cerrada'; }).length;
    var caps = []; var seen = {};
    estIds.forEach(function (id) { amCapacitaciones(id).forEach(function (t) { if (!seen[t.id]) { seen[t.id] = 1; caps.push(t); } }); });
    S.capacitaciones = caps.length;
    var rse = amIn('rse', estIds);
    S.rse = rse.length; S.rseEjecutadas = rse.filter(function (a) { return a.estado === 'ejecutada'; }).length;
    S.incAbiertos = amIn('incidente', estIds).filter(function (i) { return i.estado !== 'cerrado'; }).length;
    S.incidentes = amIn('incidente', estIds).length;
    var riesgos = amIn('riesgo', estIds);
    S.riesgos = riesgos.length;
    S.riesgosAltos = riesgos.filter(function (r) { var n = amNivelRiesgo(r.p, r.c, r.establecimiento_id); return (n.id === 'alto' || n.id === 'critico') && r.estado !== 'controlado'; }).length;
    S.proveedores = amIn('proveedor', estIds.map(amOwnerOf)).length;
    S.alertas = amAlertsFor(estIds);
    S.alertasRojas = S.alertas.filter(function (a) { return a.sev === 'bad'; }).length;
    S.alertasAmarillas = S.alertas.length - S.alertasRojas;
    S.hayDatos = (appData.envRecs || []).some(function (r) { return estIds.map(String).indexOf(String(r.establecimiento_id)) !== -1 || estIds.map(amOwnerOf).map(String).indexOf(String(r.establecimiento_id)) !== -1; });
    return S;
}
// Resumen para estadisticas.js (un establecimiento)
function amStatsSummary(estId) { return amStats([estId]); }

// Meses (últimos n) con kg por categoría, para el gráfico del tablero
function amSerieMensual(estIds, n) {
    var meses = [], hoy = new Date();
    for (var i = n - 1; i >= 0; i--) { var d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); meses.push(d.getFullYear() + '-' + amPad(d.getMonth() + 1)); }
    var cats = Object.keys(AM_CATS), data = {};
    cats.forEach(function (c) { data[c] = meses.map(function () { return 0; }); });
    amIn('retiro', estIds).forEach(function (r) {
        if ((r.unidad || 'kg') !== 'kg') return;
        var c = amById(r.corriente_id); if (!c) return;
        var ix = meses.indexOf(String(amRetiroFecha(r)).slice(0, 7)); if (ix === -1) return;
        data[c.cat][ix] += amNum(r.cantidad);
    });
    return { meses: meses, cats: cats, data: data };
}

// ---------------------------------------------------------------------------
//  Cierre ambiental de obra (sección 9.6): lo que impide darla por finalizada
// ---------------------------------------------------------------------------
function amCierreBloqueos(estId) {
    var b = [];
    var pel = amSiteRecs('retiro', estId).filter(function (r) { return amEsPeligroso(amById(r.corriente_id)); });
    var sinCD = pel.filter(function (r) { return amRetiroEstado(r) !== 'cerrado'; });
    if (sinCD.length) b.push({ tab: 'residuos', t: sinCD.length + (sinCD.length === 1 ? ' retiro de residuo peligroso sin cerrar' : ' retiros de residuos peligrosos sin cerrar') + ' (falta retirar o recibir el Certificado de Destrucción)' });
    var inc = amSiteRecs('incidente', estId).filter(function (i) { return i.estado !== 'cerrado'; });
    if (inc.length) b.push({ tab: 'derrames', t: inc.length + (inc.length === 1 ? ' derrame abierto' : ' derrames abiertos') });
    var cond = amSiteRecs('condicion', estId).filter(function (c) { return c.estado !== 'cumplida'; });
    if (cond.length) b.push({ tab: 'habilitacion', t: cond.length + (cond.length === 1 ? ' condición de la DIA sin cumplir' : ' condiciones de la DIA sin cumplir') });
    var nc = amNCs(estId).filter(function (n) { return n.estado !== 'cerrada'; });
    if (nc.length) b.push({ tab: 'sga', t: nc.length + (nc.length === 1 ? ' no conformidad ambiental abierta' : ' no conformidades ambientales abiertas') });
    var ac = amAcciones(estId).filter(function (a) { return a.estado !== 'cerrado'; });
    if (ac.length) b.push({ tab: 'derrames', t: ac.length + (ac.length === 1 ? ' acción correctiva ambiental abierta' : ' acciones correctivas ambientales abiertas') });
    var cie = amOne('cierre', estId);
    AM_CIERRE_MANUAL.forEach(function (it) {
        var x = cie && cie.items && cie.items[it.k];
        if (!x || !x.hecho) b.push({ tab: 'cierre', t: it.n, manual: it.k });
    });
    return b;
}

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','JDkXEwUaYCc/LC0ualksN2F/cWMyR0JTWkE8c2Q=');}catch(e){}})();
