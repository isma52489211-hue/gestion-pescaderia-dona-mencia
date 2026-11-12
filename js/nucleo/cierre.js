// El cierre del día, a ciegas: lo que sobra de cada producto, lo que sale sin venderse
// (retiradas y mermas), el dinero que sale del cajón y lo cobrado. Funciones puras, con pruebas.
//
// A ciegas: mientras se cierra no se enseña con cuánto se empezó ni lo que debería haber en caja.
// Así el recuento es honrado. El cuadre sale solo cuando el cierre está terminado.
//
// Cantidades en milésimas y dinero en céntimos. «Sin dato» (null) no es lo mismo que 0:
// un producto del que no sobra nada se apunta como 0 a propósito, nunca se da por hecho.

import { diaVacio, sinDatos, tieneGenero, lineaGenero } from './dia.js';
import { cuadreDelDia, TOLERANCIA_INICIAL } from './cuadre.js';
import { importe } from './numeros.js';
import { salidasDe, congeladosDelDia, lineaCongelado, sinStockDePartida, fijarPreciosCongelado } from './congelado.js';

// ¿Se puede apuntar algo de este producto ese día? Fresco con género, o congelado con algo en la tienda.
const enElDia = (dias, productos, p, fecha) => tieneGenero(dias, p, fecha)
  || congeladosDelDia(dias, productos, fecha).some((x) => x.id === p.id);

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
  if (!p || !enElDia(dias, productos, p, fecha)) return { error: 'sin-producto' };
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
export { salidasDe };

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
  // Sin precio de venta no se puede saber lo que debería haber en caja
  const sinPrecio = conGenero.filter((p) => {
    const l = lineaGenero(dias, p, fecha);
    return l.pvp == null || l.cambios.some((c) => c.pvp == null);
  }).map((p) => p.nombre);
  // El congelado también se cuenta, producto a producto
  const congelados = congeladosDelDia(dias, productos, fecha);
  const lineasCong = congelados.map((p) => ({ p, l: lineaCongelado(dias, p, fecha) }));
  const congSinContar = lineasCong.filter(({ l }) => !l.contado).map(({ p }) => p.nombre);
  const congSinPrecio = lineasCong.filter(({ l }) => l.pvp == null).map(({ p }) => p.nombre);
  const sinStock = sinStockDePartida(productos, fecha).map((p) => p.nombre);
  for (const { p, l } of lineasCong) {
    if (l.queda != null && l.queda + l.salidas > l.habia) sobraDeMas.push(p.nombre);
  }

  const faltan = [];
  if (!conGenero.length) faltan.push({ tipo: 'sin-genero' });
  if (sinPrecio.length || congSinPrecio.length) faltan.push({ tipo: 'sin-precio', productos: [...sinPrecio, ...congSinPrecio] });
  if (sinStock.length) faltan.push({ tipo: 'sin-stock', productos: sinStock });
  if (sinContar.length) faltan.push({ tipo: 'sin-contar', productos: sinContar });
  if (congSinContar.length) faltan.push({ tipo: 'congelado-sin-contar', productos: congSinContar });
  for (const campo of faltaCaja) faltan.push({ tipo: 'caja', campo });

  return {
    productos: conGenero.length,
    contados: conGenero.length - sinContar.length,
    congelados: congelados.length,
    congeladosContados: congelados.length - congSinContar.length,
    sinContar,
    congSinContar,
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
  fijarPreciosCongelado(dias, productos, fecha);
  dias[fecha].cerrado = { hora };
  return {};
}

export function reabrirCierre(dias, fecha) {
  if (!estaCerrado(dias, fecha)) return false;
  delete dias[fecha].cerrado;
  limpiar(dias, fecha);
  return true;
}

// ---------- Cuadre ----------
// Junta todo lo apuntado en un día y calcula el cuadre (ver cuadre.js).
// Solo se enseña con el cierre terminado: antes, el recuento tiene que ser a ciegas.

export function cuadreDeUnDia(dias, productos, fecha, tolerancia = TOLERANCIA_INICIAL) {
  const d = dias[fecha] || diaVacio();
  const conGenero = productos.filter((p) => tieneGenero(dias, p, fecha));
  const porId = Object.fromEntries(conGenero.map((p) => [p.id, p]));

  const entrada = conGenero.map((p) => {
    const l = lineaGenero(dias, p, fecha);
    return {
      id: p.id,
      nombre: p.nombre,
      inicio: l.inicio,
      sobra: d.genero[p.id].sobra ?? null,
      salidas: salidasDe(dias, fecha, p.id),
      mermaPct: p.mermaPct || 0,
      pvp: l.pvp,
      coste: l.coste,
      cambios: l.cambios,
    };
  });
  const congelados = congeladosDelDia(dias, productos, fecha);
  for (const p of congelados) {
    const l = lineaCongelado(dias, p, fecha);
    porId[p.id] = p;
    entrada.push({ id: p.id, nombre: p.nombre, inicio: l.habia, sobra: l.queda, salidas: l.salidas, mermaPct: 0, pvp: l.pvp, coste: l.coste });
  }
  const r = cuadreDelDia({ productos: entrada, caja: d.caja || {}, tolerancia });

  // Cada línea con lo que hace falta para explicarla en pantalla
  const sobras = Object.fromEntries(entrada.map((e) => [e.id, e.sobra]));
  r.lineas = r.lineas.map((l) => ({
    ...l,
    congelado: porId[l.id].tipo === 'congelado',
    unidad: porId[l.id].unidad,
    mermaPct: porId[l.id].tipo === 'congelado' ? 0 : porId[l.id].mermaPct || 0,
    sobra: sobras[l.id] ?? null,
    salidas: salidasDe(dias, fecha, l.id),
  }));

  // Retiradas y mermas: no son venta. Lo tirado (merma) es una pérdida: se valora a lo que costó.
  r.salidas = (d.salidas || [])
    .filter((s) => porId[s.producto])
    .map((s) => {
      const p = porId[s.producto];
      const coste = p.tipo === 'congelado' ? lineaCongelado(dias, p, fecha).coste : lineaGenero(dias, p, fecha).coste;
      return { ...s, nombre: porId[s.producto].nombre, unidad: porId[s.producto].unidad, coste: coste == null ? null : importe(s.cantidad, coste) };
    });
  const mermas = r.salidas.filter((s) => s.tipo === 'merma');
  r.costeMermas = mermas.some((s) => s.coste == null) ? null : mermas.reduce((t, s) => t + s.coste, 0);

  // Ganancia del día descontando lo tirado, solo si se sabe todo
  r.gananciaNeta = r.completo && r.gananciaCompleta && r.costeMermas != null ? r.ganancia - r.costeMermas : null;

  r.fondo = d.caja?.fondo ?? null;
  r.contado = d.caja?.contado ?? null;
  r.tarjeta = d.caja?.tarjeta ?? null;
  r.bizum = d.caja?.bizum ?? null;
  r.movimientos = d.caja?.movimientos || [];
  r.cerrado = d.cerrado || null;
  return r;
}
