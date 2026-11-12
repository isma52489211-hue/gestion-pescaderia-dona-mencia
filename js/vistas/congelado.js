// Sección «Congelado»: lo que hay en la tienda, lo que hay que reponer y la lista para el almacén.

import { $, ICONO, escapar, avisar, comprobarGuardado } from '../ui.js';
import { estado, guardar } from '../datos/almacen.js';
import { esCongelado, stockActual, reposicion, textoReposicion, ponerStockPartida, sinStockDePartida } from '../nucleo/congelado.js';
import { aMilesimas, aUnidades, fmtKg, fmtUnidades } from '../nucleo/numeros.js';
import { hoyISO, sumarDias, fechaCorta } from '../nucleo/fechas.js';

const porUnidades = (p) => p.unidad === 'ud';
const cantidad = (p, m) => (porUnidades(p) ? fmtUnidades(m) : fmtKg(m));
const producto = (id) => estado.productos.find((p) => p.id === id);

// El stock de partida vale desde hoy; si hoy ya está cerrado, desde mañana
const fechaPartida = () => (estado.dias[hoyISO()]?.cerrado ? sumarDias(hoyISO(), 1) : hoyISO());

function textoLista() {
  return textoReposicion(reposicion(estado.dias, estado.productos, hoyISO()), fechaCorta(hoyISO()), cantidad);
}

function filaPartida(p) {
  const nombre = escapar(p.nombre);
  return `<form class="fila-cierre form-partida" data-partida="${p.id}" novalidate>
    <p class="fc-nombre"><strong>${nombre}</strong>${p.formato ? ` <small>${escapar(p.formato)}</small>` : ''}</p>
    <label class="fg-campo">${porUnidades(p) ? 'Unidades que hay' : 'Kilos que hay'}
      <input type="text" class="num" inputmode="${porUnidades(p) ? 'numeric' : 'decimal'}" autocomplete="off" aria-label="${porUnidades(p) ? 'Unidades' : 'Kilos'} de ${nombre} que hay en la tienda">
    </label>
    <button type="submit" class="btn primario">Guardar</button>
    <p class="fc-estado mal" role="alert" hidden></p>
  </form>`;
}

function filaStock(x) {
  const p = x.producto;
  let estadoTxt;
  if (x.actual == null) estadoTxt = `<span class="fc-estado pendiente">${ICONO.reloj} Falta saber cuánto hay</span>`;
  else if (!p.stockIdeal) estadoTxt = `<span class="fc-estado pendiente">${ICONO.lista} Sin stock ideal</span>`;
  else if (x.falta > 0) estadoTxt = `<span class="fc-estado aviso-txt">${ICONO.alerta} Reponer ${cantidad(p, x.falta)}</span>`;
  else estadoTxt = `<span class="fc-estado ok">${ICONO.ok} Bien</span>`;
  return `<div class="linea linea-producto">
    <span><strong>${escapar(p.nombre)}</strong>
      <small>${p.formato ? `${escapar(p.formato)} · ` : ''}Hay ${x.actual == null ? '—' : cantidad(p, x.actual)}${p.stockIdeal ? ` · ideal ${cantidad(p, p.stockIdeal)}` : ''}</small>
      ${estadoTxt}
    </span>
  </div>`;
}

export function pintarCongelado() {
  const hoy = hoyISO();
  const lista = estado.productos.filter((p) => esCongelado(p) && !p.archivado).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const vista = $('vista-congelado');

  if (!lista.length) {
    vista.innerHTML = `<h1>Congelado</h1>
      <div class="resultado pendiente">${ICONO.lista}
        <div><p class="grande">No hay productos congelados</p><p>Añádelos en Productos con el tipo «Congelado», su precio y su stock ideal.</p></div>
        <button type="button" class="btn primario" data-ir="productos">Ir a productos</button></div>`;
    return;
  }

  const sinStock = sinStockDePartida(lista, fechaPartida());
  const stock = reposicion(estado.dias, estado.productos, hoy);
  const sinIdeal = lista.filter((p) => !p.stockIdeal);
  // Los que no tienen stock ideal también se ven, para saber cuánto hay
  const filas = [...stock, ...sinIdeal.map((p) => ({ producto: p, actual: stockActual(estado.dias, p, hoy), ideal: null, falta: null }))]
    .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, 'es'));
  const texto = textoLista();

  vista.innerHTML = `<h1>Congelado</h1>
    ${sinStock.length ? `<section class="tarjeta">
      <h2>Cuánto hay al empezar</h2>
      <p class="ayuda">La primera vez hay que contar lo que hay en la tienda de cada congelado (mejor antes de abrir o después del cierre). Si no hay nada, pon 0. Después, el stock lo llevan los cierres de cada día.</p>
      ${sinStock.map(filaPartida).join('')}
    </section>` : ''}

    <section class="tarjeta">
      <h2>Lo que hay en la tienda</h2>
      <p class="ayuda">Según el último cierre y lo que ha llegado. El stock ideal se cambia en la ficha de cada producto.</p>
      ${filas.map(filaStock).join('')}
    </section>

    <section class="tarjeta">
      <h2>Lista de reposición</h2>
      ${texto
        ? `<pre class="lista-reposicion" id="texto-reposicion">${escapar(texto)}</pre>
          <div class="botones">
            <button type="button" class="btn primario" id="reposicion-whatsapp">Enviar por WhatsApp</button>
            <button type="button" class="btn secundario" id="reposicion-copiar">Copiar la lista</button>
          </div>`
        : `<div class="aviso ok">${ICONO.ok}<div><strong>No hace falta reponer nada</strong><p>Todo el congelado con stock ideal está al día.</p></div></div>`}
    </section>`;
}

export function prepararCongelado() {
  const vista = $('vista-congelado');

  vista.addEventListener('submit', (e) => {
    const form = e.target.closest('.form-partida');
    if (!form) return;
    e.preventDefault();
    const p = producto(form.dataset.partida);
    const texto = form.querySelector('input').value.trim();
    const error = form.querySelector('.fc-estado');
    const valor = texto ? (porUnidades(p) ? aUnidades(texto) : aMilesimas(texto)) : null;
    if (valor == null) {
      error.textContent = !texto ? 'Escribe cuánto hay (0 si no hay nada).' : porUnidades(p) ? 'Escribe un número entero de unidades, por ejemplo 6.' : 'Escribe solo un número, por ejemplo 2,5.';
      error.hidden = false;
      return;
    }
    const r = ponerStockPartida(p, fechaPartida(), valor);
    if (r.error) {
      error.textContent = 'Este producto ya tiene su stock.';
      error.hidden = false;
      return;
    }
    if (comprobarGuardado(guardar())) {
      pintarCongelado();
      avisar(`${p.nombre}: apuntado.`);
    }
  });

  vista.addEventListener('click', async (e) => {
    const id = e.target.closest('button')?.id;
    if (id === 'reposicion-whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(textoLista())}`, '_blank', 'noopener');
    } else if (id === 'reposicion-copiar') {
      try {
        await navigator.clipboard.writeText(textoLista());
        avisar('Lista copiada.');
      } catch {
        // Si el navegador no deja copiar, se selecciona el texto para copiarlo a mano
        getSelection().selectAllChildren($('texto-reposicion'));
        avisar('Mantén pulsado el texto para copiarlo.');
      }
    }
  });
}
