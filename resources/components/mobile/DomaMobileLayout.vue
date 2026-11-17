<script setup>
/**
 * El armazón de una página de una app DOMA en las vistas móviles: la barra
 * arriba (fija al desplazar), el contenido de la página y el menú de la app.
 *
 * Lo usa el layout de escritorio de cada app en lugar de su barra DOMA y su menú
 * lateral cuando `isMobileDevice()` dice que es un teléfono o una tablet. Así
 * cualquier página, pensada para móvil o no, se navega igual en el celular:
 *
 *     <DomaMobileLayout v-if="isMobileDevice($page.props)">
 *         <template #navbar>
 *             <DomaMobileNavBar :title="modulo" :subtitle="producto" :user="usuario" @logout="…" />
 *         </template>
 *         <slot />
 *         <template #menu><MiMenuMovil /></template>   ← el adaptador de DomaMobileMenu de la app
 *     </DomaMobileLayout>
 *     <div v-else id="layout-wrapper">…</div>
 *
 * Sin `navbar`, la página pone la suya (p. ej. un detalle con su barra de color
 * y «volver»). El contenido lleva el mismo aire que `.page-content` y
 * `container-fluid` de la plantilla Velzon: lo que se pega a los bordes con
 * márgenes negativos de `--vz-gutter-x` sigue cuadrando.
 */
</script>

<template>
    <div class="doma-mobile-layout">
        <div v-if="$slots.navbar" class="doma-mobile-layout__bar">
            <slot name="navbar" />
        </div>

        <main class="doma-mobile-layout__content">
            <slot />
        </main>

        <slot name="menu" />
    </div>
</template>

<style scoped>
.doma-mobile-layout {
    min-height: 100vh;
    min-height: 100dvh;
}

/* La barra queda arriba al desplazar la página. */
.doma-mobile-layout__bar {
    position: sticky;
    top: 0;
    z-index: 1002;
}

.doma-mobile-layout__content {
    padding: var(--vz-gutter-x, 1.5rem) var(--vz-gutter-x, 1.5rem) 60px;
}
</style>
