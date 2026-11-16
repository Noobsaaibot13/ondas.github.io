# Trabajos de exámenes finales

Abre **index.html** para entrar a la colección. **Los púlsares** está disponible; **El láser** se habilita el miércoles 18 de noviembre de 2026 a las 00:00 de Panamá. Los dos documentos incluyen un enlace para volver al índice y otro para pasar al otro póster.

El índice utiliza una acuarela de casa y montañas, pequeñas animaciones de entrada y un cambio suave de luz. Se adapta a móvil y respeta la preferencia de movimiento reducido.

## El láser

El póster de láser utiliza el mismo motor de cámara que el de púlsares: amplía la hoja hacia el recuadro completo y después reorganiza la figura y el texto dentro de ese borde. Solo existe una pintura detrás del documento; cada sección conserva su región del paisaje.

Los seis bloques de figuras y los 18 párrafos originales se conservan. El material visual complementario está disponible en los desplegables **Material visual complementario**. La figura complementaria 3 usa `images/laser_cavidad_resonante.svg`, un esquema local elaborado para este póster con etiquetas en español y su nota correspondiente. Sustituye un enlace de miniatura incorrecto; funciona sin conexión. Las demás imágenes científicas mantienen sus fuentes externas.

Los resúmenes y subtítulos del láser se configuran en `laser_poster_config.js`; sus colores se ajustan en `laser_acuarela.css`. El motor compartido es `poster_immersivo.js` y conserva la configuración de púlsares cuando no se proporciona otra.

## El contador del láser

La tarjeta **El láser** se desbloquea el **miércoles 18 de noviembre de 2026, a las 00:00, hora de Panamá (UTC−05:00)**.

- Antes de esa fecha, el botón está deshabilitado y el archivo del láser muestra el mismo bloqueo y contador si se abre directamente. El póster queda oculto por defecto hasta comprobar la fecha.
- Al llegar la fecha, el botón abre el láser y su página muestra el documento automáticamente.
- La tercera tarjeta **Próxima entrega** queda por anunciar, sin contador ni fecha asignada.

La fecha se calcula con el reloj del navegador y un desplazamiento de zona horaria explícito. Para cambiarla, edita `RELEASE_AT` en `entregas.js` y las fechas visibles del índice y del archivo del láser. `RELEASE_DESTINATION` apunta al póster de láser.

## La pintura

El fondo nuevo se creó con la herramienta integrada **imagegen** y se utiliza tanto en el láser como en el índice:

- [Imagen de casa y montañas](images/fondo_casa_montanas_acuarela_vertical.png).
- [Prompt exacto](images/fondo_casa_montanas_acuarela_vertical.prompt.txt).

Es un PNG vertical de **1055 × 1491 píxeles**, con proporción aproximada de papel A0. Se conserva su resolución original; no es un archivo A0 de impresión a 300 ppp. En el HTML del láser puedes sustituir `src` y `data-zoom-src` de `.scene-photo` por una versión mayor de la misma pintura y con el mismo encuadre. El índice utiliza la misma imagen en su fondo y en las tarjetas correspondientes.

## Archivos y comprobaciones

- `index.html`, `index.css`: portada de la colección.
- `entregas.js`, `laser_disponibilidad.css`: apertura y bloqueo del láser.
- `proxima_entrega.html`: espacio reservado, sin fecha asignada.
- `laser_style.css`, `poster_pulsares.css`, `laser_acuarela.css`: estilos base, cámara y variante de montañas.
- `coleccion_posters.css`: navegación entre documentos.
- `.preview/laser-release-check.cjs` y `.preview/collection-check.cjs`: bloqueo del láser, límite exacto de la fecha, acceso directo, carga local de la figura 3 y conservación del contenido.
- `.preview/laser-check.cjs`: cámara de las seis secciones en escritorio y móvil, con el reloj de prueba situado en la fecha de apertura.
- `.preview/verification-laser-release.json`: resultado de las 16 comprobaciones de la corrección del contador y la figura complementaria.

La colección funciona con los archivos de esta carpeta, sin instalación de paquetes. La copia anterior del láser está guardada en `.preview/before-laser` para comparar el contenido.
