'use strict';

(function() {
    const STORAGE_KEY = 'k9_minutas';
    let minutas = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    let currentMinuta = null;

    window.initMinutas = function() {
        renderMinutasList();
    };

    function saveMinutas() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minutas));
    }

    function renderMinutasList() {
        const container = document.getElementById('viewMinutasList');
        if (!container) return;

        if (minutas.length === 0) {
            container.innerHTML = `
                <div class="dash-section">
                    <div class="ds-header">
                        <h2><i class="fas fa-folder-open"></i> Historial de Minutas</h2>
                        <button class="btn-gold" onclick="window.newMinuta()"><i class="fas fa-plus"></i> Nueva Minuta</button>
                    </div>
                    <div class="empty-dash">
                        <i class="fas fa-file-contract"></i>
                        <h3>Sin minutas registradas</h3>
                        <p>Comience creando la primera minuta de reunión de seguridad.</p>
                        <button class="btn-primary" onclick="window.newMinuta()"><i class="fas fa-plus"></i> Crear Minuta</button>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="dash-section">
                <div class="ds-header">
                    <h2><i class="fas fa-folder-open"></i> Historial de Minutas</h2>
                    <div class="ds-filters">
                        <div class="search-box"><i class="fas fa-search"></i><input type="text" placeholder="Buscar minuta..." oninput="window.filterMinutas(this.value)"/></div>
                        <button class="btn-gold" onclick="window.newMinuta()"><i class="fas fa-plus"></i> Nueva</button>
                    </div>
                </div>
                <div class="eval-list" id="minutasContainer">
                    ${minutas.map(m => renderMinutaCard(m)).join('')}
                </div>
            </div>
        `;
    }

    function renderMinutaCard(m) {
        return `
            <div class="eval-card" onclick="window.openMinuta('${m.id}')">
                <div class="ec-score" style="border-color:var(--gold); color:var(--gold); background:rgba(200,149,26,0.05)">
                    <i class="fas fa-file-lines" style="font-size:20px"></i>
                </div>
                <div class="ec-info">
                    <div class="ec-title">${m.tema || 'Minuta sin título'}</div>
                    <div class="ec-sub">
                        <span><i class="fas fa-calendar-alt"></i> ${m.fecha}</span>
                        <span><i class="fas fa-location-dot"></i> ${m.lugar || 'N/A'}</span>
                        <span><i class="fas fa-users"></i> ${m.participantes.length} Asistentes</span>
                    </div>
                </div>
                <div class="ec-actions" onclick="event.stopPropagation()">
                    <button class="btn-icon pdf" onclick="window.exportMinutaPDF('${m.id}')"><i class="fas fa-file-pdf"></i></button>
                    <button class="btn-icon del" onclick="window.deleteMinuta('${m.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }

    window.newMinuta = function() {
        currentMinuta = {
            id: 'min_' + Date.now(),
            tema: '',
            fecha: new Date().toISOString().split('T')[0],
            lugar: '',
            participantes: [],
            agenda: '',
            acuerdos: [],
            pendientes: '',
            createdAt: new Date().toISOString()
        };
        renderMinutaForm();
    };

    window.openMinuta = function(id) {
        currentMinuta = minutas.find(m => m.id === id);
        renderMinutaForm();
    };

    function renderMinutaForm() {
        const container = document.getElementById('viewMinutasList');
        container.innerHTML = `
            <div class="eval-layout" style="height: auto; overflow: visible;">
                <main class="eval-main" style="border-radius: var(--r); box-shadow: var(--shadow2);">
                    <div class="eval-section-header">
                        <div class="esh-num"><i class="fas fa-file-signature"></i></div>
                        <div class="esh-info">
                            <h2>Edición de Minuta</h2>
                            <p>Complete los detalles de la reunión y los acuerdos alcanzados.</p>
                        </div>
                        <button class="btn-ghost" onclick="window.initMinutas()"><i class="fas fa-arrow-left"></i> Volver</button>
                    </div>
                    
                    <div class="section-content">
                        <div class="section-card">
                            <div class="sc-title"><i class="fas fa-info-circle"></i> Datos Generales</div>
                            <div class="form-grid">
                                <div class="form-group full">
                                    <label><i class="fas fa-heading" style="color:var(--gold); margin-right:8px;"></i> Tema / Título de la Reunión</label>
                                    <input type="text" id="m_tema" value="${currentMinuta.tema}" oninput="currentMinuta.tema=this.value" placeholder="Ej: Comité de Seguridad Mensual">
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-calendar-alt" style="color:var(--gold); margin-right:8px;"></i> Fecha</label>
                                    <input type="date" id="m_fecha" value="${currentMinuta.fecha}" oninput="currentMinuta.fecha=this.value">
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-location-dot" style="color:var(--gold); margin-right:8px;"></i> Lugar</label>
                                    <input type="text" id="m_lugar" value="${currentMinuta.lugar}" oninput="currentMinuta.lugar=this.value" placeholder="Ej: Sala de Juntas A">
                                </div>
                            </div>
                        </div>

                        <div class="section-card">
                            <div class="sc-title"><i class="fas fa-users"></i> Participantes</div>
                            <div id="m_participantes_list" class="findings-list">
                                ${currentMinuta.participantes.map((p, i) => `
                                    <div class="finding-item">
                                        <input type="text" class="ai-input" style="flex:1" value="${p}" oninput="currentMinuta.participantes[${i}]=this.value" placeholder="Nombre y Cargo">
                                        <button class="btn-icon del" onclick="window.removeParticipante(${i})"><i class="fas fa-times"></i></button>
                                    </div>
                                `).join('')}
                            </div>
                            <button class="btn-add-finding" onclick="window.addParticipante()"><i class="fas fa-plus"></i> Agregar Participante</button>
                        </div>

                        <div class="section-card">
                            <div class="sc-title"><i class="fas fa-list-ul"></i> Agenda / Temas Tratados</div>
                            <textarea class="ai-input" style="width:100%; min-height:120px" oninput="currentMinuta.agenda=this.value">${currentMinuta.agenda}</textarea>
                        </div>

                        <div class="section-card">
                            <div class="sc-title"><i class="fas fa-handshake"></i> Acuerdos y Compromisos</div>
                            <table class="criteria-table">
                                <thead>
                                    <tr>
                                        <th>Acuerdo</th>
                                        <th>Responsable</th>
                                        <th>Fecha Límite</th>
                                        <th style="width:40px"></th>
                                    </tr>
                                </thead>
                                <tbody id="m_acuerdos_body">
                                    ${currentMinuta.acuerdos.map((a, i) => `
                                        <tr>
                                            <td><input type="text" class="ai-input" value="${a.detalle}" oninput="currentMinuta.acuerdos[${i}].detalle=this.value"></td>
                                            <td><input type="text" class="ai-input" value="${a.responsable}" oninput="currentMinuta.acuerdos[${i}].responsable=this.value"></td>
                                            <td><input type="date" class="ai-input" value="${a.fecha}" oninput="currentMinuta.acuerdos[${i}].fecha=this.value"></td>
                                            <td><button class="btn-icon del" onclick="window.removeAcuerdo(${i})"><i class="fas fa-trash"></i></button></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            <button class="btn-add-finding" onclick="window.addAcuerdo()"><i class="fas fa-plus"></i> Agregar Acuerdo</button>
                        </div>
                    </div>

                    <div class="eval-nav-bar">
                        <button class="btn-ghost" onclick="window.initMinutas()">Cancelar</button>
                        <button class="btn-primary" onclick="window.saveCurrentMinuta()"><i class="fas fa-save"></i> Guardar Minuta</button>
                    </div>
                </main>
            </div>
        `;
    }

    window.addParticipante = function() {
        currentMinuta.participantes.push('');
        renderMinutaForm();
    };

    window.removeParticipante = function(index) {
        currentMinuta.participantes.splice(index, 1);
        renderMinutaForm();
    };

    window.addAcuerdo = function() {
        currentMinuta.acuerdos.push({ detalle: '', responsable: '', fecha: '' });
        renderMinutaForm();
    };

    window.removeAcuerdo = function(index) {
        currentMinuta.acuerdos.splice(index, 1);
        renderMinutaForm();
    };

    window.saveCurrentMinuta = function() {
        if (!currentMinuta.tema) {
            alert('Por favor ingrese el tema de la reunión.');
            return;
        }
        const idx = minutas.findIndex(m => m.id === currentMinuta.id);
        if (idx >= 0) minutas[idx] = currentMinuta;
        else minutas.push(currentMinuta);
        saveMinutas();
        window.initMinutas();
        if (window.showToast) window.showToast('Minuta guardada correctamente.', 'success');
    };

    window.deleteMinuta = function(id) {
        if (confirm('¿Desea eliminar esta minuta?')) {
            minutas = minutas.filter(m => m.id !== id);
            saveMinutas();
            renderMinutasList();
        }
    };

    window.exportMinutaPDF = function(id) {
        const m = minutas.find(min => min.id === id);
        if (!m) return;
        // PDF generation logic will be implemented in a coordinated way with app.js PDF tools
        alert('Generando PDF para: ' + m.tema);
    };

})();
