<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

/**
 * Reproductor de video con controles propios, iguales en todos los
 * navegadores: reproducir, ±10 s, línea de tiempo, velocidad, volumen e imagen
 * en imagen. Lo usan el detalle de una novedad (DomaAnnouncementDetail, con
 * los controles sobre el video) y el visor (DomaMediaViewer, con los controles
 * en una barra debajo), y cualquier pantalla que lo necesite:
 *
 *     <DomaVideoPlayer :src="video" overlay autoplay v-model:muted="silencio" @ended="siguiente" />
 *
 * No se repite: al terminar se queda en el último cuadro y emite `ended`.
 * Los atajos de teclado los activa quien lo contiene, pasándole cada tecla a
 * `handleKey(event)` (expuesto): espacio y K reproducen o pausan, J y L
 * mueven 10 s, las flechas 5 s y el volumen, M silencia, < y > cambian la
 * velocidad.
 */
const props = defineProps({
    src: { type: String, required: true },
    /** Arranca al cargar; si el navegador no lo deja con sonido, arranca en silencio. */
    autoplay: { type: Boolean, default: false },
    /** Segundo en el que arranca al cargar. */
    startAt: { type: Number, default: 0 },
    /** Sin sonido (v-model:muted). */
    muted: { type: Boolean, default: false },
    /** Velocidad (v-model:rate). */
    rate: { type: Number, default: 1 },
    /**
     * Controles sobre el video, que se ocultan solos mientras se reproduce y
     * el mouse no se mueve. Sin ella van en una barra debajo del video.
     */
    overlay: { type: Boolean, default: false },
    /** Oculta los controles (el visor los oculta cuando el mouse no se mueve). */
    hideControls: { type: Boolean, default: false },
});

const emit = defineEmits(['play', 'pause', 'ended', 'update:muted', 'update:rate']);

const SEEK_SECONDS = 10;
const ARROW_SEEK_SECONDS = 5;
const VOLUME_STEP = 0.1;
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const IDLE_MS = 2500;

const video = ref(null);
const playing = ref(false);
const ended = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const speed = ref(props.rate);
const volume = ref(1);
const silent = ref(props.muted);
const pipSupported = typeof document !== 'undefined' && Boolean(document.pictureInPictureEnabled);

const timeLabel = computed(() => `${formatTime(currentTime.value)} / ${formatTime(duration.value)}`);
const volumeIcon = computed(() => (silent.value || volume.value === 0 ? 'ri-volume-mute-line' : 'ri-volume-up-line'));
const fill = computed(() => (duration.value ? (currentTime.value / duration.value) * 100 : 0));

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatTime(seconds) {
    const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const minutes = Math.floor(total / 60);

    return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

// Hasta que el video carga y recibe el sonido y el volumen del usuario, los
// que trae el elemento (los de fábrica) no son una elección suya: no se leen.
let ready = false;

function syncVideo() {
    const element = video.value;
    if (!element) return;

    playing.value = !element.paused && !element.ended;
    ended.value = element.ended;
    currentTime.value = element.currentTime;
    duration.value = Number.isFinite(element.duration) ? element.duration : 0;

    if (!ready) return;

    volume.value = element.volume;

    if (silent.value !== element.muted) {
        silent.value = element.muted;
        emit('update:muted', element.muted);
    }
}

// El navegador puede negar el sonido si el usuario no ha tocado la página:
// entonces arranca en silencio.
function startPlayback() {
    const element = video.value;
    if (!element) return;

    element.play().catch((error) => {
        if (error?.name !== 'NotAllowedError' || element.muted) return;

        element.muted = true;
        element.play().catch(() => {});
    });
}

// Cada video arranca con la velocidad, el volumen y el sonido que el usuario
// ya eligió.
function onLoadedMetadata() {
    const element = video.value;
    if (!element) return;

    element.defaultPlaybackRate = speed.value;
    element.playbackRate = speed.value;
    element.volume = volume.value;
    element.muted = silent.value;

    if (props.startAt > 0 && Number.isFinite(element.duration)) {
        element.currentTime = Math.min(props.startAt, Math.max(0, element.duration - 0.25));
    }

    ready = true;
    syncVideo();
    if (props.autoplay) startPlayback();
}

function onPlay() {
    syncVideo();
    emit('play');
}

// Al terminar, el navegador pausa antes de avisar que terminó: esa pausa no
// es del usuario y no se emite.
function onPause() {
    syncVideo();
    if (!video.value?.ended) emit('pause');
}

function onEnded() {
    syncVideo();
    emit('ended');
}

function togglePlay() {
    const element = video.value;
    if (!element) return;

    // Terminado, play() lo empieza de nuevo.
    if (element.paused || element.ended) element.play().catch(() => {});
    else element.pause();
}

function pause() {
    video.value?.pause();
}

function seekTo(seconds) {
    const element = video.value;
    if (!element) return;

    const limit = Number.isFinite(element.duration) ? element.duration : Infinity;
    element.currentTime = clamp(Number(seconds) || 0, 0, limit);
    currentTime.value = element.currentTime;
}

function seekBy(seconds) {
    seekTo((video.value?.currentTime ?? 0) + seconds);
}

function setRate(value) {
    const next = Number(value) || 1;
    const element = video.value;
    speed.value = next;

    if (element) {
        element.defaultPlaybackRate = next;
        element.playbackRate = next;
    }

    if (next !== props.rate) emit('update:rate', next);
}

function stepRate(direction) {
    const position = RATES.findIndex((value) => value >= speed.value - 0.001);
    const from = position === -1 ? RATES.length - 1 : position;
    setRate(RATES[clamp(from + direction, 0, RATES.length - 1)]);
}

function setVolume(value) {
    const element = video.value;
    const next = clamp(Number(value), 0, 1);
    volume.value = next;

    if (element) {
        element.volume = next;
        element.muted = next === 0;
    }
}

function toggleMute() {
    const element = video.value;
    if (!element) return;

    element.muted = !element.muted;
    if (!element.muted && element.volume === 0) element.volume = 0.5;
}

async function togglePictureInPicture() {
    const element = video.value;
    if (!element) return;

    try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else await element.requestPictureInPicture();
    } catch {
        // El navegador lo negó (p. ej. el video aún no carga): no pasa nada.
    }
}

// Otro video: se crea un elemento nuevo, que aún no tiene la configuración.
watch(() => props.src, () => {
    ready = false;
});

watch(() => props.muted, (value) => {
    silent.value = value;
    if (video.value) video.value.muted = value;
});

watch(() => props.rate, (value) => {
    if (value !== speed.value) setRate(value);
});

// ---------- Controles que se ocultan (sobre el video) ----------

const idle = ref(false);
let idleTimer = null;

function wake() {
    idle.value = false;
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
        idle.value = playing.value;
    }, IDLE_MS);
}

function rest() {
    window.clearTimeout(idleTimer);
    idle.value = playing.value;
}

watch(playing, wake);

const controlsHidden = computed(() => props.hideControls || (props.overlay && idle.value));

// ---------- Teclado ----------

/**
 * Atiende una tecla del video. Con `arrows: false` deja las flechas a quien lo
 * contiene (el detalle las usa para pasar de un paso a otro). Devuelve si la
 * atendió.
 */
function handleKey(event, { arrows = true } = {}) {
    const target = event.target;
    const key = event.key;
    const onField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(target?.tagName);
    const onControl = ['BUTTON', 'SELECT', 'A'].includes(target?.tagName);

    // La línea de tiempo, el volumen y la velocidad manejan sus propias
    // flechas; un botón, su propio Enter y espacio.
    if (onField && key.startsWith('Arrow')) return false;
    if (onControl && (key === ' ' || key === 'Enter')) return false;

    const actions = {
        ' ': () => togglePlay(),
        k: () => togglePlay(),
        j: () => seekBy(-SEEK_SECONDS),
        l: () => seekBy(SEEK_SECONDS),
        m: () => toggleMute(),
        '<': () => stepRate(-1),
        '>': () => stepRate(1),
        ...(arrows ? {
            ArrowLeft: () => seekBy(-ARROW_SEEK_SECONDS),
            ArrowRight: () => seekBy(ARROW_SEEK_SECONDS),
            ArrowUp: () => setVolume(volume.value + VOLUME_STEP),
            ArrowDown: () => setVolume(volume.value - VOLUME_STEP),
        } : {}),
    };
    // K, J, L y M también con mayúscula sostenida.
    const action = actions[key] ?? actions[key.toLowerCase()];
    if (!action) return false;

    event.preventDefault();
    action();
    wake();

    return true;
}

onBeforeUnmount(() => window.clearTimeout(idleTimer));

defineExpose({
    play: startPlayback,
    pause,
    seekTo,
    handleKey,
    /** Segundo en el que va. */
    time: () => video.value?.currentTime ?? 0,
    /** Cuánto lleva, de 0 a 1 (1 al terminar). */
    progress: () => {
        const element = video.value;
        if (!element || !Number.isFinite(element.duration) || element.duration <= 0) return 0;

        return element.ended ? 1 : element.currentTime / element.duration;
    },
});
</script>

<template>
    <div
        class="doma-video"
        :class="{ 'is-overlay': overlay, 'is-hidden': controlsHidden }"
        @pointermove="wake"
        @pointerdown="wake"
        @pointerleave="rest"
    >
        <div class="doma-video__screen">
            <video
                ref="video"
                :key="src"
                :src="src"
                class="doma-video__media"
                playsinline
                preload="metadata"
                @click="togglePlay"
                @loadedmetadata="onLoadedMetadata"
                @play="onPlay"
                @pause="onPause"
                @ended="onEnded"
                @timeupdate="syncVideo"
                @durationchange="syncVideo"
                @volumechange="syncVideo"
            ></video>

            <button
                v-if="overlay && !playing"
                type="button"
                class="doma-video__center"
                :aria-label="ended ? 'Ver de nuevo' : 'Reproducir'"
                :title="ended ? 'Ver de nuevo' : 'Reproducir'"
                @click="togglePlay"
            >
                <i :class="ended ? 'ri-restart-line' : 'ri-play-fill'" aria-hidden="true"></i>
            </button>
        </div>

        <div class="doma-video__controls">
            <input
                class="doma-video__timeline"
                type="range"
                min="0"
                :max="duration || 0"
                step="0.1"
                :value="currentTime"
                :style="{ '--doma-video-fill': `${fill}%` }"
                aria-label="Línea de tiempo"
                :aria-valuetext="timeLabel"
                @input="seekTo($event.target.value)"
            />

            <div class="doma-video__row">
                <button
                    type="button"
                    class="doma-video__btn"
                    :aria-label="playing ? 'Pausar' : 'Reproducir'"
                    :title="playing ? 'Pausar (K)' : 'Reproducir (K)'"
                    @click="togglePlay"
                >
                    <i :class="playing ? 'ri-pause-fill' : 'ri-play-fill'" aria-hidden="true"></i>
                </button>
                <button type="button" class="doma-video__btn is-seek" aria-label="Retroceder 10 segundos" title="Retroceder 10 s (J)" @click="seekBy(-SEEK_SECONDS)">
                    <i class="ri-replay-10-line" aria-hidden="true"></i>
                </button>
                <button type="button" class="doma-video__btn is-seek" aria-label="Adelantar 10 segundos" title="Adelantar 10 s (L)" @click="seekBy(SEEK_SECONDS)">
                    <i class="ri-forward-10-line" aria-hidden="true"></i>
                </button>

                <span class="doma-video__time">{{ timeLabel }}</span>

                <span class="doma-video__grow"></span>

                <label class="doma-video__rate" title="Velocidad (< >)">
                    <i class="ri-speed-line" aria-hidden="true"></i>
                    <span class="doma-video__sr-only">Velocidad</span>
                    <select :value="speed" @change="setRate($event.target.value)">
                        <option v-for="value in RATES" :key="value" :value="value">{{ value }}×</option>
                    </select>
                </label>

                <div class="doma-video__volume">
                    <button
                        type="button"
                        class="doma-video__btn"
                        :aria-label="silent ? 'Activar sonido' : 'Silenciar'"
                        :title="silent ? 'Activar sonido (M)' : 'Silenciar (M)'"
                        @click="toggleMute"
                    >
                        <i :class="volumeIcon" aria-hidden="true"></i>
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        :value="silent ? 0 : volume"
                        :style="{ '--doma-video-fill': `${(silent ? 0 : volume) * 100}%` }"
                        aria-label="Volumen"
                        @input="setVolume($event.target.value)"
                    />
                </div>

                <button
                    v-if="pipSupported"
                    type="button"
                    class="doma-video__btn is-pip"
                    aria-label="Imagen en imagen"
                    title="Imagen en imagen"
                    @click="togglePictureInPicture"
                >
                    <i class="ri-picture-in-picture-line" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Texto claro sobre fondo oscuro en los dos temas, como cualquier
   reproductor; los colores salen del tema (tokens.css: --doma-viewer-*). */
.doma-video {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    color: var(--doma-viewer-text);
    font-family: var(--doma-font);
    font-size: 0.875rem;
    user-select: none;
    container: doma-video / inline-size;
}

.doma-video__screen {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
}

/* El video se ajusta al espacio sin recortarse. Quien lo contiene puede
   dejar un margen a los lados con --doma-video-gutter (el visor deja sitio a
   sus flechas). */
.doma-video__media {
    position: absolute;
    inset: 0 var(--doma-video-gutter, 0);
    display: block;
    width: calc(100% - 2 * var(--doma-video-gutter, 0px));
    height: 100%;
    object-fit: contain;
    cursor: pointer;
}

.doma-video__center {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--doma-viewer-bg);
    color: inherit;
    font-size: 34px;
    opacity: 0.85;
    cursor: pointer;
    transform: translate(-50%, -50%);
    transition: opacity 0.15s;
}

.doma-video__center:hover {
    opacity: 1;
}

/* ---------- Controles ---------- */

.doma-video__controls {
    display: grid;
    flex: none;
    gap: 0.5rem;
    padding: 0.5rem 1rem 1rem;
    transition: opacity 0.25s ease;
}

.doma-video.is-hidden {
    cursor: none;
}

.doma-video.is-hidden .doma-video__controls {
    opacity: 0;
    pointer-events: none;
}

/* Sobre el video: ocupa todo el espacio y los controles flotan abajo, sobre
   un degradado que los deja leer en cualquier cuadro. */
.doma-video.is-overlay {
    background: var(--doma-viewer-bg);
}

.doma-video.is-overlay .doma-video__screen {
    position: absolute;
    inset: 0;
}

.doma-video.is-overlay .doma-video__controls {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    gap: 0.25rem;
    padding: 2.5rem 0.75rem 0.5rem;
    background: linear-gradient(to top, var(--doma-viewer-bg), transparent);
}

/* Con el teclado sobre un control, los controles no se ocultan. */
.doma-video.is-overlay:has(:focus-visible) .doma-video__controls {
    opacity: 1;
    pointer-events: auto;
}

.doma-video__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
}

.doma-video__grow {
    flex: 1;
}

.doma-video__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 38px;
    height: 38px;
    padding: 0 0.5rem;
    border: 0;
    border-radius: var(--doma-radius);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
}

.doma-video__btn i {
    font-size: 20px;
}

.doma-video__btn:hover {
    background: var(--doma-viewer-control-hover);
}

.is-overlay .doma-video__btn,
.is-overlay .doma-video__rate {
    min-width: 34px;
    height: 34px;
}

.doma-video__time {
    padding: 0 0.375rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

.doma-video__rate {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    height: 38px;
    margin: 0;
    padding: 0 0.25rem 0 0.5rem;
    border-radius: var(--doma-radius);
    background: var(--doma-viewer-control);
}

.doma-video__rate i {
    font-size: 18px;
}

.doma-video__rate select {
    padding: 0.25rem;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
}

.doma-video__rate select option {
    background: var(--doma-surface);
    color: var(--doma-text);
}

.doma-video__volume {
    display: inline-flex;
    align-items: center;
}

.doma-video__volume input {
    width: 90px;
}

/* Barras de tiempo y volumen: el tramo recorrido con el primario de la app. */
.doma-video input[type='range'] {
    height: 18px;
    margin: 0;
    background: transparent;
    accent-color: var(--doma-primary);
    cursor: pointer;
    appearance: none;
}

.doma-video input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: var(--doma-radius);
    background: linear-gradient(to right, var(--doma-primary) var(--doma-video-fill, 0%), var(--doma-viewer-control-hover) var(--doma-video-fill, 0%));
}

.doma-video input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: var(--doma-radius);
    background: linear-gradient(to right, var(--doma-primary) var(--doma-video-fill, 0%), var(--doma-viewer-control-hover) var(--doma-video-fill, 0%));
}

.doma-video input[type='range']::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    margin-top: -5px;
    border: 0;
    border-radius: 50%;
    background: var(--doma-viewer-text);
    appearance: none;
}

.doma-video input[type='range']::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: 0;
    border-radius: 50%;
    background: var(--doma-viewer-text);
}

.doma-video__timeline {
    width: 100%;
}

.doma-video__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
}

.doma-video__btn:focus-visible,
.doma-video__center:focus-visible,
.doma-video__rate:focus-within,
.doma-video input[type='range']:focus-visible {
    outline: 2px solid var(--doma-primary);
    outline-offset: 2px;
}

/* En un espacio angosto quedan los controles esenciales. */
@container doma-video (max-width: 560px) {
    .doma-video__volume input,
    .doma-video__btn.is-pip {
        display: none;
    }
}

@container doma-video (max-width: 400px) {
    .doma-video__btn.is-seek,
    .doma-video__rate i {
        display: none;
    }
}

@media (prefers-reduced-motion: reduce) {
    .doma-video__controls {
        transition: none;
    }
}
</style>
