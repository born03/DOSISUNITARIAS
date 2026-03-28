const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbyGMTI1Ftbe-Tc26QQxHY8io7ySfZydiM_Z6bOcpk08o725zLAfJia22ScQBUPPHY8j_Q/exec";

let etiquetas = [];
let dbMed = [];
let currentTab = "DIARIA";
let currentSrv = "TODOS";
let bloqueoSinc = false;
let ultimaHash = "";

const HOY_SISTEMA = new Date(2026, 2, 28); 
const NOMBRE_QUIMICO = "E. RICARDO L.";

// --- INICIO ---
async function start() {
    await sync();
    loopSinc();
    attachEvents();
}

async function loopSinc() {
    await new Promise(r => setTimeout(r, 4000));
    await sync();
    loopSinc();
}

async function sync() {
    if (bloqueoSinc || document.querySelector('.modal-overlay[style*="flex"]') || document.activeElement.tagName === 'INPUT') return;
    try {
        const res = await fetch(URL_SCRIPT);
        const data = await res.json();
        dbMed = data.medicamentos || [];
        const dataStr = JSON.stringify(data.activas);
        if (ultimaHash !== dataStr) {
            ultimaHash = dataStr;
            etiquetas = data.activas || [];
            render();
        }
        document.getElementById('dbStatus').innerText = "SINCRO OK";
        
        const dl = document.getElementById('listaMed');
        if (dl && dl.options.length === 0) {
            dbMed.forEach(m => { let o = document.createElement('option'); o.value = m.MEDICAMENTO; dl.appendChild(o); });
        }
    } catch (e) { document.getElementById('dbStatus').innerText = "OFFLINE"; }
}

function attachEvents() {
    document.getElementById('tabDiaria').onclick = () => { setTab('DIARIA'); };
    document.getElementById('tabPrn').onclick = () => { setTab('PRN'); };
    document.getElementById('tabLotes').onclick = () => { setTab('LOTES'); };
    document.getElementById('btnOpenModal').onclick = abrirModalEtiq;
    document.getElementById('btnCancelEtiq').onclick = () => { document.getElementById('modalEtiq').style.display='none'; };
    document.getElementById('btnCancelLote').onclick = () => { document.getElementById('modalLote').style.display='none'; };
    document.getElementById('formEtiq').onsubmit = guardarEtiq;
    document.getElementById('formLote').onsubmit = guardarLoteExcel;
    document.getElementById('btnPrint').onclick = imprimirVista;
    document.getElementById('btnDrive').onclick = generarDrive;
    document.getElementById('btnSuministros').onclick = imprimirSuministros;
    document.getElementById('btnEliminar').onclick = eliminarSeleccionados;
}

function setTab(t) {
    currentTab = t;
    currentSrv = "TODOS";
    document.getElementById('tabDiaria').className = "tab-btn" + (t==='DIARIA'?' active':'');
    document.getElementById('tabPrn').className = "tab-btn" + (t==='PRN'?' active-prn':'');
    document.getElementById('tabLotes').className = "tab-btn" + (t==='LOTES'?' active-lotes':'');
    render();
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

    const dataTab = etiquetas.filter(e => (e.TIPO || "DIARIA") === currentTab);
    const srvs = [...new Set(dataTab.map(e => e.SERVICIO))].sort();
    
    document.getElementById('listaServicios').innerHTML = `<div class="servicio-item ${currentSrv==='TODOS'?'active':''}" onclick="setSrv('TODOS')">TODOS <span>${dataTab.length}</span></div>` +
        srvs.map(s => `<div class="servicio-item ${currentSrv===s?'active':''}" onclick="setSrv('${s}')">${s} <span>${dataTab.filter(x=>x.SERVICIO===s).length}</span></div>`).join('');

    const final = currentSrv === "TODOS" ? dataTab : dataTab.filter(e => e.SERVICIO === currentSrv);
    if (final.length === 0) { main.innerHTML = '<div class="empty-state">Sin etiquetas</div>'; return; }

    const grupos = {};
    final.forEach(e => { const k = `Cama ${e.CAMA} - ${e.NOMBRE}`; if(!grupos[k]) grupos[k] = []; grupos[k].push(e); });

    main.innerHTML = Object.keys(grupos).sort().map(p => `
        <div class="grupo-paciente">
            <div class="header-paciente" style="border-color:${currentTab==='PRN'?'#e53935':'#1a73e8'}">${p}</div>
            <div class="table-responsive"><table class="med-table">
                <thead><tr><th></th><th>MEDICAMENTO</th><th>DOSIS</th><th>HR</th><th>VF</th><th></th></tr></thead>
                <tbody>${grupos[p].map(m => `
                    <tr>
                        <td><input type="checkbox" class="cb" data-id="${m.id}"></td>
                        <td><b>${m.MEDICAMENTO}</b></td>
                        <td>${m.DOSIS} ${m.UNIDADES}</td>
                        <td>${m.HORARIO}</td><td>${m['VOL FINAL']}ml</td>
                        <td style="white-space:nowrap">
                            <button onclick="mover('${m.id}')" style="border:none;background:none;cursor:pointer;"><i class="material-icons" style="font-size:18px">swap_horiz</i></button>
                            <button onclick="editEtiq('${m.id}')" style="border:none;background:none;cursor:pointer;"><i class="material-icons" style="font-size:18px">edit</i></button>
                        </td>
                    </tr>`).join('')}</tbody>
            </table></div>
        </div>`).join('');
}

function renderLotes() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `<div style="background:white;padding:15px;border-radius:8px;margin-bottom:10px;"><input type="text" id="busqLote" placeholder="Buscar medicamento..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;"></div><div id="contLotes"></div>`;
    document.getElementById('busqLote').oninput = (e) => { filterLotes(e.target.value); };
    filterLotes('');
}

function filterLotes(v) {
    const query = v.toUpperCase();
    const filtrados = dbMed.filter(m => m.MEDICAMENTO.includes(query));
    document.getElementById('contLotes').innerHTML = filtrados.map(m => {
        const cad = estaCaducado(m.CADUCIDAD);
        return `<div class="lote-list-item ${cad?'expired':''}">
            <div style="flex:1">
                <div style="font-weight:bold;">${m.MEDICAMENTO}</div>
                <div style="font-size:11px;color:#666">LOTE: ${m.LOTE} | <span class="${cad?'expired-text':''}">CAD: ${m.CADUCIDAD}</span></div>
            </div>
            <button onclick="abrirModalLote('${m.MEDICAMENTO}')" style="background:#e8f5e9;border:none;color:#34a853;padding:8px;border-radius:6px;font-weight:bold;cursor:pointer;">EDITAR</button>
        </div>`;
    }).join('');
}

function estaCaducado(s) {
    if(!s || s==="null") return false;
    const p = s.split('-'); if(p.length<2) return false;
    return new Date(p[0], p[1]-1, 1) < new Date(HOY_SISTEMA.getFullYear(), HOY_SISTEMA.getMonth(), 1);
}

// --- ACCIONES GLOBALES ---
window.setSrv = (s) => { currentSrv = s; render(); };

window.mover = async (id) => {
    const i = etiquetas.findIndex(x=>x.id===id);
    if(i>-1) { etiquetas[i].TIPO = etiquetas[i].TIPO === "DIARIA" ? "PRN" : "DIARIA"; render(); await push(); }
};

window.editEtiq = (id) => {
    const e = etiquetas.find(x=>x.id===id);
    if(e) {
        document.getElementById('etiqId').value = e.id;
        document.getElementById('in_cama').value = e.CAMA;
        document.getElementById('in_nombre').value = e.NOMBRE;
        document.getElementById('in_med').value = e.MEDICAMENTO;
        document.getElementById('in_dosis').value = e.DOSIS;
        document.getElementById('in_horario').value = e.HORARIO;
        document.getElementById('in_vf').value = e["VOL FINAL"];
        document.getElementById('divVF').style.display = 'block';
        document.getElementById('modalEtiq').style.display = 'flex';
    }
};

function abrirModalEtiq() {
    document.getElementById('etiqId').value = '';
    document.getElementById('formEtiq').reset();
    document.getElementById('divVF').style.display = 'none';
    document.getElementById('modalEtiq').style.display = 'flex';
}

window.abrirModalLote = (nom) => {
    const m = dbMed.find(x => x.MEDICAMENTO === nom);
    if(!m) return;
    document.getElementById('loteMedId').value = nom;
    document.getElementById('loteMedTitle').innerText = nom;
    document.getElementById('in_denom').value = m.DENOMINACION || "";
    document.getElementById('in_lote').value = m.LOTE || "";
    document.getElementById('in_cad').value = m.CADUCIDAD || "";
    document.getElementById('in_lab').value = m.LABORATORIO || "";
    document.getElementById('modalLote').style.display = 'flex';
};

async function guardarEtiq(ev) {
    ev.preventDefault();
    const med = document.getElementById('in_med').value.toUpperCase().trim();
    const conf = dbMed.find(m => m.MEDICAMENTO === med);
    if(!conf) return alert("Medicamento no existe");

    const dosis = parseFloat(document.getElementById('in_dosis').value);
    const id = document.getElementById('etiqId').value || Math.random().toString(36).substr(2, 9);
    
    const obj = {
        id, TIPO: currentTab, CAMA: document.getElementById('in_cama').value,
        NOMBRE: document.getElementById('in_nombre').value.toUpperCase(),
        MEDICAMENTO: conf.MEDICAMENTO, DOSIS: dosis, HORARIO: document.getElementById('in_horario').value,
        SERVICIO: calcularSrv(document.getElementById('in_cama').value),
        "VOL MED": calcVM(dosis, conf.PRESENTACION),
        "VOL FINAL": document.getElementById('in_vf').value || calcVF(dosis, conf.CONCENTRACION, conf.DILUYENTE),
        UNIDADES: conf.UNIDADES || "MG", VIA: conf.VIA || "IV", SOLUCION: conf.DILUYENTE || "",
        TIEMPO: conf.TIEMPO || "", fecha_registro: new Date().toISOString()
    };

    const idx = etiquetas.findIndex(x=>x.id===id);
    if(idx>-1) {
        const oC = etiquetas[idx].CAMA, oN = etiquetas[idx].NOMBRE;
        etiquetas[idx] = obj;
        etiquetas.forEach(eti => { if(eti.CAMA===oC && eti.NOMBRE===oN){ eti.CAMA=obj.CAMA; eti.NOMBRE=obj.NOMBRE; eti.SERVICIO=obj.SERVICIO; }});
    } else etiquetas.push(obj);

    document.getElementById('modalEtiq').style.display = 'none';
    render(); await push();
}

async function guardarLoteExcel(e) {
    e.preventDefault();
    const m = dbMed.find(x => x.MEDICAMENTO === document.getElementById('loteMedId').value);
    m.DENOMINACION = document.getElementById('in_denom').value.toUpperCase();
    m.LOTE = document.getElementById('in_lote').value.toUpperCase();
    m.CADUCIDAD = document.getElementById('in_cad').value;
    m.LABORATORIO = document.getElementById('in_lab').value.toUpperCase();
    
    bloqueoSinc = true;
    await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({action: "UPDATE_CONFIG", datos: [m]}), mode: 'no-cors'});
    document.getElementById('modalLote').style.display = 'none';
    bloqueoSinc = false; filterLotes('');
}

async function push() {
    bloqueoSinc = true;
    try { await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({action: "SYNC", datos: etiquetas}), mode: 'no-cors'}); }
    finally { bloqueoSinc = false; }
}

function calcVM(d, p) { let res = d/parseFloat(p); return isNaN(res)?0:(res<0.1?Math.round(res*100)/100:Math.round(res*10)/10); }
function calcVF(d, c, l) { let v = d/parseFloat(c); if(!l || l.trim()==="") return v; return v<=1?1:(v<=3?3:Math.ceil(v/5)*5); }
function calcularSrv(c) { 
    const n = Number(c); 
    if(n>=220 && n<=245) return "ONCO"; if(n>=501 && n<=521) return "INFECTO";
    if(n>=522 && n<=535) return "CIRUGIA"; if(n>=536 && n<=542) return "GASTRO";
    if(n>=543 && n<=549) return "TRAUMA"; if(n>=550 && n<=559) return "MED INT";
    return "URGENCIAS";
}

function imprimirVista() {
    const data = etiquetas.filter(e => (e.TIPO || "DIARIA") === currentTab && (currentSrv === "TODOS" || e.SERVICIO === currentSrv));
    if(data.length === 0) return;
    const hoy = new Date();
    const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const fStr = `${hoy.getDate().toString().padStart(2,'0')}-${meses[hoy.getMonth()]}-${hoy.getFullYear().toString().slice(-2)}`;
    let h = '<table class="print-table">';
    for (let i = 0; i < data.length; i += 4) {
        h += '<tr>';
        for (let j = 0; j < 4; j++) {
            if (i+j < data.length) {
                let et = data[i+j];
                let vm = (et["VOL MED"] && et["VOL MED"] != 0) ? ` - ${et["VOL MED"]}${et.SOLUCION ? " ML" : ""}` : "";
                h += `<td><div class="etiqueta-print">
                    <p class="bold">NOMBRE: ${et.NOMBRE}</p><p class="bold">SRV: ${et.SERVICIO} &nbsp; CAMA: ${et.CAMA}</p>
                    <p>FECHA: ${fStr} &nbsp; ${NOMBRE_QUIMICO}</p>
                    <p class="bold">${et.MEDICAMENTO} ${et.DOSIS} ${et.UNIDADES}${vm} ${et.VIA} ${et.TIEMPO ? "P/"+et.TIEMPO : ""}</p>
                    <p>${et.SOLUCION || ""}</p>
                    <p class="bold">VOL. FINAL: ${et['VOL FINAL']} ML &nbsp; HR: ${et.HORARIO || ""}</p>
                </div></td>`;
            } else h += '<td></td>';
        }
        h += '</tr>';
    }
    document.getElementById('printArea').innerHTML = h + '</table>';
    window.print();
}

function imprimirSuministros() {
    const data = etiquetas.filter(e => (e.TIPO || "DIARIA") === currentTab);
    if(data.length === 0) return;
    const cons = {}, jeringas = {"INSULINA":0,"3 ML":0,"5 ML":0,"10 ML":0,"20 ML":0};
    const sc = ['ERITROPOYETINA', 'FILGRASTIM', 'PEG-FILGRASTIM', 'ENOXAPARINA'];
    let cad = false;

    data.forEach(e => {
        cons[e.MEDICAMENTO] = (cons[e.MEDICAMENTO] || 0) + parseFloat(e.DOSIS);
        const vM = parseFloat(e["VOL MED"]) || 0, vF = parseFloat(e["VOL FINAL"]) || 0;
        if (sc.some(k => e.MEDICAMENTO.includes(k)) && vF <= 1) jeringas["INSULINA"]++;
        else {
            let vR = (vF <= 10) ? vF : (vM > 0 ? vM : vF);
            if(vR>10) jeringas["20 ML"]++; else if(vR>5) jeringas["10 ML"]++; else if(vR>3) jeringas["5 ML"]++; else if(vR>0) jeringas["3 ML"]++;
        }
    });

    let h = `<h2 style="text-align:center">SUMINISTROS - ${currentTab}</h2><table class="supply-table"><tr><th>MEDICAMENTO</th><th>TOTAL</th><th>LOTE</th><th>CAD</th></tr>`;
    Object.keys(cons).sort().forEach(m => {
        const info = dbMed.find(x => x.MEDICAMENTO === m) || {};
        const c = estaCaducado(info.CADUCIDAD); if(c) cad = true;
        h += `<tr class="${c?'expired-row':''}"><td>${m}</td><td>${cons[m]}</td><td>${info.LOTE||''}</td><td>${c?'• ':''}${info.CADUCIDAD||''}</td></tr>`;
    });
    h += `</table><h3>JERINGAS</h3><table class="supply-table" style="width:50%"><tr><th>TIPO</th><th>CANT</th></tr>`;
    for(let t in jeringas) if(jeringas[t]>0) h += `<tr><td>${t}</td><td>${jeringas[t]}</td></tr>`;
    h += '</table>';

    if(cad) alert("¡ATENCIÓN! MEDICAMENTOS CADUCADOS.");
    document.getElementById('printSupplies').innerHTML = h;
    window.print();
}

async function generarDrive() {
    const data = etiquetas.filter(e => e.TIPO === "DIARIA" && (currentSrv === "TODOS" || e.SERVICIO === currentSrv));
    if(data.length === 0) return alert("Solo Diarias");
    bloqueoSinc = true;
    await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({ action: "DOC", datos: data }), mode: 'no-cors' });
    alert("Enviado"); bloqueoSinc = false;
}

function eliminarSeleccionados() {
    const ids = Array.from(document.querySelectorAll('.cb:checked')).map(c => c.dataset.id);
    if(ids.length === 0) return;
    if(confirm("¿Eliminar?")) { etiquetas = etiquetas.filter(e => !ids.includes(e.id)); render(); push(); }
}

start();
