const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbyGMTI1Ftbe-Tc26QQxHY8io7ySfZydiM_Z6bOcpk08o725zLAfJia22ScQBUPPHY8j_Q/exec";

let etiquetas = [];
let dbMed = [];
let currentTab = "DIARIA";
let currentSrv = "TODOS";
let bloqueoSinc = false;

// INICIO
async function init() {
    await sync();
    setInterval(sync, 4000);
}
init();

async function sync() {
    if (bloqueoSinc || document.getElementById('modalForm').style.display === 'flex') return;
    try {
        const res = await fetch(URL_SCRIPT);
        const data = await res.json();
        dbMed = data.medicamentos;
        if (JSON.stringify(etiquetas) !== JSON.stringify(data.activas)) {
            etiquetas = data.activas;
            render();
        }
        document.getElementById('dbStatus').innerText = "SINCRONIZADO";
        
        // Cargar Datalist
        const dl = document.getElementById('listaMed');
        if(dl.options.length === 0) {
            dbMed.forEach(m => { let o = document.createElement('option'); o.value = m.MEDICAMENTO; dl.appendChild(o); });
        }
    } catch (e) { document.getElementById('dbStatus').innerText = "OFFLINE"; }
}

function render() {
    const main = document.getElementById('mainContent');
    const side = document.getElementById('sidebar');
    const fab = document.getElementById('btnOpenModal');
    const bBar = document.getElementById('bottomBar');

    if (currentTab === "LOTES") {
        side.style.display = "none";
        fab.style.display = "none";
        bBar.style.display = "none";
        renderLotes();
        return;
    }

    side.style.display = "block";
    fab.style.display = "flex";
    bBar.style.display = "flex";
    document.getElementById('btnDrive').style.display = (currentTab === "PRN") ? "none" : "block";

    const dataTab = etiquetas.filter(e => e.TIPO === currentTab);
    
    // Sidebar
    const srvs = [...new Set(dataTab.map(e => e.SERVICIO))].sort();
    document.getElementById('listaServicios').innerHTML = `<div class="servicio-item ${currentSrv==='TODOS'?'active':''}" onclick="setSrv('TODOS')">TODOS <span>${dataTab.length}</span></div>` +
        srvs.map(s => `<div class="servicio-item ${currentSrv===s?'active':''}" onclick="setSrv('${s}')">${s} <span>${dataTab.filter(x=>x.SERVICIO===s).length}</span></div>`).join('');

    const finalData = currentSrv === "TODOS" ? dataTab : dataTab.filter(e => e.SERVICIO === currentSrv);
    
    const grupos = {};
    finalData.forEach(e => {
        const k = `Cama ${e.CAMA} - ${e.NOMBRE}`;
        if(!grupos[k]) grupos[k] = []; grupos[k].push(e);
    });

    main.innerHTML = Object.keys(grupos).sort().map(p => `
        <div class="grupo-paciente">
            <div class="header-paciente" style="border-color:${currentTab==='PRN'?'#e53935':'#1a73e8'}">${p}</div>
            <table class="med-table">
                <tr><th></th><th>MEDICAMENTO</th><th>DOSIS</th><th>HORA</th><th>VF</th><th></th></tr>
                ${grupos[p].map(m => `
                    <tr>
                        <td><input type="checkbox" class="cb" data-id="${m.id}"></td>
                        <td><b>${m.MEDICAMENTO}</b> <small>(${m.VIA})</small></td>
                        <td>${m.DOSIS} ${m.UNIDADES}</td>
                        <td>${m.HORARIO}</td>
                        <td>${m['VOL FINAL']}ml</td>
                        <td>
                            <button onclick="mover('${m.id}')"><i class="material-icons" style="font-size:16px">swap_horiz</i></button>
                            <button onclick="editar('${m.id}')"><i class="material-icons" style="font-size:16px">edit</i></button>
                        </td>
                    </tr>
                `).join('')}
            </table>
        </div>
    `).join('');
}

// --- SECCIÓN LOTES ---
function renderLotes() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="lotes-header">
            <i class="material-icons">search</i>
            <input type="text" id="busqLote" placeholder="Buscar medicamento..." oninput="filterLotes(this.value)" style="flex:1; padding:8px; border:1px solid #ddd; border-radius:4px;">
            <button onclick="saveLotes()" style="background:#34a853; color:white; border:none; padding:10px 20px; border-radius:4px; font-weight:bold;">GUARDAR EN EXCEL</button>
        </div>
        <div class="lotes-table-container" id="tablaLotes"></div>
    `;
    filterLotes('');
}

window.filterLotes = function(v) {
    const cont = document.getElementById('tablaLotes');
    const filtrados = dbMed.filter(m => m.MEDICAMENTO.includes(v.toUpperCase()));
    cont.innerHTML = filtrados.map(m => `
        <div class="lote-row">
            <div style="font-weight:bold; font-size:12px;">${m.MEDICAMENTO}</div>
            <div><label>DENOMINACIÓN</label><input type="text" value="${m.DENOMINACION}" onchange="updMed('${m.MEDICAMENTO}','DENOMINACION',this.value)"></div>
            <div><label>LOTE</label><input type="text" value="${m.LOTE}" onchange="updMed('${m.MEDICAMENTO}','LOTE',this.value)"></div>
            <div><label>CADUCIDAD</label><input type="text" value="${m.CADUCIDAD}" onchange="updMed('${m.MEDICAMENTO}','CADUCIDAD',this.value)"></div>
            <div><label>LABORATORIO</label><input type="text" value="${m.LABORATORIO}" onchange="updMed('${m.MEDICAMENTO}','LABORATORIO',this.value)"></div>
        </div>
    `).join('');
}

window.updMed = (nom, col, val) => {
    const m = dbMed.find(x => x.MEDICAMENTO === nom);
    if(m) m[col] = val.toString().toUpperCase();
}

window.saveLotes = async () => {
    bloqueoSinc = true;
    document.getElementById('dbStatus').innerText = "GUARDANDO LOTES...";
    await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({action: "UPDATE_CONFIG", datos: dbMed}), mode: 'no-cors'});
    alert("Información de Lotes actualizada en Google Sheets.");
    bloqueoSinc = false;
    sync();
}

// --- CALCULADORA ---
document.getElementById('btnSuministros').addEventListener('click', () => {
    const data = etiquetas.filter(e => e.TIPO === currentTab);
    if(data.length === 0) return alert("No hay datos.");

    const cons = {};
    data.forEach(e => {
        cons[e.MEDICAMENTO] = (cons[e.MEDICAMENTO] || 0) + parseFloat(e.DOSIS);
    });

    const hoy = new Date();
    const fecha = `${hoy.getDate()}/${hoy.getMonth()+1}/${hoy.getFullYear()} ${hoy.getHours()}:${hoy.getMinutes()}`;

    let html = `<div style="text-align:center"><h2>REPORTE TÉCNICO DE SUMINISTROS</h2><p>VISTA: ${currentTab} | ${fecha}</p></div>`;
    html += `<table class="supply-table"><tr><th>MEDICAMENTO</th><th>TOTAL</th><th>DENOMINACIÓN</th><th>LOTE</th><th>CADUCIDAD</th><th>LAB</th></tr>`;
    
    Object.keys(cons).sort().forEach(m => {
        const info = dbMed.find(x => x.MEDICAMENTO === m) || {};
        html += `<tr><td>${m}</td><td><b>${cons[m]}</b></td><td>${info.DENOMINACION||''}</td><td>${info.LOTE||''}</td><td>${info.CADUCIDAD||''}</td><td>${info.LABORATORIO||''}</td></tr>`;
    });
    html += `</table>`;

    document.getElementById('printSupplies').innerHTML = html;
    window.print();
});

// --- FUNCIONES AUXILIARES ---
window.setSrv = (s) => { currentSrv = s; render(); }
document.addEventListener('cambioTab', e => { currentTab = e.detail; currentSrv = "TODOS"; render(); });

window.abrirModal = () => {
    document.getElementById('etiquetaId').value = '';
    document.getElementById('etiquetaForm').reset();
    document.getElementById('modalForm').style.display = 'flex';
}

window.guardarEtiqueta = async (e) => {
    e.preventDefault();
    bloqueoSinc = true;
    const id = document.getElementById('etiquetaId').value || Math.random().toString(36).substr(2, 9);
    const medNom = document.getElementById('input_medicamento').value.toUpperCase();
    const config = dbMed.find(x => x.MEDICAMENTO === medNom);
    
    if(!config) return alert("Medicamento no existe en base.");

    const dosis = document.getElementById('input_dosis').value;
    // Lógica Volúmenes (Texto)
    const vfDef = document.getElementById('input_volManual').value || "10"; 

    const obj = {
        id: id, TIPO: currentTab, 
        CAMA: document.getElementById('input_cama').value.toString(),
        NOMBRE: document.getElementById('input_nombre').value.toUpperCase(),
        MEDICAMENTO: medNom, DOSIS: dosis, 
        HORARIO: document.getElementById('input_horario').value.toString(),
        SERVICIO: calcularServicio(document.getElementById('input_cama').value),
        "VOL FINAL": vfDef, UNIDADES: config.UNIDADES || "MG", VIA: config.VIA || "IV",
        SOLUCION: config.DILUYENTE || "", fecha_registro: new Date().toISOString()
    };

    const idx = etiquetas.findIndex(x => x.id === id);
    if(idx > -1) etiquetas[idx] = obj; else etiquetas.push(obj);

    await push();
    document.getElementById('modalForm').style.display = 'none';
    render();
}

async function push() {
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
