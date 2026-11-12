# Caja Doña Mencía · Pescaderías Adolfo

Aplicación web para controlar la caja de la tienda de Doña Mencía **a partir del género**: sabiendo lo que se lleva, lo que sobra y el precio de venta, calcula lo que debería haber en caja y lo compara con lo cobrado.

Parte de la experiencia de la app de Luque, corrigiendo sus puntos débiles: datos en un solo aparato, sin usuarios ni permisos, y casillas vacías que contaban como «vendido todo».

## Cómo usarla

**En el móvil, la tablet o el ordenador:** https://isma52489211-hue.github.io/gestion-pescaderia-dona-mencia/

En el móvil se puede instalar desde el menú del navegador («Añadir a pantalla de inicio») y funciona sin conexión. Los datos se guardan en cada aparato: no se comparten entre ellos.

## Decisiones

- **Cuadre de género contra caja** (no hay báscula con total del día).
- **Coste y ganancia**, **cambios de precio durante el día** y **gastos de caja detallados**.
- La tienda abre de **martes a sábado, de 8:30 a 13:30**.
- El congelado se cobra en la misma caja: **se cuenta todo en cada cierre** (o «No se ha vendido nada») y lo vendido entra en el cuadre.
- El sobrante no pasa solo al día siguiente: cada día se apunta el género con el que se empieza.
- Los productos **se archivan, no se borran**, para no romper los días ya apuntados.
- **De momento los datos se guardan en el aparato**, con copia de seguridad descargable. La nube y los PIN se dejan para el final, por decidir.

## Plan por pasos

1. Base de la app: marca, secciones y cálculos con pruebas automáticas. **Hecho.**
2. Productos: catálogo con precio de venta y coste, y copia de seguridad. **Hecho.**
3. Género del día: kilos, precio y coste con los que empieza cada producto. **Hecho.**
4. Cambios de precio: a mitad del día, pesando lo que queda en el mostrador. **Hecho.**
5. Cierre guiado a ciegas: lo que sobra producto a producto, retiradas y mermas, gastos con concepto y caja (con recuento por billetes). **Hecho.**
6. Cuadre: sale al terminar el cierre, con el detalle por producto, la caja y la ganancia. **Hecho.**
7. Congelado: stock de la tienda, lo que llega, recuento en cada cierre y lista de reposición por WhatsApp. **Hecho.**
8. Resumen.
9. Plantilla con foto.
10. Nube y PIN (por decidir): datos compartidos entre aparatos y cada persona con su PIN.

## Cómo está hecha

Sin instalaciones ni compilación: HTML, CSS y JavaScript.

- `index.html`, `css/estilos.css`, `js/app.js`, `js/ui.js`, `js/vistas/`: la pantalla.
- `js/datos/almacen.js`: dónde se guardan los datos. Es el único archivo que habría que cambiar para pasar a la nube.
- `js/nucleo/`: los cálculos, separados de la pantalla para poder probarlos.
  - `numeros.js`: el dinero se guarda en céntimos enteros y las cantidades en milésimas enteras, para que las cuentas sean exactas.
  - `cuadre.js`: lo vendido por producto, lo cobrado en caja y la comparación.
  - `dia.js`: el género de cada día (precio propuesto, avisos, resumen y cambios de precio) y `fechas.js` (con el horario).
  - `congelado.js`: stock del congelado (de partida, lo que llega, lo que queda) y reposición.
  - `cierre.js`: el cierre a ciegas (lo que sobra, retiradas y mermas, gastos, caja, terminar y reabrir).
  - `productos.js`: reglas del catálogo (nombres sin repetir, ganancia por kilo, archivar).
  - `copia.js`: comprobación de una copia de seguridad antes de restaurarla.
- `pruebas/`: pruebas automáticas de los cálculos.
- `sw.js`, `manifest.webmanifest`: app instalable y usable sin conexión.

## Cálculos

- Género: al apuntar los kilos de un producto, su precio y su coste quedan fijados para ese día. Se proponen los del último día y, si no hay, los habituales del catálogo.
- Venta posible: todo el género al precio del día, menos la merma de limpieza. Si el precio cambia durante el día, lo que había antes del cambio cuenta al precio de antes y lo que quedaba, al nuevo. La rebaja de un día no pasa al siguiente. La ganancia posible solo se da si se conoce el precio y el coste de todo.
- Producto: `inicio − sobra − retiradas y mermas = vendido`, menos el % de merma de limpieza si lo tiene. Con cambios de precio, cada tramo se valora a su precio.
- Un producto **sin contar** no es lo mismo que uno del que **no sobra nada**: mientras quede algo sin contar no hay cuadre.
- Cierre a ciegas: mientras se cierra no se ve con cuánto se empezó ni lo que debería haber en caja. Para terminarlo hace falta lo que sobra de todo y la caja completa (fondo, efectivo, tarjeta y Bizum; 0 vale, vacío no). Terminado, el día queda bloqueado hasta que se reabra.
- Congelado: `lo que había + lo que llega − lo que queda − retiradas y mermas = vendido`. El stock pasa solo de un día a otro; la primera vez se apunta lo que hay. Reposición: lo que falta para el stock ideal de cada producto.
- Caja: `efectivo contado − fondo + gastos y retiradas de dinero + tarjeta + Bizum = cobrado`.
- La caja cuadra si la diferencia está dentro del margen (3 € o el 1 % de lo vendido, lo que sea mayor). La diferencia exacta se enseña siempre.
- El cuadre solo se ve con el cierre terminado, y solo si todo lo vendido tiene precio.
- Ganancia: ventas menos el coste de lo vendido; aparte se resta lo que costó lo tirado (mermas). Las retiradas no son pérdida y los gastos de caja no se restan.

## Pruebas

```bash
npm test
```
