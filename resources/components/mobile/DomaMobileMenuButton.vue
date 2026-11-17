<script setup>
import { useDomaMobileMenu } from '../../composables/useDomaMobileMenu.js';

/**
 * El botón ☰ que abre el menú móvil (`DomaMobileMenu`). Va en la esquina
 * izquierda de `DomaMobileNavBar`; el menú está montado una sola vez en el
 * layout móvil de la app y los une `useDomaMobileMenu`.
 */
const { isOpen, open } = useDomaMobileMenu();
</script>

<template>
    <button
        type="button"
        class="doma-mobile-menu-button"
        aria-label="Abrir el menú"
        aria-haspopup="dialog"
        :aria-expanded="String(isOpen)"
        @click="open"
    >
        <i class="ri-menu-line" aria-hidden="true"></i>
    </button>
</template>

<style scoped>
/* 36 px en teléfono y 40 px desde tablet; el área que recibe el toque es de
   44 px aunque el botón se vea más chico. */
.doma-mobile-menu-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 0;
    border-radius: var(--doma-radius);
    background: var(--doma-primary-soft);
    color: var(--doma-primary);
    font-size: 18px;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
}

.doma-mobile-menu-button::after {
    content: "";
    position: absolute;
    inset: -4px;
}

.doma-mobile-menu-button:hover,
.doma-mobile-menu-button:focus-visible {
    background: var(--doma-primary);
    color: var(--doma-on-primary);
    outline: none;
}

@media (min-width: 768px) {
    .doma-mobile-menu-button {
        width: 40px;
        height: 40px;
        font-size: 20px;
    }
}
</style>
