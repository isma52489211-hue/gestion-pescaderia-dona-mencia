// Paso 2 del día: el cierre a ciegas.
// No enseña con cuánto se empezó ni lo que debería haber en caja: eso sale en el cuadre,
// cuando el cierre está terminado.

import { $, ICONO, escapar, avisar, comprobarGuardado } from '../ui.js';
import { estado, guardar } from '../datos/almacen.js';
import { TIPOS } from '../nucleo/productos.js';
import { tieneGenero } from '../nucleo/dia.js';
import {
  TIPOS_SALIDA, TIPOS_MOVIMIENTO, CAMPOS_CAJA, DENOMINACIONES,
  ponerSobra, sobraDe, ponerSalida, quitarSalida, ponerMovimiento, quitarMovimiento,
  ponerCaja, ponerDesglose, totalDesglose, estadoCierre, terminarCierre, reabrirCierre,
} from '../nucleo/cierre.js';
import { aCentimos, aMilesimas, aUnidades, fmtEuros, fmtKg, fmtUnidades, centimosATexto, milesimasATexto } from '../nucleo/numeros.js';
import { hoyISO, horaActual } from '../nucleo/fechas.js';

const TIPOS_GENERO = ['fresco', 'gordo', 'marisco'];

const producto = (id) => estado.productos.find((p) => p.id === id);
const porUnidades = (p) => p.unidad === 'ud';
const cantidad = (p, m) => (porUnidades(p) ? fmtUnidades(m) : fmtKg(m));
const leerCantidad = (p, texto) => (porUnidades(p) ? aUnidades(texto) : aMilesimas(texto));

// Lo que se ha traído ese día, por secciones y en orden alfabético
const traidos = (fecha) => TIPOS_GENERO.flatMap((tipo) => estado.productos
  .filter((p) => p.tipo === tipo && tieneGenero(estado.dias, p, fecha))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));

const ERRORES = {
  'sin-producto': 'Elige el producto.',
  'sin-tipo': 'Elige el tipo.',
  'sin-cantidad': 'Escribe la cantidad.',
  'sin-importe': 'Escribe el importe.',
  'sin-concepto': 'Escribe en qué se ha gastado o para qué se saca. Así se sabe a dónde va cada euro.',
  cerrado: 'El cierre está terminado. Para cambiar algo, reábrelo.',
};

const fmtDenominacion = (c) => (c >= 100 ? `${c / 100} €` : `0,${String(c).padStart(2, '0')} €`);

// ---------- Pintar ----------

function filaSobra(p, fecha) {
  const sobra = sobraDe(estado.dias, p, fecha);
  const nombre = escapar(p.nombre);
  return `<div class="fila-cierre" data-id="${p.id}">
    <p class="fc-nombre"><strong>${nombre}</strong> <small>${TIPOS[p.tipo].nombre}</small></p>
    <label class="fg-campo">${porUnidades(p) ? 'Unidades que sobran' : 'Kilos que sobran'}
      <input type="text" class="num" inputmode="${porUnidades(p) ? 'numeric' : 'decimal'}" data-sobra value="${milesimasATexto(sobra)}" placeholder="" autocomplete="off" aria-label="${porUnidades(p) ? 'Unidades' : 'Kilos'} que sobran de ${nombre}">
    </label>
    <button type="button" class="btn secundario" data-nada>No sobra nada</button>
    <p class="fc-estado" role="status"></p>
  </div>`;
}

function listaSalidas(fecha) {
  const lista = (estado.dias[fecha]?.salidas || []).map((s, i) => ({ s, i, p: producto(s.producto) })).filter((x) => x.p);
  if (!lista.length) return '<p class="ayuda">Nada apuntado.</p>';
  return `<ul class="lista-cambios">${lista.map(({ s, i, p }) => `<li>
      <span><span class="etiqueta">${TIPOS_SALIDA[s.tipo]}</span> <strong>${escapar(p.nombre)}</strong> · <span class="importe">${cantidad(p, s.cantidad)}</span>${s.motivo || s.hora ? `<small> · ${[s.motivo && escapar(s.motivo), s.hora].filter(Boolean).join(' · ')}</small>` : ''}</span>
      <button type="button" class="btn secundario" data-quitar-salida="${i}" aria-label="Quitar ${TIPOS_SALIDA[s.tipo].toLowerCase()} de ${escapar(p.nombre)}">Quitar</button>
    </li>`).join('')}</ul>`;
}

function listaMovimientos(fecha) {
  const lista = estado.dias[fecha]?.caja?.movimientos || [];
  if (!lista.length) return '<p class="ayuda">Nada apuntado.</p>';
  const total = lista.reduce((s, m) => s + m.importe, 0);
  return `<ul class="lista-cambios">${lista.map((m, i) => `<li>
      <span><span class="etiqueta">${TIPOS_MOVIMIENTO[m.tipo]}</span> <strong>${escapar(m.concepto)}</strong> · <span class="importe">${fmtEuros(m.importe)}</span>${m.hora ? `<small> · ${m.hora}</small>` : ''}</span>
      <button type="button" class="btn secundario" data-quitar-movimiento="${i}" aria-label="Quitar ${escapar(m.concepto)}">Quitar</button>
    </li>`).join('')}</ul>
    <p class="ayuda">Total que ha salido del cajón: <strong class="importe">${fmtEuros(total)}</strong></p>`;
}

function campoCaja(campo, caja, ayuda = '') {
  const id = campo === 'fondo' ? 'dia-fondo' : `cierre-${campo}`;
  return `<label>${CAMPOS_CAJA[campo]} (€)
      <input type="text" class="num" inputmode="decimal" id="${id}" ${campo === 'fondo' ? '' : `data-caja="${campo}"`} value="${centimosATexto(caja[campo])}" placeholder="" autocomplete="off">
      ${ayuda ? `<small class="ayuda-campo">${ayuda}</small>` : ''}
      <small class="error" id="${campo === 'fondo' ? 'e-fondo' : `e-${campo}`}" hidden>Escribe solo un número, por ejemplo 150 o 12,50.</small>
    </label>`;
}

export function panelCierre(fecha) {
  const lista = traidos(fecha);
  if (!lista.length) {
    return `<div class="resultado pendiente">${ICONO.reloj}
      <div><p class="grande">Primero, el género</p><p>Para hacer el cierre tiene que estar apuntado con qué género empezó el día.</p></div>
      <button type="button" class="btn primario" data-paso-ir="1">Ir al género</button></div>`;
  }

  const d = estado.dias[fecha];
  const caja = d.caja || {};
  const cerrado = d.cerrado;
  const desglose = caja.desglose || {};
  const hoy = fecha === hoyISO();

  return `<div id="cierre-cerrado">${cerrado ? `<div class="aviso ok">${ICONO.ok}
      <div><strong>Cierre terminado a las ${escapar(cerrado.hora)}</strong><p>Ya no se puede cambiar nada de este día. Si hay que corregir algo, reabre el cierre.</p></div>
      <button type="button" class="btn secundario" id="cierre-reabrir">Reabrir cierre</button></div>` : ''}</div>

    <fieldset class="sin-marco" id="cierre-form"${cerrado ? ' disabled' : ''}>
    <section class="tarjeta">
      <h2><span class="paso-num">1</span> Lo que sobra</h2>
      <p class="ayuda">Pesa lo que queda de cada producto y apúntalo. Si no queda nada, pulsa <strong>No sobra nada</strong>: una casilla vacía no cuenta como cero. Aquí no se ve con cuánto se empezó, para que el recuento sea a ciegas.</p>
      <p class="progreso" id="cierre-progreso" role="status"></p>
      ${lista.map((p) => filaSobra(p, fecha)).join('')}
    </section>

    <section class="tarjeta">
      <h2><span class="paso-num">2</span> Retiradas y mermas</h2>
      <p class="ayuda"><strong>Retirada:</strong> género que se aparta sin venderlo (para congelar, para otra tienda, para casa…). <strong>Merma:</strong> género que se tira. Las dos se restan de lo vendido. Se pueden apuntar durante el día.</p>
      <div id="cierre-salidas">${listaSalidas(fecha)}</div>
      <form class="form-cierre" id="form-salida" novalidate>
        <div class="fc-campos">
          <label>Producto
            <select data-salida="producto">${lista.map((p) => `<option value="${p.id}">${escapar(p.nombre)}</option>`).join('')}</select>
          </label>
          <label>Tipo
            <select data-salida="tipo">${Object.entries(TIPOS_SALIDA).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          </label>
          <label><span data-salida-unidad>${porUnidades(lista[0]) ? 'Unidades' : 'Kilos'}</span>
            <input type="text" class="num" inputmode="decimal" data-salida="cantidad" autocomplete="off">
          </label>
          <label>Motivo <small class="ayuda-campo">(si quieres)</small>
            <input type="text" data-salida="motivo" autocomplete="off" maxlength="80" placeholder="Ej.: para congelar">
          </label>
        </div>
        <p class="error" role="alert" hidden></p>
        <button type="submit" class="btn secundario">Apuntar</button>
      </form>
    </section>

    <section class="tarjeta">
      <h2><span class="paso-num">3</span> Dinero que sale del cajón</h2>
      <p class="ayuda"><strong>Gasto:</strong> se paga algo con dinero de la caja (hielo, bolsas…). <strong>Retirada de dinero:</strong> se saca dinero del cajón (al banco, para cambio…). Siempre con su concepto.</p>
      <div id="cierre-movimientos">${listaMovimientos(fecha)}</div>
      <form class="form-cierre" id="form-movimiento" novalidate>
        <div class="fc-campos">
          <label>Tipo
            <select data-movimiento="tipo">${Object.entries(TIPOS_MOVIMIENTO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          </label>
          <label>Importe (€)
            <input type="text" class="num" inputmode="decimal" data-movimiento="importe" autocomplete="off">
          </label>
          <label class="fc-ancho">Concepto
            <input type="text" data-movimiento="concepto" autocomplete="off" maxlength="80" placeholder="Ej.: bolsas de hielo">
          </label>
        </div>
        <p class="error" role="alert" hidden></p>
        <button type="submit" class="btn secundario">Apuntar</button>
      </form>
    </section>

    <section class="tarjeta">
      <h2><span class="paso-num">4</span> Caja</h2>
      <p class="ayuda">Cuenta el efectivo del cajón, fondo incluido. Si hoy no hubo tarjeta o Bizum, pon 0.</p>
      <div class="rejilla">
        ${campoCaja('fondo', caja)}
        ${campoCaja('contado', caja, 'Todo el dinero que hay en el cajón ahora')}
        ${campoCaja('tarjeta', caja, 'El total del datáfono')}
        ${campoCaja('bizum', caja)}
      </div>
      <details class="otros desglose"${Object.keys(desglose).length ? ' open' : ''}>
        <summary>Contar el efectivo por billetes y monedas</summary>
        <div class="rejilla-billetes">
          ${DENOMINACIONES.map((c) => `<label class="fg-campo">${fmtDenominacion(c)}
            <input type="text" class="num" inputmode="numeric" data-den="${c}" value="${desglose[c] ?? ''}" placeholder="0" autocomplete="off" aria-label="Cuántas piezas de ${fmtDenominacion(c)}">
          </label>`).join('')}
        </div>
        <p class="ayuda" id="cierre-desglose-total" role="status"></p>
      </details>
    </section>
    </fieldset>

    <section class="tarjeta" id="cierre-terminar-bloque">
      <h2>Terminar el cierre</h2>
      <div id="cierre-faltan"></div>
      ${cerrado ? '' : `<button type="button" class="btn primario" id="cierre-terminar">Terminar el cierre${hoy ? '' : ' de este día'}</button>`}
    </section>`;
}

// ---------- Partes que se actualizan mientras se escribe ----------

function textoFalta(f) {
  if (f.tipo === 'sin-genero') return 'No hay género apuntado este día.';
  if (f.tipo === 'sin-contar') return `Falta lo que sobra de: ${f.productos.map(escapar).join(', ')}.`;
  const extra = f.campo === 'tarjeta' || f.campo === 'bizum' ? ' (si no hubo, pon 0)' : '';
  const nombre = CAMPOS_CAJA[f.campo];
  return `Falta: ${nombre[0].toLowerCase()}${nombre.slice(1)}${extra}.`;
}

function actualizarFilaSobra(fila, fecha) {
  const p = producto(fila.dataset.id);
  const input = fila.querySelector('[data-sobra]');
  const estadoFila = fila.querySelector('.fc-estado');
  const sobra = sobraDe(estado.dias, p, fecha);
  fila.classList.toggle('con-dato', sobra != null);
  if (input.getAttribute('aria-invalid') === 'true') {
    estadoFila.className = 'fc-estado mal';
    estadoFila.textContent = porUnidades(p) ? 'Escribe un número entero de unidades, por ejemplo 6.' : 'Número mal escrito: no se ha guardado. Escribe, por ejemplo, 2,5.';
  } else if (sobra == null) {
    estadoFila.className = 'fc-estado pendiente';
    estadoFila.innerHTML = `${ICONO.reloj} Sin contar`;
  } else {
    estadoFila.className = 'fc-estado ok';
    estadoFila.innerHTML = `${ICONO.ok} ${sobra === 0 ? 'No sobra nada' : `Sobran ${cantidad(p, sobra)}`}`;
  }
}

// Progreso, lo que falta y el estado de los pasos. Devuelve el estado del cierre.
export function actualizarCierre(fecha) {
  const e = estadoCierre(estado.dias, estado.productos, fecha);
  const progreso = $('cierre-progreso');
  if (progreso) progreso.innerHTML = `<strong>${e.contados} de ${e.productos}</strong> productos contados`;

  const faltan = $('cierre-faltan');
  if (faltan) {
    const revisar = e.sobraDeMas.length
      ? `<div class="aviso">${ICONO.alerta}<div><strong>Revisa lo que sobra de ${e.sobraDeMas.map(escapar).join(', ')}</strong><p>Sobra más de lo que se trajo, contando retiradas y mermas. ¿Está bien escrito?</p></div></div>`
      : '';
    if (e.cerrado) {
      faltan.innerHTML = `<p>El cuadre del día saldrá en el paso 3, que todavía está en construcción.</p>`;
    } else if (e.listo) {
      faltan.innerHTML = `${revisar}<div class="aviso ok">${ICONO.ok}<div><strong>Todo apuntado</strong><p>Al terminar, ya no se podrá cambiar nada de este día sin reabrir el cierre.</p></div></div>`;
    } else {
      faltan.innerHTML = `${revisar}<div class="aviso">${ICONO.lista}<div><strong>Para terminar falta:</strong>${e.faltan.map((f) => `<p>${textoFalta(f)}</p>`).join('')}</div></div>`;
    }
  }
  const boton = $('cierre-terminar');
  if (boton) boton.disabled = !e.listo;
  return e;
}

export function pintarCierre(contenedor, fecha) {
  contenedor.innerHTML = panelCierre(fecha);
  contenedor.querySelectorAll('.fila-cierre').forEach((f) => actualizarFilaSobra(f, fecha));
  pintarTotalDesglose(fecha);
  return actualizarCierre(fecha);
}

function pintarTotalDesglose(fecha) {
  const hueco = $('cierre-desglose-total');
  if (!hueco) return;
  const desglose = estado.dias[fecha]?.caja?.desglose;
  hueco.innerHTML = desglose ? `Total contado: <strong class="importe">${fmtEuros(totalDesglose(desglose))}</strong>` : 'Escribe cuántos billetes y monedas hay de cada clase y el total se pone solo en «Efectivo contado».';
}

// ---------- Eventos ----------
// fechaDe(): la fecha que se está viendo. alCambiar(): avisa al día para que actualice los pasos.

export function prepararCierre(vista, fechaDe, alCambiar, repintar) {
  const guardado = () => comprobarGuardado(guardar());

  vista.addEventListener('input', (e) => {
    const i = e.target;
    const fecha = fechaDe();

    if (i.hasAttribute('data-sobra')) {
      const fila = i.closest('.fila-cierre');
      const p = producto(fila.dataset.id);
      const texto = i.value.trim();
      const valor = texto ? leerCantidad(p, texto) : null;
      const mal = !!texto && valor == null;
      if (mal) i.setAttribute('aria-invalid', 'true');
      else {
        i.removeAttribute('aria-invalid');
        ponerSobra(estado.dias, p, fecha, valor);
        guardado();
      }
      actualizarFilaSobra(fila, fecha);
      actualizarCierre(fecha);
      alCambiar();
      return;
    }

    if (i.dataset.caja) {
      const texto = i.value.trim();
      const valor = texto ? aCentimos(texto) : null;
      const mal = !!texto && valor == null;
      $(`e-${i.dataset.caja}`).hidden = !mal;
      if (mal) return;
      const habiaDesglose = !!estado.dias[fecha]?.caja?.desglose;
      ponerCaja(estado.dias, fecha, i.dataset.caja, valor);
      guardado();
      if (i.dataset.caja === 'contado' && habiaDesglose) {
        vista.querySelectorAll('[data-den]').forEach((x) => { x.value = ''; });
        pintarTotalDesglose(fecha);
      }
      actualizarCierre(fecha);
      return;
    }

    if (i.dataset.den) {
      const desglose = {};
      let mal = false;
      vista.querySelectorAll('[data-den]').forEach((x) => {
        const t = x.value.trim();
        const ok = !t || /^\d+$/.test(t);
        if (ok) x.removeAttribute('aria-invalid');
        else x.setAttribute('aria-invalid', 'true');
        if (!ok) mal = true;
        else if (t) desglose[x.dataset.den] = Number(t);
      });
      if (mal) {
        $('cierre-desglose-total').textContent = 'Escribe solo números enteros: cuántos billetes o monedas hay.';
        return;
      }
      ponerDesglose(estado.dias, fecha, desglose);
      guardado();
      $('cierre-contado').value = centimosATexto(estado.dias[fecha]?.caja?.contado);
      $('e-contado').hidden = true;
      pintarTotalDesglose(fecha);
      actualizarCierre(fecha);
      return;
    }

    // Al escribir en un formulario, se quita el error anterior
    const form = i.closest('.form-cierre');
    if (form) form.querySelector('.error').hidden = true;
  });

  vista.addEventListener('change', (e) => {
    // La unidad de la cantidad cambia con el producto
    if (e.target.dataset.salida === 'producto') {
      const p = producto(e.target.value);
      $('form-salida').querySelector('[data-salida-unidad]').textContent = porUnidades(p) ? 'Unidades' : 'Kilos';
    }
  });

  vista.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.id !== 'form-salida' && form.id !== 'form-movimiento') return;
    e.preventDefault();
    const fecha = fechaDe();
    const hora = fecha === hoyISO() ? horaActual() : null;
    const error = form.querySelector('.error');
    error.hidden = true;
    const mostrar = (texto) => {
      error.textContent = texto;
      error.hidden = false;
    };

    if (form.id === 'form-salida') {
      const leer = (c) => form.querySelector(`[data-salida="${c}"]`).value.trim();
      const p = producto(leer('producto'));
      const texto = leer('cantidad');
      const valor = texto && p ? leerCantidad(p, texto) : null;
      if (texto && valor == null) return mostrar(p && porUnidades(p) ? 'Las unidades tienen que ser un número entero.' : 'La cantidad está mal escrita. Escribe, por ejemplo, 1,5.');
      const r = ponerSalida(estado.dias, estado.productos, fecha, { producto: p?.id, tipo: leer('tipo'), cantidad: valor, motivo: leer('motivo'), hora });
      if (r.error) return mostrar(ERRORES[r.error]);
      if (!guardado()) return;
      form.querySelector('[data-salida="cantidad"]').value = '';
      form.querySelector('[data-salida="motivo"]').value = '';
      $('cierre-salidas').innerHTML = listaSalidas(fecha);
      avisar('Apuntado.');
    } else {
      const leer = (c) => form.querySelector(`[data-movimiento="${c}"]`).value.trim();
      const texto = leer('importe');
      const importe = texto ? aCentimos(texto) : null;
      if (texto && importe == null) return mostrar('El importe está mal escrito. Escribe, por ejemplo, 12,50.');
      const r = ponerMovimiento(estado.dias, fecha, { tipo: leer('tipo'), importe, concepto: leer('concepto'), hora });
      if (r.error) return mostrar(ERRORES[r.error]);
      if (!guardado()) return;
      form.querySelector('[data-movimiento="importe"]').value = '';
      form.querySelector('[data-movimiento="concepto"]').value = '';
      $('cierre-movimientos').innerHTML = listaMovimientos(fecha);
      avisar('Apuntado.');
    }
    actualizarCierre(fecha);
    alCambiar();
  });

  vista.addEventListener('click', (e) => {
    const fecha = fechaDe();
    const boton = e.target.closest('button');
    if (!boton) return;

    if (boton.hasAttribute('data-nada')) {
      const fila = boton.closest('.fila-cierre');
      const input = fila.querySelector('[data-sobra]');
      input.value = '0';
      input.removeAttribute('aria-invalid');
      ponerSobra(estado.dias, producto(fila.dataset.id), fecha, 0);
      guardado();
      actualizarFilaSobra(fila, fecha);
      actualizarCierre(fecha);
      alCambiar();
      // Al siguiente producto sin contar, para ir uno detrás de otro
      const siguiente = [...vista.querySelectorAll('.fila-cierre')].find((f) => !f.classList.contains('con-dato'));
      siguiente?.querySelector('[data-sobra]').focus();
      return;
    }

    if (boton.dataset.quitarSalida != null) {
      if (!confirm('¿Quitar esta retirada o merma?')) return;
      if (quitarSalida(estado.dias, fecha, +boton.dataset.quitarSalida) && guardado()) {
        $('cierre-salidas').innerHTML = listaSalidas(fecha);
        actualizarCierre(fecha);
        avisar('Quitado.');
      }
      return;
    }

    if (boton.dataset.quitarMovimiento != null) {
      if (!confirm('¿Quitar este gasto o retirada de dinero?')) return;
      if (quitarMovimiento(estado.dias, fecha, +boton.dataset.quitarMovimiento) && guardado()) {
        $('cierre-movimientos').innerHTML = listaMovimientos(fecha);
        actualizarCierre(fecha);
        avisar('Quitado.');
      }
      return;
    }

    if (boton.id === 'cierre-terminar') {
      const e2 = estadoCierre(estado.dias, estado.productos, fecha);
      const revisar = e2.sobraDeMas.length ? `Ojo: de ${e2.sobraDeMas.join(', ')} sobra más de lo que se trajo.\n\n` : '';
      if (!confirm(`${revisar}¿Terminar el cierre?\n\nDespués ya no se podrá cambiar nada de este día sin reabrirlo.`)) return;
      const r = terminarCierre(estado.dias, estado.productos, fecha, horaActual());
      if (r.error) return avisar('Falta algún dato: revisa la lista.');
      if (guardado()) {
        repintar();
        avisar('Cierre terminado.');
      }
      return;
    }

    if (boton.id === 'cierre-reabrir') {
      if (!confirm('¿Reabrir el cierre?\n\nSe podrán volver a cambiar el género, lo que sobra y la caja de este día.')) return;
      if (reabrirCierre(estado.dias, fecha) && guardado()) {
        repintar();
        avisar('Cierre reabierto.');
      }
    }
  });
}
