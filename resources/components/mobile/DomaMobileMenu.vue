<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { isUnseen, markSeenHere, productNews } from '../../utils/announcements.js';
import DomaAnnouncementDetail from '../DomaAnnouncementDetail.vue';
import DomaMobileMenuNovelties from './DomaMobileMenuNovelties.vue';
import DomaMobileMenuProducts from './DomaMobileMenuProducts.vue';
import DomaMobileMenuTenants from './DomaMobileMenuTenants.vue';

/**
 * Menú de una app DOMA en las vistas móviles: un panel lateral con el usuario,
 * la empresa, las acciones de la barra de escritorio (Productos, Centro
 * Novedades y Configuración), los módulos de la app y «Cerrar sesión».
 *
 * Es el equivalente móvil de `DomaNavBar` más el menú lateral, y recibe los
 * mismos datos con los mismos nombres. No conoce el router, la sesión ni el
 * dispositivo: todo llega por props y las acciones salen por eventos. La app lo
 * monta una sola vez en su layout móvil y lo abre `DomaMobileMenuButton` (por
 * `useDomaMobileMenu`).
 */
const props = defineProps({
    open: { type: Boolean, default: false },
    /** { name, caption?, avatarUrl? } */
    user: { type: Object, default: null },
    /** Empresa actual: { id, name, caption? }. */
    tenant: { type: Object, default: null },
    /** Empresas a las que se puede cambiar: [{ id, name, caption? }]. */
    tenants: { type: Array, default: () => [] },
    /** Permite cambiar de empresa desde aquí (p. ej. solo en listados). */
    tenantSwitchable: { type: Boolean, default: true },
    /** Productos del lanzador, los mismos `modules` de DomaNavBar: [{ slug, name, icon?, url, accessible?, color? }]. */
    products: { type: Array, default: () => [] },
    /** Slug del producto en el que se está. */
    currentProduct: { type: String, default: '' },
    /** Inicio DOMA (hub de Suite), al pie de Productos. */
    homeUrl: { type: String, default: '' },
    /** Configuración DOMA; vacío oculta el acceso. */
    configUrl: { type: String, default: '' },
    /** Acceso Novedades, como `noveltiesCenter` de DomaNavBar; en false se oculta. */
    noveltiesCenter: { type: Boolean, default: true },
    /** Centro Novedades: las mismas `announcements` de DomaNavBar. */
    announcements: { type: Array, default: () => [] },
    /** Administrar novedades, solo para quien puede hacerlo. */
    manageUrl: { type: String, default: '' },
    /**
     * Módulos de la app (`buildMenuSections`):
     * [{ key, label, icon?, collapsible?, active?, items: [{ key, label, icon, href, active }] }].
     * Una sección `collapsible` se pinta como desplegable, igual que en escritorio.
     */
    sections: { type: Array, default: () => [] },
    /** Con qué se pintan los enlaces a los módulos: `a` o el `Link` de Inertia. */
    linkComponent: { type: [String, Object], default: 'a' },
    logoutable: { type: Boolean, default: true },
});

const emit = defineEmits(['close', 'select-tenant', 'logout', 'announcements-seen']);

/** main | tenants | products | novelties */
const view = ref('main');
const closeButton = ref(null);
const detail = ref(null);
const detailIsNew = ref(false);
/** Claves de los desplegables abiertos. */
const expanded = ref(new Set());

const userInitials = computed(() => String(props.user?.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase());

const canSwitchTenant = computed(() => props.tenantSwitchable && props.tenants.length > 1);
const hasProducts = computed(() => props.products.length > 0 || Boolean(props.homeUrl));

// Las de este producto, primero las que no ha abierto (las mismas de la barra).
const news = computed(() => productNews(props.announcements, props.currentProduct)
    .map((item) => ({ ...item, unseen: isUnseen(item) })));
const unseenCount = computed(() => news.value.filter((item) => item.unseen).length);

// Al abrir, siempre la vista principal, abierto el desplegable de la pantalla
// actual y el foco en «Cerrar el menú».
watch(() => props.open, (value) => {
    if (!value) return;

    view.value = 'main';
    expanded.value = new Set(props.sections.filter((section) => section.collapsible && section.active).map((section) => section.key));
    nextTick(() => closeButton.value?.focus());
});

function close() {
    emit('close');
}

function toggleSection(key) {
    const next = new Set(expanded.value);

    if (next.has(key)) next.delete(key);
    else next.add(key);

    expanded.value = next;
}

function selectTenant(option) {
    if (option?.id !== props.tenant?.id) emit('select-tenant', option);
    close();
}

// Abrirla la marca vista: la app lo registra en el servidor (`announcements-seen`).
function openAnnouncement(item) {
    detailIsNew.value = item.unseen;
    detail.value = item;

    if (item.unseen) {
        markSeenHere(item.id);
        emit('announcements-seen', [item.id]);
    }
}
</script>

<template>
    <Teleport to="body">
        <Transition name="doma-mobile-menu-fade">
            <div v-if="open" class="doma-mobile-menu-backdrop" aria-hidden="true" @click="close"></div>
        </Transition>

        <Transition name="doma-mobile-menu-slide">
            <nav v-if="open" class="doma-mobile-menu" role="dialog" aria-modal="true" aria-label="Menú" @keydown.esc="close">
                <template v-if="view === 'main'">
                    <div class="doma-mobile-menu__user">
                        <span class="doma-mobile-menu__avatar">
                            <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="" />
                            <template v-else>{{ userInitials }}</template>
                        </span>
                        <div class="doma-mobile-menu__user-text">
                            <span class="doma-mobile-menu__user-name">{{ user?.name }}</span>
                            <span v-if="user?.caption" class="doma-mobile-menu__user-caption">{{ user.caption }}</span>
                        </div>
                        <button ref="closeButton" type="button" class="doma-mobile-menu__close" aria-label="Cerrar el menú" @click="close">
                            <i class="ri-close-line" aria-hidden="true"></i>
                        </button>
                    </div>

                    <component
                        :is="canSwitchTenant ? 'button' : 'div'"
                        v-if="tenant"
                        :type="canSwitchTenant ? 'button' : null"
                        class="doma-mobile-menu__tenant"
                        @click="canSwitchTenant && (view = 'tenants')"
                    >
                        <i class="ri-building-line doma-mobile-menu__tenant-icon" aria-hidden="true"></i>
                        <span class="doma-mobile-menu__tenant-text">
                            <span class="doma-mobile-menu__tenant-label">Empresa</span>
                            <span class="doma-mobile-menu__tenant-name">{{ tenant.name }}</span>
                        </span>
                        <span v-if="canSwitchTenant" class="doma-mobile-menu__tenant-change">Cambiar</span>
                    </component>

                    <div class="doma-mobile-menu__actions">
                        <button v-if="hasProducts" type="button" class="doma-mobile-menu__action" @click="view = 'products'">
                            <i class="ri-apps-2-line" aria-hidden="true"></i>
                            Productos
                        </button>
                        <button
                            v-if="noveltiesCenter"
                            type="button"
                            class="doma-mobile-menu__action"
                            :aria-label="unseenCount ? `Novedades, ${unseenCount} pendientes por ver` : 'Novedades'"
                            @click="view = 'novelties'"
                        >
                            <i class="ri-megaphone-line" aria-hidden="true"></i>
                            Novedades
                            <span v-if="unseenCount" class="doma-mobile-menu__badge" aria-hidden="true">{{ unseenCount }}</span>
                        </button>
                        <a v-if="configUrl" :href="configUrl" class="doma-mobile-menu__action">
                            <i class="ri-settings-3-line" aria-hidden="true"></i>
                            Configuración
                        </a>
                    </div>

                    <!-- Los módulos, con el aspecto del menú lateral de escritorio: título «Menú» y el activo en el primario sólido. -->
                    <div class="doma-mobile-menu__modules">
                        <span class="doma-mobile-menu__section">Menú</span>
                        <template v-for="section in sections" :key="section.key">
                            <template v-if="section.collapsible">
                                <button
                                    type="button"
                                    class="doma-mobile-menu__module doma-mobile-menu__group"
                                    :class="{ 'is-open': expanded.has(section.key), 'has-active': section.active }"
                                    :aria-expanded="expanded.has(section.key) ? 'true' : 'false'"
                                    :aria-controls="`doma-mobile-menu-${section.key}`"
                                    @click="toggleSection(section.key)"
                                >
                                    <i :class="section.icon || 'ri-folder-line'" aria-hidden="true"></i>
                                    <span>{{ section.label }}</span>
                                    <i class="ri-arrow-right-s-line doma-mobile-menu__chevron" aria-hidden="true"></i>
                                </button>
                                <div v-show="expanded.has(section.key)" :id="`doma-mobile-menu-${section.key}`" class="doma-mobile-menu__group-items">
                                    <component
                                        :is="linkComponent"
                                        v-for="item in section.items"
                                        :key="`${section.key}-${item.key}`"
                                        :href="item.href"
                                        class="doma-mobile-menu__module doma-mobile-menu__sub-module"
                                        :class="{ 'is-active': item.active }"
                                        :aria-current="item.active ? 'page' : null"
                                        @click="close"
                                    >
                                        <span>{{ item.label }}</span>
                                    </component>
                                </div>
                            </template>
                            <template v-else>
                                <span v-if="section.label" class="doma-mobile-menu__section">{{ section.label }}</span>
                                <component
                                    :is="linkComponent"
                                    v-for="item in section.items"
                                    :key="`${section.key}-${item.key}`"
                                    :href="item.href"
                                    class="doma-mobile-menu__module"
                                    :class="{ 'is-active': item.active }"
                                    :aria-current="item.active ? 'page' : null"
                                    @click="close"
                                >
                                    <i :class="item.icon" aria-hidden="true"></i>
                                    <span>{{ item.label }}</span>
                                </component>
                            </template>
                        </template>
                    </div>

                    <div v-if="logoutable" class="doma-mobile-menu__footer">
                        <button type="button" class="doma-mobile-menu__module doma-mobile-menu__logout" @click="$emit('logout')">
                            <i class="ri-logout-box-r-line" aria-hidden="true"></i>
                            <span>Cerrar sesión</span>
                        </button>
                    </div>
                </template>

                <DomaMobileMenuTenants v-else-if="view === 'tenants'" :tenants="tenants" :current="tenant" @back="view = 'main'" @select="selectTenant" />

                <DomaMobileMenuProducts
                    v-else-if="view === 'products'"
                    :products="products"
                    :current="currentProduct"
                    :home-url="homeUrl"
                    @back="view = 'main'"
                />

                <DomaMobileMenuNovelties
                    v-else-if="view === 'novelties'"
                    :items="news"
                    :manage-url="manageUrl"
                    @back="view = 'main'"
                    @open="openAnnouncement"
                />
            </nav>
        </Transition>

        <DomaAnnouncementDetail :open="Boolean(detail)" :announcement="detail" :is-new="detailIsNew" @close="detail = null" />
    </Teleport>
</template>

<style scoped>
/*
 * Prefijo propio `doma-mobile-menu`: `.app-menu` es el menú lateral de la
 * plantilla Velzon, que lo esconde en teléfono (`margin-left: -100%`). Con ese
 * nombre el panel se abría fuera de la pantalla.
 */
.doma-mobile-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1050;
    background: var(--doma-backdrop);
}

.doma-mobile-menu {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 1051;
    display: flex;
    flex-direction: column;
    width: min(320px, 86vw);
    padding-bottom: env(safe-area-inset-bottom);
    overflow: hidden;
    background: var(--doma-surface);
    box-shadow: var(--doma-shadow-menu);
    color: var(--doma-text);
    font-family: var(--doma-font);
}

/* ---------- Usuario ---------- */

.doma-mobile-menu__user {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
}

.doma-mobile-menu__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 40px;
    height: 40px;
    overflow: hidden;
    border-radius: 50%;
    background: var(--doma-primary);
    color: var(--doma-on-primary);
    font-size: 14px;
    font-weight: 600;
}

.doma-mobile-menu__avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.doma-mobile-menu__user-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}

.doma-mobile-menu__user-name,
.doma-mobile-menu__user-caption {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.doma-mobile-menu__user-name {
    font-size: 15px;
    font-weight: 600;
}

.doma-mobile-menu__user-caption {
    color: var(--doma-muted);
    font-size: 12px;
}

.doma-mobile-menu__close {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: var(--doma-radius);
    background: var(--doma-surface-muted);
    color: var(--doma-text);
    font-size: 22px;
    cursor: pointer;
}

/* ---------- Empresa ---------- */

.doma-mobile-menu__tenant {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 12px;
    padding: 10px 12px;
    border: 0;
    border-radius: var(--doma-radius);
    background: var(--doma-surface-muted);
    color: inherit;
    font-family: inherit;
    text-align: left;
}

button.doma-mobile-menu__tenant {
    cursor: pointer;
}

.doma-mobile-menu__tenant-icon {
    color: var(--doma-muted);
    font-size: 20px;
}

.doma-mobile-menu__tenant-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}

.doma-mobile-menu__tenant-label {
    color: var(--doma-muted);
    font-size: 11px;
}

.doma-mobile-menu__tenant-name {
    overflow: hidden;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.doma-mobile-menu__tenant-change {
    color: var(--doma-primary);
    font-size: 13px;
    font-weight: 600;
}

/* ---------- Productos, Novedades y Configuración ---------- */

.doma-mobile-menu__actions {
    display: grid;
    /* Una columna por acción visible: Productos y Configuración pueden no estar. */
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--doma-border);
}

.doma-mobile-menu__action {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 4px;
    border: 1px solid var(--doma-border);
    border-radius: var(--doma-radius);
    background: var(--doma-surface);
    color: var(--doma-text);
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
}

.doma-mobile-menu__action i {
    color: var(--doma-muted);
    font-size: 20px;
}

.doma-mobile-menu__action:active {
    background: var(--doma-surface-muted);
}

.doma-mobile-menu__badge {
    position: absolute;
    top: 6px;
    right: 8px;
    min-width: 18px;
    padding: 1px 5px;
    border-radius: 999px;
    background: var(--doma-danger);
    color: var(--doma-on-primary);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.4;
    text-align: center;
}

/* ---------- Módulos ---------- */

.doma-mobile-menu__modules {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-height: 0;
    padding: 8px 10px;
    overflow-y: auto;
    overscroll-behavior: contain;
}

/* Título de sección como `.menu-title` del menú lateral (styles/menu.css). */
.doma-mobile-menu__section {
    padding: 8px 10px 6px;
    color: var(--vz-vertical-menu-title-color, var(--doma-muted));
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    opacity: 0.85;
}

/* Ítem como `.menu-link` del menú lateral, con el alto que pide el dedo. */
.doma-mobile-menu__module {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--doma-radius);
    background: transparent;
    color: var(--vz-vertical-menu-item-color, var(--doma-text));
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
}

.doma-mobile-menu__module i {
    flex-shrink: 0;
    width: 20px;
    font-size: 18px;
    text-align: center;
}

/* El activo, como en el menú lateral: el primario sólido y su texto. */
.doma-mobile-menu__module.is-active {
    background: var(--doma-primary);
    color: var(--doma-on-primary);
}

/* Desplegable de un grupo, como `.menu-dropdown` del menú lateral. */
.doma-mobile-menu__group span {
    flex: 1;
}

.doma-mobile-menu__group.has-active {
    color: var(--doma-primary);
}

.doma-mobile-menu__chevron {
    transition: transform 0.2s ease;
}

.doma-mobile-menu__group.is-open .doma-mobile-menu__chevron {
    transform: rotate(90deg);
}

.doma-mobile-menu__group-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

/* Sangría hasta el texto del grupo: 12 de relleno + 20 de ícono + 14 de separación. */
.doma-mobile-menu__sub-module {
    padding-left: 46px;
}

/* ---------- Cerrar sesión ---------- */

.doma-mobile-menu__footer {
    padding: 10px;
    border-top: 1px solid var(--doma-border);
}

.doma-mobile-menu__logout {
    color: var(--doma-danger);
}

/* ---------- Entrada y salida ---------- */

.doma-mobile-menu-slide-enter-active,
.doma-mobile-menu-slide-leave-active {
    transition: transform 0.22s ease;
}

.doma-mobile-menu-slide-enter-from,
.doma-mobile-menu-slide-leave-to {
    transform: translateX(-100%);
}

.doma-mobile-menu-fade-enter-active,
.doma-mobile-menu-fade-leave-active {
    transition: opacity 0.22s ease;
}

.doma-mobile-menu-fade-enter-from,
.doma-mobile-menu-fade-leave-to {
    opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
    .doma-mobile-menu-slide-enter-active,
    .doma-mobile-menu-slide-leave-active,
    .doma-mobile-menu-fade-enter-active,
    .doma-mobile-menu-fade-leave-active {
        transition: none;
    }
}
</style>
