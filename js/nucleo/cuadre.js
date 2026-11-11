// Cálculo del cuadre: lo que debería haber en caja según el género, frente a lo cobrado.
// Funciones puras (sin pantalla ni base de datos) para poder probarlas automáticamente.
// Dinero en céntimos enteros y cantidades en milésimas enteras (ver numeros.js).

import { importe } from './numeros.js';

export const TOLERANCIA_INICIAL = { fijo: 300, porcentaje: 1 }; // 3 € o el 1 % de lo vendido, lo que sea mayor

// Lo vendido de un producto en un día.
//
//   inicio   cantidad con la que empieza el día
//   sobra    cantidad que queda al cerrar. null = todavía sin contar (¡no es lo mismo que 0!)
//   salidas  retiradas y mermas: género que sale sin venderse
//   mermaPct % que se pierde al limpiar (salmón, atún): se vende menos peso del que sale
//   pvp      precio de venta al empezar el día
//   coste    precio de compra, para la ganancia (null = no se sabe)
//   cambios  cambios de precio durante el día: [{ quedaban, pvp }] en orden.
//            «quedaban» es lo que había en el mostrador en el momento del cambio.
export function ventaProducto({ inicio, sobra = null, salidas = 0, mermaPct = 0, pvp = null, coste = null, cambios = [] }) {
  const avisos = [];
  if (sobra == null) {
    return { contado: false, vendido: null, neto: null, importe: null, costeVendido: null, tramos: [], avisos };
  }

  let fin = sobra + salidas;
  if (fin > inicio) {
    avisos.push('sobra-mas-que-inicio');
    fin = inicio;
  }

  // Puntos de control: inicio → cada cambio de precio → final. Nunca puede haber más que antes.
  const puntos = [inicio];
  const precios = [pvp];
  for (const c of cambios) {
    let q = c.quedaban;
    const anterior = puntos[puntos.length - 1];
    if (q > anterior || q < fin) {
      avisos.push('cambio-de-precio-incoherente');
      q = Math.min(anterior, Math.max(fin, q));
    }
    puntos.push(q);
    precios.push(c.pvp);
  }
  puntos.push(fin);

  const factor = 1 - mermaPct / 100;
  const tramos = [];
  let vendido = 0;
  let neto = 0;
  let total = 0;
  for (let i = 0; i < precios.length; i++) {
    const cantidad = puntos[i] - puntos[i + 1];
    if (cantidad <= 0) continue;
    const cantidadNeta = Math.round(cantidad * factor);
    if (precios[i] == null) avisos.push('sin-precio');
    const euros = precios[i] == null ? 0 : importe(cantidadNeta, precios[i]);
    tramos.push({ cantidad, neto: cantidadNeta, pvp: precios[i], importe: euros });
    vendido += cantidad;
    neto += cantidadNeta;
    total += euros;
  }

  return {
    contado: true,
    vendido,
    neto,
    importe: total,
    costeVendido: coste == null ? null : importe(vendido, coste),
    tramos,
    avisos: [...new Set(avisos)],
  };
}

// Lo cobrado en el día.
//   contado     efectivo que hay en el cajón al cerrar (null = sin contar)
//   fondo       efectivo con el que se abrió
//   movimientos dinero que ha salido del cajón durante el día: [{ tipo: 'gasto' | 'retirada', importe, concepto }]
export function cobradoEnCaja({ contado = null, fondo = 0, tarjeta = 0, bizum = 0, movimientos = [] }) {
  const gastos = movimientos.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.importe, 0);
  const retiradas = movimientos.filter((m) => m.tipo === 'retirada').reduce((s, m) => s + m.importe, 0);
  if (contado == null) {
    return { contada: false, efectivoVendido: null, cobrado: null, gastos, retiradas };
  }
  // Lo que salió del cajón también se cobró: hay que sumarlo de vuelta
  const efectivoVendido = contado - fondo + gastos + retiradas;
  return { contada: true, efectivoVendido, cobrado: efectivoVendido + (tarjeta || 0) + (bizum || 0), gastos, retiradas };
}

// Compara lo que debería haber con lo cobrado. Pesando género nunca sale al céntimo:
// dentro del margen se considera que cuadra, pero la diferencia exacta se enseña siempre.
export function compararCaja(teorico, cobrado, tolerancia = TOLERANCIA_INICIAL) {
  const diferencia = cobrado - teorico;
  const margen = Math.max(tolerancia.fijo, Math.round((teorico * tolerancia.porcentaje) / 100));
  const estado = Math.abs(diferencia) <= margen ? 'cuadra' : diferencia < 0 ? 'falta' : 'sobra';
  return { diferencia, margen, estado };
}

// El día completo. «productos» es una lista de { id, nombre, ...datos de ventaProducto }.
export function cuadreDelDia({ productos = [], caja = {}, tolerancia = TOLERANCIA_INICIAL }) {
  const lineas = productos
    .filter((p) => p.inicio > 0)
    .map((p) => ({ id: p.id, nombre: p.nombre, inicio: p.inicio, ...ventaProducto(p) }));

  const sinContar = lineas.filter((l) => !l.contado);
  const contadas = lineas.filter((l) => l.contado);
  const teorico = contadas.reduce((s, l) => s + l.importe, 0);
  const cobro = cobradoEnCaja(caja);

  // La ganancia solo es fiable si se sabe el coste de todo lo vendido
  const conCoste = contadas.filter((l) => l.costeVendido != null);
  const ganancia = conCoste.reduce((s, l) => s + l.importe - l.costeVendido, 0);

  // El cuadre solo se da por bueno si no queda nada sin contar
  const completo = sinContar.length === 0 && cobro.contada && lineas.length > 0;

  return {
    lineas,
    sinContar: sinContar.map((l) => l.nombre),
    teorico,
    caja: cobro,
    ganancia,
    gananciaCompleta: conCoste.length === contadas.length,
    completo,
    resultado: completo ? compararCaja(teorico, cobro.cobrado, tolerancia) : null,
  };
}
