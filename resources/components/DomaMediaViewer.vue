<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import DomaVideoPlayer from './DomaVideoPlayer.vue';

/**
 * Visor multimedia a pantalla completa. Lo abre el detalle de una novedad
 * (DomaAnnouncementDetail) desde su escenario, y cualquier pantalla que lo
 * necesite:
 *
 *     <DomaMediaViewer :open="abierto" :items="medios" v-model:index="actual" @close="abierto = false" />
 *
 * Usa la pantalla completa del navegador; donde no se permite (iPhone), cubre
 * la ventana. Cada elemento es una imagen, un GIF o un video:
 *
 * - Video: el reproductor de DOMA (DomaVideoPlayer), con sus controles y sus
 *   atajos de teclado. Los controles se ocultan solos mientras se reproduce.
 * - Imagen: zoom con la rueda (centrado en el puntero), con el pellizco, con
 *   los botones o con doble clic; con zoom, se arrastra para moverla.
 *
 * Si el elemento trae `before`, un selector muestra el antes o el ahora. Las
 * flechas de los lados pasan de un elemento a otro sin salir. Un video arranca
 * en el segundo `startAt` del elemento, si lo trae; al cerrar, `close` lleva el
 * segundo en el que iba (`{ time }`), para seguir desde ahí.
 */
const props = defineProps({
    open: { type: Boolean, default: false },
    /** [{ title?, media: { src, type }, before?: { src, type }, startAt? }] */
    items: { type: Array, default: () => [] },
    /** Elemento que se muestra (v-model:index). */
    index: { type: Number, default: 0 },
    /** Rótulo del contador: "Paso 2 / 4". */
    itemLabel: { type: String, default: 'Paso' },
});

const emit = defineEmits(['close', 'update:index']);

const ZOOM_STEP = 1.5;
const MIN_MAX_ZOOM = 8;
const IDLE_MS = 2500;

const root = ref(null);
const stage = ref(null);
const image = ref(null);
const player = ref(null);

const entries = computed(() => props.items.filter((entry) => entry?.media?.src));
const visible = computed(() => props.open && entries.value.length > 0);

const current = ref(0);
// 'now' | 'before'
const side = ref('now');

const entry = computed(() => entries.value[current.value] ?? null);
const hasBefore = computed(() => Boolean(entry.value?.before?.src));
const media = computed(() => (side.value === 'before' && hasBefore.value ? entry.value.before : entry.value?.media) ?? null);
// Cambia con el elemento y con el lado: el <video> o la <img> se crean de nuevo.
const mediaKey = computed(() => `${current.value}-${side.value}-${media.value?.src ?? ''}`);

function isVideo(item) {
    return item?.type === 'video' || /\.(mp4|webm|ogv)(\?|$)/i.test(item?.src ?? '');
}

const showingVideo = computed(() => isVideo(media.value));

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function go(position) {
    if (position < 0 || position >= entries.value.length || position === current.value) return;

    current.value = position;
    side.value = 'now';
    playing.value = false;
    resetZoom();
    emit('update:index', position);
}

function setSide(value) {
    if (value === 'before' && !hasBefore.value) return;

    // El zoom se conserva: así se compara la misma zona del antes y del ahora.
    side.value = value;
    playing.value = false;
}

// ---------- Zoom de la imagen ----------

const scale = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
// Arrastre o pellizco en curso: sin transición, para que siga al dedo.
const moving = ref(false);
// Tamaño de la imagen ajustada a la pantalla y su tamaño real.
const fitted = ref({ width: 0, height: 0, naturalWidth: 0 });

const realScale = computed(() => (fitted.value.width && fitted.value.naturalWidth
    ? fitted.value.naturalWidth / fitted.value.width
    : 1));
const maxScale = computed(() => Math.max(MIN_MAX_ZOOM, realScale.value * 2));
// Porcentaje respecto al tamaño real, como en cualquier visor.
const zoomLabel = computed(() => `${Math.round((scale.value / realScale.value) * 100)} %`);
const zoomed = computed(() => scale.value > 1.001);

const imageStyle = computed(() => ({
    transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
}));

function measure() {
    const element = image.value;
    if (!element) return;

    fitted.value = {
        width: element.clientWidth,
        height: element.clientHeight,
        naturalWidth: element.naturalWidth,
    };

    const position = clampOffset(scale.value, offsetX.value, offsetY.value);
    offsetX.value = position.x;
    offsetY.value = position.y;
}

// La imagen no se aleja de la pantalla: con zoom, se mueve solo hasta su borde.
function clampOffset(value, x, y) {
    const box = stage.value?.getBoundingClientRect();
    if (!box) return { x, y };

    const maxX = Math.max(0, (fitted.value.width * value - box.width) / 2);
    const maxY = Math.max(0, (fitted.value.height * value - box.height) / 2);

    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
}

/**
 * Lleva el zoom a `value` dejando quieto el punto de la pantalla (clientX,
 * clientY); sin punto, el centro.
 */
function zoomTo(value, clientX, clientY) {
    const box = stage.value?.getBoundingClientRect();
    if (!box) return;

    const next = clamp(value, 1, maxScale.value);
    const ratio = next / scale.value;
    const pointX = (clientX ?? box.left + box.width / 2) - (box.left + box.width / 2);
    const pointY = (clientY ?? box.top + box.height / 2) - (box.top + box.height / 2);
    const position = clampOffset(
        next,
        pointX - ratio * (pointX - offsetX.value),
        pointY - ratio * (pointY - offsetY.value),
    );

    scale.value = next;
    offsetX.value = position.x;
    offsetY.value = position.y;
}

function zoomIn() {
    zoomTo(scale.value * ZOOM_STEP);
}

function zoomOut() {
    zoomTo(scale.value / ZOOM_STEP);
}

function resetZoom() {
    scale.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
}

function realSize() {
    zoomTo(realScale.value);
}

function onWheel(event) {
    event.preventDefault();
    // El pellizco del trackpad llega como rueda con Ctrl y pasos pequeños.
    const speed = event.ctrlKey ? 0.01 : 0.0015;
    zoomTo(scale.value * Math.exp(-event.deltaY * speed), event.clientX, event.clientY);
}

function onDoubleClick(event) {
    if (zoomed.value) resetZoom();
    else zoomTo(2, event.clientX, event.clientY);
}

const pointers = new Map();
let pinch = null;
let drag = null;

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function startDrag(x, y) {
    drag = zoomed.value ? { x, y, offsetX: offsetX.value, offsetY: offsetY.value } : null;
}

function onPointerDown(event) {
    if (event.button > 0) return;

    stage.value?.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { distance: distance(a, b) || 1, scale: scale.value };
        drag = null;
    } else if (pointers.size === 1) {
        startDrag(event.clientX, event.clientY);
    }

    moving.value = Boolean(pinch || drag);
}

function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        zoomTo(pinch.scale * (distance(a, b) / pinch.distance), (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (drag) {
        const position = clampOffset(
            scale.value,
            drag.offsetX + event.clientX - drag.x,
            drag.offsetY + event.clientY - drag.y,
        );
        offsetX.value = position.x;
        offsetY.value = position.y;
    }
}

function onPointerUp(event) {
    pointers.delete(event.pointerId);

    if (pointers.size < 2) pinch = null;

    // Si queda un dedo, sigue arrastrando desde donde está.
    if (pointers.size === 1) {
        const [remaining] = [...pointers.values()];
        startDrag(remaining.x, remaining.y);
    } else {
        drag = null;
    }

    moving.value = Boolean(pinch || drag);
}

// ---------- Video ----------

// Lo avisa el reproductor: con el video andando, los controles se ocultan.
const playing = ref(false);

// ---------- Controles que se ocultan ----------

const idle = ref(false);
let idleTimer = null;

function wake() {
    idle.value = false;
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
        idle.value = playing.value && showingVideo.value;
    }, IDLE_MS);
}

watch(playing, wake);

// ---------- Teclado ----------

function onKeydown(event) {
    const target = event.target;
    const onControl = ['BUTTON', 'SELECT', 'A'].includes(target?.tagName);
    const key = event.key;

    wake();

    if (key === 'Escape') {
        event.preventDefault();
        close();
        return;
    }

    // Con un video, las teclas son del reproductor (flechas incluidas).
    if (showingVideo.value) {
        player.value?.handleKey(event);
        return;
    }

    // Un botón maneja su propio Enter y espacio.
    if (onControl && (key === ' ' || key === 'Enter')) return;

    const actions = {
        ArrowLeft: () => go(current.value - 1),
        ArrowRight: () => go(current.value + 1),
        '+': () => zoomIn(),
        '=': () => zoomIn(),
        '-': () => zoomOut(),
        0: () => resetZoom(),
    };
    const action = actions[key];

    if (action) {
        event.preventDefault();
        action();
    }
}

// ---------- Pantalla completa ----------

let usingFullscreen = false;
let opener = null;
let active = false;

function fullscreenElement() {
    return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
}

async function enterFullscreen() {
    const element = root.value;
    const request = element?.requestFullscreen ?? element?.webkitRequestFullscreen;
    if (!request) return;

    try {
        await request.call(element);
        usingFullscreen = true;
    } catch {
        // Sin permiso o sin soporte: el visor ya cubre la ventana.
        usingFullscreen = false;
    }
}

function exitFullscreen() {
    if (fullscreenElement() && fullscreenElement() === root.value) {
        const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
        exit?.call(document)?.catch?.(() => {});
    }

    usingFullscreen = false;
}

// Esc en pantalla completa lo atiende el navegador: sale de ella sin avisar a
// la página. Si se salió así, se cierra el visor.
function onFullscreenChange() {
    if (usingFullscreen && !fullscreenElement()) {
        usingFullscreen = false;
        close();
    }
}

function onResize() {
    if (!showingVideo.value) measure();
}

function close() {
    emit('close', showingVideo.value ? { time: player.value?.time() ?? 0 } : {});
}

async function activate() {
    if (active) return;
    active = true;
    opener = document.activeElement;

    current.value = clamp(props.index, 0, entries.value.length - 1);
    side.value = 'now';
    playing.value = false;
    resetZoom();

    document.addEventListener('keydown', onKeydown);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    window.addEventListener('resize', onResize);

    await nextTick();
    root.value?.focus();
    enterFullscreen();
    wake();
}

function deactivate() {
    if (!active) return;
    active = false;

    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    window.removeEventListener('resize', onResize);
    window.clearTimeout(idleTimer);
    exitFullscreen();
    pointers.clear();
    pinch = null;
    drag = null;

    if (opener && opener !== document.body && opener.isConnected) {
        opener.focus?.();
    }
    opener = null;
}

watch(visible, (isVisible) => (isVisible ? activate() : deactivate()), { immediate: true });

watch(() => props.index, (value) => {
    if (visible.value) go(clamp(value, 0, entries.value.length - 1));
});

onBeforeUnmount(deactivate);
</script>

<template>
    <Teleport to="body">
        <div
            v-if="visible"
            ref="root"
            class="doma-viewer"
            :class="{ 'is-idle': idle }"
            role="dialog"
            aria-modal="true"
            aria-label="Visor multimedia"
            tabindex="-1"
            @pointermove="wake"
        >
            <header class="doma-viewer__top">
                <p class="doma-viewer__title">
                    <strong v-if="entry.title">{{ entry.title }}</strong>
                    <span v-if="entries.length > 1">{{ itemLabel }} {{ current + 1 }} / {{ entries.length }}</span>
                </p>

                <div v-if="hasBefore" class="doma-viewer__sides" role="group" aria-label="Versión">
                    <button
                        type="button"
                        :class="{ 'is-on': side === 'now' }"
                        :aria-pressed="side === 'now'"
                        @click="setSide('now')"
                    >
                        Ahora
                    </button>
                    <button
                        type="button"
                        :class="{ 'is-on': side === 'before' }"
                        :aria-pressed="side === 'before'"
                        @click="setSide('before')"
                    >
                        Antes
                    </button>
                </div>

                <button type="button" class="doma-viewer__btn" aria-label="Cerrar pantalla completa" title="Cerrar (Esc)" @click="close">
                    <i class="ri-close-line" aria-hidden="true"></i>
                </button>
            </header>

            <!-- Video: el reproductor ocupa el escenario y la barra de controles. -->
            <DomaVideoPlayer
                v-if="showingVideo"
                ref="player"
                :src="media.src"
                :start-at="Number(entry.startAt) || 0"
                autoplay
                :hide-controls="idle"
                class="doma-viewer__player"
                @play="playing = true"
                @pause="playing = false"
                @ended="playing = false"
            />

            <div
                v-else
                ref="stage"
                class="doma-viewer__stage"
                :class="{ 'is-zoomed': zoomed, 'is-moving': moving }"
                @wheel="onWheel"
                @dblclick="onDoubleClick"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp"
                @pointercancel="onPointerUp"
            >
                <img
                    ref="image"
                    :key="mediaKey"
                    :src="media.src"
                    :alt="entry.title || ''"
                    class="doma-viewer__image"
                    :style="imageStyle"
                    draggable="false"
                    @load="measure"
                />
            </div>

            <template v-if="entries.length > 1">
                <button
                    type="button"
                    class="doma-viewer__nav is-prev"
                    :disabled="current === 0"
                    :aria-label="`${itemLabel} anterior`"
                    @click="go(current - 1)"
                >
                    <i class="ri-arrow-left-s-line" aria-hidden="true"></i>
                </button>
                <button
                    type="button"
                    class="doma-viewer__nav is-next"
                    :disabled="current === entries.length - 1"
                    :aria-label="`${itemLabel} siguiente`"
                    @click="go(current + 1)"
                >
                    <i class="ri-arrow-right-s-line" aria-hidden="true"></i>
                </button>
            </template>

            <footer v-if="!showingVideo" class="doma-viewer__controls">
                <div class="doma-viewer__row is-image">
                    <button type="button" class="doma-viewer__btn" aria-label="Alejar" title="Alejar (-)" :disabled="!zoomed" @click="zoomOut">
                        <i class="ri-zoom-out-line" aria-hidden="true"></i>
                    </button>
                    <span class="doma-viewer__zoom" aria-live="polite">{{ zoomLabel }}</span>
                    <button
                        type="button"
                        class="doma-viewer__btn"
                        aria-label="Acercar"
                        title="Acercar (+)"
                        :disabled="scale >= maxScale"
                        @click="zoomIn"
                    >
                        <i class="ri-zoom-in-line" aria-hidden="true"></i>
                    </button>

                    <span class="doma-viewer__sep" aria-hidden="true"></span>

                    <button type="button" class="doma-viewer__btn is-text" title="Ajustar a pantalla (0)" :disabled="!zoomed" @click="resetZoom">
                        <i class="ri-aspect-ratio-line" aria-hidden="true"></i>
                        Ajustar
                    </button>
                    <button type="button" class="doma-viewer__btn is-text" title="Tamaño real" @click="realSize">
                        100 %
                    </button>
                    <a :href="media.src" class="doma-viewer__btn is-text" target="_blank" rel="noopener" title="Abrir original">
                        <i class="ri-external-link-line" aria-hidden="true"></i>
                        Original
                    </a>
                </div>
            </footer>
        </div>
    </Teleport>
</template>

<style scoped>
/* Fondo oscuro y texto claro en los dos temas, como cualquier visor; los dos
   colores salen del tema (tokens.css: --doma-viewer-*). */
.doma-viewer {
    position: fixed;
    inset: 0;
    z-index: 1070;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    background: var(--doma-viewer-bg);
    color: var(--doma-viewer-text);
    font-family: var(--doma-font);
    font-size: 0.875rem;
    outline: none;
    user-select: none;
    animation: domaViewerFade 0.15s ease-out;
}

.doma-viewer.is-idle {
    cursor: none;
}

.doma-viewer__top,
.doma-viewer__controls,
.doma-viewer__nav {
    transition: opacity 0.25s ease;
}

.doma-viewer.is-idle .doma-viewer__top,
.doma-viewer.is-idle .doma-viewer__controls,
.doma-viewer.is-idle .doma-viewer__nav {
    opacity: 0;
    pointer-events: none;
}

/* ---------- Encabezado ---------- */

.doma-viewer__top {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
}

.doma-viewer__title {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.75rem;
    min-width: 0;
    margin: 0;
}

.doma-viewer__title strong {
    overflow: hidden;
    font-size: 0.9375rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.doma-viewer__title span {
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
}

.doma-viewer__sides {
    display: inline-flex;
    flex: none;
    padding: 3px;
    border-radius: var(--doma-radius);
    background: var(--doma-viewer-control);
}

.doma-viewer__sides button {
    padding: 0.3rem 0.8rem;
    border: 0;
    border-radius: var(--doma-radius);
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
}

.doma-viewer__sides button.is-on {
    background: var(--doma-primary);
    color: var(--doma-on-primary);
}

/* ---------- Escenario ---------- */

.doma-viewer__stage {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 0;
    overflow: hidden;
    padding: 0 4.5rem;
    touch-action: none;
    cursor: zoom-in;
}

.doma-viewer__stage.is-zoomed {
    cursor: grab;
}

.doma-viewer__stage.is-zoomed.is-moving {
    cursor: grabbing;
}

.doma-viewer__image {
    display: block;
    max-width: 100%;
    max-height: 100%;
    transform-origin: center center;
    transition: transform 0.12s ease-out;
    pointer-events: none;
    will-change: transform;
}

.is-moving .doma-viewer__image {
    transition: none;
}

/* El reproductor ocupa el escenario y la fila de controles; el video deja
   sitio a las flechas de los lados, como la imagen. */
.doma-viewer__player {
    grid-row: 2 / -1;
    --doma-video-gutter: 4.5rem;
}

/* ---------- Anterior y siguiente ---------- */

.doma-viewer__nav {
    position: fixed;
    top: 50%;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--doma-viewer-control);
    color: inherit;
    font-size: 26px;
    cursor: pointer;
    transform: translateY(-50%);
}

.doma-viewer__nav.is-prev {
    left: 14px;
}

.doma-viewer__nav.is-next {
    right: 14px;
}

.doma-viewer__nav:disabled {
    opacity: 0.3;
    cursor: default;
}

/* ---------- Controles ---------- */

.doma-viewer__controls {
    display: grid;
    gap: 0.5rem;
    padding: 0.5rem 1rem 1rem;
}

.doma-viewer__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
}

.doma-viewer__row.is-image {
    justify-content: center;
}

.doma-viewer__grow {
    flex: 1;
}

.doma-viewer__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    min-width: 38px;
    height: 38px;
    padding: 0 0.5rem;
    border: 0;
    border-radius: var(--doma-radius);
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    text-decoration: none;
    cursor: pointer;
}

.doma-viewer__btn i {
    font-size: 20px;
}

.doma-viewer__btn.is-text {
    padding: 0 0.75rem;
    background: var(--doma-viewer-control);
}

.doma-viewer__btn.is-text i {
    font-size: 16px;
}

.doma-viewer__btn:hover:not(:disabled),
.doma-viewer__nav:hover:not(:disabled) {
    background: var(--doma-viewer-control-hover);
}

.doma-viewer__btn:disabled {
    opacity: 0.4;
    cursor: default;
}

.doma-viewer__zoom {
    min-width: 4.5em;
    padding: 0 0.375rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
    white-space: nowrap;
}

.doma-viewer__sep {
    width: 1px;
    height: 22px;
    margin: 0 0.375rem;
    background: var(--doma-viewer-control-hover);
}

.doma-viewer__btn:focus-visible,
.doma-viewer__nav:focus-visible,
.doma-viewer__sides button:focus-visible {
    outline: 2px solid var(--doma-primary);
    outline-offset: 2px;
}

@keyframes domaViewerFade {
    from {
        opacity: 0;
    }
}

@media (max-width: 640px) {
    .doma-viewer__stage {
        padding: 0;
    }

    .doma-viewer__player {
        --doma-video-gutter: 0px;
    }

    .doma-viewer__nav {
        top: auto;
        bottom: 96px;
        transform: none;
    }
}

@media (prefers-reduced-motion: reduce) {
    .doma-viewer,
    .doma-viewer__image {
        animation: none;
        transition: none;
    }
}
</style>
