<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import DomaMediaViewer from './DomaMediaViewer.vue';
import DomaVideoPlayer from './DomaVideoPlayer.vue';

/**
 * Detalle de una novedad DOMA: el modal que muestra qué cambió, paso a paso.
 * Lo abren el Centro Novedades de la barra (DomaNavBar) y el aviso
 * (DomaAnnouncement), y cualquier pantalla que lo necesite:
 *
 *     <DomaAnnouncementDetail :open="abierto" :announcement="novedad" is-new @close="abierto = false" />
 *
 * Ocupa el 64 % del ancho y el 88 % del alto de la ventana (toda en un
 * celular). Arriba, el título y la fecha de aplicación. En el cuerpo, la
 * barra de progreso de los pasos y el medio del paso llenan todo el alto
 * visible; debajo, a los que se llega desplazándose, el resumen y los pasos.
 *
 * Cada paso tiene su medio: una imagen o un GIF, que se puede comparar con la
 * captura de antes (`before`) con un divisor que se arrastra, o un video, que
 * va solo (sin antes), se maneja con sus controles y no se repite: el paso
 * dura lo que dura el video. Los pasos avanzan solos, se pueden pausar,
 * repetir o elegir; las flechas del teclado pasan de uno a otro. El botón
 * "Pantalla completa" del escenario, o el doble clic sobre él, abre el medio en
 * el visor (DomaMediaViewer).
 */
const props = defineProps({
    open: { type: Boolean, default: false },
    /**
     * { title, summary?, date?, steps?: [{ label?, title, text?, media: { src, type },
     *   before?: { src, type }, seconds? }], action?: { label, url } }. Sin pasos
     * muestra solo la fecha, el resumen y el botón (p. ej. un mantenimiento).
     */
    announcement: { type: Object, default: null },
    /** Punto rojo junto al título: el usuario no la había visto. */
    isNew: { type: Boolean, default: false },
    /** Los pasos avanzan solos. */
    autoplay: { type: Boolean, default: true },
    /**
     * Novedades que se muestran una tras otra (las invasivas al entrar):
     * { position, total }. Con más de una, el encabezado dice "1 de 3".
     */
    queue: { type: Object, default: null },
});

const emit = defineEmits(['close']);

const DEFAULT_SECONDS = 6;
const REVEAL_DELAY = 700;
const REVEAL_DURATION = 1200;
const REVEAL_TARGET = 50;

const dialog = ref(null);
const body = ref(null);
const stage = ref(null);
const player = ref(null);
const titleId = `doma-novelty-title-${Math.random().toString(36).slice(2, 8)}`;

const visible = computed(() => props.open && Boolean(props.announcement));
const queueLabel = computed(() => (props.queue?.total > 1 ? `${props.queue.position} de ${props.queue.total}` : ''));
const steps = computed(() => (Array.isArray(props.announcement?.steps) ? props.announcement.steps : []));
const action = computed(() => (props.announcement?.action?.url ? props.announcement.action : null));

// "Aplica el 15 de octubre de 2026" (date en AAAA-MM-DD).
const DATE_FORMAT = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const appliesOn = computed(() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(props.announcement?.date ?? ''));

    return match ? DATE_FORMAT.format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : '';
});

const index = ref(0);
// Cambia cada vez que se entra a un paso: el medio se crea de nuevo y un video
// arranca desde el principio, aunque sea el mismo paso (Repetir).
const run = ref(0);
const step = computed(() => steps.value[index.value] ?? null);
const isLast = computed(() => index.value >= steps.value.length - 1);

function isVideo(media) {
    return media?.type === 'video' || /\.(mp4|webm|ogv)(\?|$)/i.test(media?.src ?? '');
}

const isVideoStep = computed(() => isVideo(step.value?.media));

// Antes y ahora se comparan solo entre imágenes: un paso con video va solo.
function hasCompare(item) {
    return Boolean(item?.before?.src) && !isVideo(item.media) && !isVideo(item.before);
}

const compare = computed(() => hasCompare(step.value));

// ---------- Antes y ahora ----------

// Porcentaje de la captura de ahora que se ve, desde la izquierda.
const reveal = ref(100);
const dragging = ref(false);
let revealTimer = null;
let revealFrame = null;

function stopReveal() {
    window.clearTimeout(revealTimer);
    if (revealFrame !== null) window.cancelAnimationFrame(revealFrame);
    revealTimer = null;
    revealFrame = null;
}

// Al llegar a un paso con captura de antes: se ve el antes y el divisor corre
// hasta la mitad, para comparar.
function startReveal() {
    stopReveal();

    if (!compare.value) {
        reveal.value = 100;
        return;
    }

    reveal.value = 0;

    if (reducedMotion()) {
        reveal.value = REVEAL_TARGET;
        return;
    }

    revealTimer = window.setTimeout(() => {
        const start = performance.now();

        const animate = (now) => {
            const t = Math.min(1, (now - start) / REVEAL_DURATION);
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            reveal.value = eased * REVEAL_TARGET;
            revealFrame = t < 1 ? window.requestAnimationFrame(animate) : null;
        };

        revealFrame = window.requestAnimationFrame(animate);
    }, REVEAL_DELAY);
}

function revealAt(clientX) {
    const box = stage.value?.getBoundingClientRect();
    if (!box?.width) return;

    reveal.value = Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100));
}

function onPointerDown(event) {
    if (!compare.value || event.target.closest?.('.doma-novelty__expand')) return;

    stopReveal();
    dragging.value = true;
    paused.value = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    revealAt(event.clientX);
}

function onPointerMove(event) {
    if (dragging.value) revealAt(event.clientX);
}

function onPointerUp() {
    dragging.value = false;
}

function onKnobKeydown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    event.preventDefault();
    event.stopPropagation();
    stopReveal();
    paused.value = true;
    reveal.value = Math.min(100, Math.max(0, reveal.value + (event.key === 'ArrowRight' ? 5 : -5)));
}

// ---------- Avance de los pasos ----------

// Pausa de toda la novedad: detiene el reloj de los pasos y el video.
const paused = ref(false);
const elapsed = ref(0);
// Un paso con video avanza con el video, no con el reloj.
const videoProgress = ref(0);
const videoEnded = ref(false);
// El video arranca con sonido (si el navegador no lo deja, el reproductor
// arranca en silencio y avisa); si el usuario lo silencia o cambia la
// velocidad, los siguientes videos lo conservan.
const videoMuted = ref(false);
const videoRate = ref(1);
// Segundo en el que arranca el video del paso (al volver del visor).
const videoStartAt = ref(0);
let frame = null;
let lastTick = 0;

const duration = computed(() => Math.max(1, Number(step.value?.seconds) || DEFAULT_SECONDS) * 1000);
const progress = computed(() => (isVideoStep.value
    ? videoProgress.value * 100
    : Math.min(100, (elapsed.value / duration.value) * 100)));
const finished = computed(() => isLast.value && (isVideoStep.value ? videoEnded.value : elapsed.value >= duration.value));

// Relleno de cada tramo de la barra: los pasos vistos llenos, el actual según
// lo que lleva y los que siguen vacíos.
function segmentFill(position) {
    if (position < index.value) return 100;
    if (position > index.value) return 0;

    return progress.value;
}

function tick(now) {
    frame = window.requestAnimationFrame(tick);

    const delta = lastTick ? now - lastTick : 0;
    lastTick = now;

    if (isVideoStep.value) {
        videoProgress.value = player.value?.progress() ?? 0;
        return;
    }

    if (paused.value || dragging.value || finished.value) return;

    elapsed.value += delta;

    if (elapsed.value >= duration.value) {
        if (isLast.value) {
            elapsed.value = duration.value;
        } else {
            go(index.value + 1);
        }
    }
}

function startClock() {
    stopClock();
    lastTick = 0;
    frame = window.requestAnimationFrame(tick);
}

function stopClock() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
}

function go(position) {
    if (position < 0 || position >= steps.value.length) return;

    index.value = position;
    run.value += 1;
    elapsed.value = 0;
    videoProgress.value = 0;
    videoEnded.value = false;
    videoStartAt.value = 0;
    startReveal();
}

function next() {
    go(index.value + 1);
}

function prev() {
    go(index.value - 1);
}

function replay() {
    paused.value = false;
    go(0);
}

function togglePause() {
    if (finished.value) {
        replay();
        return;
    }

    paused.value = !paused.value;
}

// El video sigue la pausa de la novedad (Pausar, Reanudar, abrir el visor)...
watch(paused, (value) => {
    if (!isVideoStep.value) return;

    if (value) player.value?.pause();
    else player.value?.play();
}, { flush: 'post' });

// ...y la novedad, los controles del video.
function onVideoPlay() {
    paused.value = false;
    videoEnded.value = false;
}

function onVideoPause() {
    paused.value = true;
}

// El paso de un video termina cuando termina el video.
function onVideoEnded() {
    if (isLast.value) videoEnded.value = true;
    else go(index.value + 1);
}

// ---------- Pantalla completa ----------

// Los pasos que tienen medio, en el formato del visor. El video del paso que
// se ve arranca en el segundo en el que va.
const viewerFrom = ref({ position: -1, time: 0 });
const viewerItems = computed(() => steps.value
    .map((item, position) => ({
        position,
        title: item.title,
        media: item.media,
        before: hasCompare(item) ? item.before : null,
        startAt: position === viewerFrom.value.position ? viewerFrom.value.time : 0,
    }))
    .filter((item) => item.media?.src));
const viewerOpen = ref(false);
const viewerIndex = ref(0);

// Abrir el visor pausa la novedad; al volver, sigue en pausa hasta que el
// usuario pulse "Reanudar".
function openViewer() {
    const position = viewerItems.value.findIndex((item) => item.position === index.value);
    if (position === -1) return;

    stopReveal();
    viewerFrom.value = { position: index.value, time: isVideoStep.value ? player.value?.time() ?? 0 : 0 };
    paused.value = true;
    viewerIndex.value = position;
    viewerOpen.value = true;
}

// El doble clic sobre los controles del video no abre el visor.
function onStageDblclick(event) {
    if (event.target.closest?.('button, input, select, label')) return;

    openViewer();
}

// Al cerrar, el detalle queda en el paso que se estaba viendo en el visor y,
// si es un video, en el segundo en el que iba.
function closeViewer(state) {
    viewerOpen.value = false;
    const target = viewerItems.value[viewerIndex.value]?.position;
    if (target === undefined) return;

    const time = Number(state?.time) || 0;

    if (target !== index.value) {
        go(target);
        videoStartAt.value = time;
    } else if (isVideoStep.value) {
        player.value?.seekTo(time);
    }
}

// ---------- Abrir y cerrar ----------

let opener = null;
let previousOverflow = '';
let active = false;
// Solo cierra el clic que empieza y termina fuera del modal: soltar fuera un
// arrastre (el divisor, la línea de tiempo) no lo cierra.
let pressedOutside = false;

function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function close() {
    emit('close');
}

function onBackdropPointerDown(event) {
    pressedOutside = event.target === event.currentTarget;
}

function onBackdropClick(event) {
    if (pressedOutside && event.target === event.currentTarget) close();
    pressedOutside = false;
}

function onKeydown(event) {
    // Con el visor abierto, el teclado es suyo (Esc lo cierra solo a él).
    if (viewerOpen.value) return;

    const key = event.key;
    // Los campos (la línea de tiempo, el volumen, la velocidad) manejan sus
    // propias flechas.
    const onField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName);

    if (key === 'Escape') close();
    else if (key.startsWith('Arrow') && onField) return;
    else if (key === 'ArrowRight') next();
    else if (key === 'ArrowLeft') prev();
    else if (isVideoStep.value) player.value?.handleKey(event, { arrows: false });
}

function resetVideo() {
    videoMuted.value = false;
    videoRate.value = 1;
}

async function activate() {
    if (active) return;
    active = true;
    opener = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeydown);

    resetVideo();
    paused.value = !props.autoplay || reducedMotion();
    go(0);
    startClock();

    await nextTick();
    dialog.value?.focus();
}

function deactivate() {
    if (!active) return;
    active = false;
    viewerOpen.value = false;
    stopClock();
    stopReveal();
    document.body.style.overflow = previousOverflow;
    document.removeEventListener('keydown', onKeydown);

    // Vuelve el foco a lo que abrió el detalle, si sigue en la página (el ítem
    // de un menú que ya se cerró no lo está: ahí lo devuelve quien lo abrió).
    if (opener && opener !== document.body && opener.isConnected) {
        opener.focus?.();
    }
    opener = null;
}

watch(visible, (isVisible) => (isVisible ? activate() : deactivate()), { immediate: true });

// Pasa a otra novedad sin cerrarse (la siguiente de la cola): arranca desde su
// primer paso, arriba.
watch(() => props.announcement, (value, previous) => {
    if (!visible.value || value === previous) return;

    viewerOpen.value = false;
    paused.value = !props.autoplay || reducedMotion();
    go(0);
    body.value?.scrollTo?.(0, 0);
    dialog.value?.focus();
});

onBeforeUnmount(deactivate);
</script>

<template>
    <Teleport to="body">
        <div
            v-if="visible"
            class="doma-novelty"
            @pointerdown="onBackdropPointerDown"
            @click="onBackdropClick"
        >
            <div
                ref="dialog"
                class="doma-novelty__dialog"
                :class="{ 'has-stage': step }"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="titleId"
                tabindex="-1"
            >
                <header class="doma-novelty__header">
                    <h2 :id="titleId" class="doma-novelty__title">
                        <span v-if="isNew" class="doma-novelty__dot" aria-hidden="true"></span>
                        <span v-if="isNew" class="doma-novelty__sr-only">Sin ver.</span>
                        <span>{{ announcement.title }}</span>
                        <span v-if="appliesOn" class="doma-novelty__applies">– Aplica el {{ appliesOn }}</span>
                        <span v-if="queueLabel" class="doma-novelty__count">{{ queueLabel }}</span>
                    </h2>
                    <button type="button" class="doma-novelty__close" aria-label="Cerrar" @click="close">
                        <i class="ri-close-line" aria-hidden="true"></i>
                    </button>
                </header>

                <div ref="body" class="doma-novelty__body">
                    <div v-if="step" class="doma-novelty__screen">
                        <div class="doma-novelty__progress" aria-hidden="true">
                            <span v-for="(item, position) in steps" :key="position">
                                <i :style="{ width: `${segmentFill(position)}%` }"></i>
                            </span>
                        </div>

                        <div
                            ref="stage"
                            class="doma-novelty__stage"
                            :class="{ 'is-compare': compare, 'is-dragging': dragging, 'is-video': isVideoStep }"
                            :style="{ '--doma-novelty-reveal': `${reveal}%` }"
                            @pointerdown="onPointerDown"
                            @pointermove="onPointerMove"
                            @pointerup="onPointerUp"
                            @pointercancel="onPointerUp"
                            @dblclick="onStageDblclick"
                        >
                            <DomaVideoPlayer
                                v-if="isVideoStep"
                                ref="player"
                                :key="`video-${run}`"
                                :src="step.media.src"
                                :autoplay="!paused"
                                :start-at="videoStartAt"
                                v-model:muted="videoMuted"
                                v-model:rate="videoRate"
                                overlay
                                class="doma-novelty__video"
                                @play="onVideoPlay"
                                @pause="onVideoPause"
                                @ended="onVideoEnded"
                            />

                            <template v-else>
                                <div v-if="compare" class="doma-novelty__layer">
                                    <img :key="`antes-${run}`" :src="step.before.src" alt="" draggable="false" />
                                </div>

                                <div class="doma-novelty__layer is-now">
                                    <img :key="`ahora-${run}`" :src="step.media?.src" :alt="step.title" draggable="false" />
                                </div>

                                <template v-if="compare">
                                    <div class="doma-novelty__divider">
                                        <span
                                            class="doma-novelty__knob"
                                            role="slider"
                                            tabindex="0"
                                            aria-label="Comparar antes y ahora"
                                            aria-valuemin="0"
                                            aria-valuemax="100"
                                            :aria-valuenow="Math.round(reveal)"
                                            @keydown="onKnobKeydown"
                                        >
                                            <i class="ri-arrow-left-right-line" aria-hidden="true"></i>
                                        </span>
                                    </div>
                                    <span class="doma-novelty__tag is-now">Ahora</span>
                                    <span class="doma-novelty__tag is-before">Antes</span>
                                </template>
                            </template>

                            <button
                                v-if="step.media?.src"
                                type="button"
                                class="doma-novelty__expand"
                                title="Pantalla completa"
                                @click="openViewer"
                            >
                                <i class="ri-fullscreen-line" aria-hidden="true"></i>
                                <span>Pantalla completa</span>
                            </button>
                        </div>
                    </div>

                    <p v-if="announcement.summary" class="doma-novelty__intro">{{ announcement.summary }}</p>

                    <template v-if="step">
                        <div v-if="steps.length > 1" class="doma-novelty__chips" role="tablist" aria-label="Pasos">
                            <button
                                v-for="(item, position) in steps"
                                :key="position"
                                type="button"
                                class="doma-novelty__chip"
                                :class="{ 'is-on': position === index, 'is-done': position < index }"
                                role="tab"
                                :aria-selected="position === index"
                                @click="go(position)"
                            >
                                <span class="doma-novelty__chip-n">{{ position + 1 }}</span>
                                <span class="doma-novelty__chip-label">{{ item.label || item.title }}</span>
                            </button>
                        </div>

                        <div :key="index" class="doma-novelty__caption" aria-live="polite">
                            <h3>{{ step.title }}</h3>
                            <p v-if="step.text">{{ step.text }}</p>
                        </div>
                    </template>
                </div>

                <footer class="doma-novelty__footer">
                    <template v-if="steps.length">
                        <button type="button" class="doma-novelty__btn is-ghost" @click="replay">
                            <i class="ri-restart-line" aria-hidden="true"></i>
                            Repetir
                        </button>
                        <button type="button" class="doma-novelty__btn is-ghost" @click="togglePause">
                            <i :class="paused || finished ? 'ri-play-line' : 'ri-pause-line'" aria-hidden="true"></i>
                            {{ paused || finished ? 'Reanudar' : 'Pausar' }}
                        </button>
                    </template>

                    <span class="doma-novelty__grow"></span>

                    <button type="button" class="doma-novelty__btn is-light" @click="close">Entendido</button>
                    <a v-if="action" :href="action.url" class="doma-novelty__btn is-primary" @click="close">
                        {{ action.label || 'Ver ahora' }}
                    </a>
                </footer>
            </div>
        </div>
    </Teleport>

    <DomaMediaViewer
        v-model:index="viewerIndex"
        :open="visible && viewerOpen"
        :items="viewerItems"
        @close="closeViewer"
    />
</template>

<style scoped>
/* Centrado sobre el fondo oscuro, al 64 % del ancho y el 88 % del alto de la
   ventana: con esa proporción, un medio 16:9 llena casi todo el escenario.
   Con los tokens de DOMA: encabezado arriba, pie abajo y, en medio, el
   contenido, que se desplaza solo si no cabe. Sin pasos (solo texto), el alto
   se ajusta al contenido. El tamaño se puede cambiar con --doma-novelty-width
   y --doma-novelty-height. */
.doma-novelty {
    position: fixed;
    inset: 0;
    z-index: 1060;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: var(--doma-backdrop);
    font-family: var(--doma-font);
    animation: domaNoveltyFade 0.15s ease-out;
}

.doma-novelty__dialog {
    display: flex;
    flex-direction: column;
    width: var(--doma-novelty-width, 64vw);
    min-width: min(720px, 100%);
    max-width: 100%;
    max-height: 100%;
    overflow: hidden;
    border-radius: var(--doma-radius-lg);
    background: var(--doma-surface);
    color: var(--doma-text);
    font-size: 0.875rem;
    line-height: 1.5;
    box-shadow: var(--doma-shadow-menu);
    outline: none;
    animation: domaNoveltyIn 0.25s ease-out;
}

/* Con pasos, alto fijo: el medio crece hasta llenar lo que queda libre. */
.doma-novelty__dialog.has-stage {
    height: var(--doma-novelty-height, 88vh);
    min-height: min(560px, 100%);
}

.doma-novelty__header {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--doma-border);
    background: var(--doma-surface-muted);
}

.doma-novelty__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
    margin: 0;
    color: var(--doma-heading);
    font-size: 1.09375rem;
    font-weight: 600;
    line-height: 1.5;
}

/* "– Aplica el 12 de noviembre de 2026", junto al título. */
.doma-novelty__applies {
    color: var(--doma-muted);
    font-size: 0.9375rem;
    font-weight: 400;
}

/* Posición en la cola de novedades que se abren una tras otra: "1 de 3". */
.doma-novelty__count {
    padding: 0.25em 0.6em;
    border-radius: var(--doma-radius);
    background: var(--doma-primary-soft);
    color: var(--doma-primary-ink);
    font-size: 0.75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

/* Sin ver: el mismo punto rojo del Centro Novedades. */
.doma-novelty__dot {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--doma-danger);
}

.doma-novelty__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
}

.doma-novelty__close {
    display: inline-grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: var(--doma-radius);
    background: transparent;
    color: var(--doma-text);
    font-size: 20px;
    opacity: 0.5;
    cursor: pointer;
}

.doma-novelty__close:hover {
    opacity: 0.75;
}

.doma-novelty__body {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    padding: 1.25rem;
}

.doma-novelty__body > * {
    flex: none;
}

/* Resumen de la novedad, debajo del medio. */
.doma-novelty__intro {
    max-width: 80ch;
    margin: 0;
    color: var(--doma-muted);
    white-space: pre-line;
}

.doma-novelty__screen + .doma-novelty__intro {
    margin-top: 1rem;
}

/* ---------- Progreso de los pasos ---------- */

/* Un tramo por paso, arriba del medio: los vistos llenos, el actual según lo
   que lleva (o lo que lleva el video) y los que siguen vacíos. */
.doma-novelty__progress {
    display: flex;
    gap: 4px;
    margin-bottom: 0.75rem;
}

.doma-novelty__progress span {
    flex: 1;
    height: 5px;
    overflow: hidden;
    border-radius: var(--doma-radius);
    background: var(--doma-primary-soft);
}

.doma-novelty__progress i {
    display: block;
    height: 100%;
    background: var(--doma-primary);
}

/* ---------- Escenario ---------- */

/* El medio es lo que más espacio ocupa: la barra y el escenario llenan todo
   el alto visible del cuerpo, y la imagen o el video se ajustan a él sin
   recortarse. El resumen y los pasos quedan debajo; el cuerpo se desplaza
   hasta ellos. En una pantalla baja no se achica de 260 px. */
.doma-novelty__screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 260px;
}

.doma-novelty__screen > .doma-novelty__stage {
    flex: 1 1 0;
}

.doma-novelty__stage {
    position: relative;
    width: 100%;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--doma-border);
    border-radius: var(--doma-radius-lg);
    background: var(--doma-surface-muted);
    user-select: none;
    touch-action: pan-y;
}

.doma-novelty__stage.is-video {
    border-color: transparent;
    background: var(--doma-viewer-bg);
}

.doma-novelty__video {
    position: absolute;
    inset: 0;
}

.doma-novelty__stage.is-compare {
    cursor: ew-resize;
}

.doma-novelty__layer {
    position: absolute;
    inset: 0;
}

.doma-novelty__layer img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
}

/* La captura de ahora se ve desde la izquierda hasta el divisor. */
.is-compare .doma-novelty__layer.is-now {
    clip-path: inset(0 calc(100% - var(--doma-novelty-reveal, 100%)) 0 0);
}

.doma-novelty__divider {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--doma-novelty-reveal, 100%);
    width: 3px;
    margin-left: -1.5px;
    background: var(--doma-primary);
    box-shadow: 0 0 14px rgba(var(--doma-primary-rgb), 0.6);
}

.doma-novelty__knob {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--doma-primary);
    color: var(--doma-on-primary);
    font-size: 18px;
    box-shadow: 0 5px 10px rgba(30, 32, 37, 0.25);
    transform: translate(-50%, -50%);
    cursor: ew-resize;
}

/* Abre el medio en el visor a pantalla completa. */
.doma-novelty__expand {
    position: absolute;
    top: 12px;
    right: 12px;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    border: 0;
    border-radius: var(--doma-radius);
    background: var(--doma-backdrop);
    color: var(--doma-on-primary);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.2;
    opacity: 0.85;
    cursor: pointer;
    transition: opacity 0.15s;
}

.doma-novelty__expand i {
    font-size: 16px;
}

.doma-novelty__expand:hover {
    opacity: 1;
}

.doma-novelty__tag {
    position: absolute;
    bottom: 12px;
    padding: 0.35em 0.65em;
    border-radius: var(--doma-radius);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1;
    pointer-events: none;
}

.doma-novelty__tag.is-now {
    left: 12px;
    background: var(--doma-primary);
}

.doma-novelty__tag.is-before {
    right: 12px;
    background: #212529;
}

/* ---------- Pasos ---------- */

.doma-novelty__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 1rem;
}

.doma-novelty__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.3125rem 0.625rem 0.3125rem 0.375rem;
    border: 0;
    border-radius: var(--doma-radius);
    background: var(--doma-surface-muted);
    color: var(--doma-muted);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
}

.doma-novelty__chip:hover {
    color: var(--doma-heading);
}

.doma-novelty__chip-n {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: var(--doma-radius);
    background: var(--doma-surface);
    color: var(--doma-heading);
    font-size: 0.6875rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.doma-novelty__chip.is-done {
    color: var(--doma-primary-ink);
}

.doma-novelty__chip.is-done .doma-novelty__chip-n {
    background: var(--doma-primary-soft);
    color: var(--doma-primary-ink);
}

.doma-novelty__chip.is-on {
    background: var(--doma-primary);
    color: var(--doma-on-primary);
}

.doma-novelty__chip.is-on .doma-novelty__chip-n {
    background: rgba(255, 255, 255, 0.22);
    color: var(--doma-on-primary);
}

.doma-novelty__caption {
    min-height: 78px;
    margin-top: 1rem;
    animation: domaNoveltyCaption 0.45s ease;
}

.doma-novelty__caption h3 {
    margin: 0 0 0.25rem;
    color: var(--doma-heading);
    font-size: 0.9375rem;
    font-weight: 600;
}

.doma-novelty__caption p {
    max-width: 80ch;
    margin: 0;
}

/* ---------- Pie ---------- */

.doma-novelty__footer {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--doma-border);
}

.doma-novelty__grow {
    flex: 1;
}

.doma-novelty__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem 0.9rem;
    border: 1px solid transparent;
    border-radius: var(--doma-radius);
    background: transparent;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.5;
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    transition: color 0.15s, background-color 0.15s, border-color 0.15s;
}

.doma-novelty__btn i {
    font-size: 15px;
}

.doma-novelty__btn.is-ghost {
    color: var(--doma-muted);
}

.doma-novelty__btn.is-ghost:hover {
    background: rgba(135, 138, 153, 0.12);
    color: var(--doma-heading);
}

.doma-novelty__btn.is-light {
    border-color: var(--doma-surface-muted);
    background: var(--doma-surface-muted);
    color: var(--doma-text);
}

.doma-novelty__btn.is-light:hover {
    border-color: var(--doma-border);
    background: var(--doma-border);
}

.doma-novelty__btn.is-primary {
    border-color: var(--doma-primary);
    background: var(--doma-primary);
    color: var(--doma-on-primary);
}

.doma-novelty__btn.is-primary:hover {
    filter: brightness(0.92);
}

.doma-novelty__close:focus-visible,
.doma-novelty__btn:focus-visible,
.doma-novelty__chip:focus-visible,
.doma-novelty__knob:focus-visible,
.doma-novelty__expand:focus-visible {
    outline: 2px solid var(--doma-primary);
    outline-offset: 2px;
}

@keyframes domaNoveltyFade {
    from {
        opacity: 0;
    }
}

@keyframes domaNoveltyIn {
    from {
        opacity: 0;
        transform: scale(0.985);
    }
}

@keyframes domaNoveltyCaption {
    from {
        opacity: 0;
        transform: translateY(4px);
    }
}

/* En un celular o una tableta angosta ocupa toda la pantalla. */
@media (max-width: 768px) {
    .doma-novelty {
        padding: 0;
    }

    .doma-novelty__dialog,
    .doma-novelty__dialog.has-stage {
        width: 100vw;
        min-width: 0;
        height: 100vh;
        height: 100dvh;
        min-height: 0;
        border-radius: 0;
    }
}

@media (max-width: 640px) {
    .doma-novelty__header,
    .doma-novelty__body {
        padding: 1rem;
    }

    .doma-novelty__footer {
        padding: 0.75rem 1rem;
    }

    .doma-novelty__screen {
        min-height: 220px;
    }

    .doma-novelty__expand span {
        display: none;
    }

    .doma-novelty__grow {
        flex-basis: 100%;
        height: 0;
    }

    .doma-novelty__btn.is-light,
    .doma-novelty__btn.is-primary {
        flex: 1;
    }

    .doma-novelty__chip-label {
        display: none;
    }

    .doma-novelty__chip {
        padding-right: 0.375rem;
    }
}

@media (prefers-reduced-motion: reduce) {
    .doma-novelty,
    .doma-novelty__dialog,
    .doma-novelty__caption {
        animation: none;
    }
}
</style>
