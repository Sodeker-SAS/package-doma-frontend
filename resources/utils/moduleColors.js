/**
 * Color de identidad de cada producto DOMA, por slug: el mismo en el login, en
 * el hub de Suite y en el lanzador de la barra, en Suite y en cada app hija.
 *
 * Por ahora es el primario que cada app usa en su tema. No son los colores
 * definitivos: cuando se definan, se cambian aquí y se publica una versión del
 * paquete; ninguna app tiene que tocar su código.
 */
const MODULE_COLORS = {
    suite: '#25a0e2',
    sat: '#25a0e2',
    iris: '#8c68cd',
    tut: '#4b38b3',
    econnect: '#25a0e2',
    fds: '#68b88c',
    fintegra: '#405189',
    sicot: '#405189',
    msi: '#405189',
    sai: '#d97757',
    kargo: '#405189',
};

/** Para slugs nuevos: siempre el mismo color para el mismo slug. */
const FALLBACK_COLORS = ['#25a0e2', '#405189', '#8c68cd', '#4b38b3', '#68b88c', '#d97757'];

export function moduleColor(slug) {
    const key = String(slug ?? '').toLowerCase();

    if (MODULE_COLORS[key]) {
        return MODULE_COLORS[key];
    }

    const hash = [...key].reduce((total, char) => total + char.charCodeAt(0), 0);

    return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}
