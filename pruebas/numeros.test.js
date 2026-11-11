import test from 'node:test';
import assert from 'node:assert/strict';
import { aNumero, aCentimos, aMilesimas, aUnidades, fmtEuros, fmtKg, centimosATexto, milesimasATexto, importe } from '../js/nucleo/numeros.js';

test('lee números escritos a la española', () => {
  assert.equal(aNumero('12,90'), 12.9);
  assert.equal(aNumero('1.250,50'), 1250.5);
  assert.equal(aNumero(' 4 kg '), 4);
  assert.equal(aNumero('12,90 €'), 12.9);
});

test('sin coma, el punto es el decimal', () => {
  assert.equal(aNumero('3.2'), 3.2);
  assert.equal(aNumero('.5'), 0.5);
});

test('vacío o basura no es cero: es «sin dato»', () => {
  assert.equal(aNumero(''), null);
  assert.equal(aNumero('   '), null);
  assert.equal(aNumero(null), null);
  assert.equal(aNumero('abc'), null);
  assert.equal(aNumero('12abc'), null);
  assert.equal(aNumero('1,2,3'), null);
  assert.equal(aNumero('-5'), null);
});

test('cero escrito sí es cero', () => {
  assert.equal(aNumero('0'), 0);
  assert.equal(aMilesimas('0'), 0);
  assert.equal(aCentimos('0,00'), 0);
});

test('dinero a céntimos y peso a milésimas, sin decimales sueltos', () => {
  assert.equal(aCentimos('12,90'), 1290);
  assert.equal(aCentimos('0,1'), 10);
  assert.equal(aCentimos('19,99'), 1999);
  assert.equal(aMilesimas('2,5'), 2500);
  assert.equal(aMilesimas('0,375'), 375);
});

test('las unidades tienen que ser enteras', () => {
  assert.equal(aUnidades('3'), 3000);
  assert.equal(aUnidades('2,5'), null);
});

test('importe = cantidad × precio, redondeado al céntimo', () => {
  assert.equal(importe(2500, 1290), 3225); // 2,5 kg a 12,90 €
  assert.equal(importe(333, 999), 333); // 0,333 kg a 9,99 € = 3,3267 → 3,33 €
  assert.equal(importe(3000, 450), 1350); // 3 bolsas a 4,50 €
});

test('sumar céntimos no arrastra errores (0,10 + 0,20 = 0,30)', () => {
  assert.equal(aCentimos('0,10') + aCentimos('0,20'), aCentimos('0,30'));
});

test('formatos para enseñar en pantalla', () => {
  assert.equal(fmtEuros(1290).replace(/\s/g, ' '), '12,90 €');
  assert.equal(fmtKg(2500), '2,5 kg');
  assert.equal(centimosATexto(1290), '12,90');
  assert.equal(centimosATexto(null), '');
  assert.equal(milesimasATexto(2500), '2,5');
  assert.equal(milesimasATexto(0), '0');
});
