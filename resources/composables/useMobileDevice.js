import { onBeforeUnmount, onMounted, readonly, ref } from 'vue';
import { isMobileDevice } from '../utils/device.js';

// Segunda lectura tras un `resize`, cuando el User-Agent nuevo ya está aplicado.
const RECHECK_DELAY_MS = 250;

/**
 * `isMobileDevice` reactivo: si la app se está usando desde un teléfono o una
 * tablet, y que se actualice solo cuando eso cambia sin recargar la página.
 *
 * El caso es el modo dispositivo de las DevTools: al activarlo o quitarlo cambia
 * el User-Agent y redimensiona la ventana. Por eso se vuelve a mirar en cada
 * `resize`, y otra vez un momento después: el `resize` puede llegar antes de
 * que el navegador aplique el User-Agent nuevo, y con una sola lectura el
 * primer cambio no se notaba.
 *
 * La regla es la misma de `isMobileDevice` (el dispositivo, no el ancho): una
 * ventana angosta en un computador sigue siendo un computador, y girar un
 * teléfono dispara `resize` sin que el valor cambie.
 *
 * Solo dice cuándo cambia: qué hacer al cambiar (montar o desmontar el menú
 * lateral de escritorio, p. ej.) es de cada app.
 *
 *     // `pageProps`: las props de la página o una función que las devuelve,
 *     // para leer el `isMobile` que la app mande desde su servidor.
 *     const page = usePage();
 *     const { isMobile } = useMobileDevice(() => page.props);
 *
 *     watch(isMobile, (mobile) => (mobile ? desmontarEscritorio() : nextTick(montarEscritorio)));
 *
 * @param {object|Function} [pageProps] Props de la página, o una función que las devuelve.
 * @returns {{ isMobile: import('vue').Ref<boolean> }} Solo lectura.
 */
export function useMobileDevice(pageProps) {
    const read = () => isMobileDevice(typeof pageProps === 'function' ? pageProps() : pageProps);

    const isMobile = ref(read());
    let recheckTimer = null;

    function update() {
        const next = read();

        if (next !== isMobile.value) {
            isMobile.value = next;
        }
    }

    function onResize() {
        update();

        window.clearTimeout(recheckTimer);
        recheckTimer = window.setTimeout(update, RECHECK_DELAY_MS);
    }

    onMounted(() => {
        window.addEventListener('resize', onResize);
        // Por si cambió entre crear el componente y montarlo.
        update();
    });

    onBeforeUnmount(() => {
        window.removeEventListener('resize', onResize);
        window.clearTimeout(recheckTimer);
    });

    return { isMobile: readonly(isMobile) };
}
