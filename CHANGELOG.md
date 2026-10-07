# Changelog

Cambios de `sodeker/doma-frontend` por versión. Cada entrada indica si la app que actualiza
necesita alguna acción manual.

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
