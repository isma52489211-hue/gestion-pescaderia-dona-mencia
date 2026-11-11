// Fechas. Los días se identifican siempre como texto «2026-12-01».

export function hoyISO(ahora = new Date()) {
  const d = new Date(ahora);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function sumarDias(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const esFecha = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(new Date(iso + 'T12:00:00Z').getTime());

const texto = (iso, opciones) => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-ES', { timeZone: 'UTC', ...opciones });
export const fechaLarga = (iso) => texto(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fechaCorta = (iso) => texto(iso, { weekday: 'long', day: 'numeric', month: 'long' });
