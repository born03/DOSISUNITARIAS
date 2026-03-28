// ==========================================
// CONFIGURACIÓN Y ESTADO
// ==========================================
const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbyGMTI1Ftbe-Tc26QQxHY8io7ySfZydiM_Z6bOcpk08o725zLAfJia22ScQBUPPHY8j_Q/exec";

let etiquetas = [];
let dbMed = [];
let currentTab = "DIARIA";
let currentSrv = "TODOS";
let bloqueoSinc = false;
let ultimaDataHash = ""; // Para comparar si algo cambió de verdad

const HOY_SISTEMA = new Date(2026, 2, 28); 
const NOMBRE_QUIMICO = "E. RICARDO L.";

// Elementos UI frecuentes
const modalEtiq = document.getElementById('modalEtiq');
const dbStatus = document.getElementById('dbStatus');
const syncIcon = document.getElementById('syncIcon');

// ==========================================
// MOTOR DE SINCRONIZACIÓN OPTIMIZADO
// ==========================================
async function startApp() {
    await sync(); 
    cicloSincronizacion(); // Inicia el ciclo inteligente
}
startApp();

async function cicloSincronizacion() {
    // Espera 4 segundos ANTES de la siguiente vuelta
    await new Promise(res => setTimeout(res, 4000));
    await sync();
    cicloSincronizacion(); // Se rellama a sí misma
}

async function sync() {
    // Si el usuario está interactuando, pausamos la descarga para evitar lag
    if (bloqueoSinc || modalEtiq.style.display === 'flex' || document.activeElement.tagName === 'INPUT') {
        return;
    }

    try {
        const res = await fetch(URL_SCRIPT);
        const data = await res.json();
        
        if (data.error) {
            dbStatus.innerText = "ERROR GOOGLE";
            return;
        }

        dbMed = data.medicamentos || [];
        
        // COMPARACIÓN INTELIGENTE: ¿Realmente cambió algo?
        const nuevaDataStr = JSON.stringify(data.activas);
        if (ultimaDataHash !== nuevaDataStr) {
            ultimaDataHash = nuevaDataStr;
            etiquetas = data.activas || [];
            render(); // Solo redibuja si hay cambios reales
        }
        
        dbStatus.innerText = "SINCRO OK";

        // Llenar lista de medicamentos una sola vez
        const dl = document.getElementById('listaMed');
        if (dl && dl.options.length === 0 && dbMed.length > 0) {
            const fragment = document.createDocumentFragment();
            dbMed.forEach(m => {
                let o = document.createElement('option');
                o.value = m.MEDICAMENTO;
                fragment.appendChild(o);
            });
            dl.appendChild(fragment);
        }
    } catch (e) {
        dbStatus.innerText = "RECONECTANDO...";
    }
}

// ==========================================
// RENDERIZADO EFICIENTE
// ==========================================
function render() {
    const main = document.getElementById('mainContent');
    const bBar = document.getElementById('bottomBar');
    const fab = document.getElementById('btnOpenModal');

    if (currentTab === "LOTES") {
        document.getElementById('sidebar').style.display = "none";
        fab.style.display = "none";
        bBar.style.display = "none";
        renderLotes();
        return;
    }

    document.getElementById('sidebar').style.display = "block";
    fab.style.display = "flex";
    bBar.style.display = "flex";
    document.getElementById('btnDrive').style.display = (currentTab === "PRN") ? "none" : "flex";

    const dataTab = etiquetas.filter(e => (e.TIPO || "DIARIA") === currentTab);
    
    // Actualizar Sidebar solo si es necesario
    const srvs = [...new Set(dataTab.map(e => e.SERVICIO))].sort();
    let htmlServicios = `<div class="servicio-item ${currentSrv==='TODOS'?'active':''}" onclick="setSrv('TODOS')">TODOS <span>${dataTab.length}</span></div>`;
    srvs.forEach(s => {
        const count = dataTab.filter(x=>x.SERVICIO===s).length;
        htmlServicios += `<div class="servicio-item ${currentSrv===s?'active':''}" onclick="setSrv('${s}')">${s} <span>${count}</span></div>`;
    });
    document.getElementById('listaServicios').innerHTML = htmlServicios;

    const finalData = currentSrv === "TODOS" ? dataTab : dataTab.filter(e => e.SERVICIO === currentSrv);
    
    if (finalData.length === 0) {
        main.innerHTML = '<div class="empty-state">No hay pacientes en esta vista</div>';
        return;
    }

    // Agrupar por paciente
    const grupos = {};
    finalData.forEach(e => {
        const k = `Cama ${e.CAMA} - ${e.NOMBRE}`;
        if(!grupos[k]) grupos[k] = [];
        grupos[k].push(e);
    });

    // Construir HTML de pacientes
    let htmlFinal = "";
    Object.keys(grupos).sort().forEach(p => {
        htmlFinal += `
        <div class="grupo-paciente">
            <div class="header-paciente" style="border-color:${currentTab==='PRN'?'#e53935':'#1a73e8'}">${p}</div>
            <div class="table-responsive"><table class="med-table">
                <thead><tr><th></th><th>MEDICAMENTO</th><th>DOSIS</th><th>HORA</th><th>VF</th><th></th></tr></thead>
                <tbody>
                ${grupos[p].map(m => `
                    <tr>
                        <td><input type="checkbox" class="cb" data-id="${m.id}"></td>
                        <td><b>${m.MEDICAMENTO}</b> <small style="color:#999">(${m.VIA})</small></td>
                        <td>${m.DOSIS} <small>${m.UNIDADES}</small></td>
                        <td>${m.HORARIO || ""}</td>
                        <td>${m['VOL FINAL']}ml</td>
                        <td style="white-space:nowrap">
                            <button class="btn-swap" onclick="mover('${m.id}')"><i class="material-icons" style="font-size:18px">swap_horiz</i></button>
                            <button class="btn-edit" onclick="editEtiq('${m.id}')"><i class="material-icons" style="font-size:18px">edit</i></button>
                        </td>
                    </tr>
                `).join('')}
                </tbody>
            </table></div>
        </div>`;
    });
    main.innerHTML = htmlFinal;
}

// ==========================================
// LOTES Y CADUCIDAD
// ==========================================
function renderLotes() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div style="background:white; padding:15px; border-radius:8px; margin-bottom:15px; box-shadow:0 1px 3px rgba(0,0,0,0.1)">
            <input type="text" id="busqLote" placeholder="Buscar medicamento..." oninput="filterLotes(this.value)" 
                   style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; font-size:16px; box-sizing:border-box;">
        </div>
        <div id="contLotes"></div>
    `;
    filterLotes('');
}

window.filterLotes = (v) => {
    const cont = document.getElementById('contLotes');
    const query = v.toUpperCase();
    const filtrados = dbMed.filter(m => m.MEDICAMENTO.includes(query));
    
    cont.innerHTML = filtrados.map(m => {
        const caducado = estaCaducado(m.CADUCIDAD);
        return `
        <div class="lote-list-item ${caducado ? 'expired' : ''}">
            <div style="flex:1">
                <div style="font-weight:bold; font-size:14px;">${m.MEDICAMENTO}</div>
                <div style="font-size:12px; color:#5f6368;">LOTE: ${m.LOTE || '---'} | LAB: ${m.LABORATORIO || '---'}</div>
                <div style="font-size:12px;" class="${caducado ? 'expired-text' : ''}">CAD: ${m.CADUCIDAD || '---'}</div>
            </div>
            <button onclick="abrirModalLote('${m.MEDICAMENTO}')" style="background:#e8f5e9; border:none; color:#34a853; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer;">EDITAR</button>
        </div>`;
    }).join('');
}

function estaCaducado(cadStr) {
    if (!cadStr || cadStr === "" || cadStr === "null") return false;
    const parts = cadStr.split('-');
    if (parts.length < 2) return false;
    const fechaCad = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    const fechaHoy = new Date(HOY_SISTEMA.getFullYear(), HOY_SISTEMA.getMonth(), 1);
    return fechaCad < fechaHoy;
}

// ==========================================
// FUNCIONES CRUD Y NUBE
// ==========================================
async function push() {
    bloqueoSinc = true;
    syncIcon.style.display = "inline-block";
    try {
        await fetch(URL_SCRIPT, { 
            method: 'POST', 
            body: JSON.stringify({action: "SYNC", datos: etiquetas}), 
            mode: 'no-cors'
        });
        dbStatus.innerText = "GUARDADO";
    } catch (e) {
        dbStatus.innerText = "ERROR GUARDADO";
    } finally {
        bloqueoSinc = false;
        syncIcon.style.display = "none";
    }
}

window.guardarEtiq = async (ev) => {
    ev.preventDefault();
    const medNom = document.getElementById('in_med').value.toUpperCase().trim();
    const config = dbMed.find(m => m.MEDICAMENTO.toUpperCase().trim() === medNom);
    
    if(!config) return alert("Medicamento no encontrado");

    const dosisNum = parseFloat(document.getElementById('in_dosis').value);
    const id = document.getElementById('etiqId').value || Math.random().toString(36).substr(2, 9);
    
    const obj = {
        id: id,
        TIPO: currentTab,
        CAMA: document.getElementById('in_cama').value.toString(),
        NOMBRE: document.getElementById('in_nombre').value.toUpperCase().trim(),
        MEDICAMENTO: config.MEDICAMENTO,
        DOSIS: dosisNum,
        HORARIO: document.getElementById('in_horario').value.toString(),
        SERVICIO: calcularServicio(document.getElementById('in_cama').value),
        "VOL MED": calcularVolMed(dosisNum, config.PRESENTACION),
        "VOL FINAL": document.getElementById('in_vf').value || calcularVolFinal(dosisNum, config.CONCENTRACION, config.DILUYENTE),
        UNIDADES: config.UNIDADES || "MG", 
        VIA: config.VIA || "IV",
        SOLUCION: config.DILUYENTE || "", 
        TIEMPO: config.TIEMPO || "",
        fecha_registro: new Date().toISOString()
    };

    const idx = etiquetas.findIndex(x => x.id === id);
    if(idx > -1) {
        const viejaCama = etiquetas[idx].CAMA;
        const viejoNombre = etiquetas[idx].NOMBRE;
        etiquetas[idx] = obj;
        // Efecto dominó
        etiquetas.forEach(eti => {
            if(eti.CAMA === viejaCama && eti.NOMBRE === viejoNombre) {
                eti.CAMA = obj.CAMA; eti.NOMBRE = obj.NOMBRE; eti.SERVICIO = obj.SERVICIO;
            }
        });
    } else {
        etiquetas.push(obj);
    }
    
    document.getElementById('modalEtiq').style.display = 'none';
    render(); 
    await push();
}

// ==========================================
// CALCULOS MATEMÁTICOS
// ==========================================
function calcularVolMed(dosis, pres) {
    let p = parseFloat(pres);
    if (!p || p === 0) return 0;
    let res = dosis / p;
    return res < 0.1 ? Math.round(res * 100) / 100 : Math.round(res * 10) / 10;
}

function calcularVolFinal(dosis, conc, dilu) {
    let c = parseFloat(conc);
    if (!c || c === 0) return 10;
    let div = dosis / c;
    if (!dilu || dilu.trim() === "") return div;
    if (div <= 1) return 1;
    if (div <= 3) return 3;
    return Math.ceil(div / 5) * 5;
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

// ==========================================
// ACCIONES DE INTERFAZ (BOTONES)
// ==========================================
window.setSrv = (s) => { currentSrv = s; render(); }

window.cambiarTab = (t) => {
    currentTab = t;
    document.getElementById('tabDiaria').className = currentTab === 'DIARIA' ? 'tab-btn active' : 'tab-btn';
    document.getElementById('tabPrn').className = currentTab === 'PRN' ? 'tab-btn active-prn' : 'tab-btn';
    document.getElementById('tabLotes').className = currentTab === 'LOTES' ? 'tab-btn active-lotes' : 'tab-btn';
    currentSrv = "TODOS";
    render();
}

window.mover = async (id) => { 
    const i = etiquetas.findIndex(x=>x.id===id); 
    if(i>-1){ 
        etiquetas[i].TIPO = etiquetas[i].TIPO === "DIARIA" ? "PRN" : "DIARIA"; 
        render(); 
        await push(); 
    }
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
        document.getElementById('in_vf').value = e["VOL FINAL"];
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

window.abrirModalLote = (nom) => {
    const m = dbMed.find(x => x.MEDICAMENTO === nom);
    if(!m) return;
    document.getElementById('loteMedTitle').innerText = nom;
    document.getElementById('loteMedId').value = nom;
    document.getElementById('in_denom').value = m.DENOMINACION || "";
    document.getElementById('in_lote').value = m.LOTE || "";
    document.getElementById('in_cad').value = m.CADUCIDAD || "";
    document.getElementById('in_lab').value = m.LABORATORIO || "";
    document.getElementById('modalLote').style.display = 'flex';
}

window.guardarLoteExcel = async (e) => {
    e.preventDefault();
    bloqueoSinc = true;
    const nom = document.getElementById('loteMedId').value;
    const m = dbMed.find(x => x.MEDICAMENTO === nom);
    
    m.DENOMINACION = document.getElementById('in_denom').value.toUpperCase();
    m.LOTE = document.getElementById('in_lote').value.toUpperCase();
    m.CADUCIDAD = document.getElementById('in_cad').value;
    m.LABORATORIO = document.getElementById('in_lab').value.toUpperCase();

    try {
        await fetch(URL_SCRIPT, { 
            method: 'POST', 
            body: JSON.stringify({action: "UPDATE_CONFIG", datos: [m]}), 
            mode: 'no-cors'
        });
        document.getElementById('modalLote').style.display = 'none';
        renderLotes();
    } catch (err) {
        alert("Error al conectar con Google");
    } finally {
        bloqueoSinc = false;
    }
}

// ==========================================
// IMPRESIÓN Y DRIVE
// ==========================================
window.imprimirVista = () => {
    const data = etiquetas.filter(e => (e.TIPO || "DIARIA") === currentTab && (currentSrv === "TODOS" || e.SERVICIO === currentSrv));
    if (data.length === 0) return alert("No hay datos en esta vista");
    
    const hoy = new Date();
    const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const fechaStr = `${hoy.getDate().toString().padStart(2,'0')}-${meses[hoy.getMonth()]}-${hoy.getFullYear().toString().slice(-2)}`;
    
    let html = '<table class="print-table">';
    for (let i = 0; i < data.length; i += 4) {
        html += '<tr>';
        for (let j = 0; j < 4; j++) {
            if (i + j < data.length) {
                let etiq = data[i+j];
                let vMedStr = (etiq["VOL MED"] && etiq["VOL MED"] != 0) ? ` - ${etiq["VOL MED"]}${etiq.SOLUCION ? " ML" : ""}` : "";
                html += `<td><div class="etiqueta-print">
                    <p class="bold">NOMBRE: ${etiq.NOMBRE}</p><p class="bold">SRV: ${etiq.SERVICIO} &nbsp; CAMA: ${etiq.CAMA}</p>
                    <p>FECHA: ${fechaStr} &nbsp; ${NOMBRE_QUIMICO}</p>
                    <p class="bold">${etiq.MEDICAMENTO} ${etiq.DOSIS}${etiq.UNIDADES}${vMedStr} ${etiq.VIA} ${etiq.TIEMPO ? "P/"+etiq.TIEMPO : ""}</p>
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
    const data = etiquetas.filter(e => (e.TIPO || "DIARIA") === "DIARIA" && (currentSrv === "TODOS" || e.SERVICIO === currentSrv));
    if (data.length === 0) return alert("Solo se envían Dosis Diarias al Drive.");
    
    bloqueoSinc = true;
    dbStatus.innerText = "SUBIENDO A DRIVE...";
    try {
        await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({ action: "DOC", datos: data }), mode: 'no-cors' });
        alert("Enviado a Drive.");
    } catch(e) {
        alert("Error al conectar");
    } finally {
        bloqueoSinc = false;
        sync();
    }
}

document.getElementById('btnEliminar').addEventListener('click', async () => {
    const boxes = document.querySelectorAll('.cb:checked');
    if(boxes.length === 0) return alert("Selecciona etiquetas");
    if(!confirm(`¿Eliminar ${boxes.length} etiquetas?`)) return;
    
    const ids = Array.from(boxes).map(cb => cb.dataset.id);
    etiquetas = etiquetas.filter(e => !ids.includes(e.id));
    render(); 
    await push();
});

// Botón Suministros (Lógica Compacta)
document.getElementById('btnSuministros').addEventListener('click', () => {
    const data = etiquetas.filter(e => (e.TIPO || "DIARIA") === currentTab);
    if(data.length === 0) return alert("Sin datos.");
    const cons = {};
    const jeringas = { "INSULINA": 0, "3 ML": 0, "5 ML": 0, "10 ML": 0, "20 ML": 0 };
    const keywordsSC = ['ERITROPOYETINA', 'FILGRASTIM', 'PEG-FILGRASTIM', 'ENOXAPARINA'];
    let hayCad = false;

    data.forEach(e => {
        cons[e.MEDICAMENTO] = (cons[e.MEDICAMENTO] || 0) + parseFloat(e.DOSIS);
        const vMed = parseFloat(e["VOL MED"]) || 0;
        const vFin = parseFloat(e["VOL FINAL"]) || 0;
        if (keywordsSC.some(k => e.MEDICAMENTO.includes(k)) && vFin <= 1) jeringas["INSULINA"]++;
        else {
            let vRef = (vFin <= 10) ? vFin : (vMed > 0 ? vMed : vFin);
            if (vRef > 10) jeringas["20 ML"]++;
            else if (vRef > 5) jeringas["10 ML"]++;
            else if (vRef > 3) jeringas["5 ML"]++;
            else if (vRef > 0) jeringas["3 ML"]++;
        }
    });

    let html = `<h2 style="text-align:center">SUMINISTROS - ${currentTab}</h2><table class="supply-table"><tr><th>MEDICAMENTO</th><th>TOTAL</th><th>LOTE</th><th>CAD</th></tr>`;
    Object.keys(cons).sort().forEach(m => {
        const info = dbMed.find(x => x.MEDICAMENTO === m) || {};
        const c = estaCaducado(info.CADUCIDAD); if(c) hayCad = true;
        html += `<tr class="${c?'expired-row':''}"><td>${m}</td><td>${cons[m]}</td><td>${info.LOTE||''}</td><td>${c?'• ':''}${info.CADUCIDAD||''}</td></tr>`;
    });
    html += `</table><h3>JERINGAS</h3><table class="supply-table"><tr><th>TIPO</th><th>CANT</th></tr>`;
    for(let t in jeringas) if(jeringas[t]>0) html += `<tr><td>${t}</td><td>${jeringas[t]}</td></tr>`;
    html += `</table>`;

    if(hayCad) alert("¡ATENCIÓN! MEDICAMENTOS CADUCADOS DETECTADOS.");
    document.getElementById('printSupplies').innerHTML = html;
    window.print();
});
