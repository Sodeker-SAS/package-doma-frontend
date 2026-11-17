<script setup>
import DomaMobileAccountMenu from './DomaMobileAccountMenu.vue';
import DomaMobileMenuButton from './DomaMobileMenuButton.vue';

/**
 * Barra de las pantallas de entrada de un módulo en las vistas móviles: el
 * botón del menú de la app (☰), qué módulo es y quién está usando la app.
 *
 * La pantalla de entrada de un módulo es por donde se llega a los demás, por
 * eso lleva el menú (`DomaMobileMenu`, que la app monta en su layout móvil).
 * Con `menu` en false, la esquina muestra el ícono del módulo (p. ej. cuando la
 * misma pantalla se pinta en un computador, donde el menú es el lateral).
 */
defineProps({
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    /** Botón del menú; en false, el ícono del módulo. */
    menu: { type: Boolean, default: true },
    /** Ícono del módulo (Remix), cuando no hay botón del menú. */
    icon: { type: String, default: 'ri-apps-line' },
    /** { name }: las iniciales y «Cerrar Sesión»; sin usuario no se muestran. */
    user: { type: Object, default: null },
    logoutable: { type: Boolean, default: true },
});

defineEmits(['logout']);
</script>

<template>
    <div class="doma-mobile-navbar">
        <DomaMobileMenuButton v-if="menu" />
        <span v-else class="doma-mobile-navbar__icon" aria-hidden="true">
            <i :class="icon"></i>
        </span>

        <div class="doma-mobile-navbar__titles">
            <span class="doma-mobile-navbar__title">{{ title }}</span>
            <span v-if="subtitle" class="doma-mobile-navbar__subtitle">{{ subtitle }}</span>
        </div>

        <slot name="actions" />

        <DomaMobileAccountMenu :user="user" :logoutable="logoutable" @logout="$emit('logout')" />
    </div>
</template>

<style scoped>
/*
 * El aire de los lados es `--doma-mobile-gutter` (14 px; 20 px desde tablet):
 * la app lo cambia para alinearla con el contenido de su pantalla.
 */
.doma-mobile-navbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px var(--doma-mobile-gutter, 14px) 12px;
    border-bottom: 1px solid var(--doma-border);
    background: var(--doma-surface);
}

.doma-mobile-navbar__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: var(--doma-radius);
    background: var(--doma-primary-soft);
    color: var(--doma-primary);
    font-size: 18px;
}

.doma-mobile-navbar__titles {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}

.doma-mobile-navbar__title {
    color: var(--doma-text);
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
}

.doma-mobile-navbar__subtitle {
    color: var(--doma-muted);
    font-size: 12px;
}

@media (min-width: 768px) {
    .doma-mobile-navbar {
        padding-left: var(--doma-mobile-gutter, 20px);
        padding-right: var(--doma-mobile-gutter, 20px);
    }

    .doma-mobile-navbar__icon {
        width: 38px;
        height: 38px;
        font-size: 20px;
    }

    .doma-mobile-navbar__title {
        font-size: 16px;
    }

    .doma-mobile-navbar__subtitle {
        font-size: 13px;
    }
}
</style>
