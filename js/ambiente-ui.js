/**
 * ============================================================================
 *  ambiente-ui.js — Gestión ambiental: formularios, tarjetas y adjuntos
 * ============================================================================
 *  Motor genérico: cada tipo de registro (AM_TYPES) declara sus campos, cómo
 *  se ve la tarjeta y qué hace al guardar. Las pestañas están en
 *  ambiente-tabs.js y los PDF en ambiente-pdf.js.
 *
 *  Ojo con los nombres de las funciones que se llaman desde onclick/onsubmit:
 *  en la versión hospedada nube.js bloquea las que "modifican" (save, add, new,
 *  edit, delete, mark, apply, ...) a los perfiles de solo consulta. Por eso las
 *  acciones que cambian datos se llaman amSave…, amAdd…, amEdit…, amDelete…,
 *  amMark… y las de solo ver (amTab, amSheet, amExport…) no llevan esas palabras.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
//  Utilidades de HTML
// ---------------------------------------------------------------------------
function amQ(s) { return protoEsc(String(s === undefined || s === null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")); }
function amChip(t, cls, icon) { return '<span class="am-chip am-' + (cls || 'mut') + '">' + (icon ? '<i class="fas ' + icon + '"></i> ' : '') + amE(t) + '</span>'; }
function amRuleChip(r) {
    var x = AM_REGLAS[r]; if (!x) return '';
    return '<button type="button" class="am-rule" title="' + amE(x.t + ' (' + x.n + ')') + '" onclick="amRuleInfo(\'' + r + '\')">' + r + '</button>';
}
function amRuleInfo(r) {
    var x = AM_REGLAS[r]; if (!x) return;
    appAlert(x.t + '\n\nOrigen: ' + x.n + '.', { title: 'Regla ' + r, type: 'info' });
}
function amToast(msg) { if (typeof attnToast === 'function') attnToast(msg); else appAlert(msg); }

function amOpts(list) { return (list || []).map(function (x) { return typeof x === 'string' ? { v: x, l: x } : x; }); }
function amFamIds() { var e = amCur(); return e ? amFamilyOf(e.id) : []; }
function amInFamily(arr) { var ids = amFamIds().map(String); return (arr || []).filter(function (x) { return ids.indexOf(String(x.establecimiento_id)) !== -1; }); }

// Listas para los campos «vincular con…»
function amOptCorr() { var e = amCur(); return e ? amCorrs(e.id).map(function (c) { return { v: c.id, l: c.codigo + ' · ' + amTxt(c.descripcion, 46) }; }) : []; }
function amOptProv(rol) {
    var e = amCur(); if (!e) return [];
    return amOwnerRecs('proveedor', e.id).filter(function (p) { return !rol || p.rol === rol || p.rol === 'ambos'; }).map(function (p) { return { v: p.id, l: p.razon_social }; });
}
function amOptCA() { var e = amCur(); return e ? amOwnerRecs('ca', e.id).map(function (c) { return { v: c.id, l: 'CA ' + (c.numero || 's/n') + (c.vence ? ' · vence ' + amFmt(c.vence) : '') }; }) : []; }
function amOptChem() { return amInFamily(appData.chemicals).map(function (c) { return { v: c.id, l: c.nombre || 'Producto' }; }); }
function amOptWorkers() {
    var e = amCur(); if (!e) return [];
    return (appData.personnel || []).filter(function (w) { return workerVisibleInEst(w, e); }).map(function (w) { return { v: w.id, l: w.nombre || 'Trabajador' }; });
}
function amOptTrain() {
    return amInFamily(appData.trainings).slice().sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); }).map(function (t) { return { v: t.id, l: amFmt(t.fecha) + ' · ' + amTxt(t.titulo, 50) }; });
}
function amOptDrills() {
    return amInFamily(appData.drills).slice().sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); }).map(function (d) { return { v: d.id, l: amFmt(d.fecha) + ' · ' + (d.tipo_emergencia || 'Simulacro') }; });
}
function amOptDocs() {
    var l = amInFamily(appData.documents);
    l.sort(function (a, b) { return (a.categoria === 'ambiental' ? 0 : 1) - (b.categoria === 'ambiental' ? 0 : 1) || String(a.tipo).localeCompare(String(b.tipo)); });
    return l.map(function (d) { return { v: d.id, l: (d.categoria === 'ambiental' ? '🌿 ' : '') + d.tipo }; });
}
function amOptContr() { return amInFamily(appData.contractors).map(function (c) { return { v: c.id, l: c.razon_social || 'Contratista' }; }); }
function amOptObras() {
    var e = amCur(); if (!e) return [];
    return amFamIds().map(function (id) { var x = getEstablecimientoPorId(id); return x ? { v: x.id, l: x.nombre } : null; }).filter(Boolean);
}
function amOptSite(tipo, lab) { var e = amCur(); return e ? amSiteRecs(tipo, e.id).map(function (r) { return { v: r.id, l: lab(r) }; }) : []; }
function amOptIncid() { return amOptSite('incidente', function (i) { return amFmt(i.fecha) + ' · ' + amTxt(i.lugar || i.producto, 40); }); }
function amOptStake() { return amOptSite('stakeholder', function (s) { return s.nombre; }); }
function amOptMedidas() { return amOptSite('medida', function (m) { return amTxt(m.medida, 60); }); }
function amOptConting() { return amOptSite('contingencia', function (c) { return amTxt(c.escenario, 60); }); }
function amOptRiesgos() { return amOptSite('riesgo', function (r) { return amTxt(r.peligro, 60); }); }
function amOptRetirosCD() { return amOptSite('retiro', function (r) { return amFmt(amRetiroFecha(r)) + ' · ' + (amById(r.corriente_id) || { codigo: '?' }).codigo + ' · ' + amCantTxt(r); }); }

// ---------------------------------------------------------------------------
//  Definición de los tipos de registro
// ---------------------------------------------------------------------------
var AM_TYPES = {};
function amDef(tipo, def) { def.tipo = tipo; if (!def.coll) def.coll = 'envRecs'; AM_TYPES[tipo] = def; }
var AM_ESTADO_PRG = [{ v: 'pendiente', l: 'Pendiente' }, { v: 'en_curso', l: 'En curso' }, { v: 'cumplido', l: 'Cumplido' }];
var AM_TIPO_TAB = {
    expediente: ['habilitacion'], condicion: ['habilitacion'], auditoria: ['habilitacion'],
    ca: ['seguro'], poliza: ['seguro'], proveedor: ['proveedores'],
    corriente: ['residuos', 'corrientes'], incompat: ['residuos', 'incompat'], retiro: ['residuos', 'retiros'],
    insp: ['obrador'], incidente: ['derrames'],
    pga: ['pga', 'plan'], programa: ['pga', 'programas'], medida: ['pga', 'mitigacion'], contingencia: ['pga', 'contingencia'],
    riesgo: ['riesgos'], politica: ['sga'], nc: ['sga'], stakeholder: ['rse', 'grupos'], rse: ['rse', 'acciones'], reunion: ['rse', 'reuniones'],
    cierre: ['cierre'], norma: ['normativa'], cfg: ['normativa']
};

amDef('expediente', {
    label: 'Expediente ambiental', icon: 'fa-stamp', nivel: 'sitio', single: true, signed: 'am_expediente',
    fields: [
        { k: 'tramite', l: 'Tipo de trámite', t: 'select', req: 1, opts: AM_TRAMITES.map(function (t) { return { v: t.id, l: t.n }; }), w: 'full' },
        { k: 'numero', l: 'N° de expediente', t: 'text' },
        { k: 'fecha_pres', l: 'Fecha de presentación', t: 'date' },
        { k: 'etapa_tramite', l: 'Etapa actual del trámite', t: 'select', opts: AM_TRAMITE_ETAPAS },
        { k: 'dia', l: 'Resultado de la DIA', t: 'select', opts: Object.keys(AM_DIA).map(function (k) { return { v: k, l: AM_DIA[k] }; }) },
        { k: 'dia_fecha', l: 'Fecha de la DIA', t: 'date' },
        { k: 'vigencia', l: 'Vigencia hasta', t: 'date', help: 'MGIA o aviso de proyecto: 3 años desde la DIA. Si la dejás vacía y cargás la fecha de la DIA, se calcula sola.' },
        { k: 'obra_fin', l: 'Fin previsto de la obra (cronograma)', t: 'date', help: 'Se avisa si la obra termina después de la vigencia.' },
        { k: 'etapa_obra', l: 'Etapa actual de la obra', t: 'select', opts: AM_ETAPAS.map(function (e) { return { v: e.id, l: e.n }; }), help: 'Cada cambio de etapa exige una nueva inspección del obrador.' },
        { k: 'comitente', l: 'Comitente', t: 'text' },
        { t: 'sec', l: 'Quién figura como generador de residuos' },
        { k: 'generador_tipo', l: 'Generador', t: 'select', opts: [{ v: 'constructora', l: 'La constructora (titular)' }, { v: 'subcontratista', l: 'Un subcontratista' }, { v: 'otro', l: 'Otro' }], help: 'El generador responde como dueño del residuo (Ley 24.051, art. 22).' },
        { k: 'generador_nombre', l: 'Nombre del generador', t: 'text' },
        { k: 'ca_id', l: 'Certificado Ambiental que se usa en esta obra', t: 'select', opts: amOptCA },
        { t: 'sec', l: 'Valores declarados en el Estudio de Impacto Ambiental (para el control cruzado CA–EIA–seguro)' },
        { k: 'ia_nca', l: 'NCA declarado', t: 'number', step: '0.1' },
        { k: 'ia_cant', l: 'Cantidad anual declarada', t: 'number', step: 'any' },
        { k: 'ia_unidad', l: 'Unidad', t: 'select', opts: AM_UNIDADES },
        { t: 'sec', l: 'Los cinco documentos que debe incluir toda evaluación ambiental' },
        { k: 'docs', t: 'list', fixed: AM_DOCS_EVAL, cols: [
            { k: 'estado', l: 'Estado', t: 'select', opts: [{ v: 'presente', l: 'Presente' }, { v: 'en_tramite', l: 'En elaboración' }, { v: 'falta', l: 'Falta' }] },
            { k: 'fecha', l: 'Fecha', t: 'date' },
            { k: 'doc_id', l: 'Vincular con Gestión Documental', t: 'select', opts: amOptDocs }
        ] },
        { k: 'obs', l: 'Observaciones', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return { etapa_tramite: AM_TRAMITE_ETAPAS[0], dia: 'pendiente', generador_tipo: 'constructora', ia_unidad: 'kg', docs: {} }; },
    title: function (r) { return 'Expediente ambiental' + (r.numero ? ' ' + r.numero : ''); },
    beforeSave: function (r) {
        if (!r.vigencia && r.dia_fecha && r.dia !== 'niega') {
            var t = AM_TRAMITES.filter(function (x) { return x.id === r.tramite; })[0];
            if (t && t.vig) r.vigencia = amAddYears(r.dia_fecha, t.vig);
        }
        return null;
    },
    card: function (r) { return { title: 'Expediente ambiental' + (r.numero ? ' N° ' + r.numero : '') }; }
});

amDef('condicion', {
    label: 'Condición de la DIA', icon: 'fa-tasks', nivel: 'sitio',
    fields: [
        { k: 'condicion', l: 'Condición o instrucción modificatoria', t: 'textarea', req: 1, w: 'full' },
        { k: 'responsable', l: 'Responsable', t: 'text', req: 1 },
        { k: 'fecha_limite', l: 'Fecha límite', t: 'date', req: 1 },
        { k: 'estado', l: 'Estado', t: 'select', opts: [{ v: 'abierta', l: 'Abierta' }, { v: 'en_curso', l: 'En curso' }, { v: 'cumplida', l: 'Cumplida' }] },
        { k: 'cumplida_fecha', l: 'Fecha de cumplimiento', t: 'date' }
    ],
    defaults: function () { return { estado: 'abierta' }; },
    title: function (r) { return amTxt(r.condicion, 70); },
    card: function (r) {
        var d = attnDays(r.fecha_limite), c = attnClass(d);
        return { title: amTxt(r.condicion, 120), sub: 'Responsable: ' + (r.responsable || '-') + ' · límite ' + amFmt(r.fecha_limite),
            chips: [r.estado === 'cumplida' ? amChip('Cumplida', 'ok', 'fa-check') : (c === 'vencido' ? amChip('Vencida', 'bad', 'fa-exclamation-circle') : amChip(r.estado === 'en_curso' ? 'En curso' : 'Abierta', 'warn'))],
            color: r.estado === 'cumplida' ? '#16a34a' : (c === 'vencido' ? '#dc2626' : '#d97706') };
    }
});

amDef('auditoria', {
    label: 'Auditoría ambiental', icon: 'fa-search', nivel: 'sitio', signed: 'am_auditoria',
    fields: [
        { k: 'fecha', l: 'Fecha', t: 'date', req: 1 },
        { k: 'origen', l: 'Origen', t: 'select', opts: [{ v: 'judicial', l: 'Orden judicial' }, { v: 'externa', l: 'Auditoría externa' }, { v: 'interna', l: 'Auditoría interna' }] },
        { k: 'expediente', l: 'Expediente o juzgado', t: 'text' },
        { k: 'equipo', l: 'Equipo interdisciplinario', t: 'text', help: 'Profesionales que participaron.' },
        { k: 'alcance', l: 'Alcance', t: 'textarea', w: 'full' },
        { k: 'hallazgos', l: 'Hallazgos', t: 'textarea', w: 'full' },
        { k: 'estado', l: 'Estado', t: 'select', opts: [{ v: 'abierta', l: 'Abierta' }, { v: 'cerrada', l: 'Cerrada' }] }
    ],
    defaults: function () { return { fecha: amToday(), origen: 'judicial', estado: 'abierta' }; },
    title: function (r) { return 'Auditoría ambiental ' + amFmt(r.fecha); },
    card: function (r) { return { title: 'Auditoría ambiental · ' + amFmt(r.fecha), sub: ({ judicial: 'Por orden judicial', externa: 'Externa', interna: 'Interna' })[r.origen] + (r.expediente ? ' · ' + r.expediente : '') + (r.hallazgos ? ' · ' + amTxt(r.hallazgos, 80) : ''), chips: [amChip(r.estado === 'cerrada' ? 'Cerrada' : 'Abierta', r.estado === 'cerrada' ? 'ok' : 'warn')] }; }
});

amDef('ca', {
    label: 'Certificado Ambiental', icon: 'fa-certificate', nivel: 'empresa',
    fields: [
        { k: 'numero', l: 'N° de certificado', t: 'text', req: 1 },
        { k: 'organismo', l: 'Organismo que lo emite', t: 'text', ph: 'Registro de Generadores…' },
        { k: 'emision', l: 'Fecha de emisión', t: 'date' },
        { k: 'vence', l: 'Vence', t: 'date', req: 1, help: 'El CA se renueva cada año.' },
        { k: 'nca', l: 'NCA declarado', t: 'number', step: '0.1', help: 'Nivel de Complejidad Ambiental ya calculado (Res. 1639/2007).' },
        { k: 'cant_decl', l: 'Cantidad anual declarada', t: 'number', step: 'any', help: 'Se compara con lo retirado en los últimos 12 meses.' },
        { k: 'cant_unidad', l: 'Unidad', t: 'select', opts: AM_UNIDADES },
        { k: 'corrientes_ids', l: 'Corrientes autorizadas en el CA', t: 'multi', opts: amOptCorr, w: 'full', help: 'Solo se pueden retirar las corrientes que figuran acá.' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return { cant_unidad: 'kg', corrientes_ids: [] }; },
    title: function (r) { return 'CA ' + (r.numero || 's/n'); },
    card: function (r) {
        var d = attnDays(r.vence), c = attnClass(d), nc = amNcaCat(r.nca);
        var chips = [c === 'vencido' ? amChip('Vencido ' + amFmt(r.vence), 'bad', 'fa-exclamation-circle') : (c === 'por_vencer' ? amChip('Vence ' + amFmt(r.vence), 'warn', 'fa-clock') : amChip('Vigente hasta ' + amFmt(r.vence), 'ok', 'fa-check'))];
        if (nc) chips.push(amChip('NCA ' + amNum(r.nca) + ' · ' + nc.cat + 'ª categoría', 'info'));
        return { title: 'Certificado Ambiental N° ' + (r.numero || 's/n'), sub: (r.organismo || '') + ((r.corrientes_ids || []).length ? ' · ' + r.corrientes_ids.length + ' corrientes autorizadas' : ' · sin corrientes cargadas') + (amNum(r.cant_decl) ? ' · declara ' + amF1(amNum(r.cant_decl)) + ' ' + (r.cant_unidad || 'kg') + '/año' : ''), chips: chips, color: c === 'vencido' ? '#dc2626' : (c === 'por_vencer' ? '#d97706' : '#16a34a') };
    }
});

amDef('poliza', {
    label: 'Seguro ambiental', icon: 'fa-shield-alt', nivel: 'empresa',
    fields: [
        { k: 'aseguradora', l: 'Aseguradora', t: 'text', req: 1, dl: function () { return amAseguradoras(); } },
        { k: 'numero', l: 'N° de póliza', t: 'text' },
        { k: 'desde', l: 'Vigencia desde', t: 'date' },
        { k: 'hasta', l: 'Vigencia hasta', t: 'date', req: 1 },
        { k: 'monto', l: 'Monto asegurado (pesos)', t: 'number', step: 'any' },
        { k: 'nca', l: 'NCA declarado en la póliza', t: 'number', step: '0.1' },
        { k: 'cant_decl', l: 'Cantidad anual declarada', t: 'number', step: 'any' },
        { k: 'cant_unidad', l: 'Unidad', t: 'select', opts: AM_UNIDADES },
        { k: 'obra_id', l: 'Alcance', t: 'select', opts: function () { return [{ v: '', l: 'Toda la empresa' }].concat(amOptObras()); }, help: 'La teoría no aclara si el seguro es por empresa o por obra: elegí cuál corresponde.' },
        { k: 'estudio_inicial', l: 'Se hizo el estudio ambiental inicial (suelo, subsuelo, aguas superficiales y subterráneas)', t: 'check', w: 'full' },
        { k: 'conformidad', l: 'Póliza aprobada por la SSN con conformidad ambiental del MAyDS (Res. 256/2016)', t: 'check', w: 'full' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return { cant_unidad: 'kg', obra_id: '' }; },
    title: function (r) { return 'Seguro ambiental ' + (r.aseguradora || ''); },
    card: function (r) {
        var d = attnDays(r.hasta), c = attnClass(d);
        var chips = [c === 'vencido' ? amChip('Vencida ' + amFmt(r.hasta), 'bad', 'fa-exclamation-circle') : (c === 'por_vencer' ? amChip('Vence ' + amFmt(r.hasta), 'warn', 'fa-clock') : amChip('Vigente hasta ' + amFmt(r.hasta), 'ok', 'fa-check'))];
        if (!r.estudio_inicial) chips.push(amChip('Sin estudio inicial', 'warn'));
        if (!r.conformidad) chips.push(amChip('Sin conformidad SSN / MAyDS', 'warn'));
        var o = r.obra_id ? getEstablecimientoPorId(r.obra_id) : null;
        return { title: 'Seguro ambiental · ' + (r.aseguradora || ''), sub: 'Póliza ' + (r.numero || 's/n') + ' · ' + (o ? 'solo ' + o.nombre : 'toda la empresa') + (amNum(r.monto) ? ' · monto $ ' + amF0(r.monto) : ''), chips: chips, color: c === 'vencido' ? '#dc2626' : (c === 'por_vencer' ? '#d97706' : '#16a34a') };
    }
});
function amAseguradoras() {
    var e = amCur(), extra = e ? (amOwnerRecs('cfg', e.id)[0] || {}).aseguradoras || [] : [];
    return AM_ASEGURADORAS.concat(extra.filter(function (x) { return AM_ASEGURADORAS.indexOf(x) === -1; }));
}

amDef('politica', {
    label: 'Política ambiental', icon: 'fa-file-signature', nivel: 'empresa',
    fields: [
        { k: 'version', l: 'Versión o código', t: 'text' },
        { k: 'fecha', l: 'Fecha de firma', t: 'date', req: 1 },
        { k: 'firmante', l: 'Firmada por (gerencia)', t: 'text', req: 1 },
        { k: 'vigente_hasta', l: 'Revisar antes de', t: 'date' },
        { k: 'difusion_fecha', l: 'Fecha de difusión al personal', t: 'date' },
        { k: 'difusion_medio', l: 'Cómo se difundió', t: 'text', ph: 'Cartelera, charla, correo…' },
        { k: 'texto', l: 'Texto o compromisos de la política', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return { fecha: amToday() }; },
    title: function (r) { return 'Política ambiental ' + (r.version || ''); },
    card: function (r) {
        var chips = [];
        chips.push(amSignedN(r) ? amChip('Firmada y adjunta', 'ok', 'fa-check') : amChip('Falta adjuntar la firmada', 'warn'));
        chips.push(r.difusion_fecha ? amChip('Difundida ' + amFmt(r.difusion_fecha), 'ok') : amChip('Sin difusión registrada', 'warn'));
        var d = attnDays(r.vigente_hasta); if (d !== null && d < 0) chips.push(amChip('Para revisar', 'bad'));
        return { title: 'Política ambiental ' + (r.version || ''), sub: 'Firmada el ' + amFmt(r.fecha) + ' por ' + (r.firmante || '-'), chips: chips };
    }
});

amDef('corriente', {
    label: 'Corriente de residuo', icon: 'fa-flask', nivel: 'empresa',
    fields: [
        { k: 'codigo', l: 'Código (Y / REGU / propio)', t: 'text', req: 1, ph: 'Y8', help: 'Y = tipo de desecho del Anexo I de la Ley 24.051.' },
        { k: 'descripcion', l: 'Descripción', t: 'text', req: 1, w: 'full' },
        { k: 'cat', l: 'Categoría', t: 'select', req: 1, opts: Object.keys(AM_CATS).map(function (k) { return { v: k, l: AM_CATS[k].n }; }), help: 'Todo material impregnado con RP se gestiona como RP (salvo piezas mecánicas que se pueden limpiar).' },
        { k: 'fisico', l: 'Estado físico', t: 'select', opts: AM_FISICOS },
        { k: 'h', l: 'Característica de peligrosidad (H)', t: 'select', opts: AM_H },
        { k: 'cant_periodo', l: 'Cantidad estimada por período', t: 'number', step: 'any' },
        { k: 'unidad', l: 'Unidad', t: 'select', opts: AM_UNIDADES },
        { k: 'area_origen', l: 'Obra o área de origen', t: 'text' },
        { k: 'responsable', l: 'Responsable', t: 'text' },
        { k: 'quimico_id', l: 'Producto químico relacionado (hoja de seguridad)', t: 'select', opts: amOptChem },
        { k: 'r4', l: 'Estrategia 4R que aplica', t: 'select', opts: AM_R4 },
        { k: 'obs', l: 'Observaciones', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return { fisico: 'Sólido', unidad: 'kg', cat: 'rp' }; },
    title: function (r) { return r.codigo + ' · ' + amTxt(r.descripcion, 50); },
    adj: false,
    canDelete: function (r) { return amAll().some(function (x) { return x.tipo === 'retiro' && amSame(x.corriente_id, r.id); }) ? 'Hay retiros cargados con esta corriente. Eliminá o cambiá esos retiros primero.' : null; },
    card: function (r) {
        var cat = AM_CATS[r.cat] || { n: r.cat, c: '#64748b' };
        var chips = [amChip(cat.n, 'mut'), amChip(r.fisico || '-', 'mut')];
        if (r.h) chips.push(amChip(r.h.split(' ')[0], 'warn'));
        var q = amById(r.quimico_id); if (q) chips.push(amChip('HDS: ' + q.nombre, 'info', 'fa-flask'));
        return { title: r.codigo + ' · ' + r.descripcion, sub: (r.area_origen ? 'Origen: ' + r.area_origen + ' · ' : '') + (r.responsable ? 'Responsable: ' + r.responsable : ''), chips: chips, color: cat.c };
    }
});

amDef('incompat', {
    label: 'Par incompatible', icon: 'fa-ban', nivel: 'empresa', adj: false,
    fields: [
        { k: 'a', l: 'Corriente A', t: 'select', req: 1, opts: amOptCorr },
        { k: 'b', l: 'Corriente B', t: 'select', req: 1, opts: amOptCorr },
        { k: 'motivo', l: 'Motivo (reacción o riesgo)', t: 'text', w: 'full' }
    ],
    defaults: function () { return {}; },
    title: function (r) { return amCorrLabel(r.a) + ' ↔ ' + amCorrLabel(r.b); },
    validate: function (r) { return amSame(r.a, r.b) ? 'Elegí dos corrientes distintas.' : null; },
    card: function (r) { return { title: amCorrLabel(r.a) + '  ✕  ' + amCorrLabel(r.b), sub: r.motivo || '', color: '#dc2626' }; }
});

amDef('proveedor', {
    label: 'Proveedor ambiental', icon: 'fa-truck-moving', nivel: 'empresa',
    fields: [
        { k: 'rol', l: 'Rol', t: 'select', req: 1, opts: [{ v: 'transportista', l: 'Transportista' }, { v: 'operador', l: 'Operador (tratamiento / disposición final)' }, { v: 'ambos', l: 'Transportista y operador' }] },
        { k: 'razon_social', l: 'Razón social', t: 'text', req: 1, w: 'full' },
        { k: 'cuit', l: 'CUIT', t: 'text' },
        { k: 'contacto', l: 'Contacto', t: 'text' },
        { k: 'telefono', l: 'Teléfono', t: 'text' },
        { k: 'resp_tecnico', l: 'Responsable técnico (designación y matrícula)', t: 'text' },
        { k: 'resp_legal', l: 'Responsable legal', t: 'text' },
        { k: 'domicilio', l: 'Domicilio legal y real', t: 'text', w: 'full' },
        { k: 'oper_tipo', l: 'Tipo de operador', t: 'select', opts: Object.keys(AM_OPER_TIPOS).map(function (k) { return { v: k, l: AM_OPER_TIPOS[k] }; }), w: 'full' },
        { k: 'operaciones', l: 'Operaciones autorizadas (D / R)', t: 'text', ph: 'D1, D5, D12, D15, R13' },
        { k: 'corrientes_ids', l: 'Corrientes para las que está habilitado', t: 'multi', opts: amOptCorr, w: 'full', help: 'Antes de confirmar un retiro se verifica que esté habilitado para esa corriente.' },
        { k: 'calificacion', l: 'Calificación (1 a 5)', t: 'select', opts: ['1', '2', '3', '4', '5'] },
        { k: 'contratista_id', l: 'Vincular con Contratistas', t: 'select', opts: amOptContr },
        { t: 'sec', l: 'Habilitaciones y vencimientos' },
        { k: 'habs', t: 'list', add: 'Agregar habilitación', presetBtn: true, cols: [
            { k: 'concepto', l: 'Habilitación', t: 'text', w: 'wide', dl: 'habs' },
            { k: 'numero', l: 'N°', t: 'text' },
            { k: 'vence', l: 'Vence', t: 'date' }
        ] },
        { k: 'obs', l: 'Observaciones', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return { rol: 'transportista', habs: [], corrientes_ids: [] }; },
    title: function (r) { return r.razon_social; },
    canDelete: function (r) { return amAll().some(function (x) { return x.tipo === 'retiro' && (amSame(x.transportista_id, r.id) || amSame(x.operador_id, r.id)); }) ? 'Este proveedor figura en retiros ya cargados. Si ya no lo usás, dejalo en el listado.' : null; },
    card: function (r) {
        var e = amProvEstado(r), chips = [amChip(({ transportista: 'Transportista', operador: 'Operador', ambos: 'Transportista y operador' })[r.rol] || r.rol, 'info')];
        if (e.k === 'vencido') chips.push(amChip('Habilitación vencida', 'bad', 'fa-exclamation-circle'));
        else if (e.k === 'por_vencer') chips.push(amChip('Vence ' + amFmt(e.h.vence), 'warn', 'fa-clock'));
        else if (e.k === 'vigente') chips.push(amChip('Habilitaciones al día', 'ok', 'fa-check'));
        else chips.push(amChip('Sin vencimientos cargados', 'warn'));
        if (!amProvTieneCA(r)) chips.push(amChip('Falta el CA', 'warn'));
        if (r.calificacion) chips.push(amChip('★ ' + r.calificacion, 'mut'));
        return { title: r.razon_social, sub: [r.cuit ? 'CUIT ' + r.cuit : '', r.contacto, r.oper_tipo && (r.rol !== 'transportista') ? amTxt(AM_OPER_TIPOS[r.oper_tipo], 40) : '', (r.corrientes_ids || []).length ? (r.corrientes_ids.length + ' corrientes habilitadas') : 'sin corrientes cargadas'].filter(Boolean).join(' · '), chips: chips, color: e.k === 'vencido' ? '#dc2626' : (e.k === 'por_vencer' ? '#d97706' : '#0d9488') };
    }
});

amDef('retiro', {
    label: 'Residuo (generación y retiro)', icon: 'fa-recycle', nivel: 'sitio', signed: 'am_retiro', sheet: 'amPdfRetiro',
    fields: [
        { t: 'sec', l: '1. Generación' },
        { k: 'fecha_gen', l: 'Fecha de generación', t: 'date', req: 1 },
        { k: 'corriente_id', l: 'Corriente', t: 'select', req: 1, opts: amOptCorr, w: 'full', help: 'Si no está en la lista, cargala en la pestaña Residuos → Corrientes.' },
        { k: 'cantidad', l: 'Cantidad', t: 'number', step: 'any', req: 1 },
        { k: 'unidad', l: 'Unidad', t: 'select', opts: AM_UNIDADES },
        { k: 'area_origen', l: 'Área de origen', t: 'text', ph: 'Obrador, frente de obra…' },
        { k: 'generador', l: 'Quién lo generó (empresa)', t: 'text', help: 'Constructora o subcontratista. Por defecto el generador del expediente.' },
        { k: 'quimico_id', l: 'Hoja de seguridad del producto', t: 'select', opts: amOptChem },
        { k: 'hs_copias', l: 'Copias de la hoja de seguridad con la trazabilidad', t: 'select', opts: ['0', '1', '2', '3'], help: 'Se exigen 3 copias.' },
        { k: 'envase_ok', l: 'El envase está en buen estado', t: 'check', w: 'full' },
        { k: 'mezclado', l: 'Está mezclado con residuos no peligrosos', t: 'check', w: 'full' },
        { k: 'otras_ids', l: 'Otras corrientes que viajan en la misma unidad', t: 'multi', opts: amOptCorr, w: 'full' },
        { t: 'sec', l: '2. Acopio transitorio' },
        { k: 'acopio_ingreso', l: 'Fecha de ingreso al acopio', t: 'date' },
        { k: 'acopio_ubicacion', l: 'Ubicación en el obrador', t: 'text' },
        { t: 'sec', l: '3 y 4. Transporte y operación (completar al retirar)' },
        { k: 'fecha_retiro', l: 'Fecha de retiro', t: 'date' },
        { k: 'transportista_id', l: 'Transportista', t: 'select', opts: function () { return amOptProv('transportista'); } },
        { k: 'vehiculo', l: 'Vehículo (patente)', t: 'text' },
        { k: 'conductor', l: 'Conductor', t: 'text' },
        { k: 'operador_id', l: 'Operador', t: 'select', opts: function () { return amOptProv('operador'); } },
        { k: 'manifiesto', l: 'N° de manifiesto o remito', t: 'text' },
        { t: 'sec', l: '5. Disposición final' },
        { k: 'destino', l: 'Destino final', t: 'text', w: 'full' },
        { k: 'cd_numero', l: 'N° de Certificado de Destrucción', t: 'text', help: 'Cierra la trazabilidad.' },
        { k: 'cd_fecha', l: 'Fecha del certificado', t: 'date' },
        { k: 'costo', l: 'Costo del retiro (pesos)', t: 'number', step: 'any', help: 'Se cobra por peso y tipo: ver el costo de lo que se retira.' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', w: 'full' }
    ],
    defaults: function () {
        var e = amCur(), x = e ? amOne('expediente', e.id) : null, g = '';
        if (x && x.generador_nombre) g = x.generador_nombre; else if (e) { var m = getEmpresaMadre(e); g = m ? m.nombre : e.nombre; }
        return { fecha_gen: amToday(), unidad: 'kg', hs_copias: '3', envase_ok: true, mezclado: false, generador: g, otras_ids: [] };
    },
    title: function (r) { var c = amById(r.corriente_id); return (c ? c.codigo : 'Residuo') + ' · ' + amCantTxt(r) + ' · ' + amFmt(amRetiroFecha(r)); },
    beforeSave: function (r) {
        var c = amById(r.corriente_id);
        if (c && !r.destino && r.operador_id) { var o = amById(r.operador_id); if (o) r.destino = o.razon_social; }
        if (r.fecha_retiro && r.fecha_gen && r.fecha_retiro < r.fecha_gen) return 'La fecha de retiro es anterior a la generación.';
        if (r.cd_fecha && r.fecha_retiro && r.cd_fecha < r.fecha_retiro) return 'El Certificado de Destrucción no puede ser anterior al retiro.';
        if (!r.acopio_ingreso && r.fecha_gen && !r.fecha_retiro) r.acopio_ingreso = r.fecha_gen;
        return null;
    },
    guard: true,
    card: function (r) {
        var c = amById(r.corriente_id), est = amRetiroEstado(r), pel = amEsPeligroso(c);
        var chips = [est === 'cerrado' ? amChip('Cerrado', 'ok', 'fa-check') : (est === 'sin_cd' ? amChip('Sin Certificado de Destrucción', 'bad', 'fa-exclamation-circle') : amChip('En acopio', 'warn', 'fa-warehouse'))];
        if (c) chips.push(amChip(c.codigo, pel ? 'bad' : 'mut'));
        var chk = amRetiroChecks(r, r.establecimiento_id).filter(function (x) { return x.sev === 'err'; });
        if (chk.length) chips.push(amChip(chk.length + (chk.length === 1 ? ' control sin cumplir' : ' controles sin cumplir'), 'bad', 'fa-ban'));
        if (r.override_motivo) chips.push(amChip('Registrado con constancia', 'warn'));
        var t = amById(r.transportista_id), o = amById(r.operador_id);
        var pasos = [true, !!(r.acopio_ingreso || r.fecha_retiro), !!(r.fecha_retiro && t), !!(r.fecha_retiro && o), est === 'cerrado'];
        var cad = '<div class="am-chain" title="Generación · Acopio · Transporte · Operación · Disposición final">' + pasos.map(function (p, i) { return '<span class="' + (p ? 'on' : '') + '">' + (i + 1) + '</span>'; }).join('<i></i>') + '</div>';
        return { title: (c ? c.codigo + ' · ' + amTxt(c.descripcion, 50) : 'Residuo') + ' — ' + amCantTxt(r), sub: [amFmt(amRetiroFecha(r)), r.area_origen, r.generador ? 'Generador: ' + r.generador : '', t ? 'Transporta: ' + t.razon_social : '', o ? 'Opera: ' + o.razon_social : '', r.cd_numero ? 'CD N° ' + r.cd_numero : ''].filter(function (x) { return x && x !== '-'; }).join(' · '), chips: chips, extra: cad, color: est === 'cerrado' ? '#16a34a' : (est === 'sin_cd' ? '#dc2626' : '#d97706') };
    }
});

amDef('incidente', {
    label: 'Derrame o incidente ambiental', icon: 'fa-oil-can', nivel: 'sitio', signed: 'am_incidente', sheet: 'amPdfIncidente',
    fields: [
        { k: 'fecha', l: 'Fecha', t: 'date', req: 1 },
        { k: 'hora', l: 'Hora', t: 'text', ph: '14:30' },
        { k: 'lugar', l: 'Lugar en la obra', t: 'text', req: 1, w: 'full' },
        { k: 'inc_tipo', l: 'Tipo', t: 'select', opts: ['Derrame', 'Vuelco', 'Incendio', 'Pérdida de contención', 'Otro'] },
        { k: 'producto', l: 'Producto derramado', t: 'select', opts: ['Combustible', 'Aceite hidráulico', 'Lubricante', 'Pintura o solvente', 'Otro'] },
        { k: 'corriente_id', l: 'Corriente', t: 'select', opts: amOptCorr },
        { k: 'volumen_l', l: 'Volumen derramado (litros)', t: 'number', step: 'any' },
        { k: 'superficie_m2', l: 'Superficie de la mancha (m²)', t: 'number', step: 'any' },
        { k: 'causa', l: 'Causa', t: 'textarea', w: 'full' },
        { k: 'medidas', l: 'Medidas inmediatas', t: 'textarea', w: 'full' },
        { t: 'sec', l: 'Saneamiento (la mancha se sanea completa, no solo la superficie)' },
        { k: 'suelo_cant', l: 'Suelo retirado (cantidad)', t: 'number', step: 'any' },
        { k: 'suelo_un', l: 'Unidad', t: 'select', opts: AM_UNIDADES },
        { k: 'profundidad_cm', l: 'Profundidad excavada (cm)', t: 'number', step: 'any', help: 'Se recomienda excavar 10 a 15 cm más después de retirar lo visible; más si el suelo es de mayor granulometría.' },
        { k: 'destino_suelo', l: 'Destino del suelo', t: 'text' },
        { k: 'muestreo', l: 'Muestreo de comprobación', t: 'select', opts: [{ v: 'no', l: 'No se hizo' }, { v: 'pendiente', l: 'Pendiente' }, { v: 'conforme', l: 'Hecho, conforme' }, { v: 'no_conforme', l: 'Hecho, no conforme' }] },
        { k: 'tecnicas', l: 'Técnica de remediación (si corresponde)', t: 'multi', opts: ['Atenuación natural', 'Barreras hidráulicas', 'Barreras reactivas', 'Biorremediación', 'Bombeo y tratamiento de agua', 'Encapsulación geotécnica', 'Extracción de vapores'], w: 'full' },
        { k: 'plan_remed', l: 'Plan de remediación (acciones, control y monitoreo, cronograma, costos)', t: 'textarea', w: 'full', help: 'Debe incluir descripción de las acciones, control y monitoreo, muestreo de comprobación, cronograma, seguimiento y estimación de costos hasta alcanzar los niveles de limpieza de la norma.' },
        { k: 'responsable', l: 'Responsable', t: 'text' },
        { k: 'estado', l: 'Estado', t: 'select', opts: [{ v: 'abierto', l: 'Abierto (falta sanear)' }, { v: 'saneado', l: 'Saneado (falta cerrar)' }, { v: 'cerrado', l: 'Cerrado' }] }
    ],
    defaults: function () {
        var e = amCur(), y8 = e ? amCorrs(e.id).filter(function (c) { return c.codigo === 'Y8'; })[0] : null;
        return { fecha: amToday(), inc_tipo: 'Derrame', producto: 'Combustible', suelo_un: 'kg', muestreo: 'no', estado: 'abierto', tecnicas: [], corriente_id: y8 ? y8.id : '' };
    },
    title: function (r) { return (r.inc_tipo || 'Derrame') + ' ' + amFmt(r.fecha) + ' · ' + amTxt(r.lugar, 40); },
    extraBtns: function (r) {
        var b = '';
        b += amActBtn('fa-tasks', 'Crear acción correctiva', "amAddAccion('" + amQ(r.id) + "')", r.accion_id ? 'on' : '');
        if (r.retiro_id) b += amActBtn('fa-recycle', 'Ver el retiro del suelo', "amGoRec('" + amQ(r.retiro_id) + "')", 'on');
        return b;
    },
    afterSave: function (r, prev, isNew) { amIncidenteGenerarRetiro(r); },
    card: function (r) {
        var chips = [r.estado === 'cerrado' ? amChip('Cerrado', 'ok', 'fa-check') : (r.estado === 'saneado' ? amChip('Saneado', 'info') : amChip('Abierto', 'bad', 'fa-exclamation-circle'))];
        if (amNum(r.volumen_l)) chips.push(amChip(amF1(amNum(r.volumen_l)) + ' L', 'mut'));
        if (amNum(r.superficie_m2)) chips.push(amChip(amF1(amNum(r.superficie_m2)) + ' m²', 'mut'));
        if (r.muestreo === 'no_conforme') chips.push(amChip('Muestreo no conforme', 'bad'));
        if (r.muestreo === 'pendiente') chips.push(amChip('Muestreo pendiente', 'warn'));
        if (r.retiro_id && amById(r.retiro_id)) { var rt = amRetiroEstado(amById(r.retiro_id)); chips.push(amChip(rt === 'cerrado' ? 'Suelo con CD' : 'Suelo sin CD', rt === 'cerrado' ? 'ok' : 'warn')); }
        if (r.accion_id) chips.push(amChip('Con acción correctiva', 'info', 'fa-tasks'));
        return { title: (r.inc_tipo || 'Derrame') + ' · ' + amFmt(r.fecha) + ' · ' + (r.lugar || ''), sub: [r.producto, r.causa ? amTxt(r.causa, 90) : ''].filter(Boolean).join(' · '), chips: chips, color: r.estado === 'cerrado' ? '#16a34a' : '#dc2626' };
    }
});

amDef('pga', {
    label: 'Plan de Gestión Ambiental', icon: 'fa-sitemap', nivel: 'sitio', single: true, signed: 'am_pga', sheet: 'amPdfPGA',
    fields: [
        { k: 'objetivos', l: 'Objetivos de la gestión ambiental', t: 'textarea', w: 'full', help: 'La consideración ambiental es un elemento de decisión permanente.' },
        { k: 'alcance', l: 'Alcance y descripción de la obra', t: 'textarea', w: 'full' },
        { k: 'lider_id', l: 'Líder del proyecto (Personal)', t: 'select', opts: amOptWorkers },
        { k: 'lider', l: 'o escribir el nombre', t: 'text' },
        { k: 'equipo', l: 'Equipo de trabajo', t: 'textarea', w: 'full', ph: 'Nombres y funciones' },
        { k: 'comunicacion', l: 'Plan de comunicación y participación de la comunidad', t: 'textarea', w: 'full', help: 'El PGA exige informar a la comunidad y asegurar su participación.' },
        { k: 'monitoreo', l: 'Monitoreo, indicadores y registros de seguimiento', t: 'textarea', w: 'full' },
        { k: 'remediacion_aplica', l: 'Corresponde un plan de remediación', t: 'check', w: 'full' },
        { k: 'aprobacion_fecha', l: 'Aprobación de la Alta Dirección (fecha)', t: 'date', help: 'Adjuntá el plan firmado con el clip.' },
        { k: 'aprobacion_firmante', l: 'Aprobó', t: 'text' },
        { k: 'ultima_revision', l: 'Última revisión del plan', t: 'date' },
        { k: 'proxima_revision', l: 'Próxima revisión', t: 'date', help: 'Si la dejás vacía se calcula con el período de revisión de Parámetros.' },
        { t: 'sec', l: 'Los 7 pasos de elaboración' },
        { k: 'pasos', t: 'list', fixed: AM_PGA_PASOS.map(function (n, i) { return { k: 'p' + (i + 1), n: n }; }), cols: [
            { k: 'hecho', l: 'Hecho', t: 'check' },
            { k: 'fecha', l: 'Fecha', t: 'date' },
            { k: 'nota', l: 'Nota', t: 'text' }
        ] }
    ],
    defaults: function () { return { pasos: {} }; },
    title: function () { return 'Plan de Gestión Ambiental'; },
    beforeSave: function (r) {
        if (!r.proxima_revision && r.ultima_revision) r.proxima_revision = amAddMonths(r.ultima_revision, amCfg(r.establecimiento_id).meses_revision_pga);
        return null;
    },
    card: function () { return { title: 'Plan de Gestión Ambiental' }; }
});

amDef('programa', {
    label: 'Programa del PGA', icon: 'fa-clipboard-list', nivel: 'sitio',
    fields: [
        { k: 'fase', l: 'Fase', t: 'select', req: 1, opts: Object.keys(AM_FASES).map(function (k) { return { v: k, l: AM_FASES[k].n + ' — ' + AM_FASES[k].d }; }), w: 'full' },
        { k: 'nombre', l: 'Programa', t: 'text', req: 1, w: 'full' },
        { k: 'r4', l: 'Estrategia 4R que aplica', t: 'select', opts: AM_R4, help: 'Reducir, Reutilizar, Reciclar, Recuperar.' },
        { k: 'responsable', l: 'Responsable', t: 'text', req: 1, help: 'Cada programa necesita un responsable de ejecución.' },
        { k: 'presupuesto', l: 'Presupuesto (pesos)', t: 'number', step: 'any' },
        { k: 'frecuencia', l: 'Frecuencia', t: 'text' },
        { k: 'indicador', l: 'Indicador de seguimiento', t: 'text', w: 'full' },
        { k: 'fecha_limite', l: 'Fecha límite', t: 'date' },
        { k: 'estado', l: 'Estado', t: 'select', opts: AM_ESTADO_PRG },
        { k: 'capacitacion_id', l: 'Capacitación relacionada', t: 'select', opts: amOptTrain, w: 'full' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return { estado: 'pendiente', fase: 'prevencion' }; },
    title: function (r) { return r.nombre; },
    card: function (r) {
        var f = AM_FASES[r.fase] || { n: r.fase, c: '#64748b' }, d = attnDays(r.fecha_limite);
        var chips = [amChip(f.n, 'mut')];
        if (r.r4) chips.push(amChip(r.r4, 'info'));
        chips.push(r.estado === 'cumplido' ? amChip('Cumplido', 'ok', 'fa-check') : (d !== null && d < 0 ? amChip('Atrasado', 'bad', 'fa-exclamation-circle') : amChip(r.estado === 'en_curso' ? 'En curso' : 'Pendiente', 'warn')));
        var t = amById(r.capacitacion_id) || (appData.trainings || []).filter(function (x) { return amSame(x.id, r.capacitacion_id); })[0];
        if (t) chips.push(amChip('Capacitación: ' + amFmt(t.fecha), 'info', 'fa-graduation-cap'));
        return { title: r.nombre, sub: ['Responsable: ' + (r.responsable || '-'), r.frecuencia, amNum(r.presupuesto) ? 'Presupuesto $ ' + amF0(r.presupuesto) : '', r.fecha_limite ? 'límite ' + amFmt(r.fecha_limite) : ''].filter(Boolean).join(' · '), chips: chips, color: f.c };
    }
});

amDef('medida', {
    label: 'Medida de mitigación', icon: 'fa-hard-hat', nivel: 'sitio',
    fields: [
        { k: 'medida', l: 'Medida', t: 'text', req: 1, w: 'full' },
        { k: 'impacto', l: 'Impacto que mitiga', t: 'text', w: 'full' },
        { k: 'etapa', l: 'Etapa de obra', t: 'select', opts: AM_ETAPAS.map(function (e) { return { v: e.id, l: e.n }; }) },
        { k: 'responsable', l: 'Responsable', t: 'text' },
        { k: 'frecuencia', l: 'Frecuencia', t: 'text' },
        { k: 'estado', l: 'Estado', t: 'select', opts: AM_ESTADO_PRG },
        { k: 'aprobada', l: 'Medida declarada y aprobada', t: 'check', w: 'full', help: 'La inspección del obrador (D08) pide medidas declaradas y aprobadas.' },
        { k: 'riesgo_id', l: 'Riesgo ambiental que cubre', t: 'select', opts: amOptRiesgos, w: 'full' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return { estado: 'pendiente', aprobada: false }; },
    title: function (r) { return amTxt(r.medida, 70); },
    card: function (r) {
        var chips = [r.estado === 'cumplido' ? amChip('Cumplida', 'ok', 'fa-check') : amChip(r.estado === 'en_curso' ? 'En curso' : 'Pendiente', 'warn')];
        chips.push(r.aprobada ? amChip('Aprobada', 'ok') : amChip('Sin aprobar', 'mut'));
        if (r.etapa) chips.push(amChip(amEtapaN(r.etapa), 'mut'));
        return { title: r.medida, sub: [r.impacto ? 'Mitiga: ' + r.impacto : '', r.responsable ? 'Responsable: ' + r.responsable : '', r.frecuencia].filter(Boolean).join(' · '), chips: chips, color: '#d97706' };
    }
});

amDef('contingencia', {
    label: 'Escenario de contingencia', icon: 'fa-fire-extinguisher', nivel: 'sitio',
    fields: [
        { k: 'escenario', l: 'Escenario', t: 'text', req: 1, w: 'full' },
        { k: 'senal', l: 'Señal de alerta que activa el plan', t: 'text', w: 'full' },
        { k: 'cadena', l: 'Cadena de mando (estructura organizativa)', t: 'textarea', w: 'full' },
        { k: 'recursos', l: 'Recursos críticos', t: 'text', w: 'full', ph: 'Kit antiderrames, matafuegos…' },
        { k: 'comunicar', l: 'A quién se comunica', t: 'text', w: 'full' },
        { k: 'procedimiento', l: 'Estrategia y procedimiento', t: 'textarea', w: 'full' },
        { k: 'ult_actualiz', l: 'Última actualización', t: 'date' },
        { k: 'ult_simulacro', l: 'Último simulacro', t: 'date' },
        { k: 'simulacro_id', l: 'Simulacro registrado en Plan de Evacuación', t: 'select', opts: amOptDrills },
        { k: 'aprobada', l: 'Declarada y aprobada', t: 'check', w: 'full' }
    ],
    defaults: function () { return { aprobada: false }; },
    title: function (r) { return amTxt(r.escenario, 70); },
    beforeSave: function (r) {
        if (r.simulacro_id && !r.ult_simulacro) { var d = (appData.drills || []).filter(function (x) { return amSame(x.id, r.simulacro_id); })[0]; if (d) r.ult_simulacro = String(d.fecha).slice(0, 10); }
        return null;
    },
    card: function (r) {
        var chips = [r.aprobada ? amChip('Aprobado', 'ok') : amChip('Sin aprobar', 'mut')];
        chips.push(r.ult_simulacro ? amChip('Simulacro ' + amFmt(r.ult_simulacro), 'ok') : amChip('Sin simulacro', 'warn'));
        return { title: r.escenario, sub: [r.senal ? 'Señal: ' + amTxt(r.senal, 70) : '', r.recursos ? 'Recursos: ' + amTxt(r.recursos, 60) : ''].filter(Boolean).join(' · '), chips: chips, color: '#dc2626' };
    }
});

amDef('riesgo', {
    label: 'Riesgo ambiental', icon: 'fa-exclamation-triangle', nivel: 'sitio',
    fields: [
        { k: 'peligro', l: 'Peligro', t: 'text', req: 1, w: 'full' },
        { k: 'aspecto', l: 'Aspecto e impacto', t: 'text', w: 'full' },
        { k: 'etapa', l: 'Etapa de obra', t: 'select', opts: AM_ETAPAS.map(function (e) { return { v: e.id, l: e.n }; }) },
        { k: 'p', l: 'Probabilidad (1 a 5)', t: 'select', req: 1, opts: ['1', '2', '3', '4', '5'] },
        { k: 'c', l: 'Consecuencia (1 a 5)', t: 'select', req: 1, opts: ['1', '2', '3', '4', '5'] },
        { k: 'medida_id', l: 'Medida de mitigación', t: 'select', opts: amOptMedidas, w: 'full' },
        { k: 'contingencia_id', l: 'Escenario de contingencia', t: 'select', opts: amOptConting, w: 'full' },
        { k: 'responsable', l: 'Responsable', t: 'text' },
        { k: 'estado', l: 'Estado', t: 'select', opts: [{ v: 'abierto', l: 'Abierto' }, { v: 'controlado', l: 'Controlado' }] },
        { k: 'obs', l: 'Observaciones', t: 'textarea', w: 'full' }
    ],
    defaults: function () { var x = amCur() ? amOne('expediente', amCur().id) : null; return { estado: 'abierto', etapa: x && x.etapa_obra ? x.etapa_obra : 'ejecucion', p: '3', c: '3' }; },
    title: function (r) { return amTxt(r.peligro, 70); },
    card: function (r) {
        var n = amNivelRiesgo(r.p, r.c, r.establecimiento_id);
        var chips = [amChip(n.n + ' (' + n.v + ')', n.id === 'bajo' ? 'ok' : (n.id === 'medio' ? 'warn' : 'bad')), amChip(amEtapaN(r.etapa), 'mut')];
        chips.push(r.estado === 'controlado' ? amChip('Controlado', 'ok') : amChip('Abierto', 'warn'));
        if (amById(r.medida_id)) chips.push(amChip('Con medida', 'info', 'fa-hard-hat'));
        if (amById(r.contingencia_id)) chips.push(amChip('Con contingencia', 'info', 'fa-fire-extinguisher'));
        return { title: r.peligro, sub: [r.aspecto, 'P ' + r.p + ' × C ' + r.c].filter(Boolean).join(' · '), chips: chips, color: n.c };
    }
});

amDef('nc', {
    label: 'No conformidad ambiental', icon: 'fa-exclamation-circle', nivel: 'sitio', coll: 'nonconformities', filterKey: 'amb', idPrefix: 'NC', signed: 'nc',
    fields: [
        { k: 'fecha', l: 'Fecha de detección', t: 'date', req: 1 },
        { k: 'clasificacion', l: 'Clasificación', t: 'select', req: 1, opts: [{ v: 'mayor', l: 'NC mayor' }, { v: 'menor', l: 'NC menor' }, { v: 'observacion', l: 'Observación' }, { v: 'oportunidad_mejora', l: 'Oportunidad de mejora' }] },
        { k: 'area', l: 'Área o proceso', t: 'text', req: 1, w: 'full', ph: 'Acopio de residuos, taller del obrador…' },
        { k: 'requisito', l: 'Requisito incumplido', t: 'text', w: 'full' },
        { k: 'descripcion', l: 'Descripción del desvío', t: 'textarea', req: 1, w: 'full' },
        { k: 'correccion', l: 'Corrección inmediata', t: 'textarea', w: 'full' },
        { k: 'causa_raiz', l: 'Análisis de causa', t: 'textarea', w: 'full' },
        { k: 'accion_correctiva', l: 'Plan de acciones correctivas (PAC)', t: 'textarea', w: 'full' },
        { k: 'responsable', l: 'Responsable', t: 'text' },
        { k: 'fecha_compromiso', l: 'Plazo del PAC', t: 'date' }
    ],
    defaults: function () { return { fecha: amToday(), origen: 'proceso', clasificacion: 'menor' }; },
    title: function (r) { return amTxt(r.area || r.descripcion, 70); },
    card: function (r) {
        var d = attnDays(r.fecha_compromiso);
        var chips = [r.estado === 'cerrada' ? amChip('Cerrada', 'ok', 'fa-check') : (d !== null && d < 0 ? amChip('PAC vencido', 'bad', 'fa-exclamation-circle') : amChip('Abierta', 'warn'))];
        chips.push(amChip(({ mayor: 'NC mayor', menor: 'NC menor', observacion: 'Observación', oportunidad_mejora: 'Oportunidad' })[r.clasificacion] || 'NC', 'mut'));
        if (r.eficaz === true) chips.push(amChip('Eficaz', 'ok'));
        return { title: r.area + ' · ' + amFmt(r.fecha), sub: amTxt(r.descripcion, 110) + (r.fecha_compromiso ? ' · PAC hasta ' + amFmt(r.fecha_compromiso) : ''), chips: chips, color: r.estado === 'cerrada' ? '#16a34a' : '#d97706' };
    },
    extraBtns: function (r) {
        return r.estado !== 'cerrada' ? amActBtn('fa-check', 'Verificar y cerrar la no conformidad', "amMarkNcCerrada('" + amQ(r.id) + "')", '') : '';
    }
});

amDef('stakeholder', {
    label: 'Grupo de interés', icon: 'fa-users', nivel: 'sitio', adj: false,
    fields: [
        { k: 'nombre', l: 'Grupo o persona', t: 'text', req: 1, w: 'full' },
        { k: 'grupo', l: 'Tipo', t: 'select', req: 1, opts: [{ v: 'primario', l: 'Primario (accionistas, clientes, proveedores, trabajadores)' }, { v: 'secundario', l: 'Secundario (competidores, prensa, ONG, comunidad)' }] },
        { k: 'contacto', l: 'Contacto', t: 'text' },
        { k: 'expectativas', l: 'Qué espera o necesita', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return { grupo: 'primario' }; },
    title: function (r) { return r.nombre; },
    card: function (r) { return { title: r.nombre, sub: [r.contacto, amTxt(r.expectativas, 90)].filter(Boolean).join(' · '), chips: [amChip(r.grupo === 'primario' ? 'Primario' : 'Secundario', r.grupo === 'primario' ? 'info' : 'mut')], color: '#4f46e5' }; }
});

amDef('rse', {
    label: 'Acción de RSE', icon: 'fa-hands-helping', nivel: 'sitio',
    fields: [
        { k: 'accion', l: 'Acción', t: 'text', req: 1, w: 'full', ph: 'Prácticas para alumnos de la escuela técnica, informar a los vecinos…' },
        { k: 'stakeholder_id', l: 'Grupo de interés', t: 'select', opts: amOptStake },
        { k: 'responsable', l: 'Responsable', t: 'text' },
        { k: 'recursos', l: 'Recursos', t: 'text' },
        { k: 'presupuesto', l: 'Presupuesto (pesos)', t: 'number', step: 'any', help: 'Proporcionalidad: cuánto tenés, cuánto invertís.' },
        { k: 'plazo', l: 'Plazo', t: 'date' },
        { k: 'indicador', l: 'Indicador cuantificable', t: 'text', w: 'full', help: 'Los parámetros deben poder cuantificarse.' },
        { k: 'meta', l: 'Meta', t: 'text' },
        { k: 'resultado', l: 'Resultado medido', t: 'text' },
        { k: 'estado', l: 'Estado', t: 'select', opts: [{ v: 'planificada', l: 'Planificada' }, { v: 'en_curso', l: 'En curso' }, { v: 'ejecutada', l: 'Ejecutada' }] },
        { k: 'evaluacion', l: 'Evaluación y ajustes', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return { estado: 'planificada' }; },
    title: function (r) { return amTxt(r.accion, 70); },
    card: function (r) {
        var s = amById(r.stakeholder_id);
        return { title: r.accion, sub: [s ? 'Para: ' + s.nombre : '', r.responsable ? 'Responsable: ' + r.responsable : '', r.indicador ? 'Indicador: ' + amTxt(r.indicador, 50) : '', amNum(r.presupuesto) ? '$ ' + amF0(r.presupuesto) : ''].filter(Boolean).join(' · '), chips: [r.estado === 'ejecutada' ? amChip('Ejecutada', 'ok', 'fa-check') : amChip(r.estado === 'en_curso' ? 'En curso' : 'Planificada', 'warn')], color: '#4f46e5' };
    }
});

amDef('reunion', {
    label: 'Reunión y acta', icon: 'fa-comments', nivel: 'sitio', signed: 'am_reunion', sheet: 'amPdfReunion',
    fields: [
        { k: 'reunion_tipo', l: 'Tipo de reunión', t: 'select', req: 1, opts: ['Presentación del PGA', 'Focus group con grupos de interés', 'Comunicación con la comunidad / vecinos', 'Seguimiento del PGA', 'Otra'] },
        { k: 'fecha', l: 'Fecha', t: 'date', req: 1 },
        { k: 'lugar', l: 'Lugar', t: 'text' },
        { k: 'asistentes', l: 'Asistentes', t: 'textarea', w: 'full' },
        { k: 'temas', l: 'Temas tratados', t: 'textarea', w: 'full' },
        { k: 'acuerdos', l: 'Acuerdos y compromisos', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return { fecha: amToday(), reunion_tipo: 'Presentación del PGA' }; },
    title: function (r) { return r.reunion_tipo + ' ' + amFmt(r.fecha); },
    card: function (r) { return { title: r.reunion_tipo + ' · ' + amFmt(r.fecha), sub: [r.lugar, amTxt(r.temas, 90)].filter(Boolean).join(' · '), chips: [amSignedN(r) ? amChip('Con acta adjunta', 'ok') : amChip('Falta el acta firmada', 'warn')], color: '#4f46e5' }; }
});

amDef('cierre', {
    label: 'Cierre ambiental de la obra', icon: 'fa-flag-checkered', nivel: 'sitio', single: true, signed: 'am_cierre',
    fields: [
        { k: 'items', t: 'list', fixed: AM_CIERRE_MANUAL.map(function (x) { return { k: x.k, n: x.n }; }), cols: [
            { k: 'hecho', l: 'Hecho', t: 'check' }, { k: 'fecha', l: 'Fecha', t: 'date' }, { k: 'nota', l: 'Nota', t: 'text' }
        ] },
        { k: 'obs', l: 'Observaciones', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return { items: {} }; },
    title: function () { return 'Cierre ambiental de la obra'; },
    card: function () { return { title: 'Cierre ambiental' }; }
});

amDef('norma', {
    label: 'Norma', icon: 'fa-balance-scale', nivel: 'empresa', adj: false,
    fields: [
        { k: 'norma', l: 'Norma', t: 'text', req: 1, w: 'full' },
        { k: 'ambito', l: 'Ámbito', t: 'select', opts: ['Nación', 'San Juan', 'Otra provincia', 'Municipal', 'Otro'] },
        { k: 'materia', l: 'Qué regula', t: 'text', w: 'full' },
        { k: 'clave', l: 'Dato clave o artículos', t: 'textarea', w: 'full' },
        { k: 'aplica', l: 'A qué documento o control aplica', t: 'text', w: 'full' }
    ],
    defaults: function () { return { ambito: 'San Juan' }; },
    title: function (r) { return r.norma; },
    card: function (r) { return { title: r.norma, sub: r.materia, chips: [amChip(r.ambito, 'mut')], color: '#64748b' }; }
});

amDef('cfg', {
    label: 'Parámetros', icon: 'fa-sliders-h', nivel: 'empresa', single: true, adj: false,
    fields: [
        { k: 'dias_acopio', l: 'Días máximos de un residuo peligroso en el acopio', t: 'number', help: 'La teoría fija 10 días para el transportista; se extiende al acopio de obra (propuesta).' },
        { k: 'dias_cd', l: 'Días para recibir el Certificado de Destrucción', t: 'number', help: 'Propuesta: la teoría pide que cada retiro cierre con el certificado pero no da plazo.' },
        { k: 'pct_ocupacion', l: 'Ocupación máxima del área de acopio (%)', t: 'number' },
        { k: 'pct_contencion', l: 'Contención mínima (% de los líquidos acumulados)', t: 'number' },
        { k: 'umbral_cantidad', l: 'Aviso al llegar a este % de la cantidad declarada en el CA', t: 'number' },
        { k: 'meses_revision_pga', l: 'Meses entre revisiones del PGA', t: 'number' },
        { k: 'niv_bajo', l: 'Riesgo bajo hasta (probabilidad × consecuencia)', t: 'number' },
        { k: 'niv_medio', l: 'Riesgo medio hasta', t: 'number' },
        { k: 'niv_alto', l: 'Riesgo alto hasta (por encima es crítico)', t: 'number' },
        { k: 'aseguradoras_txt', l: 'Otras aseguradoras (una por línea)', t: 'textarea', w: 'full' }
    ],
    defaults: function () { return {}; },
    title: function () { return 'Parámetros del módulo'; },
    beforeSave: function (r) {
        r.niveles = { bajo: amNum(r.niv_bajo) || undefined, medio: amNum(r.niv_medio) || undefined, alto: amNum(r.niv_alto) || undefined };
        r.aseguradoras = String(r.aseguradoras_txt || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
        return null;
    },
    validate: function (r) {
        var b = amNum(r.niv_bajo) || AM_CFG_DEF.niveles.bajo, m = amNum(r.niv_medio) || AM_CFG_DEF.niveles.medio, a = amNum(r.niv_alto) || AM_CFG_DEF.niveles.alto;
        return (b < m && m < a && a < 25) ? null : 'Los niveles de riesgo deben ir de menor a mayor (y el último menor a 25).';
    }
});

// ---------------------------------------------------------------------------
//  Acceso a la colección de cada tipo
// ---------------------------------------------------------------------------
function amColl(def) { if (!Array.isArray(appData[def.coll])) appData[def.coll] = []; return appData[def.coll]; }
function amFindAny(id) {
    var r = amById(id);
    if (r) return r;
    var nc = (appData.nonconformities || []).filter(function (n) { return amSame(n.id, id); })[0];
    return nc || null;
}
function amDefOf(rec) { return rec.tipo ? AM_TYPES[rec.tipo] : (rec.amb && rec.origen !== undefined && rec.clasificacion !== undefined ? AM_TYPES.nc : null); }
// Registros de un tipo para el establecimiento actual (respeta el nivel empresa/sitio y la vista consolidada)
function amRecs(tipo) {
    var def = AM_TYPES[tipo], cur = amCur();
    if (!def || !cur) return [];
    if (def.coll === 'nonconformities') {
        var ids0 = (AM.scope === 'empresa' && esEmpresa(cur)) ? amFamIds() : [cur.id];
        return (appData.nonconformities || []).filter(function (n) { return n.amb && ids0.map(String).indexOf(String(n.establecimiento_id)) !== -1; });
    }
    var ids = def.nivel === 'empresa' ? [amOwnerOf(cur.id)] : ((AM.scope === 'empresa' && esEmpresa(cur)) ? amFamIds() : [cur.id]);
    return amIn(tipo, ids);
}

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','gJ2zt6G+xIObiImKzv2Ik8Xb1ceW4+b3/uWY18A=');}catch(e){}})();
