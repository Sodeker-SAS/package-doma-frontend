<script setup>
import DomaMobileMenuPanelHeader from './DomaMobileMenuPanelHeader.vue';

/**
 * Vista «Cambiar empresa» de `DomaMobileMenu`: las empresas del usuario con su
 * identificación y la actual marcada. Elegir otra avisa a quien usa el menú;
 * cómo se cambia de empresa lo decide la app. Interno: no se exporta.
 */
defineProps({
    /** [{ id, name, caption? }] */
    tenants: { type: Array, default: () => [] },
    /** { id, name, caption? } */
    current: { type: Object, default: null },
});

defineEmits(['back', 'select']);
</script>

<template>
    <div class="doma-mobile-panel">
        <DomaMobileMenuPanelHeader title="Cambiar empresa" subtitle="Elige con cuál trabajar." @back="$emit('back')" />

        <ul class="doma-mobile-tenants" role="listbox" aria-label="Empresas">
            <li v-for="option in tenants" :key="option.id">
                <button
                    type="button"
                    class="doma-mobile-tenants__option"
                    :class="{ 'is-current': option.id === current?.id }"
                    role="option"
                    :aria-selected="option.id === current?.id"
                    @click="$emit('select', option)"
                >
                    <span class="doma-mobile-tenants__mark"><i class="ri-building-line" aria-hidden="true"></i></span>
                    <span class="doma-mobile-tenants__text">
                        <span class="doma-mobile-tenants__name">{{ option.name }}</span>
                        <span v-if="option.caption" class="doma-mobile-tenants__caption">{{ option.caption }}</span>
                    </span>
                    <i v-if="option.id === current?.id" class="ri-check-line doma-mobile-tenants__check" aria-hidden="true"></i>
                </button>
            </li>
        </ul>
    </div>
</template>

<style scoped>
.doma-mobile-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.doma-mobile-tenants {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 12px;
    overflow-y: auto;
    list-style: none;
}

.doma-mobile-tenants__option {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 8px 12px;
    border: 1px solid var(--doma-border);
    border-radius: var(--doma-radius);
    background: var(--doma-surface);
    color: var(--doma-text);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
}

.doma-mobile-tenants__option.is-current {
    border-color: var(--doma-primary-border);
    background: var(--doma-primary-soft);
    color: var(--doma-primary-ink);
}

.doma-mobile-tenants__mark {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--doma-surface-muted);
    color: var(--doma-muted);
    font-size: 18px;
}

.doma-mobile-tenants__option.is-current .doma-mobile-tenants__mark {
    background: var(--doma-surface);
    color: var(--doma-primary-ink);
}

.doma-mobile-tenants__text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}

.doma-mobile-tenants__name {
    overflow: hidden;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.doma-mobile-tenants__caption {
    color: var(--doma-muted);
    font-size: 12px;
}

.doma-mobile-tenants__check {
    font-size: 18px;
}
</style>
