// Paso 3 del día: el cuadre. Lo que debería haber en caja según el género, frente a lo cobrado.
// Solo se enseña con el cierre terminado, para que el recuento se haga a ciegas.

import { ICONO, escapar } from '../ui.js';
import { estado } from '../datos/almacen.js';
import { cuadreDeUnDia, TIPOS_SALIDA } from '../nucleo/cierre.js';
import { fmtEuros, fmtKg, fmtUnidades } from '../nucleo/numeros.js';

const cantidad = (unidad, m) => (unidad === 'ud' ? fmtUnidades(m) : fmtKg(m));
const conSigno = (c) => (c > 0 ? `+${fmtEuros(c)}` : c < 0 ? `−${fmtEuros(-c)}` : fmtEuros(0));

// Lo que dice el resultado, en pocas palabras (también para el botón del paso y la pantalla de inicio)
export function textoResultado(resultado) {
  if (!resultado) return 'Sin cuadre';
  if (resultado.estado === 'cuadra') return 'Cuadra';
  return `${resultado.estado === 'falta' ? 'Faltan' : 'Sobran'} ${fmtEuros(Math.abs(resultado.diferencia))}`;
}

// Resultado del cuadre de un día (null si el cierre no está terminado)
export function resultadoDelDia(fecha) {
  const r = cuadreDeUnDia(estado.dias, estado.productos, fecha);
  return r.cerrado ? r : null;
}

const AVISOS_LINEA = {
  'sobra-mas-que-inicio': 'Sobra más de lo que se trajo: revisa los kilos',
  'cambio-de-precio-incoherente': 'Un cambio de precio no encaja con lo que sobró: revisa los kilos que quedaban',
  'sin-precio': 'Falta el precio de venta',
};

function bloqueResultado(r) {
  const res = r.resultado;
  const clase = res.estado === 'cuadra' ? 'ok' : res.estado;
  const icono = res.estado === 'cuadra' ? ICONO.ok : ICONO.alerta;
  const exacta = res.estado === 'cuadra'
    ? (res.diferencia === 0 ? 'Al céntimo.' : `Diferencia exacta: ${conSigno(res.diferencia)}, dentro del margen de ${fmtEuros(res.margen)}.`)
    : `Fuera del margen de ${fmtEuros(res.margen)}. Revisa los recuentos, las retiradas y los gastos.`;
  return `<div class="resultado ${clase}">${icono}
    <div><p class="grande">${res.estado === 'cuadra' ? 'La caja cuadra' : textoResultado(res)}</p>
    <p>Debería haber <strong class="importe">${fmtEuros(r.teorico)}</strong> · Cobrado <strong class="importe">${fmtEuros(r.caja.cobrado)}</strong></p>
    <p>${exacta}</p></div></div>`;
}

function tarjetaCaja(r) {
  const filas = [
    ['Efectivo contado', fmtEuros(r.contado)],
    ['− Fondo de caja', fmtEuros(r.fondo)],
  ];
  if (r.caja.gastos) filas.push(['+ Gastos pagados con la caja', fmtEuros(r.caja.gastos)]);
  if (r.caja.retiradas) filas.push(['+ Dinero sacado del cajón', fmtEuros(r.caja.retiradas)]);
  filas.push(['= Efectivo de las ventas', fmtEuros(r.caja.efectivoVendido), 'total']);
  filas.push(['+ Tarjeta', fmtEuros(r.tarjeta)]);
  filas.push(['+ Bizum', fmtEuros(r.bizum)]);
  filas.push(['= Cobrado', fmtEuros(r.caja.cobrado), 'total']);
  const movimientos = r.movimientos.length
    ? `<p class="ayuda">${r.movimientos.map((m) => `${m.tipo === 'gasto' ? 'Gasto' : 'Retirada'}: ${escapar(m.concepto)} ${fmtEuros(m.importe)}`).join(' · ')}</p>`
    : '';
  return `<section class="tarjeta">
    <h2>Cómo sale lo cobrado</h2>
    ${filas.map(([k, v, total]) => `<div class="linea${total ? ' total' : ''}"><span>${k}</span><span class="importe">${v}</span></div>`).join('')}
    ${movimientos}
  </section>`;
}

function tarjetaProductos(r) {
  const filas = r.lineas.map((l) => {
    const u = l.unidad === 'ud' ? 'ud' : 'kg';
    const cuenta = l.congelado
      ? [`Había ${cantidad(l.unidad, l.inicio)}`, `quedan ${cantidad(l.unidad, l.sobra)}`]
      : [`Empezó ${cantidad(l.unidad, l.inicio)}`, `sobran ${cantidad(l.unidad, l.sobra)}`];
    if (l.salidas) cuenta.push(`retiradas y mermas ${cantidad(l.unidad, l.salidas)}`);
    const merma = l.mermaPct ? ` (− ${String(l.mermaPct).replace('.', ',')} % de limpieza: se cobran ${cantidad(l.unidad, l.neto)})` : '';
    const tramos = l.tramos.length > 1 || l.mermaPct
      ? `<small>${l.tramos.map((t) => `${cantidad(l.unidad, t.neto)} × ${t.pvp == null ? '¿?' : fmtEuros(t.pvp)}/${u}`).join(' + ')}</small>`
      : `<small>× ${l.tramos[0]?.pvp == null ? '¿?' : `${fmtEuros(l.tramos[0].pvp)}/${u}`}</small>`;
    const avisos = l.avisos.map((a) => AVISOS_LINEA[a]).filter(Boolean);
    return `<div class="linea linea-producto">
      <span><strong>${escapar(l.nombre)}</strong>${l.congelado ? ' <span class="etiqueta">Congelado</span>' : ''}
        <small>${cuenta.join(' − ')} = vendido ${cantidad(l.unidad, l.vendido)}${merma}</small>
        ${l.vendido ? tramos : ''}
        ${avisos.map((a) => `<small class="en-ojo">⚠ ${a}</small>`).join('')}
      </span>
      <span class="importe">${fmtEuros(l.importe)}</span>
    </div>`;
  }).join('');
  return `<section class="tarjeta">
    <h2>Lo vendido, producto a producto</h2>
    ${filas}
    <div class="linea total"><span>Debería haber en caja</span><span class="importe">${fmtEuros(r.teorico)}</span></div>
  </section>`;
}

function tarjetaSalidas(r) {
  if (!r.salidas.length) return '';
  return `<section class="tarjeta">
    <h2>Retiradas y mermas</h2>
    <p class="ayuda">No cuentan como venta. Lo tirado (merma) se valora a lo que costó.</p>
    ${r.salidas.map((s) => `<div class="linea">
      <span><span class="etiqueta">${TIPOS_SALIDA[s.tipo]}</span> ${escapar(s.nombre)} · ${cantidad(s.unidad, s.cantidad)}${s.motivo ? `<small> · ${escapar(s.motivo)}</small>` : ''}</span>
      <span class="importe">${s.tipo === 'merma' ? (s.coste == null ? 'sin coste' : fmtEuros(s.coste)) : ''}</span>
    </div>`).join('')}
  </section>`;
}

function tarjetaGanancia(r) {
  if (!r.gananciaCompleta) {
    return `<section class="tarjeta"><h2>Ganancia</h2>
      <div class="aviso">${ICONO.alerta}<div><strong>Falta el coste de algún producto</strong><p>Sin el coste de todo lo vendido no se puede dar la ganancia del día. Ponlo en el paso 1 (Género) reabriendo el cierre.</p></div></div>
    </section>`;
  }
  const filas = [['Ventas', fmtEuros(r.teorico)], ['− Coste de lo vendido', fmtEuros(r.teorico - r.ganancia)], ['= Ganancia de lo vendido', fmtEuros(r.ganancia), 'total']];
  if (r.costeMermas) {
    filas.push(['− Mermas (lo que costó lo tirado)', fmtEuros(r.costeMermas)]);
    filas.push(['= Ganancia descontando mermas', r.gananciaNeta == null ? '—' : fmtEuros(r.gananciaNeta), 'total']);
  }
  return `<section class="tarjeta">
    <h2>Ganancia</h2>
    ${filas.map(([k, v, total]) => `<div class="linea${total ? ' total' : ''}"><span>${k}</span><span class="importe">${v}</span></div>`).join('')}
    <p class="ayuda">Los gastos pagados con la caja no se restan aquí.</p>
  </section>`;
}

export function panelCuadre(fecha) {
  const r = cuadreDeUnDia(estado.dias, estado.productos, fecha);

  if (!r.cerrado) {
    return `<div class="resultado pendiente">${ICONO.reloj}
      <div><p class="grande">El cuadre sale al terminar el cierre</p>
      <p>Así lo que sobra y la caja se cuentan sin saber cuánto debería salir.</p></div>
      <button type="button" class="btn primario" data-paso-ir="2">Ir al cierre</button></div>`;
  }

  if (!r.completo) {
    const motivos = [];
    if (r.sinContar.length) motivos.push(`Falta lo que sobra de: ${r.sinContar.map(escapar).join(', ')}.`);
    if (r.sinPrecio.length) motivos.push(`Falta el precio de venta de: ${r.sinPrecio.map(escapar).join(', ')}.`);
    if (!r.caja.contada) motivos.push('Falta el efectivo contado.');
    if (!r.lineas.length) motivos.push('No hay género apuntado.');
    return `<div class="resultado falta">${ICONO.alerta}
      <div><p class="grande">No se puede dar el cuadre</p>${motivos.map((m) => `<p>${m}</p>`).join('')}<p>Reabre el cierre para completarlo.</p></div>
      <button type="button" class="btn secundario" data-paso-ir="2">Ir al cierre</button></div>`;
  }

  const cifras = [
    ['Debería haber', fmtEuros(r.teorico)],
    ['Cobrado', fmtEuros(r.caja.cobrado)],
    ['Diferencia', conSigno(r.resultado.diferencia)],
    ['Ganancia', r.gananciaCompleta ? fmtEuros(r.gananciaNeta ?? r.ganancia) : '—'],
  ];
  return `${bloqueResultado(r)}
    <div class="cifras">${cifras.map(([k, v]) => `<div class="cifra"><small>${k}</small><strong>${v}</strong></div>`).join('')}</div>
    ${tarjetaProductos(r)}
    ${tarjetaCaja(r)}
    ${tarjetaSalidas(r)}
    ${tarjetaGanancia(r)}
    <p class="ayuda">Cierre terminado a las ${escapar(r.cerrado.hora)}. Margen: 3 € o el 1 % de lo vendido, lo que sea mayor.</p>`;
}
