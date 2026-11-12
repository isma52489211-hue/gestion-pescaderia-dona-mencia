// Reglas del catálogo de productos. Funciones puras, con pruebas automáticas.
//
// Un producto:
//   id        identificador fijo (no cambia aunque se cambie el nombre)
//   nombre
//   tipo      'fresco' | 'gordo' | 'marisco' | 'congelado'
//   unidad    'kg' (al peso) | 'ud' (por unidades)
//   pvp       precio de venta habitual, en céntimos (null = sin poner)
//   coste     coste de compra habitual, en céntimos (null = sin poner)
//   mermaPct  % de peso que se pierde al limpiar
//   formato   texto libre («bolsa de 1 kg»)
//   stockIdeal  congelado: cantidad que conviene tener en la tienda, en milésimas (null = sin poner)
//   stockPartida congelado: { fecha, cantidad } lo que había la primera vez (ver congelado.js)
//   archivado true = ya no sale en las listas, pero los días antiguos lo siguen contando

export const TIPOS = {
  fresco: { nombre: 'Pescado fresco', icono: 'frescura' },
  gordo: { nombre: 'Pescado gordo', icono: 'preparacion' },
  marisco: { nombre: 'Marisco', icono: 'calidad' },
  congelado: { nombre: 'Congelado', icono: 'frio' },
};

export const normalizar = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const slug = (nombre) => normalizar(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Deja los datos de un formulario limpios y con todos los campos
function limpiar(datos) {
  return {
    nombre: String(datos.nombre ?? '').replace(/\s+/g, ' ').trim(),
    tipo: datos.tipo,
    unidad: datos.unidad === 'ud' ? 'ud' : 'kg',
    pvp: datos.pvp ?? null,
    coste: datos.coste ?? null,
    mermaPct: datos.mermaPct || 0,
    formato: String(datos.formato ?? '').trim(),
    stockIdeal: datos.tipo === 'congelado' ? datos.stockIdeal ?? null : null,
  };
}

// Comprueba un producto antes de guardarlo.
// Devuelve { errores: { campo: mensaje }, avisos: [mensaje] }. Con errores no se guarda; los avisos solo informan.
export function revisarProducto(datos, catalogo = [], idPropio = null) {
  const p = limpiar(datos);
  const errores = {};
  const avisos = [];

  if (p.nombre.length < 2) errores.nombre = 'Escribe el nombre del producto.';
  else {
    const repetido = catalogo.find((x) => x.id !== idPropio && normalizar(x.nombre) === normalizar(p.nombre));
    if (repetido?.archivado) errores.nombre = 'Ese producto ya existe, pero está archivado. Recupéralo en «Archivados».';
    else if (repetido) errores.nombre = 'Ya hay un producto con ese nombre.';
  }

  if (!TIPOS[p.tipo]) errores.tipo = 'Elige el tipo de producto.';
  if (p.pvp != null && !(Number.isInteger(p.pvp) && p.pvp > 0)) errores.pvp = 'El precio de venta tiene que ser mayor que 0.';
  if (p.coste != null && !(Number.isInteger(p.coste) && p.coste >= 0)) errores.coste = 'El coste no puede ser negativo.';
  if (!(p.mermaPct >= 0 && p.mermaPct < 100)) errores.mermaPct = 'La merma tiene que estar entre 0 y 99 %.';
  if (p.stockIdeal != null && !(Number.isInteger(p.stockIdeal) && p.stockIdeal >= 0)) errores.stockIdeal = 'El stock ideal no puede ser negativo.';

  if (!errores.pvp && !errores.coste && !errores.mermaPct) {
    const g = gananciaPorUnidad(p);
    if (g && g.ganancia <= 0) avisos.push('Con este precio y este coste no se gana dinero.');
  }
  return { errores, avisos };
}

export const hayErrores = (revision) => Object.keys(revision.errores).length > 0;

// Crea un producto nuevo con un id que no exista ya
export function crearProducto(datos, catalogo = []) {
  const p = limpiar(datos);
  const base = (p.tipo === 'congelado' ? 'cong-' : '') + (slug(p.nombre) || 'producto');
  let id = base;
  for (let n = 2; catalogo.some((x) => x.id === id); n++) id = `${base}-${n}`;
  return { id, ...p, archivado: false };
}

// Devuelve el producto con los cambios aplicados (el id y el estado de archivado no cambian)
export function cambiarProducto(producto, datos) {
  return { ...producto, ...limpiar(datos) };
}

// Lo que se gana por cada kilo (o unidad) comprado.
// Con merma de limpieza, de cada kilo comprado solo se cobra una parte.
export function gananciaPorUnidad(p) {
  if (p.pvp == null || p.coste == null) return null;
  const ingreso = Math.round(p.pvp * (1 - (p.mermaPct || 0) / 100));
  const ganancia = ingreso - p.coste;
  return { ingreso, ganancia, porcentaje: ingreso > 0 ? Math.round((ganancia / ingreso) * 100) : 0 };
}

export const activos = (catalogo) => catalogo.filter((p) => !p.archivado);
export const archivados = (catalogo) => catalogo.filter((p) => p.archivado);

// Resumen para enseñar de un vistazo qué falta por rellenar
export function estadoCatalogo(catalogo) {
  const lista = activos(catalogo);
  return {
    total: lista.length,
    sinPrecio: lista.filter((p) => p.pvp == null).length,
    sinCoste: lista.filter((p) => p.coste == null).length,
    archivados: catalogo.length - lista.length,
  };
}

// Punto de partida: los productos que se venden en la tienda de Luque, sin precios
const LUQUE = {
  fresco: [
    'Sardinas', 'Sardinas chicas', 'Boquerón chico', 'Boquerón mediano', 'Boquerón grande',
    'Bacaladillas', 'Bacaladillas chicas', 'Trozos de bacalao', 'Filete de bacalao', 'Filete de rosada',
    'Tiras', 'Anillas de calamar', 'Sepia', 'Rejos', 'Almejas', 'Mejillón', 'Pescada', 'Merluza',
    'Dorada', 'Lubina', 'Trucha', 'Calamar fino', 'Caballas', 'Jureles', 'Salmonetes', 'Rape',
    'Lenguados', 'Brótola', 'Melva', 'Pulpo crudo', 'Pulpo cocido', 'Rejón', 'Almejas gordas',
    'Pijotas', 'Pijotón',
  ],
  gordo: ['Atún', 'Salmón', 'Marrajo', 'Pez limón', 'Pez espada', 'Cazón'],
  marisco: [
    'Patas de cangrejo', 'Camarones', 'Patas rotas', 'Gambón',
    'Langostinos cocidos', 'Langostinos crudos', 'Gamba cruda', 'Gamba cocida',
  ],
  congelado: [
    ['Preparado de sopa', 'bolsa de 1 kg', 'ud'], ['Cóctel de marisco', 'bolsa de 1 kg', 'ud'],
    ['Gamba pelada', 'bolsa de 1 kg', 'ud'], ['Filete de merluza congelado', 'a granel', 'kg'],
    ['Filete de rosada congelado', 'a granel', 'kg'], ['Palitos del océano', 'unidad', 'ud'],
    ['Tortillitas de camarones', 'unidad', 'ud'], ['Mejillón media concha', 'a granel', 'kg'],
    ['Calamar limpio', 'bolsa de 1 kg', 'ud'], ['Bacalao congelado', 'a granel', 'kg'],
    ['Gamba rebozada', 'bolsa de 1 kg', 'ud'],
  ],
};

export function catalogoDeLuque() {
  const catalogo = [];
  for (const tipo of ['fresco', 'gordo', 'marisco']) {
    for (const nombre of LUQUE[tipo]) catalogo.push(crearProducto({ nombre, tipo }, catalogo));
  }
  for (const [nombre, formato, unidad] of LUQUE.congelado) {
    catalogo.push(crearProducto({ nombre, tipo: 'congelado', formato, unidad }, catalogo));
  }
  return catalogo;
}
