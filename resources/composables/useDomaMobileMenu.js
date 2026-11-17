import { readonly, ref } from 'vue';

/**
 * Si el menú móvil (`DomaMobileMenu`) está abierto.
 *
 * El botón vive en la barra de cada pantalla (`DomaMobileNavBar`) y el menú una
 * sola vez en el layout móvil de la app: este estado, compartido por toda la
 * página, los une sin que la pantalla tenga que cablear nada.
 *
 *     const { isOpen, open, close } = useDomaMobileMenu();
 */
const isOpen = ref(false);

export function useDomaMobileMenu() {
    return {
        isOpen: readonly(isOpen),
        open: () => {
            isOpen.value = true;
        },
        close: () => {
            isOpen.value = false;
        },
    };
}
