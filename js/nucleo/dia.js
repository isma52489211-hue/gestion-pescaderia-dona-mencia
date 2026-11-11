// El género con el que empieza cada día. Funciones puras, con pruebas automáticas.
//
// dias['2026-12-01'] = {
//   genero: { 'merluza': { inicio: 10000, pvp: 1290, coste: 800 }, … },   cantidades en milésimas, dinero en céntimos
//   caja:   { fondo: 15000 },
// }

import { importe } from './numeros.js';
import { gananciaPorUnidad } from './productos.js';
import { sumarDias } from './fechas.js';

// A partir de qué cambio se avisa de que un precio es muy distinto al del último día
const CAMBIO_LLAMATIVO = 0.4;

export const diaVacio = () => ({ genero: {}, caja: {} });

const sinDatos = (dia) => !Object.keys(dia.genero || {}).length && Object.values(dia.caja || {}).every((v) => v == null);

// El último valor que se usó para un producto antes de esa fecha
function ultimoValor(dias, fecha, id, campo) {
  const anteriores = Object.keys(dias).filter((f) => f < fecha).sort().reverse();
  for (const f of anteriores) {
    const v = dias[f].genero?.[id]?.[campo];
    if (v != null) return v;
  }
  return null;
}

// Precio o coste que se propone al empezar: el del último día o, si no hay, el habitual del producto
export function valorPropuesto(dias, producto, fecha, campo) {
  return ultimoValor(dias, fecha, producto.id, campo) ?? producto[campo] ?? null;
}

// Lo que vale para un producto en un día: lo apuntado ese día y, si falta, lo propuesto
export function lineaGenero(dias, producto, fecha) {
  const propio = dias[fecha]?.genero?.[producto.id] || {};
  return {
    inicio: propio.inicio ?? null,
    pvp: propio.pvp ?? valorPropuesto(dias, producto, fecha, 'pvp'),
    coste: propio.coste ?? valorPropuesto(dias, producto, fecha, 'coste'),
  };
}

export const tieneGenero = (dias, producto, fecha) => (dias[fecha]?.genero?.[producto.id]?.inicio || 0) > 0;

// Apunta un dato del género. campo: 'inicio' | 'pvp' | 'coste'. valor null = borrarlo.
export function ponerDato(dias, producto, fecha, campo, valor) {
  const dia = (dias[fecha] ||= diaVacio());
  dia.genero ||= {};
  const linea = (dia.genero[producto.id] ||= {});

  if (valor == null || (campo === 'inicio' && valor === 0)) delete linea[campo];
  else linea[campo] = valor;

  // Al poner cantidad, el precio y el coste propuestos quedan fijados para ese día:
  // así, si mañana cambia el precio, el día de hoy no se mueve.
  if (campo === 'inicio' && linea.inicio > 0) {
    for (const c of ['pvp', 'coste']) {
      if (linea[c] == null) {
        const v = valorPropuesto(dias, producto, fecha, c);
        if (v != null) linea[c] = v;
      }
    }
  }

  if (!Object.keys(linea).length) delete dia.genero[producto.id];
  if (sinDatos(dia)) delete dias[fecha];
}

export function ponerFondo(dias, fecha, valor) {
  const dia = (dias[fecha] ||= diaVacio());
  dia.caja ||= {};
  if (valor == null) delete dia.caja.fondo;
  else dia.caja.fondo = valor;
  if (sinDatos(dia)) delete dias[fecha];
}

// Cosas que conviene revisar de un producto con género. Devuelve [{ tipo, antes? }]
export function avisosLinea(dias, producto, fecha) {
  const l = lineaGenero(dias, producto, fecha);
  if (!(l.inicio > 0)) return [];
  const avisos = [];
  if (l.pvp == null) avisos.push({ tipo: 'sin-precio' });
  if (l.coste == null) avisos.push({ tipo: 'sin-coste' });

  const g = gananciaPorUnidad({ pvp: l.pvp, coste: l.coste, mermaPct: producto.mermaPct });
  if (g && g.ganancia <= 0) avisos.push({ tipo: 'sin-ganancia' });

  for (const campo of ['pvp', 'coste']) {
    const antes = ultimoValor(dias, fecha, producto.id, campo);
    if (antes && l[campo] != null && Math.abs(l[campo] - antes) / antes > CAMBIO_LLAMATIVO) {
      avisos.push({ tipo: campo === 'pvp' ? 'precio-muy-distinto' : 'coste-muy-distinto', antes });
    }
  }
  return avisos;
}

// Lo que se podría cobrar por el género de un producto si se vendiera todo
export function ventaPosible(producto, linea) {
  if (!(linea.inicio > 0) || linea.pvp == null) return null;
  return importe(Math.round(linea.inicio * (1 - (producto.mermaPct || 0) / 100)), linea.pvp);
}

// El género del día de un vistazo
export function resumenGenero(dias, productos, fecha) {
  const r = { productos: 0, kilos: 0, unidades: 0, coste: 0, venta: 0, sinPrecio: [], sinCoste: [], gananciaPosible: null };
  for (const p of productos) {
    const l = lineaGenero(dias, p, fecha);
    if (!(l.inicio > 0)) continue;
    r.productos++;
    if (p.unidad === 'ud') r.unidades += l.inicio; else r.kilos += l.inicio;
    if (l.coste == null) r.sinCoste.push(p.nombre); else r.coste += importe(l.inicio, l.coste);
    if (l.pvp == null) r.sinPrecio.push(p.nombre); else r.venta += ventaPosible(p, l);
  }
  // Solo se da la ganancia si se conoce el precio y el coste de todo
  if (r.productos && !r.sinPrecio.length && !r.sinCoste.length) r.gananciaPosible = r.venta - r.coste;
  return r;
}

// ¿Se ha traído este producto en los últimos días? Los habituales salen arriba en la lista.
export function esHabitual(dias, id, fecha, diasAtras = 14) {
  const desde = sumarDias(fecha, -diasAtras);
  return Object.keys(dias).some((f) => f >= desde && f < fecha && (dias[f].genero?.[id]?.inicio || 0) > 0);
}

export function borrarDia(dias, fecha) {
  const habia = fecha in dias;
  delete dias[fecha];
  return habia;
}
