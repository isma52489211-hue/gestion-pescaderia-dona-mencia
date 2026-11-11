import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ponerDato, lineaGenero, ventaPosible, resumenGenero, avisosLinea, valorPropuesto,
  precioActual, revisarCambio, ponerCambio, quitarCambio,
} from '../js/nucleo/dia.js';

const merluza = { id: 'merluza', nombre: 'Merluza', tipo: 'fresco', unidad: 'kg', pvp: 1290, coste: 800, mermaPct: 0 };
const salmon = { id: 'salmon', nombre: 'Salmón', tipo: 'gordo', unidad: 'kg', pvp: 2000, coste: 1200, mermaPct: 25 };
const HOY = '2026-12-02';
const MANANA = '2026-12-03';

function conGenero(p = merluza, inicio = 10000) {
  const dias = {};
  ponerDato(dias, p, HOY, 'inicio', inicio);
  return dias;
}

test('sin cambios, el precio de ahora es el de empezar', () => {
  const dias = conGenero();
  assert.equal(precioActual(lineaGenero(dias, merluza, HOY)), 1290);
});

test('un cambio de precio: lo vendido antes, al precio de antes; lo que quedaba, al nuevo', () => {
  const dias = conGenero();
  const r = ponerCambio(dias, merluza, HOY, { quedaban: 4000, pvp: 990, hora: '13:30' });
  assert.deepEqual(r, { avisos: [] });
  const l = lineaGenero(dias, merluza, HOY);
  assert.deepEqual(l.cambios, [{ quedaban: 4000, pvp: 990, hora: '13:30' }]);
  assert.equal(precioActual(l), 990);
  // 6 kg a 12,90 + 4 kg a 9,90
  assert.equal(ventaPosible(merluza, l), 7740 + 3960);
  assert.equal(resumenGenero(dias, [merluza], HOY).venta, 11700);
  assert.equal(resumenGenero(dias, [merluza], HOY).cambios, 1);
});

test('con merma de limpieza, cada tramo se cobra sin la merma', () => {
  const dias = conGenero(salmon, 4000);
  ponerCambio(dias, salmon, HOY, { quedaban: 2000, pvp: 1600 });
  // 2 kg → 1,5 kg a 20 € + 2 kg → 1,5 kg a 16 €
  assert.equal(ventaPosible(salmon, lineaGenero(dias, salmon, HOY)), 3000 + 2400);
});

test('los cambios quedan en orden aunque se apunten desordenados', () => {
  const dias = conGenero();
  ponerCambio(dias, merluza, HOY, { quedaban: 2000, pvp: 790, hora: '14:00' });
  ponerCambio(dias, merluza, HOY, { quedaban: 6000, pvp: 1090, hora: '12:00' });
  const l = lineaGenero(dias, merluza, HOY);
  assert.deepEqual(l.cambios.map((c) => c.pvp), [1090, 790]);
  assert.equal(precioActual(l), 790);
  // 4 kg a 12,90 + 4 kg a 10,90 + 2 kg a 7,90
  assert.equal(ventaPosible(merluza, l), 5160 + 4360 + 1580);
});

test('no se acepta un cambio imposible', () => {
  const l = lineaGenero(conGenero(), merluza, HOY);
  assert.deepEqual(revisarCambio(lineaGenero({}, merluza, HOY), { quedaban: 1000, pvp: 990 }), { error: 'sin-genero' });
  assert.deepEqual(revisarCambio(l, { quedaban: null, pvp: 990 }), { error: 'falta-cantidad' }); // sin pesar no vale
  assert.deepEqual(revisarCambio(l, { quedaban: 4000, pvp: null }), { error: 'falta-precio' });
  assert.deepEqual(revisarCambio(l, { quedaban: 0, pvp: 990 }), { error: 'no-queda' });
  assert.deepEqual(revisarCambio(l, { quedaban: 12000, pvp: 990 }), { error: 'mas-que-inicio' });
  assert.deepEqual(revisarCambio(l, { quedaban: 4000, pvp: 1290 }), { error: 'mismo-precio' });
});

test('un cambio rechazado no se guarda', () => {
  const dias = conGenero();
  assert.equal(ponerCambio(dias, merluza, HOY, { quedaban: 12000, pvp: 990 }).error, 'mas-que-inicio');
  assert.deepEqual(lineaGenero(dias, merluza, HOY).cambios, []);
});

test('avisa si el precio nuevo parece un error al teclear, pero una rebaja normal no', () => {
  const l = lineaGenero(conGenero(), merluza, HOY);
  assert.deepEqual(revisarCambio(l, { quedaban: 4000, pvp: 990 }).avisos, []);
  assert.deepEqual(revisarCambio(l, { quedaban: 4000, pvp: 129 }).avisos, [{ tipo: 'cambio-muy-grande', antes: 1290 }]);
  assert.deepEqual(revisarCambio(l, { quedaban: 4000, pvp: 12900 }).avisos, [{ tipo: 'cambio-muy-grande', antes: 1290 }]);
});

test('el precio de antes de un cambio es el del cambio anterior', () => {
  const dias = conGenero();
  ponerCambio(dias, merluza, HOY, { quedaban: 6000, pvp: 990 });
  const l = lineaGenero(dias, merluza, HOY);
  assert.equal(revisarCambio(l, { quedaban: 3000, pvp: 990 }).error, 'mismo-precio');
  assert.deepEqual(revisarCambio(l, { quedaban: 7000, pvp: 1190 }), { avisos: [] }); // antes del primero: el de empezar
});

test('quitar un cambio devuelve el precio de antes', () => {
  const dias = conGenero();
  ponerCambio(dias, merluza, HOY, { quedaban: 4000, pvp: 990 });
  assert.equal(quitarCambio(dias, merluza, HOY, 0), true);
  const l = lineaGenero(dias, merluza, HOY);
  assert.deepEqual(l.cambios, []);
  assert.equal(ventaPosible(merluza, l), 12900);
  assert.equal('cambios' in dias[HOY].genero.merluza, false);
  assert.equal(quitarCambio(dias, merluza, HOY, 0), false);
});

test('si se bajan los kilos por debajo de un cambio, se avisa', () => {
  const dias = conGenero();
  ponerCambio(dias, merluza, HOY, { quedaban: 6000, pvp: 990 });
  ponerDato(dias, merluza, HOY, 'inicio', 5000);
  assert.ok(avisosLinea(dias, merluza, HOY).some((a) => a.tipo === 'cambio-con-mas-que-inicio'));
});

test('borrar los kilos no borra los cambios (por si se vuelven a escribir)', () => {
  const dias = conGenero();
  ponerCambio(dias, merluza, HOY, { quedaban: 4000, pvp: 990 });
  ponerDato(dias, merluza, HOY, 'inicio', null);
  ponerDato(dias, merluza, HOY, 'inicio', 10000);
  assert.equal(lineaGenero(dias, merluza, HOY).cambios.length, 1);
});

test('la rebaja de hoy no pasa a mañana: mañana se propone el precio de empezar', () => {
  const dias = conGenero();
  ponerCambio(dias, merluza, HOY, { quedaban: 2000, pvp: 790 });
  assert.equal(valorPropuesto(dias, merluza, MANANA, 'pvp'), 1290);
});
