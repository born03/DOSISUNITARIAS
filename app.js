const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbyGMTI1Ftbe-Tc26QQxHY8io7ySfZydiM_Z6bOcpk08o725zLAfJia22ScQBUPPHY8j_Q/exec";

let etiquetas = [];
let dbMed = [];
let currentTab = "DIARIA";
let currentSrv = "TODOS";
let bloqueoSinc = false;

// FECHA ACTUAL PARA CADUCIDAD (Marzo 2026)
const HOY_SISTEMA = new Date(2026, 2, 28); // 2 = Marzo

async function init() {
    await sync();
    setInterval(sync, 4000);
}
init();

async function sync() {
    if (bloqueoSinc || document.querySelector('.modal-overlay[style*="flex"]')) return;
    try {
        const res = await fetch(URL_SCRIPT);
        const data = await res.json();
        dbMed = data.medicamentos;
        if (JSON.stringify(etiquetas) !== JSON.stringify(data.activas)) {
            etiquetas = data.activas;
            render();
        }
        document.getElementById('dbStatus').innerText = "SINCRONIZADO";
        const dl = document.getElementById('listaMed');
        if(dl.options.length === 0) {
            dbMed.forEach(m => { let o = document.createElement('option'); o.value = m.MEDICAMENTO; dl.appendChild(o); });
        }
    } catch (e) { document.getElementById('dbStatus').innerText = "OFFLINE"; }
}

function estaCaducado(cadStr) {
    if (!cadStr || cadStr === "" || cadStr === "null") return false;
    // Formato esperado: YYYY-MM
    const parts = cadStr.split('-');
    if (parts.length < 2) return false;
    const fechaCad = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    return fechaCad < new Date(HOY_SISTEMA.getFullYear(), HOY_SISTEMA.getMonth(), 1);
}

function render() {
    const main = document.getElementById('mainContent');
    const side = document.getElementById('sidebar');
    const fab = document.getElementById('btnOpenModal');
    const bBar = document.getElementById('bottomBar');

    if (currentTab === "LOTES") {
        side.style.display = "none"; fab.style.display = "none"; bBar.style.display = "none";
        renderLotes(); return;
    }

    side.style.display = "block"; fab.style.display = "flex"; bBar.style.display = "flex";
    document.getElementById('btnDrive').style.display = (currentTab === "PRN") ? "none" : "flex";

    const dataTab = etiquetas.filter(e => e.TIPO === currentTab);
    const srvs = [...new Set(dataTab.map(e => e.SERVICIO))].sort();
    
    document.getElementById('listaServicios').innerHTML = `<div class="servicio-item ${currentSrv==='TODOS'?'active':''}" onclick="setSrv('TODOS')">TODOS <span>${dataTab.length}</span></div>` +
        srvs.map(s => `<div class="servicio-item ${currentSrv===s?'active':''}" onclick="setSrv('${s}')">${s} <span>${dataTab.filter(x=>x.SERVICIO===s).length}</span></div>`).join('');

    const finalData = currentSrv === "TODOS" ? dataTab : dataTab.filter(e => e.SERVICIO === currentSrv);
    const grupos = {};
    finalData.forEach(e => { const k = `Cama ${e.CAMA} - ${e.NOMBRE}`; if(!grupos[k]) grupos[k] = []; grupos[k].push(e); });

    main.innerHTML = Object.keys(grupos).sort().map(p => `
        <div class="grupo-paciente">
            <div class="header-paciente" style="border-color:${currentTab==='PRN'?'#e53935':'#1a73e8'}">${p}</div>
            <div class="table-responsive"><table class="med-table">
                <tr><th></th><th>MEDICAMENTO</th><th>DOSIS</th><th>HORA</th><th>VF</th><th></th></tr>
                ${grupos[p].map(m => `
                    <tr>
                        <td><input type="checkbox" class="cb" data-id="${m.id}"></td>
                        <td><b>${m.MEDICAMENTO}</b></td>
                        <td>${m.DOSIS} ${m.UNIDADES}</td>
                        <td>${m.HORARIO}</td><td>${m['VOL FINAL']}ml</td>
                        <td style="white-space:nowrap">
                            <button onclick="mover('${m.id}')" class="btn-swap"><i class="material-icons" style="font-size:18px">swap_horiz</i></button>
                            <button onclick="editEtiq('${m.id}')" class="btn-edit"><i class="material-icons" style="font-size:18px">edit</i></button>
                        </td>
                    </tr>`).join('')}
            </table></div>
        </div>`).join('');
}

// --- VISTA LOTES CON FORMULARIO ---
function renderLotes() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div style="background:white; padding:15px; border-radius:8px; margin-bottom:15px; box-shadow:0 1px 3px rgba(0,0,0,0.1)">
            <input type="text" id="busqLote" placeholder="Buscar medicamento..." oninput="filterLotes(this.value)" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; font-size:14px; box-sizing:border-box;">
        </div>
        <div id="contLotes"></div>
    `;
    filterLotes('');
}

window.filterLotes = (v) => {
    const cont = document.getElementById('contLotes');
    const filtrados = dbMed.filter(m => m.MEDICAMENTO.includes(v.toUpperCase()));
    cont.innerHTML = filtrados.map(m => {
        const caducado = estaCaducado(m.CADUCIDAD);
        return `
        <div class="lote-list-item ${caducado ? 'expired' : ''}">
            <div style="flex:1">
                <div style="font-weight:bold; font-size:14px;">${m.MEDICAMENTO}</div>
                <div style="font-size:12px; color:#5f6368;">LOTE: ${m.LOTE} | LAB: ${m.LABORATORIO}</div>
                <div style="font-size:12px;" class="${caducado ? 'expired-text' : ''}">CAD: ${m.CADUCIDAD}</div>
            </div>
            <button onclick="abrirModalLote('${m.MEDICAMENTO}')" style="background:#e8f5e9; border:none; color:#34a853; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer;">EDITAR</button>
        </div>`;
    }).join('');
}

window.abrirModalLote = (nom) => {
    const m = dbMed.find(x => x.MEDICAMENTO === nom);
    if(!m) return;
    document.getElementById('loteMedTitle').innerText = nom;
    document.getElementById('loteMedId').value = nom;
    document.getElementById('in_denom').value = m.DENOMINACION;
    document.getElementById('in_lote').value = m.LOTE;
    document.getElementById('in_cad').value = m.CADUCIDAD;
    document.getElementById('in_lab').value = m.LABORATORIO;
    document.getElementById('modalLote').style.display = 'flex';
}

window.guardarLoteExcel = async (e) => {
    e.preventDefault();
    const nom = document.getElementById('loteMedId').value;
    const m = dbMed.find(x => x.MEDICAMENTO === nom);
    m.DENOMINACION = document.getElementById('in_denom').value.toUpperCase();
    m.LOTE = document.getElementById('in_lote').value.toUpperCase();
    m.CADUCIDAD = document.getElementById('in_cad').value;
    m.LABORATORIO = document.getElementById('in_lab').value.toUpperCase();

    bloqueoSinc = true;
    document.getElementById('dbStatus').innerText = "GUARDANDO...";
    await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({action: "UPDATE_CONFIG", datos: [m]}), mode: 'no-cors'});
    document.getElementById('modalLote').style.display = 'none';
    bloqueoSinc = false;
    renderLotes();
}

// --- CALCULADORA DE SUMINISTROS CON JERINGAS ---
document.getElementById('btnSuministros').addEventListener('click', () => {
    const data = etiquetas.filter(e => e.TIPO === currentTab);
    if(data.length === 0) return alert("No hay datos.");

    const cons = {};
    const jeringas = { "JERINGA DE INSULINA": 0, "JERINGA DE 3 ML": 0, "JERINGA DE 5 ML": 0, "JERINGA DE 10 ML": 0, "JERINGA DE 20 ML": 0 };
    const LISTA_SC = ['ERITROPOYETINA', 'FILGRASTIM', 'PEG-FILGRASTIM', 'ENOXAPARINA'];
    let hayCaducados = false;

    data.forEach(e => {
        cons[e.MEDICAMENTO] = (cons[e.MEDICAMENTO] || 0) + parseFloat(e.DOSIS);
        const esSC = LISTA_SC.some(k => e.MEDICAMENTO.includes(k));
        const volMed = parseFloat(e["VOL MED"]) || 0;
        const volFinal = parseFloat(e["VOL FINAL"]) || 0;

        if (esSC && volFinal <= 1.0 && volFinal > 0) { jeringas["JERINGA DE INSULINA"]++; } 
        else {
            if (volMed === 0 && volFinal >= 30) { jeringas["JERINGA DE 20 ML"]++; } 
            else {
                let vRef = (volFinal <= 10) ? volFinal : (volMed > 0 ? volMed : volFinal);
                let res = vRef;
                while (res > 20) { jeringas["JERINGA DE 20 ML"]++; res -= 20; }
                if (res > 10) jeringas["JERINGA DE 20 ML"]++;
                else if (res > 5) jeringas["JERINGA DE 10 ML"]++;
                else if (res > 3) jeringas["JERINGA DE 5 ML"]++;
                else if (res > 0) jeringas["JERINGA DE 3 ML"]++;
            }
        }
    });

    let html = `<h2 style="text-align:center">SUMINISTROS REQUERIDOS - ${currentTab}</h2>`;
    html += `<table class="supply-table"><tr><th>MEDICAMENTO</th><th>TOTAL</th><th>DENOMINACIÓN</th><th>LOTE</th><th>CADUCIDAD</th><th>LAB</th></tr>`;
    
    Object.keys(cons).sort().forEach(m => {
        const info = dbMed.find(x => x.MEDICAMENTO === m) || {};
        const cad = estaCaducado(info.CADUCIDAD);
        if(cad) hayCaducados = true;
        html += `<tr class="${cad ? 'expired-row' : ''}"><td>${m}</td><td><b>${cons[m]}</b></td><td>${info.DENOMINACION||''}</td><td>${info.LOTE||''}</td><td>${cad?'• ':''}${info.CADUCIDAD||''}</td><td>${info.LABORATORIO||''}</td></tr>`;
    });
    html += `</table><h3>JERINGAS</h3><table class="supply-table"><tr><th>TIPO</th><th>CANTIDAD</th></tr>`;
    for(let t in jeringas) if(jeringas[t]>0) html += `<tr><td>${t}</td><td><b>${jeringas[t]}</b></td></tr>`;
    html += `</table>`;

    if(hayCaducados) alert("¡ATENCIÓN! Se detectaron medicamentos CADUCADOS en la lista de suministros.");
    document.getElementById('printSupplies').innerHTML = html;
    window.print();
});

// --- FUNCIONES COMUNES ---
window.setSrv = (s) => { currentSrv = s; render(); }
window.mover = async (id) => { 
    const i = etiquetas.findIndex(x=>x.id===id); 
    if(i>-1){ etiquetas[i].TIPO = etiquetas[i].TIPO === "DIARIA" ? "PRN" : "DIARIA"; render(); push(); }
}
window.editEtiq = (id) => {
    const e = etiquetas.find(x=>x.id===id);
    if(e) {
        document.getElementById('etiqId').value = e.id;
        document.getElementById('in_cama').value = e.CAMA;
        document.getElementById('in_nombre').value = e.NOMBRE;
        document.getElementById('in_med').value = e.MEDICAMENTO;
        document.getElementById('in_dosis').value = e.DOSIS;
        document.getElementById('in_horario').value = e.HORARIO;
        document.getElementById('divVF').style.display = 'block';
        document.getElementById('modalEtiq').style.display = 'flex';
    }
}
window.abrirModalEtiq = () => {
    document.getElementById('etiqId').value = '';
    document.getElementById('formEtiq').reset();
    document.getElementById('divVF').style.display = 'none';
    document.getElementById('modalEtiq').style.display = 'flex';
}
window.guardarEtiq = async (e) => {
    e.preventDefault();
    const medNom = document.getElementById('in_med').value.toUpperCase();
    const config = dbMed.find(x => x.MEDICAMENTO === medNom);
    if(!config) return alert("Medicamento no encontrado");

    const obj = {
        id: document.getElementById('etiqId').value || Math.random().toString(36).substr(2, 9),
        TIPO: currentTab,
        CAMA: document.getElementById('in_cama').value,
        NOMBRE: document.getElementById('in_nombre').value.toUpperCase(),
        MEDICAMENTO: medNom,
        DOSIS: document.getElementById('in_dosis').value,
        HORARIO: document.getElementById('in_horario').value || "",
        SERVICIO: calcularServicio(document.getElementById('in_cama').value),
        "VOL FINAL": document.getElementById('in_vf').value || "10",
        UNIDADES: config.UNIDADES || "MG", VIA: config.VIA || "IV",
        SOLUCION: config.DILUYENTE || "", fecha_registro: new Date().toISOString()
    };

    const idx = etiquetas.findIndex(x => x.id === obj.id);
    if(idx > -1) etiquetas[idx] = obj; else etiquetas.push(obj);
    document.getElementById('modalEtiq').style.display = 'none';
    render(); push();
}

async function push() {
    bloqueoSinc = true;
    await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({action: "SYNC", datos: etiquetas}), mode: 'no-cors'});
    bloqueoSinc = false;
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

window.imprimirVista = () => {
    const data = etiquetas.filter(e => e.TIPO === currentTab && (currentSrv === "TODOS" || e.SERVICIO === currentSrv));
    if (data.length === 0) return;
    const hoy = new Date();
    const fechaStr = `${hoy.getDate()}-${['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][hoy.getMonth()]}-${hoy.getFullYear().toString().slice(-2)}`;
    let html = '<table class="print-table">';
    for (let i = 0; i < data.length; i += 4) {
        html += '<tr>';
        for (let j = 0; j < 4; j++) {
            if (i + j < data.length) {
                let etiq = data[i+j];
                html += `<td><div class="etiqueta-print">
                    <p class="bold">NOMBRE: ${etiq.NOMBRE}</p><p class="bold">SRV: ${etiq.SERVICIO} &nbsp; CAMA: ${etiq.CAMA}</p>
                    <p>FECHA: ${fechaStr} &nbsp; ${NOMBRE_QUIMICO}</p>
                    <p class="bold">${etiq.MEDICAMENTO} ${etiq.DOSIS}${etiq.UNIDADES} ${etiq.VIA} ${etiq.TIEMPO ? "P/"+etiq.TIEMPO : ""}</p>
                    <p>${etiq.SOLUCION || ""}</p>
                    <p class="bold">VOL. FINAL: ${etiq['VOL FINAL']} ML &nbsp; HR: ${etiq.HORARIO}</p>
                </div></td>`;
            } else html += '<td></td>';
        }
        html += '</tr>';
    }
    document.getElementById('printArea').innerHTML = html + '</table>';
    window.print();
}

window.generarDrive = async () => {
    const data = etiquetas.filter(e => e.TIPO === "DIARIA" && (currentSrv === "TODOS" || e.SERVICIO === currentSrv));
    if (data.length === 0) return alert("Solo se envían Dosis Diarias al Drive.");
    document.getElementById('dbStatus').innerText = "GENERANDO DRIVE...";
    await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({ action: "DOC", datos: data }), mode: 'no-cors' });
    alert("Enviado a Drive.");
}

document.getElementById('btnEliminar').addEventListener('click', () => {
    const boxes = document.querySelectorAll('.cb:checked');
    if(boxes.length === 0 || !confirm("¿Eliminar seleccionados?")) return;
    const ids = Array.from(boxes).map(cb => cb.dataset.id);
    etiquetas = etiquetas.filter(e => !ids.includes(e.id));
    render(); push();
});
