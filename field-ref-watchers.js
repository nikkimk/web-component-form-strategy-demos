/**
 * Label/help source resolution and change watchers.
 */

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

/**
 * Resolve label/help refs for host-role fields in light or shadow mode.
 *
 * @param {HTMLElement} host
 * @param {object} config
 * @param {HTMLElement | null} [config.shadowLabelEl]
 * @param {HTMLElement | null} [config.shadowHelpEl]
 */
export function resolveSplitSurfaceFieldRefs(host, config) {
    const { shadowLabelEl = null, shadowHelpEl = null } = config;
    const shadowLabels = [shadowLabelEl].filter(Boolean);
    const shadowDescriptions = [shadowHelpEl].filter(Boolean);
    const useLightLabel = host.hasAttribute('label-target');

    if (!useLightLabel) {
        return {
            labelElements: shadowLabels,
            descriptionElements: shadowDescriptions,
        };
    }

    return resolveLightFieldRefs(host, {
        labelTarget: host.getAttribute('label-target') ?? '',
        helpTarget: host.getAttribute('help-target') ?? '',
    });
}
