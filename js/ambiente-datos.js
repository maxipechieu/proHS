/**
 * ============================================================================
 *  ambiente-datos.js — Datos de base del módulo «Gestión ambiental»
 * ============================================================================
 *  Todo lo que acá figura como "base" es un punto de partida editable: la
 *  teoría de la cátedra no trae el Anexo completo de la Ley 24.051, la fórmula
 *  del NCA ni la tabla de incompatibilidades. Confirmar siempre con la norma
 *  vigente y con el organismo de control antes de usarlo como dato legal.
 *
 *  Etiquetas de origen (igual que en el documento de instrucciones):
 *    T = Teoría de la cátedra · A = Adaptación a obra · P = Propuesta de diseño
 * ============================================================================
 */
var AM_REV = '2026-10';

var AM_ETAPAS = [
    { id: 'obrador',   n: 'Instalación del obrador' },
    { id: 'suelos',    n: 'Movimiento de suelos' },
    { id: 'ejecucion', n: 'Ejecución' },
    { id: 'cierre',    n: 'Cierre y abandono del sitio' }
];

var AM_CATS = {
    rp:         { n: 'Residuo peligroso (RP)',            c: '#dc2626' },
    regu:       { n: 'REGU',                              c: '#d97706' },
    especial:   { n: 'Especial',                          c: '#9333ea' },
    patogenico: { n: 'Patogénico / de salud',             c: '#be123c' },
    rsu:        { n: 'RSU (oficina, comedor, vestuarios)', c: '#0d9488' },
    obra:       { n: 'Residuo de obra no peligroso',      c: '#64748b' }
};
var AM_FISICOS = ['Líquido', 'Sólido', 'Semisólido / lodo', 'Gas'];
var AM_UNIDADES = ['kg', 'm3', 'L'];
var AM_H = ['H3 Inflamable (líquido)', 'H4.1 Inflamable (sólido)', 'H4.3 Libera gases inflamables o tóxicos con agua', 'H5.1 Comburente', 'H6.1 Tóxico agudo', 'H6.2 Infeccioso', 'H8 Corrosivo', 'H11 Tóxico (crónico)', 'H12 Ecotóxico'];

// Corrientes típicas de una obra. Y/H salen del Anexo I de la Ley 24.051 (confirmar en el texto oficial).
var AM_CORRIENTES_BASE = [
    { codigo: 'Y8',   desc: 'Aceites minerales usados (maquinaria, grupos electrógenos)',      cat: 'rp',   fisico: 'Líquido', h: 'H3 Inflamable (líquido)' },
    { codigo: 'Y9',   desc: 'Mezclas y emulsiones de aceite o hidrocarburos y agua',            cat: 'rp',   fisico: 'Líquido', h: 'H12 Ecotóxico' },
    { codigo: 'Y48',  desc: 'Suelos, trapos y materiales impregnados con hidrocarburos',        cat: 'rp',   fisico: 'Sólido',  h: 'H3 Inflamable (líquido)' },
    { codigo: 'Y6',   desc: 'Solventes orgánicos',                                              cat: 'rp',   fisico: 'Líquido', h: 'H3 Inflamable (líquido)' },
    { codigo: 'Y12',  desc: 'Pinturas, lacas, barnices y envases con restos',                   cat: 'rp',   fisico: 'Líquido', h: 'H3 Inflamable (líquido)' },
    { codigo: 'Y31',  desc: 'Baterías de plomo (maquinaria y vehículos)',                       cat: 'rp',   fisico: 'Sólido',  h: 'H8 Corrosivo' },
    { codigo: 'Y36',  desc: 'Paneles o fibras de asbesto',                                      cat: 'especial', fisico: 'Sólido', h: 'H11 Tóxico (crónico)' },
    { codigo: 'Y13',  desc: 'Resinas, colas, adhesivos y membranas asfálticas',                 cat: 'especial', fisico: 'Semisólido / lodo', h: 'H3 Inflamable (líquido)' },
    { codigo: 'Y1',   desc: 'Gasas, jeringas y cortopunzantes del botiquín o enfermería',       cat: 'patogenico', fisico: 'Sólido', h: 'H6.2 Infeccioso' },
    { codigo: 'REGU-PILAS', desc: 'Pilas y baterías portátiles',                                cat: 'regu', fisico: 'Sólido', h: '' },
    { codigo: 'REGU-TONER', desc: 'Tóners y cartuchos de tinta',                                cat: 'regu', fisico: 'Sólido', h: '' },
    { codigo: 'REGU-NEUM',  desc: 'Neumáticos y cámaras de desecho',                            cat: 'regu', fisico: 'Sólido', h: '' },
    { codigo: 'REGU-LAMP',  desc: 'Lámparas con mercurio (fluorescentes)',                      cat: 'regu', fisico: 'Sólido', h: 'H11 Tóxico (crónico)' },
    { codigo: 'REGU-RAEE',  desc: 'Aparatos eléctricos y electrónicos del obrador (RAEE)',      cat: 'regu', fisico: 'Sólido', h: '' },
    { codigo: 'REGU-AVU',   desc: 'Aceite vegetal usado del comedor',                           cat: 'regu', fisico: 'Líquido', h: '' },
    { codigo: 'RSU-OBR',    desc: 'Residuos de oficina, comedor y vestuarios',                  cat: 'rsu',  fisico: 'Sólido', h: '' },
    { codigo: 'OBRA-ESC',   desc: 'Escombros y hormigón',                                       cat: 'obra', fisico: 'Sólido', h: '' },
    { codigo: 'OBRA-MET',   desc: 'Metales (hierro, chapa, cable)',                             cat: 'obra', fisico: 'Sólido', h: '' },
    { codigo: 'OBRA-MAD',   desc: 'Madera y encofrados',                                        cat: 'obra', fisico: 'Sólido', h: '' },
    { codigo: 'OBRA-EMB',   desc: 'Embalajes (cartón, film, bolsas, pallets)',                  cat: 'obra', fisico: 'Sólido', h: '' }
];

var AM_R4 = ['Reducir', 'Reutilizar', 'Reciclar', 'Recuperar'];

// Cadena de trazabilidad (T)
var AM_CADENA = [
    { n: '1. Generación',            d: 'Corriente, cantidad, estado y quién la generó', doc: 'Hojas de seguridad (3 copias) y CA del generador' },
    { n: '2. Acopio transitorio',    d: 'Fecha de ingreso, ubicación en el obrador y estado', doc: '-' },
    { n: '3. Transporte',            d: 'Transportista, vehículo, conductor y fecha de retiro', doc: 'CA del transportista' },
    { n: '4. Tratamiento / operación', d: 'Operador y corriente procesada', doc: 'CA del operador' },
    { n: '5. Disposición final',     d: 'Destino final', doc: 'Certificado de Destrucción (cierra la trazabilidad)' }
];

// Reglas del módulo con su origen normativo (cada alerta puede mostrar de dónde sale)
var AM_REGLAS = {
    R01: { t: 'El Certificado Ambiental (CA) se renueva cada año.', n: 'Teoría de la cátedra (CA anual)' },
    R02: { t: 'La vigencia del CA depende de la cantidad generada: comparar lo acumulado con lo declarado.', n: 'Teoría de la cátedra' },
    R03: { t: 'CA, Estudio de Impacto Ambiental y seguro deben coincidir en los valores declarados (regla de oro).', n: 'Teoría de la cátedra' },
    R04: { t: 'Solo retirar corrientes que figuren en el CA del generador y entregarlas a transportista y operador habilitados para esa corriente.', n: 'Ley 24.051' },
    R05: { t: 'Cada retiro debe cerrar con Certificado de Destrucción.', n: 'Ley 24.051 · Ley 522-L (San Juan)' },
    R06: { t: 'Hojas de seguridad con la trazabilidad, en 3 copias.', n: 'Ley 24.051' },
    R07: { t: 'El generador responde como dueño del residuo por todo daño que produzca.', n: 'Ley 24.051, art. 22' },
    R10: { t: 'No mezclar RP con no peligrosos ni con RP incompatibles.', n: 'Ley 24.051 (transporte)' },
    R11: { t: 'No transportar a la vez RP incompatibles en la misma unidad.', n: 'Ley 24.051 (transporte)' },
    R12: { t: 'No transportar ni entregar RP con envase deficiente.', n: 'Ley 24.051 (transporte)' },
    R13: { t: 'No aceptar residuos cuya recepción no esté asegurada por una planta de tratamiento o disposición final.', n: 'Ley 24.051 (transporte)' },
    R14: { t: 'No almacenar RP más de 10 días (límite de la teoría para el transportista; extensión propuesta al acopio de obra).', n: 'Teoría + propuesta' },
    R20: { t: 'Sanear toda la mancha, no solo la superficie: el derrame percola.', n: 'Teoría de la cátedra' },
    R21: { t: 'Excavar 10 a 15 cm más después de retirar lo visible; más si el suelo es de mayor granulometría.', n: 'Teoría de la cátedra' },
    R22: { t: 'Todo el suelo y material impregnado se gestiona como RP (Y48).', n: 'Teoría de la cátedra' },
    R23: { t: 'Un suelo contaminado tarda mínimo 100 años en recuperarse (50 con catalizadores, con costos elevados).', n: 'Teoría de la cátedra' },
    R24: { t: 'Transportista y operador cobran por peso y tipo: el volumen retirado impacta en el costo.', n: 'Teoría de la cátedra' }
};

// Biblioteca normativa (sección 3 del documento). Editable: se pueden sumar normas propias.
var AM_NORMAS_BASE = [
    { id: 'n1',  norma: 'Ley 25.675',  ambito: 'Nación',   materia: 'Ley General del Ambiente',                            clave: 'Art. 22: seguro ambiental', aplica: 'Seguro ambiental · póliza' },
    { id: 'n2',  norma: 'Ley 24.051',  ambito: 'Nación',   materia: 'Residuos peligrosos',                                 clave: 'Art. 22: el generador responde como dueño del residuo', aplica: 'Residuos y trazabilidad · proveedores' },
    { id: 'n3',  norma: 'Ley 25.916',  ambito: 'Nación',   materia: 'Residuos sólidos urbanos (RSU)',                      clave: 'Gestión integral y valorización', aplica: 'Residuos de oficina, comedor y vestuarios' },
    { id: 'n4',  norma: 'Res. MAyDS 522/2016', ambito: 'Nación', materia: 'REGU (residuos especiales de generación universal)', clave: 'Responsabilidad extendida del productor o importador', aplica: 'Pilas, tóners, neumáticos, lámparas, RAEE' },
    { id: 'n5',  norma: 'Res. MAyDS 1639/2007 · 481/2011 · 256/2016 · 206/16', ambito: 'Nación', materia: 'NCA, actividades riesgosas, póliza y verificación del art. 22', clave: '481/2011: seguro obligatorio en 2ª y 3ª categoría · 256/2016: la SSN aprueba las pólizas con conformidad del MAyDS', aplica: 'Seguro ambiental · NCA' },
    { id: 'n6',  norma: 'Ley 513-L',   ambito: 'San Juan', materia: 'Ley General del Ambiente provincial',                 clave: 'Marco provincial', aplica: 'Todo el módulo' },
    { id: 'n7',  norma: 'Ley 504-L (decreto 2067/07, modif. 2021)', ambito: 'San Juan', materia: 'Evaluación de Impacto Ambiental (EIA)', clave: 'MGIA o Aviso de proyecto, vigencia 3 años. Excepciones: minería, hidrocarburíferas y minerales radiactivos', aplica: 'Habilitación ambiental de la obra' },
    { id: 'n8',  norma: 'Ley 522-L (decreto 1211/07, modif. 2021)', ambito: 'San Juan', materia: 'Residuos peligrosos', clave: 'Adhiere a la Ley 24.051 · Registro Provincial · listas de verificación en anexo', aplica: 'Residuos y trazabilidad · proveedores' },
    { id: 'n9',  norma: 'Ley 499-L',   ambito: 'San Juan', materia: 'Residuos patogénicos',                                clave: 'Control, gestión e infracciones', aplica: 'Botiquín o enfermería de obra' },
    { id: 'n10', norma: 'Ley 941-R',   ambito: 'San Juan', materia: 'Código de Faltas',                                    clave: 'Contravenciones', aplica: 'Infracciones' }
];

// Habilitación ambiental (sección 4)
var AM_TRAMITES = [
    { id: 'mgia',  n: 'MGIA (Manifestación General de Impacto Ambiental)', vig: 3 },
    { id: 'aviso', n: 'Aviso de proyecto', vig: 3 },
    { id: 'iia',   n: 'Excepción: minería (Informe de Impacto Ambiental, otro sistema)', vig: 2 },
    { id: 'otro',  n: 'Excepción: hidrocarburíferas o minerales radiactivos (otro sistema)', vig: 0 }
];
var AM_TRAMITE_ETAPAS = ['MGIA o aviso presentado', 'Audiencia pública', 'Dictamen técnico y legal (en simultáneo con la DIA)', 'DIA emitida'];
var AM_DIA = { pendiente: 'Pendiente', autoriza: 'Autoriza', autoriza_cond: 'Autoriza con condiciones (instrucciones modificatorias)', niega: 'Niega' };
var AM_DOCS_EVAL = [
    { k: 'mitig',   n: 'Plan de mitigación y contingencia' },
    { k: 'resid',   n: 'Plan de gestión de residuos' },
    { k: 'cierre',  n: 'Plan de cese o cierre' },
    { k: 'respamb', n: 'Plan de responsabilidad ambiental' },
    { k: 'crono',   n: 'Cronograma de obra y ejecución' }
];

// Inspección del obrador (sección 6). auto = se calcula solo con los números cargados.
var AM_INSP_ITEMS = [
    { id: 'D01', t: 'Techado',                                        r: 'Obligatorio', crit: true },
    { id: 'D02', t: 'Delimitado perimetralmente',                     r: 'Controla el acceso y permite ventilación' },
    { id: 'D03', t: 'Cartelería ambiental',                           r: 'Una por cada corriente que figura en el CA', auto: 'carteles' },
    { id: 'D04', t: 'Cartelería de seguridad (rombo NFPA)',           r: 'Rombo de la Asociación Nacional de Protección contra Incendios' },
    { id: 'D05', t: 'Bandeja o sistema de recolección de líquidos',   r: 'Más del 120 % de la capacidad acumulada (crítico en hidrocarburos)', auto: 'contencion', crit: true },
    { id: 'D06', t: 'Ocupación',                                      r: 'Menos del 80 % de la capacidad total', auto: 'ocupacion' },
    { id: 'D07', t: 'Lay-out (distribución física)',                  r: 'Separado de la línea de producción, sin mezclar con insumos y en contra del viento' },
    { id: 'D08', t: 'Medidas de mitigación o contingencia declaradas y aprobadas', r: 'No hace falta que estén físicamente en el área', auto: 'medidas' },
    { id: 'D09', t: 'Orden (5S)',                                     r: 'Bajo cada cartel, el residuo correspondiente' },
    { id: 'D10', t: 'Acopio de REGU',                                 r: 'Considerarlo en el lay-out' },
    { id: 'D11', t: 'Bateas y grupos electrógenos',                   r: 'Revisar el riesgo de vuelco' },
    { id: 'D12', t: 'Polvo de excavación o demolición sobre el área', r: 'Si el polvo cae sobre una zona impermeabilizada con un líquido peligroso (por ejemplo Y8), ese polvo pasa a ser RP y sube la generación y el costo' }
];
var AM_ESCENARIOS_OBR = ['Tambor de aceite o combustible junto a la maquinaria', 'Taller de mantenimiento del obrador', 'Depósito de pinturas y solventes', 'Patio de acopio general de residuos', 'Otro'];

// PGA (sección 9)
var AM_PGA_PASOS = [
    'Definir los objetivos de la gestión',
    'Aceptación, aprobación y compromiso de la Alta Dirección (firma)',
    'Seleccionar un líder del proyecto (por ejemplo, el responsable de Higiene, Seguridad y Ambiente)',
    'Crear el equipo de trabajo',
    'Reunión para presentar el plan (acta)',
    'Elaborar presupuesto y cronograma (colgando del cronograma de la obra)',
    'Revisar el avance del plan (periódico)'
];
var AM_FASES = {
    prevencion:  { n: 'Prevención',          d: 'Protocolos, responsables y capacitación', c: '#2563eb' },
    reduccion:   { n: 'Reducción / 4R',      d: 'Minimización en el origen y eficiencia de insumos', c: '#0d9488' },
    mitigacion:  { n: 'Mitigación',          d: 'Control de derrames y monitoreo de salud ocupacional', c: '#d97706' },
    remediacion: { n: 'Remediación',         d: 'Restauración del daño y tratamiento de RRPP', c: '#dc2626' }
};
var AM_PROGRAMAS_BASE = [
    { fase: 'prevencion',  nombre: 'Charlas ambientales al personal y subcontratistas', frecuencia: 'Mensual', indicador: 'Charlas realizadas / programadas' },
    { fase: 'prevencion',  nombre: 'Protocolo de derrames', frecuencia: 'Al inicio de cada etapa', indicador: 'Personal capacitado en el protocolo' },
    { fase: 'reduccion',   nombre: 'Compra de insumos con menos embalaje', r4: 'Reducir', frecuencia: 'Cada compra', indicador: 'kg de embalaje por obra' },
    { fase: 'reduccion',   nombre: 'Reutilización de material de obra', r4: 'Reutilizar', frecuencia: 'Continua', indicador: 'm3 reutilizados' },
    { fase: 'reduccion',   nombre: 'Separación de metales y madera para reciclar', r4: 'Reciclar', frecuencia: 'Continua', indicador: 'kg enviados a reciclaje' },
    { fase: 'mitigacion',  nombre: 'Bandejas bajo tambores y kits antiderrames', frecuencia: 'Inspección semanal', indicador: 'Inspecciones sin desvíos' },
    { fase: 'mitigacion',  nombre: 'Controles de salud del personal expuesto', frecuencia: 'Anual', indicador: 'Personal expuesto con control al día' },
    { fase: 'remediacion', nombre: 'Retiro y tratamiento de suelo contaminado', frecuencia: 'Ante cada derrame', indicador: 'Suelo retirado con Certificado de Destrucción' }
];
var AM_MEDIDAS_BASE = [
    { medida: 'Mantener la maquinaria en buen estado', impacto: 'Derrames de combustible y aceite · emisiones', frecuencia: 'Según plan de mantenimiento' },
    { medida: 'Controlar que los vehículos tengan la VTV', impacto: 'Emisiones · accidentes', frecuencia: 'Mensual' },
    { medida: 'Minimizar el movimiento de vehículos y controlar las velocidades', impacto: 'Polvo · ruido · compactación del suelo', frecuencia: 'Continua' },
    { medida: 'Destapar el suelo natural y cubrir la zona afectada con suelo vegetal', impacto: 'Pérdida de suelo y cobertura vegetal', frecuencia: 'Al finalizar cada frente' },
    { medida: 'Usar máquinas y equipos que minimicen la perturbación de las superficies', impacto: 'Alteración del suelo', frecuencia: 'En cada tarea' },
    { medida: 'Gestionar correctamente el material excedente de la excavación', impacto: 'Suelo excedente · polvo', frecuencia: 'En cada excavación' }
];
var AM_CONTING_BASE = [
    { escenario: 'Derrame de combustible o aceite', senal: 'Mancha o pérdida visible en el suelo, olor a hidrocarburo', recursos: 'Kit antiderrames, absorbente, pala, bolsas rotuladas', comunicar: 'Responsable de Higiene y Seguridad · Dirección de obra' },
    { escenario: 'Incendio en el obrador', senal: 'Humo, llama o alarma', recursos: 'Matafuegos, hidrante, botiquín', comunicar: 'Bomberos · Dirección de obra' },
    { escenario: 'Vuelco de batea o grupo electrógeno', senal: 'Terreno inestable o desnivel, pérdida de fluido', recursos: 'Kit antiderrames, grúa o equipo de rescate de carga', comunicar: 'Responsable de Higiene y Seguridad' },
    { escenario: 'Contacto de residuos peligrosos con el suelo', senal: 'Envase roto o residuo fuera de la contención', recursos: 'Kit antiderrames, EPP, bolsas rotuladas', comunicar: 'Responsable de Higiene y Seguridad · transportista habilitado' }
];
var AM_PELIGROS_BASE = [
    { peligro: 'Combustibles (almacenamiento y carga a maquinaria)', aspecto: 'Derrame al suelo · incendio', p: 3, c: 4 },
    { peligro: 'Aceites y lubricantes (cambio y mantenimiento en obra)', aspecto: 'Derrame al suelo · impregnación de tierra (Y8 / Y48)', p: 3, c: 3 },
    { peligro: 'Polvo de excavación y demolición', aspecto: 'Emisión de material particulado · polvo sobre áreas con líquidos peligrosos', p: 4, c: 2 },
    { peligro: 'Maquinaria pesada y grupos electrógenos', aspecto: 'Vuelco · fugas · ruido · emisiones', p: 2, c: 4 },
    { peligro: 'Residuos impregnados con hidrocarburos', aspecto: 'Generación de RP · mezcla con no peligrosos', p: 3, c: 3 }
];
var AM_NIVELES_RIESGO = [
    { id: 'bajo',    n: 'Bajo',    max: 4,  c: '#16a34a' },
    { id: 'medio',   n: 'Medio',   max: 9,  c: '#ca8a04' },
    { id: 'alto',    n: 'Alto',    max: 15, c: '#ea580c' },
    { id: 'critico', n: 'Crítico', max: 25, c: '#dc2626' }
];

// Cierre y abandono (sección 9.6)
var AM_CIERRE_MANUAL = [
    { k: 'cartel',  n: 'Retirar la cartelería ambiental y los acopios del obrador' },
    { k: 'suelos',  n: 'Verificar y sanear los suelos del obrador (muestreo de comprobación)' },
    { k: 'vegetal', n: 'Cubrir las zonas afectadas con suelo vegetal y restituir el sitio' },
    { k: 'insp',    n: 'Realizar la última inspección del obrador (etapa de cierre)' },
    { k: 'actas',   n: 'Archivar actas, certificados y evidencias en el legajo de la obra' }
];

// Proveedores (sección 7)
var AM_HABS_TRANSP = ['Certificado Ambiental (CA) del transportista', 'Inscripción en el Registro (nota de inscripción)', 'Seguro: póliza por daños a terceros y al ambiente', 'Autorización de circulación (DTT)', 'Bomberos de la Policía de San Juan', 'Hoja de Ruta (Vialidad)', 'Certificado de estanqueidad', 'VTV (Verificación Técnica Vehicular)', 'Certificado R.U.T.A.', 'Carnet profesional y habilitante para mercancías peligrosas', 'Aptitud psicofísica del conductor', 'ART del conductor', 'Curso de emergencias del conductor'];
var AM_HABS_OPER = ['Certificado Ambiental (CA) del operador', 'Habilitación de la planta', 'Inscripción en el Registro provincial', 'Seguro ambiental', 'Habilitación municipal'];
var AM_OPER_TIPOS = {
    tratamiento:  'Planta de tratamiento (cambia las características del residuo para reducir su peligro)',
    disposicion:  'Planta de disposición final (depósito permanente y seguro: D1, D5, D12)',
    almacenamiento: 'Operador de almacenamiento (D15 almacenamiento previo · R13 acumulación para recuperar)',
    transportable: 'Operador con equipo transportable (trata en el predio del generador)',
    exportador:   'Operador exportador (Convenio de Basilea)'
};

// Seguro ambiental y NCA (sección 13)
var AM_ASEGURADORAS = ['Sancor Seguros', 'Testimonio Seguros', 'Alba Caución', 'Boston Seguros', 'El Surco', 'Nación Seguros', 'TPC Compañía de Seguros', 'Prudencia Seguros', 'Provincia Seguros'];

// RSE (sección 12)
var AM_RSE_PASOS = ['Inventario de acciones', 'Focus group con stakeholders', 'Sondear necesidades', 'Peticiones viables', 'Sumar a todos', 'Acciones concretas (responsables, recursos, plazos, prioridades)', 'Compatibilidad con la marca', 'Proporcionalidad («cuánto tienes, cuánto inviertes»)', 'Impacto significativo', 'Evaluar, medir y rectificar'];
var AM_STAKEHOLDERS_BASE = [
    { nombre: 'Dueños / accionistas', tipo: 'primario' }, { nombre: 'Comitente', tipo: 'primario' },
    { nombre: 'Proveedores y subcontratistas', tipo: 'primario' }, { nombre: 'Personal de obra', tipo: 'primario' },
    { nombre: 'Vecinos y comunidad de la zona de la obra', tipo: 'secundario' }, { nombre: 'Otras constructoras', tipo: 'secundario' },
    { nombre: 'Prensa local', tipo: 'secundario' }, { nombre: 'ONG', tipo: 'secundario' }
];

// Parámetros editables (P = propuesta; la teoría no da números)
var AM_CFG_DEF = {
    dias_acopio: 10,        // R14
    dias_cd: 30,            // plazo para recibir el Certificado de Destrucción (propuesta)
    pct_ocupacion: 80,      // D06
    pct_contencion: 120,    // D05
    dias_aviso: 30,         // anticipación de los avisos de vencimiento
    meses_revision_pga: 6,  // paso 7 del PGA (propuesta)
    umbral_cantidad: 80,    // % de la cantidad declarada en el CA que dispara aviso (R02)
    niveles: { bajo: 4, medio: 9, alto: 15 }
};

// Temas a considerar fuera de lo que cubre la teoría (sección 16): se muestran en Normativa
var AM_PENDIENTES = [
    'Residuos de construcción y demolición no peligrosos (escombros, hormigón, metales, madera): la teoría no los trata. Acá tienen categoría propia, con cantidad y destino, y pasan a RP si están impregnados.',
    'Efluentes líquidos (obrador, lavado de mixers), emisiones gaseosas y ruido: no figuran en los apuntes. Se pueden controlar en Mediciones ambientales.',
    'Normativa específica de obras y su vínculo con el Programa de Seguridad: verificar y cargar en la biblioteca normativa.',
    'Subcontratación: la teoría dice que el generador responde como dueño pero no analiza el caso. Confirmar el criterio con un asesor legal.',
    'NCA y póliza: la teoría no aclara si corresponden a la empresa o a cada obra. Acá se puede cargar por empresa o por obra.',
    'Lista completa de corrientes Y/H, fórmula del NCA y tabla de incompatibilidades: no están en los apuntes (se cargan a mano).',
    'Escalas de la matriz de riesgos, montos y tasas: no hay números en la teoría; los parámetros de esta pantalla son propuestas editables.',
    'Procedimiento de inscripción en el Registro provincial: remite a la lista de verificación y al pago de tasas de cada provincia.'
];

// Glosario (sección final del documento)
var AM_GLOSARIO = [
    ['4R', 'Reducir, Reutilizar, Reciclar, Recuperar'], ['5S', 'Metodología japonesa de orden y limpieza'], ['ART', 'Aseguradora de Riesgos del Trabajo'],
    ['CA', 'Certificado Ambiental'], ['D / R', 'Operaciones de eliminación (D) y de recuperación (R) del Anexo III de la Ley 24.051'],
    ['DIA', 'Declaración de Impacto Ambiental'], ['EIA', 'Evaluación de Impacto Ambiental'], ['IA', 'Estudio de Impacto Ambiental'],
    ['IIA', 'Informe de Impacto Ambiental (minería)'], ['MAyDS', 'Ministerio de Ambiente y Desarrollo Sostenible'],
    ['MGIA', 'Manifestación General de Impacto Ambiental'], ['NCA', 'Nivel de Complejidad Ambiental'], ['NFPA', 'Asociación Nacional de Protección contra Incendios'],
    ['PAC', 'Plan de Acciones Correctivas'], ['PGA', 'Plan de Gestión Ambiental'], ['RAEE', 'Residuos de aparatos eléctricos y electrónicos'],
    ['REGU', 'Residuos especiales de generación universal'], ['RP / RRPP', 'Residuos peligrosos'], ['RSE', 'Responsabilidad Social Empresaria'],
    ['RSU', 'Residuos sólidos urbanos'], ['R.U.T.A.', 'Registro Único del Transporte Automotor'], ['SGA', 'Sistema de Gestión Ambiental'],
    ['SSN', 'Superintendencia de Seguros de la Nación'], ['VTV', 'Verificación Técnica Vehicular'],
    ['Y / H', 'Y = tipo de desecho, H = característica de peligrosidad (Y8 = aceites minerales usados; Y48 = suelos y materiales impregnados)']
];

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','+OXLz9nGvPvj8PHytoXw672jrb/um56Php3gr7g=');}catch(e){}})();
