const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbyGMTI1Ftbe-Tc26QQxHY8io7ySfZydiM_Z6bOcpk08o725zLAfJia22ScQBUPPHY8j_Q/exec";

let etiquetas = [];
let dbMed = [];
let currentTab = "DIARIA";
let currentSrv = "TODOS";
let isSyncing = false;
let lastHash = "";

const HOY = new Date(2026, 2, 28); // Marzo 2026

// --- INICIO ---
async function start() {
    await fetchSync();
    setInterval(fetchSync, 4000);
    initButtons();
}

async function fetchSync() {
    if (isSyncing || document.querySelector('.overlay[style*="flex"]') || document.activeElement.tagName === 'INPUT') return;
    try {
        const res = await fetch(URL_SCRIPT);
        const data = await res.json();
        dbMed = data.medicamentos || [];
        const currentHash = JSON.stringify(data.activas);
        if (lastHash !== currentHash) {
            lastHash = currentHash;
            etiquetas = data.activas || [];
            render();
        }
        document.getElementById('dbStatus').innerText = "CONECTADO";
        
        const dl = document.getElementById('datalist-med');
        if (dl.options.length === 0) {
            dbMed.forEach(m => { let o = document.createElement('option'); o.value = m.MEDICAMENTO; dl.appendChild(o); });
        }
    } catch (e) { document.getElementById('dbStatus').innerText = "OFFLINE"; }
}

function render() {
    const main = document.getElementById('main-content');
    const side = document.getElementById('sidebar');
    const btnAdd = document.getElementById('btnAdd');
    const bBar = document.getElementById('bottom-bar');

    if (currentTab === "LOTES") {
        side.style.display = "none"; btnAdd.style.display = "none"; bBar.style.display = "none";
        renderLotes(); return;
    }

    side.style.display = "block"; btnAdd.style.display = "flex"; bBar.style.display = "flex";
    document.getElementById('btn-drive').style.display = (currentTab === "PRN") ? "none" : "flex";

    const dataTab = etiquetas.filter(e => (e.TIPO || "DIARIA") === currentTab);
    const srvs = [...new Set(dataTab.map(e => e.SERVICIO))].sort();
    
    document.getElementById('list-srv').innerHTML = `<div class="srv-item ${currentSrv==='TODOS'?'active':''}" onclick="setSrv('TODOS')">TODOS <span>${dataTab.length}</span></div>` +
        srvs.map(s => `<div class="srv-item ${currentSrv===s?'active':''}" onclick="setSrv('${s}')">${s} <span>${dataTab.filter(x=>x.SERVICIO===s).length}</span></div>`).join('');

    const final = currentSrv === "TODOS" ? dataTab : dataTab.filter(e => e.SERVICIO === currentSrv);
    const grupos = {};
    final.forEach(e => { const k = `Cama ${e.CAMA} - ${e.NOMBRE}`; if(!grupos[k]) grupos[k] = []; grupos[k].push(e); });

    main.innerHTML = Object.keys(grupos).sort().map(p => `
        <div class="card">
            <div class="card-header" style="border-color:${currentTab==='PRN'?'#d32f2f':'#1a73e8'}">${p}</div>
            <table class="med-table">
                ${grupos[p].map(m => `
                    <tr>
                        <td style="width:30px"><input type="checkbox" class="sel-cb" data-id="${m.id}"></td>
                        <td><b>${m.MEDICAMENTO}</b><br><small style="color:#888">${m.VIA}</small></td>
                        <td>${m.DOSIS} ${m.UNIDADES}</td>
                        <td>${m.HORARIO}</td>
                        <td style="text-align:right">
                            <button class="btn-row" onclick="moverTab('${m.id}')"><i class="material-icons">swap_horiz</i></button>
                            <button class="btn-row" onclick="editarEtiq('${m.id}')"><i class="material-icons">edit</i></button>
                        </td>
                    </tr>`).join('')}
            </table>
        </div>`).join('');
}

function renderLotes() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <input type="text" id="busq-lote" placeholder="Buscar medicamento..." style="width:100%; padding:15px; border-radius:8px; border:1px solid #ddd; margin-bottom:15px; box-sizing:border-box; font-size:16px;">
        <div id="lotes-list"></div>`;
    
    const input = document.getElementById('busq-lote');
    input.addEventListener('input', () => {
        const query = input.value.toUpperCase();
        const filtrados = dbMed.filter(m => m.MEDICAMENTO.includes(query));
        document.getElementById('lotes-list').innerHTML = filtrados.map(m => {
            const exp = isExpired(m.CADUCIDAD);
            return `
            <div class="lote-list-item ${exp?'expired':''}">
                <div>
                    <b>${m.MEDICAMENTO}</b><br>
                    <small>LOTE: ${m.LOTE || '---'} | <span class="${exp?'expired-text':''}">CAD: ${m.CADUCIDAD || '---'}</span></small>
                </div>
                <button class="btn" style="background:#e8f5e9; color:#34a853; padding:8px;" onclick="openLoteModal('${m.MEDICAMENTO}')">EDITAR</button>
            </div>`;
        }).join('');
    });
    input.dispatchEvent(new Event('input'));
}

// --- LOGICA DE SUMATORIA (EXACTA DEL SCRIPT) ---
function printSupplies() {
    const data = etiquetas.filter(e => e.TIPO === currentTab);
    if(data.length === 0) return alert("Sin datos");

    const consolidado = {};
    const jeringas = { "JERINGA DE INSULINA": 0, "JERINGA DE 3 ML": 0, "JERINGA DE 5 ML": 0, "JERINGA DE 10 ML": 0, "JERINGA DE 20 ML": 0 };
    const LISTA_SC = ['ERITROPOYETINA', 'FILGRASTIM', 'PEG-FILGRASTIM', 'ENOXAPARINA'];
    let alertCad = false;

    data.forEach(e => {
        const med = e.MEDICAMENTO.toUpperCase().trim();
        consolidado[med] = (consolidado[med] || 0) + parseFloat(e.DOSIS);
        
        // Lógica Jeringas
        const vM = parseFloat(e["VOL MED"]) || 0, vF = parseFloat(e["VOL FINAL"]) || 0;
        if (LISTA_SC.some(k => med.includes(k)) && vF <= 1.0) { jeringas["JERINGA DE INSULINA"]++; }
        else {
            let vR = (vF <= 10) ? vF : (vM > 0 ? vM : vF);
            let rem = vR;
            while(rem > 20) { jeringas["JERINGA DE 20 ML"]++; rem -= 20; }
            if(rem > 10) jeringas["JERINGA DE 20 ML"]++;
            else if(rem > 5) jeringas["JERINGA DE 10 ML"]++;
            else if(rem > 3) jeringas["JERINGA DE 5 ML"]++;
            else if(rem > 0) jeringas["JERINGA DE 3 ML"]++;
        }
    });

    let h = `<h2 style="text-align:center">REPORTE TÉCNICO DE SUMINISTROS (${currentTab})</h2>
             <table class="sum-table"><tr><th>MEDICAMENTO</th><th>TOTAL</th><th>DENOMINACIÓN</th><th>LOTE</th><th>CADUCIDAD</th><th>LABORATORIO</th></tr>`;
    
    Object.keys(consolidado).sort().forEach(m => {
        const info = dbMed.find(x => x.MEDICAMENTO === m) || {};
        const exp = isExpired(info.CADUCIDAD); if(exp) alertCad = true;
        h += `<tr class="${exp?'expired-row':''}"><td>${m}</td><td><b>${consolidado[m]}</b></td><td>${info.DENOMINACION||''}</td><td>${info.LOTE||''}</td><td>${exp?'• ':''}${info.CADUCIDAD||''}</td><td>${info.LABORATORIO||''}</td></tr>`;
    });
    h += `</table><h3>JERINGAS NECESARIAS</h3><table class="sum-table" style="width:50%"><tr><th>TIPO</th><th>CANTIDAD</th></tr>`;
    for(let t in jeringas) if(jeringas[t]>0) h += `<tr><td>${t}</td><td><b>${jeringas[t]}</b></td></tr>`;
    h += `</table>`;

    if(alertCad) alert("¡ATENCIÓN! MEDICAMENTOS CADUCADOS DETECTADOS.");
    document.getElementById('sumatoria-area').innerHTML = h;
    window.print();
    document.getElementById('sumatoria-area').innerHTML = ""; // Limpieza
}

// --- LOGICA DE ETIQUETAS (EXACTA DEL SCRIPT) ---
function printLabels() {
    const data = etiquetas.filter(e => (e.TIPO === currentTab) && (currentSrv === "TODOS" || e.SERVICIO === currentSrv));
    if(data.length === 0) return;
    
    const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const fStr = `${HOY.getDate().toString().padStart(2,'0')}-${meses[HOY.getMonth()]}-${HOY.getFullYear().toString().slice(-2)}`;
    
    let h = '<table class="label-grid">';
    for (let i = 0; i < data.length; i += 4) {
        h += '<tr>';
        for (let j = 0; j < 4; j++) {
            if (i+j < data.length) {
                let et = data[i+j];
                let vm = (et["VOL MED"] && et["VOL MED"] != "0") ? ` - ${et["VOL MED"]}${et.SOLUCION ? " ML" : ""}` : "";
                h += `<td class="label-cell">
                    <p><b>NOMBRE: ${et.NOMBRE}</b></p>
                    <p><b>SERVICIO: ${et.SERVICIO} &nbsp; CAMA: ${et.CAMA}</b></p>
                    <p>FECHA: ${fStr} &nbsp; E. RICARDO L.</p>
                    <p><b>${et.MEDICAMENTO} ${et.DOSIS} ${et.UNIDADES}${vm} ${et.VIA} ${et.TIEMPO ? "P/"+et.TIEMPO : ""}</b></p>
                    <p>${et.SOLUCION || ""}</p>
                    <p><b>VOL. FINAL: ${et["VOL FINAL"]} ML &nbsp; HORARIO: ${et.HORARIO || ""}</b></p>
                </td>`;
            } else h += '<td></td>';
        }
        h += '</tr>';
    }
    document.getElementById('print-area').innerHTML = h + '</table>';
    window.print();
    document.getElementById('print-area').innerHTML = ""; // Limpieza
}

// --- CRUD Y MODALES ---
window.saveEtiq = async (e) => {
    e.preventDefault();
    const med = document.getElementById('f-med').value.toUpperCase().trim();
    const config = dbMed.find(m => m.MEDICAMENTO === med);
    if(!config) return alert("No existe medicamento");

    const dosis = parseFloat(document.getElementById('f-dosis').value);
    const id = document.getElementById('f-id').value || Math.random().toString(36).substr(2, 9);
    
    const obj = {
        id, TIPO: currentTab, CAMA: document.getElementById('f-cama').value,
        NOMBRE: document.getElementById('f-nombre').value.toUpperCase(),
        MEDICAMENTO: med, DOSIS: dosis, HORARIO: document.getElementById('f-hora').value,
        SERVICIO: getSrv(document.getElementById('f-cama').value),
        "VOL MED": (dosis/parseFloat(config.PRESENTACION)).toFixed(1),
        "VOL FINAL": document.getElementById('f-vf').value || calcVF(dosis, config.CONCENTRACION, config.DILUYENTE),
        UNIDADES: config.UNIDADES || "MG", VIA: config.VIA || "IV", SOLUCION: config.DILUYENTE || "",
        TIEMPO: config.TIEMPO || "", fecha_registro: new Date().toISOString()
    };

    const idx = etiquetas.findIndex(x => x.id === id);
    if(idx > -1) {
        const oC = etiquetas[idx].CAMA, oN = etiquetas[idx].NOMBRE;
        etiquetas[idx] = obj;
        etiquetas.forEach(eti => { if(eti.CAMA===oC && eti.NOMBRE===oN){ eti.CAMA=obj.CAMA; eti.NOMBRE=obj.NOMBRE; eti.SERVICIO=obj.SERVICIO; }});
    } else etiquetas.push(obj);

    document.getElementById('modal-etiq').style.display = 'none';
    render(); await push();
};

async function push() {
    isSyncing = true;
    await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({action: "SYNC", datos: etiquetas}), mode: 'no-cors'});
    isSyncing = false;
}

// --- AUXILIARES ---
window.setTab = (t) => {
    currentTab = t; currentSrv = "TODOS";
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active', 'active-prn', 'active-lotes'));
    const activeClass = t === 'PRN' ? 'active-prn' : (t === 'LOTES' ? 'active-lotes' : 'active');
    document.getElementById(`tab-${t}`).classList.add(activeClass);
    render();
};

window.setSrv = (s) => { currentSrv = s; render(); };
function isExpired(s) { if(!s || s==="null") return false; const p = s.split('-'); return new Date(p[0], p[1]-1, 1) < new Date(HOY.getFullYear(), HOY.getMonth(), 1); }
function calcVF(d, c, l) { let v = d/parseFloat(c); if(!l) return v; return v<=1?1:(v<=3?3:Math.ceil(v/5)*5); }
function getSrv(c) { 
    const n = Number(c); 
    if(n>=220 && n<=245) return "ONCOLOGIA"; if(n>=501 && n<=521) return "INFECTOLOGIA";
    if(n>=522 && n<=535) return "CIRUGIA"; if(n>=536 && n<=542) return "GASTRO";
    if(n>=543 && n<=549) return "TRAUMATOLOGIA"; if(n>=550 && n<=559) return "MED INT";
    return "URGENCIAS";
}

// Inicializar eventos de botones fijos
function initButtons() {
    document.getElementById('btnSum').onclick = printSupplies;
    document.getElementById('btnDel').onclick = deleteSelected;
    document.getElementById('f-cama').oninput = (e) => {
        const ex = etiquetas.find(x => x.CAMA === e.target.value);
        if(ex) document.getElementById('f-nombre').value = ex.NOMBRE;
    };
}

window.openEtiqModal = () => {
    document.getElementById('form-etiq').reset();
    document.getElementById('f-id').value = "";
    document.getElementById('f-vf-box').style.display = "none";
    document.getElementById('modal-etiq').style.display = 'flex';
};

window.editarEtiq = (id) => {
    const e = etiquetas.find(x => x.id === id);
    document.getElementById('f-id').value = e.id;
    document.getElementById('f-cama').value = e.CAMA;
    document.getElementById('f-nombre').value = e.NOMBRE;
    document.getElementById('f-med').value = e.MEDICAMENTO;
    document.getElementById('f-dosis').value = e.DOSIS;
    document.getElementById('f-hora').value = e.HORARIO;
    document.getElementById('f-vf').value = e["VOL FINAL"];
    document.getElementById('f-vf-box').style.display = "block";
    document.getElementById('modal-etiq').style.display = 'flex';
};

window.openLoteModal = (nom) => {
    const m = dbMed.find(x => x.MEDICAMENTO === nom);
    document.getElementById('l-med-name').value = nom;
    document.getElementById('l-title').innerText = nom;
    document.getElementById('l-denom').value = m.DENOMINACION || "";
    document.getElementById('l-lote').value = m.LOTE || "";
    document.getElementById('l-cad').value = m.CADUCIDAD || "";
    document.getElementById('l-lab').value = m.LABORATORIO || "";
    document.getElementById('modal-lote').style.display = 'flex';
};

window.saveLote = async (e) => {
    e.preventDefault();
    const nom = document.getElementById('l-med-name').value;
    const m = dbMed.find(x => x.MEDICAMENTO === nom);
    m.DENOMINACION = document.getElementById('l-denom').value.toUpperCase();
    m.LOTE = document.getElementById('l-lote').value.toUpperCase();
    m.CADUCIDAD = document.getElementById('l-cad').value;
    m.LABORATORIO = document.getElementById('l-lab').value.toUpperCase();
    isSyncing = true;
    await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({action: "UPDATE_CONFIG", datos: [m]}), mode: 'no-cors'});
    isSyncing = false; closeModals(); renderLotes();
};

window.moverTab = async (id) => {
    const i = etiquetas.findIndex(x => x.id === id);
    etiquetas[i].TIPO = etiquetas[i].TIPO === "DIARIA" ? "PRN" : "DIARIA";
    render(); await push();
};

async function deleteSelected() {
    const ids = Array.from(document.querySelectorAll('.sel-cb:checked')).map(c => c.dataset.id);
    if(ids.length === 0 || !confirm("¿Eliminar seleccionados?")) return;
    etiquetas = etiquetas.filter(e => !ids.includes(e.id));
    render(); await push();
}

window.sendDrive = async () => {
    const data = etiquetas.filter(e => e.TIPO === "DIARIA" && (currentSrv === "TODOS" || e.SERVICIO === currentSrv));
    if(data.length === 0) return alert("Solo Diarias");
    document.getElementById('dbStatus').innerText = "GENERANDO DRIVE...";
    await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({ action: "DOC", datos: data }), mode: 'no-cors' });
    alert("Enviado a Drive"); document.getElementById('dbStatus').innerText = "CONECTADO";
};

start();
