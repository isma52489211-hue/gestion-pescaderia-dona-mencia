// Resumen de una semana o un mes: lo vendido, lo cobrado, la diferencia y la ganancia,
// día a día y producto a producto. Funciones puras, con pruebas automáticas.
//
// Solo cuentan los días con el cierre terminado y el cuadre completo. Un día sin cerrar
// no se suma como si fuera cero: se enseña aparte, para que se vea que falta.

import { cuadreDeUnDia } from './cierre.js';
import { sumarDias } from './fechas.js';
import { centimosATexto, milesimasATexto } from './numeros.js';

// ---------- Periodos ----------

// Semana de lunes a domingo que contiene la fecha
export function semanaDe(fecha) {
  const dia = new Date(fecha + 'T12:00:00Z').getUTCDay(); // 0 = domingo
  const desde = sumarDias(fecha, -((dia + 6) % 7));
  return { desde, hasta: sumarDias(desde, 6) };
}

export function mesDe(fecha) {
  const desde = fecha.slice(0, 8) + '01';
  const siguiente = new Date(desde + 'T12:00:00Z');
  siguiente.setUTCMonth(siguiente.getUTCMonth() + 1);
  return { desde, hasta: sumarDias(siguiente.toISOString().slice(0, 10), -1) };
}

// El mismo periodo, n semanas o meses antes (n < 0) o después
export function moverPeriodo(modo, fecha, n) {
  if (modo === 'semana') return sumarDias(fecha, 7 * n);
  const d = new Date(fecha.slice(0, 8) + '01T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

// ---------- Resumen ----------

const sumaONull = (lista, campo) => (lista.some((x) => x[campo] == null) ? null : lista.reduce((s, x) => s + x[campo], 0));

export function resumenPeriodo(dias, productos, desde, hasta) {
  const fechas = Object.keys(dias).filter((f) => f >= desde && f <= hasta).sort();
  const lista = [];
  const sinCerrar = [];

  for (const fecha of fechas) {
    const r = cuadreDeUnDia(dias, productos, fecha);
    if (!r.lineas.length) continue; // día sin género: no se abrió
    if (!r.cerrado || !r.completo) {
      sinCerrar.push(fecha);
      continue;
    }
    lista.push({
      fecha,
      teorico: r.teorico,
      cobrado: r.caja.cobrado,
      diferencia: r.resultado.diferencia,
      estado: r.resultado.estado,
      ganancia: r.gananciaCompleta ? r.ganancia : null,
      costeMermas: r.costeMermas,
      gananciaNeta: r.gananciaNeta,
      efectivo: r.caja.efectivoVendido,
      tarjeta: r.tarjeta || 0,
      bizum: r.bizum || 0,
      gastos: r.caja.gastos,
      retiradas: r.caja.retiradas,
      lineas: r.lineas,
    });
  }

  // Producto a producto, sumando todos los días cerrados
  const porProducto = new Map();
  for (const d of lista) {
    for (const l of d.lineas) {
      if (!l.vendido) continue;
      const p = porProducto.get(l.id) || { id: l.id, nombre: l.nombre, unidad: l.unidad, congelado: l.congelado, vendido: 0, importe: 0, coste: 0 };
      p.vendido += l.vendido;
      p.importe += l.importe;
      p.coste = p.coste == null || l.costeVendido == null ? null : p.coste + l.costeVendido;
      porProducto.set(l.id, p);
    }
  }
  const productosVendidos = [...porProducto.values()]
    .map((p) => ({ ...p, ganancia: p.coste == null ? null : p.importe - p.coste }))
    .sort((a, b) => b.importe - a.importe || a.nombre.localeCompare(b.nombre, 'es'));

  const totales = {
    diasCerrados: lista.length,
    diasSinCerrar: sinCerrar.length,
    cuadran: lista.filter((d) => d.estado === 'cuadra').length,
    falta: lista.filter((d) => d.estado === 'falta').length,
    sobra: lista.filter((d) => d.estado === 'sobra').length,
    teorico: lista.reduce((s, d) => s + d.teorico, 0),
    cobrado: lista.reduce((s, d) => s + d.cobrado, 0),
    diferencia: lista.reduce((s, d) => s + d.diferencia, 0),
    efectivo: lista.reduce((s, d) => s + d.efectivo, 0),
    tarjeta: lista.reduce((s, d) => s + d.tarjeta, 0),
    bizum: lista.reduce((s, d) => s + d.bizum, 0),
    gastos: lista.reduce((s, d) => s + d.gastos, 0),
    retiradas: lista.reduce((s, d) => s + d.retiradas, 0),
    // La ganancia solo se da si se sabe la de todos los días
    ganancia: lista.length ? sumaONull(lista, 'ganancia') : null,
    costeMermas: lista.length ? sumaONull(lista, 'costeMermas') : null,
    gananciaNeta: lista.length ? sumaONull(lista, 'gananciaNeta') : null,
  };

  return { desde, hasta, dias: lista.map(({ lineas, ...d }) => d), sinCerrar, totales, productos: productosVendidos };
}

// ---------- Exportar (se abre con Excel) ----------
// Punto y coma entre columnas y coma decimal, como lo espera Excel en español.

const celda = (v) => {
  const t = String(v ?? '');
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const filaCsv = (valores) => valores.map(celda).join(';');
const euros = (c) => (c == null ? '' : centimosATexto(c));
const ESTADOS = { cuadra: 'Cuadra', falta: 'Falta', sobra: 'Sobra' };

export function csvDias(resumen) {
  const filas = [filaCsv(['Fecha', 'Debería haber', 'Cobrado', 'Diferencia', 'Resultado', 'Efectivo', 'Tarjeta', 'Bizum', 'Gastos de caja', 'Dinero sacado', 'Ganancia', 'Mermas (coste)', 'Ganancia descontando mermas'])];
  for (const d of resumen.dias) {
    filas.push(filaCsv([d.fecha, euros(d.teorico), euros(d.cobrado), euros(d.diferencia), ESTADOS[d.estado], euros(d.efectivo), euros(d.tarjeta), euros(d.bizum), euros(d.gastos), euros(d.retiradas), euros(d.ganancia), euros(d.costeMermas), euros(d.gananciaNeta)]));
  }
  for (const f of resumen.sinCerrar) filas.push(filaCsv([f, '', '', '', 'Sin cerrar']));
  const t = resumen.totales;
  filas.push(filaCsv(['Total', euros(t.teorico), euros(t.cobrado), euros(t.diferencia), '', euros(t.efectivo), euros(t.tarjeta), euros(t.bizum), euros(t.gastos), euros(t.retiradas), euros(t.ganancia), euros(t.costeMermas), euros(t.gananciaNeta)]));
  return filas.join('\r\n');
}

export function csvProductos(resumen) {
  const filas = [filaCsv(['Producto', 'Tipo', 'Vendido', 'Unidad', 'Importe', 'Coste', 'Ganancia'])];
  for (const p of resumen.productos) {
    filas.push(filaCsv([p.nombre, p.congelado ? 'Congelado' : 'Género del día', milesimasATexto(p.vendido), p.unidad === 'ud' ? 'ud' : 'kg', euros(p.importe), euros(p.coste), euros(p.ganancia)]));
  }
  return filas.join('\r\n');
}
