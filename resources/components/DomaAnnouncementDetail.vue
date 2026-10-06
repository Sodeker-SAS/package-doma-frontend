<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

/**
 * Detalle de una novedad DOMA: el modal que muestra qué cambió, paso a paso.
 * Lo abren el Centro Novedades de la barra (DomaNavBar) y el aviso
 * (DomaAnnouncement), y cualquier pantalla que lo necesite:
 *
 *     <DomaAnnouncementDetail :open="abierto" :announcement="novedad" is-new @close="abierto = false" />
 *
 * Cada paso tiene su medio (imagen, GIF o video) y, si trae `before`, la
 * captura de antes: el escenario la compara con la de ahora con un divisor que
 * se arrastra. Los pasos avanzan solos (barra de progreso), se pueden pausar,
 * repetir o elegir; las flechas del teclado pasan de uno a otro.
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
});

const emit = defineEmits(['close']);

const DEFAULT_SECONDS = 6;
const REVEAL_DELAY = 700;
const REVEAL_DURATION = 1200;
const REVEAL_TARGET = 50;

const dialog = ref(null);
const stage = ref(null);
const titleId = `doma-novelty-title-${Math.random().toString(36).slice(2, 8)}`;

const visible = computed(() => props.open && Boolean(props.announcement));
const steps = computed(() => (Array.isArray(props.announcement?.steps) ? props.announcement.steps : []));
const action = computed(() => (props.announcement?.action?.url ? props.announcement.action : null));

// "Aplica el 15 de octubre de 2026" (date en AAAA-MM-DD).
const DATE_FORMAT = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const appliesOn = computed(() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(props.announcement?.date ?? ''));

    return match ? DATE_FORMAT.format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : '';
});

const index = ref(0);
const step = computed(() => steps.value[index.value] ?? null);
const isLast = computed(() => index.value >= steps.value.length - 1);

function isVideo(media) {
    return media?.type === 'video' || /\.(mp4|webm|ogv)(\?|$)/i.test(media?.src ?? '');
}

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

    if (!step.value?.before) {
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
    if (!step.value?.before) return;

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

const paused = ref(false);
const elapsed = ref(0);
let frame = null;
let lastTick = 0;

const duration = computed(() => Math.max(1, Number(step.value?.seconds) || DEFAULT_SECONDS) * 1000);
const progress = computed(() => Math.min(100, (elapsed.value / duration.value) * 100));
const finished = computed(() => isLast.value && elapsed.value >= duration.value);

function tick(now) {
    frame = window.requestAnimationFrame(tick);

    const delta = lastTick ? now - lastTick : 0;
    lastTick = now;

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
    elapsed.value = 0;
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

// ---------- Abrir y cerrar ----------

let opener = null;
let previousOverflow = '';
let active = false;

function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function close() {
    emit('close');
}

function onKeydown(event) {
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowRight') next();
    else if (event.key === 'ArrowLeft') prev();
}

async function activate() {
    if (active) return;
    active = true;
    opener = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeydown);

    paused.value = !props.autoplay || reducedMotion();
    go(0);
    startClock();

    await nextTick();
    dialog.value?.focus();
}

function deactivate() {
    if (!active) return;
    active = false;
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

onBeforeUnmount(deactivate);
</script>

<template>
    <Teleport to="body">
        <div v-if="visible" class="doma-novelty" @click.self="close">
            <div
                ref="dialog"
                class="doma-novelty__dialog"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="titleId"
                tabindex="-1"
            >
                <header class="doma-novelty__header">
                    <h2 :id="titleId" class="doma-novelty__title">
                        <span v-if="isNew" class="doma-novelty__dot" aria-hidden="true"></span>
                        <span v-if="isNew" class="doma-novelty__sr-only">Sin ver.</span>
                        {{ announcement.title }}
                    </h2>
                    <button type="button" class="doma-novelty__close" aria-label="Cerrar" @click="close">
                        <i class="ri-close-line" aria-hidden="true"></i>
                    </button>
                </header>

                <div class="doma-novelty__body">
                    <p v-if="appliesOn" class="doma-novelty__meta">
                        <i class="ri-calendar-event-line" aria-hidden="true"></i>
                        Aplica el {{ appliesOn }}
                    </p>
                    <p v-if="announcement.summary" class="doma-novelty__intro">{{ announcement.summary }}</p>

                    <template v-if="step">
                        <div
                            ref="stage"
                            class="doma-novelty__stage"
                            :class="{ 'is-compare': step.before, 'is-dragging': dragging }"
                            :style="{ '--doma-novelty-reveal': `${reveal}%` }"
                            @pointerdown="onPointerDown"
                            @pointermove="onPointerMove"
                            @pointerup="onPointerUp"
                            @pointercancel="onPointerUp"
                        >
                            <div v-if="step.before" class="doma-novelty__layer">
                                <video
                                    v-if="isVideo(step.before)"
                                    :key="`antes-${index}`"
                                    :src="step.before.src"
                                    autoplay
                                    muted
                                    loop
                                    playsinline
                                ></video>
                                <img v-else :key="`antes-${index}`" :src="step.before.src" alt="" draggable="false" />
                            </div>

                            <div class="doma-novelty__layer is-now">
                                <video
                                    v-if="isVideo(step.media)"
                                    :key="`ahora-${index}`"
                                    :src="step.media.src"
                                    autoplay
                                    muted
                                    loop
                                    playsinline
                                ></video>
                                <img v-else :key="`ahora-${index}`" :src="step.media?.src" :alt="step.title" draggable="false" />
                            </div>

                            <template v-if="step.before">
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
                        </div>

                        <div class="doma-novelty__progress" aria-hidden="true">
                            <i :style="{ width: `${progress}%` }"></i>
                        </div>

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
</template>

<style scoped>
/* Patrón de los modales de Suite (Bootstrap y Velzon) con los tokens de DOMA. */
.doma-novelty {
    position: fixed;
    inset: 0;
    z-index: 1060;
    overflow-y: auto;
    padding: 1.75rem 16px;
    background: var(--doma-backdrop);
    font-family: var(--doma-font);
    animation: domaNoveltyFade 0.15s ease-out;
}

.doma-novelty__dialog {
    max-width: 1140px;
    margin: 0 auto;
    overflow: hidden;
    border-radius: var(--doma-radius-lg);
    background: var(--doma-surface);
    box-shadow: var(--doma-shadow-menu);
    color: var(--doma-text);
    font-size: 0.875rem;
    line-height: 1.5;
    outline: none;
    animation: domaNoveltyIn 0.3s ease-out;
}

.doma-novelty__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    background: var(--doma-surface-muted);
}

.doma-novelty__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    color: var(--doma-heading);
    font-size: 1.09375rem;
    font-weight: 600;
    line-height: 1.5;
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
    padding: 1.25rem;
}

.doma-novelty__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 0.5rem;
    color: var(--doma-heading);
    font-weight: 500;
}

.doma-novelty__meta i {
    color: var(--doma-muted);
    font-size: 16px;
}

.doma-novelty__intro {
    max-width: 80ch;
    margin: 0 0 1rem;
    color: var(--doma-muted);
    white-space: pre-line;
}

.doma-novelty__intro:last-child {
    margin-bottom: 0;
}

/* ---------- Escenario ---------- */

/* 16:9, pero sin pasar del alto que deja libre el resto del modal (unos
   420 px): el modal completo cabe en pantallas de portátil sin desplazarse. */
.doma-novelty__stage {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    max-height: max(220px, calc(100vh - 420px));
    overflow: hidden;
    border: 1px solid var(--doma-border);
    border-radius: var(--doma-radius-lg);
    background: var(--doma-surface-muted);
    user-select: none;
    touch-action: pan-y;
}

.doma-novelty__stage.is-compare {
    cursor: ew-resize;
}

.doma-novelty__layer {
    position: absolute;
    inset: 0;
}

.doma-novelty__layer img,
.doma-novelty__layer video {
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

.doma-novelty__progress {
    height: 4px;
    margin-top: 0.5rem;
    overflow: hidden;
    border-radius: var(--doma-radius);
    background: var(--doma-surface-muted);
}

.doma-novelty__progress i {
    display: block;
    height: 100%;
    background: var(--doma-primary);
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
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1.25rem 1.25rem;
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
.doma-novelty__knob:focus-visible {
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
        transform: translate(0, -50px);
    }
}

@keyframes domaNoveltyCaption {
    from {
        opacity: 0;
        transform: translateY(4px);
    }
}

@media (max-width: 640px) {
    .doma-novelty {
        padding-block: 0.5rem;
    }

    .doma-novelty__body {
        padding: 1rem;
    }

    .doma-novelty__footer {
        padding: 0 1rem 1rem;
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
