'use strict';

(function () {
    const STORAGE_KEY = 'k9_bitacora';
    const CONFIG_KEY  = 'k9_bitacora_config';

    let logs = [];
    let reportConfig = {};
    let selectedPhotos = [];
    let recognition = null;
    let isRecording = false;

    const CATEGORIES = [
        "NOVEDADES RECIENTES",
        "DETALLE DE SUPERVISIÓN EJECUTIVA",
        "ACUERDOS RECIENTES",
        "Actualización de riesgos",
        "SUGERENCIAS DE SEGURIDAD",
        "MEJORAS OPERATIVAS",
        "TEMAS PENDIENTES",
        "INVERSIONES PENDIENTES",
        "NOTAS"
    ];

    function load() {
        try { logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) { logs = []; }
        try { reportConfig = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); } catch(e) { reportConfig = {}; }
        if (!reportConfig.executive) reportConfig.executive = 'Manuel Ángel López Guevara';
        if (!reportConfig.clientContact) reportConfig.clientContact = 'Guillermo González';
        if (!reportConfig.alertLevel) reportConfig.alertLevel = 'Medio';
    }

    function saveLogs() { localStorage.setItem(STORAGE_KEY, JSON.stringify(logs)); }
    function saveConfig() { localStorage.setItem(CONFIG_KEY, JSON.stringify(reportConfig)); }

    // ── INIT ─────────────────────────────────────────────────────
    window.initBitacora = function () {
        load();
        const dateEl = document.getElementById('bit-date');
        if (dateEl) {
            if (!dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
            dateEl.onchange = renderHistory;
        }
        loadConfigToUI();
        renderHistory();
        renderStats();
        initVoice();
    };

    // ── STATS ─────────────────────────────────────────────────────
    function renderStats() {
        const today = new Date().toISOString().split('T')[0];
        const el1 = document.getElementById('bit-stat-total');
        const el2 = document.getElementById('bit-stat-today');
        if (el1) el1.textContent = logs.length;
        if (el2) el2.textContent = logs.filter(l => l.date === today).length;
    }

    // ── SAVE ENTRY ────────────────────────────────────────────────
    window.saveBitacoraEntry = function (e) {
        e.preventDefault();
        const date   = document.getElementById('bit-date').value;
        const cat    = document.getElementById('bit-classification').value;
        const desc   = document.getElementById('bit-description').value.trim();
        const dueEl  = document.getElementById('bit-due-date');
        if (!date || !cat || !desc) return;

        const entry = {
            id: Date.now().toString(),
            date,
            classification: cat,
            description: desc,
            dueDate: dueEl ? dueEl.value : '',
            photos: [...selectedPhotos],
            createdAt: new Date().toISOString()
        };

        logs.unshift(entry);
        saveLogs();
        selectedPhotos = [];

        const preview = document.getElementById('bit-photos-preview');
        if (preview) preview.innerHTML = '';
        const photoInput = document.getElementById('bit-photos');
        if (photoInput) photoInput.value = '';
        document.getElementById('bit-description').value = '';
        document.getElementById('bit-classification').value = '';

        renderHistory();
        renderStats();
        if (window.showToast) window.showToast('Registro guardado.', 'success');
    };

    // ── HISTORY ───────────────────────────────────────────────────
    function renderHistory() {
        const dateEl = document.getElementById('bit-date');
        const listEl = document.getElementById('bitacora-list');
        const dispEl = document.getElementById('bit-history-date-display');
        if (!listEl) return;

        const selectedDate = dateEl ? dateEl.value : new Date().toISOString().split('T')[0];
        const dayLogs = logs.filter(l => l.date === selectedDate);

        if (dispEl) {
            const d = new Date(selectedDate + 'T12:00:00');
            dispEl.textContent = d.toLocaleDateString('es-CR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
        }

        if (dayLogs.length === 0) {
            listEl.innerHTML = `<div style="text-align:center;padding:40px;opacity:0.5;"><i class="fas fa-book-open" style="font-size:32px;display:block;margin-bottom:12px;"></i>Sin registros para este día.</div>`;
            return;
        }

        listEl.innerHTML = dayLogs.map(l => `
            <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                    <span style="font-size:9px;font-weight:800;background:var(--navy);color:var(--gold);padding:3px 10px;border-radius:20px;text-transform:uppercase;">${l.classification}</span>
                    <div style="display:flex;gap:8px;">
                        <button onclick="window.deleteBitacoraEntry('${l.id}')" style="background:rgba(201,27,56,0.1);border:1px solid rgba(201,27,56,0.3);color:var(--critico);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <p style="font-size:12px;color:var(--text);line-height:1.6;white-space:pre-wrap;">${l.description}</p>
                ${l.dueDate ? `<div style="font-size:10px;color:var(--gold);margin-top:8px;"><i class="fas fa-clock"></i> Fecha compromiso: ${l.dueDate}</div>` : ''}
                ${l.photos && l.photos.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">${l.photos.map(p => `<img src="${p}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">`).join('')}</div>` : ''}
            </div>
        `).join('');
    }

    // ── DELETE ────────────────────────────────────────────────────
    window.deleteBitacoraEntry = function (id) {
        if (!confirm('¿Eliminar este registro?')) return;
        logs = logs.filter(l => l.id !== id);
        saveLogs();
        renderHistory();
        renderStats();
    };

    // ── PHOTOS ────────────────────────────────────────────────────
    window.previewBitacoraPhotos = function (input) {
        selectedPhotos = [];
        const preview = document.getElementById('bit-photos-preview');
        if (!preview) return;
        preview.innerHTML = '';
        const files = Array.from(input.files || []);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = e => {
                selectedPhotos.push(e.target.result);
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.cssText = 'width:70px;height:55px;object-fit:cover;border-radius:6px;border:1px solid var(--border);';
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    };

    // ── VOICE ─────────────────────────────────────────────────────
    function initVoice() {
        const mic = document.getElementById('bit-mic');
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            if (mic) mic.style.display = 'none';
            return;
        }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-ES';
        recognition.onresult = e => {
            let t = '';
            for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
            const ta = document.getElementById('bit-description');
            if (ta) ta.value = t;
        };
        recognition.onerror = () => { isRecording = false; updateMicUI(); };
        recognition.onend  = () => { if (isRecording) { isRecording = false; updateMicUI(); } };
    }

    function updateMicUI() {
        const mic = document.getElementById('bit-mic');
        if (!mic) return;
        mic.style.background = isRecording ? 'var(--critico)' : '';
        mic.innerHTML = isRecording ? '<i class="fas fa-stop"></i>' : '<i class="fas fa-microphone"></i>';
    }

    window.toggleBitacoraVoice = function () {
        if (!recognition) return;
        if (isRecording) { recognition.stop(); isRecording = false; }
        else { recognition.start(); isRecording = true; }
        updateMicUI();
    };

    // ── SIGNATURE ─────────────────────────────────────────────────
    window.uploadBitacoraSignature = function (input) {
        if (!input.files || !input.files[0]) return;
        const reader = new FileReader();
        reader.onload = e => {
            localStorage.setItem('k9_evaluator_signature', e.target.result);
            const prev = document.getElementById('bit-sig-preview');
            if (prev) prev.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
            if (window.showToast) window.showToast('Firma cargada.', 'success');
        };
        reader.readAsDataURL(input.files[0]);
    };

    // ── CONFIG UI ─────────────────────────────────────────────────
    function loadConfigToUI() {
        const f = id => document.getElementById(id);
        if (f('cfg-client-name'))    f('cfg-client-name').value    = reportConfig.clientName    || '';
        if (f('cfg-alert-level'))    f('cfg-alert-level').value    = reportConfig.alertLevel    || 'Medio';
        if (f('cfg-executive'))      f('cfg-executive').value      = reportConfig.executive     || '';
        if (f('cfg-client-contact')) f('cfg-client-contact').value = reportConfig.clientContact || '';
        const sig = localStorage.getItem('k9_evaluator_signature');
        const prev = f('bit-sig-preview');
        if (sig && prev) prev.innerHTML = `<img src="${sig}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
    }

    function saveConfigFromUI() {
        reportConfig = {
            clientName:    (document.getElementById('cfg-client-name')    || {}).value || '',
            alertLevel:    (document.getElementById('cfg-alert-level')    || {}).value || 'Medio',
            executive:     (document.getElementById('cfg-executive')      || {}).value || '',
            clientContact: (document.getElementById('cfg-client-contact') || {}).value || ''
        };
        saveConfig();
    }

    // ── MODAL ─────────────────────────────────────────────────────
    window.k9_openBitacoraReportConfig = function () {
        load();
        loadConfigToUI();
        const modal = document.getElementById('modalReportConfig');
        if (modal) modal.style.display = 'flex';
    };

    window.closeReportConfig = function () {
        const modal = document.getElementById('modalReportConfig');
        if (modal) modal.style.display = 'none';
    };

    // ── PDF GENERATION ────────────────────────────────────────────
    window.generateBitacoraPDF = function () {
        saveConfigFromUI();
        window.closeReportConfig();

        const now   = new Date();
        const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
        const period = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

        const monthLogs = logs.filter(l => {
            const d = new Date(l.date + 'T12:00:00');
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).sort((a, b) => new Date(a.date) - new Date(b.date));

        if (monthLogs.length === 0) {
            alert('No hay registros en el mes actual para generar el reporte.');
            return;
        }

        const sig = localStorage.getItem('k9_evaluator_signature') || '';
        const alertColor = reportConfig.alertLevel === 'Crítico' ? '#ef4444' :
                           reportConfig.alertLevel === 'Alto'    ? '#f59e0b' :
                           reportConfig.alertLevel === 'Medio'   ? '#3b82f6' : '#22c55e';

        const sectionsHtml = CATEGORIES.map((cat, i) => {
            const items = monthLogs.filter(l => l.classification === cat);
            if (!items.length) return '';
            return `
                <div style="margin-top:28px;">
                    <div style="background:#0f172a;color:white;padding:9px 16px;font-weight:800;font-size:11px;letter-spacing:1px;border-radius:4px;text-transform:uppercase;">
                        ${i+1}. ${cat}
                    </div>
                    ${items.map(l => `
                        <div style="padding:16px 4px;border-bottom:1px solid #e2e8f0;page-break-inside:avoid;">
                            <div style="font-size:9px;font-weight:800;color:#c8951a;margin-bottom:6px;">FECHA: ${l.date}${l.dueDate ? ' &nbsp;|&nbsp; COMPROMISO: ' + l.dueDate : ''}</div>
                            <div style="font-size:11px;color:#1e293b;line-height:1.7;white-space:pre-wrap;text-align:justify;">${l.description}</div>
                            ${l.photos && l.photos.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">${l.photos.map(p=>`<img src="${p}" style="width:150px;height:100px;object-fit:cover;border-radius:4px;border:1px solid #cbd5e1;">`).join('')}</div>` : ''}
                        </div>
                    `).join('')}
                </div>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Bitácora – ${reportConfig.clientName || 'K-9'} – ${period}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; background: #fff; font-size: 11px; }
  .page { padding: 40px 50px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1.5px solid #0f172a; padding: 10px 14px; vertical-align: middle; }
  .title-cell { text-align: center; font-weight: 800; font-size: 13px; background: #f1f5f9; letter-spacing: 0.5px; }
  .meta-cell { font-size: 9.5px; line-height: 1.9; color: #475569; width: 200px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 22px 0; }
  .info-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; background: #fdfdfd; }
  .lbl { font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
  .val { font-size: 12px; font-weight: 600; color: #0f172a; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; background: ${alertColor}; color: #fff; font-weight: 800; font-size: 9px; text-transform: uppercase; margin-top: 5px; }
  .wm { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg); font-size: 70px; font-weight: 900; color: rgba(15,23,42,0.03); pointer-events: none; white-space: nowrap; z-index: -1; }
  .sig-area { margin-top: 80px; text-align: center; page-break-inside: avoid; }
  .sig-line { width: 300px; margin: 0 auto; border-top: 2px solid #0f172a; padding-top: 8px; font-weight: 800; font-size: 12px; color: #0f172a; }
  .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #0f172a; color: #fff; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; font-size: 13px; font-weight: 600; }
  .print-bar button { background: #c8951a; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer; }
  .spacer { height: 46px; }
  @media print { .print-bar, .spacer { display: none; } .page { padding: 20px 30px; } @page { margin: 1.5cm; } }
</style>
</head>
<body>
  <div class="print-bar">
    <span style="color:#c8951a;font-weight:800;">⚙ Reporte Mensual – Bitácora K-9 · ${period}</span>
    <button onclick="window.print()">🖨 Guardar como PDF</button>
  </div>
  <div class="spacer"></div>
  <div class="page">
    <div class="wm">CORPORACIÓN K-9 INTERNACIONAL</div>

    <table style="margin-bottom:22px;">
      <tr>
        <td class="title-cell">
          REPORTE MENSUAL DE BITÁCORA VIRTUAL<br>
          <span style="font-size:10px;font-weight:600;color:#64748b;">SUPERVISIÓN Y ACUERDOS ESTRATÉGICOS</span>
        </td>
        <td class="meta-cell">
          <strong>CÓDIGO:</strong> SIG-K9-BIT-01<br>
          <strong>PERIODO:</strong> ${period}<br>
          <strong>GENERADO:</strong> ${new Date().toLocaleDateString('es-CR')}<br>
          <strong>CONFIDENCIALIDAD:</strong> NIVEL 3
        </td>
      </tr>
    </table>

    <div class="info-grid">
      <div class="info-card">
        <div class="lbl">Cliente / Entidad</div>
        <div class="val">${reportConfig.clientName || '—'}</div>
        <div class="lbl" style="margin-top:12px;">Nivel de Alerta Operativa</div>
        <div class="badge">${reportConfig.alertLevel || 'Medio'}</div>
      </div>
      <div class="info-card">
        <div class="lbl">Ejecutivo Responsable K-9</div>
        <div class="val">${reportConfig.executive || '—'}</div>
        <div class="lbl" style="margin-top:12px;">Contacto del Cliente</div>
        <div class="val">${reportConfig.clientContact || '—'}</div>
      </div>
    </div>

    ${sectionsHtml}

    <div class="sig-area">
      ${sig ? `<img src="${sig}" style="max-width:200px;max-height:80px;object-fit:contain;display:block;margin:0 auto 12px;">` : '<div style="height:80px;"></div>'}
      <div class="sig-line">${reportConfig.executive || 'Dirección de Operaciones'}</div>
      <div style="font-size:10px;color:#64748b;margin-top:4px;">Dirección de Operaciones · Corporación K-9 Internacional</div>
      <div style="font-size:8px;color:#94a3b8;margin-top:2px;">Generado por XIX Tactical Assistant</div>
    </div>
  </div>
</body>
</html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        } else {
            alert('El navegador bloqueó la ventana emergente.\nPor favor permita pop-ups para este sitio e intente de nuevo.');
        }
    };

})();
