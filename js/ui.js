// Piezas de pantalla compartidas por todas las secciones.

export const $ = (id) => document.getElementById(id);

export const escapar = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const svg = (cuerpo) => `<span class="icono"><svg viewBox="0 0 64 64" aria-hidden="true">${cuerpo}</svg></span>`;
export const ICONO = {
  ok: svg('<circle cx="32" cy="32" r="22"/><path d="M22 33l7 7 14-16"/>'),
  alerta: svg('<circle cx="32" cy="32" r="22"/><path d="M32 20v15"/><path d="M32 43v1"/>'),
  reloj: svg('<circle cx="32" cy="32" r="22"/><path d="M32 20v13l8 5"/>'),
  microfono: svg('<rect x="24" y="8" width="16" height="30" rx="8"/><path d="M15 30a17 17 0 0 0 34 0"/><path d="M32 47v9"/><path d="M23 56h18"/>'),
  copiar: svg('<rect x="22" y="20" width="28" height="34" rx="4"/><path d="M14 44V14a4 4 0 0 1 4-4h24"/>'),
  parar: svg('<rect x="19" y="19" width="26" height="26" rx="3"/>'),
  lista: svg('<path d="M24 18h28M24 32h28M24 46h28"/><path d="M12 15l3 3-3 3-3-3zM12 29l3 3-3 3-3-3zM12 43l3 3-3 3-3-3z"/>'),
};

// Mensaje breve que aparece abajo y se quita solo
export function avisar(texto) {
  const t = $('aviso');
  t.textContent = texto;
  t.classList.add('visible');
  clearTimeout(avisar.temporizador);
  avisar.temporizador = setTimeout(() => t.classList.remove('visible'), 3000);
}

// Si el aparato no ha podido guardar, hay que decirlo claro: no se puede perder en silencio
export function comprobarGuardado(ok) {
  if (!ok) alert('No se ha podido guardar en este aparato. Comprueba que queda espacio libre y que no estás en una ventana privada.');
  return ok;
}

// Descarga un archivo de texto (por ejemplo, un CSV para Excel)
export function descargarArchivo(nombre, texto, tipo = 'text/csv') {
  // La marca BOM hace que Excel lea bien las tildes y la ñ
  const blob = new Blob(['﻿' + texto], { type: `${tipo};charset=utf-8` });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}
