// Piezas de pantalla compartidas por todas las secciones.

export const $ = (id) => document.getElementById(id);

export const escapar = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const svg = (cuerpo) => `<span class="icono"><svg viewBox="0 0 64 64" aria-hidden="true">${cuerpo}</svg></span>`;
export const ICONO = {
  ok: svg('<circle cx="32" cy="32" r="22"/><path d="M22 33l7 7 14-16"/>'),
  alerta: svg('<circle cx="32" cy="32" r="22"/><path d="M32 20v15"/><path d="M32 43v1"/>'),
  reloj: svg('<circle cx="32" cy="32" r="22"/><path d="M32 20v13l8 5"/>'),
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
