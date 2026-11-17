<script setup>
/**
 * Encabezado de una vista interna de `DomaMobileMenu` (Cambiar empresa,
 * Productos DOMA, Centro Novedades): volver al menú, el título y una línea
 * corta que dice para qué es. Interno: no se exporta.
 */
defineProps({
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
});

defineEmits(['back']);
</script>

<template>
    <div class="doma-mobile-panel-header">
        <button type="button" class="doma-mobile-panel-header__back" aria-label="Volver al menú" @click="$emit('back')">
            <i class="ri-arrow-left-s-line" aria-hidden="true"></i>
        </button>
        <div class="doma-mobile-panel-header__titles">
            <span class="doma-mobile-panel-header__title">{{ title }}</span>
            <span v-if="subtitle" class="doma-mobile-panel-header__subtitle">{{ subtitle }}</span>
        </div>
    </div>
</template>

<style scoped>
.doma-mobile-panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--doma-border);
}

.doma-mobile-panel-header__back {
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

.doma-mobile-panel-header__titles {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.doma-mobile-panel-header__title {
    color: var(--doma-text);
    font-size: 15px;
    font-weight: 600;
}

.doma-mobile-panel-header__subtitle {
    color: var(--doma-muted);
    font-size: 12px;
}
</style>
