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
 * Con `remember` en false, cerrarlo lo oculta solo en esta pantalla.
 *
 * Si aparece o se va con la página abierta, la barra DOMA, el menú lateral y el
 * contenido bajan o suben con él, sin saltos.
 */
const props = defineProps({
    /** Identifica el aviso; con él se recuerda que el usuario lo cerró. */
    id: { type: String, required: true },
    /** Texto del aviso. Sin texto ni `label`: no se muestra. */
    message: { type: String, default: '' },
    /** En negrita antes del texto, como el título de una alerta de la plantilla. */
    label: { type: String, default: '' },
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
    /**
     * 'info' (el primario de la app), 'warning' o 'alert' (como las alertas de
     * la plantilla con borde izquierdo: amarillo, con una franja a la izquierda;
     * para lo que debe llamar la atención, como las novedades invasivas).
     */
    variant: { type: String, default: 'info' },
    /** Ícono de Remix Icon; por defecto, el del tipo de aviso. */
    icon: { type: String, default: '' },
    /** Se puede cerrar. */
    dismissible: { type: Boolean, default: true },
    /**
     * Cerrarlo se recuerda en el navegador. En false, se oculta solo en esta
     * pantalla: al pasar a otra o recargar, vuelve a salir.
     */
    remember: { type: Boolean, default: true },
    /**
     * El enlace abre el detalle con `steps`. En false, solo emite `open-detail`
     * (la app decide qué abrir) y se muestra aunque no haya pasos.
     */
    opensDetail: { type: Boolean, default: true },
    /** 'top': fijo arriba de la barra DOMA; 'inline': en el flujo de la página. */
    placement: { type: String, default: 'top' },
    /**
     * 'center': el texto al centro; 'start': a la izquierda, con el ícono a la
     * altura de la marca DOMA (la barra de las novedades invasivas).
     */
    align: { type: String, default: 'center' },
});

const emit = defineEmits(['dismiss', 'open-detail']);

const STORAGE_PREFIX = 'doma:announcement:';
const ANNOUNCEMENT_ATTR = 'data-doma-announcement';
const MOTION_ATTR = 'data-doma-announcement-motion';
const MOTION_MS = 400;
const HEIGHT_VAR = '--doma-announcement-height';

// Firma del aviso: si cambia el mensaje, el aviso cerrado vuelve a salir.
function signature(text) {
    let hash = 5381;
    for (const char of String(text)) {
        hash = ((hash << 5) + hash + char.codePointAt(0)) | 0;
    }

    return (hash >>> 0).toString(36);
}

// Todo lo que dice el aviso: el título en negrita y el texto.
const fullText = computed(() => `${props.label} ${props.message}`.trim());

function readDismissed() {
    if (!props.remember) return false;

    try {
        return window.localStorage.getItem(STORAGE_PREFIX + props.id) === signature(fullText.value);
    } catch {
        return false;
    }
}

function rememberDismissed() {
    if (!props.remember) return;

    try {
        window.localStorage.setItem(STORAGE_PREFIX + props.id, signature(fullText.value));
    } catch {
        // Sin almacenamiento (navegación privada, datos bloqueados): se cierra
        // solo por esta vez.
    }
}

// Se lee al crear el componente, no al montarlo: así toma su lugar en el layout
// antes de que el layout anterior suelte el suyo (ver hold).
const dismissed = ref(readDismissed());
const visible = computed(() => fullText.value !== '' && !dismissed.value);
const iconClass = computed(() => props.icon || (props.variant === 'warning' ? 'ri-error-warning-line' : 'ri-information-line'));
const hasLink = computed(() => (props.opensDetail ? props.steps.length > 0 : props.linkLabel.trim() !== ''));

// Mensaje nuevo: si el usuario no cerró este, sale de nuevo.
watch(fullText, () => {
    dismissed.value = readDismissed();
});

// ---------- Lugar en el layout ----------

const bar = ref(null);
let resizeObserver = null;
let holding = false;
let mounted = false;
let motionTimer = null;
// Entra deslizándose cuando aparece con la página abierta, no al cargarla.
const entering = ref(false);

function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Con la página abierta, el layout se mueve con una transición
// (styles/layout.css) mientras dure el atributo.
function animateLayout() {
    if (!mounted || props.placement !== 'top' || reducedMotion()) return;

    document.documentElement.setAttribute(MOTION_ATTR, '');
    window.clearTimeout(motionTimer);
    motionTimer = window.setTimeout(() => document.documentElement.removeAttribute(MOTION_ATTR), MOTION_MS);
}

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
    animateLayout();

    if (!isVisible) {
        release();
        return;
    }
    entering.value = mounted && !reducedMotion();
    hold();
    await nextTick();
    observe();
});

onMounted(() => {
    mounted = true;
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
    if (props.opensDetail) detailOpen.value = true;
    emit('open-detail');
}

// El temporizador de la transición sigue aunque se desmonte: es el que quita
// el atributo del <html>.
onUnmounted(release);
</script>

<template>
    <div
        v-if="visible"
        ref="bar"
        class="doma-announcement"
        :class="[`doma-announcement--${variant}`, `is-${placement}`, { 'is-start': align === 'start', 'is-entering': entering }]"
        role="status"
        @animationend="entering = false"
    >
        <p class="doma-announcement__text">
            <i class="doma-announcement__icon" :class="iconClass" aria-hidden="true"></i>
            <span class="doma-announcement__body">
                <span><strong v-if="label" class="doma-announcement__label">{{ label }}</strong>{{ label && message ? ' ' : '' }}{{ message }}</span>
                <button
                    v-if="hasLink"
                    type="button"
                    class="doma-announcement__link"
                    @click="openDetail"
                >
                    {{ linkLabel }}
                </button>
            </span>
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
        v-if="opensDetail"
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

/* Como las alertas de la plantilla con borde izquierdo (alert-warning
   alert-border-left): el amarillo suave con su borde, la letra del warning y
   una franja de 3 px en el warning a la izquierda (más abajo, después de
   is-inline, que pone todo el borde). Sigue el tema, claro u oscuro. */
.doma-announcement--alert {
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

.doma-announcement.is-top.is-entering {
    animation: domaAnnouncementIn 0.25s ease-out;
}

@keyframes domaAnnouncementIn {
    from {
        transform: translateY(-100%);
    }
}

.doma-announcement.is-inline {
    margin-bottom: 1rem;
    border: 1px solid var(--doma-announcement-line);
    border-radius: var(--doma-radius);
}

.doma-announcement.doma-announcement--alert {
    border-left: 3px solid var(--doma-warning);
}

/* El ícono y el texto (con el enlace al final) centrados en vertical entre sí
   y en la barra: el ícono es más alto que el texto y, alineado por la base,
   lo subía. Si el texto no cabe, se parte en líneas junto al ícono. */
.doma-announcement__text {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    margin: 0;
}

.doma-announcement__icon {
    flex: none;
    margin-right: 8px;
    font-size: 17px;
    line-height: 1;
}

.doma-announcement__body {
    min-width: 0;
    text-align: center;
    text-wrap: balance;
}

/* A la izquierda, con el ícono a la altura de la marca DOMA (la barra tiene
   20 px de margen). */
.doma-announcement.is-start {
    justify-content: flex-start;
    padding-left: 20px;
}

.doma-announcement.is-start .doma-announcement__text {
    justify-content: flex-start;
}

.doma-announcement.is-start .doma-announcement__body {
    text-align: left;
    text-wrap: pretty;
}

/* La franja de la alerta ocupa 3 px del margen: el ícono queda en su sitio. */
.doma-announcement--alert.is-start {
    padding-left: 17px;
}

.doma-announcement__label {
    font-weight: 600;
}

.doma-announcement__link {
    margin-left: 10px;
    white-space: nowrap;
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
        justify-content: flex-start;
    }

    .doma-announcement__body {
        text-align: left;
    }
}
</style>
