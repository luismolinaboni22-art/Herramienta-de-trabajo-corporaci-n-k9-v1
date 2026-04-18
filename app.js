'use strict';
/* ============================================================
   app.js – Logic for the Patrimonial Security Platform
   ============================================================ */

let DB = JSON.parse(localStorage.getItem('patrimonial_evals') || '[]');
let currentEval = null;
let currentSection = 1;

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  switchModule('home');
});

function toggleMainHeader(show) {
  const header = document.getElementById('appHeader');
  if (header) header.style.display = show ? 'block' : 'none';
}

/* ── Persist ─────────────────────────────────────────────── */
function saveDB() { localStorage.setItem('patrimonial_evals', JSON.stringify(DB)); }

/* ── PERSISTENCIA LOCAL (EXPORT/IMPORT) ───────────────────── */
async function exportDatabase() {
  if (DB.length === 0) {
    showToast("No hay evaluaciones para exportar.");
    return;
  }
  
  showToast("Preparando exportación completa con imágenes...", "info");
  
  // Collect ALL photos from all evaluations
  const allPhotos = {};
  for (const ev of DB) {
    const evPhotos = await PhotoDB.exportPhotos(ev.id);
    Object.assign(allPhotos, evPhotos);
  }

  const exportData = {
    type: 'K9FullBackup',
    version: 1,
    db: DB,
    photos: allPhotos
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const timestamp = new Date().toISOString().slice(0,10);
  link.download = `respaldo_completo_k9_${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Base de datos completa (con fotos) exportada.");
}

function triggerImport() {
  document.getElementById('importInput').click();
}

function importDatabase(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      let evalsToImport = [];
      let photosToImport = {};

      // Detect format: Full Backup with photos or Legacy Array only
      if (imported.type === 'K9FullBackup') {
        evalsToImport = imported.db || [];
        photosToImport = imported.photos || {};
      } else if (Array.isArray(imported)) {
        evalsToImport = imported;
      } else {
        showToast("Error: Formato de archivo inválido.", "error");
        return;
      }

      if (confirm(`¿Desea importar ${evalsToImport.length} evaluaciones? Esto podría sobrescribir datos existentes.`)) {
        // Import evaluations to localStorage
        evalsToImport.forEach(item => {
          const idx = DB.findIndex(e=>e.id===item.id);
          if (idx >= 0) DB[idx] = item; else DB.push(item);
        });
        saveDB();

        // Import photos to IndexedDB
        if (Object.keys(photosToImport).length > 0) {
          showToast("Importando imágenes...", "info");
          await PhotoDB.importPhotos(photosToImport);
        }

        renderDashboard();
        showToast("Importación completada con éxito.");
      }
    } catch (err) {
      console.error(err);
      showToast("Error al leer el archivo JSON.", "error");
    }
    event.target.value = ''; // Reset input
  };
  reader.readAsText(file);
}

/* ── NAVIGATION (MODULE SWITCHER) ───────────────────────── */
function switchModule(moduleName) {
  // Hide all modules
  document.querySelectorAll('.module-view').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  
  // Bug fix: Hide Evaluation Wizard and reset header state
  const evalView = document.getElementById('viewEvaluation');
  if (evalView) evalView.style.display = 'none';
  
  const bc = document.getElementById('evalBreadcrumb'); if (bc) bc.style.display = 'none';
  const bb = document.getElementById('btnBackDash'); if (bb) bb.style.display = 'none';
  const hp = document.getElementById('headerProgress'); if (hp) hp.style.display = 'none';

  // Show target module
  const targetModule = document.getElementById('module' + moduleName.charAt(0).toUpperCase() + moduleName.slice(1));
  if (targetModule) {
    targetModule.classList.add('active');
    // Ensure the dashboard view is visible within moduleRisks
    if (moduleName === 'risks') {
        const vd = document.getElementById('viewDashboard');
        if (vd) vd.style.display = 'block';
    }
  }
  
  const targetMenu = document.getElementById('menu-' + moduleName);
  if (targetMenu) targetMenu.classList.add('active');

  // Specific initializations
  if (moduleName === 'home') {
    toggleMainHeader(false);
    renderHomeDashboard();
  } else if (moduleName === 'risks') {
    toggleMainHeader(false);
    renderDashboard();
  } else if (moduleName === 'minutas') {
    toggleMainHeader(false);
    if (window.initMinutas) window.initMinutas();
  } else if (moduleName === 'incidentes') {
    toggleMainHeader(false);
    if (window.initIncidentes) window.initIncidentes();
  } else if (moduleName === 'seguimiento') {
    toggleMainHeader(false);
    if (window.initSeguimiento) window.initSeguimiento();
  } else if (moduleName === 'clientes') {
    toggleMainHeader(false);
    if (window.initClientes) window.initClientes();
  } else if (moduleName === 'calendario') {
    toggleMainHeader(false);
    if (window.initCalendario) window.initCalendario();
  }
}

/* ── HOME DASHBOARD RENDER ────────────────────────────── */
function renderHomeDashboard() {
  const container = document.getElementById('viewHomeDashboard');
  if (!container) return;

  const clients = JSON.parse(localStorage.getItem('k9_clientes') || '[]');

  // Risk Analysis Semaphore Logic
  const riskStatusList = clients.map(client => {
    const clientEvals = DB.filter(e => (e.s1.nombreSitio || '').toLowerCase().includes(client.nombre.toLowerCase()));
    const latest = clientEvals.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
    
    let status = 'red';
    let label = 'PENDIENTE';
    let dateStr = 'Sin registro';
    let expiryStr = '--';
    
    if (latest) {
      const evalDate = new Date(latest.updatedAt);
      const diffMonths = (new Date() - evalDate) / (1000 * 60 * 60 * 24 * 30);
      if (diffMonths < 6) { status = 'green'; label = 'AL DÍA'; }
      dateStr = evalDate.toLocaleDateString();
      const expiryDate = new Date(evalDate);
      expiryDate.setMonth(expiryDate.getMonth() + 6);
      expiryStr = expiryDate.toLocaleDateString();
    }
    return { name: client.nombre, status, label, date: dateStr, expiry: expiryStr };
  });


  container.innerHTML = `
    <div class="home-dash">
      <div class="home-hero">
        <div class="dash-hero-scanline"></div>
        <div class="home-hero-content">
          <div class="home-hero-text">
            <div class="dash-corp-tag"><i class="fas fa-tower-observation"></i> COMMAND CENTER · ONLINE</div>
            <h1>Centro de <span class="accent">Operaciones</span></h1>
            <p>Supervisión táctica de riesgos, compromisos y bitácora operativa de Corporación K-9 Internacional.</p>
          </div>
          <div class="home-hero-stats">
            <div class="hero-stat">
              <div class="hero-stat-value">${clients.length}</div>
              <div class="hero-stat-label">Clientes</div>
            </div>
            <div class="hero-stat">
              <div class="hero-stat-value">${DB.length}</div>
              <div class="hero-stat-label">Análisis</div>
            </div>

          </div>
        </div>
      </div>

      <div class="home-grid-wrapper">
        <!-- SEMAPHORE SECTION -->
        <div class="home-section-card">
          <div class="home-section-title">
            <i class="fas fa-traffic-light"></i> Cumplimiento de Análisis
          </div>
          ${riskStatusList.length === 0
            ? `<div class="empty-state"><i class="fas fa-building-user"></i>No hay clientes registrados.</div>`
            : riskStatusList.map(r => `
              <div class="sem-card-item">
                <div class="sem-dot ${r.status}"></div>
                <div>
                  <div class="sem-info-name">${r.name}</div>
                  <div class="sem-info-sub">Realizado: ${r.date} &nbsp;|&nbsp; Próximo: ${r.expiry}</div>
                </div>
                <span class="sem-badge ${r.status}">${r.label}</span>
              </div>
            `).join('')}
        </div>


      </div>
    </div>
  `;
}

/* ── Clock Update ────────────────────────────────────────── */
function tick() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const dsb = document.getElementById('dsbTime');
  const hClock = document.getElementById('headerClock');
  const hClockLarge = document.getElementById('homeClockLarge');
  if (dsb) dsb.textContent = timeStr;
  if (hClock) hClock.textContent = timeStr;
  if (hClockLarge) hClockLarge.textContent = timeStr;
}
setInterval(tick, 1000); tick();

/* ── AUTO-SAVE LOGIC ─────────────────────────────────────── */
let autoSaveTimeout = null;

function debounce(func, delay) {
  return function(...args) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => func.apply(this, args), delay);
  };
}

function updateAutoSaveStatus(status) {
  const el = document.getElementById('autoSaveStatus');
  if (!el) return;
  el.className = 'autosave-status ' + status;
  el.innerHTML = '<i></i>';
  if (status === 'saved') {
    setTimeout(() => { if (el.classList.contains('saved')) el.style.opacity = '0.5'; }, 2000);
  } else {
    el.style.opacity = '1';
  }
}

function autoSave() {
  if (!currentEval || currentEval.status === 'completo') return;
  updateAutoSaveStatus('saving');
  flushCurrentSection();
  currentEval.updatedAt = new Date().toISOString();
  const idx = DB.findIndex(e => e.id === currentEval.id);
  if (idx >= 0) DB[idx] = currentEval; else DB.push(currentEval);
  saveDB();
  updateAutoSaveStatus('saved');
}

const debouncedAutoSave = debounce(autoSave, 800);

/* ══ DASHBOARD ═══════════════════════════════════════════════ */
function renderDashboard() {
  const q = (document.getElementById('dashSearch')?.value||'').toLowerCase();
  let evals = [...DB].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  if (q) evals = evals.filter(e=>(e.s1.nombreSitio+e.s1.evaluador+e.s1.direccion).toLowerCase().includes(q));

  const critico = DB.filter(e=>scoreToNivel(computeOverallScore(e))==='critico').length;
  const deficiente = DB.filter(e=>scoreToNivel(computeOverallScore(e))==='deficiente').length;
  const aceptable = DB.filter(e=>['aceptable','observacion'].includes(scoreToNivel(computeOverallScore(e)))).length;
  document.getElementById('hsTotal').textContent = DB.length;
  document.getElementById('hsCritico').textContent = critico;
  document.getElementById('hsDeficiente').textContent = deficiente;
  document.getElementById('hsAceptable').textContent = aceptable;

  const list = document.getElementById('evalList');
  if (!evals.length) {
    list.innerHTML = `<div class="empty-dash"><i class="fas fa-file-circle-plus"></i><h3>Sin evaluaciones registradas</h3><p>Comience creando la primera evaluación de seguridad patrimonial.</p><button class="btn-primary" onclick="startNewEvaluation()"><i class="fas fa-plus"></i> Comenzar ahora</button></div>`;
    return;
  }
  list.innerHTML = evals.map(ev => {
    const pct = computeOverallScore(ev);
    const nivel = scoreToNivel(pct);
    const scoreDisp = pct !== null ? pct+'%' : '–';
    const fecha = ev.s1.fechaEvaluacion || ev.createdAt.slice(0,10);
    const sitio = ev.s1.nombreSitio || 'Sin nombre';
    const badge = `<span class="ec-badge badge-${nivel}">${scoreToLabel(pct)}</span>`;
    return `<div class="eval-card nivel-${nivel}" onclick="openEvaluation('${ev.id}')">
      <div class="ec-score blink-slow"><span class="ec-score-num">${scoreDisp}</span><span class="ec-score-pct">Cumpl.</span></div>
      <div class="ec-info">
        <div class="ec-title">${sitio}</div>
        <div class="ec-sub">
          <span><i class="fas fa-calendar-day"></i>${fecha}</span>
          <span><i class="fas fa-user-tie"></i>${ev.s1.evaluador||'Sin evaluador'}</span>
          <span><i class="fas fa-location-dot"></i>${ev.s1.provincia||'Sin ubicación'}</span>
        </div>
      </div>
      <div class="ec-tags">${badge}</div>
      <div class="ec-actions" onclick="event.stopPropagation()">
        <button class="btn-icon pdf" onclick="downloadPDF('${ev.id}')" title="Descargar PDF"><i class="fas fa-file-pdf"></i></button>
        <button class="btn-icon del" onclick="deleteEval('${ev.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

/* ── New / Open ─────────────────────────────────────────── */
function startNewEvaluation() {
  currentEval = newEvalTemplate();
  currentSection = 1;
  showWizard();
}

async function openEvaluation(id) {
  currentEval = DB.find(e => e.id == id);
  if (!currentEval) return;
  
  // Migration checks
  const migratedPhotos = await migrateExistingPhotos(currentEval);
  const updatedQuestions = syncQuestions(currentEval);
  
  if (migratedPhotos || updatedQuestions) saveDB();
  
  currentSection = 1;
  toggleMainHeader(false); // Hide black space during evaluation
  document.getElementById('viewDashboard').style.display = 'none';
  document.getElementById('viewEvaluation').style.display = 'flex';
  document.getElementById('btnBackDash').style.display = 'flex';
  document.getElementById('headerProgress').style.display = 'block';
  document.getElementById('eval-hero-site-name').textContent = currentEval.s1.nombreSitio || 'Sitio Sin Nombre';
  document.getElementById('eval-hero-subtitle').textContent = `Evaluador: ${currentEval.s1.evaluador || 'No asignado'} | ${currentEval.s1.fecha || ''} | AUDITORÍA ACTIVA`;
  
  buildSidebarNav();
  goToSection(1);
}

/**
 * Ensures current evaluation has the latest questions from data.js
 */
function syncQuestions(ev) {
  let changed = false;
  if (!ev) return false;

  SCORED_SECTIONS.forEach(sk => {
    // If the section doesn't exist at all, initialize it (e.g. newly added sections)
    if (!ev[sk]) {
      ev[sk] = { items: [], observaciones: '' };
      if (sk === 's19a') {
        Object.assign(ev.s19a, {
          tieneArmero:'', tieneTrampa:'', tipoArmamento:'', cantidadArmas:0, cantidadOficialesArmados:0,
          porcentajeLicencias:'', observacionesArmamento:''
        });
      }
      changed = true;
    }
    if (!ev[sk].items) { ev[sk].items = []; changed = true; }

    const latestList = CHECKLISTS[sk] || [];
    const currentItems = ev[sk].items;

    latestList.forEach((text, i) => {
      if (currentItems[i]) {
        // Update text if it changed in data.js
        if (currentItems[i].text !== text) {
          currentItems[i].text = text;
          changed = true;
        }
      } else {
        // Add new question if it's missing
        currentItems.push({ id: i, text: text, score: null, obs: '' });
        changed = true;
      }
    });
  });
  return changed;
}

function deleteEval(id) {
  if (confirm('¿Está seguro de eliminar esta evaluación permanentemente?')) {
    DB = DB.filter(e => e.id != id);
    saveDB();
    PhotoDB.deletePhotosForEval(id); // Async cleanup
    renderDashboard();
    showToast('Evaluación eliminada.');
  }
}

function showWizard() {
  document.getElementById('viewDashboard').style.display = 'none';
  document.getElementById('viewEvaluation').style.display = 'flex';
  document.getElementById('evalBreadcrumb').style.display = 'flex';
  document.getElementById('btnBackDash').style.display = 'flex';
  document.getElementById('headerProgress').style.display = 'block';
  updateBreadcrumb();
  buildSidebarNav();
  goToSection(currentSection);
}

function showDashboard() {
  switchModule('risks'); // Ensure we are on the risks module
  document.getElementById('viewDashboard').style.display = 'block';
  document.getElementById('viewEvaluation').style.display = 'none';
  document.getElementById('evalBreadcrumb').style.display = 'none';
  document.getElementById('btnBackDash').style.display = 'none';
  document.getElementById('headerProgress').style.display = 'none';
  currentEval = null;
  renderDashboard();
}

function confirmBackDashboard() {
  openModal('Salir de la evaluación', '¿Desea guardar los cambios antes de volver al dashboard?',
    `<button class="btn-primary" onclick="saveEvaluation(false);showDashboard();closeModal()"><i class="fas fa-save"></i> Guardar y salir</button>
     <button class="btn-ghost" onclick="showDashboard();closeModal()">Salir sin guardar</button>
     <button class="btn-ghost" onclick="closeModal()">Cancelar</button>`
  );
}

/* ══ SIDEBAR ═════════════════════════════════════════════════ */
function buildSidebarNav() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = SECTIONS.map(s => {
    const done = isSectionDone(s.key);
    const pct = s.type==='scored' ? computeSectionScore(s.key, currentEval) : null;
    let statusHtml = '';
    if (pct !== null) statusHtml = `<span class="snav-status scored" style="color:${scoreColor(pct)}">${pct}%</span>`;
    else if (done)    statusHtml = `<span class="snav-status done"><i class="fas fa-check"></i></span>`;
    return `<div class="snav-item${s.num===currentSection?' active':''}" id="snav${s.num}" onclick="goToSection(${s.num})">
      <span class="snav-num">${s.roman}</span>
      <span class="snav-icon"><i class="fas ${s.icon}"></i></span>
      <span class="snav-title">${s.title}</span>
      ${statusHtml}
    </div>`;
  }).join('');
}

function isSectionDone(key) {
  if (!currentEval) return false;
  if (key === 's1') return !!(currentEval.s1.nombreSitio && currentEval.s1.evaluador);
  if (key === 's2') return !!(currentEval.s2.objetivos);
  if (key === 's6') return currentEval.s6.riesgos.length > 0;
  if (key === 's7') return !!(currentEval.s7.provincia);
  if (SCORED_SECTIONS.includes(key)) {
    const d = currentEval[key];
    return d && d.items && d.items.some(it=>it.score !== null);
  }
  return false;
}

function updateSidebar() {
  SECTIONS.forEach(s => {
    const el = document.getElementById('snav'+s.num);
    if (!el) return;
    el.className = 'snav-item' + (s.num===currentSection?' active':'');
  });
  // update ring
  const overall = computeOverallScore(currentEval);
  const ringNum = document.getElementById('ringNum');
  const ringFill = document.getElementById('ringFill');
  const circ = 213;
  if (overall !== null) {
    ringNum.textContent = overall+'%';
    ringFill.setAttribute('stroke-dasharray', `${Math.round(circ*(overall/100))} ${circ}`);
    ringFill.style.stroke = scoreColor(overall);
  } else {
    ringNum.textContent = '–';
    ringFill.setAttribute('stroke-dasharray', `0 ${circ}`);
  }
  const completed = SECTIONS.filter(s=>isSectionDone(s.key)).length;
  document.getElementById('sbCompleted').textContent = completed;

  // Hero Stats update
  const hPct = document.getElementById('eval-hero-total-pct');
  const hCard = document.getElementById('eval-hero-score-card');
  if (hPct && hCard) {
    hPct.textContent = (overall || 0) + '%';
    hCard.style.borderColor = scoreColor(overall);
    hCard.className = 'hs-card ' + (overall < 50 ? 'hs-critico' : overall < 85 ? 'hs-deficiente' : 'hs-aceptable');
  }
  // progress bar
  const pct = (currentSection / SECTIONS.length) * 100;
  document.getElementById('hpbFill').style.width = pct+'%';
}

function updateBreadcrumb() {
  const el = document.getElementById('bcSiteName');
  if (el) el.textContent = currentEval?.s1?.nombreSitio || 'Nueva Evaluación';
}

/* ══ NAVIGATION ══════════════════════════════════════════════ */
function goToSection(num) {
  flushCurrentSection();
  currentSection = num;
  const sec = SECTIONS.find(s=>s.num===num);
  document.getElementById('eshNum').textContent = sec.roman;
  document.getElementById('eshTitle').textContent = sec.title;
  document.getElementById('eshDesc').textContent = sec.desc;
  
  // Hero section update
  const hSec = document.getElementById('eval-hero-section-num');
  if (hSec) hSec.textContent = num;
  const scorePnl = document.getElementById('eshScore');
  if (sec.type==='scored') {
    const pct = computeSectionScore(sec.key, currentEval);
    scorePnl.style.display = 'block';
    document.getElementById('eshScoreVal').textContent = pct !== null ? pct+'%' : '–';
    document.getElementById('eshScoreVal').style.color = scoreColor(pct);
  } else { scorePnl.style.display = 'none'; }
  document.getElementById('sectionContent').innerHTML = renderSection(sec);
  
  // Attach Auto-save listeners to the new content
  const contentEl = document.getElementById('sectionContent');
  contentEl.oninput = (e) => {
    if (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target.type === 'text')) {
      debouncedAutoSave();
    } else {
      autoSave();
    }
  };
  contentEl.onchange = (e) => {
    if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox' || e.target.type === 'radio') {
      autoSave();
    }
  };

  document.getElementById('btnPrev').disabled = (num===1);
  document.getElementById('btnNext').textContent = num === SECTIONS.length ? 'Finalizar' : 'Siguiente ›';
  buildSidebarNav();
  updateSidebar();
  if (num === 7) setTimeout(initMap, 200);
}

function nextSection() {
  if (currentSection === SECTIONS.length) { saveEvaluation(true); return; }
  goToSection(currentSection+1);
}
function prevSection() {
  if (currentSection>1) goToSection(currentSection-1);
}

/* ══ SAVE ════════════════════════════════════════════════════ */
function saveEvaluation(finalize=false) {
  flushCurrentSection();
  
  if (finalize) {
    let missingObs = [];
    SCORED_SECTIONS.forEach(sk => {
      const sec = SECTIONS.find(s=>s.key===sk);
      currentEval[sk].items.forEach((it, i) => {
        const findings = Array.isArray(it.obs) ? it.obs : (it.obs ? [it.obs] : []);
        if ((it.score==='NC' || it.score==='CP') && findings.every(f => !f || f.trim().length < 3)) {
          missingObs.push(`${sec.roman} - Ítem ${i+1}`);
        }
      });
    });

    if (missingObs.length > 0) {
      openModal('Observaciones Requeridas', 
        `<p>Para finalizar el reporte, debe ingresar una observación detallada para todos los ítems calificados como <strong>NC</strong> o <strong>CP</strong>.</p>
         <p style="margin-top:10px; color:var(--critico); font-weight:600">Pendientes:</p>
         <ul style="margin-top:5px; font-size:12px; max-height:150px; overflow-y:auto; padding-left:20px">
           ${missingObs.map(m => `<li>${m}</li>`).join('')}
         </ul>`,
        `<button class="btn-primary" onclick="closeModal()">Entendido</button>`
      );
      return;
    }
    currentEval.status = 'completo';
  }

  currentEval.updatedAt = new Date().toISOString();
  const idx = DB.findIndex(e=>e.id===currentEval.id);
  if (idx>=0) DB[idx] = currentEval; else DB.push(currentEval);
  saveDB();
  updateBreadcrumb();
  updateAutoSaveStatus('saved');
  showToast(finalize ? '✅ Evaluación finalizada y guardada.' : '💾 Borrador guardado correctamente.', finalize?'success':'info');
  if (finalize) showDashboard();
}

/* ══ FLUSH (read form values back into currentEval) ══════════ */
function flushCurrentSection() {
  if (!currentEval) return;
  const sec = SECTIONS.find(s=>s.num===currentSection);
  if (!sec) return;
  const get = id => { const el=document.getElementById(id); return el?el.value:''; };

  if (sec.key==='s1') {
    ['nombreSitio','tipoInstalacion','empresa','fechaEvaluacion','evaluador','cargo','empresa2','contacto','area','horarioOperativo','actividadesDetalle'].forEach(f => {
      const el = document.getElementById('f1_'+f); if (el) currentEval.s1[f]=el.value;
    });
  }
  if (sec.key==='s2') { const el=document.getElementById('f2_obj'); if(el) currentEval.s2.objetivos=el.value; }
  if (sec.key==='s3') {
    currentEval.s3.metodos = METHODS.filter(m => document.getElementById('mitem_'+m.id)?.classList.contains('selected')).map(m=>m.id);
    ['fechaInicio','fechaFin','duracion','observaciones'].forEach(f=>{ const el=document.getElementById('f3_'+f); if(el) currentEval.s3[f]=el.value; });
  }
  if (sec.key==='s6') {
    currentEval.s6.riesgos = RISK_MANIFESTATIONS.filter(r=>document.getElementById('r_'+r.id)?.classList.contains('selected')).map(r=>r.id);
    ['nivelAmenaza','descripcion'].forEach(f=>{ const el=document.getElementById('f6_'+f); if(el) currentEval.s6[f]=el.value; });
  }
  if (sec.key==='s7') {
    ['pais','provincia','canton','distrito','dirExacta','coordenadas','latitud','longitud','tipoZona','iluminacion','accesos','accesosSecundarios','norte','sur','este','oeste','observaciones'].forEach(f=>{ const el=document.getElementById('f7_'+f); if(el) currentEval.s7[f]=el.value; });
  }
  if (sec.key==='s8') {
    ['descripcion','conflictividad','historial','presenciaPolicial','zonasProblematicas','factoresExternos','calificacion','fuenteOIJ'].forEach(f=>{ const el=document.getElementById('f8_'+f); if(el) currentEval.s8[f]=el.value; });
    // flush oij stats
    const rows = document.querySelectorAll('.oij-stat-row');
    currentEval.s8.statsOIJ = Array.from(rows).map(row => ({
      delito: row.querySelector('.oij-delito').value,
      cantidad: row.querySelector('.oij-cantidad').value
    })).filter(s => s.delito || s.cantidad);
  }
  if (SCORED_SECTIONS.includes(sec.key)) {
    const items = currentEval[sec.key].items;
    items.forEach((it,i) => {
      const radios = document.getElementsByName(`${sec.key}_s${i}`);
      radios.forEach(r=>{ if(r.checked) it.score=r.value; });
      const listEl = document.getElementById(`${sec.key}_item${i}_list`);
      if (listEl) {
        const texts = Array.from(listEl.querySelectorAll('.finding-text')).map(t => t.value.trim());
        it.obs = texts;
      }
      const actionsEl = document.getElementById(`${sec.key}_actions${i}`);
      if (actionsEl) it.actions = actionsEl.value.trim();
    });
      const secObsEl = document.getElementById(`${sec.key}_section_obs`);
      if (secObsEl) currentEval[sec.key].observaciones = secObsEl.value;
      // Flush campos específicos para s9
      if (sec.key === 's9') {
      const gic = document.getElementById('s9_iluminacion_calidad'); if(gic) currentEval.s9.iluminacionCalidad=gic.value;
      const git = document.getElementById('s9_iluminacion_tipo'); if(git) currentEval.s9.iluminacionTipo=git.value;
      const gih = document.getElementById('s9_iluminacion_horario'); if(gih) currentEval.s9.iluminacionHorario=gih.value;
      const gir = document.getElementById('s9_iluminacion_respaldo'); if(gir) currentEval.s9.iluminacionRespaldo=gir.value;
      const gio = document.getElementById('s9_iluminacion_obs'); if(gio) currentEval.s9.iluminacionObs=gio.value;
      
      const gct = document.getElementById('s9_cerramiento_tipo'); if(gct) currentEval.s9.cerramientoTipo=gct.value;
      const gcm = document.getElementById('s9_cerramiento_material'); if(gcm) currentEval.s9.cerramientoMaterial=gcm.value;
      const gca = document.getElementById('s9_cerramiento_altura'); if(gca) currentEval.s9.cerramientoAltura=gca.value;
      const gce = document.getElementById('s9_cerramiento_estado'); if(gce) currentEval.s9.cerramientoEstado=gce.value;
      const gco = document.getElementById('s9_cerramiento_obs'); if(gco) currentEval.s9.cerramientoObs=gco.value;
      
      // Multi-select cerramientos
      const cTypes = [];
      const checks = document.querySelectorAll('.cerramiento-check');
      checks.forEach(c => { if(c.checked) cTypes.push(c.value); });
      currentEval.s9.cerramientoTipo = cTypes;
    }
  }
  if (sec.key === 's18') {
    // Los campos numéricos se manejan via updateRiskVal(oninput/onchange), 
    // pero aseguramos que los nombres de las amenazas manuales se sincronicen al salir.
    const riesgos = currentEval.s18.riesgos || [];
    riesgos.forEach((r, i) => {
      const el = document.querySelector(`#rrow_${i} input`);
      if (el) r.amenaza = el.value;
    });
  }
  if (sec.key==='s17') {
    const cl = document.getElementById('f17_conclusion'); if(cl) currentEval.s17.conclusion=cl.value;
    const re = document.getElementById('f17_rec'); if(re) currentEval.s17.recomendaciones=re.value;
    currentEval.s17.acciones.forEach((ac,i)=>{
      ['hallazgo','accion','responsable','fecha','prioridad','estado'].forEach(f=>{
        const el=document.getElementById(`ac_${i}_${f}`); if(el) ac[f]=el.value;
      });
    });
  }
  if (sec.key === 's19a') {
    ['tieneArmero','tieneTrampa','tipoArmamento','cantidadArmas','cantidadOficialesArmados','porcentajeLicencias','observacionesArmamento'].forEach(f => {
      const el = document.getElementById('f19a_' + f);
      if (el) currentEval.s19a[f] = el.value;
    });
  }
}

/* ══ SECTION RENDERING ═══════════════════════════════════════ */
function renderSection(sec) {
  switch(sec.type) {
    case 'general':       return renderGeneral();
    case 'objetivos':     return renderObjetivos();
    case 'metodologia':   return renderMetodologia();
    case 'criterios':     return renderCriterios();
    case 'interpretacion':return renderInterpretacion();
    case 'riesgos':       return renderRiesgos();
    case 'ubicacion':     return renderUbicacion();
    case 'entorno':       return renderEntorno();
    case 'scored':        return renderScored(sec.key, sec.title);
    case 'resultados':    return renderResultados();
    case 'plan':          return renderPlan();
    case 'matriz':        return renderMatriz();
    default: return '<p>Sección no encontrada.</p>';
  }
}

/* ── I. Datos Generales ─────────────────────────────────── */
function renderGeneral() {
  const d = currentEval.s1;
  const f = (name,label,val,type='text',icon='fa-pen') =>
    `<div class="form-group"><label><i class="fas ${icon}"></i>${label}</label>
     <input type="${type}" id="f1_${name}" value="${val||''}" placeholder="${label}"/></div>`;
  return `
    <div class="info-callout"><i class="fas fa-circle-info"></i>
      <p>Complete los datos generales del sitio. El <strong>Nombre del Sitio</strong> y <strong>Evaluador</strong> son obligatorios para guardar.</p></div>
    <div class="form-grid">
      ${f('nombreSitio','Nombre del Sitio',d.nombreSitio,'text','fa-building')}
      ${f('tipoInstalacion','Tipo de Instalación',d.tipoInstalacion,'text','fa-industry')}
      ${f('empresa','Empresa / Organización',d.empresa,'text','fa-briefcase')}
      ${f('fechaEvaluacion','Fecha de Evaluación',d.fechaEvaluacion,'date','fa-calendar')}
      ${f('evaluador','Evaluador / Inspector',d.evaluador,'text','fa-user-shield')}
      ${f('cargo','Cargo del Evaluador',d.cargo,'text','fa-id-badge')}
      ${f('empresa2','Empresa del Evaluador',d.empresa2,'text','fa-building-shield')}
      ${f('contacto','Persona de Contacto en el Sitio',d.contacto,'text','fa-address-card')}
      <div class="form-group">
        <label><i class="fas fa-ruler-combined"></i>Área Aproximada del Sitio (m²)
          <a href="https://earth.google.com/web/" target="_blank" rel="noopener noreferrer" class="gearth-link" title="Abrir Google Earth para medir el área del sitio">
            <i class="fas fa-earth-americas"></i> Medir en Google Earth
          </a>
        </label>
        <input type="text" id="f1_area" value="${d.area||''}" placeholder="Ej. 5000"/>
      </div>
      <div class="form-group">
        <label><i class="fas fa-clock"></i>Horario Operativo de las Instalaciones</label>
        <input type="text" id="f1_horarioOperativo" value="${d.horarioOperativo||''}" placeholder="Ej. L-V: 07:00 - 17:00 / S: 08:00 - 12:00"/>
      </div>
      <div class="form-group full">
        <label><i class="fas fa-clipboard-list"></i>Detalle de las Actividades de la Compañía</label>
        <textarea id="f1_actividadesDetalle" rows="3" placeholder="Describa brevemente el giro de negocio y actividades principales del sitio...">${d.actividadesDetalle||''}</textarea>
      </div>
    </div>
    ${renderPhotoZone('s1')}
    
    <div class="section-card" style="margin-top:24px; border-left:4px solid var(--teal)">
      <div class="sc-title"><i class="fas fa-image"></i>Logo del Cliente</div>
      <p style="font-size:12px;color:var(--text-m);margin-bottom:12px">Cargue el logotipo del cliente para esta evaluación. El logo aparecerá en la portada del reporte PDF.</p>
      <div style="display:flex; gap:16px; align-items:center">
        <div id="clientLogoContainer" style="width:160px; height:80px; border:2px dashed #0D172F33; border-radius:8px; display:flex; justify-content:center; align-items:center; background:#f9fafd">
          ${d.clientLogo ? `<img src="${d.clientLogo}" style="max-width:100%; max-height:100%; object-fit:contain"/>` : `<span style="font-size:11px;color:#aaa">Sin logo</span>`}
        </div>
        <div style="display:flex; flex-direction:column; gap:8px">
          <input type="file" id="clientLogoInput" accept="image/*" style="display:none" onchange="handleClientLogoUpload(this)">
          <button class="btn-primary" onclick="document.getElementById('clientLogoInput').click()"><i class="fas fa-upload"></i> ${d.clientLogo ? 'Cambiar Logo' : 'Cargar Logo'}</button>
          ${d.clientLogo ? `<button class="btn-ghost" style="color:#C91B38" onclick="removeClientLogo()"><i class="fas fa-trash"></i> Quitar</button>` : ''}
        </div>
      </div>
    </div>

    <div class="section-card" style="margin-top:24px; border-left:4px solid #C8951A">
      <div class="sc-title"><i class="fas fa-file-signature"></i>Firma Digital del Evaluador</div>
      <p style="font-size:12px;color:var(--text-m);margin-bottom:12px">Cargue una imagen con su firma (fondo transparente recomendado). Esta firma se guardará en su dispositivo y se adjuntará automáticamente al bloque de firma al final de todos los reportes PDF. Solo necesita cargarla una vez.</p>
      <div style="display:flex; gap:16px; align-items:center">
        <div id="firmaContainer" style="width:200px; height:80px; border:2px dashed #0D172F33; border-radius:8px; display:flex; justify-content:center; align-items:center; background:#f9fafd">
          ${localStorage.getItem('k9_evaluator_signature') ? `<img src="${localStorage.getItem('k9_evaluator_signature')}" style="max-width:100%; max-height:100%; object-fit:contain"/>` : `<span style="font-size:11px;color:#aaa">Sin firma configurada</span>`}
        </div>
        <div style="display:flex; flex-direction:column; gap:8px">
          <input type="file" id="sigInput" accept="image/*" style="display:none" onchange="handleSignatureUpload(this)">
          <button class="btn-primary" onclick="document.getElementById('sigInput').click()"><i class="fas fa-upload"></i> ${localStorage.getItem('k9_evaluator_signature') ? 'Cambiar Firma' : 'Cargar Firma'}</button>
          ${localStorage.getItem('k9_evaluator_signature') ? `<button class="btn-ghost" style="color:#C91B38" onclick="removeSignature()"><i class="fas fa-trash"></i> Quitar</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

function handleSignatureUpload(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    localStorage.setItem('k9_evaluator_signature', e.target.result);
    showToast('Firma digital guardada exitosamente.', 'success');
    document.getElementById('sectionContent').innerHTML = renderSection(SECTIONS.find(s=>s.num===currentSection));
  };
  reader.readAsDataURL(file);
}

function removeSignature() {
  localStorage.removeItem('k9_evaluator_signature');
  showToast('Firma digital eliminada.', 'info');
  document.getElementById('sectionContent').innerHTML = renderSection(SECTIONS.find(s=>s.num===currentSection));
}

function handleClientLogoUpload(input) {
  const file = input.files[0];
  if(!file) return;
  if(file.size > 2 * 1024 * 1024) {
    showToast('El logo es muy pesado. Máximo 2MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    currentEval.s1.clientLogo = e.target.result;
    showToast('Logo del cliente cargado.', 'success');
    autoSave();
    document.getElementById('sectionContent').innerHTML = renderSection(SECTIONS.find(s=>s.num===currentSection));
  };
  reader.readAsDataURL(file);
}

function removeClientLogo() {
  currentEval.s1.clientLogo = '';
  showToast('Logo del cliente eliminado.', 'info');
  autoSave();
  document.getElementById('sectionContent').innerHTML = renderSection(SECTIONS.find(s=>s.num===currentSection));
}

/* ── II. Objetivos ─────────────────────────────────────── */
function renderObjetivos() {
  return `
    <div class="info-callout"><i class="fas fa-bullseye"></i>
      <p>Describa los <strong>objetivos del informe</strong>. Se ha cargado un texto predeterminado que puede editar según las necesidades específicas de esta evaluación.</p></div>
    <div class="section-card">
      <div class="sc-title"><i class="fas fa-file-pen"></i>Objetivos del Presente Informe</div>
      <div class="form-group"><textarea id="f2_obj" rows="10" style="min-height:220px">${currentEval.s2.objetivos||''}</textarea></div>
    </div>`;
}

/* ── III. Metodología ──────────────────────────────────── */
function renderMetodologia() {
  const d = currentEval.s3;
  return `
    <div class="info-callout"><i class="fas fa-clipboard-list"></i>
      <p>Seleccione las <strong>técnicas de verificación</strong> empleadas durante la visita de campo e indique las fechas.</p></div>
    <div class="section-card">
      <div class="sc-title"><i class="fas fa-check-double"></i>Métodos Aplicados</div>
      <div class="risk-check-grid">
        ${METHODS.map(m=>`
          <div class="risk-check-item${d.metodos.includes(m.id)?' selected':''}" id="mitem_${m.id}" onclick="toggleMethod('${m.id}')">
            <i class="fas fa-check-square" style="color:var(--teal);font-size:16px"></i>
            <span class="rci-label">${m.label}</span>
          </div>`).join('')}
      </div>
    </div>
    <div class="form-grid" style="margin-top:16px">
      <div class="form-group"><label><i class="fas fa-calendar-day"></i>Fecha Inicio de la Auditoría</label>
        <input type="date" id="f3_fechaInicio" value="${d.fechaInicio||''}"/></div>
      <div class="form-group"><label><i class="fas fa-calendar-check"></i>Fecha Fin de la Auditoría</label>
        <input type="date" id="f3_fechaFin" value="${d.fechaFin||''}"/></div>
      <div class="form-group"><label><i class="fas fa-clock"></i>Duración Total</label>
        <input type="text" id="f3_duracion" value="${d.duracion||''}" placeholder="Ej. 4 horas, 1 día"/></div>
      <div class="form-group"><label><i class="fas fa-comment"></i>Observaciones Generales del Proceso</label>
        <input type="text" id="f3_observaciones" value="${d.observaciones||''}" placeholder="Limitaciones, condiciones especiales..."/></div>
    </div>`;
}
function toggleMethod(id) {
  const el = document.getElementById('mitem_' + id);
  if (el) {
    el.classList.toggle('selected');
    if (currentEval && currentEval.s3) {
      currentEval.s3.metodos = METHODS.filter(m => {
        const itemEl = document.getElementById('mitem_' + m.id);
        return itemEl && itemEl.classList.contains('selected');
      }).map(m => m.id);
      autoSave();
    }
  }
}

function toggleRisk(id) {
  const el = document.getElementById('r_' + id);
  if (el) {
    el.classList.toggle('selected');
    if (currentEval && currentEval.s6) {
      currentEval.s6.riesgos = RISK_MANIFESTATIONS.filter(r => {
        const itemEl = document.getElementById('r_' + r.id);
        return itemEl && itemEl.classList.contains('selected');
      }).map(r => r.id);
      autoSave();
    }
  }
}

/* ── IV. Criterios ──────────────────────────────────────── */
function renderCriterios() {
  return `
    <div class="info-callout"><i class="fas fa-star-half-stroke"></i>
      <p>La evaluación utiliza una escala de <strong>3 niveles</strong> para calificar cada ítem de las listas de verificación. Los ítems No Aplica (NA) son excluidos del cálculo.</p></div>
    <div class="section-card">
      <div class="sc-title"><i class="fas fa-table"></i>Escala de Calificación por Ítem</div>
      <table class="criteria-table">
        <thead><tr><th>Código</th><th>Criterio</th><th>Puntos</th><th>Descripción</th></tr></thead>
        <tbody>
          <tr><td><span style="color:var(--C);font-weight:800">C</span></td><td>Cumple</td><td>4 / 4</td><td>El control está completamente implementado, operativo y es efectivo.</td></tr>
          <tr><td><span style="color:var(--CP);font-weight:800">CP</span></td><td>Cumple Parcialmente</td><td>2 / 4</td><td>El control existe pero presenta deficiencias, brechas o no está completo.</td></tr>
          <tr><td><span style="color:var(--NC);font-weight:800">NC</span></td><td>No Cumple</td><td>0 / 4</td><td>El control no existe, está inoperativo o no cumple ningún requisito mínimo.</td></tr>
          <tr><td><span style="color:var(--NA);font-weight:800">NA</span></td><td>No Aplica</td><td>–</td><td>El ítem no es aplicable al tipo de instalación o actividad evaluada.</td></tr>
        </tbody>
      </table>
    </div>
    <div class="section-card">
      <div class="sc-title"><i class="fas fa-calculator"></i>Fórmula de Cálculo</div>
      <div style="text-align:center;padding:20px;background:var(--bg3);border-radius:10px;font-family:var(--fh);font-size:15px">
        % Cumplimiento = (Σ Puntos obtenidos) ÷ (N° ítems evaluables × 4) × 100
      </div>
      <p style="font-size:12px;color:var(--text-m);margin-top:12px">El porcentaje final es el promedio de las 7 secciones con lista de verificación (IX – XV).</p>
    </div>`;
}

/* ── V. Interpretación ─────────────────────────────────── */
function renderInterpretacion() {
  const rows=[
    ['80 – 100%','ACEPTABLE','var(--aceptable)','Las medidas de seguridad son apropiadas. Se requiere mantenimiento y mejora continua.'],
    ['60 – 79%','CON OBSERVACIONES','var(--observacion)','Existen brechas que deben ser corregidas a mediano plazo. Riesgo moderado.'],
    ['40 – 59%','DEFICIENTE','var(--deficiente)','Vulnerabilidades significativas. Se requieren acciones correctivas urgentes.'],
    ['0 – 39%','CRÍTICO','var(--critico)','Control de seguridad insuficiente. Alto riesgo de incidente. Acción inmediata requerida.']
  ];
  return `
    <div class="info-callout"><i class="fas fa-chart-pie"></i>
      <p>Los resultados finales se clasifican en <strong>cuatro niveles de riesgo</strong> según el porcentaje de cumplimiento obtenido.</p></div>
    <div class="section-card">
      <div class="sc-title"><i class="fas fa-signal"></i>Niveles de Riesgo y Rango de Cumplimiento</div>
      <table class="criteria-table">
        <thead><tr><th>Rango</th><th>Nivel</th><th>Acciones Requeridas</th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr>
            <td><strong style="color:${r[2]};font-family:var(--fh)">${r[0]}</strong></td>
            <td><span class="ec-badge badge-${r[1]==='ACEPTABLE'?'aceptable':r[1]==='CON OBSERVACIONES'?'observacion':r[1]==='DEFICIENTE'?'deficiente':'critico'}">${r[1]}</span></td>
            <td style="font-size:12px;color:var(--text-d)">${r[3]}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ── VI. Manifestaciones de Riesgo ─────────────────────── */
function renderRiesgos() {
  const d = currentEval.s6;
  return `
    <div class="info-callout"><i class="fas fa-skull-crossbones"></i>
      <p>Seleccione las <strong>manifestaciones de riesgo</strong> identificadas o presentes en el entorno. Puede marcar múltiples opciones.</p></div>
    <div class="section-card">
      <div class="sc-title"><i class="fas fa-triangle-exclamation"></i>Tipos de Amenaza Identificados</div>
      <div class="risk-check-grid">
        ${RISK_MANIFESTATIONS.map(r=>`
          <div class="risk-check-item${d.riesgos.includes(r.id)?' selected':''}" id="r_${r.id}" onclick="toggleRisk('${r.id}')">
            <div class="rci-icon" style="background:${r.color}22;color:${r.color}"><i class="fas ${r.icon}"></i></div>
            <span class="rci-label">${r.label}</span>
          </div>`).join('')}
      </div>
    </div>
    <div class="form-grid" style="margin-top:16px">
      <div class="form-group"><label><i class="fas fa-gauge"></i>Nivel General de Amenaza del Entorno</label>
        <select id="f6_nivelAmenaza">
          <option value="bajo" ${d.nivelAmenaza==='bajo'?'selected':''}>Bajo</option>
          <option value="medio" ${d.nivelAmenaza==='medio'?'selected':''}>Medio</option>
          <option value="alto" ${d.nivelAmenaza==='alto'?'selected':''}>Alto</option>
          <option value="critico" ${d.nivelAmenaza==='critico'?'selected':''}>Crítico</option>
        </select></div>
      <div class="form-group"><label><i class="fas fa-comment-dots"></i>Descripción de Amenazas Identificadas</label>
        <input type="text" id="f6_descripcion" value="${d.descripcion||''}" placeholder="Describa brevemente las amenazas principales..."/></div>
    </div>
    ${renderPhotoZone('s6')}`;
}

/* ── VII. Ubicación ────────────────────────────────────── */
let mapInstance = null;
let markerInstance = null;

function renderUbicacion() {
  const d = currentEval.s7;
  const sel=(id,opts,cur)=>`<select id="${id}">${opts.map(o=>`<option value="${o.v}"${cur===o.v?' selected':''}>${o.l}</option>`).join('')}</select>`;
  return `
    <div class="info-callout"><i class="fas fa-map-location-dot"></i>
      <p>Registre los datos geográficos. Use el <strong>mapa interactivo</strong> para precisar la ubicación; el marcador actualizará automáticamente las coordenadas GPS.</p></div>
    
    <div class="form-grid">
      <div class="form-group"><label><i class="fas fa-globe-americas"></i>País</label><input type="text" id="f7_pais" value="${d.pais||'Costa Rica'}"/></div>
      <div class="form-group"><label><i class="fas fa-map"></i>Provincia</label><input type="text" id="f7_provincia" value="${d.provincia||''}" placeholder="Ej. Cartago"/></div>
      <div class="form-group"><label><i class="fas fa-city"></i>Cantón</label><input type="text" id="f7_canton" value="${d.canton||''}"/></div>
      <div class="form-group"><label><i class="fas fa-location-dot"></i>Distrito</label><input type="text" id="f7_distrito" value="${d.distrito||''}"/></div>
      <div class="form-group full"><label><i class="fas fa-route"></i>Dirección Exacta</label><input type="text" id="f7_dirExacta" value="${d.dirExacta||''}"/></div>
    </div>

    <div class="section-card" style="margin-top:20px">
      <div class="sc-title"><i class="fas fa-map-marked-alt"></i>Mapa de Ubicación de Instalaciones</div>
      
      <div class="map-search-bar">
        <input type="text" id="map_address_search" placeholder="Escriba el nombre del lugar o dirección para buscar en el mapa..." onkeypress="if(event.key==='Enter') searchLocation()"/>
        <button class="btn-search-map" onclick="searchLocation()" title="Buscar en el mapa"><i class="fas fa-search"></i></button>
      </div>

      <div id="map" class="map-container"></div>
      <div class="coords-grid">
        <div class="form-group"><label>Latitud</label><input type="text" id="f7_latitud" value="${d.latitud||''}" placeholder="9.9340" oninput="updateMarkerFromInputs()"/></div>
        <div class="form-group"><label>Longitud</label><input type="text" id="f7_longitud" value="${d.longitud||''}" placeholder="-84.0877" oninput="updateMarkerFromInputs()"/></div>
      </div>
    </div>

    <div class="form-grid" style="margin-top:20px">
      <div class="form-group"><label><i class="fas fa-building-columns"></i>Tipo de Zona</label>
        ${sel('f7_tipoZona',[{v:'industrial',l:'Industrial'},{v:'comercial',l:'Comercial'},{v:'residencial',l:'Residencial'},{v:'mixta',l:'Mixta'},{v:'rural',l:'Rural'}],d.tipoZona)}</div>
      <div class="form-group"><label><i class="fas fa-lightbulb"></i>Iluminación Pública</label>
        ${sel('f7_iluminacion',[{v:'buena',l:'Buena'},{v:'regular',l:'Regular'},{v:'deficiente',l:'Deficiente'},{v:'ninguna',l:'Ninguna'}],d.iluminacion)}</div>
      <div class="form-group full"><label><i class="fas fa-road"></i>Accesos Viales Principales</label>
        <input type="text" id="f7_accesos" value="${d.accesos||''}" placeholder="Vías principales de entrada"/></div>
      <div class="form-group full"><label><i class="fas fa-road-circle-check"></i>Accesos Viales Secundarios</label>
        <input type="text" id="f7_accesosSecundarios" value="${d.accesosSecundarios||''}" placeholder="Vías alternativas de entrada/salida"/></div>
    </div>

    <div class="section-card" style="margin-top:20px">
      <div class="sc-title"><i class="fas fa-border-all"></i>Colindancias de la Propiedad</div>
      <div class="colindancias-grid">
        <div class="boundary-item"><label class="boundary-label">NORTE</label><input type="text" id="f7_norte" value="${d.norte||''}" placeholder="Colindancia Norte"/></div>
        <div class="boundary-item"><label class="boundary-label">SUR</label><input type="text" id="f7_sur" value="${d.sur||''}" placeholder="Colindancia Sur"/></div>
        <div class="boundary-item"><label class="boundary-label">ESTE</label><input type="text" id="f7_este" value="${d.este||''}" placeholder="Colindancia Este"/></div>
        <div class="boundary-item"><label class="boundary-label">OESTE</label><input type="text" id="f7_oeste" value="${d.oeste||''}" placeholder="Colindancia Oeste"/></div>
      </div>
    </div>

    <div class="section-obs" style="margin-top:20px">
      <label><i class="fas fa-comment"></i>Observaciones del Entorno Geográfico</label>
      <textarea id="f7_observaciones" rows="3">${d.observaciones||''}</textarea>
    </div>
    ${renderPhotoZone('s7')}`;
}

function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  const defaultLat = currentEval.s7.latitud || 9.9347;
  const defaultLng = currentEval.s7.longitud || -84.0875;

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  mapInstance = L.map('map').setView([defaultLat, defaultLng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapInstance);

  markerInstance = L.marker([defaultLat, defaultLng], {
    draggable: true
  }).addTo(mapInstance);

  markerInstance.on('dragend', function(e) {
    const pos = markerInstance.getLatLng();
    updateCoordsInputs(pos.lat, pos.lng);
  });

  mapInstance.on('click', function(e) {
    markerInstance.setLatLng(e.latlng);
    updateCoordsInputs(e.latlng.lat, e.latlng.lng);
  });

  // Asegura que el mapa se renderice correctamente en el contenedor
  setTimeout(() => mapInstance.invalidateSize(), 200);
}

function updateCoordsInputs(lat, lng) {
  document.getElementById('f7_latitud').value = lat.toFixed(6);
  document.getElementById('f7_longitud').value = lng.toFixed(6);
  currentEval.s7.latitud = lat.toFixed(6);
  currentEval.s7.longitud = lng.toFixed(6);
}

function searchLocation() {
  const query = document.getElementById('map_address_search').value;
  if (!query) return;

  const btn = document.querySelector('.btn-search-map');
  const oldIcon = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled = true;

  const geocoder = L.Control.Geocoder.nominatim();
  geocoder.geocode(query, function(results) {
    btn.innerHTML = oldIcon;
    btn.disabled = false;

    if (results && results.length > 0) {
      const res = results[0];
      const latlng = res.center;
      
      mapInstance.setView(latlng, 16);
      markerInstance.setLatLng(latlng);
      updateCoordsInputs(latlng.lat, latlng.lng);
      
      showToast(`Ubicación encontrada: ${res.name}`, 'success');
    } else {
      showToast('No se encontró la ubicación. Intente con términos más generales.', 'error');
    }
  });
}

function updateMarkerFromInputs() {
  const lat = parseFloat(document.getElementById('f7_latitud').value);
  const lng = parseFloat(document.getElementById('f7_longitud').value);
  if (!isNaN(lat) && !isNaN(lng)) {
    const newLatLng = new L.LatLng(lat, lng);
    markerInstance.setLatLng(newLatLng);
    mapInstance.panTo(newLatLng);
    currentEval.s7.latitud = lat.toFixed(6);
    currentEval.s7.longitud = lng.toFixed(6);
  }
}

/* ── VIII. Entorno de Seguridad ─────────────────────────── */
function renderEntorno() {
  const d = currentEval.s8;
  const sel=(id,opts,cur)=>`<select id="${id}">${opts.map(o=>`<option value="${o.v}"${cur===o.v?' selected':''}>${o.l}</option>`).join('')}</select>`;
  
  if (!d.statsOIJ || d.statsOIJ.length === 0) {
    d.statsOIJ = [
      { delito: 'Asalto', cantidad: '' },
      { delito: 'Hurto', cantidad: '' },
      { delito: 'Robo', cantidad: '' },
      { delito: 'Robo de Vehículo', cantidad: '' },
      { delito: 'Homicidio', cantidad: '' }
    ];
  }

  const oijRows = d.statsOIJ.map((s, i) => `
    <tr class="oij-stat-row">
      <td><input type="text" class="oij-stats-input oij-delito" value="${s.delito}" placeholder="Tipo de delito"/></td>
      <td><input type="number" class="oij-stats-input oij-cantidad" value="${s.cantidad}" placeholder="0"/></td>
      <td style="text-align:center"><button class="btn-icon del" onclick="removeOIJStat(this)"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('');

  return `
    <div class="info-callout"><i class="fas fa-shield"></i>
      <p>Describa el <strong>contexto de seguridad</strong> e incorpore estadísticas oficiales del OIJ para fortalecer el análisis del entorno.</p></div>
    
    <div class="section-card">
      <div class="form-group"><label><i class="fas fa-align-left"></i>Descripción General del Entorno de Seguridad</label>
        <textarea id="f8_descripcion" rows="5" placeholder="Describa el contexto de seguridad del área donde se ubica el sitio...">${d.descripcion||''}</textarea></div>
    </div>

    <div class="section-card" style="margin-top:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:15px">
        <div class="sc-title" style="margin:0"><i class="fas fa-chart-line"></i>Estadísticas Criminales (OIJ)</div>
        <button class="btn-oij-search" onclick="window.open('https://pjenlinea3.poder-judicial.go.cr/estadisticasoij/', '_blank')">
          <i class="fas fa-search"></i> Consultar Portal OIJ
        </button>
      </div>
      <p style="font-size:12px;color:var(--text-m);margin-bottom:12px">Consulte el portal del OIJ, filtre por la zona del proyecto y registre los datos aquí para el reporte.</p>
      
      <table class="oij-stats-table">
        <thead>
          <tr><th>Tipo de Delito</th><th style="width:80px">Cantidad</th><th style="width:40px"></th></tr>
        </thead>
        <tbody id="oijStatsBody">
          ${oijRows}
        </tbody>
      </table>
      <button class="btn-ghost" style="margin-top:10px;width:100%" onclick="addOIJStat()"><i class="fas fa-plus"></i> Agregar otro delito</button>
      
      <div class="form-group" style="margin-top:15px">
        <label><i class="fas fa-clock-rotate-left"></i>Periodo de Consulta / Fuente</label>
        <input type="text" id="f8_fuenteOIJ" value="${d.fuenteOIJ||''}" placeholder="Ej. Año 2023, Último semestre..."/>
      </div>
    </div>

    <div class="form-grid" style="margin-top:20px">
      <div class="form-group"><label><i class="fas fa-gauge-high"></i>Nivel de Conflictividad del Sector</label>
        ${sel('f8_conflictividad',[{v:'bajo',l:'Bajo'},{v:'medio',l:'Medio'},{v:'alto',l:'Alto'},{v:'critico',l:'Crítico'}],d.conflictividad)}</div>
      <div class="form-group"><label><i class="fas fa-shield-halved"></i>Presencia Policial</label>
        ${sel('f8_presenciaPolicial',[{v:'permanente',l:'Permanente'},{v:'rondas',l:'Rondas periódicas'},{v:'esporadica',l:'Esporádica'},{v:'ninguna',l:'Ninguna'}],d.presenciaPolicial)}</div>
      <div class="form-group full"><label><i class="fas fa-file-medical"></i>Historial de Incidentes Conocidos</label>
        <textarea id="f8_historial" rows="3" placeholder="Incidentes previos en el sitio o el entorno inmediato...">${d.historial||''}</textarea></div>
      <div class="form-group full"><label><i class="fas fa-triangle-exclamation"></i>Zonas Problemáticas Identificadas en el Entorno</label>
        <input type="text" id="f8_zonasProblematicas" value="${d.zonasProblematicas||''}" placeholder="Calles, predios o áreas de riesgo cercanas..."/></div>
      <div class="form-group full"><label><i class="fas fa-arrows-left-right-to-line"></i>Factores Externos que Impactan la Seguridad</label>
        <input type="text" id="f8_factoresExternos" value="${d.factoresExternos||''}" placeholder="Tráfico, negocios aledaños, infraestructura..."/></div>
    </div>
    ${renderPhotoZone('s8')}`;
}

function addOIJStat() {
  const row = `
    <tr class="oij-stat-row">
      <td><input type="text" class="oij-stats-input oij-delito" placeholder="Tipo de delito"/></td>
      <td><input type="number" class="oij-stats-input oij-cantidad" placeholder="0"/></td>
      <td style="text-align:center"><button class="btn-icon del" onclick="removeOIJStat(this)"><i class="fas fa-trash"></i></button></td>
    </tr>`;
  document.getElementById('oijStatsBody').insertAdjacentHTML('beforeend', row);
}

function removeOIJStat(btn) {
  btn.closest('tr').remove();
}

/* ── IX–XV. Secciones Puntuadas ──────────────────────────── */
function renderScored(key, title) {
  const data = currentEval[key];
  const pct = computeSectionScore(key, currentEval);
  const color = scoreColor(pct);
  const barW = pct !== null ? pct : 0;
  const scoreBar = `
    <div class="section-score-bar">
      <span class="ssb-label">Puntuación de esta sección</span>
      <div class="ssb-track"><div class="ssb-fill" id="ssb_${key}" style="width:${barW}%;background:${color}"></div></div>
      <span class="ssb-pct" id="ssbpct_${key}" style="color:${color}">${pct!==null?pct+'%':'–'}</span>
    </div>`;

  const headerRow = `<thead><tr>
    <th style="width:28px">#</th>
    <th>Ítem de Verificación</th>
    <th class="score-th"><span style="color:var(--C)">C</span></th>
    <th class="score-th"><span style="color:var(--CP)">CP</span></th>
    <th class="score-th"><span style="color:var(--NC)">NC</span></th>
    <th class="score-th"><span style="color:var(--NA)">NA</span></th>
    <th style="width:80px">Obs.</th>
  </tr></thead>`;

  const rows = data.items.map((it,i) => {
    const id = `${key}_s${i}`;
    const obsId = `${key}_obs${i}`;
    const obsContId = `${key}_obscont${i}`;
    const mkR=(val,cls)=>`<label class="score-radio"><input type="radio" name="${id}" value="${val}"${it.score===val?' checked':''}
      onchange="updateSectionScore('${key}')"/>
      <span class="score-pill sp-${cls}">${val}</span></label>`;
    const findings = Array.isArray(it.obs) ? it.obs : (it.obs ? [it.obs] : []);
    const findingsHtml = findings.map((f, fi) => `
      <div class="finding-item">
        <div style="display:flex;gap:6px;align-items:flex-start;flex:1;">
          <textarea class="finding-text" id="finding_${key}_${i}_${fi}" placeholder="Describa el hallazgo... (ej. Cerca dañada)">${f}</textarea>
          <button class="btn-field-mic-ui" onclick="activateVoiceField('finding_${key}_${i}_${fi}')" title="Dictar por voz" style="flex-shrink:0;margin-top:2px;"><i class="fas fa-microphone"></i></button>
        </div>
        <button class="btn-icon del" onclick="removeFinding(this)" title="Quitar hallazgo"><i class="fas fa-trash"></i></button>
      </div>`).join('');

    return `<tr>
      <td class="item-num">${i+1}</td>
      <td><span class="item-text">${it.text}</span>
        <div class="item-obs${it.score==='NC'||it.score==='CP'||findings.length>0||it.actions?' show':''}" id="${obsContId}">
          <div class="findings-list" id="${key}_item${i}_list">
            <div class="finding-label"><i class="fas fa-search"></i> Hallazgos / Observaciones:</div>
            ${findingsHtml}
          </div>
          <button class="btn-add-finding" onclick="addFinding('${key}', ${i})" style="margin-bottom:12px"><i class="fas fa-plus"></i> Agregar Hallazgo</button>
          </div>
        </div>
      </td>
      <td style="text-align:center">${mkR('C','C')}</td>
      <td style="text-align:center">${mkR('CP','CP')}</td>
      <td style="text-align:center">${mkR('NC','NC')}</td>
      <td style="text-align:center">${mkR('NA','NA')}</td>
      <td style="text-align:center">
        <span class="obs-toggle" onclick="toggleItemObs('${obsContId}')"><i class="fas fa-comment-alt"></i></span>
      </td>
    </tr>`;
  }).join('');

  const iluminacionBlock = (key === 's9') ? `
    <div class="section-card" style="margin-top:16px">
      <div class="sc-title"><i class="fas fa-border-top-left"></i>Características de los Cerramientos Perimetrales</div>
      <div class="form-grid">
        <div class="form-group full">
          <label><i class="fas fa-layer-group"></i>Tipo de Cerramiento (Seleccione todos los que apliquen)</label>
          <div class="checkbox-grid">
            ${ENCLOSURE_TYPES.map(t => {
              const checked = Array.isArray(data.cerramientoTipo) && data.cerramientoTipo.includes(t.id);
              return `
                <label class="checkbox-item">
                  <input type="checkbox" class="cerramiento-check" value="${t.id}" ${checked?'checked':''}/>
                  ${t.label}
                </label>`;
            }).join('')}
          </div>
        </div>
        <div class="form-group">
          <label><i class="fas fa-trowel-bricks"></i>Material de Fabricación</label>
          <input type="text" id="s9_cerramiento_material" value="${data.cerramientoMaterial||''}" placeholder="Ej. Acero, Block, Alambre..."/>
        </div>
        <div class="form-group">
          <label><i class="fas fa-arrows-up-down"></i>Altura Aproximada (m)</label>
          <input type="text" id="s9_cerramiento_altura" value="${data.cerramientoAltura||''}" placeholder="Ej. 2.5 metros"/>
        </div>
        <div class="form-group">
          <label><i class="fas fa-clipboard-check"></i>Estado de Conservación</label>
          <select id="s9_cerramiento_estado">
            <option value="" ${!data.cerramientoEstado?'selected':''}>-- Seleccione --</option>
            <option value="bueno" ${data.cerramientoEstado==='bueno'?'selected':''}>Bueno - Sin daños visibles</option>
            <option value="regular" ${data.cerramientoEstado==='regular'?'selected':''}>Regular - Requiere mantenimiento menor</option>
            <option value="deficiente" ${data.cerramientoEstado==='deficiente'?'selected':''}>Deficiente - Daños o aberturas presentes</option>
            <option value="critico" ${data.cerramientoEstado==='critico'?'selected':''}>Crítico - No cumple función de barrera</option>
          </select>
        </div>
        <div class="form-group full">
          <label><i class="fas fa-file-pen"></i>Observaciones del Cerramiento</label>
          <textarea id="s9_cerramiento_obs" rows="2" placeholder="Detalles sobre daños, vulnerabilidades o reparaciones necesarias...">${data.cerramientoObs||''}</textarea>
        </div>
      </div>
    </div>

    <div class="section-card" style="margin-top:16px">
      <div class="sc-title"><i class="fas fa-lightbulb"></i>Valoración del Sistema de Iluminación del Perímetro</div>
      <div class="form-grid">
        <div class="form-group">
          <label><i class="fas fa-star"></i>Calidad General de la Iluminación Perimetral</label>
          <select id="s9_iluminacion_calidad">
            <option value="" ${!data.iluminacionCalidad?'selected':''}>-- Seleccione --</option>
            <option value="excelente" ${data.iluminacionCalidad==='excelente'?'selected':''}>Excelente – Cobertura total, sin puntos ciegos</option>
            <option value="buena" ${data.iluminacionCalidad==='buena'?'selected':''}>Buena – Cobertura mayoritaria con mínimas fallas</option>
            <option value="regular" ${data.iluminacionCalidad==='regular'?'selected':''}>Regular – Cobertura parcial con zonas oscuras</option>
            <option value="deficiente" ${data.iluminacionCalidad==='deficiente'?'selected':''}>Deficiente – Sin cobertura o sistemas inoperativos</option>
          </select>
        </div>
        <div class="form-group">
          <label><i class="fas fa-bolt"></i>Tipo de Tecnología Empleada</label>
          <select id="s9_iluminacion_tipo">
            <option value="" ${!data.iluminacionTipo?'selected':''}>-- Seleccione --</option>
            <option value="led" ${data.iluminacionTipo==='led'?'selected':''}>LED de alta eficiencia</option>
            <option value="sodio" ${data.iluminacionTipo==='sodio'?'selected':''}>Vapor de sodio / mercurio</option>
            <option value="halogenuro" ${data.iluminacionTipo==='halogenuro'?'selected':''}>Halogenuro metálico</option>
            <option value="mixta" ${data.iluminacionTipo==='mixta'?'selected':''}>Mixta</option>
            <option value="ninguna" ${data.iluminacionTipo==='ninguna'?'selected':''}>Sin sistema instalado</option>
          </select>
        </div>
        <div class="form-group">
          <label><i class="fas fa-clock"></i>Cobertura Horaria</label>
          <select id="s9_iluminacion_horario">
            <option value="" ${!data.iluminacionHorario?'selected':''}>-- Seleccione --</option>
            <option value="nocturna" ${data.iluminacionHorario==='nocturna'?'selected':''}>Solo horario nocturno</option>
            <option value="24h" ${data.iluminacionHorario==='24h'?'selected':''}>24 horas continuas</option>
            <option value="sensores" ${data.iluminacionHorario==='sensores'?'selected':''}>Activación por sensores de movimiento</option>
            <option value="manual" ${data.iluminacionHorario==='manual'?'selected':''}>Activación manual</option>
          </select>
        </div>
        <div class="form-group">
          <label><i class="fas fa-plug-circle-check"></i>Respaldo Eléctrico</label>
          <select id="s9_iluminacion_respaldo">
            <option value="" ${!data.iluminacionRespaldo?'selected':''}>-- Seleccione --</option>
            <option value="ups" ${data.iluminacionRespaldo==='ups'?'selected':''}>UPS instalado y funcional</option>
            <option value="planta" ${data.iluminacionRespaldo==='planta'?'selected':''}>Planta generadora</option>
            <option value="solar" ${data.iluminacionRespaldo==='solar'?'selected':''}>Panel solar</option>
            <option value="ninguno" ${data.iluminacionRespaldo==='ninguno'?'selected':''}>Sin respaldo</option>
          </select>
        </div>
        <div class="form-group full">
          <label><i class="fas fa-comment"></i>Observaciones de Iluminación Perimetral</label>
          <textarea id="s9_iluminacion_obs" rows="2" placeholder="Zonas sin iluminación, luminarias en mal estado, etc...">${data.iluminacionObs||''}</textarea>
        </div>
      </div>
    </div>` : '';

  const armamentBlock = (key === 's19a') ? `
    <div class="section-card" style="margin-top:16px;border-left:4px solid var(--gold)">
      <div class="sc-title"><i class="fas fa-gun"></i> Datos Cuantitativos de Armamento</div>
      <div class="form-grid">
        <div class="form-group">
          <label><i class="fas fa-warehouse"></i> ¿Existe armero o depósito seguro de armas?</label>
          <select id="f19a_tieneArmero">
            <option value="" ${!data.tieneArmero?'selected':''}>-- Seleccione --</option>
            <option value="si_dedicado"    ${data.tieneArmero==='si_dedicado'?'selected':''}>Sí – Armero dedicado con cerrojo</option>
            <option value="si_improvised"  ${data.tieneArmero==='si_improvised'?'selected':''}>Sí – Espacio improvisado con candado</option>
            <option value="no"             ${data.tieneArmero==='no'?'selected':''}>No – Sin espacio habilitado</option>
          </select>
        </div>
        <div class="form-group">
          <label><i class="fas fa-circle-stop"></i> ¿Existe trampa de balas para descarga segura?</label>
          <select id="f19a_tieneTrampa">
            <option value="" ${!data.tieneTrampa?'selected':''}>-- Seleccione --</option>
            <option value="si"        ${data.tieneTrampa==='si'?'selected':''}>Sí – Trampa de balas instalada y operativa</option>
            <option value="si_otra"   ${data.tieneTrampa==='si_otra'?'selected':''}>Sí – Otro mecanismo equivalente</option>
            <option value="no"        ${data.tieneTrampa==='no'?'selected':''}>No – Sin zona de descarga habilitada</option>
          </select>
        </div>
        <div class="form-group">
          <label><i class="fas fa-tags"></i> Tipo(s) de Armamento Asignado</label>
          <input type="text" id="f19a_tipoArmamento" value="${data.tipoArmamento||''}"
            placeholder="Ej. Revólver .38, Pistola 9mm, Escopeta..."/>
        </div>
        <div class="form-group">
          <label><i class="fas fa-hashtag"></i> Cantidad Total de Armas en el Sitio</label>
          <input type="number" id="f19a_cantidadArmas" min="0" value="${data.cantidadArmas||0}"/>
        </div>
        <div class="form-group">
          <label><i class="fas fa-user-shield"></i> Cantidad de Oficiales Armados</label>
          <input type="number" id="f19a_cantidadOficialesArmados" min="0" value="${data.cantidadOficialesArmados||0}"/>
        </div>
        <div class="form-group">
          <label><i class="fas fa-id-card"></i> % de Oficiales con Licencia Vigente</label>
          <select id="f19a_porcentajeLicencias">
            <option value="" ${!data.porcentajeLicencias?'selected':''}>-- Seleccione --</option>
            <option value="100"   ${data.porcentajeLicencias==='100'?'selected':''}>100% – Todos con licencia vigente</option>
            <option value="75-99" ${data.porcentajeLicencias==='75-99'?'selected':''}>75-99% – La mayoría con licencia vigente</option>
            <option value="50-74" ${data.porcentajeLicencias==='50-74'?'selected':''}>50-74% – La mitad con licencia vigente</option>
            <option value="<50"   ${data.porcentajeLicencias==='<50'?'selected':''}>Menos del 50% – Situación crítica</option>
            <option value="0"     ${data.porcentajeLicencias==='0'?'selected':''}>0% – Ninguno tiene licencia</option>
          </select>
        </div>
        <div class="form-group full">
          <label><i class="fas fa-file-pen"></i> Observaciones Adicionales de Armamento</label>
          <textarea id="f19a_observacionesArmamento" rows="3"
            placeholder="Vencimientos próximos, armas en mal estado, irregularidades encontradas..."
          >${data.observacionesArmamento||''}</textarea>
        </div>
      </div>
    </div>` : '';

  return `
    ${scoreBar}
    <div class="section-card" style="padding:0;overflow:hidden">
      <table class="scored-table">${headerRow}<tbody>${rows}</tbody></table>
    </div>
    ${iluminacionBlock}
    ${armamentBlock}
    <div class="section-obs">
      <label><i class="fas fa-comment-dots"></i> Observaciones Generales de la Sección</label>
      <textarea id="${key}_section_obs" placeholder="Observaciones, hallazgos o contexto adicional para esta sección...">${data.observaciones||''}</textarea>
    </div>
    ${renderPhotoZone(key)}`;
}

function toggleItemObs(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('show');
}

function addFinding(key, idx) {
  const list = document.getElementById(`${key}_item${idx}_list`);
  if (!list) return;
  const fi = Date.now();
  const fieldId = `finding_${key}_${idx}_${fi}`;
  const div = document.createElement('div');
  div.className = 'finding-item';
  div.innerHTML = `
    <div style="display:flex;gap:6px;align-items:flex-start;flex:1;">
      <textarea class="finding-text" id="${fieldId}" placeholder="Describa el hallazgo..."></textarea>
      <button class="btn-field-mic-ui" onclick="activateVoiceField('${fieldId}')" title="Dictar por voz" style="flex-shrink:0;margin-top:2px;"><i class="fas fa-microphone"></i></button>
    </div>
    <button class="btn-icon del" onclick="removeFinding(this)"><i class="fas fa-trash"></i></button>
  `;
  list.appendChild(div);
  div.querySelector('textarea').focus();
}

function removeFinding(btn) {
  btn.closest('.finding-item').remove();
}

function updateSectionScore(key) {
  flushCurrentSection();
  const pct = computeSectionScore(key, currentEval);
  const color = scoreColor(pct);
  const barEl = document.getElementById('ssb_'+key);
  const pctEl = document.getElementById('ssbpct_'+key);
  const valEl = document.getElementById('eshScoreVal');
  if (barEl) { barEl.style.width=(pct||0)+'%'; barEl.style.background=color; }
  if (pctEl) { pctEl.textContent=pct!==null?pct+'%':'–'; pctEl.style.color=color; }
  if (valEl) { valEl.textContent=pct!==null?pct+'%':'–'; valEl.style.color=color; }
  
  // Resaltado reactivo de observaciones obligatorias
  const items = currentEval[key].items;
  items.forEach((it, i) => {
    const obsEl = document.getElementById(`${key}_obs${i}`);
    if (obsEl) {
      const isMissing = (it.score==='NC' || it.score==='CP') && (!it.obs || it.obs.trim().length < 3);
      if (isMissing) obsEl.classList.add('obs-required');
      else obsEl.classList.remove('obs-required');
    }
  });

  updateSidebar();
}

/* ── XVI. Resultados ────────────────────────────────────── */
function renderResultados() {
  flushCurrentSection();
  const overall = computeOverallScore(currentEval);
  const nivel = scoreToNivel(overall);
  const label = scoreToLabel(overall);
  const color = scoreColor(overall);
  const nivelDesc = {
    critico: 'El nivel de seguridad es insuficiente. Se requiere intervención inmediata.',
    deficiente: 'Existen vulnerabilidades significativas que deben corregirse de forma urgente.',
    observacion: 'Las medidas de seguridad son aceptables pero requieren mejoras a mediano plazo.',
    aceptable: 'Las medidas de seguridad son adecuadas. Se recomienda mantenimiento continuo.',
    borrador: 'Evaluación pendiente de completar las secciones de verificación.'
  }[nivel];

  const breakdown = SCORED_SECTIONS.map(sk => {
    const sec = SECTIONS.find(s=>s.key===sk);
    const pct = computeSectionScore(sk, currentEval);
    const w = pct||0;
    const c = scoreColor(pct);
    return `<div class="rb-card">
      <div class="rb-card-title"><i class="fas ${sec.icon}"></i>${sec.roman}. ${sec.title.split('(')[0]}</div>
      <div class="rb-bar-track"><div class="rb-bar-fill" style="width:${w}%;background:${c}"></div></div>
      <div class="rb-pct" style="color:${c}">${pct!==null?pct+'%':'–'}</div>
      <div class="rb-items">${currentEval[sk]?.items?.filter(it=>it.score&&it.score!=='NA').length||0} ítems evaluados</div>
    </div>`;
  }).join('');

  return `
    <div class="results-hero">
      <div class="rh-score-big" style="color:${color}">${overall!==null?overall:'–'}<span class="rh-score-pct">${overall!==null?'%':''}</span></div>
      <div class="rh-nivel" style="color:${color}">${label}</div>
      <div class="rh-desc">${nivelDesc}</div>
    </div>
    <div class="results-breakdown">${breakdown}</div>
    <div class="section-card">
      <div class="sc-title"><i class="fas fa-info-circle"></i>Resumen de Calificaciones</div>
      <table class="criteria-table">
        <thead><tr><th>#</th><th>Sección</th><th>% Cumplimiento</th><th>Nivel</th><th>Ítems C</th><th>Ítems CP</th><th>Ítems NC</th></tr></thead>
        <tbody>
          ${SCORED_SECTIONS.map(sk=>{
            const sec=SECTIONS.find(s=>s.key===sk);
            const d=currentEval[sk];
            const pct=computeSectionScore(sk,currentEval);
            const nv=scoreToNivel(pct);
            const C=d?.items?.filter(it=>it.score==='C').length||0;
            const CP=d?.items?.filter(it=>it.score==='CP').length||0;
            const NC=d?.items?.filter(it=>it.score==='NC').length||0;
            return `<tr>
              <td style="color:var(--text-m);font-size:11px">${sec.roman}</td>
              <td style="font-size:12px">${sec.title}</td>
              <td><strong style="color:${scoreColor(pct)};font-family:var(--fh)">${pct!==null?pct+'%':'–'}</strong></td>
              <td><span class="ec-badge badge-${nv}">${scoreToLabel(pct).split(' ')[0]}</span></td>
              <td style="color:var(--C);font-weight:700">${C}</td>
              <td style="color:var(--CP);font-weight:700">${CP}</td>
              <td style="color:var(--NC);font-weight:700">${NC}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ── XVII. Plan de Acción ───────────────────────────────── */
function renderPlan() {
  autoGenerateActions();
  const acciones = currentEval.s17.acciones;
  const actionHtml = acciones.length ? acciones.map((ac,i)=>renderActionItem(ac,i)).join('') :
    '<p style="color:var(--text-m);font-size:13px;text-align:center;padding:20px">No hay acciones registradas. Agregue manualmente o genere desde los hallazgos NC/CP.</p>';

  return `
    <div class="info-callout"><i class="fas fa-list-check"></i>
      <p>Registre las <strong>acciones correctivas</strong> para cada hallazgo. Las acciones con calificación NC se pre-cargan automáticamente.</p></div>
    <div class="section-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="sc-title" style="margin:0"><i class="fas fa-tasks"></i>Acciones Correctivas (${acciones.length})</div>
        <button class="btn-icon" onclick="addManualAction()"><i class="fas fa-plus"></i> Agregar acción</button>
      </div>
      <div class="action-list" id="actionList">${actionHtml}</div>
    </div>
    <div class="conclusion-area" style="margin-top:16px">
      <label><i class="fas fa-pen-nib" style="color:var(--teal);margin-right:6px"></i>Conclusión General del Informe</label>
      <textarea id="f17_conclusion" placeholder="Redacte la conclusión del informe de seguridad patrimonial...">${currentEval.s17.conclusion||''}</textarea>
    </div>
    <div class="conclusion-area" style="margin-top:12px">
      <label><i class="fas fa-lightbulb" style="color:var(--gold);margin-right:6px"></i>Recomendaciones Finales</label>
      <textarea id="f17_rec" placeholder="Liste las principales recomendaciones estratégicas...">${currentEval.s17.recomendaciones||''}</textarea>
    </div>`;
}

function renderActionItem(ac, i) {
  const prioOpts=['alta','media','baja'].map(p=>`<option value="${p}"${ac.prioridad===p?' selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('');
  const statOpts=['Pendiente','En Proceso','Completado'].map(s=>`<option${ac.estado===s?' selected':''}>${s}</option>`).join('');
  return `<div class="action-item">
    <div class="ai-header" onclick="toggleAction(${i})">
      <span class="ai-priority pri-${ac.prioridad}">${(ac.prioridad||'–').toUpperCase()}</span>
      <span class="ai-section">${ac.seccion||''}</span>
      <span class="ai-hallazgo">${ac.hallazgo||'Nuevo hallazgo'}</span>
      <i class="fas fa-chevron-down" style="color:var(--text-m);font-size:11px"></i>
    </div>
    <div class="ai-body" id="acbody${i}">
      <div class="ai-grid">
        <div class="ai-group col-12"><span class="ai-label">Hallazgo / Ítem No Cumplido</span>
          <div class="field-mic-wrapper">
            <textarea class="ai-textarea" id="ac_${i}_hallazgo" placeholder="Describa el hallazgo...">${ac.hallazgo||''}</textarea>
            <button class="btn-field-mic-ui" onclick="activateVoiceField('ac_${i}_hallazgo')" title="Dictar por voz"><i class="fas fa-microphone"></i></button>
          </div>
        </div>
        <div class="ai-group col-12"><span class="ai-label">Acción Correctiva Requerida</span>
          <div class="field-mic-wrapper">
            <textarea class="ai-textarea" id="ac_${i}_accion" placeholder="Acción a implementar...">${ac.accion||''}</textarea>
            <button class="btn-field-mic-ui" onclick="activateVoiceField('ac_${i}_accion')" title="Dictar por voz"><i class="fas fa-microphone"></i></button>
          </div>
        </div>
        <div class="ai-group col-4"><span class="ai-label">Responsable</span>
          <input class="ai-input" id="ac_${i}_responsable" value="${ac.responsable||''}" placeholder="Nombre / Cargo"/></div>
        <div class="ai-group col-3"><span class="ai-label">Fecha Límite</span>
          <input class="ai-input" type="date" id="ac_${i}_fecha" value="${ac.fecha||''}"/></div>
        <div class="ai-group col-2"><span class="ai-label">Prioridad</span>
          <select class="ai-input" id="ac_${i}_prioridad">${prioOpts}</select></div>
        <div class="ai-group col-3"><span class="ai-label">Estado</span>
          <select class="ai-input" id="ac_${i}_estado">${statOpts}</select></div>
      </div>
    </div>
  </div>`;
}

function toggleAction(i) {
  const el=document.getElementById('acbody'+i);
  if(el) el.classList.toggle('open');
}

function autoGenerateActions() {
  const existing = currentEval.s17.acciones || [];
  const actions = [];
  
  SCORED_SECTIONS.forEach(sk => {
    const sec = SECTIONS.find(s=>s.key===sk);
    const data = currentEval[sk];
    if (!data?.items) return;
    
    data.items.forEach(it => {
      if (it.score === 'NC' || it.score === 'CP') {
        const secLabel = sec.roman + '. ' + sec.title.split('(')[0].trim();
        // Buscar si ya existe para preservar datos manuales (responsable, fecha, etc)
        const found = existing.find(a => a.hallazgo === it.text && a.seccion === secLabel);
        
        const findings = Array.isArray(it.obs) ? it.obs : (it.obs ? [it.obs] : []);
        findings.forEach(finding => {
          if (!finding.trim()) return;
          actions.push({
            hallazgo: finding, // Cada hallazgo individual es una fila
            accion: '', 
            responsable: '',
            fecha: '',
            prioridad: (it.score === 'NC' ? 'alta' : 'media'),
            estado: 'Pendiente',
            seccion: secLabel,
            score: it.score,
            itemId: it.text // Para poder sincronizar con manuales si fuera necesario
          });
        });
        // Si no hay hallazgos pero es NC/CP, agregar uno con el texto base (fallback)
        if (findings.length === 0 || findings.every(f=>!f.trim())) {
           actions.push({
            hallazgo: it.text,
            accion: '',
            responsable: '',
            fecha: '',
            prioridad: (it.score === 'NC' ? 'alta' : 'media'),
            estado: 'Pendiente',
            seccion: secLabel,
            score: it.score
          });
        }
      }
    });
  });
  // Preservar acciones manuales
  const manual = existing.filter(a => a.seccion === 'Manual');
  currentEval.s17.acciones = [...actions, ...manual];
}

/* ── XVIII. MATRIZ DE RIESGOS ────────────────────────────── */
function syncRisksFromS6() {
  if (!currentEval.s18) currentEval.s18 = { riesgos: [] };
  if (!currentEval.s18.riesgos) currentEval.s18.riesgos = [];
  const s6Riesgos = currentEval.s6.riesgos || []; // IDs de RISK_MANIFESTATIONS
  
  s6Riesgos.forEach(rid => {
    const manifest = RISK_MANIFESTATIONS.find(r => r.id === rid);
    if (!manifest) return;
    // Verificar si ya existe en s18 (por nombre)
    const exists = currentEval.s18.riesgos.some(r => r.amenaza === manifest.label);
    if (!exists) {
      currentEval.s18.riesgos.push({
        id: 'auto_' + rid,
        amenaza: manifest.label,
        inherente: 1,
        residual: 1,
        objetivo: 1,
        medidas: '',
        nivel: 'bajo',
        origin: 's6'
      });
    }
  });
}

function renderMatriz() {
  syncRisksFromS6();
  const d = currentEval.s18;
  const riesgos = d.riesgos || [];

  return `
    <div class="info-callout"><i class="fas fa-circle-info"></i>
      <p>Califique cada amenaza identificada asignando valores de 1 a 5 para el Riesgo Inherente, Residual y Objetivo.</p></div>

    <div class="section-card">
      <div class="sc-title" style="margin-bottom:15px"><i class="fas fa-list-ol"></i> Análisis de Amenazas y Calificación de Riesgos</div>
      <table class="rm-table" style="width:100%;">
        <thead>
          <tr>
            <th style="text-align:left;">Amenaza / Riesgo</th>
            <th style="text-align:center;width:90px" title="Riesgo antes de controles">R. Inherente</th>
            <th style="text-align:center;width:90px" title="Riesgo después de controles">R. Residual</th>
            <th style="text-align:center;width:90px" title="Riesgo meta">R. Objetivo</th>
            <th style="text-align:center;width:100px">Nivel (Residual)</th>
            <th style="width:40px"></th>
          </tr>
        </thead>
        <tbody id="riskRows">
          ${renderRiskRows(riesgos)}
        </tbody>
      </table>
      <button class="btn-ghost-sm" style="margin-top:15px;width:100%" onclick="addCustomRisk()">
        <i class="fas fa-plus"></i> Agregar Amenaza Personalizada
      </button>
    </div>

    <div class="section-card" style="margin-top:20px">
      <div class="sc-title"><i class="fas fa-calculator"></i> Criterios de Evaluación y Cuantificación (Escala 1-5)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          <h4 style="font-size:12px;color:var(--navy);margin-bottom:8px">Definición de Riesgos</h4>
          <ul style="font-size:11px;color:#333;line-height:1.6;padding-left:20px;margin-bottom:0">
            <li><strong>Riesgo Inherente:</strong> El nivel de riesgo existente antes de aplicar cualquier medida de control o mitigación.</li>
            <li><strong>Riesgo Residual:</strong> El nivel de riesgo que permanece después de haber implementado controles y acciones correctivas.</li>
            <li><strong>Riesgo Objetivo:</strong> El nivel de riesgo que la organización está dispuesta a aceptar o tolerar (Apetito de Riesgo).</li>
          </ul>
        </div>
        <div>
          <h4 style="font-size:12px;color:var(--navy);margin-bottom:8px">Escala de Calificación</h4>
          <table class="criteria-table" style="font-size:10px">
            <thead style="font-size:9px"><tr><th>Valor</th><th>Nivel de Riesgo</th><th>Descripción General</th></tr></thead>
            <tbody>
              <tr><td><strong>1-2</strong></td><td><span style="color:#2ECC71;font-weight:bold">Bajo</span></td><td>Riesgo aceptable; solo requiere monitoreo rutinario.</td></tr>
              <tr><td><strong>3</strong></td><td><span style="color:#F1C40F;font-weight:bold">Medio</span></td><td>Requiere atención y controles para evitar su materialización.</td></tr>
              <tr><td><strong>4-5</strong></td><td><span style="color:#E74C3C;font-weight:bold">Alto / Extremo</span></td><td>Inaceptable; requiere acción inmediata y controles robustos.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderRiskRows(riesgos) {
  return riesgos.map((r, i) => {
    r.inherente = r.inherente || r.probabilidad || 1;
    r.residual = r.residual || r.impacto || 1;
    r.objetivo = r.objetivo || 1;
    const lvl = getRiskLevel(r.residual);
    const color = lvl==='bajo'?'#2ECC71':lvl==='medio'?'#F1C40F':'#E74C3C';
    return `
      <tr id="rrow_${i}">
        <td><input type="text" class="form-input-inline" value="${r.amenaza}" oninput="updateRiskVal(${i},'amenaza',this.value)" style="width:100%;background:none;border:none;font-weight:600;color:var(--navy)"/></td>
        <td style="text-align:center">
          <select class="rm-val-select" onchange="updateRiskVal(${i},'inherente',this.value)">
            ${[1,2,3,4,5].map(v=>`<option value="${v}" ${r.inherente==v?'selected':''}>${v}</option>`).join('')}
          </select>
        </td>
        <td style="text-align:center">
          <select class="rm-val-select" onchange="updateRiskVal(${i},'residual',this.value)">
            ${[1,2,3,4,5].map(v=>`<option value="${v}" ${r.residual==v?'selected':''}>${v}</option>`).join('')}
          </select>
        </td>
        <td style="text-align:center">
          <select class="rm-val-select" onchange="updateRiskVal(${i},'objetivo',this.value)">
            ${[1,2,3,4,5].map(v=>`<option value="${v}" ${r.objetivo==v?'selected':''}>${v}</option>`).join('')}
          </select>
        </td>
        <td style="text-align:center">
          <span class="rm-lvl-badge" style="background:${color}; width: 60px; display: inline-block;">${lvl.toUpperCase()}</span>
        </td>
        <td>
          <button class="btn-icon del" onclick="removeRisk(${i})"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
      <tr id="rrow_med_${i}" style="border-bottom: 1px solid #eee;">
        <td colspan="6" style="padding-top:0; padding-bottom:10px;">
          <input type="text" placeholder="Medidas de mitigación implementadas para reducir el riesgo..." value="${r.medidas || ''}" oninput="updateRiskVal(${i},'medidas',this.value)" style="width:100%;background:#f9fafd;border:1px solid #e0e3ee;border-radius:4px;padding:5px 8px;font-size:11px;color:var(--text);"/>
        </td>
      </tr>
    `;
  }).join('');
}

function getRiskLevel(score) {
  if (score <= 2) return 'bajo';
  if (score == 3) return 'medio';
  return 'alto';
}

function updateRiskVal(idx, key, val) {
  const r = currentEval.s18.riesgos[idx];
  if (!r) return;
  r[key] = (key==='amenaza' || key==='medidas') ? val : parseInt(val);
  r.nivel = getRiskLevel(r.residual);
  
  const row = document.getElementById(`rrow_${idx}`);
  if (row && key !== 'amenaza') {
    const color = r.nivel==='bajo'?'#2ECC71':r.nivel==='medio'?'#F1C40F':'#E74C3C';
    row.querySelector('.rm-lvl-badge').style.background = color;
    row.querySelector('.rm-lvl-badge').textContent = `${r.nivel.toUpperCase()}`;
  }
  autoSave();
}

function addCustomRisk() {
  if (!currentEval.s18.riesgos) currentEval.s18.riesgos = [];
  currentEval.s18.riesgos.push({ amenaza:'Nueva Amenaza', inherente:1, residual:1, objetivo:1, medidas:'', nivel:'bajo', origin:'manual' });
  document.getElementById('sectionContent').innerHTML = renderMatriz();
  autoSave();
}

function removeRisk(idx) {
  currentEval.s18.riesgos.splice(idx, 1);
  document.getElementById('sectionContent').innerHTML = renderMatriz();
  autoSave();
}

function addManualAction() {
  flushCurrentSection();
  currentEval.s17.acciones.push({ hallazgo:'', accion:'', responsable:'', fecha:'', prioridad:'media', estado:'Pendiente', seccion:'Manual' });
  const list = document.getElementById('actionList');
  if (list) {
    const i = currentEval.s17.acciones.length-1;
    list.insertAdjacentHTML('beforeend', renderActionItem(currentEval.s17.acciones[i], i));
    toggleAction(i);
  }
}

/* ── DELETE ─────────────────────────────────────────────── */
function deleteEval(id) {
  openModal('Eliminar evaluación',
    '¿Está seguro de que desea eliminar esta evaluación? Esta acción no se puede deshacer.',
    `<button class="btn-danger" onclick="confirmDelete('${id}')"><i class="fas fa-trash"></i> Eliminar</button>
     <button class="btn-ghost" onclick="closeModal()">Cancelar</button>`);
}
function confirmDelete(id) {
  DB = DB.filter(e=>e.id!=id);
  saveDB();
  closeModal();
  renderDashboard();
  showToast('Evaluación eliminada.','info');
}

/* printReport is now handled by downloadPDF() in photos.js */

/* ── MODAL ─────────────────────────────────────────────── */
function openModal(title, body, footer) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalFooter').innerHTML = footer;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

/* ── TOAST ─────────────────────────────────────────────── */
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(()=>t.classList.remove('show'), 3500);
}

/* ── INIT ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => renderDashboard());
