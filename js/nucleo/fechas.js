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

// Horario de la tienda de Doña Mencía: de martes a sábado, de 8:30 a 13:30
export const HORARIO = { dias: [2, 3, 4, 5, 6], abre: '08:30', cierra: '13:30' };

const diaSemana = (iso) => new Date(iso + 'T12:00:00Z').getUTCDay(); // 0 = domingo
export const abreEseDia = (iso) => HORARIO.dias.includes(diaSemana(iso));

// Hora en que se apunta algo, «13:05»
export function horaActual(ahora = new Date()) {
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
}
