<script setup>
/**
 * Búsqueda de módulos del menú lateral, fija entre el encabezado
 * (DomaMenuHeader) y la lista de módulos.
 *
 * No recibe la lista de módulos: lee los enlaces que el menú de la app pintó
 * (`#navbar-nav`). El menú ya dejó por fuera lo que el usuario no puede ver
 * (permisos, apps contratadas del tenant, lo que sea), así que la búsqueda
 * nunca muestra un módulo que no esté en su menú. Se lee en cada búsqueda,
 * con lo que siempre está al día con el menú.
 *
 * Mientras hay texto, los resultados ocupan el lugar de la lista. Abrir uno es
 * hacer clic en su enlace del menú: navega igual que desde el menú (Inertia,
 * recarga completa o lo que haga la app).
 *
 * Con el menú colapsado queda el botón con la lupa, que abre la búsqueda en un
 * panel flotante junto al menú.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { vDomaTooltip } from '../directives/domaTooltip.js';

const props = defineProps({
    /** Menú colapsado: solo el botón con la lupa. */
    collapsed: { type: Boolean, default: false },
    /** Lista del menú donde se busca, dentro del mismo `.doma-app-menu`. */
    target: { type: String, default: '#navbar-nav' },
    placeholder: { type: String, default: 'Buscar módulo' },
});

const FALLBACK_ICON = 'ri-file-list-3-line';
const PANEL_GAP = 8; // separación del panel flotante respecto al menú
const PANEL_VIEWPORT_MARGIN = 8;
const SEARCHING_CLASS = 'doma-app-menu--searching';

const uid = `doma-menu-search-${Math.random().toString(36).slice(2, 9)}`;

const root = ref(null);
const input = ref(null);
const trigger = ref(null);
const panel = ref(null);
const list = ref(null);

const query = ref('');
const activeIndex = ref(0);
const panelOpen = ref(false);
const panelStyle = ref({});

const tokens = computed(() => fold(query.value).split(/\s+/).filter(Boolean));
const searching = computed(() => tokens.value.length > 0);
const results = ref([]);

const resultsLabel = computed(() => (results.value.length === 1 ? '1 módulo' : `${results.value.length} módulos`));
const activeOptionId = computed(() => (searching.value && results.value.length ? optionId(activeIndex.value) : null));

/* ---------- Lectura del menú ---------- */

/** Minúsculas y sin tildes: "Configuración" y "configuracion" son lo mismo. */
function fold(text) {
    return String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function menuRoot() {
    return root.value?.closest('.doma-app-menu') ?? null;
}

function menuList() {
    return menuRoot()?.querySelector(props.target) ?? document.querySelector(props.target);
}

/** Texto que se lee en el ítem, sin íconos ni contadores. */
function linkLabel(link) {
    const copy = link.cloneNode(true);
    copy.querySelectorAll('i, svg, .badge, .visually-hidden, .sr-only').forEach((node) => node.remove());

    return copy.textContent.replace(/\s+/g, ' ').trim();
}

/** El ítem que abre un sub-menú: el enlace directo del `<li>` que lo contiene. */
function groupToggle(dropdown) {
    return dropdown.parentElement?.querySelector(':scope > a, :scope > .menu-link') ?? null;
}

/** Grupos que contienen el enlace, del más externo al más interno. */
function linkGroups(link, nav) {
    const groups = [];
    let dropdown = link.closest('.menu-dropdown');

    while (dropdown && nav.contains(dropdown)) {
        const toggle = groupToggle(dropdown);
        if (toggle) {
            groups.unshift(toggle);
        }
        dropdown = dropdown.parentElement?.closest('.menu-dropdown');
    }

    return groups;
}

function iconOf(element) {
    return element?.querySelector('i')?.className.trim() || '';
}

/**
 * Los módulos que el menú muestra hoy: cada enlace navegable, sin los que solo
 * despliegan un grupo (`#…`). Va en el orden del menú.
 */
function readMenuItems() {
    const nav = menuList();
    if (!nav) {
        return [];
    }

    const items = [];
    const seen = new Set();

    nav.querySelectorAll('a[href]').forEach((link) => {
        const href = link.getAttribute('href') || '';
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || link.hasAttribute('aria-controls')) {
            return;
        }

        const label = linkLabel(link);
        const key = `${href}|${label}`;
        if (!label || seen.has(key)) {
            return;
        }
        seen.add(key);

        const groups = linkGroups(link, nav);

        items.push({
            key,
            href,
            label,
            folded: fold(label),
            group: groups.map(linkLabel).filter(Boolean).join(' › '),
            icon: iconOf(link) || iconOf(groups[0]) || FALLBACK_ICON,
            link,
            order: items.length,
        });
    });

    return items;
}

/* ---------- Búsqueda ---------- */

/** 0: empieza por lo buscado; 1: alguna palabra empieza por ello; 2: lo contiene. */
function rank(folded) {
    const phrase = tokens.value.join(' ');
    if (folded.startsWith(phrase)) {
        return 0;
    }

    return folded.split(/[\s\-/]+/).some((word) => word.startsWith(tokens.value[0])) ? 1 : 2;
}

/**
 * Partes del nombre para pintarlo con lo buscado resaltado. Se compara sin
 * tildes, pero se pinta el texto original.
 */
function highlight(label) {
    // Cada carácter del texto sin tildes apunta a su carácter original.
    const chars = Array.from(label);
    let folded = '';
    const origin = [];
    chars.forEach((char, index) => {
        const part = fold(char);
        folded += part;
        for (let i = 0; i < part.length; i += 1) {
            origin.push(index);
        }
    });

    const marked = new Array(chars.length).fill(false);
    tokens.value.forEach((token) => {
        let from = folded.indexOf(token);
        while (from !== -1) {
            for (let i = from; i < from + token.length; i += 1) {
                marked[origin[i]] = true;
            }
            from = folded.indexOf(token, from + token.length);
        }
    });

    const parts = [];
    chars.forEach((char, index) => {
        const last = parts[parts.length - 1];
        if (last && last.match === marked[index]) {
            last.text += char;
        } else {
            parts.push({ text: char, match: marked[index] });
        }
    });

    return parts;
}

function search() {
    if (!searching.value) {
        results.value = [];
        return;
    }

    results.value = readMenuItems()
        .filter((item) => tokens.value.every((token) => item.folded.includes(token)))
        .map((item) => ({ ...item, rank: rank(item.folded), parts: highlight(item.label) }))
        .sort((a, b) => a.rank - b.rank || a.order - b.order);
}

watch(query, () => {
    search();
    activeIndex.value = 0;
    if (list.value) {
        list.value.scrollTop = 0;
    }
});

// Con texto, los resultados toman el lugar de la lista del menú expandido
// (layout.css); en el panel flotante la lista no se toca.
watch(
    () => searching.value && !props.collapsed,
    (value) => menuRoot()?.classList.toggle(SEARCHING_CLASS, value),
);

watch(() => props.collapsed, () => {
    closePanel();
    clear();
});

/* ---------- Abrir un resultado ---------- */

function optionId(index) {
    return `${uid}-option-${index}`;
}

/** El enlace del menú del resultado; si el menú se volvió a pintar, el nuevo. */
function sourceLink(item) {
    if (item.link?.isConnected) {
        return item.link;
    }

    return readMenuItems().find((candidate) => candidate.key === item.key)?.link ?? null;
}

function open(item) {
    const link = sourceLink(item);

    clear();
    closePanel();

    if (link) {
        link.click();
    } else {
        window.location.assign(item.href);
    }
}

/** Ctrl, ⌘, Shift o el botón del medio: el navegador abre el enlace como siempre. */
function onResultClick(event, item) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
    }

    event.preventDefault();
    open(item);
}

function clear() {
    query.value = '';
}

function onClearClick() {
    clear();
    input.value?.focus();
}

/* ---------- Teclado ---------- */

function moveActive(step) {
    const total = results.value.length;
    if (!total) {
        return;
    }

    activeIndex.value = (activeIndex.value + step + total) % total;
    nextTick(() => {
        document.getElementById(optionId(activeIndex.value))?.scrollIntoView({ block: 'nearest' });
    });
}

function onKeydown(event) {
    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            moveActive(1);
            break;
        case 'ArrowUp':
            event.preventDefault();
            moveActive(-1);
            break;
        case 'Enter':
            if (searching.value && results.value[activeIndex.value]) {
                event.preventDefault();
                open(results.value[activeIndex.value]);
            }
            break;
        case 'Escape':
            // Primero borra lo escrito; con el campo vacío, sale de la búsqueda.
            event.preventDefault();
            if (query.value) {
                clear();
            } else if (panelOpen.value) {
                closePanel();
                trigger.value?.focus();
            } else {
                input.value?.blur();
            }
            break;
        default:
    }
}

/* ---------- Panel flotante (menú colapsado) ---------- */

function placePanel() {
    const rect = trigger.value?.getBoundingClientRect();
    if (!rect) {
        return;
    }

    const top = Math.max(PANEL_VIEWPORT_MARGIN, rect.top);
    panelStyle.value = {
        top: `${top}px`,
        left: `${(menuRoot()?.getBoundingClientRect().right ?? rect.right) + PANEL_GAP}px`,
        maxHeight: `${window.innerHeight - top - PANEL_VIEWPORT_MARGIN}px`,
    };
}

function togglePanel() {
    if (panelOpen.value) {
        closePanel();
        return;
    }

    placePanel();
    panelOpen.value = true;
    nextTick(() => input.value?.focus());
}

function closePanel() {
    panelOpen.value = false;
}

function onDocumentPointerDown(event) {
    if (!panelOpen.value) {
        return;
    }

    const inside = [panel.value, trigger.value].some((element) => element?.contains(event.target));
    if (!inside) {
        closePanel();
        clear();
    }
}

onMounted(() => {
    document.addEventListener('pointerdown', onDocumentPointerDown);
    window.addEventListener('resize', closePanel);
});

onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    window.removeEventListener('resize', closePanel);
    menuRoot()?.classList.remove(SEARCHING_CLASS);
});
</script>

<template>
    <div
        ref="root"
        class="doma-menu-search"
        :class="{ 'is-collapsed': collapsed, 'is-searching': searching && !collapsed }"
    >
        <!-- Menú colapsado: la lupa abre el panel flotante. -->
        <button
            v-if="collapsed"
            ref="trigger"
            type="button"
            class="doma-menu-search__trigger"
            :class="{ 'is-open': panelOpen }"
            :aria-label="placeholder"
            :aria-expanded="panelOpen ? 'true' : 'false'"
            :aria-controls="`${uid}-panel`"
            v-doma-tooltip:right="placeholder"
            @click="togglePanel"
        >
            <i class="ri-search-line" aria-hidden="true"></i>
        </button>

        <Teleport to="body" :disabled="!collapsed">
            <div
                v-if="!collapsed || panelOpen"
                :id="`${uid}-panel`"
                ref="panel"
                class="doma-menu-search__box"
                :class="{ 'doma-menu-search__panel': collapsed }"
                :style="collapsed ? panelStyle : null"
            >
                <div class="doma-menu-search__field">
                    <i class="ri-search-line doma-menu-search__icon" aria-hidden="true"></i>
                    <input
                        ref="input"
                        v-model="query"
                        type="text"
                        class="doma-menu-search__input"
                        :placeholder="placeholder"
                        :aria-label="placeholder"
                        role="combobox"
                        aria-autocomplete="list"
                        :aria-expanded="searching ? 'true' : 'false'"
                        :aria-controls="`${uid}-results`"
                        :aria-activedescendant="activeOptionId"
                        autocomplete="off"
                        spellcheck="false"
                        @keydown="onKeydown"
                    >
                    <button
                        v-if="query"
                        type="button"
                        class="doma-menu-search__clear"
                        aria-label="Borrar búsqueda"
                        @click="onClearClick"
                    >
                        <i class="ri-close-line" aria-hidden="true"></i>
                    </button>
                </div>

                <div v-if="searching" class="doma-menu-search__results">
                    <p v-if="results.length" class="doma-menu-search__title" role="status">{{ resultsLabel }}</p>

                    <ul
                        v-if="results.length"
                        :id="`${uid}-results`"
                        ref="list"
                        class="doma-menu-search__list"
                        role="listbox"
                        :aria-label="placeholder"
                    >
                        <li v-for="(item, index) in results" :key="item.key" role="presentation">
                            <a
                                :id="optionId(index)"
                                :href="item.href"
                                class="doma-menu-search__result"
                                :class="{ 'is-active': index === activeIndex }"
                                role="option"
                                :aria-selected="index === activeIndex ? 'true' : 'false'"
                                tabindex="-1"
                                @mousemove="activeIndex = index"
                                @click="onResultClick($event, item)"
                            >
                                <i :class="item.icon" aria-hidden="true"></i>
                                <span class="doma-menu-search__text">
                                    <span class="doma-menu-search__label">
                                        <template v-for="(part, partIndex) in item.parts" :key="partIndex">
                                            <mark v-if="part.match">{{ part.text }}</mark>
                                            <template v-else>{{ part.text }}</template>
                                        </template>
                                    </span>
                                    <small v-if="item.group" class="doma-menu-search__group">{{ item.group }}</small>
                                </span>
                            </a>
                        </li>
                    </ul>

                    <div v-else :id="`${uid}-results`" class="doma-menu-search__empty" role="status">
                        <strong>Sin resultados</strong>
                        <span>Ningún módulo del menú coincide con «{{ query.trim() }}».</span>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.doma-menu-search {
    display: flex;
    flex: none;
    flex-direction: column;
    min-height: 0;
    font-family: var(--doma-font);
}

.doma-menu-search.is-searching {
    flex: 1 1 auto;
}

.doma-menu-search.is-collapsed {
    align-items: center;
    padding: 10px 0 4px;
}

/* ---------- Campo ---------- */

.doma-menu-search__box {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 12px 11px 4px;
}

.doma-menu-search.is-searching .doma-menu-search__box {
    flex: 1 1 auto;
}

.doma-menu-search__field {
    position: relative;
    flex: none;
}

/* El campo de los formularios del tema (form-control de Velzon), con la lupa
   a la izquierda como su search-box: igual a los buscadores de las páginas. */
.doma-menu-search__input {
    display: block;
    width: 100%;
    height: 36px;
    padding: 0 32px 0 34px;
    border: var(--vz-border-width, 1px) solid var(--vz-input-border-custom, var(--doma-border));
    border-radius: var(--doma-radius);
    background: var(--vz-input-bg-custom, var(--doma-surface));
    color: var(--doma-text);
    font-family: inherit;
    font-size: 13px;
    line-height: 1.5;
    outline: none;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    appearance: none;
}

.doma-menu-search__input::placeholder {
    color: var(--doma-muted);
    opacity: 1;
}

.doma-menu-search__input:focus {
    border-color: var(--doma-primary-border);
    box-shadow: 0 0 0 3px rgba(var(--doma-primary-rgb), 0.15);
}

.doma-menu-search__icon {
    position: absolute;
    top: 0;
    left: 12px;
    display: flex;
    align-items: center;
    height: 100%;
    color: var(--doma-muted);
    font-size: 14px;
    pointer-events: none;
}

.doma-menu-search__clear {
    position: absolute;
    top: 50%;
    right: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: var(--doma-radius);
    background: transparent;
    color: var(--doma-muted);
    font-size: 16px;
    cursor: pointer;
    transform: translateY(-50%);
    transition: background-color 0.15s ease, color 0.15s ease;
}

.doma-menu-search__clear:hover {
    background: rgba(var(--doma-primary-rgb), 0.07);
    color: var(--doma-heading);
}

.doma-menu-search__clear:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(var(--doma-primary-rgb), 0.3);
}

/* ---------- Botón del menú colapsado ---------- */

/* Como un ítem del menú colapsado: solo el ícono. */
.doma-menu-search__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 36px;
    padding: 0;
    border: var(--vz-border-width, 1px) solid var(--vz-input-border-custom, var(--doma-border));
    border-radius: var(--doma-radius);
    background: var(--vz-input-bg-custom, var(--doma-surface));
    color: var(--doma-muted);
    font-size: 16px;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.doma-menu-search__trigger:hover,
.doma-menu-search__trigger.is-open {
    border-color: var(--doma-primary-border);
    background: var(--doma-primary-soft);
    color: var(--doma-primary-ink);
}

.doma-menu-search__trigger:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(var(--doma-primary-rgb), 0.3);
}

/* ---------- Panel flotante ---------- */

/* El mismo aspecto del panel flotante del menú colapsado (.doma-menu-flyout). */
.doma-menu-search__panel {
    position: fixed;
    z-index: 1100;
    width: 290px;
    padding: 8px;
    border: 1px solid var(--doma-border);
    border-radius: var(--doma-radius-lg);
    background: var(--doma-surface);
    box-shadow: var(--doma-shadow-menu);
    font-family: var(--doma-font);
    animation: domaMenuSearchIn 0.12s ease-out;
}

@keyframes domaMenuSearchIn {
    from {
        opacity: 0;
        transform: translateX(-4px);
    }

    to {
        opacity: 1;
        transform: none;
    }
}

/* ---------- Resultados ---------- */

.doma-menu-search__results {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
}

/* Como los títulos de sección del menú (.menu-title). */
.doma-menu-search__title {
    flex: none;
    margin: 14px 0 6px;
    padding: 0 10px;
    color: var(--vz-vertical-menu-title-color, var(--doma-muted));
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    opacity: 0.85;
}

/* El padding derecho absorbe el translateX(2px) del hover sin barra horizontal. */
.doma-menu-search__list {
    flex: 1 1 auto;
    min-height: 0;
    margin: 0;
    padding: 0 2px 16px 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
    scrollbar-width: thin;
}

.doma-menu-search__list::-webkit-scrollbar {
    width: 6px;
}

.doma-menu-search__list::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background: rgba(var(--doma-primary-rgb), 0.25);
}

/* Como un ítem del menú (.menu-link): mismo tamaño, espacios y realce. */
.doma-menu-search__result {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 1px 0;
    padding: 7px 10px;
    border-radius: var(--doma-radius);
    color: var(--vz-vertical-menu-item-color, var(--doma-text));
    font-size: 13px;
    font-weight: 500;
    line-height: 1.35;
    text-decoration: none;
    transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1),
        color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
        transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.doma-menu-search__result > i {
    flex-shrink: 0;
    width: 20px;
    color: inherit;
    font-size: 17px;
    text-align: center;
}

.doma-menu-search__result.is-active {
    background: rgba(var(--doma-primary-rgb), 0.07);
    color: var(--vz-vertical-menu-item-hover-color, var(--doma-primary-ink));
    transform: translateX(2px);
}

.doma-menu-search__text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
}

.doma-menu-search__label,
.doma-menu-search__group {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.doma-menu-search__label mark {
    padding: 0;
    background: transparent;
    color: var(--doma-primary);
    font-weight: 600;
}

.doma-menu-search__group {
    color: var(--doma-muted);
    font-size: 11.5px;
    font-weight: 400;
}

.doma-menu-search__empty {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 14px 10px 16px;
    font-size: 12.5px;
    line-height: 1.4;
}

.doma-menu-search__empty strong {
    color: var(--doma-heading);
    font-weight: 600;
}

.doma-menu-search__empty span {
    color: var(--doma-muted);
    overflow-wrap: anywhere;
}
</style>
