// El género con el que empieza cada día. Funciones puras, con pruebas automáticas.
//
// dias['2026-12-01'] = {
//   genero: { 'merluza': { inicio: 10000, pvp: 1290, coste: 800, cambios: [{ quedaban: 4000, pvp: 990, hora: '13:30' }] }, … },
//           cantidades en milésimas, dinero en céntimos. «cambios»: cambios de precio durante el día.
//   caja:   { fondo: 15000, contado, tarjeta, bizum, desglose: { 5000: 2, … }, movimientos: [{ tipo, importe, concepto, hora }] },
//   salidas: [{ producto, tipo: 'retirada' | 'merma', cantidad, motivo, hora }],   ver cierre.js
//   congelado: { 'cong-gamba': { llega, queda, sinVenta, pvp, coste } },             ver congelado.js
//   cerrado: { hora: '13:40' },
// }

import { importe } from './numeros.js';
import { gananciaPorUnidad } from './productos.js';
import { sumarDias } from './fechas.js';
import { ventaProducto } from './cuadre.js';

// A partir de qué cambio se avisa de que un precio es muy distinto al del último día
const CAMBIO_LLAMATIVO = 0.4;

export const diaVacio = () => ({ genero: {}, caja: {} });

// Un día sin nada apuntado no se guarda
export const sinDatos = (dia) => !Object.keys(dia.genero || {}).length
  && Object.values(dia.caja || {}).every((v) => v == null || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Object.keys(v).length))
  && !dia.salidas?.length && !dia.cerrado && !Object.keys(dia.congelado || {}).length;

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
    cambios: propio.cambios || [],
  };
}

export const tieneGenero = (dias, producto, fecha) => (dias[fecha]?.genero?.[producto.id]?.inicio || 0) > 0;

// Apunta un dato del género. campo: 'inicio' | 'pvp' | 'coste'. valor null = borrarlo.
export function ponerDato(dias, producto, fecha, campo, valor) {
  if (dias[fecha]?.cerrado) return false; // con el cierre terminado no se toca nada
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
  return true;
}

export function ponerFondo(dias, fecha, valor) {
  if (dias[fecha]?.cerrado) return false;
  const dia = (dias[fecha] ||= diaVacio());
  dia.caja ||= {};
  if (valor == null) delete dia.caja.fondo;
  else dia.caja.fondo = valor;
  if (sinDatos(dia)) delete dias[fecha];
  return true;
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

  if (l.cambios.some((c) => c.quedaban > l.inicio)) avisos.push({ tipo: 'cambio-con-mas-que-inicio' });

  for (const campo of ['pvp', 'coste']) {
    const antes = ultimoValor(dias, fecha, producto.id, campo);
    if (antes && l[campo] != null && Math.abs(l[campo] - antes) / antes > CAMBIO_LLAMATIVO) {
      avisos.push({ tipo: campo === 'pvp' ? 'precio-muy-distinto' : 'coste-muy-distinto', antes });
    }
  }
  return avisos;
}

// Lo que se podría cobrar por el género de un producto si se vendiera todo.
// Con cambios de precio, cada tramo a su precio: lo que se vendió antes del cambio al precio de antes.
export function ventaPosible(producto, linea) {
  if (!(linea.inicio > 0) || linea.pvp == null) return null;
  const cambios = linea.cambios || [];
  if (cambios.some((c) => c.pvp == null)) return null;
  return ventaProducto({ inicio: linea.inicio, sobra: 0, mermaPct: producto.mermaPct || 0, pvp: linea.pvp, cambios }).importe;
}

// ---------- Cambios de precio durante el día ----------
//
// Al cambiar el precio se pesa (o se cuenta) lo que queda en el mostrador: lo que se vendió
// hasta entonces va al precio de antes y lo que queda, al nuevo. Como el género solo baja
// a lo largo del día, los cambios se ordenan de más a menos «quedaban» (= por orden de hora).

// Precio al que se vende ahora mismo: el del último cambio o, si no hay, el de empezar
export function precioActual(linea) {
  const c = linea.cambios || [];
  return c.length ? c[c.length - 1].pvp : linea.pvp;
}

// Comprueba un cambio antes de guardarlo. Devuelve { error } o { avisos: [{ tipo, antes }] }
export function revisarCambio(linea, { quedaban, pvp }, cerrado = false) {
  if (cerrado) return { error: 'cerrado' };
  if (!(linea.inicio > 0)) return { error: 'sin-genero' };
  if (quedaban == null) return { error: 'falta-cantidad' };
  if (pvp == null) return { error: 'falta-precio' };
  if (quedaban <= 0) return { error: 'no-queda' };
  if (quedaban > linea.inicio) return { error: 'mas-que-inicio' };

  const antes = precioAntesDe(linea, quedaban);
  if (antes != null && antes === pvp) return { error: 'mismo-precio' };
  const avisos = [];
  // Una rebaja de última hora es normal; un precio que sube mucho o baja a menos de la mitad,
  // seguramente es un error al teclear (12,90 → 1,29)
  if (antes && (pvp > antes * 1.4 || pvp < antes * 0.5)) avisos.push({ tipo: 'cambio-muy-grande', antes });
  return { avisos };
}

// El precio que había justo antes de un cambio hecho cuando quedaba «quedaban»
function precioAntesDe(linea, quedaban) {
  let precio = linea.pvp;
  for (const c of linea.cambios || []) {
    if (c.quedaban >= quedaban) precio = c.pvp;
  }
  return precio;
}

// Apunta un cambio de precio ya revisado. Devuelve el mismo resultado que revisarCambio.
export function ponerCambio(dias, producto, fecha, cambio) {
  const l = lineaGenero(dias, producto, fecha);
  const revision = revisarCambio(l, cambio, !!dias[fecha]?.cerrado);
  if (revision.error) return revision;
  const linea = dias[fecha].genero[producto.id];
  const nuevo = { quedaban: cambio.quedaban, pvp: cambio.pvp };
  if (cambio.hora) nuevo.hora = cambio.hora;
  linea.cambios = [...(linea.cambios || []), nuevo]
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.quedaban - a.c.quedaban || a.i - b.i) // a igual cantidad, en el orden en que se apuntaron
    .map(({ c }) => c);
  return revision;
}

export function quitarCambio(dias, producto, fecha, indice) {
  const linea = dias[fecha]?.genero?.[producto.id];
  if (dias[fecha]?.cerrado || !linea?.cambios?.[indice]) return false;
  linea.cambios.splice(indice, 1);
  if (!linea.cambios.length) delete linea.cambios;
  if (!Object.keys(linea).length) delete dias[fecha].genero[producto.id];
  if (sinDatos(dias[fecha])) delete dias[fecha];
  return true;
}

// El género del día de un vistazo
export function resumenGenero(dias, productos, fecha) {
  const r = { productos: 0, kilos: 0, unidades: 0, coste: 0, venta: 0, cambios: 0, sinPrecio: [], sinCoste: [], gananciaPosible: null };
  for (const p of productos) {
    const l = lineaGenero(dias, p, fecha);
    if (!(l.inicio > 0)) continue;
    r.productos++;
    r.cambios += l.cambios.length;
    if (p.unidad === 'ud') r.unidades += l.inicio; else r.kilos += l.inicio;
    if (l.coste == null) r.sinCoste.push(p.nombre); else r.coste += importe(l.inicio, l.coste);
    const venta = ventaPosible(p, l);
    if (venta == null) r.sinPrecio.push(p.nombre); else r.venta += venta;
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
