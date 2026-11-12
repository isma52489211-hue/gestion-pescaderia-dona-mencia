// Apuntar el género rápido, sin teclear: dictándolo (o pegando un WhatsApp) o copiándolo de otro día.
// Forma parte del paso 1 del día (Género). Nada se guarda sin revisarlo antes.

import { $, ICONO, escapar, avisar, comprobarGuardado } from '../ui.js';
import { estado, guardar } from '../datos/almacen.js';
import { interpretarGenero } from '../nucleo/dictado.js';
import { lineaGenero, ponerDato, diasConGenero, copiarGenero } from '../nucleo/dia.js';
import { aCentimos, aMilesimas, aUnidades, fmtKg, fmtUnidades, centimosATexto, milesimasATexto } from '../nucleo/numeros.js';
import { fechaCorta } from '../nucleo/fechas.js';

const TIPOS_GENERO = ['fresco', 'gordo', 'marisco'];
const Reconocimiento = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const producto = (id) => estado.productos.find((p) => p.id === id);
const porUnidades = (p) => p.unidad === 'ud';
const cantidad = (p, m) => (porUnidades(p) ? fmtUnidades(m) : fmtKg(m));
const enUso = () => estado.productos
  .filter((p) => TIPOS_GENERO.includes(p.tipo) && !p.archivado)
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

let escuchando = null;

// ---------- Botones del paso 1 ----------

export function botonesRapido() {
  return `<div class="botones rapido-botones">
      <button type="button" class="btn primario" data-rapido="dictar">${ICONO.microfono} Dictar o pegar</button>
      <button type="button" class="btn secundario" data-rapido="copiar">${ICONO.copiar} Copiar de otro día</button>
    </div>`;
}

// ---------- Dictar ----------

function panelDictado() {
  return `<section class="tarjeta panel-rapido">
    <h2>Dictar o pegar el género</h2>
    <p class="ayuda">${Reconocimiento ? 'Pulsa <strong>Hablar</strong>' : 'Pulsa el micrófono del teclado'} y di cada producto con sus kilos y, si quieres, el precio. Por ejemplo: <em>«merluza diez kilos, dorada seis y medio, salmón cuatro a veintidós»</em>. También puedes pegar un mensaje de WhatsApp.</p>
    <label class="sr-solo" for="rapido-texto">Texto del género</label>
    <textarea id="rapido-texto" rows="4" placeholder="merluza diez kilos, dorada seis y medio…"></textarea>
    <p class="ayuda" id="rapido-escucha" role="status" hidden></p>
    <div class="botones">
      ${Reconocimiento ? `<button type="button" class="btn primario" id="rapido-hablar">${ICONO.microfono} Hablar</button>` : ''}
      <button type="button" class="btn ${Reconocimiento ? 'secundario' : 'primario'}" id="rapido-leer">Leer el texto</button>
      <button type="button" class="btn secundario" data-rapido="cerrar">Cancelar</button>
    </div>
    <div id="rapido-revision"></div>
  </section>`;
}

const AVISOS = {
  'sin-producto': 'No sé qué producto es: elígelo.',
  'varios-productos': 'Puede ser más de un producto: elige cuál.',
  'sin-cantidad': 'Falta la cantidad.',
  'no-entero': 'Se vende por unidades: tiene que ser un número entero.',
  'numeros-de-mas': 'Había más números de los que entiendo: revísalo.',
};

function opcionesProducto(l) {
  const lista = enUso();
  const posibles = lista.filter((p) => l.candidatos.includes(p.id));
  const opcion = (p) => `<option value="${p.id}"${p.id === l.producto ? ' selected' : ''}>${escapar(p.nombre)}</option>`;
  return `<option value=""${l.producto ? '' : ' selected'}>Elige el producto</option>
    ${posibles.length > 1 ? `<optgroup label="Puede ser">${posibles.map(opcion).join('')}</optgroup><optgroup label="Todos">` : ''}
    ${lista.filter((p) => !(posibles.length > 1 && posibles.includes(p))).map(opcion).join('')}
    ${posibles.length > 1 ? '</optgroup>' : ''}`;
}

function filaRevision(l, n, fecha) {
  const p = producto(l.producto);
  const propuesto = p ? lineaGenero(estado.dias, p, fecha).pvp : null;
  return `<div class="fila-revision" data-n="${n}">
    <p class="fr-texto">«${escapar(l.texto)}»</p>
    <label class="fr-producto">Producto
      <select data-rev="producto">${opcionesProducto(l)}</select>
    </label>
    <label class="fg-campo"><span data-rev-unidad>${p && porUnidades(p) ? 'Unidades' : 'Kilos'}</span>
      <input type="text" class="num" inputmode="decimal" data-rev="cantidad" value="${milesimasATexto(l.cantidad)}" autocomplete="off">
    </label>
    <label class="fg-campo">Precio €
      <input type="text" class="num" inputmode="decimal" data-rev="pvp" value="${centimosATexto(l.pvp)}" placeholder="${centimosATexto(propuesto)}" autocomplete="off">
    </label>
    <button type="button" class="btn secundario" data-rev-quitar aria-label="Quitar esta línea">Quitar</button>
    <p class="fc-estado" role="status"></p>
  </div>`;
}

// Revisa una fila y dice qué se va a hacer. Devuelve { ok, p, cantidad, pvp }
function revisarFila(fila, fecha) {
  const p = producto(fila.querySelector('[data-rev="producto"]').value);
  const tc = fila.querySelector('[data-rev="cantidad"]').value.trim();
  const tp = fila.querySelector('[data-rev="pvp"]').value.trim();
  const estadoFila = fila.querySelector('.fc-estado');
  fila.querySelector('[data-rev-unidad]').textContent = p && porUnidades(p) ? 'Unidades' : 'Kilos';
  const mal = (texto) => {
    estadoFila.className = 'fc-estado mal';
    estadoFila.textContent = texto;
    fila.classList.remove('con-dato');
    return { ok: false };
  };
  if (!p) return mal(fila.dataset.aviso || 'Elige el producto.');
  const cant = tc ? (porUnidades(p) ? aUnidades(tc) : aMilesimas(tc)) : null;
  if (!tc) return mal('Falta la cantidad.');
  if (cant == null || cant <= 0) return mal(porUnidades(p) ? 'Escribe un número entero de unidades.' : 'La cantidad está mal escrita. Escribe, por ejemplo, 8,5.');
  const pvp = tp ? aCentimos(tp) : null;
  if (tp && pvp == null) return mal('El precio está mal escrito. Escribe, por ejemplo, 12,90.');

  const antes = lineaGenero(estado.dias, p, fecha);
  const precio = pvp ?? antes.pvp;
  const textoPrecio = precio == null ? ' · sin precio (ponlo después)' : ` a ${centimosATexto(precio)} €`;
  estadoFila.className = 'fc-estado ok';
  estadoFila.innerHTML = antes.inicio > 0
    ? `${ICONO.alerta} Ya tenía ${cantidad(p, antes.inicio)}: se cambia a ${cantidad(p, cant)}${textoPrecio}`
    : `${ICONO.ok} ${cantidad(p, cant)}${textoPrecio}`;
  fila.classList.add('con-dato');
  return { ok: true, p, cantidad: cant, pvp };
}

function leerTexto(fecha) {
  const texto = $('rapido-texto').value;
  const lineas = interpretarGenero(texto, enUso());
  const hueco = $('rapido-revision');
  if (!lineas.length) {
    hueco.innerHTML = `<div class="aviso">${ICONO.alerta}<div><strong>No he encontrado ningún producto</strong><p>Di el nombre como está en la lista de productos, seguido de los kilos. Por ejemplo: «merluza diez kilos».</p></div></div>`;
    return;
  }
  hueco.innerHTML = `<h3>Revisa antes de apuntar</h3>
    ${lineas.map((l, n) => filaRevision(l, n, fecha)).join('')}
    <p class="ayuda" id="rapido-resumen" role="status"></p>
    <div class="botones">
      <button type="button" class="btn primario" id="rapido-apuntar">Apuntar</button>
    </div>`;
  hueco.querySelectorAll('.fila-revision').forEach((fila, n) => {
    const aviso = lineas[n].avisos.map((a) => AVISOS[a]).filter(Boolean)[0];
    if (aviso) fila.dataset.aviso = aviso;
    revisarFila(fila, fecha);
    // Avisos que no impiden apuntar (por ejemplo, números de más) se enseñan igualmente
    if (aviso && fila.classList.contains('con-dato')) {
      fila.querySelector('.fc-estado').insertAdjacentHTML('beforeend', ` · ${escapar(aviso)}`);
    }
  });
  actualizarResumen(fecha);
  hueco.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function actualizarResumen(fecha) {
  const filas = [...document.querySelectorAll('#rapido-revision .fila-revision')];
  const bien = filas.filter((f) => f.classList.contains('con-dato')).length;
  const resumen = $('rapido-resumen');
  const boton = $('rapido-apuntar');
  if (!resumen) return;
  resumen.textContent = bien === filas.length
    ? `${bien} ${bien === 1 ? 'producto listo' : 'productos listos'} para apuntar.`
    : `${filas.length - bien} ${filas.length - bien === 1 ? 'línea por revisar' : 'líneas por revisar'}: corrígelas o quítalas.`;
  boton.disabled = !filas.length || bien !== filas.length;
  boton.textContent = `Apuntar ${bien} ${bien === 1 ? 'producto' : 'productos'}`;
}

function apuntar(fecha, alTerminar) {
  const filas = [...document.querySelectorAll('#rapido-revision .fila-revision')];
  const datos = filas.map((f) => revisarFila(f, fecha));
  if (!datos.length || datos.some((d) => !d.ok)) return actualizarResumen(fecha);
  for (const d of datos) {
    ponerDato(estado.dias, d.p, fecha, 'inicio', d.cantidad);
    if (d.pvp != null) ponerDato(estado.dias, d.p, fecha, 'pvp', d.pvp);
  }
  if (!comprobarGuardado(guardar())) return;
  alTerminar();
  avisar(`${datos.length} ${datos.length === 1 ? 'producto apuntado' : 'productos apuntados'}.`);
}

function hablar(fecha) {
  if (escuchando) {
    escuchando.stop();
    return;
  }
  const r = new Reconocimiento();
  r.lang = 'es-ES';
  r.continuous = true;
  r.interimResults = false;
  const boton = $('rapido-hablar');
  const estadoEscucha = $('rapido-escucha');
  r.onresult = (e) => {
    const area = $('rapido-texto');
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue;
      const dicho = e.results[i][0].transcript.trim();
      area.value = area.value.trim() ? `${area.value.trim()}, ${dicho}` : dicho;
    }
  };
  r.onerror = (e) => {
    const textos = {
      'not-allowed': 'El navegador no deja usar el micrófono. Permítelo o usa el micrófono del teclado.',
      'service-not-allowed': 'El navegador no deja usar el micrófono. Usa el micrófono del teclado.',
      network: 'Para dictar hace falta internet. Prueba con el micrófono del teclado o escríbelo.',
      'no-speech': 'No se ha oído nada. Vuelve a pulsar Hablar.',
    };
    avisar(textos[e.error] || 'No se ha podido dictar. Usa el micrófono del teclado.');
  };
  r.onend = () => {
    escuchando = null;
    if (boton) boton.innerHTML = `${ICONO.microfono} Hablar`;
    if (estadoEscucha) estadoEscucha.hidden = true;
    if ($('rapido-texto')?.value.trim()) leerTexto(fecha);
  };
  try {
    r.start();
  } catch {
    avisar('No se ha podido usar el micrófono. Usa el micrófono del teclado.');
    return;
  }
  escuchando = r;
  boton.innerHTML = `${ICONO.parar} Parar`;
  estadoEscucha.hidden = false;
  estadoEscucha.textContent = 'Escuchando… di los productos y pulsa Parar al terminar.';
}

// ---------- Copiar de otro día ----------

function panelCopiar(fecha) {
  const anteriores = diasConGenero(estado.dias, fecha);
  if (!anteriores.length) {
    return `<section class="tarjeta panel-rapido">
      <h2>Copiar de otro día</h2>
      <p class="ayuda">Todavía no hay días anteriores con género para copiar.</p>
      <button type="button" class="btn secundario" data-rapido="cerrar">Cerrar</button>
    </section>`;
  }
  return `<section class="tarjeta panel-rapido">
    <h2>Copiar de otro día</h2>
    <p class="ayuda">Se copian los kilos en los productos que hoy todavía no tienen nada; lo ya apuntado no se toca. Después cambia lo que sea distinto con los botones <strong>−</strong> y <strong>+</strong>.</p>
    <label>Copiar de
      <select id="rapido-desde">${anteriores.map((d) => `<option value="${d.fecha}">${escapar(fechaCorta(d.fecha))} · ${d.productos} ${d.productos === 1 ? 'producto' : 'productos'}</option>`).join('')}</select>
    </label>
    <div class="botones">
      <button type="button" class="btn primario" id="rapido-copiar-ya">Copiar</button>
      <button type="button" class="btn secundario" data-rapido="cerrar">Cancelar</button>
    </div>
  </section>`;
}

function copiar(fecha, alTerminar) {
  const desde = $('rapido-desde').value;
  const r = copiarGenero(estado.dias, estado.productos, desde, fecha);
  if (r.error) return avisar('Este día ya está cerrado.');
  if (!r.copiados) {
    avisar(r.yaTenian ? 'Todos esos productos ya tenían kilos hoy: no se ha cambiado nada.' : 'No había nada que copiar.');
    return;
  }
  if (!comprobarGuardado(guardar())) return;
  alTerminar();
  avisar(`Copiados ${r.copiados} ${r.copiados === 1 ? 'producto' : 'productos'}${r.yaTenian ? ` (${r.yaTenian === 1 ? '1 ya tenía kilos y no se ha tocado' : `${r.yaTenian} ya tenían kilos y no se han tocado`})` : ''}.`);
}

// ---------- Eventos ----------
// fechaDe(): la fecha que se está viendo. alTerminar(): repinta el paso 1 con lo apuntado.

export function prepararRapido(vista, fechaDe, alTerminar) {
  vista.addEventListener('click', (e) => {
    const boton = e.target.closest('button');
    if (!boton) return;
    const fecha = fechaDe();
    const accion = boton.dataset.rapido;
    if (accion === 'dictar' || accion === 'copiar') {
      escuchando?.abort();
      $('rapido').innerHTML = accion === 'dictar' ? panelDictado() : panelCopiar(fecha);
      $('rapido').querySelector('textarea, select')?.focus();
    } else if (accion === 'cerrar') {
      escuchando?.abort();
      $('rapido').innerHTML = '';
    } else if (boton.id === 'rapido-hablar') {
      hablar(fecha);
    } else if (boton.id === 'rapido-leer') {
      leerTexto(fecha);
    } else if (boton.id === 'rapido-apuntar') {
      apuntar(fecha, alTerminar);
    } else if (boton.id === 'rapido-copiar-ya') {
      copiar(fecha, alTerminar);
    } else if (boton.hasAttribute('data-rev-quitar')) {
      boton.closest('.fila-revision').remove();
      actualizarResumen(fecha);
    }
  });

  // Al corregir una línea de la revisión, solo se repasa esa línea
  const repasar = (e) => {
    const fila = e.target.closest('.fila-revision');
    if (!fila) return;
    if (e.target.dataset.rev === 'producto') delete fila.dataset.aviso;
    revisarFila(fila, fechaDe());
    actualizarResumen(fechaDe());
  };
  vista.addEventListener('input', repasar);
  vista.addEventListener('change', repasar);
}
