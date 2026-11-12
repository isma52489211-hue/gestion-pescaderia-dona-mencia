import test from 'node:test';
import assert from 'node:assert/strict';
import { ponerDato, ponerFondo, ponerCambio, lineaGenero } from '../js/nucleo/dia.js';
import {
  ponerSobra, sobraDe, ponerSalida, quitarSalida, salidasDe, ponerMovimiento, quitarMovimiento,
  ponerCaja, ponerDesglose, totalDesglose, estadoCierre, terminarCierre, reabrirCierre, estaCerrado,
  cuadreDeUnDia,
} from '../js/nucleo/cierre.js';
import { abreEseDia } from '../js/nucleo/fechas.js';

const merluza = { id: 'merluza', nombre: 'Merluza', tipo: 'fresco', unidad: 'kg', pvp: 1290, coste: 800, mermaPct: 0 };
const ostras = { id: 'ostras', nombre: 'Ostras', tipo: 'marisco', unidad: 'ud', pvp: 150, coste: 80, mermaPct: 0 };
const rape = { id: 'rape', nombre: 'Rape', tipo: 'fresco', unidad: 'kg', pvp: 1990, coste: 1300, mermaPct: 0 };
const CATALOGO = [merluza, ostras, rape];
const HOY = '2026-12-02';

function diaConGenero() {
  const dias = {};
  ponerDato(dias, merluza, HOY, 'inicio', 10000);
  ponerDato(dias, ostras, HOY, 'inicio', 24000);
  ponerFondo(dias, HOY, 15000);
  return dias;
}

function cajaCompleta(dias) {
  ponerCaja(dias, HOY, 'contado', 20000);
  ponerCaja(dias, HOY, 'tarjeta', 4000);
  ponerCaja(dias, HOY, 'bizum', 0);
}

// ---------- Horario ----------

test('la tienda abre de martes a sábado', () => {
  assert.equal(abreEseDia('2026-12-01'), true); // martes
  assert.equal(abreEseDia('2026-12-05'), true); // sábado
  assert.equal(abreEseDia('2026-12-06'), false); // domingo
  assert.equal(abreEseDia('2026-12-07'), false); // lunes
});

// ---------- Lo que sobra ----------

test('«no sobra nada» (0) es un dato; la casilla vacía no', () => {
  const dias = diaConGenero();
  assert.equal(sobraDe(dias, merluza, HOY), null);
  ponerSobra(dias, merluza, HOY, 0);
  assert.equal(sobraDe(dias, merluza, HOY), 0);
  ponerSobra(dias, merluza, HOY, null);
  assert.equal(sobraDe(dias, merluza, HOY), null);
});

test('solo se cuenta lo que se ha traído', () => {
  const dias = diaConGenero();
  assert.deepEqual(ponerSobra(dias, rape, HOY, 1000), { error: 'sin-genero' });
});

// ---------- Retiradas y mermas ----------

test('retiradas y mermas: se suman por producto', () => {
  const dias = diaConGenero();
  assert.deepEqual(ponerSalida(dias, CATALOGO, HOY, { producto: 'merluza', tipo: 'merma', cantidad: 500, motivo: ' estropeada ', hora: '09:00' }), {});
  ponerSalida(dias, CATALOGO, HOY, { producto: 'merluza', tipo: 'retirada', cantidad: 1000 });
  ponerSalida(dias, CATALOGO, HOY, { producto: 'ostras', tipo: 'merma', cantidad: 2000 });
  assert.equal(salidasDe(dias, HOY, 'merluza'), 1500);
  assert.equal(salidasDe(dias, HOY, 'ostras'), 2000);
  assert.equal(salidasDe(dias, HOY, 'rape'), 0);
  assert.deepEqual(dias[HOY].salidas[0], { producto: 'merluza', tipo: 'merma', cantidad: 500, motivo: 'estropeada', hora: '09:00' });
});

test('una retirada o merma necesita producto con género, tipo y cantidad', () => {
  const dias = diaConGenero();
  assert.equal(ponerSalida(dias, CATALOGO, HOY, { producto: 'rape', tipo: 'merma', cantidad: 500 }).error, 'sin-producto');
  assert.equal(ponerSalida(dias, CATALOGO, HOY, { producto: 'merluza', tipo: 'regalo', cantidad: 500 }).error, 'sin-tipo');
  assert.equal(ponerSalida(dias, CATALOGO, HOY, { producto: 'merluza', tipo: 'merma', cantidad: null }).error, 'sin-cantidad');
  assert.equal(ponerSalida(dias, CATALOGO, HOY, { producto: 'merluza', tipo: 'merma', cantidad: 0 }).error, 'sin-cantidad');
  assert.equal(dias[HOY].salidas, undefined);
});

test('quitar una retirada', () => {
  const dias = diaConGenero();
  ponerSalida(dias, CATALOGO, HOY, { producto: 'merluza', tipo: 'merma', cantidad: 500 });
  assert.equal(quitarSalida(dias, HOY, 0), true);
  assert.equal(salidasDe(dias, HOY, 'merluza'), 0);
  assert.equal('salidas' in dias[HOY], false);
  assert.equal(quitarSalida(dias, HOY, 0), false);
});

// ---------- Dinero que sale del cajón ----------

test('gastos y retiradas de dinero, siempre con concepto', () => {
  const dias = diaConGenero();
  assert.equal(ponerMovimiento(dias, HOY, { tipo: 'gasto', importe: 1250, concepto: '' }).error, 'sin-concepto');
  assert.equal(ponerMovimiento(dias, HOY, { tipo: 'gasto', importe: 0, concepto: 'Hielo' }).error, 'sin-importe');
  assert.equal(ponerMovimiento(dias, HOY, { tipo: 'otro', importe: 100, concepto: 'Hielo' }).error, 'sin-tipo');
  assert.deepEqual(ponerMovimiento(dias, HOY, { tipo: 'gasto', importe: 1250, concepto: '  Bolsas   de hielo ', hora: '10:15' }), {});
  ponerMovimiento(dias, HOY, { tipo: 'retirada', importe: 10000, concepto: 'Al banco' });
  assert.deepEqual(dias[HOY].caja.movimientos.map((m) => m.concepto), ['Bolsas de hielo', 'Al banco']);
  assert.equal(quitarMovimiento(dias, HOY, 0), true);
  assert.equal(dias[HOY].caja.movimientos.length, 1);
});

// ---------- Caja ----------

test('recuento por billetes y monedas', () => {
  const dias = diaConGenero();
  ponerDesglose(dias, HOY, { 5000: 2, 1000: 3, 200: 4, 5: 1, 7: 9, 100: -1, 50: 1.5 }); // las piezas raras no cuentan
  assert.deepEqual(dias[HOY].caja.desglose, { 5000: 2, 1000: 3, 200: 4, 5: 1 });
  assert.equal(dias[HOY].caja.contado, 10000 + 3000 + 800 + 5);
  assert.equal(totalDesglose({ 2000: 1, 1: 3 }), 2003);
});

test('escribir el efectivo a mano quita el recuento por billetes', () => {
  const dias = diaConGenero();
  ponerDesglose(dias, HOY, { 5000: 2 });
  ponerCaja(dias, HOY, 'contado', 12000);
  assert.equal(dias[HOY].caja.contado, 12000);
  assert.equal('desglose' in dias[HOY].caja, false);
});

test('vaciar el recuento por billetes deja el efectivo sin contar (no a 0)', () => {
  const dias = diaConGenero();
  ponerDesglose(dias, HOY, { 5000: 2 });
  ponerDesglose(dias, HOY, {});
  assert.equal(dias[HOY].caja.contado, undefined);
});

// ---------- Terminar ----------

test('no se puede terminar con productos sin contar o la caja sin apuntar', () => {
  const dias = diaConGenero();
  let e = estadoCierre(dias, CATALOGO, HOY);
  assert.equal(e.productos, 2);
  assert.equal(e.contados, 0);
  assert.deepEqual(e.sinContar, ['Merluza', 'Ostras']);
  assert.deepEqual(e.faltaCaja, ['contado', 'tarjeta', 'bizum']);
  assert.equal(e.listo, false);
  assert.equal(terminarCierre(dias, CATALOGO, HOY, '13:40').error, 'faltan-datos');

  ponerSobra(dias, merluza, HOY, 2000);
  ponerSobra(dias, ostras, HOY, 0);
  cajaCompleta(dias);
  e = estadoCierre(dias, CATALOGO, HOY);
  assert.equal(e.listo, true);
  assert.deepEqual(terminarCierre(dias, CATALOGO, HOY, '13:40'), {});
  assert.deepEqual(dias[HOY].cerrado, { hora: '13:40' });
});

test('Bizum o tarjeta a 0 valen; sin escribir, no', () => {
  const dias = diaConGenero();
  ponerSobra(dias, merluza, HOY, 0);
  ponerSobra(dias, ostras, HOY, 0);
  ponerCaja(dias, HOY, 'contado', 20000);
  ponerCaja(dias, HOY, 'tarjeta', 0);
  assert.deepEqual(estadoCierre(dias, CATALOGO, HOY).faltaCaja, ['bizum']);
  ponerCaja(dias, HOY, 'bizum', 0);
  assert.equal(estadoCierre(dias, CATALOGO, HOY).listo, true);
});

test('sin fondo de caja no se puede cerrar', () => {
  const dias = diaConGenero();
  ponerFondo(dias, HOY, null);
  assert.ok(estadoCierre(dias, CATALOGO, HOY).faltaCaja.includes('fondo'));
});

test('un día sin género no se puede cerrar', () => {
  const e = estadoCierre({}, CATALOGO, HOY);
  assert.deepEqual(e.faltan[0], { tipo: 'sin-genero' });
  assert.equal(e.listo, false);
});

test('avisa si sobra más de lo que se trajo (contando las retiradas)', () => {
  const dias = diaConGenero();
  ponerSobra(dias, merluza, HOY, 9000);
  assert.deepEqual(estadoCierre(dias, CATALOGO, HOY).sobraDeMas, []);
  ponerSalida(dias, CATALOGO, HOY, { producto: 'merluza', tipo: 'merma', cantidad: 2000 });
  assert.deepEqual(estadoCierre(dias, CATALOGO, HOY).sobraDeMas, ['Merluza']);
});

test('con el cierre terminado no se puede cambiar nada del día', () => {
  const dias = diaConGenero();
  ponerSobra(dias, merluza, HOY, 2000);
  ponerSobra(dias, ostras, HOY, 0);
  cajaCompleta(dias);
  terminarCierre(dias, CATALOGO, HOY, '13:40');
  assert.equal(estaCerrado(dias, HOY), true);

  assert.equal(ponerSobra(dias, merluza, HOY, 1000).error, 'cerrado');
  assert.equal(ponerSalida(dias, CATALOGO, HOY, { producto: 'merluza', tipo: 'merma', cantidad: 500 }).error, 'cerrado');
  assert.equal(ponerMovimiento(dias, HOY, { tipo: 'gasto', importe: 100, concepto: 'Hielo' }).error, 'cerrado');
  assert.equal(ponerCaja(dias, HOY, 'contado', 1).error, 'cerrado');
  assert.equal(ponerDesglose(dias, HOY, { 100: 1 }).error, 'cerrado');
  assert.equal(ponerDato(dias, merluza, HOY, 'inicio', 1), false);
  assert.equal(ponerFondo(dias, HOY, 1), false);
  assert.equal(ponerCambio(dias, merluza, HOY, { quedaban: 1000, pvp: 990 }).error, 'cerrado');
  assert.equal(lineaGenero(dias, merluza, HOY).inicio, 10000);
  assert.equal(dias[HOY].caja.contado, 20000);
  assert.equal(terminarCierre(dias, CATALOGO, HOY, '14:00').error, 'cerrado');

  // Reabierto, se puede corregir
  assert.equal(reabrirCierre(dias, HOY), true);
  assert.deepEqual(ponerSobra(dias, merluza, HOY, 1000), {});
  assert.equal(reabrirCierre(dias, HOY), false);
});

test('sin precio de venta no se puede cerrar', () => {
  const sinPrecio = { ...rape, id: 'sargo', nombre: 'Sargo', pvp: null };
  const dias = diaConGenero();
  ponerDato(dias, sinPrecio, HOY, 'inicio', 2000);
  const e = estadoCierre(dias, [...CATALOGO, sinPrecio], HOY);
  assert.deepEqual(e.faltan.find((f) => f.tipo === 'sin-precio'), { tipo: 'sin-precio', productos: ['Sargo'] });
});

// ---------- Cuadre del día ----------

function diaCerrado() {
  const dias = diaConGenero(); // merluza 10 kg a 12,90 (coste 8), ostras 24 uds a 1,50 (coste 0,80), fondo 150 €
  ponerCambio(dias, merluza, HOY, { quedaban: 4000, pvp: 990 });
  ponerSobra(dias, merluza, HOY, 1000);
  ponerSalida(dias, CATALOGO, HOY, { producto: 'merluza', tipo: 'merma', cantidad: 500 });
  ponerSobra(dias, ostras, HOY, 4000);
  ponerSalida(dias, CATALOGO, HOY, { producto: 'ostras', tipo: 'retirada', cantidad: 2000 });
  // Vendido: merluza 6 kg × 12,90 + 2,5 kg × 9,90 = 77,40 + 24,75 = 102,15 €; ostras 18 × 1,50 = 27 €
  ponerMovimiento(dias, HOY, { tipo: 'gasto', importe: 1000, concepto: 'Hielo' });
  ponerCaja(dias, HOY, 'contado', 15000 + 9215 - 1000); // fondo + efectivo de ventas − gasto
  ponerCaja(dias, HOY, 'tarjeta', 2000);
  ponerCaja(dias, HOY, 'bizum', 1700);
  terminarCierre(dias, CATALOGO, HOY, '13:40');
  return dias;
}

test('cuadre de un día con cambio de precio, mermas, retiradas y gastos', () => {
  const r = cuadreDeUnDia(diaCerrado(), CATALOGO, HOY);
  assert.equal(r.completo, true);
  assert.equal(r.teorico, 10215 + 2700);
  assert.equal(r.caja.cobrado, 9215 + 2000 + 1700);
  assert.equal(r.resultado.diferencia, 0);
  assert.equal(r.resultado.estado, 'cuadra');
  const merluzaL = r.lineas.find((l) => l.id === 'merluza');
  assert.equal(merluzaL.vendido, 8500);
  assert.equal(merluzaL.salidas, 500);
  assert.equal(merluzaL.tramos.length, 2);
  assert.equal(r.cerrado.hora, '13:40');
});

test('ganancia: lo vendido menos su coste, y aparte lo que costó lo tirado', () => {
  const r = cuadreDeUnDia(diaCerrado(), CATALOGO, HOY);
  // merluza: 102,15 € − 8,5 kg × 8 € = 34,15 €; ostras: 27 € − 18 × 0,80 = 12,60 €
  assert.equal(r.ganancia, 3415 + 1260);
  assert.equal(r.costeMermas, 400); // 0,5 kg de merluza × 8 €
  assert.equal(r.gananciaNeta, 3415 + 1260 - 400);
  // La retirada no es pérdida
  assert.deepEqual(r.salidas.map((s) => s.tipo), ['merma', 'retirada']);
});

test('si falta dinero, se dice cuánto', () => {
  const dias = diaCerrado();
  reabrirCierre(dias, HOY);
  ponerCaja(dias, HOY, 'contado', 15000 + 9215 - 1000 - 2000);
  const r = cuadreDeUnDia(dias, CATALOGO, HOY);
  assert.equal(r.resultado.estado, 'falta');
  assert.equal(r.resultado.diferencia, -2000);
});

test('sin coste de algo, no se da la ganancia', () => {
  const dias = diaCerrado();
  reabrirCierre(dias, HOY);
  ponerDato(dias, merluza, HOY, 'coste', null);
  const sinCoste = { ...merluza, coste: null };
  const r = cuadreDeUnDia(dias, [sinCoste, ostras, rape], HOY);
  assert.equal(r.gananciaCompleta, false);
  assert.equal(r.costeMermas, null);
  assert.equal(r.gananciaNeta, null);
});

test('un producto archivado después sigue contando en los días antiguos', () => {
  const dias = diaCerrado();
  const archivada = { ...merluza, archivado: true };
  const r = cuadreDeUnDia(dias, [archivada, ostras, rape], HOY);
  assert.equal(r.teorico, 10215 + 2700);
});
