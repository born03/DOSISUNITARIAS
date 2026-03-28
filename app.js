import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAHHMG-hsYk1WRCn86K_Ot9WbjMX1Zf8xQ",
  authDomain: "dosishtml.firebaseapp.com",
  projectId: "dosishtml",
  storageBucket: "dosishtml.firebasestorage.app",
  messagingSenderId: "317130614255",
  appId: "1:317130614255:web:167de03096990415a1421a"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbyGMTI1Ftbe-Tc26QQxHY8io7ySfZydiM_Z6bOcpk08o725zLAfJia22ScQBUPPHY8j_Q/exec";

let etiquetasPendientes = JSON.parse(localStorage.getItem('etiquetasIV')) || [];
let dbMedicamentos = [];
const NOMBRE_QUIMICO = "E. RICARDO L."; 

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

document.getElementById('btnOpenModal').addEventListener('click', () => { 
    limpiarFormulario();
    document.getElementById('modalTitle').innerText = "Nueva Etiqueta (Usa ENTER)";
    document.getElementById('btnSubmitForm').innerText = "AGREGAR ETIQUETA";
    grupoVolManual.style.display = 'none'; 
    modal.style.display = 'flex'; 
    inputCama.focus(); 
});
document.getElementById('btnCloseModal').addEventListener('click', () => modal.style.display = 'none');

inputCama.addEventListener('input', () => {
    const paciente = etiquetasPendientes.find(e => String(e.CAMA) === String(inputCama.value));
    inputNombre.value = paciente ? paciente.NOMBRE : ''; 
});

async function cargarMedicamentos() {
    try {
        const response = await fetch(URL_APPS_SCRIPT);
        dbMedicamentos = await response.json();
        const dataList = document.getElementById('listaMedicamentos');
        dataList.innerHTML = '';
        dbMedicamentos.forEach(med => {
            let option = document.createElement('option');
            option.value = med.MEDICAMENTO; 
            dataList.appendChild(option);
        });
        document.getElementById('dbStatus').innerText = "Base lista";
        renderizarInterfaz(); 
    } catch (error) {
        document.getElementById('dbStatus').innerText = "Modo Offline";
        renderizarInterfaz();
    }
}
cargarMedicamentos();

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
    const cama = inputCama.value;
    const nombre = inputNombre.value.toUpperCase();
    let nombreMedInput = inputMed.value.toUpperCase().trim();
    const dosis = parseFloat(inputDosis.value);
    const horario = inputHorario.value.toUpperCase();
    const volFinalManualStr = inputVolFinalManual.value;

    // LÓGICA INFALIBLE PARA ENTER:
    // Si escribe "CEFOTA", buscará el primero que empiece con eso en la base de datos.
    let configMed = dbMedicamentos.find(m => String(m.MEDICAMENTO).toUpperCase() === nombreMedInput);
    if (!configMed) {
        configMed = dbMedicamentos.find(m => String(m.MEDICAMENTO).toUpperCase().startsWith(nombreMedInput));
        if (!configMed) configMed = dbMedicamentos.find(m => String(m.MEDICAMENTO).toUpperCase().includes(nombreMedInput));
        
        if (configMed) {
            nombreMedInput = configMed.MEDICAMENTO; 
        } else {
            return alert("Medicamento no encontrado en la base de datos.");
        }
    }

    const volFinalDefinitivo = volFinalManualStr !== "" ? parseFloat(volFinalManualStr) : calcularVolFinal(dosis, configMed.CONCENTRACION, configMed.DILUYENTE);

    const etiquetaObj = {
        id: idActual || (Date.now().toString(36) + Math.random().toString(36).substr(2)), 
        CAMA: cama, NOMBRE: nombre, MEDICAMENTO: nombreMedInput, DOSIS: dosis, HORARIO: horario,
        SERVICIO: calcularServicio(cama), "VOL MED": calcularVolMed(dosis, configMed.PRESENTACION),
        "VOL FINAL": volFinalDefinitivo,
        SOLUCION: configMed.DILUYENTE || "", TIEMPO: configMed.TIEMPO || "",
        UNIDADES: configMed.UNIDADES || "MG", // LEE LAS UNIDADES DESDE TU EXCEL
        VIA: configMed.VIA || "IV",           // LEE LA VÍA DESDE TU EXCEL
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
                        e.CAMA = cama;
                        e.NOMBRE = nombre;
                        e.SERVICIO = calcularServicio(cama);
                    }
                });
            }
        }
        modal.style.display = 'none'; 
    } else {
        etiquetasPendientes.push(etiquetaObj);
        inputMed.value = ''; inputDosis.value = ''; inputHorario.value = '';
        inputMed.focus(); 
    }

    localStorage.setItem('etiquetasIV', JSON.stringify(etiquetasPendientes));
    renderizarInterfaz();
});

function limpiarFormulario() {
    inputId.value = ''; inputCama.value = ''; inputNombre.value = '';
    inputMed.value = ''; inputDosis.value = ''; inputHorario.value = ''; inputVolFinalManual.value = '';
}

document.getElementById('listaPacientes').addEventListener('click', (e) => {
    const btnEdit = e.target.closest('.btn-edit');
    if (btnEdit) {
        const idToEdit = btnEdit.dataset.id;
        const etiqueta = etiquetasPendientes.find(et => et.id === idToEdit);
        if (etiqueta) {
            inputId.value = etiqueta.id;
            inputCama.value = etiqueta.CAMA;
            inputNombre.value = etiqueta.NOMBRE;
            inputMed.value = etiqueta.MEDICAMENTO;
            inputDosis.value = etiqueta.DOSIS;
            inputHorario.value = etiqueta.HORARIO;
            
            const configMed = dbMedicamentos.find(m => String(m.MEDICAMENTO).toUpperCase() === etiqueta.MEDICAMENTO);
            const calcVol = configMed ? calcularVolFinal(etiqueta.DOSIS, configMed.CONCENTRACION, configMed.DILUYENTE) : "";
            
            inputVolFinalManual.value = (String(etiqueta["VOL FINAL"]) !== String(calcVol)) ? etiqueta["VOL FINAL"] : '';

            document.getElementById('modalTitle').innerText = "Editar Etiqueta";
            document.getElementById('btnSubmitForm').innerText = "ACTUALIZAR CAMBIOS";
            grupoVolManual.style.display = 'block'; 
            modal.style.display = 'flex';
        }
    }
});

document.getElementById('btnEliminarSeleccionados').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.med-checkbox:checked');
    if(checkboxes.length === 0) return alert("Selecciona etiquetas con las casillas.");
    if(confirm(`¿Eliminar ${checkboxes.length} etiquetas?`)) {
        const idsToDelete = Array.from(checkboxes).map(cb => cb.dataset.id);
        etiquetasPendientes = etiquetasPendientes.filter(e => !idsToDelete.includes(e.id));
        localStorage.setItem('etiquetasIV', JSON.stringify(etiquetasPendientes));
        renderizarInterfaz();
    }
});

function renderizarInterfaz() {
    const panelServicios = document.getElementById('listaServicios');
    const panelPacientes = document.getElementById('listaPacientes');
    
    if (etiquetasPendientes.length === 0) {
        panelServicios.innerHTML = '<div style="color: #9aa0a6; text-align: center; margin-top: 20px;">Sin pacientes aún</div>';
        panelPacientes.innerHTML = '<div class="empty-state"><i class="material-icons" style="font-size: 48px; color: #dadce0;">assignment</i><br>Comienza agregando etiquetas</div>';
        return;
    }

    const conteoServicios = {};
    const gruposPacientes = {};

    etiquetasPendientes.forEach(etiq => {
        conteoServicios[etiq.SERVICIO] = (conteoServicios[etiq.SERVICIO] || 0) + 1;
        const llavePaciente = `Cama ${etiq.CAMA} - ${etiq.NOMBRE}`;
        if (!gruposPacientes[etiq.SERVICIO]) gruposPacientes[etiq.SERVICIO] = {};
        if (!gruposPacientes[etiq.SERVICIO][llavePaciente]) gruposPacientes[etiq.SERVICIO][llavePaciente] = [];
        gruposPacientes[etiq.SERVICIO][llavePaciente].push(etiq);
    });

    panelServicios.innerHTML = Object.keys(conteoServicios).sort().map(srv => 
        `<div class="servicio-item"><span>${srv}</span> <span class="badge">${conteoServicios[srv]}</span></div>`
    ).join('');

    let htmlPacientes = '';
    Object.keys(gruposPacientes).sort().forEach(servicio => {
        const pacientes = gruposPacientes[servicio];
        Object.keys(pacientes).sort().forEach(pacienteStr => {
            htmlPacientes += `<div class="grupo-paciente"><div class="header-paciente"><i class="material-icons">hotel</i> ${pacienteStr}</div>`;
            
            // ESTRUCTURA TIPO TABLA APPSHEET
            htmlPacientes += `<table class="med-table">
                                <tr>
                                    <th style="width: 30px;"></th>
                                    <th>MEDICAMENTO</th>
                                    <th>DOSIS</th>
                                    <th>HORARIO</th>
                                    <th>VF</th>
                                    <th style="text-align: right;">ACCIONES</th>
                                </tr>`;
            
            pacientes[pacienteStr].forEach(med => {
                htmlPacientes += `
                    <tr>
                        <td><input type="checkbox" class="med-checkbox" data-id="${med.id}"></td>
                        <td class="med-name">${med.MEDICAMENTO}</td>
                        <td>${med.DOSIS} ${med.UNIDADES || "MG"}</td>
                        <td>${med.HORARIO}</td>
                        <td class="med-vol">${med['VOL FINAL']} ml</td>
                        <td style="text-align: right;">
                            <button class="btn-edit" data-id="${med.id}" title="Editar Etiqueta"><i class="material-icons">edit</i></button>
                        </td>
                    </tr>`;
            });
            htmlPacientes += `</table></div>`;
        });
    });
    panelPacientes.innerHTML = htmlPacientes;
}

// IMPRIMIR NATIVO (TABLA CLÁSICA GOOGLE DOCS)
document.getElementById('btnImprimir').addEventListener('click', () => {
    if (etiquetasPendientes.length === 0) return alert("No hay etiquetas.");
    const printGrid = document.getElementById('printGrid');
    
    const hoy = new Date();
    const fechaStr = `${hoy.getDate().toString().padStart(2, '0')}-${['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][hoy.getMonth()]}-${hoy.getFullYear().toString().slice(-2)}`;

    let tableHTML = '<table class="print-table">';
    for (let i = 0; i < etiquetasPendientes.length; i += 4) {
        tableHTML += '<tr>';
        for (let j = 0; j < 4; j++) {
            if (i + j < etiquetasPendientes.length) {
                let etiq = etiquetasPendientes[i + j];
                let medLimpio = etiq.MEDICAMENTO.split(/\s\d/)[0].trim();
                let textoVolumen = (etiq["VOL MED"] && etiq["VOL MED"] !== "0") ? ` - ${etiq["VOL MED"]}${etiq.SOLUCION ? " ML" : ""}` : "";
                
                tableHTML += `
                <td>
                    <div class="etiqueta-print">
                        <p class="bold">NOMBRE: ${etiq.NOMBRE}</p>
                        <p class="bold">SERVICIO: ${etiq.SERVICIO} &nbsp;&nbsp; CAMA: ${etiq.CAMA}</p>
                        <p>FECHA: ${fechaStr} &nbsp;&nbsp; ${NOMBRE_QUIMICO}</p>
                        <p class="bold">${etiq.MEDICAMENTO} ${etiq.DOSIS} ${etiq.UNIDADES || "MG"}${textoVolumen} ${etiq.VIA || "IV"} ${etiq.TIEMPO ? "P/"+etiq.TIEMPO : ""}</p>
                        <p>${etiq.SOLUCION}</p>
                        <p class="bold">VOL. FINAL: ${etiq['VOL FINAL']} ML &nbsp;&nbsp; HORARIO: ${etiq.HORARIO}</p>
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

document.getElementById('btnGuardar').addEventListener('click', async () => {
    if (etiquetasPendientes.length === 0) return alert("Agrega etiquetas primero.");
    const btn = document.getElementById('btnGuardar');
    btn.innerHTML = '<i class="material-icons">sync</i> GUARDANDO...';
    btn.disabled = true;

    try {
        for (const etiq of etiquetasPendientes) await addDoc(collection(db, "etiquetas_historial"), etiq);

        await fetch(URL_APPS_SCRIPT, {
            method: 'POST',
            body: JSON.stringify(etiquetasPendientes),
            mode: 'no-cors', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        alert("Etiquetas guardadas en Drive y Firebase.");
    } catch (e) {
        alert("Error al guardar.");
    } finally {
        btn.innerHTML = '<i class="material-icons">cloud_upload</i> GUARDAR EN DRIVE';
        btn.disabled = false;
    }
});

document.getElementById('btnLimpiarTodo').addEventListener('click', () => {
    if (confirm("¿Borrar toda la lista actual?")) {
        etiquetasPendientes = [];
        localStorage.removeItem('etiquetasIV');
        renderizarInterfaz();
    }
});