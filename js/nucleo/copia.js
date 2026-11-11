// Copia de seguridad: empaquetar los datos y comprobar una copia antes de restaurarla.

export const APP = 'caja-dona-mencia';
export const VERSION_DATOS = 1;

export const datosVacios = () => ({ version: VERSION_DATOS, productos: [], dias: {}, ajustes: {} });

export function empaquetarCopia(datos, fecha = new Date()) {
  return { app: APP, fecha: fecha.toISOString(), datos };
}

// Devuelve { datos } si la copia vale, o { error } explicando por qué no.
export function revisarCopia(copia) {
  if (!copia || typeof copia !== 'object') return { error: 'El archivo no es una copia de esta app.' };
  if (copia.app !== APP) return { error: 'El archivo no es una copia de la app de Doña Mencía.' };
  const d = copia.datos;
  if (!d || !Array.isArray(d.productos) || typeof d.dias !== 'object' || d.dias === null || Array.isArray(d.dias)) {
    return { error: 'La copia está incompleta o dañada.' };
  }
  if (d.version > VERSION_DATOS) return { error: 'La copia es de una versión más nueva de la app. Actualiza la app y vuelve a intentarlo.' };
  if (d.productos.some((p) => !p || typeof p.id !== 'string' || typeof p.nombre !== 'string')) {
    return { error: 'La copia tiene productos dañados.' };
  }
  return { datos: { ...datosVacios(), ...d }, fecha: copia.fecha || null };
}
