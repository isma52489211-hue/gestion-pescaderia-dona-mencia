# Caja Doña Mencía · Pescaderías Adolfo

Aplicación web para controlar la caja de la tienda de Doña Mencía **a partir del género**: sabiendo lo que se lleva, lo que sobra y el precio de venta, calcula lo que debería haber en caja y lo compara con lo cobrado.

Parte de la experiencia de la app de Luque, corrigiendo sus puntos débiles: datos en un solo aparato, sin usuarios ni permisos, y casillas vacías que contaban como «vendido todo».

## Decisiones

- **Datos en la nube**, compartidos entre aparatos y usables sin internet.
- **Cada persona con su PIN**: el dueño lo ve todo; el empleado solo hace el cierre. Queda registrado quién hace qué.
- **Cuadre de género contra caja** (no hay báscula con total del día).
- **Coste y ganancia**, **cambios de precio durante el día** y **gastos de caja detallados**.
- El sobrante no pasa solo al día siguiente: cada día se apunta el género con el que se empieza.

## Plan por pasos

1. Base de la app: marca, secciones y cálculos con pruebas automáticas. **Hecho.**
2. Nube y PIN.
3. Productos.
4. Género del día.
5. Cambios de precio.
6. Cierre guiado a ciegas.
7. Cuadre.
8. Congelado.
9. Resumen.
10. Plantilla con foto.

## Cómo está hecha

Sin instalaciones ni compilación: HTML, CSS y JavaScript.

- `index.html`, `css/estilos.css`, `js/app.js`: la pantalla.
- `js/nucleo/`: los cálculos, separados de la pantalla para poder probarlos.
  - `numeros.js`: el dinero se guarda en céntimos enteros y las cantidades en milésimas enteras, para que las cuentas sean exactas.
  - `cuadre.js`: lo vendido por producto, lo cobrado en caja y la comparación.
- `pruebas/`: pruebas automáticas de los cálculos.
- `sw.js`, `manifest.webmanifest`: app instalable y usable sin conexión.

## Cálculos

- Producto: `inicio − sobra − retiradas y mermas = vendido`, menos el % de merma de limpieza si lo tiene. Con cambios de precio, cada tramo se valora a su precio.
- Un producto **sin contar** no es lo mismo que uno del que **no sobra nada**: mientras quede algo sin contar no hay cuadre.
- Caja: `efectivo contado − fondo + gastos y retiradas de dinero + tarjeta + Bizum = cobrado`.
- La caja cuadra si la diferencia está dentro del margen (3 € o el 1 % de lo vendido, lo que sea mayor). La diferencia exacta se enseña siempre.

## Pruebas

```bash
npm test
```
