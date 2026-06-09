/**
 * Cross-root ARIA logging and re-exports (shadow inner surface → light label/help).
 */

import { SUPPORTS_ELEMENT_REFS } from './aria-ref-utils.js';
import { createLogRefresher, resolveLightFieldRefs } from './form-field-base.js';

export { createLogRefresher, resolveLightFieldRefs } from './form-field-base.js';
export { InnerCrossRootAriaController } from './inner-cross-root-aria-controller.js';
export {
    establishInnerCrossRootAriaSync,
    wireInnerCrossRootAriaRefs,
} from './inner-cross-root-aria-controller.js';

export const SUPPORTS_INNER_CROSS_ROOT_REFS = SUPPORTS_ELEMENT_REFS;

/**
 * @param {HTMLElement | null} innerSurface
 */
function describeInnerSurface(innerSurface) {
    if (!innerSurface) {
        return '(missing)';
    }

    const parts = [innerSurface.tagName.toLowerCase()];

    if (innerSurface.getAttribute('type')) {
        parts.push(`type="${innerSurface.getAttribute('type')}"`);
    }

    if (innerSurface.getAttribute('role')) {
        parts.push(`role="${innerSurface.getAttribute('role')}"`);
    }

    const root = innerSurface.getRootNode();
    parts.push(root instanceof ShadowRoot ? '(shadow)' : '(light)');

    return parts.join(' ');
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

    parts.push(element.getRootNode() === document ? '(light)' : '(other)');

    return parts.join('');
}

/**
 * @param {HTMLElement} logEl
 * @param {HTMLElement | null} innerSurface
 * @param {HTMLElement[]} labelElements
 * @param {HTMLElement[]} descriptionElements
 */
export function logInnerCrossRootAriaRefs(logEl, innerSurface, labelElements, descriptionElements) {
    const lines = [];
    const labels = labelElements.filter(Boolean);
    const descriptions = descriptionElements.filter(Boolean);

    lines.push(`inner surface: ${describeInnerSurface(innerSurface)}`);
    lines.push(
        `cross-root direction: shadow → light (${SUPPORTS_INNER_CROSS_ROOT_REFS ? 'element refs' : 'unsupported'})`
    );
    lines.push('');

    labels.forEach((label, index) => {
        lines.push(`light label[${index}]: ${describeElement(label)} ("${label.textContent?.trim()}")`);
    });

    descriptions.forEach((description, index) => {
        lines.push(
            `light description[${index}]: ${describeElement(description)} ("${description.textContent?.trim()}")`
        );
    });

    lines.push('');

    if (!SUPPORTS_INNER_CROSS_ROOT_REFS) {
        lines.push('❌ ariaLabelledByElements / ariaDescribedByElements unavailable.');
        lines.push('   String ID fallback (aria-labelledby / aria-describedby) is shadow-scoped');
        lines.push('   and cannot reference light DOM targets from an inner shadow surface.');
        logEl.textContent = lines.join('\n');
        return;
    }

    if (!innerSurface) {
        lines.push('❌ No inner ARIA surface found.');
        logEl.textContent = lines.join('\n');
        return;
    }

    const labelledBy = innerSurface.ariaLabelledByElements;
    const describedBy = innerSurface.ariaDescribedByElements;

    lines.push(`inner.ariaLabelledByElements → ${formatElements(labelledBy)}`);
    lines.push(`inner.ariaDescribedByElements → ${formatElements(describedBy)}`);

    if (labels.length) {
        lines.push(`verify label ref: ${labelledBy?.[0] === labels[0]}`);
    }

    if (descriptions.length) {
        lines.push(`verify description ref: ${describedBy?.[0] === descriptions[0]}`);
    }

    lines.push('');
    lines.push(
        `aria-labelledby attribute = ${innerSurface.getAttribute('aria-labelledby') ?? '(not set)'}`
    );
    lines.push(
        `aria-describedby attribute = ${innerSurface.getAttribute('aria-describedby') ?? '(not set)'}`
    );

    if (innerSurface.matches('[role="progressbar"]')) {
        lines.push(`aria-valuenow="${innerSurface.getAttribute('aria-valuenow') ?? ''}"`);
        lines.push(`aria-valuetext="${innerSurface.getAttribute('aria-valuetext') ?? ''}"`);
    }

    if (innerSurface.matches('input[type="checkbox"]')) {
        lines.push(`checked=${innerSurface.checked}`);
    }

    logEl.textContent = lines.join('\n');
}

/**
 * @param {HTMLElement} statusEl
 */
export function renderCrossRootSupportStatus(statusEl) {
    statusEl.innerHTML = SUPPORTS_INNER_CROSS_ROOT_REFS
        ? '<strong>Supported:</strong> Inner shadow surface uses <code>ariaLabelledByElements</code> / <code>ariaDescribedByElements</code> to reference light DOM label and help (<a href="https://codepen.io/spectrum-css/pen/pvNEVda">CodePen POC</a>). Direction is shadow → light only.'
        : '<strong>Unsupported:</strong> Reflected element references are unavailable in this browser. Cross-root label/help from an inner shadow control has no safe fallback.';
}
