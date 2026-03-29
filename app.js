const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbyGMTI1Ftbe-Tc26QQxHY8io7ySfZydiM_Z6bOcpk08o725zLAfJia22ScQBUPPHY8j_Q/exec";

let etiquetas = [];
let baseMeds = [];
let tabActiva = "DIARIA";
let srvActivo = "TODOS";
let bloqueoSinc = false;
let dataHash = "";
const HOY_REF = new Date(2026, 2, 28); 

async function init() {
    await sync();
    setInterval(sync, 4000);
    document.getElementById('f-cama').addEventListener('input', e => {
        const ex = etiquetas.find(x => x.CAMA === e.target.value);
        if(ex) document.getElementById('f-nombre').value = ex.NOMBRE;
    });
}
init();

async function sync() {
    if (bloqueoSinc || document.querySelector('.overlay[style*="flex"]') || document.activeElement.tagName === 'INPUT') return;
    try {
        const res = await fetch(URL_SCRIPT);
        const data = await res.json();
        baseMeds = data.medicamentos || [];
        const newHash = JSON.stringify(data.activas);
        if (dataHash !== newHash) {
            dataHash = newHash;
            etiquetas = data.activas || [];
            render();
        }
        document.getElementById('dbStatus').innerText = "ONLINE";
        const dl = document.getElementById('dl-med');
        if (dl.options.length === 0) baseMeds.forEach(m => { let o = document.createElement('option'); o.value = m.MEDICAMENTO; dl.appendChild(o); });
    } catch (e) { document.getElementById('dbStatus').innerText = "OFFLINE"; }
}

function render() {
    const main = document.getElementById('main-content');
    const side = document.getElementById('sidebar');
    if (tabActiva === "LOTES") { side.style.display = "none"; renderLotes(); return; }
    side.style.display = "block";
    document.getElementById('btnDrive').style.display = (tabActiva === "PRN") ? "none" : "flex";
    const dataTab = etiquetas.filter(e => (e.TIPO || "DIARIA") === tabActiva);
    const srvs = [...new Set(dataTab.map(e => e.SERVICIO))].sort();
    document.getElementById('list-srv').innerHTML = `<div class="srv-item ${srvActivo==='TODOS'?'active':''}" onclick="setSrv('TODOS')">TODOS <span>${dataTab.length}</span></div>` +
        srvs.map(s => `<div class="srv-item ${srvActivo===s?'active':''}" onclick="setSrv('${s}')">${s} <span>${dataTab.filter(x=>x.SERVICIO===s).length}</span></div>`).join('');
    const final = srvActivo === "TODOS" ? dataTab : dataTab.filter(e => e.SERVICIO === srvActivo);
    const grupos = {};
    final.forEach(e => { const k = `Cama ${e.CAMA} - ${e.NOMBRE}`; if(!grupos[k]) grupos[k] = []; grupos[k].push(e); });
    main.innerHTML = Object.keys(grupos).sort().map(p => `
        <div class="card">
            <div class="card-header" style="border-bottom-color:${tabActiva==='PRN'?'#d32f2f':'#1a73e8'}">${p}</div>
            <table class="med-table">
                ${grupos[p].map(m => `
                    <tr>
                        <td style="width:30px"><input type="checkbox" class="cb-sel" data-id="${m.id}"></td>
                        <td style="line-height:1.2"><b>${m.MEDICAMENTO}</b></td>
                        <td>${m.DOSIS} ${m.UNIDADES}</td>
                        <td>${m.HORARIO || ''}</td>
                        <td style="text-align:right">
                            <button onclick="moverTab('${m.id}')" style="border:none;background:none;cursor:pointer;"><i class="material-icons" style="font-size:18px">swap_horiz</i></button>
                            <button onclick="editEtiq('${m.id}')" style="border:none;background:none;cursor:pointer;"><i class="material-icons" style="font-size:18px">edit</i></button>
                        </td>
                    </tr>`).join('')}
            </table>
        </div>`).join('');
}

window.printLabels = () => {
    document.getElementById('sum-area').innerHTML = "";
    const data = etiquetas.filter(e => e.TIPO === tabActiva && (srvActivo === "TODOS" || e.SERVICIO === srvActivo));
    if (data.length === 0) return alert("Sin datos");
    
    const mNames = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const fStr = `${HOY_REF.getDate().toString().padStart(2,'0')}-${mNames[HOY_REF.getMonth()]}-${HOY_REF.getFullYear().toString().slice(-2)}`;
    
    let html = '<table class="label-table">';
    for (let i = 0; i < data.length; i += 4) {
        html += '<tr>';
        for (let j = 0; j < 4; j++) {
            const idx = i + j;
            if (idx < data.length) {
                let e = data[idx];
                let vm = parseFloat(e["VOL MED"]);
                let vMedStr = (!isNaN(vm) && vm > 0) ? ` - ${vm} ML` : "";
                let lineaM = `${e.MEDICAMENTO} ${e.DOSIS} ${e.UNIDADES}${vMedStr} ${e.VIA} ${e.TIEMPO ? "P/"+e.TIEMPO : ""}`;
                let sol = (e.SOLUCION && e.SOLUCION !== "null" && e.SOLUCION.trim() !== "") ? `<p>${e.SOLUCION}</p>` : '';
                
                html += `<td class="label-td">
                    <p class="bold">NOMBRE: ${e.NOMBRE}</p>
                    <p class="bold">SERVICIO: ${e.SERVICIO} &nbsp; CAMA: ${e.CAMA}</p>
                    <p>FECHA: ${fStr} &nbsp; E. RICARDO L.</p>
                    <p class="bold">${lineaM}</p>
                    ${sol}
                    <p class="bold">VOL. FINAL: ${e["VOL FINAL"]} ML &nbsp; HR: ${e.HORARIO || ""}</p>
                </td>`;
            } else html += '<td></td>';
        }
        html += '</tr>';
    }
    document.getElementById('print-area').innerHTML = html + '</table>';
    window.print();
};

window.calcSuministros = () => {
    document.getElementById('print-area').innerHTML = "";
    const data = etiquetas.filter(e => e.TIPO === tabActiva);
    if (data.length === 0) return alert("Pestaña vacía");
    const cons = {};
    const jer = { "JERINGA DE INSULINA":0,"JERINGA DE 3 ML":0,"JERINGA DE 5 ML":0,"JERINGA DE 10 ML":0,"JERINGA DE 20 ML":0 };
    const scK = ['ERITROPOYETINA', 'FILGRASTIM', 'PEG-FILGRASTIM', 'ENOXAPARINA'];
    let venci = false;

    data.forEach(e => {
        const m = e.MEDICAMENTO.toUpperCase().trim();
        cons[m] = (cons[m] || 0) + parseFloat(e.DOSIS);
        const vM = parseFloat(e["VOL MED"]) || 0, vF = parseFloat(e["VOL FINAL"]) || 0;
        if (scK.some(k => m.includes(k)) && vF <= 1.0) jer["JERINGA DE INSULINA"]++;
        else {
            let vR = (vF <= 10) ? vF : (vM > 0 ? vM : vF);
            let rem = vR;
            while(rem > 20) { jer["JERINGA DE 20 ML"]++; rem -= 20; }
            if(rem > 10) jer["JERINGA DE 20 ML"]++; else if(rem > 5) jer["JERINGA DE 10 ML"]++; else if(rem > 3) jer["JERINGA DE 5 ML"]++; else if(rem > 0) jer["JERINGA DE 3 ML"]++;
        }
    });

    let h = `<h2 style="text-align:center">SUMINISTROS (${tabActiva})</h2><table class="st-table"><tr><th>MEDICAMENTO</th><th>TOTAL</th><th>DENOMINACIÓN</th><th>LOTE</th><th>CADUCIDAD</th><th>LAB</th></tr>`;
    Object.keys(cons).sort().forEach(med => {
        const info = baseMeds.find(x => x.MEDICAMENTO === med) || {};
        const v = esExp(info.CADUCIDAD); if(v) venci = true;
        h += `<tr class="${v?'expired-row':''}"><td>${med}</td><td><b>${Math.round(cons[med]*100)/100}</b></td><td>${info.DENOMINACION||''}</td><td>${info.LOTE||''}</td><td>${v?'• ':''}${info.CADUCIDAD||''}</td><td>${info.LABORATORIO||''}</td></tr>`;
    });
    h += `</table><h3 style="text-align:center;margin-top:20px;">JERINGAS</h3><table class="st-table" style="width:50%;margin:0 auto;"><tr><th>TIPO</th><th>CANT</th></tr>`;
    for(let t in jer) if(jer[t]>0) h += `<tr><td>${t}</td><td><b>${jer[t]}</b></td></tr>`;
    h += '</table>';

    if(venci) alert("¡ATENCIÓN! MEDICAMENTOS CADUCADOS DETECTADOS.");
    document.getElementById('sum-area').innerHTML = h;
    window.print();
};

window.goTab = (t) => { tabActiva = t; srvActivo = "TODOS"; render(); };
window.setSrv = (s) => { srvActivo = s; render(); };
function esExp(s) { if(!s || s==="null" || s==="") return false; const p = s.split('-'); return new Date(p[0], p[1]-1, 1) < new Date(HOY_REF.getFullYear(), HOY_REF.getMonth(), 1); }
window.openAdd = () => { document.getElementById('f-id').value = ""; document.getElementById('formEtiq').reset(); document.getElementById('box-vf').style.display = "none"; document.getElementById('modal-etiq').style.display = "flex"; };
window.editEtiq = (id) => {
    const e = etiquetas.find(x => x.id === id);
    document.getElementById('f-id').value = e.id;
    document.getElementById('f-cama').value = e.CAMA; document.getElementById('f-nombre').value = e.NOMBRE;
    document.getElementById('f-med').value = e.MEDICAMENTO; document.getElementById('f-dosis').value = e.DOSIS;
    document.getElementById('f-hora').value = e.HORARIO; document.getElementById('f-vf').value = e["VOL FINAL"];
    document.getElementById('box-vf').style.display = "block"; document.getElementById('modal-etiq').style.display = "flex";
};
window.saveEtiq = async (ev) => {
    ev.preventDefault();
    const med = document.getElementById('f-med').value.toUpperCase().trim();
    const conf = baseMeds.find(m => m.MEDICAMENTO === med);
    if (!conf) return alert("No existe");
    const id = document.getElementById('f-id').value || Math.random().toString(36).substr(2, 9);
    const dosis = parseFloat(document.getElementById('f-dosis').value);
    const obj = {
        id, TIPO: tabActiva, CAMA: document.getElementById('f-cama').value, NOMBRE: document.getElementById('f-nombre').value.toUpperCase().trim(),
        MEDICAMENTO: conf.MEDICAMENTO, DOSIS: dosis, HORARIO: document.getElementById('f-hora').value, SERVICIO: getSrv(document.getElementById('f-cama').value),
        "VOL MED": (dosis/parseFloat(conf.PRESENTACION || 1)).toFixed(2), "VOL FINAL": document.getElementById('f-vf').value || calcVF(dosis, conf.CONCENTRACION, conf.DILUYENTE),
        UNIDADES: conf.UNIDADES || "MG", VIA: conf.VIA || "IV", SOLUCION: conf.DILUYENTE || "", TIEMPO: conf.TIEMPO || "", fecha_registro: new Date().toISOString()
    };
    const idx = etiquetas.findIndex(x => x.id === id);
    if (idx > -1) {
        const oC = etiquetas[idx].CAMA, oN = etiquetas[idx].NOMBRE;
        etiquetas[idx] = obj;
        etiquetas.forEach(e => { if(e.CAMA===oC && e.NOMBRE===oN){ e.CAMA=obj.CAMA; e.NOMBRE=obj.NOMBRE; e.SERVICIO=obj.SERVICIO; }});
    } else etiquetas.push(obj);
    document.getElementById('modal-etiq').style.display = "none"; render(); await push();
};
async function push() { bloqueoSinc = true; await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({action: "SYNC", datos: etiquetas}), mode: 'no-cors'}); bloqueoSinc = false; }
function calcVF(d, c, l) { let v = d/parseFloat(c || 1); if(!l) return v.toFixed(1); return v<=1?1:(v<=3?3:Math.ceil(v/5)*5); }
function getSrv(c) { const n = Number(c); if(n>=220 && n<=245) return "ONCOLOGIA"; if(n>=501 && n<=521) return "INFECTOLOGIA"; if(n>=522 && n<=535) return "CIRUGIA"; if(n>=536 && n<=542) return "GASTRO"; if(n>=543 && n<=549) return "TRAUMATOLOGIA"; if(n>=550 && n<=559) return "MED INT"; return "URGENCIAS"; }
window.delSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.cb-sel:checked')).map(c => c.dataset.id);
    if (ids.length === 0 || !confirm("¿Eliminar?")) return;
    etiquetas = etiquetas.filter(e => !ids.includes(e.id)); render(); await push();
};
window.sendDrive = async () => {
    const data = etiquetas.filter(e => e.TIPO === "DIARIA" && (srvActivo === "TODOS" || e.SERVICIO === srvActivo));
    if (data.length === 0) return alert("Solo Diarias");
    document.getElementById('dbStatus').innerText = "ENVIANDO...";
    await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({ action: "DOC", datos: data }), mode: 'no-cors' });
    alert("Enviado");
};
function renderLotes() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<input type="text" id="q-lote" placeholder="Buscar..." style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;margin-bottom:15px;box-sizing:border-box;"><div id="grid-lotes"></div>`;
    document.getElementById('q-lote').oninput = (e) => {
        const q = e.target.value.toUpperCase();
        const fils = baseMeds.filter(m => m.MEDICAMENTO.includes(q));
        document.getElementById('grid-lotes').innerHTML = fils.map(m => {
            const v = esExp(m.CADUCIDAD);
            return `<div class="card" style="padding:10px;display:flex;justify-content:space-between;align-items:center;border-left:5px solid ${v?'red':'#34a853'}">
                <div><b>${m.MEDICAMENTO}</b><br><small>CAD: ${m.CADUCIDAD||'--'}</small></div>
                <button onclick="openLoteModal('${m.MEDICAMENTO}')" style="background:#e8f5e9;color:#34a853;border:none;padding:8px;border-radius:6px;font-weight:bold;cursor:pointer;">EDITAR</button>
            </div>`;
        }).join('');
    };
    document.getElementById('q-lote').oninput({target:{value:''}});
}
window.openLoteModal = (nom) => {
    const m = baseMeds.find(x => x.MEDICAMENTO === nom);
    document.getElementById('lt-id').value = nom; document.getElementById('lt-title').innerText = nom;
    document.getElementById('lt-denom').value = m.DENOMINACION || ""; document.getElementById('lt-lote').value = m.LOTE || "";
    document.getElementById('lt-cad').value = m.CADUCIDAD || ""; document.getElementById('lt-lab').value = m.LABORATORIO || "";
    document.getElementById('modal-lote').style.display = 'flex';
};
window.saveLote = async (e) => {
    e.preventDefault();
    const m = baseMeds.find(x => x.MEDICAMENTO === document.getElementById('lt-id').value);
    m.DENOMINACION = document.getElementById('lt-denom').value.toUpperCase(); m.LOTE = document.getElementById('lt-lote').value.toUpperCase();
    m.CADUCIDAD = document.getElementById('lt-cad').value; m.LABORATORIO = document.getElementById('lt-lab').value.toUpperCase();
    bloqueoSinc = true; await fetch(URL_SCRIPT, { method: 'POST', body: JSON.stringify({action: "UPDATE_CONFIG", datos: [m]}), mode: 'no-cors'});
    bloqueoSinc = false; document.getElementById('modal-lote').style.display='none'; renderLotes();
};
window.moverTab = async (id) => { const i = etiquetas.findIndex(x => x.id === id); etiquetas[i].TIPO = etiquetas[i].TIPO === "DIARIA" ? "PRN" : "DIARIA"; render(); await push(); };
