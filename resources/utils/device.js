/**
 * ¿La app se está usando desde un teléfono o una tablet?
 *
 * Decide si una app DOMA muestra las vistas móviles (`DomaMobileLayout`, la
 * barra y el menú móviles) o las de escritorio. No es un ajuste de tamaño: una
 * ventana angosta en un computador sigue siendo un computador, y un computador
 * táctil se usa como computador. Por eso se mira el dispositivo y no el ancho.
 *
 * 1. Si la app manda `isMobile` en las props de la página (su servidor lo
 *    decidió por el User-Agent), se usa ese dato.
 * 2. Si no lo manda, se mira el User-Agent en el navegador, con la misma regla.
 *    Las páginas las pinta el navegador, así que el resultado es el mismo y la
 *    app no necesita nada en su servidor.
 * 3. En los dos casos se suma el iPad: desde iPadOS 13 Safari se presenta como
 *    un Mac de escritorio y lo único que lo distingue es la pantalla táctil.
 *
 *     import { isMobileDevice } from '@doma';
 *     isMobileDevice(page.props);   // en Options API: isMobileDevice(this.$page.props)
 */
const MOBILE_USER_AGENT = /(android|iphone|ipad|ipod|blackberry|windows phone|mobile)/i;

/** Teléfono o tablet según un User-Agent (la misma regla del lado del servidor). */
export function isMobileUserAgent(userAgent) {
    return MOBILE_USER_AGENT.test(String(userAgent ?? ''));
}

/** Safari de iPad con el User-Agent de un Mac: un Mac con pantalla táctil. */
function isIpadPresentingAsMac() {
    if (typeof navigator === 'undefined') return false;

    return /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}

/**
 * @param {object} [pageProps] Las props de la página (`$page.props`); `isMobile` es opcional.
 * @returns {boolean}
 */
export function isMobileDevice(pageProps) {
    const fromServer = pageProps?.isMobile;
    const mobile = typeof fromServer === 'boolean'
        ? fromServer
        : typeof navigator !== 'undefined' && isMobileUserAgent(navigator.userAgent);

    return mobile || isIpadPresentingAsMac();
}
