'use strict';

(function () {
    const KEY = 'k9_calendario';
    let events = [];
    let currentYear  = new Date().getFullYear();
    let currentMonth = new Date().getMonth(); // 0-indexed
    let selectedDate = null;
    let editingId    = null;

    const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const DAYS   = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

    const EVENT_TYPES = {
        'reunion':    { label: 'Reunión',          color: '#3b82f6', icon: 'fa-users' },
        'visita':     { label: 'Visita de Campo',  color: '#22c55e', icon: 'fa-map-marker-alt' },
        'capacitacion':{ label: 'Capacitación',    color: '#a855f7', icon: 'fa-graduation-cap' },
        'seguimiento':{ label: 'Seguimiento',      color: '#f59e0b', icon: 'fa-clipboard-check' },
        'urgente':    { label: 'Urgente',          color: '#ef4444', icon: 'fa-triangle-exclamation' },
        'otro':       { label: 'Otro',             color: '#64748b', icon: 'fa-calendar' }
    };

    function load() {
        try { events = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e) { events = []; }
    }
    function save() { localStorage.setItem(KEY, JSON.stringify(events)); }
    function uid()  { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

    // ── INIT ─────────────────────────────────────────────────────
    window.initCalendario = function () {
        load();
        render();
    };

    // ── MAIN RENDER ───────────────────────────────────────────────
    function render() {
        const container = document.getElementById('viewCalendario');
        if (!container) return;

        container.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">

          <!-- HEADER BANNER -->
          <div style="background:linear-gradient(135deg,#060C1A 0%,#0a1628 60%,#091220 100%);padding:32px 44px 28px;border-bottom:2px solid #c8951a;flex-shrink:0;position:relative;overflow:hidden;">
            <div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.01) 3px,rgba(255,255,255,0.01) 4px);pointer-events:none;"></div>
            <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;">
              <div>
                <div style="font-size:10px;font-weight:800;letter-spacing:0.18em;color:#00C8B4;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                  <span style="width:24px;height:2px;background:#00C8B4;border-radius:2px;display:inline-block;"></span>
                  CORPORACIÓN K-9 · AGENDA OPERATIVA
                </div>
                <h1 style="font-family:'Outfit',sans-serif;font-size:34px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">
                  Calendario <span style="color:#c8951a;text-shadow:0 0 24px rgba(200,149,26,0.4);">Táctico</span>
                </h1>
                <p style="font-size:12px;color:rgba(255,255,255,0.45);font-weight:500;">Gestión de reuniones, visitas y compromisos operativos.</p>
              </div>
              <button onclick="window.calOpenModal()" style="background:linear-gradient(135deg,#c8951a,#e8b020);color:#fff;border:none;padding:13px 28px;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:10px;letter-spacing:0.05em;box-shadow:0 4px 16px rgba(200,149,26,0.35);transition:all 0.2s;"
                onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
                <i class="fas fa-plus"></i> NUEVO EVENTO
              </button>
            </div>
          </div>

          <!-- CALENDAR BODY -->
          <div style="display:flex;flex:1;overflow:hidden;">

            <!-- MAIN CALENDAR -->
            <div style="flex:1;overflow-y:auto;padding:28px 32px;">

              <!-- NAV -->
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
                <div style="display:flex;align-items:center;gap:16px;">
                  <button onclick="window.calPrev()" style="background:var(--card);border:1.5px solid var(--border);color:var(--text);width:36px;height:36px;border-radius:8px;cursor:pointer;font-size:14px;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
                    <i class="fas fa-chevron-left"></i>
                  </button>
                  <h2 style="font-family:'Outfit',sans-serif;font-size:22px;font-weight:900;color:var(--text);min-width:200px;text-align:center;">${MONTHS[currentMonth]} ${currentYear}</h2>
                  <button onclick="window.calNext()" style="background:var(--card);border:1.5px solid var(--border);color:var(--text);width:36px;height:36px;border-radius:8px;cursor:pointer;font-size:14px;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
                    <i class="fas fa-chevron-right"></i>
                  </button>
                </div>
                <button onclick="window.calToday()" style="background:var(--card);border:1.5px solid var(--border);color:var(--text-m);padding:7px 18px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
                  Hoy
                </button>
              </div>

              <!-- GRID -->
              <div style="background:var(--card);border:1.5px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:var(--shadow);">
                <!-- Day headers -->
                <div style="display:grid;grid-template-columns:repeat(7,1fr);background:var(--navy-d);">
                  ${DAYS.map(d => `<div style="padding:12px;text-align:center;font-size:10px;font-weight:800;color:rgba(255,255,255,0.5);letter-spacing:0.1em;text-transform:uppercase;">${d}</div>`).join('')}
                </div>
                <!-- Cells -->
                <div style="display:grid;grid-template-columns:repeat(7,1fr);">
                  ${buildCells()}
                </div>
              </div>

            </div>

            <!-- SIDEBAR: upcoming events -->
            <div style="width:280px;border-left:1.5px solid var(--border);overflow-y:auto;padding:24px 20px;flex-shrink:0;background:var(--card2);">
              <div style="font-size:11px;font-weight:800;color:var(--gold);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:18px;display:flex;align-items:center;gap:8px;">
                <i class="fas fa-calendar-week"></i> Próximos Eventos
              </div>
              ${buildUpcoming()}
            </div>

          </div>
        </div>

        <!-- MODAL -->
        <div id="cal-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9000;align-items:center;justify-content:center;" onclick="if(event.target===this)window.calCloseModal()">
          <div style="background:var(--card);border-radius:18px;width:480px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
            <div style="background:linear-gradient(135deg,#060C1A,#0a1628);padding:22px 28px;border-radius:18px 18px 0 0;border-bottom:2px solid #c8951a;display:flex;align-items:center;justify-content:space-between;">
              <h3 id="cal-modal-title" style="color:#fff;font-family:'Outfit',sans-serif;font-weight:900;font-size:18px;"><i class="fas fa-calendar-plus" style="color:#c8951a;margin-right:10px;"></i>Nuevo Evento</h3>
              <button onclick="window.calCloseModal()" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:20px;cursor:pointer;"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding:28px;">
              <div style="margin-bottom:18px;">
                <label style="font-size:10px;font-weight:800;color:var(--text-m);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:6px;">Título del Evento *</label>
                <input id="cal-title" placeholder="Ej: Reunión con cliente Holcim" style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;color:var(--text);background:var(--bg);outline:none;" onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'">
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
                <div>
                  <label style="font-size:10px;font-weight:800;color:var(--text-m);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:6px;">Fecha *</label>
                  <input id="cal-date" type="date" style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;color:var(--text);background:var(--bg);outline:none;" onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'">
                </div>
                <div>
                  <label style="font-size:10px;font-weight:800;color:var(--text-m);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:6px;">Hora</label>
                  <input id="cal-time" type="time" value="09:00" style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;color:var(--text);background:var(--bg);outline:none;" onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'">
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
                <div>
                  <label style="font-size:10px;font-weight:800;color:var(--text-m);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:6px;">Tipo</label>
                  <select id="cal-type" style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;color:var(--text);background:var(--bg);outline:none;" onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'">
                    ${Object.entries(EVENT_TYPES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="font-size:10px;font-weight:800;color:var(--text-m);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:6px;">Duración</label>
                  <select id="cal-duration" style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;color:var(--text);background:var(--bg);outline:none;">
                    <option value="30">30 min</option>
                    <option value="60" selected>1 hora</option>
                    <option value="90">1.5 horas</option>
                    <option value="120">2 horas</option>
                    <option value="180">3 horas</option>
                    <option value="0">Todo el día</option>
                  </select>
                </div>
              </div>
              <div style="margin-bottom:18px;">
                <label style="font-size:10px;font-weight:800;color:var(--text-m);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:6px;">Ubicación / Enlace</label>
                <input id="cal-location" placeholder="Ej: Oficinas centrales / Meet link..." style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;color:var(--text);background:var(--bg);outline:none;" onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'">
              </div>
              <div style="margin-bottom:18px;">
                <label style="font-size:10px;font-weight:800;color:var(--text-m);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:6px;">Participantes</label>
                <input id="cal-attendees" placeholder="Ej: Juan Pérez, Ana López..." style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;color:var(--text);background:var(--bg);outline:none;" onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'">
              </div>
              <div style="margin-bottom:24px;">
                <label style="font-size:10px;font-weight:800;color:var(--text-m);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:6px;">Notas / Agenda</label>
                <textarea id="cal-notes" rows="3" placeholder="Temas a tratar, objetivos de la reunión..." style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;color:var(--text);background:var(--bg);outline:none;resize:vertical;" onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border)'"></textarea>
              </div>
              <div style="display:flex;gap:12px;">
                <button onclick="window.calCloseModal()" style="flex:1;padding:12px;border:1.5px solid var(--border);background:var(--bg);color:var(--text-m);border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">Cancelar</button>
                <button onclick="window.calSaveEvent()" style="flex:2;padding:12px;background:linear-gradient(135deg,#c8951a,#e8b020);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:800;font-size:13px;letter-spacing:0.05em;">
                  <i class="fas fa-save"></i> GUARDAR EVENTO
                </button>
              </div>
            </div>
          </div>
        </div>`;
    }

    // ── BUILD CALENDAR CELLS ──────────────────────────────────────
    function buildCells() {
        const today = new Date();
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const daysInPrev  = new Date(currentYear, currentMonth, 0).getDate();

        let cells = '';
        let total = 0;

        // prev month padding
        for (let i = firstDay - 1; i >= 0; i--) {
            cells += cell(daysInPrev - i, true, false, []);
            total++;
        }

        // current month
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayEvents = events.filter(e => e.date === dateStr);
            const isToday = d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
            cells += cell(d, false, isToday, dayEvents, dateStr);
            total++;
        }

        // next month padding
        const remaining = 42 - total;
        for (let d = 1; d <= remaining; d++) {
            cells += cell(d, true, false, []);
        }

        return cells;
    }

    function cell(day, faded, isToday, dayEvents, dateStr) {
        const border = isToday ? 'border:2px solid var(--gold);' : 'border-right:1px solid var(--border);border-bottom:1px solid var(--border);';
        const bg     = isToday ? 'background:rgba(200,149,26,0.06);' : '';
        const dayColor = faded ? 'color:var(--text-d);' : isToday ? 'color:var(--gold);font-weight:900;' : 'color:var(--text);font-weight:700;';
        const click  = dateStr ? `onclick="window.calOpenModal('${dateStr}')"` : '';

        const pills = dayEvents.slice(0,3).map(ev => {
            const t = EVENT_TYPES[ev.type] || EVENT_TYPES.otro;
            return `<div style="background:${t.color};color:#fff;font-size:8.5px;font-weight:700;padding:2px 7px;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;margin-top:2px;"
                        onclick="event.stopPropagation();window.calViewEvent('${ev.id}')" title="${ev.title}">${ev.time ? ev.time+' ' : ''}${ev.title}</div>`;
        }).join('');

        const more = dayEvents.length > 3 ? `<div style="font-size:8px;color:var(--text-d);font-weight:700;margin-top:2px;">+${dayEvents.length-3} más</div>` : '';

        return `<div style="min-height:90px;padding:8px;${border}${bg}cursor:${dateStr?'pointer':'default'};transition:background 0.15s;position:relative;"
                    ${click} onmouseover="if(!${isToday})this.style.background='var(--bg2)'" onmouseout="if(!${isToday})this.style.background=''">
                    <div style="font-size:13px;${dayColor}margin-bottom:4px;">${day}</div>
                    ${pills}${more}
                </div>`;
    }

    // ── UPCOMING SIDEBAR ──────────────────────────────────────────
    function buildUpcoming() {
        const today = new Date().toISOString().split('T')[0];
        const upcoming = events.filter(e => e.date >= today).sort((a,b) => (a.date+a.time) < (b.date+b.time) ? -1 : 1).slice(0, 12);
        if (!upcoming.length) return `<div style="text-align:center;padding:30px 10px;opacity:0.4;"><i class="fas fa-calendar-xmark" style="font-size:28px;display:block;margin-bottom:10px;"></i>Sin eventos próximos</div>`;

        return upcoming.map(ev => {
            const t = EVENT_TYPES[ev.type] || EVENT_TYPES.otro;
            const d = new Date(ev.date + 'T12:00:00');
            const dateStr = d.toLocaleDateString('es-CR',{weekday:'short',month:'short',day:'numeric'});
            return `<div style="background:var(--card);border:1px solid var(--border);border-left:4px solid ${t.color};border-radius:8px;padding:12px;margin-bottom:10px;cursor:pointer;transition:all 0.2s;"
                        onclick="window.calViewEvent('${ev.id}')"
                        onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform=''">
                        <div style="font-size:9px;font-weight:800;color:${t.color};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;"><i class="fas ${t.icon}"></i> ${t.label}</div>
                        <div style="font-size:12px;font-weight:700;color:var(--text);line-height:1.3;margin-bottom:5px;">${ev.title}</div>
                        <div style="font-size:10px;color:var(--text-m);">${dateStr}${ev.time ? ' · ' + ev.time : ''}</div>
                        ${ev.location ? `<div style="font-size:10px;color:var(--text-d);margin-top:3px;"><i class="fas fa-location-dot"></i> ${ev.location}</div>` : ''}
                    </div>`;
        }).join('');
    }

    // ── NAVIGATION ────────────────────────────────────────────────
    window.calPrev  = function () { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } render(); };
    window.calNext  = function () { currentMonth++; if (currentMonth > 11) { currentMonth = 0;  currentYear++; } render(); };
    window.calToday = function () { currentYear = new Date().getFullYear(); currentMonth = new Date().getMonth(); render(); };

    // ── MODAL OPEN ────────────────────────────────────────────────
    window.calOpenModal = function (dateStr) {
        editingId = null;
        const modal = document.getElementById('cal-modal');
        if (!modal) return;
        document.getElementById('cal-title').value    = '';
        document.getElementById('cal-date').value     = dateStr || new Date().toISOString().split('T')[0];
        document.getElementById('cal-time').value     = '09:00';
        document.getElementById('cal-type').value     = 'reunion';
        document.getElementById('cal-duration').value = '60';
        document.getElementById('cal-location').value = '';
        document.getElementById('cal-attendees').value= '';
        document.getElementById('cal-notes').value    = '';
        document.getElementById('cal-modal-title').innerHTML = '<i class="fas fa-calendar-plus" style="color:#c8951a;margin-right:10px;"></i>Nuevo Evento';
        modal.style.display = 'flex';
    };

    window.calCloseModal = function () {
        const modal = document.getElementById('cal-modal');
        if (modal) modal.style.display = 'none';
    };

    // ── SAVE EVENT ────────────────────────────────────────────────
    window.calSaveEvent = function () {
        const title = document.getElementById('cal-title').value.trim();
        const date  = document.getElementById('cal-date').value;
        if (!title || !date) { alert('Título y fecha son obligatorios.'); return; }

        const ev = {
            id:        editingId || uid(),
            title,
            date,
            time:      document.getElementById('cal-time').value,
            type:      document.getElementById('cal-type').value,
            duration:  document.getElementById('cal-duration').value,
            location:  document.getElementById('cal-location').value.trim(),
            attendees: document.getElementById('cal-attendees').value.trim(),
            notes:     document.getElementById('cal-notes').value.trim(),
            createdAt: new Date().toISOString()
        };

        if (editingId) {
            const idx = events.findIndex(e => e.id === editingId);
            if (idx >= 0) events[idx] = ev;
        } else {
            events.push(ev);
        }
        save();
        window.calCloseModal();
        // navigate to event's month
        const d = new Date(date + 'T12:00:00');
        currentYear  = d.getFullYear();
        currentMonth = d.getMonth();
        render();
        if (window.showToast) window.showToast('Evento guardado.', 'success');
    };

    // ── VIEW / EDIT EVENT ─────────────────────────────────────────
    window.calViewEvent = function (id) {
        const ev = events.find(e => e.id === id);
        if (!ev) return;
        editingId = id;
        const t = EVENT_TYPES[ev.type] || EVENT_TYPES.otro;
        const modal = document.getElementById('cal-modal');
        if (!modal) return;
        document.getElementById('cal-modal-title').innerHTML = `<i class="fas ${t.icon}" style="color:${t.color};margin-right:10px;"></i>${ev.title}`;
        document.getElementById('cal-title').value    = ev.title;
        document.getElementById('cal-date').value     = ev.date;
        document.getElementById('cal-time').value     = ev.time || '09:00';
        document.getElementById('cal-type').value     = ev.type || 'reunion';
        document.getElementById('cal-duration').value = ev.duration || '60';
        document.getElementById('cal-location').value = ev.location || '';
        document.getElementById('cal-attendees').value= ev.attendees || '';
        document.getElementById('cal-notes').value    = ev.notes || '';

        // add delete button dynamically
        const footer = modal.querySelector('[onclick="window.calSaveEvent()"]').parentElement;
        if (!document.getElementById('cal-delete-btn')) {
            const del = document.createElement('button');
            del.id = 'cal-delete-btn';
            del.innerHTML = '<i class="fas fa-trash"></i>';
            del.style.cssText = 'padding:12px 16px;background:rgba(201,27,56,0.1);border:1.5px solid rgba(201,27,56,0.3);color:var(--critico);border-radius:8px;cursor:pointer;font-size:14px;';
            del.onclick = () => window.calDeleteEvent(id);
            footer.insertBefore(del, footer.firstChild);
        } else {
            document.getElementById('cal-delete-btn').onclick = () => window.calDeleteEvent(id);
        }
        modal.style.display = 'flex';
    };

    window.calDeleteEvent = function (id) {
        if (!confirm('¿Eliminar este evento?')) return;
        events = events.filter(e => e.id !== id);
        save();
        window.calCloseModal();
        render();
        if (window.showToast) window.showToast('Evento eliminado.', 'success');
    };

})();
