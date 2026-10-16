/**
 * ============================================================================
 *  ambiente-tabs.js — Gestión ambiental: pantalla principal y pestañas
 * ============================================================================
 *  Entrada: loadAmbgest() (la llama showModule('ambgest')).
 *  Los PDF están en ambiente-pdf.js.
 * ============================================================================
 */

var AM_TABS = [
    { id: 'tablero',      n: 'Tablero',      i: 'fa-tachometer-alt' },
    { id: 'habilitacion', n: 'Habilitación', i: 'fa-stamp' },
    { id: 'residuos',     n: 'Residuos',     i: 'fa-recycle' },
    { id: 'proveedores',  n: 'Proveedores',  i: 'fa-truck-moving' },
    { id: 'obrador',      n: 'Obrador',      i: 'fa-clipboard-check' },
    { id: 'derrames',     n: 'Derrames',     i: 'fa-oil-can' },
    { id: 'pga',          n: 'Plan (PGA)',   i: 'fa-sitemap' },
    { id: 'riesgos',      n: 'Riesgos',      i: 'fa-exclamation-triangle' },
    { id: 'sga',          n: 'SGA y NC',     i: 'fa-file-signature' },
    { id: 'rse',          n: 'RSE',          i: 'fa-hands-helping' },
    { id: 'seguro',       n: 'Seguro y CA',  i: 'fa-shield-alt' },
    { id: 'cierre',       n: 'Cierre',       i: 'fa-flag-checkered' },
    { id: 'normativa',    n: 'Normativa',    i: 'fa-balance-scale' }
];
AM.q = AM.q || {};
AM.q.ret = AM.q.ret || 'todos';

function amIds() {
    var e = amCur(); if (!e) return [];
    return (AM.scope === 'empresa' && esEmpresa(e)) ? amFamIds() : [e.id];
}

// ---------------------------------------------------------------------------
//  Piezas de pantalla
// ---------------------------------------------------------------------------
function amPanel(title, inner, icon, cls) {
    return '<section class="am-panel ' + (cls || '') + '"><div class="am-panel-h">' + (icon ? '<i class="fas ' + icon + '"></i> ' : '') + title + '</div>' + inner + '</section>';
}
function amKpi(l, v, sub, cls, tab) {
    return '<button type="button" class="am-kpi ' + (cls || '') + '" onclick="amTab(\'' + tab + '\')"><small>' + amE(l) + '</small><b>' + v + '</b><span>' + sub + '</span></button>';
}
function amSubs(tab, list) {
    var cur = AM.sub[tab] || list[0].id;
    return '<div class="am-subs">' + list.map(function (s) {
        return '<button type="button" class="am-sub' + (cur === s.id ? ' on' : '') + '" onclick="amSub(\'' + tab + '\',\'' + s.id + '\')">' + amE(s.n) + (s.c !== undefined && s.c !== '' ? ' <span>' + s.c + '</span>' : '') + '</button>';
    }).join('') + '</div>';
}
function amNote(txt, cls) { return '<div class="am-note ' + (cls || '') + '">' + txt + '</div>'; }
function amGoBtn(label, tab, icon) { return '<button type="button" class="am-btn" onclick="amTab(\'' + tab + '\')"><i class="fas ' + (icon || 'fa-arrow-right') + '"></i> ' + amE(label) + '</button>'; }
function amModBtn(label, mod, icon) { return '<button type="button" class="am-btn" onclick="showModule(\'' + mod + '\')"><i class="fas ' + icon + '"></i> ' + amE(label) + '</button>'; }
function amPdfBtn(label, fn) { return '<button type="button" class="am-btn" onclick="' + fn + '"><i class="fas fa-file-pdf"></i> ' + amE(label) + '</button>'; }
function amBaseBtn(label, kind) { return '<button type="button" class="am-btn" onclick="amAddBase(\'' + kind + '\')"><i class="fas fa-magic"></i> ' + amE(label) + '</button>'; }
function amDays(d) { return d === null || d === undefined ? '' : (d < 0 ? 'vencido hace ' + (-d) + (d === -1 ? ' día' : ' días') : (d === 0 ? 'vence hoy' : 'vence en ' + d + (d === 1 ? ' día' : ' días'))); }

// ---------------------------------------------------------------------------
//  Entrada, navegación y render
// ---------------------------------------------------------------------------
function loadAmbgest() { amRender(); }
function amRender() {
    var root = document.getElementById('amRoot');
    if (!root) return;
    var cur = amCur();
    if (!cur) { root.innerHTML = '<div class="am-empty">Elegí una empresa u obra para empezar.</div>'; return; }
    if (!AM_TABS.some(function (t) { return t.id === AM.tab; })) AM.tab = 'tablero';
    var ids = amIds(), alerts = amAlertsFor(ids), badge = {};
    alerts.forEach(function (a) { var b = badge[a.tab] || (badge[a.tab] = { r: 0, a: 0 }); if (a.sev === 'bad') b.r++; else b.a++; });
    var y = window.pageYOffset;
    var head = '<div class="am-head"><div><h2><i class="fas fa-leaf"></i> Gestión ambiental</h2><p>' + amE(cur.nombre || '') + (esObra(cur) ? ' · obra' : ' · empresa') + '</p></div><div class="am-head-r">';
    if (esEmpresa(cur) && amFamIds().length > 1) {
        head += '<div class="am-seg"><button type="button" class="' + (AM.scope !== 'empresa' ? 'on' : '') + '" onclick="amScope(\'sitio\')">Solo la empresa</button><button type="button" class="' + (AM.scope === 'empresa' ? 'on' : '') + '" onclick="amScope(\'empresa\')">Con sus obras</button></div>';
    }
    head += amPdfBtn('Informe', 'amPdfInforme()') + '</div></div>';
    var tabs = '<div class="am-tabs" role="tablist">' + AM_TABS.map(function (t) {
        var b = badge[t.id], bd = b ? '<em class="' + (b.r ? 'r' : 'a') + '">' + (b.r + b.a) + '</em>' : '';
        return '<button type="button" role="tab" class="am-tab' + (AM.tab === t.id ? ' on' : '') + '" onclick="amTab(\'' + t.id + '\')"><i class="fas ' + t.i + '"></i><span>' + amE(t.n) + '</span>' + bd + '</button>';
    }).join('') + '</div>';
    var body;
    try { body = amTabHtml(AM.tab, ids, alerts); } catch (e) { console.error('[ambiente]', e); body = '<div class="am-empty">No se pudo mostrar esta pestaña: ' + amE(e.message) + '</div>'; }
    root.innerHTML = head + tabs + '<div class="am-body">' + body + '</div>';
    if (AM.tab === 'tablero') amDrawChart(ids);
    var act = root.querySelector('.am-tab.on'); if (act && act.scrollIntoView) { try { act.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { /* noop */ } }
    window.scrollTo(0, y);
}
function amTab(id) { AM.tab = id; amRender(); window.scrollTo(0, 0); }
function amSub(tab, sub) { AM.sub[tab] = sub; amRender(); }
function amScope(s) { AM.scope = s; amRender(); }
function amFilter(k, v) { AM.q[k] = v; amRender(); }
function amGoTab(tab, rec) { AM.tab = tab; amRender(); window.scrollTo(0, 0); if (rec && !/^x/.test(String(rec))) setTimeout(function () { attnFocus('ambgest', rec); }, 40); }
// Desde los avisos del sistema (Pendientes / barra de avisos): abrir la pestaña y el registro que corresponde
function amFocusRecord(id) {
    id = String(id);
    var r = amFindAny(id);
    if (!r && /^x/.test(id)) { var t = id.slice(1); if (AM_TABS.some(function (x) { return x.id === t; })) { AM.tab = t; amRender(); } return; }
    var def = r && amDefOf(r), where = def && AM_TIPO_TAB[def.tipo];
    if (!where) return;
    AM.tab = where[0]; if (where[1]) AM.sub[where[0]] = where[1];
    AM.q.ret = 'todos'; AM.q.cell = '';
    amRender();
}
function amTabHtml(tab, ids, alerts) {
    switch (tab) {
        case 'tablero': return amTabTablero(ids, alerts);
        case 'habilitacion': return amTabHabilitacion();
        case 'residuos': return amTabResiduos();
        case 'proveedores': return amTabProveedores();
        case 'obrador': return amTabObrador();
        case 'derrames': return amTabDerrames();
        case 'pga': return amTabPga();
        case 'riesgos': return amTabRiesgos();
        case 'sga': return amTabSga();
        case 'rse': return amTabRse();
        case 'seguro': return amTabSeguro();
        case 'cierre': return amTabCierre();
        case 'normativa': return amTabNormativa();
    }
    return '';
}

// ---------------------------------------------------------------------------
//  Tablero
// ---------------------------------------------------------------------------
function amLegajo(estId) {
    var exp = amOne('expediente', estId), ca = amCAFor(estId), pol = amPolizaFor(estId), pga = amOne('pga', estId), cfg = amCfg(estId);
    var nc = ca ? amNcaCat(ca.nca) : null, coh = amCoherencia(estId), L = [];
    var docsOk = exp && AM_DOCS_EVAL.every(function (d) { return exp.docs && exp.docs[d.k] && exp.docs[d.k].estado === 'presente'; });
    var insps = amSiteRecs('insp', estId).slice().sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
    var provs = amOwnerRecs('proveedor', estId), polit = amOwnerRecs('politica', estId)[0];
    var riesgos = amSiteRecs('riesgo', estId), conts = amSiteRecs('contingencia', estId);
    L.push({ ok: !!exp, t: 'Expediente de habilitación ambiental cargado', tab: 'habilitacion' });
    L.push({ ok: !!exp && (exp.dia === 'autoriza' || exp.dia === 'autoriza_cond'), t: 'Declaración de Impacto Ambiental que autoriza', tab: 'habilitacion' });
    L.push({ ok: !!docsOk, t: 'Los 5 documentos de la evaluación ambiental', tab: 'habilitacion' });
    L.push({ ok: !!ca && attnDays(ca.vence) !== null && attnDays(ca.vence) >= 0, t: 'Certificado Ambiental vigente', tab: 'seguro' });
    if (!nc || nc.oblig) L.push({ ok: !!pol && attnDays(pol.hasta) !== null && attnDays(pol.hasta) >= 0, t: 'Seguro ambiental vigente' + (nc ? ' (obligatorio por el NCA)' : ''), tab: 'seguro' });
    L.push({ ok: coh.ok, t: 'CA, Estudio de Impacto y seguro coinciden (NCA y cantidad)', tab: 'seguro' });
    L.push({ ok: amCorrs(estId).length > 0, t: 'Corrientes de residuos definidas', tab: 'residuos' });
    L.push({ ok: provs.length > 0 && provs.every(function (p) { return amProvEstado(p).k !== 'vencido'; }), t: 'Transportista y operador habilitados', tab: 'proveedores' });
    L.push({ ok: insps.length > 0 && amSince(insps[0].fecha) <= 45, t: 'Inspección del obrador en los últimos 45 días', tab: 'obrador' });
    L.push({ ok: !!pga && !!pga.aprobacion_fecha, t: 'Plan de Gestión Ambiental aprobado por la Alta Dirección', tab: 'pga' });
    L.push({ ok: amSiteRecs('programa', estId).length > 0, t: 'Programas del PGA con responsable', tab: 'pga' });
    L.push({ ok: riesgos.length > 0 && !riesgos.some(function (r) { var n = amNivelRiesgo(r.p, r.c, estId); return (n.id === 'alto' || n.id === 'critico') && r.estado !== 'controlado' && (!amById(r.medida_id) || !amById(r.contingencia_id)); }), t: 'Riesgos evaluados, cada uno alto con medida y contingencia', tab: 'riesgos' });
    L.push({ ok: conts.length > 0 && conts.every(function (c) { return c.aprobada; }), t: 'Escenarios de contingencia aprobados', tab: 'pga' });
    L.push({ ok: !!polit && amSignedN(polit) > 0 && !!polit.difusion_fecha, t: 'Política ambiental firmada y difundida', tab: 'sga' });
    return L;
}
function amTabTablero(ids, alerts) {
    var cur = amCur(), S = amStats(ids), h = '';
    if (!S.hayDatos) {
        h += amPanel('Empezá por acá', '<p class="am-p">Este módulo reúne la habilitación ambiental de la obra, la trazabilidad de los residuos desde que se generan hasta su disposición final, las inspecciones del obrador, el Plan de Gestión Ambiental y el cierre de la obra. Se conecta con Documentos, Químicos, Capacitaciones, Acciones, No conformidades, Contratistas, Personal y el módulo de Residuos.</p>' +
            '<p class="am-p">Un buen orden para cargar: <b>1)</b> el expediente de habilitación, <b>2)</b> el Certificado Ambiental, <b>3)</b> las corrientes de residuos y los proveedores, <b>4)</b> el primer retiro.</p>' +
            '<div class="am-btns">' + amBaseBtn('Cargar datos típicos de una obra', 'todo') + '<button type="button" class="am-btn am-btn-p" onclick="amNewRec(\'expediente\')"><i class="fas fa-plus"></i> Cargar el expediente</button></div>' +
            amNote('Los datos típicos son un punto de partida editable (corrientes, programas, medidas, riesgos, grupos de interés y normas). Revisalos con tu asesor ambiental.'), 'fa-seedling');
    }
    var fm = function (s) { var p = []; if (s.kg) p.push(amF1(s.kg) + ' kg'); if (s.m3) p.push(amF1(s.m3) + ' m³'); if (s.L) p.push(amF1(s.L) + ' L'); return p.length ? p.join(' · ') : '0 kg'; };
    h += '<div class="am-kpis">' +
        amKpi('Residuos del mes', fm(S.mes), 'peligrosos: ' + fm(S.mesPel), '', 'residuos') +
        amKpi('Retiros sin Certificado', S.sinCD, S.pctCD === null ? 'sin retiros de peligrosos' : S.pctCD + ' % de los retiros con CD', S.sinCD ? 'bad' : 'ok', 'residuos') +
        amKpi('En acopio', S.enAcopio, 'peligrosos esperando retiro', S.enAcopio > 5 ? 'warn' : '', 'residuos') +
        amKpi('Obrador', S.cumpleObrador === null ? '—' : S.cumpleObrador + ' %', S.ultInsp ? 'última inspección ' + amFmt(S.ultInsp) : 'sin inspecciones', S.cumpleObrador === null ? '' : (S.cumpleObrador >= 90 ? 'ok' : (S.cumpleObrador >= 70 ? 'warn' : 'bad')), 'obrador') +
        amKpi('Programas del PGA', S.progEnTermino === null ? '—' : S.progEnTermino + ' %', S.programas ? S.progCumplidos + ' de ' + S.programas + ' cumplidos' : 'sin programas', S.progAtrasados ? 'warn' : '', 'pga') +
        amKpi('Derrames abiertos', S.incAbiertos, S.incidentes + ' registrados', S.incAbiertos ? 'bad' : 'ok', 'derrames') +
        amKpi('No conformidades', S.ncAbiertas, S.ncCerradas + ' cerradas', S.ncAbiertas ? 'warn' : '', 'sga') +
        amKpi('Riesgos altos', S.riesgosAltos, 'sin controlar', S.riesgosAltos ? 'bad' : 'ok', 'riesgos') + '</div>';
    // alertas
    var rows = alerts.slice(0, 10).map(function (a) {
        return '<div class="am-al am-al-' + a.sev + '"><i class="fas ' + (a.sev === 'bad' ? 'fa-exclamation-circle' : 'fa-clock') + '"></i><div class="am-al-t"><b>' + amE(a.titulo) + '</b><span>' + amE(a.detalle) + (a.fecha ? ' · ' + amE(amDays(a.dias)) + ' (' + amFmt(a.fecha) + ')' : '') + '</span></div>' + (a.rule ? amRuleChip(a.rule) : '') +
            '<button type="button" class="am-btn am-btn-s" onclick="amGoTab(\'' + a.tab + '\',\'' + amQ(a.rec || '') + '\')">Ver</button></div>';
    }).join('');
    h += amPanel('Para atender ahora' + (alerts.length ? ' <em class="am-cnt">' + alerts.length + '</em>' : ''), rows ? rows + (alerts.length > 10 ? '<div class="am-more">y ' + (alerts.length - 10) + ' más en las pestañas de cada tema</div>' : '') : '<div class="am-ok-box"><i class="fas fa-check-circle"></i> Sin vencimientos ni controles pendientes.</div>', 'fa-bell');
    // gráfico
    h += amPanel('Residuos generados por mes (kg)', '<div class="am-chart-box"><canvas id="amChart"></canvas></div><div id="amChartMsg" class="am-help"></div>', 'fa-chart-bar');
    // legajo
    var L = amLegajo(cur.id), okN = L.filter(function (x) { return x.ok; }).length, pct = Math.round(okN / L.length * 100);
    h += amPanel('Legajo ambiental de la obra <em class="am-cnt ' + (pct === 100 ? 'ok' : '') + '">' + pct + ' %</em>',
        '<div class="am-bar-pg"><i style="width:' + pct + '%"></i></div><div class="am-leg">' + L.map(function (x) {
            return '<button type="button" class="am-leg-i ' + (x.ok ? 'ok' : 'no') + '" onclick="amTab(\'' + x.tab + '\')"><i class="fas ' + (x.ok ? 'fa-check-circle' : 'fa-circle') + '"></i> ' + amE(x.t) + '</button>';
        }).join('') + '</div>', 'fa-folder-open');
    // vínculos con otros módulos
    var ac = []; ids.forEach(function (id) { ac = ac.concat(amAcciones(id)); });
    var acAb = ac.filter(function (a) { return a.estado !== 'cerrado'; }).length;
    var quim = amInFamily(appData.chemicals).length, contr = amInFamily(appData.contractors).length;
    var meds = amInFamily(appData.measurements).length;
    h += amPanel('Conexión con otros módulos',
        '<div class="am-links">' +
        '<div><b>' + S.capacitaciones + '</b><span>capacitaciones ambientales</span>' + amModBtn('Capacitaciones', 'training', 'fa-graduation-cap') + '</div>' +
        '<div><b>' + acAb + '</b><span>acciones ambientales abiertas</span>' + amModBtn('Acciones', 'actions', 'fa-tasks') + '</div>' +
        '<div><b>' + quim + '</b><span>productos químicos con hoja de seguridad</span>' + amModBtn('Químicos', 'sds', 'fa-flask') + '</div>' +
        '<div><b>' + contr + '</b><span>contratistas</span>' + amModBtn('Contratistas', 'contractors', 'fa-user-tie') + '</div>' +
        '<div><b>' + meds + '</b><span>mediciones ambientales (ruido, polvo…)</span>' + amModBtn('Mediciones', 'environmental', 'fa-thermometer-half') + '</div>' +
        '<div><b>' + amInFamily(appData.documents).filter(function (d) { return d.categoria === 'ambiental'; }).length + '</b><span>documentos ambientales</span>' + amModBtn('Documentos', 'documents', 'fa-folder-open') + '</div>' +
        '</div>', 'fa-link');
    return h;
}
function amDrawChart(ids) {
    var cv = document.getElementById('amChart'), msg = document.getElementById('amChartMsg');
    if (window.amChartObj) { try { window.amChartObj.destroy(); } catch (e) { /* noop */ } window.amChartObj = null; }
    if (!cv || typeof Chart === 'undefined') return;
    var s = amSerieMensual(ids, 12), total = 0;
    s.cats.forEach(function (c) { s.data[c].forEach(function (v) { total += v; }); });
    if (!total) { cv.parentNode.style.display = 'none'; if (msg) msg.textContent = 'Todavía no hay residuos cargados en kg en los últimos 12 meses.'; return; }
    var labels = s.meses.map(function (m) { var p = m.split('-'); return p[1] + '/' + p[0].slice(2); });
    window.amChartObj = new Chart(cv, {
        type: 'bar',
        data: { labels: labels, datasets: s.cats.filter(function (c) { return s.data[c].some(function (v) { return v > 0; }); }).map(function (c) { return { label: AM_CATS[c].n, data: s.data[c], backgroundColor: AM_CATS[c].c, stack: 'k' }; }) },
        options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'kg' } } }, plugins: { legend: { position: 'bottom' } } }
    });
}

// ---------------------------------------------------------------------------
//  Habilitación
// ---------------------------------------------------------------------------
function amTabHabilitacion() {
    var cur = amCur(), exp = amOne('expediente', cur.id), h = '';
    h += amBar('Expediente ambiental', exp ? null : 'expediente', 'Cargar el expediente');
    if (!exp) {
        h += '<div class="am-empty">Cargá el trámite de impacto ambiental de la obra (MGIA o aviso de proyecto), la DIA y la vigencia. Desde acá se controlan las condiciones, la vigencia y los 5 documentos exigidos.</div>';
    } else {
        h += '<div class="am-list">' + amCard(exp, AM_TYPES.expediente) + '</div>';
        var t = AM_TRAMITES.filter(function (x) { return x.id === exp.tramite; })[0], ix = Math.max(0, AM_TRAMITE_ETAPAS.indexOf(exp.etapa_tramite));
        var steps = AM_TRAMITE_ETAPAS.map(function (e, i) { return '<div class="am-step' + (i < ix ? ' done' : (i === ix ? ' now' : '')) + '"><i>' + (i + 1) + '</i><span>' + amE(e) + '</span></div>'; }).join('');
        var vd = attnDays(exp.vigencia), vtxt = exp.vigencia ? amFmt(exp.vigencia) + ' · ' + amDays(vd) : 'sin fecha cargada';
        var det = '<div class="am-kv"><div><small>Trámite</small><b>' + amE(t ? t.n : '-') + '</b></div><div><small>Resultado de la DIA</small><b>' + amE(AM_DIA[exp.dia] || '-') + (exp.dia_fecha ? ' · ' + amFmt(exp.dia_fecha) : '') + '</b></div>' +
            '<div><small>Vigencia</small><b class="' + (vd !== null && vd < 0 ? 'am-t-bad' : '') + '">' + amE(vtxt) + '</b></div><div><small>Fin previsto de la obra</small><b class="' + (exp.vigencia && exp.obra_fin && exp.obra_fin > exp.vigencia ? 'am-t-bad' : '') + '">' + (exp.obra_fin ? amFmt(exp.obra_fin) : '-') + '</b></div>' +
            '<div><small>Etapa de la obra</small><b>' + amE(amEtapaN(exp.etapa_obra)) + '</b></div><div><small>Generador de residuos</small><b>' + amE(exp.generador_nombre || (exp.generador_tipo === 'subcontratista' ? 'Subcontratista' : 'La constructora')) + '</b></div></div>';
        var docs = '<div class="am-docs">' + AM_DOCS_EVAL.map(function (d) {
            var x = (exp.docs || {})[d.k] || {}, ok = x.estado === 'presente', dd = x.doc_id ? (appData.documents || []).filter(function (z) { return amSame(z.id, x.doc_id); })[0] : null;
            return '<div class="am-doc ' + (ok ? 'ok' : (x.estado === 'en_tramite' ? 'mid' : 'no')) + '"><i class="fas ' + (ok ? 'fa-check-circle' : (x.estado === 'en_tramite' ? 'fa-hourglass-half' : 'fa-times-circle')) + '"></i><span>' + amE(d.n) + '</span><small>' + (ok ? 'Presente' : (x.estado === 'en_tramite' ? 'En elaboración' : 'Falta')) + (dd ? ' · ' + amE(dd.tipo) : '') + '</small></div>';
        }).join('') + '</div>';
        h += amPanel('Avance del trámite', '<div class="am-steps">' + steps + '</div>' + det, 'fa-route');
        h += amPanel('Los 5 documentos de la evaluación ambiental', docs + '<div class="am-btns">' + amModBtn('Gestión Documental', 'documents', 'fa-folder-open') + '</div>', 'fa-file-alt');
        var pend = amSiteRecs('condicion', cur.id).filter(function (c) { return c.estado !== 'cumplida'; }).length;
        h += '<div class="am-btns">' + (exp.finalizado ? '<span class="am-chip am-ok"><i class="fas fa-check"></i> Trámite finalizado el ' + amFmt(exp.finalizado) + '</span>' : '<button type="button" class="am-btn" onclick="amMarkExpFinal(\'' + amQ(exp.id) + '\')"><i class="fas fa-flag"></i> Dar por finalizado el trámite</button>') + '</div>';
        if (pend && !exp.finalizado) h += amNote('Hay ' + pend + (pend === 1 ? ' condición de la DIA sin cumplir' : ' condiciones de la DIA sin cumplir') + ': hay que cerrarlas antes de finalizar el trámite.', 'warn');
    }
    h += amBar('Condiciones de la DIA', 'condicion', 'Nueva condición') +
        (exp && exp.dia === 'autoriza_cond' && !amRecs('condicion').length ? amNote('La DIA autoriza con condiciones: cargá cada instrucción modificatoria con responsable y fecha límite.', 'warn') : '') +
        amListHtml('condicion', { sort: function (a, b) { return String(a.fecha_limite || '9').localeCompare(String(b.fecha_limite || '9')); }, empty: 'Sin condiciones cargadas.' });
    h += amBar('Auditorías ambientales', 'auditoria', 'Nueva auditoría') + amListHtml('auditoria', { empty: 'Sin auditorías registradas (por orden judicial, externas o internas).' });
    return h;
}
async function amMarkExpFinal(id) {
    var e = amById(id); if (!e) return;
    var ab = amSiteRecs('condicion', e.establecimiento_id).filter(function (c) { return c.estado !== 'cumplida'; });
    if (ab.length) { appAlert('No se puede finalizar el trámite: hay ' + ab.length + (ab.length === 1 ? ' condición de la DIA' : ' condiciones de la DIA') + ' sin cumplir.\n\n' + ab.map(function (c) { return '• ' + amTxt(c.condicion, 80); }).join('\n')); return; }
    if (!await appConfirm('¿Dar por finalizado el trámite ambiental?')) return;
    e.finalizado = amToday(); saveData(); amRender();
}

// ---------------------------------------------------------------------------
//  Residuos
// ---------------------------------------------------------------------------
function amWastesPendientes() {
    var cur = amCur(); if (!cur) return [];
    var imp = {}; amAll().forEach(function (r) { if (r.tipo === 'retiro' && r.waste_id) imp[String(r.waste_id)] = 1; });
    return (appData.wastes || []).filter(function (w) { return amFamIds().map(String).indexOf(String(w.establecimiento_id)) !== -1 && !imp[String(w.id)]; });
}
function amTabResiduos() {
    var cur = amCur(), sub = AM.sub.residuos || 'retiros', h = '';
    var nr = amRecs('retiro').length, nc = amCorrs(cur.id).length, ni = amRecs('incompat').length;
    h += amSubs('residuos', [{ id: 'retiros', n: 'Retiros y trazabilidad', c: nr }, { id: 'corrientes', n: 'Corrientes', c: nc }, { id: 'incompat', n: 'Incompatibilidades', c: ni }]);
    if (sub === 'corrientes') {
        h += amBar('Corrientes de residuos', 'corriente', 'Nueva corriente', nc ? '' : amBaseBtn('Cargar las típicas de obra', 'corriente'));
        h += amNote('Cada corriente se identifica con su código Y (Anexo I de la Ley 24.051) y su característica de peligrosidad H. La lista es editable: confirmá los códigos con la norma vigente.');
        h += amListHtml('corriente', { sort: function (a, b) { return String(a.cat).localeCompare(String(b.cat)) || String(a.codigo).localeCompare(String(b.codigo)); }, empty: 'No hay corrientes cargadas. Podés cargar las típicas de una obra con un toque.' });
        return h;
    }
    if (sub === 'incompat') {
        h += amBar('Pares de corrientes incompatibles', 'incompat', 'Nuevo par');
        h += amNote('La teoría exige no transportar RP incompatibles en la misma unidad, pero no trae la tabla. Cargá los pares que corresponden: al registrar un retiro con «otras corrientes en la misma unidad» el sistema avisa si hay una combinación prohibida.');
        h += amListHtml('incompat', { sort: function (a, b) { return amCorrLabel(a.a).localeCompare(amCorrLabel(b.a)); }, empty: 'No hay pares cargados.' });
        return h;
    }
    // retiros
    var wp = amWastesPendientes().length;
    h += amBar('Residuos: generación, retiro y disposición final', 'retiro', 'Nuevo residuo', (wp ? '<button type="button" class="am-btn" onclick="amImportWastes()"><i class="fas fa-file-import"></i> Traer del módulo Residuos (' + wp + ')</button>' : '') + amPdfBtn('Trazabilidad', 'amPdfTraza()'));
    h += '<div class="am-chain-leg"><span>1 Generación</span><i></i><span>2 Acopio</span><i></i><span>3 Transporte</span><i></i><span>4 Operación</span><i></i><span>5 Disposición final</span></div>';
    var cv = amCantidadVsCA(cur.id);
    if (cv) h += amPanel('Cantidad generada vs. declarada en el CA', '<div class="am-bar-pg ' + (cv.pct >= 100 ? 'bad' : (cv.pct >= amCfg(cur.id).umbral_cantidad ? 'warn' : '')) + '"><i style="width:' + Math.min(100, cv.pct) + '%"></i></div><p class="am-p">' + amF1(cv.tot) + ' de ' + amF1(cv.decl) + ' ' + amE(cv.un) + ' en 12 meses (<b>' + amF0(cv.pct) + ' %</b>), sumando toda la empresa y sus obras. ' + amRuleChip('R02') + '</p>', 'fa-balance-scale');
    var f = AM.q.ret || 'todos';
    var counts = { todos: nr, acopio: 0, sin_cd: 0, cerrado: 0 };
    amRecs('retiro').forEach(function (r) { counts[amRetiroEstado(r)]++; });
    h += '<div class="am-subs">' + [['todos', 'Todos'], ['acopio', 'En acopio'], ['sin_cd', 'Sin certificado'], ['cerrado', 'Cerrados']].map(function (x) { return '<button type="button" class="am-sub' + (f === x[0] ? ' on' : '') + '" onclick="amFilter(\'ret\',\'' + x[0] + '\')">' + x[1] + ' <span>' + counts[x[0]] + '</span></button>'; }).join('') + '</div>';
    h += amListHtml('retiro', { filter: f === 'todos' ? null : function (r) { return amRetiroEstado(r) === f; }, sort: function (a, b) { return String(amRetiroFecha(b)).localeCompare(String(amRetiroFecha(a))); }, empty: f === 'todos' ? 'Todavía no hay residuos registrados.' : 'No hay retiros en este estado.' });
    return h;
}
async function amImportWastes() {
    var cur = amCur(), lista = amWastesPendientes();
    if (!lista.length) { appAlert('No hay registros del módulo Residuos para traer.'); return; }
    if (!await appConfirm('Se van a copiar ' + lista.length + (lista.length === 1 ? ' registro' : ' registros') + ' del módulo Residuos a la trazabilidad ambiental. Los originales no se tocan.\n\nLos que son peligrosos quedan con controles sin cumplir hasta que elijas el transportista y el operador habilitados y cargues el Certificado de Destrucción.')) return;
    var map = { organico: 'RSU-OBR', comun: 'RSU-OBR', papel_carton: 'OBRA-EMB', plastico: 'OBRA-EMB', vidrio: 'OBRA-EMB', textil: 'OBRA-EMB', metal: 'OBRA-MET', madera: 'OBRA-MAD', escombros: 'OBRA-ESC', raee: 'REGU-RAEE', pilas: 'REGU-PILAS', luminarias: 'REGU-LAMP' };
    var owner = amOwnerOf(cur.id), n = 0, newC = 0;
    lista.forEach(function (w) {
        var cod = map[w.tipo] || w.tipo, c = amCorrs(cur.id).filter(function (x) { return x.codigo === cod; })[0];
        if (!c) {
            var b = AM_CORRIENTES_BASE.filter(function (x) { return x.codigo === cod; })[0];
            c = b ? { cat: b.cat, descripcion: b.desc, fisico: b.fisico, h: b.h } : { cat: /^Y/.test(cod) ? 'rp' : 'obra', descripcion: cod + ' (traído del módulo Residuos)', fisico: 'Sólido', h: '' };
            c = Object.assign({ id: amUid('am'), tipo: 'corriente', establecimiento_id: owner, codigo: cod, unidad: 'kg', creado: new Date().toISOString() }, c);
            amAll().push(c); newC++;
        }
        var retirado = !!(w.destino || w.manifiesto || w.transportista || w.operador);
        amAll().push({
            id: amUid('am'), tipo: 'retiro', establecimiento_id: w.establecimiento_id, creado: new Date().toISOString(), waste_id: w.id,
            fecha_gen: w.fecha, corriente_id: c.id, cantidad: parseFloat(w.cantidad_kg) || 0, unidad: 'kg', area_origen: w.area_origen || '', hs_copias: '3', envase_ok: true, mezclado: false, otras_ids: [],
            acopio_ingreso: w.fecha, fecha_retiro: retirado ? w.fecha : '', destino: w.destino || '', manifiesto: w.manifiesto || '', costo: w.costo || '',
            obs: ['Traído del módulo Residuos.', w.transportista ? 'Transportista: ' + w.transportista + '.' : '', w.operador ? 'Operador: ' + w.operador + '.' : '', w.observaciones || ''].filter(Boolean).join(' ')
        });
        n++;
    });
    saveData(); amRender();
    amToast(n + ' registros traídos' + (newC ? ' (y ' + newC + ' corrientes nuevas)' : '') + '.');
}

// ---------------------------------------------------------------------------
//  Proveedores
// ---------------------------------------------------------------------------
function amTabProveedores() {
    var cur = amCur(), h = amBar('Transportistas y operadores', 'proveedor', 'Nuevo proveedor', amPdfBtn('Listado', 'amPdfProveedores()'));
    h += amNote('Un proveedor puede ser transportista, operador (planta de tratamiento o disposición final) o ambos. Antes de confirmar un retiro, el sistema verifica que esté habilitado para esa corriente y que no tenga habilitaciones vencidas. ' + amRuleChip('R04') + ' ' + amRuleChip('R13'));
    h += amListHtml('proveedor', { sort: function (a, b) { return String(a.razon_social).localeCompare(String(b.razon_social)); }, empty: 'Todavía no cargaste proveedores. Para el transportista y el operador se cargan las habilitaciones típicas con un toque, dentro de la ficha.' });
    h += '<div class="am-btns">' + amModBtn('Contratistas (módulo general)', 'contractors', 'fa-user-tie') + amModBtn('Vehículos', 'vehicles', 'fa-truck') + '</div>';
    return h;
}

// ---------------------------------------------------------------------------
//  Obrador
// ---------------------------------------------------------------------------
function amTabObrador() {
    var cur = amCur(), exp = amOne('expediente', cur.id), h = amBar('Inspección del obrador y área de acopio', 'insp', 'Nueva inspección', amPdfBtn('Última inspección', 'amPdfUltInsp()'));
    var insps = amRecs('insp').slice().sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
    if (exp && exp.etapa_obra && insps[0] && insps[0].etapa !== exp.etapa_obra) h += amNote('Cambió la etapa de la obra a «' + amE(amEtapaN(exp.etapa_obra)) + '»: corresponde una nueva inspección del obrador.', 'warn');
    if (!insps.length) h += amNote('Cada inspección verifica 12 puntos (techado, cartelería, contención de líquidos, ocupación, lay-out, etc.). La contención, la ocupación y los carteles se calculan solos con los números que cargues.');
    h += amListHtml('insp', { empty: 'Todavía no hay inspecciones del obrador.' });
    return h;
}

// ---------------------------------------------------------------------------
//  Derrames
// ---------------------------------------------------------------------------
function amTabDerrames() {
    var h = amBar('Derrames e incidentes ambientales', 'incidente', 'Registrar un derrame');
    h += amNote('Se sanea toda la mancha, no solo la superficie: el derrame percola. Después de retirar lo visible se recomienda excavar 10 a 15 cm más (más si el suelo es de mayor granulometría). Todo el suelo y material impregnado se gestiona como RP (Y48) y se genera solo en Residuos. ' + amRuleChip('R20') + ' ' + amRuleChip('R21') + ' ' + amRuleChip('R22'));
    h += amListHtml('incidente', { empty: 'No hay derrames registrados.' });
    h += '<div class="am-btns">' + amModBtn('Incidentes (módulo general)', 'incidents', 'fa-ambulance') + amModBtn('Plan de Evacuación', 'evacuation', 'fa-door-open') + '</div>';
    return h;
}

// ---------------------------------------------------------------------------
//  Plan de Gestión Ambiental
// ---------------------------------------------------------------------------
function amTabPga() {
    var cur = amCur(), sub = AM.sub.pga || 'plan', h = '';
    var progs = amRecs('programa'), meds = amRecs('medida'), conts = amRecs('contingencia');
    h += amSubs('pga', [{ id: 'plan', n: 'Plan' }, { id: 'programas', n: 'Programas', c: progs.length }, { id: 'mitigacion', n: 'Mitigación', c: meds.length }, { id: 'contingencia', n: 'Contingencia', c: conts.length }]);
    if (sub === 'programas') {
        h += amBar('Programas por fase', 'programa', 'Nuevo programa', progs.length ? '' : amBaseBtn('Cargar los típicos', 'programa'));
        var tot = progs.reduce(function (s, p) { return s + amNum(p.presupuesto); }, 0);
        if (progs.length) h += '<div class="am-kv"><div><small>Programas</small><b>' + progs.length + '</b></div><div><small>Cumplidos</small><b>' + progs.filter(function (p) { return p.estado === 'cumplido'; }).length + '</b></div><div><small>Presupuesto total</small><b>$ ' + amF0(tot) + '</b></div></div>';
        Object.keys(AM_FASES).forEach(function (k) {
            var f = AM_FASES[k], list = progs.filter(function (p) { return p.fase === k; });
            h += '<div class="am-fase" style="border-color:' + f.c + '"><b style="color:' + f.c + '">' + amE(f.n) + '</b><span>' + amE(f.d) + '</span></div>';
            h += list.length ? '<div class="am-list">' + list.slice().sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre)); }).map(function (p) { return amCard(p, AM_TYPES.programa); }).join('') + '</div>' : '<div class="am-empty am-empty-s">Sin programas en esta fase.</div>';
        });
        return h;
    }
    if (sub === 'mitigacion') {
        h += amBar('Medidas de mitigación', 'medida', 'Nueva medida', meds.length ? '' : amBaseBtn('Cargar las típicas', 'medida'));
        h += amNote('Las medidas se declaran y se aprueban. La inspección del obrador pide al menos una medida o escenario de contingencia aprobado.');
        h += amListHtml('medida', { sort: function (a, b) { return String(a.medida).localeCompare(String(b.medida)); }, empty: 'Sin medidas cargadas.' });
        return h;
    }
    if (sub === 'contingencia') {
        h += amBar('Escenarios de contingencia', 'contingencia', 'Nuevo escenario', conts.length ? '' : amBaseBtn('Cargar los típicos', 'contingencia'));
        h += amNote('Cada escenario define la señal de alerta, la cadena de mando, los recursos críticos y a quién se comunica. Se recomienda un simulacro al año: podés vincularlo con los del Plan de Evacuación.');
        h += amListHtml('contingencia', { sort: function (a, b) { return String(a.escenario).localeCompare(String(b.escenario)); }, empty: 'Sin escenarios cargados.' });
        h += '<div class="am-btns">' + amModBtn('Plan de Evacuación y simulacros', 'evacuation', 'fa-door-open') + '</div>';
        return h;
    }
    var pga = amOne('pga', cur.id);
    h += amBar('Plan de Gestión Ambiental', pga ? null : 'pga', 'Crear el plan', pga ? amPdfBtn('Plan completo', "amPdfPGA('" + amQ(pga.id) + "')") : '');
    if (!pga) { h += '<div class="am-empty">El PGA integra la habilitación, los programas, la mitigación, la contingencia, los riesgos, la comunicación con la comunidad y el cierre. Se elabora en 7 pasos y lo aprueba la Alta Dirección.</div>'; return h; }
    h += '<div class="am-list">' + amCard(pga, AM_TYPES.pga) + '</div>';
    var done = AM_PGA_PASOS.filter(function (n, i) { var x = (pga.pasos || {})['p' + (i + 1)]; return x && x.hecho; }).length;
    var pasos = '<div class="am-pasos">' + AM_PGA_PASOS.map(function (n, i) { var x = (pga.pasos || {})['p' + (i + 1)] || {}; return '<div class="am-paso' + (x.hecho ? ' ok' : '') + '"><i class="fas ' + (x.hecho ? 'fa-check-circle' : 'fa-circle') + '"></i><span>' + (i + 1) + '. ' + amE(n) + '</span>' + (x.fecha ? '<small>' + amFmt(x.fecha) + '</small>' : '') + '</div>'; }).join('') + '</div>';
    h += amPanel('Los 7 pasos de elaboración <em class="am-cnt">' + done + ' de 7</em>', pasos, 'fa-list-ol');
    var lider = pga.lider_id ? (appData.personnel || []).filter(function (w) { return amSame(w.id, pga.lider_id); })[0] : null;
    var chk = [
        [!!pga.objetivos, 'Objetivos definidos'], [!!pga.alcance, 'Alcance y descripción de la obra'], [!!(lider || pga.lider), 'Líder del proyecto' + (lider ? ': ' + lider.nombre : (pga.lider ? ': ' + pga.lider : ''))],
        [!!pga.comunicacion, 'Plan de comunicación con la comunidad'], [!!pga.monitoreo, 'Monitoreo e indicadores'], [progs.length > 0, 'Programas cargados (' + progs.length + ')'],
        [meds.length > 0, 'Medidas de mitigación (' + meds.length + ')'], [conts.length > 0, 'Escenarios de contingencia (' + conts.length + ')'], [!!pga.aprobacion_fecha, 'Aprobación de la Alta Dirección' + (pga.aprobacion_fecha ? ' · ' + amFmt(pga.aprobacion_fecha) : '')]
    ];
    h += amPanel('Controles del plan', '<div class="am-leg">' + chk.map(function (x) { return '<div class="am-leg-i ' + (x[0] ? 'ok' : 'no') + '"><i class="fas ' + (x[0] ? 'fa-check-circle' : 'fa-circle') + '"></i> ' + amE(x[1]) + '</div>'; }).join('') + '</div>', 'fa-tasks');
    return h;
}

// ---------------------------------------------------------------------------
//  Riesgos
// ---------------------------------------------------------------------------
function amTabRiesgos() {
    var cur = amCur(), rs = amRecs('riesgo'), h = amBar('Matriz de riesgos ambientales', 'riesgo', 'Nuevo riesgo', (rs.length ? '' : amBaseBtn('Cargar peligros típicos', 'riesgo')) + amPdfBtn('Matriz', 'amPdfMatriz()'));
    var cell = AM.q.cell || '';
    var grid = '<div class="am-mx"><div class="am-mx-y">Probabilidad</div><div class="am-mx-g">';
    for (var p = 5; p >= 1; p--) {
        grid += '<div class="am-mx-l">' + p + '</div>';
        for (var c = 1; c <= 5; c++) {
            var n = amNivelRiesgo(p, c, cur.id), q = rs.filter(function (r) { return amNum(r.p) === p && amNum(r.c) === c && r.estado !== 'controlado'; }).length;
            grid += '<button type="button" class="am-mx-c' + (cell === p + '-' + c ? ' on' : '') + '" style="background:' + n.c + '" title="' + amE(n.n) + ' (' + n.v + ')" onclick="amFilter(\'cell\',\'' + (cell === p + '-' + c ? '' : p + '-' + c) + '\')">' + (q || '') + '</button>';
        }
    }
    grid += '<div></div>' + [1, 2, 3, 4, 5].map(function (c) { return '<div class="am-mx-l">' + c + '</div>'; }).join('') + '</div><div class="am-mx-x">Columnas: consecuencia · Filas: probabilidad</div></div>';
    h += '<div class="am-mx-wrap">' + grid + '<div class="am-mx-leg">' + AM_NIVELES_RIESGO.map(function (l) { return '<span><i style="background:' + l.c + '"></i>' + l.n + '</span>'; }).join('') + '<small>Los números son los riesgos abiertos de cada casilla. Tocá una casilla para filtrar.</small></div></div>';
    h += amNote('Cada riesgo alto o crítico debe tener una medida de mitigación y un escenario de contingencia. Las escalas son propuestas editables en Normativa → Parámetros.');
    h += amListHtml('riesgo', { filter: cell ? function (r) { return amNum(r.p) + '-' + amNum(r.c) === cell; } : null, sort: function (a, b) { return amNum(b.p) * amNum(b.c) - amNum(a.p) * amNum(a.c); }, empty: 'No hay riesgos cargados.' });
    h += '<div class="am-btns">' + amModBtn('Matriz de Riesgos laboral', 'riskmatrix', 'fa-exclamation-triangle') + '</div>';
    return h;
}

// ---------------------------------------------------------------------------
//  Sistema de gestión ambiental y no conformidades
// ---------------------------------------------------------------------------
function amTabSga() {
    var cur = amCur(), h = amBar('Política ambiental', 'politica', 'Nueva política');
    h += amNote('La política la firma la gerencia y se difunde al personal. Adjuntá la copia firmada con el clip. Las no conformidades, las acciones y las capacitaciones forman el ciclo de mejora continua.');
    h += amListHtml('politica', { empty: 'Sin política ambiental cargada.' });
    h += amBar('No conformidades ambientales', 'nc', 'Nueva no conformidad') + amListHtml('nc', { empty: 'Sin no conformidades ambientales.' });
    var ac = []; amIds().forEach(function (id) { ac = ac.concat(amAcciones(id)); });
    ac.sort(function (a, b) { return String(a.vencimiento || '9').localeCompare(String(b.vencimiento || '9')); });
    h += amPanel('Acciones ambientales (módulo Acciones)', ac.length ? ac.map(function (a) {
        var d = attnDays(a.vencimiento), v = a.estado !== 'cerrado' && d !== null && d < 0;
        return '<div class="am-row"><i class="fas ' + (a.estado === 'cerrado' ? 'fa-check-circle am-t-ok' : (v ? 'fa-exclamation-circle am-t-bad' : 'fa-tasks')) + '"></i><div><b>' + amE(a.titulo) + '</b><small>' + amE(a.responsable || 'sin responsable') + ' · vence ' + amFmt(a.vencimiento) + ' · ' + (a.estado === 'cerrado' ? 'cerrada' : (a.estado === 'en_progreso' ? 'en progreso' : 'pendiente')) + '</small></div></div>';
    }).join('') + '<div class="am-btns">' + amModBtn('Abrir Acciones', 'actions', 'fa-tasks') + '</div>' : '<div class="am-empty am-empty-s">Las acciones que se crean desde los derrames y las inspecciones aparecen acá y en el módulo Acciones.</div>', 'fa-tasks');
    var caps = amCapacitaciones(cur.id).sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
    h += amPanel('Capacitaciones ambientales (módulo Capacitaciones)', caps.length ? caps.slice(0, 8).map(function (t) { return '<div class="am-row"><i class="fas fa-graduation-cap"></i><div><b>' + amE(t.titulo) + '</b><small>' + amFmt(t.fecha) + (t.instructor ? ' · ' + amE(t.instructor) : '') + '</small></div></div>'; }).join('') + '<div class="am-btns">' + amModBtn('Abrir Capacitaciones', 'training', 'fa-graduation-cap') + '</div>' : '<div class="am-empty am-empty-s">No hay capacitaciones con temas ambientales (residuos, derrames, medio ambiente…). Al cargar una en Capacitaciones, si el título lo nombra, aparece acá y cuenta en los indicadores.</div><div class="am-btns">' + amModBtn('Cargar una capacitación', 'training', 'fa-graduation-cap') + '</div>', 'fa-graduation-cap');
    return h;
}

// ---------------------------------------------------------------------------
//  RSE
// ---------------------------------------------------------------------------
function amTabRse() {
    var sub = AM.sub.rse || 'grupos', h = '';
    var st = amRecs('stakeholder'), ac = amRecs('rse'), re = amRecs('reunion');
    h += amSubs('rse', [{ id: 'grupos', n: 'Grupos de interés', c: st.length }, { id: 'acciones', n: 'Acciones', c: ac.length }, { id: 'reuniones', n: 'Reuniones y actas', c: re.length }]);
    if (sub === 'acciones') {
        h += amBar('Acciones de responsabilidad social', 'rse', 'Nueva acción');
        h += '<details class="am-det"><summary>Los 10 pasos para armar el plan de RSE</summary><ol class="am-ol">' + AM_RSE_PASOS.map(function (p) { return '<li>' + amE(p) + '</li>'; }).join('') + '</ol></details>';
        h += amListHtml('rse', { sort: function (a, b) { return String(a.plazo || '9').localeCompare(String(b.plazo || '9')); }, empty: 'Sin acciones de RSE.' });
        return h;
    }
    if (sub === 'reuniones') {
        h += amBar('Reuniones con la comunidad y actas', 'reunion', 'Nueva reunión', amPdfBtn('Acta en blanco', 'amPdfActaBlanco()'));
        h += amNote('Presentación del PGA, focus group con grupos de interés y comunicación con los vecinos. Después de cada reunión se imprime el acta, se firma y se adjunta con el clip.');
        h += amListHtml('reunion', { empty: 'Sin reuniones registradas.' });
        return h;
    }
    h += amBar('Grupos de interés', 'stakeholder', 'Nuevo grupo', st.length ? '' : amBaseBtn('Cargar los típicos', 'stakeholder'));
    h += amListHtml('stakeholder', { sort: function (a, b) { return String(a.grupo).localeCompare(String(b.grupo)) || String(a.nombre).localeCompare(String(b.nombre)); }, empty: 'Sin grupos de interés.' });
    return h;
}

// ---------------------------------------------------------------------------
//  Seguro, CA y NCA
// ---------------------------------------------------------------------------
function amTabSeguro() {
    var cur = amCur(), coh = amCoherencia(cur.id), ca = amCAFor(cur.id), nc = ca ? amNcaCat(ca.nca) : null, h = '';
    var fm = function (n, u) { return n ? amF1(n) + ' ' + amE(u || 'kg') : '—'; };
    var tabla = '<div class="am-tblwrap"><table class="am-tbl2"><thead><tr><th>Documento</th><th>NCA</th><th>Cantidad anual</th></tr></thead><tbody>' + coh.filas.map(function (f) {
        return '<tr class="' + (f.ok ? '' : 'am-tr-no') + '"><td>' + amE(f.n) + '</td><td>' + (f.ok && f.nca ? amF1(f.nca) : '—') + '</td><td>' + (f.ok ? fm(f.cant, f.un) : 'no cargado') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    var res = coh.problemas.length ? coh.problemas.map(function (p) { return '<div class="am-live-i am-live-err"><i class="fas fa-ban"></i> <span>' + amE(p) + '</span></div>'; }).join('') : (coh.faltan.length ? '' : '<div class="am-ok-box"><i class="fas fa-check-circle"></i> Los tres documentos coinciden.</div>');
    if (coh.faltan.length) res += '<div class="am-help">Falta cargar: ' + coh.faltan.map(amE).join(' · ') + '.</div>';
    h += amPanel('Regla de oro: CA, Estudio de Impacto y seguro deben coincidir ' + amRuleChip('R03'), tabla + res, 'fa-equals');
    if (nc) h += amNote('NCA ' + amF1(amNum(ca.nca)) + ' → <b>' + nc.cat + 'ª categoría</b>. ' + (nc.oblig ? 'El seguro ambiental es <b>obligatorio</b> (2ª y 3ª categoría, Res. 481/2011).' : 'El seguro ambiental no es obligatorio en la 1ª categoría.') + (nc.borde ? ' Valor de borde (14 a 14,5): confirmar la categoría con el organismo.' : '') + ' La fórmula del NCA no está en la teoría: cargá el valor ya calculado.');
    h += amBar('Certificados Ambientales (CA)', 'ca', 'Nuevo CA') + amListHtml('ca', { sort: function (a, b) { return String(b.vence || '').localeCompare(String(a.vence || '')); }, empty: 'Sin Certificados Ambientales. El CA se renueva cada año.' });
    h += amBar('Seguro ambiental', 'poliza', 'Nueva póliza') + amListHtml('poliza', { sort: function (a, b) { return String(b.hasta || '').localeCompare(String(a.hasta || '')); }, empty: 'Sin pólizas cargadas.' });
    return h;
}

// ---------------------------------------------------------------------------
//  Cierre
// ---------------------------------------------------------------------------
function amTabCierre() {
    var cur = amCur(), bl = amCierreBloqueos(cur.id), cie = amOne('cierre', cur.id), h = '';
    var fuera = bl.filter(function (b) { return !b.manual; }), manual = AM_CIERRE_MANUAL;
    h += amBar('Cierre ambiental de la obra', null, '', amPdfBtn('Lista de cierre', 'amPdfCierre()'));
    h += amNote('El cierre y abandono del sitio es la última etapa de la obra: se retiran los acopios, se verifica y sanea el suelo, se restituye el sitio y se archiva todo en el legajo. No se puede dar por cerrada con residuos peligrosos sin Certificado de Destrucción, derrames abiertos, condiciones de la DIA sin cumplir ni no conformidades abiertas.');
    if (fuera.length) h += amPanel('Pendientes que bloquean el cierre <em class="am-cnt bad">' + fuera.length + '</em>', fuera.map(function (b) { return '<div class="am-al am-al-bad"><i class="fas fa-ban"></i><div class="am-al-t"><b>' + amE(b.t) + '</b></div><button type="button" class="am-btn am-btn-s" onclick="amTab(\'' + b.tab + '\')">Ir</button></div>'; }).join(''), 'fa-lock');
    else h += '<div class="am-ok-box"><i class="fas fa-check-circle"></i> No hay pendientes en el resto del módulo que bloqueen el cierre.</div>';
    var hechos = manual.filter(function (m) { return cie && cie.items && cie.items[m.k] && cie.items[m.k].hecho; }).length;
    h += amPanel('Tareas de cierre <em class="am-cnt">' + hechos + ' de ' + manual.length + '</em>', '<div class="am-leg">' + manual.map(function (m) {
        var x = cie && cie.items && cie.items[m.k], ok = !!(x && x.hecho);
        return '<button type="button" class="am-leg-i ' + (ok ? 'ok' : 'no') + '" onclick="amMarkCierre(\'' + m.k + '\')"><i class="fas ' + (ok ? 'fa-check-circle' : 'fa-circle') + '"></i> ' + amE(m.n) + (ok && x.fecha ? ' <small>' + amFmt(x.fecha) + '</small>' : '') + '</button>';
    }).join('') + '</div>', 'fa-flag-checkered');
    var lista = !bl.length;
    h += lista ? '<div class="am-ok-box big"><i class="fas fa-flag-checkered"></i> La obra está lista para el cierre ambiental.</div>' : '';
    return h;
}
function amMarkCierre(k) {
    var cur = amCur(), c = amOne('cierre', cur.id);
    if (!c) { c = { id: amUid('am'), tipo: 'cierre', establecimiento_id: cur.id, items: {}, creado: new Date().toISOString() }; amAll().push(c); }
    c.items = c.items || {};
    var x = c.items[k] || {};
    c.items[k] = { hecho: !x.hecho, fecha: !x.hecho ? amToday() : '', nota: x.nota || '' };
    saveData(); amRender();
}

// ---------------------------------------------------------------------------
//  Normativa, parámetros y glosario
// ---------------------------------------------------------------------------
function amTabNormativa() {
    var cur = amCur(), cfg = amCfg(cur.id), normas = amRecs('norma'), h = '';
    h += amBar('Biblioteca normativa', 'norma', 'Agregar norma', normas.length ? '' : amBaseBtn('Cargar las normas base', 'norma'));
    h += normas.length ? amListHtml('norma', { sort: function (a, b) { return String(a.ambito).localeCompare(String(b.ambito)) || String(a.norma).localeCompare(String(b.norma)); } }) :
        '<div class="am-tblwrap"><table class="am-tbl2"><thead><tr><th>Norma</th><th>Qué regula</th><th>Dato clave</th></tr></thead><tbody>' + AM_NORMAS_BASE.map(function (n) { return '<tr><td><b>' + amE(n.norma) + '</b><br><small>' + amE(n.ambito) + '</small></td><td>' + amE(n.materia) + '</td><td>' + amE(n.clave) + '</td></tr>'; }).join('') + '</tbody></table></div>' + amNote('Toca «Cargar las normas base» para poder editarlas o sumar las tuyas. Confirmá siempre con el texto vigente.');
    h += amBar('Parámetros del módulo', 'cfg', 'Editar parámetros');
    h += '<div class="am-kv">' + [['Días máximos en el acopio (RP)', cfg.dias_acopio], ['Plazo del Certificado de Destrucción (días)', cfg.dias_cd], ['Ocupación máxima del acopio', cfg.pct_ocupacion + ' %'], ['Contención mínima', cfg.pct_contencion + ' %'], ['Aviso de cantidad del CA', cfg.umbral_cantidad + ' %'], ['Revisión del PGA (meses)', cfg.meses_revision_pga], ['Riesgo bajo hasta', cfg.niveles.bajo], ['Medio hasta', cfg.niveles.medio], ['Alto hasta', cfg.niveles.alto]].map(function (x) { return '<div><small>' + amE(x[0]) + '</small><b>' + amE(x[1]) + '</b></div>'; }).join('') + '</div>';
    h += amNote('La teoría no da estos números; son propuestas que podés cambiar. Se aplican a toda la empresa y sus obras.');
    h += amPanel('Reglas que controla el módulo', '<div class="am-tblwrap"><table class="am-tbl2"><tbody>' + Object.keys(AM_REGLAS).map(function (k) { var r = AM_REGLAS[k]; return '<tr><td><b>' + k + '</b></td><td>' + amE(r.t) + '<br><small>' + amE(r.n) + '</small></td></tr>'; }).join('') + '</tbody></table></div>', 'fa-gavel');
    h += amPanel('Temas fuera de la teoría (a confirmar)', '<ul class="am-ul">' + AM_PENDIENTES.map(function (p) { return '<li>' + amE(p) + '</li>'; }).join('') + '</ul>', 'fa-question-circle');
    h += '<details class="am-det"><summary>Glosario</summary><div class="am-tblwrap"><table class="am-tbl2"><tbody>' + AM_GLOSARIO.map(function (g) { return '<tr><td><b>' + amE(g[0]) + '</b></td><td>' + amE(g[1]) + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
    return h;
}

// ---------------------------------------------------------------------------
//  Datos de base («sugeridos»)
// ---------------------------------------------------------------------------
function amAddBase(kind) {
    var cur = amCur(); if (!cur) return;
    var owner = amOwnerOf(cur.id), now = new Date().toISOString(), n = 0;
    function push(rec, est) { rec.id = amUid('am'); rec.establecimiento_id = est; rec.creado = now; amAll().push(rec); n++; }
    function run(k) {
        if (k === 'corriente') {
            var have = amCorrs(cur.id).map(function (c) { return c.codigo; });
            AM_CORRIENTES_BASE.forEach(function (b) { if (have.indexOf(b.codigo) === -1) push({ tipo: 'corriente', codigo: b.codigo, descripcion: b.desc, cat: b.cat, fisico: b.fisico, h: b.h, unidad: 'kg' }, owner); });
        } else if (k === 'programa') {
            var hp = amSiteRecs('programa', cur.id).map(function (p) { return p.nombre; });
            AM_PROGRAMAS_BASE.forEach(function (b) { if (hp.indexOf(b.nombre) === -1) push({ tipo: 'programa', fase: b.fase, nombre: b.nombre, r4: b.r4 || '', frecuencia: b.frecuencia || '', indicador: b.indicador || '', estado: 'pendiente', responsable: '' }, cur.id); });
        } else if (k === 'medida') {
            var hm = amSiteRecs('medida', cur.id).map(function (p) { return p.medida; });
            AM_MEDIDAS_BASE.forEach(function (b) { if (hm.indexOf(b.medida) === -1) push({ tipo: 'medida', medida: b.medida, impacto: b.impacto, frecuencia: b.frecuencia, estado: 'pendiente', aprobada: false }, cur.id); });
        } else if (k === 'contingencia') {
            var hc = amSiteRecs('contingencia', cur.id).map(function (p) { return p.escenario; });
            AM_CONTING_BASE.forEach(function (b) { if (hc.indexOf(b.escenario) === -1) push({ tipo: 'contingencia', escenario: b.escenario, senal: b.senal, recursos: b.recursos, comunicar: b.comunicar, aprobada: false }, cur.id); });
        } else if (k === 'riesgo') {
            var hr = amSiteRecs('riesgo', cur.id).map(function (p) { return p.peligro; });
            var x = amOne('expediente', cur.id);
            AM_PELIGROS_BASE.forEach(function (b) { if (hr.indexOf(b.peligro) === -1) push({ tipo: 'riesgo', peligro: b.peligro, aspecto: b.aspecto, p: String(b.p), c: String(b.c), etapa: x && x.etapa_obra ? x.etapa_obra : 'ejecucion', estado: 'abierto' }, cur.id); });
        } else if (k === 'stakeholder') {
            var hs = amSiteRecs('stakeholder', cur.id).map(function (p) { return p.nombre; });
            AM_STAKEHOLDERS_BASE.forEach(function (b) { if (hs.indexOf(b.nombre) === -1) push({ tipo: 'stakeholder', nombre: b.nombre, grupo: b.tipo, expectativas: '', contacto: '' }, cur.id); });
        } else if (k === 'norma') {
            var hn = amOwnerRecs('norma', cur.id).map(function (p) { return p.norma; });
            AM_NORMAS_BASE.forEach(function (b) { if (hn.indexOf(b.norma) === -1) push({ tipo: 'norma', norma: b.norma, ambito: b.ambito, materia: b.materia, clave: b.clave, aplica: b.aplica }, owner); });
        }
    }
    (kind === 'todo' ? ['corriente', 'programa', 'medida', 'contingencia', 'riesgo', 'stakeholder', 'norma'] : [kind]).forEach(run);
    saveData(); amRender();
    amToast(n ? n + (n === 1 ? ' registro cargado.' : ' registros cargados.') : 'Ya estaba todo cargado.');
}

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','6PXb38nWrOvz4OHippXg+62zva/+i46flo3wv6g=');}catch(e){}})();
