// Leer el género dictado (o pegado de un WhatsApp): «merluza diez kilos, boquerón ocho y medio a seis noventa».
// Funciones puras, con pruebas automáticas.
//
// El móvil convierte la voz en texto; aquí se busca cada producto del catálogo (aunque no se diga exacto)
// y los números que lo acompañan: la cantidad y, si se dice, el precio. Nada se guarda sin revisarlo antes.

import { normalizar } from './productos.js';
import { aNumero } from './numeros.js';

// ---------- Palabras ----------

const NUMEROS = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const DECENAS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const CENTENAS = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};
const KILOS = new Set(['kilo', 'kilos', 'kg', 'kgs', 'k', 'kilogramo', 'kilogramos']);
const UNIDADES = new Set(['unidad', 'unidades', 'ud', 'uds', 'bolsa', 'bolsas', 'caja', 'cajas', 'pieza', 'piezas', 'bandeja', 'bandejas']);
const DOCENAS = new Set(['docena', 'docenas']);
const EUROS = new Set(['euro', 'euros', 'eur']);
const MARCA_PRECIO = new Set(['a', 'al', 'por', 'precio', 'pvp', 'vale', 'valen']);
// Palabras que no cambian nada y se pueden saltar dentro del nombre de un producto
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las']);
const SEPARADORES = new Set([',', ';', '.', '\n', '!', '?', 'y', 'e', 'luego', 'tambien', 'despues', 'otro', 'otra']);

const esNumeroPalabra = (w) => w in NUMEROS || w in DECENAS || w in CENTENAS || w === 'mil';
const esDigitos = (w) => /^\d/.test(w);

// ---------- Números dictados ----------

// Un número entero dicho con palabras o cifras: «treinta y dos», «ciento veinte», «12». Devuelve { valor, fin } o null.
function leerEntero(t, i) {
  if (i >= t.length) return null;
  if (esDigitos(t[i])) {
    const v = aNumero(t[i].replace("'", ','));
    return v == null ? null : { valor: v, fin: i + 1, conCifras: true };
  }
  let total = 0;
  let hay = false;
  let j = i;
  const resto = () => {
    if (t[j] in CENTENAS) { total += CENTENAS[t[j]]; j++; hay = true; }
    if (t[j] in DECENAS) {
      total += DECENAS[t[j]]; j++; hay = true;
      if (t[j] === 'y' && NUMEROS[t[j + 1]] >= 1 && NUMEROS[t[j + 1]] <= 9) { total += NUMEROS[t[j + 1]]; j += 2; }
    } else if (t[j] in NUMEROS) { total += NUMEROS[t[j]]; j++; hay = true; }
  };
  resto();
  if (t[j] === 'mil') {
    total = (hay ? total : 1) * 1000;
    j++;
    hay = true;
    resto();
  }
  return hay ? { valor: total, fin: j } : null;
}

// Los decimales dichos después de «coma» o «con»: «cinco» → 5, «noventa» → 90, «cero cinco» → 05
function leerDecimales(t, i, varios) {
  let texto = '';
  let j = i;
  while (j < t.length) {
    const e = leerEntero(t, j);
    if (!e || e.conCifras && !/^\d+$/.test(t[j])) break;
    texto += String(e.valor);
    j = e.fin;
    if (!varios && !(e.valor === 0)) break; // tras «con», un solo número (o «cero» y otro)
  }
  return texto ? { texto, fin: j } : null;
}

// Un número completo: entero, con decimales, «y medio», «tres cuartos», «medio kilo», «dos kilos trescientos»…
// Devuelve { valor, fin, unidad } (unidad: 'kg' | 'ud' | null).
export function leerNumero(t, i) {
  let valor;
  let j;
  if (t[i] === 'medio' || t[i] === 'media') {
    valor = 0.5;
    j = i + 1;
  } else {
    const e = leerEntero(t, i);
    if (!e) return null;
    valor = e.valor;
    j = e.fin;
    // Decimales: «doce coma cinco», «doce con noventa»
    if ((t[j] === 'coma' || t[j] === 'con' || t[j] === 'punto') && t[j + 1] && (esNumeroPalabra(t[j + 1]) || /^\d+$/.test(t[j + 1]))) {
      const d = leerDecimales(t, j + 1, t[j] !== 'con');
      if (d) {
        valor = Number(`${Math.trunc(valor)}.${d.texto}`);
        j = d.fin;
      }
    }
    if (t[j] === 'cuarto' || t[j] === 'cuartos') { // «un cuarto», «tres cuartos»
      valor /= 4;
      j++;
    }
  }

  let unidad = null;
  if (KILOS.has(t[j])) { unidad = 'kg'; j++; }
  else if (UNIDADES.has(t[j])) { unidad = 'ud'; j++; }
  else if (DOCENAS.has(t[j])) { valor *= 12; unidad = 'ud'; j++; }

  // «y medio», «y cuarto», «y tres cuartos» (también detrás de «kilos»)
  if (t[j] === 'y') {
    if (t[j + 1] === 'medio' || t[j + 1] === 'media') { valor += 0.5; j += 2; }
    else if (t[j + 1] === 'cuarto') { valor += 0.25; j += 2; }
    else if (t[j + 1] === 'tres' && (t[j + 2] === 'cuartos')) { valor += 0.75; j += 3; }
  }
  // «dos kilos trescientos» = 2,3 kg
  if (unidad === 'kg' && Number.isInteger(valor)) {
    const g = leerEntero(t, j);
    if (g && Number.isInteger(g.valor) && g.valor >= 100 && g.valor < 1000) {
      valor += g.valor / 1000;
      j = g.fin;
      if (t[j] === 'gramos' || t[j] === 'g') j++;
    }
  }
  return { valor, fin: j, unidad };
}

// ---------- Productos ----------

function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

const formas = (w) => new Set([w, w.replace(/es$/, ''), w.replace(/s$/, '')]);

// ¿Es la misma palabra? Admite plurales y algún error de una letra en palabras largas
function parecida(dicha, delNombre) {
  const a = formas(dicha);
  const b = formas(delNombre);
  for (const x of a) if (b.has(x)) return true;
  const largo = Math.min(dicha.length, delNombre.length);
  const max = largo >= 8 ? 2 : largo >= 5 ? 1 : 0;
  return max > 0 && distancia(dicha, delNombre) <= max;
}

const palabrasNombre = (p) => normalizar(p.nombre).split(' ').filter((w) => !VACIAS.has(w));

// Intenta leer el nombre completo de un producto a partir de la posición i. Devuelve el final o -1.
function encaja(t, i, palabras) {
  let j = i;
  for (const w of palabras) {
    while (VACIAS.has(t[j])) j++;
    if (j >= t.length || !parecida(t[j], w)) return -1;
    j++;
  }
  return j;
}

// Busca un producto en la posición i: primero el nombre completo más largo; si no, los que empiezan
// por esa palabra («boquerón» → chico, mediano o grande). Devuelve { ids, fin, completo } o null.
function buscarProducto(t, i, catalogo) {
  if (VACIAS.has(t[i]) || SEPARADORES.has(t[i]) || esDigitos(t[i]) || esNumeroPalabra(t[i])) return null;
  let mejor = null;
  for (const { p, palabras } of catalogo) {
    const fin = encaja(t, i, palabras);
    if (fin < 0) continue;
    if (!mejor || palabras.length > mejor.largo) mejor = { ids: [p.id], fin, largo: palabras.length };
    else if (palabras.length === mejor.largo && !mejor.ids.includes(p.id)) mejor.ids.push(p.id);
  }
  if (mejor) return { ids: mejor.ids, fin: mejor.fin, completo: mejor.ids.length === 1 };
  const empiezan = catalogo.filter(({ palabras }) => palabras.length > 1 && parecida(t[i], palabras[0]));
  if (empiezan.length) return { ids: empiezan.map(({ p }) => p.id), fin: i + 1, completo: empiezan.length === 1 };
  return null;
}

// ---------- Leer todo ----------

function trocear(texto) {
  const crudos = String(texto ?? '').match(/\d+(?:[.,']\d+)*|[\p{L}€]+|[,;.!?\n]/gu) || [];
  return crudos.map((c) => (c === '€' ? 'euros' : normalizar(c).replace(/€/g, '')) || c);
}

// Interpreta el texto. «productos»: los que se pueden apuntar (sin archivar).
// Devuelve una línea por producto encontrado:
//   { producto: id | null, candidatos: [ids], cantidad: milésimas | null, pvp: céntimos | null, texto, avisos: [] }
export function interpretarGenero(texto, productos) {
  const catalogo = productos.map((p) => ({ p, palabras: palabrasNombre(p) })).filter((x) => x.palabras.length);
  const t = trocear(texto);

  // 1. Elementos: productos, números (con su unidad), marcas de precio y separadores
  const elementos = [];
  for (let i = 0; i < t.length;) {
    const prod = buscarProducto(t, i, catalogo);
    if (prod) {
      elementos.push({ tipo: 'producto', ids: prod.ids, completo: prod.completo, desde: i, hasta: prod.fin });
      i = prod.fin;
      continue;
    }
    const num = (esDigitos(t[i]) || esNumeroPalabra(t[i]) || t[i] === 'medio' || t[i] === 'media') ? leerNumero(t, i) : null;
    if (num) {
      elementos.push({ tipo: 'numero', valor: num.valor, unidad: num.unidad, desde: i, hasta: num.fin });
      i = num.fin;
      continue;
    }
    if (SEPARADORES.has(t[i])) elementos.push({ tipo: 'separador', desde: i, hasta: i + 1 });
    else if (MARCA_PRECIO.has(t[i])) elementos.push({ tipo: 'marca', desde: i, hasta: i + 1 });
    else if (EUROS.has(t[i])) elementos.push({ tipo: 'euros', desde: i, hasta: i + 1 });
    else if (!VACIAS.has(t[i])) elementos.push({ tipo: 'palabra', texto: t[i], desde: i, hasta: i + 1 });
    i++;
  }

  // 2. Precio: los números detrás de «a», «por»… o delante de «euros». «doce noventa» = 12,90
  for (let k = 0; k < elementos.length; k++) {
    const e = elementos[k];
    if (e.tipo !== 'numero') continue;
    const antes = elementos[k - 1];
    const despues = elementos[k + 1];
    if (antes?.tipo === 'marca' || despues?.tipo === 'euros') e.precio = true;
  }
  for (let k = 0; k < elementos.length; k++) {
    const e = elementos[k];
    if (!e.precio) continue;
    let s = k + 1;
    if (elementos[s]?.tipo === 'euros') s++;
    const c = elementos[s];
    if (c?.tipo === 'numero' && !c.precio && !c.unidad && Number.isInteger(c.valor) && c.valor < 100 && Number.isInteger(e.valor)) {
      e.valor += c.valor / 100;
      e.hasta = c.hasta;
      c.usado = true;
    }
  }

  // 3. Trozos separados por comas, «y», puntos…
  const trozos = [[]];
  for (const e of elementos) {
    if (e.tipo === 'separador') trozos.push([]);
    else if (!e.usado) trozos[trozos.length - 1].push(e);
  }

  const lineas = [];
  const nuevaLinea = (prod) => {
    const l = { producto: prod.completo ? prod.ids[0] : null, candidatos: prod.ids, numeros: [], desde: prod.desde, hasta: prod.hasta };
    lineas.push(l);
    return l;
  };

  for (const trozo of trozos.filter((x) => x.length)) {
    const prods = trozo.filter((e) => e.tipo === 'producto');
    if (!prods.length) {
      if (trozo.some((e) => e.tipo === 'numero')) {
        lineas.push({ producto: null, candidatos: [], numeros: trozo.filter((e) => e.tipo === 'numero'), desde: trozo[0].desde, hasta: trozo[trozo.length - 1].hasta, sinProducto: true });
      }
      continue;
    }
    if (prods.length === 1) {
      // Un solo producto en el trozo: todos sus números son suyos, estén antes o después
      const l = nuevaLinea(prods[0]);
      l.numeros = trozo.filter((e) => e.tipo === 'numero');
      l.desde = trozo[0].desde;
      l.hasta = trozo[trozo.length - 1].hasta;
      continue;
    }
    // Varios productos seguidos sin comas: ¿se dice el número antes («diez kilos de merluza») o después?
    const numerosAntes = trozo[0].tipo === 'numero';
    let actual = null;
    let pendientes = [];
    for (const e of trozo) {
      if (e.tipo === 'producto') {
        actual = nuevaLinea(e);
        if (numerosAntes) {
          actual.numeros.push(...pendientes);
          actual.desde = pendientes[0]?.desde ?? actual.desde;
          pendientes = [];
        }
      } else if (e.tipo === 'numero') {
        if (!numerosAntes || (e.precio && actual)) {
          if (actual) { actual.numeros.push(e); actual.hasta = e.hasta; }
        } else {
          pendientes.push(e);
        }
      }
    }
    if (pendientes.length && actual && !actual.numeros.some((n) => !n.precio)) actual.numeros.push(...pendientes);
  }

  // 4. Cantidad y precio de cada línea
  const porId = Object.fromEntries(productos.map((p) => [p.id, p]));
  const crudos = String(texto ?? '').match(/\d+(?:[.,']\d+)*|[\p{L}€]+|[,;.!?\n]/gu) || [];
  return lineas.map((l) => {
    const avisos = [];
    let cantidades = l.numeros.filter((n) => !n.precio);
    let precios = l.numeros.filter((n) => n.precio);
    // Sin «a» ni «euros»: «merluza diez doce noventa» → el segundo número es el precio
    if (!precios.length && cantidades.length >= 2 && !cantidades[1].unidad) {
      const [c, ...resto] = cantidades;
      let pvp = resto[0].valor;
      if (resto[1] && Number.isInteger(pvp) && Number.isInteger(resto[1].valor) && resto[1].valor < 100) pvp += resto[1].valor / 100;
      precios = [{ valor: pvp }];
      cantidades = [c];
    }
    const p = porId[l.producto];
    let cantidad = cantidades[0] ? Math.round(cantidades[0].valor * 1000) : null;
    if (cantidad != null && p?.unidad === 'ud' && cantidad % 1000) {
      avisos.push('no-entero');
      cantidad = null;
    }
    const pvp = precios[0] ? Math.round(precios[0].valor * 100) : null;
    if (l.sinProducto) avisos.push('sin-producto');
    else if (!l.producto) avisos.push('varios-productos');
    if (cantidad == null && !avisos.includes('no-entero')) avisos.push('sin-cantidad');
    if (cantidades.length > 1 || precios.length > 1) avisos.push('numeros-de-mas');
    return {
      producto: l.producto,
      candidatos: l.candidatos,
      cantidad,
      pvp,
      texto: crudos.slice(l.desde, l.hasta).join(' ').replace(/ ([,.;])/g, '$1'),
      avisos,
    };
  });
}
