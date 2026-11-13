# Changelog

Cambios de `sodeker/doma-frontend` por versión. Cada entrada indica si la app que actualiza
necesita alguna acción manual.

## [0.3.3] - 2026-11-13

### Cambiado

- Los videos de las novedades arrancan con sonido (`DomaAnnouncementDetail`). Si el navegador no
  lo deja porque el usuario aún no ha tocado la página (una invasiva que se abre sola al entrar),
  `DomaVideoPlayer` arranca en silencio y muestra el botón «Activar sonido» arriba a la izquierda
  hasta que se active. Ese silencio no cuenta como elección del usuario: el siguiente video vuelve
  a intentar con sonido.

**Acción en la app:** ninguna.

## [0.3.2] - 2026-11-12

### Añadido

- `DomaMediaViewer`: visor multimedia a pantalla completa. Video con `DomaVideoPlayer`
  (reproducir, ±10 s, línea de tiempo, velocidad, volumen, imagen en imagen y atajos de teclado),
  desde el segundo `startAt`; al cerrar, `close` lleva el segundo en el que iba;
  imagen con zoom (rueda, pellizco, botones, doble clic), arrastre, tamaño real y original;
  selector "Ahora | Antes" y paso a paso. Tokens `--doma-viewer-*`.
- Novedades invasivas en `DomaNavBar` (`invasive`, `publishedAt` y `releasedAt` de cada
  novedad, y la prop `session-started-at`): las que el usuario no ha visto y llegaron antes de su
  sesión se abren solas al entrar, una tras otra en orden de publicación; las que llegan con la
  sesión abierta salen en una barra arriba de la barra DOMA.
- `refresh-announcements` y `refresh-seconds` en `DomaNavBar`: la barra vuelve a pedir las
  novedades cada 3 minutos, con la pestaña visible, sin recargar la página.
- `DomaVideoPlayer`: reproductor de video con controles propios (los del visor), sobre el video
  (`overlay`) o en una barra debajo. No se repite; `v-model:muted`, `v-model:rate`, `start-at` y
  `handleKey(event)` para el teclado.
- `DomaAnnouncementDetail`: `queue` ("1 de 3") y el botón "Pantalla completa" del escenario (o
  doble clic), que abre el visor.
- `DomaAnnouncement`: `remember` (cerrarlo solo en esta pantalla), `opens-detail` (el enlace solo
  emite `open-detail`), `align` (`start`: a la izquierda), `label` (en negrita antes del mensaje) y la
  variante `alert` (como las alertas de la plantilla con borde izquierdo). La barra de las
  invasivas los usa: "**Novedades pendientes:** {título}" o "**3 novedades pendientes**", como
  alerta y a la izquierda.
  Si aparece o se va con la página abierta, el layout se mueve con una transición
  (`data-doma-announcement-motion`).

### Cambiado

- `DomaAnnouncement`: el ícono y el texto quedan centrados en vertical (el texto quedaba unos 2 px
  arriba); si el texto no cabe, se parte en líneas junto al ícono.
- `DomaAnnouncementDetail` ocupa el 64 % del ancho y el 88 % del alto de la ventana (toda en un
  celular): la fecha de aplicación pasa al encabezado ("Título – Aplica el…"); la barra de
  progreso (un tramo por paso)
  y el medio llenan el alto visible del cuerpo, y debajo van el resumen y los pasos. Un clic fuera
  lo cierra solo si empieza y termina fuera (soltar fuera un arrastre no lo cierra).
- Un paso con video va solo (no muestra `before`), se maneja con sus controles, arranca en
  silencio y ya no se repite: el paso dura lo que dura el video y, al terminar, pasa al siguiente.
  Antes y ahora se comparan solo entre imágenes.

**Acción en la app:** ninguna para seguir como antes; las props nuevas son opcionales. Para las
invasivas, pasar a `DomaNavBar` `session-started-at` (inicio de la sesión del navegador) y
`refresh-announcements` (una ruta propia que pida las novedades a Suite y no cuente como actividad
de la sesión). En DOMA lo traen Suite y las hijas en `tenantContext.noveltiesCenter`.

## [0.3.1] - 2026-10-07

### Añadido

- `DomaMenuSearch`: búsqueda de módulos del menú lateral, fija debajo de `DomaMenuHeader`. Busca
  por el nombre del módulo, sin tildes, solo entre los que el menú le muestra al usuario (lee lo
  que el menú pintó, así respeta permisos y apps contratadas). Con el menú colapsado, una lupa la
  abre en un panel flotante. **Acción en la app:** ponerla en el layout vertical, entre
  `DomaMenuHeader` y `#scrollbar`, con `:collapsed` como el encabezado.

## [0.3.0] - 2026-10-06

### Añadido

- Centro Novedades en `DomaNavBar`: botón con el megáfono a la izquierda de Configuración, con
  las novedades del sistema (`announcements`, filtradas por producto con `apps`; "Aplica el…" y
  ícono amarillo si son `critical`; todas abren su detalle), "Gestionar"
  para quien las administra (`manage-url`) y el slot `novelties-menu`. Un punto rojo, en el botón
  y en el ícono de cada una, avisa las novedades sin ver (`seen`), que se listan primero; al abrir una novedad
  el Centro Novedades emite `announcements-seen` para que la app lo registre en Suite. Sale en todas
  las apps al actualizar; `novelties-center` en `false` lo oculta. Para llenarlo, cada app pasa
  `tenantContext.noveltiesCenter` (lo manda Suite).
- `DomaAnnouncementDetail`: el detalle de una novedad, paso a paso, con comparación antes y
  ahora, reproducción automática con barra de progreso, pasos numerados y botón principal.
- `DomaAnnouncement`: aviso del sistema a todo el ancho que abre ese detalle. Se recuerda
  cerrado en el navegador hasta que cambie el mensaje. Tokens `--doma-announcement-height` y
  `--doma-layout-top` en el layout, y `--doma-warning-*` y `--doma-backdrop`.

### Cambiado

- Rótulos sin conectores: "Cambiar empresa" en el selector de empresa.
- Colores de producto (`moduleColor`): el primario que usa hoy cada app, en un solo mapa, para
  cambiarlos rápido cuando se definan los definitivos. Agrega `suite` y `kargo`.

## [0.2.0] - 2026-09-30

### Añadido

- Layout del rediseño sobre la plantilla Velzon (`styles/layout.css`): barra a todo el ancho,
  menú lateral debajo de ella que se colapsa solo con click, botón redondo de colapsar, vista en
  celular y contenido sin footer. **Acción en la app:** marcar `<html>` con `data-doma-layout`
  (en vez de su atributo propio), el menú con `doma-app-menu` y el botón con
  `doma-sidebar-toggle`, y quitar ese bloque de su `custom.scss`.
- Ítems del menú lateral (`styles/menu.css`): tamaños, espacios y estados, y panel flotante
  (`doma-menu-flyout`) del menú colapsado. **Acción en la app:** quitar esos estilos de su
  `menu.vue` y de su `custom.scss`, y usar las clases `doma-menu-*`.
- Directiva `v-doma-tooltip`: tooltip que se pinta en `<body>`, a cualquier lado, sin PrimeVue ni
  Bootstrap, y que no se borra al repintar el elemento. **Acción en la app:** usarla en los ítems
  sin sub-ítems del menú colapsado (`v-doma-tooltip:right`), en lugar del `v-tooltip` de PrimeVue
  o de un tooltip propio.
- El tooltip de Bootstrap (`v-b-tooltip`) toma el aspecto de los tooltips de DOMA, como ya lo
  hacía el de PrimeVue.
- Token `--doma-on-primary`: texto sobre el primario, tomado del blanco del tema.
- Token `--doma-layout-border`: color de las líneas del layout.
- `holdDomaLayout()`, `releaseDomaLayout()` y `DOMA_LAYOUT_ATTR`: mantienen el atributo del
  layout mientras haya un layout DOMA montado. **Acción en la app:** llamarlos en el `created` y
  el `unmounted` de su layout vertical, en vez de poner y quitar el atributo directamente.

### Cambiado

- La barra, el menú lateral y el título de página van planos, sin sombra. La línea bajo la barra,
  el borde del menú y el separador de la marca son la misma: `--doma-layout-border`, el borde del
  menú del tema de la app. Se quita la línea de `#page-topbar` de la plantilla, que duplicaba la
  de la barra.
- Ningún color fijo en el paquete: el texto del tooltip y la sombra de los menús desplegables
  salen del tema de la app, con el valor de Suite como respaldo.
- Radio del tema en los ítems del menú lateral y en su panel flotante.
- El botón del usuario (el que abre su menú y el cierre de sesión) ya no marca borde al pasar el
  mouse.
- Los tooltips de DOMA salen con el mismo retardo, 0,15 s (antes, 0,3 s los de la barra y sin
  retardo los del menú), y la misma entrada.
- El repositorio pasa a llamarse `package-doma-frontend` (`Sodeker-SAS/package-doma-frontend`), el
  estándar de nombres de los repositorios de paquetes. El paquete de Composer sigue siendo
  `sodeker/doma-frontend`. **Acción en la app:** apuntar el repositorio `vcs` de su
  `composer.json` a la URL nueva, y la carpeta local `../doma-frontend` a
  `../package-doma-frontend` en `vite.config.js`, `docker-compose.yml` (servicio `node`) y
  `jsconfig.json`.
- Lanzador: muestra a lo sumo 3×3 productos, siempre del mismo tamaño; si hay más, aparece
  "Ver más productos", que lleva al hub (`homeUrl`). Inicio y Configuración se reparten el ancho
  del pie, una mitad cada uno, con una línea divisoria en medio.

### Corregido

- La barra ya no se desliza desde la derecha al cambiar de módulo: el atributo del layout se
  quitaba un instante entre el layout que salía y el que entraba.
- Lo de la derecha de la barra ya no salta cuando la página gana o pierde la barra de scroll
  (al cambiar de módulo o al abrir un modal): la barra mide siempre el ancho de la ventana
  (`100vw`) y la barra de scroll se pinta encima de su borde derecho. El contenido conserva todo
  su ancho.

- El tooltip del menú colapsado ya no parpadea ni desaparece al pasar de una opción con
  sub-ítems a una sin ellos (pasaba con el `v-tooltip` de PrimeVue: al cerrarse el panel
  flotante el menú se repinta y la directiva borraba el tooltip).

### Eliminado

- Token `--doma-shadow`: la barra ya no lleva sombra.

## [0.1.0] - 2026-09-29

### Añadido

- `DomaNavBar`: barra de navegación superior unificada para Suite y las apps hijas (lanzador
  de productos, selector de empresa, Configuración DOMA, menú del usuario y botón del menú
  lateral).
- `DomaMenuHeader`: encabezado del menú lateral (ícono, título y descripción).
- Tooltip sin JavaScript con `data-doma-tooltip` (`styles/tooltip.css`, incluido en `doma.css`),
  que también unifica el tooltip de PrimeVue. **Acción en la app:** quitar sus estilos propios
  de `.p-tooltip` y el `tooltip` de su preset de PrimeVue, si los tiene.
- `moduleColor(slug)` y `useDismiss()`.
- Tokens `--doma-*` en `styles/tokens.css`, tomados del tema de la app (`--vz-*`).
  **Acción en la app:** importar `@doma/styles/doma.css` una vez en su `app.js`.
- Estructura base: `resources/` con `components/`, `composables/`, `styles/` y el punto de
  entrada `@doma`.
- Plugin de Vite (`vite.js`): alias `@doma`, resolución de las `peerDependencies` desde la app
  y, con la copia local, acceso y vigilancia de la carpeta del paquete.
