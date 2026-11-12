import test from 'node:test';
import assert from 'node:assert/strict';
import {
  valorPropuesto, lineaGenero, tieneGenero, ponerDato, ponerFondo, avisosLinea,
  ventaPosible, resumenGenero, esHabitual, borrarDia, diasConGenero, copiarGenero,
} from '../js/nucleo/dia.js';
import { hoyISO, sumarDias, esFecha, fechaLarga } from '../js/nucleo/fechas.js';

const merluza = { id: 'merluza', nombre: 'Merluza', tipo: 'fresco', unidad: 'kg', pvp: 1290, coste: 800, mermaPct: 0 };
const salmon = { id: 'salmon', nombre: 'Salmón', tipo: 'gordo', unidad: 'kg', pvp: 2000, coste: 1200, mermaPct: 25 };
const rape = { id: 'rape', nombre: 'Rape', tipo: 'fresco', unidad: 'kg', pvp: null, coste: null, mermaPct: 0 };
const ostras = { id: 'ostras', nombre: 'Ostras', tipo: 'marisco', unidad: 'ud', pvp: 150, coste: 80, mermaPct: 0 };
const HOY = '2026-12-02';
const AYER = '2026-12-01';

// ---------- Fechas ----------

test('fechas: sumar días cruza meses y años', () => {
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(sumarDias('2026-10-25', 1), '2026-10-26'); // día del cambio de hora
});

test('fechas: hoy según la hora local, no la de Londres', () => {
  assert.match(hoyISO(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(esFecha('2026-12-01'), true);
  assert.equal(esFecha(''), false);
  assert.equal(esFecha('2026-13-45'), false);
  assert.equal(fechaLarga('2026-12-01'), 'martes, 1 de diciembre de 2026');
});

// ---------- Precio y coste propuestos ----------

test('sin días anteriores se propone el precio habitual del producto', () => {
  assert.equal(valorPropuesto({}, merluza, HOY, 'pvp'), 1290);
  assert.equal(valorPropuesto({}, merluza, HOY, 'coste'), 800);
  assert.equal(valorPropuesto({}, rape, HOY, 'pvp'), null);
});

test('se propone el precio del último día en que se apuntó', () => {
  const dias = {
    '2026-11-28': { genero: { merluza: { inicio: 5000, pvp: 1190, coste: 700 } } },
    [AYER]: { genero: { merluza: { inicio: 5000, pvp: 1390, coste: 850 } } },
  };
  assert.equal(valorPropuesto(dias, merluza, HOY, 'pvp'), 1390);
  assert.equal(valorPropuesto(dias, merluza, AYER, 'pvp'), 1190);
  assert.equal(valorPropuesto(dias, merluza, '2026-11-28', 'pvp'), 1290); // antes de todo: el habitual
});

test('los días futuros no influyen en el precio propuesto', () => {
  const dias = { '2026-12-05': { genero: { merluza: { inicio: 5000, pvp: 999 } } } };
  assert.equal(valorPropuesto(dias, merluza, HOY, 'pvp'), 1290);
});

// ---------- Apuntar ----------

test('al poner kilos se fijan el precio y el coste de ese día', () => {
  const dias = {};
  ponerDato(dias, merluza, HOY, 'inicio', 10000);
  assert.deepEqual(dias[HOY].genero.merluza, { inicio: 10000, pvp: 1290, coste: 800 });
  // Si después cambia el precio habitual, el día ya apuntado no se mueve
  const masCara = { ...merluza, pvp: 1590 };
  assert.equal(lineaGenero(dias, masCara, HOY).pvp, 1290);
});

test('el precio del día se puede cambiar sin tocar el habitual', () => {
  const dias = {};
  ponerDato(dias, merluza, HOY, 'inicio', 10000);
  ponerDato(dias, merluza, HOY, 'pvp', 1490);
  assert.equal(lineaGenero(dias, merluza, HOY).pvp, 1490);
  assert.equal(merluza.pvp, 1290);
});

test('quitar los kilos (o poner 0) quita el producto del día', () => {
  const dias = {};
  ponerDato(dias, merluza, HOY, 'inicio', 10000);
  assert.equal(tieneGenero(dias, merluza, HOY), true);
  ponerDato(dias, merluza, HOY, 'inicio', 0);
  assert.equal(tieneGenero(dias, merluza, HOY), false);
});

test('un día sin nada apuntado no se guarda', () => {
  const dias = {};
  ponerDato(dias, rape, HOY, 'inicio', 3000);
  ponerDato(dias, rape, HOY, 'inicio', null);
  assert.deepEqual(dias, {});

  ponerFondo(dias, HOY, 15000);
  assert.equal(dias[HOY].caja.fondo, 15000);
  ponerFondo(dias, HOY, null);
  assert.deepEqual(dias, {});
});

test('un fondo de 0 € sí es un dato', () => {
  const dias = {};
  ponerFondo(dias, HOY, 0);
  assert.equal(dias[HOY].caja.fondo, 0);
});

test('si se borra el precio del día, vuelve a valer el propuesto', () => {
  const dias = {};
  ponerDato(dias, merluza, HOY, 'inicio', 10000);
  ponerDato(dias, merluza, HOY, 'pvp', null);
  assert.equal(lineaGenero(dias, merluza, HOY).pvp, 1290);
});

// ---------- Avisos ----------

const tipos = (dias, p) => avisosLinea(dias, p, HOY).map((a) => a.tipo);

test('sin género no hay avisos', () => {
  assert.deepEqual(tipos({}, rape), []);
});

test('avisa si falta el precio o el coste', () => {
  const dias = {};
  ponerDato(dias, rape, HOY, 'inicio', 3000);
  assert.deepEqual(tipos(dias, rape), ['sin-precio', 'sin-coste']);
});

test('avisa si se vende sin ganar, contando la merma', () => {
  const dias = {};
  ponerDato(dias, salmon, HOY, 'inicio', 5000);
  assert.deepEqual(tipos(dias, salmon), []); // 20 € × 0,75 = 15 € > 12 €
  ponerDato(dias, salmon, HOY, 'pvp', 1500); // 15 € × 0,75 = 11,25 € < 12 €
  assert.ok(tipos(dias, salmon).includes('sin-ganancia'));
});

test('avisa si el precio cambia mucho respecto al último día (posible error al teclear)', () => {
  const dias = { [AYER]: { genero: { merluza: { inicio: 5000, pvp: 1290, coste: 800 } } } };
  ponerDato(dias, merluza, HOY, 'inicio', 10000);
  assert.deepEqual(tipos(dias, merluza), []);
  ponerDato(dias, merluza, HOY, 'pvp', 129); // falta un cero… o sobra una coma
  const avisos = avisosLinea(dias, merluza, HOY);
  assert.deepEqual(avisos.find((a) => a.tipo === 'precio-muy-distinto'), { tipo: 'precio-muy-distinto', antes: 1290 });
  ponerDato(dias, merluza, HOY, 'pvp', 1390); // una subida normal no avisa
  assert.deepEqual(tipos(dias, merluza), []);
});

// ---------- Resumen ----------

test('venta posible: todo el género al precio del día, menos la merma de limpieza', () => {
  assert.equal(ventaPosible(merluza, { inicio: 10000, pvp: 1290 }), 12900);
  assert.equal(ventaPosible(salmon, { inicio: 4000, pvp: 2000 }), 6000); // se cobran 3 kg
  assert.equal(ventaPosible(rape, { inicio: 3000, pvp: null }), null);
});

test('resumen del género del día', () => {
  const dias = {};
  ponerDato(dias, merluza, HOY, 'inicio', 10000);
  ponerDato(dias, salmon, HOY, 'inicio', 4000);
  ponerDato(dias, ostras, HOY, 'inicio', 24000);
  const r = resumenGenero(dias, [merluza, salmon, rape, ostras], HOY);
  assert.equal(r.productos, 3);
  assert.equal(r.kilos, 14000);
  assert.equal(r.unidades, 24000);
  assert.equal(r.coste, 8000 + 4800 + 1920);
  assert.equal(r.venta, 12900 + 6000 + 3600);
  assert.equal(r.gananciaPosible, r.venta - r.coste);
});

test('si falta un precio o un coste, no se inventa la ganancia', () => {
  const dias = {};
  ponerDato(dias, merluza, HOY, 'inicio', 10000);
  ponerDato(dias, rape, HOY, 'inicio', 3000);
  const r = resumenGenero(dias, [merluza, rape], HOY);
  assert.deepEqual(r.sinPrecio, ['Rape']);
  assert.deepEqual(r.sinCoste, ['Rape']);
  assert.equal(r.venta, 12900);
  assert.equal(r.gananciaPosible, null);
});

test('un día vacío da un resumen a cero', () => {
  const r = resumenGenero({}, [merluza], HOY);
  assert.equal(r.productos, 0);
  assert.equal(r.gananciaPosible, null);
});

// ---------- Habituales y borrado ----------

test('habitual = traído en los últimos 14 días (hoy no cuenta)', () => {
  const dias = { [AYER]: { genero: { merluza: { inicio: 5000 } } }, '2026-11-01': { genero: { rape: { inicio: 2000 } } } };
  assert.equal(esHabitual(dias, 'merluza', HOY), true);
  assert.equal(esHabitual(dias, 'rape', HOY), false); // hace un mes
  assert.equal(esHabitual(dias, 'merluza', AYER), false);
});

test('borrar un día', () => {
  const dias = {};
  ponerDato(dias, merluza, HOY, 'inicio', 10000);
  assert.equal(borrarDia(dias, HOY), true);
  assert.deepEqual(dias, {});
  assert.equal(borrarDia(dias, HOY), false);
});

// ---------- Copiar el género de otro día ----------

test('días con género para copiar: los anteriores, del más reciente al más antiguo', () => {
  const dias = {};
  ponerDato(dias, merluza, '2026-11-28', 'inicio', 5000);
  ponerDato(dias, merluza, AYER, 'inicio', 8000);
  ponerDato(dias, merluza, '2026-12-05', 'inicio', 1000); // después: no cuenta
  ponerFondo(dias, '2026-11-30', 15000); // sin género: no cuenta
  assert.deepEqual(diasConGenero(dias, HOY), [{ fecha: AYER, productos: 1 }, { fecha: '2026-11-28', productos: 1 }]);
});

test('copiar el género: solo lo que falta, sin tocar lo ya apuntado', () => {
  const dias = {};
  ponerDato(dias, merluza, AYER, 'inicio', 8000);
  ponerDato(dias, merluza, AYER, 'pvp', 1390);
  ponerDato(dias, salmon, AYER, 'inicio', 4000);
  ponerDato(dias, salmon, HOY, 'inicio', 2000); // hoy ya tiene salmón
  const r = copiarGenero(dias, [merluza, salmon, rape], AYER, HOY);
  assert.deepEqual(r, { copiados: 1, yaTenian: 1 });
  assert.equal(lineaGenero(dias, merluza, HOY).inicio, 8000);
  assert.equal(lineaGenero(dias, merluza, HOY).pvp, 1390); // el precio del último día
  assert.equal(lineaGenero(dias, salmon, HOY).inicio, 2000);
});

test('copiar no trae productos archivados ni a un día cerrado', () => {
  const dias = {};
  ponerDato(dias, merluza, AYER, 'inicio', 8000);
  assert.deepEqual(copiarGenero(dias, [{ ...merluza, archivado: true }], AYER, HOY), { copiados: 0, yaTenian: 0 });
  dias[HOY] = { genero: {}, caja: {}, cerrado: { hora: '13:30' } };
  assert.equal(copiarGenero(dias, [merluza], AYER, HOY).error, 'cerrado');
});
