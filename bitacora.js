'use strict';

(function() {
    const STORAGE_KEY = 'k9_bitacora';
    let entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    let currentEntryPhotos = [];

    window.initBitacora = function() {
        const dateInput = document.getElementById('b_filter_date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        renderBitacoraView();
    };

    function saveEntries() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }

    function renderBitacoraView() {
        const container = document.getElementById('moduleBitacora');
        if (!container) return;

        const now = new Date();
        const fullDateStr = now.toLocaleDateString('es-CR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();

        container.innerHTML = `
            <div class="bitacora-layout">
                <!-- FORM PANEL (LEFT) -->
                <section class="bitacora-card bitacora-form-panel">
                    <h2 class="bitacora-section-title">REGISTRO DE ACTIVIDAD</h2>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label class="bitacora-label"><i class="fas fa-calendar-day" style="color:var(--gold); margin-right:8px;"></i> FECHA DEL REGISTRO</label>
                        <input type="date" id="b_filter_date" class="bitacora-input" onchange="window.renderBitacoraHistory()">
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label class="bitacora-label"><i class="fas fa-tags" style="color:var(--gold); margin-right:8px;"></i> CLASIFICACIÓN</label>
                        <select id="b_class" class="bitacora-select">
                            <option value="">Seleccione Clasificación</option>
                            <option value="NOVEDADES RECIENTES">NOVEDADES RECIENTES</option>
                            <option value="DETALLE DE SUPERVISIÓN EJECUTIVA">DETALLE DE SUPERVISIÓN EJECUTIVA</option>
                            <option value="ACUERDOS RECIENTES">ACUERDOS RECIENTES</option>
                            <option value="Actualización de riesgos">Actualización de riesgos</option>
                            <option value="SUGERENCIAS DE SEGURIDAD:MEJORAS OPERATIVAS">SUGERENCIAS DE SEGURIDAD:MEJORAS OPERATIVAS</option>
                            <option value="TEMAS PENDIENTES:">TEMAS PENDIENTES:</option>
                            <option value="INVERSIONES PENDIENTES">INVERSIONES PENDIENTES</option>
                        </select>
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label class="bitacora-label"><i class="fas fa-file-lines" style="color:var(--gold); margin-right:8px;"></i> DESCRIPCIÓN DETALLADA</label>
                        <textarea id="b_desc" class="bitacora-textarea" placeholder="Describa la actividad o novedad..."></textarea>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 25px;">
                        <label class="bitacora-label"><i class="fas fa-camera" style="color:var(--gold); margin-right:8px;"></i> EVIDENCIA FOTOGRÁFICA</label>
                        <div class="bitacora-photo-input-wrapper">
                            <input type="file" id="b_photo_input" accept="image/*" multiple onchange="window.handleBitacoraPhotos(this)">
                        </div>
                        <div class="photo-grid" id="b_photo_grid" style="margin-top:10px"></div>
                    </div>

                    <button class="btn-bitacora-save" onclick="window.saveBitacoraEntry()">
                        <i class="fas fa-save"></i> GUARDAR EN BITÁCORA
                    </button>
                </section>

                <!-- HISTORY PANEL (RIGHT) -->
                <section class="bitacora-card bitacora-history-panel">
                    <div class="bitacora-history-header">
                        <h2 class="bitacora-section-title">REGISTROS DEL DÍA</h2>
                        <div style="display:flex; gap:12px; align-items:center">
                            <button class="btn-report-monthly" onclick="window.openReportConfig()">
                                <i class="fas fa-file-pdf"></i> REPORTE MENSUAL
                            </button>
                            <div class="bitacora-header-date" id="b_display_date">${fullDateStr}</div>
                        </div>
                    </div>

                    <div id="bitacoraHistoryContainer" class="bitacora-history-content">
                        <!-- Entries rendered here -->
                    </div>
                </section>
            </div>

            <!-- MODAL DE CONFIGURACIÓN DEL REPORTE -->
            <div id="modalReport" class="modal-overlay">
                <div class="modal-box config-modal">
                    <div class="modal-header tactical">
                        <div style="display:flex; align-items:center; gap:10px">
                             <i class="fas fa-file-invoice" style="color:var(--teal)"></i>
                             <div>
                                 <h3 style="margin:0; font-size:16px">CONFIGURACIÓN DEL REPORTE</h3>
                                 <p style="margin:0; font-size:10px; opacity:0.7">BITÁCORA VIRTUAL - FORMATO OFICIAL</p>
                             </div>
                        </div>
                    </div>
                    <div class="modal-body">
                        <div class="form-grid-2">
                            <div class="form-group">
                                <label class="bitacora-label">FECHA INICIO</label>
                                <input type="date" id="rep_start" class="bitacora-input">
                            </div>
                            <div class="form-group">
                                <label class="bitacora-label">FECHA FIN</label>
                                <input type="date" id="rep_end" class="bitacora-input">
                            </div>
                        </div>
                        <div class="form-group" style="margin-top:10px">
                            <label class="bitacora-label">NOMBRE DEL CLIENTE / ENTIDAD</label>
                            <input type="text" id="rep_client" class="bitacora-input" placeholder="Nombre completo">
                        </div>
                        <div class="form-group" style="margin-top:10px">
                            <label class="bitacora-label">NIVEL DE ALERTA</label>
                            <select id="rep_alert" class="bitacora-select">
                                <option value="Bajo">Bajo</option>
                                <option value="Medio" selected>Medio</option>
                                <option value="Alto">Alto</option>
                                <option value="Crítico">Crítico</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-top:10px">
                            <label class="bitacora-label">EJECUTIVO(S) K-9</label>
                            <input type="text" id="rep_execs" class="bitacora-input" placeholder="Nombres de ejecutivos">
                        </div>
                        <div class="form-group" style="margin-top:10px">
                            <label class="bitacora-label">CONTACTO CLIENTE</label>
                            <input type="text" id="rep_contact" class="bitacora-input" placeholder="Nombre del contacto">
                        </div>
                    </div>
                    <div class="modal-footer" style="padding: 20px; border-top: none">
                        <button class="btn-ghost" onclick="window.closeReportModal()">CANCELAR</button>
                        <button class="btn-report-gen" onclick="window.generateMonthlyReport()">GENERAR REPORTE FINAL</button>
                    </div>
                </div>
            </div>
        `;
        
        // Match the date picker to the current day
        const dateInput = document.getElementById('b_filter_date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        
        window.renderBitacoraHistory();
    }

    window.handleBitacoraPhotos = async function(input) {
        if (!input.files) return;
        const grid = document.getElementById('b_photo_grid');
        for (const file of input.files) {
            const base64 = await toBase64(file);
            currentEntryPhotos.push(base64);
            const thumb = document.createElement('div');
            thumb.className = 'photo-thumb';
            thumb.innerHTML = `<img src="${base64}"><button class="photo-thumb-del" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
            grid.insertBefore(thumb, grid.firstChild);
        }
        input.value = '';
    };

    window.saveBitacoraEntry = function() {
        const cls = document.getElementById('b_class').value;
        const desc = document.getElementById('b_desc').value.trim();
        const date = document.getElementById('b_filter_date').value;

        if (!cls || !desc) {
            alert('Por favor complete la clasificación y descripción.');
            return;
        }

        const newEntry = {
            id: 'bit_' + Date.now(),
            date: date,
            classification: cls,
            description: desc,
            photos: [...currentEntryPhotos],
            timestamp: new Date().toISOString()
        };

        entries.unshift(newEntry);
        saveEntries();
        currentEntryPhotos = [];
        renderBitacoraView();
        if (window.showToast) window.showToast('Entrada registrada.', 'success');
    };

    window.renderBitacoraHistory = function() {
        const historyContainer = document.getElementById('bitacoraHistoryContainer');
        const filterDateInput = document.getElementById('b_filter_date');
        const dateDisplay = document.getElementById('b_display_date');
        
        if (!historyContainer || !filterDateInput) return;

        const filterDate = filterDateInput.value;
        
        // Update display date
        if (dateDisplay && filterDate) {
            const d = new Date(filterDate + 'T12:00:00');
            dateDisplay.textContent = d.toLocaleDateString('es-CR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
        }

        const filtered = entries.filter(e => e.date === filterDate);

        if (filtered.length === 0) {
            historyContainer.innerHTML = `
                <div class="bitacora-empty-state">
                    <i class="fas fa-book-open"></i>
                    <p>No hay registros para la fecha seleccionada.</p>
                </div>
            `;
            return;
        }

        historyContainer.innerHTML = filtered.map(e => `
            <div class="eval-card" style="cursor:default">
                <div class="ec-info">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px">
                        <span class="ec-badge" style="background:var(--navy-xl); color:var(--navy)">${e.classification}</span>
                        <span style="font-size:10px; color:var(--text-d)">${new Date(e.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div class="ec-title" style="font-size:13px; font-weight:500; white-space:pre-line">${e.description}</div>
                    ${e.photos.length > 0 ? `
                        <div class="photo-grid" style="margin-top:10px">
                            ${e.photos.map(p => `<div class="photo-thumb" style="width:50px; height:50px"><img src="${p}" onclick="window.viewBitacoraPhoto('${p}')" style="cursor:pointer"></div>`).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="ec-actions">
                    <button class="btn-icon del" onclick="window.deleteBitacoraEntry('${e.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    };

    window.deleteBitacoraEntry = function(id) {
        if (confirm('¿Eliminar este registro?')) {
            entries = entries.filter(e => e.id !== id);
            saveEntries();
            window.renderBitacoraHistory();
        }
    };

    window.openReportConfig = function() {
        const modal = document.getElementById('modalReport');
        if (!modal) return;
        
        // Default dates: start and end of current month
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        
        document.getElementById('rep_start').value = firstDay;
        document.getElementById('rep_end').value = lastDay;
        
        // Auto-fill client if possible
        if (window.DB && window.DB.length > 0) {
            const lastEval = window.DB[0];
            document.getElementById('rep_client').value = lastEval.s1.empresa || '';
        }
        
        modal.classList.add('open');
    };

    window.closeReportModal = function() {
        document.getElementById('modalReport').classList.remove('open');
    };

    window.generateMonthlyReport = async function() {
        const start = document.getElementById('rep_start').value;
        const end = document.getElementById('rep_end').value;
        const client = document.getElementById('rep_client').value || 'Sin Definir';
        const alertLvl = document.getElementById('rep_alert').value;
        const execs = document.getElementById('rep_execs').value || 'Sin Definir';
        const contact = document.getElementById('rep_contact').value || 'Sin Definir';

        if (!start || !end) {
            alert('Por favor defina el rango de fechas.');
            return;
        }

        const dateStart = new Date(start + 'T00:00:00');
        const dateEnd = new Date(end + 'T23:59:59');

        // Filter entries in range
        const filteredEntries = entries.filter(e => {
            const entryDate = new Date(e.date + 'T12:00:00');
            return entryDate >= dateStart && entryDate <= dateEnd;
        }).sort((a, b) => a.date.localeCompare(b.date));

        // Group by category
        const categories = {
            'NOVEDADES RECIENTES': [],
            'DETALLE DE SUPERVISIÓN EJECUTIVA': [],
            'ACUERDOS RECIENTES': [],
            'Actualización de riesgos': [],
            'SUGERENCIAS DE SEGURIDAD:MEJORAS OPERATIVAS': [],
            'TEMAS PENDIENTES:': [],
            'INVERSIONES PENDIENTES': []
        };

        filteredEntries.forEach(e => {
            if (categories[e.classification]) {
                categories[e.classification].push(`[${e.date}] ${e.description}`);
            }
        });

        const mapping = {
            'NOVEDADES RECIENTES': 'NOVEDADES RECIENTES',
            'DETALLE DE SUPERVISIÓN EJECUTIVA': 'SUPERVISIÓN EJECUTIVA',
            'ACUERDOS RECIENTES': 'ACUERDOS RECIENTES',
            'Actualización de riesgos': 'GESTIÓN DE RIESGOS',
            'SUGERENCIAS DE SEGURIDAD:MEJORAS OPERATIVAS': 'MEJORAS OPERATIVAS',
            'TEMAS PENDIENTES:': 'TEMAS PENDIENTES',
            'INVERSIONES PENDIENTES': 'INVERSIONES PENDIENTES'
        };

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte Mensual SIG - ${client}</title>
            <style>
                body { font-family: 'Inter', Arial, sans-serif; color: #333; margin: 0; padding: 20px; font-size: 11px; line-height: 1.4; }
                .sig-header { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #000; }
                .sig-header td { border: 1px solid #000; padding: 5px; text-align: center; }
                .sig-logo { width: 100px; height: 50px; object-fit: contain; }
                .sig-title-box { background: #00102b; color: #fff; font-weight: 800; text-transform: uppercase; font-size: 14px; }
                
                .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .meta-table td { padding: 8px 4px; border-bottom: 1px solid #eee; }
                .meta-label { font-weight: 800; width: 150px; text-transform: uppercase; color: #00102b; }
                .alert-badge { background: #ff9800; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: 800; }
                
                .content-table { width: 100%; border-collapse: collapse; border: 1px solid #999; }
                .content-table th { background: #f4f4f4; border: 1px solid #999; padding: 10px; width: 180px; text-align: left; text-transform: uppercase; font-weight: 800; color: #00102b; }
                .content-table td { border: 1px solid #999; padding: 10px; vertical-align: top; }
                
                .periodo-box { background: #00102b; color: #fff; padding: 8px; text-align: center; font-weight: 800; margin-bottom: 20px; border-radius: 4px; font-size: 12px; }
                .no-data { color: #888; font-style: italic; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <table class="sig-header">
                <tr>
                    <td rowspan="2" style="width:120px"><img src="logo.png" class="sig-logo"></td>
                    <td class="sig-title-box" colspan="6">REPORTE MENSUAL DE CLIENTES<br>SISTEMA INTEGRAL DE GESTIÓN</td>
                </tr>
                <tr style="font-size: 8px;">
                    <td>TIPO: Documento</td>
                    <td>ÚLTIMA MODIF: ${new Date().toLocaleDateString()}</td>
                    <td>APROBACIÓN: SIG</td>
                    <td>CÓDIGO: OPS_FOR_014</td>
                    <td>VERSIÓN: 3</td>
                    <td>CONFIDENCIALIDAD: ${alertLvl.toUpperCase()}</td>
                </tr>
            </table>

            <div class="periodo-box">PERIODO: ${start} - ${end}</div>

            <table class="meta-table">
                <tr>
                    <td class="meta-label">CLIENTE / ENTIDAD:</td>
                    <td style="font-size:14px; font-weight:800">
                        <div style="display:flex; justify-content:space-between; align-items:center">
                            <span>${client}</span>
                            ${(() => {
                                // Try to find a logo in the DB
                                let logo = null;
                                if (window.DB && window.DB.length > 0) {
                                    const match = window.DB.find(ev => ev.s1 && ev.s1.clientLogo);
                                    if (match) logo = match.s1.clientLogo;
                                }
                                return logo ? `<img src="${logo}" style="height:40px; max-width:150px; object-fit:contain">` : '';
                            })()}
                        </div>
                    </td>
                </tr>
                <tr>
                    <td class="meta-label">NIVEL DE ALERTA:</td>
                    <td><span class="alert-badge">${alertLvl}</span></td>
                </tr>
                <tr>
                    <td class="meta-label">EJECUTIVOS K-9:</td>
                    <td>${execs}</td>
                </tr>
                <tr>
                    <td class="meta-label">CONTACTO CLIENTE:</td>
                    <td>${contact}</td>
                </tr>
            </table>

            <table class="content-table">
                ${Object.keys(mapping).map(formKey => {
                    const reportKey = mapping[formKey];
                    const items = categories[formKey] || [];
                    const content = items.length > 0 ? items.join('<br><br>').replace(/\n/g, '<br>') : '<span class="no-data">Sin registros.</span>';
                    return `
                        <tr>
                            <th>${reportKey}</th>
                            <td>${content}</td>
                        </tr>
                    `;
                }).join('')}
                <tr>
                    <th>NOTAS ADICIONALES:</th>
                    <td></td>
                </tr>
            </table>

            <script>
                window.onload = function() {
                    window.print();
                    // window.close(); 
                }
            </script>
        </body>
        </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(htmlContent);
        win.document.close();
        
        window.closeReportModal();
    };

    function toBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

})();
