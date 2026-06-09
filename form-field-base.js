/**
 * Logging and re-exports for host-role form field demos.
 */

import { SUPPORTS_ELEMENT_REFS } from './aria-ref-utils.js';

export { SUPPORTS_ELEMENT_REFS } from './aria-ref-utils.js';
export {
    collectSlottedFieldRefs,
    resolveLightFieldRefs,
    watchRefTargets,
    watchSlottedFieldRefs,
} from './field-ref-watchers.js';
export { SplitSurfaceAriaController } from './split-surface-aria-controller.js';
export { SlottedFieldAriaController } from './slotted-field-aria-controller.js';
export {
    syncHostFieldAriaRefs,
    syncAriaElementRefs,
} from './split-surface-aria-controller.js';
export {
    establishSlottedFieldAriaSync,
} from './slotted-field-aria-controller.js';

/**
 * @param {string} logKey
 * @returns {HTMLElement | null}
 */
export function resolveLogElement(logKey) {
    return document.querySelector(`.log[data-aria-log="${logKey}"]`);
}

/**
 * @param {string} logKey
 * @param {(logEl: HTMLElement) => void} render
 */
export function createLogRefresher(logKey, render) {
    const refresh = () => {
        const logEl = resolveLogElement(logKey);
        if (logEl) {
            render(logEl);
        }
    };

    refresh();
    queueMicrotask(refresh);

    return refresh;
}

/**
 * @param {HTMLElement} statusEl
 */
export function renderSupportStatus(statusEl) {
    statusEl.innerHTML = SUPPORTS_ELEMENT_REFS
        ? '<strong>Supported:</strong> Shadow label/help use <code>ElementInternals</code> element refs plus mirrored <code>ariaLabel</code> / <code>ariaDescription</code>. Light or slotted label/help use the host. Widget <code>role</code> is on <code>internals</code>.'
        : '<strong>Fallback:</strong> Light DOM label/help use <code>aria-labelledby</code> / <code>aria-describedby</code> on the host. Shadow-only label/help cannot be linked without element refs.';
}

/**
 * @param {HTMLElement} logEl
 * @param {HTMLElement} host
 * @param {ElementInternals} internals
 * @param {HTMLElement[]} labels
 * @param {HTMLElement[]} descriptions
 */
export function logHostFieldAriaRefs(logEl, host, internals, labels, descriptions) {
    const lines = [];
    const role = SUPPORTS_ELEMENT_REFS ? internals.role : host.getAttribute('role');

    lines.push(`role="${role ?? ''}" (via ${SUPPORTS_ELEMENT_REFS ? 'internals' : 'host'})`);

    if (SUPPORTS_ELEMENT_REFS) {
        lines.push(
            `internals.ariaLabelledByElements → ${formatElements(internals.ariaLabelledByElements)}`
        );
        lines.push(
            `internals.ariaDescribedByElements → ${formatElements(internals.ariaDescribedByElements)}`
        );
        lines.push(
            `host.ariaLabelledByElements → ${formatElements(host.ariaLabelledByElements)}`
        );
        lines.push(
            `host.ariaDescribedByElements → ${formatElements(host.ariaDescribedByElements)}`
        );

        if (internals.ariaLabel) {
            lines.push(`internals.ariaLabel="${internals.ariaLabel}"`);
        }

        if ('ariaDescription' in internals && internals.ariaDescription) {
            lines.push(`internals.ariaDescription="${internals.ariaDescription}"`);
        }

        if (labels.length) {
            lines.push(`label ID refs → ${labels.map((el) => el.id).join(' ')}`);
        }

        if (descriptions.length) {
            lines.push(`description ID refs → ${descriptions.map((el) => el.id).join(' ')}`);
        }
    } else {
        lines.push(`aria-labelledby="${host.getAttribute('aria-labelledby') ?? ''}"`);
        lines.push(`aria-describedby="${host.getAttribute('aria-describedby') ?? ''}"`);
    }

    if (role === 'checkbox') {
        const checked = SUPPORTS_ELEMENT_REFS
            ? internals.ariaChecked
            : host.getAttribute('aria-checked');
        lines.push(`aria-checked="${checked ?? ''}"`);
    }

    if (role === 'textbox') {
        lines.push(`value="${host.getAttribute('value') ?? ''}"`);
    }

    if (role === 'progressbar') {
        const valueNow = SUPPORTS_ELEMENT_REFS
            ? internals.ariaValueNow
            : host.getAttribute('aria-valuenow');
        const valueMin = SUPPORTS_ELEMENT_REFS
            ? internals.ariaValueMin
            : host.getAttribute('aria-valuemin');
        const valueMax = SUPPORTS_ELEMENT_REFS
            ? internals.ariaValueMax
            : host.getAttribute('aria-valuemax');
        const valueText = SUPPORTS_ELEMENT_REFS
            ? internals.ariaValueText
            : host.getAttribute('aria-valuetext');

        lines.push(`aria-valuenow="${valueNow ?? ''}"`);
        lines.push(`aria-valuemin="${valueMin ?? ''}"`);
        lines.push(`aria-valuemax="${valueMax ?? ''}"`);
        if (valueText) {
            lines.push(`aria-valuetext="${valueText}"`);
        }
    }

    labels.forEach((label, i) => {
        lines.push(`label[${i}]: ${describeElement(label)} (${label.textContent?.trim()})`);
    });
    descriptions.forEach((desc, i) => {
        lines.push(`description[${i}]: ${describeElement(desc)} (${desc.textContent?.trim()})`);
    });

    logEl.textContent = lines.join('\n');
}

/**
 * @param {HTMLElement[] | undefined} elements
 */
function formatElements(elements) {
    if (!elements?.length) {
        return '[]';
    }
    return `[${elements.map((el) => describeElement(el)).join(', ')}]`;
}

/**
 * @param {HTMLElement} element
 */
function describeElement(element) {
    const parts = [element.tagName.toLowerCase()];
    if (element.id) {
        parts.push(`#${element.id}`);
    }
    const root = element.getRootNode();
    parts.push(root instanceof ShadowRoot ? '(shadow)' : '(light)');
    return parts.join('');
}
