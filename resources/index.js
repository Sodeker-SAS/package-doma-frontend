/**
 * Punto de entrada público de doma-frontend. Cada componente, composable o
 * directiva nueva se exporta aquí para que las apps lo importen desde '@doma':
 *
 *     import { DomaNavBar } from '@doma';
 */
export { default as DomaNavBar } from './components/DomaNavBar.vue';
export { default as DomaMenuHeader } from './components/DomaMenuHeader.vue';
export { default as DomaMenuSearch } from './components/DomaMenuSearch.vue';
export { default as DomaAnnouncement } from './components/DomaAnnouncement.vue';
export { default as DomaAnnouncementDetail } from './components/DomaAnnouncementDetail.vue';
export { default as DomaMediaViewer } from './components/DomaMediaViewer.vue';
export { default as DomaVideoPlayer } from './components/DomaVideoPlayer.vue';

// Vistas móviles: la barra de las pantallas de entrada y el menú de la app.
export { default as DomaMobileLayout } from './components/mobile/DomaMobileLayout.vue';
export { default as DomaMobileNavBar } from './components/mobile/DomaMobileNavBar.vue';
export { default as DomaMobileMenu } from './components/mobile/DomaMobileMenu.vue';
export { default as DomaMobileMenuButton } from './components/mobile/DomaMobileMenuButton.vue';
export { default as DomaMobileAccountMenu } from './components/mobile/DomaMobileAccountMenu.vue';

export { useDismiss } from './composables/useDismiss.js';
export { useDomaMobileMenu } from './composables/useDomaMobileMenu.js';

export { vDomaTooltip } from './directives/domaTooltip.js';

export { moduleColor } from './utils/moduleColors.js';
export { DOMA_LAYOUT_ATTR, holdDomaLayout, releaseDomaLayout } from './utils/domaLayout.js';
export { activeModuleCode, buildMenuSections } from './utils/menuSections.js';
export { isMobileDevice, isMobileUserAgent } from './utils/device.js';
