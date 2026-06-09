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
 * @param {HTMLElement[]} elements
 */
function collectElementText(elements) {
    return elements
        .map((element) => element.textContent?.trim())
        .filter(Boolean)
        .join(' ');
}

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
 * Always mirror shadow label/help text on internals alongside element refs.
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

/**
 * @param {HTMLElement} host
 * @param {ElementInternals} internals
 * @param {string} role
 * @param {HTMLElement[]} labelElements
 * @param {HTMLElement[]} descriptionElements
 * @param {{ focusable?: boolean, resolveRefs?: () => { labelElements: HTMLElement[], descriptionElements: HTMLElement[] } }} [options]
 * @returns {() => void} resync — call when label/help text or slotted nodes change
 */
export function syncHostFieldAriaRefs(
    host,
    internals,
    role,
    labelElements = [],
    descriptionElements = [],
    options = {}
) {
    const { focusable = true, resolveRefs } = options;

    const resync = () => {
        const refs = resolveRefs?.() ?? { labelElements, descriptionElements };
        const activeLabels = refs.labelElements ?? labelElements;
        const activeDescriptions = refs.descriptionElements ?? descriptionElements;
        if (focusable) {
            host.setAttribute('tabindex', '0');
        } else {
            host.removeAttribute('tabindex');
        }

        const { light: lightLabels, shadow: shadowLabels } = partitionByRoot(activeLabels);
        const { light: lightDescriptions, shadow: shadowDescriptions } =
            partitionByRoot(activeDescriptions);

        const preparedLightLabels = prepareRefTargets(lightLabels);
        const preparedShadowLabels = prepareRefTargets(shadowLabels);
        const preparedLightDescriptions = prepareRefTargets(lightDescriptions);
        const preparedShadowDescriptions = prepareRefTargets(shadowDescriptions);

        if (!SUPPORTS_ELEMENT_REFS) {
            host.setAttribute('role', role);
            host.removeAttribute('aria-label');
            host.removeAttribute('aria-description');

            if (preparedLightLabels.length) {
                host.setAttribute(
                    'aria-labelledby',
                    preparedLightLabels.map((el) => el.id).join(' ')
                );
            } else {
                host.removeAttribute('aria-labelledby');
            }

            if (preparedLightDescriptions.length) {
                host.setAttribute(
                    'aria-describedby',
                    preparedLightDescriptions.map((el) => el.id).join(' ')
                );
            } else {
                host.removeAttribute('aria-describedby');
            }

            return;
        }

        host.removeAttribute('role');
        host.removeAttribute('aria-labelledby');
        host.removeAttribute('aria-describedby');

        internals.role = role;
        internals.ariaLabelledByElements = preparedShadowLabels;
        internals.ariaDescribedByElements = preparedShadowDescriptions;
        host.ariaLabelledByElements = preparedLightLabels;
        host.ariaDescribedByElements = preparedLightDescriptions;

        if (preparedShadowLabels.length || preparedShadowDescriptions.length) {
            mirrorShadowAccessibleName(
                internals,
                preparedShadowLabels,
                preparedShadowDescriptions
            );
        } else {
            internals.ariaLabel = null;
            if ('ariaDescription' in internals) {
                internals.ariaDescription = null;
            }
        }
    };

    resync();
    return resync;
}

/**
 * @param {HTMLElement} host
 * @param {{ labelSlot?: string, helpSlot?: string }} [options]
 */
export function collectSlottedFieldRefs(host, options = {}) {
    const { labelSlot = 'label', helpSlot = 'help-text' } = options;

    const labelSlotEl = host.shadowRoot?.querySelector(`slot[name="${labelSlot}"]`);
    const helpSlotEl = host.shadowRoot?.querySelector(`slot[name="${helpSlot}"]`);

    const labelElements = (
        labelSlotEl?.assignedElements({ flatten: true }) ?? []
    ).filter((element) => element instanceof HTMLElement);

    const descriptionElements = (
        helpSlotEl?.assignedElements({ flatten: true }) ?? []
    ).filter((element) => element instanceof HTMLElement);

    return { labelElements, descriptionElements };
}

/**
 * @param {HTMLElement[]} elements
 * @param {() => void} resync
 */
export function watchRefTargets(elements, resync) {
    const targets = elements.filter(Boolean);

    if (!targets.length) {
        return () => {};
    }

    const observer = new MutationObserver(resync);

    targets.forEach((target) => {
        observer.observe(target, {
            childList: true,
            characterData: true,
            subtree: true,
        });
    });

    return () => observer.disconnect();
}

/**
 * @param {HTMLElement} host
 * @param {() => void} resync
 * @param {{ labelSlot?: string, helpSlot?: string }} [options]
 */
export function watchSlottedFieldRefs(host, resync, options = {}) {
    const { labelSlot = 'label', helpSlot = 'help-text' } = options;

    const slots = [labelSlot, helpSlot]
        .map((name) => host.shadowRoot?.querySelector(`slot[name="${name}"]`))
        .filter(Boolean);

    slots.forEach((slot) => slot.addEventListener('slotchange', resync));

    return () => {
        slots.forEach((slot) => slot.removeEventListener('slotchange', resync));
    };
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
