/**
 * Shared utilities for ARIA element-reference wiring.
 */

export const SUPPORTS_ELEMENT_REFS = 'ariaControlsElements' in Element.prototype;

/**
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function isShadowElement(element) {
    return element.getRootNode() instanceof ShadowRoot;
}

/**
 * @param {HTMLElement} element
 * @param {string} prefix
 */
export function ensureFallbackId(element, prefix) {
    if (!element.id) {
        element.id = `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }
    return element.id;
}

/**
 * @param {HTMLElement[]} elements
 */
export function prepareRefTargets(elements) {
    return elements.filter(Boolean).map((element, index) => {
        ensureFallbackId(element, `ref-${index}`);
        return element;
    });
}

/**
 * @param {HTMLElement[]} elements
 */
export function collectElementText(elements) {
    return elements
        .map((element) => element.textContent?.trim())
        .filter(Boolean)
        .join(' ');
}

/**
 * @param {HTMLElement[]} elements
 */
export function partitionByRoot(elements) {
    const light = [];
    const shadow = [];

    elements.filter(Boolean).forEach((element) => {
        if (isShadowElement(element)) {
            shadow.push(element);
        } else {
            light.push(element);
        }
    });

    return { light, shadow };
}

/**
 * @param {ElementInternals} internals
 * @param {HTMLElement[]} shadowLabels
 * @param {HTMLElement[]} shadowDescriptions
 */
export function mirrorShadowAccessibleName(internals, shadowLabels, shadowDescriptions) {
    const labelText = collectElementText(shadowLabels);

    if (labelText) {
        internals.ariaLabel = labelText;
    } else {
        internals.ariaLabel = null;
    }

    const descriptionText = collectElementText(shadowDescriptions);

    if ('ariaDescription' in internals) {
        internals.ariaDescription = descriptionText || null;
    }
}
