import test from 'node:test';
import assert from 'node:assert/strict';
import {
  revisarProducto, hayErrores, crearProducto, cambiarProducto, gananciaPorUnidad,
  activos, archivados, estadoCatalogo, catalogoDeLuque,
} from '../js/nucleo/productos.js';
import { empaquetarCopia, revisarCopia, datosVacios } from '../js/nucleo/copia.js';

const merluza = () => crearProducto({ nombre: 'Merluza', tipo: 'fresco', pvp: 1290, coste: 800 });

// ---------- Revisar antes de guardar ----------

test('un producto correcto no tiene errores', () => {
  const r = revisarProducto({ nombre: 'Merluza', tipo: 'fresco', pvp: 1290, coste: 800 });
  assert.equal(hayErrores(r), false);
  assert.deepEqual(r.avisos, []);
});

test('se puede guardar sin precio ni coste (se rellenan después)', () => {
  assert.equal(hayErrores(revisarProducto({ nombre: 'Rape', tipo: 'fresco' })), false);
});

test('el nombre es obligatorio', () => {
  assert.ok(revisarProducto({ nombre: '  ', tipo: 'fresco' }).errores.nombre);
});

test('no deja repetir un nombre, aunque cambien mayúsculas, tildes o espacios', () => {
  const catalogo = [crearProducto({ nombre: 'Boquerón grande', tipo: 'fresco' })];
  assert.ok(revisarProducto({ nombre: 'boqueron  GRANDE', tipo: 'fresco' }, catalogo).errores.nombre);
});

test('al cambiar un producto, su propio nombre no cuenta como repetido', () => {
  const p = merluza();
  assert.equal(hayErrores(revisarProducto({ ...p, pvp: 1390 }, [p], p.id)), false);
});

test('si el nombre es de un producto archivado, avisa de que hay que recuperarlo', () => {
  const p = { ...merluza(), archivado: true };
  assert.match(revisarProducto({ nombre: 'Merluza', tipo: 'fresco' }, [p]).errores.nombre, /archivado/);
});

test('rechaza precios y mermas imposibles', () => {
  assert.ok(revisarProducto({ nombre: 'Rape', tipo: 'fresco', pvp: 0 }).errores.pvp);
  assert.ok(revisarProducto({ nombre: 'Rape', tipo: 'fresco', coste: -100 }).errores.coste);
  assert.ok(revisarProducto({ nombre: 'Rape', tipo: 'fresco', mermaPct: 100 }).errores.mermaPct);
  assert.ok(revisarProducto({ nombre: 'Rape', tipo: 'otro' }).errores.tipo);
});

test('avisa (sin impedir guardar) si se vende sin ganar', () => {
  const r = revisarProducto({ nombre: 'Rape', tipo: 'fresco', pvp: 800, coste: 900 });
  assert.equal(hayErrores(r), false);
  assert.equal(r.avisos.length, 1);
});

// ---------- Crear y cambiar ----------

test('el id sale del nombre y no se repite', () => {
  const a = crearProducto({ nombre: 'Boquerón grande', tipo: 'fresco' });
  assert.equal(a.id, 'boqueron-grande');
  const b = crearProducto({ nombre: 'Boquerón grande', tipo: 'fresco' }, [a]);
  assert.equal(b.id, 'boqueron-grande-2');
  assert.equal(crearProducto({ nombre: 'Gamba pelada', tipo: 'congelado' }).id, 'cong-gamba-pelada');
});

test('un producto nuevo queda completo y sin archivar', () => {
  const p = crearProducto({ nombre: '  Merluza  ', tipo: 'fresco' });
  assert.deepEqual(p, { id: 'merluza', nombre: 'Merluza', tipo: 'fresco', unidad: 'kg', pvp: null, coste: null, mermaPct: 0, formato: '', archivado: false });
});

test('cambiar el nombre no cambia el id (los días antiguos lo siguen encontrando)', () => {
  const p = cambiarProducto(merluza(), { nombre: 'Merluza de pincho', tipo: 'fresco', pvp: 1490, coste: 900 });
  assert.equal(p.id, 'merluza');
  assert.equal(p.nombre, 'Merluza de pincho');
  assert.equal(p.pvp, 1490);
});

// ---------- Ganancia ----------

test('ganancia por kilo = precio − coste', () => {
  assert.deepEqual(gananciaPorUnidad({ pvp: 1290, coste: 800 }), { ingreso: 1290, ganancia: 490, porcentaje: 38 });
});

test('con merma de limpieza se cobra menos por cada kilo comprado', () => {
  // Salmón: 20 € de venta, 12 € de coste, 25 % de merma → de cada kilo se cobran 15 €
  assert.deepEqual(gananciaPorUnidad({ pvp: 2000, coste: 1200, mermaPct: 25 }), { ingreso: 1500, ganancia: 300, porcentaje: 20 });
});

test('sin precio o sin coste no hay ganancia que enseñar', () => {
  assert.equal(gananciaPorUnidad({ pvp: 1290, coste: null }), null);
  assert.equal(gananciaPorUnidad({ pvp: null, coste: 800 }), null);
});

// ---------- Catálogo ----------

test('archivar no borra: el producto sigue en el catálogo', () => {
  const catalogo = [merluza(), { ...crearProducto({ nombre: 'Rape', tipo: 'fresco' }), archivado: true }];
  assert.equal(activos(catalogo).length, 1);
  assert.equal(archivados(catalogo).length, 1);
  assert.deepEqual(estadoCatalogo(catalogo), { total: 1, sinPrecio: 0, sinCoste: 0, archivados: 1 });
});

test('la lista de Luque: 60 productos, sin ids repetidos y todos válidos', () => {
  const lista = catalogoDeLuque();
  assert.equal(lista.length, 60);
  assert.equal(new Set(lista.map((p) => p.id)).size, 60);
  for (const p of lista) {
    assert.equal(hayErrores(revisarProducto(p, lista, p.id)), false, p.nombre);
  }
  assert.equal(lista.find((p) => p.nombre === 'Gamba pelada').unidad, 'ud');
});

// ---------- Copia de seguridad ----------

test('una copia recién hecha se puede restaurar tal cual', () => {
  const datos = { ...datosVacios(), productos: [merluza()] };
  const vuelta = revisarCopia(JSON.parse(JSON.stringify(empaquetarCopia(datos))));
  assert.equal(vuelta.error, undefined);
  assert.deepEqual(vuelta.datos, datos);
});

test('no acepta archivos que no son una copia de esta app', () => {
  assert.ok(revisarCopia(null).error);
  assert.ok(revisarCopia({ productos: [], dias: {} }).error); // copia de la app de Luque
  assert.ok(revisarCopia({ app: 'caja-dona-mencia', datos: { productos: 'x', dias: {} } }).error);
  assert.ok(revisarCopia({ app: 'caja-dona-mencia', datos: { productos: [{ nombre: 'sin id' }], dias: {} } }).error);
  assert.ok(revisarCopia({ app: 'caja-dona-mencia', datos: { version: 99, productos: [], dias: {} } }).error);
});
