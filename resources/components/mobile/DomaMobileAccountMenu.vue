<script setup>
import { computed, ref } from 'vue';
import { useDismiss } from '../../composables/useDismiss.js';

/**
 * Quién está usando la app, y la salida: las iniciales del usuario que abren
 * «Bienvenido …!» y «Cerrar Sesión». Es el menú del usuario de la barra de
 * escritorio en las vistas móviles, donde no hay barra DOMA.
 *
 * `variant`: `avatar`, el círculo de color de la barra clara de entrada
 * (`DomaMobileNavBar`); `topbar`, translúcido, para una barra de color.
 */
const props = defineProps({
    /** { name } */
    user: { type: Object, default: null },
    /** Muestra «Cerrar Sesión». */
    logoutable: { type: Boolean, default: true },
    variant: {
        type: String,
        default: 'avatar',
        validator: (value) => ['avatar', 'topbar'].includes(value),
    },
});

const emit = defineEmits(['logout']);

const open = ref(false);
const anchor = ref(null);

useDismiss(anchor, () => {
    open.value = false;
});

const userName = computed(() => props.user?.name || '');

/**
 * Siempre DOS letras, para que el botón no cambie de peso según el nombre: con
 * nombre y apellido, sus iniciales; con una sola palabra («Sodeker»), sus dos
 * primeras letras.
 */
const initials = computed(() => {
    const words = userName.value.split(/\s+/).filter(Boolean);

    if (words.length === 0) return '';

    return (words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join('') : words[0].slice(0, 2)).toUpperCase();
});

function logout() {
    open.value = false;
    emit('logout');
}
</script>

<template>
    <div v-if="user" ref="anchor" class="doma-mobile-account">
        <button
            type="button"
            class="doma-mobile-account__toggle"
            :class="`doma-mobile-account__toggle--${variant}`"
            :aria-label="`Cuenta de ${userName}`"
            aria-haspopup="menu"
            :aria-expanded="String(open)"
            @click="open = !open"
        >
            {{ initials }}
        </button>

        <div v-if="open" class="doma-mobile-account__menu" role="menu">
            <p class="doma-mobile-account__greeting">Bienvenido {{ userName }}!</p>
            <button v-if="logoutable" type="button" class="doma-mobile-account__item" role="menuitem" @click="logout">
                <i class="ri-logout-box-r-line" aria-hidden="true"></i>
                Cerrar Sesión
            </button>
        </div>
    </div>
</template>

<style scoped>
.doma-mobile-account {
    position: relative;
    flex: none;
}

.doma-mobile-account__toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}

/* En la barra clara: el círculo de color, del alto del botón del menú. Toma el
   primario de la app, como el avatar del menú móvil. */
.doma-mobile-account__toggle--avatar {
    width: 34px;
    height: 34px;
    background: var(--doma-primary);
    color: var(--doma-on-primary);
    font-size: 13px;
}

/* En una barra de color: translúcido, como sus demás botones. */
.doma-mobile-account__toggle--topbar {
    width: 40px;
    height: 40px;
    background: color-mix(in srgb, var(--doma-on-primary) 18%, transparent);
    color: var(--doma-on-primary);
    font-size: 13px;
    letter-spacing: 0.02em;
    transition: background-color 0.15s ease;
}

.doma-mobile-account__toggle--topbar:hover,
.doma-mobile-account__toggle--topbar:focus-visible {
    background: color-mix(in srgb, var(--doma-on-primary) 30%, transparent);
    outline: none;
}

.doma-mobile-account__menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 1060;
    min-width: 200px;
    padding: 6px 0;
    border: 1px solid var(--doma-border);
    border-radius: var(--doma-radius-lg);
    background: var(--doma-surface);
    box-shadow: var(--doma-shadow-menu);
}

.doma-mobile-account__greeting {
    margin: 0;
    padding: 8px 16px 10px;
    border-bottom: 1px solid var(--doma-border);
    color: var(--doma-muted);
    font-size: 13px;
    font-weight: 600;
}

.doma-mobile-account__item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    margin-top: 6px;
    padding: 0 16px;
    border: 0;
    background: transparent;
    color: var(--doma-danger);
    font-family: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
}

.doma-mobile-account__item i {
    font-size: 16px;
}

.doma-mobile-account__item:hover,
.doma-mobile-account__item:focus-visible {
    background: var(--doma-surface-muted);
    outline: none;
}

@media (min-width: 768px) {
    .doma-mobile-account__toggle--avatar {
        width: 38px;
        height: 38px;
        font-size: 14px;
    }

    .doma-mobile-account__toggle--topbar {
        width: 44px;
        height: 44px;
        font-size: 14px;
    }
}
</style>
