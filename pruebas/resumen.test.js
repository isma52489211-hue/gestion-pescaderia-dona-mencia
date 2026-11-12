import test from 'node:test';
import assert from 'node:assert/strict';
import { semanaDe, mesDe, moverPeriodo, resumenPeriodo, csvDias, csvProductos } from '../js/nucleo/resumen.js';
import { ponerDato, ponerFondo } from '../js/nucleo/dia.js';
import { ponerSobra, ponerSalida, ponerMovimiento, ponerCaja, terminarCierre } from '../js/nucleo/cierre.js';

const merluza = { id: 'merluza', nombre: 'Merluza', tipo: 'fresco', unidad: 'kg', pvp: 1000, coste: 600, mermaPct: 0 };
const ostras = { id: 'ostras', nombre: 'Ostras', tipo: 'marisco', unidad: 'ud', pvp: 150, coste: 80, mermaPct: 0 };
const CATALOGO = [merluza, ostras];

// Un día cerrado: 10 kg de merluza a 10 €/kg; la caja con «diferencia» céntimos de más o de menos
function cerrarDia(dias, fecha, { sobra = 2000, diferencia = 0, gasto = 0, merma = 0 } = {}) {
  ponerDato(dias, merluza, fecha, 'inicio', 10000);
  ponerFondo(dias, fecha, 10000);
  ponerSobra(dias, merluza, fecha, sobra);
  if (merma) ponerSalida(dias, CATALOGO, fecha, { producto: 'merluza', tipo: 'merma', cantidad: merma });
  if (gasto) ponerMovimiento(dias, fecha, { tipo: 'gasto', importe: gasto, concepto: 'Hielo' });
  const vendido = 10000 - sobra - merma; // en céntimos, porque el kilo vale 10 €
  ponerCaja(dias, fecha, 'contado', 10000 + vendido - gasto + diferencia);
  ponerCaja(dias, fecha, 'tarjeta', 0);
  ponerCaja(dias, fecha, 'bizum', 0);
  return terminarCierre(dias, CATALOGO, fecha, '13:40');
}

// ---------- Periodos ----------

test('la semana va de lunes a domingo', () => {
  assert.deepEqual(semanaDe('2026-12-02'), { desde: '2026-11-30', hasta: '2026-12-06' }); // miércoles
  assert.deepEqual(semanaDe('2026-11-30'), { desde: '2026-11-30', hasta: '2026-12-06' }); // lunes
  assert.deepEqual(semanaDe('2026-12-06'), { desde: '2026-11-30', hasta: '2026-12-06' }); // domingo
});

test('el mes, con febrero y diciembre', () => {
  assert.deepEqual(mesDe('2026-12-15'), { desde: '2026-12-01', hasta: '2026-12-31' });
  assert.deepEqual(mesDe('2027-02-10'), { desde: '2027-02-01', hasta: '2027-02-28' });
  assert.equal(moverPeriodo('mes', '2026-12-31', 1), '2027-01-01');
  assert.equal(moverPeriodo('mes', '2026-03-31', -1), '2026-02-01');
  assert.equal(moverPeriodo('semana', '2026-12-02', -1), '2026-11-25');
});

// ---------- Resumen ----------

test('suma los días cerrados', () => {
  const dias = {};
  cerrarDia(dias, '2026-12-01'); // vende 80 €, cuadra
  cerrarDia(dias, '2026-12-02', { sobra: 4000, diferencia: -1000 }); // vende 60 €, faltan 10 €
  cerrarDia(dias, '2026-12-03', { diferencia: 500, gasto: 300 }); // vende 80 €, sobran 5 €
  const r = resumenPeriodo(dias, CATALOGO, '2026-11-30', '2026-12-06');
  assert.equal(r.totales.diasCerrados, 3);
  assert.equal(r.totales.teorico, 22000);
  assert.equal(r.totales.cobrado, 22000 - 1000 + 500);
  assert.equal(r.totales.diferencia, -500);
  assert.deepEqual([r.totales.cuadran, r.totales.falta, r.totales.sobra], [1, 1, 1]);
  assert.equal(r.totales.gastos, 300);
  assert.equal(r.totales.ganancia, 22000 - 22 * 600); // 22 kg vendidos a 6 € de coste
  assert.deepEqual(r.dias.map((d) => d.estado), ['cuadra', 'falta', 'sobra']);
});

test('un día sin cerrar no se suma como cero: se enseña aparte', () => {
  const dias = {};
  cerrarDia(dias, '2026-12-01');
  ponerDato(dias, merluza, '2026-12-02', 'inicio', 10000); // abierto, sin cierre
  const r = resumenPeriodo(dias, CATALOGO, '2026-11-30', '2026-12-06');
  assert.equal(r.totales.diasCerrados, 1);
  assert.deepEqual(r.sinCerrar, ['2026-12-02']);
  assert.equal(r.totales.teorico, 8000);
});

test('los días fuera del periodo no cuentan', () => {
  const dias = {};
  cerrarDia(dias, '2026-11-28');
  cerrarDia(dias, '2026-12-01');
  const r = resumenPeriodo(dias, CATALOGO, '2026-11-30', '2026-12-06');
  assert.deepEqual(r.dias.map((d) => d.fecha), ['2026-12-01']);
});

test('sin días cerrados, no hay ganancia (no es 0)', () => {
  const r = resumenPeriodo({}, CATALOGO, '2026-11-30', '2026-12-06');
  assert.equal(r.totales.diasCerrados, 0);
  assert.equal(r.totales.ganancia, null);
});

test('mermas: la ganancia descontando mermas se suma por días', () => {
  const dias = {};
  cerrarDia(dias, '2026-12-01', { merma: 500 }); // se tiran 0,5 kg que costaron 3 €
  const r = resumenPeriodo(dias, CATALOGO, '2026-11-30', '2026-12-06');
  assert.equal(r.totales.costeMermas, 300);
  assert.equal(r.totales.gananciaNeta, r.totales.ganancia - 300);
});

test('si un día no tiene la ganancia completa, la del periodo tampoco', () => {
  const dias = {};
  cerrarDia(dias, '2026-12-01');
  // Un producto que nunca ha tenido coste (no se puede proponer el de otro día)
  const sinCoste = { id: 'rape', nombre: 'Rape', tipo: 'fresco', unidad: 'kg', pvp: 1000, coste: null, mermaPct: 0 };
  const cat = [merluza, sinCoste];
  ponerDato(dias, sinCoste, '2026-12-02', 'inicio', 10000);
  ponerFondo(dias, '2026-12-02', 0);
  ponerSobra(dias, sinCoste, '2026-12-02', 0);
  ponerCaja(dias, '2026-12-02', 'contado', 10000);
  ponerCaja(dias, '2026-12-02', 'tarjeta', 0);
  ponerCaja(dias, '2026-12-02', 'bizum', 0);
  assert.deepEqual(terminarCierre(dias, cat, '2026-12-02', '13:40'), {});
  const r = resumenPeriodo(dias, cat, '2026-11-30', '2026-12-06');
  assert.equal(r.totales.diasCerrados, 2);
  assert.equal(r.totales.ganancia, null);
  assert.equal(r.productos.find((p) => p.id === 'rape').ganancia, null);
  assert.equal(r.productos.find((p) => p.id === 'merluza').ganancia, 3200);
});

test('producto a producto, ordenado por lo vendido', () => {
  const dias = {};
  cerrarDia(dias, '2026-12-01');
  ponerDato(dias, ostras, '2026-12-02', 'inicio', 24000);
  // Las ostras del día 2 no se han contado: el cierre no se puede terminar
  assert.equal(cerrarDia(dias, '2026-12-02').error, 'faltan-datos');
  const r = resumenPeriodo(dias, CATALOGO, '2026-11-30', '2026-12-06');
  assert.deepEqual(r.sinCerrar, ['2026-12-02']);
  assert.deepEqual(r.productos.map((p) => [p.nombre, p.vendido, p.importe, p.ganancia]), [['Merluza', 8000, 8000, 3200]]);
});

// ---------- Exportar ----------

test('exportar para Excel: punto y coma, coma decimal y los días sin cerrar', () => {
  const dias = {};
  cerrarDia(dias, '2026-12-01', { diferencia: -1050 });
  ponerDato(dias, merluza, '2026-12-02', 'inicio', 10000);
  const r = resumenPeriodo(dias, CATALOGO, '2026-11-30', '2026-12-06');
  const lineas = csvDias(r).split('\r\n');
  assert.match(lineas[0], /^Fecha;Debería haber;Cobrado;Diferencia;Resultado/);
  assert.match(lineas[1], /^2026-12-01;80,00;69,50;-10,50;Falta;/);
  assert.equal(lineas[2], '2026-12-02;;;;Sin cerrar');
  assert.match(lineas[3], /^Total;80,00;69,50;-10,50;/);
  assert.equal(csvProductos(r).split('\r\n')[1], 'Merluza;Género del día;8;kg;80,00;48,00;32,00');
});

test('exportar: un nombre con punto y coma o comillas no rompe las columnas', () => {
  const raro = { ...merluza, nombre: 'Merluza; grande "pincho"' };
  const dias = {};
  ponerDato(dias, raro, '2026-12-01', 'inicio', 1000);
  ponerFondo(dias, '2026-12-01', 0);
  ponerSobra(dias, raro, '2026-12-01', 0);
  ponerCaja(dias, '2026-12-01', 'contado', 1000);
  ponerCaja(dias, '2026-12-01', 'tarjeta', 0);
  ponerCaja(dias, '2026-12-01', 'bizum', 0);
  assert.deepEqual(terminarCierre(dias, [raro], '2026-12-01', '13:40'), {});
  const r = resumenPeriodo(dias, [raro], '2026-11-30', '2026-12-06');
  assert.ok(csvProductos(r).split('\r\n')[1].startsWith('"Merluza; grande ""pincho""";'));
});
