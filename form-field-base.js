/**
 * Shared helpers for form controls with ARIA role on the custom element host.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/ariaLabelledByElements
 */

export const SUPPORTS_ELEMENT_REFS = 'ariaControlsElements' in Element.prototype;

/**
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isShadowElement(element) {
    return element.getRootNode() instanceof ShadowRoot;
}

/**
 * @param {HTMLElement} element
 * @param {string} prefix
 */
function ensureFallbackId(element, prefix) {
    if (!element.id) {
        element.id = `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }
    return element.id;
}

/**
 * @param {HTMLElement[]} elements
 */
function prepareRefTargets(elements) {
    return elements.filter(Boolean).map((element, index) => {
        ensureFallbackId(element, `ref-${index}`);
        return element;
    });
}

/**
 * @param {string} logKey
 * @returns {HTMLElement | null}
 */
export function resolveLogElement(logKey) {
    return document.querySelector(`.log[data-aria-log="${logKey}"]`);
}

/**
 * @param {HTMLElement[]} elements
 */
function partitionByRoot(elements) {
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
 * @param {HTMLElement} host
 * @param {ElementInternals} internals
 * @param {string} role
 * @param {HTMLElement[]} labelElements
 * @param {HTMLElement[]} descriptionElements
 * @param {{ focusable?: boolean }} [options]
 */
export function syncHostFieldAriaRefs(
    host,
    internals,
    role,
    labelElements = [],
    descriptionElements = [],
    options = {}
) {
    const { focusable = true } = options;

    host.setAttribute('role', role);

    if (focusable) {
        host.setAttribute('tabindex', '0');
    } else {
        host.removeAttribute('tabindex');
    }

    const { light: lightLabels, shadow: shadowLabels } = partitionByRoot(labelElements);
    const { light: lightDescriptions, shadow: shadowDescriptions } =
        partitionByRoot(descriptionElements);

    const preparedLightLabels = prepareRefTargets(lightLabels);
    const preparedShadowLabels = prepareRefTargets(shadowLabels);
    const preparedLightDescriptions = prepareRefTargets(lightDescriptions);
    const preparedShadowDescriptions = prepareRefTargets(shadowDescriptions);

    if (!SUPPORTS_ELEMENT_REFS) {
        if (preparedLightLabels.length) {
            host.setAttribute(
                'aria-labelledby',
                preparedLightLabels.map((el) => el.id).join(' ')
            );
        }

        if (preparedLightDescriptions.length) {
            host.setAttribute(
                'aria-describedby',
                preparedLightDescriptions.map((el) => el.id).join(' ')
            );
        }

        return;
    }

    internals.role = role;
    internals.ariaLabelledByElements = preparedShadowLabels;
    internals.ariaDescribedByElements = preparedShadowDescriptions;
    host.ariaLabelledByElements = preparedLightLabels;
    host.ariaDescribedByElements = preparedLightDescriptions;

    applyShadowNameFallback(internals, preparedShadowLabels, preparedShadowDescriptions);
}

/**
 * When element refs do not read back, mirror shadow label/help text on internals.
 * @param {ElementInternals} internals
 * @param {HTMLElement[]} shadowLabels
 * @param {HTMLElement[]} shadowDescriptions
 */
function applyShadowNameFallback(internals, shadowLabels, shadowDescriptions) {
    if (shadowLabels.length && !internals.ariaLabelledByElements?.length) {
        internals.ariaLabel = shadowLabels
            .map((element) => element.textContent?.trim())
            .filter(Boolean)
            .join(' ');
    }

    if (shadowDescriptions.length && !internals.ariaDescribedByElements?.length) {
        const description = shadowDescriptions
            .map((element) => element.textContent?.trim())
            .filter(Boolean)
            .join(' ');

        if ('ariaDescription' in internals) {
            internals.ariaDescription = description;
        }
    }
}

/**
 * @param {HTMLElement} statusEl
 */
export function renderSupportStatus(statusEl) {
    statusEl.innerHTML = SUPPORTS_ELEMENT_REFS
        ? '<strong>Supported:</strong> Shadow label/help use <code>ElementInternals</code> element refs; light label/help use the host. Widget <code>role</code> is on the host.'
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

    lines.push(`host.role="${host.getAttribute('role') ?? ''}"`);

    if (SUPPORTS_ELEMENT_REFS) {
        lines.push(`internals.role="${internals.role ?? ''}"`);
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
    } else {
        lines.push(`aria-labelledby="${host.getAttribute('aria-labelledby') ?? ''}"`);
        lines.push(`aria-describedby="${host.getAttribute('aria-describedby') ?? ''}"`);
    }

    if (host.getAttribute('role') === 'checkbox') {
        lines.push(`aria-checked="${host.getAttribute('aria-checked') ?? ''}"`);
    }

    if (host.getAttribute('role') === 'textbox') {
        lines.push(`value="${host.getAttribute('value') ?? ''}"`);
    }

    if (host.getAttribute('role') === 'progressbar') {
        lines.push(`aria-valuenow="${host.getAttribute('aria-valuenow') ?? ''}"`);
        lines.push(`aria-valuemin="${host.getAttribute('aria-valuemin') ?? ''}"`);
        lines.push(`aria-valuemax="${host.getAttribute('aria-valuemax') ?? ''}"`);
        const valueText = host.getAttribute('aria-valuetext');
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

/**
 * @param {HTMLElement} host
 * @param {object} config
 * @param {string} config.labelTarget
 * @param {string} config.helpTarget
 * @param {HTMLElement} config.previousLabelSibling
 * @param {HTMLElement} config.nextHelpSibling
 */
export function resolveLightFieldRefs(host, config) {
    const labelEl = config.labelTarget
        ? document.getElementById(config.labelTarget)
        : config.previousLabelSibling?.matches('label')
          ? config.previousLabelSibling
          : null;

    const helpEl = config.helpTarget
        ? document.getElementById(config.helpTarget)
        : config.nextHelpSibling?.hasAttribute('data-help')
          ? config.nextHelpSibling
          : null;

    return {
        labelElements: [labelEl].filter(Boolean),
        descriptionElements: [helpEl].filter(Boolean),
    };
}
