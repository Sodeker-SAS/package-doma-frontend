<script setup>
import { formatAnnouncementDate, isoDate } from '../../utils/announcements.js';
import DomaMobileMenuPanelHeader from './DomaMobileMenuPanelHeader.vue';

/**
 * Vista «Centro Novedades» de `DomaMobileMenu`: las novedades de este producto,
 * las que el usuario no ha abierto primero y resaltadas. Abrir una avisa a
 * quien usa el menú, que muestra su detalle. «Administrar novedades» solo
 * llega para los roles que pueden hacerlo. Interno: no se exporta.
 */
defineProps({
    /** Novedades ya filtradas y ordenadas (`productNews`), cada una con `unseen`. */
    items: { type: Array, default: () => [] },
    manageUrl: { type: String, default: '' },
});

defineEmits(['back', 'open']);
</script>

<template>
    <div class="doma-mobile-panel">
        <DomaMobileMenuPanelHeader title="Centro Novedades" subtitle="Actualizaciones DOMA" @back="$emit('back')" />

        <ul v-if="items.length" class="doma-mobile-news">
            <li v-for="item in items" :key="item.id">
                <button type="button" class="doma-mobile-news__item" :class="{ 'is-unseen': item.unseen }" @click="$emit('open', item)">
                    <i
                        :class="[item.icon || 'ri-megaphone-line', { 'is-critical': item.critical }]"
                        class="doma-mobile-news__icon"
                        aria-hidden="true"
                    ></i>
                    <span class="doma-mobile-news__text">
                        <span class="doma-mobile-news__title">{{ item.title }}</span>
                        <time v-if="item.date" class="doma-mobile-news__date" :datetime="isoDate(item.date)">
                            Aplica el {{ formatAnnouncementDate(item.date) }}
                        </time>
                        <span v-if="item.unseen" class="doma-mobile-news__pending">Pendiente por ver.</span>
                    </span>
                    <i class="ri-arrow-right-s-line doma-mobile-news__go" aria-hidden="true"></i>
                </button>
            </li>
        </ul>

        <p v-else class="doma-mobile-news__empty">
            <i class="ri-inbox-line" aria-hidden="true"></i>
            Sin novedades.
        </p>

        <div v-if="manageUrl" class="doma-mobile-news__footer">
            <a :href="manageUrl" class="doma-mobile-news__manage">
                <i class="ri-edit-2-line" aria-hidden="true"></i>
                Administrar novedades
            </a>
        </div>
    </div>
</template>

<style scoped>
.doma-mobile-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.doma-mobile-news {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 12px;
    overflow-y: auto;
    list-style: none;
}

.doma-mobile-news__item {
    display: flex;
    gap: 8px;
    width: 100%;
    padding: 12px;
    border: 1px solid var(--doma-border);
    border-radius: var(--doma-radius);
    background: var(--doma-surface);
    color: var(--doma-text);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
}

.doma-mobile-news__item.is-unseen {
    border-color: var(--doma-primary-border);
    background: var(--doma-primary-soft);
}

.doma-mobile-news__icon {
    flex: none;
    color: var(--doma-muted);
    font-size: 18px;
}

.doma-mobile-news__icon.is-critical {
    color: var(--doma-warning);
}

.doma-mobile-news__text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}

.doma-mobile-news__title {
    font-weight: 600;
}

.doma-mobile-news__date {
    color: var(--doma-muted);
    font-size: 12px;
}

.doma-mobile-news__pending {
    color: var(--doma-primary-ink);
    font-size: 11px;
    font-weight: 600;
}

.doma-mobile-news__go {
    color: var(--doma-muted);
}

.doma-mobile-news__empty {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 16px;
    color: var(--doma-muted);
}

.doma-mobile-news__footer {
    margin-top: auto;
    padding: 12px;
    border-top: 1px solid var(--doma-border);
}

.doma-mobile-news__manage {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    border-radius: var(--doma-radius);
    background: var(--doma-surface-muted);
    color: var(--doma-text);
    font-weight: 600;
    text-decoration: none;
}
</style>
