// Dónde se guardan los datos. De momento, en este aparato.
// El resto de la app solo usa «estado» y «guardar()»: si más adelante los datos
// pasan a la nube, solo hay que cambiar este archivo.

import { datosVacios, empaquetarCopia, revisarCopia } from '../nucleo/copia.js';

const CLAVE = 'cdm.datos.v1';

function cargar() {
  const texto = localStorage.getItem(CLAVE);
  if (!texto) return datosVacios();
  try {
    return { ...datosVacios(), ...JSON.parse(texto) };
  } catch {
    // Datos ilegibles: se apartan sin borrarlos, para poder recuperarlos a mano
    localStorage.setItem(`${CLAVE}.ilegible.${Date.now()}`, texto);
    return datosVacios();
  }
}

export const estado = cargar();

// Guarda todo. Devuelve false si el aparato no ha podido guardar (sin espacio, modo privado…).
export function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
    return true;
  } catch {
    return false;
  }
}

// Pide al navegador que no borre los datos por su cuenta para liberar espacio
export function protegerDatos() {
  navigator.storage?.persist?.().catch(() => {});
}

export function descargarCopia() {
  const ahora = new Date();
  const blob = new Blob([JSON.stringify(empaquetarCopia(estado, ahora), null, 2)], { type: 'application/json' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `caja-dona-mencia-${ahora.toISOString().slice(0, 10)}.json`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
  estado.ajustes.ultimaCopia = ahora.toISOString();
  return guardar();
}

// Lee un archivo de copia. Devuelve { datos, fecha } o { error }, sin cambiar nada todavía.
export async function leerCopia(archivo) {
  try {
    return revisarCopia(JSON.parse(await archivo.text()));
  } catch {
    return { error: 'El archivo no se puede leer. Comprueba que es una copia descargada desde esta app.' };
  }
}

// Sustituye los datos actuales por los de una copia ya revisada.
// Lo que había se guarda aparte por si hay que volver atrás.
export function restaurarCopia(datos) {
  try {
    localStorage.setItem(`${CLAVE}.anterior`, JSON.stringify(estado));
  } catch { /* si no cabe, se sigue igualmente */ }
  for (const k of Object.keys(estado)) delete estado[k];
  Object.assign(estado, datos);
  return guardar();
}
