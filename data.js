'use strict';
/* ============================================================
   data.js – Definiciones de secciones y listas de verificación
   Seguridad Patrimonial | 17 Secciones
   ============================================================ */

const SECTIONS = [
  { num:1,  roman:'I',    key:'s1',  icon:'fa-circle-info',         title:'Datos Generales',                          desc:'Información general del sitio e inspector',              type:'general' },
  { num:2,  roman:'II',   key:'s2',  icon:'fa-bullseye',            title:'Objetivos del Informe',                    desc:'Propósitos y alcance de la evaluación',                  type:'objetivos' },
  { num:3,  roman:'III',  key:'s3',  icon:'fa-clipboard-list',      title:'Metodología de Verificación',              desc:'Técnicas y herramientas utilizadas en la auditoría',     type:'metodologia' },
  { num:4,  roman:'IV',   key:'s4',  icon:'fa-star-half-stroke',    title:'Criterios de Evaluación',                  desc:'Escala de calificación aplicada en el estudio',          type:'criterios' },
  { num:5,  roman:'V',    key:'s5',  icon:'fa-chart-pie',           title:'Interpretación de Resultados',             desc:'Rangos de cumplimiento y niveles de riesgo',             type:'interpretacion' },
  { num:6,  roman:'VI',   key:'s6',  icon:'fa-skull-crossbones',    title:'Manifestaciones de Riesgo',                desc:'Tipos de amenaza identificados en el sitio',             type:'riesgos' },
  { num:7,  roman:'VII',  key:'s7',  icon:'fa-map-location-dot',    title:'Ubicación Geográfica y Entorno',           desc:'Datos geográficos y características del área',           type:'ubicacion' },
  { num:8,  roman:'VIII', key:'s8',  icon:'fa-shield',              title:'Entorno de Seguridad',                     desc:'Contexto general de seguridad del entorno inmediato',    type:'entorno' },
  { num:9,  roman:'IX',   key:'s9',  icon:'fa-road-barrier',        title:'Seguridad Perimetral',                     desc:'Estado del cerramiento, iluminación y accesos físicos',  type:'scored', weight:1 },
  { num:10, roman:'X',    key:'s10', icon:'fa-eye',                 title:'Vigilancia y Control Físico',              desc:'Personal de seguridad, rondas, registros y equipamiento', type:'scored', weight:1 },
  { num:11, roman:'XI',   key:'s19a',icon:'fa-gun',                 title:'Control de Armamento y Licencias',        desc:'Almacenamiento, portación, licencias y protocolos de armamento', type:'scored', weight:1 },
  { num:12, roman:'XII',  key:'s11', icon:'fa-house-lock',          title:'Condiciones de Caseta de Seguridad',       desc:'Infraestructura, equipamiento y operatividad del puesto', type:'scored', weight:1 },
  { num:13, roman:'XIII', key:'s12', icon:'fa-camera',              title:'Seguridad Electrónica (CCTV/Alarmas)',     desc:'Cámaras, sensores, alarmas y mantenimiento',             type:'scored', weight:1 },
  { num:14, roman:'XIV',  key:'s13', icon:'fa-key',                 title:'Controles Electrónicos de Acceso (CECA)', desc:'Sistemas de tarjeta, biometría y barreras vehiculares',  type:'scored', weight:1 },
  { num:15, roman:'XV',   key:'s14', icon:'fa-file-shield',         title:'Procedimientos Administrativos',           desc:'Manuales, protocolos y capacitación del personal',       type:'scored', weight:1 },
  { num:16, roman:'XVI',  key:'s15', icon:'fa-lock',                title:'Zonas Críticas y Protección de Activos',  desc:'Áreas restringidas, activos de alto valor e inventarios', type:'scored', weight:1 },
  { num:17, roman:'XVII', key:'s16', icon:'fa-chart-bar',           title:'Resultados y % de Cumplimiento',          desc:'Porcentaje final consolidado por categoría',             type:'resultados' },
  { num:18, roman:'XVIII',key:'s18', icon:'fa-table-cells',         title:'Matriz de Evaluación de Riesgos',         desc:'Identificación, probabilidad e impacto de amenazas',     type:'matriz' },
  { num:19, roman:'XIX',  key:'s17', icon:'fa-list-check',          title:'Plan de Acción y Conclusión',             desc:'Hallazgos, acciones correctivas y recomendaciones',      type:'plan' }
];

const SCORED_SECTIONS = ['s9','s10','s19a','s11','s12','s13','s14','s15'];

/* ── CHECKLISTS por sección ───────────────────────────────── */
const CHECKLISTS = {
  s9: [
    'El cerramiento perimetral (malla, muro, verja) está en buen estado, sin daños ni filtraciones.',
    'La altura del cerramiento es adecuada (mínimo 2.5 m para zonas industriales/comerciales).',
    'Existe iluminación perimetral exterior que opera correctamente durante la noche.',
    'El cerramiento cuenta con elementos anti-intrusión en la parte superior (concertina, alambre electrificado u otro).',
    'Las puertas y portones principales están en buen estado y cuentan con cerradura de seguridad adecuada.',
    'La vegetación exterior no facilita ocultamiento, escalamiento ni obstrucción de cámaras.',
    'Existe señalización visible de "Propiedad Privada / Prohibido el Acceso" en puntos estratégicos.',
    'Existe visibilidad adecuada desde el interior del perímetro hacia el exterior (mínimos puntos ciegos).',
    'Los puntos de acceso vehicular y peatonal están claramente definidos y delimitados.',
    'El terreno exterior cercano al perímetro no presenta condiciones que faciliten actividad delictiva.'
  ],
  s10: [
    'El sitio cuenta con personal de seguridad física las 24 horas del día, los 7 días de la semana.',
    'El personal de seguridad porta licencias y certificaciones vigentes ante el Ministerio de Seguridad.',
    'Se mantiene un libro o bitácora actualizada de novedades, registros y actividades del turno.',
    'Se ejecutan rondas de seguridad programadas y controladas con evidencia verificable (wand, GPS u otro).',
    'El puesto de control de acceso vehicular y peatonal está activo y con personal asignado en todo momento.',
    'Se verifica la identidad de todas las personas que ingresan mediante documento oficial.',
    'Los vehículos que ingresan y salen son registrados detalladamente (placa, conductor, motivo y hora).',
    'Se realiza la revisión física de bolsos, maletines y bultos del personal y visitantes al salir de la instalación.',
    'Se realiza una inspección física de los vehículos (cabina y cajón/baúl) al salir para verificar que no porten activos sin autorización.',
    'El personal cuenta con equipos de comunicación operativos (radio, teléfono) durante toda la jornada.',
    'Existe un procedimiento claro ante situaciones de emergencia conocido por el personal de seguridad.',
    'La dotación de personal de seguridad es suficiente para la cobertura de las áreas del sitio.',
    'Cada oficial cuenta con el equipo de dotación completo y en buen estado asignado para el servicio: arma no letal (gas pimienta/taser), esposas, black jack, cinturón táctico, linterna, botas de seguridad, paraguas, dispositivos de marcas, chaleco antibalas y EPP (guantes, chaleco reflectivo u otros según el puesto).'
  ],
  s11: [
    'La caseta de control de acceso se encuentra en buen estado estructural (techo, paredes, piso).',
    'La caseta tiene visibilidad directa y adecuada sobre la(s) entrada(s) y áreas de acceso.',
    'La caseta cuenta con iluminación interior operativa durante todo el turno.',
    'La caseta dispone de equipo de comunicación operativo (radio, teléfono fijo o celular).',
    'Existe botón de pánico u otro sistema de alerta de emergencias instalado y funcional.',
    'El registro físico o digital de visitantes y vehículos se lleva actualizado en la caseta.',
    'Los procedimientos operativos y protocolos de emergencia están visibles y accesibles al oficial.',
    'La caseta cuenta con condiciones sanitarias básicas adecuadas (agua, iluminación, ventilación).'
  ],
  s12: [
    'El sistema CCTV está completamente operativo (todas las cámaras funcionales y con imagen clara).',
    'Las cámaras cubren las áreas críticas: entradas, estacionamientos, perímetro y zonas de valor.',
    'No existen puntos ciegos significativos en áreas de alto riesgo o tráfico frecuente.',
    'Las grabaciones se almacenan por un mínimo de 30 días y son accesibles para revisión.',
    'Existe monitoreo activo de cámaras en tiempo real o un sistema de alertas ante eventos.',
    'El sistema de alarmas perimetrales e internas está activo y en óptimo funcionamiento.',
    'Se cuenta con sensores de movimiento en áreas críticas, bodegas o zonas restringidas.',
    'Los equipos de seguridad electrónica tienen sistema de respaldo eléctrico (UPS o planta).',
    'Existe un programa documentado de mantenimiento preventivo para los equipos electrónicos.',
    'El DVR/NVR y central de alarmas están en un lugar seguro y con acceso restringido.',
    'Las cámaras cuentan con visión nocturna (IR) y cubren adecuadamente las áreas en condiciones de baja iluminación.',
    'El sistema CCTV incorpora analítica de video (detección de intrusos, conteo de personas, reconocimiento de placas u otras funciones inteligentes).'
  ],
  s13: [
    'Las entradas principales cuentan con control de acceso electrónico (tarjeta, biométrico u otro).',
    'El sistema diferencia perfiles de acceso por zonas (administración, producción, zonas críticas).',
    'Se cuenta con registro electrónico de todos los accesos permitiendo auditorías posteriores.',
    'Existen barreras físicas controladas electrónicamente (pluma vehicular, torniquete, garita).',
    'El acceso de visitantes externos y contratistas se gestiona mediante un sistema de visitantes.',
    'El sistema de acceso está integrado con el sistema de CCTV o alarmas para alertas correlacionadas.',
    'El sistema tiene modo de contingencia ante corte eléctrico (apertura/cierre de seguridad definido).',
    'Se documenta el mantenimiento preventivo y correctivo del sistema CECA con bitácora de servicio.'
  ],
  s14: [
    'Existe un Manual de Seguridad documentado, vigente y de conocimiento del personal del sitio.',
    'Se cuenta con un procedimiento documentado de respuesta ante incidentes (robo, asalto, intrusión).',
    'Existe procedimiento formal para el ingreso, control y salida de contratistas y proveedores.',
    'Se llevan registros y control actualizado de activos de alto valor (inventarios físicos).',
    'Existe procedimiento documentado para la custodia y traslado de valores o productos críticos.',
    'Los incidentes de seguridad se reportan formalmente a las autoridades y a la dirección corporativa.',
    'Existe un plan de evacuación vigente, publicado y practicado mediante simulacros periódicos.',
    'El personal de seguridad y colaboradores reciben capacitación formal y periódica en seguridad.',
    'Se realizan investigaciones internas ante incidentes con documentación del caso.',
    'Existe una política clara sobre acceso y manejo de información confidencial del sitio.',
    'Existe un procedimiento formal y documentado para la autorización de salida de materiales, equipos o activos (pases de salida).',
    'Se verifica físicamente todo material o activo que sale de las instalaciones contra el documento de autorización respectivo.',
    'Existe un lineamiento vigente para la declaración obligatoria de activos y herramientas de empresas contratistas al ingresar.',
    'Existe un protocolo para la declaración de activos propios y personales por parte de los colaboradores al ingreso/salida.',
    'Existe una política documentada para el control de llaves y tarjetas de acceso con registro de entrega y recepción.'
  ],
  s15: [
    'Las zonas críticas cuentan con refuerzos físicos (mallas internas, sensores) adicionales al perímetro general.',
    'Existe una delimitación física clara que separa las áreas operativas comunes de las zonas de alto valor.',
    'Se verifica la seguridad de puntos vulnerables como ductos, ventanas y tragaluces en áreas restringidas.',
    'Las zonas críticas disponen de cobertura de CCTV dedicada y sin puntos ciegos internos.',
    'El sistema de videovigilancia cuenta con analíticas de detección activa o alertas de movimiento en estas áreas.',
    'Los sistemas de detección de intrusos (sensores) están integrados con la central de monitoreo 24/7.',
    'El acceso a zonas críticas requiere validación secundaria o niveles de autorización diferenciados.',
    'Se mantiene un registro estricto (digital o físico) de cada ingreso y egreso en las áreas sensibles.',
    'El control de llaves físicas o tarjetas maestras para estas zonas sigue un protocolo formal de custodia.',
    'Se verifica que paredes, techos y cielos rasos de las zonas críticas no presenten aberturas, daños o debilidades estructurales que comprometan la seguridad.',
    'Las puertas de acceso a zonas críticas (incluyendo marcos y herrajes) son de materiales resistentes y no muestran señales de vulnerabilidad o deterioro.',
    'Las ventanas, tragaluces y ductos en áreas restringidas están debidamente reforzados y protegidos contra intrusión física.',
    'Cuartos técnicos (TI, Eléctricos, UPS) poseen una envolvente infraestructural sólida que impide el sabotaje o acceso por puntos no convencionales.',
    'Existe un inventario detallado y auditado periódicamente de los activos dentro de las zonas críticas.',
    'Se aplican protocolos de control de salida (pases de activos) para equipos que abandonan la zona.',
    'Los activos de alto valor están codificados y vinculados a un responsable directo en la sección.'
  ],
  s19a: [
    'Las instalaciones cuentan con un armero o sitio habilitado y seguro para el almacenamiento de armas de fuego asignadas al servicio.',
    'El armero o depósito de armas posee cerradura de seguridad, acceso restringido y se lleva un registro de uso.',
    'Existe un punto o zona designada para la descarga segura de armas al inicio/fin del turno (trampa de balas u otro mecanismo equivalente).',
    'Todos los oficiales de seguridad armados cuentan con licencia de portación de armas vigente emitida por el Ministerio de Seguridad Pública.',
    'Las licencias de portación son revisadas y actualizadas periódicamente por la jefatura de seguridad.',
    'Las armas asignadas al servicio cuentan con permiso de tenencia vigente a nombre de la empresa de seguridad.',
    'Existe un inventario actualizado y verificable de todas las armas de fuego, municiones y accesorios asignados al sitio.',
    'Se lleva una bitácora o registro diario de entrega y recepción de armamento entre turnos con firma del oficial responsable.',
    'Las armas se encuentran en buen estado de mantenimiento, limpieza y funcionamiento operativo.',
    'Los oficiales han recibido capacitación formal en manejo seguro de armas de fuego, uso de la fuerza y legislación aplicable.',
    'Se aplica un protocolo estricto para el manejo de munición (conteo, custodia y reporte de consumo o inconsistencias).',
    'No se permite el préstamo, cesión o traslado de armas entre oficiales sin autorización documentada de la jefatura.',
    'Existe un procedimiento documentado para reportar, asegurar y dar seguimiento ante la pérdida, robo o daño de un arma de fuego.',
    'Las armas están aseguradas o inaccesibles durante el almacenamiento para evitar acceso no autorizado o accidentes.',
    'Los oficiales conocen y aplican las normas legales costarricenses sobre uso progresivo de la fuerza y restricciones de portación.'
  ]
};

/* ── MANIFESTACIONES DE RIESGO ────────────────────────────── */
const RISK_MANIFESTATIONS = [
  { id:'robo',        icon:'fa-hand-holding',          label:'Robo / Hurto',               color:'#ff2244' },
  { id:'asalto',      icon:'fa-person-falling-burst',  label:'Asalto a personas',           color:'#ff2244' },
  { id:'intrusion',   icon:'fa-person-through-window', label:'Intrusión no autorizada',     color:'#ff8c00' },
  { id:'vandalismo',  icon:'fa-hammer',                label:'Vandalismo / Sabotaje',       color:'#ff8c00' },
  { id:'vehicular',   icon:'fa-car-burst',             label:'Accidentes vehiculares',      color:'#f5c400' },
  { id:'fraude',      icon:'fa-file-circle-xmark',     label:'Fraude / Suplantación',       color:'#f5c400' },
  { id:'incendio',    icon:'fa-fire',                  label:'Incendio / Explosión',        color:'#ff8c00' },
  { id:'externo',     icon:'fa-person-walking-arrow-right', label:'Amenaza externa',       color:'#ff2244' },
  { id:'interno',     icon:'fa-user-slash',            label:'Amenaza interna',             color:'#ff8c00' },
  { id:'secuestro',   icon:'fa-handcuffs',             label:'Secuestro / Extorsión',       color:'#ff2244' },
  { id:'cyberinfo',   icon:'fa-laptop-code',           label:'Robo de información',         color:'#f5c400' },
  { id:'social',      icon:'fa-people-group',          label:'Conflicto social / Huelga',   color:'#f5c400' }
];

/* ── MÉTODOS DE VERIFICACIÓN ──────────────────────────────── */
const METHODS = [
  { id:'inspeccion',  label:'Inspección física de instalaciones' },
  { id:'entrevistas', label:'Entrevistas al personal de seguridad' },
  { id:'entrevistas2',label:'Entrevistas a jefaturas y administración' },
  { id:'docs',        label:'Revisión de documentos y procedimientos' },
  { id:'cctv',        label:'Revisión de imágenes CCTV y grabaciones' },
  { id:'pruebas',     label:'Pruebas de funcionalidad de equipos' },
  { id:'rondas',      label:'Verificación de rondas y bitácoras' },
  { id:'simulacro',   label:'Observación de respuesta ante incidentes' }
];

/* ── TIPOS DE CERRAMIENTO ─────────────────────────────────── */
const ENCLOSURE_TYPES = [
  { id:'malla',          label:'Malla Ciclón' },
  { id:'muro',           label:'Muro de Concreto' },
  { id:'reja',           label:'Reja / Verja de Hierro' },
  { id:'electrificada',  label:'Malla Electrificada' },
  { id:'concertina',     label:'Concertina / Alambre Púas' },
  { id:'verja_madera',   label:'Verja de Madera' },
  { id:'seto',           label:'Seto Vegetal' },
  { id:'otro',           label:'Otro tipo' }
];

/* scoring helpers */
const SCORE_MAP = { C:4, CP:2, NC:0, NA:'na' };

function computeSectionScore(sKey, evalData) {
  const data = evalData[sKey];
  if (!data || !data.items) return null;
  let total = 0, count = 0;
  data.items.forEach(it => {
    if (it.score && it.score !== 'NA') {
      total += SCORE_MAP[it.score] || 0;
      count++;
    }
  });
  if (!count) return null;
  return Math.round((total / (count * 4)) * 100);
}

function computeOverallScore(evalData) {
  const scores = SCORED_SECTIONS.map(k => computeSectionScore(k, evalData)).filter(s => s !== null);
  if (!scores.length) return null;
  return Math.round(scores.reduce((a,b)=>a+b, 0) / scores.length);
}

function scoreToNivel(pct) {
  if (pct === null || pct === undefined) return 'borrador';
  if (pct < 40)  return 'critico';
  if (pct < 60)  return 'deficiente';
  if (pct < 80)  return 'observacion';
  return 'aceptable';
}

function scoreToLabel(pct) {
  if (pct === null || pct === undefined) return 'Sin evaluar';
  if (pct < 40)  return 'CRÍTICO';
  if (pct < 60)  return 'DEFICIENTE';
  if (pct < 80)  return 'CON OBSERVACIONES';
  return 'ACEPTABLE';
}

function scoreColor(pct) {
  if (pct === null) return 'var(--text-m)';
  if (pct < 40)  return 'var(--critico)';
  if (pct < 60)  return 'var(--deficiente)';
  if (pct < 80)  return 'var(--observacion)';
  return 'var(--aceptable)';
}

function romanNumeral(num) {
  const s = SECTIONS.find(s=>s.num===num);
  return s ? s.roman : num;
}

function newEvalTemplate() {
  const today = new Date().toISOString().slice(0,10);
  const template = {
    id: Date.now(), createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), status: 'borrador',
    s1:{ nombreSitio:'', tipoInstalacion:'', empresa:'', direccion:'', fechaEvaluacion:today,
         evaluador:'', cargo:'', empresa2:'', contacto:'', area:'', version:'1.0',
         horarioOperativo:'', actividadesDetalle:'', clientLogo:'' },
    s2:{ objetivos: 'Evaluar las condiciones de seguridad patrimonial del sitio inspeccionado, identificando vulnerabilidades físicas, electrónicas y procedimentales que puedan comprometer la integridad de las personas, activos e información.\n\nDeterminar el nivel de cumplimiento general de las medidas de seguridad implementadas y proponer un plan de acción correctivo para los hallazgos identificados.' },
    s3:{ metodos:[], fechaInicio:today, fechaFin:today, duracion:'', observaciones:'' },
    s6:{ riesgos:[], nivelAmenaza:'medio', descripcion:'' },
    s7:{ pais:'Costa Rica', provincia:'', canton:'', distrito:'', dirExacta:'', coordenadas:'',
         latitud:'', longitud:'', tipoZona:'', iluminacion:'', accesos:'', accesosSecundarios:'',
         norte:'', sur:'', este:'', oeste:'', observaciones:'' },
    s8:{ descripcion:'', conflictividad:'bajo', historial:'', presenciaPolicial:'rondas',
         zonasProblematicas:'', factoresExternos:'', calificacion:'medio',
         statsOIJ: [], fuenteOIJ: '' },
    s17:{ acciones:[], conclusion:'', recomendaciones:'' },
    s18:{ riesgos:[] },
    s19a:{ items: (CHECKLISTS.s19a||[]).map((t,i)=>({ id:i, text:t, score:null, obs:'' })), observaciones:'',
           tieneArmero:'', tieneTrampa:'', tipoArmamento:'', cantidadArmas:0, cantidadOficialesArmados:0,
           porcentajeLicencias:'', observacionesArmamento:'' },
    photos: {}
  };
  const allPhotoKeys = [...SCORED_SECTIONS, 's1','s2','s3','s6','s7','s8','s18','s19a'];
  SCORED_SECTIONS.forEach(sk => {
    if (sk === 's19a') return; // already set above with custom fields
    const items = (CHECKLISTS[sk]||[]).map((t,i) => ({ id:i, text:t, score:null, obs:'', actions:'' }));
    template[sk] = { items, observaciones:'' };
    // Campos específicos para S9
    if (sk === 's9') {
      template.s9.iluminacionCalidad = '';
      template.s9.iluminacionTipo = '';
      template.s9.iluminacionHorario = '';
      template.s9.iluminacionRespaldo = '';
      template.s9.iluminacionObs = '';
      template.s9.cerramientoTipo = [];
      template.s9.cerramientoMaterial = '';
      template.s9.cerramientoAltura = '';
      template.s9.cerramientoEstado = '';
      template.s9.cerramientoObs = '';
    }
  });
  allPhotoKeys.forEach(k => { template.photos[k] = []; });
  return template;
}
