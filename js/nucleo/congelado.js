// El congelado: stock de la tienda, lo que llega, lo que queda al cerrar y lo que hay que reponer.
// Funciones puras, con pruebas automáticas.
//
// A diferencia del fresco, el congelado no se trae cada mañana: se queda en la tienda de un día para otro.
//
//   producto.stockPartida = { fecha, cantidad }   lo que había al empezar ese día, la primera vez que se apunta
//   producto.stockIdeal   cantidad que conviene tener en la tienda (para la lista de reposición)
//   dias[f].congelado[id] = { llega, queda, sinVenta, pvp, coste }
//     llega     lo que llega ese día del almacén
//     queda     lo que queda al cerrar (contado a ciegas)
//     sinVenta  true = «no se ha vendido nada» (sin enseñar cuánto había)
//     pvp/coste se fijan al terminar el cierre, para que un cambio de precio no mueva los días antiguos
//
// Lo vendido = lo que había + lo que llega − lo que queda − retiradas y mermas.
// Cantidades en milésimas y dinero en céntimos.

import { sumarDias } from './fechas.js';

export const esCongelado = (p) => p.tipo === 'congelado';

// Retiradas y mermas de un producto en un día (las apunta el cierre)
export const salidasDe = (dias, fecha, id) => (dias[fecha]?.salidas || [])
  .filter((s) => s.producto === id)
  .reduce((suma, s) => suma + s.cantidad, 0);

const datosDia = (dias, fecha, id) => dias[fecha]?.congelado?.[id] || {};

// Lo que queda al cerrar un día: lo contado o, si «no se ha vendido nada», lo que había menos lo que salió.
// null = sin contar.
function quedaAlCerrar(c, habia, salidas) {
  if (c.queda != null) return c.queda;
  if (c.sinVenta) return Math.max(0, habia - salidas);
  return null;
}

// Stock al empezar un día, antes de lo que llegue. null = no se sabe (falta el stock de partida).
export function inicioDelDia(dias, producto, fecha) {
  const partida = producto.stockPartida;
  if (!partida || fecha < partida.fecha) return null;
  let stock = partida.cantidad;
  const anteriores = Object.keys(dias).filter((f) => f >= partida.fecha && f < fecha).sort();
  for (const f of anteriores) {
    const c = datosDia(dias, f, producto.id);
    const salidas = salidasDe(dias, f, producto.id);
    const habia = stock + (c.llega || 0);
    // Un día sin contar (la tienda no abrió) no vende nada: solo restan las retiradas y mermas
    stock = quedaAlCerrar(c, habia, salidas) ?? Math.max(0, habia - salidas);
  }
  return stock;
}

// Stock según el último recuento, contando lo que haya llegado hasta hoy
export const stockActual = (dias, producto, hoy) => inicioDelDia(dias, producto, sumarDias(hoy, 1));

// Todo lo de un producto congelado en un día
export function lineaCongelado(dias, producto, fecha) {
  const c = datosDia(dias, fecha, producto.id);
  const inicio = inicioDelDia(dias, producto, fecha);
  const habia = inicio == null ? null : inicio + (c.llega || 0);
  const salidas = salidasDe(dias, fecha, producto.id);
  const queda = habia == null ? null : quedaAlCerrar(c, habia, salidas);
  return {
    inicio,
    llega: c.llega ?? null,
    habia,
    queda,
    sinVenta: !!c.sinVenta,
    contado: queda != null,
    salidas,
    pvp: c.pvp ?? producto.pvp ?? null,
    coste: c.coste ?? producto.coste ?? null,
  };
}

// Los congelados que cuentan en un día: los que tenían algo en la tienda (aunque estén archivados)
export const congeladosDelDia = (dias, productos, fecha) => productos
  .filter((p) => esCongelado(p) && (lineaCongelado(dias, p, fecha).habia || 0) > 0);

// Congelados en uso de los que todavía no se sabe cuánto hay
export const sinStockDePartida = (productos, fecha) => productos
  .filter((p) => esCongelado(p) && !p.archivado && (!p.stockPartida || p.stockPartida.fecha > fecha));

// ---------- Apuntar ----------

function guardarDato(dias, producto, fecha, cambios) {
  if (dias[fecha]?.cerrado) return { error: 'cerrado' };
  if (inicioDelDia(dias, producto, fecha) == null) return { error: 'sin-stock' };
  const dia = (dias[fecha] ||= { genero: {}, caja: {} });
  const todos = (dia.congelado ||= {});
  const c = (todos[producto.id] ||= {});
  for (const [k, v] of Object.entries(cambios)) {
    if (v == null || v === false) delete c[k];
    else c[k] = v;
  }
  if (!Object.keys(c).length) delete todos[producto.id];
  if (!Object.keys(todos).length) delete dia.congelado;
  return {};
}

// Lo que llega del almacén ese día. null o 0 = nada.
export const ponerLlegada = (dias, producto, fecha, valor) => guardarDato(dias, producto, fecha, { llega: valor || null });

// Lo que queda al cerrar. null = sin contar (no es lo mismo que 0).
export const ponerQueda = (dias, producto, fecha, valor) => guardarDato(dias, producto, fecha, { queda: valor, sinVenta: null });

export const ponerSinVenta = (dias, producto, fecha) => guardarDato(dias, producto, fecha, { queda: null, sinVenta: true });

// Al terminar el cierre se fijan el precio y el coste del día
export function fijarPreciosCongelado(dias, productos, fecha) {
  for (const p of congeladosDelDia(dias, productos, fecha)) {
    const todos = (dias[fecha].congelado ||= {});
    const c = (todos[p.id] ||= {});
    if (c.pvp == null && p.pvp != null) c.pvp = p.pvp;
    if (c.coste == null && p.coste != null) c.coste = p.coste;
  }
}

// La primera vez: cuánto hay en la tienda al empezar ese día. Después, el stock lo llevan los cierres.
export function ponerStockPartida(producto, fecha, cantidad) {
  if (cantidad == null || cantidad < 0) return { error: 'sin-cantidad' };
  if (producto.stockPartida && producto.stockPartida.fecha <= fecha) return { error: 'ya-tiene' };
  producto.stockPartida = { fecha, cantidad };
  return {};
}

// ---------- Reposición ----------

// Lo que falta para llegar al stock ideal. Por unidades, siempre unidades enteras.
export function reposicion(dias, productos, hoy) {
  return productos
    .filter((p) => esCongelado(p) && !p.archivado && p.stockIdeal > 0)
    .map((p) => {
      const actual = stockActual(dias, p, hoy);
      let falta = actual == null ? null : Math.max(0, p.stockIdeal - actual);
      if (falta && p.unidad === 'ud') falta = Math.ceil(falta / 1000) * 1000;
      return { producto: p, actual, ideal: p.stockIdeal, falta };
    });
}

// La lista para enviar por WhatsApp. «formatear» escribe una cantidad (kg o unidades).
export function textoReposicion(lista, fechaTexto, formatear) {
  const pedir = lista.filter((x) => x.falta > 0);
  if (!pedir.length) return '';
  return [
    `Reposición de congelado · Doña Mencía · ${fechaTexto}`,
    '',
    ...pedir.map((x) => `- ${x.producto.nombre}${x.producto.formato ? ` (${x.producto.formato})` : ''}: ${formatear(x.producto, x.falta)}`),
  ].join('\n');
}
