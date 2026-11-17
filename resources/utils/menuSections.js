/**
 * Las secciones de módulos de un menú DOMA, a partir del catálogo de permisos
 * de Suite (`tenantContext.ownModules` y `ownMenuGroups`): el mismo orden y los
 * mismos grupos que el menú lateral de escritorio de cada app (`menu.vue`).
 *
 * Funciones puras, sin Vue ni Inertia: reciben los datos y devuelven lo que
 * pinta `DomaMobileMenu`.
 *
 *   [{ key, label, items: [{ key, label, icon, href, active }] }]
 *
 * `label` es el nombre del grupo; los módulos sueltos van en secciones sin
 * rótulo.
 */

const DEFAULT_MODULE_ICON = 'ri-apps-line';

// Comparación de nombres sin distinguir mayúsculas ni tildes.
function compareLabels(a, b) {
    return String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base', numeric: true });
}

const bySortOrder = (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);

/**
 * Prefijos del componente Inertia de un módulo: los declarados en `overrides`
 * (separados por comas) o el PascalCase de su código. Las vistas del módulo
 * comparten ese prefijo, así que sirve para marcarlo activo en cualquiera de
 * sus pantallas.
 */
export function modulePrefixes(code, overrides = {}) {
    const value = String(code || '');

    if (!value) return [];

    return String(overrides[value] || value.charAt(0).toUpperCase() + value.slice(1))
        .split(',')
        .map((prefix) => prefix.trim())
        .filter(Boolean);
}

/**
 * Código del módulo de la pantalla actual: el de prefijo más largo que casa con
 * el componente. Así una vista anidada (`Approvals/Consolidated`) gana sobre la
 * de su carpeta (`Approvals`).
 */
export function activeModuleCode(modules, component, overrides = {}) {
    let best = { code: null, length: 0 };

    for (const module of modules || []) {
        for (const prefix of modulePrefixes(module?.code, overrides)) {
            const matches = component === prefix || String(component || '').startsWith(`${prefix}/`);

            if (matches && prefix.length > best.length) {
                best = { code: module.code, length: prefix.length };
            }
        }
    }

    return best.code;
}

/**
 * @param {object}   options
 * @param {Array}    options.modules     Módulos con permiso: { code, name, icon, path, menuGroup, sortOrder }.
 * @param {Array}    options.groups      Grupos del menú: { code, name, sortOrder }.
 * @param {string}   options.component   Componente Inertia de la página actual.
 * @param {object}   [options.overrides] Prefijos de componente que no son el PascalCase del código.
 * @param {Function} [options.subItems]  (módulo) => [{ key, href, label }]: sub-ítems que no son módulos.
 */
export function buildMenuSections({ modules = [], groups = [], component = '', overrides = {}, subItems = () => [] }) {
    const activeCode = activeModuleCode(modules, component, overrides);
    const groupsByCode = new Map(groups.map((group) => [group.code, group]));
    const grouped = new Map();
    const sections = [];

    const toItem = (module) => ({
        key: module.code,
        label: module.name,
        icon: module.icon || DEFAULT_MODULE_ICON,
        href: module.path,
        active: module.code === activeCode,
    });

    for (const module of modules) {
        const children = module ? subItems(module) || [] : [];

        if (!module?.path && !children.length) continue;

        const group = module.menuGroup ? groupsByCode.get(module.menuGroup) : null;

        if (!group) {
            // Un módulo con sub-ítems se pinta como una sección con su nombre.
            const items = children.length
                ? children.map((child) => ({ key: child.key, label: child.label, icon: module.icon || DEFAULT_MODULE_ICON, href: child.href, active: false }))
                : [toItem(module)];

            sections.push({ key: `module-${module.code}`, label: children.length ? module.name : null, sortOrder: module.sortOrder, orderLabel: module.name, items });
            continue;
        }

        if (!grouped.has(group.code)) {
            const section = { key: `group-${group.code}`, label: group.name, sortOrder: group.sortOrder, orderLabel: group.name, modules: [] };
            grouped.set(group.code, section);
            sections.push(section);
        }

        grouped.get(group.code).modules.push(module);
    }

    grouped.forEach((section) => {
        section.items = [...section.modules]
            .sort((a, b) => bySortOrder(a, b) || compareLabels(a.name, b.name))
            .map(toItem);
    });

    return sections
        .sort((a, b) => bySortOrder(a, b) || compareLabels(a.orderLabel, b.orderLabel))
        .map(({ key, label, items }) => ({ key, label, items }));
}
