'use strict';
/* ============================================================
   photos.js – Fotos por sección + Generación de PDF
   Corporación K-9 Internacional
   ============================================================ */

/* ── Photo helpers ────────────────────────────────────────── */
function ensurePhotos(key) {
  if (!currentEval.photos) currentEval.photos = {};
  if (!currentEval.photos[key]) currentEval.photos[key] = [];
}

function renderPhotoZone(sectionKey) {
  ensurePhotos(sectionKey);
  const photos = currentEval.photos[sectionKey] || [];
  const thumbs = photos.map((p, i) => `
    <div class="photo-thumb">
      <img src="${p.data}" alt="foto ${i+1}"/>
      <button class="photo-thumb-del" onclick="removePhoto('${sectionKey}',${i})" title="Eliminar"><i class="fas fa-times"></i></button>
    </div>
    <input class="photo-caption-input" id="cap_${sectionKey}_${i}" value="${p.caption||''}" placeholder="Pie de foto..." onchange="updateCaption('${sectionKey}',${i},this.value)"/>`).join('');
  return `
    <div class="photo-zone">
      <div class="photo-zone-title"><i class="fas fa-camera"></i>Fotografías de Evidencia</div>
      <div class="photo-grid" id="pg_${sectionKey}">
        ${thumbs}
        <div class="photo-add-btn" onclick="triggerPhotoUpload('${sectionKey}')">
          <i class="fas fa-plus-circle"></i><span>Agregar<br>Foto</span>
        </div>
      </div>
      <input type="file" id="fi_${sectionKey}" accept="image/*" multiple style="display:none"
        onchange="handlePhotoUpload('${sectionKey}',this)"/>
    </div>`;
}

function triggerPhotoUpload(key) {
  flushCurrentSection();
  const fi = document.getElementById('fi_'+key);
  if (fi) fi.click();
}

async function handlePhotoUpload(key, input) {
  if (!currentEval) return;
  ensurePhotos(key);
  const files = Array.from(input.files);
  for (const file of files) {
    const data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
    
    // Save metadata in object (without large base64)
    const newIdx = currentEval.photos[key].length;
    currentEval.photos[key].push({ caption: '', hasData: true });
    
    // Save binary in IndexedDB
    await PhotoDB.savePhoto(currentEval.id, key, newIdx, data);
  }
  
  refreshPhotoGrid(key);
  if (typeof saveEvaluation === 'function') saveEvaluation(false);
  input.value = '';
}

async function removePhoto(key, idx) {
  if (!currentEval) return;
  ensurePhotos(key);
  
  // Delete from IndexedDB
  await PhotoDB.deletePhoto(currentEval.id, key, idx);
  
  // Update theoretical indices for subsequent photos in the same section
  const sectionPhotos = currentEval.photos[key];
  for (let i = idx + 1; i < sectionPhotos.length; i++) {
    const data = await PhotoDB.getPhoto(currentEval.id, key, i);
    if (data) {
      await PhotoDB.savePhoto(currentEval.id, key, i - 1, data);
      await PhotoDB.deletePhoto(currentEval.id, key, i);
    }
  }

  currentEval.photos[key].splice(idx, 1);
  refreshPhotoGrid(key);
  showToast('Foto eliminada.', 'info');
  if (typeof saveEvaluation === 'function') saveEvaluation(false);
}

function updateCaption(key, idx, val) {
  ensurePhotos(key);
  if (currentEval.photos[key][idx]) currentEval.photos[key][idx].caption = val;
  if (typeof autoSave === 'function') autoSave();
}

async function refreshPhotoGrid(key) {
  const container = document.getElementById('pg_'+key);
  if (!container || !currentEval) return;
  ensurePhotos(key);
  
  const photosMetadata = currentEval.photos[key];
  let thumbsHtml = '';
  
  for (let i = 0; i < photosMetadata.length; i++) {
    const data = await PhotoDB.getPhoto(currentEval.id, key, i);
    const p = photosMetadata[i];
    
    thumbsHtml += `
      <div class="photo-thumb">
        ${data ? `<img src="${data}" alt="foto ${i+1}" onclick="viewPhoto('${key}',${i})"/>` : `<div class="photo-placeholder"><i class="fas fa-image"></i></div>`}
        <button class="photo-thumb-del" onclick="removePhoto('${key}',${i})"><i class="fas fa-times"></i></button>
      </div>
      <input class="photo-caption-input" id="cap_${key}_${i}" value="${p.caption||''}" placeholder="Pie de foto..."
        onchange="updateCaption('${key}',${i},this.value)"/>`;
  }
  
  container.innerHTML = thumbsHtml + `
    <div class="photo-add-btn" onclick="triggerPhotoUpload('${key}')">
      <i class="fas fa-plus-circle"></i><span>Agregar<br>Foto</span>
    </div>`;
}

async function viewPhoto(key, idx) {
  if (!currentEval) return;
  const data = await PhotoDB.getPhoto(currentEval.id, key, idx);
  const p = currentEval.photos[key][idx];
  if (!data) { showToast('Cargando imagen...','info'); return; }
  
  openModal('Vista de Fotografía',
    `<div style="text-align:center">
      <img src="${data}" style="max-width:100%;max-height:55vh;border-radius:8px"/>
      <p style="margin-top:10px;color:var(--text-m);font-size:12px">${p.caption||'Sin descripción'}</p>
    </div>`,
    `<button class="btn-ghost" onclick="closeModal()">Cerrar</button>`);
}

/**
 * Migration helper: Moves photos from localStorage to IndexedDB
 */
async function migrateExistingPhotos(ev) {
  if (!ev.photos) return false;
  let migrated = false;
  
  for (const key in ev.photos) {
    if (!Array.isArray(ev.photos[key])) continue;
    for (let i = 0; i < ev.photos[key].length; i++) {
       const p = ev.photos[key][i];
       if (p.data && p.data.startsWith('data:image')) {
         // It has local data (old format), move to IndexedDB
         await PhotoDB.savePhoto(ev.id, key, i, p.data);
         delete p.data;
         p.hasData = true;
         migrated = true;
       }
    }
  }
  return migrated;
}

/* ── PDF / Informe ────────────────────────────────────────── */
async function downloadPDF(id) {
  let ev = id ? DB.find(e => e.id == id) : currentEval;
  if (!ev) { showToast('No hay evaluación activa.','error'); return; }
  flushCurrentSection();
  
  showToast("Generando reporte PDF con imágenes...", "info");
  
  // Create a deep copy to not modify the original evaluation object
  const evTemp = JSON.parse(JSON.stringify(ev));
  
  // Pre-fetch ALL photos from IndexedDB and link them to our temp object
  const allPhotos = await PhotoDB.exportPhotos(evTemp.id);
  if (evTemp.photos) {
    for (const secKey in evTemp.photos) {
      if (!Array.isArray(evTemp.photos[secKey])) continue;
      evTemp.photos[secKey].forEach((p, i) => {
        const photoId = `${evTemp.id}_${secKey}_${i}`;
        if (allPhotos[photoId]) p.data = allPhotos[photoId];
      });
    }
  }

  // Swap to the populated object for rendering
  ev = evTemp;

  // Use ev for the rest of the logic
  const overall = computeOverallScore(ev);
  const nivel = scoreToLabel(overall);
  const color = { 'CRÍTICO':'#C91B38','DEFICIENTE':'#D96008','CON OBSERVACIONES':'#B07A00','ACEPTABLE':'#007A55','Sin evaluar':'#546085' }[nivel] || '#546085';

  /* ---------- CHART: use real section names ---------- */
  const chartLabels = SCORED_SECTIONS.map(sk => {
    const sec = SECTIONS.find(s => s.key === sk);
    // Shorten long titles for graph labels
    return sec.title.split('(')[0].trim().substring(0, 22);
  });
  const chartData = SCORED_SECTIONS.map(sk => computeSectionScore(sk, ev) || 0);
  const chartColors = SCORED_SECTIONS.map(sk => {
    const pct = computeSectionScore(sk, ev);
    if (pct === null) return 'rgba(84,96,133,0.8)';
    if (pct < 40) return 'rgba(201,27,56,0.85)';
    if (pct < 60) return 'rgba(217,96,8,0.85)';
    if (pct < 80) return 'rgba(176,122,0,0.85)';
    return 'rgba(0,122,85,0.85)';
  });

  const chartConfig = {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [{
        label: '% Cumplimiento',
        data: chartData,
        backgroundColor: chartColors,
        borderColor: chartColors.map(c => c.replace('0.85','1').replace('0.8','1')),
        borderWidth: 1
      }]
    },
    options: {
      legend: { display: false },
      title: { display: true, text: 'Cumplimiento por Área de Seguridad (%)', fontSize: 13, fontColor: '#0D172F', fontStyle: 'bold' },
      scales: {
        yAxes: [{ ticks: { beginAtZero: true, max: 100, fontSize: 11 }, gridLines: { color: 'rgba(0,0,0,0.08)' } }],
        xAxes: [{ ticks: { fontSize: 10, autoSkip: false } }]
      },
      plugins: { datalabels: { anchor: 'end', align: 'top', formatter: v => v+'%', font: { size: 10, weight: 'bold' } } }
    }
  };
  const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=600&h=320`;

  /* ---------- SECTION BLOCKS ---------- */
  const sectionBlocks = SECTIONS.map(sec => {
    let content = '';

    /* ── Bloque Scored (IX-XV) ── */
    if (SCORED_SECTIONS.includes(sec.key)) {
      const d = ev[sec.key];
      const pct = computeSectionScore(sec.key, ev);
      const sc = scoreColor(pct);
      const barPct = pct || 0;

      // Progress bar using inline block div trick reliable in PDF
      const progressBar = `
        <div style="margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
            <div style="flex:1">
              <div style="width:100%;height:10px;background:#e8eaf0;border-radius:99px;overflow:hidden;border:1px solid #ddd">
                <div style="height:10px;width:${barPct}%;background:${sc};border-radius:99px;display:block"></div>
              </div>
            </div>
            <strong style="color:${sc};font-size:16px;font-family:Georgia,serif;min-width:48px;text-align:right">${pct!==null?pct+'%':'–'}</strong>
            <span style="font-size:10px;padding:2px 8px;border-radius:12px;font-weight:700;background:${sc}18;color:${sc};border:1px solid ${sc}44">${scoreToLabel(pct)}</span>
          </div>
        </div>`;

      const rows = (d?.items||[]).map((it,i) => {
        const badge = it.score
          ? `<span style="font-weight:800;padding:2px 6px;border-radius:4px;font-size:10px;background:${it.score==='C'?'#e6f5f0':it.score==='CP'?'#fdf5e6':it.score==='NC'?'#fde8ec':'#f0f2f8'};color:${it.score==='C'?'#007A55':it.score==='CP'?'#B07A00':it.score==='NC'?'#C91B38':'#546085'}">${it.score}</span>`
          : '<span style="color:#bbb;font-size:10px">–</span>';
        return `<tr style="background:${i%2===0?'#f9fafd':'#fff'}">
          <td style="padding:6px 10px;color:#999;font-size:11px;width:24px;text-align:center">${i+1}</td>
          <td style="padding:6px 10px;font-size:11px;line-height:1.5;color:#333">${it.text}</td>
          <td style="padding:6px 10px;text-align:center;width:60px">${badge}</td>
          <td style="padding:6px 10px;font-size:10px;color:#666;width:140px">${it.obs||''}</td>
        </tr>`;
      }).join('');

      const photoBlock = (ev.photos?.[sec.key]||[]).map(p =>
        `<div style="display:inline-block;margin:6px;text-align:center;vertical-align:top;page-break-inside:avoid">
          <img src="${p.data}" style="width:130px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #ddd;display:block"/>
          <div style="font-size:9px;color:#666;margin-top:3px;max-width:130px">${p.caption||''}</div>
        </div>`).join('');

      // Bloque de cerramientos perimetrales
      let cerramientoBlock = '';
      if (sec.key === 's9' && ((Array.isArray(d.cerramientoTipo) && d.cerramientoTipo.length > 0) || d.cerramientoMaterial || d.cerramientoAltura || d.cerramientoEstado || d.cerramientoObs)) {
        const estadoLabels = { bueno:'Bueno', regular:'Regular', deficiente:'Deficiente', critico:'Crítico' };
        
        // Mapeo selectivo para multi-selección
        let tiposLabel = '–';
        if (Array.isArray(d.cerramientoTipo) && d.cerramientoTipo.length > 0) {
          tiposLabel = d.cerramientoTipo.map(tid => {
            const found = ENCLOSURE_TYPES.find(t => t.id === tid);
            return found ? found.label : tid;
          }).join(', ');
        } else if (typeof d.cerramientoTipo === 'string' && d.cerramientoTipo) {
          const found = ENCLOSURE_TYPES.find(t => t.id === d.cerramientoTipo);
          tiposLabel = found ? found.label : d.cerramientoTipo;
        }

        cerramientoBlock = `
          <div style="margin-top:14px;padding:12px 14px;background:#f0fafe;border-left:4px solid #007A55;border-radius:0 8px 8px 0;margin-bottom:10px">
            <div style="font-size:11px;font-weight:700;color:#007A55;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
              Características de los Cerramientos Perimetrales
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <tr>
                <td style="padding:4px 8px;color:#555;width:200px">Tipos de Cerramiento:</td>
                <td style="padding:4px 8px;font-weight:600">${tiposLabel}</td>
              </tr>
              <tr style="background:rgba(255,255,255,0.7)">
                <td style="padding:4px 8px;color:#555">Material Fabricación:</td>
                <td style="padding:4px 8px;font-weight:600">${d.cerramientoMaterial||'–'}</td>
              </tr>
              <tr>
                <td style="padding:4px 8px;color:#555">Altura Aproximada:</td>
                <td style="padding:4px 8px;font-weight:600">${d.cerramientoAltura||'–'}</td>
              </tr>
              <tr style="background:rgba(255,255,255,0.7)">
                <td style="padding:4px 8px;color:#555">Estado Conservación:</td>
                <td style="padding:4px 8px;font-weight:600;color:${d.cerramientoEstado==='critico'?'#C91B38':d.cerramientoEstado==='bueno'?'#007A55':'#B07A00'}">${estadoLabels[d.cerramientoEstado]||d.cerramientoEstado||'–'}</td>
              </tr>
              ${d.cerramientoObs ? `<tr><td style="padding:4px 8px;color:#555">Observaciones Cerramiento:</td><td style="padding:4px 8px;font-style:italic;color:#444">${d.cerramientoObs}</td></tr>` : ''}
            </table>
          </div>`;
      }

      // Special s9 illumination block
      let illumBlock = '';
      if (sec.key === 's9' && (d.iluminacionCalidad || d.iluminacionTipo || d.iluminacionHorario || d.iluminacionRespaldo || d.iluminacionObs)) {
        const ilumLabels = {
          excelente: 'Excelente – Cobertura total, sin puntos ciegos',
          buena: 'Buena – Cobertura mayoritaria con mínimas fallas',
          regular: 'Regular – Cobertura parcial con zonas oscuras',
          deficiente: 'Deficiente – Sin cobertura o sistemas inoperativos'
        };
        const tipoLabels = { led:'LED de alta eficiencia', sodio:'Vapor de sodio / mercurio', halogenuro:'Halogenuro metálico', mixta:'Mixta', ninguna:'Sin sistema instalado' };
        const horLabels = { nocturna:'Solo horario nocturno', '24h':'24 horas continuas', sensores:'Activación por sensores', manual:'Activación manual' };
        const respLabels = { ups:'UPS instalado y funcional', planta:'Planta generadora', solar:'Panel solar', ninguno:'Sin respaldo' };
        illumBlock = `
          <div style="margin-top:10px;padding:12px 14px;background:#f0f7ff;border-left:4px solid #0D172F;border-radius:0 8px 8px 0">
            <div style="font-size:11px;font-weight:700;color:#0D172F;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
              Valoración del Sistema de Iluminación Perimetral
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <tr>
                <td style="padding:4px 8px;color:#555;width:200px">Calidad de Iluminación:</td>
                <td style="padding:4px 8px;font-weight:600;color:#0D172F">${ilumLabels[d.iluminacionCalidad]||d.iluminacionCalidad||'–'}</td>
              </tr>
              <tr style="background:rgba(255,255,255,0.7)">
                <td style="padding:4px 8px;color:#555">Tecnología Empleada:</td>
                <td style="padding:4px 8px;font-weight:600">${tipoLabels[d.iluminacionTipo]||d.iluminacionTipo||'–'}</td>
              </tr>
              <tr>
                <td style="padding:4px 8px;color:#555">Cobertura Horaria:</td>
                <td style="padding:4px 8px;font-weight:600">${horLabels[d.iluminacionHorario]||d.iluminacionHorario||'–'}</td>
              </tr>
              <tr style="background:rgba(255,255,255,0.7)">
                <td style="padding:4px 8px;color:#555">Respaldo Eléctrico:</td>
                <td style="padding:4px 8px;font-weight:600">${respLabels[d.iluminacionRespaldo]||d.iluminacionRespaldo||'–'}</td>
              </tr>
              ${d.iluminacionObs ? `<tr><td style="padding:4px 8px;color:#555">Observaciones Iluminación:</td><td style="padding:4px 8px;font-style:italic;color:#444">${d.iluminacionObs}</td></tr>` : ''}
            </table>
          </div>`;
      }

      content = `
        ${progressBar}
        <table style="width:100%;border-collapse:collapse;border:1px solid #e0e3ee;box-shadow:0 2px 6px rgba(30,43,82,0.06)">
          <thead><tr style="background:#0D172F">
            <th style="padding:9px 10px;color:#fff;font-size:10px;text-align:center;width:28px;border-right:1px solid rgba(255,255,255,0.1)">#</th>
            <th style="padding:9px 12px;color:#fff;font-size:10px;text-align:left;border-right:1px solid rgba(255,255,255,0.1)">Ítem de Verificación</th>
            <th style="padding:9px 10px;color:#fff;font-size:10px;text-align:center;width:60px;border-right:1px solid rgba(255,255,255,0.1)">Cal.</th>
            <th style="padding:9px 12px;color:#fff;font-size:10px;text-align:left;width:140px">Observación / Hallazgo</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${cerramientoBlock}
        ${illumBlock}
        ${d?.observaciones ? `<div style="margin-top:10px;padding:10px;background:#fdf9f0;border-left:3px solid #C8951A;font-size:11px;color:#444"><strong>Notas de la sección:</strong> ${d.observaciones}</div>` : ''}
        ${photoBlock ? `<div style="margin-top:12px"><div style="font-size:10px;font-weight:800;color:#0D172F;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px">Evidencia Fotográfica</div>${photoBlock}</div>` : ''}`;

    /* ── I. Datos Generales ── */
    } else if (sec.key === 's1') {
      const d = ev.s1;
      content = `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr><td style="padding:7px 10px;color:#666;width:160px;border-bottom:1px solid #f0f0f0">Nombre del Sitio:</td><td style="padding:7px 10px;font-weight:700;color:#0D172F;border-bottom:1px solid #f0f0f0">${d.nombreSitio||'–'}</td><td style="padding:7px 10px;color:#666;width:160px;border-bottom:1px solid #f0f0f0">Tipo de Instalación:</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${d.tipoInstalacion||'–'}</td></tr>
        <tr style="background:#f9fafd"><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Empresa / Organización:</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${d.empresa||'–'}</td><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Fecha de Evaluación:</td><td style="padding:7px 10px;font-weight:600;border-bottom:1px solid #f0f0f0">${d.fechaEvaluacion||'–'}</td></tr>
        <tr><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Evaluador / Inspector:</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${d.evaluador||'–'}</td><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Cargo:</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${d.cargo||'–'}</td></tr>
        <tr style="background:#f9fafd"><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Empresa del Evaluador:</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${d.empresa2||'–'}</td><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Persona de Contacto:</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${d.contacto||'–'}</td></tr>
        <tr><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Área Aproximada (m²):</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${d.area||'–'}</td><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Horario Operativo:</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${d.horarioOperativo||'–'}</td></tr>
        <tr style="background:#f9fafd"><td style="padding:7px 10px;color:#666;vertical-align:top">Actividades de la Compañía:</td><td colspan="3" style="padding:7px 10px;line-height:1.4">${d.actividadesDetalle||'–'}</td></tr>
      </table>`;
      const photoBlock1 = (ev.photos?.s1||[]).map(p =>
        `<div style="display:inline-block;margin:6px;text-align:center;vertical-align:top;page-break-inside:avoid">
          <img src="${p.data}" style="width:130px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #ddd;display:block"/>
          <div style="font-size:9px;color:#666;margin-top:3px">${p.caption||''}</div>
        </div>`).join('');
      if (photoBlock1) content += `<div style="margin-top:12px"><div style="font-size:10px;font-weight:800;color:#0D172F;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px">Evidencia Fotográfica</div>${photoBlock1}</div>`;

    /* ── II. Objetivos ── */
    } else if (sec.key === 's2') {
      const obj = ev.s2?.objetivos || '–';
      content = `<div style="font-size:12px;line-height:1.7;color:#333;white-space:pre-line;background:#fafbff;border:1px solid #e8ebf5;border-radius:8px;padding:14px 16px">${obj}</div>`;

    /* ── III. Metodología ── */
    } else if (sec.key === 's3') {
      const d = ev.s3;
      const selectedMetodos = d.metodos || [];
      // Show ALL available methods, marking which were applied vs not
      const allMethodsRows = METHODS.map((m, i) => {
        const applied = Array.isArray(selectedMetodos) && selectedMetodos.includes(m.id);
        return `<tr style="background:${i%2?'#f9fafd':'#fff'}">
          <td style="padding:7px 12px;width:28px;text-align:center">
            <span style="font-size:13px;font-weight:700;color:${applied?'#007A55':'#ccc'}">${applied?'✓':'○'}</span>
          </td>
          <td style="padding:7px 12px;font-size:11px;color:${applied?'#222':'#aaa'}">${m.label}</td>
          <td style="padding:7px 12px;width:110px;text-align:center">
            ${applied ? '<span style="background:#e6f5f0;color:#007A55;border:1px solid #007A5533;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">APLICADO</span>' 
                      : '<span style="background:#f5f5f5;color:#bbb;border:1px solid #ddd;padding:2px 8px;border-radius:10px;font-size:10px">No aplicado</span>'}
          </td>
        </tr>`;
      }).join('');
      content = `
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px">
          <tr><td style="padding:7px 10px;color:#666;width:180px;border-bottom:1px solid #f0f0f0">Fecha Inicio:</td><td style="padding:7px 10px;font-weight:600;border-bottom:1px solid #f0f0f0">${d.fechaInicio||'–'}</td><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Fecha Fin:</td><td style="padding:7px 10px;font-weight:600;border-bottom:1px solid #f0f0f0">${d.fechaFin||'–'}</td></tr>
          <tr style="background:#f9fafd"><td style="padding:7px 10px;color:#666">Duración Total:</td><td colspan="3" style="padding:7px 10px">${d.duracion||'–'}</td></tr>
          ${d.observaciones ? `<tr><td style="padding:7px 10px;color:#666">Observaciones:</td><td colspan="3" style="padding:7px 10px;font-style:italic">${d.observaciones}</td></tr>` : ''}
        </table>
        <div style="font-size:11px;font-weight:700;color:#0D172F;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Técnicas de Verificación Aplicadas</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e0e3ee">
          <thead><tr style="background:#0D172F">
            <th style="padding:7px 10px;color:#fff;font-size:10px;text-align:center;width:28px">✓</th>
            <th style="padding:7px 10px;color:#fff;font-size:10px;text-align:left">Técnica de Verificación</th>
            <th style="padding:7px 10px;color:#fff;font-size:10px;text-align:center;width:110px">Estado</th>
          </tr></thead>
          <tbody>${allMethodsRows}</tbody>
        </table>`;

    /* ── IV. Criterios de Evaluación ── */
    } else if (sec.key === 's4') {
      content = `
        <div style="font-size:12px;color:#444;margin-bottom:14px">La evaluación utiliza una escala de <strong>3 niveles</strong> para calificar cada ítem de las listas de verificación. Los ítems marcados como No Aplica (NA) son excluidos del cálculo del porcentaje.</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e0e3ee">
          <thead><tr style="background:#0D172F">
            <th style="padding:9px 14px;color:#fff;font-size:11px;text-align:center;width:60px">Código</th>
            <th style="padding:9px 14px;color:#fff;font-size:11px;text-align:left">Criterio</th>
            <th style="padding:9px 14px;color:#fff;font-size:11px;text-align:center;width:80px">Puntos</th>
            <th style="padding:9px 14px;color:#fff;font-size:11px;text-align:left">Descripción</th>
          </tr></thead>
          <tbody>
            <tr><td style="padding:8px 14px;text-align:center"><strong style="color:#007A55;font-size:14px">C</strong></td><td style="padding:8px 14px;font-weight:600">Cumple</td><td style="padding:8px 14px;text-align:center;font-weight:700;color:#007A55">4 / 4</td><td style="padding:8px 14px;font-size:11px">El control está completamente implementado, operativo y es efectivo.</td></tr>
            <tr style="background:#f9fafd"><td style="padding:8px 14px;text-align:center"><strong style="color:#B07A00;font-size:14px">CP</strong></td><td style="padding:8px 14px;font-weight:600">Cumple Parcialmente</td><td style="padding:8px 14px;text-align:center;font-weight:700;color:#B07A00">2 / 4</td><td style="padding:8px 14px;font-size:11px">El control existe pero presenta deficiencias, brechas o no está completo.</td></tr>
            <tr><td style="padding:8px 14px;text-align:center"><strong style="color:#C91B38;font-size:14px">NC</strong></td><td style="padding:8px 14px;font-weight:600">No Cumple</td><td style="padding:8px 14px;text-align:center;font-weight:700;color:#C91B38">0 / 4</td><td style="padding:8px 14px;font-size:11px">El control no existe, está inoperativo o no cumple ningún requisito mínimo.</td></tr>
            <tr style="background:#f9fafd"><td style="padding:8px 14px;text-align:center"><strong style="color:#546085;font-size:14px">NA</strong></td><td style="padding:8px 14px;font-weight:600">No Aplica</td><td style="padding:8px 14px;text-align:center;color:#999">–</td><td style="padding:8px 14px;font-size:11px">El ítem no es aplicable al tipo de instalación o actividad evaluada.</td></tr>
          </tbody>
        </table>
        <div style="margin-top:14px;padding:12px 16px;background:#f0f7ff;border-left:4px solid #0D172F;border-radius:0 8px 8px 0">
          <div style="font-size:11px;font-weight:700;color:#0D172F;margin-bottom:6px">Fórmula de Cálculo del Porcentaje de Cumplimiento</div>
          <div style="font-size:12px;text-align:center;padding:8px;background:rgba(255,255,255,0.8);border-radius:6px;font-family:Georgia,serif">% Cumplimiento = (Σ Puntos obtenidos) ÷ (N° ítems evaluables × 4) × 100</div>
          <div style="font-size:10px;color:#666;margin-top:8px">El porcentaje final general es el promedio ponderado de las 7 secciones con lista de verificación (IX – XV).</div>
        </div>`;

    /* ── V. Interpretación de Resultados ── */
    } else if (sec.key === 's5') {
      content = `
        <div style="font-size:12px;color:#444;margin-bottom:14px">Los resultados finales se clasifican en <strong>cuatro niveles de riesgo</strong> según el porcentaje de cumplimiento obtenido en las secciones evaluadas.</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e0e3ee">
          <thead><tr style="background:#0D172F">
            <th style="padding:9px 14px;color:#fff;font-size:11px;text-align:center;width:120px">Rango %</th>
            <th style="padding:9px 14px;color:#fff;font-size:11px;text-align:center;width:160px">Nivel de Riesgo</th>
            <th style="padding:9px 14px;color:#fff;font-size:11px;text-align:left">Descripción y Acciones Requeridas</th>
          </tr></thead>
          <tbody>
            <tr><td style="padding:10px 14px;text-align:center"><strong style="color:#007A55;font-size:13px;font-family:Georgia,serif">80 – 100%</strong></td><td style="padding:10px 14px;text-align:center"><span style="background:#e6f5f0;color:#007A55;border:1px solid #007A5533;padding:3px 10px;border-radius:12px;font-weight:700;font-size:11px">ACEPTABLE</span></td><td style="padding:10px 14px;font-size:11px">Las medidas de seguridad son apropiadas. Se requiere mantenimiento y mejora continua.</td></tr>
            <tr style="background:#f9fafd"><td style="padding:10px 14px;text-align:center"><strong style="color:#B07A00;font-size:13px;font-family:Georgia,serif">60 – 79%</strong></td><td style="padding:10px 14px;text-align:center"><span style="background:#fdf5e6;color:#B07A00;border:1px solid #B07A0033;padding:3px 10px;border-radius:12px;font-weight:700;font-size:11px">CON OBSERVACIONES</span></td><td style="padding:10px 14px;font-size:11px">Existen brechas que deben ser corregidas a mediano plazo. Riesgo moderado.</td></tr>
            <tr><td style="padding:10px 14px;text-align:center"><strong style="color:#D96008;font-size:13px;font-family:Georgia,serif">40 – 59%</strong></td><td style="padding:10px 14px;text-align:center"><span style="background:#fef0e6;color:#D96008;border:1px solid #D9600833;padding:3px 10px;border-radius:12px;font-weight:700;font-size:11px">DEFICIENTE</span></td><td style="padding:10px 14px;font-size:11px">Vulnerabilidades significativas. Se requieren acciones correctivas urgentes.</td></tr>
            <tr style="background:#f9fafd"><td style="padding:10px 14px;text-align:center"><strong style="color:#C91B38;font-size:13px;font-family:Georgia,serif">0 – 39%</strong></td><td style="padding:10px 14px;text-align:center"><span style="background:#fde8ec;color:#C91B38;border:1px solid #C91B3833;padding:3px 10px;border-radius:12px;font-weight:700;font-size:11px">CRÍTICO</span></td><td style="padding:10px 14px;font-size:11px">Control de seguridad insuficiente. Alto riesgo de incidente. Acción inmediata requerida.</td></tr>
          </tbody>
        </table>`;

    /* ── VI. Manifestaciones de Riesgo ── */
    } else if (sec.key === 's6') {
      const rLabels = (ev.s6?.riesgos||[]).map(r => RISK_MANIFESTATIONS.find(m=>m.id===r)?.label||r);
      const nivelColor = { bajo:'#007A55', medio:'#B07A00', alto:'#D96008', critico:'#C91B38' }[ev.s6?.nivelAmenaza] || '#546085';
      content = `
          <tr><td style="padding:7px 10px;color:#666;width:220px;border-bottom:1px solid #f0f0f0">Nivel General de Amenaza:</td>
            <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0"><strong style="color:${nivelColor};font-size:13px;text-transform:uppercase">${ev.s6?.nivelAmenaza||'–'}</strong></td></tr>
          ${ev.s6?.descripcion ? `<tr><td colspan="2" style="padding:12px 10px;background:#f9fafd;border-bottom:1px solid #f0f0f0">
              <div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:6px;font-weight:700">Descripción Detallada</div>
              <div style="font-style:italic;line-height:1.6;text-align:justify;color:#222;white-space:pre-wrap">${ev.s6.descripcion}</div>
            </td></tr>` : ''}
        </table>
        <div style="font-size:11px;font-weight:700;color:#0D172F;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Amenazas Identificadas</div>
        ${rLabels.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${rLabels.map(r => `<span style="background:#fde8ec;color:#C91B38;border:1px solid #C91B3833;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600">⚠ ${r}</span>`).join('')}</div>` : '<p style="color:#999;font-size:12px;font-style:italic">No se identificaron amenazas específicas.</p>'}`;
      const photoBlock6 = (ev.photos?.s6||[]).map(p =>
        `<div style="display:inline-block;margin:6px;text-align:center;vertical-align:top;page-break-inside:avoid">
          <img src="${p.data}" style="width:130px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #ddd;display:block"/>
          <div style="font-size:9px;color:#666;margin-top:3px">${p.caption||''}</div>
        </div>`).join('');
      if (photoBlock6) content += `<div style="margin-top:12px"><div style="font-size:10px;font-weight:800;color:#0D172F;text-transform:uppercase;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px">Evidencia Fotográfica</div>${photoBlock6}</div>`;

    /* ── VII. Ubicación Geográfica ── */
    } else if (sec.key === 's7') {
      const d = ev.s7;
      // OpenStreetMap static map via staticmap.openstreetmap.de or maps.geoapify.com
      let mapImgHtml = '';
      if (d.latitud && d.longitud) {
        const lat = parseFloat(d.latitud);
        const lng = parseFloat(d.longitud);
        // Using staticmap service from geoapify (free, reliable)
        const mapUrl = `https://maps.geoapify.com/v1/staticmap?style=osm-carto&width=600&height=350&center=lonlat:${lng},${lat}&zoom=15&marker=lonlat:${lng},${lat};color:%23C91B38;size:large&apiKey=YOUR_KEY`;
        // Fallback: use openstreetmap tile approach via map image
        // Using a reliable free static map - staticmaps.net or tiles.openstreetmap.org composite
        const osmStaticUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=600x350&markers=${lat},${lng},red-pushpin`;
        mapImgHtml = `
          <div style="margin-bottom:16px;page-break-inside:avoid">
            <div style="font-size:10px;font-weight:700;color:#0D172F;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Ubicación Geográfica en Mapa</div>
            <div style="border:2px solid #0D172F;border-radius:8px;overflow:hidden;max-width:560px">
              <div style="background:#0D172F;padding:6px 12px;font-size:10px;color:rgba(255,255,255,0.8)">
                📍 Lat: ${lat.toFixed(6)} | Long: ${lng.toFixed(6)} &nbsp;·&nbsp; Fuente: OpenStreetMap
              </div>
              <img src="${osmStaticUrl}" style="width:100%;max-width:560px;height:auto;display:block" 
                   onerror="this.style.display='none';this.nextSibling.style.display='block'"/>
              <div style="display:none;padding:30px;text-align:center;background:#f0f3fd;font-size:12px;color:#666">
                🗺 Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
                <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15" style="color:#0D172F">Ver en OpenStreetMap</a>
              </div>
            </div>
            <div style="font-size:9px;color:#888;margin-top:5px;text-align:center">Mapa basado en coordenadas GPS registradas · © OpenStreetMap contributors</div>
          </div>`;
      }
      content = `
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
          <tr><td style="padding:7px 10px;color:#666;width:150px;border-bottom:1px solid #f0f0f0">País:</td><td style="padding:7px 10px;font-weight:600;border-bottom:1px solid #f0f0f0">${d.pais||'Costa Rica'}</td><td style="padding:7px 10px;color:#666;width:150px;border-bottom:1px solid #f0f0f0">Provincia:</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${d.provincia||'–'}</td></tr>
          <tr style="background:#f9fafd"><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Cantón:</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${d.canton||'–'}</td><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Distrito:</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${d.distrito||'–'}</td></tr>
          <tr><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Dirección Exacta:</td><td colspan="3" style="padding:7px 10px;font-weight:600;border-bottom:1px solid #f0f0f0">${d.dirExacta||'–'}</td></tr>
          <tr style="background:#f9fafd"><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Coordenadas GPS:</td><td colspan="3" style="padding:7px 10px;font-family:monospace;font-weight:700;color:#0D172F;border-bottom:1px solid #f0f0f0">${d.latitud ? `Lat: ${d.latitud} | Long: ${d.longitud}` : 'No proporcionadas'}</td></tr>
          <tr><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Tipo de Zona:</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${(d.tipoZona||'–').toUpperCase()}</td><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Iluminación Pública:</td><td style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${(d.iluminacion||'–').toUpperCase()}</td></tr>
          <tr style="background:#f9fafd"><td style="padding:7px 10px;color:#666;border-bottom:1px solid #f0f0f0">Accesos Principales:</td><td colspan="3" style="padding:7px 10px;border-bottom:1px solid #f0f0f0">${d.accesos||'–'}</td></tr>
          <tr><td style="padding:7px 10px;color:#666">Accesos Secundarios:</td><td colspan="3" style="padding:7px 10px">${d.accesosSecundarios||'–'}</td></tr>
        </table>
        ${mapImgHtml}
        <div style="page-break-inside:avoid">
          <div style="font-size:10px;font-weight:700;color:#0D172F;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Colindancias de la Propiedad</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e0e3ee;font-size:11px">
            <tr style="background:#0D172F"><th style="padding:8px 12px;color:#fff;width:25%">NORTE</th><th style="padding:8px 12px;color:#fff;width:25%">SUR</th><th style="padding:8px 12px;color:#fff;width:25%">ESTE</th><th style="padding:8px 12px;color:#fff;width:25%">OESTE</th></tr>
            <tr><td style="padding:9px 12px;border:1px solid #e0e3ee">${d.norte||'–'}</td><td style="padding:9px 12px;border:1px solid #e0e3ee">${d.sur||'–'}</td><td style="padding:9px 12px;border:1px solid #e0e3ee">${d.este||'–'}</td><td style="padding:9px 12px;border:1px solid #e0e3ee">${d.oeste||'–'}</td></tr>
          </table>
        </div>
        ${d.observaciones ? `<div style="margin-top:12px;padding:10px;background:#fdf9f0;border-left:3px solid #C8951A;font-size:11px;color:#444"><strong>Observaciones del Entorno:</strong> ${d.observaciones}</div>` : ''}`;

    /* ── VIII. Entorno de Seguridad ── */
    } else if (sec.key === 's8') {
      const d = ev.s8;
      const conflictColor = { bajo:'#007A55', medio:'#B07A00', alto:'#D96008', critico:'#C91B38' }[d.conflictividad] || '#546085';
      const validStats = (d.statsOIJ||[]).filter(s => s.delito || s.cantidad);
      const statsRows = validStats.map((s,i) =>
        `<tr style="background:${i%2?'#f9fafd':'#fff'}"><td style="padding:7px 12px;font-size:11px">${s.delito||'–'}</td><td style="padding:7px 12px;text-align:center;font-weight:700;font-size:13px;color:#C91B38">${s.cantidad||'0'}</td></tr>`).join('');
      
      let oijChartHtml = '';
      if (validStats.length > 0) {
        const oijLabels = validStats.map(s => s.delito || 'Desconocido');
        const oijValues = validStats.map(s => parseInt(s.cantidad) || 0);
        const maxVal = Math.max(...oijValues, 5);
        const oijConfig = {
          type: 'horizontalBar',
          data: {
            labels: oijLabels,
            datasets: [{
              label: 'Incidentes',
              data: oijValues,
              backgroundColor: 'rgba(201, 27, 56, 0.8)',
              borderColor: '#C91B38',
              borderWidth: 1
            }]
          },
          options: {
            title: { display: false },
            legend: { display: false },
            scales: {
              xAxes: [{ ticks: { beginAtZero: true, suggestedMax: maxVal, precision: 0, fontSize: 10 } }],
              yAxes: [{ ticks: { fontSize: 10, fontColor: '#0D172F', fontStyle: 'bold' } }]
            },
            plugins: {
              datalabels: { anchor: 'end', align: 'right', color: '#C91B38', font: { weight: 'bold', size: 10 } }
            }
          }
        };
        const oijChartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(oijConfig))}&w=500&h=${Math.max(160, oijLabels.length * 35)}`;
        oijChartHtml = `
          <div style="margin-top:12px;background:#fcfcfe;padding:12px;border:1px solid #e8ebf5;border-radius:8px;text-align:center">
            <img src="${oijChartUrl}" style="max-width:100%;height:auto;border-radius:4px"/>
          </div>
        `;
      }

      content = `
        <div style="font-size:12px;line-height:1.6;color:#333;margin-bottom:14px;padding:10px 14px;background:#fafbff;border-radius:8px;border:1px solid #e8ebf5">${d.descripcion||'Descripción del entorno no proporcionada.'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div style="padding:10px 14px;background:#f9fafd;border:1px solid #e8ebf5;border-radius:8px">
            <div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;letter-spacing:.06em">Nivel de Conflictividad</div>
            <div style="font-size:14px;font-weight:700;color:${conflictColor};text-transform:uppercase">${d.conflictividad||'–'}</div>
          </div>
          <div style="padding:10px 14px;background:#f9fafd;border:1px solid #e8ebf5;border-radius:8px">
            <div style="font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px;letter-spacing:.06em">Presencia Policial</div>
            <div style="font-size:13px;font-weight:600;color:#0D172F;text-transform:capitalize">${d.presenciaPolicial||'–'}</div>
          </div>
        </div>
        ${d.historial ? `<div style="margin-bottom:12px"><div style="font-size:10px;font-weight:700;color:#0D172F;text-transform:uppercase;margin-bottom:4px">Historial de Incidentes</div><div style="font-size:11px;color:#444;padding:8px 12px;background:#fff8f0;border-left:3px solid #D96008;border-radius:0 6px 6px 0">${d.historial}</div></div>` : ''}
        ${d.zonasProblematicas ? `<div style="margin-bottom:12px"><div style="font-size:10px;font-weight:700;color:#0D172F;text-transform:uppercase;margin-bottom:4px">Zonas Problemáticas</div><div style="font-size:11px;color:#444">${d.zonasProblematicas}</div></div>` : ''}
        ${d.factoresExternos ? `<div style="margin-bottom:14px"><div style="font-size:10px;font-weight:700;color:#0D172F;text-transform:uppercase;margin-bottom:4px">Factores Externos que Impactan la Seguridad</div><div style="font-size:11px;color:#444">${d.factoresExternos}</div></div>` : ''}
        ${statsRows ? `
          <div style="font-size:10px;font-weight:700;color:#0D172F;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Estadísticas Criminales OIJ ${d.fuenteOIJ ? '· '+d.fuenteOIJ : ''}</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e0e3ee;margin-bottom:10px">
            <thead><tr style="background:#0D172F"><th style="padding:8px 12px;color:#fff;font-size:10px;text-align:left">Tipo de Delito</th><th style="padding:8px 12px;color:#fff;font-size:10px;text-align:center;width:100px">Cantidad</th></tr></thead>
            <tbody>${statsRows}</tbody>
          </table>
          ${oijChartHtml}` : ''}`;
      const photoBlock8 = (ev.photos?.s8||[]).map(p =>
        `<div style="display:inline-block;margin:6px;text-align:center;vertical-align:top;page-break-inside:avoid">
          <img src="${p.data}" style="width:130px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #ddd;display:block"/>
          <div style="font-size:9px;color:#666;margin-top:3px">${p.caption||''}</div>
        </div>`).join('');
      if (photoBlock8) content += `<div style="margin-top:12px"><div style="font-size:10px;font-weight:800;color:#0D172F;text-transform:uppercase;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px">Evidencia Fotográfica</div>${photoBlock8}</div>`;

    /* ── XVI. Resultados ── */
    } else if (sec.key === 's16') {
      const rows16 = SCORED_SECTIONS.map(sk => {
        const s=SECTIONS.find(x=>x.key===sk); const pct=computeSectionScore(sk,ev); const c=scoreColor(pct); const bw=pct||0;
        return `<tr>
          <td style="padding:9px 12px;font-size:11px;font-weight:600;color:#0D172F;width:300px">${s.roman}. ${s.title}</td>
          <td style="padding:9px 12px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:8px;background:#e8eaf0;border-radius:99px;overflow:hidden;border:1px solid #ddd">
                <div style="height:8px;width:${bw}%;background:${c};border-radius:99px;display:block"></div>
              </div>
              <strong style="color:${c};font-size:12px;min-width:36px;text-align:right">${pct!==null?pct+'%':'–'}</strong>
            </div>
          </td>
          <td style="padding:9px 12px;text-align:center;width:140px"><span style="display:inline-block;padding:2px 9px;border-radius:12px;font-weight:700;font-size:10px;background:${c}18;color:${c};border:1px solid ${c}44">${scoreToLabel(pct)}</span></td>
        </tr>`;
      }).join('');

      // Radar chart — Perfil de Madurez Patrimonial
      // Map our 7 scored sections into 6 radar axes (group some)
      const radarLabels = [
        'Físico (Perímetro)',
        'Vigilancia y Control',
        'Caseta de Seguridad',
        'Electrónico (CCTV)',
        'Procedimientos',
        'Zonas Críticas'
      ];
      // s9=Perimetral(Físico), s10=Vigilancia, s11=Caseta, s12=Electrónico, s13+s14=Procedimientos(avg), s15=Zonas
      const s13p = computeSectionScore('s13', ev) || 0;
      const s14p = computeSectionScore('s14', ev) || 0;
      const radarData = [
        computeSectionScore('s9', ev) || 0,
        computeSectionScore('s10', ev) || 0,
        computeSectionScore('s11', ev) || 0,
        computeSectionScore('s12', ev) || 0,
        Math.round((s13p + s14p) / 2),
        computeSectionScore('s15', ev) || 0
      ];
      const radarConfig = {
        type: 'radar',
        data: {
          labels: radarLabels,
          datasets: [{
            label: '% Cumplimiento',
            data: radarData,
            backgroundColor: 'rgba(200,149,26,0.15)',
            borderColor: '#C8951A',
            borderWidth: 2,
            pointBackgroundColor: '#C8951A',
            pointBorderColor: '#0D172F',
            pointRadius: 4
          }]
        },
        options: {
          title: { display: true, text: 'Perfil de Madurez Patrimonial', fontSize: 14, fontColor: '#0D172F', fontStyle: 'bold' },
          scale: {
            ticks: { beginAtZero: true, max: 100, stepSize: 25, fontSize: 9, fontColor: '#999' },
            gridLines: { color: 'rgba(30,43,82,0.12)' },
            angleLines: { color: 'rgba(30,43,82,0.15)' },
            pointLabels: { fontSize: 11, fontColor: '#0D172F', fontStyle: 'bold' }
          },
          legend: { display: false }
        }
      };
      const radarUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(radarConfig))}&w=420&h=340`;

      content = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px;page-break-inside:avoid">
          <div style="background:#fcfcfe;padding:14px;border:1px solid #e8ebf5;border-radius:10px;text-align:center">
            <img src="${chartUrl}" style="width:100%;max-width:420px;height:auto"/>
          </div>
          <div style="background:#fcfcfe;padding:14px;border:1px solid #e8ebf5;border-radius:10px;text-align:center">
            <img src="${radarUrl}" style="width:100%;max-width:340px;height:auto"/>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e0e3ee;box-shadow:0 2px 6px rgba(30,43,82,0.06)">
          <thead><tr style="background:#0D172F">
            <th style="padding:10px 12px;color:#fff;font-size:11px;text-align:left">Área de Seguridad</th>
            <th style="padding:10px 12px;color:#fff;font-size:11px;text-align:left">% Cumplimiento</th>
            <th style="padding:10px 12px;color:#fff;font-size:11px;text-align:center;width:140px">Estado</th>
          </tr></thead>
          <tbody style="font-size:12px">${rows16}</tbody>
        </table>`;

    /* ── XVII. Plan de Acción ── */
    } else if (sec.key === 's17') {
      // PDF: only show NC (alta prioridad) and CP (media prioridad) actions — skip C/NA items
      // Regenerate from scored data to ensure accuracy at PDF generation time
      const pdfActions = [];
      SCORED_SECTIONS.forEach(sk => {
        const secS = SECTIONS.find(s=>s.key===sk);
        const dS = ev[sk];
        if (!dS?.items) return;
        dS.items.forEach(it => {
          if (it.score === 'NC' || it.score === 'CP') {
            const findings = Array.isArray(it.obs) ? it.obs : (it.obs ? [it.obs] : []);
            findings.forEach(finding => {
              if (!finding.trim()) return;
              // Buscar coincidencia en s17 para preservar datos manuales si ya existe
              const found = (ev.s17?.acciones||[]).find(a => a.hallazgo === finding);
              
              pdfActions.push({
                seccion: secS.roman+'. '+secS.title.split('(')[0].trim(),
                hallazgo: finding,
                accion: found?.accion || '–',
                responsable: found?.responsable || '–',
                fecha: found?.fecha || '–',
                prioridad: it.score === 'NC' ? 'alta' : 'media',
                estado: found?.estado || 'Pendiente',
                score: it.score
              });
            });
            // Fallback si no hay hallazgos
            if (findings.length === 0 || findings.every(f=>!f.trim())) {
              pdfActions.push({
                seccion: secS.roman+'. '+secS.title.split('(')[0].trim(),
                hallazgo: it.text,
                accion: '–',
                responsable: '–',
                fecha: '–',
                prioridad: it.score === 'NC' ? 'alta' : 'media',
                estado: 'Pendiente',
                score: it.score
              });
            }
          }
        });
      });
      // Also include manual actions
      (ev.s17?.acciones||[]).filter(a=>a.seccion==='Manual').forEach(a => pdfActions.push({...a}));

      // Group: NC = high priority (red), CP = medium priority (amber), Manual = separate
      const ncActs    = pdfActions.filter(a => a.score === 'NC' && a.seccion !== 'Manual');
      const cpActs    = pdfActions.filter(a => a.score === 'CP' && a.seccion !== 'Manual');
      const manualActs = pdfActions.filter(a => a.seccion === 'Manual');

      const renderActRow = (a, i) => `<tr style="background:${i%2?'#f9fafd':'#fff'}">
        <td style="padding:6px 10px;font-size:10px;color:#666;width:130px">${a.seccion||'–'}</td>
        <td style="padding:6px 10px;font-size:11px;line-height:1.4">${a.hallazgo||'–'}</td>
        <td style="padding:6px 10px;font-size:11px">${a.accion||'–'}</td>
        <td style="padding:6px 10px;font-size:11px;width:90px">${a.responsable||'–'}</td>
        <td style="padding:6px 10px;font-size:11px;width:70px">${a.fecha||'–'}</td>
        <td style="padding:6px 10px;font-size:11px;font-weight:700;width:55px;color:${a.prioridad==='alta'?'#C91B38':'#C8951A'}">${(a.prioridad||'').toUpperCase()}</td>
        <td style="padding:6px 10px;font-size:11px;width:70px">${a.estado||'–'}</td>
      </tr>`;

      const tableHeader = `<thead><tr style="background:#0D172F">
        ${['Sección','Hallazgo / Ítem','Acción Correctiva','Responsable','Fecha','Prior.','Estado'].map(h=>`<th style="padding:7px 10px;color:#fff;font-size:10px;text-align:left">${h}</th>`).join('')}
      </tr></thead>`;

      let actContent = '';
      if (ncActs.length) {
        actContent += `<div style="font-size:11px;font-weight:700;color:#C91B38;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;padding:6px 10px;background:#fde8ec;border-radius:6px">⚠ No Cumple – Acción Inmediata (${ncActs.length} hallazgos)</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #f0c0c8;margin-bottom:16px">
          ${tableHeader}<tbody>${ncActs.map(renderActRow).join('')}</tbody></table>`;
      }
      if (cpActs.length) {
        actContent += `<div style="font-size:11px;font-weight:700;color:#B07A00;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;padding:6px 10px;background:#fdf5e6;border-radius:6px">! Cumple Parcialmente – Mejora Requerida (${cpActs.length} hallazgos)</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #f0dfa0;margin-bottom:16px">
          ${tableHeader}<tbody>${cpActs.map(renderActRow).join('')}</tbody></table>`;
      }
      if (manualActs.length) {
        actContent += `<div style="font-size:11px;font-weight:700;color:#0D172F;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;padding:6px 10px;background:#f0f3fd;border-radius:6px">Acciones Adicionales
        </div><table style="width:100%;border-collapse:collapse;border:1px solid #c8d0ee;margin-bottom:16px">
          ${tableHeader}<tbody>${manualActs.map(renderActRow).join('')}</tbody></table>`;
      }
      if (!actContent) actContent = '<p style="color:#888;font-size:12px;font-style:italic;padding:12px">Sin hallazgos de No Cumple o Cumple Parcialmente registrados.</p>';

      content = actContent;
      content += `<div style="margin-top:16px;padding:12px 16px;background:#fafbff;border:1px solid #e8ebf5;border-radius:8px">
        <p style="font-size:11px;font-weight:700;color:#0D172F;text-transform:uppercase;margin:0 0 6px">Conclusión</p>
        <p style="font-size:12px;line-height:1.7;color:#333;margin:0">${ev.s17?.conclusion||'–'}</p>
      </div>
      <div style="margin-top:10px;padding:12px 16px;background:#fdf9f0;border:1px solid #f0e8cc;border-radius:8px">
        <p style="font-size:11px;font-weight:700;color:#C8951A;text-transform:uppercase;margin:0 0 6px">Recomendaciones Finales</p>
        <p style="font-size:12px;line-height:1.7;color:#333;margin:0">${ev.s17?.recomendaciones||'–'}</p>
      </div>`;

    /* ── XVIII. Matriz de Riesgo ── */
    } else if (sec.key === 's18') {
      const riesgos = ev.s18?.riesgos || [];
      
      // Grid Visual logic for PDF
      let gridRows = '';
      for (let y = 5; y >= 1; y--) {
        let cells = '';
        for (let x = 1; x <= 5; x++) {
          const score = x * y;
          const bg = score <= 4 ? '#2ECC71' : score <= 9 ? '#F1C40F' : score <= 15 ? '#E67E22' : '#E74C3C';
          const count = riesgos.filter(r => r.probabilidad == x && r.impacto == y).length;
          cells += `<td style="width:40px;height:40px;background:${bg};border:1px solid #fff;text-align:center;font-size:10px;font-weight:700;color:rgba(255,255,255,0.8);position:relative">
            ${count > 0 ? `<div style="color:#000;background:#fff;border-radius:50%;width:18px;height:18px;line-height:18px;margin:0 auto;box-shadow:0 1px 3px rgba(0,0,0,0.2)">${count}</div>` : score}
          </td>`;
        }
        gridRows += `<tr><td style="width:20px;font-size:10px;font-weight:700;text-align:right;padding-right:5px;color:#666">${y}</td>${cells}</tr>`;
      }

      const visualMatrix = `
        <div style="margin:20px auto;width:250px;text-align:center">
          <table style="border-collapse:collapse;margin:0 auto">
            ${gridRows}
            <tr><td></td><td style="font-size:10px;font-weight:700;color:#666;height:20px">1</td><td style="font-size:10px;font-weight:700;color:#666">2</td><td style="font-size:10px;font-weight:700;color:#666">3</td><td style="font-size:10px;font-weight:700;color:#666">4</td><td style="font-size:10px;font-weight:700;color:#666">5</td></tr>
          </table>
          <div style="font-size:9px;color:#888;margin-top:5px;font-weight:700;text-transform:uppercase">← Probabilidad →</div>
        </div>
      `;

      const analysisTable = `
        <table style="width:100%;border-collapse:collapse;border:1px solid #e0e3ee;font-size:11px">
          <thead><tr style="background:#0D172F;color:#fff">
            <th style="padding:8px;text-align:left">Amenaza / Riesgo</th>
            <th style="padding:8px;text-align:center;width:60px">Prob.</th>
            <th style="padding:8px;text-align:center;width:60px">Imp.</th>
            <th style="padding:8px;text-align:center;width:80px">Nivel</th>
          </tr></thead>
          <tbody>
            ${riesgos.length ? riesgos.map((r,i) => {
              const score = r.probabilidad * r.impacto;
              const lvl = score <= 4 ? 'Bajo' : score <= 9 ? 'Medio' : score <= 15 ? 'Alto' : 'Muy Alto';
              const color = score <= 4 ? '#2ECC71' : score <= 9 ? '#F1C40F' : score <= 15 ? '#E67E22' : '#E74C3C';
              return `<tr style="background:${i%2?'#f9fafd':'#fff'}">
                <td style="padding:7px 10px;font-weight:600">${r.amenaza}</td>
                <td style="padding:7px 10px;text-align:center">${r.probabilidad}</td>
                <td style="padding:7px 10px;text-align:center">${r.impacto}</td>
                <td style="padding:7px 10px;text-align:center"><span style="color:#fff;background:${color};padding:2px 6px;border-radius:4px;font-weight:700;font-size:9px">${lvl.toUpperCase()}</span></td>
              </tr>`;
            }).join('') : '<tr><td colspan="4" style="padding:15px;text-align:center;color:#888">No se registraron amenazas específicas en la matriz.</td></tr>'}
          </tbody>
        </table>
      `;

      content = `
        <div style="display:grid;grid-template-columns:250px 1fr;gap:20px;align-items:center">
          <div>${visualMatrix}</div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#0D172F;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;border-bottom:1px solid #0D172F;padding-bottom:4px">Análisis Cuantitativo</div>
            ${analysisTable}
          </div>
        </div>
        <div style="margin-top:15px;display:flex;gap:15px;justify-content:center;font-size:9px;font-weight:700">
           <span style="color:#2ECC71">■ BAJO (1-4)</span>
           <span style="color:#F1C40F">■ MEDIO (5-9)</span>
           <span style="color:#E67E22">■ ALTO (10-15)</span>
           <span style="color:#E74C3C">■ MUY ALTO (16-25)</span>
        </div>
      `;

    /* ── XIX. Control de Armamento ── */
    } else if (sec.key === 's19a') {
      const d = ev.s19a;
      const pct = computeSectionScore('s19a', ev);
      const sc = hexColor(pct);
      const barPct = pct || 0;

      const progressBar = `
        <div style="margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
            <div style="flex:1">
              <div style="width:100%;height:10px;background:#e8eaf0;border-radius:99px;overflow:hidden;border:1px solid #ddd">
                <div style="height:10px;width:${barPct}%;background:${sc};border-radius:99px;display:block"></div>
              </div>
            </div>
            <strong style="color:${sc};font-size:16px;font-family:Georgia,serif;min-width:48px;text-align:right">${pct!==null?pct+'%':'–'}</strong>
            <span style="font-size:10px;padding:2px 8px;border-radius:12px;font-weight:700;background:${sc}18;color:${sc};border:1px solid ${sc}44">${scoreToLabel(pct)}</span>
          </div>
        </div>`;

      const rows = (d?.items||[]).map((it,i) => {
        const badge = it.score
          ? `<span style="font-weight:800;padding:2px 6px;border-radius:4px;font-size:10px;background:${it.score==='C'?'#e6f5f0':it.score==='CP'?'#fdf5e6':it.score==='NC'?'#fde8ec':'#f0f2f8'};color:${it.score==='C'?'#007A55':it.score==='CP'?'#B07A00':it.score==='NC'?'#C91B38':'#546085'}">${it.score}</span>`
          : '<span style="color:#bbb;font-size:10px">–</span>';
        return `<tr style="background:${i%2===0?'#f9fafd':'#fff'}">
          <td style="padding:6px 10px;color:#999;font-size:11px;width:24px;text-align:center">${i+1}</td>
          <td style="padding:6px 10px;font-size:11px;line-height:1.5;color:#333">${it.text}</td>
          <td style="padding:6px 10px;text-align:center;width:60px">${badge}</td>
          <td style="padding:6px 10px;font-size:10px;color:#666;width:140px">${Array.isArray(it.obs)?it.obs.join('; '):(it.obs||'')}</td>
        </tr>`;
      }).join('');

      const armeroLabels = { si_dedicado:'Sí – Armero dedicado', si_improvised:'Sí – Espacio improvisado', no:'No – Sin espacio habilitado' };
      const trampaLabels = { si:'Sí – Trampa de balas instalada', si_otra:'Sí – Otro mecanismo', no:'No – Sin zona habilitada' };
      const licLabels   = { '100':'100% – Todos vigentes', '75-99':'75-99% – Mayoría vigente', '50-74':'50-74% – Mitad vigente', '<50':'Menos del 50% – Crítico', '0':'0% – Ninguno' };

      const summaryBlock = `
        <div style="margin-top:14px;padding:12px 14px;background:#f5f0e8;border-left:4px solid #C8951A;border-radius:0 8px 8px 0;margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;color:#0D172F;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
            Datos Cuantitativos de Armamento
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <tr><td style="padding:4px 8px;color:#555;width:220px">Armero / Depósito Seguro:</td><td style="padding:4px 8px;font-weight:600">${armeroLabels[d.tieneArmero]||d.tieneArmero||'–'}</td></tr>
            <tr style="background:rgba(255,255,255,.6)"><td style="padding:4px 8px;color:#555">Trampa de Balas / Descarga Segura:</td><td style="padding:4px 8px;font-weight:600">${trampaLabels[d.tieneTrampa]||d.tieneTrampa||'–'}</td></tr>
            <tr><td style="padding:4px 8px;color:#555">Tipo de Armamento:</td><td style="padding:4px 8px;font-weight:600">${d.tipoArmamento||'–'}</td></tr>
            <tr style="background:rgba(255,255,255,.6)"><td style="padding:4px 8px;color:#555">Cantidad Total de Armas:</td><td style="padding:4px 8px;font-weight:700;color:#0D172F">${d.cantidadArmas||0}</td></tr>
            <tr><td style="padding:4px 8px;color:#555">Oficiales Armados:</td><td style="padding:4px 8px;font-weight:700;color:#0D172F">${d.cantidadOficialesArmados||0}</td></tr>
            <tr style="background:rgba(255,255,255,.6)"><td style="padding:4px 8px;color:#555">% con Licencia Vigente:</td><td style="padding:4px 8px;font-weight:700;color:${d.porcentajeLicencias==='100'?'#007A55':d.porcentajeLicencias==='0'||d.porcentajeLicencias==='<50'?'#C91B38':'#B07A00'}">${licLabels[d.porcentajeLicencias]||d.porcentajeLicencias||'–'}</td></tr>
            ${d.observacionesArmamento ? `<tr><td style="padding:4px 8px;color:#555">Observaciones:</td><td style="padding:4px 8px;font-style:italic;color:#444">${d.observacionesArmamento}</td></tr>` : ''}
          </table>
        </div>`;

      const photoBlockArm = (ev.photos?.s19a||[]).map(p =>
        `<div style="display:inline-block;margin:6px;text-align:center;vertical-align:top;page-break-inside:avoid">
          <img src="${p.data}" style="width:130px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #ddd;display:block"/>
          <div style="font-size:9px;color:#666;margin-top:3px;max-width:130px">${p.caption||''}</div>
        </div>`).join('');

      content = `
        ${progressBar}
        <table style="width:100%;border-collapse:collapse;border:1px solid #e0e3ee">
          <thead><tr style="background:#0D172F">
            <th style="padding:9px 10px;color:#fff;font-size:10px;text-align:center;width:28px">#</th>
            <th style="padding:9px 12px;color:#fff;font-size:10px;text-align:left">Ítem de Verificación</th>
            <th style="padding:9px 10px;color:#fff;font-size:10px;text-align:center;width:60px">Cal.</th>
            <th style="padding:9px 12px;color:#fff;font-size:10px;text-align:left;width:140px">Observación / Hallazgo</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${summaryBlock}
        ${d?.observaciones ? `<div style="margin-top:10px;padding:10px;background:#fdf9f0;border-left:3px solid #C8951A;font-size:11px;color:#444"><strong>Notas de la sección:</strong> ${d.observaciones}</div>` : ''}
        ${photoBlockArm ? `<div style="margin-top:12px"><div style="font-size:10px;font-weight:800;color:#0D172F;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px">Evidencia Fotográfica</div>${photoBlockArm}</div>` : ''}`;

    } else {
      content = `<p style="color:#888;font-size:12px;font-style:italic">Sección informativa – ver documento de referencia.</p>`;
    }

    return `
      <div style="margin-bottom:28px">
        <div style="display:flex;align-items:center;gap:12px;background:#0D172F;padding:10px 16px;border-radius:8px 8px 0 0;page-break-after:avoid;">
          <div style="width:30px;height:30px;background:#C8951A;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-weight:900;font-size:13px;color:#0D172F;flex-shrink:0">${sec.roman}</div>
          <div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:16px;color:#C8951A;flex-shrink:0"><i class="fas ${sec.icon}"></i></div>
          <div style="font-family:Georgia,serif;font-size:14px;font-weight:700;color:#fff">${sec.title}</div>
        </div>
        <div style="border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;padding:14px 16px;background:#fff">${content}</div>
      </div>`;
  }).join('');

  /* ---------- SCORE BARS EN PORTADA ---------- */
  const scoreBarsHtml = SCORED_SECTIONS.map(sk => {
    const s = SECTIONS.find(x => x.key === sk);
    const p = computeSectionScore(sk, ev);
    const c = scoreColor(p);
    const bw = p || 0;
    // Shorten title for portada
    const shortTitle = s.title.split('(')[0].trim().split(' ').slice(0,2).join(' ');
    return `<div style="text-align:center">
      <div style="font-size:8.5px;color:#aaa;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;line-height:1.2">${shortTitle}</div>
      <div style="height:6px;background:rgba(255,255,255,0.15);border-radius:99px;overflow:hidden;margin-bottom:4px">
        <div style="height:6px;width:${bw}%;background:${c};border-radius:99px;display:block"></div>
      </div>
      <div style="font-size:12px;font-weight:700;color:${c}">${p!==null?p+'%':'–'}</div>
    </div>`;
  }).join('');

  /* ---------- HTML COMPLETO ---------- */
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<title>Informe Seguridad Patrimonial – ${ev.s1.nombreSitio||'Sitio'}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
  :root {
    --critico: #C91B38;
    --deficiente: #D96008;
    --observacion: #B07A00;
    --aceptable: #007A55;
    --text-m: #546085;
  }
  @page { size:A4; margin:18mm 18mm 20mm; }
  body { font-family:Arial,Helvetica,sans-serif; color:#222; margin:0; padding:0; font-size:12px; }
  .page-header { background:#0D172F; color:#fff; padding:24px 28px 18px; margin-bottom:24px; }
  .ph-top { display:flex; align-items:center; gap:18px; margin-bottom:14px; }
  .ph-badge { width:auto; height:56px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .ph-titles { flex:1; }
  .ph-corp { font-size:11px; color:#C8951A; letter-spacing:.07em; text-transform:uppercase; margin-bottom:2px; }
  .ph-doc { font-family:Georgia,serif; font-size:21px; font-weight:700; color:#fff; line-height:1.1; margin-top:4px; }
  .ph-meta { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; border-top:1px solid rgba(255,255,255,0.2); padding-top:14px; }
  .meta-item { padding-right:10px; border-right:1px solid rgba(255,255,255,0.12); }
  .meta-item:last-child { border-right:none; }
  .meta-label { font-size:9px; color:rgba(255,255,255,0.55); text-transform:uppercase; letter-spacing:.08em; font-weight:700; }
  .meta-val { font-size:13px; color:#fff; font-weight:600; margin-top:2px; }
  .score-hero { text-align:center; padding:26px 20px 20px; background:#fff; border:2px solid #0D172F; border-radius:14px; margin-bottom:28px; page-break-inside:avoid; position:relative; box-shadow:0 8px 20px rgba(30,43,82,0.1); }
  .score-hero::before { content:''; position:absolute; top:0; left:0; right:0; height:6px; background:#C8951A; border-radius:12px 12px 0 0; }
  .score-num { font-family:Georgia,serif; font-size:78px; font-weight:900; line-height:1; color:${color}; }
  .score-label { font-size:18px; font-weight:800; color:${color}; letter-spacing:.1em; text-transform:uppercase; border-top:1px solid #eee; display:inline-block; padding-top:8px; margin-top:6px; }
  .score-bars { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; margin-top:18px; padding-top:16px; border-top:1px dashed #e0e3ee; }
  table { width:100%; border-collapse:collapse; margin-bottom:10px; }
  th { text-align:left; }
  @media print { 
    .page-break { page-break-before:always; } 
    .avoid-break { page-break-inside: avoid; }
  }
  
  /* Footer styles for PDF Cover Page */
  .cover-page {
    position: relative;
    height: 95vh;
    page-break-after: always;
  }
  .pdf-footer {
    position: absolute;
    bottom: 0px;
    left: 0;
    right: 0;
  }
  .pdf-footer img {
    width: 100%;
    display: block;
    object-fit: contain;
  }
</style>
</head><body>

<div class="cover-page">
  <div class="page-header">
    <div class="ph-top">
      <div class="ph-badge">
        <img src="logo.png" style="height:60px; width:auto; display:block;">
      </div>
      <div class="ph-titles">
        <div class="ph-corp">Corporación K-9 Seguridad · Seguridad Patrimonial</div>
        <div class="ph-doc">Informe de Evaluación de Riesgos de Seguridad</div>
      </div>
    </div>
    <div class="ph-meta">
      <div class="meta-item"><div class="meta-label">Sitio Evaluado</div><div class="meta-val">${ev.s1.nombreSitio||'–'}</div></div>
      <div class="meta-item"><div class="meta-label">Fecha</div><div class="meta-val">${ev.s1.fechaEvaluacion||'–'}</div></div>
      <div class="meta-item"><div class="meta-label">Evaluador</div><div class="meta-val">${ev.s1.evaluador||'–'}</div></div>
      <div class="meta-item"><div class="meta-label">Estado</div><div class="meta-val">${ev.status==='completo'?'Finalizado ✓':'Borrador'}</div></div>
    </div>
  </div>

  <div class="score-hero">
    <div class="score-num">${overall!==null?overall+'%':'–'}</div>
    <div class="score-label">${nivel}</div>
    <p style="font-size:11px;color:#999;margin:6px 0 0">Porcentaje global de cumplimiento en seguridad patrimonial</p>
  </div>

  ${ev.s1.clientLogo ? `
    <div style="margin: 40px auto; text-align: center; max-width: 400px;">
      <p style="font-size:10px; color:#aaa; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.1em;">Evaluación Realizada Para:</p>
      <img src="${ev.s1.clientLogo}" style="max-height:140px; max-width:100%; object-fit:contain; filter:drop-shadow(0 4px 10px rgba(0,0,0,0.05));">
    </div>
  ` : ''}

  <div class="pdf-footer">
    <img src="footer.png" onerror="this.style.opacity='0'" alt="footer"/>
  </div>
</div>

${sectionBlocks}

${localStorage.getItem('k9_evaluator_signature') ? `
  <div style="margin-top:60px;page-break-inside:avoid;text-align:center">
    <div style="display:inline-block;border-bottom:1px solid #333;width:250px;padding-bottom:12px;margin-bottom:8px">
      <img src="${localStorage.getItem('k9_evaluator_signature')}" style="max-width:200px;max-height:80px;object-fit:contain"/>
    </div>
    <div style="font-size:12px;font-weight:700;color:#0D172F">${ev.s1.evaluador||'Evaluador de Seguridad'}</div>
    <div style="font-size:10px;color:#666">${ev.s1.cargo||'Inspector'}</div>
    <div style="font-size:10px;color:#666">${ev.s1.empresa2||'Corporación K-9 Seguridad'}</div>
  </div>
` : `
  <div style="margin-top:80px;page-break-inside:avoid;text-align:center">
    <div style="display:inline-block;border-top:1px solid #333;width:250px;padding-top:8px">
      <div style="font-size:12px;font-weight:700;color:#0D172F">${ev.s1.evaluador||'Evaluador de Seguridad'}</div>
      <div style="font-size:10px;color:#666">${ev.s1.cargo||'Inspector'}</div>
      <div style="font-size:10px;color:#666">${ev.s1.empresa2||'Corporación K-9 Seguridad'}</div>
    </div>
  </div>
`}

<div style="margin-top:40px;padding-top:14px;border-top:2px solid #0D172F;display:flex;justify-content:space-between;align-items:center">
  <div style="font-size:10px;color:#888">Corporación K-9 Internacional · Sistema de Análisis de Riesgos Patrimonial</div>
  <div style="font-size:10px;color:#888">Generado: ${new Date().toLocaleString('es-CR')}</div>
</div>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
    showToast('📄 Informe listo. Use "Guardar como PDF" en el diálogo de impresión.', 'info');
  }, 1500);
}
