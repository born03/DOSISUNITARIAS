const URL_API = "https://script.google.com/macros/s/AKfycbyGMTI1Ftbe-Tc26QQxHY8io7ySfZydiM_Z6bOcpk08o725zLAfJia22ScQBUPPHY8j_Q/exec";

let listaEtiquetas = [];
let baseMedicamentos = [];
let pestañaActual = "DIARIA";
let servicioActual = "TODOS";
let sincronizando = false;
let hashAnterior = "";

const HOY = new Date(2026, 2, 28); // Referencia

// --- INICIO ---
async function iniciar() {
    await descargar();
    setInterval(descargar, 4000);
    configurarEntradas();
}
iniciar();

async function descargar() {
    if (sincronizando || document.querySelector('.overlay[style*="flex"]') || document.activeElement.tagName === 'INPUT') return;
    try {
        const res = await fetch(URL_API);
        const data = await res.json();
        baseMedicamentos = data.medicamentos || [];
        const nuevoHash = JSON.stringify(data.activas);
        if (hashAnterior !== nuevoHash) {
            hashAnterior = nuevoHash;
            listaEtiquetas = data.activas || [];
            dibujarInterfaz();
        }
        document.getElementById('dbStatus').innerText = "ONLINE";
        const dl = document.getElementById('lista-meds');
        if (dl.options.length === 0) {
            baseMedicamentos.forEach(m => { let o = document.createElement('option'); o.value = m.MEDICAMENTO; dl.appendChild(o); });
        }
    } catch (e) { document.getElementById('dbStatus').innerText = "OFFLINE"; }
}

function dibujarInterfaz() {
    const main = document.getElementById('listado-pacientes');
    const side = document.getElementById('sidebar');
    const fab = document.getElementById('btnFAB');
    const bBar = document.getElementById('barra-inferior');

    if (pestañaActual === "LOTES") {
        side.style.display = "none"; fab.style.display = "none"; bBar.style.display = "none";
        dibujarLotes(); return;
    }

    side.style.display = "block"; fab.style.display = "flex"; bBar.style.display = "flex";
    document.getElementById('btnDrive').style.display = (pestañaActual === "PRN") ? "none" : "flex";

    const datosTab = listaEtiquetas.filter(e => (e.TIPO || "DIARIA") === pestañaActual);
    const srvs = [...new Set(datosTab.map(e => e.SERVICIO))].sort();
    
    document.getElementById('listado-servicios').innerHTML = `<div class="srv-item ${servicioActual==='TODOS'?'active':''}" onclick="filtrarSrv('TODOS')">TODOS <span>${datosTab.length}</span></div>` +
        srvs.map(s => `<div class="srv-item ${servicioActual===s?'active':''}" onclick="filtrarSrv('${s}')">${s} <span>${datosTab.filter(x=>x.SERVICIO===s).length}</span></div>`).join('');

    const final = servicioActual === "TODOS" ? datosTab : datosTab.filter(e => e.SERVICIO === servicioActual);
    const grupos = {};
    final.forEach(e => { const k = `Cama ${e.CAMA} - ${e.NOMBRE}`; if(!grupos[k]) grupos[k] = []; grupos[k].push(e); });

    main.innerHTML = Object.keys(grupos).sort().map(p => `
        <div class="card">
            <div class="card-header" style="border-color:${pestañaActual==='PRN'?'#d32f2f':'#1a73e8'}">${p}</div>
            <table class="med-table">
                ${grupos[p].map(m => `
                    <tr>
                        <td style="width:30px"><input type="checkbox" class="cb-sel" data-id="${m.id}"></td>
                        <td style="line-height:1.2"><b>${m.MEDICAMENTO}</b><br><small style="color:#888">${m.VIA}</small></td>
                        <td>${m.DOSIS} ${m.UNIDADES}</td>
                        <td>${m.HORARIO || ''}</td>
                        <td style="text-align:right">
                            <button onclick="moverEtiqueta('${m.id}')" style="border:none;background:none;color:#5f6368;"><i class="material-icons" style="font-size:18px">swap_horiz</i></button>
                            <button onclick="editarEtiq('${m.id}')" style="border:none;background:none;color:#5f6368;"><i class="material-icons" style="font-size:18px">edit</i></button>
                        </td>
                    </tr>`).join('')}
            </table>
        </div>`).join('');
}

// --- IMPRESIÓN CORREGIDA (ANTI-NaN) ---
window.imprimirEtiquetasDirecto = () => {
    const data = listaEtiquetas.filter(e => (e.TIPO === pestañaActual) && (servicioActual === "TODOS" || e.SERVICIO === servicioActual));
    if (data.length === 0) return alert("Sin datos");

    const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const fStr = `${HOY.getDate().toString().padStart(2,'0')}-${meses[HOY.getMonth()]}-${HOY.getFullYear().toString().slice(-2)}`;
    
    let html = '<table class="label-table">';
    for (let i = 0; i < data.length; i += 4) {
        html += '<tr>';
        for (let j = 0; j < 4; j++) {
            if (i+j < data.length) {
                let e = data[i+j];
                let vMed = parseFloat(e["VOL MED"]);
                let vMedStr = (!isNaN(vMed) && vMed > 0) ? ` - ${vMed}` : "";
                let sol = (e.SOLUCION && e.SOLUCION !== "null") ? e.SOLUCION : "";
                
                // ESPACIO ENTRE DOSIS Y UNIDADES
                let lineaM = `${e.MEDICAMENTO} ${e.DOSIS} ${e.UNIDADES || "MG"}${vMedStr} ${e.VIA || "IV"} ${e.TIEMPO ? "P/"+e.TIEMPO : ""}`;

                html += `<td class="label-td">
                    <p class="bold">NOMBRE: ${e.NOMBRE}</p>
                    <p class="bold">SRV: ${e.SERVICIO} &nbsp; CAMA: ${e.CAMA}</p>
                    <p>FECHA: ${fStr} &nbsp; E. RICARDO L.</p>
                    <p class="bold">${lineaM}</p>
                    ${sol ? `<p>${sol}</p>` : ''}
                    <p class="bold">VOL. FINAL: ${e["VOL FINAL"]} ML &nbsp; HR: ${e.HORARIO || ""}</p>
                </td>`;
            } else html += '<td></td>';
        }
        html += '</tr>';
    }
    const container = document.getElementById('print-labels-container');
    container.innerHTML = html + '</table>';
    container.classList.add('printing-now');
    setTimeout(() => { window.print(); container.classList.remove('printing-now'); container.innerHTML = ""; }, 500);
};

// --- SUMATORIA CORREGIDA ---
window.generarSuministros = () => {
    const data = listaEtiquetas.filter(e => (e.TIPO || "DIARIA") === pestañaActual);
    if (data.length === 0) return alert("Pestaña vacía");

    const cons = {};
    const jer = { "JERINGA DE INSULINA":0,"JERINGA DE 3 ML":0,"JERINGA DE 5 ML":0,"JERINGA DE 10 ML":0,"JERINGA DE 20 ML":0 };
    const scK = ['ERITROPOYETINA', 'FILGRASTIM', 'PEG-FILGRASTIM', 'ENOXAPARINA'];
    let venci = false;

    data.forEach(e => {
        const m = e.MEDICAMENTO.toUpperCase().trim();
        cons[m] = (cons[m] || 0) + parseFloat(e.DOSIS);
        const vM = parseFloat(e["VOL MED"]) || 0, vF = parseFloat(e["VOL FINAL"]) || 0;
        if (scK.some(k => m.includes(k)) && vF <= 1.0) { jer["JERINGA DE INSULINA"]++; }
        else {
            let vR = (vF <= 10) ? vF : (vM > 0 ? vM : vF);
            let rem = vR;
            while(rem > 20) { jer["JERINGA DE 20 ML"]++; rem -= 20; }
            if(rem > 10) jer["JERINGA DE 20 ML"]++;
            else if(rem > 5) jer["JERINGA DE 10 ML"]++;
            else if(rem > 3) jer["JERINGA DE 5 ML"]++;
            else if(rem > 0) jer["JERINGA DE 3 ML"]++;
        }
    });

    let h = `<h2 style="text-align:center">REPORTE TÉCNICO DE SUMINISTROS (${pestañaActual})</h2>
             <table class="sum-table"><thead><tr><th>MEDICAMENTO</th><th>TOTAL</th><th>DENOMINACIÓN</th><th>LOTE</th><th>CADUCIDAD</th><th>LAB</th></tr></thead><tbody>`;
    Object.keys(cons).sort().forEach(med => {
        const info = baseMedicamentos.find(x => x.MEDICAMENTO === med) || {};
        const v = esVencido(info.CADUCIDAD); if(v) venci = true;
        h += `<tr class="${v?'expired-row':''}"><td>${med}</td><td><b>${Math.round(cons[med]*100)/100}</b></td><td>${info.DENOMINACION||''}</td><td>${info.LOTE||''}</td><td>${v?'• ':''}${info.CADUCIDAD||''}</td><td>${info.LABORATORIO||''}</td></tr>`;
    });
    h += `</tbody></table><br><h3 style="text-align:center">JERINGAS</h3>
          <table class="sum-table" style="width:50%;margin:0 auto;"><thead><tr><th>TIPO</th><th>PIEZAS</th></tr></thead><tbody>`;
    for(let t in jer) if(jer[t]>0) h += `<tr><td>${t}</td><td><b>${jer[t]}</b></td></tr>`;
    h += `</tbody></table>`;

    const container = document.getElementById('print-summary-container');
    container.innerHTML = h;
    container.classList.add('printing-now');
    setTimeout(() => { window.print(); container.classList.remove('printing-now'); container.innerHTML = ""; }, 500);
};

// --- RESTO DE FUNCIONES ---
window.setTab = (t) => { pestañaActual = t; servicioActual = "TODOS"; dibujarInterfaz(); };
window.filtrarSrv = (s) => { servicioActual = s; dibujarInterfaz(); };
function esVencido(s) { if(!s || s==="null" || s==="") return false; const p = s.split('-'); return new Date(p[0], p[1]-1, 1) < new Date(HOY.getFullYear(), HOY.getMonth(), 1); }

window.abrirModalEtiq = () => {
    document.getElementById('formEtiq').reset();
    document.getElementById('edit-id').value = "";
    document.getElementById('box-vf').style.display = "none";
    document.getElementById('modal-etiq').style.display = "flex";
};

window.editarEtiq = (id) => {
    const e = listaEtiquetas.find(x => x.id === id);
    document.getElementById('edit-id').value = e.id;
    document.getElementById('in-cama').value = e.CAMA;
    document.getElementById('in-nombre').value = e.NOMBRE;
    document.getElementById('in-med').value = e.MEDICAMENTO;
    document.getElementById('in-dosis').value = e.DOSIS;
    document.getElementById('in-horario').value = e.HORARIO || "";
    document.getElementById('in-vf').value = e["VOL FINAL"];
    document.getElementById('box-vf').style.display = "block";
    document.getElementById('modal-etiq').style.display = "flex";
};

window.guardarNuevaEtiq = async (ev) => {
    ev.preventDefault();
    const medNom = document.getElementById('in-med').value.toUpperCase().trim();
    const conf = baseMedicamentos.find(m => m.MEDICAMENTO === medNom);
    if (!conf) return alert("No existe");
    const dosis = parseFloat(document.getElementById('in-dosis').value);
    const id = document.getElementById('edit-id').value || Math.random().toString(36).substr(2, 9);
    const obj = {
        id, TIPO: pestañaActual, CAMA: document.getElementById('in-cama').value,
        NOMBRE: document.getElementById('in-nombre').value.toUpperCase().trim(),
        MEDICAMENTO: conf.MEDICAMENTO, DOSIS: dosis, HORARIO: document.getElementById('in-horario').value,
        SERVICIO: getSrv(document.getElementById('in-cama').value),
        "VOL MED": (dosis/parseFloat(conf.PRESENTACION || 1)).toFixed(1),
        "VOL FINAL": document.getElementById('in-vf').value || calcVF(dosis, conf.CONCENTRACION, conf.DILUYENTE),
        UNIDADES: conf.UNIDADES || "MG", VIA: conf.VIA || "IV", SOLUCION: conf.DILUYENTE || "",
        TIEMPO: conf.TIEMPO || "", fecha_registro: new Date().toISOString()
    };
    const idx = listaEtiquetas.findIndex(x => x.id === id);
    if (idx > -1) {
        const oC = listaEtiquetas[idx].CAMA, oN = listaEtiquetas[idx].NOMBRE;
        listaEtiquetas[idx] = obj;
        listaEtiquetas.forEach(e => { if(e.CAMA===oC && e.NOMBRE===oN){ e.CAMA=obj.CAMA; e.NOMBRE=obj.NOMBRE; e.SERVICIO=obj.SERVICIO; }});
    } else listaEtiquetas.push(obj);
    document.getElementById('modal-etiq').style.display = "none";
    dibujarInterfaz(); await subir();
};

async function subir() {
    sincronizando = true;
    await fetch(URL_API, { method: 'POST', body: JSON.stringify({action: "SYNC", datos: listaEtiquetas}), mode: 'no-cors'});
    sincronizando = false;
}

function calcVF(d, c, l) { let v = d/parseFloat(c || 1); if(!l) return v.toFixed(1); return v<=1?1:(v<=3?3:Math.ceil(v/5)*5); }
function getSrv(c) { const n = Number(c); if(n>=220 && n<=245) return "ONCOLOGIA"; if(n>=501 && n<=521) return "INFECTOLOGIA"; if(n>=522 && n<=535) return "CIRUGIA"; if(n>=536 && n<=542) return "GASTRO"; if(n>=543 && n<=549) return "TRAUMATOLOGIA"; if(n>=550 && n<=559) return "MED INT"; return "URGENCIAS"; }

function configurarEntradas() {
    document.getElementById('in-cama').addEventListener('input', (e) => {
        const ex = listaEtiquetas.find(x => x.CAMA === e.target.value);
        if(ex) document.getElementById('in-nombre').value = ex.NOMBRE;
    });
    document.getElementById('btnSum').onclick = generarSuministros;
    document.getElementById('btnDel').onclick = async () => {
        const ids = Array.from(document.querySelectorAll('.cb-sel:checked')).map(c => c.dataset.id);
        if (ids.length === 0 || !confirm("¿Eliminar?")) return;
        listaEtiquetas = listaEtiquetas.filter(e => !ids.includes(e.id));
        dibujarInterfaz(); await subir();
    };
}

window.enviarAlDrive = async () => {
    const data = listaEtiquetas.filter(e => e.TIPO === "DIARIA" && (servicioActual === "TODOS" || e.SERVICIO === servicioActual));
    if (data.length === 0) return;
    document.getElementById('dbStatus').innerText = "ENVIANDO...";
    await fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: "DOC", datos: data }), mode: 'no-cors' });
    alert("Enviado");
};

function dibujarLotes() {
    const main = document.getElementById('listado-pacientes');
    main.innerHTML = `<input type="text" id="q-lote" placeholder="Buscar..." style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;margin-bottom:15px;box-sizing:border-box;">
                      <div id="grid-lotes"></div>`;
    document.getElementById('q-lote').oninput = (e) => {
        const q = e.target.value.toUpperCase();
        const fils = baseMedicamentos.filter(m => m.MEDICAMENTO.includes(q));
        document.getElementById('grid-lotes').innerHTML = fils.map(m => {
            const v = esVencido(m.CADUCIDAD);
            return `<div class="card" style="padding:10px;display:flex;justify-content:space-between;align-items:center;border-left:5px solid ${v?'red':'#34a853'}">
                <div><b>${m.MEDICAMENTO}</b><br><small style="${v?'color:red;font-weight:bold':''}">CAD: ${m.CADUCIDAD||'--'}</small></div>
                <button onclick="abrirModalLote('${m.MEDICAMENTO}')" style="background:#e8f5e9;color:#34a853;border:none;padding:8px;border-radius:6px;font-weight:bold;cursor:pointer;">EDITAR</button>
            </div>`;
        }).join('');
    };
    document.getElementById('q-lote').oninput({target:{value:''}});
}

window.abrirModalLote = (nom) => {
    const m = baseMedicamentos.find(x => x.MEDICAMENTO === nom);
    document.getElementById('lote-med-id').value = nom;
    document.getElementById('lote-med-titulo').innerText = nom;
    document.getElementById('lt-denom').value = m.DENOMINACION || "";
    document.getElementById('lt-lote').value = m.LOTE || "";
    document.getElementById('lt-cad').value = m.CADUCIDAD || "";
    document.getElementById('lt-lab').value = m.LABORATORIO || "";
    document.getElementById('modal-lote').style.display = 'flex';
};

window.actualizarLoteExcel = async (e) => {
    e.preventDefault();
    const m = baseMedicamentos.find(x => x.MEDICAMENTO === document.getElementById('lote-med-id').value);
    m.DENOMINACION = document.getElementById('lt-denom').value.toUpperCase();
    m.LOTE = document.getElementById('lt-lote').value.toUpperCase();
    m.CADUCIDAD = document.getElementById('lt-cad').value;
    m.LABORATORIO = document.getElementById('lt-lab').value.toUpperCase();
    sincronizando = true;
    await fetch(URL_API, { method: 'POST', body: JSON.stringify({action: "UPDATE_CONFIG", datos: [m]}), mode: 'no-cors'});
    sincronizando = false; cerrarTodosModales(); dibujarLotes();
};

window.moverEtiqueta = async (id) => {
    const i = listaEtiquetas.findIndex(x => x.id === id);
    listaEtiquetas[i].TIPO = listaEtiquetas[i].TIPO === "DIARIA" ? "PRN" : "DIARIA";
    dibujarInterfaz(); await subir();
};
