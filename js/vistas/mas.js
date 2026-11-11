// Sección «Más»: productos, copia de seguridad y datos de la app.

import { $, ICONO, escapar, avisar, comprobarGuardado } from '../ui.js';
import { estado, guardar, descargarCopia, leerCopia, restaurarCopia } from '../datos/almacen.js';
import {
  TIPOS, normalizar, revisarProducto, hayErrores, crearProducto, cambiarProducto,
  gananciaPorUnidad, activos, archivados, estadoCatalogo, catalogoDeLuque,
} from '../nucleo/productos.js';
import { aCentimos, aNumero, fmtEuros, centimosATexto } from '../nucleo/numeros.js';

let version = '';
let pagina = 'menu'; // 'menu' | 'productos'
let busqueda = '';
let editando = null; // id del producto abierto en la ficha, o null si es nuevo

const porUnidad = (p) => (p.unidad === 'ud' ? 'ud' : 'kg');
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function pintarMas(v) {
  if (v) version = v;
  if (pagina === 'productos') pintarProductos();
  else pintarMenu();
}

export function abrirPaginaMas(nombre) {
  pagina = nombre;
  busqueda = '';
}

// ---------- Menú ----------

function resumenCatalogo() {
  const e = estadoCatalogo(estado.productos);
  if (!e.total) return 'Todavía no hay ninguno';
  const partes = [plural(e.total, 'producto', 'productos')];
  if (e.sinPrecio) partes.push(`${e.sinPrecio} sin precio`);
  if (e.sinCoste) partes.push(`${e.sinCoste} sin coste`);
  return partes.join(' · ');
}

function pintarMenu() {
  const copia = estado.ajustes.ultimaCopia;
  const textoCopia = copia
    ? `Última copia descargada: ${new Date(copia).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.`
    : 'Todavía no has descargado ninguna copia.';

  $('vista-mas').innerHTML = `<h1>Más</h1>
    <div class="menu">
      <button type="button" class="menu-fila" data-pagina="productos">
        ${ICONO.lista}
        <span class="menu-txt"><strong>Productos</strong><small>${resumenCatalogo()}</small></span>
        <span class="menu-flecha" aria-hidden="true">›</span>
      </button>
    </div>
    <section class="tarjeta">
      <h2>Copia de seguridad</h2>
      <p class="ayuda">Los datos se guardan solo en este aparato. Descarga una copia de vez en cuando y guárdala en otro sitio. ${textoCopia}</p>
      <div class="botones">
        <button type="button" class="btn secundario" id="copia-descargar">Descargar copia</button>
        <label class="btn secundario">Restaurar copia
          <input type="file" id="copia-restaurar" accept="application/json,.json" hidden>
        </label>
      </div>
    </section>
    <section class="tarjeta"><h2>Sobre la app</h2>
      <div class="linea"><span>Tienda</span><span class="importe">Doña Mencía</span></div>
      <div class="linea"><span>Versión</span><span class="importe">${version}</span></div>
    </section>`;
}

// ---------- Productos ----------

function filaProducto(p) {
  const u = porUnidad(p);
  const g = gananciaPorUnidad(p);
  const datos = [
    p.pvp != null ? `<span class="dato">${fmtEuros(p.pvp)}/${u}</span>` : '<span class="etiqueta falta-dato">Sin precio</span>',
    p.coste != null ? `<span>coste ${fmtEuros(p.coste)}</span>` : '<span class="etiqueta falta-dato">Sin coste</span>',
  ];
  if (g) datos.push(`<span class="${g.ganancia > 0 ? '' : 'en-rojo'}">${g.ganancia > 0 ? 'ganas' : 'pierdes'} ${fmtEuros(Math.abs(g.ganancia))} (${g.porcentaje} %)</span>`);
  const extras = [p.formato, p.mermaPct ? `merma ${String(p.mermaPct).replace('.', ',')} %` : ''].filter(Boolean).map(escapar).join(' · ');
  return `<button type="button" class="fila-producto" data-editar="${p.id}">
    <span class="fila-txt">
      <strong>${escapar(p.nombre)}${extras ? ` <small>${extras}</small>` : ''}</strong>
      <span class="fila-datos">${datos.join('')}</span>
    </span>
    <span class="menu-flecha" aria-hidden="true">›</span>
  </button>`;
}

function pintarProductos() {
  const lista = activos(estado.productos);
  const e = estadoCatalogo(estado.productos);
  const cabecera = `<button type="button" class="volver" data-pagina="menu">‹ Más</button><h1>Productos</h1>`;

  if (!estado.productos.length) {
    $('vista-mas').innerHTML = `${cabecera}
      <div class="resultado pendiente">${ICONO.lista}
        <div><p class="grande">Todavía no hay productos</p>
        <p>Puedes empezar con la lista de la tienda de Luque (${catalogoDeLuque().length} productos, sin precios) y luego quitar o añadir, o crearlos uno a uno.</p></div>
      </div>
      <div class="botones">
        <button type="button" class="btn primario" id="cargar-luque">Empezar con la lista de Luque</button>
        <button type="button" class="btn secundario" data-nuevo>Añadir producto a mano</button>
      </div>`;
    return;
  }

  const q = normalizar(busqueda);
  const visibles = q ? lista.filter((p) => normalizar(p.nombre).includes(q)) : lista;

  const secciones = Object.entries(TIPOS).map(([tipo, t]) => {
    const deTipo = visibles.filter((p) => p.tipo === tipo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (!deTipo.length) return '';
    return `<section class="tarjeta categoria">
      <header class="cat-cab">
        <img src="assets/iconos/${t.icono}.svg" alt="" width="44" height="44">
        <div><h2>${t.nombre}</h2><p class="ayuda">${plural(deTipo.length, 'producto', 'productos')}</p></div>
      </header>
      ${deTipo.map(filaProducto).join('')}
    </section>`;
  }).join('');

  const guardados = archivados(estado.productos);
  const archivo = guardados.length && !q
    ? `<details class="tarjeta archivo">
        <summary>Archivados (${guardados.length})</summary>
        <p class="ayuda">No salen en las listas del día, pero los días ya apuntados los siguen contando.</p>
        ${guardados.map((p) => `<div class="linea"><span>${escapar(p.nombre)} <small>${TIPOS[p.tipo]?.nombre || ''}</small></span>
          <button type="button" class="btn secundario" data-recuperar="${p.id}">Recuperar</button></div>`).join('')}
      </details>`
    : '';

  const faltan = [e.sinPrecio ? `${e.sinPrecio} sin precio` : '', e.sinCoste ? `${e.sinCoste} sin coste` : ''].filter(Boolean);
  const avisoFaltan = faltan.length
    ? `<div class="aviso">${ICONO.alerta}<div><strong>Faltan datos: ${faltan.join(' y ')}</strong>
        <p>Sin precio de venta un producto no cuenta en el cuadre, y sin coste no se puede calcular su ganancia. Toca un producto para rellenarlo.</p></div></div>`
    : `<div class="aviso ok">${ICONO.ok}<div><strong>Catálogo completo</strong><p>Todos los productos tienen precio de venta y coste.</p></div></div>`;

  $('vista-mas').innerHTML = `${cabecera}
    ${avisoFaltan}
    <div class="barra-productos">
      <label class="sr-solo" for="buscar-producto">Buscar producto</label>
      <input type="search" id="buscar-producto" placeholder="Buscar producto" autocomplete="off" value="${escapar(busqueda)}">
      <button type="button" class="btn primario" data-nuevo>Añadir producto</button>
    </div>
    ${secciones || `<p class="ayuda">Ningún producto coincide con «${escapar(busqueda)}».</p>`}
    ${archivo}`;
}

// ---------- Ficha de producto ----------

const CAMPOS = ['nombre', 'tipo', 'pvp', 'coste', 'mermaPct'];

function leerFicha() {
  const errores = {};
  const numero = (id, convertir, campo) => {
    const texto = $(id).value.trim();
    if (!texto) return null;
    const n = convertir(texto);
    if (n == null) errores[campo] = 'Escribe solo un número, por ejemplo 12,90.';
    return n;
  };
  const datos = {
    nombre: $('f-nombre').value,
    tipo: $('f-tipo').value,
    unidad: $('f-unidad').value,
    formato: $('f-formato').value,
    pvp: numero('f-pvp', aCentimos, 'pvp'),
    coste: numero('f-coste', aCentimos, 'coste'),
    mermaPct: numero('f-merma', aNumero, 'mermaPct') ?? 0,
  };
  return { datos, errores };
}

function pintarErrores(errores) {
  for (const campo of CAMPOS) {
    const hueco = $('e-' + campo);
    hueco.textContent = errores[campo] || '';
    hueco.hidden = !errores[campo];
  }
}

// Mientras se escribe: etiquetas por kilo o por unidad y la ganancia que sale
function actualizarFicha() {
  const u = $('f-unidad').value === 'ud' ? 'unidad' : 'kg';
  $('t-pvp').textContent = `Precio de venta habitual (€/${u})`;
  $('t-coste').textContent = `Coste de compra habitual (€/${u})`;
  $('l-formato').hidden = $('f-tipo').value !== 'congelado';

  const { datos, errores } = leerFicha();
  const caja = $('f-ganancia');
  const g = Object.keys(errores).length ? null : gananciaPorUnidad(datos);
  if (!g) {
    caja.innerHTML = '';
    return;
  }
  const por = datos.unidad === 'ud' ? 'unidad' : 'kilo';
  caja.innerHTML = g.ganancia > 0
    ? `<div class="aviso ok">${ICONO.ok}<div><strong>Ganas ${fmtEuros(g.ganancia)} por ${por}</strong><p>Es el ${g.porcentaje} % de lo que cobras${datos.mermaPct ? ', contando la merma de limpieza' : ''}.</p></div></div>`
    : `<div class="aviso">${ICONO.alerta}<div><strong>Con estos números no se gana dinero</strong><p>${g.ganancia === 0 ? 'Vendes al mismo precio que compras' : `Pierdes ${fmtEuros(-g.ganancia)} por ${por}`}${datos.mermaPct ? ', contando la merma de limpieza' : ''}.</p></div></div>`;
}

function abrirFicha(id = null) {
  editando = id;
  const p = id ? estado.productos.find((x) => x.id === id) : null;
  $('ficha-titulo').textContent = p ? 'Cambiar producto' : 'Añadir producto';
  $('f-nombre').value = p?.nombre || '';
  $('f-tipo').value = p?.tipo || 'fresco';
  $('f-unidad').value = p?.unidad || 'kg';
  $('f-formato').value = p?.formato || '';
  $('f-pvp').value = centimosATexto(p?.pvp);
  $('f-coste').value = centimosATexto(p?.coste);
  $('f-merma').value = p?.mermaPct ? String(p.mermaPct).replace('.', ',') : '';
  $('f-archivar').hidden = !p;
  pintarErrores({});
  actualizarFicha();
  $('ficha').showModal();
  if (!p) $('f-nombre').focus();
}

function guardarFicha() {
  const { datos, errores: deFormato } = leerFicha();
  const revision = revisarProducto(datos, estado.productos, editando);
  const errores = { ...revision.errores, ...deFormato };
  pintarErrores(errores);
  if (Object.keys(errores).length) {
    $('f-' + ({ mermaPct: 'merma' }[Object.keys(errores)[0]] || Object.keys(errores)[0])).focus();
    return;
  }
  if (editando) {
    const i = estado.productos.findIndex((x) => x.id === editando);
    estado.productos[i] = cambiarProducto(estado.productos[i], datos);
  } else {
    estado.productos.push(crearProducto(datos, estado.productos));
  }
  if (!comprobarGuardado(guardar())) return;
  $('ficha').close();
  pintarProductos();
  avisar(editando ? 'Cambios guardados.' : `«${datos.nombre.trim()}» añadido.`);
}

function archivar(id, valor) {
  const p = estado.productos.find((x) => x.id === id);
  if (!p) return;
  p.archivado = valor;
  if (!comprobarGuardado(guardar())) return;
  pintarProductos();
  avisar(valor ? `«${p.nombre}» archivado.` : `«${p.nombre}» recuperado.`);
}

// ---------- Eventos ----------

export function prepararMas() {
  const vista = $('vista-mas');

  vista.addEventListener('click', (e) => {
    const ir = e.target.closest('[data-pagina]');
    if (ir) {
      pagina = ir.dataset.pagina;
      busqueda = '';
      pintarMas();
      window.scrollTo(0, 0);
      return;
    }
    if (e.target.closest('[data-nuevo]')) return abrirFicha();
    const editar = e.target.closest('[data-editar]');
    if (editar) return abrirFicha(editar.dataset.editar);
    const recuperar = e.target.closest('[data-recuperar]');
    if (recuperar) return archivar(recuperar.dataset.recuperar, false);

    if (e.target.id === 'cargar-luque') {
      estado.productos = catalogoDeLuque();
      if (comprobarGuardado(guardar())) {
        pintarProductos();
        avisar(`${estado.productos.length} productos añadidos. Ahora ponles precio y coste.`);
      }
    }
    if (e.target.id === 'copia-descargar') {
      if (comprobarGuardado(descargarCopia())) {
        pintarMenu();
        avisar('Copia descargada.');
      }
    }
  });

  vista.addEventListener('input', (e) => {
    if (e.target.id !== 'buscar-producto') return;
    busqueda = e.target.value;
    pintarProductos();
    // Al repintar la lista se pierde el cursor: se devuelve al buscador
    const campo = $('buscar-producto');
    campo.focus();
    campo.setSelectionRange(busqueda.length, busqueda.length);
  });

  vista.addEventListener('change', async (e) => {
    if (e.target.id !== 'copia-restaurar') return;
    const archivo = e.target.files[0];
    e.target.value = '';
    if (!archivo) return;
    const copia = await leerCopia(archivo);
    if (copia.error) return alert(copia.error);
    const cuando = copia.fecha ? ` del ${new Date(copia.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
    const texto = `Vas a sustituir TODOS los datos de este aparato por los de la copia${cuando} `
      + `(${copia.datos.productos.length} productos, ${Object.keys(copia.datos.dias).length} días).\n\n¿Continuar?`;
    if (!confirm(texto)) return;
    if (comprobarGuardado(restaurarCopia(copia.datos))) {
      pintarMenu();
      avisar('Copia restaurada.');
    }
  });

  $('ficha-form').addEventListener('submit', (e) => {
    e.preventDefault();
    guardarFicha();
  });
  $('ficha-form').addEventListener('input', actualizarFicha);
  $('f-cancelar').addEventListener('click', () => $('ficha').close());
  $('f-archivar').addEventListener('click', () => {
    const p = estado.productos.find((x) => x.id === editando);
    if (!confirm(`¿Archivar «${p.nombre}»?\n\nDejará de salir en las listas, pero los días ya apuntados lo seguirán contando. Podrás recuperarlo cuando quieras.`)) return;
    $('ficha').close();
    archivar(editando, true);
  });
}
