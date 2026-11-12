// Sección «Resumen»: la semana o el mes, día a día y producto a producto, con exportación a Excel.

import { $, ICONO, escapar, descargarArchivo, avisar } from '../ui.js';
import { estado } from '../datos/almacen.js';
import { semanaDe, mesDe, moverPeriodo, resumenPeriodo, csvDias, csvProductos } from '../nucleo/resumen.js';
import { fmtEuros, fmtKg, fmtUnidades } from '../nucleo/numeros.js';
import { hoyISO } from '../nucleo/fechas.js';

let modo = 'semana';
let referencia = hoyISO();

const cantidad = (unidad, m) => (unidad === 'ud' ? fmtUnidades(m) : fmtKg(m));
const conSigno = (c) => (c > 0 ? `+${fmtEuros(c)}` : c < 0 ? `−${fmtEuros(-c)}` : fmtEuros(0));
const fecha = (iso, opciones) => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-ES', { timeZone: 'UTC', ...opciones });

function periodo() {
  return modo === 'semana' ? semanaDe(referencia) : mesDe(referencia);
}

function tituloPeriodo({ desde, hasta }) {
  if (modo === 'mes') {
    const t = fecha(desde, { month: 'long', year: 'numeric' });
    return t[0].toUpperCase() + t.slice(1);
  }
  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7);
  return `Semana del ${fecha(desde, mismoMes ? { day: 'numeric' } : { day: 'numeric', month: 'long' })} al ${fecha(hasta, { day: 'numeric', month: 'long' })}`;
}

const ESTADO = {
  cuadra: (d) => `<span class="fc-estado ok">${ICONO.ok} Cuadra</span>`,
  falta: (d) => `<span class="fc-estado mal-txt">${ICONO.alerta} Faltan ${fmtEuros(-d.diferencia)}</span>`,
  sobra: (d) => `<span class="fc-estado aviso-txt">${ICONO.alerta} Sobran ${fmtEuros(d.diferencia)}</span>`,
};

function tarjetaDias(r) {
  const filas = r.dias.map((d) => `<button type="button" class="fila-dia" data-ir="cuadre" data-fecha="${d.fecha}">
      <span class="fila-txt"><strong>${escapar(fecha(d.fecha, { weekday: 'long', day: 'numeric', month: 'long' }))}</strong>
        <small>Vendido ${fmtEuros(d.teorico)} · Cobrado ${fmtEuros(d.cobrado)}${d.ganancia == null ? '' : ` · Ganancia ${fmtEuros(d.gananciaNeta ?? d.ganancia)}`}</small>
        ${ESTADO[d.estado](d)}
      </span>
      <span class="menu-flecha" aria-hidden="true">›</span>
    </button>`).join('');
  return `<section class="tarjeta">
    <h2>Día a día</h2>
    <p class="ayuda">Pulsa un día para ver su cuadre.</p>
    ${filas}
  </section>`;
}

function tarjetaProductos(r) {
  if (!r.productos.length) return '';
  return `<section class="tarjeta">
    <h2>Producto a producto</h2>
    <p class="ayuda">Ordenado por lo que más se ha vendido.</p>
    ${r.productos.map((p) => `<div class="linea linea-producto">
      <span><strong>${escapar(p.nombre)}</strong>${p.congelado ? ' <span class="etiqueta">Congelado</span>' : ''}
        <small>${cantidad(p.unidad, p.vendido)}${p.ganancia == null ? ' · ganancia sin calcular (falta algún coste)' : ` · ganancia ${fmtEuros(p.ganancia)}`}</small>
      </span>
      <span class="importe">${fmtEuros(p.importe)}</span>
    </div>`).join('')}
  </section>`;
}

function tarjetaCaja(t) {
  const filas = [
    ['Efectivo de las ventas', t.efectivo],
    ['Tarjeta', t.tarjeta],
    ['Bizum', t.bizum],
    ['Cobrado', t.cobrado, 'total'],
  ];
  const aparte = [];
  if (t.gastos) aparte.push(['Gastos pagados con la caja', t.gastos]);
  if (t.retiradas) aparte.push(['Dinero sacado del cajón', t.retiradas]);
  if (t.costeMermas) aparte.push(['Mermas (lo que costó lo tirado)', t.costeMermas]);
  return `<section class="tarjeta">
    <h2>Cobros y gastos</h2>
    ${filas.map(([k, v, total]) => `<div class="linea${total ? ' total' : ''}"><span>${k}</span><span class="importe">${fmtEuros(v)}</span></div>`).join('')}
    ${aparte.map(([k, v]) => `<div class="linea"><span>${k}</span><span class="importe">${fmtEuros(v)}</span></div>`).join('')}
  </section>`;
}

export function pintarResumen() {
  const p = periodo();
  const r = resumenPeriodo(estado.dias, estado.productos, p.desde, p.hasta);
  const t = r.totales;
  const hoyDentro = hoyISO() >= p.desde && hoyISO() <= p.hasta;

  const sinCerrar = r.sinCerrar.length ? `<div class="aviso">${ICONO.alerta}
      <div><strong>${r.sinCerrar.length === 1 ? 'Un día sin cerrar' : `${r.sinCerrar.length} días sin cerrar`}: no cuentan en el resumen</strong>
      <p>${r.sinCerrar.map((f) => escapar(fecha(f, { weekday: 'long', day: 'numeric' }))).join(', ')}</p></div>
      <button type="button" class="btn secundario" data-ir="cierre" data-fecha="${r.sinCerrar[0]}">Ir al cierre</button></div>` : '';

  let cuerpo;
  if (!t.diasCerrados) {
    cuerpo = `${sinCerrar}<div class="resultado pendiente">${ICONO.reloj}
      <div><p class="grande">Todavía no hay días cerrados</p><p>El resumen se llena con cada cierre terminado.</p></div></div>`;
  } else {
    const ganancia = t.gananciaNeta ?? t.ganancia;
    const cifras = [
      ['Vendido', fmtEuros(t.teorico)],
      ['Cobrado', fmtEuros(t.cobrado)],
      ['Diferencia', conSigno(t.diferencia)],
      ['Ganancia', ganancia == null ? '—' : fmtEuros(ganancia)],
      ['Días cerrados', t.diasCerrados],
      ['Media por día', fmtEuros(Math.round(t.teorico / t.diasCerrados))],
    ];
    const resultado = [
      t.cuadran ? `${t.cuadran} ${t.cuadran === 1 ? 'día cuadra' : 'días cuadran'}` : '',
      t.falta ? `${t.falta} con falta` : '',
      t.sobra ? `${t.sobra} con sobra` : '',
    ].filter(Boolean).join(' · ');
    cuerpo = `${sinCerrar}
      <div class="cifras">${cifras.map(([k, v]) => `<div class="cifra"><small>${k}</small><strong>${v}</strong></div>`).join('')}</div>
      <p class="ayuda">${resultado}.${ganancia == null ? ' La ganancia no se da porque falta el coste de algún producto.' : t.costeMermas ? ' La ganancia ya descuenta lo que costó lo tirado.' : ''}</p>
      ${tarjetaDias(r)}
      ${tarjetaProductos(r)}
      ${tarjetaCaja(t)}
      <section class="tarjeta">
        <h2>Exportar</h2>
        <p class="ayuda">Descarga el resumen para abrirlo con Excel o enviárselo a la gestoría.</p>
        <div class="botones">
          <button type="button" class="btn secundario" id="resumen-csv-dias">Descargar día a día</button>
          <button type="button" class="btn secundario" id="resumen-csv-productos">Descargar por producto</button>
        </div>
      </section>`;
  }

  $('vista-resumen').innerHTML = `<h1>Resumen</h1>
    <div class="botones selector-modo" role="group" aria-label="Periodo">
      <button type="button" class="btn ${modo === 'semana' ? 'primario' : 'secundario'}" data-modo="semana" aria-pressed="${modo === 'semana'}">Semana</button>
      <button type="button" class="btn ${modo === 'mes' ? 'primario' : 'secundario'}" data-modo="mes" aria-pressed="${modo === 'mes'}">Mes</button>
    </div>
    <div class="barra-fecha">
      <button type="button" class="btn-icono" id="resumen-anterior" aria-label="${modo === 'semana' ? 'Semana anterior' : 'Mes anterior'}">‹</button>
      <p class="titulo-periodo">${tituloPeriodo(p)}</p>
      <button type="button" class="btn-icono" id="resumen-siguiente" aria-label="${modo === 'semana' ? 'Semana siguiente' : 'Mes siguiente'}">›</button>
      <button type="button" class="btn secundario" id="resumen-hoy"${hoyDentro ? ' disabled' : ''}>Hoy</button>
    </div>
    ${cuerpo}`;
}

export function prepararResumen() {
  $('vista-resumen').addEventListener('click', (e) => {
    const boton = e.target.closest('button');
    if (!boton) return;
    if (boton.dataset.modo) {
      modo = boton.dataset.modo;
    } else if (boton.id === 'resumen-anterior') {
      referencia = moverPeriodo(modo, referencia, -1);
    } else if (boton.id === 'resumen-siguiente') {
      referencia = moverPeriodo(modo, referencia, 1);
    } else if (boton.id === 'resumen-hoy') {
      referencia = hoyISO();
    } else if (boton.id === 'resumen-csv-dias' || boton.id === 'resumen-csv-productos') {
      const p = periodo();
      const r = resumenPeriodo(estado.dias, estado.productos, p.desde, p.hasta);
      const porDias = boton.id === 'resumen-csv-dias';
      descargarArchivo(`dona-mencia-${porDias ? 'dias' : 'productos'}-${p.desde}-a-${p.hasta}.csv`, porDias ? csvDias(r) : csvProductos(r));
      avisar('Descargado.');
      return;
    } else {
      return;
    }
    pintarResumen();
  });
}
