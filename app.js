const URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbyGMTI1Ftbe-Tc26QQxHY8io7ySfZydiM_Z6bOcpk08o725zLAfJia22ScQBUPPHY8j_Q/exec";

let etiquetasPendientes = [];
let dbMedicamentos = [];
const NOMBRE_QUIMICO = "E. RICARDO L."; 

// ESTADO DE LA VISTA
let currentTab = "DIARIA"; 
let currentServicio = "TODOS";

const modal = document.getElementById('modalForm');
const form = document.getElementById('etiquetaForm');
const inputId = document.getElementById('etiquetaId');
const inputCama = document.getElementById('cama');
const inputNombre = document.getElementById('nombre');
const inputMed = document.getElementById('medicamento');
const inputDosis = document.getElementById('dosis');
const inputHorario = document.getElementById('horario');
const inputVolFinalManual = document.getElementById('volFinalManual');
const grupoVolManual = document.getElementById('grupoVolManual');
const syncIcon = document.getElementById('syncIcon');
const dbStatus = document.getElementById('dbStatus');

// ESCUCHADORES DE PESTAÑAS Y SERVICIOS (Custom Events)
document.addEventListener('cambioTab', (e) => {
    currentTab = e.detail;
    document.getElementById('tabDiaria').className = currentTab === 'DIARIA' ? 'tab-btn active' : 'tab-btn';
    document.getElementById('tabPrn').className = currentTab === 'PRN' ? 'tab-btn active-prn' : 'tab-btn';
    currentServicio = "TODOS"; // Reiniciar filtro al cambiar de pestaña
    renderizarInterfaz();
});

document.addEventListener('cambioServicio', (e) => {
    currentServicio = e.detail;
    renderizarInterfaz();
});

document.getElementById('btnOpenModal').addEventListener('click', () => { 
    limpiarFormulario();
    document.getElementById('modalTitle').innerText = "Nueva Etiqueta";
    document.getElementById('btnSubmitForm').innerText = "AGREGAR A " + currentTab;
    grupoVolManual.style.display = 'none'; 
    modal.style.display = 'flex'; 
});
document.getElementById('btnCloseModal').addEventListener('click', () => modal.style.display = 'none');

inputCama.addEventListener('input', () => {
    const paciente = etiquetasPendientes.find(e => String(e.CAMA) === String(inputCama.value));
    inputNombre.value = paciente ? paciente.NOMBRE : ''; 
});

// MOTOR DE SINCRONIZACIÓN A 4 SEGUNDOS
let isSyncing = false;
async function fetchSyncRealTime() {
    if (isSyncing || modal.style.display === 'flex') return; 
    try {
        const response = await fetch(URL_APPS_SCRIPT);
        const data = await response.json();
        
        dbMedicamentos = data.medicamentos || [];
        const datosNube = data.activas || [];
        
        if(JSON.stringify(datosNube) !== JSON.stringify(etiquetasPendientes)) {
            etiquetasPendientes = datosNube;
            renderizarInterfaz(); 
        }
        dbStatus.innerText = "Sincronizado";
    } catch (error) {
        dbStatus.innerText = "Offline";
    }
}
fetchSyncRealTime().then(() => {
    setInterval(fetchSyncRealTime, 4000); // ACTUALIZACIÓN CADA 4 SEGUNDOS
});

async function pushToNube() {
    isSyncing = true;
    try {
        dbStatus.innerText = "Guardando...";
        syncIcon.style.display = 'inline-block';
        await fetch(URL_APPS_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({ action: "SYNC", datos: etiquetasPendientes }), // Siempre manda todo
            mode: 'no-cors', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        dbStatus.innerText = "Sincronizado";
    } catch (e) {
        dbStatus.innerText = "Pendiente...";
    } finally {
        syncIcon.style.display = 'none';
        isSyncing = false;
    }
}

function calcularServicio(cama) {
    const c = Number(cama);
    if (c >= 220 && c <= 245) return "ONCOLOGIA";
    if (c >= 501 && c <= 521) return "INFECTOLOGIA";
    if (c >= 522 && c <= 535) return "CIRUGIA";
    if (c >= 536 && c <= 542) return "GASTRO";
    if (c >= 543 && c <= 549) return "TRAUMATOLOGIA";
    if (c >= 550 && c <= 559) return "MED INT";
    return "URGENCIAS";
}
function calcularVolMed(dosis, presentacion) {
    let calculo = dosis / Number(presentacion);
    return calculo < 0.1 ? Math.round(calculo * 100) / 100.0 : Math.round(calculo * 10) / 10.0;
}
function calcularVolFinal(dosis, concentracion, diluyente) {
    let division = dosis / Number(concentracion);
    if (!diluyente || String(diluyente).trim() === "") return division;
    if (division <= 1) return 1;
    if (division <= 3) return 3;
    return Math.ceil(division / 5.0) * 5;
}

// GUARDAR / ACTUALIZAR
form.addEventListener('submit', function(e) {
    e.preventDefault();

    const idActual = inputId.value;
    const tipo = currentTab; // Siempre guarda en la pestaña actual
    const cama = inputCama.value;
    const nombre = inputNombre.value.toUpperCase();
    let nombreMedInput = inputMed.value.toUpperCase().trim();
    const dosis = parseFloat(inputDosis.value);
    const horario = inputHorario.value.toUpperCase() || "N/A"; // Si lo deja blanco, pone N/A
    const volFinalManualStr = inputVolFinalManual.value;

    let configMed = dbMedicamentos.find(m => String(m.MEDICAMENTO).toUpperCase() === nombreMedInput);
    if (!configMed) {
        configMed = dbMedicamentos.find(m => String(m.MEDICAMENTO).toUpperCase().startsWith(nombreMedInput));
        if (!configMed) configMed = dbMedicamentos.find(m => String(m.MEDICAMENTO).toUpperCase().includes(nombreMedInput));
        if (configMed) nombreMedInput = configMed.MEDICAMENTO; 
        else return alert("Medicamento no encontrado.");
    }

    const volFinalDefinitivo = volFinalManualStr !== "" ? parseFloat(volFinalManualStr) : calcularVolFinal(dosis, configMed.CONCENTRACION, configMed.DILUYENTE);

    const etiquetaObj = {
        id: idActual || (Date.now().toString(36) + Math.random().toString(36).substr(2)), 
        TIPO: tipo, CAMA: cama, NOMBRE: nombre, MEDICAMENTO: nombreMedInput, DOSIS: dosis, HORARIO: horario,
        SERVICIO: calcularServicio(cama), "VOL MED": calcularVolMed(dosis, configMed.PRESENTACION),
        "VOL FINAL": volFinalDefinitivo,
        SOLUCION: configMed.DILUYENTE || "", TIEMPO: configMed.TIEMPO || "",
        UNIDADES: configMed.UNIDADES || "MG", VIA: configMed.VIA || "IV",
        fecha_registro: new Date().toISOString()
    };

    if (idActual) {
        const index = etiquetasPendientes.findIndex(e => e.id === idActual);
        if (index > -1) {
            const camaVieja = etiquetasPendientes[index].CAMA;
            const nombreViejo = etiquetasPendientes[index].NOMBRE;
            etiquetasPendientes[index] = etiquetaObj;
            if (camaVieja !== cama || nombreViejo !== nombre) {
                etiquetasPendientes.forEach(e => {
                    if (e.CAMA === camaVieja && e.NOMBRE === nombreViejo) {
                        e.CAMA = cama; e.NOMBRE = nombre; e.SERVICIO = calcularServicio(cama);
                    }
                });
            }
        }
        modal.style.display = 'none'; 
    } else {
        etiquetasPendientes.push(etiquetaObj);
        inputMed.value = ''; inputDosis.value = ''; inputHorario.value = '';
        
        // Bloquear inputs temporalmente para resetear hack de móvil
        inputMed.setAttribute('readonly', true);
        inputDosis.setAttribute('readonly', true);
        inputHorario.setAttribute('readonly', true);
        
        inputMed.focus(); 
    }

    renderizarInterfaz(); 
    pushToNube(); 
});

function limpiarFormulario() {
    inputId.value = ''; inputCama.value = ''; inputNombre.value = '';
    inputMed.value = ''; inputDosis.value = ''; inputHorario.value = ''; inputVolFinalManual.value = '';
    // Restablecer el bloqueo de readonly para el hack
    document.querySelectorAll('#etiquetaForm input').forEach(i => i.setAttribute('readonly', true));
}

// DELEGACIÓN: EDITAR Y TRASLADAR
document.getElementById('listaPacientes').addEventListener('click', (e) => {
    const btnEdit = e.target.closest('.btn-edit');
    const btnSwap = e.target.closest('.btn-swap');

    if (btnEdit) {
        const idToEdit = btnEdit.dataset.id;
        const etiqueta = etiquetasPendientes.find(et => et.id === idToEdit);
        if (etiqueta) {
            inputId.value = etiqueta.id;
            inputCama.value = etiqueta.CAMA;
            inputNombre.value = etiqueta.NOMBRE;
            inputMed.value = etiqueta.MEDICAMENTO;
            inputDosis.value = etiqueta.DOSIS;
            inputHorario.value = etiqueta.HORARIO === "N/A" ? "" : etiqueta.HORARIO;
            
            const configMed = dbMedicamentos.find(m => String(m.MEDICAMENTO).toUpperCase() === etiqueta.MEDICAMENTO);
            const calcVol = configMed ? calcularVolFinal(etiqueta.DOSIS, configMed.CONCENTRACION, configMed.DILUYENTE) : "";
            inputVolFinalManual.value = (String(etiqueta["VOL FINAL"]) !== String(calcVol)) ? etiqueta["VOL FINAL"] : '';

            // Quitar el readonly al editar
            document.querySelectorAll('#etiquetaForm input').forEach(i => i.removeAttribute('readonly'));

            document.getElementById('modalTitle').innerText = "Editar Etiqueta";
            document.getElementById('btnSubmitForm').innerText = "ACTUALIZAR CAMBIOS";
            grupoVolManual.style.display = 'block'; 
            modal.style.display = 'flex';
        }
    }

    if (btnSwap) {
        const idToSwap = btnSwap.dataset.id;
        const index = etiquetasPendientes.findIndex(et => et.id === idToSwap);
        if (index > -1) {
            const nuevoTipo = etiquetasPendientes[index].TIPO === "DIARIA" ? "PRN" : "DIARIA";
            etiquetasPendientes[index].TIPO = nuevoTipo;
            renderizarInterfaz();
            pushToNube();
        }
    }
});

document.getElementById('btnEliminarSeleccionados').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.med-checkbox:checked');
    if(checkboxes.length === 0) return alert("Selecciona etiquetas con las casillas.");
    if(confirm(`¿Eliminar ${checkboxes.length} etiquetas?`)) {
        const idsToDelete = Array.from(checkboxes).map(cb => cb.dataset.id);
        etiquetasPendientes = etiquetasPendientes.filter(e => !idsToDelete.includes(e.id));
        renderizarInterfaz();
        pushToNube();
    }
});

function renderizarInterfaz() {
    const panelServicios = document.getElementById('listaServicios');
    const panelPacientes = document.getElementById('listaPacientes');
    
    // FILTRAR PRIMERO POR LA PESTAÑA ACTUAL
    const listaVisiblePestaña = etiquetasPendientes.filter(e => (e.TIPO || "DIARIA") === currentTab);

    if (listaVisiblePestaña.length === 0) {
        panelServicios.innerHTML = '<div style="color: #9aa0a6; text-align: center; margin-top: 20px;">Sin pacientes</div>';
        panelPacientes.innerHTML = '<div class="empty-state"><i class="material-icons" style="font-size: 48px; color: #dadce0;">assignment</i><br>No hay etiquetas aquí</div>';
        return;
    }

    // CONSTRUIR BARRA DE SERVICIOS (Basado solo en la pestaña actual)
    const conteoServicios = {};
    listaVisiblePestaña.forEach(etiq => {
        conteoServicios[etiq.SERVICIO] = (conteoServicios[etiq.SERVICIO] || 0) + 1;
    });

    let htmlServicios = `<div class="servicio-item ${currentServicio === 'TODOS' ? 'active' : ''}" onclick="cambiarServicio('TODOS')">
                            <span>TODOS</span> <span class="badge">${listaVisiblePestaña.length}</span>
                         </div>`;
                         
    Object.keys(conteoServicios).sort().forEach(srv => {
        const activeClass = currentServicio === srv ? 'active' : '';
        htmlServicios += `<div class="servicio-item ${activeClass}" onclick="cambiarServicio('${srv}')">
                            <span>${srv}</span> <span class="badge">${conteoServicios[srv]}</span>
                          </div>`;
    });
    panelServicios.innerHTML = htmlServicios;

    // FILTRAR POR SERVICIO SELECCIONADO PARA MOSTRAR PACIENTES
    const listaFinalVista = currentServicio === 'TODOS' ? listaVisiblePestaña : listaVisiblePestaña.filter(e => e.SERVICIO === currentServicio);

    if(listaFinalVista.length === 0) {
        panelPacientes.innerHTML = '<div class="empty-state">No hay pacientes en este servicio.</div>';
        return;
    }

    const gruposPacientes = {};
    listaFinalVista.forEach(etiq => {
        const llavePaciente = `Cama ${etiq.CAMA} - ${etiq.NOMBRE}`;
        if (!gruposPacientes[etiq.SERVICIO]) gruposPacientes[etiq.SERVICIO] = {};
        if (!gruposPacientes[etiq.SERVICIO][llavePaciente]) gruposPacientes[etiq.SERVICIO][llavePaciente] = [];
        gruposPacientes[etiq.SERVICIO][llavePaciente].push(etiq);
    });

    let htmlPacientes = '';
    const headerClass = currentTab === "PRN" ? "header-prn" : "";

    Object.keys(gruposPacientes).sort().forEach(servicio => {
        const pacientes = gruposPacientes[servicio];
        Object.keys(pacientes).sort().forEach(pacienteStr => {
            htmlPacientes += `<div class="grupo-paciente"><div class="header-paciente ${headerClass}"><i class="material-icons">hotel</i> ${pacienteStr} (${servicio})</div>`;
            htmlPacientes += `<div class="table-responsive"><table class="med-table">
                                <tr>
                                    <th style="width: 25px;"></th>
                                    <th>MEDICAMENTO</th>
                                    <th>DOSIS</th>
                                    <th>HORA</th>
                                    <th>VF</th>
                                    <th style="text-align: right;">ACCIONES</th>
                                </tr>`;
            
            pacientes[pacienteStr].forEach(med => {
                const iconSwap = currentTab === "DIARIA" ? "arrow_forward" : "arrow_back";
                const titleSwap = currentTab === "DIARIA" ? "Mover a PRN" : "Mover a DIARIA";

                htmlPacientes += `
                    <tr>
                        <td><input type="checkbox" class="med-checkbox" data-id="${med.id}"></td>
                        <td class="med-name">${med.MEDICAMENTO} <span style="font-size:10px; color:#9aa0a6;">(${med.VIA || 'IV'})</span></td>
                        <td>${med.DOSIS} <span style="font-size:11px; color:#5f6368;">${med.UNIDADES || "MG"}</span></td>
                        <td>${med.HORARIO}</td>
                        <td class="med-vol">${med['VOL FINAL']} ml</td>
                        <td class="actions-cell">
                            <button class="btn-swap" data-id="${med.id}" title="${titleSwap}"><i class="material-icons" style="font-size:18px;">${iconSwap}</i></button>
                            <button class="btn-edit" data-id="${med.id}" title="Editar"><i class="material-icons" style="font-size:18px;">edit</i></button>
                        </td>
                    </tr>`;
            });
            htmlPacientes += `</table></div></div>`;
        });
    });
    panelPacientes.innerHTML = htmlPacientes;
}

// OBTENER SOLO LA VISTA ACTUAL PARA IMPRIMIR/GUARDAR
function obtenerEtiquetasVista() {
    return etiquetasPendientes.filter(e => {
        const matchTab = (e.TIPO || "DIARIA") === currentTab;
        const matchSrv = currentServicio === 'TODOS' || e.SERVICIO === currentServicio;
        return matchTab && matchSrv;
    });
}

// IMPRIMIR NATIVO (SOLO LA VISTA ACTUAL)
document.getElementById('btnImprimir').addEventListener('click', () => {
    const aImprimir = obtenerEtiquetasVista();
    if (aImprimir.length === 0) return alert("No hay etiquetas en esta vista para imprimir.");
    
    const printGrid = document.getElementById('printGrid');
    const hoy = new Date();
    const fechaStr = `${hoy.getDate().toString().padStart(2, '0')}-${['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][hoy.getMonth()]}-${hoy.getFullYear().toString().slice(-2)}`;

    let tableHTML = '<table class="print-table">';
    for (let i = 0; i < aImprimir.length; i += 4) {
        tableHTML += '<tr>';
        for (let j = 0; j < 4; j++) {
            if (i + j < aImprimir.length) {
                let etiq = aImprimir[i + j];
                let tituloMed = etiq.TIPO === "PRN" ? `<span class="prn-mark">PRN</span> ${etiq.MEDICAMENTO}` : etiq.MEDICAMENTO;
                let textoVolumen = (etiq["VOL MED"] && String(etiq["VOL MED"]) !== "0") ? ` - ${etiq["VOL MED"]}${etiq.SOLUCION ? " ML" : ""}` : "";
                
                tableHTML += `
                <td>
                    <div class="etiqueta-print">
                        <p class="bold">NOMBRE: ${etiq.NOMBRE}</p>
                        <p class="bold">SERVICIO: ${etiq.SERVICIO} &nbsp;&nbsp; CAMA: ${etiq.CAMA}</p>
                        <p>FECHA: ${fechaStr} &nbsp;&nbsp; ${NOMBRE_QUIMICO}</p>
                        <p class="bold">${tituloMed} ${etiq.DOSIS} ${etiq.UNIDADES || "MG"}${textoVolumen} ${etiq.VIA || "IV"} ${etiq.TIEMPO ? " P/"+etiq.TIEMPO : ""}</p>
                        <p>${etiq.SOLUCION}</p>
                        <p class="bold">VOL. FINAL: ${etiq['VOL FINAL']} ML &nbsp;&nbsp; HR: ${etiq.HORARIO}</p>
                    </div>
                </td>`;
            } else {
                tableHTML += `<td></td>`;
            }
        }
        tableHTML += '</tr>';
    }
    tableHTML += '</table>';
    
    printGrid.innerHTML = tableHTML;
    window.print();
});

// GENERAR DOCUMENTO DRIVE (SOLO LA VISTA ACTUAL)
document.getElementById('btnGuardar').addEventListener('click', async () => {
    const aGuardar = obtenerEtiquetasVista();
    if (aGuardar.length === 0) return alert("No hay etiquetas en esta vista para generar el documento.");
    
    const btn = document.getElementById('btnGuardar');
    btn.innerHTML = '<i class="material-icons">sync</i> GENERANDO...';
    btn.disabled = true;

    try {
        await fetch(URL_APPS_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({ action: "DOC", datos: aGuardar }),
            mode: 'no-cors', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        alert(`Documento generado en Drive con las etiquetas de ${currentTab} ${currentServicio !== 'TODOS' ? '('+currentServicio+')' : ''}.`);
    } catch (e) {
        alert("Error al generar en Drive.");
    } finally {
        btn.innerHTML = '<i class="material-icons">cloud_upload</i> DRIVE VISTA';
        btn.disabled = false;
    }
});
