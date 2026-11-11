// El cierre del día, a ciegas: lo que sobra de cada producto, lo que sale sin venderse
// (retiradas y mermas), el dinero que sale del cajón y lo cobrado. Funciones puras, con pruebas.
//
// A ciegas: mientras se cierra no se enseña con cuánto se empezó ni lo que debería haber en caja.
// Así el recuento es honrado. El cuadre sale solo cuando el cierre está terminado.
//
// Cantidades en milésimas y dinero en céntimos. «Sin dato» (null) no es lo mismo que 0:
// un producto del que no sobra nada se apunta como 0 a propósito, nunca se da por hecho.

import { diaVacio, sinDatos, tieneGenero } from './dia.js';

export const TIPOS_SALIDA = {
  retirada: 'Retirada',
  merma: 'Merma',
};

export const TIPOS_MOVIMIENTO = {
  gasto: 'Gasto',
  retirada: 'Retirada de dinero',
};

// Lo que hace falta en la caja para poder cerrar. 0 vale; vacío, no.
export const CAMPOS_CAJA = {
  fondo: 'Fondo de caja al empezar',
  contado: 'Efectivo contado',
  tarjeta: 'Cobrado con tarjeta',
  bizum: 'Cobrado por Bizum',
};

// Billetes y monedas, en céntimos, para contar el efectivo
export const DENOMINACIONES = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

const dia = (dias, fecha) => (dias[fecha] ||= diaVacio());
const limpiar = (dias, fecha) => {
  if (dias[fecha] && sinDatos(dias[fecha])) delete dias[fecha];
};

export const estaCerrado = (dias, fecha) => !!dias[fecha]?.cerrado;

// ---------- Lo que sobra ----------

export function ponerSobra(dias, producto, fecha, valor) {
  if (estaCerrado(dias, fecha)) return { error: 'cerrado' };
  if (!tieneGenero(dias, producto, fecha)) return { error: 'sin-genero' };
  const linea = dias[fecha].genero[producto.id];
  if (valor == null) delete linea.sobra;
  else linea.sobra = valor;
  return {};
}

export const sobraDe = (dias, producto, fecha) => dias[fecha]?.genero?.[producto.id]?.sobra ?? null;

// ---------- Retiradas y mermas ----------
// Retirada: género que se aparta sin venderlo (para congelar, para otra tienda, para casa…).
// Merma: género que se tira. Las dos se restan de lo vendido.

export function revisarSalida(dias, productos, fecha, { producto, tipo, cantidad }) {
  if (estaCerrado(dias, fecha)) return { error: 'cerrado' };
  const p = productos.find((x) => x.id === producto);
  if (!p || !tieneGenero(dias, p, fecha)) return { error: 'sin-producto' };
  if (!TIPOS_SALIDA[tipo]) return { error: 'sin-tipo' };
  if (cantidad == null || cantidad <= 0) return { error: 'sin-cantidad' };
  return {};
}

export function ponerSalida(dias, productos, fecha, salida) {
  const r = revisarSalida(dias, productos, fecha, salida);
  if (r.error) return r;
  const nueva = { producto: salida.producto, tipo: salida.tipo, cantidad: salida.cantidad };
  const motivo = String(salida.motivo ?? '').trim();
  if (motivo) nueva.motivo = motivo;
  if (salida.hora) nueva.hora = salida.hora;
  (dia(dias, fecha).salidas ||= []).push(nueva);
  return {};
}

export function quitarSalida(dias, fecha, indice) {
  if (estaCerrado(dias, fecha)) return false;
  const lista = dias[fecha]?.salidas;
  if (!lista?.[indice]) return false;
  lista.splice(indice, 1);
  if (!lista.length) delete dias[fecha].salidas;
  limpiar(dias, fecha);
  return true;
}

// Total que ha salido sin venderse de un producto ese día
export const salidasDe = (dias, fecha, id) => (dias[fecha]?.salidas || [])
  .filter((s) => s.producto === id)
  .reduce((suma, s) => suma + s.cantidad, 0);

// ---------- Dinero que sale del cajón ----------
// Gasto: se paga algo con dinero de la caja. Retirada: se saca dinero del cajón (al banco, al dueño…).
// Siempre con concepto, para saber a dónde ha ido cada euro.

export function revisarMovimiento(dias, fecha, { tipo, importe, concepto }) {
  if (estaCerrado(dias, fecha)) return { error: 'cerrado' };
  if (!TIPOS_MOVIMIENTO[tipo]) return { error: 'sin-tipo' };
  if (importe == null || importe <= 0) return { error: 'sin-importe' };
  if (!String(concepto ?? '').trim()) return { error: 'sin-concepto' };
  return {};
}

export function ponerMovimiento(dias, fecha, movimiento) {
  const r = revisarMovimiento(dias, fecha, movimiento);
  if (r.error) return r;
  const nuevo = { tipo: movimiento.tipo, importe: movimiento.importe, concepto: String(movimiento.concepto).replace(/\s+/g, ' ').trim() };
  if (movimiento.hora) nuevo.hora = movimiento.hora;
  const caja = (dia(dias, fecha).caja ||= {});
  (caja.movimientos ||= []).push(nuevo);
  return {};
}

export function quitarMovimiento(dias, fecha, indice) {
  if (estaCerrado(dias, fecha)) return false;
  const lista = dias[fecha]?.caja?.movimientos;
  if (!lista?.[indice]) return false;
  lista.splice(indice, 1);
  if (!lista.length) delete dias[fecha].caja.movimientos;
  limpiar(dias, fecha);
  return true;
}

// ---------- Caja ----------

// campo: 'contado' | 'tarjeta' | 'bizum' (el fondo se apunta con ponerFondo, al empezar el día)
export function ponerCaja(dias, fecha, campo, valor) {
  if (estaCerrado(dias, fecha)) return { error: 'cerrado' };
  const caja = (dia(dias, fecha).caja ||= {});
  if (valor == null) delete caja[campo];
  else caja[campo] = valor;
  // Si se escribe el efectivo a mano, el recuento por billetes ya no vale
  if (campo === 'contado') delete caja.desglose;
  limpiar(dias, fecha);
  return {};
}

// Recuento por billetes y monedas: { 5000: 3, 200: 4 } (céntimos de cada pieza: cuántas hay).
// El efectivo contado pasa a ser el total.
export function ponerDesglose(dias, fecha, desglose) {
  if (estaCerrado(dias, fecha)) return { error: 'cerrado' };
  const limpio = {};
  for (const d of DENOMINACIONES) {
    const n = desglose[d];
    if (Number.isInteger(n) && n > 0) limpio[d] = n;
  }
  const caja = (dia(dias, fecha).caja ||= {});
  if (Object.keys(limpio).length) {
    caja.desglose = limpio;
    caja.contado = totalDesglose(limpio);
  } else {
    delete caja.desglose;
    delete caja.contado;
  }
  limpiar(dias, fecha);
  return {};
}

export const totalDesglose = (desglose = {}) => Object.entries(desglose).reduce((s, [d, n]) => s + Number(d) * n, 0);

// ---------- Estado del cierre ----------

// Qué falta para poder terminar el cierre. «productos» es el catálogo entero.
export function estadoCierre(dias, productos, fecha) {
  const d = dias[fecha] || diaVacio();
  const conGenero = productos.filter((p) => tieneGenero(dias, p, fecha));
  const sinContar = conGenero.filter((p) => sobraDe(dias, p, fecha) == null).map((p) => p.nombre);

  // Aviso para errores al teclear (50 en vez de 5,0): sobra más de lo que se trajo.
  // No dice cuánto se trajo, para que el recuento siga siendo a ciegas.
  const sobraDeMas = conGenero
    .filter((p) => {
      const sobra = sobraDe(dias, p, fecha);
      return sobra != null && sobra + salidasDe(dias, fecha, p.id) > d.genero[p.id].inicio;
    })
    .map((p) => p.nombre);

  const faltaCaja = Object.keys(CAMPOS_CAJA).filter((c) => d.caja?.[c] == null);
  const faltan = [];
  if (!conGenero.length) faltan.push({ tipo: 'sin-genero' });
  if (sinContar.length) faltan.push({ tipo: 'sin-contar', productos: sinContar });
  for (const campo of faltaCaja) faltan.push({ tipo: 'caja', campo });

  return {
    productos: conGenero.length,
    contados: conGenero.length - sinContar.length,
    sinContar,
    sobraDeMas,
    faltaCaja,
    faltan,
    listo: !faltan.length,
    cerrado: d.cerrado || null,
  };
}

// Termina el cierre: a partir de aquí no se puede cambiar nada del día sin reabrirlo.
export function terminarCierre(dias, productos, fecha, hora) {
  if (estaCerrado(dias, fecha)) return { error: 'cerrado' };
  const e = estadoCierre(dias, productos, fecha);
  if (!e.listo) return { error: 'faltan-datos', faltan: e.faltan };
  dias[fecha].cerrado = { hora };
  return {};
}

export function reabrirCierre(dias, fecha) {
  if (!estaCerrado(dias, fecha)) return false;
  delete dias[fecha].cerrado;
  limpiar(dias, fecha);
  return true;
}
