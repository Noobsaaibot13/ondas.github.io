# Póster de púlsares: cámara sobre la hoja

Abre el HTML y pulsa **Acercar ↗**. Primero se amplía el recuadro entero, con la figura, el título y la línea informativa que ya se ven en el póster. Después la figura se reduce y el texto se organiza dentro de ese mismo borde. Las seis secciones permanecen en su columna original: la cámara mueve y amplía la hoja completa, y no transporta el contenido a otra pantalla.

Solo existe una imagen de bosque. Su tamaño y sus coordenadas se mantienen durante el acercamiento; cada sección muestra la región de la pintura que le corresponde. Las capas SVG acompañan a esa misma hoja. Las figuras científicas y sus notas mantienen su superficie opaca, su contenido y sus fuentes originales.

**Esc** o **Volver al póster** restaura la vista general y la posición de lectura. Las flechas recorren las secciones mediante un movimiento de cámara. **Pausar animación** detiene las capas decorativas. En móvil el borde entero sigue visible, y se puede desplazar el contenido dentro de él. En escritorio el texto tiene su propia columna de lectura.

## Fondo y resolución

En el HTML busca `FONDO DEL PÓSTER COMPLETO`:

```html
<img class="scene-photo" src="images/fondo_bosque_acuarela_vertical.png"
     data-zoom-src="images/fondo_bosque_acuarela_vertical.png" ...>
```

El nuevo fondo es una acuarela de bosque vertical, clara, en verde musgo y marfil, creada con la herramienta integrada `imagegen`. El archivo entregado tiene **1055 × 1491 píxeles**, con proporción aproximada de papel A0. La herramienta no produjo un original 4K en esta sesión. No es un archivo de impresión A0 a 300 ppp.

Puedes sustituir `src` por un original mayor de la misma proporción. También puedes indicar en `data-zoom-src` una versión más grande de la misma pintura y con el mismo encuadre: se carga primero y se sustituye en el único fondo, manteniendo sus coordenadas. La sustitución se omite si la proporción cambia. No se reencuadra una imagen completa dentro de cada sección.

El prompt utilizado está en `images/fondo_bosque_acuarela_vertical.prompt.txt`. La acuarela anterior se conserva en su archivo original.

## Logos y legibilidad

Los logos usan las imágenes originales dentro de máscaras SVG que recortan su silueta exterior. No se redibujaron ni se cambiaron las letras. Los JPG originales se guardan junto a los SVG; estos últimos llevan una copia embebida para que funcionen sin dependencias externas.

Las fórmulas usan KaTeX local, con sus fuentes y licencias en `vendor/katex`. Las fotografías científicas que estaban enlazadas a servidores externos siguen necesitando conexión. Los respaldos existentes se cargan antes de las imágenes para evitar fallos por el orden de ejecución.

## Archivos principales

- `poster_immersivo.js`: cámara sobre la hoja, reorganización del contenido y teclado.
- `poster_pulsares.css`: diseño claro, recuadros, escalado de tipografía y versión móvil.
- `script.js`: contenido académico y respaldos originales.
- `math_poster.js`: renderizado local de las fórmulas existentes.
- `images/fondo_bosque_acuarela_vertical.png`: fondo de bosque.
- `images/logo_fisica_recortado.svg` y `images/logo_universidad_recortado.svg`: logos con recorte exterior.

Las comprobaciones y capturas de esta versión están en `.preview/camera-check.cjs`, `.preview/verification-v2.json` y los archivos de imagen cuyo nombre empieza por `v2-`.
