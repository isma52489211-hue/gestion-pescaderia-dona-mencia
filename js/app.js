// Caja Doña Mencía — Pescaderías Adolfo
// Arranque de la app y navegación entre secciones.

import { aCentimos, aMilesimas, fmtEuros, fmtKg } from './nucleo/numeros.js';
import { ventaProducto, compararCaja } from './nucleo/cuadre.js';

import { $, ICONO } from './ui.js';
import { protegerDatos } from './datos/almacen.js';
import { pintarMas, prepararMas, abrirMenuMas } from './vistas/mas.js';

export const VERSION = '0.2';

// ---------- Plan de construcción ----------

const PASOS = [
  { titulo: 'Base de la app', texto: 'La marca, las secciones y los cálculos con sus pruebas automáticas.', hecho: true },
  { titulo: 'Productos', texto: 'Catálogo con precio de venta y coste de compra, y copia de seguridad.', hecho: true },
  { titulo: 'Género del día', texto: 'Kilos, coste y precio con los que empieza cada producto.' },
  { titulo: 'Cambios de precio', texto: 'Subir o bajar un precio a mitad del día sin descuadrar la caja.' },
  { titulo: 'Cierre guiado a ciegas', texto: 'Producto a producto, sin casillas olvidadas, con retiradas, mermas y gastos detallados.' },
  { titulo: 'Cuadre', texto: 'Lo que debería haber frente a lo cobrado, con margen, ganancia y avisos.' },
  { titulo: 'Congelado', texto: 'Stock de la tienda y lista de reposición.' },
  { titulo: 'Resumen', texto: 'Semana y mes, con ganancia y exportación.' },
  { titulo: 'Plantilla con foto', texto: 'Rellenar el género con una foto de la hoja impresa.' },
  { titulo: 'Nube y PIN', texto: 'Para el final, si decides aplicarlo: datos compartidos entre aparatos y cada persona con su PIN.' },
];

function pintarPasos() {
  const siguiente = PASOS.findIndex((p) => !p.hecho);
  $('pasos-obra').innerHTML = PASOS.map((p, i) => {
    const estado = p.hecho ? 'hecho' : i === siguiente ? 'siguiente' : 'pendiente';
    const etiqueta = { hecho: 'Hecho', siguiente: 'Siguiente', pendiente: 'Pendiente' }[estado];
    return `<li class="paso-obra ${estado}">
      <span class="paso-num">${i + 1}</span>
      <span class="paso-txt"><strong>${p.titulo}</strong><small>${p.texto}</small></span>
      <span class="etiqueta">${etiqueta}</span>
    </li>`;
  }).join('');
}

// ---------- Prueba del cálculo ----------

function pintarDemo() {
  const inicio = aMilesimas($('demo-inicio').value);
  const pvp = aCentimos($('demo-pvp').value);
  const sobra = aMilesimas($('demo-sobra').value);
  const cobrado = aCentimos($('demo-cobrado').value);
  const caja = $('demo-resultado');

  if (inicio == null || pvp == null || sobra == null || cobrado == null) {
    caja.innerHTML = `<div class="resultado pendiente">${ICONO.reloj}
      <div><p class="grande">Faltan números</p><p>Rellena las cuatro casillas. Si no sobra nada, escribe 0.</p></div></div>`;
    return;
  }

  const venta = ventaProducto({ inicio, sobra, pvp });
  if (venta.avisos.includes('sobra-mas-que-inicio')) {
    caja.innerHTML = `<div class="resultado falta">${ICONO.alerta}
      <div><p class="grande">Revisa los kilos</p><p>No pueden sobrar más kilos de los que había al empezar.</p></div></div>`;
    return;
  }

  const r = compararCaja(venta.importe, cobrado);
  const titulo = r.diferencia === 0 ? 'Cuadra'
    : r.estado === 'cuadra' ? `Cuadra (${r.diferencia < 0 ? 'faltan' : 'sobran'} ${fmtEuros(Math.abs(r.diferencia))}, dentro del margen)`
      : `${r.estado === 'falta' ? 'Faltan' : 'Sobran'} ${fmtEuros(Math.abs(r.diferencia))}`;
  const clase = r.estado === 'cuadra' ? 'ok' : r.estado;
  caja.innerHTML = `<div class="resultado ${clase}">${clase === 'ok' ? ICONO.ok : ICONO.alerta}
    <div><p class="grande">${titulo}</p>
    <p>Vendido ${fmtKg(venta.vendido)} · Debería haber ${fmtEuros(venta.importe)} · Cobrado ${fmtEuros(cobrado)} · Margen ${fmtEuros(r.margen)}</p></div></div>`;
}

// ---------- Secciones todavía en construcción ----------

const EN_OBRAS = {
  dia: {
    titulo: 'Día',
    texto: 'Aquí se apuntará cada día en tres pasos: el género con el que se empieza, el cierre de la tienda y el cuadre de la caja.',
    pasos: 'Pasos 3 a 6',
  },
  congelado: {
    titulo: 'Congelado',
    texto: 'Aquí verás el stock de congelado de la tienda y la lista de lo que hay que reponer, lista para enviar por WhatsApp.',
    pasos: 'Paso 7',
  },
  resumen: {
    titulo: 'Resumen',
    texto: 'Aquí verás la semana y el mes: lo vendido, lo cobrado, la diferencia y la ganancia, por día y por producto.',
    pasos: 'Paso 8',
  },
};

function pintarEnObras(nombre) {
  const s = EN_OBRAS[nombre];
  $('vista-' + nombre).innerHTML = `<h1>${s.titulo}</h1>
    <div class="resultado pendiente">${ICONO.reloj}
      <div><p class="grande">Todavía en construcción</p><p>${s.texto}</p></div>
      <span class="etiqueta">${s.pasos}</span>
    </div>`;
}

// ---------- Navegación ----------

const VISTAS = ['inicio', 'dia', 'congelado', 'resumen', 'mas'];

function mostrarVista(nombre) {
  document.querySelectorAll('.nav-btn').forEach((b) => {
    if (b.dataset.vista === nombre) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  for (const v of VISTAS) $('vista-' + v).hidden = v !== nombre;
  if (EN_OBRAS[nombre]) pintarEnObras(nombre);
  if (nombre === 'mas') pintarMas(VERSION);
  window.scrollTo(0, 0);
}

document.querySelectorAll('.nav-btn').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.vista === 'mas') abrirMenuMas(); // el botón de abajo siempre lleva al menú, no a una subpágina
  mostrarVista(b.dataset.vista);
}));
for (const id of ['demo-inicio', 'demo-pvp', 'demo-sobra', 'demo-cobrado']) $(id).addEventListener('input', pintarDemo);

// ---------- Arranque ----------

const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
$('inicio-fecha').textContent = hoy;
prepararMas();
protegerDatos();
pintarPasos();
pintarDemo();
mostrarVista('inicio');

// Instalable en el móvil y usable sin conexión
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
