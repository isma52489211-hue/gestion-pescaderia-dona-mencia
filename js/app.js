// Caja Doña Mencía — Pescaderías Adolfo
// Arranque de la app, pantalla de inicio y navegación entre secciones.

import { $, ICONO, escapar } from './ui.js';
import { estado, protegerDatos } from './datos/almacen.js';
import { pintarMas, prepararMas, abrirPaginaMas } from './vistas/mas.js';
import { pintarDia, prepararDia, irAlDia } from './vistas/dia.js';
import { activos } from './nucleo/productos.js';
import { resumenGenero } from './nucleo/dia.js';
import { estadoCierre } from './nucleo/cierre.js';
import { resultadoDelDia, textoResultado } from './vistas/cuadre.js';
import { pintarCongelado, prepararCongelado } from './vistas/congelado.js';
import { pintarResumen, prepararResumen } from './vistas/resumen.js';
import { reposicion, sinStockDePartida } from './nucleo/congelado.js';
import { hoyISO, fechaLarga, fechaCorta, sumarDias, abreEseDia, HORARIO } from './nucleo/fechas.js';
import { fmtEuros, fmtKg, fmtUnidades } from './nucleo/numeros.js';

export const VERSION = '0.9';

// ---------- Plan de construcción ----------

const PASOS = [
  { titulo: 'Base de la app', texto: 'La marca, las secciones y los cálculos con sus pruebas automáticas.', hecho: true },
  { titulo: 'Productos', texto: 'Catálogo con precio de venta y coste de compra, y copia de seguridad.', hecho: true },
  { titulo: 'Género del día', texto: 'Kilos, coste y precio con los que empieza cada producto.', hecho: true },
  { titulo: 'Cambios de precio', texto: 'Subir o bajar un precio a mitad del día sin descuadrar la caja.', hecho: true },
  { titulo: 'Cierre guiado a ciegas', texto: 'Producto a producto, sin casillas olvidadas, con retiradas, mermas y gastos detallados.', hecho: true },
  { titulo: 'Cuadre', texto: 'Lo que debería haber frente a lo cobrado, con margen, ganancia y avisos.', hecho: true },
  { titulo: 'Congelado', texto: 'Stock de la tienda y lista de reposición.', hecho: true },
  { titulo: 'Resumen', texto: 'Semana y mes, con ganancia y exportación.', hecho: true },
  { titulo: 'Apuntar sin teclear', texto: 'Dictar o pegar el género, copiarlo de otro día y ajustar con − y +.', hecho: true },
  { titulo: 'Nube y PIN', texto: 'Para el final, si decides aplicarlo: datos compartidos entre aparatos y cada persona con su PIN.' },
];

function pintarPasos() {
  const siguiente = PASOS.findIndex((p) => !p.hecho);
  $('pasos-obra').innerHTML = PASOS.map((p, i) => {
    const situacion = p.hecho ? 'hecho' : i === siguiente ? 'siguiente' : 'pendiente';
    const etiqueta = { hecho: 'Hecho', siguiente: 'Siguiente', pendiente: 'Pendiente' }[situacion];
    return `<li class="paso-obra ${situacion}">
      <span class="paso-num">${i + 1}</span>
      <span class="paso-txt"><strong>${p.titulo}</strong><small>${p.texto}</small></span>
      <span class="etiqueta">${etiqueta}</span>
    </li>`;
  }).join('');
}

// ---------- Inicio ----------

function pintarInicio() {
  const hoy = hoyISO();
  $('inicio-fecha').textContent = fechaLarga(hoy);

  const hayProductos = activos(estado.productos).some((p) => p.tipo !== 'congelado');
  const r = resumenGenero(estado.dias, estado.productos, hoy);
  let bloque;
  if (!hayProductos) {
    bloque = `<div class="resultado pendiente">${ICONO.lista}
      <div><p class="grande">Empieza por los productos</p><p>Crea el catálogo con lo que vas a vender. Después podrás apuntar el género de cada día.</p></div>
      <button type="button" class="btn primario" data-ir="productos">Ir a productos</button></div>`;
  } else if (!r.productos && !abreEseDia(hoy)) {
    bloque = `<div class="resultado pendiente">${ICONO.reloj}
      <div><p class="grande">Hoy la tienda no abre</p><p>Abre de martes a sábado, de ${horaTexto(HORARIO.abre)} a ${horaTexto(HORARIO.cierra)}.</p></div>
      <button type="button" class="btn secundario" data-ir="dia">Abrir el día igualmente</button></div>`;
  } else if (!r.productos) {
    bloque = `<div class="resultado pendiente">${ICONO.reloj}
      <div><p class="grande">Falta el género de hoy</p><p>Apunta los kilos y los precios con los que empieza el día.</p></div>
      <button type="button" class="btn primario" data-ir="dia">Apuntar género</button></div>`;
  } else {
    const cantidad = [r.kilos ? fmtKg(r.kilos) : '', r.unidades ? fmtUnidades(r.unidades) : ''].filter(Boolean).join(' y ');
    const datos = `${r.productos} ${r.productos === 1 ? 'producto' : 'productos'} · ${cantidad} · Venta posible ${fmtEuros(r.venta)}${r.cambios ? ` · ${r.cambios} ${r.cambios === 1 ? 'cambio' : 'cambios'} de precio` : ''}`;
    const c = estadoCierre(estado.dias, estado.productos, hoy);
    const cuadre = c.cerrado ? resultadoDelDia(hoy) : null;
    const res = cuadre?.resultado;
    const clase = !res ? 'pendiente' : res.estado === 'cuadra' ? 'ok' : res.estado;
    bloque = c.cerrado
      ? `<div class="resultado ${clase}">${res?.estado === 'cuadra' ? ICONO.ok : ICONO.alerta}
      <div><p class="grande">${res?.estado === 'cuadra' ? 'Hoy la caja cuadra' : res ? `Hoy: ${textoResultado(res)}` : 'Cierre de hoy terminado'}</p>
      <p>Cierre terminado a las ${escapar(c.cerrado.hora)}${res ? ` · Debería haber ${fmtEuros(cuadre.teorico)} · Cobrado ${fmtEuros(cuadre.caja.cobrado)}` : ''}</p></div>
      <button type="button" class="btn secundario" data-ir="cuadre" data-fecha="${hoy}">Ver el cuadre</button></div>`
      : `<div class="resultado pendiente">${ICONO.reloj}
      <div><p class="grande">Día abierto: falta el cierre</p>
      <p>${datos}</p><p>El cierre se hace al cerrar, a las ${horaTexto(HORARIO.cierra)}${c.contados ? ` · ${c.contados} de ${c.productos} contados` : ''}.</p></div>
      <button type="button" class="btn primario" data-ir="cierre" data-fecha="${hoy}">Ir al cierre</button></div>`;
  }

  const avisos = [];
  // Días de la última semana con género y sin cerrar
  for (let i = 7; i >= 1; i--) {
    const f = sumarDias(hoy, -i);
    if (!estado.dias[f]) continue;
    const c = estadoCierre(estado.dias, estado.productos, f);
    if (c.productos && !c.cerrado) avisos.push([`Cierre sin terminar: ${fechaCorta(f)}`, 'El género está apuntado pero falta terminar el cierre.', 'cierre', f]);
  }
  if (r.sinPrecio.length) avisos.push(['Falta el precio de venta de hoy', r.sinPrecio.join(', ')]);
  const sinStock = sinStockDePartida(estado.productos, hoy);
  if (sinStock.length) avisos.push(['Falta saber cuánto congelado hay', sinStock.map((p) => p.nombre).join(', '), 'congelado']);
  const reponer = reposicion(estado.dias, estado.productos, hoy).filter((x) => x.falta > 0);
  if (reponer.length) avisos.push(['Hay que reponer congelado', reponer.map((x) => x.producto.nombre).join(', '), 'congelado']);
  if (r.sinCoste.length) avisos.push(['Falta el coste de hoy', r.sinCoste.join(', ')]);
  $('inicio-estado').innerHTML = bloque + avisos.map(([titulo, texto, ir = 'dia', f = hoy]) => `<div class="aviso">${ICONO.alerta}
    <div><strong>${titulo}</strong><p>${escapar(texto)}</p></div>
    <button type="button" class="btn secundario" data-ir="${ir}" data-fecha="${f}">Revisar</button></div>`).join('');
}

const horaTexto = (h) => h.replace(/^0/, '');

// ---------- Navegación ----------

const VISTAS = ['inicio', 'dia', 'congelado', 'resumen', 'mas'];

function mostrarVista(nombre) {
  document.querySelectorAll('.nav-btn').forEach((b) => {
    if (b.dataset.vista === nombre) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  for (const v of VISTAS) $('vista-' + v).hidden = v !== nombre;
  if (nombre === 'inicio') pintarInicio();
  if (nombre === 'dia') pintarDia();
  if (nombre === 'mas') pintarMas(VERSION);
  if (nombre === 'congelado') pintarCongelado();
  if (nombre === 'resumen') pintarResumen();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.nav-btn').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.vista === 'mas') abrirPaginaMas('menu'); // el botón de abajo siempre lleva al menú, no a una subpágina
  mostrarVista(b.dataset.vista);
}));

// Botones que llevan a otro sitio de la app: data-ir="dia" (el día de hoy), "cierre" (con data-fecha) o "productos"
document.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-ir]');
  const destino = boton?.dataset.ir;
  if (destino === 'dia') {
    irAlDia();
    mostrarVista('dia');
  } else if (destino === 'cierre' || destino === 'cuadre') {
    irAlDia(boton.dataset.fecha, destino === 'cierre' ? 2 : 3);
    mostrarVista('dia');
  } else if (destino === 'congelado') {
    mostrarVista('congelado');
  } else if (destino === 'productos') {
    abrirPaginaMas('productos');
    mostrarVista('mas');
  }
});

// ---------- Arranque ----------

prepararMas();
prepararDia();
prepararCongelado();
prepararResumen();
protegerDatos();
pintarPasos();
mostrarVista('inicio');

// Instalable en el móvil y usable sin conexión
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
