import { reactive } from 'vue';

/**
 * Lo que comparten el Centro Novedades de la barra (`DomaNavBar`) y el del menú
 * móvil (`DomaMobileMenu`): qué novedades son de este producto, cuáles no ha
 * abierto el usuario y cómo se escribe su fecha.
 */

// Novedades que el usuario abrió en esta página, en cualquiera de las dos. El
// servidor es la fuente (`seen`), pero se entera una petición después: esto
// evita que vuelva a salir como nueva mientras tanto. Reactivo: abrir una en un
// lado apaga su punto en el otro.
const seenHere = reactive(new Set());

/** Es de este producto: las que traen su slug en `apps` y las que no traen `apps`. */
export function appliesToProduct(item, product) {
    return !Array.isArray(item.apps) || item.apps.length === 0 || item.apps.includes(product);
}

/**
 * Una novedad queda vista solo cuando el usuario la abre, no al abrir el Centro
 * Novedades: mientras quede alguna sin abrir, el botón conserva el punto rojo.
 */
export function isUnseen(item) {
    return !item.seen && !seenHere.has(String(item.id));
}

/** El usuario la abrió: deja de contar como pendiente en esta página. */
export function markSeenHere(id) {
    seenHere.add(String(id));
}

/**
 * Las de este producto, con título e id, y primero las que el usuario no ha
 * abierto; dentro de cada grupo, en el orden en que llegan (la más reciente
 * primero).
 */
export function productNews(announcements, product) {
    return (announcements || [])
        .filter((item) => item?.id != null && item.title && appliesToProduct(item, product))
        .map((item) => ({ ...item, id: String(item.id) }))
        .sort((a, b) => Number(isUnseen(b)) - Number(isUnseen(a)));
}

const DATE_FORMAT = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

/** La fecha si viene como AAAA-MM-DD; si no, null. */
export function isoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? value : null;
}

/** "2026-10-15" → "15 de octubre de 2026"; cualquier otro valor, tal cual. */
export function formatAnnouncementDate(value) {
    if (!isoDate(value)) return value;

    const [year, month, day] = value.split('-').map(Number);

    return DATE_FORMAT.format(new Date(year, month - 1, day));
}
