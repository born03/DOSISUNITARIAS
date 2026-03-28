const URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbyGMTI1Ftbe-Tc26QQxHY8io7ySfZydiM_Z6bOcpk08o725zLAfJia22ScQBUPPHY8j_Q/exec";

let etiquetasPendientes = [];
let dbMedicamentos = [];
const NOMBRE_QUIMICO = "E. RICARDO L."; 

let currentTab = "DIARIA"; 
let currentServicio = "TODOS";
let bloqueoSincronizacion = false; 

const modal = document.getElementById('modalForm');
const syncIcon = document.getElementById('syncIcon');
const dbStatus = document.getElementById('dbStatus');

// EVENTOS DE PESTAÑAS
document.addEventListener('cambioTab', (e) => {
    currentTab = e.detail;
    document.getElementById('tabDiaria').className = currentTab === 'DIARIA' ? 'tab-btn active' : 'tab-btn';
    document.getElementById('tabPrn').className = currentTab === 'PRN' ? 'tab-btn active-prn' : 'tab-btn';
    document.getElementById('tabLotes').className = currentTab === 'LOTES' ? 'tab-btn active-lotes' : 'tab-btn';
    
    document.getElementById('sidebar').style.display = (currentTab === "LOTES") ? 'none' : 'block';
    document.getElementById('bottomBar').style.display = (currentTab === "LOTES") ? 'none' : 'flex';
    document.getElementById('btnOpenModal').style.display = (currentTab === "LOTES") ? 'none' : 'flex';

    renderizarInterfaz();
});

document.addEventListener('cambioServicio', (e) => {
    currentServicio = e.detail;
    renderizarInterfaz();
});

// MOTOR DE SINCRONIZACIÓN
async function fetchSyncRealTime() {
    if (bloqueoSincronizacion || modal.style.display === 'flex' || currentTab === "LOTES") return; 
    try {
        const response = await fetch(URL_APPS_SCRIPT);
        const data = await response.json();
        dbMedicamentos = data.medicamentos || [];
        const datosNube = data.activas || [];
        
        const dlist = document.getElementById('listaMedicamentos');
        if(dlist.options.length === 0) {
            dbMedicamentos.forEach(m => { let o = document.createElement('option'); o.value = m.MEDICAMENTO; dlist.appendChild(o); });
        }

        if(JSON.stringify(datosNube) !== JSON.stringify(etiquetasPendientes)) {
            etiquetasPendientes = datosNube;
            renderizarInterfaz(); 
        }
        dbStatus.innerText = "Sincronizado";
    } catch (e) { dbStatus.innerText = "Offline"; }
}
fetchSyncRealTime().then(() => { setInterval(fetchSyncRealTime, 4000); });

async function pushToNube() {
    bloqueoSincronizacion = true; 
    try {
        syncIcon.style.display = 'inline-block';
        await fetch(URL_APPS_SCRIPT, { method: 'POST', body: JSON.stringify({ action: "SYNC", datos: etiquetasPendientes }), mode: 'no-cors' });
    } finally { syncIcon.style.display = 'none'; bloqueoSincronizacion = false; }
}

// GUARDAR LOTES AL EXCEL
async function guardarLotesAlExcel() {
    dbStatus.innerText = "Guardando Lotes...";
    syncIcon.style.display = 'inline-block';
    try {
        await fetch(URL_APPS_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({ action: "UPDATE_CONFIG", datos: dbMedicamentos }),
            mode: 'no-cors'
        });
        alert("Lotes y Caducidades guardados en el Excel.");
    } catch (e) { alert("Error al guardar lotes."); }
    finally { syncIcon.style.display = 'none'; dbStatus.innerText = "Sincronizado"; }
}

// RENDERIZADO PRINCIPAL
function renderizarInterfaz() {
    const panelPac = document.getElementById('listaPacientes');
    const panelSrv = document.getElementById('listaServicios');

    if (currentTab === "LOTES") {
        renderizarLotes();
        return;
    }

    const dataTab = etiquetasPendientes.filter(e => (e.TIPO || "DIARIA") === currentTab);
    if (dataTab.length === 0) {
        panelSrv.innerHTML = '';
        panelPac.innerHTML = '<div class="empty-state">No hay etiquetas aquí</div>';
        return;
    }

    const conteoSrv = {};
    dataTab.forEach(e => conteoSrv[e.SERVICIO] = (conteoSrv[e.SERVICIO] || 0) + 1);
    panelSrv.innerHTML = `<div class="servicio-item ${currentServicio === 'TODOS' ? 'active' : ''}" onclick="cambiarServicio('TODOS')">TODOS <span class="badge">${dataTab.length}</span></div>` +
        Object.keys(conteoSrv).sort().map(s => `<div class="servicio-item ${currentServicio === s ? 'active' : ''}" onclick="cambiarServicio('${s}')">${s} <span class="badge">${conteoSrv[s]}</span></div>`).join('');

    const finalData = currentServicio === 'TODOS' ? dataTab : dataTab.filter(e => e.SERVICIO === currentServicio);
    const grupos = {};
    finalData.forEach(e => { const k = `Cama ${e.CAMA} - ${e.NOMBRE}`; if (!grupos[k]) grupos[k] = []; grupos[k].push(e); });

    panelPac.innerHTML = Object.keys(grupos).sort().map(p => `
        <div class="grupo-paciente">
            <div class="header-paciente"><i class="material-icons">hotel</i> ${p}</div>
            <div class="table-responsive"><table class="med-table">
                <tr><th></th><th>MEDICAMENTO</th><th>DOSIS</th><th>HORA</th><th>VF</th><th></th></tr>
                ${grupos[p].map(m => `
                    <tr>
                        <td><input type="checkbox" class="med-checkbox" data-id="${m.id}"></td>
                        <td>${m.MEDICAMENTO} <span style="font-size:10px; color:#9aa0a6;">(${m.VIA})</span></td>
                        <td>${m.DOSIS} ${m.UNIDADES}</td>
                        <td>${m.HORARIO}</td><td>${m['VOL FINAL']}ml</td>
                        <td style="text-align:right">
                            <button class="btn-swap" onclick="swapDosis('${m.id}')"><i class="material-icons" style="font-size:18px;">${currentTab === "DIARIA" ? 'arrow_forward' : 'arrow_back'}</i></button>
                            <button class="btn-edit" onclick="editEtiq('${m.id}')"><i class="material-icons" style="font-size:18px;">edit</i></button>
                        </td>
                    </tr>`).join('')}
            </table></div>
        </div>`).join('');
}

// RENDERIZAR VISTA DE LOTES
function renderizarLotes() {
    const panel = document.getElementById('listaPacientes');
    panel.innerHTML = `
        <input type="text" id="searchLotes" placeholder="Buscar medicamento para actualizar lote..." oninput="filtrarLotes(this.value)">
        <div id="lotesContainer"></div>
        <button class="btn-lotes-save" onclick="guardarLotesAlExcel()">GUARDAR CAMBIOS EN EXCEL</button>
    `;
    filtrarLotes('');
}

window.filtrarLotes = function(query) {
    const container = document.getElementById('lotesContainer');
    const filtrados = dbMedicamentos.filter(m => m.MEDICAMENTO.toUpperCase().includes(query.toUpperCase()));
    
    container.innerHTML = filtrados.map(m => `
        <div class="lote-card">
            <div style="font-weight:bold; color:#1a73e8; border-bottom:1px solid #eee; padding-bottom:5px;">${m.MEDICAMENTO}</div>
            <div class="lote-input-grid">
                <div><label>DENOMINACIÓN</label><input type="text" value="${m.DENOMINACION}" onchange="updateMedData('${m.MEDICAMENTO}', 'DENOMINACION', this.value)"></div>
                <div><label>LOTE</label><input type="text" value="${m.LOTE}" onchange="updateMedData('${m.MEDICAMENTO}', 'LOTE', this.value)"></div>
                <div><label>CADUCIDAD</label><input type="text" placeholder="AAAA-MM" value="${m.CADUCIDAD}" onchange="updateMedData('${m.MEDICAMENTO}', 'CADUCIDAD', this.value)"></div>
                <div><label>LABORATORIO</label><input type="text" value="${m.LABORATORIO}" onchange="updateMedData('${m.MEDICAMENTO}', 'LABORATORIO', this.value)"></div>
            </div>
        </div>
    `).join('');
}

window.updateMedData = function(medNombre, campo, valor) {
    const med = dbMedicamentos.find(m => m.MEDICAMENTO === medNombre);
    if (med) med[campo] = valor.toUpperCase();
}

// --- LÓGICA CALCULADORA CON LOTES ---
document.getElementById('btnSuministros').addEventListener('click', () => {
    const data = etiquetasPendientes.filter(e => e.TIPO === currentTab);
    if(data.length === 0) return alert("Sin datos.");

    const consolidado = {};
    const jeringas = { "JERINGA DE INSULINA": 0, "JERINGA DE 3 ML": 0, "JERINGA DE 5 ML": 0, "JERINGA DE 10 ML": 0, "JERINGA DE 20 ML": 0 };
    
    data.forEach(e => {
        consolidado[e.MEDICAMENTO] = (consolidado[e.MEDICAMENTO] || 0) + e.DOSIS;
        // ... (Misma lógica de jeringas que ya tenías)
    });

    const hoy = new Date();
    const fechaStr = `${hoy.getDate()}-${hoy.getMonth()+1}-${hoy.getFullYear()} ${hoy.getHours()}:${hoy.getMinutes()}`;
    
    let html = `<h2>REPORTE CONSOLIDADO - ${currentTab}</h2><h3>FECHA: ${fechaStr}</h3>`;
    html += `<table class="supply-table">
                <tr><th>MEDICAMENTO</th><th>TOTAL</th><th>DENOMINACIÓN</th><th>LOTE</th><th>CADUCIDAD</th><th>LABORATORIO</th></tr>`;
    
    Object.keys(consolidado).sort().forEach(mNombre => {
        const total = Math.round(consolidado[mNombre]);
        const info = dbMedicamentos.find(dm => dm.MEDICAMENTO === mNombre) || {};
        html += `<tr>
                    <td style="text-align:left"><b>${mNombre}</b></td>
                    <td><b>${total}</b></td>
                    <td>${info.DENOMINACION || ''}</td>
                    <td>${info.LOTE || ''}</td>
                    <td>${info.CADUCIDAD || ''}</td>
                    <td>${info.LABORATORIO || ''}</td>
                </tr>`;
    });
    html += `</table><h2>SUMINISTROS JERINGAS</h2><table class="supply-table"><tr><th>TIPO</th><th>PIEZAS</th></tr>`;
    for(let t in jeringas) if(jeringas[t]>0) html += `<tr><td>${t}</td><td><b>${jeringas[t]}</b></td></tr>`;
    html += `</table>`;

    document.getElementById('printSupplies').innerHTML = html;
    window.print();
});

// (Resto de funciones swapDosis, editEtiq, etc. iguales a las anteriores)
window.swapDosis = function(id) {
    const idx = etiquetasPendientes.findIndex(e => e.id === id);
    if(idx > -1) { etiquetasPendientes[idx].TIPO = etiquetasPendientes[idx].TIPO === "DIARIA" ? "PRN" : "DIARIA"; renderizarInterfaz(); pushToNube(); }
}
window.editEtiq = function(id) {
    const e = etiquetasPendientes.find(et => et.id === id);
    if(e) {
        document.getElementById('etiquetaId').value = e.id;
        document.getElementById('input_cama').value = e.CAMA;
        document.getElementById('input_nombre').value = e.NOMBRE;
        document.getElementById('input_medicamento').value = e.MEDICAMENTO;
        document.getElementById('input_dosis').value = e.DOSIS;
        document.getElementById('input_horario').value = e.HORARIO;
        modal.style.display = 'flex';
    }
}
window.guardarLotesAlExcel = guardarLotesAlExcel;
