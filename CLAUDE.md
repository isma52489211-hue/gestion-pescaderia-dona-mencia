# Caja Doña Mencía — instrucciones para trabajar en este proyecto

App de control de caja de la pescadería de Doña Mencía (Pescaderías Adolfo), que abre en diciembre de 2026. El dueño es Ismael: no es técnico, así que explícale todo en lenguaje llano, en español, sin jerga.

Lee `README.md` antes de empezar: tiene las decisiones tomadas y el plan por pasos, con lo que ya está hecho.

## Cómo se trabaja

- **Un paso del plan cada vez.** Al terminar un paso: pruebas, comprobación en el navegador, commit, push y decirle a Ismael qué puede probar y qué decisiones has tomado tú.
- **Cada push publica la app** en https://isma52489211-hue.github.io/gestion-pescaderia-dona-mencia/ (GitHub Pages, rama `main`). El repositorio es público: nada de contraseñas ni claves.
- En cada paso: sube `VERSION` en `js/app.js`, el nombre de `CACHE` en `sw.js` (y añade allí los archivos nuevos), marca el paso como hecho en `PASOS` de `js/app.js` y en el `README.md`.
- No cambies decisiones ya tomadas (están en el README) sin preguntarle a Ismael.

## Reglas del código

- Sin compilación ni dependencias: HTML, CSS y JavaScript con módulos (`type="module"`).
- **Los cálculos van en `js/nucleo/`**, como funciones puras, sin tocar la pantalla ni el almacenamiento, y **cada regla nueva lleva su prueba** en `pruebas/`. Ejecuta `npm test` antes de cada commit: tienen que pasar todas.
- **Nunca decimales:** dinero en céntimos enteros y cantidades en milésimas enteras (kg o unidades). Usa las funciones de `js/nucleo/numeros.js`.
- **«Sin dato» (`null`) no es lo mismo que 0.** Una casilla vacía nunca se trata como cero ni como «vendido todo». Sin todos los datos no se da un cuadre ni una ganancia por buenos.
- Los datos solo se leen y guardan a través de `js/datos/almacen.js` (`estado` y `guardar()`). Comprueba siempre el resultado con `comprobarGuardado`.
- Los productos se archivan, no se borran. Los días antiguos tienen que seguir contando bien aunque cambie el catálogo.
- Las pantallas van en `js/vistas/`, una por sección. Mientras el usuario escribe, no se repinta la lista entera (se pierde el cursor): se actualiza solo lo necesario.
- Nombres de variables, funciones, comentarios y textos en español.

## Diseño

Identidad de Pescaderías Adolfo: azul `#22326A`, coral `#CC4D51` solo como acento, Lato para texto y Source Code Pro para cifras. Radios de 4–6 px, controles de al menos 44 px, primero el móvil (390 px de ancho). Los estados nunca se comunican solo con color: siempre con icono y texto. Reutiliza las clases de `css/estilos.css` antes de crear otras.

## Comprobar en el navegador

La configuración de vista previa está en `.claude/launch.json` (servidor en el puerto 5501). Prueba a tamaño de móvil y de ordenador, mira que no haya errores en la consola y **borra los datos de prueba al terminar** (las claves `cdm.*` de localStorage).

## Referencia

La app anterior, de la tienda de Luque, está en `../APP LUQUE`. Sirve de referencia para el cierre, el congelado, el resumen, el teclado del mostrador y la plantilla con foto (`lector.js`), pero no se toca.
