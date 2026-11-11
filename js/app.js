// Caja Doña Mencía — Pescaderías Adolfo
// Arranque de la app, pantalla de inicio y navegación entre secciones.

import { $, ICONO, escapar } from './ui.js';
import { estado, protegerDatos } from './datos/almacen.js';
import { pintarMas, prepararMas, abrirPaginaMas } from './vistas/mas.js';
import { pintarDia, prepararDia, irAlDia } from './vistas/dia.js';
import { activos } from './nucleo/productos.js';
import { resumenGenero } from './nucleo/dia.js';
import { hoyISO, fechaLarga } from './nucleo/fechas.js';
import { fmtEuros, fmtKg, fmtUnidades } from './nucleo/numeros.js';

export const VERSION = '0.3';

// ---------- Plan de construcción ----------

const PASOS = [
  { titulo: 'Base de la app', texto: 'La marca, las secciones y los cálculos con sus pruebas automáticas.', hecho: true },
  { titulo: 'Productos', texto: 'Catálogo con precio de venta y coste de compra, y copia de seguridad.', hecho: true },
  { titulo: 'Género del día', texto: 'Kilos, coste y precio con los que empieza cada producto.', hecho: true },
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
  } else if (!r.productos) {
    bloque = `<div class="resultado pendiente">${ICONO.reloj}
      <div><p class="grande">Falta el género de hoy</p><p>Apunta los kilos y los precios con los que empieza el día.</p></div>
      <button type="button" class="btn primario" data-ir="dia">Apuntar género</button></div>`;
  } else {
    const cantidad = [r.kilos ? fmtKg(r.kilos) : '', r.unidades ? fmtUnidades(r.unidades) : ''].filter(Boolean).join(' y ');
    bloque = `<div class="resultado ok">${ICONO.ok}
      <div><p class="grande">Género de hoy apuntado</p>
      <p>${r.productos} ${r.productos === 1 ? 'producto' : 'productos'} · ${cantidad} · Venta posible ${fmtEuros(r.venta)}</p></div>
      <button type="button" class="btn secundario" data-ir="dia">Ver el día</button></div>`;
  }

  const avisos = [];
  if (r.sinPrecio.length) avisos.push(['Falta el precio de venta de hoy', r.sinPrecio.join(', ')]);
  if (r.sinCoste.length) avisos.push(['Falta el coste de hoy', r.sinCoste.join(', ')]);
  $('inicio-estado').innerHTML = bloque + avisos.map(([titulo, texto]) => `<div class="aviso">${ICONO.alerta}
    <div><strong>${titulo}</strong><p>${escapar(texto)}</p></div>
    <button type="button" class="btn secundario" data-ir="dia">Revisar</button></div>`).join('');
}

// ---------- Secciones todavía en construcción ----------

const EN_OBRAS = {
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
  if (nombre === 'inicio') pintarInicio();
  if (nombre === 'dia') pintarDia();
  if (nombre === 'mas') pintarMas(VERSION);
  if (EN_OBRAS[nombre]) pintarEnObras(nombre);
  window.scrollTo(0, 0);
}

document.querySelectorAll('.nav-btn').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.vista === 'mas') abrirPaginaMas('menu'); // el botón de abajo siempre lleva al menú, no a una subpágina
  mostrarVista(b.dataset.vista);
}));

// Botones que llevan a otro sitio de la app: data-ir="dia" (el día de hoy) o data-ir="productos"
document.addEventListener('click', (e) => {
  const destino = e.target.closest('[data-ir]')?.dataset.ir;
  if (destino === 'dia') {
    irAlDia();
    mostrarVista('dia');
  } else if (destino === 'productos') {
    abrirPaginaMas('productos');
    mostrarVista('mas');
  }
});

// ---------- Arranque ----------

prepararMas();
prepararDia();
protegerDatos();
pintarPasos();
mostrarVista('inicio');

// Instalable en el móvil y usable sin conexión
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
