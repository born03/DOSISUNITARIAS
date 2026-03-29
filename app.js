// REEMPLAZA ESTAS FUNCIONES EN TU app.js

function imprimirEtiquetasDirecto() {
    const data = listaEtiquetas.filter(e => (e.TIPO === pestañaActual) && (servicioActual === "TODOS" || e.SERVICIO === servicioActual));
    if (data.length === 0) return alert("No hay datos para imprimir.");

    const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const fStr = `${HOY.getDate().toString().padStart(2,'0')}-${meses[HOY.getMonth()]}-${HOY.getFullYear().toString().slice(-2)}`;
    
    let html = '<table class="label-table">';
    for (let i = 0; i < data.length; i += 4) {
        html += '<tr>';
        for (let j = 0; j < 4; j++) {
            if (i+j < data.length) {
                let e = data[i+j];
                
                // LIMPIEZA ANTI-NaN
                let vMedNum = parseFloat(e["VOL MED"]);
                let vMedStr = (!isNaN(vMedNum) && vMedNum > 0) ? ` - ${vMedNum}` : "";
                
                let lineaM = `${e.MEDICAMENTO} ${e.DOSIS} ${e.UNIDADES}${vMedStr} ${e.VIA} ${e.TIEMPO ? "P/"+e.TIEMPO : ""}`;
                let sol = (e.SOLUCION && e.SOLUCION !== "null") ? e.SOLUCION : "";

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
    
    // REPARACIÓN: Forzar visibilidad para impresión
    container.classList.add('printing-now');
    setTimeout(() => {
        window.print();
        container.classList.remove('printing-now');
        container.innerHTML = "";
    }, 500);
}

function generarSuministros() {
    const data = listaEtiquetas.filter(e => e.TIPO === pestañaActual);
    if (data.length === 0) return alert("Sin datos en esta pestaña.");

    const cons = {};
    const jer = { "JERINGA DE INSULINA":0,"JERINGA DE 3 ML":0,"JERINGA DE 5 ML":0,"JERINGA DE 10 ML":0,"JERINGA DE 20 ML":0 };
    const keywordsSC = ['ERITROPOYETINA', 'FILGRASTIM', 'PEG-FILGRASTIM', 'ENOXAPARINA'];
    let hayVencidos = false;

    data.forEach(e => {
        const m = e.MEDICAMENTO.toUpperCase().trim();
        cons[m] = (cons[m] || 0) + parseFloat(e.DOSIS);
        const vM = parseFloat(e["VOL MED"]) || 0, vF = parseFloat(e["VOL FINAL"]) || 0;

        if (keywordsSC.some(k => m.includes(k)) && vF <= 1.0) { jer["JERINGA DE INSULINA"]++; }
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

    let h = `<h2 style="text-align:center">SUMINISTROS REQUERIDOS (${pestañaActual})</h2>
             <table class="sum-table"><thead><tr><th>MEDICAMENTO</th><th>TOTAL</th><th>DENOMINACIÓN</th><th>LOTE</th><th>CADUCIDAD</th><th>LABORATORIO</th></tr></thead><tbody>`;
    
    Object.keys(cons).sort().forEach(med => {
        const info = baseMedicamentos.find(x => x.MEDICAMENTO === med) || {};
        const vencido = esVencido(info.CADUCIDAD); if(vencido) hayVencidos = true;
        h += `<tr class="${vencido?'expired-row':''}"><td>${med}</td><td><b>${Math.round(cons[med]*100)/100}</b></td><td>${info.DENOMINACION||''}</td><td>${info.LOTE||''}</td><td>${vencido?'• ':''}${info.CADUCIDAD||''}</td><td>${info.LABORATORIO||''}</td></tr>`;
    });
    
    h += `</tbody></table><h3 style="text-align:center;margin-top:20px;">JERINGAS</h3>
          <table class="sum-table" style="width:50%;margin:0 auto;"><thead><tr><th>TIPO</th><th>PIEZAS</th></tr></thead><tbody>`;
    for(let t in jer) if(jer[t]>0) h += `<tr><td>${t}</td><td><b>${jer[t]}</b></td></tr>`;
    h += `</tbody></table>`;

    if(hayVencidos) alert("¡ATENCIÓN! MEDICAMENTOS CADUCADOS DETECTADOS.");
    
    const container = document.getElementById('print-summary-container');
    container.innerHTML = h;
    
    // REPARACIÓN: Forzar visibilidad para impresión
    container.classList.add('printing-now');
    setTimeout(() => {
        window.print();
        container.classList.remove('printing-now');
        container.innerHTML = "";
    }, 500);
}
