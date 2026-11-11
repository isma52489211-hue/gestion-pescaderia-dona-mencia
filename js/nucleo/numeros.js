// Números de la app.
// Regla de oro: nunca se guardan decimales.
//   · Dinero   → céntimos enteros   (12,90 € = 1290)
//   · Cantidad → milésimas enteras  (2,5 kg = 2500; 3 bolsas = 3000)
// Así las sumas son exactas y no aparecen errores de redondeo.

// Convierte lo que escribe una persona («12,90», «1.250,5», «3.2», « 4 kg ») en un número.
// Devuelve null si está vacío o no es un número válido. No admite negativos.
export function aNumero(texto) {
  if (texto == null) return null;
  let t = String(texto).trim().replace(/\s|€|kg|uds?/gi, '');
  if (!t) return null;
  // Con coma, los puntos son separadores de miles; sin coma, el punto es el decimal
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function aCentimos(texto) {
  const n = aNumero(texto);
  return n == null ? null : Math.round(n * 100);
}

export function aMilesimas(texto) {
  const n = aNumero(texto);
  return n == null ? null : Math.round(n * 1000);
}

// Para productos que se cuentan por unidades enteras (bolsas, cajas)
export function aUnidades(texto) {
  const n = aNumero(texto);
  return n == null || !Number.isInteger(n) ? null : n * 1000;
}

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const decimales = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 });

export const fmtEuros = (centimos) => euros.format((centimos || 0) / 100);
export const fmtKg = (milesimas) => `${decimales.format((milesimas || 0) / 1000)} kg`;
export const fmtUnidades = (milesimas) => {
  const n = (milesimas || 0) / 1000;
  return `${decimales.format(n)} ${n === 1 ? 'ud' : 'uds'}`;
};

// Para volver a enseñar un valor dentro de una casilla
export const centimosATexto = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));
export const milesimasATexto = (m) => (m == null ? '' : String(m / 1000).replace('.', ','));

// Importe de una cantidad a un precio por kilo o por unidad
export const importe = (milesimas, centimosPorUnidad) => Math.round((milesimas * centimosPorUnidad) / 1000);
