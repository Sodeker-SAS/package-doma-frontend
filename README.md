# sodeker/doma-frontend

Componentes Vue, estilos y tokens del rediseño de Suite y sus aplicaciones hijas.

Es un paquete Composer **sin PHP y sin build propio**: Composer solo lo entrega en `vendor/` y
cada aplicación compila su fuente con su propio Vite, igual que el resto de su `resources/js`.

## Estructura

```
resources/
├── index.js          punto de entrada público: import { … } from '@doma'
├── components/       componentes Vue (SFC con <script setup>)
├── composables/      lógica reutilizable (useAlgo)
├── directives/       directivas de Vue (v-doma-tooltip)
├── utils/            funciones sueltas (moduleColor, holdDomaLayout)
└── styles/
    ├── doma.css      estilos globales; la app lo importa una sola vez
    ├── tokens.css    variables CSS --doma-* (color, tipografía, espaciado…)
    ├── tooltip.css   tooltips de DOMA y el aspecto de los de PrimeVue y Bootstrap
    ├── layout.css    barra a todo el ancho y menú lateral sobre la plantilla Velzon
    └── menu.css      ítems del menú lateral, su panel flotante y su tooltip
vite.js               plugin de Vite que conecta el paquete con la app
package.json          solo declara peerDependencies; no se instala
```

## Uso desde una aplicación

```js
// resources/js/app.js — una sola vez
import '@doma/styles/doma.css';

// en cualquier componente o página
import { DomaButton } from '@doma';
import DomaButton from '@doma/components/DomaButton.vue';
```

## Componentes

### `DomaNavBar`

Barra de navegación superior, la misma en Suite y en cada app hija. No conoce el router ni
la sesión de la app: recibe los datos por props y avisa las acciones por eventos.

```vue
<DomaNavBar
    :modules="modules"            <!-- lanzador: [{ slug, name, icon, url, accessible, color? }], ya ordenados -->
    current-module="sat"          <!-- se resalta en el lanzador -->
    :home-url="homeUrl"           <!-- "Inicio" del lanzador (hub de Suite) -->
    :config-url="configUrl"       <!-- "Configuración": botón en la barra y en el lanzador -->
    :config-active="false"        <!-- resalta ese botón cuando se está en la configuración -->
    :novelties-center="true"           <!-- botón Centro Novedades (?), a la izquierda de Configuración -->
    :announcements="novedades"    <!-- novedades del Centro Novedades (ver abajo) -->
    :tenant="{ id, name, caption }"
    :tenants="empresas"           <!-- [{ id, name, caption? }]: con más de una aparece el selector -->
    :tenant-switchable="true"     <!-- p. ej. solo en vistas de listado -->
    :user="{ name, caption, email, avatarUrl }"
    :logoutable="true"
    :menu-toggle="true"           <!-- botón del menú lateral, solo en pantallas angostas -->
    :brand="true"                 <!-- marca DOMA + lanzador al inicio, antes de la línea separadora -->
    :theme="null"                 <!-- 'light' | 'dark' muestra el botón de tema -->
    @select-tenant="(empresa) => …"
    @logout="…"
    @toggle-menu="…"
    @toggle-theme="…"
    @open-announcement="(novedad) => …"
>
    <template #novelties-menu="{ close }">
        <!-- enlaces del Centro Novedades (manuales, guías…); usar la clase doma-navbar__menu-item -->
    </template>
    <template #user-menu="{ close }">
        <!-- ítems extra del menú del usuario; usar la clase doma-navbar__menu-item -->
    </template>
</DomaNavBar>
```

Slots: `start` (junto al selector de empresa), `actions` (antes del usuario), `novelties-menu` y
`user-menu`.
Los íconos son de Remix Icon (`ri-*`), que carga cada app. El color de cada módulo sale de
`moduleColor(slug)` si no se pasa `color`.

El lanzador pinta los productos en el orden en que llegan: el orden lo decide la app y debe ser
el mismo del hub de productos (en Suite, `ProductOrderService`). Muestra a lo sumo 3×3, siempre
del mismo tamaño; si llegan más, los primeros nueve y "Ver más productos", que lleva a `homeUrl`
(el hub, donde están todos). La empresa se muestra siempre con dos letras (sin logo) y, si trae
`caption`, con ese dato bajo el nombre, p. ej. su NIT.

La barra ocupa siempre todo el ancho de la pantalla, fija arriba; el menú lateral de la app va
debajo de ella. El bloque de marca y lanzador mide `--doma-navbar-brand-width` (por defecto el
ancho del menú lateral de Velzon) para que la línea separadora caiga sobre el borde del menú.

En Suite va dentro de `#page-topbar` (`resources/js/Components/SuiteNavBar.vue`).

#### Centro Novedades

El botón con el megáfono, a la izquierda de Configuración, abre el Centro Novedades: el lugar
para anunciar las actualizaciones de DOMA. Sale siempre (`novelties-center` en `false` lo oculta) y
tiene dos partes:

- **Novedades** (`announcements`): primero las que el usuario no ha abierto y luego las vistas,
  cada grupo de la más reciente a la más antigua; sin novedades dice
  "Sin novedades.". De cada una solo se ve el ícono, el título (dos líneas como máximo) y
  "Aplica el {date}"; el ícono va en amarillo si es `critical`. Todas se abren en su detalle
  (resumen, pasos y botón), tengan pasos o no. Cada barra muestra
  solo las de su producto: las que traen su slug (`current-module`) en `apps` y las que no
  traen `apps`. Con `manage-url` (solo para quien puede administrarlas) aparece "Gestionar".
- Lo que la app pase por el slot `novelties-menu`.

En DOMA todo eso lo manda Suite: las novedades se crean y publican en su pantalla Novedades DOMA
(módulo `SystemNovelties`, solo roles privilegiados) y llegan a su barra en
`tenantContext.noveltiesCenter` y a las apps hijas en el contexto de navegación (`novelties_center`), que
cada hija comparte igual en `tenantContext.noveltiesCenter`:

```vue
<DomaNavBar
    :announcements="noveltiesCenter.announcements ?? []"
    :manage-url="noveltiesCenter.manage_url ?? ''"
    @announcements-seen="(ids) => window.axios.post(rutaQueAvisaASuite, { ids })"
    …
/>
```

Cada novedad (la arma Suite):

```js
{
    id: '01K6TQ0M3Y8E2V5N7R4B9C1D2F', // uuid de la novedad
    title: 'Nueva barra superior y menú lateral', // máximo 60 caracteres (Suite)
    summary: 'Ahora cambias de empresa y de producto desde la barra superior…',
    date: '2026-10-15',           // cuándo aplica (AAAA-MM-DD): "Aplica el 15 de octubre de 2026"
    icon: 'ri-layout-top-2-line', // por defecto, un megáfono
    critical: false,              // true: el ícono en amarillo (p. ej. un mantenimiento)
    apps: ['sat'],                // productos donde sale; vacío: en todos
    steps: [{                     // abren el detalle (DomaAnnouncementDetail)
        label: 'Empresa',         // el chip del paso
        title: 'Tu empresa, siempre a la vista',
        text: 'Arriba ves el nombre y el NIT de la empresa activa…',
        media: { src: 'https://…/storage/system-novelties/…gif', type: 'image' }, // o 'video'
        before: { src: '…', type: 'image' }, // opcional: captura de antes, para comparar
        seconds: 6,               // tiempo del paso en la reproducción automática
    }],
    action: { label: 'Ver ahora', url: '/t/develop/…' }, // opcional: botón principal del detalle
    seen: false,                  // el usuario ya la vio (lo guarda Suite)
}
```

- **Vistas:** una novedad queda vista solo cuando el usuario la abre, no al abrir el Centro
  Novedades. Mientras quede alguna sin abrir (`seen: false`), el botón conserva el punto rojo, y
  cada una sin abrir lleva el mismo punto en su ícono y un fondo suave. Al abrirla, la barra emite
  `announcements-seen` con su id y la app se lo pasa a Suite (`POST /novelties-center/seen` en
  Suite, `POST /sso/novelties-center-seen` en las hijas, que reenvían a
  `POST /api/v1/novelties-center/seen`). La lectura es del usuario: vista en una app, vista en
  todas.
- Sin pasos, el detalle muestra la fecha, el resumen y el botón: sirve para avisos rápidos
  como un mantenimiento.
- Los medios los sirve Suite (disco `public`, `system-novelties/`): el paquete no trae medios.
- Los rótulos van directos, sin conectores: "Centro Novedades", no "Centro de ayuda".

### `DomaMenuHeader`

Encabezado del menú lateral: dónde está parado el usuario, sobre fondo gris. En Suite es
"Configuración"; en cada app hija será su producto. Con el menú colapsado solo queda el ícono.

```vue
<DomaMenuHeader
    title="Configuración"
    description="Ajustes transversales en DOMA"
    icon="ri-settings-3-line"
    :collapsed="menuColapsado"
/>
```

### `DomaAnnouncement`

Aviso del sistema: una barra a todo el ancho con un mensaje, el enlace "Más información" y el
botón de cerrar. El enlace abre el detalle (`DomaAnnouncementDetail`) con sus pasos. Para avisos
que deben verse sin buscarlos; las novedades van en el Centro Novedades de la barra.

```vue
<DomaAnnouncement
    id="mantenimiento-2026-10"
    :message="aviso.message"
    detail-title="Mantenimiento programado"
    :steps="[{ title: 'Qué pasa', text: '…', media: { src: '…/aviso.jpg', type: 'image' } }]"
/>
```

- Con `placement="top"` (por defecto) va fija arriba de la barra DOMA y empuja la barra, el menú
  lateral y el contenido: pone `data-doma-announcement` en `<html>` y su alto en
  `--doma-announcement-height`, que usa `styles/layout.css` (`--doma-layout-top`). Con
  `placement="inline"` ocupa su lugar en la página.
- Al cerrarlo, el navegador lo recuerda (`localStorage`, clave `doma:announcement:{id}`) hasta que
  se borren los datos del sitio. Si cambia el mensaje, vuelve a salir.
- Sin mensaje no se muestra; sin pasos no hay enlace.
- `variant`: `info` (el primario de la app, por defecto) o `warning`.

### `DomaAnnouncementDetail`

El detalle de una novedad, con el patrón de los modales de Suite: encabezado con el título
(y el punto rojo si el usuario no la había visto, `is-new`), el resumen, y un escenario con el medio de cada paso. Si el paso trae
`before`, el escenario compara antes y ahora con un divisor que se arrastra (o con las flechas
del teclado sobre él). Debajo, la barra de progreso, los pasos numerados y la explicación del
paso; al pie, Repetir, Pausar, Entendido y el botón principal (`action`).

```vue
<DomaAnnouncementDetail :open="abierto" :announcement="novedad" is-new @close="abierto = false" />
```

- Los pasos avanzan solos según sus `seconds` (6 por defecto) y se detienen en el último;
  arrastrar el divisor pausa. Con "reducir movimiento" del sistema, empieza en pausa.
- El escenario es 16:9 y nunca más alto de lo que deja libre el resto del modal: completo cabe
  en una pantalla de portátil. Los medios se ajustan sin recortarse.
- Se cierra con Escape, la X, un clic fuera o Entendido; las flechas pasan de un paso a otro.

### Tooltip

Todos los tooltips se ven igual en todas las apps: fondo del primario de la app, su texto, el
radio del tema y sin sombra (`styles/tooltip.css`, incluido en `doma.css`). Los dos de DOMA
salen igual: 0,15 s después de llegar al elemento, con una entrada de 0,15 s. Los colores salen de
`--doma-tooltip-bg` y `--doma-tooltip-text`; la app no los pinta por su cuenta.

El paquete trae dos, que no dependen de PrimeVue ni de Bootstrap (no todas las apps los tienen):

- `data-doma-tooltip="Texto"`: sin JavaScript, debajo del elemento, al pasar el mouse o al
  enfocarlo con el teclado. Para elementos que nada recorta, como los de la barra.
- `v-doma-tooltip`: directiva que pinta el tooltip en `<body>`, a cualquier lado, así ningún
  contenedor lo recorta. Para elementos dentro de algo con scroll u `overflow`, como el menú
  lateral. Un texto vacío no muestra nada, y repintar el elemento no lo borra.

  ```js
  import { vDomaTooltip } from '@doma';   // en <script setup> queda registrada sola
  directives: { domaTooltip: vDomaTooltip }, // en la Options API
  ```

  ```vue
  <a v-doma-tooltip:right="'Reportes'">…</a>
  <a v-doma-tooltip:right="menuColapsado ? 'Reportes' : ''">…</a>
  ```

  El argumento es el lado: `top` (por defecto), `right`, `bottom` o `left`.

Los tooltips que ya usan las páginas de cada app toman el mismo aspecto: el de PrimeVue
(`v-tooltip`, Suite y SAT) y el de Bootstrap (`v-b-tooltip` de bootstrap-vue-next, Iris y SAT).
En el rediseño se usan los de DOMA: el `v-tooltip` de PrimeVue borra el tooltip visible cada vez
que el componente se repinta.

### Layout y menú lateral

`styles/layout.css` y `styles/menu.css` (incluidos en `doma.css`) le dan a la plantilla Velzon
de cada app el layout del rediseño, el mismo en Suite y en todas las hijas:

- La barra (`DomaNavBar`, dentro de `#page-topbar`) a todo el ancho y fija arriba, **plana**: sin
  sombra, solo con su línea inferior. Nunca se mueve: ni al cambiar de módulo ni cuando la
  página gana o pierde la barra de scroll, porque mide siempre el ancho de la ventana (`100vw`).
  El título de página (`.page-title-box`) tampoco lleva sombra.
- El menú lateral debajo de la barra, sin sombra: lo separa del contenido su borde derecho. Esa
  línea y la de la barra son la misma, `--doma-layout-border` (el borde del menú del tema).
  Se colapsa y expande solo con click (sin hover), con el botón redondo sobre su borde; colapsado,
  las opciones con sub-ítems abren un panel flotante y las demás muestran un tooltip.
- Ítems con los tamaños, espacios y estados del rediseño: el activo en el primario sólido y el
  padre de un sub-ítem activo con una barra del primario. El radio es el del tema.
- Sin footer: el contenido no reserva su alto abajo.

Los colores salen del tema de cada app: su primario y las variables de su menú
(`--vz-vertical-menu-*`), así el menú de cada una conserva su paleta.

La app pone el marcado y su lógica (qué módulos lista, el tamaño guardado del menú, el panel
flotante); el aspecto y la mecánica del layout vienen del paquete:

| Marcado en la app | Para qué |
|---|---|
| `<html data-doma-layout>` | Activa el layout. Ponerlo antes de montar Vue (en `app.blade.php`, para que el menú no salte al cargar) y mantenerlo desde el layout vertical: `holdDomaLayout()` al crearlo y `releaseDomaLayout()` al desmontarlo, nunca con `setAttribute`/`removeAttribute` directos |
| `<div class="app-menu navbar-menu doma-app-menu">` | El menú lateral; `DomaMenuHeader` va como primer hijo |
| `<button class="doma-sidebar-toggle">` | Botón de colapsar el menú |
| `.doma-menu-flyout`, `-title`, `-list`, `-link` | Panel flotante del menú colapsado, teletransportado a `<body>` |
| `v-doma-tooltip:right` en los ítems sin sub-ítems | Su nombre con el menú colapsado; con el menú expandido, texto vacío |

La app ya no define estos estilos en su `custom.scss` ni en su `menu.vue`.

### Utilidades

- `moduleColor(slug)`: color de identidad de cada producto; el mismo en el login, el hub de Suite
  y el lanzador de todas las apps. Hoy es el primario de cada app y es provisional: los colores
  están juntos en `utils/moduleColors.js` para cambiarlos en un solo lugar.
- `useDismiss(ancla, cerrar)`: cierra un menú al hacer clic fuera o presionar Escape.
- `holdDomaLayout()` / `releaseDomaLayout()` y `DOMA_LAYOUT_ATTR`: ponen y quitan el atributo
  del layout. Al cambiar de módulo, Inertia monta el layout nuevo antes de desmontar el anterior;
  el atributo solo se quita cuando ya no queda ninguno montado. Si se quitara en ese cambio, la
  barra nueva arrancaría en la posición de la plantilla y se deslizaría a su lugar.

### Tokens

`styles/tokens.css` define las variables `--doma-*`. Cada una toma el valor del tema de la app
(`--vz-*` de Velzon): su primario, su paleta y su modo oscuro. El valor de respaldo, el de
Suite, solo aplica si la app no define la variable.

**Ningún color va fijo en el paquete.** Todo color de un componente o de una hoja de estilos sale
de un token `--doma-*` o de una variable `--vz-*` del tema, con el valor de Suite como respaldo.

## Probar sin publicar

El `vite.config.js` de la aplicación usa la **primera copia del paquete que exista**:

| Orden | Ruta | Cuándo aplica |
|---|---|---|
| 1 | `DOMA_FRONTEND_PATH` | Variable de entorno opcional para forzar otra copia |
| 2 | `../package-doma-frontend` | **Modo local**: la carpeta de trabajo, hermana de las apps |
| 3 | `vendor/sodeker/doma-frontend` | **Modo publicado**: la versión que instaló Composer |

En modo local cada archivo que se guarda en `doma-frontend` llega al navegador por HMR, igual
que un archivo de la propia app: **sin commit, sin tag y sin tocar Composer**. En el servidor
`../package-doma-frontend` no existe y se usa la copia de `vendor/` sin cambiar nada.

No se usa un *path repository* de Composer (como en `package-laravel-attachements`) porque
quien consume el paquete es Vite, no PHP: así el `composer.json` y el `composer.lock` de la app
no cambian durante el desarrollo y no hay un lock apuntando a una carpeta local que rompa un
despliegue.

### Conectar una aplicación (una sola vez)

**1. `vite.config.js`** — elegir la copia y registrar el plugin:

```js
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// doma-frontend (componentes del rediseño). Se prefiere la carpeta hermana
// ../package-doma-frontend, montada en el contenedor node, para probar sin
// publicar; si no existe, la copia que instaló Composer. DOMA_FRONTEND_PATH
// fuerza otra.
const domaFrontendRoot = [process.env.DOMA_FRONTEND_PATH, '../package-doma-frontend', 'vendor/sodeker/doma-frontend']
    .filter(Boolean)
    .map((path) => resolve(path))
    .find((path) => existsSync(resolve(path, 'vite.js')));
const domaFrontend = domaFrontendRoot
    ? (await import(pathToFileURL(resolve(domaFrontendRoot, 'vite.js')).href)).default
    : () => null;

// …y en plugins: [laravel(…), vue(…), domaFrontend()]
```

**2. `docker-compose.yml`** — montar el paquete en el servicio `node`:

```yaml
      # doma-frontend en vivo: vite.config.js lo prefiere a vendor/. Si la
      # carpeta no existe en el Mac, Docker monta una vacía y se usa vendor/.
      - ../package-doma-frontend:/var/package-doma-frontend:ro
```

La ruta `/var/package-doma-frontend` no es arbitraria: la app vive en `/var/www`, así que
`../package-doma-frontend` desde ahí es `/var/package-doma-frontend`.

**3. Recrear el contenedor** — los volúmenes solo se aplican al crearlo:

```bash
docker compose up -d --no-deps --force-recreate node
```

**4. `jsconfig.json`** (opcional) — para que el editor resuelva `@doma`:

```json
"@doma": ["../package-doma-frontend/resources/index.js", "vendor/sodeker/doma-frontend/resources/index.js"],
"@doma/*": ["../package-doma-frontend/resources/*", "vendor/sodeker/doma-frontend/resources/*"]
```

**Verificación:** el log de Vite debe decir qué copia usa.

```bash
docker logs node_suite 2>&1 | grep doma-frontend
```

```
doma-frontend: usando la copia local /var/package-doma-frontend
```

Si no aparece la línea, se está usando `vendor/` (o el paquete no está en ninguna de las rutas).

### Reglas del modo local

- **Dependencias npm.** Todo paquete npm que importe un componente se declara en
  `peerDependencies` y debe estar en el `package.json` de cada app. En modo local se resuelve
  siempre desde `node_modules` de la app: si allí no está, falla en local igual que fallaría en
  producción, que es justo lo que se quiere.
- **Cambios en `vite.js` o `package.json` del paquete** exigen reiniciar el contenedor:
  `docker restart node_suite`. El resto de archivos se refleja al guardar.
- **Nada que importe `@doma` llega a `develop`** antes de que el paquete tenga un tag y la app
  lo instale por Composer: en el servidor no existe `../package-doma-frontend`.
- **`vite build` con la copia local** muestra un aviso: esa build lleva código sin publicar.

## Publicar una versión

1. Registrar los cambios en `CHANGELOG.md` y crear el tag (`v0.x.y` mientras se define el diseño).
2. En cada app, declarar el repositorio e instalar:

   ```json
   "repositories": [
       { "type": "vcs", "url": "git@github.com:Sodeker-SAS/package-doma-frontend.git", "no-api": true }
   ]
   ```

   ```bash
   docker compose exec php composer require sodeker/doma-frontend:^0.2
   ```

3. Para probar en local la versión publicada en lugar de la carpeta de trabajo, definir
   `DOMA_FRONTEND_PATH=vendor/sodeker/doma-frontend` en el servicio `node` y reiniciarlo.

## Convenciones

- Vue 3 con `<script setup>`, en JavaScript, como en las apps.
- Componentes con prefijo `Doma` (`DomaButton.vue`): conviven con los componentes actuales de
  cada app durante la migración y un `grep Doma` muestra qué pantallas ya usan el rediseño.
- Estilos de cada componente en `<style scoped>` y a partir de los tokens `var(--doma-…)`.
- Cada componente o composable público se exporta en `resources/index.js`.
- Código, comentarios y documentación en español.
