const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbyGMTI1Ftbe-Tc26QQxHY8io7ySfZydiM_Z6bOcpk08o725zLAfJia22ScQBUPPHY8j_Q/exec";

let etiquetas = [];
let dbMed = [];
let currentTab = "DIARIA";
let currentSrv = "TODOS";
let bloqueoSinc = false;
let hashActual = "";

const HOY_REF = new Date(2026, 2, 28); // Referencia Marzo 2026

async function start() {
    await sync();
    ciclo();
    configEvents();
}

async function ciclo() {
    setTimeout(async () => {
        await sync();
        ciclo();
    }, 4000);
}

async function sync() {
    if (bloqueoSinc || document.querySelector('.modal-overlay[style*="flex"]') || document.activeElement.tagName === 'INPUT') return;
    try {
        const res = await fetch(URL_SCRIPT);
        const data = await res.json();
        dbMed = data.medicamentos || [];
        const nuevoHash = JSON.stringify(data.activas);
        if (hashActual !== nuevoHash) {
            hashActual = nuevoHash;
            etiquetas = data.activas || [];
            render();
        }
        document.getElementById('dbStatus').innerText = "CONECTADO";
        
        const dl = document.getElementById('listaMed');
        if (dl && dl.options.length === 0) {
            dbMed.forEach(m => { let o = document.createElement('option'); o.value = m.MEDICAMENTO; dl.appendChild(o); });
        }
    } catch (e) { document.getElementById('dbStatus').innerText = "RECONECTANDO..."; }
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
    if (final.length === 0) { main.innerHTML = '<div style="text-align:center; padding:50px; color:#999">No hay etiquetas</div>'; return; }

    const grupos = {};
    final.forEach(e => { const k = `Cama ${e.CAMA} - ${e.NOMBRE}`; if(!grupos[k]) grupos[k] = []; grupos[k].push(e); });

    main.innerHTML = Object.keys(grupos).sort().map(p => `
        <div class="grupo-paciente">
            <div class="header-paciente" style="border-bottom-color:${currentTab==='PRN'?'#e53935':'#1a73e8'}">${p}</div>
            <div class="table-responsive"><table class="med-table">
                <thead><tr><th style="width:30px"></th><th>MEDICAMENTO</th><th>DOSIS</th><th>HORA</th><th>VF</th><th style="text-align:right"></th></tr></thead>
                <tbody>${grupos[p].map(m => `
                    <tr>
                        <td><input type="checkbox" class="cb" data-id="${m.id}"></td>
                        <td><b>${m.MEDICAMENTO}</b> <br> <small style="color:#888">${m.VIA}</small></td>
                        <td>${m.DOSIS} ${m.UNIDADES}</td>
                        <td>${m.HORARIO}</td><td>${m['VOL FINAL']}ml</td>
                        <td style="text-align:right; white-space:nowrap">
                            <button class="btn-row" onclick="mover('${m.id}')"><i class="material-icons" style="font-size:20px">swap_horiz</i></button>
                            <button class="btn-row" onclick="editarEtiq('${m.id}')"><i class="material-icons" style="font-size:20px">edit</i></button>
                        </td>
                    </tr>`).join('')}</tbody>
            </table></div>
        </div>`).join('');
}

function renderLotes() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `<div style="background:white;padding:15px;border-radius:8px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <input type="text" id="busqLote" placeholder="Buscar medicamento..." style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:16px;">
    </div><div id="contLotes"></div>`;
    document.getElementById('busqLote').addEventListener('input', e => filterLotes(e.target.value));
    filterLotes('');
}

function filterLotes(v) {
    const query = v.toUpperCase();
    const filtrados = dbMed.filter(m => m.MEDICAMENTO.includes(query));
    document.getElementById('contLotes').innerHTML = filtrados.map(m => {
        const cad = estaCaducado(m.CADUCIDAD);
        return `<div class="lote-list-item ${cad?'expired':''}">
            <div style="flex:1">
                <div style="font-weight:bold; font-size:14px;">${m.MEDICAMENTO}</div>
                <div style="font-size:12px; color:#666; margin-top:3px;">LOTE: ${m.LOTE || '---'} | <span class="${cad?'expired-text':''}">CAD: ${m.CADUCIDAD || '---'}</span></div>
            </div>
            <button onclick="abrirModalLote('${m.MEDICAMENTO}')" style="background:#e8f5e9;border:none;color:#34a853;padding:10px 15px;border-radius:8px;font-weight:bold;cursor:pointer;">EDITAR</button>
        </div>`;
    }).join('');
}

function estaCaducado(s) {
    if(!s || s==="" || s==="null") return false;
    const p = s.split('-'); if(p.length<2) return false;
    return new Date(p[0], p[1]-1, 1) < new Date(HOY_REF.getFullYear(), HOY_REF.getMonth(), 1);
}

// --- LOGICA DE CAMA Y PACIENTE (MEMORIA) ---
document.getElementById('in_cama').addEventListener('input', e => {
    const v = e.target.value;
    const existe = etiquetas.find(et => et.CAMA === v);
    if(existe) document.getElementById('in_nombre').value = existe.NOMBRE;
});

function configEvents() {
    document.getElementById('tabDiaria').onclick = () => setTab('DIARIA');
    document.getElementById('tabPrn').onclick = () => setTab('PRN');
    document.getElementById('tabLotes').onclick = () => setTab('LOTES');
    document.getElementById('btnOpenModal').onclick = abrirModalEtiq;
    document.getElementById('btnCancelEtiq').onclick = () => document.getElementById('modalEtiq').style.display='none';
    document.getElementById('btnCancelLote').onclick = () => document.getElementById('modalLote').style.display='none';
    document.getElementById('formEtiq').onsubmit = guardarEtiq;
    document.getElementById('formLote').onsubmit = guardarLoteExcel;
    document.getElementById('btnPrint').onclick = imprimirVista;
    document.getElementById('btnDrive').onclick = generarDrive;
    document.getElementById('btnSuministros').onclick = imprimirSuministros;
    document.getElementById('btnEliminar').onclick = eliminarSeleccionados;
}

function setTab(t) {
    currentTab = t; currentSrv = "TODOS";
    document.getElementById('tabDiaria').className = "tab-btn" + (t==='DIARIA'?' active':'');
    document.getElementById('tabPrn').className = "tab-btn" + (t==='PRN'?' active-prn':'');
    document.getElementById('tabLotes').className = "tab-btn" + (t==='LOTES'?' active-lotes':'');
    render();
}

window.setSrv = (s) => { currentSrv = s; render(); };

function abrirModalEtiq() {
    document.getElementById('etiqId').value = '';
    document.getElementById('formEtiq').reset();
    document.getElementById('modalTitle').innerText = "Nueva Etiqueta - " + currentTab;
    document.getElementById('divVF').style.display = 'none';
    document.getElementById('modalEtiq').style.display = 'flex';
}

window.editarEtiq = (id) => {
    const e = etiquetas.find(x=>x.id===id);
    if(e) {
        document.getElementById('etiqId').value = e.id;
        document.getElementById('in_cama').value = e.CAMA;
        document.getElementById('in_nombre').value = e.NOMBRE;
        document.getElementById('in_med').value = e.MEDICAMENTO;
        document.getElementById('in_dosis').value = e.DOSIS;
        document.getElementById('in_horario').value = e.HORARIO;
        document.getElementById('in_vf').value = e["VOL FINAL"];
        document.getElementById('modalTitle').innerText = "Editar Etiqueta";
        document.getElementById('divVF').style.display = 'block';
        document.getElementById('modalEtiq').style.display = 'flex';
    }
}

async function guardarEtiq(ev) {
    ev.preventDefault();
    const med = document.getElementById('in_med').value.toUpperCase().trim();
    const conf = dbMed.find(m => m.MEDICAMENTO === med);
    if(!conf) return alert("Medicamento no existe en base.");

    const dosis = parseFloat(document.getElementById('in_dosis').value);
    const id = document.getElementById('etiqId').value || Math.random().toString(36).substr(2, 9);
    
    const obj = {
        id, TIPO: currentTab, 
        CAMA: document.getElementById('in_cama').value,
        NOMBRE: document.getElementById('in_nombre').value.toUpperCase().trim(),
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
        // LOGICA DOMINO
        etiquetas.forEach(eti => { if(eti.CAMA===oC && eti.NOMBRE===oN){ eti.CAMA=obj.CAMA; eti.NOMBRE=obj.NOMBRE; eti.SERVICIO=obj.SERVICIO; }});
    } else etiquetas.push(obj);

    document.getElementById('modalEtiq').style.display = 'none';
    render(); await push();
}

window.abrirModalLote = (nom) => {
    const m = dbMed.find(x => x.MEDICAMENTO === nom);
    if(!m) return;
    document.getElementById('loteMedId').value = nom;
    document.getElementById('loteMedTitle').innerText = nom;
    document.getElementById('in_denom').value = m.DENOMINACION;
    document.getElementById('in_lote').value = m.LOTE;
    document.getElementById('in_cad').value = m.CADUCIDAD;
    document.getElementById('in_lab').value = m.LABORATORIO;
    document.getElementById('modalLote').style.display = 'flex';
}

async function guardarLoteExcel(e) {
    e.preventDefault();
    const m = dbMed.find(x => x.MEDICAMENTO === document.getElementById('loteMedId').value);
    m.DENOMINACION = document.getElementById('in_denom').value.toUpperCase();
    m.LOTE = document.getElementById('in_lote').value.toUpperCase();
    m.CADUCIDAD = document.getElementById('in_cad').value;
    m.LABORATORIO = document.getElementById('in_lab').value.toUpperCase();
    
    document.getElementById('dbStatus').innerText = "GUARDANDO...";
    bloqueoSinc = true;
    await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({action: "UPDATE_CONFIG", datos: [m]}), mode: 'no-cors'});
    document.getElementById('modalLote').style.display = 'none';
    bloqueoSinc = false; render();
}

// --- LOGICA JERINGAS ---
function imprimirSuministros() {
    const data = etiquetas.filter(e => e.TIPO === currentTab);
    if(data.length === 0) return alert("No hay datos");
    const cons = {}, jeringas = {"JERINGA DE INSULINA":0,"JERINGA DE 3 ML":0,"JERINGA DE 5 ML":0,"JERINGA DE 10 ML":0,"JERINGA DE 20 ML":0};
    const scList = ['ERITROPOYETINA', 'FILGRASTIM', 'PEG-FILGRASTIM', 'ENOXAPARINA'];
    let hasExpired = false;

    data.forEach(e => {
        cons[e.MEDICAMENTO] = (cons[e.MEDICAMENTO] || 0) + parseFloat(e.DOSIS);
        const vMed = parseFloat(e["VOL MED"]) || 0, vFin = parseFloat(e["VOL FINAL"]) || 0;
        if (scList.some(k => e.MEDICAMENTO.includes(k)) && vFin <= 1) jeringas["JERINGA DE INSULINA"]++;
        else {
            let vRef = (vFin <= 10) ? vFin : (vMed > 0 ? vMed : vFin);
            let rest = vRef;
            while(rest > 20){ jeringas["JERINGA DE 20 ML"]++; rest -= 20; }
            if(rest > 10) jeringas["JERINGA DE 20 ML"]++;
            else if(rest > 5) jeringas["JERINGA DE 10 ML"]++;
            else if(rest > 3) jeringas["JERINGA DE 5 ML"]++;
            else if(rest > 0) jeringas["JERINGA DE 3 ML"]++;
        }
    });

    const hoy = new Date();
    let html = `<h2 style="text-align:center">SUMINISTROS - ${currentTab}</h2><p style="text-align:center">${hoy.toLocaleString()}</p>`;
    html += `<table class="supply-table"><tr><th>MEDICAMENTO</th><th>TOTAL</th><th>DENOMINACIÓN</th><th>LOTE</th><th>CAD</th><th>LAB</th></tr>`;
    Object.keys(cons).sort().forEach(m => {
        const info = dbMed.find(x => x.MEDICAMENTO === m) || {};
        const isExp = estaCaducado(info.CADUCIDAD); if(isExp) hasExpired = true;
        html += `<tr class="${isExp?'expired-row':''}"><td>${m}</td><td><b>${Math.round(cons[m]*100)/100}</b></td><td>${info.DENOMINACION||''}</td><td>${info.LOTE||''}</td><td>${isExp?'• ':''}${info.CADUCIDAD||''}</td><td>${info.LABORATORIO||''}</td></tr>`;
    });
    html += '</table><h3>JERINGAS</h3><table class="supply-table" style="width:50%"><tr><th>TIPO</th><th>PIEZAS</th></tr>';
    for(let t in jeringas) if(jeringas[t]>0) html += `<tr><td>${t}</td><td><b>${jeringas[t]}</b></td></tr>`;
    html += '</table>';

    if(hasExpired) alert("¡ALERTA! HAY MEDICAMENTOS CADUCADOS EN EL REPORTE.");
    document.getElementById('printSupplies').innerHTML = html;
    window.print();
}

// --- AUXILIARES ---
async function push() { bloqueoSinc = true; await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({action: "SYNC", datos: etiquetas}), mode: 'no-cors'}); bloqueoSinc = false; }
function calcVM(d, p) { let r = d/parseFloat(p); return isNaN(r)?0:(r<0.1?Math.round(r*100)/100:Math.round(r*10)/10); }
function calcVF(d, c, l) { let v = d/parseFloat(c); if(!l || l.trim()==="") return v; return v<=1?1:(v<=3?3:Math.ceil(v/5)*5); }
function calcularSrv(c) { const n = Number(c); if(n>=220 && n<=245) return "ONCOLOGIA"; if(n>=501 && n<=521) return "INFECTOLOGIA"; if(n>=522 && n<=535) return "CIRUGIA"; if(n>=536 && n<=542) return "GASTRO"; if(n>=543 && n<=549) return "TRAUMATOLOGIA"; if(n>=550 && n<=559) return "MED INT"; return "URGENCIAS"; }

window.mover = async (id) => { const i = etiquetas.findIndex(x=>x.id===id); if(i>-1) { etiquetas[i].TIPO = etiquetas[i].TIPO === "DIARIA" ? "PRN" : "DIARIA"; render(); await push(); }};

function imprimirVista() {
    const data = etiquetas.filter(e => (e.TIPO || "DIARIA") === currentTab && (currentSrv === "TODOS" || e.SERVICIO === currentSrv));
    if(data.length === 0) return;
    const hoy = new Date(), meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
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

async function generarDrive() {
    const data = etiquetas.filter(e => (e.TIPO || "DIARIA") === "DIARIA" && (currentSrv === "TODOS" || e.SERVICIO === currentSrv));
    if(data.length === 0) return alert("Solo Diarias");
    document.getElementById('dbStatus').innerText = "GENERANDO...";
    bloqueoSinc = true;
    await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({ action: "DOC", datos: data }), mode: 'no-cors' });
    alert("Enviado"); bloqueoSinc = false; sync();
}

function eliminarSeleccionados() {
    const ids = Array.from(document.querySelectorAll('.cb:checked')).map(c => c.dataset.id);
    if(ids.length === 0) return alert("Selecciona etiquetas");
    if(confirm("¿Eliminar?")) { etiquetas = etiquetas.filter(e => !ids.includes(e.id)); render(); push(); }
}

start();
