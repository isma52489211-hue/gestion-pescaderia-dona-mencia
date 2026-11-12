import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarGenero, leerNumero } from '../js/nucleo/dictado.js';
import { catalogoDeLuque } from '../js/nucleo/productos.js';

// El catálogo de Luque, sin el congelado: nombres reales, parecidos entre sí (boquerón chico, mediano, grande…)
const CATALOGO = catalogoDeLuque().filter((p) => p.tipo !== 'congelado');
const id = (nombre) => CATALOGO.find((p) => p.nombre === nombre).id;
const ostras = { id: 'ostras', nombre: 'Ostras', tipo: 'marisco', unidad: 'ud' };
const CON_OSTRAS = [...CATALOGO, ostras];

const leer = (texto, cat = CATALOGO) => interpretarGenero(texto, cat);
const resumen = (texto, cat) => leer(texto, cat).map((l) => [l.producto, l.cantidad, l.pvp]);

// ---------- Números ----------

test('números dichos con palabras', () => {
  const n = (texto) => leerNumero(texto.split(' '), 0).valor;
  assert.equal(n('diez'), 10);
  assert.equal(n('treinta y dos'), 32);
  assert.equal(n('ciento veinte'), 120);
  assert.equal(n('ocho y medio'), 8.5);
  assert.equal(n('dos kilos y medio'), 2.5);
  assert.equal(n('dos y cuarto'), 2.25);
  assert.equal(n('tres cuartos'), 0.75);
  assert.equal(n('medio'), 0.5);
  assert.equal(n('dos kilos trescientos'), 2.3);
  assert.equal(n('doce coma cinco'), 12.5);
  assert.equal(n('doce con noventa'), 12.9);
  assert.equal(n('cuatro coma cero cinco'), 4.05);
  assert.equal(n('12,5'), 12.5);
  assert.equal(n('dos docenas'), 24);
});

// ---------- Frases ----------

test('la frase de ejemplo', () => {
  assert.deepEqual(resumen('merluza diez kilos, boquerón grande ocho y medio, salmón cuatro a veintidós'), [
    [id('Merluza'), 10000, null],
    [id('Boquerón grande'), 8500, null],
    [id('Salmón'), 4000, 2200],
  ]);
});

test('precios: «a doce noventa», «12,90 €», «doce con noventa», «doce euros noventa»', () => {
  assert.deepEqual(resumen('merluza diez kilos a doce noventa')[0], [id('Merluza'), 10000, 1290]);
  assert.deepEqual(resumen('merluza 10 kg 12,90 €')[0], [id('Merluza'), 10000, 1290]);
  assert.deepEqual(resumen('merluza diez a doce con noventa')[0], [id('Merluza'), 10000, 1290]);
  assert.deepEqual(resumen('merluza diez kilos doce euros noventa')[0], [id('Merluza'), 10000, 1290]);
  assert.deepEqual(resumen('dorada seis kilos a nueve')[0], [id('Dorada'), 6000, 900]);
});

test('sin comas ni «y», con el número detrás del producto', () => {
  assert.deepEqual(resumen('merluza diez boquerón grande ocho dorada seis a nueve noventa'), [
    [id('Merluza'), 10000, null],
    [id('Boquerón grande'), 8000, null],
    [id('Dorada'), 6000, 990],
  ]);
});

test('con el número delante: «diez kilos de merluza y ocho de dorada»', () => {
  assert.deepEqual(resumen('diez kilos de merluza y ocho de dorada'), [
    [id('Merluza'), 10000, null],
    [id('Dorada'), 8000, null],
  ]);
  assert.deepEqual(resumen('diez kilos de merluza a doce noventa ocho de dorada'), [
    [id('Merluza'), 10000, 1290],
    [id('Dorada'), 8000, null],
  ]);
});

test('pegado de un WhatsApp, una línea por producto', () => {
  const texto = 'Merluza 10\nDorada 6,5\nLubina 4 a 11,90\nSalmonetes 3';
  assert.deepEqual(resumen(texto), [
    [id('Merluza'), 10000, null],
    [id('Dorada'), 6500, null],
    [id('Lubina'), 4000, 1190],
    [id('Salmonetes'), 3000, null],
  ]);
});

test('reconoce el producto aunque no se diga exacto: plurales, tildes y una letra mal', () => {
  assert.equal(leer('sardina 5')[0].producto, id('Sardinas'));
  assert.equal(leer('salmonete 3')[0].producto, id('Salmonetes'));
  assert.equal(leer('lenguado 2')[0].producto, id('Lenguados'));
  assert.equal(leer('salmon 4')[0].producto, id('Salmón'));
  assert.equal(leer('calamar fino 2')[0].producto, id('Calamar fino'));
  assert.equal(leer('filete bacalao 3')[0].producto, id('Filete de bacalao')); // sin el «de»
  assert.equal(leer('langostino cocido 2')[0].producto, id('Langostinos cocidos'));
  // No se parece a nada del catálogo: no se inventa, se deja la línea sin producto para elegirlo
  const [raro] = leer('pescadilla 3');
  assert.equal(raro.producto, null);
  assert.deepEqual(raro.candidatos, []);
});

test('el nombre más completo gana: «sardinas chicas» no es «sardinas»', () => {
  assert.equal(leer('sardinas chicas 3')[0].producto, id('Sardinas chicas'));
  assert.equal(leer('sardinas 3')[0].producto, id('Sardinas'));
  assert.equal(leer('almejas gordas 2')[0].producto, id('Almejas gordas'));
});

test('si no está claro qué producto es, da las opciones', () => {
  const [l] = leer('boquerón 8');
  assert.equal(l.producto, null);
  assert.deepEqual(l.candidatos.sort(), [id('Boquerón chico'), id('Boquerón mediano'), id('Boquerón grande')].sort());
  assert.equal(l.cantidad, 8000);
  assert.ok(l.avisos.includes('varios-productos'));
});

test('por unidades: solo números enteros', () => {
  assert.deepEqual(resumen('veinticuatro ostras', CON_OSTRAS), [['ostras', 24000, null]]);
  assert.deepEqual(resumen('ostras dos docenas', CON_OSTRAS), [['ostras', 24000, null]]);
  const [l] = leer('ostras ocho y medio', CON_OSTRAS);
  assert.equal(l.cantidad, null);
  assert.ok(l.avisos.includes('no-entero'));
});

test('lo que no se entiende se avisa, no se inventa', () => {
  const [sinCantidad] = leer('merluza');
  assert.equal(sinCantidad.cantidad, null);
  assert.ok(sinCantidad.avisos.includes('sin-cantidad'));
  const [suelto] = leer('pescadilla diez kilos');
  assert.equal(suelto.producto, null);
  assert.ok(suelto.avisos.includes('sin-producto'));
  assert.equal(suelto.texto, 'pescadilla diez kilos');
});

test('guarda el trozo de texto de cada línea para revisarlo', () => {
  const l = leer('Merluza diez kilos, Dorada seis');
  assert.equal(l[0].texto, 'Merluza diez kilos');
  assert.equal(l[1].texto, 'Dorada seis');
  assert.equal(leer('dorada seis a nueve noventa')[0].texto, 'dorada seis a nueve noventa');
});

test('un texto vacío no da nada', () => {
  assert.deepEqual(leer(''), []);
  assert.deepEqual(leer(null), []);
});
