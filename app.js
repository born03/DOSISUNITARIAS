const URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbyGMTI1Ftbe-Tc26QQxHY8io7ySfZydiM_Z6bOcpk08o725zLAfJia22ScQBUPPHY8j_Q/exec";

let etiquetasPendientes = [];
let dbMedicamentos = [];
const NOMBRE_QUIMICO = "E. RICARDO L."; 

let currentTab = "DIARIA"; 
let currentServicio = "TODOS";
let bloqueoSincronizacion = false; 

const modal = document.getElementById('modalForm');
const form = document.getElementById('etiquetaForm');
const inputId = document.getElementById('etiquetaId');
const inputCama = document.getElementById('input_cama');
const inputNombre = document.getElementById('input_nombre');
const inputMed = document.getElementById('input_medicamento');
const inputDosis = document.getElementById('input_dosis');
const inputHorario = document.getElementById('input_horario');
const inputVolFinalManual = document.getElementById('input_volFinalManual');
const grupoVolManual = document.getElementById('grupoVolManual');
const syncIcon = document.getElementById('syncIcon');
const dbStatus = document.getElementById('dbStatus');
const btnGuardarDrive = document.getElementById('btnGuardar');

// CONTROL DE VISTAS
document.addEventListener('cambioTab', (e) => {
    currentTab = e.detail;
    document.getElementById('tabDiaria').className = currentTab === 'DIARIA' ? 'tab-btn active' : 'tab-btn';
    document.getElementById('tabPrn').className = currentTab === 'PRN' ? 'tab-btn active-prn' : 'tab-btn';
    currentServicio = "TODOS"; 
    btnGuardarDrive.style.display = (currentTab === "PRN") ? 'none' : 'flex';
    renderizarInterfaz();
});

document.addEventListener('cambioServicio', (e) => {
    currentServicio = e.detail;
    renderizarInterfaz();
});

document.getElementById('btnOpenModal').addEventListener('click', () => { 
    limpiarFormulario();
    document.getElementById('modalTitle').innerText = `Nueva Etiqueta (${currentTab})`;
    document.getElementById('btnSubmitForm').innerText = `AGREGAR A ${currentTab}`;
    grupoVolManual.style.display = 'none'; 
    modal.style.display = 'flex'; 
    inputCama.focus();
});

inputCama.addEventListener('input', () => {
    const paciente = etiquetasPendientes.find(e => String(e.CAMA) === String(inputCama.value));
    inputNombre.value = paciente ? paciente.NOMBRE : ''; 
});

// MOTOR DE CARGA Y SINCRONIZACIÓN
async function fetchSyncRealTime() {
    if (bloqueoSincronizacion || modal.style.display === 'flex') return; 
    try {
        const response = await fetch(URL_APPS_SCRIPT);
        const data = await response.json();
        dbMedicamentos = data.medicamentos || [];
        const datosNube = data.activas || [];
        
        // REPARACIÓN: Poblar lista de medicamentos
        const dataList = document.getElementById('listaMedicamentos');
        if(dataList.options.length === 0) {
            dbMedicamentos.forEach(med => {
                let opt = document.createElement('option');
                opt.value = med.MEDICAMENTO;
                dataList.appendChild(opt);
            });
        }

        if(JSON.stringify(datosNube) !== JSON.stringify(etiquetasPendientes)) {
            etiquetasPendientes = datosNube;
            renderizarInterfaz(); 
        }
        dbStatus.innerText = "Sincronizado";
    } catch (error) { dbStatus.innerText = "Offline"; }
}
fetchSyncRealTime().then(() => { setInterval(fetchSyncRealTime, 4000); });

async function pushToNube() {
    bloqueoSincronizacion = true; 
    try {
        dbStatus.innerText = "Guardando...";
        syncIcon.style.display = 'inline-block';
        await fetch(URL_APPS_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({ action: "SYNC", datos: etiquetasPendientes }),
            mode: 'no-cors', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        dbStatus.innerText = "Sincronizado";
    } catch (e) { dbStatus.innerText = "Error"; }
    finally { syncIcon.style.display = 'none'; bloqueoSincronizacion = false; }
}

// LÓGICA MATEMÁTICA
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
    if (!presentacion || isNaN(presentacion) || Number(presentacion) === 0) return 0;
    let calculo = dosis / Number(presentacion);
    return calculo < 0.1 ? Math.round(calculo * 100) / 100.0 : Math.round(calculo * 10) / 10.0;
}
function calcularVolFinal(dosis, concentracion, diluyente) {
    if (!concentracion || isNaN(concentracion) || Number(concentracion) === 0) return 0;
    let division = dosis / Number(concentracion);
    if (!diluyente || String(diluyente).trim() === "") return division;
    if (division <= 1) return 1;
    if (division <= 3) return 3;
    return Math.ceil(division / 5.0) * 5;
}

// GUARDAR
form.addEventListener('submit', function(e) {
    e.preventDefault();
    const idActual = inputId.value;
    let nombreMedInput = inputMed.value.toUpperCase().trim();
    const configMed = dbMedicamentos.find(m => String(m.MEDICAMENTO).toUpperCase().startsWith(nombreMedInput) || String(m.MEDICAMENTO).toUpperCase().includes(nombreMedInput));
    
    if (configMed) nombreMedInput = configMed.MEDICAMENTO; 
    else return alert("Medicamento no encontrado.");

    const dosisVal = parseFloat(inputDosis.value);
    const volMed = calcularVolMed(dosisVal, configMed.PRESENTACION);
    const volFinalDef = inputVolFinalManual.value !== "" ? parseFloat(inputVolFinalManual.value) : calcularVolFinal(dosisVal, configMed.CONCENTRACION, configMed.DILUYENTE);

    const etiquetaObj = {
        id: idActual || (Date.now().toString(36) + Math.random().toString(36).substr(2)), 
        TIPO: currentTab, CAMA: inputCama.value, NOMBRE: inputNombre.value.toUpperCase(), MEDICAMENTO: nombreMedInput, DOSIS: dosisVal, HORARIO: inputHorario.value.toUpperCase(),
        SERVICIO: calcularServicio(inputCama.value), "VOL MED": volMed, "VOL FINAL": volFinalDef,
        SOLUCION: configMed.DILUYENTE || "", TIEMPO: configMed.TIEMPO || "", UNIDADES: configMed.UNIDADES || "MG", VIA: configMed.VIA || "IV", fecha_registro: new Date().toISOString()
    };

    if (idActual) {
        const idx = etiquetasPendientes.findIndex(e => e.id === idActual);
        if (idx > -1) etiquetasPendientes[idx] = etiquetaObj;
        modal.style.display = 'none'; 
    } else {
        etiquetasPendientes.push(etiquetaObj);
        inputMed.value = ''; inputDosis.value = ''; inputHorario.value = ''; inputMed.focus(); 
    }
    renderizarInterfaz(); pushToNube(); 
});

function limpiarFormulario() {
    inputId.value = ''; inputCama.value = ''; inputNombre.value = '';
    inputMed.value = ''; inputDosis.value = ''; inputHorario.value = ''; inputVolFinalManual.value = '';
}

document.getElementById('listaPacientes').addEventListener('click', (e) => {
    const btnEdit = e.target.closest('.btn-edit');
    const btnSwap = e.target.closest('.btn-swap');
    if (btnEdit) {
        const etiq = etiquetasPendientes.find(et => et.id === btnEdit.dataset.id);
        if (etiq) {
            inputId.value = etiq.id; inputCama.value = etiq.CAMA; inputNombre.value = etiq.NOMBRE;
            inputMed.value = etiq.MEDICAMENTO; inputDosis.value = etiq.DOSIS; inputHorario.value = etiq.HORARIO;
            grupoVolManual.style.display = 'block'; modal.style.display = 'flex';
        }
    }
    if (btnSwap) {
        const idx = etiquetasPendientes.findIndex(et => et.id === btnSwap.dataset.id);
        if (idx > -1) { etiquetasPendientes[idx].TIPO = etiquetasPendientes[idx].TIPO === "DIARIA" ? "PRN" : "DIARIA"; renderizarInterfaz(); pushToNube(); }
    }
});

document.getElementById('btnEliminarSeleccionados').addEventListener('click', () => {
    const boxes = document.querySelectorAll('.med-checkbox:checked');
    if(boxes.length === 0 || !confirm("¿Eliminar seleccionados?")) return;
    const ids = Array.from(boxes).map(cb => cb.dataset.id);
    etiquetasPendientes = etiquetasPendientes.filter(e => !ids.includes(e.id));
    renderizarInterfaz(); pushToNube();
});

function renderizarInterfaz() {
    const panelSrv = document.getElementById('listaServicios');
    const panelPac = document.getElementById('listaPacientes');
    const listaPestana = etiquetasPendientes.filter(e => (e.TIPO || "DIARIA") === currentTab);

    if (listaPestana.length === 0) {
        panelSrv.innerHTML = ''; panelPac.innerHTML = '<div class="empty-state">No hay etiquetas aquí</div>'; return;
    }

    const conteoSrv = {};
    listaPestana.forEach(e => conteoSrv[e.SERVICIO] = (conteoSrv[e.SERVICIO] || 0) + 1);

    panelSrv.innerHTML = `<div class="servicio-item ${currentServicio === 'TODOS' ? 'active' : ''}" onclick="cambiarServicio('TODOS')">TODOS <span class="badge">${listaPestana.length}</span></div>` +
        Object.keys(conteoSrv).sort().map(s => `<div class="servicio-item ${currentServicio === s ? 'active' : ''}" onclick="cambiarServicio('${s}')">${s} <span class="badge">${conteoSrv[s]}</span></div>`).join('');

    const finalData = currentServicio === 'TODOS' ? listaPestana : listaPestana.filter(e => e.SERVICIO === currentServicio);
    const grupos = {};
    finalData.forEach(e => {
        const key = `Cama ${e.CAMA} - ${e.NOMBRE}`;
        if (!grupos[key]) grupos[key] = []; grupos[key].push(e);
    });

    panelPac.innerHTML = Object.keys(grupos).sort().map(p => `
        <div class="grupo-paciente">
            <div class="header-paciente ${currentTab === 'PRN' ? 'header-prn' : ''}"><i class="material-icons">hotel</i> ${p}</div>
            <div class="table-responsive"><table class="med-table">
                <tr><th></th><th>MEDICAMENTO</th><th>DOSIS</th><th>HORA</th><th>VF</th><th></th></tr>
                ${grupos[p].map(m => `
                    <tr>
                        <td><input type="checkbox" class="med-checkbox" data-id="${m.id}"></td>
                        <td class="med-name">${m.MEDICAMENTO} <span style="font-size:10px; color:#9aa0a6;">(${m.VIA})</span></td>
                        <td>${m.DOSIS} <span style="font-size:10px;">${m.UNIDADES}</span></td>
                        <td>${m.HORARIO}</td><td>${m['VOL FINAL'] || '0'}ml</td>
                        <td class="actions-cell">
                            <button class="btn-swap" data-id="${m.id}"><i class="material-icons" style="font-size:18px;">${currentTab === "DIARIA" ? 'arrow_forward' : 'arrow_back'}</i></button>
                            <button class="btn-edit" data-id="${m.id}"><i class="material-icons" style="font-size:18px;">edit</i></button>
                        </td>
                    </tr>`).join('')}
            </table></div>
        </div>`).join('');
}

// --- LÓGICA CALCULADORA (SUMINISTROS) ---
document.getElementById('btnSuministros').addEventListener('click', () => {
    const data = etiquetasPendientes.filter(e => e.TIPO === currentTab);
    if(data.length === 0) return alert("No hay datos en esta pestaña.");

    const consolidado = {};
    const jeringas = { "JERINGA DE INSULINA": 0, "JERINGA DE 3 ML": 0, "JERINGA DE 5 ML": 0, "JERINGA DE 10 ML": 0, "JERINGA DE 20 ML": 0 };
    const keywordsSC = ['ERITROPOYETINA', 'FILGRASTIM', 'PEG-FILGRASTIM', 'ENOXAPARINA'];

    data.forEach(e => {
        consolidado[e.MEDICAMENTO] = (consolidado[e.MEDICAMENTO] || 0) + e.DOSIS;
        const esSC = keywordsSC.some(k => e.MEDICAMENTO.includes(k));
        const vMed = parseFloat(e["VOL MED"]) || 0;
        const vFinal = parseFloat(e["VOL FINAL"]) || 0;

        if (esSC && vFinal <= 1.0 && vFinal > 0) { jeringas["JERINGA DE INSULINA"]++; } 
        else {
            if (vMed === 0 && vFinal >= 30) { jeringas["JERINGA DE 20 ML"]++; } 
            else {
                let vRef = (vFinal <= 10) ? vFinal : (vMed > 0 ? vMed : vFinal);
                let res = vRef;
                while (res > 20) { jeringas["JERINGA DE 20 ML"]++; res -= 20; }
                if (res > 10) jeringas["JERINGA DE 20 ML"]++;
                else if (res > 5) jeringas["JERINGA DE 10 ML"]++;
                else if (res > 3) jeringas["JERINGA DE 5 ML"]++;
                else if (res > 0) jeringas["JERINGA DE 3 ML"]++;
            }
        }
    });

    const hoy = new Date();
    const fechaStr = `${hoy.getDate()}-${hoy.getMonth()+1}-${hoy.getFullYear()} ${hoy.getHours()}:${hoy.getMinutes()}`;
    
    let html = `<h2>REPORTE DE SUMINISTROS - ${currentTab}</h2><h3>FECHA: ${fechaStr}</h3>`;
    html += `<table class="supply-table"><tr><th>MEDICAMENTO</th><th>TOTAL REQUERIDO</th></tr>`;
    Object.keys(consolidado).sort().forEach(m => html += `<tr><td>${m}</td><td><b>${Math.round(consolidado[m] * 100) / 100}</b></td></tr>`);
    html += `</table>`;
    html += `<h2>JERINGAS NECESARIAS</h2><table class="supply-table"><tr><th>TIPO</th><th>CANTIDAD (Piezas)</th></tr>`;
    for(let t in jeringas) if(jeringas[t] > 0) html += `<tr><td>${t}</td><td><b>${jeringas[t]}</b></td></tr>`;
    html += `</table>`;

    document.getElementById('printSupplies').innerHTML = html;
    window.print();
});

// IMPRIMIR ETIQUETAS
document.getElementById('btnImprimir').addEventListener('click', () => {
    const data = etiquetasPendientes.filter(e => (e.TIPO || "DIARIA") === currentTab && (currentServicio === "TODOS" || e.SERVICIO === currentServicio));
    if (data.length === 0) return alert("Sin datos.");
    
    const hoy = new Date();
    const fechaStr = `${hoy.getDate()}-${['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][hoy.getMonth()]}-${hoy.getFullYear().toString().slice(-2)}`;
    let tableHTML = '<table class="print-table">';
    for (let i = 0; i < data.length; i += 4) {
        tableHTML += '<tr>';
        for (let j = 0; j < 4; j++) {
            if (i + j < data.length) {
                let etiq = data[i+j];
                let vMedStr = (etiq["VOL MED"] && etiq["VOL MED"] != 0) ? ` - ${etiq["VOL MED"]}${etiq.SOLUCION ? " ML" : ""}` : "";
                tableHTML += `<td><div class="etiqueta-print">
                    <p class="bold">NOMBRE: ${etiq.NOMBRE}</p><p class="bold">SRV: ${etiq.SERVICIO} &nbsp; CAMA: ${etiq.CAMA}</p>
                    <p>FECHA: ${fechaStr} &nbsp; ${NOMBRE_QUIMICO}</p>
                    <p class="bold">${etiq.MEDICAMENTO} ${etiq.DOSIS}${etiq.UNIDADES}${vMedStr} ${etiq.VIA} ${etiq.TIEMPO ? "P/"+etiq.TIEMPO : ""}</p>
                    <p>${etiq.SOLUCION || ""}</p>
                    <p class="bold">VOL. FINAL: ${etiq['VOL FINAL'] || ''} ML &nbsp; HR: ${etiq.HORARIO || ""}</p>
                </div></td>`;
            } else tableHTML += '<td></td>';
        }
        tableHTML += '</tr>';
    }
    document.getElementById('printGrid').innerHTML = tableHTML + '</table>';
    window.print();
});

// DRIVE
document.getElementById('btnGuardar').addEventListener('click', async () => {
    const data = etiquetasPendientes.filter(e => (e.TIPO || "DIARIA") === currentTab && (currentServicio === "TODOS" || e.SERVICIO === currentServicio));
    if (data.length === 0) return;
    document.getElementById('btnGuardar').innerText = "GENERANDO...";
    await fetch(URL_APPS_SCRIPT, { method: 'POST', body: JSON.stringify({ action: "DOC", datos: data }), mode: 'no-cors' });
    alert("Enviado a Drive.");
    document.getElementById('btnGuardar').innerHTML = '<i class="material-icons">cloud_upload</i> DRIVE';
});
