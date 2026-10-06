<script>
// Compartido por todas las instancias: al cambiar de página, Inertia monta el
// layout nuevo (con su aviso) antes de desmontar el anterior, y el atributo del
// <html> solo se quita cuando ya no queda ninguno.
let holders = 0;
</script>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import DomaAnnouncementDetail from './DomaAnnouncementDetail.vue';

/**
 * Aviso del sistema: una barra a todo el ancho con un mensaje, un enlace que
 * abre el detalle (DomaAnnouncementDetail: pasos con imágenes, GIF o videos) y
 * el botón para cerrarla. Para avisos que deben verse sin buscarlos; las
 * novedades van en el Centro Novedades de la barra.
 *
 * Arriba de todo (placement 'top'), empuja la barra DOMA y el menú lateral hacia
 * abajo (styles/layout.css, --doma-announcement-height). En el flujo de la
 * página ('inline') ocupa su lugar como cualquier bloque.
 *
 * Al cerrarlo, el navegador lo recuerda (localStorage) y no vuelve a salir
 * hasta que se borren los datos del sitio. Si cambia el mensaje, sale de nuevo.
 */
const props = defineProps({
    /** Identifica el aviso; con él se recuerda que el usuario lo cerró. */
    id: { type: String, required: true },
    /** Texto del aviso. Vacío: no se muestra. */
    message: { type: String, default: '' },
    /** Texto del enlace que abre el detalle. */
    linkLabel: { type: String, default: 'Más información' },
    /** Título del detalle. */
    detailTitle: { type: String, default: 'Novedades DOMA' },
    /**
     * Pasos del detalle, como los de una novedad. Sin pasos no hay enlace.
     * [{ label?, title, text?, media: { src, type }, before?: { src, type }, seconds? }]
     */
    steps: { type: Array, default: () => [] },
    /** Botón principal del detalle: { label, url }. */
    action: { type: Object, default: null },
    /** 'info' (el primario de la app) o 'warning'. */
    variant: { type: String, default: 'info' },
    /** Ícono de Remix Icon; por defecto, el del tipo de aviso. */
    icon: { type: String, default: '' },
    /** Se puede cerrar. */
    dismissible: { type: Boolean, default: true },
    /** 'top': fijo arriba de la barra DOMA; 'inline': en el flujo de la página. */
    placement: { type: String, default: 'top' },
});

const emit = defineEmits(['dismiss', 'open-detail']);

const STORAGE_PREFIX = 'doma:announcement:';
const ANNOUNCEMENT_ATTR = 'data-doma-announcement';
const HEIGHT_VAR = '--doma-announcement-height';

// Firma del aviso: si cambia el mensaje, el aviso cerrado vuelve a salir.
function signature(text) {
    let hash = 5381;
    for (const char of String(text)) {
        hash = ((hash << 5) + hash + char.codePointAt(0)) | 0;
    }

    return (hash >>> 0).toString(36);
}

function readDismissed() {
    try {
        return window.localStorage.getItem(STORAGE_PREFIX + props.id) === signature(props.message);
    } catch {
        return false;
    }
}

function rememberDismissed() {
    try {
        window.localStorage.setItem(STORAGE_PREFIX + props.id, signature(props.message));
    } catch {
        // Sin almacenamiento (navegación privada, datos bloqueados): se cierra
        // solo por esta vez.
    }
}

// Se lee al crear el componente, no al montarlo: así toma su lugar en el layout
// antes de que el layout anterior suelte el suyo (ver hold).
const dismissed = ref(readDismissed());
const visible = computed(() => props.message.trim() !== '' && !dismissed.value);
const iconClass = computed(() => props.icon || (props.variant === 'warning' ? 'ri-error-warning-line' : 'ri-information-line'));

// ---------- Lugar en el layout ----------

const bar = ref(null);
let resizeObserver = null;
let holding = false;

function syncHeight() {
    if (bar.value) {
        document.documentElement.style.setProperty(HEIGHT_VAR, `${bar.value.offsetHeight}px`);
    }
}

function observe() {
    syncHeight();
    if (!resizeObserver && window.ResizeObserver && bar.value) {
        resizeObserver = new ResizeObserver(syncHeight);
        resizeObserver.observe(bar.value);
    }
}

// Toma el lugar arriba de la barra. Se llama al crear el componente: al cambiar
// de página, Inertia crea el layout nuevo antes de desmontar el anterior, y el
// anterior suelta su lugar ya desmontado (onUnmounted). Así el atributo nunca se
// quita en medio del cambio y la barra DOMA no salta.
function hold() {
    if (holding || props.placement !== 'top') return;
    holding = true;
    holders += 1;
    document.documentElement.setAttribute(ANNOUNCEMENT_ATTR, '');
}

function release() {
    if (!holding) return;
    holding = false;
    resizeObserver?.disconnect();
    resizeObserver = null;
    holders = Math.max(0, holders - 1);
    if (holders === 0) {
        document.documentElement.removeAttribute(ANNOUNCEMENT_ATTR);
        document.documentElement.style.removeProperty(HEIGHT_VAR);
    }
}

if (visible.value) hold();

watch(visible, async (isVisible) => {
    if (!isVisible) {
        release();
        return;
    }
    hold();
    await nextTick();
    observe();
});

onMounted(() => {
    if (holding) observe();
});

function dismiss() {
    rememberDismissed();
    dismissed.value = true;
    emit('dismiss');
}

// ---------- Detalle ----------

const detailOpen = ref(false);
const detail = computed(() => ({ title: props.detailTitle, steps: props.steps, action: props.action }));

function openDetail() {
    detailOpen.value = true;
    emit('open-detail');
}

onUnmounted(release);
</script>

<template>
    <div
        v-if="visible"
        ref="bar"
        class="doma-announcement"
        :class="[`doma-announcement--${variant}`, `is-${placement}`]"
        role="status"
    >
        <p class="doma-announcement__text">
            <i class="doma-announcement__icon" :class="iconClass" aria-hidden="true"></i>
            <span>{{ message }}</span>
            <button
                v-if="steps.length"
                type="button"
                class="doma-announcement__link"
                @click="openDetail"
            >
                {{ linkLabel }}
            </button>
        </p>

        <button
            v-if="dismissible"
            type="button"
            class="doma-announcement__close"
            aria-label="Cerrar aviso"
            @click="dismiss"
        >
            <i class="ri-close-line" aria-hidden="true"></i>
        </button>
    </div>

    <DomaAnnouncementDetail
        :open="detailOpen"
        :announcement="detail"
        @close="detailOpen = false"
    />
</template>

<style scoped>
.doma-announcement {
    --doma-announcement-bg: var(--doma-primary-soft);
    --doma-announcement-line: var(--doma-primary-border);
    --doma-announcement-ink: var(--doma-primary-ink);

    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 8px 56px;
    border-bottom: 1px solid var(--doma-announcement-line);
    background: var(--doma-announcement-bg);
    color: var(--doma-announcement-ink);
    font-family: var(--doma-font);
    font-size: 13.5px;
    line-height: 1.45;
}

.doma-announcement--warning {
    --doma-announcement-bg: var(--doma-warning-soft);
    --doma-announcement-line: var(--doma-warning-border);
    --doma-announcement-ink: var(--doma-warning-ink);
}

/* Arriba de todo, por encima de la barra DOMA (1023). */
.doma-announcement.is-top {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1024;
    width: 100vw;
}

.doma-announcement.is-inline {
    margin-bottom: 1rem;
    border: 1px solid var(--doma-announcement-line);
    border-radius: var(--doma-radius);
}

.doma-announcement__text {
    margin: 0;
    text-align: center;
    text-wrap: balance;
}

.doma-announcement__icon {
    margin-right: 8px;
    font-size: 17px;
    vertical-align: -3px;
}

.doma-announcement__link {
    margin-left: 10px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
}

.doma-announcement__close {
    position: absolute;
    top: 50%;
    right: 12px;
    display: inline-grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: var(--doma-radius);
    background: transparent;
    color: inherit;
    font-size: 18px;
    cursor: pointer;
    transform: translateY(-50%);
}

.doma-announcement__close:hover {
    background: color-mix(in srgb, currentColor 12%, transparent);
}

.doma-announcement__link:focus-visible,
.doma-announcement__close:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
}

@media (max-width: 575.98px) {
    .doma-announcement {
        justify-content: flex-start;
        padding: 10px 48px 10px 14px;
    }

    .doma-announcement__text {
        text-align: left;
    }
}
</style>
