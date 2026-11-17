<script setup>
import { computed } from 'vue';
import { moduleColor } from '../../utils/moduleColors.js';
import DomaMobileMenuPanelHeader from './DomaMobileMenuPanelHeader.vue';

/**
 * Vista «Productos DOMA» de `DomaMobileMenu`: los productos en tarjetas de dos
 * en dos, con los colores del lanzador de `DomaNavBar` (`.doma-product`,
 * styles/products.css): cada uno con su color de identidad, el actual
 * resaltado y los que la empresa no tiene apagados con candado. Inicio DOMA va
 * al pie, como botón. Interno: no se exporta.
 *
 * Los productos son de otras apps: se abren con un enlace normal (su entrada
 * SSO), no con la navegación de la app.
 */
const props = defineProps({
    /** [{ slug, name, icon?, url, accessible?, color? }] */
    products: { type: Array, default: () => [] },
    /** Slug del producto en el que se está. */
    current: { type: String, default: '' },
    homeUrl: { type: String, default: '' },
});

defineEmits(['back']);

const tiles = computed(() => props.products.map((product) => ({
    ...product,
    color: product.color || moduleColor(product.slug),
    href: product.accessible !== false ? product.url || null : null,
    isCurrent: product.slug === props.current,
})));
</script>

<template>
    <div class="doma-mobile-panel">
        <DomaMobileMenuPanelHeader title="Productos DOMA" subtitle="Sin volver a iniciar sesión." @back="$emit('back')" />

        <div class="doma-mobile-products">
            <component
                :is="tile.href ? 'a' : 'div'"
                v-for="tile in tiles"
                :key="tile.slug"
                :href="tile.href"
                class="doma-mobile-products__tile doma-product"
                :class="{ 'is-current': tile.isCurrent, 'is-locked': !tile.href }"
                :style="{ '--module': tile.color }"
                :aria-current="tile.isCurrent ? 'true' : null"
                :aria-disabled="tile.href ? null : 'true'"
            >
                <span class="doma-product__icon">
                    <i :class="tile.icon || 'ri-apps-line'" aria-hidden="true"></i>
                </span>
                <span class="doma-mobile-products__name">{{ tile.name }}</span>
                <i v-if="!tile.href" class="ri-lock-line doma-product__lock" aria-hidden="true"></i>
            </component>
        </div>

        <div v-if="homeUrl" class="doma-mobile-products__footer">
            <a :href="homeUrl" class="doma-mobile-products__home">
                <i class="ri-home-5-line" aria-hidden="true"></i>
                Inicio DOMA
            </a>
        </div>
    </div>
</template>

<style scoped>
.doma-mobile-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

/* La forma: de dos en dos y con borde. Los colores son los de `.doma-product`. */
.doma-mobile-products {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: 10px;
    padding: 12px;
    overflow-y: auto;
}

.doma-mobile-products__tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 14px 8px;
    border: 1px solid var(--doma-border);
    border-radius: var(--doma-radius);
    background: var(--doma-surface);
    color: var(--doma-heading);
    text-align: center;
    text-decoration: none;
}

a.doma-mobile-products__tile:active {
    background: var(--doma-surface-muted);
}

.doma-mobile-products__tile.is-current {
    border-color: color-mix(in srgb, var(--module) 30%, transparent);
    background: color-mix(in srgb, var(--module) 10%, transparent);
}

.doma-mobile-products__tile.is-locked {
    border-style: dashed;
    color: var(--doma-muted);
}

.doma-mobile-products__name {
    display: -webkit-box;
    overflow: hidden;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.3;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.doma-mobile-products__tile.is-current .doma-mobile-products__name {
    font-weight: 600;
}

.doma-mobile-products__footer {
    margin-top: auto;
    padding: 12px;
    border-top: 1px solid var(--doma-border);
}

.doma-mobile-products__home {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    border-radius: var(--doma-radius);
    background: var(--doma-surface-muted);
    color: var(--doma-text);
    font-weight: 600;
    text-decoration: none;
}
</style>
