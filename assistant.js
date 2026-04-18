/**
 * K-9 TACTICAL ASSISTANT
 * Maneja reconocimiento de voz, comandos tácticos y chatbot interactivo.
 */

'use strict';

(function() {
    let recognition;
    let isListening = false;
    let synth = window.speechSynthesis;
    
    // Configuración inicial de Reconocimiento de Voz
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'es-CR';
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            
            if (voiceActiveField) {
                // EXCLUSIVE DICTATION MODE
                const start = voiceActiveField.selectionStart;
                const end = voiceActiveField.selectionEnd;
                const text = voiceActiveField.value;
                voiceActiveField.value = text.substring(0, start) + transcript + " " + text.substring(end);
                voiceActiveField.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }

            processInput(transcript);
        };

        recognition.onend = () => {
            stopMicPulse();
        };

        recognition.onerror = (event) => {
            console.error('Error de voz:', event.error);
            stopMicPulse();
        };
    }

    // Interfaz
    window.toggleAssistant = function() {
        const win = document.getElementById('assistantWindow');
        const toggle = document.getElementById('assistantToggle');
        if (!win) return;
        
        const isOpen = win.classList.toggle('open');
        toggle.classList.toggle('active', isOpen);
        
        if (isOpen) {
            speak("Operador central listo. ¿Qué necesita agente?");
            document.getElementById('assistantInput').focus();
        }
    };

    window.toggleVoiceRecognition = function() {
        if (!recognition) {
            alert("Su navegador no soporta reconocimiento de voz.");
            return;
        }

        if (isListening) {
            recognition.stop();
        } else {
            startMicPulse();
            recognition.start();
        }
    };

    let currentActiveMicBtn = null;
    let voiceActiveField = null;

    function startMicPulse() {
        isListening = true;
        document.getElementById('assistantMic')?.classList.add('listening');
        if (currentActiveMicBtn) currentActiveMicBtn.classList.add('active');
    }

    function stopMicPulse() {
        isListening = false;
        document.getElementById('assistantMic')?.classList.remove('listening');
        if (currentActiveMicBtn) currentActiveMicBtn.classList.remove('active');
        currentActiveMicBtn = null;
        voiceActiveField = null;
    }

    window.activateVoiceField = function(id) {
        const field = document.getElementById(id);
        if (!field) return;
        
        // Determinar qué botón se clicó para el feedback visual
        const btn = field.parentNode.querySelector('.btn-field-mic-ui');
        currentActiveMicBtn = btn;
        voiceActiveField = field;

        field.focus();
        if (isListening) {
            recognition.stop();
        } else {
            window.toggleVoiceRecognition();
        }
    };

    window.sendAssistantMessage = function() {
        const input = document.getElementById('assistantInput');
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        input.value = '';
        processInput(text);
    };

    function addMessage(text, type) {
        const body = document.getElementById('assistantChatBody');
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg msg-${type}`;
        msgDiv.textContent = text;
        body.appendChild(msgDiv);
        body.scrollTop = body.scrollHeight;
    }

    function speak(text) {
        if (!synth) return;
        synth.cancel();
        
        const utter = new SpeechSynthesisUtterance(text);
        
        // Priorizar voces latinas (MX, US, AR, CL)
        const voices = synth.getVoices();
        const latinoVoice = voices.find(v => 
            v.lang.includes('MX') || 
            v.lang.includes('US') || 
            v.lang.includes('es-419') ||
            (v.lang.startsWith('es') && v.name.includes('Mexican'))
        );
        
        if (latinoVoice) {
            utter.voice = latinoVoice;
            utter.lang = latinoVoice.lang;
        } else {
            utter.lang = 'es-MX'; // Fallback a regional
        }
        
        utter.rate = 1.0;
        utter.pitch = 0.95; 
        
        synth.speak(utter);
    }

    /**
     * Lógica de Procesamiento de Comandos (NLP-Lite)
     */
    function processInput(text) {
        const input = text.toLowerCase();
        
        // Comandos de Consulta de Datos (Análisis de Riesgos)
        if (input.includes('analisis de') || input.includes('riesgo de') || input.includes('estatus de') || input.includes('consulta de')) {
            queryRiskData(input);
            return;
        }

        // Comandos de Navegación
        if (input.includes('riesgos') || input.includes('evaluación')) {
            respond("Cambiando a Módulo de Análisis de Riesgos. Acceso concedido.", () => switchModule('risks'));
        } 
 
        else if (input.includes('minutas') || input.includes('reunión')) {
            respond("Accediendo a Minutas de Reunión. Historial en pantalla.", () => switchModule('minutas'));
        }
        else if (input.includes('incidentes') || input.includes('investigación') || input.includes('sucesos')) {
            respond("Cambiando a Módulo de Informe de Incidentes e Investigaciones.", () => switchModule('incidentes'));
        }
        else if (input.includes('nuevo informe') || (input.includes('nuevo') && input.includes('suceso')) || (input.includes('crear') && input.includes('incidente'))) {
            if (window.createNewIncidente) {
                respond("Afirmativo. Iniciando nuevo Informe de Investigación. Adelante con el dictado del suceso.", () => {
                   switchModule('incidentes');
                   window.createNewIncidente();
                   // Wait for render and activate voice on the description field
                   setTimeout(() => {
                       window.activateVoiceField(`inc_desc`);
                   }, 500);
                });
            }
        }
        else if (input.includes('acuerdo nuevo') || (input.includes('nuevo') && input.includes('acuerdo'))) {
            if (window.addAcuerdo) {
                respond("Afirmativo. Generando nueva entrada de acuerdo. Adelante con el dictado.", () => {
                   window.addAcuerdo();
                   // Wait for render and activate voice on the new field
                   setTimeout(() => {
                       const m = window.getCurrentMinuta ? window.getCurrentMinuta() : null;
                       const lastIdx = (m && m.acuerdos) ? m.acuerdos.length - 1 : 0;
                       window.activateVoiceField(`m_acuerdo_${lastIdx}_detalle`);
                   }, 400);
                });
            }
        }
        else if (input.includes('inicio') || input.includes('dashboard') || input.includes('home')) {
            respond("Regresando al Centro de Operaciones Principal.", () => switchModule('home'));
        }
        
        // Comandos de Acción (Plan de Acción XIX o Auditoría Scored)
        else if (input.includes('responsable') || input.includes('acción') || input.includes('prioridad') || input.includes('estado') || input.includes('fecha') || input.includes('hallazgo')) {
            let activeEl = document.activeElement;
            // Si el foco está en el asistente o en el body, intentar encontrar el ítem abierto en el Plan de Acción
            let parentRow = (activeEl && !activeEl.classList.contains('chat-input') && activeEl.tagName !== 'BODY') 
                ? activeEl.closest('.action-item, tr') 
                : document.querySelector('.action-item.open') || document.querySelector('.action-item');
            
            if (parentRow) {
                let targetInput = null;
                let response = "Afirmativo. He registrado la información.";
                
                if (input.includes('responsable')) {
                    targetInput = parentRow.querySelector('[id*="responsable"]');
                    response = "Entendido, oficial responsable asignado.";
                } else if (input.includes('acción') || input.includes('correctiva')) {
                    targetInput = parentRow.querySelector('[id*="accion"], .corrective-text');
                    response = "Acción correctiva registrada en el reporte táctico.";
                } else if (input.includes('prioridad')) {
                    targetInput = parentRow.querySelector('[id*="prioridad"]');
                    response = "Nivel de prioridad actualizado.";
                    const val = input.includes('alta') ? 'alta' : input.includes('baja') ? 'baja' : 'media';
                    if (targetInput) targetInput.value = val;
                } else if (input.includes('estado')) {
                    targetInput = parentRow.querySelector('[id*="estado"]');
                    response = "Estado del ítem actualizado.";
                    const val = input.includes('completado') ? 'Completado' : input.includes('proceso') ? 'En Proceso' : 'Pendiente';
                    if (targetInput) targetInput.value = val;
                } else if (input.includes('fecha')) {
                    targetInput = parentRow.querySelector('[id*="fecha"]');
                    response = "Fecha límite establecida.";
                } else if (input.includes('hallazgo')) {
                    targetInput = parentRow.querySelector('[id*="hallazgo"]');
                    response = "Descripción del hallazgo actualizada.";
                }

                if (targetInput) {
                    if (!targetInput.tagName.includes('SELECT')) {
                        const cleanText = text.replace(/operador|asistente|responsable|acción|correctiva|fecha|prioridad|estado|hallazgo/gi, '').trim();
                        targetInput.value = (targetInput.value ? targetInput.value + ' ' : '') + cleanText;
                    }
                    // Trigger events for save
                    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                    targetInput.focus();
                }
                
                respond(response);
                return;
            }
            respond("Para dictar, por favor seleccione o abra primero el ítem que desea editar.");
        }
        else if (input.includes('nueva minuta') || input.includes('crear minuta')) {
            respond("Iniciando nueva acta de reunión. Prepare el dictado.", () => {
                switchModule('minutas');
                setTimeout(() => { if(window.newMinuta) window.newMinuta(); }, 500);
            });
        }


        // Dictado directamente en el campo activo
        else {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
                const prev = activeEl.value;
                activeEl.value = prev + (prev ? ' ' : '') + text;
                respond("Entendido. He registrado su dictado en el campo seleccionado.");
            } else {
                respond("Afirmativo. Operando en frecuencia. ¿Desea que navegue a algún módulo o dicte un registro?");
            }
        }
    }

    /**
     * Consulta la base de datos de riesgos
     */
    function queryRiskData(input) {
        const dbRaw = localStorage.getItem('patrimonial_evals');
        if (!dbRaw) {
            respond("Negativo. No detecto ninguna evaluación registrada en la base de datos operativa.");
            return;
        }

        const Database = JSON.parse(dbRaw);
        // Intentar extraer el nombre del sitio del input
        const keywords = ['analisis de', 'riesgo de', 'estatus de', 'consulta de', 'del sitio', 'de'];
        let searchQuery = input;
        keywords.forEach(k => searchQuery = searchQuery.replace(k, ''));
        searchQuery = searchQuery.trim();

        if (searchQuery.length < 3) {
            respond("Solicitud incompleta. Por favor especifique el nombre del sitio que desea consultar.");
            return;
        }

        const match = Database.find(ev => ev.s1.nombreSitio.toLowerCase().includes(searchQuery));

        if (match) {
            const score = match.score || 0;
            let cat = "CRÍTICO";
            if (score >= 90) cat = "EXCELENTE";
            else if (score >= 80) cat = "ACEPTABLE";
            else if (score >= 70) cat = "DEFICIENTE";

            respond(`Reporte de inteligencia para el sitio: ${match.s1.nombreSitio}. El nivel de cumplimiento patrimonial es del ${score}%, clasificado como ${cat}. ¿Desea que abra la evaluación completa?`, () => {
                // Opcional: Podría navegar al dashboard de riesgos y filtrar
                switchModule('risks');
            });
        } else {
            respond(`Negativo. No he encontrado registros para el sitio "${searchQuery}". Verifique el nombre o consulte el dashboard manual.`);
        }
    }

    function respond(text, callback) {
        addMessage(text, 'bot');
        speak(text);
        if (callback) callback();
    }

})();
