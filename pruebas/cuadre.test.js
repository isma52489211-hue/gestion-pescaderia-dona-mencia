import test from 'node:test';
import assert from 'node:assert/strict';
import { ventaProducto, cobradoEnCaja, compararCaja, cuadreDelDia } from '../js/nucleo/cuadre.js';

// ---------- Un producto ----------

test('venta normal: inicio − sobra, al precio del día', () => {
  const v = ventaProducto({ inicio: 10000, sobra: 2500, pvp: 1290 });
  assert.equal(v.vendido, 7500);
  assert.equal(v.importe, 9675); // 7,5 kg × 12,90 €
  assert.deepEqual(v.avisos, []);
});

test('sin contar no es lo mismo que «no sobra nada»', () => {
  const sinContar = ventaProducto({ inicio: 10000, pvp: 1000 });
  assert.equal(sinContar.contado, false);
  assert.equal(sinContar.importe, null);

  const vendidoTodo = ventaProducto({ inicio: 10000, sobra: 0, pvp: 1000 });
  assert.equal(vendidoTodo.contado, true);
  assert.equal(vendidoTodo.importe, 10000);
});

test('las retiradas y mermas no cuentan como venta', () => {
  const v = ventaProducto({ inicio: 10000, sobra: 2000, salidas: 1500, pvp: 1000 });
  assert.equal(v.vendido, 6500);
  assert.equal(v.importe, 6500);
});

test('merma de limpieza: se cobra menos peso del que sale', () => {
  const v = ventaProducto({ inicio: 10000, sobra: 0, mermaPct: 20, pvp: 2000 });
  assert.equal(v.vendido, 10000);
  assert.equal(v.neto, 8000);
  assert.equal(v.importe, 16000);
});

test('cambio de precio a mitad del día', () => {
  // Empieza con 10 kg a 12 €. Cuando quedan 4 kg se baja a 9 €. Al cerrar sobra 1 kg.
  const v = ventaProducto({ inicio: 10000, sobra: 1000, pvp: 1200, cambios: [{ quedaban: 4000, pvp: 900 }] });
  assert.equal(v.tramos.length, 2);
  assert.equal(v.tramos[0].importe, 7200); // 6 kg × 12 €
  assert.equal(v.tramos[1].importe, 2700); // 3 kg × 9 €
  assert.equal(v.importe, 9900);
  assert.equal(v.vendido, 9000);
});

test('dos cambios de precio seguidos', () => {
  const v = ventaProducto({
    inicio: 10000, sobra: 0, pvp: 1000,
    cambios: [{ quedaban: 6000, pvp: 800 }, { quedaban: 2000, pvp: 500 }],
  });
  assert.equal(v.importe, 4000 + 3200 + 1000);
});

test('coste de lo vendido, para la ganancia', () => {
  const v = ventaProducto({ inicio: 10000, sobra: 2000, pvp: 1200, coste: 700 });
  assert.equal(v.costeVendido, 5600); // 8 kg × 7 €
  assert.equal(ventaProducto({ inicio: 10000, sobra: 2000, pvp: 1200 }).costeVendido, null);
});

test('avisa si sobra más de lo que había, y no inventa ventas negativas', () => {
  const v = ventaProducto({ inicio: 5000, sobra: 6000, pvp: 1000 });
  assert.equal(v.vendido, 0);
  assert.equal(v.importe, 0);
  assert.ok(v.avisos.includes('sobra-mas-que-inicio'));
});

test('avisa si falta el precio de algo vendido', () => {
  const v = ventaProducto({ inicio: 5000, sobra: 1000 });
  assert.equal(v.importe, 0);
  assert.ok(v.avisos.includes('sin-precio'));
});

test('avisa si un cambio de precio no encaja con los pesos', () => {
  // Al cambiar el precio «quedaban» 2 kg, pero al cerrar sobran 3 kg
  const v = ventaProducto({ inicio: 10000, sobra: 3000, pvp: 1000, cambios: [{ quedaban: 2000, pvp: 500 }] });
  assert.ok(v.avisos.includes('cambio-de-precio-incoherente'));
  assert.equal(v.vendido, 7000);
  assert.equal(v.importe, 7000);
});

// ---------- La caja ----------

test('cobrado = efectivo − fondo + lo que salió del cajón + tarjeta + Bizum', () => {
  const c = cobradoEnCaja({
    contado: 45000, fondo: 15000, tarjeta: 20000, bizum: 5000,
    movimientos: [
      { tipo: 'gasto', importe: 1250, concepto: 'Hielo' },
      { tipo: 'retirada', importe: 10000, concepto: 'Ismael' },
    ],
  });
  assert.equal(c.gastos, 1250);
  assert.equal(c.retiradas, 10000);
  assert.equal(c.efectivoVendido, 41250);
  assert.equal(c.cobrado, 66250);
});

test('sin contar el efectivo no hay cobrado', () => {
  const c = cobradoEnCaja({ fondo: 15000, tarjeta: 20000 });
  assert.equal(c.contada, false);
  assert.equal(c.cobrado, null);
});

test('un cajón vacío contado (0 €) sí cuenta', () => {
  const c = cobradoEnCaja({ contado: 0, fondo: 0, tarjeta: 5000 });
  assert.equal(c.contada, true);
  assert.equal(c.cobrado, 5000);
});

// ---------- La comparación ----------

test('dentro del margen cuadra, pero la diferencia exacta se conserva', () => {
  const r = compararCaja(50000, 49800, { fijo: 300, porcentaje: 1 });
  assert.equal(r.estado, 'cuadra');
  assert.equal(r.diferencia, -200);
  assert.equal(r.margen, 500); // el 1 % de 500 € es mayor que 3 €
});

test('fuera del margen: falta o sobra', () => {
  assert.equal(compararCaja(50000, 48000).estado, 'falta');
  assert.equal(compararCaja(50000, 52000).estado, 'sobra');
});

test('en días flojos manda el margen fijo', () => {
  const r = compararCaja(10000, 9750, { fijo: 300, porcentaje: 1 });
  assert.equal(r.margen, 300);
  assert.equal(r.estado, 'cuadra');
});

// ---------- El día entero ----------

const dia = () => ({
  productos: [
    { id: 'merluza', nombre: 'Merluza', inicio: 10000, sobra: 2000, pvp: 1290, coste: 800 },
    { id: 'dorada', nombre: 'Dorada', inicio: 6000, sobra: 0, pvp: 995, coste: 600 },
    { id: 'lubina', nombre: 'Lubina', inicio: 0, sobra: null, pvp: 1100 }, // no se trajo hoy
  ],
  caja: { contado: 31290, fondo: 15000, tarjeta: 0, bizum: 0 },
});

test('día que cuadra al céntimo', () => {
  const r = cuadreDelDia(dia());
  assert.equal(r.lineas.length, 2);
  assert.equal(r.teorico, 10320 + 5970);
  assert.equal(r.completo, true);
  assert.equal(r.resultado.diferencia, 0);
  assert.equal(r.resultado.estado, 'cuadra');
});

test('ganancia del día = ventas − coste de lo vendido', () => {
  const r = cuadreDelDia(dia());
  assert.equal(r.ganancia, (10320 - 6400) + (5970 - 3600));
  assert.equal(r.gananciaCompleta, true);
});

test('si falta un coste, la ganancia se marca como incompleta', () => {
  const d = dia();
  delete d.productos[1].coste;
  const r = cuadreDelDia(d);
  assert.equal(r.gananciaCompleta, false);
});

test('con un producto sin contar no se da el cuadre por bueno', () => {
  const d = dia();
  d.productos[1].sobra = null;
  const r = cuadreDelDia(d);
  assert.equal(r.completo, false);
  assert.equal(r.resultado, null);
  assert.deepEqual(r.sinContar, ['Dorada']);
});

test('sin el efectivo contado tampoco hay resultado', () => {
  const d = dia();
  d.caja.contado = null;
  assert.equal(cuadreDelDia(d).resultado, null);
});

test('un día sin género no «cuadra» por estar vacío', () => {
  const r = cuadreDelDia({ productos: [], caja: { contado: 0 } });
  assert.equal(r.completo, false);
});

test('con algo vendido sin precio no se da el cuadre por bueno', () => {
  const d = dia();
  d.productos[1].pvp = null;
  const r = cuadreDelDia(d);
  assert.deepEqual(r.sinPrecio, ['Dorada']);
  assert.equal(r.completo, false);
  assert.equal(r.resultado, null);
});
