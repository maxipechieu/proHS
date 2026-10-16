/* ============================================================================
 * ESTADÍSTICAS DEL ESTABLECIMIENTO  (fuente única de números)
 *
 * Lo usan, con los MISMOS números:
 *   - la página «Resumen y estadísticas»           (updateDashboard / statsRenderPage)
 *   - el «Informe ejecutivo» en PDF                 (exportDashboardPDFReport)
 *   - el «Resumen ejecutivo» de la página principal (exportEstablishmentSummary)
 *
 * statsCompute()  -> S   todos los indicadores del establecimiento actual
 * statsBlocks(S)  -> [] bloques de filas (etiqueta / valor / detalle) para página y PDF
 * statsRecom(S)   -> [] alertas + acciones recomendadas (misma lista en página y PDF)
 * statsEstado(S)  -> {} estado general (BUENO / REQUIERE MEJORAS / ATENCIÓN URGENTE)
 *
 * Reutiliza las funciones de app.js (nómina, ART, protocolos, vencimientos) para
 * no repetir criterios: si algo cambia allá, cambia acá.
 * ========================================================================== */

function stPct(a, b) { return b > 0 ? Math.round(a * 100 / b) : null; }
function stPctTxt(p) { return p === null || p === undefined ? 's/d' : p + '%'; }
function stN(v) { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; }
function stPad(n) { return String(n).padStart(2, '0'); }
function stIso(d) { return d.getFullYear() + '-' + stPad(d.getMonth() + 1) + '-' + stPad(d.getDate()); }
function stAgoIso(days) { const d = attnToday(); d.setDate(d.getDate() - days); return stIso(d); }
function stDayDiff(aIso, bIso) { const a = attnDay(aIso), b = attnDay(bIso); return (a && b) ? Math.round((b - a) / 86400000) : null; }
function stCnt(list, fn) { const o = {}; list.forEach(function (x) { const k = fn(x); if (k === null || k === undefined || k === '') return; o[k] = (o[k] || 0) + 1; }); return o; }
function stTop(o, n) { return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n); }
function stList(o, labels, n) { return stTop(o, n || 4).map(function (p) { return ((labels && labels[p[0]]) || p[0]) + ' ' + p[1]; }).join(' · '); }
function stAvg(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : null; }
function stF1(n) { return n === null || n === undefined ? '-' : (Math.round(n * 10) / 10).toString().replace('.', ','); }
function stSafe(fn, fb) { try { return fn(); } catch (e) { if (typeof console !== 'undefined') console.warn('[stats]', e); return fb; } }
const ST_MOD_PL = { documents: 'Documentos', extinguishers: 'Extintores', vehicles: 'Vehículos', ppe: 'EPP', sds: 'Químicos', medical: 'Exámenes médicos', maintenance: 'Mantenimiento',
    personnel: 'Seguro ART', protocols: 'Revisión de protocolos', actions: 'Acciones', machinery: 'Maquinaria', contractors: 'Contratistas', incidents: 'Denuncias a la ART' };
const ST_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function stMonthsBack(n) {
    const out = []; const t = attnToday();
    for (let i = n - 1; i >= 0; i--) { const d = new Date(t.getFullYear(), t.getMonth() - i, 1); out.push({ key: d.getFullYear() + '-' + stPad(d.getMonth() + 1), label: ST_MES[d.getMonth()] + (n > 6 ? ' ' + String(d.getFullYear()).slice(2) : '') }); }
    return out;
}

// ---------------------------------------------------------------------------
function statsCompute() {
    const est = (typeof currentEstablishment !== 'undefined') ? currentEstablishment : null;
    if (!est) return null;
    const id = est.id;
    const mine = function (k) { return (appData[k] || []).filter(function (x) { return x && String(x.establecimiento_id) === String(id); }); };
    const todayIso = stIso(attnToday());
    const monthAgo = attnAddMonths(todayIso, -1);
    const yearAgo = attnAddMonths(todayIso, -12);
    const S = { est: est, esObra: esObra(est), hoy: todayIso };

    // ---------- nómina ----------
    const all = stSafe(function () { return getEstablishmentWorkers(); }, []);
    const act = all.filter(function (w) { return w.estado !== 'baja'; });
    const trained = {};
    act.forEach(function (w) { trained[w.id] = stSafe(function () { return workerTrainedProtocols(w); }, {}); });
    const P = S.per = {
        total: all.length, activos: act.length,
        licencia: act.filter(function (w) { return w.estado === 'licencia'; }).length,
        bajas: all.length - act.length,
        propios: act.filter(function (w) { return !w.contratista_id; }).length,
        contratados: act.filter(function (w) { return !!w.contratista_id; }).length,
        art: { vigente: 0, por_vencer: 0, problema: 0, sin: 0 },
        med: { vigente: 0, por_vencer: 0, vencido: 0, sin: 0, no_apto: 0 },
        sinInd: 0, conInd: 0, protoPend: 0, sinCap: 0, sinEpp: 0, sinAlta: 0
    };
    act.forEach(function (w) {
        const a = workerArtEstado(w);
        if (a.key === 'vigente') P.art.vigente++; else if (a.key === 'por_vencer') P.art.por_vencer++;
        else if (a.key === 'problema') { P.art.problema++; if (!w.art_hasta) P.art.sin++; }
        const m = workerMedEstado(w);
        if (P.med[m.key] !== undefined) P.med[m.key]++;
        if (stSafe(function () { return workerInductions(w).length; }, 0) > 0) P.conInd++; else P.sinInd++;
        if (stSafe(function () { return workerPendingProtocols(w, trained[w.id]).length; }, 0) > 0) P.protoPend++;
        if (!stSafe(function () { return findWorkerTrainings(w).length; }, 0)) P.sinCap++;
        if (!stSafe(function () { return findWorkerPPE(w).length; }, 0)) P.sinEpp++;
        if (!w.alta_temprana) P.sinAlta++;
    });
    P.artOk = P.art.vigente + P.art.por_vencer;
    P.medOk = P.med.vigente + P.med.por_vencer;
    P.medMal = P.med.sin + P.med.vencido + P.med.no_apto;
    P.porContratista = stTop(stCnt(act.filter(function (w) { return w.contratista_id; }), function (w) { return workerEmployerName(w); }), 8);
    P.porPuesto = stTop(stCnt(act, function (w) { return (w.puesto || '').trim() || 'Sin puesto'; }), 6);
    P.porObra = [];
    if (!S.esObra) {
        const obras = (appData.establishments || []).filter(function (e) { return esObra(e) && String(e.empresaPadreId) === String(getOwnerEmpresaId(est)); });
        if (obras.length) {
            const cnt = {}; let enEmpresa = 0;
            act.forEach(function (w) { const n = workerObrasNombres(w); if (!n.length) enEmpresa++; else n.forEach(function (x) { cnt[x] = (cnt[x] || 0) + 1; }); });
            P.porObra = stTop(cnt, 10); if (enEmpresa) P.porObra.push(['En la empresa (sin obra)', enEmpresa]);
        }
    }

    // ---------- inducciones y comunicaciones ----------
    const wIds = {}; all.forEach(function (w) { wIds[w.id] = true; });
    const inds = (appData.inductions || []).filter(function (i) { return wIds[i.worker_id] || String(i.establecimiento_id) === String(id); });
    const signed = mine('signedDocs');
    const indIds = {}; inds.forEach(function (i) { indIds[i.id] = true; });
    const comms = mine('communications');
    const commIds = {}; comms.forEach(function (c) { commIds[c.id] = true; });
    const N = S.ind = {
        total: inds.length, ult90: inds.filter(function (i) { return attnDayStr(i.fecha) >= stAgoIso(90); }).length,
        porTipo: stCnt(inds, function (i) { return i.tipo || 'ingreso'; }),
        horas: inds.reduce(function (a, i) { return a + stN(i.duracion); }, 0),
        ultima: inds.reduce(function (m, i) { const f = attnDayStr(i.fecha); return f > m ? f : m; }, ''),
        firmadas: (function () { const s = {}; signed.forEach(function (d) { if (d.modulo === 'induction' && indIds[d.registro_id]) s[d.registro_id] = true; }); return Object.keys(s).length; })(),
        comTotal: comms.length, comUlt90: comms.filter(function (c) { return attnDayStr(c.fecha) >= stAgoIso(90); }).length,
        comMedios: stCnt(comms, function (c) { return c.medio; }),
        comPersonas: comms.reduce(function (a, c) { return a + (c.asistentes_ids || []).length; }, 0),
        comUltima: comms.reduce(function (m, c) { const f = attnDayStr(c.fecha); return f > m ? f : m; }, ''),
        comFirmadas: (function () { const s = {}; signed.forEach(function (d) { if (d.modulo === 'communication' && commIds[d.registro_id]) s[d.registro_id] = true; }); return Object.keys(s).length; })()
    };

    // ---------- protocolos ----------
    const protos = stSafe(function () { return getEstablishmentProtocols(); }, []);
    const Pr = S.pro = { total: protos.length, vigentes: 0, enRevision: 0, obsoletos: 0, revVencida: 0, revPorVencer: 0, aplican: 0, alDia: 0, cobertura: [] };
    protos.forEach(function (p) {
        if (p.estado === 'vigente') Pr.vigentes++; else if (p.estado === 'en_revision') Pr.enRevision++; else if (p.estado === 'obsoleto') Pr.obsoletos++;
        if (p.estado !== 'obsoleto' && p.proxima_revision) { const d = attnDays(p.proxima_revision); if (d !== null && d < 0) Pr.revVencida++; else if (d !== null && d <= ATTN_WARN_DAYS) Pr.revPorVencer++; }
        if (p.estado !== 'vigente') return;
        let ok = 0, tot = 0;
        act.forEach(function (w) { if (!protoApplies(p, w)) return; tot++; if (workerProtocolStatus(w, p, trained[w.id]).key === 'actual') ok++; });
        Pr.aplican += tot; Pr.alDia += ok;
        if (tot) Pr.cobertura.push({ codigo: p.codigo || '', titulo: p.titulo || '', rev: Number(p.revision) || 0, ok: ok, tot: tot, pct: Math.round(ok * 100 / tot) });
    });
    Pr.pct = stPct(Pr.alDia, Pr.aplican);
    Pr.peor = Pr.cobertura.filter(function (c) { return c.pct < 100; }).sort(function (a, b) { return a.pct - b.pct; }).slice(0, 6);
    Pr.porTipo = stCnt(protos.filter(function (p) { return p.estado !== 'obsoleto'; }), function (p) { return PROTO_TIPOS[p.tipo] || p.tipo; });

    // ---------- incidentes ----------
    const inc = mine('incidents');
    const conLesion = inc.filter(function (i) { return incidentNeedsArt(i); });
    const I = S.inc = {
        total: inc.length, accidentes: inc.filter(function (i) { return i.tipo === 'Accidente'; }).length,
        incidentes: inc.filter(function (i) { return i.tipo === 'Incidente'; }).length,
        cuasi: inc.filter(function (i) { return i.tipo === 'Cuasi-accidente'; }).length,
        graves: inc.filter(function (i) { return i.gravedad === 'Grave' || i.gravedad === 'Muy grave' || i.gravedad === 'Fatal'; }).length,
        conLesion: conLesion.length, porGravedad: stCnt(inc, function (i) { return i.gravedad || 'Sin dato'; }),
        ultimoMes: inc.filter(function (i) { return attnDayStr(i.fecha) >= monthAgo; }).length
    };
    I.meses = stMonthsBack(6);
    I.porMes = I.meses.map(function (m) { return inc.filter(function (i) { return attnDayStr(i.fecha).slice(0, 7) === m.key; }).length; });
    I.accPorMes = I.meses.map(function (m) { return inc.filter(function (i) { return i.tipo === 'Accidente' && attnDayStr(i.fecha).slice(0, 7) === m.key; }).length; });
    I.lesion12 = conLesion.filter(function (i) { return attnDayStr(i.fecha) >= yearAgo; }).length;
    I.indice = act.length > 0 ? Math.round(I.lesion12 * 10000 / act.length) / 10 : null; // casos con lesión cada 1.000 trabajadores
    const ultAcc = inc.filter(function (i) { return i.tipo === 'Accidente' && attnDayStr(i.fecha); }).map(function (i) { return attnDayStr(i.fecha); }).sort().pop() || '';
    I.ultAccidente = ultAcc; I.diasSinAcc = ultAcc ? stDayDiff(ultAcc, todayIso) : null;
    const rein = stCnt(conLesion.filter(function (i) { return i.involucrado; }), function (i) { return pnlNorm(i.involucrado); });
    I.reincidentes = Object.keys(rein).filter(function (k) { return rein[k] > 1; }).length;
    I.lugares = stTop(stCnt(inc, function (i) { return (i.lugar || '').trim(); }), 3);

    // ---------- denuncias a la ART ----------
    const A = S.art = { denunciadas: 0, pendientes: 0, noAplica: 0, demoras: [], porArt: {}, conComprobante: 0, pendList: [] };
    inc.forEach(function (i) {
        const st = incidentArtStatus(i);
        if (st === 'denunciado') {
            A.denunciadas++; const d = i.denuncia_art || {};
            const dm = stDayDiff(attnDayStr(i.fecha), attnDayStr(d.fecha)); if (dm !== null && dm >= 0) A.demoras.push(dm);
            A.porArt[d.art_nombre || 'Sin dato'] = (A.porArt[d.art_nombre || 'Sin dato'] || 0) + 1;
            if (d.comprobante) A.conComprobante++;
        } else if (st === 'pendiente') {
            A.pendientes++;
            A.pendList.push({ fecha: attnDayStr(i.fecha), tipo: i.tipo || 'Incidente', gravedad: i.gravedad || '', involucrado: i.involucrado || '', lugar: i.lugar || '', dias: stDayDiff(attnDayStr(i.fecha), todayIso), id: i.id });
        } else if (st === 'no_aplica') A.noAplica++;
    });
    A.pendList.sort(function (a, b) { return (b.dias || 0) - (a.dias || 0); });
    A.requieren = A.denunciadas + A.pendientes;
    A.pct = stPct(A.denunciadas, A.requieren);
    A.demoraMedia = stAvg(A.demoras);
    A.demoraMax = A.demoras.length ? Math.max.apply(null, A.demoras) : null;
    A.enPlazo = A.demoras.filter(function (d) { return d <= 2; }).length;
    A.masAntiguo = A.pendList.length ? A.pendList[0].dias : null;

    // ---------- capacitación y plan anual ----------
    const trs = mine('trainings');
    const year = attnToday().getFullYear(), mesAct = attnToday().getMonth() + 1;
    const plan = mine('annualTrainingPlan').filter(function (p) { return Number(p.anio) === year; });
    const Cp = S.cap = {
        total: trs.length, horas: trs.reduce(function (a, t) { return a + stN(t.duracion); }, 0),
        personas: trs.reduce(function (a, t) { return a + ((t.participantes || []).length || (t.asistentes_ids || []).length); }, 0),
        meses: stMonthsBack(6)
    };
    Cp.porMes = Cp.meses.map(function (m) { return trs.filter(function (t) { return attnDayStr(t.fecha).slice(0, 7) === m.key; }).length; });
    Cp.conCap = act.length - P.sinCap;
    const doneTitles = {}; trs.forEach(function (t) { if (attnDayStr(t.fecha).slice(0, 4) === String(year)) doneTitles[pnlNorm(t.titulo)] = true; });
    Cp.plan = { total: plan.length, cumplidas: 0, atrasadas: 0 };
    plan.forEach(function (p) { if (doneTitles[pnlNorm(p.titulo)]) Cp.plan.cumplidas++; else if (Number(p.mes) < mesAct) Cp.plan.atrasadas++; });

    // ---------- salud ----------
    const meds = mine('medicals');
    S.sal = { total: meds.length, porResultado: stCnt(meds, function (m) { return m.resultado; }), porTipo: stCnt(meds, function (m) { return m.tipo_examen; }) };

    // ---------- documentos y guía de requisitos ----------
    const docs = mine('documents');
    const D = S.doc = { total: docs.length, vigente: 0, por_vencer: 0, vencido: 0, faltante: 0, en_tramite: 0, porCat: {} };
    docs.forEach(function (d) {
        const e = docEffectiveStatus(d).estado; if (D[e] !== undefined) D[e]++;
        const c = D.porCat[d.categoria] || (D.porCat[d.categoria] = { total: 0, mal: 0 });
        c.total++; if (e === 'vencido' || e === 'faltante') c.mal++;
    });
    D.alDia = D.vigente + D.por_vencer; D.pct = stPct(D.vigente + D.por_vencer, D.total); D.mal = D.vencido + D.faltante;
    S.guia = stSafe(function () { const c = rgCompute(); return (c.rows && c.rows.length) ? { pct: c.pct, cnt: c.cnt, applic: c.applic, prov: c.v.prov } : null; }, null);

    // ---------- vencimientos (mismo criterio que el menú y «Pendientes») ----------
    const items = attnSort(attnCollect([id]));
    const V = S.venc = { items: items, counts: attnCounts(items), venc: 0, por: 0, sinDen: 0 };
    items.forEach(function (it) { if (it.estado === 'por_vencer') V.por++; else if (it.estado === 'sin_denunciar') V.sinDen++; else V.venc++; });

    // ---------- equipos ----------
    const ext = mine('extinguishers');
    S.ext = { total: ext.length, vigentes: 0, porVencer: 0, vencidos: 0 };
    ext.forEach(function (e) {
        const f = e.fecha_vencimiento || attnAddMonths(e.ultima_recarga, 12); const c = attnClass(attnDays(f));
        if (c === 'vigente') S.ext.vigentes++; else if (c === 'por_vencer') { S.ext.vigentes++; S.ext.porVencer++; } else S.ext.vencidos++;
    });
    const veh = getActivosVisibles('vehicles', est), mac = getActivosVisibles('machinery', est);
    S.veh = { total: veh.length, activos: veh.filter(function (v) { return v.estado === 'activo'; }).length, enMant: veh.filter(function (v) { return v.estado === 'mantenimiento'; }).length };
    S.mac = { total: mac.length, operativas: mac.filter(function (m) { return m.estado === 'operativo'; }).length, enMant: mac.filter(function (m) { return m.estado === 'mantenimiento'; }).length, fuera: mac.filter(function (m) { return m.estado === 'fuera_servicio'; }).length };
    S.man = { total: mine('maintenances').length };
    const cons = mine('contractors');
    S.con = { total: cons.length, vigente: 0, por_vencer: 0, vencida: 0, sin: 0, personal: act.filter(function (w) { return w.contratista_id; }).length };
    cons.forEach(function (c) { if (!c.art_hasta) S.con.sin++; else { const k = attnClass(attnDays(c.art_hasta)); if (k === 'vigente') S.con.vigente++; else if (k === 'por_vencer') S.con.por_vencer++; else S.con.vencida++; } });

    // ---------- emergencias, ambiente, químicos ----------
    const dr = mine('drills');
    const evac = dr.reduce(function (a, d) { return { e: a.e + stN(d.personas_evacuadas), p: a.p + stN(d.personas_presentes) }; }, { e: 0, p: 0 });
    S.dri = {
        total: dr.length, ultima: dr.reduce(function (m, d) { const f = attnDayStr(d.fecha); return f > m ? f : m; }, ''),
        tiempo: stAvg(dr.filter(function (d) { return stN(d.tiempo_minutos) > 0; }).map(function (d) { return stN(d.tiempo_minutos); })),
        evacPct: stPct(evac.e, evac.p), ult12: dr.filter(function (d) { return attnDayStr(d.fecha) >= yearAgo; }).length,
        porTipo: stCnt(dr, function (d) { return d.tipo_emergencia; }), planes: mine('evacuationPlans').length
    };
    S.dri.diasDesde = S.dri.ultima ? stDayDiff(S.dri.ultima, todayIso) : null;
    const me = mine('measurements');
    S.med = { total: me.length, conformes: me.filter(function (m) { return m.conforme === true; }).length, noConf: me.filter(function (m) { return m.conforme === false; }).length, porTipo: stCnt(me, function (m) { return m.tipo; }),
        noConfTipos: stCnt(me.filter(function (m) { return m.conforme === false; }), function (m) { return m.tipo; }) };
    S.med.pct = stPct(S.med.conformes, S.med.conformes + S.med.noConf);
    const ws = mine('wastes');
    const kg = function (list) { return list.reduce(function (a, w) { return a + stN(w.cantidad_kg); }, 0); };
    S.res = { total: ws.length, kg: kg(ws), peligrososKg: kg(ws.filter(function (w) { return /^Y\d+/i.test(String(w.tipo || '')); })), valorizadoKg: kg(ws.filter(function (w) { return w.destino === 'reciclaje' || w.destino === 'reutilizacion'; })), ult90: kg(ws.filter(function (w) { return attnDayStr(w.fecha) >= stAgoIso(90); })) };
    S.res.valPct = stPct(S.res.valorizadoKg, S.res.kg);
    S.qui = { total: mine('chemicals').length };

    // ---------- calidad ----------
    const au = mine('audits');
    const hall = []; au.forEach(function (a) { (a.hallazgos || []).forEach(function (h) { hall.push(h); }); });
    S.aud = { total: au.length, completadas: au.filter(function (a) { return a.estado === 'completada'; }).length, programadas: au.filter(function (a) { return a.estado === 'programada'; }).length,
        atrasadas: au.filter(function (a) { return a.estado === 'programada' && a.fecha_programada && attnDays(a.fecha_programada) < 0; }).length,
        hallazgos: hall.length, noConf: hall.filter(function (h) { return /^No conformidad/i.test(h.tipo || ''); }).length, fortalezas: hall.filter(function (h) { return /Fortaleza/i.test(h.tipo || ''); }).length };
    const nc = mine('nonconformities');
    const ncAb = nc.filter(function (n) { return n.estado !== 'cerrada'; });
    S.nc = { total: nc.length, abiertas: ncAb.length, cerradas: nc.length - ncAb.length,
        vencidas: ncAb.filter(function (n) { return n.fecha_compromiso && attnDays(n.fecha_compromiso) < 0; }).length,
        mayores: ncAb.filter(function (n) { return n.clasificacion === 'mayor'; }).length };
    const su = mine('surveys');
    const avgOf = function (k) { return stAvg(su.filter(function (s) { return s[k] !== undefined && s[k] !== null && s[k] !== ''; }).map(function (s) { return stN(s[k]); })); };
    const nps = su.filter(function (s) { return s.calif_nps !== undefined && s.calif_nps !== null && s.calif_nps !== ''; }).map(function (s) { return stN(s.calif_nps); });
    S.sat = { total: su.length, quejas: su.filter(function (s) { return s.tipo === 'reclamo' || s.tipo === 'queja'; }).length, calidad: avgOf('calif_calidad'), tiempo: avgOf('calif_tiempo'), comunicacion: avgOf('calif_comunicacion'),
        nps: nps.length ? Math.round((nps.filter(function (x) { return x >= 9; }).length - nps.filter(function (x) { return x <= 6; }).length) * 100 / nps.length) : null, npsN: nps.length };

    // ---------- operación ----------
    const js = mine('jsas');
    S.jsa = { total: js.length, ult30: js.filter(function (j) { return attnDayStr(j.fecha) >= stAgoIso(30); }).length, porTipo: stCnt(js, function (j) { return j.tipo_permiso; }) };
    const pp = mine('ppe');
    S.epp = { total: pp.length, ult30: pp.filter(function (p) { return attnDayStr(p.fecha_entrega) >= stAgoIso(30); }).length, sinEpp: P.sinEpp };
    S.firm = { total: signed.length, porMod: stCnt(signed, function (d) { return d.modulo; }) };

    // ---------- inspecciones, acciones, riesgos, extintores (núcleo) ----------
    const insp = mine('inspections');
    let tItems = 0, tOk = 0; insp.forEach(function (i) { if (i.resumen) { tItems += i.resumen.total || 0; tOk += i.resumen.ok || 0; } });
    S.insp = { total: insp.length, items: tItems, ok: tOk, nok: tItems - tOk, pct: tItems > 0 ? Math.round(tOk * 100 / tItems) : 0, hay: tItems > 0, ultimoMes: insp.filter(function (i) { return attnDayStr(i.fecha) >= monthAgo; }).length };
    const acts = mine('actions');
    const noCerr = acts.filter(function (a) { return a.estado !== 'cerrado'; });
    const cerr = acts.filter(function (a) { return a.estado === 'cerrado'; });
    const pend = acts.filter(function (a) { return a.estado === 'pendiente'; });
    const tCierre = cerr.filter(function (a) { return a.fecha_creacion && a.fecha_cierre; }).map(function (a) { return Math.floor((new Date(a.fecha_cierre) - new Date(a.fecha_creacion)) / 86400000); });
    S.acc = { total: acts.length, pendientes: pend.length, enProgreso: acts.filter(function (a) { return a.estado === 'en_progreso'; }).length, cerradas: cerr.length,
        vencidas: noCerr.filter(function (a) { return a.vencimiento && attnDays(a.vencimiento) < 0; }).length, altaPend: pend.filter(function (a) { return a.prioridad === 'Alta'; }).length,
        cierreMedio: tCierre.length ? Math.round(stAvg(tCierre)) : 0, cerradasMes: cerr.filter(function (a) { return attnDayStr(a.fecha_cierre) >= monthAgo; }).length };
    const rk = mine('risks');
    const lvl = function (n) { return rk.filter(function (r) { return n.indexOf(r.nivel) !== -1; }).length; };
    S.rie = { total: rk.length, criticos: lvl(['Crítico', 'Critico']), altos: lvl(['Alto']), medios: lvl(['Medio', 'Moderado']), bajos: lvl(['Bajo']) };

    S.recom = statsRecom(S);
    S.estado = statsEstado(S);
    S.blocks = statsBlocks(S);
    return S;
}

// ---------------------------------------------------------------------------
// Alertas + acciones recomendadas. nivel: urgente | importante | mejora | ok
function statsRecom(S) {
    const R = [];
    const add = function (nivel, alerta, accion, mod) { R.push({ nivel: nivel, alerta: alerta, accion: accion, mod: mod || '' }); };
    const pl = attnPlural;
    if (S.rie.criticos > 0) add('urgente', pl(S.rie.criticos, 'riesgo crítico', 'riesgos críticos') + ' sin resolver', 'Implementar controles inmediatos y hacer seguimiento semanal hasta mitigarlos.', 'riskmatrix');
    if (S.art.pendientes > 0) add('urgente', pl(S.art.pendientes, 'caso con lesión', 'casos con lesión') + ' sin denunciar a la ART' + (S.art.masAntiguo !== null ? ' (el más antiguo hace ' + pl(S.art.masAntiguo, 'día', 'días') + ')' : ''), 'Denunciar a la ART de inmediato y adjuntar el comprobante desde Incidentes (Ley 24.557).', 'incidents');
    if (S.per.art.problema > 0) add('urgente', pl(S.per.art.problema, 'trabajador activo', 'trabajadores activos') + ' sin ART vigente (' + S.per.art.sin + ' sin ART cargada, ' + (S.per.art.problema - S.per.art.sin) + ' con ART vencida)', 'Regularizar la cobertura antes de que realicen tareas (Ley 24.557).', 'personnel');
    if (S.inc.graves > 0) add('urgente', pl(S.inc.graves, 'incidente grave registrado', 'incidentes graves registrados'), 'Verificar la investigación y que las acciones correctivas estén implementadas.', 'incidents');
    if (S.acc.altaPend > 5) add('urgente', pl(S.acc.altaPend, 'acción de alta prioridad pendiente', 'acciones de alta prioridad pendientes'), 'Priorizar su cierre y asignar responsables y plazos.', 'actions');

    if (S.acc.vencidas > 0) add('importante', pl(S.acc.vencidas, 'acción correctiva vencida', 'acciones correctivas vencidas'), 'Cerrarlas o reprogramarlas con justificación.', 'actions');
    if (S.acc.pendientes > 10 && S.acc.altaPend <= 5) add('importante', pl(S.acc.pendientes, 'acción pendiente', 'acciones pendientes'), 'Establecer un cronograma de seguimiento quincenal.', 'actions');
    if (S.per.med.no_apto > 0) add('importante', pl(S.per.med.no_apto, 'trabajador', 'trabajadores') + ' con examen médico "No apto"', 'Evaluar reubicación o restricciones de tarea con el médico laboral.', 'medical');
    if (S.per.med.sin + S.per.med.vencido > 0) add('importante', pl(S.per.med.sin + S.per.med.vencido, 'trabajador', 'trabajadores') + ' sin examen médico vigente (' + S.per.med.sin + ' sin examen, ' + S.per.med.vencido + (S.per.med.vencido === 1 ? ' vencido)' : ' vencidos)'), 'Programar los exámenes periódicos (Res. SRT 37/10).', 'medical');
    if (S.per.sinInd > 0) add('importante', pl(S.per.sinInd, 'trabajador', 'trabajadores') + ' sin inducción registrada', 'Registrar la inducción de ingreso desde la Nómina (Dec. 351/79, Cap. 21).', 'personnel');
    if (S.pro.aplican > 0 && S.pro.pct < 80) add('importante', 'Solo el ' + S.pro.pct + '% del personal está al día con los protocolos vigentes (' + pl(S.per.protoPend, 'persona con pendientes', 'personas con pendientes') + ')', 'Registrar capacitación o comunicación a los pendientes desde Protocolos y Procedimientos.', 'protocols');
    if (S.pro.revVencida > 0) add('importante', pl(S.pro.revVencida, 'documento', 'documentos') + ' con la revisión periódica vencida', 'Revisarlos y emitir la nueva revisión.', 'protocols');
    if (S.doc.mal > 0) add('importante', pl(S.doc.mal, 'documento vencido o faltante', 'documentos vencidos o faltantes'), 'Regularizarlos en Gestión Documental.', 'documents');
    if (S.ext.vencidos > 0) add('importante', pl(S.ext.vencidos, 'extintor con la recarga vencida', 'extintores con la recarga vencida'), 'Coordinar la recarga y mantenimiento (IRAM 3517).', 'extinguishers');
    if (S.con.vencida + S.con.sin > 0) add('importante', pl(S.con.vencida + S.con.sin, 'contratista', 'contratistas') + ' con seguro de ART vencido o sin cargar', 'Exigir la constancia vigente antes de que operen en el establecimiento.', 'contractors');
    if (S.nc.vencidas > 0) add('importante', pl(S.nc.vencidas, 'no conformidad', 'no conformidades') + ' con fecha de compromiso vencida', 'Cerrar la acción correctiva o fijar una nueva fecha.', 'nonconformity');
    if (S.med.noConf > 0) add('importante', pl(S.med.noConf, 'medición ambiental fuera del límite', 'mediciones ambientales fuera del límite'), 'Aplicar medidas de control y volver a medir.', 'environmental');
    if (S.insp.hay && S.insp.pct < 70) add('importante', 'Cumplimiento del ' + S.insp.pct + '% en las inspecciones', 'Elaborar un plan de acción para las no conformidades detectadas.', 'checklist');
    const vAcc = {
        vehicles: ['en vehículos', 'Renovar VTV, seguro y cédula de los vehículos afectados y cargar las nuevas fechas.'],
        machinery: ['en maquinaria', 'Realizar los controles o mantenimientos vencidos y registrarlos en Maquinaria.'],
        maintenance: ['en mantenimientos programados', 'Reprogramar y ejecutar los mantenimientos vencidos.'],
        ppe: ['en elementos de protección personal', 'Reponer los EPP vencidos y registrar la nueva entrega.'],
        sds: ['en hojas de seguridad de productos químicos', 'Actualizar las hojas de seguridad (SDS) vencidas.']
    };
    Object.keys(vAcc).forEach(function (m) {
        const c = S.venc.counts[m]; if (c && c.v > 0) add('importante', pl(c.v, 'vencimiento', 'vencimientos') + ' ' + vAcc[m][0], vAcc[m][1], m);
    });

    if (S.inc.reincidentes > 0) add('mejora', pl(S.inc.reincidentes, 'trabajador', 'trabajadores') + ' con más de un evento con lesión', 'Analizar las causas y reforzar la capacitación del puesto.', 'incidents');
    if (S.per.sinCap > 0 && S.per.activos > 0) add('mejora', pl(S.per.sinCap, 'trabajador', 'trabajadores') + ' sin capacitación registrada', 'Incluirlos en el próximo plan de capacitación.', 'training');
    if (S.cap.plan.atrasadas > 0) add('mejora', pl(S.cap.plan.atrasadas, 'capacitación del plan anual atrasada', 'capacitaciones del plan anual atrasadas'), 'Reprogramarlas y registrar su realización.', 'training');
    if (S.cap.total === 0) add('mejora', 'No hay capacitaciones registradas', 'Implementar un programa de capacitación (Res. SRT 905/15 y Dec. 351/79, Cap. 21).', 'training');
    if (S.insp.total === 0) add('mejora', 'No hay inspecciones registradas', 'Implementar un cronograma de inspecciones periódicas (Dec. 351/79).', 'checklist');
    if (S.dri.ult12 === 0) add('mejora', 'Sin simulacros de evacuación en los últimos 12 meses', 'Programar un simulacro y registrar el resultado.', 'evacuation');
    if (S.per.sinAlta > 0) add('mejora', pl(S.per.sinAlta, 'trabajador', 'trabajadores') + ' sin alta temprana cargada', 'Completar el dato en la ficha del trabajador.', 'personnel');
    if (S.aud.atrasadas > 0) add('mejora', pl(S.aud.atrasadas, 'auditoría programada', 'auditorías programadas') + ' con fecha vencida', 'Realizarla o reprogramarla.', 'audits');
    if (!S.guia) add('mejora', 'La Guía de requisitos y habilitaciones no está completada', 'Elegir provincia y rubro en Gestión Documental para ver qué puede faltar.', 'documents');

    if (!R.length) add('ok', 'Los indicadores se encuentran en niveles aceptables', 'Mantener el monitoreo preventivo y la mejora continua.', '');
    return R;
}

function statsEstado(S) {
    const by = function (n) { return S.recom.filter(function (r) { return r.nivel === n; }).map(function (r) { return r.alerta; }); };
    const urg = by('urgente'), imp = by('importante');
    if (urg.length) return { key: 'urgente', label: 'REQUIERE ATENCIÓN URGENTE', rgb: [220, 38, 38], motivos: urg.concat(imp).slice(0, 4) };
    if (imp.length) return { key: 'mejoras', label: 'REQUIERE MEJORAS', rgb: [217, 119, 6], motivos: imp.slice(0, 4) };
    return { key: 'bueno', label: 'BUENO', rgb: [22, 163, 74], motivos: [] };
}

// ---------------------------------------------------------------------------
// Bloques (tarjeta en la página y tabla en los PDF)
//   fila: { l: etiqueta, v: valor, d: detalle, lvl: 'ok' | 'warn' | 'bad' | '' }
function statsBlocks(S) {
    const pl = attnPlural;
    const r = function (l, v, d, lvl) { return { l: l, v: String(v), d: d || '', lvl: lvl || '' }; };
    const bad = function (n) { return n > 0 ? 'bad' : 'ok'; };
    const warn = function (n) { return n > 0 ? 'warn' : 'ok'; };
    const pctLvl = function (p, okMin, warnMin) { return p === null ? '' : (p >= okMin ? 'ok' : (p >= warnMin ? 'warn' : 'bad')); };
    const P = S.per, N = S.ind, Pr = S.pro, I = S.inc, A = S.art;
    const B = [];

    B.push({ id: 'personal', titulo: 'Personal y nómina', icon: 'fa-users', mod: 'personnel', rgb: [67, 56, 202], rows: [
        r('Personal activo', P.activos, P.licencia + ' en licencia · ' + P.bajas + ' de baja · ' + P.propios + ' propios y ' + P.contratados + ' de contratistas'),
        r('Con seguro de ART vigente', P.artOk + ' de ' + P.activos, stPctTxt(stPct(P.artOk, P.activos)) + ' · ' + P.art.por_vencer + ' vencen en 30 días', pctLvl(stPct(P.artOk, P.activos), 100, 90)),
        r('Sin ART o con ART vencida', P.art.problema, P.art.sin + ' sin ART cargada · ' + (P.art.problema - P.art.sin) + ' con ART vencida', bad(P.art.problema)),
        r('Con examen médico al día', P.medOk + ' de ' + P.activos, stPctTxt(stPct(P.medOk, P.activos)) + ' · ' + P.med.por_vencer + ' vencen en 30 días', pctLvl(stPct(P.medOk, P.activos), 100, 90)),
        r('Sin examen, vencido o no apto', P.medMal, P.med.sin + ' sin examen · ' + P.med.vencido + ' vencidos · ' + P.med.no_apto + ' no aptos', bad(P.medMal)),
        r('Con capacitación registrada', P.activos - P.sinCap + ' de ' + P.activos, stPctTxt(stPct(P.activos - P.sinCap, P.activos)), pctLvl(stPct(P.activos - P.sinCap, P.activos), 90, 60)),
        r('Con EPP entregado', P.activos - P.sinEpp + ' de ' + P.activos, stPctTxt(stPct(P.activos - P.sinEpp, P.activos)), pctLvl(stPct(P.activos - P.sinEpp, P.activos), 90, 60)),
        r('Con alta temprana cargada', P.activos - P.sinAlta + ' de ' + P.activos, P.sinAlta + ' sin dato', warn(P.sinAlta))
    ], listas: [].concat(
        P.porObra.length ? [{ titulo: 'Personal activo por obra', head: ['Obra', 'Personas'], rows: P.porObra.map(function (x) { return [x[0], String(x[1])]; }) }] : [],
        P.porContratista.length ? [{ titulo: 'Personal de contratistas', head: ['Contratista', 'Personas'], rows: P.porContratista.map(function (x) { return [x[0], String(x[1])]; }) }] : [],
        P.porPuesto.length ? [{ titulo: 'Puestos más frecuentes', head: ['Puesto', 'Personas'], rows: P.porPuesto.map(function (x) { return [x[0], String(x[1])]; }) }] : []) });

    B.push({ id: 'induccion', titulo: 'Inducciones y comunicación', icon: 'fa-chalkboard-teacher', mod: 'personnel', rgb: [14, 116, 144], rows: [
        r('Personal con inducción registrada', P.conInd + ' de ' + P.activos, stPctTxt(stPct(P.conInd, P.activos)) + ' · ' + P.sinInd + ' sin inducción', pctLvl(stPct(P.conInd, P.activos), 100, 80)),
        r('Inducciones registradas', N.total, N.ult90 + ' en los últimos 90 días · ' + stF1(N.horas) + ' h en total' + (Object.keys(N.porTipo).length ? ' · ' + stList(N.porTipo, INDUCTION_TIPOS, 4) : '')),
        r('Última inducción', N.ultima ? attnFmt(N.ultima) : '-', ''),
        r('Con constancia firmada adjunta', N.firmadas + ' de ' + N.total, stPctTxt(stPct(N.firmadas, N.total)), N.total ? pctLvl(stPct(N.firmadas, N.total), 80, 40) : ''),
        r('Comunicaciones de protocolos', N.comTotal, N.comUlt90 + ' en los últimos 90 días · ' + N.comPersonas + ' personas notificadas' + (Object.keys(N.comMedios).length ? ' · ' + stList(N.comMedios, COMM_MEDIOS, 4) : '') + (N.comUltima ? ' · última: ' + attnFmt(N.comUltima) : '')),
        r('Comunicaciones con constancia firmada', N.comFirmadas + ' de ' + N.comTotal, stPctTxt(stPct(N.comFirmadas, N.comTotal)), N.comTotal ? pctLvl(stPct(N.comFirmadas, N.comTotal), 80, 40) : '')
    ] });

    B.push({ id: 'protocolos', titulo: 'Protocolos y procedimientos', icon: 'fa-file-signature', mod: 'protocols', rgb: [109, 40, 217], rows: [
        r('Documentos vigentes', Pr.vigentes, 'de ' + Pr.total + ' · ' + Pr.enRevision + ' en revisión · ' + Pr.obsoletos + ' obsoletos' + (Object.keys(Pr.porTipo).length ? ' · ' + stList(Pr.porTipo, null, 5) : '')),
        r('Revisión periódica vencida', Pr.revVencida, Pr.revPorVencer + ' vencen en 30 días', bad(Pr.revVencida)),
        r('Personal al día con la revisión vigente', stPctTxt(Pr.pct), Pr.alDia + ' de ' + Pr.aplican + ' asignaciones persona-documento', pctLvl(Pr.pct, 90, 60)),
        r('Personal con protocolos pendientes', P.protoPend, 'de ' + P.activos + ' activos', warn(P.protoPend))
    ], listas: Pr.peor.length ? [{ titulo: 'Documentos con menor cobertura', head: ['Documento', 'Rev.', 'Al día', 'Cobertura'], rows: Pr.peor.map(function (c) { return [(c.codigo ? c.codigo + ' - ' : '') + c.titulo, String(c.rev).padStart(2, '0'), c.ok + '/' + c.tot, c.pct + '%']; }) }] : [] });

    B.push({ id: 'art', titulo: 'Denuncias a la ART', icon: 'fa-shield-alt', mod: 'incidents', rgb: [190, 24, 93], rows: [
        r('Casos que requieren denuncia', A.requieren, 'Accidentes y eventos con lesión'),
        r('Denunciados', A.denunciadas + ' de ' + A.requieren, stPctTxt(A.pct) + (Object.keys(A.porArt).length ? ' · ' + stList(A.porArt, null, 3) : ''), A.requieren ? pctLvl(A.pct, 100, 80) : ''),
        r('Sin denunciar', A.pendientes, A.masAntiguo !== null ? 'El más antiguo hace ' + pl(A.masAntiguo, 'día', 'días') : 'Al día', bad(A.pendientes)),
        r('Demora media de denuncia', A.demoraMedia === null ? '-' : stF1(A.demoraMedia) + ' d', A.demoras.length ? A.enPlazo + ' de ' + A.demoras.length + ' dentro de 2 días · máxima ' + A.demoraMax + ' d' : 'Sin denuncias con fecha'),
        r('Con comprobante adjunto', A.conComprobante + ' de ' + A.denunciadas, stPctTxt(stPct(A.conComprobante, A.denunciadas)), A.denunciadas ? pctLvl(stPct(A.conComprobante, A.denunciadas), 80, 40) : ''),
        r('Marcados "no aplica"', A.noAplica, 'Sin lesión ni asistencia médica')
    ], listas: A.pendList.length ? [{ titulo: 'Casos sin denunciar', head: ['Fecha', 'Tipo', 'Involucrado', 'Lugar', 'Días'], rows: A.pendList.slice(0, 8).map(function (x) { return [attnFmt(x.fecha), x.tipo + (x.gravedad ? ' (' + x.gravedad + ')' : ''), x.involucrado || '-', x.lugar || '-', String(x.dias)]; }) }] : [] });

    B.push({ id: 'siniestralidad', titulo: 'Siniestralidad', icon: 'fa-ambulance', mod: 'incidents', rgb: [185, 28, 28], rows: [
        r('Accidentes', I.accidentes, I.incidentes + ' incidentes · ' + I.cuasi + ' cuasi-accidentes', I.accidentes > 0 ? 'warn' : 'ok'),
        r('Eventos con lesión', I.conLesion, stList(I.porGravedad, null, 4), warn(I.conLesion)),
        r('Eventos en los últimos 6 meses', I.porMes.reduce(function (a, b) { return a + b; }, 0), 'Accidentes: ' + I.accPorMes.reduce(function (a, b) { return a + b; }, 0) + ' · último mes: ' + I.ultimoMes),
        r('Índice de incidencia (12 meses)', I.indice === null ? '-' : stF1(I.indice), 'Casos con lesión cada 1.000 trabajadores activos (referencial)'),
        r('Días sin accidentes', I.diasSinAcc === null ? 'Sin accidentes' : I.diasSinAcc, I.ultAccidente ? 'Último accidente: ' + attnFmt(I.ultAccidente) : ''),
        r('Con más de un evento con lesión', I.reincidentes, 'Trabajadores', warn(I.reincidentes)),
        r('Lugar con más eventos', I.lugares.length ? I.lugares[0][1] : '-', I.lugares.map(function (x) { return x[0] + ' (' + x[1] + ')'; }).join(' · '))
    ] });

    B.push({ id: 'capacitacion', titulo: 'Capacitación y plan anual', icon: 'fa-graduation-cap', mod: 'training', rgb: [37, 99, 235], rows: [
        r('Capacitaciones registradas', S.cap.total, stF1(S.cap.horas) + ' h de formación · ' + S.cap.personas + ' participaciones'),
        r('Personal con alguna capacitación', P.activos - P.sinCap + ' de ' + P.activos, stPctTxt(stPct(P.activos - P.sinCap, P.activos)), pctLvl(stPct(P.activos - P.sinCap, P.activos), 90, 60)),
        r('Plan anual ' + attnToday().getFullYear(), S.cap.plan.total ? S.cap.plan.cumplidas + ' de ' + S.cap.plan.total : '-', S.cap.plan.total ? S.cap.plan.atrasadas + ' atrasadas (según el título)' : 'Sin plan cargado para este año', S.cap.plan.total ? warn(S.cap.plan.atrasadas) : '')
    ] });

    B.push({ id: 'salud', titulo: 'Vigilancia de salud', icon: 'fa-heartbeat', mod: 'medical', rgb: [219, 39, 119], rows: [
        r('Exámenes registrados', S.sal.total, [Object.keys(S.sal.porResultado).length ? stList(S.sal.porResultado, null, 3) : '', Object.keys(S.sal.porTipo).length ? stList(S.sal.porTipo, null, 3) : ''].filter(Boolean).join(' · ')),
        r('Próximos controles (30 días)', (S.venc.counts.medical || { p: 0 }).p, 'Vencidos: ' + (S.venc.counts.medical || { v: 0 }).v, ((S.venc.counts.medical || { v: 0 }).v) > 0 ? 'bad' : '')
    ] });

    B.push({ id: 'documentos', titulo: 'Gestión documental', icon: 'fa-folder-open', mod: 'documents', rgb: [180, 83, 9], rows: [
        r('Documentos al día', S.doc.alDia + ' de ' + S.doc.total, stPctTxt(S.doc.pct) + ' · ' + S.doc.por_vencer + ' por vencer', pctLvl(S.doc.pct, 95, 80)),
        r('Vencidos o faltantes', S.doc.mal, S.doc.vencido + ' vencidos · ' + S.doc.faltante + ' faltantes', bad(S.doc.mal)),
        r('En trámite', S.doc.en_tramite, ''),
        r('Guía de requisitos y habilitaciones', S.guia ? S.guia.pct + '%' : '-', S.guia ? S.guia.cnt.ok + S.guia.cnt.warn + ' de ' + S.guia.applic + ' cubiertos · ' + (S.guia.cnt.falta + S.guia.cnt.venc) + ' por revisar' : 'Falta elegir provincia y rubro', S.guia ? pctLvl(S.guia.pct, 90, 60) : '')
    ] });

    B.push({ id: 'equipos', titulo: 'Equipos y vehículos', icon: 'fa-truck', mod: 'extinguishers', rgb: [194, 65, 12], rows: [
        r('Extintores vigentes', S.ext.vigentes + ' de ' + S.ext.total, S.ext.porVencer + ' por vencer · ' + S.ext.vencidos + ' vencidos', S.ext.total ? bad(S.ext.vencidos) : ''),
        r('Vehículos', S.veh.total, S.veh.activos + ' activos · ' + S.veh.enMant + ' en mantenimiento · ' + ((S.venc.counts.vehicles || { v: 0 }).v) + ' vencimientos', ((S.venc.counts.vehicles || { v: 0 }).v) > 0 ? 'warn' : ''),
        r('Maquinaria', S.mac.total, S.mac.operativas + ' operativas · ' + S.mac.enMant + ' en mantenimiento · ' + S.mac.fuera + ' fuera de servicio', S.mac.fuera > 0 ? 'warn' : ''),
        r('Contratistas', S.con.total, S.con.vigente + S.con.por_vencer + ' con ART vigente · ' + (S.con.vencida + S.con.sin) + ' vencida o sin cargar · ' + S.con.personal + ' trabajadores', (S.con.vencida + S.con.sin) > 0 ? 'bad' : '')
    ] });

    B.push({ id: 'emergencias', titulo: 'Emergencias y permisos de trabajo', icon: 'fa-door-open', mod: 'evacuation', rgb: [21, 128, 61], rows: [
        r('Simulacros de evacuación', S.dri.total, S.dri.ult12 + ' en los últimos 12 meses' + (S.dri.ultima ? ' · último: ' + attnFmt(S.dri.ultima) : ''), S.dri.ult12 === 0 ? 'warn' : ''),
        r('Tiempo medio de evacuación', S.dri.tiempo === null ? '-' : stF1(S.dri.tiempo) + ' min', S.dri.evacPct !== null ? S.dri.evacPct + '% de los presentes evacuados' : ''),
        r('Planes de evacuación', S.dri.planes, ''),
        r('Permisos de trabajo (JSA)', S.jsa.total, S.jsa.ult30 + ' en los últimos 30 días' + (Object.keys(S.jsa.porTipo).length ? ' · ' + stList(S.jsa.porTipo, null, 3) : '')),
        r('EPP entregado', S.epp.total, S.epp.ult30 + ' entregas en los últimos 30 días · ' + ((S.venc.counts.ppe || { v: 0 }).v) + ' con vida útil vencida', ((S.venc.counts.ppe || { v: 0 }).v) > 0 ? 'warn' : '')
    ] });

    B.push({ id: 'ambiente', titulo: 'Ambiente y químicos', icon: 'fa-leaf', mod: 'environmental', rgb: [4, 120, 87], rows: [
        r('Mediciones ambientales', S.med.total, S.med.conformes + ' conformes · ' + S.med.noConf + ' fuera de límite' + (S.med.noConf ? ' (' + stList(S.med.noConfTipos, null, 3) + ')' : ''), S.med.noConf > 0 ? 'warn' : ''),
        r('Residuos registrados', stF1(S.res.kg) + ' kg', S.res.total + ' registros · ' + stF1(S.res.peligrososKg) + ' kg peligrosos · ' + stPctTxt(S.res.valPct) + ' valorizado'),
        r('Residuos en los últimos 90 días', stF1(S.res.ult90) + ' kg', ''),
        r('Productos químicos', S.qui.total, ((S.venc.counts.sds || { v: 0, p: 0 }).v + (S.venc.counts.sds || { v: 0, p: 0 }).p) + ' hojas de seguridad a revisar', ((S.venc.counts.sds || { v: 0 }).v) > 0 ? 'warn' : '')
    ].concat((function () {
        // Gestión ambiental (ambiente.js): trazabilidad, obrador y derrames
        let A = null;
        try { if (typeof amStats === 'function' && typeof currentEstablishment !== 'undefined' && currentEstablishment) A = amStats([currentEstablishment.id]); } catch (e) { A = null; }
        if (!A || !A.hayDatos) return [];
        return [
            r('Residuos peligrosos retirados (trazabilidad)', A.peligrosos, A.sinCD + ' sin Certificado de Destrucción · ' + A.enAcopio + ' en acopio' + (A.pctCD !== null ? ' · ' + A.pctCD + '% con certificado' : ''), A.sinCD > 0 ? 'bad' : ''),
            r('Obrador y área de acopio', A.cumpleObrador === null ? '-' : A.cumpleObrador + '%', A.insp + ' inspecciones' + (A.ultInsp ? ' · última: ' + attnFmt(A.ultInsp) : '') + (A.ocupacion !== null ? ' · ocupación máx. ' + A.ocupacion + '%' : ''), A.cumpleObrador !== null && A.cumpleObrador < 70 ? 'warn' : ''),
            r('Derrames ambientales', A.incidentes, A.incAbiertos + ' sin cerrar', A.incAbiertos > 0 ? 'bad' : ''),
            r('Plan de Gestión Ambiental', A.programas + ' programas', A.progCumplidos + ' cumplidos · ' + A.progAtrasados + ' atrasados · ' + A.capacitaciones + ' capacitaciones ambientales', A.progAtrasados > 0 ? 'warn' : ''),
            r('Pendientes de gestión ambiental', A.alertas.length, A.alertasRojas + ' vencidos o faltantes · ' + A.alertasAmarillas + ' por vencer', A.alertasRojas > 0 ? 'bad' : (A.alertas.length ? 'warn' : 'ok'))
        ];
    })()) });

    B.push({ id: 'calidad', titulo: 'Calidad y mejora continua', icon: 'fa-certificate', mod: 'audits', rgb: [71, 85, 105], rows: [
        r('Auditorías internas', S.aud.total, S.aud.completadas + ' completadas · ' + S.aud.programadas + ' programadas' + (S.aud.atrasadas ? ' (' + S.aud.atrasadas + ' atrasadas)' : ''), S.aud.atrasadas > 0 ? 'warn' : ''),
        r('Hallazgos de auditoría', S.aud.hallazgos, S.aud.noConf + ' no conformidades · ' + S.aud.fortalezas + ' fortalezas'),
        r('No conformidades abiertas', S.nc.abiertas, S.nc.cerradas + ' cerradas · ' + S.nc.vencidas + ' vencidas · ' + S.nc.mayores + ' mayores abiertas', S.nc.vencidas > 0 ? 'bad' : (S.nc.abiertas > 0 ? 'warn' : 'ok')),
        r('Satisfacción del cliente', S.sat.total, (S.sat.calidad === null ? 'Sin calificaciones' : 'Calidad ' + stF1(S.sat.calidad) + ' · plazos ' + stF1(S.sat.tiempo) + ' · comunicación ' + stF1(S.sat.comunicacion)) + (S.sat.nps !== null ? ' · NPS ' + S.sat.nps : '') + ' · ' + S.sat.quejas + ' reclamos/quejas', S.sat.quejas > 0 ? 'warn' : '')
    ] });

    return B;
}

// ---------------------------------------------------------------------------
// Tabla de próximos vencimientos (para PDF)
function statsVencRows(S, n) {
    return S.venc.items.slice(0, n || 12).map(function (it) {
        const m = ATTN_MODS[it.mod] || { label: it.mod };
        return [m.label, it.titulo + (it.detalle ? ' - ' + it.detalle : ''), it.fecha ? attnFmt(it.fecha) : '-', attnItemText(it)];
    });
}

// ===========================================================================
//  CONFIGURACIÓN: qué bloques se muestran en la página y qué entra en cada PDF
// ===========================================================================
const ST_KEY = 'prohs_stats_cfg_v1';
const ST_AREAS = [['personal', 'Personal y nómina'], ['induccion', 'Inducciones y comunicación'], ['protocolos', 'Protocolos y procedimientos'], ['art', 'Denuncias a la ART'],
    ['siniestralidad', 'Siniestralidad'], ['capacitacion', 'Capacitación y plan anual'], ['salud', 'Vigilancia de salud'], ['documentos', 'Gestión documental'],
    ['equipos', 'Equipos y vehículos'], ['emergencias', 'Emergencias y permisos de trabajo'], ['ambiente', 'Ambiente y químicos'], ['calidad', 'Calidad y mejora continua']];
const ST_CHARTS = [['actions', 'Acciones por estado'], ['incidents', 'Incidentes por tipo'], ['risks', 'Riesgos por nivel'], ['trainings', 'Capacitaciones (6 meses)'], ['meses', 'Eventos por mes']];
let stCfgMem = null;

function stAreaItems(prefix) { return ST_AREAS.map(function (a) { return { id: prefix + a[0], l: a[1] }; }); }
// Catálogo por destino: 'page' (pantalla), 'informe' (Informe ejecutivo, PDF), 'resumen' (Resumen ejecutivo de la portada, PDF)
function stCatalog(kind) {
    if (kind === 'page') return [
        { g: 'Resumen', items: [{ id: 'estado', l: 'Estado general', d: 'Semáforo con los motivos principales' }, { id: 'recom', l: 'Recomendaciones', d: 'Qué conviene hacer, ordenado por urgencia' }, { id: 'vencimientos', l: 'Vencimientos y pendientes', d: 'Por módulo y próximos a vencer' }] },
        { g: 'Indicadores', items: [{ id: 'indicadores', l: 'Indicadores clave', d: 'Prevención, incidentes y correctivos' }, { id: 'personal', l: 'Cobertura del personal', d: 'ART, examen médico, inducción, protocolos' }, { id: 'art', l: 'Siniestralidad y denuncias a la ART' }] },
        { g: 'Gráficos', items: ST_CHARTS.map(function (c) { return { id: 'chart_' + c[0], l: c[1] }; }) },
        { g: 'Detalle por área (pestañas)', items: stAreaItems('area_'), all: true }
    ];
    if (kind === 'informe') return [
        { g: 'Resumen', items: [{ id: 'resumen', l: 'Resumen ejecutivo y estado general' }, { id: 'kpis', l: 'Indicadores clave (prevención y correctivos)' }] },
        { g: 'Personal, ART y vencimientos', items: [{ id: 'k_personal', l: 'Personal, inducciones y protocolos' }, { id: 'k_art', l: 'Siniestralidad y denuncias a la ART' }, { id: 'k_venc', l: 'Vencimientos y documentación' }] },
        { g: 'Gráficos', items: [{ id: 'g_gestion', l: 'Acciones, incidentes, riesgos y capacitaciones' }, { id: 'g_personal', l: 'Cobertura del personal' }, { id: 'g_eventos', l: 'Eventos por mes' }, { id: 'g_art', l: 'Denuncias a la ART' }, { id: 'g_venc', l: 'Vencimientos por módulo' }] },
        { g: 'Tablas y detalle', items: [{ id: 't_venc', l: 'Próximos vencimientos y pendientes' }, { id: 't_acciones', l: 'Acciones correctivas pendientes' }, { id: 't_riesgos', l: 'Riesgos que requieren atención' }] },
        { g: 'Situación por área', items: stAreaItems('area_'), all: true },
        { g: 'Cierre', items: [{ id: 'recom', l: 'Conclusiones y recomendaciones' }, { id: 'normativa', l: 'Marco normativo' }] }
    ];
    return [
        { g: 'Resumen', items: [{ id: 'kpis', l: 'Cuadros de indicadores clave' }, { id: 'texto', l: 'Texto del resumen ejecutivo' }] },
        { g: 'Gestión', items: [{ id: 'inspecciones', l: 'Inspecciones y cumplimiento' }, { id: 'riesgos', l: 'Matriz de riesgos' }, { id: 'acciones', l: 'Acciones correctivas' }, { id: 'incidentes', l: 'Registro de incidentes' },
            { id: 'incendios', l: 'Prevención de incendios' }, { id: 'capacitacion', l: 'Programa de capacitación' }, { id: 'epp', l: 'Elementos de protección personal' }, { id: 'jsa', l: 'JSA / permisos de trabajo' }] },
        { g: 'Activos y documentación', items: [{ id: 'vehiculos', l: 'Flota vehicular' }, { id: 'maquinaria', l: 'Maquinarias' }, { id: 'contratistas', l: 'Contratistas' }, { id: 'documentos', l: 'Gestión documental' }, { id: 't_venc', l: 'Próximos vencimientos y pendientes' }] },
        { g: 'Situación por área', items: stAreaItems('area_'), all: true },
        { g: 'Cierre', items: [{ id: 'alertas', l: 'Alertas y observaciones' }, { id: 'recom', l: 'Recomendaciones' }, { id: 'normativa', l: 'Normativa aplicable' }, { id: 'declaracion', l: 'Declaración' }] }
    ];
}
function stAllIds(kind) { const o = []; stCatalog(kind).forEach(function (g) { g.items.forEach(function (i) { o.push(i.id); }); }); return o; }
function stPreset(kind, name) {
    const all = stAllIds(kind);
    if (name === 'todo') return all;
    if (name === 'nada') return [];
    if (kind === 'page') {
        if (name === 'personal') return ['estado', 'personal', 'art', 'recom'].concat(all.filter(function (i) { return /^area_(personal|induccion|protocolos|art|salud)$/.test(i); }));
        if (name === 'venc') return ['estado', 'vencimientos', 'recom'];
        return ['estado', 'indicadores', 'personal', 'art', 'vencimientos', 'recom', 'chart_actions', 'chart_incidents'].concat(all.filter(function (i) { return i.indexOf('area_') === 0; }));
    }
    if (kind === 'informe') {
        if (name === 'personal') return ['resumen', 'k_personal', 'k_art', 'g_personal', 'g_art', 'area_personal', 'area_induccion', 'area_protocolos', 'area_art', 'area_salud', 'recom'];
        if (name === 'venc') return ['resumen', 'k_venc', 'g_venc', 't_venc', 'recom'];
        return ['resumen', 'kpis', 'k_personal', 'k_art', 'k_venc', 'g_gestion', 't_venc', 't_acciones', 't_riesgos', 'recom', 'normativa'];
    }
    if (name === 'personal') return ['kpis', 'texto', 'area_personal', 'area_induccion', 'area_protocolos', 'area_art', 'area_salud', 'alertas', 'recom'];
    if (name === 'venc') return ['kpis', 'texto', 't_venc', 'alertas', 'recom'];
    return all.filter(function (i) { return i.indexOf('area_') !== 0; });
}
function stCfgLoad() { try { return JSON.parse(localStorage.getItem(ST_KEY) || '{}') || {}; } catch (e) { return {}; } }
function stCfgGet() { if (!stCfgMem) stCfgMem = stCfgLoad(); return stCfgMem; }
function stCfgSet(kind, set) {
    const cfg = stCfgGet(); cfg[kind] = {}; stAllIds(kind).forEach(function (id) { cfg[kind][id] = set.indexOf(id) >= 0; });
    try { localStorage.setItem(ST_KEY, JSON.stringify(cfg)); } catch (e) { /* sin almacenamiento: queda sólo en memoria */ }
}
// Conjunto de ids elegidos (objeto con has())
function statsSelection(kind) {
    const saved = stCfgGet()[kind], def = stPreset(kind, 'esencial'), ids = stAllIds(kind), on = {};
    ids.forEach(function (id) { on[id] = saved && (id in saved) ? !!saved[id] : def.indexOf(id) >= 0; });
    return { has: function (id) { return !!on[id]; }, ids: ids.filter(function (i) { return on[i]; }), all: on };
}

// Ventana de selección (pantalla y PDF). Devuelve una promesa con la lista de ids elegidos o null si se cancela.
function stDialog(kind, o) {
    return new Promise(function (resolve) {
        const cur = statsSelection(kind);
        const ov = document.createElement('div'); ov.className = 'st-ov';
        const groups = stCatalog(kind).map(function (g, gi) {
            return '<div class="st-g"><div class="st-g-h">' + protoEsc(g.g) + '<a data-g="' + gi + '" data-v="1">todos</a><a data-g="' + gi + '" data-v="0" style="margin-left:.4rem">ninguno</a></div>' +
                g.items.map(function (i) {
                    return '<label class="st-ck"><input type="checkbox" data-id="' + i.id + '" data-g="' + gi + '"' + (cur.has(i.id) ? ' checked' : '') + '><span>' + protoEsc(i.l) + (i.d ? '<small>' + protoEsc(i.d) + '</small>' : '') + '</span></label>';
                }).join('') + '</div>';
        }).join('');
        ov.innerHTML = '<div class="st-dlg" role="dialog" aria-modal="true"><div class="st-dlg-h"><h3>' + protoEsc(o.title) + '</h3><p>' + protoEsc(o.sub) + '</p></div>' +
            '<div class="st-presets"><button data-p="esencial">Lo esencial</button><button data-p="personal">Personal y ART</button><button data-p="venc">Sólo vencimientos</button><button data-p="todo">Todo</button><button data-p="nada">Nada</button></div>' +
            '<div class="st-dlg-b">' + groups + '</div>' +
            '<div class="st-dlg-f"><button class="st-btn-s" data-x="c">Cancelar</button><button class="st-btn-p" data-x="ok">' + protoEsc(o.ok) + '</button></div></div>';
        document.body.appendChild(ov);
        const boxes = function () { return [].slice.call(ov.querySelectorAll('input[type=checkbox]')); };
        const done = function (v) { ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
        const onKey = function (e) { if (e.key === 'Escape') done(null); };
        document.addEventListener('keydown', onKey);
        ov.addEventListener('click', function (e) {
            const t = e.target;
            if (t === ov) return done(null);
            if (t.dataset && t.dataset.p) { const ids = stPreset(kind, t.dataset.p); boxes().forEach(function (b) { b.checked = ids.indexOf(b.dataset.id) >= 0; }); }
            if (t.tagName === 'A' && t.dataset.g !== undefined) { boxes().forEach(function (b) { if (b.dataset.g === t.dataset.g) b.checked = t.dataset.v === '1'; }); }
            if (t.dataset && t.dataset.x === 'c') done(null);
            if (t.dataset && t.dataset.x === 'ok') {
                const ids = boxes().filter(function (b) { return b.checked; }).map(function (b) { return b.dataset.id; });
                if (o.needOne && !ids.length) { t.textContent = 'Elegí al menos un bloque'; setTimeout(function () { t.textContent = o.ok; }, 1500); return; }
                stCfgSet(kind, ids); done(ids);
            }
        });
        const first = ov.querySelector('input'); if (first) first.focus();
    });
}
// Botón «Personalizar» de la página
function statsOpenConfig() {
    stDialog('page', { title: 'Personalizar «Resumen y estadísticas»', sub: 'Elegí qué bloques querés ver. La elección se guarda en este dispositivo.', ok: 'Guardar', needOne: false }).then(function (ids) {
        if (ids) { statsApplyConfig(); if (typeof refreshDashboard === 'function') refreshDashboard(); }
    });
}
// Antes de generar un PDF: devuelve la selección (objeto con has()) o null si se cancela
function statsPickSections(kind) {
    const nombre = kind === 'informe' ? 'Informe ejecutivo' : 'Resumen ejecutivo';
    return stDialog(kind, { title: 'Qué incluir en el ' + nombre, sub: 'Marcá las secciones que querés en el PDF. Se recuerda la última elección.', ok: 'Generar PDF', needOne: true }).then(function (ids) {
        return ids ? statsSelection(kind) : null;
    });
}
// Muestra u oculta los bloques de la página según la configuración
function statsApplyConfig() {
    const sel = statsSelection('page'), root = document.getElementById('dashboardView'); if (!root) return;
    const anyChart = ST_CHARTS.some(function (c) { return sel.has('chart_' + c[0]); });
    const anyArea = ST_AREAS.some(function (a) { return sel.has('area_' + a[0]); });
    [].slice.call(root.querySelectorAll('[data-st]')).forEach(function (el) {
        const id = el.getAttribute('data-st');
        const on = id === 'charts' ? anyChart : id === 'areas' ? anyArea : sel.has(id);
        el.classList.toggle('st-off', !on);
    });
    const total = stAllIds('page').length, shown = sel.ids.length, note = document.getElementById('stCfgNote');
    if (note) {
        if (shown < total) { note.classList.remove('hidden'); note.innerHTML = '<i class="fas fa-eye-slash"></i> Mostrando ' + shown + ' de ' + total + ' bloques. <a onclick="statsOpenConfig()">Personalizar</a>'; }
        else note.classList.add('hidden');
    }
}

// ===========================================================================
//  PÁGINA «Resumen y estadísticas»
// ===========================================================================
let stLastS = null, stAreaSel = null, stVencAll = false, stRecomAll = false;
const ST_LVL_DOT = { bad: 'st-c-bad', warn: 'st-c-warn' };

function statsRenderEstado(S) {
    const el = document.getElementById('stEstado'); if (!el) return;
    const e = S.estado; const col = 'rgb(' + e.rgb.join(',') + ')';
    const fig = function (v, l) { return '<div><b>' + protoEsc(String(v)) + '</b><span>' + protoEsc(l) + '</span></div>'; };
    el.innerHTML = '<div class="st-estado" style="background:' + col + '"><div><div class="st-estado-t"><span>Estado general</span><strong>' + protoEsc(e.label) + '</strong></div>' +
        (e.motivos.length ? '<ul>' + e.motivos.map(function (m) { return '<li>' + protoEsc(m) + '</li>'; }).join('') + '</ul>' : '<p>Sin alertas importantes: los indicadores están en niveles aceptables.</p>') + '</div>' +
        '<div class="st-figs">' + fig(S.per.activos, 'Personal activo') + fig(stPctTxt(S.doc.pct), 'Documentos al día') + fig(S.art.pendientes, 'Sin denunciar a la ART') + fig(S.venc.venc, 'Vencidos o faltantes') + '</div></div>';
}

function statsRenderCobertura(S) {
    const el = document.getElementById('stCobertura'); if (!el) return;
    const P = S.per, n = P.activos;
    const rows = [
        ['Seguro de ART', P.artOk, P.art.problema ? P.art.problema + ' sin ART o vencida' : '', 'personnel', 100],
        ['Examen médico', P.medOk, P.medMal ? P.medMal + ' con pendientes' : '', 'medical', 95],
        ['Inducción', P.conInd, P.sinInd ? P.sinInd + ' sin inducción' : '', 'personnel', 95],
        ['Protocolos al día', n - P.protoPend, P.protoPend ? P.protoPend + ' con pendientes' : '', 'protocols', 90],
        ['Capacitación', n - P.sinCap, P.sinCap ? P.sinCap + ' sin capacitación' : '', 'training', 90],
        ['EPP entregado', n - P.sinEpp, P.sinEpp ? P.sinEpp + ' sin entrega' : '', 'ppe', 90],
        ['Alta temprana', n - P.sinAlta, P.sinAlta ? P.sinAlta + ' sin alta cargada' : '', 'personnel', 100]
    ];
    let h = '<h3 class="st-h"><i class="fas fa-users" style="color:#4f46e5"></i> Cobertura del personal<small>' + attnPlural(n, 'persona activa', 'personas activas') + '</small></h3>';
    if (!n) { el.innerHTML = h + '<p class="st-more">No hay personal activo cargado en la nómina.</p>'; return; }
    h += '<div class="st-bars">' + rows.map(function (r) {
        const pct = Math.max(0, Math.min(100, Math.round(r[1] * 100 / n)));
        const cls = pct >= r[4] ? 'ok' : (pct >= r[4] - 20 ? 'warn' : 'bad');
        return '<div class="st-bar-row" onclick="showModule(\'' + r[3] + '\')" title="Abrir el módulo"><div class="st-bar-top"><span>' + r[0] + '<small>' + (r[2] || (r[1] + ' de ' + n)) + '</small></span><span class="st-t-' + cls + '">' + pct + '%</span></div>' +
            '<div class="st-track"><i class="st-c-' + cls + '" style="width:' + pct + '%"></i></div></div>';
    }).join('') + '</div>';
    el.innerHTML = h;
}

function statsRenderArtBox(S) {
    const el = document.getElementById('stArtBox'); if (!el) return;
    const A = S.art, I = S.inc, tot = A.denunciadas + A.pendientes + A.noAplica;
    let h = '<h3 class="st-h"><i class="fas fa-shield-alt" style="color:#be185d"></i> Siniestralidad y ART<small><a class="st-rec-a" onclick="showModule(\'incidents\')">Abrir incidentes</a></small></h3>';
    h += '<div class="st-big"><b class="' + (A.pendientes ? 'st-t-bad' : 'st-t-ok') + '">' + A.pendientes + '</b><span>' + (A.requieren ? (A.pendientes === 1 ? 'caso sin denunciar a la ART' : 'casos sin denunciar a la ART') + (A.masAntiguo !== null && A.pendientes ? ' · el más antiguo hace ' + attnPlural(A.masAntiguo, 'día', 'días') : '') : 'No hay casos con lesión que denunciar') + '</span></div>';
    if (tot) {
        h += '<div class="st-track" style="height:12px">' + (A.denunciadas ? '<i class="st-c-ok" style="flex:' + A.denunciadas + '"></i>' : '') + (A.pendientes ? '<i class="st-c-bad" style="flex:' + A.pendientes + '"></i>' : '') + (A.noAplica ? '<i class="st-c-mute" style="flex:' + A.noAplica + '"></i>' : '') + '</div>' +
            '<div class="st-legend"><span><i class="st-c-ok"></i>Denunciadas ' + A.denunciadas + '</span><span><i class="st-c-bad"></i>Sin denunciar ' + A.pendientes + '</span><span><i class="st-c-mute"></i>No aplica ' + A.noAplica + '</span></div>';
    }
    const pair = function (t, v) { return '<div><dt>' + t + '</dt><dd>' + protoEsc(String(v)) + '</dd></div>'; };
    h += '<dl class="st-pairs">' + pair('Casos con lesión', I.conLesion) + pair('Graves', I.graves) + pair('Índice de incidencia (12 meses)', I.indice === null ? '-' : stF1(I.indice)) +
        pair('Demora media de denuncia', A.demoraMedia === null ? '-' : stF1(A.demoraMedia) + ' días') + pair('Días sin accidentes', I.diasSinAcc === null ? '-' : I.diasSinAcc) + pair('Último accidente', I.ultAccidente ? attnFmt(I.ultAccidente) : '-') + '</dl>';
    el.innerHTML = h;
}

function statsRenderVencBox(S) {
    const el = document.getElementById('stVencBox'); if (!el) return;
    const V = S.venc, items = V.items;
    let h = '<h3 class="st-h"><i class="fas fa-calendar-alt" style="color:#b45309"></i> Vencimientos y pendientes<small>' + V.venc + ' vencidos o faltantes · ' + V.por + ' por vencer</small></h3>';
    if (!items.length) { el.innerHTML = h + '<p class="st-empty"><i class="fas fa-check-circle"></i> No hay vencimientos ni pendientes en este establecimiento.</p>'; return; }
    const mods = Object.keys(V.counts).sort(function (a, b) { const x = V.counts[a], y = V.counts[b]; return (y.v + y.p + y.n) - (x.v + x.p + x.n); }).slice(0, 8);
    const max = Math.max.apply(null, mods.map(function (m) { const c = V.counts[m]; return c.v + c.p + c.n; }).concat([1]));
    const lab = function (m) { return ST_MOD_PL[m] || (ATTN_MODS[m] && ATTN_MODS[m].label) || m; };
    h += '<div class="st-vsplit"><div>' + mods.map(function (m) {
        const c = V.counts[m], bad = c.v + c.n, tot = bad + c.p;
        return '<div class="st-vrow" onclick="showModule(\'' + m + '\')" title="Abrir el módulo"><span class="st-vl">' + protoEsc(lab(m)) + '</span><div class="st-track">' +
            (bad ? '<i class="st-c-bad" style="width:' + (bad * 100 / max) + '%"></i>' : '') + (c.p ? '<i class="st-c-warn" style="width:' + (c.p * 100 / max) + '%"></i>' : '') + '</div><span class="st-vn">' + tot + '</span></div>';
    }).join('') + '<div class="st-legend"><span><i class="st-c-bad"></i>Vencidos, faltantes o sin denunciar</span><span><i class="st-c-warn"></i>Por vencer (30 días)</span></div></div>';
    const lim = stVencAll ? 25 : 6, list = items.slice(0, lim);
    h += '<div><div class="st-tbl-w"><table class="st-tbl st-tbl-venc"><thead><tr><th>Módulo</th><th>Detalle</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>' + list.map(function (it) {
        const m = ATTN_MODS[it.mod] || { label: it.mod, icon: 'fa-clipboard-list' };
        const cls = it.estado === 'por_vencer' ? 'st-warn' : 'st-bad';
        return '<tr class="st-clk" onclick="attnGo(\'' + it.mod + '\',\'' + String(it.id).replace(/'/g, "\\'") + '\',\'' + String(it.estId).replace(/'/g, "\\'") + '\')"><td><i class="fas ' + m.icon + '"></i> ' + protoEsc(m.label) + '</td><td>' + protoEsc(it.titulo) + (it.detalle ? '<small>' + protoEsc(it.detalle) + '</small>' : '') + '</td><td>' + (it.fecha ? attnFmt(it.fecha) : '-') + '</td><td class="' + cls + '">' + protoEsc(attnItemText(it)) + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
        (items.length > 6 ? '<button class="st-toggle" type="button" onclick="statsToggle(\'venc\')">' + (stVencAll ? 'Ver menos' : 'Ver ' + Math.min(25, items.length) + ' de ' + items.length) + '</button>' : '') +
        (stVencAll && items.length > 25 ? '<p class="st-more">Y ' + (items.length - 25) + ' más en el botón «Pendientes».</p>' : '') + '</div></div>';
    el.innerHTML = h;
}

function statsRenderAreas(S) {
    const el = document.getElementById('stAreas'); if (!el) return;
    const sel = statsSelection('page');
    const blocks = S.blocks.filter(function (b) { return sel.has('area_' + b.id); });
    if (!blocks.length) { el.innerHTML = ''; return; }
    if (!blocks.some(function (b) { return b.id === stAreaSel; })) stAreaSel = blocks[0].id;
    const worst = function (b) { return b.rows.some(function (r) { return r.lvl === 'bad'; }) ? 'bad' : (b.rows.some(function (r) { return r.lvl === 'warn'; }) ? 'warn' : 'ok'); };
    const dotCls = { bad: 'st-c-bad', warn: 'st-c-warn', ok: 'st-c-ok' };
    let h = '<h3 class="st-h"><i class="fas fa-layer-group" style="color:#0e7490"></i> Detalle por área</h3><div class="st-tabs" role="tablist">' + blocks.map(function (b) {
        return '<button type="button" role="tab" class="st-tab' + (b.id === stAreaSel ? ' on' : '') + '" style="--stc:rgb(' + b.rgb.join(',') + ')" onclick="statsSelectArea(\'' + b.id + '\')"><span class="st-dot ' + dotCls[worst(b)] + '"></span>' + protoEsc(b.titulo) + '</button>';
    }).join('') + '</div>';
    const b = blocks.filter(function (x) { return x.id === stAreaSel; })[0];
    const lvlCls = { ok: 'st-ok', warn: 'st-warn', bad: 'st-bad', '': '' };
    h += '<div class="st-panel" style="--stc:rgb(' + b.rgb.join(',') + ')"><div class="st-panel-h"><h4><i class="fas ' + b.icon + '"></i> ' + protoEsc(b.titulo) + '</h4><button type="button" class="st-go" onclick="showModule(\'' + b.mod + '\')">Abrir módulo <i class="fas fa-arrow-right"></i></button></div><div class="st-rows st-cols">' +
        b.rows.map(function (x) { return '<div class="st-row"><div class="st-l">' + protoEsc(x.l) + (x.d ? '<small>' + protoEsc(x.d) + '</small>' : '') + '</div><div class="st-v ' + lvlCls[x.lvl] + '">' + protoEsc(x.v) + '</div></div>'; }).join('') + '</div>';
    (b.listas || []).forEach(function (L) {
        h += '<div class="st-sub">' + protoEsc(L.titulo) + '</div><div class="st-tbl-w"><table class="st-tbl"><thead><tr>' + L.head.map(function (t) { return '<th>' + protoEsc(t) + '</th>'; }).join('') + '</tr></thead><tbody>' +
            L.rows.map(function (row) { return '<tr>' + row.map(function (t) { return '<td>' + protoEsc(t) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    });
    el.innerHTML = h + '</div>';
}
function statsSelectArea(id) { stAreaSel = id; if (stLastS) statsRenderAreas(stLastS); }
function statsToggle(w) {
    if (w === 'venc') stVencAll = !stVencAll; else stRecomAll = !stRecomAll;
    if (stLastS) { if (w === 'venc') statsRenderVencBox(stLastS); else statsRenderRecom(stLastS); }
}

function statsRenderRecom(S) {
    const el = document.getElementById('stRecomBox'); if (!el) return;
    const tag = { urgente: ['URGENTE', '#dc2626'], importante: ['IMPORTANTE', '#d97706'], mejora: ['MEJORA', '#2563eb'], ok: ['BIEN', '#16a34a'] };
    const cnt = {}; S.recom.forEach(function (x) { cnt[x.nivel] = (cnt[x.nivel] || 0) + 1; });
    const lim = stRecomAll ? S.recom.length : 6, list = S.recom.slice(0, lim);
    let h = '<h3 class="st-h"><i class="fas fa-lightbulb" style="color:#ca8a04"></i> Análisis y recomendaciones</h3><div class="st-rcount">' +
        [['urgente', 'urgente', 'urgentes'], ['importante', 'importante', 'importantes'], ['mejora', 'mejora', 'mejoras']].filter(function (k) { return cnt[k[0]]; }).map(function (k) { return '<span style="background:' + tag[k[0]][1] + '">' + cnt[k[0]] + ' ' + (cnt[k[0]] === 1 ? k[1] : k[2]) + '</span>'; }).join('') + '</div>';
    h += list.map(function (x) {
        const t = tag[x.nivel] || tag.mejora;
        return '<div class="st-rec"><span class="st-rec-t" style="background:' + t[1] + '">' + t[0] + '</span><span><strong>' + protoEsc(x.alerta) + '.</strong> ' + protoEsc(x.accion) + (x.mod ? ' <a class="st-rec-a" onclick="showModule(\'' + x.mod + '\')">Ir al módulo</a>' : '') + '</span></div>';
    }).join('');
    if (S.recom.length > 6) h += '<button class="st-toggle" type="button" onclick="statsToggle(\'recom\')">' + (stRecomAll ? 'Ver menos' : 'Ver las ' + (S.recom.length - 6) + ' restantes') + '</button>';
    el.innerHTML = h;
}

// Gráfico propio (Chart.js): eventos por mes. Los demás gráficos son barras y listas hechas con HTML.
function statsRenderCharts(S) {
    if (typeof Chart === 'undefined') return;
    const sel = function (id, def) { const e = document.getElementById(id); return (e && e.value) || def; };
    const c = document.getElementById('stMesesChart'); if (!c) return;
    const t2 = sel('stMesesChartType', 'bar');
    const yAxis = { y: { beginAtZero: true, ticks: { stepSize: 1 } } };
    dashboardCharts.stMeses = new Chart(c, {
        type: t2,
        data: { labels: S.inc.meses.map(function (m) { return m.label; }), datasets: [
            { label: 'Accidentes', data: S.inc.accPorMes, backgroundColor: t2 === 'line' ? 'rgba(239,68,68,0.1)' : '#ef4444', borderColor: '#ef4444', borderWidth: 2, fill: t2 === 'line' },
            { label: 'Otros eventos', data: S.inc.porMes.map(function (n, i) { return n - S.inc.accPorMes[i]; }), backgroundColor: t2 === 'line' ? 'rgba(245,158,11,0.1)' : '#f59e0b', borderColor: '#f59e0b', borderWidth: 2, fill: t2 === 'line' }
        ] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: t2 === 'bar' ? { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } } : yAxis }
    });
}

function statsRenderPage(S) {
    if (!S) return;
    stLastS = S;
    stSafe(function () { statsApplyConfig(); });
    stSafe(function () { statsRenderEstado(S); }); stSafe(function () { statsRenderCobertura(S); }); stSafe(function () { statsRenderArtBox(S); });
    stSafe(function () { statsRenderVencBox(S); }); stSafe(function () { statsRenderAreas(S); }); stSafe(function () { statsRenderRecom(S); });
    const sel = statsSelection('page');
    if (sel.has('chart_meses')) stSafe(function () { statsRenderCharts(S); });
}

// ===========================================================================
//  PDF: bloque con título + tabla (+ listas auxiliares)
//  newPage() debe agregar una página (con su encabezado) y devolver el Y inicial.
// ===========================================================================
// Cuando autoTable corta una tabla en otra página, repite el encabezado de la página (newPage.draw)
function stPdfPg(doc, newPage) {
    const first = doc.internal.getCurrentPageInfo ? doc.internal.getCurrentPageInfo().pageNumber : doc.internal.getNumberOfPages();
    return function (d) { if (newPage && newPage.draw && d.pageNumber !== first) newPage.draw(); };
}
// Grupos de indicadores (los mismos de la página) para el PDF
function statsKpiGroups(S) {
    const P = S.per, A = S.art, I = S.inc;
    return [
        { titulo: 'Personal, inducciones y protocolos', rgb: [79, 70, 229], rows: [
            ['Personal activo', P.activos, P.propios + ' propios · ' + P.contratados + ' contratistas', ''],
            ['Seguro ART al día', stPctTxt(stPct(P.artOk, P.activos)), P.art.problema ? P.art.problema + ' sin ART o vencida' : 'Todo el personal cubierto', P.art.problema ? 'bad' : 'ok'],
            ['Examen médico al día', stPctTxt(stPct(P.medOk, P.activos)), P.medMal ? P.medMal + ' sin examen, vencido o no apto' : 'Sin pendientes', P.medMal ? 'bad' : 'ok'],
            ['Con inducción', stPctTxt(stPct(P.conInd, P.activos)), P.sinInd ? P.sinInd + ' sin inducción' : 'Todos inducidos', P.sinInd ? 'warn' : 'ok'],
            ['Protocolos al día', stPctTxt(S.pro.pct), P.protoPend + ' personas con pendientes', S.pro.pct !== null && S.pro.pct < 80 ? 'bad' : 'ok']
        ] },
        { titulo: 'Siniestralidad y denuncias a la ART', rgb: [190, 24, 93], rows: [
            ['Denunciados a la ART', A.denunciadas + ' de ' + A.requieren, A.requieren ? stPctTxt(A.pct) + ' de los casos con lesión' : 'Sin casos que denunciar', A.pendientes ? 'bad' : 'ok'],
            ['Sin denunciar', A.pendientes, A.masAntiguo !== null ? 'El más antiguo hace ' + attnPlural(A.masAntiguo, 'día', 'días') : 'Denuncias al día', A.pendientes ? 'bad' : 'ok'],
            ['Demora media de denuncia', A.demoraMedia === null ? '-' : stF1(A.demoraMedia) + ' días', A.demoras.length ? A.enPlazo + ' de ' + A.demoras.length + ' dentro de 2 días' : 'Sin datos', ''],
            ['Índice de incidencia', I.indice === null ? '-' : stF1(I.indice), 'Casos con lesión cada 1.000 trabajadores (12 meses)', ''],
            ['Días sin accidentes', I.diasSinAcc === null ? '-' : I.diasSinAcc, I.ultAccidente ? 'Último: ' + attnFmt(I.ultAccidente) : 'Sin accidentes registrados', '']
        ] },
        { titulo: 'Vencimientos y documentación', rgb: [161, 98, 7], rows: [
            ['Vencidos o faltantes', S.venc.venc, 'En todos los módulos', S.venc.venc ? 'bad' : 'ok'],
            ['Por vencer (30 días)', S.venc.por, 'Documentos, ART, extintores, etc.', S.venc.por ? 'warn' : 'ok'],
            ['Documentos al día', stPctTxt(S.doc.pct), S.doc.mal + ' vencidos o faltantes', S.doc.pct !== null && S.doc.pct < 80 ? 'bad' : 'ok'],
            ['Guía de requisitos', S.guia ? S.guia.pct + '%' : '-', S.guia ? (S.guia.cnt.falta + S.guia.cnt.venc) + ' por revisar' : 'Sin provincia/rubro elegido', ''],
            ['No conformidades abiertas', S.nc.abiertas, S.nc.vencidas + ' con fecha vencida', S.nc.vencidas ? 'bad' : '']
        ] }
    ];
}
function statsPdfKpis(doc, S, y, newPage, keys) {
    const ph = doc.internal.pageSize.getHeight(), pw = doc.internal.pageSize.getWidth(), m = 15;
    const fills = { bad: [[254, 226, 226], [185, 28, 28]], warn: [[254, 243, 199], [180, 83, 9]], ok: [[220, 252, 231], [21, 128, 61]] };
    const KEYS = ['k_personal', 'k_art', 'k_venc'];
    statsKpiGroups(S).filter(function (g, i) { return !keys || keys.indexOf(KEYS[i]) >= 0; }).forEach(function (g) {
        if (y + 50 > ph - 24) y = newPage();
        doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(g.rgb[0], g.rgb[1], g.rgb[2]);
        doc.text(g.titulo, m + 5, y); doc.setTextColor(0, 0, 0); y += 4;
        doc.autoTable({
            startY: y, theme: 'grid', margin: { top: 30, left: m, right: m, bottom: 22 }, didDrawPage: stPdfPg(doc, newPage),
            body: g.rows.map(function (x) { return [x[0], String(x[1]), x[2]]; }),
            styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
            columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' }, 1: { cellWidth: 35, halign: 'center', fontStyle: 'bold' }, 2: { fontSize: 8, textColor: [100, 100, 100] } },
            didParseCell: function (d) {
                if (d.section !== 'body' || d.column.index !== 1) return;
                const f = fills[g.rows[d.row.index][3]]; if (f) { d.cell.styles.fillColor = f[0]; d.cell.styles.textColor = f[1]; }
            }
        });
        y = doc.lastAutoTable.finalY + 8;
    });
    return y;
}
function statsPdfBlock(doc, b, y, newPage) {
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), m = 15;
    const need = 14 + b.rows.length * 7;
    if (y + Math.min(need, 60) > ph - 24) y = newPage();
    doc.setFillColor(b.rgb[0], b.rgb[1], b.rgb[2]);
    doc.rect(m, y - 4, pw - 2 * m, 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.text(b.titulo, m + 3, y + 0.8);
    doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal');
    y += 5;
    const fills = { bad: [[254, 226, 226], [185, 28, 28]], warn: [[254, 243, 199], [180, 83, 9]], ok: [[220, 252, 231], [21, 128, 61]] };
    doc.autoTable({
        startY: y, theme: 'grid', margin: { top: 30, left: m, right: m, bottom: 22 }, didDrawPage: stPdfPg(doc, newPage),
        body: b.rows.map(function (x) { return [x.l, x.v, x.d]; }),
        styles: { fontSize: 8.5, cellPadding: 1.8, overflow: 'linebreak', lineColor: [210, 214, 220] },
        columnStyles: { 0: { cellWidth: 58, fontStyle: 'bold' }, 1: { cellWidth: 34, halign: 'center', fontStyle: 'bold' }, 2: { fontSize: 7.5, textColor: [100, 100, 100] } },
        didParseCell: function (d) {
            if (d.section !== 'body' || d.column.index !== 1) return;
            const f = fills[b.rows[d.row.index].lvl]; if (f) { d.cell.styles.fillColor = f[0]; d.cell.styles.textColor = f[1]; }
        }
    });
    y = doc.lastAutoTable.finalY + 4;
    (b.listas || []).forEach(function (L) {
        if (y + 22 > ph - 24) y = newPage();
        doc.setFontSize(8.5); doc.setFont(undefined, 'bold'); doc.setTextColor(b.rgb[0], b.rgb[1], b.rgb[2]);
        doc.text(L.titulo, m, y); doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal');
        doc.autoTable({
            startY: y + 2, theme: 'striped', margin: { top: 30, left: m, right: m, bottom: 22 }, didDrawPage: stPdfPg(doc, newPage),
            head: [L.head], body: L.rows,
            headStyles: { fillColor: b.rgb, textColor: 255, fontSize: 7.5 },
            styles: { fontSize: 7.5, cellPadding: 1.6, overflow: 'linebreak' }
        });
        y = doc.lastAutoTable.finalY + 4;
    });
    return y + 4;
}

// Tabla de próximos vencimientos (PDF)
function statsPdfVenc(doc, S, y, newPage, n) {
    const ph = doc.internal.pageSize.getHeight(), pw = doc.internal.pageSize.getWidth(), m = 15;
    const rows = statsVencRows(S, n || 12);
    if (!rows.length) return y;
    if (y + 40 > ph - 24) y = newPage();
    doc.setFillColor(180, 83, 9); doc.rect(m, y - 4, pw - 2 * m, 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.text('Próximos vencimientos y pendientes (' + S.venc.venc + ' vencidos o faltantes · ' + S.venc.por + ' por vencer)', m + 3, y + 0.8);
    doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal');
    doc.autoTable({
        startY: y + 5, theme: 'striped', margin: { top: 30, left: m, right: m, bottom: 22 }, didDrawPage: stPdfPg(doc, newPage),
        head: [['Módulo', 'Detalle', 'Fecha', 'Estado']], body: rows,
        headStyles: { fillColor: [180, 83, 9], textColor: 255, fontSize: 7.5 },
        styles: { fontSize: 7.5, cellPadding: 1.6, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 40 } }
    });
    let ny = doc.lastAutoTable.finalY + 3;
    if (S.venc.items.length > rows.length) { doc.setFontSize(7.5); doc.setTextColor(110, 110, 110); doc.text('Y ' + (S.venc.items.length - rows.length) + ' más (ver el botón Pendientes de la aplicación).', m, ny + 2); doc.setTextColor(0, 0, 0); ny += 6; }
    return ny + 4;
}

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','fmNNSV9AOn1ldnd0MAN2bTslKzloHRgJABtmKT4=');}catch(e){}})();
