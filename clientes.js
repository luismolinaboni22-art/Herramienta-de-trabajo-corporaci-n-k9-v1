'use strict';

(function() {
    let clientes = JSON.parse(localStorage.getItem('k9_clientes') || '[]');
    let currentClienteIndex = -1;

    window.initClientes = function() {
        renderClientesView();
    };

    function saveClientes() {
        localStorage.setItem('k9_clientes', JSON.stringify(clientes));
    }

    function renderClientesView() {
        const container = document.getElementById('moduleClientes');
        if (!container) return;

        const total = clientes.length;

        container.innerHTML = `
            <div class="dash-hero">
                <div class="dash-hero-scanline"></div>
                <div class="dash-hero-inner">
                    <div class="dash-hero-content">
                        <div class="dash-corp-tag"><i class="fas fa-building-user"></i> GESTIÓN DE CLIENTES</div>
                        <h1>Información de <span class="accent">Cliente</span></h1>
                        <p>Registro y control de perfiles corporativos, cobertura operativa y gestión de puestos específicos.</p>
                        <div class="dash-hero-actions">
                            <button class="btn-gold btn-lg" onclick="window.showClienteForm()"><i class="fas fa-plus"></i> Nuevo Cliente</button>
                        </div>
                    </div>
                    <div class="dash-hero-stats">
                        <div class="hs-card">
                            <div class="hs-num">${total}</div>
                            <div class="hs-label">Clientes Registrados</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="dash-section" id="clientesContentArea"></div>
        `;

        renderClientesList();
    }

    window.showClienteForm = function(index = -1) {
        const area = document.getElementById('clientesContentArea');
        if (!area) return;

        currentClienteIndex = index;
        const c = index >= 0 ? clientes[index] : { 
            nombre: '', enlace: '', bravo: '', cobertura: '', 
            direccion: '', telefono: '', correo: '', logo: '', 
            rol: '', puestosList: []
        };
        
        area.innerHTML = `
            <div class="eval-layout" style="height: auto; overflow: visible;">
                <main class="eval-main" style="border-radius: var(--r); box-shadow: var(--shadow2);">
                    <div class="eval-section-header">
                        <div class="esh-num"><i class="fas fa-building"></i></div>
                        <div class="esh-info">
                            <h2>${index >= 0 ? 'Editar Cliente' : 'Registro de Nuevo Cliente'}</h2>
                            <p>Complete los datos del perfil corporativo y detalle los puestos de servicio.</p>
                        </div>
                        <button class="btn-ghost" onclick="window.initClientes()"><i class="fas fa-arrow-left"></i> Volver</button>
                    </div>

                    <div class="section-content">
                        <div class="section-card premium-header-card">
                            <div class="form-grid-tactical">
                                <div class="fg-item col-6">
                                    <label><i class="fas fa-building-user"></i> NOMBRE DEL CLIENTE</label>
                                    <input type="text" id="cli_nombre" value="${c.nombre}" class="ai-input-premium" placeholder="Razón social o comercial">
                                </div>
                                <div class="fg-item col-6">
                                    <label><i class="fas fa-user-shield"></i> ENLACE DE SEGURIDAD</label>
                                    <input type="text" id="cli_enlace" value="${c.enlace}" class="ai-input-premium" placeholder="Nombre del encargado">
                                </div>
                                <div class="fg-item col-3">
                                    <label><i class="fas fa-hashtag"></i> NÚMERO DE BRAVO</label>
                                    <input type="text" id="cli_bravo" value="${c.bravo || ''}" class="ai-input-premium" placeholder="ID Operativo">
                                </div>
                                <div class="fg-item col-3">
                                    <label><i class="fas fa-map-location-dot"></i> COBERTURA GENERAL</label>
                                    <input type="text" id="cli_cobertura" value="${c.cobertura || ''}" class="ai-input-premium" placeholder="Ej: Nacional...">
                                </div>
                                <div class="fg-item col-6">
                                    <label><i class="fas fa-clipboard-user"></i> ROL DE TRABAJO</label>
                                    <input type="text" id="cli_rol" value="${c.rol}" class="ai-input-premium" placeholder="Ej: Seguridad perimetral 24/7">
                                </div>
                                <div class="fg-item col-6">
                                    <label><i class="fas fa-location-dot"></i> DIRECCIÓN EXACTA</label>
                                    <input type="text" id="cli_direccion" value="${c.direccion || ''}" class="ai-input-premium" placeholder="Ubicación física">
                                </div>
                                <div class="fg-item col-3">
                                    <label><i class="fas fa-phone"></i> TELÉFONO</label>
                                    <input type="text" id="cli_telefono" value="${c.telefono || ''}" class="ai-input-premium">
                                </div>
                                <div class="fg-item col-3">
                                    <label><i class="fas fa-envelope"></i> CORREO</label>
                                    <input type="email" id="cli_correo" value="${c.correo || ''}" class="ai-input-premium">
                                </div>
                                <div class="fg-item col-12">
                                    <label><i class="fas fa-image"></i> LOGO DEL CLIENTE</label>
                                    <input type="file" id="cli_logo_input" accept="image/*" class="ai-input-premium" onchange="window.previewClienteLogo(this)">
                                    <div id="cli_logo_preview" style="margin-top:5px; height:60px; border:1px dashed var(--border); border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                                        ${c.logo ? `<img src="${c.logo}" style="height:100%;">` : '<span style="opacity:0.5; font-size:11px;">Vista previa del logo</span>'}
                                    </div>
                                    <input type="hidden" id="cli_logo_base64" value="${c.logo || ''}">
                                </div>
                            </div>
                        </div>

                        <div class="section-card">
                            <div class="sc-title"><i class="fas fa-map-pin"></i> Gestión de Puestos</div>
                            <div id="cli_puestos_container" class="findings-list" style="margin-bottom:15px;"></div>
                            <button class="btn-add-finding" onclick="window.addPostToClient()"><i class="fas fa-plus"></i> Agregar Puesto</button>
                        </div>
                    </div>

                    <div class="eval-nav-bar">
                        <button class="btn-ghost" onclick="window.initClientes()">Cancelar</button>
                        <button class="btn-primary" onclick="window.saveClienteData()"><i class="fas fa-save"></i> Guardar Cliente</button>
                    </div>
                </main>
            </div>
        `;
        renderPostsInForm(c.puestosList);
    };

    function renderPostsInForm(posts) {
        const container = document.getElementById('cli_puestos_container');
        if (!container) return;
        container.innerHTML = posts.map((p, idx) => `
            <div class="finding-item" style="display:grid; grid-template-columns: 1fr 1fr 40px; gap:10px; align-items:center;">
                <input type="text" class="ai-input post-name" value="${p.nombre}" placeholder="Puesto">
                <input type="text" class="ai-input post-schedule" value="${p.horario}" placeholder="Horario">
                <button class="btn-icon del" onclick="window.removePostFromClient(${idx})"><i class="fas fa-times"></i></button>
            </div>
        `).join('') || '<p style="opacity:0.5; font-size:12px;">Sin puestos.</p>';
    }

    window.addPostToClient = function() {
        const posts = getPostsFromForm();
        posts.push({ nombre: '', horario: '' });
        renderPostsInForm(posts);
    };

    window.removePostFromClient = function(idx) {
        const posts = getPostsFromForm();
        posts.splice(idx, 1);
        renderPostsInForm(posts);
    };

    window.previewClienteLogo = function(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const base64 = e.target.result;
                document.getElementById('cli_logo_base64').value = base64;
                document.getElementById('cli_logo_preview').innerHTML = `<img src="${base64}" style="height:100%;">`;
            };
            reader.readAsDataURL(input.files[0]);
        }
    };

    function getPostsFromForm() {
        const names = document.querySelectorAll('.post-name');
        const schedules = document.querySelectorAll('.post-schedule');
        const posts = [];
        names.forEach((n, idx) => {
            posts.push({ nombre: n.value.trim(), horario: schedules[idx].value.trim() });
        });
        return posts;
    }

    window.saveClienteData = function() {
        const nombre = document.getElementById('cli_nombre').value.trim();
        const enlace = document.getElementById('cli_enlace').value.trim();
        const bravo = document.getElementById('cli_bravo').value.trim();
        const cobertura = document.getElementById('cli_cobertura').value.trim();
        const rol = document.getElementById('cli_rol').value.trim();
        const direccion = document.getElementById('cli_direccion').value.trim();
        const telefono = document.getElementById('cli_telefono').value.trim();
        const correo = document.getElementById('cli_correo').value.trim();
        const logo = document.getElementById('cli_logo_base64').value;
        const puestosList = getPostsFromForm();

        if (!nombre) return;
        const data = {
            id: currentClienteIndex >= 0 ? clientes[currentClienteIndex].id : 'CLI-' + Date.now(),
            nombre, enlace, bravo, cobertura, rol, puestosList,
            direccion, telefono, correo, logo, updatedAt: new Date().toISOString()
        };

        if (currentClienteIndex >= 0) clientes[currentClienteIndex] = data;
        else clientes.unshift(data);

        saveClientes();
        renderClientesView();
    };

    window.deleteCliente = function(index) {
        if (confirm('¿Eliminar cliente?')) {
            clientes.splice(index, 1);
            saveClientes();
            renderClientesView();
        }
    };

    window.toggleFlip = function(btn) {
        const card = btn.closest('.flip-card');
        if (card) card.classList.toggle('flipped');
    };

    function renderClientesList() {
        const area = document.getElementById('clientesContentArea');
        if (!area) return;

        if (clientes.length === 0) {
            area.innerHTML = '<div class="empty-dash-tactical">NO HAY CLIENTES REGISTRADOS</div>';
            return;
        }

        let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap:20px;">';
        clientes.forEach((c, idx) => {
            const postsCount = c.puestosList ? c.puestosList.length : 0;
            html += `
                <div class="flip-card">
                    <div class="flip-card-inner">
                        <div class="flip-card-front">
                            <div style="padding:20px; flex:1; display:flex; flex-direction:column; justify-content:space-between;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                    <div style="display:flex; gap:15px; align-items:center;">
                                        <div style="width:60px; height:60px; border-radius:10px; border:2px solid var(--gold); background:#fff; overflow:hidden; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                                            ${c.logo ? `<img src="${c.logo}" style="width:100%; height:100%; object-fit:contain;">` : `<i class="fas fa-building" style="font-size:30px; color:var(--gold);"></i>`}
                                        </div>
                                        <div>
                                            <div style="font-size:18px; font-weight:800; color:var(--navy); text-transform:uppercase;">${c.nombre}</div>
                                            <div style="display:flex; gap:10px; align-items:center;">
                                                <span style="font-size:11px; font-weight:700; color:var(--gold); letter-spacing:1px;">BRAVO: ${c.bravo || 'N/A'}</span>
                                                <span style="font-size:10px; color:var(--text-d);"><i class="fas fa-phone"></i> ${c.telefono || ''}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style="display:flex; gap:8px;">
                                        <button class="btn-icon blue-t" onclick="window.showClienteForm(${idx})" title="Editar"><i class="fas fa-edit"></i></button>
                                        <button class="btn-icon red-t" onclick="window.deleteCliente(${idx})" title="Eliminar"><i class="fas fa-trash"></i></button>
                                    </div>
                                </div>
                                <div style="background:rgba(13,23,47,0.03); border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:8px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <div style="display:flex; gap:15px; font-size:11px; color:var(--text-m); font-weight:600;">
                                            <span><i class="fas fa-user-tie" style="color:var(--gold);"></i> ${c.enlace || 'N/A'}</span>
                                            <span><i class="fas fa-map-location-dot" style="color:var(--gold);"></i> ${c.cobertura || 'N/A'}</span>
                                        </div>
                                        <button class="btn-ghost-sm" onclick="window.toggleFlip(this)" style="background:var(--navy); color:#fff; border:none; padding:4px 10px; font-size:10px; font-weight:800;">VER PUESTOS <i class="fas fa-arrow-rotate-y"></i></button>
                                    </div>
                                    <div style="font-size:10px; color:var(--text-d); border-top:1px solid rgba(0,0,0,0.05); padding-top:5px; display:flex; justify-content:space-between;">
                                        <span><i class="fas fa-map-pin"></i> ${c.direccion || 'Sin dirección registrada'}</span>
                                        <span><i class="fas fa-envelope"></i> ${c.correo || ''}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="flip-card-back">
                            <div style="font-size: 10px; font-weight: 800; color: var(--gold); text-transform: uppercase; margin-bottom: 12px; display: flex; justify-content: space-between; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <button class="btn-icon" onclick="window.toggleFlip(this)" style="padding:2px 6px; background:rgba(255,255,255,0.1); color:#fff; border:none;"><i class="fas fa-arrow-left"></i></button>
                                    <span><i class="fas fa-map-pin"></i> PUESTOS (${postsCount})</span>
                                </div>
                                <span style="color:rgba(255,255,255,0.6);">${c.rol || ''}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 8px; overflow-y:auto; padding-right:5px; flex:1;">
                                ${postsCount > 0 ? c.puestosList.map(p => `
                                    <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); border-left:3px solid var(--gold);">
                                        <div style="font-size:12px; font-weight:800;">${p.nombre}</div>
                                        <div style="font-size:10px; color:rgba(255,255,255,0.6);"><i class="fas fa-clock" style="color:var(--gold);"></i> ${p.horario}</div>
                                    </div>
                                `).join('') : '<div style="font-size:11px; color:rgba(255,255,255,0.4); text-align:center; padding:10px;">Sin detalles operativos.</div>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        area.innerHTML = `
            <div class="ds-header"><h2><i class="fas fa-list"></i> Directorio de Clientes</h2></div>
            ${html}
        `;
    }
})();
