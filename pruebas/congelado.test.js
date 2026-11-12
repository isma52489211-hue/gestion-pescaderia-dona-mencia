import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inicioDelDia, stockActual, lineaCongelado, congeladosDelDia, sinStockDePartida,
  ponerLlegada, ponerQueda, ponerSinVenta, ponerStockPartida, reposicion, textoReposicion,
} from '../js/nucleo/congelado.js';
import { ponerDato, ponerFondo } from '../js/nucleo/dia.js';
import {
  ponerSobra, ponerSalida, ponerCaja, estadoCierre, terminarCierre, cuadreDeUnDia, reabrirCierre,
} from '../js/nucleo/cierre.js';
import { fmtUnidades, fmtKg } from '../js/nucleo/numeros.js';

const gamba = () => ({ id: 'cong-gamba', nombre: 'Gamba pelada', tipo: 'congelado', unidad: 'ud', formato: 'bolsa de 1 kg', pvp: 900, coste: 600, stockIdeal: 10000 });
const bacalao = () => ({ id: 'cong-bacalao', nombre: 'Bacalao congelado', tipo: 'congelado', unidad: 'kg', pvp: 1200, coste: 800, stockIdeal: 5000 });
const merluza = { id: 'merluza', nombre: 'Merluza', tipo: 'fresco', unidad: 'kg', pvp: 1290, coste: 800, mermaPct: 0 };
const D1 = '2026-12-01';
const D2 = '2026-12-02';
const D3 = '2026-12-03';
const formatear = (p, m) => (p.unidad === 'ud' ? fmtUnidades(m) : fmtKg(m));

// ---------- Stock ----------

test('sin stock de partida no se sabe cuánto hay', () => {
  const g = gamba();
  assert.equal(inicioDelDia({}, g, D1), null);
  assert.deepEqual(sinStockDePartida([g, merluza], D1).map((p) => p.id), ['cong-gamba']);
  assert.equal(ponerLlegada({}, g, D1, 5000).error, 'sin-stock');
});

test('stock de partida: solo vale desde ese día, y solo una vez', () => {
  const g = gamba();
  assert.deepEqual(ponerStockPartida(g, D2, 6000), {});
  assert.equal(inicioDelDia({}, g, D1), null); // los días de antes no cambian
  assert.equal(inicioDelDia({}, g, D2), 6000);
  assert.equal(ponerStockPartida(g, D3, 1000).error, 'ya-tiene');
  assert.equal(ponerStockPartida(gamba(), D1, null).error, 'sin-cantidad');
  assert.deepEqual(ponerStockPartida(gamba(), D1, 0), {}); // 0 sí es un dato
});

test('el stock pasa de un día a otro: lo que queda + lo que llega', () => {
  const g = gamba();
  ponerStockPartida(g, D1, 6000);
  const dias = {};
  ponerLlegada(dias, g, D1, 4000);
  assert.equal(lineaCongelado(dias, g, D1).habia, 10000);
  ponerQueda(dias, g, D1, 7000);
  assert.equal(inicioDelDia(dias, g, D2), 7000);
  assert.equal(stockActual(dias, g, D1), 7000);
});

test('«no se ha vendido nada»: queda lo que había menos retiradas y mermas', () => {
  const g = gamba();
  ponerStockPartida(g, D1, 6000);
  const dias = {};
  ponerSinVenta(dias, g, D1);
  const l = lineaCongelado(dias, g, D1);
  assert.equal(l.contado, true);
  assert.equal(l.queda, 6000);
  assert.equal(inicioDelDia(dias, g, D2), 6000);
});

test('sin contar no es lo mismo que «no se ha vendido nada»', () => {
  const g = gamba();
  ponerStockPartida(g, D1, 6000);
  const dias = {};
  ponerLlegada(dias, g, D1, 1000);
  assert.equal(lineaCongelado(dias, g, D1).contado, false);
  ponerQueda(dias, g, D1, 0);
  assert.equal(lineaCongelado(dias, g, D1).contado, true); // queda 0: se vendió todo, pero contado
  ponerQueda(dias, g, D1, null);
  assert.equal(lineaCongelado(dias, g, D1).contado, false);
});

test('un día sin abrir no vende nada', () => {
  const g = gamba();
  ponerStockPartida(g, D1, 6000);
  const dias = { [D2]: { genero: {}, caja: {} } };
  assert.equal(inicioDelDia(dias, g, D3), 6000);
});

test('los congelados del día son los que tienen algo en la tienda', () => {
  const g = gamba();
  const b = bacalao();
  ponerStockPartida(g, D1, 6000);
  ponerStockPartida(b, D1, 0);
  assert.deepEqual(congeladosDelDia({}, [g, b, merluza], D1).map((p) => p.id), ['cong-gamba']);
  const dias = {};
  ponerLlegada(dias, b, D1, 3000);
  assert.deepEqual(congeladosDelDia(dias, [g, b], D1).map((p) => p.id), ['cong-gamba', 'cong-bacalao']);
});

// ---------- Reposición ----------

test('reposición: lo que falta para el stock ideal, en unidades enteras', () => {
  const g = gamba();
  const b = bacalao();
  ponerStockPartida(g, D1, 6500);
  ponerStockPartida(b, D1, 6000);
  const lista = reposicion({}, [g, b, merluza], D1);
  assert.equal(lista.find((x) => x.producto.id === 'cong-gamba').falta, 4000); // 3,5 → 4 bolsas
  assert.equal(lista.find((x) => x.producto.id === 'cong-bacalao').falta, 0); // ya hay de sobra
  const texto = textoReposicion(lista, '1 de diciembre', formatear);
  assert.match(texto, /Gamba pelada \(bolsa de 1 kg\): 4 uds/);
  assert.doesNotMatch(texto, /Bacalao/);
  assert.equal(textoReposicion([], 'hoy', formatear), '');
});

test('sin stock de partida no se calcula la reposición', () => {
  const lista = reposicion({}, [gamba()], D1);
  assert.equal(lista[0].falta, null);
});

// ---------- En el cierre y el cuadre ----------

function diaConCongelado() {
  const g = gamba();
  ponerStockPartida(g, D1, 6000);
  const catalogo = [merluza, g];
  const dias = {};
  ponerDato(dias, merluza, D1, 'inicio', 10000);
  ponerFondo(dias, D1, 15000);
  ponerLlegada(dias, g, D1, 4000); // hay 10 bolsas
  return { dias, catalogo, g };
}

test('el cierre pide contar el congelado', () => {
  const { dias, catalogo, g } = diaConCongelado();
  ponerSobra(dias, merluza, D1, 0);
  ponerCaja(dias, D1, 'contado', 0);
  ponerCaja(dias, D1, 'tarjeta', 0);
  ponerCaja(dias, D1, 'bizum', 0);
  let e = estadoCierre(dias, catalogo, D1);
  assert.deepEqual(e.congSinContar, ['Gamba pelada']);
  assert.equal(e.listo, false);
  ponerSinVenta(dias, g, D1);
  e = estadoCierre(dias, catalogo, D1);
  assert.equal(e.congeladosContados, 1);
  assert.equal(e.listo, true);
});

test('el cierre pide el stock de partida de los congelados en uso', () => {
  const { dias, catalogo } = diaConCongelado();
  const nuevo = { id: 'cong-sopa', nombre: 'Preparado de sopa', tipo: 'congelado', unidad: 'ud', pvp: 300 };
  const e = estadoCierre(dias, [...catalogo, nuevo], D1);
  assert.deepEqual(e.faltan.find((f) => f.tipo === 'sin-stock'), { tipo: 'sin-stock', productos: ['Preparado de sopa'] });
  // Archivado ya no lo pide
  assert.equal(estadoCierre(dias, [...catalogo, { ...nuevo, archivado: true }], D1).faltan.some((f) => f.tipo === 'sin-stock'), false);
});

test('lo vendido de congelado entra en el cuadre', () => {
  const { dias, catalogo, g } = diaConCongelado();
  ponerSobra(dias, merluza, D1, 2000); // 8 kg × 12,90 = 103,20 €
  ponerSalida(dias, catalogo, D1, { producto: 'cong-gamba', tipo: 'merma', cantidad: 1000 }); // una bolsa rota
  ponerQueda(dias, g, D1, 6000); // 10 − 6 − 1 = 3 bolsas × 9 € = 27 €
  ponerCaja(dias, D1, 'contado', 15000 + 10320 + 2700);
  ponerCaja(dias, D1, 'tarjeta', 0);
  ponerCaja(dias, D1, 'bizum', 0);
  assert.deepEqual(terminarCierre(dias, catalogo, D1, '13:40'), {});
  const r = cuadreDeUnDia(dias, catalogo, D1);
  const linea = r.lineas.find((l) => l.id === 'cong-gamba');
  assert.equal(linea.congelado, true);
  assert.equal(linea.vendido, 3000);
  assert.equal(linea.importe, 2700);
  assert.equal(r.teorico, 10320 + 2700);
  assert.equal(r.resultado.estado, 'cuadra');
  assert.equal(r.costeMermas, 600); // la bolsa rota costó 6 €
});

test('el precio del congelado queda fijado al cerrar', () => {
  const { dias, catalogo, g } = diaConCongelado();
  ponerSobra(dias, merluza, D1, 0);
  ponerSinVenta(dias, g, D1);
  ponerCaja(dias, D1, 'contado', 0);
  ponerCaja(dias, D1, 'tarjeta', 0);
  ponerCaja(dias, D1, 'bizum', 0);
  terminarCierre(dias, catalogo, D1, '13:40');
  g.pvp = 1500; // sube el precio en el catálogo
  assert.equal(lineaCongelado(dias, g, D1).pvp, 900);
});

test('con el cierre terminado no se toca el congelado', () => {
  const { dias, catalogo, g } = diaConCongelado();
  ponerSobra(dias, merluza, D1, 0);
  ponerSinVenta(dias, g, D1);
  ponerCaja(dias, D1, 'contado', 0);
  ponerCaja(dias, D1, 'tarjeta', 0);
  ponerCaja(dias, D1, 'bizum', 0);
  terminarCierre(dias, catalogo, D1, '13:40');
  assert.equal(ponerQueda(dias, g, D1, 1000).error, 'cerrado');
  assert.equal(ponerLlegada(dias, g, D1, 1000).error, 'cerrado');
  reabrirCierre(dias, D1);
  assert.deepEqual(ponerQueda(dias, g, D1, 1000), {});
});
