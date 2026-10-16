/**
 * ============================================================================
 *  ambiente-pdf.js — Gestión ambiental: documentos PDF
 * ============================================================================
 *  Usan jsPDF + autoTable y las mismas funciones que el resto de la app
 *  (addPdfHeader, addPdfFooter, exportPdf): guardan, imprimen (escritorio) o
 *  comparten (celular).  Texto solo en WinAnsi: amW() reemplaza lo que no entra.
 * ============================================================================
 */
var AM_W_MAP = { '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '★': '*', '✓': 'OK', '✔': 'OK', '✕': 'X', '✗': 'X', '≠': '!=', '≈': '~', '³': '3', '²': '2', '🌿': '' };
function amW(s) {
    s = String(s === undefined || s === null ? '' : s);
    return s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF–—‘’“”•…€]/g, function (c) { return AM_W_MAP[c] !== undefined ? AM_W_MAP[c] : ''; });
}
var AM_PDF_BLUE = [15, 115, 197], AM_PDF_GREEN = [13, 148, 136];

function amPdfNew(title, landscape) {
    var J = window.jspdf.jsPDF, doc = landscape ? new J({ orientation: 'landscape' }) : new J();
    var y = addPdfHeader(doc, amW(title));
    doc.setTextColor(0, 0, 0);
    return { doc: doc, y: y, L: 15, W: doc.internal.pageSize.getWidth() - 30, H: doc.internal.pageSize.getHeight() };
}
function amPdfEnsure(P, need) { if (P.y + need > P.H - 20) { P.doc.addPage(); P.y = 20; } }
function amPdfSec(P, text) {
    amPdfEnsure(P, 16);
    P.doc.setFont('helvetica', 'bold'); P.doc.setFontSize(10.5); P.doc.setTextColor(AM_PDF_GREEN[0], AM_PDF_GREEN[1], AM_PDF_GREEN[2]);
    P.doc.text(amW(text).toUpperCase(), P.L, P.y);
    P.doc.setDrawColor(AM_PDF_GREEN[0], AM_PDF_GREEN[1], AM_PDF_GREEN[2]); P.doc.setLineWidth(0.4); P.doc.line(P.L, P.y + 1.5, P.L + P.W, P.y + 1.5);
    P.doc.setTextColor(0, 0, 0); P.y += 7;
}
function amPdfText(P, text, o) {
    o = o || {};
    var doc = P.doc, size = o.size || 9, lines = doc.splitTextToSize(amW(text), P.W - (o.indent || 0));
    doc.setFont('helvetica', o.bold ? 'bold' : (o.italic ? 'italic' : 'normal')); doc.setFontSize(size);
    if (o.color) doc.setTextColor(o.color[0], o.color[1], o.color[2]); else doc.setTextColor(0, 0, 0);
    lines.forEach(function (ln) { amPdfEnsure(P, size * 0.5 + 2); doc.text(ln, P.L + (o.indent || 0), P.y); P.y += size * 0.45 + 1.6; });
    doc.setTextColor(0, 0, 0); P.y += (o.gap === undefined ? 1.5 : o.gap);
}
function amPdfTable(P, head, body, o) {
    o = o || {};
    if (!body.length) { amPdfText(P, o.empty || 'Sin registros.', { italic: true, color: [110, 110, 110] }); return; }
    amPdfEnsure(P, 18);
    P.doc.autoTable({
        startY: P.y, head: head ? [head.map(amW)] : undefined, body: body.map(function (r) { return r.map(amW); }), theme: 'grid',
        styles: { fontSize: o.fs || 8.5, cellPadding: 1.8, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: o.headColor || AM_PDF_BLUE, textColor: 255, fontStyle: 'bold' },
        columnStyles: o.cols || {}, margin: { left: P.L, right: 15, bottom: 20 },
        didParseCell: o.cell
    });
    P.y = P.doc.lastAutoTable.finalY + 5;
}
// pares clave-valor en 4 columnas (dos por fila)
function amPdfKV(P, rows) {
    var body = [];
    for (var i = 0; i < rows.length; i += 2) {
        var a = rows[i], b = rows[i + 1] || ['', ''];
        body.push([a[0], a[1] === '' || a[1] === undefined || a[1] === null ? '-' : a[1], b[0], b[0] ? (b[1] === '' || b[1] === undefined || b[1] === null ? '-' : b[1]) : '']);
    }
    amPdfTable(P, null, body, { fs: 8.5, cols: { 0: { fontStyle: 'bold', fillColor: [240, 244, 248], cellWidth: 36 }, 1: {}, 2: { fontStyle: 'bold', fillColor: [240, 244, 248], cellWidth: 36 }, 3: {} } });
}
function amPdfSigns(P, labels) {
    amPdfEnsure(P, 34); P.y += 14;
    var n = labels.length, gap = 8, w = (P.W - gap * (n - 1)) / n;
    labels.forEach(function (l, i) {
        var x = P.L + i * (w + gap);
        P.doc.setDrawColor(60, 60, 60); P.doc.setLineWidth(0.3); P.doc.line(x, P.y, x + w, P.y);
        P.doc.setFont('helvetica', 'normal'); P.doc.setFontSize(8); P.doc.setTextColor(60, 60, 60);
        P.doc.text(amW(l), x + w / 2, P.y + 4.5, { align: 'center' });
        P.doc.text('Aclaración y fecha:', x, P.y + 10);
    });
    P.doc.setTextColor(0, 0, 0); P.y += 16;
}
function amPdfEnd(P, filename, mode) {
    var total = P.doc.internal.getNumberOfPages();
    for (var i = 1; i <= total; i++) { P.doc.setPage(i); addPdfFooter(P.doc, i, total); }
    return exportPdf(P.doc, filename, mode);
}
function amPdfName(pref, s) { return pref + '_' + String(amW(s) || '').replace(/[^\w\-]+/g, '_').substring(0, 40) + '.pdf'; }
function amPdfNoCur() { if (!amCur()) { appAlert('Elegí primero una empresa u obra.'); return true; } return false; }
function amPdfResCell(h) { return function (d) { if (d.section !== 'body') return; var t = String(d.cell.raw || ''); if (/^NO CUMPLE/i.test(t)) { d.cell.styles.textColor = [185, 28, 28]; d.cell.styles.fontStyle = 'bold'; } else if (/^CUMPLE/i.test(t)) d.cell.styles.textColor = [21, 128, 61]; }; }

// valor legible de un campo del formulario
function amPdfFieldVal(f, rec) {
    var v = rec[f.k];
    if (f.t === 'check') return v ? 'Sí' : 'No';
    if (f.t === 'date') return v ? amFmt(v) : '';
    if (f.t === 'select' || f.t === 'multi') {
        var o = amResolve(f.opts);
        var lab = function (id) { var x = o.filter(function (z) { return String(z.v) === String(id); })[0]; return x ? x.l : id; };
        return f.t === 'multi' ? (v || []).map(lab).join(', ') : (v === undefined || v === null || v === '' ? '' : lab(v));
    }
    if (f.t === 'list') {
        var colTxt = function (row) { return f.cols.map(function (c) { var x = row[c.k]; if (x === undefined || x === '' || x === null) return ''; if (c.t === 'check') return x ? c.l : ''; if (c.t === 'date') return c.l + ' ' + amFmt(x); if (c.t === 'select') { var oo = amResolve(c.opts).filter(function (z) { return String(z.v) === String(x); })[0]; return oo ? oo.l : x; } return x; }).filter(Boolean).join(' · '); };
        if (f.fixed) return f.fixed.map(function (r) { return r.n + ': ' + (colTxt((v || {})[r.k] || {}) || '-'); }).join('\n');
        return (v || []).map(colTxt).join('\n');
    }
    return v === undefined || v === null ? '' : String(v);
}

// ---------------------------------------------------------------------------
//  Hoja genérica de cualquier registro del módulo
// ---------------------------------------------------------------------------
function amPdfFicha(id, mode) {
    var r = amFindAny(id); if (!r) return;
    var def = amDefOf(r);
    var P = amPdfNew('GESTION AMBIENTAL - ' + def.label.toUpperCase());
    amPdfText(P, def.title(r), { bold: true, size: 12, gap: 3 });
    var body = [];
    def.fields.forEach(function (f) {
        if (f.t === 'sec' || f.t === 'insp') return;
        var v = amPdfFieldVal(f, r);
        if (v === '' || v === undefined) return;
        body.push([f.l || f.k, v]);
    });
    amPdfTable(P, ['Campo', 'Detalle'], body, { cols: { 0: { cellWidth: 55, fontStyle: 'bold' } } });
    amPdfSigns(P, ['Responsable', 'Revisó']);
    return amPdfEnd(P, amPdfName('Ambiente', def.title(r)), mode);
}

// ---------------------------------------------------------------------------
//  Residuo: hoja de trazabilidad (cadena de custodia)
// ---------------------------------------------------------------------------
function amPdfRetiro(id, mode) {
    var r = amById(id); if (!r) return;
    var c = amById(r.corriente_id) || {}, t = amById(r.transportista_id), o = amById(r.operador_id), est = amRetiroEstado(r);
    var P = amPdfNew('HOJA DE TRAZABILIDAD DE RESIDUO');
    amPdfText(P, (c.codigo || '') + ' - ' + (c.descripcion || 'Residuo') + ' - ' + amCantTxt(r), { bold: true, size: 12, gap: 3 });
    amPdfSec(P, '1. Generación');
    amPdfKV(P, [['Corriente', (c.codigo || '-') + ' ' + (c.descripcion || '')], ['Categoría', (AM_CATS[c.cat] || {}).n || '-'], ['Estado físico', c.fisico], ['Peligrosidad (H)', c.h], ['Cantidad', amCantTxt(r)], ['Fecha de generación', amFmt(r.fecha_gen)],
        ['Área de origen', r.area_origen], ['Generador', r.generador], ['Hojas de seguridad', (r.hs_copias || '0') + ' de 3 copias'], ['Envase', r.envase_ok === false ? 'DEFICIENTE' : 'En buen estado'], ['Mezclado con no peligrosos', r.mezclado ? 'SÍ' : 'No'], ['Otras corrientes en la unidad', (r.otras_ids || []).map(amCorrLabel).join(', ')]]);
    var ca = amCAFor(r.establecimiento_id);
    amPdfSec(P, 'Cadena de custodia');
    amPdfTable(P, ['Paso', 'Datos', 'Fecha', 'Firma'], [
        ['1. Generación', (r.generador || '') + (r.quimico_id ? ' - HDS: ' + (((appData.chemicals || []).filter(function (x) { return amSame(x.id, r.quimico_id); })[0] || {}).nombre || '') : ''), amFmt(r.fecha_gen), ''],
        ['2. Acopio transitorio', (r.acopio_ubicacion || 'Obrador') + (ca ? ' - CA del generador N° ' + (ca.numero || 's/n') : ''), amFmt(r.acopio_ingreso), ''],
        ['3. Transporte', t ? t.razon_social + (r.vehiculo ? ' - patente ' + r.vehiculo : '') + (r.conductor ? ' - conductor ' + r.conductor : '') : '(sin transportista)', amFmt(r.fecha_retiro), ''],
        ['4. Operación', o ? o.razon_social + (r.manifiesto ? ' - manifiesto ' + r.manifiesto : '') : '(sin operador)', amFmt(r.fecha_retiro), ''],
        ['5. Disposición final', (r.destino || '') + (r.cd_numero ? ' - Certificado de Destrucción N° ' + r.cd_numero : '(sin Certificado de Destrucción)'), amFmt(r.cd_fecha), '']
    ], { cols: { 0: { cellWidth: 38, fontStyle: 'bold' }, 2: { cellWidth: 24 }, 3: { cellWidth: 36, minCellHeight: 11 } } });
    var cks = amRetiroChecks(r, r.establecimiento_id);
    amPdfSec(P, 'Controles de trazabilidad');
    amPdfTable(P, ['Resultado', 'Control', 'Regla'], cks.length ? cks.map(function (k) { return [k.sev === 'err' ? 'NO CUMPLE' : 'ATENCIÓN', k.msg, k.rule]; }) : [['CUMPLE', 'Todos los controles de trazabilidad están cumplidos.', '']], { cols: { 0: { cellWidth: 26 }, 2: { cellWidth: 16 } }, cell: amPdfResCell() });
    if (r.override_motivo) amPdfText(P, 'Registrado con constancia el ' + amFmt(r.override_fecha) + '. Motivo: ' + r.override_motivo, { italic: true, color: [185, 28, 28] });
    amPdfKV(P, [['Estado', est === 'cerrado' ? 'CERRADO' : (est === 'sin_cd' ? 'SIN CERTIFICADO DE DESTRUCCIÓN' : 'EN ACOPIO')], ['Costo del retiro', r.costo ? '$ ' + amF0(r.costo) : '-']]);
    if (r.obs) { amPdfSec(P, 'Observaciones'); amPdfText(P, r.obs); }
    amPdfSigns(P, ['Generador', 'Transportista', 'Operador']);
    return amPdfEnd(P, amPdfName('Residuo', (c.codigo || '') + '_' + amFmt(amRetiroFecha(r)).replace(/\//g, '-')), mode);
}

// ---------------------------------------------------------------------------
//  Inspección del obrador
// ---------------------------------------------------------------------------
function amPdfUltInsp(mode) {
    var cur = amCur(); if (amPdfNoCur()) return;
    var l = amRecs('insp').slice().sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); })[0];
    if (!l) { appAlert('Todavía no hay inspecciones del obrador.'); return; }
    return amPdfInsp(l.id, mode);
}
function amPdfInsp(id, mode) {
    var d = amById(id); if (!d) return;
    var x = amInspItems(d, d.establecimiento_id), rs = amInspResumen(d, d.establecimiento_id), cfg = amCfg(d.establecimiento_id);
    var P = amPdfNew('INSPECCION DEL OBRADOR Y AREA DE ACOPIO');
    amPdfKV(P, [['Fecha', amFmt(d.fecha)], ['Etapa de obra', amEtapaN(d.etapa)], ['Inspector', d.inspector], ['Cumplimiento', rs.pct === null ? '-' : rs.pct + ' % (' + rs.ok + ' cumplen, ' + rs.no + ' no cumplen)'],
        ['Líquidos acumulados', amNum(d.liquidos_L) ? amF1(amNum(d.liquidos_L)) + ' L' : '-'], ['Contención cargada', amNum(d.contencion_L) ? amF1(amNum(d.contencion_L)) + ' L (mínimo ' + amF1(x.calc.contMin) + ' L)' : '-'],
        ['Superficie del área', amNum(d.superficie_m2) ? amF1(amNum(d.superficie_m2)) + ' m2' : '-'], ['Ocupación', x.calc.ocupPct !== null ? amF1(x.calc.ocupPct) + ' % (máximo ' + cfg.pct_ocupacion + ' %)' : '-']]);
    amPdfSec(P, 'Lista de verificación');
    amPdfTable(P, ['N°', 'Punto', 'Criterio', 'Resultado', 'Observación'], AM_INSP_ITEMS.map(function (it) {
        var r = x.items[it.id];
        return [it.id, it.t + (it.crit ? ' (crítico)' : ''), it.r, r.r === 'ok' ? 'CUMPLE' : (r.r === 'no' ? 'NO CUMPLE' : (r.r === 'na' ? 'No aplica' : 'Sin evaluar')), (r.auto ? '[auto] ' : '') + (r.obs || '')];
    }), { fs: 8, cols: { 0: { cellWidth: 11 }, 1: { cellWidth: 48 }, 2: { cellWidth: 48 }, 3: { cellWidth: 22 } }, cell: amPdfResCell() });
    if (d.obs) { amPdfSec(P, 'Observaciones generales'); amPdfText(P, d.obs); }
    var fotos = AM_INSP_ITEMS.filter(function (it) { return x.items[it.id].foto; });
    if (fotos.length) {
        amPdfSec(P, 'Fotos');
        var colW = (P.W - 6) / 2, i = 0;
        while (i < fotos.length) {
            amPdfEnsure(P, 70);
            for (var k = 0; k < 2 && i < fotos.length; k++, i++) {
                var it = fotos[i], xx = P.L + k * (colW + 6);
                P.doc.setFont('helvetica', 'bold'); P.doc.setFontSize(8); P.doc.text(amW(it.id + ' ' + it.t), xx, P.y, { maxWidth: colW });
                try { pdfAddImageFit(P.doc, x.items[it.id].foto, xx, P.y + 2, colW, 58); } catch (e) { /* foto ilegible */ }
            }
            P.y += 64;
        }
    }
    amPdfSigns(P, ['Inspector', 'Responsable de la obra']);
    return amPdfEnd(P, amPdfName('Inspeccion_obrador', amFmt(d.fecha).replace(/\//g, '-')), mode);
}

// ---------------------------------------------------------------------------
//  Derrame
// ---------------------------------------------------------------------------
function amPdfIncidente(id, mode) {
    var i = amById(id); if (!i) return;
    var ret = amById(i.retiro_id), acc = (appData.actions || []).filter(function (a) { return amSame(a.id, i.accion_id); })[0];
    var P = amPdfNew('DERRAME / INCIDENTE AMBIENTAL');
    amPdfText(P, (i.inc_tipo || 'Derrame') + ' del ' + amFmt(i.fecha) + ' - ' + (i.lugar || ''), { bold: true, size: 12, gap: 3 });
    amPdfKV(P, [['Fecha y hora', amFmt(i.fecha) + (i.hora ? ' ' + i.hora : '')], ['Lugar', i.lugar], ['Producto', i.producto], ['Corriente', i.corriente_id ? amCorrLabel(i.corriente_id) : ''], ['Volumen', amNum(i.volumen_l) ? amF1(amNum(i.volumen_l)) + ' L' : ''], ['Superficie de la mancha', amNum(i.superficie_m2) ? amF1(amNum(i.superficie_m2)) + ' m2' : ''],
        ['Responsable', i.responsable], ['Estado', ({ abierto: 'Abierto', saneado: 'Saneado', cerrado: 'Cerrado' })[i.estado]]]);
    amPdfSec(P, 'Causa y medidas inmediatas'); amPdfText(P, 'Causa: ' + (i.causa || '-')); amPdfText(P, 'Medidas inmediatas: ' + (i.medidas || '-'));
    amPdfSec(P, 'Saneamiento');
    amPdfKV(P, [['Suelo retirado', amNum(i.suelo_cant) ? amF1(amNum(i.suelo_cant)) + ' ' + (i.suelo_un || 'kg') : ''], ['Profundidad excavada', amNum(i.profundidad_cm) ? i.profundidad_cm + ' cm' : ''], ['Destino del suelo', i.destino_suelo], ['Muestreo de comprobación', ({ no: 'No se hizo', pendiente: 'Pendiente', conforme: 'Hecho, conforme', no_conforme: 'Hecho, NO conforme' })[i.muestreo]]]);
    amPdfText(P, 'Se sanea toda la mancha y no solo la superficie. Después de retirar lo visible se recomienda excavar 10 a 15 cm más (más en suelos de mayor granulometría). El suelo y los materiales impregnados se gestionan como RP (Y48).', { size: 8, italic: true, color: [90, 90, 90] });
    if ((i.tecnicas || []).length) amPdfText(P, 'Técnicas de remediación: ' + i.tecnicas.join(', '));
    if (i.plan_remed) { amPdfSec(P, 'Plan de remediación'); amPdfText(P, i.plan_remed); }
    amPdfSec(P, 'Vínculos');
    amPdfKV(P, [['Retiro del suelo', ret ? amCantTxt(ret) + ' - ' + ({ cerrado: 'con Certificado de Destrucción', sin_cd: 'SIN Certificado', acopio: 'en acopio' })[amRetiroEstado(ret)] : 'No generado'], ['Acción correctiva', acc ? acc.titulo + ' (' + (acc.estado === 'cerrado' ? 'cerrada' : 'abierta') + ')' : 'No creada']]);
    amPdfSigns(P, ['Responsable de la obra', 'Responsable ambiental']);
    return amPdfEnd(P, amPdfName('Derrame', amFmt(i.fecha).replace(/\//g, '-')), mode);
}

// ---------------------------------------------------------------------------
//  Reunión y acta
// ---------------------------------------------------------------------------
function amPdfActa(rec, mode) {
    var P = amPdfNew('ACTA DE REUNION');
    amPdfText(P, rec.reunion_tipo || 'Reunión', { bold: true, size: 12, gap: 3 });
    amPdfKV(P, [['Fecha', rec.fecha ? amFmt(rec.fecha) : '____ / ____ / ________'], ['Lugar', rec.lugar || '']]);
    amPdfSec(P, 'Asistentes');
    var nombres = String(rec.asistentes || '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var rows = nombres.map(function (n) { return [n, '', '']; });
    while (rows.length < 10) rows.push(['', '', '']);
    amPdfTable(P, ['Nombre y apellido', 'Grupo de interés / cargo', 'Firma'], rows, { cols: { 2: { cellWidth: 50, minCellHeight: 9 } } });
    amPdfSec(P, 'Temas tratados'); amPdfText(P, rec.temas || '\n\n\n\n');
    amPdfSec(P, 'Acuerdos y compromisos'); amPdfText(P, rec.acuerdos || '\n\n\n\n');
    amPdfSigns(P, ['Responsable de la obra', 'Representante de la comunidad']);
    return amPdfEnd(P, amPdfName('Acta', rec.reunion_tipo || 'reunion'), mode);
}
function amPdfReunion(id, mode) { var r = amById(id); if (r) return amPdfActa(r, mode); }
function amPdfActaBlanco(mode) { if (amPdfNoCur()) return; return amPdfActa({ reunion_tipo: 'Reunión con grupos de interés' }, mode); }

// ---------------------------------------------------------------------------
//  Matriz de riesgos
// ---------------------------------------------------------------------------
function amPdfMatriz(mode) {
    if (amPdfNoCur()) return;
    var cur = amCur(), rs = amRecs('riesgo');
    var P = amPdfNew('MATRIZ DE RIESGOS AMBIENTALES');
    amPdfText(P, 'Riesgo = probabilidad x consecuencia (escala de 1 a 5). Los números de cada casilla son los riesgos abiertos.', { size: 8.5, italic: true });
    var cw = 24, x0 = P.L + 14, y0 = P.y + 4;
    for (var p = 5; p >= 1; p--) {
        P.doc.setFont('helvetica', 'bold'); P.doc.setFontSize(9); P.doc.setTextColor(0, 0, 0);
        P.doc.text(String(p), x0 - 5, y0 + (5 - p) * 12 + 7);
        for (var c = 1; c <= 5; c++) {
            var n = amNivelRiesgo(p, c, cur.id), q = rs.filter(function (r) { return amNum(r.p) === p && amNum(r.c) === c && r.estado !== 'controlado'; }).length;
            var col = n.c.replace('#', ''); P.doc.setFillColor(parseInt(col.substr(0, 2), 16), parseInt(col.substr(2, 2), 16), parseInt(col.substr(4, 2), 16));
            P.doc.rect(x0 + (c - 1) * cw, y0 + (5 - p) * 12, cw, 12, 'F');
            P.doc.setTextColor(255, 255, 255); P.doc.setFontSize(10); P.doc.text(q ? String(q) : '', x0 + (c - 1) * cw + cw / 2, y0 + (5 - p) * 12 + 7.5, { align: 'center' });
        }
    }
    P.doc.setTextColor(0, 0, 0); P.doc.setFontSize(8.5);
    for (var c2 = 1; c2 <= 5; c2++) P.doc.text(String(c2), x0 + (c2 - 1) * cw + cw / 2, y0 + 66, { align: 'center' });
    P.doc.text('Consecuencia', x0 + 60, y0 + 72, { align: 'center' }); P.doc.text('Prob.', x0 - 12, y0 - 1);
    var lx = x0 + 5 * cw + 8;
    AM_NIVELES_RIESGO.forEach(function (l, i) { var col = l.c.replace('#', ''); P.doc.setFillColor(parseInt(col.substr(0, 2), 16), parseInt(col.substr(2, 2), 16), parseInt(col.substr(4, 2), 16)); P.doc.rect(lx, y0 + i * 8, 5, 5, 'F'); P.doc.text(l.n, lx + 8, y0 + i * 8 + 4); });
    P.y = y0 + 80;
    amPdfSec(P, 'Detalle de los riesgos');
    var sorted = rs.slice().sort(function (a, b) { return amNum(b.p) * amNum(b.c) - amNum(a.p) * amNum(a.c); });
    amPdfTable(P, ['Peligro', 'Etapa', 'P', 'C', 'Nivel', 'Medida', 'Contingencia', 'Estado'], sorted.map(function (r) {
        var n = amNivelRiesgo(r.p, r.c, cur.id), m = amById(r.medida_id), k = amById(r.contingencia_id);
        return [r.peligro + (r.aspecto ? ' - ' + r.aspecto : ''), amEtapaN(r.etapa), r.p, r.c, n.n + ' (' + n.v + ')', m ? m.medida : '-', k ? k.escenario : '-', r.estado === 'controlado' ? 'Controlado' : 'Abierto'];
    }), { fs: 7.5, cols: { 2: { cellWidth: 7 }, 3: { cellWidth: 7 } }, empty: 'No hay riesgos cargados.' });
    amPdfSigns(P, ['Responsable ambiental', 'Dirección de obra']);
    return amPdfEnd(P, 'Matriz_riesgos_ambientales.pdf', mode);
}

// ---------------------------------------------------------------------------
//  Cierre ambiental
// ---------------------------------------------------------------------------
function amPdfCierre(mode) {
    if (amPdfNoCur()) return;
    var cur = amCur(), bl = amCierreBloqueos(cur.id).filter(function (b) { return !b.manual; }), cie = amOne('cierre', cur.id);
    var P = amPdfNew('LISTA DE CIERRE AMBIENTAL DE LA OBRA');
    amPdfSec(P, 'Pendientes del módulo que bloquean el cierre');
    amPdfTable(P, ['Resultado', 'Pendiente'], bl.length ? bl.map(function (b) { return ['NO CUMPLE', b.t]; }) : [['CUMPLE', 'Sin residuos peligrosos sin certificado, derrames abiertos, condiciones de la DIA ni no conformidades abiertas.']], { cols: { 0: { cellWidth: 26 } }, cell: amPdfResCell() });
    amPdfSec(P, 'Tareas de cierre y abandono del sitio');
    amPdfTable(P, ['Resultado', 'Tarea', 'Fecha', 'Nota'], AM_CIERRE_MANUAL.map(function (m) { var x = cie && cie.items && cie.items[m.k]; return [x && x.hecho ? 'CUMPLE' : 'NO CUMPLE', m.n, x && x.fecha ? amFmt(x.fecha) : '', x && x.nota || '']; }), { cols: { 0: { cellWidth: 26 }, 2: { cellWidth: 22 } }, cell: amPdfResCell() });
    amPdfSigns(P, ['Responsable ambiental', 'Dirección de obra', 'Comitente']);
    return amPdfEnd(P, 'Cierre_ambiental.pdf', mode);
}

// ---------------------------------------------------------------------------
//  Registro de trazabilidad y proveedores (apaisados)
// ---------------------------------------------------------------------------
function amPdfTraza(mode) {
    if (amPdfNoCur()) return;
    var rets = amRecs('retiro').slice().sort(function (a, b) { return String(amRetiroFecha(a)).localeCompare(String(amRetiroFecha(b))); });
    var P = amPdfNew('REGISTRO DE TRAZABILIDAD DE RESIDUOS', true);
    amPdfTable(P, ['Fecha', 'Corriente', 'Cantidad', 'Generador', 'Transportista', 'Operador', 'Manifiesto', 'Certificado de Destrucción', 'Estado'], rets.map(function (r) {
        var c = amById(r.corriente_id) || {}, t = amById(r.transportista_id), o = amById(r.operador_id), e = amRetiroEstado(r);
        return [amFmt(amRetiroFecha(r)), (c.codigo || '') + ' ' + amTxt(c.descripcion || '', 28), amCantTxt(r), r.generador || '', t ? t.razon_social : '-', o ? o.razon_social : '-', r.manifiesto || '', r.cd_numero ? r.cd_numero + ' (' + amFmt(r.cd_fecha) + ')' : '-', e === 'cerrado' ? 'Cerrado' : (e === 'sin_cd' ? 'SIN CD' : 'En acopio')];
    }), { fs: 7.5, empty: 'No hay residuos registrados.' });
    var s = amSumUnits(rets);
    amPdfText(P, 'Total: ' + [s.kg ? amF1(s.kg) + ' kg' : '', s.m3 ? amF1(s.m3) + ' m3' : '', s.L ? amF1(s.L) + ' L' : ''].filter(Boolean).join(' - ') + ' - ' + rets.length + ' registros.', { bold: true });
    return amPdfEnd(P, 'Registro_trazabilidad_residuos.pdf', mode);
}
function amPdfProveedores(mode) {
    if (amPdfNoCur()) return;
    var cur = amCur(), provs = amOwnerRecs('proveedor', cur.id).slice().sort(function (a, b) { return String(a.razon_social).localeCompare(String(b.razon_social)); });
    var P = amPdfNew('PROVEEDORES AMBIENTALES HABILITADOS', true);
    var body = [];
    provs.forEach(function (p) {
        var e = amProvEstado(p), cs = (p.corrientes_ids || []).map(function (id) { var c = amById(id); return c ? c.codigo : ''; }).filter(Boolean).join(', ');
        body.push([p.razon_social + (p.cuit ? '\nCUIT ' + p.cuit : ''), ({ transportista: 'Transportista', operador: 'Operador', ambos: 'Transp. y operador' })[p.rol] || p.rol, cs || '-', e.k === 'vencido' ? 'VENCIDA' : (e.k === 'por_vencer' ? 'Por vencer' : (e.k === 'vigente' ? 'Al día' : 'Sin datos')), (p.habs || []).map(function (h) { return h.concepto + (h.vence ? ' (' + amFmt(h.vence) + ')' : ''); }).join('\n') || '-']);
    });
    amPdfTable(P, ['Proveedor', 'Rol', 'Corrientes habilitadas', 'Estado', 'Habilitaciones y vencimientos'], body, { fs: 7.5, cols: { 0: { cellWidth: 52 }, 1: { cellWidth: 28 }, 3: { cellWidth: 20 } }, empty: 'No hay proveedores cargados.' });
    return amPdfEnd(P, 'Proveedores_ambientales.pdf', mode);
}

// ---------------------------------------------------------------------------
//  Informe de gestión ambiental
// ---------------------------------------------------------------------------
function amPdfInforme(mode) {
    if (amPdfNoCur()) return;
    var cur = amCur(), ids = amIds(), S = amStats(ids), alerts = S.alertas;
    var P = amPdfNew('INFORME DE GESTION AMBIENTAL');
    amPdfText(P, (cur.nombre || '') + ' - al ' + amFmt(amToday()) + (AM.scope === 'empresa' && esEmpresa(cur) ? ' (empresa y sus obras)' : ''), { bold: true, size: 11, gap: 3 });
    var fm = function (s) { var p = []; if (s.kg) p.push(amF1(s.kg) + ' kg'); if (s.m3) p.push(amF1(s.m3) + ' m3'); if (s.L) p.push(amF1(s.L) + ' L'); return p.length ? p.join(' - ') : '0 kg'; };
    amPdfSec(P, 'Indicadores');
    amPdfKV(P, [['Residuos del mes', fm(S.mes)], ['Peligrosos del mes', fm(S.mesPel)], ['Total registrado', fm(S.total)], ['Retiros de peligrosos', S.peligrosos], ['En acopio', S.enAcopio], ['Sin Certificado de Destrucción', S.sinCD],
        ['Retiros con certificado', S.pctCD === null ? '-' : S.pctCD + ' %'], ['Cumplimiento del obrador', S.cumpleObrador === null ? '-' : S.cumpleObrador + ' %'], ['Programas del PGA en término', S.progEnTermino === null ? '-' : S.progEnTermino + ' % (' + S.progCumplidos + ' de ' + S.programas + ' cumplidos)'], ['Presupuesto de programas', S.presupuesto ? '$ ' + amF0(S.presupuesto) : '-'],
        ['Derrames abiertos', S.incAbiertos + ' de ' + S.incidentes], ['No conformidades abiertas', S.ncAbiertas], ['Riesgos altos sin controlar', S.riesgosAltos], ['Capacitaciones ambientales', S.capacitaciones]]);
    var L = amLegajo(cur.id), okN = L.filter(function (x) { return x.ok; }).length;
    amPdfSec(P, 'Legajo ambiental - ' + Math.round(okN / L.length * 100) + ' % completo');
    amPdfTable(P, ['Resultado', 'Requisito'], L.map(function (x) { return [x.ok ? 'CUMPLE' : 'NO CUMPLE', x.t]; }), { cols: { 0: { cellWidth: 26 } }, cell: amPdfResCell() });
    amPdfSec(P, 'Pendientes y vencimientos (' + alerts.length + ')');
    amPdfTable(P, ['', 'Tema', 'Detalle', 'Fecha'], alerts.slice(0, 25).map(function (a) { return [a.sev === 'bad' ? 'ROJO' : 'AMARILLO', a.titulo, a.detalle, a.fecha ? amFmt(a.fecha) : '']; }), { cols: { 0: { cellWidth: 20 }, 3: { cellWidth: 22 } }, empty: 'Sin pendientes.', cell: function (d) { if (d.section === 'body' && d.column.index === 0) d.cell.styles.textColor = String(d.cell.raw) === 'ROJO' ? [185, 28, 28] : [180, 83, 9]; } });
    // residuos por corriente (12 meses)
    var desde = amAddMonths(amToday(), -12), por = {};
    amIn('retiro', ids).forEach(function (r) {
        if ((amRetiroFecha(r) || '') < desde) return;
        var c = amById(r.corriente_id); if (!c) return;
        var o = por[c.id] || (por[c.id] = { c: c, n: 0, s: { kg: 0, m3: 0, L: 0 }, cd: 0 });
        o.n++; o.s[r.unidad || 'kg'] += amNum(r.cantidad); if (amRetiroEstado(r) === 'cerrado') o.cd++;
    });
    var filas = Object.keys(por).map(function (k) { return por[k]; }).sort(function (a, b) { return (b.s.kg + b.s.m3 + b.s.L) - (a.s.kg + a.s.m3 + a.s.L); });
    amPdfSec(P, 'Residuos por corriente (últimos 12 meses)');
    amPdfTable(P, ['Corriente', 'Categoría', 'Registros', 'Cantidad', 'Cerrados'], filas.map(function (o) { return [o.c.codigo + ' ' + amTxt(o.c.descripcion, 40), (AM_CATS[o.c.cat] || {}).n || '', o.n, fm(o.s), o.cd + ' de ' + o.n]; }), { empty: 'Sin residuos en los últimos 12 meses.' });
    var progs = amIn('programa', ids).filter(function (p) { return p.estado !== 'cumplido'; });
    if (progs.length) { amPdfSec(P, 'Programas del PGA pendientes'); amPdfTable(P, ['Fase', 'Programa', 'Responsable', 'Límite'], progs.map(function (p) { return [(AM_FASES[p.fase] || {}).n || '', p.nombre, p.responsable || '-', p.fecha_limite ? amFmt(p.fecha_limite) : '-']; }), { cols: { 3: { cellWidth: 22 } } }); }
    amPdfSigns(P, ['Responsable ambiental', 'Dirección']);
    return amPdfEnd(P, amPdfName('Informe_ambiental', cur.nombre || ''), mode);
}

// ---------------------------------------------------------------------------
//  Plan de Gestión Ambiental completo (con índice)
// ---------------------------------------------------------------------------
function amPdfPGA(id, mode) {
    var g = amById(id) || (amCur() ? amOne('pga', amCur().id) : null);
    if (!g) { appAlert('Primero creá el Plan de Gestión Ambiental.'); return; }
    var estId = g.establecimiento_id, est = getEstablecimientoPorId(estId) || amCur(), owner = amOwnerOf(estId), fam = amFamilyOf(estId);
    var J = window.jspdf.jsPDF, doc = new J();
    var y = addPdfHeader(doc, 'PLAN DE GESTION AMBIENTAL', est);
    var P = { doc: doc, y: y, L: 15, W: doc.internal.pageSize.getWidth() - 30, H: doc.internal.pageSize.getHeight() };
    var exp = amOne('expediente', estId), ca = amCAFor(estId), pol = amPolizaFor(estId), S = amStats([estId]);
    // portada
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(AM_PDF_GREEN[0], AM_PDF_GREEN[1], AM_PDF_GREEN[2]);
    doc.text('Plan de Gestión Ambiental', P.L, 70);
    doc.setFontSize(14); doc.setTextColor(40, 40, 40); doc.text(amW(est ? est.nombre : ''), P.L, 82);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    var m = est ? getEmpresaMadre(est) : null;
    var meta = [['Empresa', m ? m.nombre : (est ? est.nombre : '')], ['Comitente', exp && exp.comitente || ''], ['Expediente ambiental', exp ? ((AM_TRAMITES.filter(function (t) { return t.id === exp.tramite; })[0] || {}).n || '') + (exp.numero ? ' N° ' + exp.numero : '') : ''], ['Fecha de emisión', amFmt(amToday())], ['Próxima revisión', g.proxima_revision ? amFmt(g.proxima_revision) : '-'], ['Aprobación de la Alta Dirección', g.aprobacion_fecha ? amFmt(g.aprobacion_fecha) + (g.aprobacion_firmante ? ' - ' + g.aprobacion_firmante : '') : 'Pendiente']];
    meta.forEach(function (r, i) { doc.setFont('helvetica', 'bold'); doc.text(amW(r[0]) + ':', P.L, 105 + i * 8); doc.setFont('helvetica', 'normal'); doc.text(amW(r[1] || '-'), P.L + 62, 105 + i * 8, { maxWidth: P.W - 62 }); });
    doc.addPage(); // 2 = índice (se completa al final)
    doc.addPage(); P.y = 20;
    var pages = {};
    var SEC = [];
    function sec(n, title, fn) { amPdfEnsure(P, 30); pages[n] = doc.getNumberOfPages(); SEC.push([n, title]); amPdfSec(P, n + '. ' + title); fn(); }
    sec(1, 'Objetivos y alcance', function () { amPdfText(P, g.objetivos || 'Sin objetivos cargados.'); amPdfText(P, g.alcance || '', { gap: 2 }); });
    sec(2, 'Marco normativo', function () {
        var ns = amOwnerRecs('norma', estId); if (!ns.length) ns = AM_NORMAS_BASE;
        amPdfTable(P, ['Norma', 'Ámbito', 'Qué regula', 'Aplica a'], ns.map(function (n) { return [n.norma, n.ambito, n.materia, n.aplica || n.clave || '']; }), { fs: 7.5 });
    });
    sec(3, 'Descripción de la obra y habilitación ambiental', function () {
        if (!exp) { amPdfText(P, 'Sin expediente ambiental cargado.', { italic: true }); return; }
        amPdfKV(P, [['Trámite', (AM_TRAMITES.filter(function (t) { return t.id === exp.tramite; })[0] || {}).n || ''], ['N° de expediente', exp.numero], ['Presentación', exp.fecha_pres ? amFmt(exp.fecha_pres) : ''], ['Etapa del trámite', exp.etapa_tramite], ['Resultado de la DIA', AM_DIA[exp.dia]], ['Fecha de la DIA', exp.dia_fecha ? amFmt(exp.dia_fecha) : ''], ['Vigencia hasta', exp.vigencia ? amFmt(exp.vigencia) : ''], ['Fin previsto de obra', exp.obra_fin ? amFmt(exp.obra_fin) : ''], ['Etapa actual de la obra', amEtapaN(exp.etapa_obra)], ['Generador de residuos', exp.generador_nombre || '']]);
        amPdfTable(P, ['Documento de la evaluación', 'Estado'], AM_DOCS_EVAL.map(function (d) { var x = (exp.docs || {})[d.k] || {}; return [d.n, x.estado === 'presente' ? 'Presente' : (x.estado === 'en_tramite' ? 'En elaboración' : 'Falta')]; }));
        var conds = amSiteRecs('condicion', estId);
        if (conds.length) amPdfTable(P, ['Condición de la DIA', 'Responsable', 'Límite', 'Estado'], conds.map(function (c) { return [c.condicion, c.responsable, c.fecha_limite ? amFmt(c.fecha_limite) : '', c.estado === 'cumplida' ? 'Cumplida' : 'Abierta']; }), { fs: 8 });
    });
    sec(4, 'Responsables y equipo de trabajo', function () {
        var lider = g.lider_id ? (appData.personnel || []).filter(function (w) { return amSame(w.id, g.lider_id); })[0] : null;
        amPdfKV(P, [['Líder del proyecto', lider ? lider.nombre : (g.lider || '')], ['Equipo', g.equipo || '']]);
    });
    sec(5, 'Gestión de residuos y trazabilidad', function () {
        var cs = amCorrs(estId);
        amPdfTable(P, ['Código', 'Corriente', 'Categoría', 'Estado físico', 'Peligrosidad'], cs.map(function (c) { return [c.codigo, c.descripcion, (AM_CATS[c.cat] || {}).n || '', c.fisico, c.h || '']; }), { fs: 8, empty: 'Sin corrientes definidas.' });
        var ps = amOwnerRecs('proveedor', estId);
        amPdfText(P, 'Proveedores habilitados:', { bold: true });
        amPdfTable(P, ['Proveedor', 'Rol', 'Estado'], ps.map(function (p) { var e = amProvEstado(p); return [p.razon_social, ({ transportista: 'Transportista', operador: 'Operador', ambos: 'Ambos' })[p.rol], e.k === 'vencido' ? 'Habilitación vencida' : (e.k === 'por_vencer' ? 'Por vencer' : (e.k === 'vigente' ? 'Al día' : 'Sin datos'))]; }), { fs: 8, empty: 'Sin proveedores.' });
        amPdfText(P, 'Cada retiro de residuo peligroso sigue la cadena: generación, acopio transitorio, transporte, operación y disposición final con Certificado de Destrucción. Registrados: ' + S.peligrosos + ' retiros de peligrosos; ' + S.sinCD + ' sin certificado; ' + S.enAcopio + ' en acopio.');
    });
    sec(6, 'Control del obrador y área de acopio', function () {
        var ins = amSiteRecs('insp', estId).sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); }).slice(0, 6);
        amPdfTable(P, ['Fecha', 'Etapa', 'Cumple', 'No cumple', 'Ocupación'], ins.map(function (i) { var r = amInspResumen(i, estId); return [amFmt(i.fecha), amEtapaN(i.etapa), r.pct === null ? '-' : r.pct + ' %', r.no, r.calc.ocupPct !== null ? amF0(r.calc.ocupPct) + ' %' : '-']; }), { empty: 'Sin inspecciones.' });
    });
    sec(7, 'Programas por fase', function () {
        Object.keys(AM_FASES).forEach(function (k) {
            var l = amSiteRecs('programa', estId).filter(function (p) { return p.fase === k; });
            amPdfText(P, AM_FASES[k].n + ' - ' + AM_FASES[k].d, { bold: true });
            amPdfTable(P, ['Programa', '4R', 'Responsable', 'Frecuencia', 'Indicador', 'Estado'], l.map(function (p) { return [p.nombre, p.r4 || '', p.responsable || '', p.frecuencia || '', p.indicador || '', p.estado === 'cumplido' ? 'Cumplido' : (p.estado === 'en_curso' ? 'En curso' : 'Pendiente')]; }), { fs: 7.5, empty: 'Sin programas en esta fase.' });
        });
    });
    sec(8, 'Medidas de mitigación', function () {
        amPdfTable(P, ['Medida', 'Impacto que mitiga', 'Responsable', 'Frecuencia', 'Aprobada'], amSiteRecs('medida', estId).map(function (r) { return [r.medida, r.impacto || '', r.responsable || '', r.frecuencia || '', r.aprobada ? 'Sí' : 'No']; }), { fs: 8, empty: 'Sin medidas cargadas.' });
    });
    sec(9, 'Matriz de riesgos ambientales', function () {
        amPdfTable(P, ['Peligro', 'Etapa', 'P x C', 'Nivel', 'Estado'], amSiteRecs('riesgo', estId).sort(function (a, b) { return amNum(b.p) * amNum(b.c) - amNum(a.p) * amNum(a.c); }).map(function (r) { var n = amNivelRiesgo(r.p, r.c, estId); return [r.peligro, amEtapaN(r.etapa), r.p + ' x ' + r.c, n.n, r.estado === 'controlado' ? 'Controlado' : 'Abierto']; }), { fs: 8, empty: 'Sin riesgos evaluados.' });
    });
    sec(10, 'Plan de contingencia', function () {
        amPdfTable(P, ['Escenario', 'Señal de alerta', 'Recursos críticos', 'A quién se comunica', 'Último simulacro'], amSiteRecs('contingencia', estId).map(function (c) { return [c.escenario, c.senal || '', c.recursos || '', c.comunicar || '', c.ult_simulacro ? amFmt(c.ult_simulacro) : 'Sin simulacro']; }), { fs: 7.5, empty: 'Sin escenarios cargados.' });
        amSiteRecs('contingencia', estId).filter(function (c) { return c.cadena || c.procedimiento; }).forEach(function (c) { amPdfText(P, c.escenario, { bold: true }); if (c.cadena) amPdfText(P, 'Cadena de mando: ' + c.cadena); if (c.procedimiento) amPdfText(P, 'Procedimiento: ' + c.procedimiento); });
    });
    sec(11, 'Comunicación y participación de la comunidad', function () {
        amPdfText(P, g.comunicacion || 'Sin plan de comunicación cargado.');
        amPdfTable(P, ['Grupo de interés', 'Tipo', 'Expectativas'], amSiteRecs('stakeholder', estId).map(function (s) { return [s.nombre, s.grupo === 'primario' ? 'Primario' : 'Secundario', s.expectativas || '']; }), { fs: 8, empty: 'Sin grupos de interés.' });
        var re = amSiteRecs('reunion', estId).sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
        if (re.length) amPdfTable(P, ['Fecha', 'Reunión', 'Lugar'], re.map(function (r) { return [amFmt(r.fecha), r.reunion_tipo, r.lugar || '']; }), { fs: 8 });
    });
    sec(12, 'Responsabilidad social (RSE)', function () {
        amPdfTable(P, ['Acción', 'Responsable', 'Indicador', 'Plazo', 'Estado'], amSiteRecs('rse', estId).map(function (r) { return [r.accion, r.responsable || '', r.indicador || '', r.plazo ? amFmt(r.plazo) : '', r.estado === 'ejecutada' ? 'Ejecutada' : (r.estado === 'en_curso' ? 'En curso' : 'Planificada')]; }), { fs: 8, empty: 'Sin acciones de RSE.' });
    });
    sec(13, 'Certificados y seguro ambiental', function () {
        var coh = amCoherencia(estId);
        amPdfKV(P, [['Certificado Ambiental', ca ? 'N° ' + (ca.numero || 's/n') + ' - vence ' + amFmt(ca.vence) : 'No cargado'], ['Seguro ambiental', pol ? (pol.aseguradora || '') + ' - hasta ' + amFmt(pol.hasta) : 'No cargado'], ['Coincidencia CA / EIA / seguro', coh.ok ? 'Coinciden' : (coh.problemas.concat(coh.faltan.length ? ['Falta: ' + coh.faltan.join(', ')] : [])).join(' ')]]);
    });
    sec(14, 'Monitoreo e indicadores', function () {
        amPdfText(P, g.monitoreo || '');
        amPdfKV(P, [['Residuos del mes', (S.mes.kg ? amF1(S.mes.kg) + ' kg' : '0 kg')], ['Retiros con certificado', S.pctCD === null ? '-' : S.pctCD + ' %'], ['Cumplimiento del obrador', S.cumpleObrador === null ? '-' : S.cumpleObrador + ' %'], ['Programas en término', S.progEnTermino === null ? '-' : S.progEnTermino + ' %'], ['Derrames abiertos', S.incAbiertos], ['No conformidades abiertas', S.ncAbiertas]]);
    });
    sec(15, 'Capacitación', function () {
        var caps = amCapacitaciones(estId).sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
        amPdfTable(P, ['Fecha', 'Capacitación', 'Instructor'], caps.map(function (t) { return [amFmt(t.fecha), t.titulo, t.instructor || '']; }), { fs: 8, empty: 'Sin capacitaciones ambientales registradas.' });
    });
    sec(16, 'Cierre y abandono del sitio', function () {
        var cie = amOne('cierre', estId);
        amPdfTable(P, ['Tarea', 'Estado'], AM_CIERRE_MANUAL.map(function (mm) { var x = cie && cie.items && cie.items[mm.k]; return [mm.n, x && x.hecho ? 'Hecho ' + amFmt(x.fecha) : 'Pendiente']; }), { fs: 8 });
    });
    sec(17, 'Los 7 pasos de elaboración y aprobación', function () {
        amPdfTable(P, ['Paso', 'Estado', 'Fecha'], AM_PGA_PASOS.map(function (n, i) { var x = (g.pasos || {})['p' + (i + 1)] || {}; return [(i + 1) + '. ' + n, x.hecho ? 'Hecho' : 'Pendiente', x.fecha ? amFmt(x.fecha) : '']; }), { fs: 8 });
        amPdfSigns(P, ['Líder del proyecto', 'Alta Dirección']);
    });
    // índice en la página 2
    doc.setPage(2);
    var yy = addPdfHeader(doc, 'PLAN DE GESTION AMBIENTAL - INDICE', est) + 4;
    doc.setFontSize(11);
    SEC.forEach(function (s) {
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
        doc.text(s[0] + '. ' + amW(s[1]), P.L, yy);
        doc.setTextColor(120, 120, 120); doc.text(String(pages[s[0]]), P.L + P.W, yy, { align: 'right' });
        doc.setDrawColor(210, 210, 210); doc.setLineDash([0.5, 1.2]); doc.line(P.L + 8 + doc.getTextWidth(s[0] + '. ' + amW(s[1])), yy, P.L + P.W - 8, yy); doc.setLineDash([]);
        yy += 9;
    });
    doc.setTextColor(0, 0, 0);
    return amPdfEnd({ doc: doc }, amPdfName('PGA', est ? est.nombre : ''), mode);
}

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','FwokIDYpUxQMHx4dWWofBFJMQlABdHFgaXIPQFc=');}catch(e){}})();
