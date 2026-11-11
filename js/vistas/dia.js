// Sección «Día»: el género con el que se empieza, el cierre y el cuadre.

import { $, ICONO, escapar, avisar, comprobarGuardado } from '../ui.js';
import { estado, guardar } from '../datos/almacen.js';
import { TIPOS, normalizar } from '../nucleo/productos.js';
import {
  lineaGenero, tieneGenero, ponerDato, ponerFondo, avisosLinea, ventaPosible, resumenGenero, esHabitual, borrarDia,
  precioActual, revisarCambio, ponerCambio, quitarCambio,
} from '../nucleo/dia.js';
import { aCentimos, aMilesimas, aUnidades, fmtEuros, fmtKg, fmtUnidades, centimosATexto, milesimasATexto } from '../nucleo/numeros.js';
import { hoyISO, sumarDias, esFecha, fechaLarga, fechaCorta } from '../nucleo/fechas.js';

// El congelado lleva su propio control de stock (sección «Congelado»)
const TIPOS_GENERO = ['fresco', 'gordo', 'marisco'];

let fecha = hoyISO();
let paso = 1;

const producto = (id) => estado.productos.find((p) => p.id === id);
const porUnidades = (p) => p.unidad === 'ud';

// Los productos de la lista: los que están en uso y, además, los archivados que tengan género ese día
const delGenero = () => estado.productos.filter((p) => TIPOS_GENERO.includes(p.tipo) && (!p.archivado || tieneGenero(estado.dias, p, fecha)));

export function irAlDia(f = hoyISO(), p = 1) {
  fecha = f;
  paso = p;
}

// ---------- Textos ----------

function textoAviso(a) {
  return {
    'sin-precio': 'Falta el precio de venta',
    'sin-coste': 'Falta el coste',
    'sin-ganancia': 'Con este precio no se gana dinero',
    'precio-muy-distinto': `Precio muy distinto al del último día (${fmtEuros(a.antes)})`,
    'coste-muy-distinto': `Coste muy distinto al del último día (${fmtEuros(a.antes)})`,
    'cambio-con-mas-que-inicio': 'Hay un cambio de precio con más género del que había al empezar: revisa los kilos o quita ese cambio',
  }[a.tipo];
}

function textoErrorCambio(error, p, l) {
  const u = porUnidades(p) ? 'las unidades que quedan' : 'lo que queda';
  return {
    'sin-genero': 'Primero apunta con cuánto empieza el día este producto.',
    'falta-cantidad': `Escribe ${u} en el mostrador. Sin ese dato no se sabe qué se vendió a cada precio.`,
    'falta-precio': 'Escribe el precio nuevo.',
    'no-queda': 'Si no queda nada, no hace falta cambiar el precio.',
    'mas-que-inicio': `No puede quedar más de lo que había al empezar (${cantidad(p, l.inicio)}).`,
    'mismo-precio': 'Es el mismo precio que ya tenía.',
  }[error];
}

const cantidad = (p, m) => (porUnidades(p) ? fmtUnidades(m) : fmtKg(m));
const porUnidad = (p) => (porUnidades(p) ? 'ud' : 'kg');

function horaAhora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function cantidades(r) {
  return [r.kilos ? fmtKg(r.kilos) : '', r.unidades ? fmtUnidades(r.unidades) : ''].filter(Boolean).join(' y ') || '0 kg';
}

// ---------- Partes que se actualizan mientras se escribe ----------

function pintarCifras() {
  const r = resumenGenero(estado.dias, estado.productos, fecha);
  const cifras = [
    ['Productos', r.productos],
    ['Género', cantidades(r)],
    ['Coste del género', r.sinCoste.length ? `${fmtEuros(r.coste)} <small>faltan ${r.sinCoste.length}</small>` : fmtEuros(r.coste)],
    ['Venta posible', r.sinPrecio.length ? `${fmtEuros(r.venta)} <small>faltan ${r.sinPrecio.length}</small>` : fmtEuros(r.venta)],
    ['Ganancia posible', r.gananciaPosible == null ? '—' : fmtEuros(r.gananciaPosible)],
    ['Cambios de precio', r.cambios],
  ];
  $('dia-cifras').innerHTML = cifras.map(([k, v]) => `<div class="cifra"><small>${k}</small><strong>${v}</strong></div>`).join('');

  $('dia-total').innerHTML = r.productos
    ? `<strong>${r.productos} ${r.productos === 1 ? 'producto' : 'productos'}</strong> · ${cantidades(r)} · Venta <strong>${fmtEuros(r.venta)}</strong>`
    : 'Todavía no hay género apuntado';

  const faltan = [];
  if (r.sinPrecio.length) faltan.push(`<strong>Falta el precio de venta</strong> de ${escapar(r.sinPrecio.join(', '))}. Sin precio no cuentan en el cuadre.`);
  if (r.sinCoste.length) faltan.push(`<strong>Falta el coste</strong> de ${escapar(r.sinCoste.join(', '))}. Sin coste no se puede calcular la ganancia.`);
  $('dia-faltan').innerHTML = faltan.length
    ? `<div class="aviso">${ICONO.alerta}<div>${faltan.map((t) => `<p>${t}</p>`).join('')}</div></div>`
    : '';

  $('estado-paso-1').textContent = r.productos ? `${r.productos} ${r.productos === 1 ? 'producto' : 'productos'}` : 'Pendiente';
  document.querySelector('.pasos [data-paso="1"]').classList.toggle('hecho', r.productos > 0);

  for (const tipo of TIPOS_GENERO) {
    const hueco = document.querySelector(`[data-conteo="${tipo}"]`);
    if (hueco) hueco.textContent = `${delGenero().filter((p) => p.tipo === tipo && tieneGenero(estado.dias, p, fecha)).length} con género`;
  }
}

function actualizarFila(fila) {
  const p = producto(fila.dataset.id);
  const l = lineaGenero(estado.dias, p, fecha);
  const con = l.inicio > 0;
  fila.classList.toggle('con-dato', con);

  const nota = fila.querySelector('.fg-nota');
  const mal = fila.querySelector('[aria-invalid="true"]');
  const avisos = avisosLinea(estado.dias, p, fecha);
  if (mal) {
    nota.className = 'fg-nota mal';
    nota.textContent = 'Hay un número mal escrito: ese dato no se ha guardado. Escribe solo números, por ejemplo 12,90.';
  } else if (avisos.length) {
    nota.className = 'fg-nota ojo';
    nota.textContent = avisos.map(textoAviso).join(' · ');
  } else if (con) {
    nota.className = 'fg-nota';
    const ahora = l.cambios.length && precioActual(l) != null ? ` · Ahora a ${fmtEuros(precioActual(l))}/${porUnidad(p)}` : '';
    nota.textContent = `Venta posible ${fmtEuros(ventaPosible(p, l))}${ahora}`;
  } else {
    nota.className = 'fg-nota';
    nota.textContent = '';
  }

  // Solo se puede cambiar el precio de lo que se ha traído
  const abrir = fila.querySelector('[data-abrir-cambio]');
  const form = fila.querySelector('.form-cambio');
  if (!con) form.hidden = true;
  abrir.hidden = !con || !form.hidden;
}

// ---------- Cambios de precio ----------

function bloqueCambios(p) {
  const l = lineaGenero(estado.dias, p, fecha);
  const u = porUnidad(p);
  const nombre = escapar(p.nombre);
  const lista = l.cambios.map((c, i) => `<li>
      <span>${c.hora ? `<strong>${escapar(c.hora)}</strong> · ` : ''}quedaban <span class="importe">${cantidad(p, c.quedaban)}</span> → <span class="importe">${fmtEuros(c.pvp)}/${u}</span></span>
      <button type="button" class="btn secundario" data-quitar-cambio="${i}" aria-label="Quitar el cambio de precio${c.hora ? ` de las ${escapar(c.hora)}` : ''} de ${nombre}">Quitar</button>
    </li>`).join('');
  return `${l.cambios.length ? `<p class="fc-titulo">Cambios de precio</p><ul class="lista-cambios">${lista}</ul>` : ''}
    <button type="button" class="btn secundario btn-cambio" data-abrir-cambio>Cambiar precio</button>
    <form class="form-cambio" hidden novalidate>
      <p class="fc-titulo">Cambio de precio de ${nombre}</p>
      <p class="ayuda">${porUnidades(p) ? 'Cuenta las unidades' : 'Pesa lo'} que queda en el mostrador ahora: lo vendido hasta ahora cuenta al precio de antes y lo que queda, al nuevo.</p>
      <div class="fc-campos">
        <label class="fg-campo">${porUnidades(p) ? 'Unidades que quedan' : 'Kilos que quedan'}
          <input type="text" class="num" inputmode="${porUnidades(p) ? 'numeric' : 'decimal'}" data-cambio="quedaban" placeholder="0" autocomplete="off">
        </label>
        <label class="fg-campo">Precio nuevo €/${u}
          <input type="text" class="num" inputmode="decimal" data-cambio="pvp" placeholder="0,00" autocomplete="off">
        </label>
        <label class="fg-campo">Hora
          <input type="time" data-cambio="hora">
        </label>
      </div>
      <p class="error" role="alert" hidden></p>
      <div class="botones">
        <button type="submit" class="btn primario">Guardar cambio</button>
        <button type="button" class="btn secundario" data-cerrar-cambio>Cancelar</button>
      </div>
    </form>`;
}

function repintarCambios(fila) {
  fila.querySelector('.fg-cambios').innerHTML = bloqueCambios(producto(fila.dataset.id));
  actualizarFila(fila);
  pintarCifras();
}

function abrirCambio(fila) {
  const form = fila.querySelector('.form-cambio');
  form.reset();
  form.querySelector('.error').hidden = true;
  form.querySelector('[data-cambio="hora"]').value = fecha === hoyISO() ? horaAhora() : '';
  form.hidden = false;
  fila.querySelector('[data-abrir-cambio]').hidden = true;
  form.querySelector('[data-cambio="quedaban"]').focus();
}

function cerrarCambio(fila) {
  fila.querySelector('.form-cambio').hidden = true;
  actualizarFila(fila);
  fila.querySelector('[data-abrir-cambio]').focus();
}

function guardarCambio(form) {
  const fila = form.closest('.fila-genero');
  const p = producto(fila.dataset.id);
  const l = lineaGenero(estado.dias, p, fecha);
  const error = form.querySelector('.error');
  const leer = (campo) => form.querySelector(`[data-cambio="${campo}"]`).value.trim();
  const mostrar = (texto) => {
    error.textContent = texto;
    error.hidden = false;
  };

  const tq = leer('quedaban');
  const tp = leer('pvp');
  const quedaban = tq ? (porUnidades(p) ? aUnidades(tq) : aMilesimas(tq)) : null;
  const pvp = tp ? aCentimos(tp) : null;
  if (tq && quedaban == null) {
    return mostrar(porUnidades(p) ? 'Las unidades tienen que ser un número entero, por ejemplo 12.' : 'Los kilos están mal escritos. Escribe solo números, por ejemplo 4,5.');
  }
  if (tp && pvp == null) return mostrar('El precio está mal escrito. Escribe solo números, por ejemplo 9,90.');

  const cambio = { quedaban, pvp, hora: leer('hora') || null };
  const revision = revisarCambio(l, cambio);
  if (revision.error) return mostrar(textoErrorCambio(revision.error, p, l));
  const raro = revision.avisos.find((a) => a.tipo === 'cambio-muy-grande');
  if (raro && !confirm(`El precio nuevo (${fmtEuros(pvp)}) es muy distinto del que tenía (${fmtEuros(raro.antes)}).\n\n¿Está bien escrito?`)) return;

  ponerCambio(estado.dias, p, fecha, cambio);
  if (!comprobarGuardado(guardar())) return;
  repintarCambios(fila);
  fila.querySelector('[data-abrir-cambio]').focus();
  avisar(`${p.nombre}: ahora a ${fmtEuros(pvp)}/${porUnidad(p)}.`);
}

// ---------- Pintar ----------

function filaGenero(p) {
  const l = lineaGenero(estado.dias, p, fecha);
  const u = porUnidades(p) ? 'ud' : 'kg';
  const nombre = escapar(p.nombre);
  const extras = [p.mermaPct ? `merma ${String(p.mermaPct).replace('.', ',')} %` : '', p.archivado ? 'archivado' : ''].filter(Boolean).join(' · ');
  return `<div class="fila-genero" data-id="${p.id}" data-nombre="${escapar(normalizar(p.nombre))}">
    <p class="fg-nombre"><strong>${nombre}</strong>${extras ? ` <small>${extras}</small>` : ''}</p>
    <label class="fg-campo">${porUnidades(p) ? 'Unidades' : 'Kilos'}
      <input type="text" class="num" inputmode="${porUnidades(p) ? 'numeric' : 'decimal'}" data-campo="inicio" value="${milesimasATexto(l.inicio)}" placeholder="0" autocomplete="off" aria-label="${porUnidades(p) ? 'Unidades' : 'Kilos'} de ${nombre}">
    </label>
    <label class="fg-campo">Venta €/${u}
      <input type="text" class="num" inputmode="decimal" data-campo="pvp" value="${centimosATexto(l.pvp)}" placeholder="0,00" autocomplete="off" aria-label="Precio de venta de ${nombre}">
    </label>
    <label class="fg-campo">Coste €/${u}
      <input type="text" class="num" inputmode="decimal" data-campo="coste" value="${centimosATexto(l.coste)}" placeholder="0,00" autocomplete="off" aria-label="Coste de ${nombre}">
    </label>
    <p class="fg-nota" role="status"></p>
    <div class="fg-cambios">${bloqueCambios(p)}</div>
  </div>`;
}

function panelGenero() {
  const lista = delGenero();
  if (!lista.length) {
    return `<div class="resultado pendiente">${ICONO.lista}
      <div><p class="grande">Primero hacen falta productos</p>
      <p>Para apuntar el género necesitas tener productos de pescado o marisco en el catálogo.</p></div>
      <button type="button" class="btn primario" data-ir="productos">Ir a productos</button></div>`;
  }

  const secciones = TIPOS_GENERO.map((tipo) => {
    const deTipo = lista.filter((p) => p.tipo === tipo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (!deTipo.length) return '';
    // Arriba, los que tienen género hoy o se han traído estos días; el resto, plegado
    const arriba = deTipo.filter((p) => tieneGenero(estado.dias, p, fecha) || esHabitual(estado.dias, p.id, fecha));
    const resto = deTipo.filter((p) => !arriba.includes(p));
    return `<section class="tarjeta categoria">
      <header class="cat-cab">
        <img src="assets/iconos/${TIPOS[tipo].icono}.svg" alt="" width="44" height="44">
        <div><h2>${TIPOS[tipo].nombre}</h2><p class="ayuda" data-conteo="${tipo}"></p></div>
      </header>
      ${arriba.map(filaGenero).join('')}
      ${resto.length ? `<details class="otros"${arriba.length ? '' : ' open'}>
        <summary>${arriba.length ? 'Otros productos' : 'Todos los productos'} (${resto.length})</summary>
        ${resto.map(filaGenero).join('')}
      </details>` : ''}
    </section>`;
  }).join('');

  return `<section class="tarjeta">
      <h2>Para empezar el día</h2>
      <div class="rejilla">
        <label>Fondo de caja al empezar (€)
          <input type="text" class="num" inputmode="decimal" id="dia-fondo" value="${centimosATexto(estado.dias[fecha]?.caja?.fondo)}" placeholder="0,00" autocomplete="off" aria-describedby="e-fondo">
          <small class="error" id="e-fondo" hidden>Escribe solo un número, por ejemplo 150.</small>
        </label>
        <label>Buscar producto
          <input type="search" id="dia-buscar" placeholder="Ej.: merluza" autocomplete="off">
        </label>
      </div>
      <p class="ayuda">Apunta los kilos con los que empieza cada producto. El precio y el coste salen con los del último día: cámbialos solo si hoy son otros. Se guarda solo, mientras escribes.</p>
      <p class="ayuda">Si a mitad del día subes o bajas un precio, pulsa <strong>Cambiar precio</strong> en ese producto y pesa lo que queda en el mostrador. Así la caja sigue cuadrando.</p>
    </section>
    ${secciones}
    <p class="ayuda" id="dia-sin-resultados" hidden>Ningún producto coincide con la búsqueda.</p>
    <div class="barra-total" id="dia-total" role="status"></div>
    <h2>Resumen del género</h2>
    <div class="cifras" id="dia-cifras"></div>
    <div id="dia-faltan"></div>
    <div class="acciones">
      <button type="button" class="btn peligro" id="dia-borrar">Borrar este día</button>
    </div>`;
}

const EN_OBRAS = {
  2: ['Cierre', 'Aquí la tienda apuntará, producto a producto, lo que sobra al cerrar, las retiradas, las mermas y la caja.'],
  3: ['Cuadre', 'Aquí saldrá lo que debería haber en caja frente a lo cobrado, y la ganancia del día.'],
};

export function pintarDia() {
  const hoy = hoyISO();
  const otroDia = fecha === hoy ? '' : `<div class="aviso">${ICONO.alerta}
      <div><strong>Estás viendo otro día, no hoy</strong><p>Lo que apuntes aquí se guarda en el ${fechaCorta(fecha)}.</p></div>
      <button type="button" class="btn secundario" id="dia-hoy-aviso">Ir a hoy</button></div>`;

  $('vista-dia').innerHTML = `<div class="barra-fecha">
      <button type="button" class="btn-icono" id="dia-anterior" aria-label="Día anterior">‹</button>
      <input type="date" id="dia-fecha" aria-label="Fecha" value="${fecha}">
      <button type="button" class="btn-icono" id="dia-siguiente" aria-label="Día siguiente">›</button>
      <button type="button" class="btn secundario" id="dia-hoy"${fecha === hoy ? ' disabled' : ''}>Hoy</button>
    </div>
    <h1 class="h1-fecha">${fechaLarga(fecha)}</h1>
    ${otroDia}
    <ol class="pasos" aria-label="Pasos del día">
      <li><button type="button" data-paso="1"><span class="paso-num">1</span><span class="paso-txt"><strong>Género</strong><small id="estado-paso-1"></small></span></button></li>
      <li><button type="button" data-paso="2"><span class="paso-num">2</span><span class="paso-txt"><strong>Cierre</strong><small>En construcción</small></span></button></li>
      <li><button type="button" data-paso="3"><span class="paso-num">3</span><span class="paso-txt"><strong>Cuadre</strong><small>En construcción</small></span></button></li>
    </ol>
    <div id="dia-panel"></div>`;
  pintarPanel();
}

function pintarPanel() {
  document.querySelectorAll('.pasos button').forEach((b) => {
    if (+b.dataset.paso === paso) b.setAttribute('aria-current', 'step');
    else b.removeAttribute('aria-current');
  });

  if (paso !== 1) {
    const [titulo, texto] = EN_OBRAS[paso];
    $('dia-panel').innerHTML = `<div class="resultado pendiente">${ICONO.reloj}
      <div><p class="grande">${titulo}: todavía en construcción</p><p>${texto}</p></div></div>`;
    // El estado del paso 1 se sigue viendo aunque se mire otro paso
    const n = resumenGenero(estado.dias, estado.productos, fecha).productos;
    $('estado-paso-1').textContent = n ? `${n} ${n === 1 ? 'producto' : 'productos'}` : 'Pendiente';
    document.querySelector('.pasos [data-paso="1"]').classList.toggle('hecho', n > 0);
    return;
  }

  $('dia-panel').innerHTML = panelGenero();
  if (!$('dia-cifras')) {
    $('estado-paso-1').textContent = 'Pendiente';
    return;
  }
  document.querySelectorAll('#dia-panel .fila-genero').forEach(actualizarFila);
  pintarCifras();
}

function cambiarFecha(f) {
  if (!esFecha(f)) return;
  fecha = f;
  paso = 1;
  pintarDia();
  window.scrollTo(0, 0);
}

function buscar(texto) {
  const q = normalizar(texto);
  let visibles = 0;
  document.querySelectorAll('#dia-panel .fila-genero').forEach((fila) => {
    const coincide = !q || fila.dataset.nombre.includes(q);
    fila.hidden = !coincide;
    if (coincide) visibles++;
  });
  document.querySelectorAll('#dia-panel .categoria').forEach((s) => {
    s.hidden = !s.querySelector('.fila-genero:not([hidden])');
    if (q) s.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  $('dia-sin-resultados').hidden = visibles > 0;
}

// ---------- Eventos ----------

export function prepararDia() {
  const vista = $('vista-dia');

  vista.addEventListener('click', (e) => {
    const id = e.target.closest('button')?.id;
    if (id === 'dia-anterior') return cambiarFecha(sumarDias(fecha, -1));
    if (id === 'dia-siguiente') return cambiarFecha(sumarDias(fecha, 1));
    if (id === 'dia-hoy' || id === 'dia-hoy-aviso') return cambiarFecha(hoyISO());

    const boton = e.target.closest('.pasos button');
    if (boton) {
      paso = +boton.dataset.paso;
      pintarPanel();
      return;
    }

    const fila = e.target.closest('.fila-genero');
    if (fila && e.target.closest('[data-abrir-cambio]')) return abrirCambio(fila);
    if (fila && e.target.closest('[data-cerrar-cambio]')) return cerrarCambio(fila);
    const quitar = e.target.closest('[data-quitar-cambio]');
    if (fila && quitar) {
      const p = producto(fila.dataset.id);
      const indice = +quitar.dataset.quitarCambio;
      const c = lineaGenero(estado.dias, p, fecha).cambios[indice];
      if (!c || !confirm(`¿Quitar el cambio a ${fmtEuros(c.pvp)}/${porUnidad(p)}${c.hora ? ` de las ${c.hora}` : ''}?\n\nLo que se vendió después volverá a contar al precio anterior.`)) return;
      quitarCambio(estado.dias, p, fecha, indice);
      if (comprobarGuardado(guardar())) {
        repintarCambios(fila);
        fila.querySelector('[data-abrir-cambio]').focus();
        avisar('Cambio de precio quitado.');
      }
      return;
    }

    if (id === 'dia-borrar') {
      if (!estado.dias[fecha]) return avisar('Este día no tiene nada apuntado.');
      if (!confirm(`¿Borrar todo lo apuntado el ${fechaCorta(fecha)}?\n\nNo se puede deshacer.`)) return;
      borrarDia(estado.dias, fecha);
      if (comprobarGuardado(guardar())) {
        pintarDia();
        avisar('Día borrado.');
      }
    }
  });

  vista.addEventListener('submit', (e) => {
    if (!e.target.matches('.form-cambio')) return;
    e.preventDefault();
    guardarCambio(e.target);
  });

  vista.addEventListener('input', (e) => {
    const i = e.target;
    if (i.dataset.cambio) {
      i.closest('.form-cambio').querySelector('.error').hidden = true;
      return;
    }

    if (i.id === 'dia-buscar') return buscar(i.value);

    if (i.id === 'dia-fondo') {
      const texto = i.value.trim();
      const valor = texto ? aCentimos(texto) : null;
      const mal = !!texto && valor == null;
      $('e-fondo').hidden = !mal;
      if (mal) return;
      ponerFondo(estado.dias, fecha, valor);
      comprobarGuardado(guardar());
      return;
    }

    if (!i.dataset.campo) return;
    const fila = i.closest('.fila-genero');
    const p = producto(fila.dataset.id);
    const campo = i.dataset.campo;
    const texto = i.value.trim();
    const convertir = campo !== 'inicio' ? aCentimos : porUnidades(p) ? aUnidades : aMilesimas;
    const valor = texto ? convertir(texto) : null;
    const mal = !!texto && valor == null;
    if (mal) i.setAttribute('aria-invalid', 'true');
    else i.removeAttribute('aria-invalid');
    if (!mal) {
      ponerDato(estado.dias, p, fecha, campo, valor);
      comprobarGuardado(guardar());
    }
    actualizarFila(fila);
    pintarCifras();
  });

  // Al salir de una casilla: si el precio o el coste se dejan vacíos, vuelve el propuesto
  vista.addEventListener('change', (e) => {
    const i = e.target;
    if (i.id === 'dia-fecha') return cambiarFecha(i.value);
    if (!i.dataset.campo || i.dataset.campo === 'inicio' || i.value.trim()) return;
    const p = producto(i.closest('.fila-genero').dataset.id);
    i.value = centimosATexto(lineaGenero(estado.dias, p, fecha)[i.dataset.campo]);
  });
}
